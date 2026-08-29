// F01's first bullet: "Debounced input with autocomplete from tracked
// figures plus a trending list."
//
// The ranking is pure, so it is tested directly. The debounce is a timer
// in the widget; what matters here is that the list it shows is ordered
// by how likely each entry is to be what was meant.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/features/search/domain/search_suggestions.dart';

const watched = ['Taylor Swift', 'Elon Musk', 'Zendaya'];
const recent = ['Taylor Hawkins', 'Serena Williams', 'zendaya'];

List<String> names(List<SearchSuggestion> s) => [for (final x in s) x.name];

void main() {
  test('offers everything known before a character is typed', () {
    // The field is useful immediately, not only once you commit to a
    // prefix.
    final out = suggestionsFor(query: '', watched: watched, recent: recent);
    expect(out, isNotEmpty);
    expect(names(out).first, 'Taylor Swift');
  });

  test('ranks a prefix match above a mere substring match', () {
    // Someone typing "tay" means Taylor.
    final out = suggestionsFor(
      query: 'tay',
      watched: const ['Katy Taylor'],
      recent: const ['Taylor Swift'],
    );
    expect(names(out), ['Taylor Swift', 'Katy Taylor']);
  });

  test('puts a followed figure ahead of a past search', () {
    // Following someone is a stronger signal than having once typed them.
    final out = suggestionsFor(
      query: 'tay',
      watched: const ['Taylor Swift'],
      recent: const ['Taylor Hawkins'],
    );
    expect(names(out), ['Taylor Swift', 'Taylor Hawkins']);
  });

  test('is case-insensitive in both directions', () {
    final out = suggestionsFor(
      query: 'ZEND',
      watched: const ['zendaya'],
      recent: const [],
    );
    expect(names(out), ['zendaya']);
  });

  test('shows a figure once even when watched and recently searched', () {
    // "zendaya" appears in both lists; the watched entry is the one kept.
    final out = suggestionsFor(
      query: 'zen',
      watched: watched,
      recent: recent,
    );
    expect(names(out), ['Zendaya']);
    expect(out.single.kind, SuggestionKind.watched);
  });

  test('does not offer back exactly what was typed', () {
    // A row that does nothing.
    final out = suggestionsFor(
      query: 'Taylor Swift',
      watched: const ['Taylor Swift'],
      recent: const [],
    );
    expect(out, isEmpty);
  });

  test('still offers longer names that start with the full query', () {
    final out = suggestionsFor(
      query: 'Taylor',
      watched: const ['Taylor Swift', 'Taylor'],
      recent: const [],
    );
    expect(names(out), ['Taylor Swift']);
  });

  test('respects the limit', () {
    final many = List.generate(20, (i) => 'Person $i');
    expect(
      suggestionsFor(query: '', watched: many, recent: const []).length,
      6,
    );
    expect(
      suggestionsFor(
        query: '',
        watched: many,
        recent: const [],
        limit: 3,
      ).length,
      3,
    );
  });

  test('ignores blank entries rather than rendering empty rows', () {
    final out = suggestionsFor(
      query: '',
      watched: const ['', '   ', 'Real Name'],
      recent: const [],
    );
    expect(names(out), ['Real Name']);
  });

  test('trims stored names', () {
    final out = suggestionsFor(
      query: 'real',
      watched: const ['  Real Name  '],
      recent: const [],
    );
    expect(names(out), ['Real Name']);
  });

  test('returns nothing when nothing matches', () {
    final out = suggestionsFor(
      query: 'qqqq',
      watched: watched,
      recent: recent,
    );
    expect(out, isEmpty);
  });

  test('survives empty inputs', () {
    expect(
      suggestionsFor(query: 'x', watched: const [], recent: const []),
      isEmpty,
    );
    expect(
      suggestionsFor(query: '', watched: const [], recent: const []),
      isEmpty,
    );
  });
}
