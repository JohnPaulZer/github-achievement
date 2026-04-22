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
const MAX_QUICKDRAW_EVENT_PAGES = 3;
const MAX_PAIR_YOLO_INSPECTION = 30;

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

function cacheTtlMs(hasToken: boolean): number {
  const seconds = hasToken ? AUTH_CACHE_TTL_SECONDS : PUBLIC_CACHE_TTL_SECONDS;
  return Math.max(0, seconds) * 1000;
}

function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, "");
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
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];

  for (let page = 1; page <= 3; page += 1) {
    const response = await rest<GitHubRepo[]>(
      `/users/${encodeURIComponent(username)}/repos?type=owner&per_page=100&page=${page}`,
    );

    repos.push(...response);

    if (response.length < 100) {
      break;
    }
  }

  return repos;
}

async function fetchRecentEvents(
  username: string,
  rest: ReturnType<typeof createGitHubClient>["rest"],
): Promise<GitHubEvent[]> {
  const events: GitHubEvent[] = [];

  for (let page = 1; page <= MAX_QUICKDRAW_EVENT_PAGES; page += 1) {
    const response = await rest<GitHubEvent[]>(
      `/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`,
    );

    events.push(...response);

    if (response.length < 100) {
      break;
    }
  }

  return events;
}

async function fetchMergedPrSearch(
  username: string,
  rest: ReturnType<typeof createGitHubClient>["rest"],
): Promise<GitHubIssueSearchResponse> {
  const query = buildSearchQuery(
    `is:pr author:${username} is:merged sort:updated-desc`,
  );
  return rest<GitHubIssueSearchResponse>(
    `/search/issues?q=${query}&per_page=100&page=1`,
  );
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

  const candidates = mergedPrItems.slice(0, MAX_PAIR_YOLO_INSPECTION);

  for (const item of candidates) {
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
  const cacheKey = `${username.toLowerCase()}:${token ? "auth" : "public"}`;
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

  let user: GitHubUser;
  try {
    user = await client.rest<GitHubUser>(
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
      fetchAllOwnedRepos(username, client.rest),
      fetchRecentEvents(username, client.rest),
      fetchMergedPrSearch(username, client.rest),
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
    "Private activity may be missing when no token is provided.",
    "Quickdraw uses recent public event history and may not include older events.",
    `Pair Extraordinaire and YOLO inspect up to ${MAX_PAIR_YOLO_INSPECTION} recent merged PRs per sync.`,
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
      },
      true,
      "Estimated from your highest-starred owned repository.",
    ),
    buildAchievement(
      "quickdraw",
      quickdrawStats.count,
      {
        qualifyingQuickCloses: quickdrawStats.count,
        eventsInspected: quickdrawStats.inspectedEvents,
        sampleMatches:
          quickdrawStats.samples.join(", ") ||
          "No qualifying quick closes found",
      },
      true,
      "Estimated from recent public IssuesEvent and PullRequestEvent data.",
    ),
    buildAchievement(
      "pair-extraordinaire",
      pairAndYoloInspection.pairCount,
      {
        qualifyingMergedPrs: pairAndYoloInspection.pairCount,
        mergedPrsInspected: pairAndYoloInspection.inspectedPrs,
      },
      true,
      `Estimated from co-authored commit metadata in up to ${MAX_PAIR_YOLO_INSPECTION} recent merged PRs.`,
    ),
    buildAchievement(
      "pull-shark",
      mergedPrSearch.total_count,
      {
        totalMergedPrs: mergedPrSearch.total_count,
      },
      true,
      "Estimated from GitHub pull-request search results.",
    ),
    buildAchievement(
      "galaxy-brain",
      galaxyEstimate.count,
      {
        acceptedDiscussionAnswers: galaxyEstimate.count,
      },
      true,
      galaxyEstimate.limitation ??
        "Estimated from answered discussion search because official counters are not fully exposed.",
    ),
    buildAchievement(
      "yolo",
      pairAndYoloInspection.yoloCount,
      {
        unreviewedMergedPrs: pairAndYoloInspection.yoloCount,
        mergedPrsInspected: pairAndYoloInspection.inspectedPrs,
      },
      true,
      `Estimated from review activity in up to ${MAX_PAIR_YOLO_INSPECTION} recent merged PRs.`,
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
