interface ProgressBarProps {
  value: number;
}

function ProgressBar({ value }: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, value));

  return (
    <div
      className="h-2.5 w-full rounded-full bg-slate-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number(percentage.toFixed(0))}
      aria-label={`Progress ${percentage.toFixed(0)} percent`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-cyan-400 transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default ProgressBar;
