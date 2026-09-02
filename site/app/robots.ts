import type { MetadataRoute } from "next";

const SITE = "https://crititrack-f7430.web.app";

/**
 * Emitted as a static /robots.txt by the export. The Flutter app under
 * /app/ is a single-page shell with no crawlable content, so it is
 * disallowed; everything else is open.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/app/",
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}

export const dynamic = "force-static";
