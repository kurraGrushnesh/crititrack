/// Category catalogue — a *labelled mock adapter*.
///
/// The backend has no category or "top figures" endpoint. Rather than
/// rank real people by a metric we would have to invent, this file holds
/// only public facts (see [RosterEntry]). It never feeds a number into
/// the scoring path: opening a profile queries the real API.
///
/// Kept in step with `site/lib/catalog.ts`.
library;

import '../domain/models/figure_category.dart';

const List<FigureCategory> kCategories = [
  FigureCategory(
    slug: 'actors',
    label: 'Actors',
    blurb: 'Film and television performers with a sustained public profile.',
  ),
  FigureCategory(
    slug: 'politicians',
    label: 'Politicians',
    blurb: 'Elected officials and heads of government and party.',
  ),
  FigureCategory(
    slug: 'athletes',
    label: 'Athletes',
    blurb: 'Competitors and champions across major sports.',
  ),
  FigureCategory(
    slug: 'musicians',
    label: 'Musicians',
    blurb: 'Recording artists, songwriters and performers.',
  ),
  FigureCategory(
    slug: 'business',
    label: 'Business Leaders',
    blurb: 'Founders and chief executives of large companies.',
  ),
  FigureCategory(
    slug: 'creators',
    label: 'Creators',
    blurb: 'People known primarily for work published online.',
  ),
];

const List<RosterEntry> kRoster = [
  // Actors
  RosterEntry(name: 'Denzel Washington', category: 'actors', descriptor: 'American film actor and director', born: 1954),
  RosterEntry(name: 'Meryl Streep', category: 'actors', descriptor: 'American film and stage actor', born: 1949),
  RosterEntry(name: 'Tom Hanks', category: 'actors', descriptor: 'American actor and producer', born: 1956),
  RosterEntry(name: 'Cate Blanchett', category: 'actors', descriptor: 'Australian actor and producer', born: 1969),
  RosterEntry(name: 'Shah Rukh Khan', category: 'actors', descriptor: 'Indian film actor and producer', born: 1965),
  RosterEntry(name: 'Zendaya', category: 'actors', descriptor: 'American actor and producer', born: 1996),
  RosterEntry(name: 'Idris Elba', category: 'actors', descriptor: 'British actor and musician', born: 1972),
  RosterEntry(name: 'Florence Pugh', category: 'actors', descriptor: 'British actor', born: 1996),
  RosterEntry(name: 'Ke Huy Quan', category: 'actors', descriptor: 'American actor', born: 1971),
  RosterEntry(name: 'Michelle Yeoh', category: 'actors', descriptor: 'Malaysian actor', born: 1962),
  RosterEntry(name: 'Pedro Pascal', category: 'actors', descriptor: 'Chilean-American actor', born: 1975),
  RosterEntry(name: 'Viola Davis', category: 'actors', descriptor: 'American actor and producer', born: 1965),
  // Politicians
  RosterEntry(name: 'Barack Obama', category: 'politicians', descriptor: '44th President of the United States', born: 1961),
  RosterEntry(name: 'Angela Merkel', category: 'politicians', descriptor: 'Former Chancellor of Germany', born: 1954),
  RosterEntry(name: 'Jacinda Ardern', category: 'politicians', descriptor: 'Former Prime Minister of New Zealand', born: 1980),
  RosterEntry(name: 'Justin Trudeau', category: 'politicians', descriptor: 'Prime Minister of Canada', born: 1971),
  RosterEntry(name: 'Emmanuel Macron', category: 'politicians', descriptor: 'President of France', born: 1977),
  RosterEntry(name: 'Narendra Modi', category: 'politicians', descriptor: 'Prime Minister of India', born: 1950),
  RosterEntry(name: 'Kamala Harris', category: 'politicians', descriptor: 'Vice President of the United States', born: 1964),
  RosterEntry(name: 'Volodymyr Zelenskyy', category: 'politicians', descriptor: 'President of Ukraine', born: 1978),
  RosterEntry(name: 'Rishi Sunak', category: 'politicians', descriptor: 'Former Prime Minister of the United Kingdom', born: 1980),
  RosterEntry(name: 'Lula da Silva', category: 'politicians', descriptor: 'President of Brazil', born: 1945),
  RosterEntry(name: 'Sanna Marin', category: 'politicians', descriptor: 'Former Prime Minister of Finland', born: 1985),
  RosterEntry(name: 'Ursula von der Leyen', category: 'politicians', descriptor: 'President of the European Commission', born: 1958),
  // Athletes
  RosterEntry(name: 'Serena Williams', category: 'athletes', descriptor: 'American tennis champion', born: 1981),
  RosterEntry(name: 'LeBron James', category: 'athletes', descriptor: 'American basketball player', born: 1984),
  RosterEntry(name: 'Lionel Messi', category: 'athletes', descriptor: 'Argentine footballer', born: 1987),
  RosterEntry(name: 'Cristiano Ronaldo', category: 'athletes', descriptor: 'Portuguese footballer', born: 1985),
  RosterEntry(name: 'Simone Biles', category: 'athletes', descriptor: 'American gymnast', born: 1997),
  RosterEntry(name: 'Novak Djokovic', category: 'athletes', descriptor: 'Serbian tennis player', born: 1987),
  RosterEntry(name: 'Usain Bolt', category: 'athletes', descriptor: 'Jamaican sprinter', born: 1986),
  RosterEntry(name: 'Megan Rapinoe', category: 'athletes', descriptor: 'American footballer', born: 1985),
  RosterEntry(name: 'Lewis Hamilton', category: 'athletes', descriptor: 'British racing driver', born: 1985),
  RosterEntry(name: 'Katie Ledecky', category: 'athletes', descriptor: 'American swimmer', born: 1997),
  RosterEntry(name: 'Virat Kohli', category: 'athletes', descriptor: 'Indian cricketer', born: 1988),
  RosterEntry(name: 'Caitlin Clark', category: 'athletes', descriptor: 'American basketball player', born: 2002),
  // Musicians
  RosterEntry(name: 'Beyoncé', category: 'musicians', descriptor: 'American singer and songwriter', born: 1981),
  RosterEntry(name: 'Taylor Swift', category: 'musicians', descriptor: 'American singer and songwriter', born: 1989),
  RosterEntry(name: 'Kendrick Lamar', category: 'musicians', descriptor: 'American rapper', born: 1987),
  RosterEntry(name: 'Adele', category: 'musicians', descriptor: 'British singer and songwriter', born: 1988),
  RosterEntry(name: 'Bad Bunny', category: 'musicians', descriptor: 'Puerto Rican rapper and singer', born: 1994),
  RosterEntry(name: 'Billie Eilish', category: 'musicians', descriptor: 'American singer and songwriter', born: 2001),
  RosterEntry(name: 'The Weeknd', category: 'musicians', descriptor: 'Canadian singer and songwriter', born: 1990),
  RosterEntry(name: 'Dua Lipa', category: 'musicians', descriptor: 'British singer and songwriter', born: 1995),
  RosterEntry(name: 'Bruce Springsteen', category: 'musicians', descriptor: 'American singer and songwriter', born: 1949),
  RosterEntry(name: 'SZA', category: 'musicians', descriptor: 'American singer and songwriter', born: 1989),
  RosterEntry(name: 'Rosalía', category: 'musicians', descriptor: 'Spanish singer and songwriter', born: 1992),
  RosterEntry(name: 'Stevie Wonder', category: 'musicians', descriptor: 'American singer and songwriter', born: 1950),
  // Business Leaders
  RosterEntry(name: 'Satya Nadella', category: 'business', descriptor: 'Chief executive of Microsoft', born: 1967),
  RosterEntry(name: 'Tim Cook', category: 'business', descriptor: 'Chief executive of Apple', born: 1960),
  RosterEntry(name: 'Mary Barra', category: 'business', descriptor: 'Chief executive of General Motors', born: 1961),
  RosterEntry(name: 'Jensen Huang', category: 'business', descriptor: 'Chief executive of Nvidia', born: 1963),
  RosterEntry(name: 'Warren Buffett', category: 'business', descriptor: 'Chair of Berkshire Hathaway', born: 1930),
  RosterEntry(name: 'Sundar Pichai', category: 'business', descriptor: 'Chief executive of Alphabet', born: 1972),
  RosterEntry(name: 'Elon Musk', category: 'business', descriptor: 'Chief executive of Tesla and SpaceX', born: 1971),
  RosterEntry(name: 'Jamie Dimon', category: 'business', descriptor: 'Chief executive of JPMorgan Chase', born: 1956),
  RosterEntry(name: 'Lisa Su', category: 'business', descriptor: 'Chief executive of AMD', born: 1969),
  RosterEntry(name: 'Bob Iger', category: 'business', descriptor: 'Chief executive of The Walt Disney Company', born: 1951),
  RosterEntry(name: 'Reed Hastings', category: 'business', descriptor: 'Co-founder of Netflix', born: 1960),
  RosterEntry(name: 'Brian Chesky', category: 'business', descriptor: 'Chief executive of Airbnb', born: 1981),
  // Creators
  RosterEntry(name: 'MrBeast', category: 'creators', descriptor: 'American online video creator', born: 1998),
  RosterEntry(name: 'Marques Brownlee', category: 'creators', descriptor: 'American technology video creator', born: 1993),
  RosterEntry(name: 'Emma Chamberlain', category: 'creators', descriptor: 'American online personality', born: 2001),
  RosterEntry(name: 'Hank Green', category: 'creators', descriptor: 'American online video creator and author', born: 1980),
  RosterEntry(name: 'Ali Abdaal', category: 'creators', descriptor: 'British productivity video creator', born: 1994),
  RosterEntry(name: 'Michelle Khare', category: 'creators', descriptor: 'American online video creator', born: 1992),
  RosterEntry(name: 'Marina Mogilko', category: 'creators', descriptor: 'Language and entrepreneurship creator', born: 1990),
  RosterEntry(name: 'Dhar Mann', category: 'creators', descriptor: 'American short-video producer', born: 1984),
  RosterEntry(name: 'Physics Girl', category: 'creators', descriptor: 'American science communicator', born: 1991),
  RosterEntry(name: 'Safiya Nygaard', category: 'creators', descriptor: 'American online video creator', born: 1992),
  RosterEntry(name: 'Marina Joyce', category: 'creators', descriptor: 'British online video creator', born: 1995),
  RosterEntry(name: 'Simone Giertz', category: 'creators', descriptor: 'Swedish inventor and video creator', born: 1990),
];

/// A labelled mock adapter over the catalogue. Named so it is obvious at
/// the call site that this is not backend data.
abstract final class CatalogAdapter {
  static List<FigureCategory> categories() => kCategories;

  static FigureCategory? categoryBySlug(String slug) {
    for (final c in kCategories) {
      if (c.slug == slug) return c;
    }
    return null;
  }

  static List<RosterEntry> rosterFor(String slug) =>
      kRoster.where((r) => r.category == slug).toList(growable: false);

  /// Editorial prominence order = the roster's own order.
  static List<RosterEntry> topTen(String slug) =>
      rosterFor(slug).take(10).toList(growable: false);

  static RosterEntry? figureByName(String name) {
    final key = name.trim().toLowerCase();
    for (final r in kRoster) {
      if (r.name.toLowerCase() == key) return r;
    }
    return null;
  }

  static List<RosterEntry> relatedFigures(String name, {int limit = 6}) {
    final self = figureByName(name);
    if (self == null) return const [];
    return kRoster
        .where((r) => r.category == self.category && r.name != self.name)
        .take(limit)
        .toList(growable: false);
  }

  static const List<int> decades = [
    1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010,
  ];
}
