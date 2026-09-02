import type { Metadata } from "next";
import Link from "next/link";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Method",
  description:
    "How CritiTrack turns a name into a sourced, scored profile: resolve, gather, score, gate, record.",
};

export default function MethodologyPage() {
  return (
    <>
      <PillNav />
      <main id="main" className="page page-narrow">
        <div className="page-head">
          <h1>Method</h1>
          <p>
            What happens between typing a name and seeing a profile, and
            where the guardrails are.
          </p>
        </div>

        <div className="prose">
          <h2>1. Resolve</h2>
          <p>
            The name is matched against Wikidata and filtered to entities
            Wikidata lists as human. Spelling variants converge on one
            entity, so every rendering of a name shares a single cache
            entry. If the name matches several people, the alternatives are
            offered rather than one being picked silently. A name that
            resolves to nothing documented is marked unverified, not
            rejected.
          </p>

          <h2>2. Gather</h2>
          <p>
            Coverage is pulled from GDELT, a news API and YouTube in
            parallel, then deduplicated across sources so a syndicated
            story counts once. Only headline, outlet, date and link are
            kept; article bodies are not stored.
          </p>

          <h2>3. Score</h2>
          <p>
            Three independent methods score each item: a general-purpose
            lexicon, a reputation-tuned lexicon, and a batched
            language-model call. The blend is weighted by reach, because a
            front-page story and a 200-view upload are not equally
            informative. The spread between the three methods becomes a
            confidence band. A single-method score has nothing to disagree
            with, so it can only assert.
          </p>

          <h2>4. Gate</h2>
          <p>
            Generated claims are schema-validated, required to cite a
            source, and checked against what was actually retrieved. A
            severity 4 or 5 controversy claim that no retrieved article
            supports is discarded before it is ever stored. That is a
            technical control, not a disclaimer: it prevents the harm
            rather than apologising for it. The same gate runs again on the
            client, in <code>lib/controversy.ts</code>, so a record that
            slipped through cannot be rendered.
          </p>

          <h2>5. Record</h2>
          <p>
            A dated snapshot is written on every refresh. The trend line is
            a database query over measured history, not a model&rsquo;s
            guess at what last week looked like. The{" "}
            <Link href="/controversy-index">Controversy Index</Link> is
            recomputed from the stored records by a fixed formula every time
            it is shown.
          </p>

          <h2>What is measured, and what is not</h2>
          <p>
            Accuracy is checked with a benchmark harness that compares the
            three-method ensemble against each method alone, reporting
            accuracy, macro-F1, latency and cost. The committed figures come
            from a small seed set and are <strong>not publishable</strong>;
            the benchmark&rsquo;s own README says so rather than quoting a
            flattering number.
          </p>
          <p>
            Sentiment scores, controversy severities and the index are
            algorithmically assessed, not verified fact, and the app labels
            them as such wherever they appear. If a profile is about you and
            something is wrong,{" "}
            <Link href="/report-correction">report a correction</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
