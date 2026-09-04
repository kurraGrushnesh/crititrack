import { describe, expect, it } from "vitest";
import {
  readCachedProfile,
  writeCachedProfile,
  cachedProfileSlugs,
  MAX_ENTRIES,
  type StorageLike,
} from "./profile-cache";
import type { RealProfile } from "./api";

function memStore(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

const profile = (slug: string): RealProfile =>
  ({ slug, name: slug }) as unknown as RealProfile;

describe("profile-cache", () => {
  it("stores and reads back a profile by slug", () => {
    const store = memStore();
    writeCachedProfile(profile("ada-lovelace"), store, 1000);
    const hit = readCachedProfile("ada-lovelace", store);
    expect(hit?.slug).toBe("ada-lovelace");
    expect(hit?.storedAt).toBe(1000);
  });

  it("moves a re-stored profile to the front and refreshes its stamp", () => {
    const store = memStore();
    writeCachedProfile(profile("a"), store, 1);
    writeCachedProfile(profile("b"), store, 2);
    writeCachedProfile(profile("a"), store, 3);
    expect(cachedProfileSlugs(store)).toEqual(["a", "b"]);
    expect(readCachedProfile("a", store)?.storedAt).toBe(3);
  });

  it("evicts the oldest beyond MAX_ENTRIES", () => {
    const store = memStore();
    for (let i = 0; i < MAX_ENTRIES + 3; i++) {
      writeCachedProfile(profile(`s${i}`), store, i);
    }
    const slugs = cachedProfileSlugs(store);
    expect(slugs).toHaveLength(MAX_ENTRIES);
    expect(slugs).not.toContain("s0");
    expect(slugs[0]).toBe(`s${MAX_ENTRIES + 2}`);
  });

  it("is a no-op with no storage and tolerates junk", () => {
    expect(readCachedProfile("x", null)).toBeNull();
    expect(writeCachedProfile(profile("x"), null)).toEqual([]);
    const store = memStore();
    store.setItem("crititrack.profileCache.v1", "not json");
    expect(readCachedProfile("x", store)).toBeNull();
  });

  it("ignores a profile with no slug", () => {
    const store = memStore();
    writeCachedProfile(profile(""), store, 1);
    expect(cachedProfileSlugs(store)).toEqual([]);
  });
});
