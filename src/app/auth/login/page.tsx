"use client";

import { useState, useSyncExternalStore, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { isInAppBrowser } from "@/lib/share/safety";
import { isPendingInviteFresh, useAutoplayedStore } from "@/lib/store";
import { signInToStartLine } from "@/lib/copy/invite";
import { DEFAULT_NEXT, safeNext } from "../safe-next";

// In-app webviews (Instagram, Facebook, WhatsApp, Line, Snapchat, TikTok, the Google app) block
// Google OAuth with "disallowed_useragent", and a magic link opens in a different browser where the
// stats don't exist. There the emailed code, typed into this same tab, is the default.
const noopSubscribe = () => () => {};

function useInAppBrowser(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => isInAppBrowser(),
    () => false
  );
}

// Phones and tablets: a tapped email link often opens in the mail app's browser or the default
// browser, not this one, so the reel isn't there. The code is the default on coarse pointers too.
function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches,
    () => false
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  caretColor: "var(--color-red)",
};

// Supabase OTP length is 6 by default (configurable up to 10)
const CODE_RE = /^\d{6,10}$/;

// "Sending…" / "Checking…" never spin forever: past this the button comes back with an error
const AUTH_TIMEOUT_MS = 15_000;
const TIMEOUT_MESSAGE = "Autoplayed took too long to answer. Check your connection and try again.";
const OFFLINE_MESSAGE = "Couldn't reach Autoplayed. Check your connection and try again.";

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), AUTH_TIMEOUT_MS);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// localStorage is only readable after hydration; before that, render the store-free line
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/**
 * "Lives in this browser" only when there is a local reel to protect. Invitees without one
 * get the group they're joining (from the saved invite, never from the URL).
 */
function intentLine(next: string, personality: string | null, inviteGroup: string | null): string {
  const creating = next.includes("mode=create");
  // Any fresh invite names its group, unless they are signing in to start their own
  const toGroup = inviteGroup && !creating ? inviteGroup : null;
  if (personality && creating) return `${signInToStartLine(personality)} Your reel lives in this browser.`;
  if (personality && toGroup) return `Sign in to join ${toGroup} as ${personality}. Your reel lives in this browser.`;
  if (personality && (next.startsWith("/wrapped/") || next.startsWith("/groups"))) {
    return `Sign in to put ${personality} on a group board. Your reel lives in this browser.`;
  }
  if (toGroup) return `Sign in to join ${toGroup}.`;
  if (creating) return signInToStartLine(null);
  return "Sign in to create or join a group with friends.";
}

type Method = "link" | "code";
type Step = "email" | "link-sent" | "code-sent";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inApp = useInAppBrowser();
  const coarse = useCoarsePointer();
  const hydrated = useHydrated();
  const storedPersonality = useAutoplayedStore((s) => s.wrappedStats?.personality ?? null);
  const personality = hydrated ? storedPersonality : null;
  const pendingInvite = useAutoplayedStore((s) => s.pendingInvite);
  // An invite adopted from a ?join link has no name yet: still say there is a group waiting
  const inviteGroup =
    hydrated && isPendingInviteFresh(pendingInvite) ? pendingInvite.groupName ?? "your friend's group" : null;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("email");
  // null = not chosen yet: code in in-app browsers and on touch devices, link on desktop
  const [chosenMethod, setChosenMethod] = useState<Method | null>(null);
  const method: Method = chosenMethod ?? (inApp || coarse ? "code" : "link");
  // `redirectTo` is the older name, still accepted so old links keep working
  const next = safeNext(searchParams.get("next") ?? searchParams.get("redirectTo")) ?? DEFAULT_NEXT;
  const callbackFailed = searchParams.get("error") === "auth_failed";
  const [error, setError] = useState(
    callbackFailed
      ? "That sign-in link didn't work. It may have expired, already been used, or opened in another browser. Get a code below instead."
      : ""
  );

  function callbackUrl() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function sendEmail(kind: Method) {
    setLoading(true);
    setError("");
    try {
      // Same Supabase call for both: the email carries the link and, when the template includes
      // {{ .Token }}, the code. The link still lands on the callback if they tap it instead.
      const { error } = await withTimeout(
        createClient().auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true, emailRedirectTo: callbackUrl() },
        })
      );
      if (error) setError(`${error.message}. Check the address and try again.`);
      else setStep(kind === "code" ? "code-sent" : "link-sent");
    } catch (err) {
      setError(err instanceof TimeoutError ? TIMEOUT_MESSAGE : OFFLINE_MESSAGE);
    }
    setLoading(false);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendEmail(method);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\s+/g, "");
    if (!CODE_RE.test(token)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error } = await withTimeout(createClient().auth.verifyOtp({ email, token, type: "email" }));
      if (error) {
        setError("That code didn't work. It may have expired. Check the latest email or send a new code.");
        setLoading(false);
        return;
      }
      // `next` already passed safeNext: a same-origin relative path
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof TimeoutError ? TIMEOUT_MESSAGE : OFFLINE_MESSAGE);
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError("");
    try {
      // A disabled provider makes Supabase answer the redirect with raw JSON, so check first
      const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (settings && settings.external?.google !== true) {
        setError("Google sign-in isn't set up yet. Use the email sign-in below.");
        setLoading(false);
        return;
      }
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl() },
      });
      if (error) {
        setError(`${error.message}. Use the email sign-in instead.`);
        setLoading(false);
      }
    } catch {
      setError("Couldn't reach Autoplayed. Check your connection and try again.");
      setLoading(false);
    }
  }

  const errorLine = error && (
    <p role="alert" className="text-sm" style={{ color: "var(--color-red-text)" }}>
      {error}
    </p>
  );

  const quietButton = "self-center inline-flex items-center min-h-[44px] px-3 text-sm underline underline-offset-4";

  return (
    <motion.div
      className="card p-8 w-full max-w-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link
        href="/"
        className="-ml-1 inline-flex items-center min-h-[44px] px-1 text-title font-black tracking-[-0.02em]"
        style={{ color: "var(--color-text)" }}
      >
        Autoplayed
      </Link>
      <h1 className="text-title font-semibold">Sign in</h1>
      <p className="text-sm mt-1 mb-6" style={{ color: "var(--color-text-secondary)" }}>
        {intentLine(next, personality, inviteGroup)}
      </p>

      {/* Both sent steps carry the code field: a tapped link can open in another browser, the code can't */}
      {(step === "link-sent" || step === "code-sent") && (
        <form onSubmit={handleVerify} className="flex flex-col gap-3">
          {step === "link-sent" ? (
            <div role="status" className="flex flex-col gap-1">
              <p className="font-semibold">Check your email</p>
              <p style={{ color: "var(--color-text-secondary)" }}>
                We sent a sign-in link to <strong style={{ color: "var(--color-text)" }}>{email}</strong>. The
                email has a 6-digit code too: type it here, in this same browser, so your reel comes with you.
              </p>
            </div>
          ) : (
            <p role="status" style={{ color: "var(--color-text-secondary)" }}>
              We sent a 6-digit code to <strong style={{ color: "var(--color-text)" }}>{email}</strong>. Type it
              here, in this same browser. Keep this tab open.
            </p>
          )}
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
              Code
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,12}"
              maxLength={12}
              required
              autoFocus={step === "code-sent"}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              className="w-full min-h-[44px] px-4 py-3 rounded-xl text-lg font-mono tracking-[0.3em] tabular-nums"
              style={inputStyle}
            />
          </label>
          {errorLine}
          <button type="submit" disabled={loading || code.replace(/\s+/g, "").length < 6} className="btn-primary py-3">
            {loading ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void sendEmail("code")}
            className={quietButton}
            style={{ color: "var(--color-text-secondary)" }}
          >
            Send a new code
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
            className={quietButton}
            style={{ color: "var(--color-muted)" }}
          >
            Use a different email
          </button>
        </form>
      )}

      {step === "email" && (
        <>
          {inApp ? (
            <p
              className="mb-4 p-4 rounded-xl text-sm"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border-strong)",
                color: "var(--color-text)",
              }}
            >
              Google sign-in doesn&apos;t work inside this app. We&apos;ll email you a code to type in right here, so
              you stay in this tab.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="btn-secondary w-full gap-3 py-3 px-4 mb-4"
              >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.909-2.258c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96l3.007 2.332C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
              </div>
            </>
          )}

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] px-4 py-3 rounded-xl text-base"
                style={inputStyle}
              />
            </label>
            {errorLine}
            <button type="submit" disabled={loading || !email} className="btn-primary py-3">
              {loading ? "Sending…" : method === "code" ? "Email me a code" : "Email me a sign-in link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setChosenMethod(method === "code" ? "link" : "code");
                setError("");
              }}
              className={quietButton}
              style={{ color: "var(--color-text-secondary)" }}
            >
              {method === "code" ? "Email me a link instead" : "Get a 6-digit code instead"}
            </button>
          </form>
        </>
      )}
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="relative isolate min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-8 overflow-hidden"
      style={{ background: "var(--color-bg)" }}
    >
      {/* The screening room: the reel's red glow sits behind the card, the one red action sits on it */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--glow-hero)" }}
      />
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-center text-xs" style={{ color: "var(--color-muted)" }}>
        Autoplayed is not affiliated with Netflix, Inc. ·{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-white">
          Privacy
        </Link>
      </p>
    </div>
  );
}
