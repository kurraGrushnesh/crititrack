"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import Button from "@/components/Button";
import { useComparisons } from "@/lib/use-compare";
import { fetchProfile, ApiError } from "@/lib/api";

/**
 * Advanced Compare — entry point. Resolves two names (any correctly
 * resolved global entity, catalogue membership never required) before
 * creating a comparison, exactly the way `/figure` resolves a search —
 * no separate resolution system.
 */
export default function CompareCreatePage() {
  const router = useRouter();
  const { create } = useComparisons();
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!nameA.trim() || !nameB.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const [profileA, profileB] = await Promise.all([fetchProfile(nameA.trim()), fetchProfile(nameB.trim())]);

      if (profileA.resolution === "ambiguous" || profileB.resolution === "ambiguous") {
        setError(
          "One of these names matches more than one real person. Search for each on its own profile page first, pin the right one, then come back and compare using their exact names.",
        );
        return;
      }

      const entityIdA = profileA.wikidataId ?? profileA.slug;
      const entityIdB = profileB.wikidataId ?? profileB.slug;
      const comparison = await create({
        entityIds: [entityIdA, entityIdB],
        entityNames: [profileA.name, profileB.name],
      });
      router.push(`/research/compare/view?id=${comparison.comparisonId}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not resolve one of these names. Check the spelling and try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PillNav />
      <main id="main" className="page">
        <div className="page-head">
          <h1>Compare</h1>
          <p>
            Puts two resolved entities side by side using CritiTrack&rsquo;s
            existing intelligence — CritiScore, sentiment, career,
            controversies, claims, and data coverage. This describes real
            differences in the available evidence; it never ranks who is
            &ldquo;better&rdquo;.
          </p>
        </div>

        <form onSubmit={onCompare} className="cmp-create-form">
          <label className="field">
            <span>Entity A</span>
            <input type="text" value={nameA} onChange={(e) => setNameA(e.target.value)} placeholder="Search a name…" />
          </label>
          <span className="cmp-vs">vs</span>
          <label className="field">
            <span>Entity B</span>
            <input type="text" value={nameB} onChange={(e) => setNameB(e.target.value)} placeholder="Search a name…" />
          </label>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Resolving…" : "Compare"}
          </Button>
        </form>

        {error && <p className="state-block">{error}</p>}
      </main>
      <SiteFooter />
    </>
  );
}
