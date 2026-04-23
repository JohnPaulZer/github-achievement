interface ProgressBarProps {
  value: number;
  tone?: "default" | "bronze" | "silver" | "gold";
}

const toneClasses: Record<
  NonNullable<ProgressBarProps["tone"]>,
  { track: string; fill: string }
> = {
  default: {
    track: "bg-sky-200/85 dark:bg-sky-950/35",
    fill: "bg-sky-600 dark:bg-sky-300",
  },
  bronze: {
    track: "bg-amber-200/85 dark:bg-amber-950/45",
    fill: "bg-amber-600 dark:bg-amber-300",
  },
  silver: {
    track: "bg-slate-300/85 dark:bg-slate-700/85",
    fill: "bg-slate-600 dark:bg-slate-200",
  },
  gold: {
    track: "bg-yellow-200/88 dark:bg-yellow-950/45",
    fill: "bg-yellow-500 dark:bg-yellow-300",
  },
};

function ProgressBar({ value, tone = "default" }: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, value));
  const classes = toneClasses[tone];

  return (
    <div
      className={`h-2.5 w-full rounded-full ${classes.track}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number(percentage.toFixed(0))}
      aria-label={`Progress ${percentage.toFixed(0)} percent`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${classes.fill}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default ProgressBar;
