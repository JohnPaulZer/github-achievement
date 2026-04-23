function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[1.45rem] border border-white/10 bg-[rgba(8,12,24,0.74)] px-4 py-4 shadow-[0_18px_50px_rgba(2,6,23,0.35)] backdrop-blur-md"
        >
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-[1rem] bg-white/10" />
          <div className="mx-auto mb-2.5 h-3.5 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="mx-auto mb-3 h-10 w-28 animate-pulse rounded-full bg-white/10" />
          <div className="mb-4 h-3.5 w-full animate-pulse rounded-full bg-white/10" />
          <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3">
            <div className="mb-3 h-2 w-full animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default LoadingSkeleton;
