interface ProgressBarProps {
  value: number;
}

function ProgressBar({ value }: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, value));

  return (
    <div
      className="h-2.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-950/70"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number(percentage.toFixed(0))}
      aria-label={`Progress ${percentage.toFixed(0)} percent`}
    >
      <div
        className="h-full rounded-full bg-sky-500 transition-all duration-500 dark:bg-sky-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default ProgressBar;
