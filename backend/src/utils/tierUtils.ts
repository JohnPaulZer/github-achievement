import { AchievementStatus, TierLabel, TierTarget } from "../types";

export interface TierSnapshot {
  currentTier: TierLabel | "None";
  nextTier: TierLabel | null;
  nextTarget: number | null;
  progressPercent: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeTierSnapshot(
  value: number,
  tiers: TierTarget[],
): TierSnapshot {
  let current: TierTarget | null = null;

  for (const tier of tiers) {
    if (value >= tier.target) {
      current = tier;
    } else {
      break;
    }
  }

  const next = tiers.find((tier) => tier.target > value) ?? null;

  if (!next) {
    return {
      currentTier: current?.label ?? "None",
      nextTier: null,
      nextTarget: null,
      progressPercent: 100,
    };
  }

  const previousTarget = current?.target ?? 0;
  const stepSize = next.target - previousTarget;
  const progress =
    stepSize > 0 ? ((value - previousTarget) / stepSize) * 100 : 0;

  return {
    currentTier: current?.label ?? "None",
    nextTier: next.label,
    nextTarget: next.target,
    progressPercent: clamp(progress, 0, 100),
  };
}

export function computeStatus(
  value: number,
  firstTierTarget: number,
  limitedOrUnavailable: boolean,
): AchievementStatus {
  if (limitedOrUnavailable && value <= 0) {
    return "Not started";
  }

  if (value <= 0) {
    return "Not started";
  }

  if (value >= firstTierTarget) {
    return "Achieved";
  }

  const ratio = value / firstTierTarget;
  if (ratio >= 0.8) {
    return "Near completion";
  }

  return "In progress";
}
