import Hero from "@/components/Hero";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import type { Figure } from "@/components/SentimentGlobe";

/**
 * Illustrative data.
 *
 * Deliberately not fetched from the live API: the marketing site is a
 * static export, and a build-time fetch would bake one moment's scores
 * into a page that then claims to be current. Labelled as illustrative on
 * the page itself rather than implying it is live.
 */
const FIGURES: Figure[] = [
  { name: "Film & television", score: 71, lat: 34, lon: -118 },
  { name: "Music", score: 66, lat: 51, lon: 0 },
  { name: "Sport", score: 44, lat: -33, lon: 151 },
  { name: "Technology", score: 38, lat: 37, lon: -122 },
  { name: "Politics", score: 31, lat: 48, lon: 2 },
  { name: "Business", score: 58, lat: 19, lon: 72 },
  { name: "Broadcasting", score: 62, lat: 35, lon: 139 },
];

const PILLARS = [
  {
    n: "01",
    title: "Structure over prose",
    body: "Controversies are typed records — title, category, severity 1–5, status, year, sources — not a paragraph of text. Structure is what makes them sortable, comparable, auditable and testable.",
  },
  {
    n: "02",
    title: "Deterministic scoring",
    body: "The Controversy Index is computed from those records, not asked from a model. The same input always produces the same score, and unit tests pin the shape of the curve.",
  },
  {
    n: "03",
    title: "Measured uncertainty",
    body: "Three independent methods score every headline — a general lexicon, a reputation lexicon, and a language model. How much they disagree becomes a confidence band. A single-method score has nothing to disagree with, so it can only assert.",
  },
  {
    n: "04",
    title: "Corroboration before display",
    body: "A severity 4–5 claim that no retrieved article supports is discarded, not rendered. That is a technical control rather than a disclaimer: it prevents the harm instead of apologising for it.",
  },
];

const STEPS = [
  {
    k: "Resolve",
    body: "The name is matched against Wikidata and filtered to documented people. Every spelling converges on one entity, so “ntr” becomes N. T. Rama Rao and three variants share one cache entry.",
  },
  {
    k: "Gather",
    body: "Coverage is pulled from GDELT, NewsAPI and YouTube in parallel, then deduplicated across sources so a syndicated story counts once rather than three times.",
  },
  {
    k: "Score",
    body: "A general lexicon, a reputation lexicon and a batched language-model call score each item independently. The blend is weighted by reach — a front-page story and a 200-view upload are not equally informative — and the spread between the three becomes the confidence band.",
  },
  {
    k: "Gate",
    body: "Generated claims are schema-validated, required to cite a source, and checked against what was actually retrieved. Anything unsupported is dropped before it reaches a screen.",
  },
  {
    k: "Record",
    body: "A dated snapshot is stored on every refresh. The trend line is a database query over measured history, not a model's guess at what last week looked like.",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <Hero figures={FIGURES} />

      <main id="main">
        <section id="how" className="band">
          <div className="wrap">
            <p className="section-label">Why it is different</p>
            <h2>Four things that separate this from asking a chatbot</h2>
            <p className="section-lede">
              The easy version of this product renders whatever a language
              model says. It falls apart the moment someone asks how you know
              it is true. These four exist to answer that.
            </p>

            <div className="pillars">
              {PILLARS.map((p) => (
                <article key={p.n} className="pillar">
                  <span className="pillar-n">{p.n}</span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="method" className="band band-alt">
          <div className="wrap">
            <p className="section-label">The pipeline</p>
            <h2>What happens when you search a name</h2>

            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.k}>
                  <div className="step-head">
                    <span className="step-i">{i + 1}</span>
                    <h3>{s.k}</h3>
                  </div>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="band">
          <div className="wrap">
            <p className="section-label">Honesty</p>
            <h2>What this does not claim</h2>
            <div className="honesty">
              <p>
                Sentiment scores, controversy severities and the index are{" "}
                <strong>algorithmically assessed, not verified fact</strong>,
                and the app labels them as such wherever they appear.
              </p>
              <p>
                Accuracy is measured with a benchmark harness that compares the
                ensemble against each method alone, reporting accuracy, macro-F1,
                latency and cost. The committed figures currently come from a
                small seed set and are{" "}
                <strong>not publishable</strong> — the repository says so, in
                the benchmark&rsquo;s own README, rather than quoting a flattering
                number.
              </p>
              <p>
                CritiTrack covers public figures using published reporting. If
                you are the subject of a profile and believe something is
                inaccurate, every entry carries a report control.
              </p>
            </div>
          </div>
        </section>

        <section className="band band-alt">
          <div className="wrap cta-band">
            <h2>Built in the open</h2>
            <p className="section-lede">
              The security posture, privacy policy and benchmark method are all
              in the repository, including the parts that are unfinished.
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" href="/app/">
                Open the app
              </a>
              <a
                className="btn btn-ghost"
                href="https://github.com/kurraGrushnesh/crititrack"
                rel="noopener noreferrer"
              >
                View the source
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
