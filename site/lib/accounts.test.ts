import { describe, expect, it } from "vitest";
import { mapAccounts } from "./api";

describe("mapAccounts", () => {
  it("maps known platforms in display order with labels", () => {
    const out = mapAccounts({
      instagram: "https://www.instagram.com/star/",
      website: "https://star.example",
      x: "https://x.com/star",
    });
    expect(out.map((a) => a.platform)).toEqual(["website", "x", "instagram"]);
    expect(out.map((a) => a.label)).toEqual(["Official site", "X", "Instagram"]);
  });

  it("drops non-https and unknown keys", () => {
    const out = mapAccounts({
      x: "http://x.com/star",
      website: "javascript:alert(1)",
      myspace: "https://myspace.com/star",
      imdb: "https://www.imdb.com/name/nm1/",
    });
    expect(out).toEqual([
      { platform: "imdb", label: "IMDb", url: "https://www.imdb.com/name/nm1/" },
    ]);
  });

  it("returns [] for junk or an empty links object", () => {
    expect(mapAccounts(null)).toEqual([]);
    expect(mapAccounts({})).toEqual([]);
    expect(mapAccounts("nope")).toEqual([]);
  });
});
