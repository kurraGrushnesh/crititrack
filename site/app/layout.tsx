import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "CritiTrack",
    title: "CritiTrack — accountability tracking for public figures",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "CritiTrack",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E1119" },
    { media: "(prefers-color-scheme: light)", color: "#0E1119" },
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
    <html lang="en">
      <body>
        {/* Keyboard users should not have to tab through the hero to
            reach the content. */}
        <a className="skip-link" href="#how">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
