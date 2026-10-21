import Link from "next/link";
import type { Insights, UsageStat } from "@/types";
import { LockIcon } from "@/components/landing/icons";
import { FullExportSteps } from "@/components/wrapped/FullExportSteps";
import { ReceiptSection } from "./fields";
import { formatCount, formatHours } from "./money";

const LIST_LIMIT = 8;

/** "Mar 2024" from an ISO "YYYY-MM-DD" (local date, no timezone shift). */
function monthYear(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(y, m - 1, d || 1));
}

function plural(n: number, one: string, many: string) {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

function WarningIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

/** A divided list with thin share-of-time bars (Screen Track rail, Screen Track Strong fill). */
function UsageList({ id, title, items, nouns }: { id: string; title: string; items: UsageStat[]; nouns: [string, string] }) {
  if (items.length === 0) return null;
  const total = items.reduce((sum, i) => sum + i.seconds, 0);
  const shown = items.slice(0, LIST_LIMIT);
  const rest = items.length - shown.length;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 id={id} className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
        {title} <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>({formatCount(items.length)})</span>
      </h3>
      <ul aria-labelledby={id} className="divide-y" style={{ borderColor: "var(--color-border)" }}>
        {shown.map((item) => {
          const share = total > 0 ? (item.seconds / total) * 100 : 0;
          const shareText = share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`;
          return (
            <li key={item.name} className="flex flex-col gap-1.5 py-3" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium" title={item.name}>
                  {item.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                  {formatHours(item.seconds)} · {shareText}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--color-track)" }} aria-hidden="true">
                {share > 0 ? (
                  <div className="h-full rounded-full" style={{ width: `${Math.max(share, 1)}%`, background: "var(--color-track-strong)" }} />
                ) : (
                  <div className="h-px w-full" style={{ background: "var(--color-border-strong)" }} />
                )}
              </div>
              <span className="text-xs tabular-nums" style={{ color: "var(--color-muted)" }}>
                {plural(item.sessions, "play", "plays")} · {monthYear(item.firstSeen)}
                {item.firstSeen.slice(0, 7) !== item.lastSeen.slice(0, 7) ? ` to ${monthYear(item.lastSeen)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Plus {plural(rest, `more ${nouns[0]}`, `more ${nouns[1]}`)} with less time.
        </p>
      )}
    </div>
  );
}

function SharingVerdict({ insights }: { insights: Insights }) {
  const sharing = insights.sharing;
  if (!sharing) return null;
  const devices = insights.devices?.length ?? 0;
  const countries = insights.countries?.length ?? 0;
  const profiles = insights.profiles?.length ?? 0;

  if (sharing.suspicious) {
    return (
      <div
        data-testid="sharing-callout"
        className="flex flex-col gap-4 rounded-2xl p-5 sm:p-6"
        style={{ background: "rgba(245, 166, 35, 0.08)", border: "1px solid rgba(245, 166, 35, 0.35)" }}
      >
        <div className="flex items-center gap-3">
          <span className="shrink-0" style={{ color: "var(--color-warning)" }}>
            <WarningIcon />
          </span>
          <h3 className="text-title font-semibold">Someone else might be on your account</h3>
        </div>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Not proof, just patterns worth a look. Here&rsquo;s what stood out:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-[var(--color-muted)]">
          {sharing.signals.map((s) => (
            <li key={`${s.kind}-${s.date}-${s.detail}`}>{s.detail}</li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
          <h4 className="text-sm font-semibold">If none of that was you or yours</h4>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm marker:text-[var(--color-muted)]" style={{ color: "var(--color-text-secondary)" }}>
            <li>
              On netflix.com, open Account, then{" "}
              <strong style={{ color: "var(--color-text)" }}>Manage access and devices</strong>, and sign out the
              ones you don&rsquo;t know (or all of them).
            </li>
            <li>Change your Netflix password, and tick the box to sign out of all devices.</li>
            <li>Ask around first. A family member on holiday looks exactly like this.</li>
          </ol>
        </div>
      </div>
    );
  }

  const evidence = [
    plural(devices, "device", "devices"),
    plural(countries, "country", "countries"),
    plural(profiles, "profile", "profiles"),
  ].join(", ");
  const noOverlap = !sharing.signals.some((s) => s.kind === "overlap");
  return (
    <div data-testid="sharing-clear" className="card flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="shrink-0" style={{ color: "var(--color-success)" }}>
          <CheckIcon />
        </span>
        <h3 className="text-title font-semibold">No signs of a stranger on your account</h3>
      </div>
      <p style={{ color: "var(--color-text-secondary)" }}>
        {evidence}.{noOverlap ? " Nothing ever played on two devices at once." : ""}
      </p>
      {sharing.signals.length > 0 && (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm marker:text-[var(--color-muted)]" style={{ color: "var(--color-text-secondary)" }}>
          {sharing.signals.map((s) => (
            <li key={`${s.kind}-${s.date}-${s.detail}`}>{s.detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Quick export (no devices in the file) or stats saved before insights existed. */
function Locked({ reason }: { reason: "quick" | "old" }) {
  return (
    <div data-testid={reason === "quick" ? "account-locked" : "account-readd"} className="card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="shrink-0" style={{ color: "var(--color-muted)" }}>
          <LockIcon size={20} />
        </span>
        <h3 className="text-title font-semibold">
          {reason === "quick" ? "Your quick export keeps this locked" : "Re-add your file to see this"}
        </h3>
      </div>
      <p style={{ color: "var(--color-text-secondary)" }}>
        {reason === "quick"
          ? "NetflixViewingHistory.csv has titles and dates only. Devices, countries and profiles come with the full data request."
          : "This reel was saved before the account check existed. Add your file again and it shows up here."}
      </p>
      {reason === "quick" && <FullExportSteps className="[overflow-wrap:anywhere]" />}
      <Link href="/upload" className="btn-secondary self-start px-5 text-sm">
        {reason === "quick" ? "Add the full file" : "Re-add my file"}
      </Link>
    </div>
  );
}

/** Section 3: who has been watching, from where, on what. */
export function AccountCheck({ insights }: { insights: Insights | undefined }) {
  const hasUsage = !!insights && (insights.devices !== null || insights.countries !== null || insights.profiles !== null);
  return (
    <ReceiptSection
      id="receipts-account"
      title="Devices and countries"
      lead="An account check: every screen, place and profile in your file."
    >
      {!insights ? (
        <Locked reason="old" />
      ) : !hasUsage ? (
        <Locked reason="quick" />
      ) : (
        <>
          <SharingVerdict insights={insights} />
          <div className="grid gap-8 md:grid-cols-2">
            <div className="md:col-span-2">
              <UsageList id="receipts-devices" title="Devices" items={insights.devices ?? []} nouns={["device", "devices"]} />
            </div>
            <UsageList id="receipts-countries" title="Countries" items={insights.countries ?? []} nouns={["country", "countries"]} />
            <UsageList id="receipts-profiles" title="Profiles" items={insights.profiles ?? []} nouns={["profile", "profiles"]} />
          </div>
        </>
      )}
    </ReceiptSection>
  );
}
