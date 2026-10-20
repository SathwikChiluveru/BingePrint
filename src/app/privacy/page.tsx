import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy · Autoplayed",
  description:
    "What Autoplayed keeps, where, and who can see it. Your Netflix file is read in your browser and never uploaded.",
};

// TODO(owner): replace with a real inbox you check before launch. Deletion requests go here
// because there is no in-app "delete group" or "delete account" button yet ("Leave" exists).
const CONTACT_EMAIL = "privacy@example.com";

const LAST_UPDATED = "2026-10-20";
const LAST_UPDATED_LABEL = "20 October 2026";

const link = "underline underline-offset-4 decoration-[var(--color-border-strong)] hover:decoration-current";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="text-title font-semibold" style={{ color: "var(--color-text)" }}>
        {title}
      </h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-[var(--color-muted)]">{children}</ul>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return (
    <strong className="font-semibold" style={{ color: "var(--color-text)" }}>
      {children}
    </strong>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--color-bg)" }}>
      <header
        style={{
          background: "var(--color-bg-translucent)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6" aria-label="Main">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-xl font-black"
            style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}
          >
            Autoplayed
          </Link>
          <Link href="/upload" className="btn-secondary px-4 text-sm">
            Get my reel
          </Link>
        </nav>
      </header>

      <main className="flex-1 px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
        <article className="mx-auto max-w-[65ch] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          <h1 className="text-headline font-bold text-balance" style={{ color: "var(--color-text)" }}>
            Privacy
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Last updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
          </p>
          <p className="mt-6 text-lg" style={{ color: "var(--color-text)" }}>
            Your Netflix file is read in your browser and never uploaded. Summary stats leave your device only
            when you create or join a group.
          </p>

          <Section id="file" title="Your Netflix file">
            <p>
              When you pick your viewing-history CSV, this page reads it on your device and works out your reel there.
              The file itself is never sent to Autoplayed or anyone else, and we never see the full list of what you
              watched.
            </p>
          </Section>

          <Section id="device" title="What stays on your device">
            <p>Your browser keeps a few things so your reel is still there when you come back:</p>
            <List>
              <li>
                <Strong>Your reel&apos;s stats</Strong>, in this site&apos;s local storage, along with a random id for
                the reel&apos;s link.
              </li>
              <li>
                <Strong>The invite you arrived through</Strong> (code and group name, ignored after 7 days) and{" "}
                <Strong>the group you last created or joined</Strong> (its id, name and invite code), so the app can
                send you back to them.
              </li>
              <li>
                <Strong>Which slide you were on</Strong>, in session storage, which your browser clears when you close
                the tab.
              </li>
              <li>
                <Strong>Your sign-in session</Strong>, in cookies, if you sign in.
              </li>
            </List>
            <p>
              A reel link only works in the browser that made it. Opened anywhere else, it shows nothing, because the
              stats aren&apos;t on any server. Share cards are drawn on your device too; they go only where you send
              them.
            </p>
          </Section>

          <Section id="groups" title="What we store when you create or join a group">
            <p>
              Groups need an account, and they are the only time your stats leave your device. When you create a
              group with your stats, join one, or update your stats in one, we store:
            </p>
            <List>
              <li>
                <Strong>Your account id</Strong> and <Strong>the nickname you pick</Strong>.
              </li>
              <li>
                <Strong>A summary of your reel:</Strong> total watch time; your top 5 titles (name, play count, watch
                time, show or film); your most-watched show; your longest binge (when it started and ended, how long it
                ran, how many titles, but not which ones); your night-owl score and peak viewing hour; viewing per
                weekday; how many different shows and titles you watched; how many weeks your history covers; your
                personality label and its roast line; and whether your file had watch times.
              </li>
              <li>
                <Strong>For groups you create:</Strong> the group&apos;s name, its invite code, and that you own it.
                If you turn the invite teaser on, also your nickname, personality label and one headline number,
                copied for the invite page.
              </li>
            </List>
            <p>
              The server keeps only those fields and drops anything else the browser sends. Your full history, your
              list of binges and the titles inside them are never stored.
            </p>
          </Section>

          <Section id="who" title="Who can see it">
            <List>
              <li>
                <Strong>People in the same group</Strong> see each member&apos;s nickname and summary stats. Nobody
                outside the group can read them.
              </li>
              <li>
                <Strong>Anyone with the invite code</Strong>, signed in or not, can see the group&apos;s name. If the
                owner opted in, they also see a teaser: the owner&apos;s nickname in the group, their personality label
                and one headline number (for example &ldquo;Sam is The Binge Lord&rdquo;). If the owner changes their
                nickname, the teaser follows. The teaser is on by default when you start a group: the last card of
                your reel says so, and the create form on the Groups page has a checkbox to turn it off.
              </li>
            </List>
            <p>Treat an invite code like a link to a group chat: anyone you give it to can join.</p>
          </Section>

          <Section id="signin" title="Signing in">
            <p>
              Sign-in is handled by Supabase, which also hosts our database. With an email link or code, it stores your
              email address. With Google, it stores the email address and basic profile Google shares (your name and
              profile picture link). Autoplayed uses your account only to tell members apart and to let you back into
              your groups.
            </p>
          </Section>

          <Section id="limits" title="Rate limits">
            <p>
              To stop people hammering invite codes or flooding groups, the server counts recent requests. The counters
              are keyed by a salted SHA-256 hash of your IP address or account id, never the raw value, and are
              cleared within a day. A record of your recent invite-code lookups is kept against your account for the
              same reason and cleared after about an hour.
            </p>
          </Section>

          <Section id="changes" title="Changing names">
            <List>
              <li>
                <Strong>Your nickname:</Strong> any member can change their own name in a group from the group page.
                Members see the new name right away.
              </li>
              <li>
                <Strong>The group&apos;s name:</Strong> only the person who started the group can rename it. Everyone
                in the group, and anyone with the invite code, sees the new name.
              </li>
            </List>
          </Section>

          <Section id="delete" title="Removing your data">
            <List>
              <li>
                <Strong>On this device:</Strong> clear this site&apos;s data in your browser settings. That removes your
                reel, saved invite and group shortcut. Uploading a different file replaces the reel.
              </li>
              <li>
                <Strong>Leaving a group:</Strong> the &ldquo;Leave&rdquo; button at the bottom of a group&apos;s page
                deletes your nickname and stats from that group straight away. To come back you need the invite code
                again. If you started the group, it stays yours after you leave: the invite code keeps working, you
                can add your reel again later, and an invite teaser you turned on keeps showing the nickname and
                personality it last had.
              </li>
              <li>
                <Strong>Deleting a group or your account:</Strong> there is no button for these yet. Email{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className={link} style={{ color: "var(--color-text)" }}>
                  {CONTACT_EMAIL}
                </a>{" "}
                from the address you signed in with, and say which groups. We&apos;ll delete them, or your whole
                account. Deleting a group you own removes every member&apos;s stats in it.
              </li>
            </List>
          </Section>

          <Section id="other" title="Everything else">
            <p>
              Autoplayed has no ads and no analytics trackers, and doesn&apos;t sell or share your data. Autoplayed is
              not affiliated with Netflix, Inc.
            </p>
            <p>If this page changes, the date at the top changes with it.</p>
          </Section>
        </article>
      </main>

      <footer className="px-4 py-8 sm:px-6" style={{ color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center font-black" style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}>
            Autoplayed
          </Link>
          <p>Autoplayed is not affiliated with Netflix, Inc.</p>
        </div>
      </footer>
    </div>
  );
}
