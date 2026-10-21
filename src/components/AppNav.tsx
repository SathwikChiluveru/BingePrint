import Link from "next/link";

/**
 * The thin bar every page past the landing shares: white wordmark home, plus at most one quiet
 * secondary. The wordmark stays white so each page's one red thing is its own primary action.
 * A secondary pointing home reads "Home" (never "Back"): it is a destination, not a history step,
 * so it never doubles a page's own inline back control.
 */
export default function AppNav({ secondary }: { secondary?: { href: string; label?: string } }) {
  const secondaryLabel = secondary ? (secondary.label ?? (secondary.href === "/" ? "Home" : undefined)) : undefined;
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "var(--color-bg-translucent)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-2" aria-label="Main">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-xl font-black"
          style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}
        >
          Autoplayed
        </Link>
        {secondary && secondaryLabel && (
          <Link href={secondary.href} className="btn-secondary px-4 text-sm">
            {secondaryLabel}
          </Link>
        )}
      </nav>
    </header>
  );
}
