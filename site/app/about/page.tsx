import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "About",
  description:
    "What CritiTrack is, who it covers, and what it does not claim.",
};

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main className="page page-narrow">
        <div className="page-head">
          <h1>About</h1>
          <p>
            CritiTrack turns scattered coverage of a public figure into a
            structured, evidence-linked record: what they have been
            criticised for, how serious it was, whether it is resolved, and
            whether sentiment is moving.
          </p>
        </div>

        <div className="prose">
          <h2>Who it covers</h2>
          <p>
            Public figures, using published reporting. It is not for private
            individuals, and it does not aggregate personal information that
            is not already part of a person&rsquo;s public record.
          </p>

          <h2>What it does not claim</h2>
          <p>
            Scores are algorithmically assessed, not verified fact. A
            severity rating is a model&rsquo;s reading of how a set of
            articles frame an episode, not a legal or moral finding. The{" "}
            <Link href="/controversy-index">Controversy Index</Link> is
            arithmetic over those readings.
          </p>
          <p>
            A severity 4 or 5 claim with no corroborating source is
            rejected, not shown. Everything displayed carries a source or is
            labelled as unverified.
          </p>

          <h2>If a profile is about you</h2>
          <p>
            Every entry carries a report control.{" "}
            <Link href="/report-correction">Report a correction</Link> and it
            is reviewed against published reporting. A record is not changed
            without a source that supports the change.
          </p>

          <h2>Built in the open</h2>
          <p>
            The security posture, privacy policy and benchmark method are in
            the repository, including the parts that are unfinished.
          </p>
          <p className="link-row">
            <a
              href="https://github.com/kurraGrushnesh/crititrack"
              rel="noopener noreferrer"
            >
              Source
            </a>
            <Link href="/methodology">Method</Link>
            <Link href="/privacy">Privacy</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
