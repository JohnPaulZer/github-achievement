import { createHash } from "crypto";
import { ACHIEVEMENT_DEFINITIONS } from "../config/achievements";
import {
  getCachedAnalyzeResult,
  invalidateAnalyzeCacheByUsername,
  setCachedAnalyzeResult,
} from "../lib/cache";
import { AppError } from "../lib/errors";
import { createGitHubClient } from "../lib/githubClient";
import {
  AchievementId,
  AchievementResult,
  AnalyzeParams,
  AnalyzeResponse,
  GitHubEvent,
  GitHubIssueSearchResponse,
  GitHubPullRequest,
  GitHubPullRequestCommit,
  GitHubPullRequestReview,
  GitHubRepo,
  GitHubUser,
  VerificationStatus,
} from "../types";
import { computeStatus, computeTierSnapshot } from "../utils/tierUtils";

const PUBLIC_CACHE_TTL_SECONDS = Number(
  process.env.PUBLIC_CACHE_TTL_SECONDS ?? 120,
);
const AUTH_CACHE_TTL_SECONDS = Number(process.env.AUTH_CACHE_TTL_SECONDS ?? 90);
const AUTO_SYNC_INTERVAL_SECONDS = Number(
  process.env.AUTO_SYNC_INTERVAL_SECONDS ?? 120,
);
const MAX_OWNED_REPO_PAGES = 20;
const MAX_QUICKDRAW_EVENT_PAGES = 3;
const PUBLIC_PAIR_YOLO_INSPECTION_LIMIT = 30;
const AUTHENTICATED_PAIR_YOLO_INSPECTION_LIMIT = 150;
const MAX_MERGED_PR_SEARCH_PAGES = 5;
const PAIR_EXTRAORDINAIRE_GOLD_TARGET =
  ACHIEVEMENT_DEFINITIONS["pair-extraordinaire"].tiers[
    ACHIEVEMENT_DEFINITIONS["pair-extraordinaire"].tiers.length - 1
  ]?.target ?? 48;
const YOLO_DEFAULT_TARGET =
  ACHIEVEMENT_DEFINITIONS.yolo.tiers[
    ACHIEVEMENT_DEFINITIONS.yolo.tiers.length - 1
  ]?.target ?? 1;

interface GalaxyEstimateResult {
  count: number;
  limitation?: string;
  available: boolean;
}

interface SponsorResult {
  verificationStatus: VerificationStatus;
  count: number;
  limitation?: string;
}

interface MergedPrSearchResult {
  totalCount: number;
  items: GitHubIssueSearchResponse["items"];
}

function cacheTtlMs(hasToken: boolean): number {
  const seconds = hasToken ? AUTH_CACHE_TTL_SECONDS : PUBLIC_CACHE_TTL_SECONDS;
  return Math.max(0, seconds) * 1000;
}

function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, "");
}

function hashTokenForCache(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

function isSameUserLogin(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function parseRepositoryFromApiUrl(
  repositoryUrl: string,
): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(repositoryUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const reposIndex = parts.indexOf("repos");
    if (reposIndex === -1) {
      return null;
    }

    const owner = parts[reposIndex + 1];
    const repo = parts[reposIndex + 2];

    if (!owner || !repo) {
      return null;
    }

    return { owner, repo };
  } catch {
    return null;
  }
}

function buildSearchQuery(query: string): string {
  return encodeURIComponent(query);
}

async function fetchAllOwnedRepos(
  username: string,
  rest: ReturnType<typeof createGitHubClient>["rest"],
  useAuthenticatedSelfData: boolean,
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  const lowerUsername = username.toLowerCase();

  for (let page = 1; page <= MAX_OWNED_REPO_PAGES; page += 1) {
    const response = await rest<GitHubRepo[]>(
      useAuthenticatedSelfData
        ? `/user/repos?affiliation=owner&visibility=all&per_page=100&page=${page}`
        : `/users/${encodeURIComponent(username)}/repos?type=owner&per_page=100&page=${page}`,
    );

    repos.push(
      ...response.filter(
        (repo) => repo.owner.login.toLowerCase() === lowerUsername,
      ),
    );

    if (response.length < 100) {
      break;
    }
  }

  return repos;
}

async function fetchRecentEvents(
  username: string,
  rest: ReturnType<typeof createGitHubClient>["rest"],
  useAuthenticatedSelfData: boolean,
): Promise<GitHubEvent[]> {
  const events: GitHubEvent[] = [];

  for (let page = 1; page <= MAX_QUICKDRAW_EVENT_PAGES; page += 1) {
    const response = await rest<GitHubEvent[]>(
      useAuthenticatedSelfData
        ? `/users/${encodeURIComponent(username)}/events?per_page=100&page=${page}`
        : `/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`,
    );

    events.push(...response);

    if (response.length < 100) {
      break;
    }
  }

  return events;
}

async function fetchMergedPrSearchPage(
  username: string,
  rest: ReturnType<typeof createGitHubClient>["rest"],
  page: number,
): Promise<GitHubIssueSearchResponse> {
  const query = buildSearchQuery(
    `is:pr author:${username} is:merged sort:updated-desc`,
  );
  return rest<GitHubIssueSearchResponse>(
    `/search/issues?q=${query}&per_page=100&page=${page}`,
  );
}

async function fetchMergedPrSearch(
  username: string,
  rest: ReturnType<typeof createGitHubClient>["rest"],
  inspectionLimit: number,
): Promise<MergedPrSearchResult> {
  const items: GitHubIssueSearchResponse["items"] = [];
  let totalCount = 0;
  const pagesToFetch = Math.min(
    MAX_MERGED_PR_SEARCH_PAGES,
    Math.max(1, Math.ceil(inspectionLimit / 100)),
  );

  for (let page = 1; page <= pagesToFetch; page += 1) {
    const response = await fetchMergedPrSearchPage(username, rest, page);

    if (page === 1) {
      totalCount = response.total_count;
    }

    items.push(...response.items);

    if (response.items.length < 100) {
      break;
    }
  }

  return {
    totalCount,
    items: items.slice(0, inspectionLimit),
  };
}

function countQuickdrawMatches(
  username: string,
  events: GitHubEvent[],
): {
  count: number;
  inspectedEvents: number;
  samples: string[];
} {
  const lower = username.toLowerCase();
  const seen = new Set<string>();
  const samples: string[] = [];

  for (const event of events) {
    const action = event.payload.action;
    const isClosedAction = action === "closed";
    if (!isClosedAction) {
      continue;
    }

    const issue = event.payload.issue;
    const pr = event.payload.pull_request;
    const subject = issue ?? pr;

    if (!subject?.created_at || !subject.closed_at) {
      continue;
    }

    const openedBy = subject.user?.login?.toLowerCase();
    if (!openedBy || openedBy !== lower) {
      continue;
    }

    const createdTime = Date.parse(subject.created_at);
    const closedTime = Date.parse(subject.closed_at);
    if (Number.isNaN(createdTime) || Number.isNaN(closedTime)) {
      continue;
    }

    const minutesDiff = (closedTime - createdTime) / 1000 / 60;
    if (minutesDiff > 5 || minutesDiff < 0) {
      continue;
    }

    const key = `${event.repo.name}#${subject.number}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    if (samples.length < 3) {
      samples.push(subject.html_url);
    }
  }

  return {
    count: seen.size,
    inspectedEvents: events.length,
    samples,
  };
}

function containsCoAuthor(message: string): boolean {
  return /co-authored-by:/i.test(message);
}

async function inspectPairAndYoloSignals(
  mergedPrItems: GitHubIssueSearchResponse["items"],
  rest: ReturnType<typeof createGitHubClient>["rest"],
): Promise<{
  pairCount: number;
  yoloCount: number;
  inspectedPrs: number;
  notes: string[];
}> {
  let pairCount = 0;
  let yoloCount = 0;
  let inspectedPrs = 0;
  const notes: string[] = [];

  for (const item of mergedPrItems) {
    if (
      pairCount >= PAIR_EXTRAORDINAIRE_GOLD_TARGET &&
      yoloCount >= YOLO_DEFAULT_TARGET
    ) {
      break;
    }

    const repoData = parseRepositoryFromApiUrl(item.repository_url);
    if (!repoData) {
      continue;
    }

    const { owner, repo } = repoData;

    try {
      const [pullRequest, reviews, commits] = await Promise.all([
        rest<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${item.number}`),
        rest<GitHubPullRequestReview[]>(
          `/repos/${owner}/${repo}/pulls/${item.number}/reviews?per_page=100`,
        ),
        rest<GitHubPullRequestCommit[]>(
          `/repos/${owner}/${repo}/pulls/${item.number}/commits?per_page=100`,
        ),
      ]);

      if (!pullRequest.merged_at) {
        continue;
      }

      inspectedPrs += 1;
      const mergedAt = Date.parse(pullRequest.merged_at);

      const hasReviewBeforeMerge = reviews.some((review) => {
        if (!review.submitted_at) {
          return false;
        }

        const submittedTime = Date.parse(review.submitted_at);
        return !Number.isNaN(submittedTime) && submittedTime <= mergedAt;
      });

      if (!hasReviewBeforeMerge) {
        yoloCount += 1;
      }

      const hasCoauthoredCommit = commits.some((commit) =>
        containsCoAuthor(commit.commit.message),
      );

      if (hasCoauthoredCommit) {
        pairCount += 1;
      }
    } catch {
      notes.push(`Could not inspect PR #${item.number} for ${owner}/${repo}.`);
    }
  }

  return {
    pairCount,
    yoloCount,
    inspectedPrs,
    notes,
  };
}

async function getGalaxyBrainEstimate(
  username: string,
  rest: ReturnType<typeof createGitHubClient>["rest"],
): Promise<GalaxyEstimateResult> {
  const query = buildSearchQuery(
    `is:discussion is:answered commenter:${username}`,
  );

  try {
    const response = await rest<GitHubIssueSearchResponse>(
      `/search/issues?q=${query}&per_page=1&page=1`,
    );

    return {
      count: response.total_count,
      available: true,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        count: 0,
        available: false,
        limitation:
          "Official progress data is limited by GitHub API availability.",
      };
    }

    return {
      count: 0,
      available: false,
      limitation:
        "Official progress data is limited by GitHub API availability.",
    };
  }
}

interface SponsorGraphQL {
  viewer: {
    login: string;
    sponsorshipsAsSponsor: {
      totalCount: number;
    };
  };
}

async function getPublicSponsorStatus(
  username: string,
  token: string | undefined,
): Promise<SponsorResult> {
  if (!token) {
    return {
      verificationStatus: "unavailable",
      count: 0,
      limitation:
        "Provide a token to verify Public Sponsor status. Token is used only for this request.",
    };
  }

  const client = createGitHubClient(token);
  const query = `
    query SponsorStatus {
      viewer {
        login
        sponsorshipsAsSponsor(first: 1, includePrivate: false) {
          totalCount
        }
      }
    }
  `;

  try {
    const result = await client.graphql<SponsorGraphQL>(query);
    const viewer = result.viewer;

    if (viewer.login.toLowerCase() !== username.toLowerCase()) {
      return {
        verificationStatus: "unavailable",
        count: 0,
        limitation:
          "Token belongs to a different account. Use a token owned by the analyzed username.",
      };
    }

    const count = viewer.sponsorshipsAsSponsor.totalCount;
    return {
      verificationStatus: count > 0 ? "verified" : "not-verified",
      count,
    };
  } catch {
    return {
      verificationStatus: "unavailable",
      count: 0,
      limitation:
        "Could not verify Public Sponsor automatically with current token permissions.",
    };
  }
}

function buildAchievement(
  id: AchievementId,
  value: number,
  detectedStats: AchievementResult["detectedStats"],
  estimated: boolean,
  limitationNote?: string,
  verificationStatus?: VerificationStatus,
): AchievementResult {
  const definition = ACHIEVEMENT_DEFINITIONS[id];
  const firstTierTarget = definition.tiers[0]?.target ?? 1;
  const tierSnapshot = computeTierSnapshot(value, definition.tiers);
  const limited = Boolean(limitationNote);
  const status = computeStatus(value, firstTierTarget, limited);
  const achieved = value >= firstTierTarget;

  const base: AchievementResult = {
    id,
    name: definition.name,
    description: definition.description,
    instructions: definition.instructions,
    badgeImageUrl: definition.badgeImageUrl,
    currentValue: value,
    unit: definition.unit,
    tiers: definition.tiers,
    currentTier: tierSnapshot.currentTier,
    nextTier: tierSnapshot.nextTier,
    nextTarget: tierSnapshot.nextTarget,
    progressPercent: tierSnapshot.progressPercent,
    status,
    achieved,
    estimated,
    detectedStats,
  };

  if (limitationNote) {
    base.limitationNote = limitationNote;
  }

  if (verificationStatus) {
    base.verificationStatus = verificationStatus;
  }

  return base;
}

function normalizedIntervalSeconds(): number {
  const fallback = 120;
  if (
    Number.isNaN(AUTO_SYNC_INTERVAL_SECONDS) ||
    AUTO_SYNC_INTERVAL_SECONDS <= 0
  ) {
    return fallback;
  }

  return Math.min(300, Math.max(60, AUTO_SYNC_INTERVAL_SECONDS));
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function invalidateUserAchievementCache(username: string) {
  invalidateAnalyzeCacheByUsername(username);
}

export async function analyzeAchievementProgress(
  params: AnalyzeParams,
): Promise<AnalyzeResponse> {
  const username = normalizeUsername(params.username);
  if (!username) {
    throw new AppError(400, "INVALID_USERNAME", "Username is required.");
  }

  const token = params.token?.trim() || undefined;
  const cacheKey = `${username.toLowerCase()}:${
    token ? `auth:${hashTokenForCache(token)}` : "public"
  }`;
  const ttlMs = cacheTtlMs(Boolean(token));

  if (!params.forceRefresh && ttlMs > 0) {
    const cached = getCachedAnalyzeResult(cacheKey);
    if (cached) {
      return {
        ...cached.payload,
        cacheHit: true,
      };
    }
  }

  const client = createGitHubClient(token);
  const authenticatedViewer = token
    ? await client.rest<GitHubUser>("/user")
    : null;
  const useAuthenticatedSelfData = Boolean(
    authenticatedViewer && isSameUserLogin(authenticatedViewer.login, username),
  );
  const pairAndYoloInspectionLimit = useAuthenticatedSelfData
    ? AUTHENTICATED_PAIR_YOLO_INSPECTION_LIMIT
    : PUBLIC_PAIR_YOLO_INSPECTION_LIMIT;

  let user: GitHubUser;
  try {
    user =
      useAuthenticatedSelfData && authenticatedViewer
        ? authenticatedViewer
        : await client.rest<GitHubUser>(
            `/users/${encodeURIComponent(username)}`,
          );
  } catch (error) {
    if (error instanceof AppError && error.code === "GITHUB_NOT_FOUND") {
      throw new AppError(
        404,
        "USERNAME_NOT_FOUND",
        "GitHub username was not found.",
      );
    }

    throw error;
  }

  const [repos, events, mergedPrSearch, galaxyEstimate, sponsorResult] =
    await Promise.all([
      fetchAllOwnedRepos(username, client.rest, useAuthenticatedSelfData),
      fetchRecentEvents(username, client.rest, useAuthenticatedSelfData),
      fetchMergedPrSearch(
        username,
        client.rest,
        pairAndYoloInspectionLimit,
      ),
      getGalaxyBrainEstimate(username, client.rest),
      getPublicSponsorStatus(username, token),
    ]);

  const pairAndYoloInspection = await inspectPairAndYoloSignals(
    mergedPrSearch.items,
    client.rest,
  );

  const highestRepo = repos.reduce<GitHubRepo | null>((best, current) => {
    if (!best || current.stargazers_count > best.stargazers_count) {
      return current;
    }

    return best;
  }, null);

  const starstruckValue = highestRepo?.stargazers_count ?? 0;

  const quickdrawStats = countQuickdrawMatches(username, events);

  const limitations: string[] = [
    "Achievement progress is estimated where GitHub does not publish official badge counters.",
    useAuthenticatedSelfData
      ? "Authenticated self-analysis is enabled. Private repositories, private pull requests, and private events are included when the token can access them."
      : token && authenticatedViewer
        ? `Token belongs to @${authenticatedViewer.login}, so progress for @${username} is limited mostly to public activity. Use a token from the analyzed account for the best coverage.`
        : "Private activity may be missing when no token is provided.",
    useAuthenticatedSelfData
      ? "Quickdraw uses your authenticated event feed, but GitHub events can still be delayed and older events can fall out of the event history window."
      : "Quickdraw uses recent public event history and may not include older or private events.",
    `Pair Extraordinaire and YOLO inspect up to ${pairAndYoloInspectionLimit} recent merged PRs per sync.`,
  ];

  if (galaxyEstimate.limitation) {
    limitations.push(galaxyEstimate.limitation);
  }

  if (sponsorResult.limitation) {
    limitations.push(sponsorResult.limitation);
  }

  if (pairAndYoloInspection.notes.length > 0) {
    limitations.push(
      "Some pull requests could not be fully inspected due to API limits.",
    );
  }

  const achievements: AchievementResult[] = [
    buildAchievement(
      "starstruck",
      starstruckValue,
      {
        highestStarredRepo: highestRepo?.name ?? "None",
        highestStarredRepoUrl: highestRepo?.html_url ?? null,
        currentStarCount: starstruckValue,
        repoVisibilityChecked: useAuthenticatedSelfData
          ? "public and private owned repositories"
          : "public owned repositories only",
      },
      true,
      useAuthenticatedSelfData
        ? "Estimated from your highest-starred owned repository, including private repos visible to your token."
        : "Estimated from your highest-starred public owned repository.",
    ),
    buildAchievement(
      "quickdraw",
      quickdrawStats.count,
      {
        qualifyingQuickCloses: quickdrawStats.count,
        eventsInspected: quickdrawStats.inspectedEvents,
        eventVisibilityChecked: useAuthenticatedSelfData
          ? "public and private recent events"
          : "public recent events only",
        sampleMatches:
          quickdrawStats.samples.join(", ") ||
          "No qualifying quick closes found",
      },
      true,
      useAuthenticatedSelfData
        ? "Estimated from recent authenticated IssuesEvent and PullRequestEvent data, including private events returned by GitHub for your account."
        : "Estimated from recent public IssuesEvent and PullRequestEvent data.",
    ),
    buildAchievement(
      "pair-extraordinaire",
      pairAndYoloInspection.pairCount,
      {
        qualifyingMergedPrs: pairAndYoloInspection.pairCount,
        mergedPrsInspected: pairAndYoloInspection.inspectedPrs,
        inspectionWindow: `${pairAndYoloInspectionLimit} most recent merged PRs`,
      },
      true,
      `Estimated from co-authored commit metadata in up to ${pairAndYoloInspectionLimit} recent merged PRs.`,
    ),
    buildAchievement(
      "pull-shark",
      mergedPrSearch.totalCount,
      {
        totalMergedPrs: mergedPrSearch.totalCount,
        searchVisibilityChecked: useAuthenticatedSelfData
          ? "token-accessible public and private pull requests"
          : "public pull requests only",
      },
      true,
      useAuthenticatedSelfData
        ? "Estimated from GitHub pull-request search results, including private pull requests visible to your token."
        : "Estimated from GitHub pull-request search results.",
    ),
    buildAchievement(
      "galaxy-brain",
      galaxyEstimate.count,
      {
        acceptedDiscussionAnswers: galaxyEstimate.count,
        discussionVisibilityChecked: useAuthenticatedSelfData
          ? "token-accessible public and private discussions"
          : "public discussions only",
      },
      true,
      galaxyEstimate.limitation ??
        (useAuthenticatedSelfData
          ? "Estimated from discussion search, including private results visible to your token, because official counters are not fully exposed."
          : "Estimated from answered discussion search because official counters are not fully exposed."),
    ),
    buildAchievement(
      "yolo",
      pairAndYoloInspection.yoloCount,
      {
        unreviewedMergedPrs: pairAndYoloInspection.yoloCount,
        mergedPrsInspected: pairAndYoloInspection.inspectedPrs,
        inspectionWindow: `${pairAndYoloInspectionLimit} most recent merged PRs`,
      },
      true,
      `Estimated from review activity in up to ${pairAndYoloInspectionLimit} recent merged PRs.`,
    ),
    buildAchievement(
      "public-sponsor",
      sponsorResult.count,
      {
        publicSponsorshipsDetected: sponsorResult.count,
        verificationStatus: sponsorResult.verificationStatus,
      },
      false,
      sponsorResult.limitation,
      sponsorResult.verificationStatus,
    ),
  ];

  const now = new Date();

  const payload: AnalyzeResponse = {
    profile: {
      username: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      profileUrl: user.html_url,
      followers: user.followers,
      following: user.following,
      publicRepos: user.public_repos,
    },
    achievements,
    syncedAt: now.toISOString(),
    lastSyncedLabel: now.toLocaleString(),
    autoSyncEnabled: true,
    autoSyncIntervalSeconds: normalizedIntervalSeconds(),
    cacheHit: false,
    apiLimitations: dedupeStrings(limitations),
  };

  if (ttlMs > 0) {
    setCachedAnalyzeResult(cacheKey, payload, ttlMs);
  }

  return payload;
}
