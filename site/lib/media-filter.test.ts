import { describe, expect, it } from "vitest";
import {
  filterMediaByTopic,
  topicsPresent,
  type MediaLink,
} from "./api";

const item = (over: Partial<MediaLink>): MediaLink => ({
  id: "1",
  title: "t",
  url: "https://x",
  source: "s",
  type: "news",
  sentimentScore: null,
  ...over,
});

const media: MediaLink[] = [
  item({ id: "1", topic: "legal" }),
  item({ id: "2", topic: "financial" }),
  item({ id: "3", topic: "legal" }),
  item({ id: "4" }), // no topic -> treated as "other"
];

describe("filterMediaByTopic", () => {
  it("passes everything through for 'all'", () => {
    expect(filterMediaByTopic(media, "all")).toHaveLength(4);
  });

  it("keeps only the selected topic, untagged items counting as 'other'", () => {
    expect(filterMediaByTopic(media, "legal").map((m) => m.id)).toEqual(["1", "3"]);
    expect(filterMediaByTopic(media, "other").map((m) => m.id)).toEqual(["4"]);
  });
});

describe("topicsPresent", () => {
  it("lists present topics in canonical order", () => {
    expect(topicsPresent(media)).toEqual(["legal", "financial", "other"]);
  });
});
