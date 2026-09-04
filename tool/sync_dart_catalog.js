"use strict";

/**
 * Regenerates the Flutter twin of `site/lib/catalog.ts` — `kCategories`
 * and `kRoster` in `lib/core/data/catalog.dart` — by parsing the real TS
 * source rather than hand-retyping ~480 roster entries. `site/lib/catalog.ts`
 * stays the single source of truth for the data; this script keeps the
 * Dart file byte-for-byte consistent with it instead of drifting.
 *
 * Usage: node tool/sync_dart_catalog.js
 */

const fs = require("fs");
const path = require("path");

const TS_PATH = path.join(__dirname, "..", "site", "lib", "catalog.ts");
const DART_PATH = path.join(__dirname, "..", "lib", "core", "data", "catalog.dart");

function readSection(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error(`end marker not found after ${startMarker}`);
  return src.slice(start + startMarker.length, end);
}

/** Parses `{ slug: "...", label: "...", blurb: "..." }` category objects. */
function parseCategories(body) {
  const out = [];
  const re = /\{\s*slug:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*blurb:\s*"([^"]+)",?\s*\}/g;
  let m;
  while ((m = re.exec(body))) {
    out.push({ slug: m[1], label: m[2], blurb: m[3] });
  }
  return out;
}

/** Parses one `{ name: "...", category: "...", descriptor: "...", born: N[, country: "..."] }` per line. */
function parseRoster(body) {
  const out = [];
  const re =
    /\{\s*name:\s*"((?:[^"\\]|\\.)*)",\s*category:\s*"([^"]+)",\s*descriptor:\s*"((?:[^"\\]|\\.)*)",\s*born:\s*(\d+)(?:,\s*country:\s*"([^"]+)")?\s*\}/g;
  let m;
  while ((m = re.exec(body))) {
    out.push({
      name: m[1],
      category: m[2],
      descriptor: m[3],
      born: Number(m[4]),
      country: m[5] || null,
    });
  }
  return out;
}

function dartString(s) {
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function main() {
  const src = fs.readFileSync(TS_PATH, "utf8");

  const catBody = readSection(src, "export const CATEGORIES: Category[] = [", "\nexport const CATEGORY_SLUGS");
  const categories = parseCategories(catBody);

  const rosterBody = readSection(src, "export const ROSTER: RosterEntry[] = [", "\nexport function categoryBySlug");
  const roster = parseRoster(rosterBody);

  if (categories.length !== 6) {
    throw new Error(`expected 6 legacy categories, parsed ${categories.length}`);
  }
  if (roster.length < 400) {
    throw new Error(`parsed suspiciously few roster entries: ${roster.length}`);
  }

  const lines = [];
  lines.push("/// Category catalogue — a *labelled mock adapter*.");
  lines.push("///");
  lines.push("/// The backend has no category or \"top figures\" endpoint. Rather than");
  lines.push("/// rank real people by a metric we would have to invent, this file holds");
  lines.push("/// only public facts (see [RosterEntry]). It never feeds a number into");
  lines.push("/// the scoring path: opening a profile queries the real API.");
  lines.push("///");
  lines.push("/// GENERATED — do not hand-edit. Run `node tool/sync_dart_catalog.js`");
  lines.push("/// after changing `site/lib/catalog.ts`; that file is the source of");
  lines.push("/// truth for every name, category and descriptor below.");
  lines.push("library;");
  lines.push("");
  lines.push("import '../domain/models/figure_category.dart';");
  lines.push("");
  lines.push("const List<FigureCategory> kCategories = [");
  for (const c of categories) {
    lines.push("  FigureCategory(");
    lines.push(`    slug: ${dartString(c.slug)},`);
    lines.push(`    label: ${dartString(c.label)},`);
    lines.push(`    blurb: ${dartString(c.blurb)},`);
    lines.push("  ),");
  }
  lines.push("];");
  lines.push("");
  lines.push("const List<RosterEntry> kRoster = [");
  for (const r of roster) {
    const country = r.country ? `, country: ${dartString(r.country)}` : "";
    lines.push(
      `  RosterEntry(name: ${dartString(r.name)}, category: ${dartString(r.category)}, descriptor: ${dartString(r.descriptor)}, born: ${r.born}${country}),`,
    );
  }
  lines.push("];");
  lines.push("");
  lines.push("/// A labelled mock adapter over the catalogue. Named so it is obvious at");
  lines.push("/// the call site that this is not backend data.");
  lines.push("///");
  lines.push("/// Matches only the original six `category` tags above — the 35-category");
  lines.push("/// taxonomy layer (`site/lib/categories.ts`) has not been ported to");
  lines.push("/// Flutter yet, so a roster entry added under a newer tag (e.g.");
  lines.push("/// \"academics\", \"doctors\") is not reachable through this adapter.");
  lines.push("abstract final class CatalogAdapter {");
  lines.push("  static List<FigureCategory> categories() => kCategories;");
  lines.push("");
  lines.push("  static FigureCategory? categoryBySlug(String slug) {");
  lines.push("    for (final c in kCategories) {");
  lines.push("      if (c.slug == slug) return c;");
  lines.push("    }");
  lines.push("    return null;");
  lines.push("  }");
  lines.push("");
  lines.push("  static List<RosterEntry> rosterFor(String slug) =>");
  lines.push("      kRoster.where((r) => r.category == slug).toList(growable: false);");
  lines.push("");
  lines.push("  /// Editorial prominence order = the roster's own order.");
  lines.push("  static List<RosterEntry> topTen(String slug) =>");
  lines.push("      rosterFor(slug).take(10).toList(growable: false);");
  lines.push("");
  lines.push("  static RosterEntry? figureByName(String name) {");
  lines.push("    final key = name.trim().toLowerCase();");
  lines.push("    for (final r in kRoster) {");
  lines.push("      if (r.name.toLowerCase() == key) return r;");
  lines.push("    }");
  lines.push("    return null;");
  lines.push("  }");
  lines.push("");
  lines.push("  static List<RosterEntry> relatedFigures(String name, {int limit = 6}) {");
  lines.push("    final self = figureByName(name);");
  lines.push("    if (self == null) return const [];");
  lines.push("    return kRoster");
  lines.push("        .where((r) => r.category == self.category && r.name != self.name)");
  lines.push("        .take(limit)");
  lines.push("        .toList(growable: false);");
  lines.push("  }");
  lines.push("");
  lines.push("  static const List<int> decades = [");
  lines.push("    1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010,");
  lines.push("  ];");
  lines.push("}");
  lines.push("");

  fs.writeFileSync(DART_PATH, lines.join("\n"), "utf8");
  console.log(`Wrote ${categories.length} categories and ${roster.length} roster entries to ${DART_PATH}`);
}

main();
