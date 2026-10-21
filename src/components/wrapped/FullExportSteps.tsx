/**
 * How to get the full data request (ViewingActivity.csv), which carries start times, durations,
 * devices and countries. Shown wherever a quick export leaves a feature locked.
 */
export function FullExportSteps({ className = "" }: { className?: string }) {
  return (
    <ol
      className={`list-decimal space-y-1.5 pl-5 text-left text-sm marker:text-[var(--color-muted)] ${className}`}
      style={{ color: "var(--color-text-secondary)" }}
    >
      <li>
        On netflix.com go to Account, then Security &amp; Privacy, then{" "}
        <strong style={{ color: "var(--color-text)" }}>Download your personal information</strong>
      </li>
      <li>Submit the request and wait for Netflix&apos;s email with the download link</li>
      <li>
        Unzip it and add{" "}
        <span className="font-mono text-[0.95em]" style={{ color: "var(--color-text)" }}>
          CONTENT_INTERACTION/ViewingActivity.csv
        </span>{" "}
        here
      </li>
    </ol>
  );
}
