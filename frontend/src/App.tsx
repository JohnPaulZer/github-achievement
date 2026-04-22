import type { FormEvent } from "react";
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

const DEFAULT_AUTO_SYNC_SECONDS = 120;
const LAST_USERNAME_STORAGE_KEY = "github-achievement-last-username";

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
        return `Rate limit reached. Add a token or try again after ${new Date(resetAt).toLocaleTimeString()}.`;
      }

      return "Rate limit reached. Add a token or try again after reset time.";
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
  const [achievementFilter, setAchievementFilter] = useState("");
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
        forceRefresh: true,
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
        forceRefresh: true,
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
        forceRefresh: true,
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

  const filteredAchievements = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const filter = achievementFilter.trim().toLowerCase();
    if (!filter) {
      return dashboard.achievements;
    }

    return dashboard.achievements.filter((achievement) =>
      [
        achievement.name,
        achievement.description,
        achievement.instructions,
        achievement.status,
        achievement.currentTier,
      ]
        .join(" ")
        .toLowerCase()
        .includes(filter),
    );
  }, [achievementFilter, dashboard]);

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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runAnalysis({ forceRefresh: true });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#1f2937_0,#0d1117_45%,#030712_100%)] px-4 py-10 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
                GitHub Inspired Live Tracker
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
                GitHub Achievement Progress Tracker
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
                Analyze selected GitHub achievements with best-effort
                estimation, live sync, and clear API limitation notes.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-center">
                <p className="text-slate-400">Tracked</p>
                <p className="font-semibold text-slate-100">
                  {achievementSummary.total}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-center">
                <p className="text-emerald-200">Unlocked</p>
                <p className="font-semibold text-emerald-50">
                  {achievementSummary.unlocked}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-center">
                <p className="text-amber-200">Estimated</p>
                <p className="font-semibold text-amber-50">
                  {achievementSummary.estimated}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <form
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
            onSubmit={handleSubmit}
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">
                GitHub username
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="octocat"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-400 transition focus:ring-2"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">
                GitHub token (optional)
              </span>
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                type="password"
                placeholder="ghp_..."
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-400 transition focus:ring-2"
              />
            </label>

            <div className="md:col-span-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
              Token is optional and never stored in any database. It is used in
              memory only for the current analysis request.
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">
                Search achievements
              </span>
              <input
                value={achievementFilter}
                onChange={(event) => setAchievementFilter(event.target.value)}
                placeholder="Filter by name, status, or tier"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-400 transition focus:ring-2"
              />
            </label>

            <div className="flex flex-wrap items-end gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg border border-sky-500/50 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Analyze Progress"}
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
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncing ? "Refreshing..." : "Refresh Progress"}
              </button>

              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(event) => setAutoSyncEnabled(event.target.checked)}
                  className="h-4 w-4"
                />
                Auto-sync enabled
              </label>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400 sm:text-sm">
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1">
              Last synced: {lastSyncedText}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1">
              Auto-refresh every {formatSyncInterval(syncIntervalSeconds)}
            </span>
            <span
              className={`rounded-full border px-3 py-1 ${
                sseConnected
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                  : "border-slate-700 bg-slate-950 text-slate-400"
              }`}
            >
              {sseConnected
                ? "Webhook sync connected"
                : "Webhook sync unavailable"}
            </span>
            {syncing ? (
              <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-sky-200">
                Syncing latest GitHub data
              </span>
            ) : null}
            {dashboard?.cacheHit ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">
                Served from short-term cache
              </span>
            ) : dashboard ? (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                Fresh sync
              </span>
            ) : null}
          </div>
        </section>

        {notifications.length > 0 ? (
          <section className="mb-6 space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100"
              >
                {notification.message}
              </div>
            ))}
          </section>
        ) : null}

        {errorMessage ? (
          <section className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </section>
        ) : null}

        {!loading && !dashboard && !errorMessage ? (
          <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-100">
              Start tracking progress
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Enter a GitHub username to estimate progress toward Starstruck,
              Quickdraw, Pair Extraordinaire, Pull Shark, Galaxy Brain, YOLO,
              and Public Sponsor. If you analyzed someone before on this
              device, the dashboard will refresh automatically when you return.
            </p>
          </section>
        ) : null}

        {dashboard?.profile ? (
          <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-slate-100">
              Profile summary
            </h2>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={dashboard.profile.avatarUrl}
                  alt={`${dashboard.profile.username} avatar`}
                  className="h-16 w-16 rounded-full border border-slate-700"
                />
                <div>
                  <a
                    href={dashboard.profile.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lg font-semibold text-sky-300 hover:text-sky-200"
                  >
                    {dashboard.profile.name ?? dashboard.profile.username}
                  </a>
                  <p className="text-sm text-slate-400">
                    @{dashboard.profile.username}
                  </p>
                  {dashboard.profile.bio ? (
                    <p className="mt-1 max-w-2xl text-sm text-slate-300">
                      {dashboard.profile.bio}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
                <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center">
                  <p className="text-slate-400">Repos</p>
                  <p className="font-semibold text-slate-100">
                    {dashboard.profile.publicRepos}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center">
                  <p className="text-slate-400">Followers</p>
                  <p className="font-semibold text-slate-100">
                    {dashboard.profile.followers}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center">
                  <p className="text-slate-400">Following</p>
                  <p className="font-semibold text-slate-100">
                    {dashboard.profile.following}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-slate-100">
              Achievement progress
            </h2>
            {dashboard ? (
              <p className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300 sm:text-sm">
                Some cards are labeled estimated because GitHub does not expose
                every official badge counter directly.
              </p>
            ) : null}
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAchievements.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  highlighted={highlightedAchievementIds.includes(
                    achievement.id,
                  )}
                />
              ))}
            </div>
          )}

          {!loading && dashboard && filteredAchievements.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              No achievement cards match your search filter.
            </p>
          ) : null}
        </section>

        {dashboard ? (
          <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="mb-3 text-lg font-semibold text-slate-100">
                Instructions
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {dashboard.achievements.map((achievement) => (
                  <li
                    key={achievement.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                  >
                    <span className="font-medium text-slate-100">
                      {achievement.name}:
                    </span>{" "}
                    {achievement.instructions}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="mb-3 text-lg font-semibold text-slate-100">
                API limitation notes
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {dashboard.apiLimitations.map((limitation) => (
                  <li
                    key={limitation}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100"
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
