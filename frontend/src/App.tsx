import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeAchievements,
  API_BASE_URL,
  ApiError,
} from "./api/achievementApi";
import AchievementCard from "./components/AchievementCard";
import LoadingSkeleton from "./components/LoadingSkeleton";
import type { AnalyzeResponse, UiNotification } from "./types";
import { detectAchievementChanges } from "./utils/changeDetection";

interface AnalyzeCredentials {
  username: string;
  token?: string;
}

interface IconProps {
  className?: string;
}

const DEFAULT_AUTO_SYNC_SECONDS = 120;
const LAST_USERNAME_STORAGE_KEY = "github-achievement-last-username";
const cosmicAuroraStyle = {
  backgroundImage: `
    radial-gradient(ellipse at 20% 30%, rgba(56, 189, 248, 0.4) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 70%, rgba(139, 92, 246, 0.3) 0%, transparent 70%),
    radial-gradient(ellipse at 60% 20%, rgba(236, 72, 153, 0.25) 0%, transparent 50%),
    radial-gradient(ellipse at 40% 80%, rgba(34, 197, 94, 0.2) 0%, transparent 65%)
  `,
};

function readResetAt(details: unknown): string | null {
  if (!details || typeof details !== "object") {
    return null;
  }

  const resetAt = (details as { resetAt?: unknown }).resetAt;
  return typeof resetAt === "string" ? resetAt : null;
}

function formatSyncInterval(seconds: number): string {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} min`;
  }

  return `${seconds}s`;
}

function mapErrorToMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "USERNAME_NOT_FOUND") {
      return "Invalid username. Please enter a valid GitHub username.";
    }

    if (error.code === "GITHUB_RATE_LIMIT") {
      const resetAt = readResetAt(error.details);
      if (resetAt) {
        return `Rate limit reached. Add a GitHub token in the app or set backend GITHUB_TOKEN, then try again after ${new Date(resetAt).toLocaleTimeString()}.`;
      }

      return "Rate limit reached. Add a GitHub token in the app or set backend GITHUB_TOKEN, then try again after the reset time.";
    }

    if (error.code === "GITHUB_TOKEN_INVALID") {
      return "Token is invalid or expired. Update the token and retry.";
    }

    if (error.code === "GITHUB_FORBIDDEN") {
      return "Token permissions are insufficient for one or more checks.";
    }

    return error.message;
  }

  return "Unable to analyze progress right now. Please try again.";
}

function SummaryIconFrame({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-sky-400/25 bg-sky-400/12 text-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      {children}
    </span>
  );
}

function AchievementGlyph({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 17.5V6.75A1.75 1.75 0 0 1 5.75 5h12.5A1.75 1.75 0 0 1 20 6.75V17.5" />
      <path d="M8 9.5h8" />
      <path d="M8 13h5" />
      <path d="m9 19 3-3 3 3" />
    </svg>
  );
}

function UnlockedGlyph({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m12 3 2.3 4.66L19.5 8l-3.75 3.66.88 5.19L12 14.4l-4.63 2.45.88-5.19L4.5 8l5.2-.34L12 3Z" />
      <path d="m9.25 12.25 1.8 1.8 3.7-4.05" />
    </svg>
  );
}

function EstimateGlyph({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.75v3.5" />
      <path d="m18.19 5.81-2.47 2.47" />
      <path d="M21.25 12h-3.5" />
      <path d="m18.19 18.19-2.47-2.47" />
      <path d="M12 17.75v3.5" />
      <path d="m8.28 15.72-2.47 2.47" />
      <path d="M6.25 12h-3.5" />
      <path d="m8.28 8.28-2.47-2.47" />
      <circle cx="12" cy="12" r="3.75" />
    </svg>
  );
}

function RepoGlyph({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 5.5h9A2.5 2.5 0 0 1 17.5 8v10.5H8.5A2.5 2.5 0 0 0 6 21V5.5Z" />
      <path d="M6 18.5A2.5 2.5 0 0 1 8.5 16h9.5" />
      <path d="M9 9h5" />
      <path d="M9 12h5" />
    </svg>
  );
}

function App() {
  const [username, setUsername] = useState(
    () => window.localStorage.getItem(LAST_USERNAME_STORAGE_KEY)?.trim() ?? "",
  );
  const [token, setToken] = useState("");
  const [dashboard, setDashboard] = useState<AnalyzeResponse | null>(null);
  const [activeCredentials, setActiveCredentials] =
    useState<AnalyzeCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const [highlightedAchievementIds, setHighlightedAchievementIds] = useState<
    string[]
  >([]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  const dashboardRef = useRef<AnalyzeResponse | null>(null);
  const notificationTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const restoredLastUsernameRef = useRef(false);
  const requestInFlightRef = useRef(false);

  const runAnalysis = useCallback(
    async (options?: {
      forceRefresh?: boolean;
      silent?: boolean;
      credentials?: AnalyzeCredentials;
    }) => {
      const credentialSource = options?.credentials ?? {
        username: username.trim(),
        token: token.trim() || undefined,
      };

      if (!credentialSource.username) {
        setErrorMessage("GitHub username is required.");
        return;
      }

      if (requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;

      if (options?.silent) {
        setSyncing(true);
      } else {
        setLoading(true);
      }

      if (!options?.silent || !dashboardRef.current) {
        setErrorMessage(null);
      }

      try {
        const response = await analyzeAchievements({
          username: credentialSource.username,
          token: credentialSource.token,
          forceRefresh: options?.forceRefresh,
        });

        const changeResult = detectAchievementChanges(
          dashboardRef.current?.achievements ?? null,
          response.achievements,
        );

        if (changeResult.notifications.length > 0) {
          setNotifications((existing) =>
            [...changeResult.notifications, ...existing].slice(0, 5),
          );

          if (notificationTimerRef.current) {
            window.clearTimeout(notificationTimerRef.current);
          }

          notificationTimerRef.current = window.setTimeout(() => {
            setNotifications([]);
          }, 6000);
        }

        if (changeResult.changedIds.length > 0) {
          setHighlightedAchievementIds(changeResult.changedIds);

          if (highlightTimerRef.current) {
            window.clearTimeout(highlightTimerRef.current);
          }

          highlightTimerRef.current = window.setTimeout(() => {
            setHighlightedAchievementIds([]);
          }, 5000);
        }

        window.localStorage.setItem(
          LAST_USERNAME_STORAGE_KEY,
          credentialSource.username,
        );

        dashboardRef.current = response;
        setDashboard(response);
        setActiveCredentials(credentialSource);
        setUsername(credentialSource.username);
      } catch (error) {
        if (!options?.silent || !dashboardRef.current) {
          setErrorMessage(mapErrorToMessage(error));
        }
      } finally {
        requestInFlightRef.current = false;
        setLoading(false);
        setSyncing(false);
      }
    },
    [token, username],
  );

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
      }

      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (restoredLastUsernameRef.current) {
      return;
    }

    restoredLastUsernameRef.current = true;
    if (!username.trim()) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void runAnalysis({
        credentials: {
          username: username.trim(),
        },
      });
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [runAnalysis, username]);

  useEffect(() => {
    if (!autoSyncEnabled || !activeCredentials) {
      return;
    }

    const syncIntervalSeconds = Math.max(
      60,
      Math.min(
        300,
        dashboard?.autoSyncIntervalSeconds ?? DEFAULT_AUTO_SYNC_SECONDS,
      ),
    );

    const timerId = window.setInterval(() => {
      void runAnalysis({
        silent: true,
        credentials: activeCredentials,
      });
    }, syncIntervalSeconds * 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [
    activeCredentials,
    autoSyncEnabled,
    dashboard?.autoSyncIntervalSeconds,
    runAnalysis,
  ]);

  useEffect(() => {
    if (!activeCredentials) {
      return;
    }

    const refreshVisibleDashboard = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void runAnalysis({
        silent: true,
        credentials: activeCredentials,
      });
    };

    window.addEventListener("focus", refreshVisibleDashboard);
    document.addEventListener("visibilitychange", refreshVisibleDashboard);

    return () => {
      window.removeEventListener("focus", refreshVisibleDashboard);
      document.removeEventListener("visibilitychange", refreshVisibleDashboard);
    };
  }, [activeCredentials, runAnalysis]);

  useEffect(() => {
    if (!activeCredentials?.username) {
      return;
    }

    const eventSource = new EventSource(
      `${API_BASE_URL}/api/sync/events/${encodeURIComponent(activeCredentials.username)}`,
    );

    const onConnected = () => {
      setSseConnected(true);
    };

    const onRefreshNeeded = () => {
      void runAnalysis({
        forceRefresh: true,
        silent: true,
        credentials: activeCredentials,
      });
    };

    eventSource.addEventListener("connected", onConnected);
    eventSource.addEventListener("refresh-needed", onRefreshNeeded);

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      eventSource.removeEventListener("connected", onConnected);
      eventSource.removeEventListener("refresh-needed", onRefreshNeeded);
      eventSource.close();
      setSseConnected(false);
    };
  }, [activeCredentials, runAnalysis]);

  const achievementSummary = useMemo(() => {
    if (!dashboard) {
      return {
        total: 0,
        unlocked: 0,
        estimated: 0,
      };
    }

    return {
      total: dashboard.achievements.length,
      unlocked: dashboard.achievements.filter((achievement) => achievement.achieved)
        .length,
      estimated: dashboard.achievements.filter(
        (achievement) => achievement.estimated,
      ).length,
    };
  }, [dashboard]);

  const syncIntervalSeconds =
    dashboard?.autoSyncIntervalSeconds ?? DEFAULT_AUTO_SYNC_SECONDS;
  const lastSyncedText = dashboard
    ? new Date(dashboard.syncedAt).toLocaleString()
    : "Not synced yet";
  const visibleAchievements = dashboard?.achievements ?? [];
  const summaryCards = useMemo(
    () => [
      {
        id: "tracked",
        label: "Tracked",
        value: achievementSummary.total.toLocaleString(),
        detail: "Achievement counters ready to watch",
        icon: <AchievementGlyph />,
      },
      {
        id: "unlocked",
        label: "Unlocked",
        value: achievementSummary.unlocked.toLocaleString(),
        detail: "Badges already earned on the profile",
        icon: <UnlockedGlyph />,
      },
      {
        id: "estimated",
        label: "Estimated",
        value: achievementSummary.estimated.toLocaleString(),
        detail: "Best-effort counters sourced from API clues",
        icon: <EstimateGlyph />,
      },
      {
        id: "repos",
        label: "Public Repos",
        value: (dashboard?.profile.publicRepos ?? 0).toLocaleString(),
        detail: dashboard?.profile
          ? `Loaded from @${dashboard.profile.username}`
          : "Displays after the first successful analysis",
        icon: <RepoGlyph />,
      },
    ],
    [
      achievementSummary.estimated,
      achievementSummary.total,
      achievementSummary.unlocked,
      dashboard?.profile?.publicRepos,
      dashboard?.profile?.username,
    ],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runAnalysis();
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="absolute inset-0 z-0" style={cosmicAuroraStyle} />
      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.38em] text-sky-200/80 sm:text-sm">
            GitHub Counter Board
          </p>
          <h1 className="mt-3 text-2xl font-semibold uppercase tracking-[0.14em] text-white sm:text-4xl">
            GitHub Achievement Number Animation
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-xs leading-6 text-slate-300 sm:text-sm">
            Analyze a GitHub profile, then watch each achievement settle into a
            cleaner counter-card layout with live sync and
            expandable details.
          </p>
        </header>

        <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article
              key={card.id}
              className="rounded-[1.5rem] border border-white/10 bg-[rgba(8,12,24,0.74)] px-4 py-4 text-center text-slate-100 shadow-[0_18px_54px_rgba(2,6,23,0.35)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_64px_rgba(2,6,23,0.42)]"
            >
              <div className="mb-3 flex justify-center">
                <SummaryIconFrame>{card.icon}</SummaryIconFrame>
              </div>
              <p className="font-mono text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {card.value}
              </p>
              <h2 className="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/90">
                {card.label}
              </h2>
              <p className="mt-1.5 text-xs text-slate-400">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
          <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(8,12,24,0.72)] p-5 shadow-[0_18px_54px_rgba(2,6,23,0.34)] backdrop-blur-md sm:p-6">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200/80">
                  Profile Input
                </p>
                <h2 className="mt-1.5 text-xl font-semibold text-white">
                  Choose a GitHub account
                </h2>
              </div>
              <p className="max-w-lg text-xs leading-6 text-slate-300 sm:text-sm">
                Tokens are used in memory only for the current request. Add one
                when you need the most accurate private-progress estimate.
              </p>
            </div>

            <form
              className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]"
              onSubmit={handleSubmit}
            >
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                  GitHub username
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="octocat"
                  className="rounded-[1rem] border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:bg-white/10 focus:ring-4 focus:ring-sky-400/15"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                  GitHub token
                </span>
                <input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  type="password"
                  placeholder="ghp_..."
                  className="rounded-[1rem] border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:bg-white/10 focus:ring-4 focus:ring-sky-400/15"
                />
              </label>

              <div className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 text-xs leading-6 text-slate-300 lg:col-span-2">
                Private tokens are never written to the database. The app uses
                them only while the current analysis runs, which helps when a
                profile needs extra API access for the cleanest badge estimate.
              </div>

              <div className="flex flex-col gap-2.5 rounded-[1.2rem] border border-white/10 bg-[rgba(14,20,36,0.9)] p-3 text-slate-100 shadow-[0_16px_48px_rgba(2,6,23,0.32)]">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-sky-400 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Analyzing..." : "Analyze Profile"}
                </button>

                <button
                  type="button"
                  disabled={!activeCredentials || syncing || loading}
                  onClick={() =>
                    void runAnalysis({
                      credentials: activeCredentials ?? undefined,
                      forceRefresh: true,
                      silent: true,
                    })
                  }
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncing ? "Refreshing..." : "Refresh Counters"}
                </button>

                <label className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(event) => setAutoSyncEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent text-emerald-400"
                  />
                  Auto-sync enabled
                </label>
              </div>
            </form>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.6rem] border border-white/10 bg-[rgba(8,12,24,0.72)] p-5 text-slate-100 shadow-[0_18px_54px_rgba(2,6,23,0.34)] backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200/90">
                Live Status
              </p>
              <div className="mt-4 space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between gap-4 rounded-[0.95rem] border border-white/10 bg-white/5 px-3.5 py-2.5">
                  <span className="text-slate-400">Last synced</span>
                  <span className="text-right text-slate-100">
                    {lastSyncedText}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[0.95rem] border border-white/10 bg-white/5 px-3.5 py-2.5">
                  <span className="text-slate-400">Auto refresh</span>
                  <span className="text-slate-100">
                    {formatSyncInterval(syncIntervalSeconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[0.95rem] border border-white/10 bg-white/5 px-3.5 py-2.5">
                  <span className="text-slate-400">Webhook sync</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      sseConnected
                        ? "bg-sky-400/15 text-sky-200"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {sseConnected ? "Connected" : "Unavailable"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[0.95rem] border border-white/10 bg-white/5 px-3.5 py-2.5">
                  <span className="text-slate-400">Data source</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      dashboard?.cacheHit
                        ? "bg-amber-300/15 text-amber-200"
                        : dashboard
                          ? "bg-emerald-400/15 text-emerald-200"
                          : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {dashboard?.cacheHit
                      ? "Short-term cache"
                      : dashboard
                        ? "Fresh sync"
                        : "Waiting"}
                  </span>
                </div>
                {syncing ? (
                  <div className="rounded-[0.95rem] border border-sky-400/20 bg-sky-400/10 px-3.5 py-2.5 text-sky-200">
                    Syncing the latest GitHub data in the background.
                  </div>
                ) : null}
              </div>
            </section>

            {dashboard?.profile ? (
              <section className="rounded-[1.6rem] border border-white/10 bg-[rgba(8,12,24,0.72)] p-5 shadow-[0_18px_54px_rgba(2,6,23,0.34)] backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200/80">
                  Profile Snapshot
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={dashboard.profile.avatarUrl}
                    alt={`${dashboard.profile.username} avatar`}
                    className="h-14 w-14 rounded-full border border-white/10 object-cover"
                  />
                  <div>
                    <a
                      href={dashboard.profile.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-base font-semibold text-white transition hover:text-sky-300"
                    >
                      {dashboard.profile.name ?? dashboard.profile.username}
                    </a>
                    <p className="text-xs text-slate-400 sm:text-sm">
                      @{dashboard.profile.username}
                    </p>
                  </div>
                </div>

                {dashboard.profile.bio ? (
                  <p className="mt-3 text-xs leading-6 text-slate-300 sm:text-sm">
                    {dashboard.profile.bio}
                  </p>
                ) : null}

                <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
                  <div className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Repos
                    </p>
                    <p className="mt-1.5 font-mono text-xl font-semibold text-white">
                      {dashboard.profile.publicRepos}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Followers
                    </p>
                    <p className="mt-1.5 font-mono text-xl font-semibold text-white">
                      {dashboard.profile.followers}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Following
                    </p>
                    <p className="mt-1.5 font-mono text-xl font-semibold text-white">
                      {dashboard.profile.following}
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[1.6rem] border border-dashed border-white/10 bg-[rgba(8,12,24,0.64)] p-5 backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200/80">
                  Start Tracking
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Load a profile to populate the board
                </h2>
                <p className="mt-2 text-xs leading-6 text-slate-300 sm:text-sm">
                  Enter a GitHub username to estimate progress toward
                  Starstruck, Quickdraw, Pair Extraordinaire, Pull Shark,
                  Galaxy Brain, YOLO, and Public Sponsor.
                </p>
              </section>
            )}
          </aside>
        </section>

        {notifications.length > 0 ? (
          <section className="mb-6 grid gap-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="rounded-[1.1rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100 shadow-[0_12px_32px_rgba(16,185,129,0.08)] sm:text-sm"
              >
                {notification.message}
              </div>
            ))}
          </section>
        ) : null}

        {errorMessage ? (
          <section className="mb-6 rounded-[1.2rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-xs text-rose-100 shadow-[0_12px_32px_rgba(244,63,94,0.08)] sm:text-sm">
            {errorMessage}
          </section>
        ) : null}

        <section className="mb-8">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200/80">
                Achievement Grid
              </p>
              <h2 className="mt-1.5 text-xl font-semibold uppercase tracking-[0.12em] text-white sm:text-2xl">
                Live Counter Tiles
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 sm:text-sm">
              <span className="rounded-full border border-white/10 bg-[rgba(8,12,24,0.72)] px-4 py-2 shadow-sm backdrop-blur-md">
                {visibleAchievements.length.toLocaleString()} total
              </span>
              {dashboard ? (
                <span className="rounded-full border border-white/10 bg-[rgba(8,12,24,0.72)] px-4 py-2 shadow-sm backdrop-blur-md">
                  Some counters stay estimated because GitHub does not expose
                  every badge value directly.
                </span>
              ) : null}
            </div>
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : dashboard ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {visibleAchievements.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  highlighted={highlightedAchievementIds.includes(
                    achievement.id,
                  )}
                />
              ))}
            </div>
          ) : !errorMessage ? (
            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-[rgba(8,12,24,0.64)] px-5 py-8 text-center shadow-[0_18px_54px_rgba(2,6,23,0.34)] backdrop-blur-md">
              <h3 className="text-xl font-semibold text-white">
                The counter board will appear here
              </h3>
              <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-slate-300 sm:text-sm">
                Once a profile is analyzed, each achievement renders as a dark
                counter tile inspired by the reference you shared, while keeping
                live refresh and detailed progress tracking intact.
              </p>
            </div>
          ) : null}
        </section>

        {dashboard ? (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(8,12,24,0.72)] p-5 shadow-[0_18px_54px_rgba(2,6,23,0.34)] backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200/80">
                How To Earn
              </p>
              <ul className="mt-4 space-y-2.5 text-xs leading-6 text-slate-300 sm:text-sm">
                {dashboard.achievements.map((achievement) => (
                  <li
                    key={achievement.id}
                    className="rounded-[1rem] border border-white/10 bg-white/5 px-3.5 py-2.5"
                  >
                    <span className="font-semibold text-white">
                      {achievement.name}:
                    </span>{" "}
                    {achievement.instructions}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(8,12,24,0.72)] p-5 shadow-[0_18px_54px_rgba(2,6,23,0.34)] backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200/80">
                API Notes
              </p>
              <ul className="mt-4 space-y-2.5 text-xs leading-6 text-slate-300 sm:text-sm">
                {dashboard.apiLimitations.map((limitation) => (
                  <li
                    key={limitation}
                    className="rounded-[1rem] border border-amber-300/20 bg-amber-300/10 px-3.5 py-2.5 text-amber-100"
                  >
                    {limitation}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default App;
