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

import { resolveCatalogueOccupation } from "./professional-identity";

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
  /**
   * Country of nationality, spelled out only where the descriptor does
   * not already carry a demonym or an "… of <Country>" office phrase
   * (mostly business figures). A verifiable fact, not a guess.
   */
  country?: string;
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
 * Curated roster. Ordering within a category is editorial prominence
 * (the first ten of each fill its "Top 10"); the rest follow in no
 * particular order. Names are chosen to be broadly recognisable and
 * globally spread; inclusion is not a judgement of any kind, and every
 * `descriptor` is a neutral, checkable fact.
 *
 * Office- and role-based descriptors ("Prime Minister of …") reflect the
 * position held when the entry was written and can go stale; "Former …"
 * is used wherever a term is known to have ended. The live profile, not
 * this file, is the source of anything current.
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
  { name: "Leonardo DiCaprio", category: "actors", descriptor: "American actor and producer", born: 1974 },
  { name: "Brad Pitt", category: "actors", descriptor: "American actor and producer", born: 1963 },
  { name: "Nicole Kidman", category: "actors", descriptor: "Australian actor and producer", born: 1967 },
  { name: "Anthony Hopkins", category: "actors", descriptor: "Welsh actor", born: 1937 },
  { name: "Judi Dench", category: "actors", descriptor: "British actor", born: 1934 },
  { name: "Morgan Freeman", category: "actors", descriptor: "American actor and narrator", born: 1937 },
  { name: "Robert De Niro", category: "actors", descriptor: "American actor and producer", born: 1943 },
  { name: "Al Pacino", category: "actors", descriptor: "American actor", born: 1940 },
  { name: "Daniel Day-Lewis", category: "actors", descriptor: "British-Irish actor", born: 1957 },
  { name: "Kate Winslet", category: "actors", descriptor: "British actor", born: 1975 },
  { name: "Saoirse Ronan", category: "actors", descriptor: "Irish actor", born: 1994 },
  { name: "Timothée Chalamet", category: "actors", descriptor: "American actor", born: 1995 },
  { name: "Margot Robbie", category: "actors", descriptor: "Australian actor and producer", born: 1990 },
  { name: "Song Kang-ho", category: "actors", descriptor: "South Korean actor", born: 1967 },
  { name: "Lee Jung-jae", category: "actors", descriptor: "South Korean actor", born: 1972 },
  { name: "Tony Leung Chiu-wai", category: "actors", descriptor: "Hong Kong actor", born: 1962 },
  { name: "Aamir Khan", category: "actors", descriptor: "Indian film actor and producer", born: 1965 },
  { name: "Deepika Padukone", category: "actors", descriptor: "Indian film actor and producer", born: 1986 },
  { name: "Priyanka Chopra Jonas", category: "actors", descriptor: "Indian actor and producer", born: 1982 },
  { name: "Nawazuddin Siddiqui", category: "actors", descriptor: "Indian film actor", born: 1974 },
  { name: "Rajinikanth", category: "actors", descriptor: "Indian film actor", born: 1950 },
  { name: "Marion Cotillard", category: "actors", descriptor: "French actor", born: 1975 },
  { name: "Penélope Cruz", category: "actors", descriptor: "Spanish actor", born: 1974 },
  { name: "Javier Bardem", category: "actors", descriptor: "Spanish actor", born: 1969 },
  { name: "Christoph Waltz", category: "actors", descriptor: "Austrian-German actor", born: 1956 },
  { name: "Mahershala Ali", category: "actors", descriptor: "American actor", born: 1974 },
  { name: "Lupita Nyong'o", category: "actors", descriptor: "Kenyan-Mexican actor", born: 1983 },
  { name: "Dev Patel", category: "actors", descriptor: "British actor", born: 1990 },
  { name: "John Boyega", category: "actors", descriptor: "British actor", born: 1992 },
  { name: "Ken Watanabe", category: "actors", descriptor: "Japanese actor", born: 1959 },
  { name: "Wagner Moura", category: "actors", descriptor: "Brazilian actor and director", born: 1976 },
  { name: "Ricardo Darín", category: "actors", descriptor: "Argentine actor", born: 1957 },

  // ── Politicians ──────────────────────────────────────────────────
  { name: "Barack Obama", category: "politicians", descriptor: "44th President of the United States", born: 1961 },
  { name: "Angela Merkel", category: "politicians", descriptor: "Former Chancellor of Germany", born: 1954 },
  { name: "Jacinda Ardern", category: "politicians", descriptor: "Former Prime Minister of New Zealand", born: 1980 },
  { name: "Justin Trudeau", category: "politicians", descriptor: "Former Prime Minister of Canada", born: 1971 },
  { name: "Emmanuel Macron", category: "politicians", descriptor: "President of France", born: 1977 },
  { name: "Narendra Modi", category: "politicians", descriptor: "Prime Minister of India", born: 1950 },
  { name: "Kamala Harris", category: "politicians", descriptor: "Former Vice President of the United States", born: 1964 },
  { name: "Volodymyr Zelenskyy", category: "politicians", descriptor: "President of Ukraine", born: 1978 },
  { name: "Rishi Sunak", category: "politicians", descriptor: "Former Prime Minister of the United Kingdom", born: 1980 },
  { name: "Lula da Silva", category: "politicians", descriptor: "President of Brazil", born: 1945 },
  { name: "Sanna Marin", category: "politicians", descriptor: "Former Prime Minister of Finland", born: 1985 },
  { name: "Ursula von der Leyen", category: "politicians", descriptor: "President of the European Commission", born: 1958 },
  { name: "Joe Biden", category: "politicians", descriptor: "46th President of the United States", born: 1942 },
  { name: "Donald Trump", category: "politicians", descriptor: "45th President of the United States", born: 1946 },
  { name: "Vladimir Putin", category: "politicians", descriptor: "President of Russia", born: 1952 },
  { name: "Xi Jinping", category: "politicians", descriptor: "General Secretary of the Chinese Communist Party", born: 1953 },
  { name: "Keir Starmer", category: "politicians", descriptor: "Prime Minister of the United Kingdom", born: 1962 },
  { name: "Olaf Scholz", category: "politicians", descriptor: "Chancellor of Germany", born: 1958 },
  { name: "Giorgia Meloni", category: "politicians", descriptor: "Prime Minister of Italy", born: 1977 },
  { name: "Pedro Sánchez", category: "politicians", descriptor: "Prime Minister of Spain", born: 1972 },
  { name: "Anthony Albanese", category: "politicians", descriptor: "Prime Minister of Australia", born: 1963 },
  { name: "Recep Tayyip Erdoğan", category: "politicians", descriptor: "President of Turkey", born: 1954 },
  { name: "Benjamin Netanyahu", category: "politicians", descriptor: "Prime Minister of Israel", born: 1949 },
  { name: "Cyril Ramaphosa", category: "politicians", descriptor: "President of South Africa", born: 1952 },
  { name: "Bola Tinubu", category: "politicians", descriptor: "President of Nigeria", born: 1952 },
  { name: "William Ruto", category: "politicians", descriptor: "President of Kenya", born: 1966 },
  { name: "Claudia Sheinbaum", category: "politicians", descriptor: "President of Mexico", born: 1962 },
  { name: "Javier Milei", category: "politicians", descriptor: "President of Argentina", born: 1970 },
  { name: "Gabriel Boric", category: "politicians", descriptor: "President of Chile", born: 1986 },
  { name: "Gustavo Petro", category: "politicians", descriptor: "President of Colombia", born: 1960 },
  { name: "Nayib Bukele", category: "politicians", descriptor: "President of El Salvador", born: 1981 },
  { name: "Anwar Ibrahim", category: "politicians", descriptor: "Prime Minister of Malaysia", born: 1947 },
  { name: "Ferdinand Marcos Jr.", category: "politicians", descriptor: "President of the Philippines", born: 1957 },
  { name: "Prabowo Subianto", category: "politicians", descriptor: "President of Indonesia", born: 1951 },
  { name: "Joko Widodo", category: "politicians", descriptor: "Former President of Indonesia", born: 1961 },
  { name: "Fumio Kishida", category: "politicians", descriptor: "Former Prime Minister of Japan", born: 1957 },
  { name: "Sheikh Hasina", category: "politicians", descriptor: "Former Prime Minister of Bangladesh", born: 1947 },
  { name: "Alexandria Ocasio-Cortez", category: "politicians", descriptor: "United States Representative for New York", born: 1989 },
  { name: "Bernie Sanders", category: "politicians", descriptor: "United States Senator for Vermont", born: 1941 },
  { name: "Nancy Pelosi", category: "politicians", descriptor: "United States Representative and former Speaker", born: 1940 },
  { name: "Viktor Orbán", category: "politicians", descriptor: "Prime Minister of Hungary", born: 1963 },
  { name: "Donald Tusk", category: "politicians", descriptor: "Prime Minister of Poland", born: 1957 },
  { name: "Mette Frederiksen", category: "politicians", descriptor: "Prime Minister of Denmark", born: 1977 },
  { name: "Nicola Sturgeon", category: "politicians", descriptor: "Former First Minister of Scotland", born: 1970 },

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
  { name: "Rafael Nadal", category: "athletes", descriptor: "Spanish tennis player", born: 1986 },
  { name: "Roger Federer", category: "athletes", descriptor: "Swiss former tennis player", born: 1981 },
  { name: "Kylian Mbappé", category: "athletes", descriptor: "French footballer", born: 1998 },
  { name: "Erling Haaland", category: "athletes", descriptor: "Norwegian footballer", born: 2000 },
  { name: "Neymar", category: "athletes", descriptor: "Brazilian footballer", born: 1992 },
  { name: "Stephen Curry", category: "athletes", descriptor: "American basketball player", born: 1988 },
  { name: "Kevin Durant", category: "athletes", descriptor: "American basketball player", born: 1988 },
  { name: "Giannis Antetokounmpo", category: "athletes", descriptor: "Greek basketball player", born: 1994 },
  { name: "Nikola Jokić", category: "athletes", descriptor: "Serbian basketball player", born: 1995 },
  { name: "Luka Dončić", category: "athletes", descriptor: "Slovenian basketball player", born: 1999 },
  { name: "Max Verstappen", category: "athletes", descriptor: "Dutch racing driver", born: 1997 },
  { name: "Patrick Mahomes", category: "athletes", descriptor: "American football quarterback", born: 1995 },
  { name: "Shohei Ohtani", category: "athletes", descriptor: "Japanese baseball player", born: 1994 },
  { name: "Naomi Osaka", category: "athletes", descriptor: "Japanese tennis player", born: 1997 },
  { name: "Carlos Alcaraz", category: "athletes", descriptor: "Spanish tennis player", born: 2003 },
  { name: "Iga Świątek", category: "athletes", descriptor: "Polish tennis player", born: 2001 },
  { name: "Coco Gauff", category: "athletes", descriptor: "American tennis player", born: 2004 },
  { name: "Eliud Kipchoge", category: "athletes", descriptor: "Kenyan marathon runner", born: 1984 },
  { name: "Faith Kipyegon", category: "athletes", descriptor: "Kenyan middle-distance runner", born: 1994 },
  { name: "Sifan Hassan", category: "athletes", descriptor: "Dutch distance runner", born: 1993 },
  { name: "Neeraj Chopra", category: "athletes", descriptor: "Indian javelin thrower", born: 1997 },
  { name: "P. V. Sindhu", category: "athletes", descriptor: "Indian badminton player", born: 1995 },
  { name: "MS Dhoni", category: "athletes", descriptor: "Indian former cricket captain", born: 1981 },
  { name: "Ben Stokes", category: "athletes", descriptor: "English cricketer", born: 1991 },
  { name: "Pat Cummins", category: "athletes", descriptor: "Australian cricketer", born: 1993 },
  { name: "Katie Taylor", category: "athletes", descriptor: "Irish boxer", born: 1986 },
  { name: "Canelo Álvarez", category: "athletes", descriptor: "Mexican boxer", born: 1990 },
  { name: "Anthony Joshua", category: "athletes", descriptor: "British boxer", born: 1989 },
  { name: "Tadej Pogačar", category: "athletes", descriptor: "Slovenian road cyclist", born: 1998 },
  { name: "Mikaela Shiffrin", category: "athletes", descriptor: "American alpine skier", born: 1995 },

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
  { name: "Drake", category: "musicians", descriptor: "Canadian rapper and singer", born: 1986 },
  { name: "Rihanna", category: "musicians", descriptor: "Barbadian singer and businesswoman", born: 1988 },
  { name: "Ed Sheeran", category: "musicians", descriptor: "British singer and songwriter", born: 1991 },
  { name: "Bruno Mars", category: "musicians", descriptor: "American singer and songwriter", born: 1985 },
  { name: "Lady Gaga", category: "musicians", descriptor: "American singer and actor", born: 1986 },
  { name: "Ariana Grande", category: "musicians", descriptor: "American singer and actor", born: 1993 },
  { name: "Justin Bieber", category: "musicians", descriptor: "Canadian singer", born: 1994 },
  { name: "Paul McCartney", category: "musicians", descriptor: "British singer and songwriter", born: 1942 },
  { name: "Elton John", category: "musicians", descriptor: "British singer and songwriter", born: 1947 },
  { name: "Madonna", category: "musicians", descriptor: "American singer and songwriter", born: 1958 },
  { name: "Shakira", category: "musicians", descriptor: "Colombian singer and songwriter", born: 1977 },
  { name: "Karol G", category: "musicians", descriptor: "Colombian singer", born: 1991 },
  { name: "J Balvin", category: "musicians", descriptor: "Colombian singer", born: 1985 },
  { name: "Peso Pluma", category: "musicians", descriptor: "Mexican singer", born: 1999 },
  { name: "BTS", category: "musicians", descriptor: "South Korean pop group", born: 2013 },
  { name: "IU", category: "musicians", descriptor: "South Korean singer and actor", born: 1993 },
  { name: "G-Dragon", category: "musicians", descriptor: "South Korean rapper and singer", born: 1988 },
  { name: "Burna Boy", category: "musicians", descriptor: "Nigerian singer", born: 1991 },
  { name: "Wizkid", category: "musicians", descriptor: "Nigerian singer", born: 1990 },
  { name: "Tems", category: "musicians", descriptor: "Nigerian singer and songwriter", born: 1995 },
  { name: "A. R. Rahman", category: "musicians", descriptor: "Indian composer", born: 1967 },
  { name: "Arijit Singh", category: "musicians", descriptor: "Indian playback singer", born: 1987 },
  { name: "Diljit Dosanjh", category: "musicians", descriptor: "Indian singer and actor", born: 1984 },
  { name: "Sabrina Carpenter", category: "musicians", descriptor: "American singer and actor", born: 1999 },
  { name: "Olivia Rodrigo", category: "musicians", descriptor: "American singer and songwriter", born: 2003 },
  { name: "Post Malone", category: "musicians", descriptor: "American singer and rapper", born: 1995 },
  { name: "Lana Del Rey", category: "musicians", descriptor: "American singer and songwriter", born: 1985 },
  { name: "Hozier", category: "musicians", descriptor: "Irish singer and songwriter", born: 1990 },
  { name: "Stormzy", category: "musicians", descriptor: "British rapper", born: 1993 },
  { name: "Yo-Yo Ma", category: "musicians", descriptor: "American cellist", born: 1955 },
  { name: "Lang Lang", category: "musicians", descriptor: "Chinese pianist", born: 1982 },

  // ── Business Leaders ─────────────────────────────────────────────
  { name: "Satya Nadella", category: "business", descriptor: "Chief executive of Microsoft", born: 1967, country: "India" },
  { name: "Tim Cook", category: "business", descriptor: "Chief executive of Apple", born: 1960, country: "United States" },
  { name: "Mary Barra", category: "business", descriptor: "Chief executive of General Motors", born: 1961, country: "United States" },
  { name: "Jensen Huang", category: "business", descriptor: "Chief executive of Nvidia", born: 1963, country: "United States" },
  { name: "Warren Buffett", category: "business", descriptor: "Chair of Berkshire Hathaway", born: 1930, country: "United States" },
  { name: "Sundar Pichai", category: "business", descriptor: "Chief executive of Alphabet", born: 1972, country: "India" },
  { name: "Elon Musk", category: "business", descriptor: "Chief executive of Tesla and SpaceX", born: 1971, country: "United States" },
  { name: "Jamie Dimon", category: "business", descriptor: "Chief executive of JPMorgan Chase", born: 1956, country: "United States" },
  { name: "Lisa Su", category: "business", descriptor: "Chief executive of AMD", born: 1969, country: "United States" },
  { name: "Bob Iger", category: "business", descriptor: "Chief executive of The Walt Disney Company", born: 1951, country: "United States" },
  { name: "Reed Hastings", category: "business", descriptor: "Co-founder of Netflix", born: 1960, country: "United States" },
  { name: "Brian Chesky", category: "business", descriptor: "Chief executive of Airbnb", born: 1981, country: "United States" },
  { name: "Jeff Bezos", category: "business", descriptor: "Founder and executive chair of Amazon", born: 1964, country: "United States" },
  { name: "Bill Gates", category: "business", descriptor: "Co-founder of Microsoft", born: 1955, country: "United States" },
  { name: "Mark Zuckerberg", category: "business", descriptor: "Chief executive of Meta Platforms", born: 1984, country: "United States" },
  { name: "Larry Page", category: "business", descriptor: "Co-founder of Google", born: 1973, country: "United States" },
  { name: "Sergey Brin", category: "business", descriptor: "Co-founder of Google", born: 1973, country: "United States" },
  { name: "Larry Ellison", category: "business", descriptor: "Co-founder and chair of Oracle", born: 1944, country: "United States" },
  { name: "Michael Dell", category: "business", descriptor: "Founder and chief executive of Dell", born: 1965, country: "United States" },
  { name: "Bernard Arnault", category: "business", descriptor: "Chair and chief executive of LVMH", born: 1949, country: "France" },
  { name: "Mukesh Ambani", category: "business", descriptor: "Chair of Reliance Industries", born: 1957, country: "India" },
  { name: "Gautam Adani", category: "business", descriptor: "Chair of the Adani Group", born: 1962, country: "India" },
  { name: "N. R. Narayana Murthy", category: "business", descriptor: "Co-founder of Infosys", born: 1946, country: "India" },
  { name: "Kiran Mazumdar-Shaw", category: "business", descriptor: "Founder and chair of Biocon", born: 1953, country: "India" },
  { name: "Jack Ma", category: "business", descriptor: "Co-founder of Alibaba Group", born: 1964, country: "China" },
  { name: "Zhang Yiming", category: "business", descriptor: "Co-founder of ByteDance", born: 1983, country: "China" },
  { name: "Masayoshi Son", category: "business", descriptor: "Founder and chief executive of SoftBank Group", born: 1957, country: "Japan" },
  { name: "Aliko Dangote", category: "business", descriptor: "Founder and chair of the Dangote Group", born: 1957, country: "Nigeria" },
  { name: "Strive Masiyiwa", category: "business", descriptor: "Founder of Econet Wireless", born: 1961, country: "Zimbabwe" },
  { name: "Carlos Slim", category: "business", descriptor: "Chair of Grupo Carso and América Móvil", born: 1940, country: "Mexico" },
  { name: "Daniel Ek", category: "business", descriptor: "Co-founder and chief executive of Spotify", born: 1983, country: "Sweden" },
  { name: "Patrick Collison", category: "business", descriptor: "Co-founder and chief executive of Stripe", born: 1988, country: "Ireland" },
  { name: "Dara Khosrowshahi", category: "business", descriptor: "Chief executive of Uber", born: 1969, country: "United States" },
  { name: "Andy Jassy", category: "business", descriptor: "Chief executive of Amazon", born: 1968, country: "United States" },
  { name: "Marc Benioff", category: "business", descriptor: "Co-founder and chief executive of Salesforce", born: 1964, country: "United States" },
  { name: "Sam Altman", category: "business", descriptor: "Chief executive of OpenAI", born: 1985, country: "United States" },
  { name: "Demis Hassabis", category: "business", descriptor: "Co-founder and chief executive of Google DeepMind", born: 1976, country: "United Kingdom" },
  { name: "Jane Fraser", category: "business", descriptor: "Chief executive of Citigroup", born: 1967, country: "United Kingdom" },
  { name: "Doug McMillon", category: "business", descriptor: "Chief executive of Walmart", born: 1966, country: "United States" },
  { name: "Shantanu Narayen", category: "business", descriptor: "Chair and chief executive of Adobe", born: 1963, country: "India" },
  { name: "Arvind Krishna", category: "business", descriptor: "Chair and chief executive of IBM", born: 1962, country: "India" },
  { name: "Emma Walmsley", category: "business", descriptor: "Chief executive of GSK", born: 1969, country: "United Kingdom" },

  // ── Creators ─────────────────────────────────────────────────────
  { name: "MrBeast", category: "creators", descriptor: "American online video creator", born: 1998, country: "United States" },
  { name: "Marques Brownlee", category: "creators", descriptor: "American technology video creator", born: 1993 },
  { name: "Emma Chamberlain", category: "creators", descriptor: "American online personality", born: 2001 },
  { name: "Hank Green", category: "creators", descriptor: "American online video creator and author", born: 1980 },
  { name: "Ali Abdaal", category: "creators", descriptor: "British productivity video creator", born: 1994 },
  { name: "Michelle Khare", category: "creators", descriptor: "American online video creator", born: 1992 },
  { name: "Marina Mogilko", category: "creators", descriptor: "Language and entrepreneurship creator", born: 1990 },
  { name: "Dhar Mann", category: "creators", descriptor: "American short-video producer", born: 1984 },
  { name: "Kurzgesagt", category: "creators", descriptor: "German science animation studio", born: 2013, country: "Germany" },
  { name: "Physics Girl", category: "creators", descriptor: "American science communicator", born: 1991 },
  { name: "Safiya Nygaard", category: "creators", descriptor: "American online video creator", born: 1992 },
  { name: "TED-Ed", category: "creators", descriptor: "Educational video initiative", born: 2011, country: "United States" },
  { name: "PewDiePie", category: "creators", descriptor: "Swedish online video creator", born: 1989 },
  { name: "Markiplier", category: "creators", descriptor: "American online video creator", born: 1989 },
  { name: "Casey Neistat", category: "creators", descriptor: "American filmmaker and online video creator", born: 1981 },
  { name: "Lilly Singh", category: "creators", descriptor: "Canadian online video creator and host", born: 1988 },
  { name: "KSI", category: "creators", descriptor: "British online video creator and musician", born: 1993 },
  { name: "Tyler Blevins", category: "creators", descriptor: "American live streamer, known as Ninja", born: 1991 },
  { name: "Kai Cenat", category: "creators", descriptor: "American live streamer", born: 2001 },
  { name: "IShowSpeed", category: "creators", descriptor: "American live streamer", born: 2005 },
  { name: "Pokimane", category: "creators", descriptor: "Moroccan-Canadian live streamer", born: 1996 },
  { name: "Charli D'Amelio", category: "creators", descriptor: "American social media personality and dancer", born: 2004 },
  { name: "Khaby Lame", category: "creators", descriptor: "Senegalese-Italian social media personality", born: 2000 },
  { name: "Bella Poarch", category: "creators", descriptor: "Filipino-American social media personality and singer", born: 1997 },
  { name: "Linus Sebastian", category: "creators", descriptor: "Canadian technology video creator", born: 1986 },
  { name: "Derek Muller", category: "creators", descriptor: "Australian-Canadian science communicator, Veritasium", born: 1982 },
  { name: "Michael Stevens", category: "creators", descriptor: "American educational creator, Vsauce", born: 1986 },
  { name: "Mark Rober", category: "creators", descriptor: "American engineer and science video creator", born: 1980 },
  { name: "Simone Giertz", category: "creators", descriptor: "Swedish inventor and video creator", born: 1990 },
  { name: "Nuseir Yassin", category: "creators", descriptor: "Palestinian-Israeli video creator, Nas Daily", born: 1992 },
  { name: "Arun Maini", category: "creators", descriptor: "British technology video creator, Mrwhosetheboss", born: 1996 },
  { name: "NikkieTutorials", category: "creators", descriptor: "Dutch beauty video creator", born: 1994 },
  { name: "Zoe Sugg", category: "creators", descriptor: "British online personality and author", born: 1990 },
  { name: "Ryan Trahan", category: "creators", descriptor: "American online video creator", born: 1998 },
  { name: "Bailey Sarian", category: "creators", descriptor: "American storytelling video creator", born: 1988 },
  { name: "Andrew Rea", category: "creators", descriptor: "American cooking video creator, Babish", born: 1987 },

  // ── Academics & Professors ──────────────────────────────────────────
  { name: "Noam Chomsky", category: "academics", descriptor: "American professor", born: 1928, country: "United States" },
  { name: "Steven Pinker", category: "academics", descriptor: "Canadian-American professor", born: 1954, country: "United States" },
  { name: "Michael Sandel", category: "academics", descriptor: "American political philosopher and professor", born: 1953, country: "United States" },
  { name: "Jordan Peterson", category: "academics", descriptor: "Canadian psychologist and former professor", born: 1962, country: "Canada" },
  { name: "Niall Ferguson", category: "academics", descriptor: "British historian and professor", born: 1964, country: "United Kingdom" },
  { name: "Jonathan Haidt", category: "academics", descriptor: "American social psychologist and professor", born: 1963, country: "United States" },
  { name: "Ibram X. Kendi", category: "academics", descriptor: "American historian and professor", born: 1982, country: "United States" },
  { name: "Cornel West", category: "academics", descriptor: "American philosopher and professor", born: 1953, country: "United States" },

  // ── Activists & Human Rights ─────────────────────────────────────────
  { name: "Malala Yousafzai", category: "activists", descriptor: "Pakistani education activist", born: 1997, country: "Pakistan" },
  { name: "Amal Clooney", category: "lawyers", descriptor: "Lebanese-British human rights lawyer", born: 1978, country: "United Kingdom" },
  { name: "Bryan Stevenson", category: "activists", descriptor: "American civil rights lawyer", born: 1959, country: "United States" },
  { name: "Nadia Murad", category: "activists", descriptor: "Iraqi human rights activist", born: 1993, country: "Iraq" },
  { name: "DeRay Mckesson", category: "activists", descriptor: "American civil rights activist", born: 1985, country: "United States" },
  { name: "Ai Weiwei", category: "activists", descriptor: "Chinese artist and activist", born: 1957, country: "China" },
  { name: "Denis Mukwege", category: "activists", descriptor: "Congolese gynaecologist and human rights activist", born: 1955, country: "DR Congo" },

  // ── AI & Machine Learning ────────────────────────────────────────────
  { name: "Geoffrey Hinton", category: "ai-ml", descriptor: "British-Canadian computer scientist", born: 1947, country: "Canada" },
  { name: "Yann LeCun", category: "ai-ml", descriptor: "French computer scientist", born: 1960, country: "France" },
  { name: "Yoshua Bengio", category: "ai-ml", descriptor: "Canadian computer scientist", born: 1964, country: "Canada" },
  { name: "Fei-Fei Li", category: "ai-ml", descriptor: "Chinese-American computer scientist", born: 1976, country: "United States" },
  { name: "Andrew Ng", category: "ai-ml", descriptor: "American computer scientist and AI researcher", born: 1976, country: "United States" },
  { name: "Ilya Sutskever", category: "ai-ml", descriptor: "Russian-Canadian AI researcher", born: 1985, country: "Canada" },
  { name: "Timnit Gebru", category: "ai-ml", descriptor: "Eritrean-American AI researcher", born: 1983, country: "United States" },
  { name: "Mustafa Suleyman", category: "ai-ml", descriptor: "British AI researcher", born: 1984, country: "United Kingdom" },
  { name: "Dario Amodei", category: "ai-ml", descriptor: "American AI researcher", born: 1983, country: "United States" },

  // ── Architects ───────────────────────────────────────────────────────
  { name: "Bjarke Ingels", category: "architects", descriptor: "Danish architect", born: 1974, country: "Denmark" },
  { name: "Frank Gehry", category: "architects", descriptor: "Canadian-American architect", born: 1929, country: "United States" },
  { name: "Renzo Piano", category: "architects", descriptor: "Italian architect", born: 1937, country: "Italy" },
  { name: "Norman Foster", category: "architects", descriptor: "British architect", born: 1935, country: "United Kingdom" },
  { name: "Tadao Ando", category: "architects", descriptor: "Japanese architect", born: 1941, country: "Japan" },
  { name: "David Adjaye", category: "architects", descriptor: "Ghanaian-British architect", born: 1966, country: "United Kingdom" },
  { name: "Zaha Hadid", category: "architects", descriptor: "Iraqi-British architect", born: 1950, country: "United Kingdom" },

  // ── Artists & Designers ──────────────────────────────────────────────
  { name: "Yayoi Kusama", category: "artists", descriptor: "Japanese artist", born: 1929, country: "Japan" },
  { name: "Jeff Koons", category: "artists", descriptor: "American artist", born: 1955, country: "United States" },
  { name: "Marina Abramović", category: "artists", descriptor: "Serbian performance artist", born: 1946, country: "Serbia" },
  { name: "Takashi Murakami", category: "artists", descriptor: "Japanese artist", born: 1962, country: "Japan" },
  { name: "Kehinde Wiley", category: "artists", descriptor: "American portrait artist", born: 1977, country: "United States" },
  { name: "Es Devlin", category: "artists", descriptor: "British stage designer and artist", born: 1971, country: "United Kingdom" },

  // ── Chefs & Food ─────────────────────────────────────────────────────
  { name: "Gordon Ramsay", category: "chefs", descriptor: "British chef", born: 1966, country: "United Kingdom" },
  { name: "José Andrés", category: "chefs", descriptor: "Spanish-American chef", born: 1969, country: "United States" },
  { name: "Massimo Bottura", category: "chefs", descriptor: "Italian chef", born: 1962, country: "Italy" },
  { name: "Dominique Crenn", category: "chefs", descriptor: "French-American chef", born: 1965, country: "United States" },
  { name: "David Chang", category: "chefs", descriptor: "American chef", born: 1977, country: "United States" },
  { name: "Alice Waters", category: "chefs", descriptor: "American chef", born: 1944, country: "United States" },
  { name: "René Redzepi", category: "chefs", descriptor: "Danish chef", born: 1977, country: "Denmark" },
  { name: "Marcus Samuelsson", category: "chefs", descriptor: "Swedish-Ethiopian chef", born: 1971, country: "United States" },

  // ── Doctors & Healthcare ─────────────────────────────────────────────
  { name: "Anthony Fauci", category: "doctors", descriptor: "American physician", born: 1940, country: "United States" },
  { name: "Sanjay Gupta", category: "doctors", descriptor: "American neurosurgeon and medical journalist", born: 1969, country: "United States" },
  { name: "Atul Gawande", category: "doctors", descriptor: "American surgeon and writer", born: 1965, country: "United States" },
  { name: "Devi Shetty", category: "doctors", descriptor: "Indian cardiac surgeon", born: 1953, country: "India" },
  { name: "Tedros Adhanom Ghebreyesus", category: "doctors", descriptor: "Ethiopian public health official, WHO Director-General", born: 1965, country: "Ethiopia" },
  { name: "Soumya Swaminathan", category: "doctors", descriptor: "Indian paediatrician and public health official", born: 1959, country: "India" },
  { name: "Leana Wen", category: "doctors", descriptor: "American physician and public health official", born: 1983, country: "United States" },

  // ── Economists ───────────────────────────────────────────────────────
  { name: "Paul Krugman", category: "economists", descriptor: "American economist", born: 1953, country: "United States" },
  { name: "Esther Duflo", category: "economists", descriptor: "French-American economist", born: 1972, country: "United States" },
  { name: "Amartya Sen", category: "economists", descriptor: "Indian economist", born: 1933, country: "India" },
  { name: "Thomas Piketty", category: "economists", descriptor: "French economist", born: 1971, country: "France" },
  { name: "Joseph Stiglitz", category: "economists", descriptor: "American economist", born: 1943, country: "United States" },
  { name: "Raghuram Rajan", category: "economists", descriptor: "Indian economist, former Reserve Bank Governor", born: 1963, country: "India" },
  { name: "Gita Gopinath", category: "economists", descriptor: "Indian-American economist", born: 1971, country: "United States" },

  // ── Education ────────────────────────────────────────────────────────
  { name: "Wendy Kopp", category: "education", descriptor: "American educator", born: 1967, country: "United States" },
  { name: "Geoffrey Canada", category: "education", descriptor: "American educator", born: 1952, country: "United States" },
  { name: "Linda Darling-Hammond", category: "education", descriptor: "American education researcher and professor", born: 1951, country: "United States" },
  { name: "Angela Duckworth", category: "education", descriptor: "American professor", born: 1970, country: "United States" },
  { name: "Andreas Schleicher", category: "education", descriptor: "German education researcher", born: 1964, country: "Germany" },

  // ── Engineers ────────────────────────────────────────────────────────
  { name: "Burt Rutan", category: "engineers", descriptor: "American aerospace engineer", born: 1943, country: "United States" },
  { name: "Gwynne Shotwell", category: "engineers", descriptor: "American engineer and business executive", born: 1963, country: "United States" },
  { name: "Radia Perlman", category: "engineers", descriptor: "American computer engineer", born: 1951, country: "United States" },
  { name: "Limor Fried", category: "engineers", descriptor: "American electrical engineer", born: 1979, country: "United States" },
  { name: "Marc Raibert", category: "engineers", descriptor: "American engineer and roboticist", born: 1949, country: "United States" },
  { name: "Tony Fadell", category: "engineers", descriptor: "American engineer and inventor", born: 1969, country: "United States" },

  // ── Entrepreneurs & Founders (additional) ────────────────────────────
  { name: "Melanie Perkins", category: "entrepreneurs", descriptor: "Australian entrepreneur, Canva co-founder", born: 1987, country: "Australia" },
  { name: "Whitney Wolfe Herd", category: "entrepreneurs", descriptor: "American entrepreneur, Bumble founder", born: 1989, country: "United States" },

  // ── Environmental & Climate ──────────────────────────────────────────
  { name: "Jane Goodall", category: "environment", descriptor: "British conservationist", born: 1934, country: "United Kingdom" },
  { name: "David Attenborough", category: "environment", descriptor: "British conservationist and broadcaster", born: 1926, country: "United Kingdom" },
  { name: "Vandana Shiva", category: "environment", descriptor: "Indian environmental scientist and activist", born: 1952, country: "India" },
  { name: "Wangari Maathai", category: "environment", descriptor: "Kenyan environmentalist", born: 1940, country: "Kenya" },
  { name: "Christiana Figueres", category: "environment", descriptor: "Costa Rican diplomat and climate policy leader", born: 1956, country: "Costa Rica" },
  { name: "Bill McKibben", category: "environment", descriptor: "American environmentalist and writer", born: 1960, country: "United States" },

  // ── Esports & Gaming ─────────────────────────────────────────────────
  { name: "Lee Sang-hyeok", category: "esports", descriptor: "South Korean esports player, known as Faker", born: 1996, country: "South Korea" },
  { name: "Oleksandr Kostyliev", category: "esports", descriptor: "Ukrainian esports player, known as s1mple", born: 1997, country: "Ukraine" },
  { name: "Johan Sundstein", category: "esports", descriptor: "Danish esports player, known as N0tail", born: 1996, country: "Denmark" },

  // ── Explorers & Adventurers ──────────────────────────────────────────
  { name: "Bear Grylls", category: "explorers", descriptor: "British adventurer", born: 1974, country: "United Kingdom" },
  { name: "Alex Honnold", category: "explorers", descriptor: "American rock climber and adventurer", born: 1985, country: "United States" },
  { name: "Sylvia Earle", category: "explorers", descriptor: "American explorer and oceanographer", born: 1935, country: "United States" },
  { name: "Ranulph Fiennes", category: "explorers", descriptor: "British explorer", born: 1944, country: "United Kingdom" },
  { name: "Nirmal Purja", category: "explorers", descriptor: "Nepali mountaineer and explorer", born: 1983, country: "Nepal" },

  // ── Fashion ──────────────────────────────────────────────────────────
  { name: "Anna Wintour", category: "fashion", descriptor: "British-American fashion editor", born: 1949, country: "United States" },
  { name: "Tom Ford", category: "fashion", descriptor: "American fashion designer", born: 1961, country: "United States" },
  { name: "Stella McCartney", category: "fashion", descriptor: "British fashion designer", born: 1971, country: "United Kingdom" },
  { name: "Donatella Versace", category: "fashion", descriptor: "Italian fashion designer", born: 1955, country: "Italy" },
  { name: "Miuccia Prada", category: "fashion", descriptor: "Italian fashion designer", born: 1949, country: "Italy" },
  { name: "Alexander Wang", category: "fashion", descriptor: "American fashion designer", born: 1983, country: "United States" },

  // ── Finance & Investors ──────────────────────────────────────────────
  { name: "Ray Dalio", category: "finance", descriptor: "American investor", born: 1949, country: "United States" },
  { name: "Cathie Wood", category: "finance", descriptor: "American investor, ARK Invest founder", born: 1955, country: "United States" },
  { name: "Ken Griffin", category: "finance", descriptor: "American investor, Citadel founder", born: 1968, country: "United States" },
  { name: "Christine Lagarde", category: "finance", descriptor: "French central banker, President of the European Central Bank", born: 1956, country: "France" },
  { name: "Janet Yellen", category: "finance", descriptor: "American central banker and economist", born: 1946, country: "United States" },
  { name: "Howard Marks", category: "finance", descriptor: "American investor, Oaktree Capital co-founder", born: 1946, country: "United States" },
  { name: "Abigail Johnson", category: "finance", descriptor: "American chief executive of Fidelity Investments", born: 1961, country: "United States" },

  // ── Journalists & Media ──────────────────────────────────────────────
  { name: "Christiane Amanpour", category: "journalists", descriptor: "British-Iranian journalist", born: 1958, country: "United Kingdom" },
  { name: "Anderson Cooper", category: "journalists", descriptor: "American journalist", born: 1967, country: "United States" },
  { name: "Fareed Zakaria", category: "journalists", descriptor: "Indian-American journalist", born: 1964, country: "United States" },
  { name: "Oprah Winfrey", category: "journalists", descriptor: "American media executive and journalist", born: 1954, country: "United States" },
  { name: "Ezra Klein", category: "journalists", descriptor: "American journalist and columnist", born: 1984, country: "United States" },
  { name: "Ronan Farrow", category: "journalists", descriptor: "American investigative journalist", born: 1987, country: "United States" },

  // ── Lawyers & Legal ──────────────────────────────────────────────────
  { name: "Ruth Bader Ginsburg", category: "lawyers", descriptor: "American judge, Supreme Court Justice", born: 1933, country: "United States" },
  { name: "Sonia Sotomayor", category: "lawyers", descriptor: "American judge, Supreme Court Justice", born: 1954, country: "United States" },
  { name: "David Boies", category: "lawyers", descriptor: "American lawyer", born: 1941, country: "United States" },
  { name: "Gloria Allred", category: "lawyers", descriptor: "American lawyer", born: 1941, country: "United States" },
  { name: "Alan Dershowitz", category: "lawyers", descriptor: "American lawyer and legal scholar", born: 1938, country: "United States" },
  { name: "Ben Crump", category: "lawyers", descriptor: "American lawyer", born: 1969, country: "United States" },

  // ── Military & Defense ───────────────────────────────────────────────
  { name: "David Petraeus", category: "military", descriptor: "American retired military officer, former general", born: 1952, country: "United States" },
  { name: "Mark Milley", category: "military", descriptor: "American retired military officer, former general", born: 1958, country: "United States" },
  { name: "Valery Zaluzhny", category: "military", descriptor: "Ukrainian military officer, former general", born: 1973, country: "Ukraine" },
  { name: "H. R. McMaster", category: "military", descriptor: "American retired military officer, former general", born: 1962, country: "United States" },
  { name: "Stanley McChrystal", category: "military", descriptor: "American retired military officer, former general", born: 1954, country: "United States" },
  { name: "Colin Powell", category: "military", descriptor: "American retired military officer and statesman", born: 1937, country: "United States" },

  // ── Police & Law Enforcement ─────────────────────────────────────────
  { name: "Christopher Wray", category: "police", descriptor: "American police officer", born: 1966, country: "United States" },
  { name: "William Bratton", category: "police", descriptor: "American police officer, former police commissioner", born: 1947, country: "United States" },
  { name: "Cressida Dick", category: "police", descriptor: "British police officer, former police commissioner", born: 1960, country: "United Kingdom" },

  // ── Real Estate ──────────────────────────────────────────────────────
  { name: "Stephen Ross", category: "real-estate", descriptor: "American real estate developer", born: 1940, country: "United States" },
  { name: "Barbara Corcoran", category: "real-estate", descriptor: "American real estate agent and businesswoman", born: 1949, country: "United States" },
  { name: "Grant Cardone", category: "real-estate", descriptor: "American real estate investor", born: 1958, country: "United States" },

  // ── Religious & Spiritual Leaders ────────────────────────────────────
  { name: "Pope Francis", category: "religious", descriptor: "Argentine religious leader, Pope", born: 1936, country: "Vatican City" },
  { name: "Dalai Lama", category: "religious", descriptor: "Tibetan religious leader", born: 1935, country: "India" },
  { name: "Rick Warren", category: "religious", descriptor: "American religious leader and author", born: 1954, country: "United States" },
  { name: "T. D. Jakes", category: "religious", descriptor: "American religious leader and author", born: 1957, country: "United States" },

  // ── Royalty & Public Figures ─────────────────────────────────────────
  { name: "King Charles III", category: "royalty", descriptor: "British monarch", born: 1948, country: "United Kingdom" },
  { name: "Naruhito", category: "royalty", descriptor: "Japanese monarch, Emperor of Japan", born: 1960, country: "Japan" },
  { name: "Felipe VI", category: "royalty", descriptor: "Spanish monarch, King of Spain", born: 1968, country: "Spain" },
  { name: "Prince William", category: "royalty", descriptor: "British noble, Prince of Wales", born: 1982, country: "United Kingdom" },
  { name: "Catherine, Princess of Wales", category: "royalty", descriptor: "British noble, Princess of Wales", born: 1982, country: "United Kingdom" },
  { name: "Albert II, Prince of Monaco", category: "royalty", descriptor: "Monégasque monarch, Prince of Monaco", born: 1958, country: "Monaco" },

  // ── Scientists & Researchers (additional) ────────────────────────────
  { name: "Jennifer Doudna", category: "scientists", descriptor: "American biochemist", born: 1964, country: "United States" },
  { name: "Katalin Karikó", category: "scientists", descriptor: "Hungarian-American biochemist", born: 1955, country: "United States" },
  { name: "Neil deGrasse Tyson", category: "scientists", descriptor: "American astrophysicist and science communicator", born: 1958, country: "United States" },
  { name: "Brian Cox", category: "scientists", descriptor: "British physicist and science communicator", born: 1968, country: "United Kingdom" },
  { name: "Michio Kaku", category: "scientists", descriptor: "American theoretical physicist", born: 1947, country: "United States" },

  // ── Social & Community Leaders ───────────────────────────────────────
  { name: "Scott Harrison", category: "social", descriptor: "American nonprofit leader, charity: water founder", born: 1975, country: "United States" },
  { name: "Jacqueline Novogratz", category: "social", descriptor: "American nonprofit leader, Acumen founder", born: 1961, country: "United States" },
  { name: "Ai-jen Poo", category: "social", descriptor: "American labour organiser and nonprofit leader", born: 1974, country: "United States" },
  { name: "Van Jones", category: "social", descriptor: "American commentator and nonprofit leader", born: 1968, country: "United States" },

  // ── Writers & Authors ────────────────────────────────────────────────
  { name: "Margaret Atwood", category: "writers", descriptor: "Canadian author", born: 1939, country: "Canada" },
  { name: "Salman Rushdie", category: "writers", descriptor: "British-Indian author", born: 1947, country: "United Kingdom" },
  { name: "Chimamanda Ngozi Adichie", category: "writers", descriptor: "Nigerian author", born: 1977, country: "Nigeria" },
  { name: "Haruki Murakami", category: "writers", descriptor: "Japanese author", born: 1949, country: "Japan" },
  { name: "Stephen King", category: "writers", descriptor: "American author", born: 1947, country: "United States" },
  { name: "Colson Whitehead", category: "writers", descriptor: "American author", born: 1969, country: "United States" },
  { name: "Elif Shafak", category: "writers", descriptor: "Turkish-British author", born: 1971, country: "United Kingdom" },
];

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/**
 * `RosterEntry.category` → one occupation phrase that is guaranteed to
 * resolve on the taxonomy, used only when a person's own `descriptor`
 * does not resolve directly (e.g. it names two occupations joined by
 * "and", which the resolver does not attempt to split). This is the
 * same safety net the original six categories always had — every entry
 * added since keeps its own `category` tag and gets the matching hint,
 * so it lands in its intended category even when its descriptor's exact
 * wording does not resolve on its own. Shared by `catalogueProfession`
 * below and `lib/categories.ts`'s `categoriesFor`.
 */
export const CATEGORY_HINT: Record<string, string> = {
  actors: "actor",
  politicians: "politician",
  athletes: "athlete",
  musicians: "musician",
  business: "entrepreneur",
  creators: "content creator",
  academics: "professor",
  activists: "activist",
  "ai-ml": "computer scientist",
  architects: "architect",
  artists: "artist",
  chefs: "chef",
  doctors: "physician",
  economists: "economist",
  education: "educator",
  engineers: "engineer",
  entrepreneurs: "entrepreneur",
  environment: "conservationist",
  esports: "esports player",
  explorers: "explorer",
  fashion: "fashion designer",
  finance: "investor",
  journalists: "journalist",
  lawyers: "lawyer",
  military: "military officer",
  police: "police officer",
  "real-estate": "real estate developer",
  religious: "religious leader",
  royalty: "monarch",
  scientists: "scientist",
  social: "nonprofit leader",
  writers: "author",
};

/**
 * Resolves a roster entry onto the global taxonomy from its neutral
 * `descriptor` (a verified fact this file already carries — e.g. "Indian
 * javelin thrower"). Returns null rather than guessing when the
 * descriptor does not map. `entry.category` is used only as a
 * last-resort hint via {@link CATEGORY_HINT}.
 */
export function catalogueProfession(entry: RosterEntry): {
  label: string;
  sector: string;
  industry: string;
} | null {
  const direct = resolveCatalogueOccupation(entry.descriptor);
  if (direct) {
    return {
      label: direct.label,
      sector: direct.path.sector,
      industry: direct.path.industry,
    };
  }
  const hint = CATEGORY_HINT[entry.category];
  const viaHint = hint ? resolveCatalogueOccupation(hint) : null;
  return viaHint
    ? {
        label: viaHint.label,
        sector: viaHint.path.sector,
        industry: viaHint.path.industry,
      }
    : null;
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
