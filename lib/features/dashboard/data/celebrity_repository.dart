/// Celebrity data repository — 100% real API calls, no mock data.
///
/// The app either fetches real data from real APIs or shows a
/// proper error state — nothing in between. No fallback data,
/// no pre-seeded JSON, no hardcoded celebrity names.
library;

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/error/failures.dart';
import 'package:crititrack/core/error/result.dart';

/// Base repository interface. Concrete implementations call real APIs.
class CelebrityRepository {
  /// Fetches celebrity data by the user's exact entered [name].
  Future<Result<Celebrity>> getCelebrity(String name, {String? qid}) async {
    return const Error(ServerFailure(message: 'Repository not initialized.'));
  }

  /// Forces a fresh API fetch, bypassing any cache.
  Future<Result<Celebrity>> forceRefresh(String name) async {
    return const Error(ServerFailure(message: 'Repository not initialized.'));
  }

  /// The last snapshot this repository has on record for [name], without
  /// triggering a fresh fetch — the real "previous state" Change
  /// Detection (`core/utils/changes.dart`) compares against. Null when
  /// there is no prior snapshot (a repository that keeps no history, or
  /// a name never seen before).
  ///
  /// Default implementation returns null; only a repository backed by a
  /// persistent store (see [FirestoreCelebrityRepository]) can answer
  /// this meaningfully.
  Future<Celebrity?> previousSnapshot(String name) async => null;
}
