"use client";

import { useState } from "react";
import { demoProfileBySlug } from "@/lib/demo-data";
import { comparisonToQuery } from "@/lib/comparisons";
import {
  useComparisons,
  saveComparison,
  deleteComparison,
} from "./comparisons-store";

/**
 * The list of saved comparison sets, plus a control to save the pair
 * currently shown. Each saved row reopens via `/compare/?figures=a,b`.
 * Device-local; nothing is sent anywhere.
 */
export default function SavedComparisons({
  current,
}: {
  /** The slugs currently being compared, for the "save this" control. */
  current: string[];
}) {
  const saved = useComparisons();
  const [label, setLabel] = useState("");

  const canSave = current.filter(Boolean).length >= 2 && label.trim().length > 0;

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    saveComparison(
      label,
      current.filter(Boolean).map((slug) => ({
        slug,
        name: demoProfileBySlug(slug)?.name ?? slug,
      })),
    );
    setLabel("");
  }

  return (
    <div className="saved-cmp">
      <form className="saved-cmp-row" onSubmit={onSave}>
        <input
          type="text"
          value={label}
          maxLength={60}
          aria-label="Name this comparison"
          placeholder="Name this comparison (e.g. “Streaming CEOs”)"
          onChange={(e) => setLabel(e.target.value)}
          style={{ flex: "1 1 220px" }}
        />
        <button type="submit" className="linkbtn" disabled={!canSave}>
          Save this comparison
        </button>
      </form>

      {saved.map((c) => (
        <div key={c.id} className="saved-cmp-row">
          <span className="saved-cmp-label">{c.label}</span>
          <span className="saved-cmp-members">
            {c.members.map((m) => m.name).join(" vs ")}
          </span>
          <span className="saved-cmp-actions">
            <a
              className="linkbtn"
              href={`/compare/?figures=${comparisonToQuery(c)}`}
            >
              Open
            </a>
            <button
              type="button"
              className="linkbtn is-danger"
              onClick={() => deleteComparison(c.id)}
            >
              Delete
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
