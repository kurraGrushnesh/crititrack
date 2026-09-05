"use client";

/**
 * Firestore persistence for Professional Research Reports — the
 * storage side of `report.ts`, which does all the actual generation
 * logic. This file only reads and writes documents.
 *
 * Schema: `users/{uid}/researchReports/{reportId}`, with a `sections`
 * subcollection (one document per section) rather than one big array
 * field on the report document — a report can have up to 16 sections,
 * each with its own citation-bearing blocks, so keeping them as
 * separate documents avoids ever approaching Firestore's 1 MiB
 * per-document limit on a long report. Same reasoning `research-
 * store.ts` used for a workspace's `items` subcollection.
 *
 * Ruled to `request.auth.uid == userId`, same as every other per-user
 * collection in `firestore.rules`.
 */

import { ensureSignedInUid, getFirebaseApp } from "./firebase";
import type { Citation, ReportSection, ResearchReport } from "./report";

async function db() {
  const { getFirestore } = await import("firebase/firestore");
  return getFirestore(getFirebaseApp());
}

const REPORTS = "researchReports";
const SECTIONS = "sections";
const CITATIONS = "citations";

function reportsCol(uid: string) {
  return `users/${uid}/${REPORTS}`;
}

export async function currentUid(): Promise<string> {
  return ensureSignedInUid();
}

export async function newReportId(): Promise<string> {
  const { collection, doc } = await import("firebase/firestore");
  return doc(collection(await db(), "_ids")).id;
}

export async function listReports(uid: string, workspaceId?: string): Promise<ResearchReport[]> {
  const { collection, getDocs, orderBy, query, where } = await import("firebase/firestore");
  const col = collection(await db(), reportsCol(uid));
  const q = workspaceId
    ? query(col, where("workspaceId", "==", workspaceId), orderBy("updatedAt", "desc"))
    : query(col, orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ResearchReport);
}

export async function getReport(uid: string, reportId: string): Promise<ResearchReport | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(await db(), reportsCol(uid), reportId));
  return snap.exists() ? (snap.data() as ResearchReport) : null;
}

export async function saveReport(uid: string, report: ResearchReport): Promise<void> {
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(await db(), reportsCol(uid), report.reportId), report);
}

export async function deleteReport(uid: string, reportId: string): Promise<void> {
  const { collection, deleteDoc, doc, getDocs, writeBatch } = await import("firebase/firestore");
  const database = await db();
  const base = doc(database, reportsCol(uid), reportId);
  for (const sub of [SECTIONS, CITATIONS]) {
    const snap = await getDocs(collection(base, sub));
    let batch = writeBatch(database);
    let count = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      count += 1;
      if (count === 450) {
        await batch.commit();
        batch = writeBatch(database);
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
  }
  await deleteDoc(base);
}

/** Replaces every section and citation in one batch — used after
 * (re)generation, where the whole set is recomputed together. A batch
 * keeps the report internally consistent: a reader never sees half the
 * new sections next to half the old ones. */
export async function replaceGeneratedContent(
  uid: string,
  reportId: string,
  sections: ReportSection[],
  citations: Citation[],
): Promise<void> {
  const { collection, deleteDoc, doc, getDocs, writeBatch } = await import("firebase/firestore");
  const database = await db();
  const base = doc(database, reportsCol(uid), reportId);

  for (const sub of [SECTIONS, CITATIONS]) {
    const snap = await getDocs(collection(base, sub));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }

  const batch = writeBatch(database);
  for (const s of sections) batch.set(doc(base, SECTIONS, s.sectionId), s);
  for (const c of citations) batch.set(doc(base, CITATIONS, c.citationId), c);
  await batch.commit();
}

export async function listSections(uid: string, reportId: string): Promise<ReportSection[]> {
  const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
  const snap = await getDocs(query(collection(await db(), reportsCol(uid), reportId, SECTIONS), orderBy("order", "asc")));
  return snap.docs.map((d) => d.data() as ReportSection);
}

export async function saveSection(uid: string, reportId: string, section: ReportSection): Promise<void> {
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(await db(), reportsCol(uid), reportId, SECTIONS, section.sectionId), section);
}

export async function listCitations(uid: string, reportId: string): Promise<Citation[]> {
  const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
  const snap = await getDocs(query(collection(await db(), reportsCol(uid), reportId, CITATIONS), orderBy("number", "asc")));
  return snap.docs.map((d) => d.data() as Citation);
}
