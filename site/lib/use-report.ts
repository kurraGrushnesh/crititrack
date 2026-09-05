"use client";

/**
 * React wiring for Professional Research Reports — bridges the pure
 * generation logic in `report.ts` to `report-store.ts` (Firestore) and
 * to the entities a report covers, exactly the way `use-research.ts`
 * bridges the workspace model.
 *
 * Building an `EntityReportContext` requires the entity's live
 * `RealProfile` (for coverage/historical/current-score data a saved
 * workspace item never carries on its own) — fetched here via the same
 * `fetchProfile` the rest of the app uses, and run through the same
 * derivation calls `app/figure/page.tsx` already makes (coverage,
 * evidence, claims, historical). No new system, no new fetch shape.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchProfile, type RealProfile } from "./api";
import { buildEvidenceItems } from "./evidence";
import { buildClaimMatrix } from "./claims";
import { buildCoverageReport } from "./coverage";
import { buildHistoricalOverview } from "./historical";
import { computeControversyIndex } from "./controversy-index";
import {
  archiveReport as archiveReportPure,
  createReport as createReportPure,
  generateReport,
  renameReport as renameReportPure,
  setSubtitle as setSubtitlePure,
  type EntityReportContext,
  type ReportSection,
  type ResearchReport,
} from "./report";
import type { ResearchItem, ResearchWorkspace } from "./research";
import {
  currentUid,
  deleteReport as deleteReportStore,
  getReport,
  listCitations,
  listReports as listReportsStore,
  listSections,
  newReportId,
  replaceGeneratedContent,
  saveReport,
} from "./report-store";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: T };

function nowIso(): string {
  return new Date().toISOString();
}

/** Builds one entity's report context from its live profile, reusing
 * exactly the derivations the profile page itself uses — never a
 * second implementation of coverage/claims/historical. */
function buildEntityContext(entityId: string, profile: RealProfile): EntityReportContext {
  const evidenceItems = buildEvidenceItems({
    media: profile.media,
    controversies: profile.controversies,
    career: profile.career.timeline,
    sentimentEvidence: profile.evidence,
  });
  const claims = buildClaimMatrix(profile.controversies, evidenceItems, profile.wikidataId ?? null);
  const coverageReport = buildCoverageReport({ profile, evidenceItems, claims });
  const historicalOverview = buildHistoricalOverview({ profile, claims, changeEvents: [] });
  const index = computeControversyIndex(profile.controversies);
  const attention = profile.attention?.summary;

  return {
    entityId,
    entityName: profile.name,
    profession: profile.profession,
    currentCritiScore: profile.controversies.length > 0 ? index.score : null,
    currentSentimentScore: profile.sentimentScore,
    coverageReport,
    historicalOverview,
    attentionSummary: attention
      ? {
          peakDate: attention.peak.date,
          peakViews: attention.peak.views,
          latestViews: attention.latest.views,
          changePct: attention.changePct,
        }
      : null,
  };
}

/** Resolves the display name CritiTrack has on file for an entity id
 * already in a workspace's scope, from its saved ENTITY item — never
 * guessed from the id itself. */
function nameForEntity(entityId: string, items: ResearchItem[]): string {
  const entityItem = items.find((i) => i.type === "ENTITY" && (i.entityId === entityId || i.referenceId === entityId));
  return entityItem?.title ?? entityId;
}

export function useReports(workspaceId?: string) {
  const [state, setState] = useState<AsyncState<ResearchReport[]>>({ status: "loading" });

  const fetchReports = useCallback(() => currentUid().then((uid) => listReportsStore(uid, workspaceId)), [workspaceId]);

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", value: await fetchReports() });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Could not load reports." });
    }
  }, [fetchReports]);

  useEffect(() => {
    let cancelled = false;
    fetchReports()
      .then((reports) => {
        if (!cancelled) setState({ status: "ready", value: reports });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Could not load reports." });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchReports]);

  const create = useCallback(
    async (workspace: ResearchWorkspace, title?: string) => {
      const uid = await currentUid();
      const reportId = await newReportId();
      const report = createReportPure({
        reportId,
        workspaceId: workspace.workspaceId,
        userId: uid,
        entityIds: workspace.entityIds,
        title: title ?? `${workspace.title} — Report`,
        now: nowIso(),
      });
      await saveReport(uid, report);
      await reload();
      return report;
    },
    [reload],
  );

  const remove = useCallback(
    async (reportId: string) => {
      const uid = await currentUid();
      await deleteReportStore(uid, reportId);
      await reload();
    },
    [reload],
  );

  return { state, reload, create, remove };
}

export interface ReportView {
  report: ResearchReport;
  sections: ReportSection[];
  needsReviewCount: number;
}

export function useReport(reportId: string | null) {
  const [state, setState] = useState<AsyncState<ReportView>>({ status: "loading" });
  const [generating, setGenerating] = useState(false);

  const fetchReport = useCallback(async (): Promise<ReportView | null> => {
    if (!reportId) return null;
    const uid = await currentUid();
    const report = await getReport(uid, reportId);
    if (!report) return null;
    const sections = await listSections(uid, reportId);
    return { report, sections, needsReviewCount: 0 };
  }, [reportId]);

  const reload = useCallback(async () => {
    if (!reportId) return;
    setState({ status: "loading" });
    try {
      const view = await fetchReport();
      if (!view) {
        setState({ status: "error", message: "This report was not found." });
        return;
      }
      setState({ status: "ready", value: view });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Could not load this report." });
    }
  }, [reportId, fetchReport]);

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    fetchReport()
      .then((view) => {
        if (cancelled) return;
        if (!view) {
          setState({ status: "error", message: "This report was not found." });
          return;
        }
        setState({ status: "ready", value: view });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Could not load this report." });
      });
    return () => {
      cancelled = true;
    };
  }, [reportId, fetchReport]);

  const rename = useCallback(
    async (title: string) => {
      if (state.status !== "ready") return;
      const next = renameReportPure(state.value.report, title, nowIso());
      setState({ status: "ready", value: { ...state.value, report: next } });
      await saveReport(await currentUid(), next);
    },
    [state],
  );

  const updateSubtitle = useCallback(
    async (subtitle: string) => {
      if (state.status !== "ready") return;
      const next = setSubtitlePure(state.value.report, subtitle, nowIso());
      setState({ status: "ready", value: { ...state.value, report: next } });
      await saveReport(await currentUid(), next);
    },
    [state],
  );

  const archive = useCallback(async () => {
    if (state.status !== "ready") return;
    const next = archiveReportPure(state.value.report, nowIso());
    setState({ status: "ready", value: { ...state.value, report: next } });
    await saveReport(await currentUid(), next);
  }, [state]);

  const toggleSectionVisibility = useCallback(
    async (sectionId: string) => {
      if (state.status !== "ready") return;
      const uid = await currentUid();
      const sections = state.value.sections.map((s) => (s.sectionId === sectionId ? { ...s, visible: !s.visible } : s));
      setState({ status: "ready", value: { ...state.value, sections } });
      const { saveSection } = await import("./report-store");
      const changed = sections.find((s) => s.sectionId === sectionId);
      if (changed) await saveSection(uid, state.value.report.reportId, changed);
    },
    [state],
  );

  /** "Generate" / "Refresh report from workspace" — fetches each
   * in-scope entity's live profile, rebuilds every section from the
   * workspace's currently-Included items, and replaces the stored
   * sections/citations in one batch. Never touches the report's own
   * title/subtitle/description — those are the user's, preserved
   * across a regeneration exactly as spec section 20 requires. On
   * failure, the previously-saved sections are left untouched: a report
   * a user already has never disappears because a later regeneration
   * failed. */
  const generate = useCallback(
    async (workspace: ResearchWorkspace, items: ResearchItem[]) => {
      if (state.status !== "ready") return;
      setGenerating(true);
      try {
        const uid = await currentUid();
        const entities = await Promise.all(
          workspace.entityIds.map(async (entityId): Promise<EntityReportContext | null> => {
            const name = nameForEntity(entityId, items);
            try {
              const profile = await fetchProfile(name, { qid: /^Q\d+$/.test(entityId) ? entityId : undefined });
              return buildEntityContext(entityId, profile);
            } catch {
              // A provider/profile fetch failure for one entity must not
              // block the rest of the report — that entity's sections
              // simply have less to draw on, disclosed via Data Coverage.
              return null;
            }
          }),
        );
        const resolvedEntities = entities.filter((e): e is EntityReportContext => e !== null);

        const { sections, citations } = generateReport({
          workspace,
          items,
          entities: resolvedEntities,
          now: nowIso(),
        });
        await replaceGeneratedContent(uid, state.value.report.reportId, sections, citations);

        const updatedReport: ResearchReport = {
          ...state.value.report,
          status: "READY",
          generatedAt: nowIso(),
          updatedAt: nowIso(),
          version: state.value.report.version + 1,
          sectionIds: sections.map((s) => s.sectionId),
        };
        await saveReport(uid, updatedReport);
        setState({ status: "ready", value: { report: updatedReport, sections, needsReviewCount: 0 } });
      } finally {
        setGenerating(false);
      }
    },
    [state],
  );

  return { state, generating, reload, rename, updateSubtitle, archive, toggleSectionVisibility, generate };
}

export async function loadCitations(reportId: string) {
  const uid = await currentUid();
  return listCitations(uid, reportId);
}
