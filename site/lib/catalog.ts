/**
 * Category catalogue — a *labelled mock adapter*.
 *
 * The backend has no category or "top figures" endpoint, and building one
 * would mean ranking real people by a metric we would have to invent.
 * Instead this file holds only **verifiable public facts**: a person's
 * name, the field they are known for, a one-line neutral descriptor, and
 * an approximate birth year. Nothing here is a score, a claim, or an
 * allegation.
 *
 * When a profile is opened, the real API is queried by name and returns
 * the sourced, confidence-rated, evidence-linked data. This file never
 * feeds a number into that path.
 *
 * The per-category ordering is **editorial prominence**, not a ranking by
 * controversy — every surface that shows it says so.
 */

export interface Category {
  slug: string;
  label: string;
  /** One neutral sentence about who the category covers. */
  blurb: string;
}

export interface RosterEntry {
  name: string;
  category: string;
  /** A neutral, factual descriptor. No evaluation. */
  descriptor: string;
  /** Approximate birth year, for the decade filter. */
  born: number;
}

export const CATEGORIES: Category[] = [
  {
    slug: "actors",
    label: "Actors",
    blurb: "Film and television performers with a sustained public profile.",
  },
  {
    slug: "politicians",
    label: "Politicians",
    blurb: "Elected officials and heads of government and party.",
  },
  {
    slug: "athletes",
    label: "Athletes",
    blurb: "Competitors and champions across major sports.",
  },
  {
    slug: "musicians",
    label: "Musicians",
    blurb: "Recording artists, songwriters and performers.",
  },
  {
    slug: "business",
    label: "Business Leaders",
    blurb: "Founders and chief executives of large companies.",
  },
  {
    slug: "creators",
    label: "Creators",
    blurb: "People known primarily for work published online.",
  },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

/**
 * Curated roster. Ordering within a category is editorial prominence.
 * Names are chosen to be broadly recognisable; inclusion is not a
 * judgement of any kind.
 */
export const ROSTER: RosterEntry[] = [
  // ── Actors ────────────────────────────────────────────────────────
  { name: "Denzel Washington", category: "actors", descriptor: "American film actor and director", born: 1954 },
  { name: "Meryl Streep", category: "actors", descriptor: "American film and stage actor", born: 1949 },
  { name: "Tom Hanks", category: "actors", descriptor: "American actor and producer", born: 1956 },
  { name: "Cate Blanchett", category: "actors", descriptor: "Australian actor and producer", born: 1969 },
  { name: "Shah Rukh Khan", category: "actors", descriptor: "Indian film actor and producer", born: 1965 },
  { name: "Zendaya", category: "actors", descriptor: "American actor and producer", born: 1996 },
  { name: "Idris Elba", category: "actors", descriptor: "British actor and musician", born: 1972 },
  { name: "Florence Pugh", category: "actors", descriptor: "British actor", born: 1996 },
  { name: "Ke Huy Quan", category: "actors", descriptor: "American actor", born: 1971 },
  { name: "Michelle Yeoh", category: "actors", descriptor: "Malaysian actor", born: 1962 },
  { name: "Pedro Pascal", category: "actors", descriptor: "Chilean-American actor", born: 1975 },
  { name: "Viola Davis", category: "actors", descriptor: "American actor and producer", born: 1965 },

  // ── Politicians ──────────────────────────────────────────────────
  { name: "Barack Obama", category: "politicians", descriptor: "44th President of the United States", born: 1961 },
  { name: "Angela Merkel", category: "politicians", descriptor: "Former Chancellor of Germany", born: 1954 },
  { name: "Jacinda Ardern", category: "politicians", descriptor: "Former Prime Minister of New Zealand", born: 1980 },
  { name: "Justin Trudeau", category: "politicians", descriptor: "Prime Minister of Canada", born: 1971 },
  { name: "Emmanuel Macron", category: "politicians", descriptor: "President of France", born: 1977 },
  { name: "Narendra Modi", category: "politicians", descriptor: "Prime Minister of India", born: 1950 },
  { name: "Kamala Harris", category: "politicians", descriptor: "Vice President of the United States", born: 1964 },
  { name: "Volodymyr Zelenskyy", category: "politicians", descriptor: "President of Ukraine", born: 1978 },
  { name: "Rishi Sunak", category: "politicians", descriptor: "Former Prime Minister of the United Kingdom", born: 1980 },
  { name: "Lula da Silva", category: "politicians", descriptor: "President of Brazil", born: 1945 },
  { name: "Sanna Marin", category: "politicians", descriptor: "Former Prime Minister of Finland", born: 1985 },
  { name: "Ursula von der Leyen", category: "politicians", descriptor: "President of the European Commission", born: 1958 },

  // ── Athletes ─────────────────────────────────────────────────────
  { name: "Serena Williams", category: "athletes", descriptor: "American tennis champion", born: 1981 },
  { name: "LeBron James", category: "athletes", descriptor: "American basketball player", born: 1984 },
  { name: "Lionel Messi", category: "athletes", descriptor: "Argentine footballer", born: 1987 },
  { name: "Cristiano Ronaldo", category: "athletes", descriptor: "Portuguese footballer", born: 1985 },
  { name: "Simone Biles", category: "athletes", descriptor: "American gymnast", born: 1997 },
  { name: "Novak Djokovic", category: "athletes", descriptor: "Serbian tennis player", born: 1987 },
  { name: "Usain Bolt", category: "athletes", descriptor: "Jamaican sprinter", born: 1986 },
  { name: "Megan Rapinoe", category: "athletes", descriptor: "American footballer", born: 1985 },
  { name: "Lewis Hamilton", category: "athletes", descriptor: "British racing driver", born: 1985 },
  { name: "Katie Ledecky", category: "athletes", descriptor: "American swimmer", born: 1997 },
  { name: "Virat Kohli", category: "athletes", descriptor: "Indian cricketer", born: 1988 },
  { name: "Caitlin Clark", category: "athletes", descriptor: "American basketball player", born: 2002 },

  // ── Musicians ────────────────────────────────────────────────────
  { name: "Beyoncé", category: "musicians", descriptor: "American singer and songwriter", born: 1981 },
  { name: "Taylor Swift", category: "musicians", descriptor: "American singer and songwriter", born: 1989 },
  { name: "Kendrick Lamar", category: "musicians", descriptor: "American rapper", born: 1987 },
  { name: "Adele", category: "musicians", descriptor: "British singer and songwriter", born: 1988 },
  { name: "Bad Bunny", category: "musicians", descriptor: "Puerto Rican rapper and singer", born: 1994 },
  { name: "Billie Eilish", category: "musicians", descriptor: "American singer and songwriter", born: 2001 },
  { name: "The Weeknd", category: "musicians", descriptor: "Canadian singer and songwriter", born: 1990 },
  { name: "Dua Lipa", category: "musicians", descriptor: "British singer and songwriter", born: 1995 },
  { name: "Bruce Springsteen", category: "musicians", descriptor: "American singer and songwriter", born: 1949 },
  { name: "SZA", category: "musicians", descriptor: "American singer and songwriter", born: 1989 },
  { name: "Rosalía", category: "musicians", descriptor: "Spanish singer and songwriter", born: 1992 },
  { name: "Stevie Wonder", category: "musicians", descriptor: "American singer and songwriter", born: 1950 },

  // ── Business Leaders ─────────────────────────────────────────────
  { name: "Satya Nadella", category: "business", descriptor: "Chief executive of Microsoft", born: 1967 },
  { name: "Tim Cook", category: "business", descriptor: "Chief executive of Apple", born: 1960 },
  { name: "Mary Barra", category: "business", descriptor: "Chief executive of General Motors", born: 1961 },
  { name: "Jensen Huang", category: "business", descriptor: "Chief executive of Nvidia", born: 1963 },
  { name: "Warren Buffett", category: "business", descriptor: "Chair of Berkshire Hathaway", born: 1930 },
  { name: "Sundar Pichai", category: "business", descriptor: "Chief executive of Alphabet", born: 1972 },
  { name: "Elon Musk", category: "business", descriptor: "Chief executive of Tesla and SpaceX", born: 1971 },
  { name: "Jamie Dimon", category: "business", descriptor: "Chief executive of JPMorgan Chase", born: 1956 },
  { name: "Lisa Su", category: "business", descriptor: "Chief executive of AMD", born: 1969 },
  { name: "Bob Iger", category: "business", descriptor: "Chief executive of The Walt Disney Company", born: 1951 },
  { name: "Reed Hastings", category: "business", descriptor: "Co-founder of Netflix", born: 1960 },
  { name: "Brian Chesky", category: "business", descriptor: "Chief executive of Airbnb", born: 1981 },

  // ── Creators ─────────────────────────────────────────────────────
  { name: "MrBeast", category: "creators", descriptor: "American online video creator", born: 1998 },
  { name: "Marques Brownlee", category: "creators", descriptor: "American technology video creator", born: 1993 },
  { name: "Emma Chamberlain", category: "creators", descriptor: "American online personality", born: 2001 },
  { name: "Hank Green", category: "creators", descriptor: "American online video creator and author", born: 1980 },
  { name: "Ali Abdaal", category: "creators", descriptor: "British productivity video creator", born: 1994 },
  { name: "Michelle Khare", category: "creators", descriptor: "American online video creator", born: 1992 },
  { name: "Marina Mogilko", category: "creators", descriptor: "Language and entrepreneurship creator", born: 1990 },
  { name: "Dhar Mann", category: "creators", descriptor: "American short-video producer", born: 1984 },
  { name: "Kurzgesagt", category: "creators", descriptor: "German science animation studio", born: 2013 },
  { name: "Physics Girl", category: "creators", descriptor: "American science communicator", born: 1991 },
  { name: "Safiya Nygaard", category: "creators", descriptor: "American online video creator", born: 1992 },
  { name: "TED-Ed", category: "creators", descriptor: "Educational video initiative", born: 2011 },
];

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function rosterFor(slug: string): RosterEntry[] {
  return ROSTER.filter((r) => r.category === slug);
}

/** Editorial prominence order = the roster's own order. */
export function topTen(slug: string): RosterEntry[] {
  return rosterFor(slug).slice(0, 10);
}

export function figureByName(name: string): RosterEntry | undefined {
  const key = name.trim().toLowerCase();
  return ROSTER.find((r) => r.name.toLowerCase() === key);
}

/** Same category, excluding the person themselves. */
export function relatedFigures(name: string, limit = 6): RosterEntry[] {
  const self = figureByName(name);
  if (!self) return [];
  return ROSTER.filter(
    (r) => r.category === self.category && r.name !== self.name,
  ).slice(0, limit);
}

export const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010];

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/** A stable, URL-safe id for a roster entry (matches the backend slug
 * rules closely enough for a link; the API canonicalises on lookup). */
export function figureSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
