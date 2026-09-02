import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import PageFade from "@/components/PageFade";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

/**
 * One tight grotesk for the whole site — display and body. The design is
 * editorial minimalism: oversized weights carry the hierarchy, so the
 * type only needs to be clean and to hold up large.
 *
 * Self-hosted by next/font at build time — no runtime request to Google,
 * and `display: swap` with a matched fallback keeps the layout stable.
 */
const display = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-display",
});

// The Firebase Hosting target for this project. Deliberately not a
// custom domain: `crititrack.app` is not registered, and a canonical
// URL pointing at a domain that does not resolve is worse than no
// custom domain at all — it tells crawlers the real page is a dead
// host and breaks every link preview. Change this one constant if a
// domain is registered later.
const SITE = "https://crititrack-f7430.web.app";
const DESCRIPTION =
  "CritiTrack turns scattered news, video and social coverage into a " +
  "structured, evidence-linked record of what a public figure has been " +
  "criticised for, how serious it was, and whether sentiment is moving.";

/**
 * Metadata is exhaustive because the marketing site's whole job is to be
 * found and to preview well when shared. A static export with no
 * server-rendered copy would fail at both.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "CritiTrack — accountability tracking for public figures",
    template: "%s · CritiTrack",
  },
  description: DESCRIPTION,
  applicationName: "CritiTrack",
  keywords: [
    "public figure accountability",
    "controversy tracker",
    "sentiment analysis",
    "media coverage",
    "celebrity reputation",
  ],
  // No `title` / `description` / `url` here on purpose: setting them
  // freezes the value site-wide, so every subpage would advertise the
  // homepage. Leaving them unset lets Next fill og:title and
  // og:description from each page's own `title` and `description`.
  openGraph: {
    type: "website",
    siteName: "CritiTrack",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
  // Relative, so each page resolves its own canonical against
  // metadataBase and its path rather than all pointing at the root.
  alternates: { canonical: "./" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f100e" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <head>
        <script
          // Runs before first paint: applies the saved theme so there is
          // no flash of the wrong one. Safe to inline — no user input,
          // string is a module constant.
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body>
        {/* Keyboard users should not have to tab through the nav to
            reach the content. Every page marks its main region with
            id="main". */}
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <PageFade>{children}</PageFade>
      </body>
    </html>
  );
}
