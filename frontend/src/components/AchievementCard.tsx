import { useEffect, useMemo, useRef, useState } from "react";
import type { AchievementResult } from "../types";
import GalaxyBrainBadge from "../assets/GalaxyBrain.png";
import GitHubSponsorBadge from "../assets/GitHubSponsorBadge.png";
import PairExtraordinaireBadge from "../assets/PairExtraordinaire.png";
import PullSharkBadge from "../assets/PullShark.png";
import QuickdrawBadge from "../assets/QuickDraw_SkinTone1.png";
import StarstruckBadge from "../assets/StarStruck_SkinTone1.png";
import YoloBadge from "../assets/YOLO_Badge.png";
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

const localAchievementBadgeMap: Record<AchievementResult["id"], string> = {
  starstruck: StarstruckBadge,
  quickdraw: QuickdrawBadge,
  "pair-extraordinaire": PairExtraordinaireBadge,
  "pull-shark": PullSharkBadge,
  "galaxy-brain": GalaxyBrainBadge,
  yolo: YoloBadge,
  "public-sponsor": GitHubSponsorBadge,
};

function resolveBadgeImage(achievement: AchievementResult): string {
  return localAchievementBadgeMap[achievement.id] ?? achievement.badgeImageUrl;
}

function DetailLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

function AchievementCard({
  achievement,
  highlighted = false,
}: AchievementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [animatedValue, setAnimatedValue] = useState(0);
  const previousValueRef = useRef(0);
  const badgeImageSrc = resolveBadgeImage(achievement);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      previousValueRef.current = achievement.currentValue;
      setAnimatedValue(achievement.currentValue);
      return;
    }

    const startValue = previousValueRef.current;
    const endValue = achievement.currentValue;
    const durationMs = 900;
    let frameId = 0;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(
        startValue + (endValue - startValue) * easedProgress,
      );

      setAnimatedValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
        return;
      }

      previousValueRef.current = endValue;
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [achievement.currentValue]);

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
      className={`group relative overflow-hidden rounded-[1.45rem] border border-white/70 bg-white/70 px-4 py-4 text-slate-900 shadow-[0_18px_44px_rgba(148,163,184,0.18)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(148,163,184,0.22)] ${
        highlighted ? "achievement-highlight" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-rose-200/80 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <img
          src={badgeImageSrc}
          alt={`${achievement.name} badge`}
          className="h-12 w-12 rounded-full border-2 border-white bg-white object-cover p-0.5 shadow-[0_10px_24px_rgba(148,163,184,0.18)]"
          loading="lazy"
        />
        <StatusPill status={achievement.status} />
      </div>

      <div className="mt-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          {achievement.name}
        </p>
        <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {animatedValue.toLocaleString()}
        </p>
        <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm">
          {achievement.description}
        </p>
      </div>

      <div className="mt-4 rounded-[1rem] border border-rose-100/80 bg-white/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span>
            {achievement.currentTier === "None"
              ? "Not started"
              : achievement.currentTier}
          </span>
          <span>{achievement.progressPercent.toFixed(0)}%</span>
        </div>
        <ProgressBar value={achievement.progressPercent} />
        <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] text-slate-600 sm:text-xs">
          <span>{progressCopy}</span>
          <span>{achievement.nextTier ? `To ${achievement.nextTier}` : "Max tier"}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs">
        {achievement.estimated ? (
          <span
            className="rounded-full border border-amber-300/70 bg-amber-100/85 px-2.5 py-1 text-amber-700"
            title="Best-effort estimate based on currently available GitHub API data"
          >
            Estimated
          </span>
        ) : (
          <span className="rounded-full border border-emerald-300/70 bg-emerald-100/85 px-2.5 py-1 text-emerald-700">
            Verified
          </span>
        )}
        {achievement.verificationStatus ? (
          <span className="rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-slate-600">
            Sponsor: {achievement.verificationStatus}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        className="mt-4 w-full rounded-full border border-rose-200/70 bg-white/75 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-white"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? "Hide Details" : "Show Details"}
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 rounded-[1.2rem] border border-white/70 bg-white/80 p-3.5 text-left text-xs sm:text-sm">
          <div className="flex items-center gap-3 rounded-[1rem] border border-rose-100/80 bg-rose-50/75 p-3">
            <img
              src={badgeImageSrc}
              alt={`${achievement.name} badge`}
              className="h-12 w-12 rounded-full border-2 border-white bg-white object-cover p-0.5"
              loading="lazy"
            />
            <div>
              <DetailLabel>Tier Summary</DetailLabel>
              <p className="mt-1.5 text-slate-800">{tierSummary}</p>
            </div>
          </div>

            <div>
              <DetailLabel>How To Earn</DetailLabel>
              <p className="mt-1.5 leading-6 text-slate-600">
                {achievement.instructions}
              </p>
            </div>

            <div>
              <DetailLabel>Progress Detail</DetailLabel>
              <p className="mt-1.5 text-slate-600">{tierProgressDetail}</p>
            </div>

            <div>
              <DetailLabel>Detected Stats</DetailLabel>
              <ul className="mt-2.5 space-y-2 text-slate-600">
                {Object.entries(achievement.detectedStats).map(([key, value]) => (
                  <li
                    key={key}
                    className="rounded-[0.9rem] border border-rose-100/80 bg-white/80 px-3 py-2"
                  >
                    <span className="text-slate-500">{formatStatLabel(key)}:</span>{" "}
                    {typeof value === "string" && isUrl(value) ? (
                      <a
                        href={value}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-700 transition hover:text-sky-600"
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
              <DetailLabel>Tier Targets</DetailLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {achievement.tiers.map((tier) => (
                  <span
                    key={tier.label}
                    className="rounded-full border border-rose-100/80 bg-rose-50/80 px-2.5 py-1 text-[11px] text-slate-600 sm:text-xs"
                  >
                    {tier.label}: {tier.target}
                  </span>
                ))}
              </div>
            </div>

          {achievement.limitationNote ? (
            <p className="rounded-[0.9rem] border border-amber-300/70 bg-amber-100/85 px-3 py-2.5 text-amber-800">
              {achievement.limitationNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default AchievementCard;
