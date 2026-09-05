"use client";

/**
 * Firestore persistence for Research Workspaces — the storage side of
 * `lib/research.ts`, which stays pure and does all of the actual logic
 * (creation, deduplication, filtering, summaries). This file only reads
 * and writes documents; every decision about *what* to write was
 * already made by that module.
 *
 * Schema: `users/{uid}/researchWorkspaces/{workspaceId}`, with
 * `items/{itemId}` and `activity/{activityId}` subcollections — see
 * `firestore.rules`, which restricts every read and write to the
 * matching `request.auth.uid`.
 *
 * `uid` here is the anonymous Firebase Auth uid from `firebase.ts` —
 * this project has no real account system on the web, so a workspace
 * is private to one browser profile, not a portable identity. That is
 * disclosed in the UI, not hidden.
 *
 * Item de-duplication uses a *stable Firestore document id*
 * (`stableItemKey`) rather than a query-then-check: `setDoc(..., {merge:
 * true})` on that id is what makes "the same evidence saved twice"
 * collapse into one document, matching `addItem`'s in-memory behaviour
 * exactly — the store layer and the pure module agree on identity by
 * construction, not by convention.
 */

import { ensureSignedInUid, getFirebaseApp } from "./firebase";
import type {
  ActivityEntry,
  FindingStatus,
  ResearchItem,
  ResearchItemType,
  ResearchWorkspace,
  WorkspaceStatus,
} from "./research";

// Firestore's SDK is loaded lazily so it never enters the initial page
// bundle — same convention as the rest of this file's Firebase usage.
async function db() {
  const { getFirestore } = await import("firebase/firestore");
  return getFirestore(getFirebaseApp());
}

const WORKSPACES = "researchWorkspaces";
const ITEMS = "items";
const ACTIVITY = "activity";

function workspacesCol(uid: string) {
  return `users/${uid}/${WORKSPACES}`;
}

export async function currentUid(): Promise<string> {
  return ensureSignedInUid();
}

// ── Workspaces ──────────────────────────────────────────────────────

export async function newWorkspaceId(): Promise<string> {
  const { collection, doc } = await import("firebase/firestore");
  return doc(collection(await db(), "_ids")).id;
}

export async function listWorkspaces(uid: string): Promise<ResearchWorkspace[]> {
  const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
  const snap = await getDocs(query(collection(await db(), workspacesCol(uid)), orderBy("updatedAt", "desc")));
  return snap.docs.map((d) => d.data() as ResearchWorkspace);
}

export async function getWorkspace(uid: string, workspaceId: string): Promise<ResearchWorkspace | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(await db(), workspacesCol(uid), workspaceId));
  return snap.exists() ? (snap.data() as ResearchWorkspace) : null;
}

export async function saveWorkspace(uid: string, workspace: ResearchWorkspace): Promise<void> {
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(await db(), workspacesCol(uid), workspace.workspaceId), workspace);
}

export async function deleteWorkspace(uid: string, workspaceId: string): Promise<void> {
  const { collection, deleteDoc, doc, getDocs, writeBatch } = await import("firebase/firestore");
  const database = await db();
  const base = doc(database, workspacesCol(uid), workspaceId);

  // Firestore does not cascade-delete subcollections — remove items and
  // activity first, in batches, so a large workspace does not exceed
  // the 500-write batch limit.
  for (const sub of [ITEMS, ACTIVITY]) {
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

// ── Items ───────────────────────────────────────────────────────────

/** A page of items, ordered newest-first. Filtering by type/entity and
 * searching happen client-side over the fetched page (see
 * `research.ts`) rather than as composite Firestore queries, so no
 * extra index is required — acceptable at the scale a personal research
 * workspace actually reaches. */
export async function listItemsPage(
  uid: string,
  workspaceId: string,
  opts: { pageSize?: number; cursor?: unknown } = {},
): Promise<{ items: ResearchItem[]; nextCursor: unknown | null }> {
  const { collection, getDocs, limit, orderBy, query, startAfter } = await import("firebase/firestore");
  const pageSize = opts.pageSize ?? 50;
  const col = collection(await db(), workspacesCol(uid), workspaceId, ITEMS);
  const constraints = [orderBy("addedAt", "desc"), limit(pageSize)];
  const q = opts.cursor ? query(col, ...constraints, startAfter(opts.cursor)) : query(col, ...constraints);
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => d.data() as ResearchItem),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
  };
}

function itemDocId(item: Pick<ResearchItem, "itemId" | "type" | "referenceId">): string {
  // Mirrors research.ts's stableItemKey: a referenced item's Firestore
  // document id IS its dedup key, so a second save of the same
  // (type, referenceId) is a merge, never a second document.
  if (item.referenceId != null) return `${item.type}:${item.referenceId}`;
  return item.itemId;
}

/** Writes an item with `{merge: true}` on its stable id. The caller
 * (via `research.ts`'s `addItem`) has already decided what the merged
 * fields should be — this just persists it. */
export async function upsertItem(uid: string, item: ResearchItem): Promise<void> {
  const { doc, setDoc } = await import("firebase/firestore");
  const id = itemDocId(item);
  await setDoc(doc(await db(), workspacesCol(uid), item.workspaceId, ITEMS, id), { ...item, itemId: id }, { merge: true });
}

export async function removeItemDoc(uid: string, workspaceId: string, itemId: string): Promise<void> {
  const { deleteDoc, doc } = await import("firebase/firestore");
  await deleteDoc(doc(await db(), workspacesCol(uid), workspaceId, ITEMS, itemId));
}

/** Looks up a single item by its stable (type, referenceId) key, for
 * the fast "save to research" action — one read, no full-page fetch. */
export async function findItemByReference(
  uid: string,
  workspaceId: string,
  type: ResearchItemType,
  referenceId: string,
): Promise<ResearchItem | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(await db(), workspacesCol(uid), workspaceId, ITEMS, `${type}:${referenceId}`));
  return snap.exists() ? (snap.data() as ResearchItem) : null;
}

// ── Activity ─────────────────────────────────────────────────────────

export async function appendActivity(uid: string, entry: ActivityEntry): Promise<void> {
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(await db(), workspacesCol(uid), entry.workspaceId, ACTIVITY, entry.activityId), entry);
}

export async function listActivityPage(
  uid: string,
  workspaceId: string,
  opts: { pageSize?: number } = {},
): Promise<ActivityEntry[]> {
  const { collection, getDocs, limit, orderBy, query } = await import("firebase/firestore");
  const snap = await getDocs(
    query(
      collection(await db(), workspacesCol(uid), workspaceId, ACTIVITY),
      orderBy("at", "desc"),
      limit(opts.pageSize ?? 30),
    ),
  );
  return snap.docs.map((d) => d.data() as ActivityEntry);
}

// Re-exported only so callers of this module don't need a second import
// from research.ts just for the type names they pass through.
export type { FindingStatus, ResearchItem, ResearchItemType, ResearchWorkspace, WorkspaceStatus };
