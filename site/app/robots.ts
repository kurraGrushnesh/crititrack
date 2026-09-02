import type { MetadataRoute } from "next";

const SITE = "https://crititrack-f7430.web.app";

/**
 * Emitted as a static /robots.txt by the export. `/figure/` renders its
 * content client-side from the live API and carries nothing crawlable on
 * its own, so it is disallowed; everything else is open.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/figure/",
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}

export const dynamic = "force-static";
