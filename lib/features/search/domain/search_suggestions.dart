/// Suggestions offered under the search field.
///
/// Drawn from two things the device already knows: the figures the user
/// follows, and what they have searched before. Both are local, so a
/// suggestion costs nothing and works offline.
///
/// There is deliberately no "trending" list. The feature specification
/// asks for one, and producing it honestly needs a backend endpoint
/// ranking what people are actually looking up — which does not exist.
/// A hard-coded list of famous names dressed as "trending" would be a
/// claim about other users' behaviour that nothing measured.
library;

import 'package:equatable/equatable.dart';

enum SuggestionKind {
  /// A figure on the watchlist.
  watched,

  /// A previous search on this device.
  recent,
}

class SearchSuggestion extends Equatable {
  const SearchSuggestion({required this.name, required this.kind});

  final String name;
  final SuggestionKind kind;

  @override
  List<Object?> get props => [name.toLowerCase(), kind];
}

/// Ranks suggestions for [query].
///
/// Ordering, strongest first:
///   1. Names that *start* with the query. Someone typing "tay" means
///      Taylor, not "Fifty Shades of Tay".
///   2. Names that merely contain it.
///
/// Within each tier, watched figures come before past searches: following
/// someone is a stronger signal of intent than having once typed them.
///
/// An empty query returns the same list unfiltered, so the field is
/// useful before a single character is typed.
///
/// Deduplicated case-insensitively, because a figure who is both watched
/// and recently searched is one suggestion, not two — and the watched
/// entry is the one kept.
List<SearchSuggestion> suggestionsFor({
  required String query,
  required Iterable<String> watched,
  required Iterable<String> recent,
  int limit = 6,
}) {
  final needle = query.trim().toLowerCase();

  final candidates = <SearchSuggestion>[
    for (final name in watched)
      if (name.trim().isNotEmpty)
        SearchSuggestion(name: name.trim(), kind: SuggestionKind.watched),
    for (final name in recent)
      if (name.trim().isNotEmpty)
        SearchSuggestion(name: name.trim(), kind: SuggestionKind.recent),
  ];

  final seen = <String>{};
  final prefix = <SearchSuggestion>[];
  final contains = <SearchSuggestion>[];

  for (final candidate in candidates) {
    final lower = candidate.name.toLowerCase();
    if (!seen.add(lower)) continue;

    if (needle.isEmpty || lower.startsWith(needle)) {
      prefix.add(candidate);
    } else if (lower.contains(needle)) {
      contains.add(candidate);
    }
  }

  // Exactly what was typed is not a suggestion — offering it back is a
  // row that does nothing.
  final ranked = [...prefix, ...contains]
      .where((s) => s.name.toLowerCase() != needle)
      .toList();

  return ranked.length > limit ? ranked.sublist(0, limit) : ranked;
}
