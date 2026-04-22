import { useMemo, useState } from "react";
import type { AchievementResult } from "../types";
import ProgressBar from "./ProgressBar";
import StatusPill from "./StatusPill";

interface AchievementCardProps {
  achievement: AchievementResult;
  highlighted?: boolean;
}

function formatStatLabel(raw: string): string {
  return raw
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (value) => value.toUpperCase());
}

function formatStatValue(value: AchievementResult["detectedStats"][string]) {
  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === null || value === "") {
    return "Unavailable";
  }

  return String(value);
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function AchievementCard({
  achievement,
  highlighted = false,
}: AchievementCardProps) {
  const [expanded, setExpanded] = useState(false);

  const tierSummary = useMemo(() => {
    if (!achievement.nextTier || !achievement.nextTarget) {
      return "At highest configured tier";
    }

    return `Next tier: ${achievement.nextTier} at ${achievement.nextTarget.toLocaleString()} ${achievement.unit}`;
  }, [achievement.nextTarget, achievement.nextTier, achievement.unit]);

  const progressCopy = useMemo(() => {
    if (!achievement.nextTarget || !achievement.nextTier) {
      return `${achievement.currentValue.toLocaleString()} ${achievement.unit}`;
    }

    return `${achievement.currentValue.toLocaleString()} / ${achievement.nextTarget.toLocaleString()} ${achievement.unit}`;
  }, [
    achievement.currentValue,
    achievement.nextTarget,
    achievement.nextTier,
    achievement.unit,
  ]);

  const tierProgressDetail = useMemo(() => {
    if (!achievement.nextTarget || !achievement.nextTier) {
      return "Top configured tier reached";
    }

    const remaining = Math.max(achievement.nextTarget - achievement.currentValue, 0);
    return `${remaining.toLocaleString()} ${achievement.unit} to ${achievement.nextTier}`;
  }, [
    achievement.currentValue,
    achievement.nextTarget,
    achievement.nextTier,
    achievement.unit,
  ]);

  return (
    <article
      className={`rounded-2xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl transition-all ${
        highlighted ? "achievement-highlight" : ""
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <img
            src={achievement.badgeImageUrl}
            alt={`${achievement.name} badge`}
            className="h-14 w-14 rounded-lg border border-slate-700 object-cover"
            loading="lazy"
          />
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              {achievement.name}
            </h3>
            <p className="text-sm text-slate-400">{achievement.description}</p>
          </div>
        </div>
        <StatusPill status={achievement.status} />
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
        {achievement.estimated ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-200"
            title="Best-effort estimate based on currently available GitHub API data"
          >
            Estimated
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-400/40 text-[10px]"
            >
              i
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
            Verified
          </span>
        )}
        {achievement.verificationStatus ? (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
            Sponsor check: {achievement.verificationStatus}
          </span>
        ) : null}
      </div>

      <div className="mb-3 text-sm text-slate-200">
        <span className="font-semibold">Progress:</span>{" "}
        {progressCopy}
      </div>

      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span>{tierSummary}</span>
        <span>{achievement.progressPercent.toFixed(0)}%</span>
      </div>
      <ProgressBar value={achievement.progressPercent} />
      <p className="mt-2 text-xs text-slate-400">{tierProgressDetail}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300">
          Current tier: {achievement.currentTier}
        </span>
        {achievement.nextTier ? (
          <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300">
            Next: {achievement.nextTier}
          </span>
        ) : (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-300">
            Top tier reached
          </span>
        )}
      </div>

      <button
        type="button"
        className="mt-4 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? "Hide details" : "Show details"}
      </button>

      {expanded ? (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
              How to earn it
            </p>
            <p className="text-slate-200">{achievement.instructions}</p>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
              Detected stats
            </p>
            <ul className="space-y-1 text-slate-300">
              {Object.entries(achievement.detectedStats).map(([key, value]) => (
                <li key={key}>
                  <span className="text-slate-400">
                    {formatStatLabel(key)}:
                  </span>{" "}
                  {typeof value === "string" && isUrl(value) ? (
                    <a
                      href={value}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 hover:text-sky-200"
                    >
                      Open link
                    </a>
                  ) : (
                    formatStatValue(value)
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
              Tier targets
            </p>
            <div className="flex flex-wrap gap-2">
              {achievement.tiers.map((tier) => (
                <span
                  key={tier.label}
                  className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
                >
                  {tier.label}: {tier.target}
                </span>
              ))}
            </div>
          </div>

          {achievement.limitationNote ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
              {achievement.limitationNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default AchievementCard;
