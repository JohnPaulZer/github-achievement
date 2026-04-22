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

export interface AnalyzeRequest {
  username: string;
  token?: string;
  forceRefresh?: boolean;
}

export interface ApiErrorPayload {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
}

export interface UiNotification {
  id: string;
  message: string;
}
