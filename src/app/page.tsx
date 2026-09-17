import Link from 'next/link';

/**
 * Landing (spec §5.1 "/"): a pure void. The Keeper Avatar simulation mounts here in
 * the next step. Ships no wallet code (architecture.md §4.7, design.md §7.5).
 */
export default function LandingPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-8 px-4 py-10">
      <header className="absolute left-4 top-4 flex items-center gap-3 sm:left-6 sm:top-6">
        <span className="font-display text-lg tracking-tight text-argon-400 glow-text">ARGON</span>
        <span className="label hidden sm:inline">eth 8h gate · v1</span>
      </header>

      <h1 className="text-center font-display text-4xl font-medium leading-tight tracking-tight text-text-hi sm:text-6xl">
        In the pool when the next eight hours look calm.
        <br />
        <span className="text-argon-400 glow-text">In cash when they don&apos;t.</span>
      </h1>

      <Link
        href="/app"
        className="inline-flex items-center rounded-chip border border-argon-500 bg-argon-600/30 px-5 py-2.5 text-label uppercase tracking-[0.12em] text-argon-300 transition-[box-shadow,background-color] hover:bg-argon-600/50 hover:shadow-glow-sm"
      >
        launch app →
      </Link>

      <footer className="absolute bottom-4 label text-text-dim">custody on-chain · judgment off-chain · the website is not the keeper</footer>
    </main>
  );
}
