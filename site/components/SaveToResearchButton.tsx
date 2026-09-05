"use client";

import { useState } from "react";
import { useWorkspaces } from "@/lib/use-research";
import { saveItemToWorkspace } from "@/lib/use-research";
import type { AddItemInput } from "@/lib/research";

export type SaveToResearchInput = Omit<AddItemInput, "itemId" | "workspaceId" | "now">;

/**
 * The fast "save to research" action (spec section 23): one tap opens a
 * short list of existing workspaces plus "New workspace"; picking one
 * saves immediately. No form, no second screen for the common case.
 *
 * Drop this on anything a piece of evidence, a claim, a controversy, a
 * timeline/change/historical event, or a source already renders — pass
 * a stable `referenceId` so saving the same thing twice never
 * duplicates (see `research.ts`'s `stableItemKey`).
 */
export default function SaveToResearchButton({ item }: { item: SaveToResearchInput }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const { state, create } = useWorkspaces();

  async function saveTo(workspaceId: string, title: string) {
    setBusy(true);
    try {
      await saveItemToWorkspace(workspaceId, item);
      setSavedTo(title);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function saveToNew() {
    setBusy(true);
    try {
      // Only an ENTITY item's own title is a person/organization name —
      // for anything else (evidence, a claim, an event...) a new
      // workspace gets the default "Untitled research" title instead of
      // borrowing that item's own title.
      const workspace = await create({ entityNames: item.type === "ENTITY" ? [item.title] : undefined });
      await saveItemToWorkspace(workspace.workspaceId, item);
      setSavedTo(workspace.title);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (savedTo) {
    return <span className="str-saved">Saved to {savedTo} ✓</span>;
  }

  return (
    <span className="str-wrap">
      <button type="button" className="str-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Save to research
      </button>
      {open && (
        <span className="str-menu" role="menu">
          {state.status === "ready" &&
            state.value
              .filter((w) => w.status === "ACTIVE")
              .slice(0, 6)
              .map((w) => (
                <button
                  key={w.workspaceId}
                  type="button"
                  className="str-menu-item"
                  disabled={busy}
                  onClick={() => saveTo(w.workspaceId, w.title)}
                >
                  {w.title}
                </button>
              ))}
          {state.status === "ready" && state.value.filter((w) => w.status === "ACTIVE").length === 0 && (
            <span className="str-menu-empty">No workspaces yet.</span>
          )}
          <button type="button" className="str-menu-item str-menu-new" disabled={busy} onClick={saveToNew}>
            + New workspace
          </button>
        </span>
      )}
    </span>
  );
}
