import Link from "next/link";
import { SampleReel } from "@/components/landing/SampleReel";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { GroupTeaser } from "@/components/landing/GroupTeaser";
import { ReelDropZone } from "@/components/landing/ReelDropZone";
import { ReturningReelLink } from "@/components/landing/ReturningReelLink";
import { FriendsProof } from "@/components/landing/FriendsProof";
import { LockIcon } from "@/components/landing/icons";
import styles from "@/components/landing/landing.module.css";

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
        <nav className="mx-auto flex max-w-[88rem] items-center justify-between gap-3 px-6 py-2 xl:px-10" aria-label="Main">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-xl font-black"
            style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}
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
        {/*
          Hero: the sample reel is the stage. On wide screens it sits dead centre with the headline as its
          punchline on the left and the working drop zone on the right. Smaller screens read headline,
          a one-frame group sample, then the action, so proof and Choose file both sit above the fold
          on phones (checked at 375x548, 375x667 and 320x568); the full reel follows.
        */}
        <section aria-labelledby="hero-heading" className="relative">
          <div className="mx-auto grid w-full max-w-[88rem] grid-cols-1 items-center gap-x-12 gap-y-5 px-6 pb-20 pt-5 short:gap-y-3 short:pt-3 md:grid-cols-[minmax(0,1fr)_auto] md:gap-y-8 md:pt-14 lg:pb-28 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-x-14 xl:px-10 xl:pt-12">
            <div className="md:col-start-1 md:row-start-1 md:self-end xl:self-center xl:text-right">
              {/*
                Below 360px the display size would overflow "explaining", so drop one step there.
                Short screens (max-height 640px) step down to Headline so the action stays above the fold.
              */}
              <h1
                id="hero-heading"
                className="text-display font-black max-[359px]:[@media(min-height:641px)]:text-4xl max-[359px]:leading-none max-[359px]:tracking-tight short:text-headline short:leading-[1.05] md:max-w-[12ch] xl:ml-auto xl:text-[clamp(3.25rem,4.4vw,4.5rem)]"
                style={{ textWrap: "balance" }}
              >
                Your watch history has some explaining to do.
              </h1>
              <p
                className="mt-3 max-w-[40ch] text-base leading-relaxed short:mt-2 sm:text-lg md:mt-5 xl:ml-auto"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <span className="short:hidden">
                  Receipts from your Netflix history, plus a label you&apos;ll want to argue with.
                </span>
                <span className="hidden short:inline">Your Netflix history, roasted.</span>
              </p>
              <div className="mt-4 short:mt-3 md:mt-6">
                <FriendsProof />
              </div>
            </div>

            <div className="md:col-start-1 md:row-start-2 md:self-start xl:col-start-3 xl:row-start-1 xl:self-center">
              <ReelDropZone />
              <p className="mt-3 flex items-start gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                <span className="mt-0.5 shrink-0" style={{ color: "var(--color-success)" }}>
                  <LockIcon size={16} />
                </span>
                <span>
                  No account needed for your reel.{" "}
                  <strong className="font-semibold text-white">Your file never leaves your browser.</strong>
                </span>
              </p>
            </div>

            <div className="mt-8 md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0 xl:row-span-1">
              <SampleReel />
            </div>
          </div>
        </section>

        <HowItWorks />

        <GroupTeaser />

        {/* Closing call: a neutral glow (the red stays on the CTA) and the same working drop zone */}
        <section aria-labelledby="cta-heading" className="relative isolate overflow-hidden px-6 py-24 text-center md:py-32">
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-[-25%] inset-y-0 -z-10 ${styles.neutralGlow}`}
          />
          <h2 id="cta-heading" className="text-display mx-auto max-w-[14ch] font-black" style={{ textWrap: "balance" }}>
            Go on. See how bad it is.
          </h2>
          <p className="mx-auto mt-5 max-w-[44ch] text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Netflix hands you the file. Autoplayed hands back the roast.
          </p>
          <p className="mx-auto mt-2 max-w-[44ch] text-lg font-semibold">
            Then start a group and find out who in the chat is worst.
          </p>
          <ReelDropZone align="center" className="mt-9" />
        </section>
      </main>

      <footer
        className="px-6 py-8"
        style={{ color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }}
      >
        <div className="mx-auto flex max-w-[88rem] flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between xl:px-4">
          <span className="font-black" style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}>
            Autoplayed
          </span>
          <p>Autoplayed is not affiliated with Netflix, Inc.</p>
        </div>
      </footer>
    </div>
  );
}
