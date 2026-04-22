function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-6 py-20">
        <p className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1 text-sm font-medium text-emerald-300">
          MERN + TypeScript + Tailwind
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Frontend ready in a separate folder
        </h1>
        <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
          This React app was scaffolded with Vite and configured with Tailwind
          CSS. Build your UI in the{" "}
          <code className="rounded bg-slate-800 px-2 py-1">frontend/src</code>{" "}
          folder.
        </p>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-left">
          <p className="mb-2 text-sm text-slate-400">Start frontend:</p>
          <code className="text-sm text-emerald-300">
            cd frontend && npm run dev
          </code>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-left">
          <p className="mb-2 text-sm text-slate-400">Start backend:</p>
          <code className="text-sm text-emerald-300">
            cd backend && npm run dev
          </code>
        </div>
      </section>
    </main>
  );
}

export default App;
