import { motion, useReducedMotion } from "motion/react";

const sponsorUrl = "https://github.com/sponsors/JohnPaulZer";

function SponsorFloatingAction() {
  const reduceMotion = useReducedMotion();
  const pokeTransition = reduceMotion
    ? undefined
    : {
        duration: 0.55,
        ease: "easeInOut" as const,
        repeat: Infinity,
        repeatDelay: 0.45,
      };

  return (
    <motion.a
      aria-label="Support JohnPaulZer on GitHub Sponsors"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-3"
      href={sponsorUrl}
      rel="noreferrer"
      target="_blank"
      whileHover={reduceMotion ? undefined : { y: -2 }}
    >
      <motion.span
        animate={reduceMotion ? undefined : { x: [0, 3, 0, 0] }}
        className="pointer-events-none relative hidden rounded-full border border-white/80 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-800 shadow-[0_14px_34px_rgba(71,85,105,0.16)] backdrop-blur-xl sm:inline-flex"
        transition={pokeTransition}
      >
        Support JohnPaulZer
        <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-white/80 bg-white/90" />
      </motion.span>

      <motion.span
        animate={
          reduceMotion
            ? undefined
            : {
                rotate: [0, -3, 3, 0, 0],
                scale: [1, 1.06, 0.9, 1.08, 1],
              }
        }
        className="relative flex h-12 w-12 items-center justify-center rounded-[0.9rem] border border-slate-700/70 bg-slate-950 text-pink-400 shadow-[0_16px_36px_rgba(15,23,42,0.24)] transition-colors duration-200 group-hover:border-pink-300/80 group-hover:text-pink-300 group-hover:shadow-[0_20px_42px_rgba(15,23,42,0.28)]"
        transition={pokeTransition}
        whileHover={reduceMotion ? undefined : { scale: 1.1, rotate: -2 }}
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
      >
        <motion.span
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0, 0.55, 0], x: [-14, -2, -14] }
          }
          className="absolute left-0 top-[calc(50%-0.375rem)] h-3 w-3 rounded-full bg-pink-300/70 blur-[1px]"
          transition={pokeTransition}
        />
        <motion.span
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0, 0.28, 0], scale: [1, 1.22, 1] }
          }
          className="absolute inset-0 rounded-[0.9rem] border border-pink-300/80"
          transition={pokeTransition}
        />

        <motion.svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          animate={reduceMotion ? undefined : { scale: [1, 0.84, 1.16, 1] }}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          transition={pokeTransition}
          viewBox="0 0 24 24"
        >
          <path d="M20.8 4.6c-1.9-1.8-4.9-1.7-6.7.2L12 7l-2.1-2.2C8.1 2.9 5.1 2.8 3.2 4.6 1.2 6.5 1.2 9.7 3 11.6l9 8.9 9-8.9c1.8-1.9 1.8-5.1-.2-7Z" />
        </motion.svg>

        <span className="pointer-events-none absolute bottom-full right-0 mb-3 w-64 translate-y-1 rounded-[1rem] border border-white/80 bg-white/95 px-4 py-3 text-left text-xs font-medium leading-5 text-slate-700 opacity-0 shadow-[0_18px_42px_rgba(71,85,105,0.18)] backdrop-blur-xl transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          Support JohnPaulZer with a minimum of $1 and get the sponsor badge.
          <span className="absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 border-b border-r border-white/80 bg-white/95" />
        </span>
      </motion.span>
    </motion.a>
  );
}

export default SponsorFloatingAction;
