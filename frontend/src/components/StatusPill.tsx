import type { AchievementStatus } from "../types";

interface StatusPillProps {
  status: AchievementStatus;
}

const statusClasses: Record<AchievementStatus, string> = {
  "Not started": "border-slate-200/80 bg-white/70 text-slate-500",
  "In progress": "border-sky-300/70 bg-sky-100/80 text-sky-700",
  "Near completion": "border-sky-300/70 bg-sky-100/80 text-sky-700",
  Achieved: "border-sky-300/70 bg-sky-100/80 text-sky-700",
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
