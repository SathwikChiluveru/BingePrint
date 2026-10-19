"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { MotionConfig } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { adoptJoinParam, clearMyGroupIfStale, useAutoplayedStore } from "@/lib/store";
import { SlideShow } from "@/components/wrapped/SlideShow";
import { Slide10Share } from "@/components/wrapped/slides/Slide10Share";

const noopSubscribe = () => () => {};

function Blank() {
  return <main className="min-h-screen" style={{ background: "var(--color-bg)" }} />;
}

/**
 * Stats live only in the localStorage of the browser that parsed the file. A link opened anywhere
 * else (another device, a magic link that opened a different browser) lands here instead of
 * bouncing silently to /upload.
 */
function MissingReel({ savedSessionId }: { savedSessionId: string | null }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="card p-6 w-full max-w-md flex flex-col gap-4 text-center">
        <h1 className="text-title font-semibold">This reel lives in the browser that made it.</h1>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Open it there, or upload your history here. Your file never leaves your browser.
        </p>
        <Link href="/upload" className="btn-primary py-3">
          Upload my Netflix history
        </Link>
        {savedSessionId && (
          <Link
            href={`/wrapped/${savedSessionId}`}
            className="self-center inline-flex items-center min-h-[44px] px-3 text-sm underline underline-offset-4"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Open the reel saved in this browser
          </Link>
        )}
      </div>
    </main>
  );
}

function WrappedContent() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Read ?autoshare=1 once, then drop it from the URL so a reload, back-navigation or a copied
  // link does not start another group.
  const autoshareInUrl = searchParams.get("autoshare") === "1";
  // ?join=CODE carries a friend's invite across a browser switch (magic link, upload in another
  // app). Adopted into pendingInvite, so slide 10 offers that group instead of starting a rival one.
  const joinInUrl = searchParams.get("join");
  const [autoshare, setAutoshare] = useState(autoshareInUrl);
  useEffect(() => {
    if (joinInUrl) adoptJoinParam(joinInUrl);
    if (autoshareInUrl || joinInUrl) {
      router.replace(`/wrapped/${encodeURIComponent(params.sessionId)}`, { scroll: false });
    }
  }, [autoshareInUrl, joinInUrl, params.sessionId, router]);
  const wrappedStats = useAutoplayedStore((s) => s.wrappedStats);
  const sessionId = useAutoplayedStore((s) => s.sessionId);
  // A group made from an older reel must not hand its code to this one.
  useEffect(() => {
    if (sessionId && sessionId === params.sessionId) clearMyGroupIfStale(sessionId);
  }, [sessionId, params.sessionId]);
  // Stats come from localStorage, so render nothing on the server and decide after hydration
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  if (!isClient) return <Blank />;

  if (!wrappedStats || !sessionId || sessionId !== params.sessionId) {
    return <MissingReel savedSessionId={wrappedStats ? sessionId : null} />;
  }

  // Back from sign-in after tapping "Start my group and invite": go straight to the share card.
  // Outside SlideShow, so it needs its own MotionConfig to honor reduced motion.
  if (autoshare) {
    return (
      <MotionConfig reducedMotion="user">
        <Slide10Share stats={wrappedStats} sessionId={sessionId} autoCreate />
        <button
          type="button"
          onClick={() => setAutoshare(false)}
          className="fixed left-4 z-10 inline-flex items-center min-h-[44px] px-3 text-sm underline-offset-4 hover:underline"
          style={{ top: "calc(8px + env(safe-area-inset-top, 0px))", color: "var(--color-text-secondary)" }}
        >
          Watch my reel
        </button>
      </MotionConfig>
    );
  }

  return <SlideShow stats={wrappedStats} sessionId={sessionId} />;
}

export default function WrappedPage() {
  return (
    <Suspense fallback={<Blank />}>
      <WrappedContent />
    </Suspense>
  );
}
