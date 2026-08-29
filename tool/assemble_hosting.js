#!/usr/bin/env node
"use strict";

/**
 * Assembles the one directory Firebase Hosting serves.
 *
 * Hosting serves a single `public` directory, and this project has two
 * things to publish: the marketing site at the root and the Flutter web
 * app under /app/. Neither build can write into the other's output —
 * `next build` wipes site/out, and `flutter build web` wipes build/web —
 * so copying one into the other would survive exactly until the next
 * build of whichever one was the destination.
 *
 * This copies both into a third directory instead, which is disposable
 * and gitignored.
 *
 * Usage:
 *   flutter build web --release --base-href /app/
 *   (cd site && npm run build)
 *   node tool/assemble_hosting.js
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const parts = [
  {from: path.join(root, "site", "out"), to: dist, what: "marketing site"},
  {
    from: path.join(root, "build", "web"),
    to: path.join(dist, "app"),
    what: "Flutter web app",
  },
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
