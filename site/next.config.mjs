import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app lives in its own package with its own lockfile, nested under
  // the Flutter repo which has another. Point Turbopack at this directory
  // so it stops guessing and warning about which root to use.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },

  // Static export: the site is entirely pre-rendered, so it can be hosted
  // on any static host and there is no server to attack. Most of the
  // advisories filed against Next target server-side surfaces — Server
  // Actions, RSC responses, middleware, rewrites — none of which exist in
  // an exported build.
  output: "export",

  images: {
    // Required by `output: "export"`, which has no server to run the
    // optimizer on. It also removes the Image Optimizer as a component
    // entirely; this site ships no remote images, so nothing is lost.
    unoptimized: true,
  },

  // Trailing slashes keep static hosting predictable across providers.
  trailingSlash: true,

  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
