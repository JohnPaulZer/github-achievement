import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

interface TokenTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const fineGrainedTokenUrl =
  "https://github.com/settings/personal-access-tokens/new?name=Achievement%20Counter&description=Read-only%20token%20for%20GitHub%20Achievement%20Counter&expires_in=30&contents=read&issues=read&pull_requests=read&discussions=read&user_events=read";

const classicTokenUrl = "https://github.com/settings/tokens/new";
const tokenDocsUrl =
  "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens";

function TokenTutorialModal({ open, onClose }: TokenTutorialModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
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
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm dark:bg-slate-950/65"
      role="dialog"
      onMouseDown={onClose}
    >
      <div
        className="scrollbar-invisible max-h-[min(720px,calc(100vh-3rem))] w-full max-w-2xl overflow-y-auto rounded-[1.35rem] border border-white/80 bg-white/95 p-5 text-slate-900 shadow-[0_26px_80px_rgba(71,85,105,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-100 dark:shadow-[0_26px_80px_rgba(2,6,23,0.5)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              GitHub API
            </p>
            <h2 className="mt-1 text-2xl font-semibold" id={titleId}>
              Token tutorial
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Paste a token in the Token field before analyzing. Use a token
              from the same GitHub account for the most accurate private
              repository and private pull request checks.
            </p>
          </div>
          <button
            aria-label="Close token tutorial"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/85 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            type="button"
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <section className="rounded-[1rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/70">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
              1. Create a fine-grained token
            </h3>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <li>Open the token page and choose an expiration date.</li>
              <li>Set Resource owner to the GitHub account you want to scan.</li>
              <li>
                Choose All repositories, or select only the repositories you
                want included.
              </li>
              <li>Generate the token and copy it before closing GitHub.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                href={fineGrainedTokenUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open token page
              </a>
              <a
                className="rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                href={tokenDocsUrl}
                rel="noreferrer"
                target="_blank"
              >
                GitHub docs
              </a>
            </div>
          </section>

          <section className="rounded-[1rem] border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
              2. Use read-only permissions
            </h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              <p className="rounded-[0.85rem] bg-slate-50/90 px-3 py-2 dark:bg-slate-800/70">
                Metadata: read
              </p>
              <p className="rounded-[0.85rem] bg-slate-50/90 px-3 py-2 dark:bg-slate-800/70">
                Contents: read
              </p>
              <p className="rounded-[0.85rem] bg-slate-50/90 px-3 py-2 dark:bg-slate-800/70">
                Pull requests: read
              </p>
              <p className="rounded-[0.85rem] bg-slate-50/90 px-3 py-2 dark:bg-slate-800/70">
                Issues: read
              </p>
              <p className="rounded-[0.85rem] bg-slate-50/90 px-3 py-2 dark:bg-slate-800/70">
                Discussions: read
              </p>
              <p className="rounded-[0.85rem] bg-slate-50/90 px-3 py-2 dark:bg-slate-800/70">
                Events: read, if shown
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Do not add write, admin, secret, workflow, or organization
              permissions for this app.
            </p>
          </section>

          <section className="rounded-[1rem] border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
              3. Paste and analyze
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Paste the copied token into the optional Token field, enter the
              matching username, then click Analyze. The app sends the token to
              the backend for GitHub API requests and keeps it only in the
              current browser session.
            </p>
          </section>

          <section className="rounded-[1rem] border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
              Classic token fallback
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              For public data only, a classic token with no scopes can raise the
              API limit. For private repository data, classic tokens need the
              broad repo scope, so use that only if you are comfortable with the
              wider access.
            </p>
            <a
              className="mt-3 inline-flex rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              href={classicTokenUrl}
              rel="noreferrer"
              target="_blank"
            >
              Classic token page
            </a>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default TokenTutorialModal;
