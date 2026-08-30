// Recent searches, across a restart.
//
// They were written correctly and never read back. The box was a
// `Box<List<String>>`, Hive returns a stored list as `List<dynamic>`, and
// the implicit cast threw on every read after a restart — swallowed by a
// bare `catch (_)`, so the section simply never appeared and the search
// suggestions had nothing to draw on.
//
// The reopen in these tests is the point: reading back within one session
// can hand you the original in-memory list and pass regardless.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:crititrack/features/search/data/repositories/search_repository.dart';

late Directory tempDir;

void main() {
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('crititrack_recents');
    Hive.init(tempDir.path);
    await Hive.openBox<dynamic>('search_recents');
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    await Hive.close();
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  Future<void> restart() async {
    await Hive.close();
    Hive.init(tempDir.path);
    await Hive.openBox<dynamic>('search_recents');
  }

  test('a search survives a restart', () async {
    await SearchRepository().addSearch('Zendaya');
    await restart();

    expect(SearchRepository().getRecentSearches(), ['Zendaya']);
  });

  test('several searches come back newest first', () async {
    final repo = SearchRepository();
    await repo.addSearch('First');
    await repo.addSearch('Second');
    await repo.addSearch('Third');
    await restart();

    expect(SearchRepository().getRecentSearches(), [
      'Third',
      'Second',
      'First',
    ]);
  });

  test(
    're-searching a name moves it to the front rather than duplicating',
    () async {
      final repo = SearchRepository();
      await repo.addSearch('Zendaya');
      await repo.addSearch('Elon Musk');
      await repo.addSearch('Zendaya');
      await restart();

      expect(SearchRepository().getRecentSearches(), ['Zendaya', 'Elon Musk']);
    },
  );

  test(
    'clearing empties the list and the emptiness survives a restart',
    () async {
      final repo = SearchRepository();
      await repo.addSearch('Zendaya');
      await repo.clearSearches();
      await restart();

      expect(SearchRepository().getRecentSearches(), isEmpty);
    },
  );

  test('removing one leaves the rest', () async {
    final repo = SearchRepository();
    await repo.addSearch('Keep me');
    await repo.addSearch('Drop me');
    await repo.removeSearch('Drop me');
    await restart();

    expect(SearchRepository().getRecentSearches(), ['Keep me']);
  });

  test('blank queries are not recorded', () async {
    final repo = SearchRepository();
    await repo.addSearch('   ');
    await repo.addSearch('');
    await restart();

    expect(SearchRepository().getRecentSearches(), isEmpty);
  });

  test('the list is capped', () async {
    final repo = SearchRepository();
    for (var i = 0; i < 25; i++) {
      await repo.addSearch('Person $i');
    }
    await restart();

    final recents = SearchRepository().getRecentSearches();
    expect(recents.length, 20);
    expect(recents.first, 'Person 24');
  });

  test(
    'a corrupt stored value degrades to empty rather than throwing',
    () async {
      // The box is untyped, so anything could be in there.
      await Hive.box<dynamic>(
        'search_recents',
      ).put('recent_queries', 'not a list');
      expect(SearchRepository().getRecentSearches(), isEmpty);

      await Hive.box<dynamic>(
        'search_recents',
      ).put('recent_queries', [1, null, 'ok']);
      expect(SearchRepository().getRecentSearches(), ['ok']);
    },
  );
}
