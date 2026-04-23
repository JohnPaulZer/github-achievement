import { createHash } from "crypto";
import { ACHIEVEMENT_DEFINITIONS } from "../config/achievements";
import {
  getCachedAnalyzeResult,
  getMostRecentAnalyzeResult,
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
  TierLabel,
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
const inFlightAnalyzeRequests = new Map<string, Promise<AnalyzeResponse>>();
const SERVER_GITHUB_TOKEN =
  process.env.GITHUB_TOKEN?.trim() ||
  process.env.GITHUB_ACCESS_TOKEN?.trim() ||
  process.env.GITHUB_PAT?.trim() ||
  "";
const GITHUB_PROFILE_BASE_URL = "https://github.com";

const PROFILE_BADGE_TIER_LABELS: Record<string, TierLabel> = {
  x2: "Bronze",
  x3: "Silver",
  x4: "Gold",
};

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

interface OfficialAchievementBadge {
  id: AchievementId;
  tierLabel: TierLabel;
  minimumValue: number;
  displayLabel: string;
}

interface PublicProfileAchievementSnapshot {
  available: boolean;
  badges: Partial<Record<AchievementId, OfficialAchievementBadge>>;
  publicSponsoringCount: number | null;
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

function isAchievementId(value: string): value is AchievementId {
  return Object.prototype.hasOwnProperty.call(ACHIEVEMENT_DEFINITIONS, value);
}

function getTierTarget(id: AchievementId, label: TierLabel): number {
  const definition = ACHIEVEMENT_DEFINITIONS[id];
  return (
    definition.tiers.find((tier) => tier.label === label)?.target ??
    definition.tiers[0]?.target ??
    1
  );
}

function getProfileBadgeTier(block: string): {
  tierLabel: TierLabel;
  displayLabel: string;
} {
  const classMatch = block.match(
    /achievement-tier-label--(bronze|silver|gold)/i,
  );
  const classTier = classMatch?.[1]?.toLowerCase();

  if (classTier === "bronze") {
    return { tierLabel: "Bronze", displayLabel: "x2" };
  }

  if (classTier === "silver") {
    return { tierLabel: "Silver", displayLabel: "x3" };
  }

  if (classTier === "gold") {
    return { tierLabel: "Gold", displayLabel: "x4" };
  }

  const multiplierMatch = block.match(/>\s*(x[234])\s*</i);
  const multiplier = multiplierMatch?.[1]?.toLowerCase();
  const multiplierTier = multiplier
    ? PROFILE_BADGE_TIER_LABELS[multiplier]
    : undefined;

  if (multiplierTier && multiplier) {
    return { tierLabel: multiplierTier, displayLabel: multiplier };
  }

  return { tierLabel: "Default", displayLabel: "Default" };
}

function parseIntegerText(value: string): number | null {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOfficialAchievementBadges(
  html: string,
): Partial<Record<AchievementId, OfficialAchievementBadge>> {
  const badges: Partial<Record<AchievementId, OfficialAchievementBadge>> = {};
  const achievementLinkRegex =
    /<a\b[^>]*href="\/[^"]+\?achievement=([a-z-]+)(?:&amp;|&)tab=achievements"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(achievementLinkRegex)) {
    const id = match[1];
    const block = match[2];

    if (!id || !block || !isAchievementId(id)) {
      continue;
    }

    const { tierLabel, displayLabel } = getProfileBadgeTier(block);
    const minimumValue = getTierTarget(id, tierLabel);
    const existing = badges[id];

    if (!existing || minimumValue > existing.minimumValue) {
      badges[id] = {
        id,
        tierLabel,
        minimumValue,
        displayLabel,
      };
    }
  }

  return badges;
}

function parsePublicSponsoringCount(html: string): number | null {
  const sponsoringTabMatch = html.match(
    /data-tab-item="sponsoring"[\s\S]*?<span[^>]*>\s*Sponsoring\s*<\/span>\s*<span[^>]*class="Counter"[^>]*>([\s\S]*?)<\/span>/i,
  );

  if (!sponsoringTabMatch?.[1]) {
    return null;
  }

  const titleMatch = sponsoringTabMatch[0].match(/title="([^"]+)"/i);
  const titleCount = titleMatch?.[1] ? parseIntegerText(titleMatch[1]) : null;

  if (titleCount !== null) {
    return titleCount;
  }

  return parseIntegerText(sponsoringTabMatch[1].replace(/<[^>]+>/g, "").trim());
}

async function fetchPublicProfileAchievementSnapshot(
  username: string,
): Promise<PublicProfileAchievementSnapshot> {
  try {
    const response = await fetch(
      `${GITHUB_PROFILE_BASE_URL}/${encodeURIComponent(username)}`,
      {
        headers: {
          Accept: "text/html",
          "User-Agent": "github-achievement-progress-tracker",
        },
      },
    );

    if (!response.ok) {
      return {
        available: false,
        badges: {},
        publicSponsoringCount: null,
        limitation: `Could not read public GitHub profile achievements (HTTP ${response.status}).`,
      };
    }

    const html = await response.text();

    return {
      available: true,
      badges: parseOfficialAchievementBadges(html),
      publicSponsoringCount: parsePublicSponsoringCount(html),
    };
  } catch {
    return {
      available: false,
      badges: {},
      publicSponsoringCount: null,
      limitation: "Could not read public GitHub profile achievements.",
    };
  }
}

function getOfficialProfileBadge(
  snapshot: PublicProfileAchievementSnapshot,
  id: AchievementId,
): OfficialAchievementBadge | null {
  return snapshot.badges[id] ?? null;
}

function valueWithOfficialProfileFloor(
  value: number,
  id: AchievementId,
  snapshot: PublicProfileAchievementSnapshot,
): number {
  const officialBadge = getOfficialProfileBadge(snapshot, id);
  return Math.max(value, officialBadge?.minimumValue ?? 0);
}

function officialProfileDetectedStats(
  officialBadge: OfficialAchievementBadge | null,
): AchievementResult["detectedStats"] {
  if (!officialBadge) {
    return {};
  }

  return {
    officialProfileBadgeTier: officialBadge.tierLabel,
    officialProfileBadgeLabel: officialBadge.displayLabel,
    officialProfileMinimumValue: officialBadge.minimumValue,
  };
}

function officialProfileFloorNote(
  id: AchievementId,
  officialBadge: OfficialAchievementBadge | null,
  rawValue: number,
): string | undefined {
  if (!officialBadge || rawValue >= officialBadge.minimumValue) {
    return undefined;
  }

  const definition = ACHIEVEMENT_DEFINITIONS[id];
  return `Official GitHub profile badge confirms at least ${officialBadge.minimumValue} ${definition.unit} (${officialBadge.tierLabel}).`;
}

function joinNotes(
  ...notes: Array<string | undefined | false>
): string | undefined {
  const filtered = notes.filter((note): note is string => Boolean(note));
  return filtered.length > 0 ? filtered.join(" ") : undefined;
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
        // Exclude forks — Starstruck only counts repos the user originally created
        (repo) =>
          repo.owner.login.toLowerCase() === lowerUsername && !repo.fork,
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
    // Only IssuesEvent and PullRequestEvent can carry a "closed" action for Quickdraw
    if (event.type !== "IssuesEvent" && event.type !== "PullRequestEvent") {
      continue;
    }

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

// ---------------------------------------------------------------------------
// Pair Extraordinaire – GraphQL scan
// The REST search approach only finds public PRs. Using GraphQL user.pullRequests
// reaches private repos too (when the user provides their own token), which is
// critical for users whose co-authored work lives in private org repos.
// ---------------------------------------------------------------------------

interface PairExtraordinaireGraphQL {
  user: {
    pullRequests: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<{
        commits: {
          nodes: Array<{
            commit: { message: string };
          }>;
        };
      }>;
    };
  } | null;
}

// Fetch up to 5 pages × 50 PRs = 250 merged PRs via GraphQL.
// Each page requests 30 commits per PR to stay well within GitHub's
// GraphQL complexity limit (50 × 30 = 1 500 per query, max is 5 000).
const PAIR_GRAPHQL_MAX_PAGES = 5;

async function countPairExtraordinaireViaGraphQL(
  username: string,
  graphql: ReturnType<typeof createGitHubClient>["graphql"],
): Promise<{ count: number; inspected: number }> {
  const query = `
    query PairExtraordinaire($username: String!, $cursor: String) {
      user(login: $username) {
        pullRequests(states: MERGED, first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            commits(first: 30) {
              nodes {
                commit { message }
              }
            }
          }
        }
      }
    }
  `;

  let count = 0;
  let inspected = 0;
  let cursor: string | null = null;

  for (let page = 0; page < PAIR_GRAPHQL_MAX_PAGES; page += 1) {
    try {
      const result: PairExtraordinaireGraphQL =
        await graphql<PairExtraordinaireGraphQL>(query, {
          username,
          cursor,
        });

      const prs = result.user?.pullRequests;
      if (!prs) break;

      for (const pr of prs.nodes) {
        inspected += 1;
        const hasCoAuthor = pr.commits.nodes.some((c) =>
          containsCoAuthor(c.commit.message),
        );
        if (hasCoAuthor) {
          count += 1;
        }
      }

      if (!prs.pageInfo.hasNextPage) break;
      cursor = prs.pageInfo.endCursor;
    } catch {
      // GraphQL unavailable (no token, rate-limited, etc.) — return what we have
      break;
    }
  }

  return { count, inspected };
}

interface GalaxyBrainGraphQL {
  user: {
    repositoryDiscussionComments: {
      totalCount: number;
    };
  } | null;
}

async function getGalaxyBrainEstimate(
  username: string,
  graphql: ReturnType<typeof createGitHubClient>["graphql"],
): Promise<GalaxyEstimateResult> {
  // GitHub Discussions are NOT searchable via REST /search/issues.
  // The correct approach is GraphQL: fetch discussion comments by this user
  // that were marked as the accepted answer (onlyAnswers: true).
  const query = `
    query GalaxyBrainCount($username: String!) {
      user(login: $username) {
        repositoryDiscussionComments(onlyAnswers: true) {
          totalCount
        }
      }
    }
  `;

  try {
    const result = await graphql<GalaxyBrainGraphQL>(query, { username });
    const count = result.user?.repositoryDiscussionComments.totalCount ?? 0;

    return { count, available: true };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        count: 0,
        available: false,
        limitation:
          "Galaxy Brain data is limited by GitHub GraphQL API availability.",
      };
    }

    return {
      count: 0,
      available: false,
      limitation:
        "Galaxy Brain data is limited by GitHub GraphQL API availability.",
    };
  }
}

interface PublicSponsorUserGraphQL {
  user: {
    sponsorshipsAsSponsor: {
      totalCount: number;
    };
  } | null;
}

async function getPublicSponsorStatus(
  username: string,
  client: ReturnType<typeof createGitHubClient>,
  token: string | undefined,
): Promise<SponsorResult> {
  // GraphQL is required to query sponsorship data, so a token (any valid token,
  // not necessarily the analyzed user's) must be present.
  if (!token) {
    return {
      verificationStatus: "unavailable",
      count: 0,
      limitation:
        "Provide a token to verify Public Sponsor status. Any valid GitHub token is accepted.",
    };
  }

  // Query the target user's public outgoing sponsorships directly.
  // Using user(login: $username) rather than viewer means any token works —
  // the old viewer-based check required a token owned by the analyzed account.
  const query = `
    query PublicSponsorCheck($username: String!) {
      user(login: $username) {
        sponsorshipsAsSponsor(first: 1, includePrivate: false) {
          totalCount
        }
      }
    }
  `;

  try {
    const result = await client.graphql<PublicSponsorUserGraphQL>(query, {
      username,
    });

    if (!result.user) {
      return {
        verificationStatus: "unavailable",
        count: 0,
        limitation: "User not found when verifying Public Sponsor status.",
      };
    }

    const count = result.user.sponsorshipsAsSponsor.totalCount;
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

function readRateLimitResetAt(error: AppError): string | null {
  if (!error.details || typeof error.details !== "object") {
    return null;
  }

  const resetAt = (error.details as { resetAt?: unknown }).resetAt;
  return typeof resetAt === "string" ? resetAt : null;
}

function buildRateLimitedFallback(
  cachedPayload: AnalyzeResponse,
  error: AppError,
): AnalyzeResponse {
  const resetAt = readRateLimitResetAt(error);
  const retryMessage = resetAt
    ? `Showing the most recent cached result because GitHub rate-limited refresh requests until ${new Date(resetAt).toLocaleString()}.`
    : "Showing the most recent cached result because GitHub rate-limited refresh requests.";

  return {
    ...cachedPayload,
    cacheHit: true,
    apiLimitations: dedupeStrings([
      retryMessage,
      ...cachedPayload.apiLimitations,
    ]),
  };
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

  const requestToken = params.token?.trim() || undefined;
  const serverToken = requestToken
    ? undefined
    : SERVER_GITHUB_TOKEN || undefined;
  const token = requestToken ?? serverToken;
  const cacheScope = requestToken
    ? `auth:${hashTokenForCache(requestToken)}`
    : serverToken
      ? `server-auth:${hashTokenForCache(serverToken)}`
      : "public";
  const cacheKey = `${username.toLowerCase()}:${cacheScope}`;
  const ttlMs = cacheTtlMs(Boolean(token));
  const freshCached = getCachedAnalyzeResult(cacheKey);
  const mostRecentCached = getMostRecentAnalyzeResult(cacheKey);

  if (!params.forceRefresh && ttlMs > 0 && freshCached) {
    return {
      ...freshCached.payload,
      cacheHit: true,
    };
  }

  const inFlight = inFlightAnalyzeRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const requestPromise = (async () => {
    try {
      const client = createGitHubClient(token);
      const authenticatedViewer = token
        ? await client.rest<GitHubUser>("/user")
        : null;
      const usingServerToken = Boolean(serverToken);
      const useAuthenticatedSelfData = Boolean(
        authenticatedViewer &&
        isSameUserLogin(authenticatedViewer.login, username),
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

      const [
        repos,
        events,
        mergedPrSearch,
        galaxyEstimate,
        sponsorResult,
        pairGraphqlResult,
        profileAchievementSnapshot,
      ] = await Promise.all([
        fetchAllOwnedRepos(username, client.rest, useAuthenticatedSelfData),
        fetchRecentEvents(username, client.rest, useAuthenticatedSelfData),
        fetchMergedPrSearch(username, client.rest, pairAndYoloInspectionLimit),
        // Galaxy Brain: must use GraphQL — REST /search/issues does not index Discussions
        getGalaxyBrainEstimate(username, client.graphql),
        // Public Sponsor: pass the shared client so any token (server or user) is accepted
        getPublicSponsorStatus(username, client, token),
        // Pair Extraordinaire: GraphQL reaches private PRs the REST search misses
        countPairExtraordinaireViaGraphQL(username, client.graphql),
        // Public profile badges are the closest available signal to GitHub's official achievement state.
        fetchPublicProfileAchievementSnapshot(username),
      ]);

      const pairAndYoloInspection = await inspectPairAndYoloSignals(
        mergedPrSearch.items,
        client.rest,
      );

      // Take whichever scan found more co-authored PRs.
      // REST search covers recent public PRs with full review context (needed for YOLO).
      // GraphQL covers all merged PRs including private org repos (critical for Pair Extraordinaire).
      const rawPairCount = Math.max(
        pairAndYoloInspection.pairCount,
        pairGraphqlResult.count,
      );
      const pairCount = valueWithOfficialProfileFloor(
        rawPairCount,
        "pair-extraordinaire",
        profileAchievementSnapshot,
      );
      const pairInspectedTotal =
        pairAndYoloInspection.inspectedPrs + pairGraphqlResult.inspected;

      const highestRepo = repos.reduce<GitHubRepo | null>((best, current) => {
        if (!best || current.stargazers_count > best.stargazers_count) {
          return current;
        }

        return best;
      }, null);

      const rawStarstruckValue = highestRepo?.stargazers_count ?? 0;
      const starstruckProfileBadge = getOfficialProfileBadge(
        profileAchievementSnapshot,
        "starstruck",
      );
      const starstruckValue = valueWithOfficialProfileFloor(
        rawStarstruckValue,
        "starstruck",
        profileAchievementSnapshot,
      );
      const quickdrawStats = countQuickdrawMatches(username, events);
      const quickdrawProfileBadge = getOfficialProfileBadge(
        profileAchievementSnapshot,
        "quickdraw",
      );
      const quickdrawValue = valueWithOfficialProfileFloor(
        quickdrawStats.count,
        "quickdraw",
        profileAchievementSnapshot,
      );
      const pullSharkProfileBadge = getOfficialProfileBadge(
        profileAchievementSnapshot,
        "pull-shark",
      );
      const pullSharkValue = valueWithOfficialProfileFloor(
        mergedPrSearch.totalCount,
        "pull-shark",
        profileAchievementSnapshot,
      );
      const galaxyBrainProfileBadge = getOfficialProfileBadge(
        profileAchievementSnapshot,
        "galaxy-brain",
      );
      const galaxyBrainValue = valueWithOfficialProfileFloor(
        galaxyEstimate.count,
        "galaxy-brain",
        profileAchievementSnapshot,
      );
      const yoloProfileBadge = getOfficialProfileBadge(
        profileAchievementSnapshot,
        "yolo",
      );
      const yoloValue = valueWithOfficialProfileFloor(
        pairAndYoloInspection.yoloCount,
        "yolo",
        profileAchievementSnapshot,
      );
      const pairProfileBadge = getOfficialProfileBadge(
        profileAchievementSnapshot,
        "pair-extraordinaire",
      );
      const publicSponsorBadge = getOfficialProfileBadge(
        profileAchievementSnapshot,
        "public-sponsor",
      );
      const publicProfileSponsoringCount =
        profileAchievementSnapshot.publicSponsoringCount ?? 0;
      const rawSponsorCount = Math.max(
        sponsorResult.count,
        publicProfileSponsoringCount,
      );
      const sponsorValue = valueWithOfficialProfileFloor(
        rawSponsorCount,
        "public-sponsor",
        profileAchievementSnapshot,
      );
      const sponsorVerifiedViaPublicProfile = Boolean(
        publicSponsorBadge || publicProfileSponsoringCount > 0,
      );
      const sponsorVerificationStatus: VerificationStatus =
        sponsorVerifiedViaPublicProfile
          ? "verified"
          : sponsorResult.verificationStatus;
      const sponsorLimitation = sponsorVerifiedViaPublicProfile
        ? undefined
        : sponsorResult.limitation;
      const officialProfileFloorsApplied = (
        [
          ["starstruck", rawStarstruckValue],
          ["quickdraw", quickdrawStats.count],
          ["pair-extraordinaire", rawPairCount],
          ["pull-shark", mergedPrSearch.totalCount],
          ["galaxy-brain", galaxyEstimate.count],
          ["yolo", pairAndYoloInspection.yoloCount],
          ["public-sponsor", rawSponsorCount],
        ] as Array<[AchievementId, number]>
      )
        .filter(([id, value]) => {
          const badge = getOfficialProfileBadge(profileAchievementSnapshot, id);
          return Boolean(badge && value < badge.minimumValue);
        })
        .map(([id]) => ACHIEVEMENT_DEFINITIONS[id].name);

      const limitations: string[] = [
        "Achievement progress is estimated where GitHub does not publish official badge counters.",
        useAuthenticatedSelfData
          ? "Authenticated self-analysis is enabled. Private repositories, private pull requests, and private events are included when the token can access them."
          : requestToken && authenticatedViewer
            ? `Token belongs to @${authenticatedViewer.login}, so progress for @${username} is limited mostly to public activity. Use a token from the analyzed account for the best coverage.`
            : usingServerToken
              ? "Server GitHub token is enabled for higher API limits. Private activity is still unavailable unless you analyze with a token from the same GitHub account."
              : "Private activity may be missing when no token is provided.",
        useAuthenticatedSelfData
          ? "Quickdraw uses your authenticated event feed, but GitHub events can still be delayed and older events can fall out of the event history window."
          : "Quickdraw uses recent public event history and may not include older or private events.",
        `Pair Extraordinaire uses a GraphQL scan (up to ${PAIR_GRAPHQL_MAX_PAGES * 50} merged PRs, including private) combined with a REST review scan of up to ${pairAndYoloInspectionLimit} recent merged PRs for YOLO.`,
      ];

      if (profileAchievementSnapshot.limitation) {
        limitations.push(profileAchievementSnapshot.limitation);
      }

      if (officialProfileFloorsApplied.length > 0) {
        limitations.push(
          `Official public GitHub profile badges were used as lower-bound floors for: ${officialProfileFloorsApplied.join(", ")}.`,
        );
      }

      if (galaxyEstimate.limitation) {
        limitations.push(galaxyEstimate.limitation);
      }

      if (sponsorLimitation) {
        limitations.push(sponsorLimitation);
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
            apiHighestStarCount: rawStarstruckValue,
            repoVisibilityChecked: useAuthenticatedSelfData
              ? "public and private owned repositories"
              : "public owned repositories only",
            ...officialProfileDetectedStats(starstruckProfileBadge),
          },
          true,
          joinNotes(
            useAuthenticatedSelfData
              ? "Estimated from your highest-starred owned repository, including private repos visible to your token."
              : "Estimated from your highest-starred public owned repository.",
            officialProfileFloorNote(
              "starstruck",
              starstruckProfileBadge,
              rawStarstruckValue,
            ),
          ),
        ),
        buildAchievement(
          "quickdraw",
          quickdrawValue,
          {
            qualifyingQuickCloses: quickdrawValue,
            eventMatchesFound: quickdrawStats.count,
            eventsInspected: quickdrawStats.inspectedEvents,
            eventVisibilityChecked: useAuthenticatedSelfData
              ? "public and private recent events"
              : "public recent events only",
            sampleMatches:
              quickdrawStats.samples.join(", ") ||
              "No qualifying quick closes found",
            ...officialProfileDetectedStats(quickdrawProfileBadge),
          },
          true,
          joinNotes(
            useAuthenticatedSelfData
              ? "Estimated from recent authenticated IssuesEvent and PullRequestEvent data, including private events returned by GitHub for your account."
              : "Estimated from recent public IssuesEvent and PullRequestEvent data.",
            officialProfileFloorNote(
              "quickdraw",
              quickdrawProfileBadge,
              quickdrawStats.count,
            ),
          ),
        ),
        buildAchievement(
          "pair-extraordinaire",
          pairCount,
          {
            qualifyingMergedPrs: pairCount,
            estimatedFromApi: rawPairCount,
            foundViaGraphQL: pairGraphqlResult.count,
            foundViaRestInspection: pairAndYoloInspection.pairCount,
            totalPrsInspected: pairInspectedTotal,
            inspectionWindow: `GraphQL: up to ${PAIR_GRAPHQL_MAX_PAGES * 50} merged PRs (incl. private) + REST: ${pairAndYoloInspectionLimit} recent merged PRs`,
            ...officialProfileDetectedStats(pairProfileBadge),
          },
          true,
          joinNotes(
            pairGraphqlResult.count > 0
              ? `Detected via GraphQL scan of merged PRs (includes private repos accessible to the provided token).`
              : `Estimated from co-authored commit metadata. For private org repos, provide your own GitHub token for full coverage.`,
            officialProfileFloorNote(
              "pair-extraordinaire",
              pairProfileBadge,
              rawPairCount,
            ),
          ),
        ),
        buildAchievement(
          "pull-shark",
          pullSharkValue,
          {
            totalMergedPrs: pullSharkValue,
            apiSearchMergedPrs: mergedPrSearch.totalCount,
            searchVisibilityChecked: useAuthenticatedSelfData
              ? "token-accessible public and private pull requests"
              : "public pull requests only",
            ...officialProfileDetectedStats(pullSharkProfileBadge),
          },
          true,
          joinNotes(
            useAuthenticatedSelfData
              ? "Estimated from GitHub pull-request search results, including private pull requests visible to your token."
              : "Estimated from GitHub pull-request search results.",
            officialProfileFloorNote(
              "pull-shark",
              pullSharkProfileBadge,
              mergedPrSearch.totalCount,
            ),
          ),
        ),
        buildAchievement(
          "galaxy-brain",
          galaxyBrainValue,
          {
            acceptedDiscussionAnswers: galaxyBrainValue,
            graphqlAcceptedAnswers: galaxyEstimate.count,
            discussionVisibilityChecked: useAuthenticatedSelfData
              ? "token-accessible public and private discussions"
              : "public discussions only",
            ...officialProfileDetectedStats(galaxyBrainProfileBadge),
          },
          true,
          joinNotes(
            galaxyEstimate.limitation ??
              (useAuthenticatedSelfData
                ? "Estimated from discussion search, including private results visible to your token, because official counters are not fully exposed."
                : "Estimated from answered discussion search because official counters are not fully exposed."),
            officialProfileFloorNote(
              "galaxy-brain",
              galaxyBrainProfileBadge,
              galaxyEstimate.count,
            ),
          ),
        ),
        buildAchievement(
          "yolo",
          yoloValue,
          {
            unreviewedMergedPrs: yoloValue,
            apiUnreviewedMergedPrs: pairAndYoloInspection.yoloCount,
            mergedPrsInspected: pairAndYoloInspection.inspectedPrs,
            inspectionWindow: `${pairAndYoloInspectionLimit} most recent merged PRs`,
            ...officialProfileDetectedStats(yoloProfileBadge),
          },
          true,
          joinNotes(
            `Estimated from review activity in up to ${pairAndYoloInspectionLimit} recent merged PRs.`,
            officialProfileFloorNote(
              "yolo",
              yoloProfileBadge,
              pairAndYoloInspection.yoloCount,
            ),
          ),
        ),
        buildAchievement(
          "public-sponsor",
          sponsorValue,
          {
            publicSponsorshipsDetected: sponsorValue,
            graphqlSponsorshipsDetected: sponsorResult.count,
            publicProfileSponsoringCount:
              profileAchievementSnapshot.publicSponsoringCount,
            verificationStatus: sponsorVerificationStatus,
            ...officialProfileDetectedStats(publicSponsorBadge),
          },
          false,
          sponsorLimitation,
          sponsorVerificationStatus,
        ),
      ];

      // API limitations and estimation notes are included in the response for transparency, but the raw detected values and official profile badge floors are also included in the detectedStats of each achievement for clients that want to build their own UI or messaging around the limitations.
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
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "GITHUB_RATE_LIMIT" &&
        mostRecentCached
      ) {
        return buildRateLimitedFallback(mostRecentCached.payload, error);
      }

      throw error;
    } finally {
      inFlightAnalyzeRequests.delete(cacheKey);
    }
  })();

  inFlightAnalyzeRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
