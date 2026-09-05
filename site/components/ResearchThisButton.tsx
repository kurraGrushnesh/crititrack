"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaces } from "@/lib/use-research";
import { saveItemToWorkspace } from "@/lib/use-research";

/**
 * "Research this person" (spec section 3): creates a new workspace
 * pre-seeded with this resolved entity as an ENTITY item, and opens it.
 * The one-click path for starting an investigation from a profile page.
 */
export default function ResearchThisButton({
  slug,
  name,
  wikidataId,
  profession,
}: {
  slug: string;
  name: string;
  wikidataId?: string;
  profession?: string;
}) {
  const { create } = useWorkspaces();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const workspace = await create({ entityNames: [name] });
      await saveItemToWorkspace(workspace.workspaceId, {
        type: "ENTITY",
        entityId: wikidataId ?? slug,
        title: name,
        summary: profession ?? "",
        referenceId: wikidataId ?? slug,
        metadata: {},
      });
      router.push(`/research/workspace?id=${workspace.workspaceId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="research-this-btn" onClick={start} disabled={busy}>
      {busy ? "Starting…" : `Research ${name}`}
    </button>
  );
}
