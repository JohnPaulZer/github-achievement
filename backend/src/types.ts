export type TierLabel = "Default" | "Bronze" | "Silver" | "Gold";

export type AchievementStatus =
  | "Not started"
  | "In progress"
  | "Near completion"
  | "Achieved";

export type VerificationStatus = "verified" | "not-verified" | "unavailable";

export type AchievementId =
  | "starstruck"
  | "quickdraw"
  | "pair-extraordinaire"
  | "pull-shark"
  | "galaxy-brain"
  | "yolo"
  | "public-sponsor";

export interface TierTarget {
  label: TierLabel;
  target: number;
}

export interface ProfileSummary {
  username: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  profileUrl: string;
  followers: number;
  following: number;
  publicRepos: number;
}

export interface AchievementResult {
  id: AchievementId;
  name: string;
  description: string;
  badgeImageUrl: string;
  instructions: string;
  currentValue: number;
  unit: string;
  currentTier: TierLabel | "None";
  nextTier: TierLabel | null;
  nextTarget: number | null;
  progressPercent: number;
  status: AchievementStatus;
  achieved: boolean;
  estimated: boolean;
  limitationNote?: string;
  detectedStats: Record<string, string | number | boolean | null>;
  tiers: TierTarget[];
  verificationStatus?: VerificationStatus;
}

export interface AnalyzeResponse {
  profile: ProfileSummary;
  achievements: AchievementResult[];
  syncedAt: string;
  lastSyncedLabel: string;
  autoSyncEnabled: boolean;
  autoSyncIntervalSeconds: number;
  cacheHit: boolean;
  apiLimitations: string[];
}

export interface AnalyzeParams {
  username: string;
  token?: string;
  forceRefresh?: boolean;
}

export interface CachedAnalyzeResult {
  payload: AnalyzeResponse;
  expiresAt: number;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  html_url: string;
  followers: number;
  following: number;
  public_repos: number;
}

export interface GitHubRepo {
  name: string;
  stargazers_count: number;
  html_url: string;
  private: boolean;
  owner: {
    login: string;
  };
}

export interface GitHubIssueSearchItem {
  number: number;
  title: string;
  repository_url: string;
  html_url: string;
  pull_request?: {
    url: string;
  };
}

export interface GitHubIssueSearchResponse {
  total_count: number;
  items: GitHubIssueSearchItem[];
}

export interface GitHubEvent {
  id: string;
  type: string;
  actor: {
    login: string;
  };
  repo: {
    name: string;
  };
  payload: {
    action?: string;
    issue?: {
      number: number;
      html_url: string;
      created_at?: string;
      closed_at?: string;
      user?: {
        login?: string;
      };
    };
    pull_request?: {
      number: number;
      html_url: string;
      created_at?: string;
      closed_at?: string;
      user?: {
        login?: string;
      };
    };
  };
}

export interface GitHubPullRequest {
  number: number;
  html_url: string;
  merged_at: string | null;
  merged: boolean;
}

export interface GitHubPullRequestReview {
  id: number;
  submitted_at: string | null;
}

export interface GitHubPullRequestCommit {
  sha: string;
  commit: {
    message: string;
  };
}
