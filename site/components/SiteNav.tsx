import Link from "next/link";

/**
 * Site-wide navigation. One line on desktop, wraps to a scrollable strip
 * on narrow screens. The app link is the one primary action; everything
 * else is reference material.
 */
export default function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="site-nav-inner">
        <Link href="/" className="site-nav-brand">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#0E1119" />
            <circle
              cx="32"
              cy="32"
              r="19"
              fill="none"
              stroke="#8B7CFF"
              strokeWidth="3"
            />
            <ellipse
              cx="32"
              cy="32"
              rx="8"
              ry="19"
              fill="none"
              stroke="#8B7CFF"
              strokeWidth="2"
              opacity=".55"
            />
            <path d="M13 32h38" stroke="#8B7CFF" strokeWidth="2" opacity=".55" />
            <circle cx="43" cy="20" r="5" fill="#3FD5A0" />
            <circle cx="20" cy="42" r="4" fill="#FF7A66" />
          </svg>
          CritiTrack
        </Link>
        <div className="site-nav-links">
          <Link href="/explore">Explore</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/methodology">Method</Link>
          <Link href="/controversy-index">The index</Link>
          <Link href="/report-correction">Report a correction</Link>
          <a href="/app/" className="nav-cta">
            Open the app
          </a>
        </div>
      </div>
    </nav>
  );
}
