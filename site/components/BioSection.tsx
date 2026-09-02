import Link from "next/link";
import type { RealProfile } from "@/lib/api";

/**
 * The biography block: a short model-written summary, the longer
 * background behind a "Read more" disclosure, and the notable-work list.
 *
 * All of it comes from the backend's Groq-written `biography` — there is
 * no Wikidata here. The disclosure is a native `<details>`, so it needs
 * no client JS and works from the keyboard.
 */
export default function BioSection({
  profile,
  fetchedLabel,
  correctionHref,
}: {
  profile: RealProfile;
  fetchedLabel: string;
  correctionHref: string;
}) {
  const summary = profile.summary.trim();
  const background = profile.background.trim();
  const hasBackground = background.length > 0 && background !== summary;
  const works = profile.notableWorks;

  return (
    <div className="bio">
      {summary && <p className="bio-summary">{summary}</p>}

      {hasBackground && (
        <details className="bio-more">
          <summary>Read more</summary>
          <p>{background}</p>
        </details>
      )}

      {works.length > 0 && (
        <div className="bio-works">
          <h3>Notable work</h3>
          <ul>
            {works.map((w) => (
              <li key={w} className="tag">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="form-note">
        Compiled {fetchedLabel} from public coverage. The summary is
        model-written.{" "}
        <Link href={correctionHref}>Report a correction</Link>.
      </p>
    </div>
  );
}
