import { displayInviteCode } from "@/lib/supabase/groups";

const SIZES = {
  /** Inside a sentence ("No group uses the code …") */
  inline: "px-1.5 py-0.5 text-[0.95em]",
  /** Below a heading, next to the invite actions */
  md: "px-3 py-1.5 text-title",
  /** The code is the point of the block (a fresh group, an in-app browser) */
  lg: "px-4 py-2 text-headline",
} as const;

/**
 * The one way a code is shown for reading or sharing (DESIGN.md, Inputs / Fields: "Displayed
 * codes"): a single mono chip, 6px radius, Seat Row Raised, 1px Hairline, 0.2em tracking, always
 * uppercase. Never per-character boxes, which read as an input to fill in. `select-all` so one tap
 * selects the whole code for a manual copy.
 */
export default function InviteCodeChip({
  code,
  size = "md",
  className = "",
}: {
  code: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-[6px] font-mono font-semibold tracking-[0.2em] select-all whitespace-nowrap ${SIZES[size]} ${className}`}
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      {displayInviteCode(code)}
    </span>
  );
}
