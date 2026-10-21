import Link from "next/link";
import AppNav from "@/components/AppNav";

/** Same behavior as the reel's MissingReel: stats live only in the browser that parsed the file. */
export function ReceiptsMissing({ savedSessionId }: { savedSessionId: string | null }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <AppNav secondary={{ href: "/", label: "Back" }} />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="card p-6 w-full max-w-md flex flex-col gap-4 text-center">
          <h1 className="text-title font-semibold">These receipts live in the browser that made the reel.</h1>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Open them there, or upload your history here. Your file never leaves your browser.
          </p>
          <Link href="/upload" className="btn-primary py-3">
            Upload my Netflix history
          </Link>
          {savedSessionId && (
            <Link
              href={`/wrapped/${encodeURIComponent(savedSessionId)}/receipts`}
              className="self-center inline-flex items-center min-h-[44px] px-3 text-sm underline underline-offset-4"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Open the receipts saved in this browser
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
