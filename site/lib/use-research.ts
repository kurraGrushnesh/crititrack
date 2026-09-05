"use client";

/**
 * React wiring for Research Workspaces — bridges the pure logic in
 * `research.ts` to the Firestore layer in `research-store.ts` and
 * exposes loading/error/empty states the way `use-celebrity.ts` does
 * for profiles. No component should import `research-store.ts`
 * directly; everything goes through these two hooks.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addEntityToWorkspace,
  addItem as addItemPure,
  addTag as addTagPure,
  archiveWorkspace as archiveWorkspacePure,
  buildItem,
  createWorkspace as createWorkspacePure,
  filterByEntity,
  filterByType,
  markOpened,
  reactivateWorkspace as reactivateWorkspacePure,
  recordActivity,
  removeItem as removeItemPure,
  removeTag as removeTagPure,
  renameWorkspace as renameWorkspacePure,
  searchItems,
  setItemNote as setItemNotePure,
  setItemStatus as setItemStatusPure,
  sortItems,
  updateDescription as updateDescriptionPure,
  type AddItemInput,
  type FindingStatus,
  type ItemSort,
  type ResearchItem,
  type ResearchItemType,
  type ResearchWorkspace,
} from "./research";
import {
  appendActivity,
  currentUid,
  deleteWorkspace as deleteWorkspaceStore,
  findItemByReference,
  listItemsPage,
  listWorkspaces as listWorkspacesStore,
  newWorkspaceId,
  removeItemDoc,
  saveWorkspace,
  upsertItem,
} from "./research-store";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: T };

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The fast "save to research" path, usable from anywhere without first
 * loading a full `useWorkspace` view — e.g. a button on an evidence
 * card. Mirrors `useWorkspace`'s own `addItem` logic exactly (same
 * dedup-by-reference rule, same activity entry), just without needing a
 * mounted workspace screen to call it from.
 */
export async function saveItemToWorkspace(
  workspaceId: string,
  input: Omit<AddItemInput, "itemId" | "workspaceId" | "now">,
): Promise<{ added: boolean }> {
  const uid = await currentUid();
  const now = nowIso();
  const existing = input.referenceId ? await findItemByReference(uid, workspaceId, input.type, input.referenceId) : null;
  const item = buildItem({
    ...input,
    itemId: existing?.itemId ?? `${input.type}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    now,
  });
  await upsertItem(uid, item);
  await appendActivity(
    uid,
    recordActivity({
      activityId: `item-${item.itemId}-${now}`,
      workspaceId,
      kind: "item_added",
      summary: existing ? `Refreshed "${item.title}"` : `Added ${item.type.toLowerCase().replace("_", " ")}: "${item.title}"`,
      now,
    }),
  );
  return { added: existing == null };
}

// ── Workspace list ──────────────────────────────────────────────────

export function useWorkspaces() {
  const [state, setState] = useState<AsyncState<ResearchWorkspace[]>>({ status: "loading" });

  // No setState here — this only fetches. `reload` (called from event
  // handlers) and the mount effect below each wire their own .then()/
  // .catch() around it, so neither one is "a function that sets state"
  // being invoked directly from an effect body (see react.dev's "you
  // might not need an effect" — setState belongs in the callback, not
  // in a shared function called synchronously from the effect).
  const fetchWorkspacesData = useCallback(() => currentUid().then(listWorkspacesStore), []);

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const workspaces = await fetchWorkspacesData();
      setState({ status: "ready", value: workspaces });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Could not load workspaces." });
    }
  }, [fetchWorkspacesData]);

  useEffect(() => {
    let cancelled = false;
    fetchWorkspacesData()
      .then((workspaces) => {
        if (!cancelled) setState({ status: "ready", value: workspaces });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Could not load workspaces." });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchWorkspacesData]);

  const create = useCallback(
    async (input: { entityIds?: string[]; entityNames?: string[]; title?: string; description?: string }) => {
      const uid = await currentUid();
      const workspaceId = await newWorkspaceId();
      const now = nowIso();
      const workspace = createWorkspacePure({ ...input, workspaceId, userId: uid, now });
      await saveWorkspace(uid, workspace);
      await appendActivity(
        uid,
        recordActivity({
          activityId: `created-${now}`,
          workspaceId,
          kind: "workspace_created",
          summary: `Created "${workspace.title}"`,
          now,
        }),
      );
      await reload();
      return workspace;
    },
    [reload],
  );

  const archive = useCallback(
    async (workspace: ResearchWorkspace) => {
      const uid = await currentUid();
      await saveWorkspace(uid, archiveWorkspacePure(workspace, nowIso()));
      await reload();
    },
    [reload],
  );

  const reactivate = useCallback(
    async (workspace: ResearchWorkspace) => {
      const uid = await currentUid();
      await saveWorkspace(uid, reactivateWorkspacePure(workspace, nowIso()));
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (workspaceId: string) => {
      const uid = await currentUid();
      await deleteWorkspaceStore(uid, workspaceId);
      await reload();
    },
    [reload],
  );

  return { state, reload, create, archive, reactivate, remove };
}

// ── One workspace ────────────────────────────────────────────────────

export interface WorkspaceView {
  workspace: ResearchWorkspace;
  items: ResearchItem[];
  hasMore: boolean;
}

export function useWorkspace(workspaceId: string | null) {
  const [state, setState] = useState<AsyncState<WorkspaceView>>({ status: "loading" });
  // Lets the two mutators below read the latest state without needing
  // `state` itself in their own useCallback deps (which would otherwise
  // recreate them, and everything built on them, on every state change).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [cursor, setCursor] = useState<unknown>(null);
  const [typeFilter, setTypeFilter] = useState<ResearchItemType | "ALL">("ALL");
  const [entityFilter, setEntityFilter] = useState<string | "ALL">("ALL");
  const [sort, setSort] = useState<ItemSort>("newest");
  const [query, setQuery] = useState("");

  // No setState here — same reasoning as useWorkspaces' fetchWorkspacesData
  // above: `reload` and the mount effect each wire their own .then()/
  // .catch() around this, so neither is "a function that sets state"
  // called directly from an effect body. Returns null for "not found"
  // rather than throwing, since that is not an error condition.
  const fetchWorkspaceData = useCallback(async (): Promise<{ workspace: ResearchWorkspace; items: ResearchItem[]; nextCursor: unknown } | null> => {
    if (!workspaceId) return null;
    const uid = await currentUid();
    const { getWorkspace } = await import("./research-store");
    const workspace = await getWorkspace(uid, workspaceId);
    if (!workspace) return null;
    const opened = markOpened(workspace, nowIso());
    if (opened !== workspace) await saveWorkspace(uid, opened);
    const { items, nextCursor } = await listItemsPage(uid, workspaceId);
    return { workspace: opened, items, nextCursor };
  }, [workspaceId]);

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    setState({ status: "loading" });
    try {
      const result = await fetchWorkspaceData();
      if (!result) {
        setState({ status: "error", message: "This workspace was not found." });
        return;
      }
      setCursor(result.nextCursor);
      setState({ status: "ready", value: { workspace: result.workspace, items: result.items, hasMore: result.nextCursor != null } });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Could not load this workspace." });
    }
  }, [workspaceId, fetchWorkspaceData]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    fetchWorkspaceData()
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setState({ status: "error", message: "This workspace was not found." });
          return;
        }
        setCursor(result.nextCursor);
        setState({ status: "ready", value: { workspace: result.workspace, items: result.items, hasMore: result.nextCursor != null } });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Could not load this workspace." });
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, fetchWorkspaceData]);

  const loadMore = useCallback(async () => {
    if (!workspaceId || state.status !== "ready" || cursor == null) return;
    const uid = await currentUid();
    const { items, nextCursor } = await listItemsPage(uid, workspaceId, { cursor });
    setCursor(nextCursor);
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", value: { ...prev.value, items: [...prev.value.items, ...items], hasMore: nextCursor != null } }
        : prev,
    );
  }, [workspaceId, state.status, cursor]);

  const mutateWorkspace = useCallback((fn: (w: ResearchWorkspace) => ResearchWorkspace) => {
    const current = stateRef.current;
    if (current.status !== "ready") return null;
    const next = fn(current.value.workspace);
    setState({ status: "ready", value: { ...current.value, workspace: next } });
    return next;
  }, []);

  const rename = useCallback(
    async (title: string) => {
      const next = mutateWorkspace((w) => renameWorkspacePure(w, title, nowIso()));
      if (next) await saveWorkspace(await currentUid(), next);
    },
    [mutateWorkspace],
  );

  const updateDescription = useCallback(
    async (description: string) => {
      const next = mutateWorkspace((w) => updateDescriptionPure(w, description, nowIso()));
      if (next) await saveWorkspace(await currentUid(), next);
    },
    [mutateWorkspace],
  );

  const addEntity = useCallback(
    async (entityId: string) => {
      const next = mutateWorkspace((w) => addEntityToWorkspace(w, entityId, nowIso()));
      if (next) await saveWorkspace(await currentUid(), next);
    },
    [mutateWorkspace],
  );

  /** The fast "save to research" path: builds the item, merges it in
   * memory via the same dedup rule the store uses, persists it, and
   * logs one activity entry only when something was actually added or
   * changed. */
  const addItem = useCallback(
    async (input: Omit<AddItemInput, "itemId" | "workspaceId" | "now">) => {
      if (!workspaceId) return;
      const uid = await currentUid();
      const now = nowIso();
      const existing = input.referenceId ? await findItemByReference(uid, workspaceId, input.type, input.referenceId) : null;
      const item = buildItem({
        ...input,
        itemId: existing?.itemId ?? `${input.type}-${now}-${Math.random().toString(36).slice(2, 8)}`,
        workspaceId,
        now,
      });
      await upsertItem(uid, item);
      await appendActivity(
        uid,
        recordActivity({
          activityId: `item-${item.itemId}-${now}`,
          workspaceId,
          kind: "item_added",
          summary: existing ? `Refreshed "${item.title}"` : `Added ${item.type.toLowerCase().replace("_", " ")}: "${item.title}"`,
          now,
        }),
      );
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        const { items } = addItemPure(prev.value.items, item);
        return { status: "ready", value: { ...prev.value, items } };
      });
    },
    [workspaceId],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!workspaceId) return;
      const uid = await currentUid();
      await removeItemDoc(uid, workspaceId, itemId);
      setState((prev) => (prev.status === "ready" ? { status: "ready", value: { ...prev.value, items: removeItemPure(prev.value.items, itemId) } } : prev));
    },
    [workspaceId],
  );

  const mutateItemAndPersist = useCallback(
    async (itemId: string, fn: (items: ResearchItem[]) => ResearchItem[]) => {
      const current = stateRef.current;
      if (!workspaceId || current.status !== "ready") return;
      const next = fn(current.value.items);
      setState({ status: "ready", value: { ...current.value, items: next } });
      const changed = next.find((i) => i.itemId === itemId);
      if (changed) await upsertItem(await currentUid(), changed);
    },
    [workspaceId],
  );

  const setStatus = useCallback(
    (itemId: string, status: FindingStatus) => mutateItemAndPersist(itemId, (items) => setItemStatusPure(items, itemId, status, nowIso())),
    [mutateItemAndPersist],
  );
  const setNote = useCallback(
    (itemId: string, note: string) => mutateItemAndPersist(itemId, (items) => setItemNotePure(items, itemId, note, nowIso())),
    [mutateItemAndPersist],
  );
  const addTag = useCallback(
    (itemId: string, tag: string) => mutateItemAndPersist(itemId, (items) => addTagPure(items, itemId, tag, nowIso())),
    [mutateItemAndPersist],
  );
  const removeTag = useCallback(
    (itemId: string, tag: string) => mutateItemAndPersist(itemId, (items) => removeTagPure(items, itemId, tag, nowIso())),
    [mutateItemAndPersist],
  );

  const visibleItems =
    state.status === "ready"
      ? sortItems(searchItems(filterByEntity(filterByType(state.value.items, typeFilter), entityFilter), query), sort)
      : [];

  return {
    state,
    reload,
    loadMore,
    rename,
    updateDescription,
    addEntity,
    addItem,
    removeItem,
    setStatus,
    setNote,
    addTag,
    removeTag,
    typeFilter,
    setTypeFilter,
    entityFilter,
    setEntityFilter,
    sort,
    setSort,
    query,
    setQuery,
    visibleItems,
  };
}
