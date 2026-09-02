import { displayHost, parseSafeUrl } from "@/lib/safe-url";

/**
 * Renders one source string from a controversy record. If it is a safe
 * https URL it becomes a link labelled by its host; otherwise it is a
 * publication name and renders as plain text. The link policy is the
 * shared one in `lib/safe-url.ts`, so an unsafe scheme is never turned
 * into an anchor.
 */
export default function SourceLink({ source }: { source: string }) {
  const url = parseSafeUrl(source);
  if (url) {
    return (
      <a
        className="source-link"
        href={url.toString()}
        rel="noopener noreferrer nofollow"
        target="_blank"
      >
        {displayHost(source)}
      </a>
    );
  }
  return <span className="source-plain">{source}</span>;
}
