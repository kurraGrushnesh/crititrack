"use client";

/**
 * Firestore persistence for saved comparisons — schema:
 * `users/{uid}/comparisons/{comparisonId}`. A comparison document is
 * small (entity ids, a title, filters, a time range), so unlike
 * workspaces/reports it needs no subcollection — one document is the
 * whole record. Ruled to `request.auth.uid == userId` in
 * `firestore.rules`, same as every other per-user collection.
 */

import { ensureSignedInUid, getFirebaseApp } from "./firebase";
import type { Comparison } from "./compare";

async function db() {
  const { getFirestore } = await import("firebase/firestore");
  return getFirestore(getFirebaseApp());
}

const COMPARISONS = "comparisons";

function comparisonsCol(uid: string) {
  return `users/${uid}/${COMPARISONS}`;
}

export async function currentUid(): Promise<string> {
  return ensureSignedInUid();
}

export async function newComparisonId(): Promise<string> {
  const { collection, doc } = await import("firebase/firestore");
  return doc(collection(await db(), "_ids")).id;
}

export async function listComparisons(uid: string): Promise<Comparison[]> {
  const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
  const snap = await getDocs(query(collection(await db(), comparisonsCol(uid)), orderBy("updatedAt", "desc")));
  return snap.docs.map((d) => d.data() as Comparison);
}

export async function getComparison(uid: string, comparisonId: string): Promise<Comparison | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(await db(), comparisonsCol(uid), comparisonId));
  return snap.exists() ? (snap.data() as Comparison) : null;
}

export async function saveComparison(uid: string, comparison: Comparison): Promise<void> {
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(await db(), comparisonsCol(uid), comparison.comparisonId), comparison);
}

export async function deleteComparison(uid: string, comparisonId: string): Promise<void> {
  const { deleteDoc, doc } = await import("firebase/firestore");
  await deleteDoc(doc(await db(), comparisonsCol(uid), comparisonId));
}
