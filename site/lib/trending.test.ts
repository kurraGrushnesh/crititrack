import { describe, expect, it } from "vitest";
import { parseTrending, parseTrendingFigure } from "./trending";

describe("parseTrendingFigure", () => {
  it("maps a well-formed row", () => {
    expect(
      parseTrendingFigure({
        slug: "n-t-rama-rao",
        name: "N. T. Rama Rao",
        requestCount: 42,
        sentimentScore: 58.3,
        trendDirection: "up",
        imageUrl: "https://example.org/ntr.jpg",
      }),
    ).toEqual({
      slug: "n-t-rama-rao",
      name: "N. T. Rama Rao",
      requestCount: 42,
      sentimentScore: 58.3,
      trendDirection: "up",
      imageUrl: "https://example.org/ntr.jpg",
    });
  });

  it("drops a row with no slug", () => {
    expect(parseTrendingFigure({ name: "no slug" })).toBeNull();
    expect(parseTrendingFigure(null)).toBeNull();
    expect(parseTrendingFigure(42)).toBeNull();
  });

  it("fills a missing name from the slug and defaults the rest", () => {
    expect(parseTrendingFigure({ slug: "x" })).toEqual({
      slug: "x",
      name: "x",
      requestCount: 0,
      sentimentScore: null,
      trendDirection: "stable",
      imageUrl: null,
    });
  });

  it("keeps a zero score but rejects a non-numeric one", () => {
    expect(parseTrendingFigure({ slug: "x", sentimentScore: 0 })?.sentimentScore).toBe(0);
    expect(
      parseTrendingFigure({ slug: "x", sentimentScore: "n/a" })?.sentimentScore,
    ).toBeNull();
  });
});

describe("parseTrending", () => {
  it("ranks by request count regardless of input order and caps the list", () => {
    const out = parseTrending(
      {
        figures: [
          { slug: "a", requestCount: 3 },
          { slug: "b", requestCount: 30 },
          { slug: "c", requestCount: 12 },
        ],
      },
      2,
    );
    expect(out.map((f) => f.slug)).toEqual(["b", "c"]);
  });

  it("returns an empty list for junk or an empty backend response", () => {
    expect(parseTrending({ figures: [] })).toEqual([]);
    expect(parseTrending(null)).toEqual([]);
    expect(parseTrending({})).toEqual([]);
  });
});
