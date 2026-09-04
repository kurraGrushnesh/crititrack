import type { ProfileAccount } from "@/lib/api";

/**
 * The figure's own verified links — official site and primary social
 * accounts — read from Wikidata. Part of the "here is where you can check
 * for yourself" idea: these go to accounts the person runs, not coverage
 * about them. Renders nothing when Wikidata lists none.
 */
export default function ProfileLinks({
  accounts,
}: {
  accounts: ProfileAccount[];
}) {
  if (accounts.length === 0) return null;

  return (
    <div className="profile-links">
      <span className="profile-links-label">Accounts</span>
      <ul>
        {accounts.map((a) => (
          <li key={a.platform}>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {a.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
