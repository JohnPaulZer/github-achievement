import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AchievementResult } from "../types";
import { resolveBadgeImage } from "../utils/achievementBadges";
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [animatedValue, setAnimatedValue] = useState(0);
  const previousValueRef = useRef(0);
  const dialogTitleId = useId();
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

  useEffect(() => {
    if (!detailsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [detailsOpen]);

  const detailsContent = (
    <div className="space-y-3">
      <section className="rounded-[1rem] border border-slate-200/70 bg-white/80 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <DetailLabel>Progress</DetailLabel>
            <p className="mt-1 font-mono text-3xl font-semibold text-slate-900">
              {achievement.currentValue.toLocaleString()}
            </p>
          </div>
          <span className="rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs font-semibold text-sky-700">
            {achievement.progressPercent.toFixed(0)}%
          </span>
        </div>
        <ProgressBar value={achievement.progressPercent} />
        <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <p className="rounded-[0.8rem] bg-slate-50/85 px-3 py-2">
            Current: {achievement.currentTier}
          </p>
          <p className="rounded-[0.8rem] bg-sky-50/75 px-3 py-2">
            {tierSummary}
          </p>
        </div>
        <p className="mt-2 text-xs text-slate-500">{tierProgressDetail}</p>
      </section>

      <section className="rounded-[1rem] border border-slate-200/70 bg-white/70 p-3">
        <DetailLabel>How To Earn</DetailLabel>
        <p className="mt-1.5 leading-6 text-slate-600">
          {achievement.instructions}
        </p>
      </section>

      <section className="rounded-[1rem] border border-slate-200/70 bg-white/70 p-3">
        <DetailLabel>Detected Stats</DetailLabel>
        <dl className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          {Object.entries(achievement.detectedStats).map(([key, value]) => (
            <div
              key={key}
              className="rounded-[0.8rem] bg-white/85 px-3 py-2"
            >
              <dt className="text-slate-500">{formatStatLabel(key)}</dt>
              <dd className="mt-1 font-medium text-slate-700">
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
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-[1rem] border border-slate-200/70 bg-white/70 p-3">
        <DetailLabel>Tier Targets</DetailLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {achievement.tiers.map((tier) => (
            <span
              key={tier.label}
              className="rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-[11px] text-slate-600 sm:text-xs"
            >
              {tier.label}: {tier.target}
            </span>
          ))}
        </div>
      </section>

      {achievement.limitationNote ? (
        <p className="rounded-[1rem] border border-slate-200/80 bg-slate-50/90 px-3 py-2.5 text-sm text-slate-700">
          {achievement.limitationNote}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      <article
        className={`group relative flex min-h-[390px] flex-col overflow-hidden rounded-[1.55rem] border border-white/75 bg-[rgba(248,251,255,0.76)] px-4 py-4 text-slate-900 shadow-[0_18px_42px_rgba(148,163,184,0.16)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(148,163,184,0.2)] ${
          highlighted ? "achievement-highlight" : ""
        }`}
      >
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />

        <div className="flex items-start justify-between gap-3">
          <img
            src={badgeImageSrc}
            alt={`${achievement.name} badge`}
            className="h-12 w-12 rounded-full border-2 border-white bg-white object-cover p-0.5 shadow-[0_12px_28px_rgba(148,163,184,0.18)]"
            loading="lazy"
          />
          <StatusPill status={achievement.status} />
        </div>

        <div className="mt-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            {achievement.name}
          </p>
          <p className="mt-4 font-mono text-3xl font-semibold leading-none tracking-tight text-slate-950 sm:text-4xl">
            {animatedValue.toLocaleString()}
          </p>
          <p className="mx-auto mt-2 min-h-[2.5rem] max-w-[15rem] text-sm leading-5 text-slate-600">
            {achievement.description}
          </p>
        </div>

        <div className="mt-4 rounded-[1.05rem] border border-slate-200/70 bg-white/62 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
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
            <span>
              {achievement.nextTier ? `To ${achievement.nextTier}` : "Max tier"}
            </span>
          </div>
        </div>

        <div className="mt-3 flex min-h-[1.9rem] flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs">
          {achievement.estimated ? (
            <span
              className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-slate-600"
              title="Best-effort estimate based on currently available GitHub API data"
            >
              Estimated
            </span>
          ) : (
            <span className="rounded-full border border-sky-300/70 bg-sky-50/85 px-3 py-1 text-sky-700">
              Verified
            </span>
          )}
          {achievement.verificationStatus ? (
            <span className="rounded-full border border-slate-200/80 bg-white/75 px-3 py-1 text-slate-600">
              Sponsor: {achievement.verificationStatus}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          className="mt-auto w-full rounded-full border border-slate-200/80 bg-white/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-300 hover:bg-white"
          onClick={() => setDetailsOpen(true)}
        >
          Show Details
        </button>
      </article>

      {detailsOpen
        ? createPortal(
            <div
              aria-labelledby={dialogTitleId}
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
              role="dialog"
              onMouseDown={() => setDetailsOpen(false)}
            >
              <div
                className="scrollbar-invisible relative max-h-[min(720px,calc(100vh-3rem))] w-full max-w-xl overflow-y-auto rounded-[1.35rem] border border-white/80 bg-white/95 p-4 text-left text-sm text-slate-900 shadow-[0_26px_80px_rgba(71,85,105,0.24)] backdrop-blur-xl sm:p-5"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={badgeImageSrc}
                      alt={`${achievement.name} badge`}
                      className="h-14 w-14 rounded-full border-2 border-white bg-white object-cover p-0.5 shadow-sm"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <h3
                        className="text-xl font-semibold text-slate-900"
                        id={dialogTitleId}
                      >
                        {achievement.name}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                  <button
                    aria-label="Close details"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/85 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                  >
                    X
                  </button>
                </div>

                {detailsContent}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export default AchievementCard;
