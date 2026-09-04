/**
 * Demonym → country, for turning "Indian entrepreneurs" into a country
 * filter and for reading a nationality off a roster descriptor like
 * "Portuguese footballer". Covers the nationalities in the catalogue
 * plus the common ones; unknown demonyms are simply not resolved.
 */

export const DEMONYM_TO_COUNTRY: Record<string, string> = {
  afghan: "Afghanistan",
  albanian: "Albania",
  algerian: "Algeria",
  american: "United States",
  argentine: "Argentina",
  argentinian: "Argentina",
  australian: "Australia",
  austrian: "Austria",
  bangladeshi: "Bangladesh",
  barbadian: "Barbados",
  belgian: "Belgium",
  bolivian: "Bolivia",
  brazilian: "Brazil",
  british: "United Kingdom",
  bulgarian: "Bulgaria",
  cameroonian: "Cameroon",
  canadian: "Canada",
  chilean: "Chile",
  chinese: "China",
  colombian: "Colombia",
  congolese: "DR Congo",
  croatian: "Croatia",
  cuban: "Cuba",
  czech: "Czechia",
  danish: "Denmark",
  dominican: "Dominican Republic",
  dutch: "Netherlands",
  ecuadorian: "Ecuador",
  egyptian: "Egypt",
  emirati: "United Arab Emirates",
  english: "United Kingdom",
  ethiopian: "Ethiopia",
  filipino: "Philippines",
  filipina: "Philippines",
  finnish: "Finland",
  french: "France",
  georgian: "Georgia",
  german: "Germany",
  ghanaian: "Ghana",
  greek: "Greece",
  guatemalan: "Guatemala",
  haitian: "Haiti",
  hungarian: "Hungary",
  icelandic: "Iceland",
  indian: "India",
  indonesian: "Indonesia",
  iranian: "Iran",
  iraqi: "Iraq",
  irish: "Ireland",
  israeli: "Israel",
  italian: "Italy",
  jamaican: "Jamaica",
  japanese: "Japan",
  jordanian: "Jordan",
  kazakh: "Kazakhstan",
  kenyan: "Kenya",
  korean: "South Korea",
  kuwaiti: "Kuwait",
  lebanese: "Lebanon",
  malaysian: "Malaysia",
  mexican: "Mexico",
  moroccan: "Morocco",
  nepalese: "Nepal",
  "new zealander": "New Zealand",
  nigerian: "Nigeria",
  norwegian: "Norway",
  pakistani: "Pakistan",
  palestinian: "Palestine",
  peruvian: "Peru",
  polish: "Poland",
  portuguese: "Portugal",
  "puerto rican": "Puerto Rico",
  romanian: "Romania",
  russian: "Russia",
  saudi: "Saudi Arabia",
  scottish: "United Kingdom",
  senegalese: "Senegal",
  serbian: "Serbia",
  singaporean: "Singapore",
  slovak: "Slovakia",
  slovenian: "Slovenia",
  "south african": "South Africa",
  "south korean": "South Korea",
  spanish: "Spain",
  "sri lankan": "Sri Lanka",
  swedish: "Sweden",
  swiss: "Switzerland",
  syrian: "Syria",
  taiwanese: "Taiwan",
  thai: "Thailand",
  turkish: "Turkey",
  ukrainian: "Ukraine",
  uruguayan: "Uruguay",
  venezuelan: "Venezuela",
  vietnamese: "Vietnam",
  welsh: "United Kingdom",
  zimbabwean: "Zimbabwe",
};

/** Resolves a single demonym token to a country name, or null. */
export function countryForDemonym(token: string): string | null {
  return DEMONYM_TO_COUNTRY[token.trim().toLowerCase()] ?? null;
}

const COUNTRY_BY_LOWER = new Map(
  Object.values(DEMONYM_TO_COUNTRY).map((c) => [c.toLowerCase(), c]),
);
const COUNTRY_NAMES = new Set(COUNTRY_BY_LOWER.keys());

/**
 * A country name written out ("japan", "united states", "uk"), for a
 * bare-country search. Returns the canonical spelling or null.
 */
export function countryForName(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (t === "uk" || t === "u.k." || t === "britain") return "United Kingdom";
  if (t === "usa" || t === "u.s.a." || t === "us" || t === "america") {
    return "United States";
  }
  if (t === "uae") return "United Arab Emirates";
  return COUNTRY_BY_LOWER.get(t) ?? null;
}

/**
 * Reads a country off a roster descriptor:
 *   1. a leading demonym — "Portuguese footballer" → "Portugal"
 *   2. an "… of <Country>" office phrase — "Prime Minister of India" → "India"
 * Returns null when neither is present (e.g. "Chair of Reliance
 * Industries") — those entries carry an explicit `country` field.
 */
export function countryFromDescriptor(descriptor: string): string | null {
  const first = descriptor.trim().split(/[\s-]+/)[0]?.toLowerCase() ?? "";
  const demo = countryForDemonym(first);
  if (demo) return demo;

  const m = descriptor.match(
    /\bof (?:the )?([A-Z][a-z]+(?: [A-Z][a-z]+){0,2})\b/,
  );
  if (m && COUNTRY_NAMES.has(m[1].toLowerCase())) return m[1];
  return null;
}
