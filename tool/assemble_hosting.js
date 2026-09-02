#!/usr/bin/env node
"use strict";

/**
 * Assembles the one directory Firebase Hosting serves.
 *
 * The web app *is* the product now: `site/` (Next.js static export) is
 * the whole deploy. The Flutter build is no longer published — `/app/**`
 * redirects to `/figure/` in `firebase.json` — so this just stages the
 * one export into a disposable, gitignored directory that `next build`
 * won't wipe out from under Hosting.
 *
 * Usage:
 *   (cd site && npm run build)
 *   node tool/assemble_hosting.js
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const parts = [
  {from: path.join(root, "site", "out"), to: dist, what: "web app"},
];

for (const {from} of parts) {
  if (!fs.existsSync(from)) {
    console.error(`missing: ${path.relative(root, from)}`);
    console.error("build both before assembling — see the header of this file");
    process.exit(1);
  }
}

// Cleared rather than merged, so a file deleted from a source stops
// being served instead of lingering from an earlier assembly.
fs.rmSync(dist, {recursive: true, force: true});

for (const {from, to, what} of parts) {
  fs.cpSync(from, to, {recursive: true});
  console.log(`${what}  ->  ${path.relative(root, to) || "dist"}`);
}

const count = (dir) =>
  fs
      .readdirSync(dir, {recursive: true, withFileTypes: true})
      .filter((e) => e.isFile()).length;

console.log(`${count(dist)} files in dist/`);
