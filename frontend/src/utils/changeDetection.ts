import type { AchievementResult, UiNotification } from "../types";

function toMap(
  achievements: AchievementResult[],
): Map<string, AchievementResult> {
  return new Map(
    achievements.map((achievement) => [achievement.id, achievement]),
  );
}

function createNotification(message: string): UiNotification {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
  };
}

export function detectAchievementChanges(
  previous: AchievementResult[] | null,
  next: AchievementResult[],
): { notifications: UiNotification[]; changedIds: string[] } {
  if (!previous) {
    return { notifications: [], changedIds: [] };
  }

  const notifications: UiNotification[] = [];
  const changedIds = new Set<string>();
  const previousMap = toMap(previous);

  for (const current of next) {
    const older = previousMap.get(current.id);
    if (!older) {
      continue;
    }

    const valueDelta = current.currentValue - older.currentValue;
    const statusChanged = current.status !== older.status;
    const tierChanged = current.currentTier !== older.currentTier;
    const unlockedNow = !older.achieved && current.achieved;

    if (statusChanged || tierChanged || valueDelta > 0) {
      changedIds.add(current.id);
    }

    if (unlockedNow) {
      notifications.push(
        createNotification(`New achievement unlocked: ${current.name}`),
      );
      continue;
    }

    if (tierChanged && current.currentTier !== "None") {
      notifications.push(
        createNotification(
          `${current.name} tier advanced to ${current.currentTier}`,
        ),
      );
      continue;
    }

    if (statusChanged) {
      notifications.push(
        createNotification(
          `${current.name} status changed to ${current.status}`,
        ),
      );
      continue;
    }

    if (valueDelta > 0) {
      notifications.push(
        createNotification(`${current.name} progress updated (+${valueDelta})`),
      );
    }
  }

  return {
    notifications,
    changedIds: [...changedIds],
  };
}
