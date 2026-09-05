// Watchlist: the local-first store, its model, and the home-screen list.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:crititrack/features/watchlist/data/watchlist_repository.dart';
import 'package:crititrack/features/watchlist/domain/watched_figure.dart';
import 'package:crititrack/features/watchlist/presentation/providers/watchlist_providers.dart';

WatchedFigure figure(String slug, {String? name, DateTime? at, double? score}) {
  return WatchedFigure(
    slug: slug,
    name: name ?? slug,
    addedAt: at ?? DateTime(2026, 1, 1),
    lastScore: score,
  );
}

void main() {
  group('WatchedFigure', () {
    test('round-trips through a map', () {
      final f = figure('zendaya', name: 'Zendaya', score: 71.5);
      final back = WatchedFigure.fromMap(f.toMap());
      expect(back, isNotNull);
      expect(back!.slug, 'zendaya');
      expect(back.name, 'Zendaya');
      expect(back.lastScore, 71.5);
      expect(back.addedAt, f.addedAt);
    });

    test('returns null for an entry with no usable slug', () {
      // A corrupted row must be skipped, not crash the list rendering it.
      expect(WatchedFigure.fromMap(<String, dynamic>{}), isNull);
      expect(WatchedFigure.fromMap({'slug': ''}), isNull);
      expect(WatchedFigure.fromMap({'slug': 42}), isNull);
    });

    test('falls back to the slug when the name is missing', () {
      expect(WatchedFigure.fromMap({'slug': 'x'})!.name, 'x');
    });

    test('omits null optional fields rather than storing them', () {
      final map = figure('a').toMap();
      expect(map.containsKey('imageUrl'), isFalse);
      expect(map.containsKey('lastScore'), isFalse);
      expect(map.containsKey('lastViewedAt'), isFalse);
    });

    test('Watch Intelligence fields round-trip through a map', () {
      final f = WatchedFigure(
        slug: 'zendaya',
        name: 'Zendaya',
        addedAt: DateTime(2026, 1, 1),
        wikidataId: 'Q1',
        lastViewedAt: DateTime(2026, 2, 1),
        lastSeenChangeAt: DateTime(2026, 2, 5),
        notificationPreferences: const WatchNotificationPreferences(sentimentChanges: false),
        filters: const WatchFilters(minimumSeverity: WatchMinimumSeverity.major),
      );
      final back = WatchedFigure.fromMap(f.toMap())!;
      expect(back.wikidataId, 'Q1');
      expect(back.lastViewedAt, f.lastViewedAt);
      expect(back.lastSeenChangeAt, f.lastSeenChangeAt);
      expect(back.notificationPreferences.sentimentChanges, isFalse);
      expect(back.notificationPreferences.careerChanges, isTrue); // untouched default
      expect(back.filters.minimumSeverity, WatchMinimumSeverity.major);
    });

    test('a legacy entry with no Watch Intelligence fields still parses, with defaults', () {
      final back = WatchedFigure.fromMap({'slug': 'x', 'name': 'X'})!;
      expect(back.lastViewedAt, isNull);
      expect(back.lastSeenChangeAt, isNull);
      expect(back.notificationPreferences, const WatchNotificationPreferences());
      expect(back.filters, const WatchFilters());
    });
  });

  group('WatchlistRepository', () {
    late WatchlistRepository repo;

    setUp(() async {
      // A fresh in-memory box per test; no Firebase is initialised, so
      // every cloud path must no-op rather than throw.
      Hive.init(
        './.dart_tool/test_hive_${DateTime.now().microsecondsSinceEpoch}',
      );
      await Hive.openBox<dynamic>(watchlistBoxName);
      repo = WatchlistRepository();
    });

    tearDown(() async {
      await Hive.deleteBoxFromDisk(watchlistBoxName);
      await Hive.close();
    });

    test('starts empty', () {
      expect(repo.all(), isEmpty);
      expect(repo.contains('zendaya'), isFalse);
    });

    test('adds and reports membership', () async {
      await repo.add(figure('zendaya', name: 'Zendaya'));
      expect(repo.contains('zendaya'), isTrue);
      expect(repo.all().single.name, 'Zendaya');
    });

    test('works with no Firebase initialised', () async {
      // The cloud mirror is fire-and-forget; a signed-out or offline user
      // must still be able to star instantly.
      await repo.add(figure('a'));
      await repo.remove('a');
      await repo.clear();
      await repo.mergeFromCloud();
      expect(repo.all(), isEmpty);
    });

    test('toggle adds then removes', () async {
      final f = figure('a');
      expect(await repo.toggle(f), isTrue);
      expect(repo.contains('a'), isTrue);
      expect(await repo.toggle(f), isFalse);
      expect(repo.contains('a'), isFalse);
    });

    test(
      're-adding refreshes details but keeps the original added time',
      () async {
        final first = DateTime(2020, 5, 1);
        await repo.add(figure('a', name: 'Old', at: first));
        await repo.add(figure('a', name: 'New', at: DateTime(2026, 1, 1)));

        final stored = repo.all().single;
        expect(stored.name, 'New', reason: 'details should refresh');
        expect(
          stored.addedAt,
          first,
          reason: 'position in the list must not jump',
        );
        expect(repo.all().length, 1, reason: 'must not duplicate');
      },
    );

    test('orders most recently added first', () async {
      await repo.add(figure('old', at: DateTime(2020, 1, 1)));
      await repo.add(figure('new', at: DateTime(2026, 1, 1)));
      expect(repo.all().map((f) => f.slug).toList(), ['new', 'old']);
    });

    test('removing one leaves the rest', () async {
      await repo.add(figure('a'));
      await repo.add(figure('b', at: DateTime(2026, 2, 1)));
      await repo.remove('a');
      expect(repo.all().map((f) => f.slug).toList(), ['b']);
    });

    test('skips corrupted rows instead of failing the whole list', () async {
      await repo.add(figure('good'));
      await Hive.box<dynamic>(watchlistBoxName).put('bad', 'not a map');
      await Hive.box<dynamic>(watchlistBoxName).put('worse', {'no': 'slug'});

      expect(repo.all().map((f) => f.slug).toList(), ['good']);
    });

    test('a globally-discovered person (not in any catalogue) watches exactly the same way', () async {
      // No catalogue lookup happens anywhere in this path — any resolved
      // slug/name pair can be added.
      await repo.add(
        WatchedFigure(
          slug: 'obscure-researcher-not-in-any-catalogue',
          name: 'Obscure Researcher',
          addedAt: DateTime(2026, 1, 1),
          wikidataId: 'Q123456789',
        ),
      );
      expect(repo.contains('obscure-researcher-not-in-any-catalogue'), isTrue);
      expect(repo.all().single.wikidataId, 'Q123456789');
    });

    test('markViewed and markChangesSeen update only the matching figure', () async {
      await repo.add(figure('a'));
      await repo.add(figure('b', at: DateTime(2026, 2, 1)));

      final at = DateTime(2026, 3, 1);
      await repo.markViewed('a', at);
      await repo.markChangesSeen('a', at);

      final a = repo.all().firstWhere((f) => f.slug == 'a');
      final b = repo.all().firstWhere((f) => f.slug == 'b');
      expect(a.lastViewedAt, at);
      expect(a.lastSeenChangeAt, at);
      expect(b.lastViewedAt, isNull);
      expect(b.lastSeenChangeAt, isNull);
    });

    test('marking viewed/seen on an unwatched slug is a safe no-op', () async {
      await repo.markViewed('nonexistent', DateTime.now());
      expect(repo.all(), isEmpty);
    });

    test('updateNotificationPreferences and updateFilters persist for one figure', () async {
      await repo.add(figure('a'));
      await repo.updateNotificationPreferences('a', const WatchNotificationPreferences(newsEvents: false));
      await repo.updateFilters('a', const WatchFilters(minimumConfidence: WatchMinimumConfidence.high));

      final stored = repo.all().single;
      expect(stored.notificationPreferences.newsEvents, isFalse);
      expect(stored.filters.minimumConfidence, WatchMinimumConfidence.high);
    });

    test('re-adding an already-watched figure preserves its seen cursor and preferences', () async {
      await repo.add(figure('a'));
      final at = DateTime(2026, 3, 1);
      await repo.markChangesSeen('a', at);
      await repo.updateNotificationPreferences('a', const WatchNotificationPreferences(careerChanges: false));

      // Re-adding (e.g. the Watch button toggled off then on, or a
      // duplicate add attempt) must not silently reset intelligence state.
      await repo.add(figure('a', name: 'Refreshed Name'));

      final stored = repo.all().single;
      expect(stored.name, 'Refreshed Name');
      expect(stored.lastSeenChangeAt, at);
      expect(stored.notificationPreferences.careerChanges, isFalse);
    });
  });

  group('watchlist controller', () {
    setUp(() async {
      Hive.init(
        './.dart_tool/test_hive_ui_${DateTime.now().microsecondsSinceEpoch}',
      );
      await Hive.openBox<dynamic>(watchlistBoxName);
    });

    tearDown(() async {
      await Hive.deleteBoxFromDisk(watchlistBoxName);
      await Hive.close();
    });

    test('reflects adds and removes', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final controller = container.read(watchlistProvider.notifier);
      expect(container.read(watchlistProvider), isEmpty);

      await controller.toggle(figure('zendaya', name: 'Zendaya'));
      expect(container.read(watchlistProvider).single.name, 'Zendaya');
      expect(controller.isWatched('zendaya'), isTrue);

      await controller.remove('zendaya');
      expect(container.read(watchlistProvider), isEmpty);
    });

    test('clear empties the list', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final controller = container.read(watchlistProvider.notifier);
      await controller.toggle(figure('a'));
      await controller.toggle(figure('b'));
      expect(container.read(watchlistProvider).length, 2);

      await controller.clear();
      expect(container.read(watchlistProvider), isEmpty);
    });
  });
}
