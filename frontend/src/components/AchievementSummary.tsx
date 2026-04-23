import type { AchievementResult } from "../types";
import { resolveBadgeImage } from "../utils/achievementBadges";

interface AchievementSummaryProps {
  achievements: AchievementResult[];
}

function getTierMultiplier(achievement: AchievementResult): string | null {
  if (achievement.currentTier === "Bronze") {
    return "x2";
  }

  if (achievement.currentTier === "Silver") {
    return "x3";
  }

  if (achievement.currentTier === "Gold") {
    return "x4";
  }

  return null;
}

function AchievementSummary({ achievements }: AchievementSummaryProps) {
  const earnedAchievements = achievements.filter(
    (achievement) => achievement.achieved,
  );

  if (earnedAchievements.length === 0) {
    return null;
  }

  return (
    <section className="w-full rounded-[1.45rem] border border-white/75 bg-white/72 px-5 py-4 shadow-[0_16px_36px_rgba(148,163,184,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72 dark:shadow-[0_16px_36px_rgba(2,6,23,0.32)] sm:w-fit sm:min-w-96">
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">
        Achievements
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {earnedAchievements.map((achievement) => {
          const multiplier = getTierMultiplier(achievement);

          return (
            <div
              key={achievement.id}
              className="relative h-14 w-14 shrink-0"
              title={`${achievement.name}${multiplier ? ` ${multiplier}` : ""}`}
            >
              <img
                src={resolveBadgeImage(achievement)}
                alt={achievement.name}
                className="h-14 w-14 rounded-full border-[3px] border-white bg-white object-cover shadow-[0_10px_22px_rgba(71,85,105,0.16)] dark:border-white/20 dark:bg-slate-800"
              />
              {multiplier ? (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:bg-white dark:text-slate-950 dark:ring-slate-900">
                  {multiplier}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default AchievementSummary;
