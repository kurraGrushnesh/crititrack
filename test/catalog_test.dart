// The Dart catalogue is a labelled mock adapter and the twin of
// site/lib/catalog.ts. These tests pin its internal consistency and
// that it carries nothing that could read as a claim about a person.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/data/catalog.dart';
import 'package:crititrack/core/domain/models/figure_category.dart';

void main() {
  group('categories', () {
    test('has the six required categories with unique slugs', () {
      expect(CatalogAdapter.categories(), hasLength(6));
      final slugs = CatalogAdapter.categories().map((c) => c.slug).toSet();
      expect(slugs, hasLength(6));
      for (final s in [
        'actors',
        'politicians',
        'athletes',
        'musicians',
        'business',
        'creators',
      ]) {
        expect(slugs, contains(s));
      }
    });

    test('resolves a slug', () {
      expect(CatalogAdapter.categoryBySlug('athletes')?.label, 'Athletes');
      expect(CatalogAdapter.categoryBySlug('nope'), isNull);
    });
  });

  group('roster', () {
    test('every entry is in a real category with a plausible birth year', () {
      // The original six `CatalogAdapter` categories, plus the newer
      // category tags the web catalogue's expanded taxonomy recognises
      // (site/lib/catalog.ts's CATEGORY_HINT) — Flutter has not ported
      // that taxonomy layer yet, so these roster entries are real and
      // tagged correctly but not yet browsable through CatalogAdapter.
      final legacySlugs =
          CatalogAdapter.categories().map((c) => c.slug).toSet();
      const newerTags = {
        'academics',
        'activists',
        'ai-ml',
        'architects',
        'artists',
        'chefs',
        'doctors',
        'economists',
        'education',
        'engineers',
        'entrepreneurs',
        'environment',
        'esports',
        'explorers',
        'fashion',
        'finance',
        'journalists',
        'lawyers',
        'military',
        'police',
        'real-estate',
        'religious',
        'royalty',
        'scientists',
        'social',
        'writers',
      };
      final knownTags = {...legacySlugs, ...newerTags};
      for (final r in kRoster) {
        expect(knownTags, contains(r.category));
        expect(r.born, greaterThan(1900));
        expect(r.born, lessThan(2015));
        expect(r.descriptor.trim().length, greaterThan(4));
      }
    });

    test('names are unique', () {
      final names = kRoster.map((r) => r.name).toList();
      expect(names.toSet(), hasLength(names.length));
    });

    test('descriptors carry no evaluative language', () {
      final banned = RegExp(
        r'\b(scandal|controversial|disgraced|accused|allege|criminal|corrupt|worst|best)\b',
        caseSensitive: false,
      );
      for (final r in kRoster) {
        expect(banned.hasMatch(r.descriptor), isFalse, reason: r.name);
      }
    });

    test('every category can fill a Top 10', () {
      for (final c in CatalogAdapter.categories()) {
        expect(
          CatalogAdapter.rosterFor(c.slug).length,
          greaterThanOrEqualTo(10),
        );
        expect(CatalogAdapter.topTen(c.slug), hasLength(10));
      }
    });
  });

  group('helpers', () {
    test('figureByName is case-insensitive', () {
      expect(
        CatalogAdapter.figureByName('serena williams')?.category,
        'athletes',
      );
      expect(CatalogAdapter.figureByName('  Beyoncé ')?.category, 'musicians');
    });

    test('relatedFigures stays in-category and excludes the person', () {
      final related = CatalogAdapter.relatedFigures('LeBron James');
      expect(related, isNotEmpty);
      expect(related.every((r) => r.category == 'athletes'), isTrue);
      expect(related.any((r) => r.name == 'LeBron James'), isFalse);
    });

    test('decade buckets a birth year', () {
      expect(
        const RosterEntry(
          name: 'x',
          category: 'actors',
          descriptor: 'test descriptor',
          born: 1987,
        ).decade,
        1980,
      );
    });
  });
}
