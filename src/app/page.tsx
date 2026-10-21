import Link from "next/link";
import { SampleReel } from "@/components/landing/SampleReel";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { GroupTeaser } from "@/components/landing/GroupTeaser";
import { ReturningReelLink } from "@/components/landing/ReturningReelLink";
import { ArrowRightIcon, LockIcon } from "@/components/landing/icons";

// Title, description, Open Graph and Twitter metadata come from the root layout.

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip" style={{ background: "var(--color-bg)" }}>
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
            style={{ color: "var(--color-red)", letterSpacing: "-0.02em" }}
          >
            Autoplayed
          </Link>
          <div className="flex items-center gap-2">
            <ReturningReelLink />
            <Link href="/auth/login" className="btn-secondary px-4 text-sm">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero: the pitch on the left, the sample reel (red glow, red hero numbers) on the right */}
        <section aria-labelledby="hero-heading" className="relative">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16 md:pt-20 lg:pb-28">
            <div>
              <h1
                id="hero-heading"
                className="text-display max-w-[14ch] font-black max-[359px]:text-4xl max-[359px]:leading-none"
                style={{ textWrap: "balance" }}
              >
                Your watch history has some explaining to do.
              </h1>
              <p
                className="mt-6 max-w-[46ch] text-base leading-relaxed sm:text-lg"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Autoplayed turns your Netflix viewing history into a reel of receipts: the show you never stopped
                rewatching, the day you never left the couch, and a personality label you will want to argue
                with. Then your friends get theirs.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/upload" className="btn-primary px-6 text-base">
                  Get my reel
                  <ArrowRightIcon size={18} />
                </Link>
                <Link href="/groups?mode=join" className="btn-secondary px-6 text-base">
                  Join a friend&apos;s group
                </Link>
              </div>

              <p className="mt-5 flex items-start gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                <span className="mt-0.5 shrink-0" style={{ color: "var(--color-success)" }}>
                  <LockIcon size={16} />
                </span>
                <span>
                  <strong className="font-semibold text-white">Your file never leaves your browser.</strong> Your
                  whole history, any time of year. No account needed for your reel.
                </span>
              </p>
            </div>

            <SampleReel />
          </div>
        </section>

        <HowItWorks />

        <GroupTeaser />

        {/* Closing call: one big line and the main button, which is the frame's one red thing (no glow here) */}
        <section aria-labelledby="cta-heading" className="px-6 py-24 text-center md:py-32">
          <h2 id="cta-heading" className="text-display mx-auto max-w-[14ch] font-black" style={{ textWrap: "balance" }}>
            Go on. See how bad it is.
          </h2>
          <p className="mx-auto mt-5 max-w-[44ch] text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Netflix hands you the file in about 30 seconds. Autoplayed hands back the roast. Then start a group and
            find out who in the chat is worst.
          </p>
          <div className="mt-9 flex justify-center">
            <Link href="/upload" className="btn-primary px-6 text-base">
              Get my reel
              <ArrowRightIcon size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer
        className="px-6 py-8"
        style={{ color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          {/* Small red text uses the lighter red so it passes 4.5:1 on the dark ground */}
          <span className="font-black" style={{ color: "var(--color-red-text)", letterSpacing: "-0.02em" }}>
            Autoplayed
          </span>
          <p>
            Autoplayed is not affiliated with Netflix, Inc. ·{" "}
            {/* 14px padding cancelled by -14px margin: a 44px+ hit area that leaves the line box alone */}
            <Link href="/privacy" className="-my-[14px] inline-block px-1 py-[14px] underline underline-offset-4 hover:text-white">
              Privacy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
