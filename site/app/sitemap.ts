import type { MetadataRoute } from "next";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { CATEGORY_SLUGS } from "@/lib/catalog";

const SITE = "https://crititrack-f7430.web.app";

/**
 * Emitted as a static /sitemap.xml by the export. Lists every route the
 * export produces, including the per-profile pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPaths = [
    "",
    "/explore",
    "/compare",
    "/methodology",
    "/controversy-index",
    "/about",
    "/report-correction",
    "/watchlist",
    "/privacy",
    ...CATEGORY_SLUGS.map((s) => `/category/${s}`),
  ];

  const profilePaths = DEMO_PROFILES.flatMap((p) => [
    `/profile/${p.slug}`,
    `/profile/${p.slug}/evidence`,
  ]);

  return [...staticPaths, ...profilePaths].map((path) => ({
    url: `${SITE}${path}/`,
    lastModified: now,
  }));
}

export const dynamic = "force-static";
