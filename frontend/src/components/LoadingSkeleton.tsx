function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg"
        >
          <div className="mb-4 h-16 w-16 animate-pulse rounded-lg bg-slate-800" />
          <div className="mb-2 h-5 w-40 animate-pulse rounded bg-slate-800" />
          <div className="mb-3 h-4 w-full animate-pulse rounded bg-slate-800" />
          <div className="mb-4 h-4 w-2/3 animate-pulse rounded bg-slate-800" />
          <div className="h-2 w-full animate-pulse rounded-full bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export default LoadingSkeleton;
