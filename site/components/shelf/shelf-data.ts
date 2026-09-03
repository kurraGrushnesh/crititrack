import { ROSTER, type RosterEntry } from "@/lib/catalog";

/**
 * The shelf shows two figures from each category — a small, even spread
 * rather than the whole roster, so the row stays readable and the scene
 * stays light. Spine colour is keyed to the category, drawn from the
 * site palette.
 */

const PICK_PER_CATEGORY = 2;

export const SHELF_FIGURES: RosterEntry[] = (() => {
  const byCat = new Map<string, RosterEntry[]>();
  for (const e of ROSTER) {
    const list = byCat.get(e.category) ?? [];
    list.push(e);
    byCat.set(e.category, list);
  }
  const out: RosterEntry[] = [];
  for (const list of byCat.values()) {
    out.push(...list.slice(0, PICK_PER_CATEGORY));
  }
  return out;
})();

/** Spine colour per category. Muted, all in the same tonal family so
 * the row reads as a set, not a rainbow. */
export const CATEGORY_COLOR: Record<string, string> = {
  actors: "#2f6b52",
  politicians: "#3a4a63",
  athletes: "#8c5a2b",
  musicians: "#6b3f5b",
  business: "#4a4a44",
  creators: "#5a6b3a",
};

export function spineColor(category: string): string {
  return CATEGORY_COLOR[category] ?? "#4a4a44";
}
