import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import loadingAnimationUrl from "../assets/Loading.lottie?url";

function AnalyzeLoading() {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-[1.4rem] border border-white/75 bg-[rgba(248,251,255,0.76)] px-5 py-10 text-center shadow-[0_18px_42px_rgba(148,163,184,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 dark:shadow-[0_18px_42px_rgba(2,6,23,0.32)]">
      <div className="flex flex-col items-center gap-3">
        <DotLottieReact
          src={loadingAnimationUrl}
          loop
          autoplay
          className="h-32 w-32"
        />
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Analyzing profile
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Checking GitHub achievement data.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AnalyzeLoading;
