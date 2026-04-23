import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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

const DEFAULT_AUTO_SYNC_SECONDS = 120;
const LAST_USERNAME_STORAGE_KEY = "github-achievement-last-username";
const cottonCandySkyStyle = {
  background:
    "linear-gradient(225deg, #FFB3D9 0%, #FFD1DC 20%, #FFF0F5 40%, #E6F3FF 60%, #D1E7FF 80%, #C7E9F1 100%)",
};

const geometricGridStyle = {
  backgroundImage: `
    linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px),
    radial-gradient(circle, rgba(51,65,85,0.4) 1px, transparent 1px)
  `,
  backgroundSize: "20px 20px, 20px 20px, 20px 20px",
  backgroundPosition: "0 0, 0 0, 0 0",
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

  const syncIntervalSeconds =
    dashboard?.autoSyncIntervalSeconds ?? DEFAULT_AUTO_SYNC_SECONDS;
  const lastSyncedText = dashboard
    ? new Date(dashboard.syncedAt).toLocaleString()
    : "Not synced yet";
  const visibleAchievements = dashboard?.achievements ?? [];
  const unlockedCount = visibleAchievements.filter(
    (achievement) => achievement.achieved,
  ).length;
  const estimatedCount = visibleAchievements.filter(
    (achievement) => achievement.estimated,
  ).length;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runAnalysis();
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="absolute inset-0 z-0" style={cottonCandySkyStyle} />
      <div
        className="absolute inset-0 z-0 opacity-70"
        style={geometricGridStyle}
      />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-sky-700/80 sm:text-sm">
              GitHub Counter Board
            </p>
            <h1 className="mt-2 text-2xl font-semibold uppercase tracking-[0.12em] text-slate-900 sm:text-4xl">
              Achievement Counter
            </h1>
            <p className="mt-3 max-w-2xl text-xs leading-6 text-slate-600 sm:text-sm">
              Analyze a profile and keep the achievement counters in one clean
              view.
            </p>
          </div>

          {dashboard?.profile ? (
            <a
              href={dashboard.profile.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-3 rounded-full border border-white/80 bg-white/75 py-2 pl-2 pr-4 text-sm text-slate-700 shadow-sm backdrop-blur-xl transition hover:bg-white"
            >
              <img
                src={dashboard.profile.avatarUrl}
                alt={`${dashboard.profile.username} avatar`}
                className="h-10 w-10 rounded-full border border-white object-cover"
              />
              <span>
                <span className="block font-semibold text-slate-900">
                  {dashboard.profile.name ?? dashboard.profile.username}
                </span>
                <span className="text-xs text-slate-500">
                  @{dashboard.profile.username}
                </span>
              </span>
            </a>
          ) : null}
        </header>

        <form
          className="grid grid-cols-1 gap-3 rounded-[1.4rem] border border-white/70 bg-white/72 p-3 shadow-[0_18px_44px_rgba(148,163,184,0.18)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end"
          onSubmit={handleSubmit}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Username
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="octocat"
              className="h-11 rounded-full border border-white/80 bg-white/90 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Token
            </span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              type="password"
              placeholder="optional"
              className="h-11 rounded-full border border-white/80 bg-white/90 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-pink-300 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-900 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Analyzing" : "Analyze"}
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
            className="h-11 rounded-full border border-rose-200/70 bg-white/85 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Refreshing" : "Refresh"}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:text-sm">
          <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm backdrop-blur-xl">
            {visibleAchievements.length.toLocaleString()} total
          </span>
          <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm backdrop-blur-xl">
            {unlockedCount.toLocaleString()} achieved
          </span>
          <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm backdrop-blur-xl">
            {estimatedCount.toLocaleString()} estimated
          </span>
          <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm backdrop-blur-xl">
            Synced: {lastSyncedText}
          </span>
          <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm backdrop-blur-xl">
            Auto: {autoSyncEnabled ? formatSyncInterval(syncIntervalSeconds) : "off"}
          </span>
          <label className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm backdrop-blur-xl">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(event) => setAutoSyncEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-sky-200 bg-transparent text-sky-500"
            />
            Auto-sync
          </label>
          {dashboard ? (
            <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm backdrop-blur-xl">
              {dashboard.cacheHit ? "Cache" : "Fresh"}
            </span>
          ) : null}
          <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm backdrop-blur-xl">
            {sseConnected ? "Live sync" : "Polling"}
          </span>
          {syncing ? (
            <span className="rounded-full border border-sky-300/70 bg-sky-100/80 px-3 py-1.5 text-sky-700">
              Syncing
            </span>
          ) : null}
        </div>

        {notifications.length > 0 ? (
          <div className="grid gap-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="rounded-[1rem] border border-emerald-300/70 bg-emerald-100/85 px-4 py-3 text-xs text-emerald-800 shadow-[0_12px_24px_rgba(16,185,129,0.08)] sm:text-sm"
              >
                {notification.message}
              </div>
            ))}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-[1rem] border border-rose-300/70 bg-rose-100/85 px-4 py-3 text-xs text-rose-800 shadow-[0_12px_24px_rgba(244,63,94,0.08)] sm:text-sm">
            {errorMessage}
          </div>
        ) : null}

        <section>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fuchsia-700/80">
                Achievements
              </p>
              <h2 className="mt-1 text-xl font-semibold uppercase tracking-[0.1em] text-slate-900 sm:text-2xl">
                Counter Tiles
              </h2>
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
            <div className="rounded-[1.4rem] border border-dashed border-rose-200/70 bg-white/65 px-5 py-8 text-center shadow-[0_18px_44px_rgba(148,163,184,0.18)] backdrop-blur-xl">
              <h3 className="text-xl font-semibold text-slate-900">
                Enter a GitHub username to start
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-slate-600 sm:text-sm">
                Your achievement cards will appear here after analysis.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default App;
