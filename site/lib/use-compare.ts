"use client";

/**
 * React wiring for Advanced Compare — fetches each entity's live
 * profile (the same `fetchProfile` every other screen uses), builds an
 * `EntityComparisonContext` from it via the exact same derivation calls
 * `use-report.ts` already makes (coverage/evidence/claims/historical —
 * no second implementation), and hands the pair to `compare.ts`'s pure
 * `buildComparison`. Persistence goes through `compare-store.ts`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProfile, type RealProfile } from "./api";
import { buildEvidenceItems } from "./evidence";
import { buildClaimMatrix } from "./claims";
import { buildCoverageReport } from "./coverage";
import { buildHistoricalOverview } from "./historical";
import { computeControversyIndex, scoreBand } from "./controversy-index";
import { buildRelationships } from "./relationships";
import { sentimentBand } from "./sentiment";
import { buildTimeline } from "./timeline";
import {
  buildComparison,
  createComparison as createComparisonPure,
  renameComparison as renameComparisonPure,
  updateFilters as updateFiltersPure,
  updateTimeRange as updateTimeRangePure,
  type Comparison,
  type ComparisonFilters,
  type ComparisonSection,
  type EntityComparisonContext,
} from "./compare";
import type { HistoricalTimeRange } from "./historical";
import {
  currentUid,
  deleteComparison as deleteComparisonStore,
  getComparison,
  listComparisons as listComparisonsStore,
  newComparisonId,
  saveComparison,
} from "./compare-store";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: T };

function nowIso(): string {
  return new Date().toISOString();
}

/** Builds one entity's comparison context from its live profile —
 * reusing exactly what the profile page and the report generator
 * already compute. */
export function buildEntityContext(entityId: string, profile: RealProfile): EntityComparisonContext {
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
  const timeline = buildTimeline({
    controversies: profile.controversies,
    media: profile.media,
    career: profile.career.timeline,
    attentionSeries: profile.attention?.series ?? [],
    trend: profile.trend,
  });

  return {
    entityId,
    entityName: profile.name,
    profession: profile.profession || profile.professional?.primary?.label || null,
    country: null, // RealProfile carries no country field for a resolved entity
    currentRole: profile.professional?.roles?.[0] ?? null,
    industries: profile.professional?.industries?.map((i) => i.label) ?? [],
    watchStatus: false, // filled in by the caller, which has the watchlist in context
    critiScore: profile.controversies.length > 0 ? index.score : null,
    critiScoreBand: profile.controversies.length > 0 ? scoreBand(index.score).band : null,
    critiScoreHistory: [],
    sentimentScore: profile.sentimentScore,
    sentimentBand: sentimentBand(profile.sentimentScore),
    sentimentTrendDirection: profile.trendDirection,
    sentimentSnapshots: [],
    attentionSummary: attention
      ? {
          peakDate: attention.peak.date,
          peakViews: attention.peak.views,
          latestViews: attention.latest.views,
          changePct: attention.changePct,
        }
      : null,
    career: profile.career,
    controversies: profile.controversies,
    claims,
    meaningfulNewsCount: timeline.filter((e) => e.kind === "news").length,
    coverageReport,
    historicalOverview,
    relationships: buildRelationships({
      subjectEntityId: entityId,
      subjectName: profile.name,
      wikidataRelationships: profile.relationships,
      career: profile.career.timeline,
      evidenceItems,
    }),
  };
}

export interface CompareView {
  comparison: Comparison;
  contextA: EntityComparisonContext | null;
  contextB: EntityComparisonContext | null;
  sections: ComparisonSection[];
}

export function useCompare(comparisonId: string | null) {
  const [state, setState] = useState<AsyncState<CompareView>>({ status: "loading" });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const fetchView = useCallback(async (): Promise<CompareView | null> => {
    if (!comparisonId) return null;
    const uid = await currentUid();
    const comparison = await getComparison(uid, comparisonId);
    if (!comparison) return null;
    const [idA, idB] = comparison.entityIds;
    const [profileA, profileB] = await Promise.all([
      idA ? fetchProfile(idA, { qid: /^Q\d+$/.test(idA) ? idA : undefined }).catch(() => null) : Promise.resolve(null),
      idB ? fetchProfile(idB, { qid: /^Q\d+$/.test(idB) ? idB : undefined }).catch(() => null) : Promise.resolve(null),
    ]);
    const contextA = profileA ? buildEntityContext(idA, profileA) : null;
    const contextB = profileB ? buildEntityContext(idB, profileB) : null;
    const sections =
      contextA && contextB
        ? buildComparison({ a: contextA, b: contextB, filters: comparison.filters, timeRange: comparison.timeRange })
        : [];
    return { comparison, contextA, contextB, sections };
  }, [comparisonId]);

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const view = await fetchView();
      if (!view) {
        setState({ status: "error", message: "This comparison was not found." });
        return;
      }
      setState({ status: "ready", value: view });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Could not load this comparison." });
    }
  }, [fetchView]);

  useEffect(() => {
    if (!comparisonId) return;
    let cancelled = false;
    fetchView()
      .then((view) => {
        if (cancelled) return;
        if (!view) {
          setState({ status: "error", message: "This comparison was not found." });
          return;
        }
        setState({ status: "ready", value: view });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Could not load this comparison." });
      });
    return () => {
      cancelled = true;
    };
  }, [comparisonId, fetchView]);

  const mutateComparison = useCallback((fn: (c: Comparison) => Comparison) => {
    const current = stateRef.current;
    if (current.status !== "ready") return null;
    const next = fn(current.value.comparison);
    const sections =
      current.value.contextA && current.value.contextB
        ? buildComparison({ a: current.value.contextA, b: current.value.contextB, filters: next.filters, timeRange: next.timeRange })
        : [];
    setState({ status: "ready", value: { ...current.value, comparison: next, sections } });
    return next;
  }, []);

  const rename = useCallback(
    async (title: string) => {
      const next = mutateComparison((c) => renameComparisonPure(c, title, nowIso()));
      if (next) await saveComparison(await currentUid(), next);
    },
    [mutateComparison],
  );

  const setFilters = useCallback(
    async (filters: Partial<ComparisonFilters>) => {
      const next = mutateComparison((c) => updateFiltersPure(c, filters, nowIso()));
      if (next) await saveComparison(await currentUid(), next);
    },
    [mutateComparison],
  );

  const setTimeRange = useCallback(
    async (range: HistoricalTimeRange) => {
      const next = mutateComparison((c) => updateTimeRangePure(c, range, nowIso()));
      if (next) await saveComparison(await currentUid(), next);
    },
    [mutateComparison],
  );

  return { state, reload, rename, setFilters, setTimeRange };
}

export function useComparisons() {
  const [state, setState] = useState<AsyncState<Comparison[]>>({ status: "loading" });

  const fetchComparisons = useCallback(() => currentUid().then(listComparisonsStore), []);

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", value: await fetchComparisons() });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Could not load comparisons." });
    }
  }, [fetchComparisons]);

  useEffect(() => {
    let cancelled = false;
    fetchComparisons()
      .then((list) => {
        if (!cancelled) setState({ status: "ready", value: list });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Could not load comparisons." });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchComparisons]);

  const create = useCallback(
    async (input: { entityIds: string[]; entityNames?: string[]; title?: string }) => {
      const uid = await currentUid();
      const comparisonId = await newComparisonId();
      const comparison = createComparisonPure({ ...input, comparisonId, userId: uid, now: nowIso() });
      await saveComparison(uid, comparison);
      await reload();
      return comparison;
    },
    [reload],
  );

  const remove = useCallback(
    async (comparisonId: string) => {
      const uid = await currentUid();
      await deleteComparisonStore(uid, comparisonId);
      await reload();
    },
    [reload],
  );

  return { state, reload, create, remove };
}
