import Link from "next/link";
import type { RealProfile } from "@/lib/api";

/**
 * The biography block: a short model-written summary, the longer
 * background, and the notable-work list. Everything is shown inline —
 * the background is not worth a click.
 *
 * All of it comes from the backend's Groq-written `biography`. No
 * Wikidata.
 */
function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}|(?<=\.)\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

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
        <div className="bio-background">
          {paragraphs(background).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
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
