import Link from "next/link";

/**
 * Shared footer. The fine print about scores being algorithmically
 * assessed rather than verified appears on every page, because the
 * claim it qualifies also appears on every page.
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>
          <strong>CritiTrack</strong> - accountability tracking for public
          figures.
        </p>
        <p className="link-row">
          <Link href="/explore">Explore</Link>
          <Link href="/methodology">Method</Link>
          <Link href="/controversy-index">The index</Link>
          <Link href="/about">About</Link>
          <Link href="/report-correction">Report a correction</Link>
          <Link href="/privacy">Privacy</Link>
          <a
            href="https://github.com/kurraGrushnesh/crititrack"
            rel="noopener noreferrer"
          >
            Source
          </a>
        </p>
        <p className="fine">
          Sentiment scores, controversy severities and the Controversy Index
          are algorithmically assessed from public reporting and are not
          verified fact. Profiles shown on this site are fabricated composites
          used to demonstrate the format.
        </p>
      </div>
    </footer>
  );
}
