import { formatMemberHours } from "@/components/groups/memberStats";
import Approx from "./Approx";
import { listNames, unitLabel, type Metric, type RankedMember } from "./compareModel";

export function YouTag() {
  return <span className="font-normal text-[var(--color-muted)]"> (you)</span>;
}

/** One divided ranked row: rank, name, value, a relative bar and the member's roast line. */
export function StandingRow({ row, metric }: { row: RankedMember; metric: Metric }) {
  const d = row.member.wrapped_data;
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-x-2 py-4">
      <span className="pt-0.5 text-sm font-semibold tabular-nums text-[var(--color-muted)]">
        <span className="sr-only">Rank </span>
        {row.rank}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 truncate font-semibold">
            {row.member.nickname}
            {row.isMe && <YouTag />}
          </h3>
          <p className="shrink-0 text-right tabular-nums">
            <span className="font-semibold">{row.value.toLocaleString()}</span>
            <span className="text-sm text-[var(--color-text-secondary)]"> {unitLabel(metric, row.value)}</span>
            {metric === "titles" && (
              <span className="block text-xs text-[var(--color-muted)]">
                <Approx text={formatMemberHours(d)} />
              </span>
            )}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="mt-2 h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--color-track)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, Math.round(row.share * 100))}%`,
              background: row.isMe
                ? "var(--color-track-strong)"
                : "color-mix(in srgb, var(--color-text) 22%, transparent)",
            }}
          />
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{row.roast}</p>
      </div>
    </li>
  );
}

interface NoteInput {
  metric: Metric;
  ranked: RankedMember[];
}

/** Footnote under a ranked list: what it is ranked by and why. */
export function metricNote({ metric, ranked }: NoteInput) {
  if (metric === "hours") return "Ranked by hours watched. Everyone's export has real watch times.";
  const members = ranked.map((r) => r.member);
  const dateOnlyNames = members.filter((m) => m.wrapped_data.hasTimeData !== true).map((m) => m.nickname);
  const allDateOnly = dateOnlyNames.length === members.length;
  const inflatedNames = members
    .filter((m) => typeof m.wrapped_data.distinctTitleDays !== "number" && m.wrapped_data.hasTimeData === true)
    .map((m) => m.nickname);
  const why = allDateOnly
    ? "Nobody's export has watch times, so hours would be a guess."
    : `${listNames(dateOnlyNames)}'s ${dateOnlyNames.length > 1 ? "exports have" : "export has"} dates only, so hours would be a guess.`;
  const older =
    inflatedNames.length > 0
      ? ` ${listNames(inflatedNames)}'s count comes from an older upload and may include repeat sittings.`
      : "";
  return `Ranked by titles, each counted once per day it was watched. ${why}${older}`;
}

export function StandingsList({ ranked, metric }: NoteInput) {
  return (
    <>
      <ol className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {ranked.map((row) => (
          <StandingRow key={row.member.id} row={row} metric={metric} />
        ))}
      </ol>
      <p className="mt-3 text-xs text-[var(--color-muted)]">{metricNote({ metric, ranked })}</p>
    </>
  );
}
