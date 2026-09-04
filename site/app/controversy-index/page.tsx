import type { Metadata } from "next";
import Link from "next/link";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import ControversyIndexGauge from "@/components/ControversyIndexGauge";
import { computeControversyIndex } from "@/lib/controversy-index";
import type { Controversy } from "@/lib/controversy";

export const metadata: Metadata = {
  title: "The Controversy Index",
  description:
    "The 0-100 Controversy Index is deterministic: computed from typed records by a fixed formula, never from a language model.",
};

const WORKED_EXAMPLE: Controversy[] = [
  {
    title: "Ongoing regulatory inquiry",
    summary: "Severity 5, ongoing, this year.",
    category: "Legal",
    severity: 5,
    status: "ongoing",
    year: 2026,
    sources: ["Reuters"],
  },
  {
    title: "Resolved dispute from six years ago",
    summary: "Severity 3, resolved, 2020.",
    category: "Professional",
    severity: 3,
    status: "resolved",
    year: 2020,
    sources: ["Variety"],
  },
  {
    title: "Undated minor backlash",
    summary: "Severity 2, year unknown.",
    category: "Social media",
    severity: 2,
    status: "historical",
    sources: ["Pitchfork"],
  },
];

export default function ControversyIndexPage() {
  const index = computeControversyIndex(WORKED_EXAMPLE, 2026);

  return (
    <>
      <PillNav />
      <main id="main" className="page page-narrow">
        <div className="page-head">
          <h1>The Controversy Index</h1>
          <p>
            A 0-100 summary of how controversial a public figure is,
            computed from the typed controversy records by a fixed formula.
            No language model invents or adjusts it, and the same records
            always produce the same number. The Flutter app and this site
            share one implementation
            (<code>controversy_index.dart</code> and{" "}
            <code>controversy-index.ts</code>) and one test suite.
          </p>
        </div>

        <div className="prose">
          <h2>The formula</h2>
          <p>Each record contributes a weight:</p>
          <ul>
            <li>
              <strong>Severity</strong> 1 to 5 maps to 0.2 to 1.0.
            </li>
            <li>
              <strong>Recency.</strong> Two years old or newer keeps full
              weight. After that it decays by 0.06 per year, down to a floor
              of 0.4. An unknown year is discounted to 0.7.
            </li>
            <li>
              <strong>Status.</strong> An unresolved (ongoing) episode is
              multiplied by 1.25.
            </li>
          </ul>
          <p>
            The weights are summed, then passed through a
            diminishing-returns curve:{" "}
            <code>score = 100 &times; (1 - 1 / (1 + total))</code>. One
            severe recent episode lands near 50; several push the score
            toward, but never reach, 100.
          </p>

          <h2>Label bands</h2>
          <ul>
            <li>Below 15: Low profile</li>
            <li>15 to 34: Occasionally criticized</li>
            <li>35 to 54: Frequently debated</li>
            <li>55 to 74: Highly controversial</li>
            <li>75 and above: Lightning rod</li>
          </ul>
          <p>
            Profiles also show a standardised five-band scale for comparing
            two figures on the same footing: <strong>0–19 Very Low</strong>,{" "}
            <strong>20–39 Low</strong>, <strong>40–59 Moderate</strong>,{" "}
            <strong>60–79 High</strong>, <strong>80–100 Very High</strong>.
            It is the same score, just read against a common scale rather
            than the more descriptive label above.
          </p>

          <h2>Data coverage confidence</h2>
          <p>
            Every profile also shows how well-supported the score&rsquo;s
            inputs are — the fraction of episodes with at least one source
            and the fraction with a recorded year — as High, Medium or Low.
            This is not a model&rsquo;s opinion of the number; it is a count
            of the sourcing and dates the episodes themselves carry.
          </p>

          <h2>Score history</h2>
          <p>
            When a figure has controversies dated in at least two different
            years, the profile shows a year-by-year score history. Every
            point is a genuine recomputation of the formula above, using
            only the episodes dated on or before that year — never a
            snapshot the app stored at the time, since it does not store
            one. A person with too little dated history simply shows no
            history chart, rather than an invented or flat one.
          </p>

          <h2>A worked example</h2>
          <p>Three records, evaluated as of 2026:</p>
          <ul>
            <li>
              Severity 5, ongoing, 2026: 1.0 &times; 1.0 &times; 1.25 ={" "}
              <strong>1.25</strong>
            </li>
            <li>
              Severity 3, resolved, 2020: 0.6 &times; (1 - 4 &times; 0.06) =
              0.6 &times; 0.76 = <strong>0.456</strong>
            </li>
            <li>
              Severity 2, year unknown: 0.4 &times; 0.7 ={" "}
              <strong>0.28</strong>
            </li>
          </ul>
          <p>
            Total 1.986, so score = 100 &times; (1 - 1 / 2.986) ={" "}
            <strong>66.5</strong>, which lands in &ldquo;Highly
            controversial&rdquo;:
          </p>
        </div>

        <div className="section-gap">
          <ControversyIndexGauge index={index} />
        </div>

        <div className="prose section-gap">
          <h2>Why it is not a model output</h2>
          <p>
            A language model asked to rate controversy on a 0-100 scale
            gives a different answer each run, cannot show its working, and
            can be steered by the text it is fed. A fixed formula over typed
            records is reproducible, auditable, testable and free. The model
            still writes the record summaries and proposes the severity, but
            the number you see is arithmetic.
          </p>
          <p>
            <Link href="/methodology">
              How the records themselves are produced and gated
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
