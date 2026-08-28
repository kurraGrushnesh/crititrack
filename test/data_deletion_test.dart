// The privacy policy promises deletion, so it has to actually clear every
// local store — not just the visible ones.
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:crititrack/core/theme/theme_controller.dart';
import 'package:crititrack/features/privacy/data/data_deletion_service.dart';
import 'package:crititrack/features/watchlist/data/watchlist_repository.dart';

void main() {
  late DataDeletionService service;

  setUp(() async {
    Hive.init(
      './.dart_tool/test_hive_del_${DateTime.now().microsecondsSinceEpoch}',
    );
    await Hive.openBox<dynamic>('search_recents');
    await Hive.openBox<dynamic>(watchlistBoxName);
    await Hive.openBox<dynamic>(settingsBoxName);
    service = DataDeletionService();
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
  });

  Future<void> seed() async {
    await Hive.box<dynamic>(
      'search_recents',
    ).put('recent_queries', ['zendaya']);
    await Hive.box<dynamic>(watchlistBoxName).put('zendaya', {
      'slug': 'zendaya',
      'name': 'Zendaya',
      'addedAt': DateTime(2026).toIso8601String(),
    });
    await Hive.box<dynamic>(settingsBoxName).put('theme_mode', 'dark');
  }

  test(
    'clears every local store, including the appearance preference',
    () async {
      await seed();
      for (final name in [
        'search_recents',
        watchlistBoxName,
        settingsBoxName,
      ]) {
        expect(Hive.box<dynamic>(name).isNotEmpty, isTrue, reason: name);
      }

      final result = await service.deleteEverything();

      expect(result.localCleared, isTrue);
      for (final name in [
        'search_recents',
        watchlistBoxName,
        settingsBoxName,
      ]) {
        expect(
          Hive.box<dynamic>(name).isEmpty,
          isTrue,
          reason:
              '$name must be empty — "delete everything" that quietly '
              'keeps a setting is not what the policy promised',
        );
      }
    },
  );

  test('succeeds with no Firebase, since nothing was ever written', () async {
    await seed();
    final result = await service.deleteEverything();

    // Signed out, there is no server record and no account to remove, so
    // both must report success rather than a spurious failure.
    expect(result.remoteCleared, isTrue);
    expect(result.accountDeleted, isTrue);
    expect(result.problems, isEmpty);
    expect(result.complete, isTrue);
  });

  test('is safe to run twice', () async {
    await seed();
    await service.deleteEverything();
    final second = await service.deleteEverything();
    expect(second.complete, isTrue);
  });

  test('works on already-empty storage', () async {
    final result = await service.deleteEverything();
    expect(result.complete, isTrue);
  });

  group('DeletionResult', () {
    test('is only complete when nothing was left behind', () {
      const all = DeletionResult(
        localCleared: true,
        remoteCleared: true,
        accountDeleted: true,
      );
      expect(all.complete, isTrue);

      const partial = DeletionResult(
        localCleared: true,
        remoteCleared: false,
        accountDeleted: true,
      );
      expect(partial.complete, isFalse);
    });

    test('a reported problem prevents claiming success', () {
      // Showing "deleted" when something survived is exactly the kind of
      // claim the policy must not make.
      const withProblem = DeletionResult(
        localCleared: true,
        remoteCleared: true,
        accountDeleted: true,
        problems: ['Could not delete your usage record.'],
      );
      expect(withProblem.complete, isFalse);
    });
  });
}
