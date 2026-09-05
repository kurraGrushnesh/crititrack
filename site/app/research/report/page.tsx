"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import Button from "@/components/Button";
import { useReport } from "@/lib/use-report";
import { useWorkspace } from "@/lib/use-research";
import { SECTION_LABEL, type ContentBlock, type ContentBlockKind } from "@/lib/report";
import { relativeTime } from "@/lib/time";

const BLOCK_LABEL: Record<ContentBlockKind, string> = {
  fact: "Fact",
  analysis: "Analysis",
  userNote: "Research note",
  limitation: "Limitation",
};

function Block({ block }: { block: ContentBlock }) {
  return (
    <p className={`rr-block rr-block-${block.kind}`}>
      {block.kind !== "fact" && <span className="rr-block-label">{BLOCK_LABEL[block.kind]}: </span>}
      {block.text}
      {block.citationIds.length > 0 && (
        <span className="rr-cites">
          {" "}
          {block.citationIds.map((n) => (
            <a key={n} href="#evidence-sources" className="rr-cite">
              [{n}]
            </a>
          ))}
        </span>
      )}
    </p>
  );
}

function ReportInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const { state, generating, rename, archive, toggleSectionVisibility, generate } = useReport(id);

  if (!id) return <p className="state-block">No report selected.</p>;
  if (state.status === "loading") return <p className="state-block">Loading report…</p>;
  if (state.status === "error") return <p className="state-block">{state.message}</p>;

  const { report, sections } = state.value;

  return (
    <div className="rr-report">
      <ReportHeader
        workspaceId={report.workspaceId}
        title={report.title}
        onRename={rename}
        generating={generating}
        onGenerate={generate}
      />
      <p className="rr-meta">
        Status: {report.status} · v{report.version}
        {report.generatedAt && <> · generated {relativeTime(report.generatedAt)}</>} · methodology{" "}
        {report.methodologyVersion}
      </p>
      {report.status === "DRAFT" && sections.length === 0 && (
        <p className="state-block">
          <span className="sb-title">Not generated yet</span>
          Click &ldquo;Generate report&rdquo; to build sections from this
          workspace&rsquo;s Included items.
        </p>
      )}

      <div className="rr-sections">
        {sections
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s) => (
            <section key={s.sectionId} id={s.kind === "evidenceSources" ? "evidence-sources" : s.sectionId} className="rr-section">
              <div className="rr-section-head">
                <h2>{SECTION_LABEL[s.kind]}</h2>
                <button type="button" className="rr-toggle" onClick={() => toggleSectionVisibility(s.sectionId)}>
                  {s.visible ? "Hide" : "Show"}
                </button>
              </div>
              {s.visible && s.blocks.map((b) => <Block key={b.blockId} block={b} />)}
            </section>
          ))}
      </div>

      <p className="dc-footnote">
        This report presents existing CritiTrack records selected from a research
        workspace. It never overwrites verification, confidence, or scores — every
        fact traces back to a source or record, and every research note is the
        user&rsquo;s own words, clearly labeled.
      </p>

      <Button variant="ghost" size="sm" onClick={archive}>
        Archive report
      </Button>
    </div>
  );
}

function ReportHeader({
  workspaceId,
  title,
  onRename,
  generating,
  onGenerate,
}: {
  workspaceId: string;
  title: string;
  onRename: (title: string) => void;
  generating: boolean;
  onGenerate: (workspace: import("@/lib/research").ResearchWorkspace, items: import("@/lib/research").ResearchItem[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { state: wsState } = useWorkspace(workspaceId);

  return (
    <div className="rr-header">
      {editing ? (
        <input
          autoFocus
          defaultValue={title}
          onBlur={(e) => {
            setEditing(false);
            if (e.target.value.trim()) onRename(e.target.value);
          }}
        />
      ) : (
        <h1 onClick={() => setEditing(true)}>{title}</h1>
      )}
      {wsState.status === "ready" && (
        <>
          {wsState.value.items.some((i) => i.status === "NEEDS_REVIEW") && (
            <p className="rr-warning">
              {wsState.value.items.filter((i) => i.status === "NEEDS_REVIEW").length} workspace item(s) are marked
              Needs Review and will not be included until resolved.
            </p>
          )}
          <Button
            variant="primary"
            size="sm"
            disabled={generating}
            onClick={() => onGenerate(wsState.value.workspace, wsState.value.items)}
          >
            {generating ? "Generating…" : "Refresh report from workspace"}
          </Button>
        </>
      )}
    </div>
  );
}

export default function ResearchReportPage() {
  return (
    <>
      <PillNav />
      <main id="main" className="page">
        <Suspense fallback={<p className="state-block">Loading report…</p>}>
          <ReportInner />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
