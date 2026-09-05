import type { Metadata } from "next";
import Link from "next/link";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import { METHODOLOGY_CHANGES } from "@/lib/methodology-version";
import { SYSTEM_VERSIONS, METHODOLOGY_SECTIONS } from "@/lib/methodology";

export const metadata: Metadata = {
  title: "Method",
  description:
    "How CritiTrack turns a name into a sourced, scored profile: resolve, gather, score, gate, record — and the version of the code behind every number.",
};

/** Order matches the spec's suggested outline: Entity Resolution, Evidence,
 * Claims, CritiScore sit before Sentiment; Attention, Timeline, Coverage
 * sit after it. */
const BEFORE_SENTIMENT = ["evidence", "claims", "critiscore"];
const AFTER_SENTIMENT = ["attention-trending", "timeline", "data-coverage"];

export default function MethodologyPage() {
  const byId = new Map(METHODOLOGY_SECTIONS.map((s) => [s.id, s]));
  const before = BEFORE_SENTIMENT.map((id) => byId.get(id)!);
  const after = AFTER_SENTIMENT.map((id) => byId.get(id)!);
  const limitations = byId.get("limitations")!;

  return (
    <>
      <PillNav />
      <main id="main" className="page page-narrow">
        <div className="page-head">
          <h1>Method</h1>
          <p>
            What happens between typing a name and seeing a profile, where
            the guardrails are, and the version of the code that produced
            each number.
          </p>
        </div>

        <div className="prose">
          <h2>Methodology versions</h2>
          <p>
            Every calculated result on a profile is stamped with the
            version of the system that produced it. A version only
            changes when the underlying formula or rules change — never
            silently.
          </p>
          <table className="version-table">
            <thead>
              <tr>
                <th>System</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM_VERSIONS.map((s) => (
                <tr key={s.system}>
                  <td>{s.label}</td>
                  <td className="version-badge">v{s.version}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 id="entity-resolution">1. Entity Resolution</h2>
          <p>
            The name is matched against Wikidata and filtered to entities
            Wikidata lists as human. Spelling variants converge on one
            entity, so every rendering of a name shares a single cache
            entry. If the name matches several people, the alternatives are
            offered rather than one being picked silently. A name that
            resolves to nothing documented is marked unverified, not
            rejected.
          </p>
          <p>
            Occupation, notability (sitelink count), and any available
            dates are weighed alongside the name itself, because name-only
            matching cannot tell two same-named people apart. The result is
            a confidence band — high, medium, low, or ambiguous — never a
            bare yes/no.
          </p>

          <h2>2. Gather</h2>
          <p>
            Coverage is pulled from GDELT, a news API and YouTube in
            parallel, then deduplicated across sources so a syndicated
            story counts once. Only headline, outlet, date and link are
            kept; article bodies are not stored.
          </p>

          {before.map((s) => (
            <section key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </section>
          ))}

          <h2 id="sentiment">Public Sentiment, in detail</h2>
          <p>
            Three independent methods score each item: a general-purpose
            lexicon, a reputation-tuned lexicon, and a batched
            language-model call. The blend is weighted by reach, because a
            front-page story and a 200-view upload are not equally
            informative. The spread between the three methods becomes a
            confidence band. A single-method score has nothing to disagree
            with, so it can only assert.
          </p>
          <p>
            Sentiment measures the tone of analyzed coverage, never the
            truth of a claim. Negative sentiment is not proof of
            wrongdoing; positive sentiment does not disprove an allegation
            — sentiment and the Controversy Index/CritiScore are computed
            independently and never feed into one another.
          </p>

          {after.map((s) => (
            <section key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </section>
          ))}

          <h2>Gate</h2>
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

          <h2>Record</h2>
          <p>
            A dated snapshot is written on every refresh. The trend line is
            a database query over measured history, not a model&rsquo;s
            guess at what last week looked like. The{" "}
            <Link href="/controversy-index">Controversy Index</Link> is
            recomputed from the stored records by a fixed formula every time
            it is shown.
          </p>

          <h2 id="limitations">{limitations.title}</h2>
          <p>
            Accuracy is checked with a benchmark harness that compares the
            three-method sentiment ensemble against each method alone,
            reporting accuracy, macro-F1, latency and cost. The committed
            figures come from a small seed set and are{" "}
            <strong>not publishable</strong>; the benchmark&rsquo;s own
            README says so rather than quoting a flattering number.
          </p>
          {limitations.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p>
            Sentiment scores, controversy severities and the index are
            algorithmically assessed, not verified fact, and the app labels
            them as such wherever they appear. If a profile is about you and
            something is wrong,{" "}
            <Link href="/report-correction">report a correction</Link>.
          </p>

          <h2 id="version-history">Version history</h2>
          <p>
            When a formula changes, the number a share card or export shows
            can change with it. Each version below is what was in force on
            its date; new share cards carry the current version so an old
            screenshot stays readable as &ldquo;computed under method
            v3&rdquo;. This tracks the whole-product method number; the
            per-system versions above are more specific to one calculation.
          </p>
          <ul>
            {METHODOLOGY_CHANGES.map((c) => (
              <li key={c.version}>
                <strong>v{c.version}</strong> ·{" "}
                {c.date}
                {c.approxDate ? " (approx.)" : ""} — {c.summary}
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
