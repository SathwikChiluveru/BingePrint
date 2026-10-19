import type { Metadata, Viewport } from "next";
import "./globals.css";

// viewport-fit=cover makes env(safe-area-inset-*) work for the slideshow chrome on iOS
export const viewport: Viewport = {
  viewportFit: "cover",
};

const SITE_TITLE = "Autoplayed: your Netflix history, roasted";
const SITE_DESCRIPTION =
  "Turn your Netflix viewing history into a roast reel and compare it with your friends. Your file never leaves your browser. Not affiliated with Netflix.";

// Explicit app URL first, then the Vercel deployment host, then local dev
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  // Resolves the generated opengraph-image / twitter-image URLs to absolute links
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "Autoplayed",
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Autoplayed",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Extensions like Grammarly add attributes to <body> before hydration */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
