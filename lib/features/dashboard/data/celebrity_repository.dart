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
}
