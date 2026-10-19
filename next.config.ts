import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Only the project's own Supabase origin may be reached from the browser (auth + REST + realtime).
// Falls back to any *.supabase.co project when the env var is missing at build time.
const SUPABASE_FALLBACK = ["https://*.supabase.co", "wss://*.supabase.co"];

function supabaseOrigins(): string[] {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.protocol !== "https:" && url.protocol !== "http:") return SUPABASE_FALLBACK;
    const ws = url.protocol === "https:" ? "wss:" : "ws:";
    return [url.origin, `${ws}//${url.host}`];
  } catch {
    return SUPABASE_FALLBACK;
  }
}

// Scripts: Next inlines its RSC bootstrap scripts, and pages are statically prerendered, so a
// per-request nonce isn't available; 'unsafe-inline' is the documented no-nonce setup. 'unsafe-eval'
// is dev-only (React's debug stacks). Everything else is locked to 'self'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind/Framer Motion set inline style attributes
  "style-src 'self' 'unsafe-inline'",
  // data:/blob: for the generated share card PNG
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins().join(" ")}${isDev ? " ws: wss:" : ""}`.trim(),
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
