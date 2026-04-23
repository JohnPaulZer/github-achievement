import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

interface ErrorModalProps {
  message: string | null;
  onClose: () => void;
}

function ErrorModal({ message, onClose }: ErrorModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!message) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [message, onClose]);

  if (!message) {
    return null;
  }

  return createPortal(
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm dark:bg-slate-950/65"
      role="alertdialog"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-[1.35rem] border border-white/80 bg-white/95 p-5 text-slate-900 shadow-[0_26px_80px_rgba(71,85,105,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-100 dark:shadow-[0_26px_80px_rgba(2,6,23,0.5)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-200/80 bg-rose-50 text-lg font-semibold text-rose-500 dark:border-rose-300/20 dark:bg-rose-400/10 dark:text-rose-200">
            !
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Error
            </p>
            <h2 className="mt-1 text-xl font-semibold" id={titleId}>
              Unable to continue
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
              id={descriptionId}
            >
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            className="rounded-full bg-slate-950 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ErrorModal;
