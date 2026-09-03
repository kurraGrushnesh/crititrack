import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes "add to home screen" produce a real app entry: a
 * standalone window, the CritiTrack mark, and a sage splash on launch
 * (Android composes the splash from `background_color` + the icon; iOS
 * uses the apple-icon). Kept minimal — this is a reference site, not an
 * offline app, so there is no service worker.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CritiTrack — accountability tracking for public figures",
    short_name: "CritiTrack",
    description:
      "Search a public figure and open a structured, evidence-linked record of what they were criticised for, how serious it was, and whether sentiment is moving.",
    start_url: "/",
    display: "standalone",
    background_color: "#1c7a53",
    theme_color: "#1c7a53",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      {
        src: "/apple-icon.svg",
        type: "image/svg+xml",
        sizes: "180x180",
        purpose: "maskable",
      },
    ],
  };
}

export const dynamic = "force-static";
