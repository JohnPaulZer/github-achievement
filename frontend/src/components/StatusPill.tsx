import type { AchievementStatus } from "../types";

interface StatusPillProps {
  status: AchievementStatus;
}

const statusClasses: Record<AchievementStatus, string> = {
  "Not started": "border-white/10 bg-white/5 text-slate-300",
  "In progress": "border-sky-400/25 bg-sky-400/10 text-sky-200",
  "Near completion": "border-amber-300/25 bg-amber-300/10 text-amber-200",
  Achieved: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
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
