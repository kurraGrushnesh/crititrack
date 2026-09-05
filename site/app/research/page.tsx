"use client";

import { useState } from "react";
import Link from "next/link";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import Button from "@/components/Button";
import { useWorkspaces } from "@/lib/use-research";
import { relativeTime } from "@/lib/time";

export default function ResearchListPage() {
  const { state, create, archive, reactivate, remove } = useWorkspaces();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <>
      <PillNav />
      <main id="main" className="page">
        <div className="page-head">
          <h1>Research Workspace</h1>
          <p>
            Collect evidence, claims, and events into a private workspace as
            you investigate — nothing here changes CritiTrack&rsquo;s own
            verification or scores. Private to this browser: there is no
            account system yet, so a workspace does not follow you to a
            different browser or device.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setCreating((v) => !v)}>
          + New workspace
        </Button>

        {creating && (
          <form
            className="rw-create-form"
            onSubmit={async (e) => {
              e.preventDefault();
              await create({ title: title.trim() || undefined });
              setTitle("");
              setCreating(false);
            }}
          >
            <input
              type="text"
              placeholder="Workspace title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <Button type="submit" variant="ghost" size="sm">
              Create
            </Button>
          </form>
        )}

        {state.status === "loading" && <p className="state-block">Loading your workspaces…</p>}
        {state.status === "error" && <p className="state-block">{state.message}</p>}

        {state.status === "ready" && state.value.length === 0 && (
          <p className="state-block">
            <span className="sb-title">No research workspaces yet</span>
            Create one from here, or use &ldquo;Save to research&rdquo; on any
            evidence, claim, controversy, or event on a profile.
          </p>
        )}

        {state.status === "ready" && (
          <div className="rw-list">
            {state.value.map((w) => (
              <div key={w.workspaceId} className={`rw-card ${w.status === "ARCHIVED" ? "is-archived" : ""}`}>
                <Link href={`/research/workspace?id=${w.workspaceId}`} className="rw-card-title">
                  {w.title}
                </Link>
                {w.description && <p className="rw-card-desc">{w.description}</p>}
                <p className="rw-card-meta">
                  {w.entityIds.length} entit{w.entityIds.length === 1 ? "y" : "ies"} · updated{" "}
                  {relativeTime(w.updatedAt)}
                  {w.status === "ARCHIVED" && " · archived"}
                </p>
                <div className="rw-card-actions">
                  {w.status === "ACTIVE" ? (
                    <button type="button" onClick={() => archive(w)}>
                      Archive
                    </button>
                  ) : (
                    <button type="button" onClick={() => reactivate(w)}>
                      Reactivate
                    </button>
                  )}
                  <button
                    type="button"
                    className="rw-danger"
                    onClick={() => {
                      if (confirm(`Delete "${w.title}"? This removes everything saved in it.`)) remove(w.workspaceId);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
