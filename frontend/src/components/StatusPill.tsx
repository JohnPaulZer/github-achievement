import type { AchievementStatus } from "../types";

interface StatusPillProps {
  status: AchievementStatus;
}

const statusClasses: Record<AchievementStatus, string> = {
  "Not started":
    "border-slate-200/80 bg-white/70 text-slate-500 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300",
  "In progress":
    "border-sky-300/70 bg-sky-100/80 text-sky-700 dark:border-sky-300/25 dark:bg-sky-300/15 dark:text-sky-100",
  "Near completion":
    "border-sky-300/70 bg-sky-100/80 text-sky-700 dark:border-sky-300/25 dark:bg-sky-300/15 dark:text-sky-100",
  Achieved:
    "border-sky-300/70 bg-sky-100/80 text-sky-700 dark:border-sky-300/25 dark:bg-sky-300/15 dark:text-sky-100",
};

function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClasses[status]}`}
    >
      {status}
    </span>
  );
}

export default StatusPill;
