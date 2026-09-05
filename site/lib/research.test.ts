import { describe, expect, test } from "vitest";
import {
  createWorkspace,
  renameWorkspace,
  updateDescription,
  archiveWorkspace,
  reactivateWorkspace,
  addEntityToWorkspace,
  removeEntityFromWorkspace,
  buildItem,
  addItem,
  removeItem,
  setItemStatus,
  setItemNote,
  addTag,
  removeTag,
  createNoteItem,
  searchItems,
  filterByType,
  filterByEntity,
  sortItems,
  overviewCounts,
  evidenceQualitySummary,
  recordActivity,
  groupActivityByDay,
  stableItemKey,
  type ResearchItem,
} from "./research";

const NOW = "2026-09-05T00:00:00.000Z";
const LATER = "2026-09-06T00:00:00.000Z";

describe("createWorkspace", () => {
  test("defaults the title from a single entity name", () => {
    const w = createWorkspace({ workspaceId: "w1", userId: "u1", entityNames: ["Jane Doe"], now: NOW });
    expect(w.title).toBe("Research — Jane Doe");
    expect(w.status).toBe("ACTIVE");
  });

  test("defaults to a compare title for exactly two entities", () => {
    const w = createWorkspace({ workspaceId: "w1", userId: "u1", entityNames: ["A", "B"], now: NOW });
    expect(w.title).toBe("Compare A and B");
  });

  test("an explicit title wins over the default", () => {
    const w = createWorkspace({ workspaceId: "w1", userId: "u1", entityNames: ["A"], title: "My research", now: NOW });
    expect(w.title).toBe("My research");
  });
});

describe("workspace mutators", () => {
  const base = createWorkspace({ workspaceId: "w1", userId: "u1", entityNames: ["Jane Doe"], now: NOW });

  test("rename ignores a blank title", () => {
    expect(renameWorkspace(base, "   ", LATER).title).toBe(base.title);
    expect(renameWorkspace(base, "New title", LATER).title).toBe("New title");
  });

  test("archive then reactivate round-trips status", () => {
    const archived = archiveWorkspace(base, LATER);
    expect(archived.status).toBe("ARCHIVED");
    expect(reactivateWorkspace(archived, LATER).status).toBe("ACTIVE");
  });

  test("description is trimmed and bumps updatedAt", () => {
    const updated = updateDescription(base, "  notes  ", LATER);
    expect(updated.description).toBe("notes");
    expect(updated.updatedAt).toBe(LATER);
  });

  test("adding the same entity twice is a no-op the second time", () => {
    const once = addEntityToWorkspace(base, "q2", LATER);
    const twice = addEntityToWorkspace(once, "q2", LATER);
    expect(twice.entityIds).toEqual(once.entityIds);
  });

  test("removing an entity not present is a no-op", () => {
    expect(removeEntityFromWorkspace(base, "q999", LATER)).toBe(base);
  });
});

describe("stableItemKey / addItem deduplication", () => {
  test("a NOTE (no referenceId) never collides", () => {
    expect(stableItemKey("NOTE", null)).toBeNull();
  });

  test("adding the same (type, referenceId) twice updates in place rather than duplicating", () => {
    const first = buildItem({
      itemId: "i1",
      workspaceId: "w1",
      type: "EVIDENCE",
      referenceId: "E123",
      title: "Old title",
      metadata: { confidence: "medium" },
      now: NOW,
    });
    const { items: afterFirst } = addItem([], first);
    expect(afterFirst).toHaveLength(1);

    const second = buildItem({
      itemId: "i2",
      workspaceId: "w1",
      type: "EVIDENCE",
      referenceId: "E123",
      title: "Refreshed title",
      metadata: { confidence: "high" },
      now: LATER,
    });
    const { items: afterSecond, added } = addItem(afterFirst, second);
    expect(added).toBe(false);
    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0].itemId).toBe("i1"); // identity of the retained row is the original
    expect(afterSecond[0].title).toBe("Refreshed title");
    expect(afterSecond[0].metadata.confidence).toBe("high");
  });

  test("a user's note and tags survive a metadata refresh", () => {
    const first = buildItem({
      itemId: "i1",
      workspaceId: "w1",
      type: "CLAIM",
      referenceId: "C1",
      title: "Claim A",
      note: "keep me",
      tags: ["important"],
      now: NOW,
    });
    const { items } = addItem([], first);
    const refreshed = buildItem({
      itemId: "i2",
      workspaceId: "w1",
      type: "CLAIM",
      referenceId: "C1",
      title: "Claim A (updated evidence count)",
      now: LATER,
    });
    const { items: after } = addItem(items, refreshed);
    expect(after[0].note).toBe("keep me");
    expect(after[0].tags).toEqual(["important"]);
  });

  test("different references never collapse into one item", () => {
    const a = buildItem({ itemId: "a", workspaceId: "w1", type: "EVIDENCE", referenceId: "E1", title: "A", now: NOW });
    const b = buildItem({ itemId: "b", workspaceId: "w1", type: "EVIDENCE", referenceId: "E2", title: "B", now: NOW });
    const { items: step1 } = addItem([], a);
    const { items: step2 } = addItem(step1, b);
    expect(step2).toHaveLength(2);
  });

  test("two freestanding notes never dedupe against each other", () => {
    const n1 = createNoteItem({ itemId: "n1", workspaceId: "w1", text: "first", now: NOW });
    const n2 = createNoteItem({ itemId: "n2", workspaceId: "w1", text: "second", now: NOW });
    const { items: step1 } = addItem([], n1);
    const { items: step2, added } = addItem(step1, n2);
    expect(added).toBe(true);
    expect(step2).toHaveLength(2);
  });
});

describe("item mutators", () => {
  const item = buildItem({ itemId: "i1", workspaceId: "w1", type: "CLAIM", referenceId: "C1", title: "Claim A", now: NOW });

  test("removeItem drops only the named item", () => {
    const list = [item];
    expect(removeItem(list, "i1")).toEqual([]);
    expect(removeItem(list, "missing")).toEqual(list);
  });

  test("setItemStatus never touches other items", () => {
    const other = buildItem({ itemId: "i2", workspaceId: "w1", type: "NOTE", title: "Research note", now: NOW });
    const list = setItemStatus([item, other], "i1", "NEEDS_REVIEW", LATER);
    expect(list[0].status).toBe("NEEDS_REVIEW");
    expect(list[1].status).toBe("UNDECIDED");
  });

  test("setItemNote updates the note text and updatedAt", () => {
    const list = setItemNote([item], "i1", "Need to verify the date.", LATER);
    expect(list[0].note).toBe("Need to verify the date.");
    expect(list[0].updatedAt).toBe(LATER);
  });

  test("addTag / removeTag normalize case and de-duplicate", () => {
    let list = addTag([item], "i1", "Important", LATER);
    list = addTag(list, "i1", "important", LATER); // same tag, different case
    expect(list[0].tags).toEqual(["Important"]);
    list = removeTag(list, "i1", "IMPORTANT", LATER);
    expect(list[0].tags).toEqual([]);
  });
});

describe("search / filter / sort", () => {
  const items: ResearchItem[] = [
    buildItem({ itemId: "1", workspaceId: "w1", type: "EVIDENCE", entityId: "qA", referenceId: "E1", title: "Financial report", now: "2026-01-01T00:00:00Z" }),
    buildItem({ itemId: "2", workspaceId: "w1", type: "CLAIM", entityId: "qB", referenceId: "C1", title: "Denial statement", note: "check this", now: "2026-02-01T00:00:00Z" }),
    buildItem({ itemId: "3", workspaceId: "w1", type: "NOTE", title: "Research note", note: "unrelated", tags: ["follow-up"], now: "2026-03-01T00:00:00Z" }),
  ];

  test("search matches title, note, and tags case-insensitively", () => {
    expect(searchItems(items, "financial")).toHaveLength(1);
    expect(searchItems(items, "check this")).toHaveLength(1);
    expect(searchItems(items, "follow-up")).toHaveLength(1);
    expect(searchItems(items, "")).toHaveLength(3);
  });

  test("filterByType / filterByEntity narrow the list; ALL returns everything", () => {
    expect(filterByType(items, "CLAIM")).toHaveLength(1);
    expect(filterByType(items, "ALL")).toHaveLength(3);
    expect(filterByEntity(items, "qA")).toHaveLength(1);
    expect(filterByEntity(items, "ALL")).toHaveLength(3);
  });

  test("sortItems orders newest-first or oldest-first deterministically", () => {
    const newest = sortItems(items, "newest");
    expect(newest.map((i) => i.itemId)).toEqual(["3", "2", "1"]);
    const oldest = sortItems(items, "oldest");
    expect(oldest.map((i) => i.itemId)).toEqual(["1", "2", "3"]);
  });
});

describe("overviewCounts", () => {
  test("counts each type, folding every event kind into one events bucket", () => {
    const items: ResearchItem[] = [
      buildItem({ itemId: "1", workspaceId: "w", type: "ENTITY", title: "A", now: NOW }),
      buildItem({ itemId: "2", workspaceId: "w", type: "EVIDENCE", title: "A", now: NOW }),
      buildItem({ itemId: "3", workspaceId: "w", type: "CLAIM", title: "A", now: NOW }),
      buildItem({ itemId: "4", workspaceId: "w", type: "CONTROVERSY", title: "A", now: NOW }),
      buildItem({ itemId: "5", workspaceId: "w", type: "CHANGE_EVENT", title: "A", now: NOW }),
      buildItem({ itemId: "6", workspaceId: "w", type: "SOURCE", title: "A", now: NOW }),
      buildItem({ itemId: "7", workspaceId: "w", type: "NOTE", title: "A", now: NOW }),
    ];
    expect(overviewCounts(items)).toEqual({
      entities: 1,
      evidence: 1,
      claims: 1,
      events: 2,
      sources: 1,
      notes: 1,
    });
  });
});

describe("evidenceQualitySummary", () => {
  test("reads confidence/corroboration that was already saved — never computes new values", () => {
    const items: ResearchItem[] = [
      buildItem({ itemId: "1", workspaceId: "w", type: "EVIDENCE", title: "A", metadata: { confidence: "high" }, now: NOW }),
      buildItem({ itemId: "2", workspaceId: "w", type: "EVIDENCE", title: "B", metadata: { confidence: "medium" }, now: NOW }),
      buildItem({ itemId: "3", workspaceId: "w", type: "EVIDENCE", title: "C", metadata: { confidence: "low" }, now: NOW }),
      buildItem({ itemId: "4", workspaceId: "w", type: "CLAIM", title: "D", metadata: { corroborated: true }, now: NOW }),
    ];
    const withReview = setItemStatus(items, "2", "NEEDS_REVIEW", NOW);
    const summary = evidenceQualitySummary(withReview);
    expect(summary.evidenceCollected).toBe(3);
    expect(summary.highConfidence).toBe(1);
    expect(summary.mediumConfidence).toBe(1);
    expect(summary.lowConfidence).toBe(1);
    expect(summary.corroboratedClaims).toBe(1);
    expect(summary.claimsNeedingReview).toBe(1);
  });

  test("an empty workspace reports zeros, not a crash", () => {
    expect(evidenceQualitySummary([])).toEqual({
      evidenceCollected: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      corroboratedClaims: 0,
      claimsNeedingReview: 0,
    });
  });
});

describe("activity log", () => {
  test("groupActivityByDay labels today and yesterday, and buckets older days by date", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    const entries = [
      recordActivity({ activityId: "a1", workspaceId: "w", kind: "item_added", summary: "Added evidence", now: "2026-09-05T09:00:00.000Z" }),
      recordActivity({ activityId: "a2", workspaceId: "w", kind: "status_changed", summary: "Marked needs review", now: "2026-09-04T09:00:00.000Z" }),
      recordActivity({ activityId: "a3", workspaceId: "w", kind: "workspace_created", summary: "Created workspace", now: "2026-09-01T09:00:00.000Z" }),
    ];
    const groups = groupActivityByDay(entries, now);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "2026-09-01"]);
  });
});
