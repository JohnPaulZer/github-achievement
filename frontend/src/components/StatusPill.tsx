import type { AchievementStatus } from "../types";

interface StatusPillProps {
  status: AchievementStatus;
}

const statusClasses: Record<AchievementStatus, string> = {
  "Not started": "border-slate-600 bg-slate-800 text-slate-300",
  "In progress": "border-sky-500/40 bg-sky-500/10 text-sky-300",
  "Near completion": "border-amber-500/40 bg-amber-500/10 text-amber-300",
  Achieved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {status}
    </span>
  );
}

export default StatusPill;
