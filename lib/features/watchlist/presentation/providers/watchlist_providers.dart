/// Riverpod wiring for the watchlist.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/features/watchlist/data/watchlist_repository.dart';
import 'package:crititrack/features/watchlist/domain/watched_figure.dart';

final watchlistRepositoryProvider = Provider<WatchlistRepository>(
  (ref) => WatchlistRepository(),
);

/// The current watchlist, most recently added first.
///
/// A [Notifier] rather than a plain provider because the list is mutated
/// from several screens — the dashboard star, the watchlist row's remove,
/// and the cloud merge on start — and every one of them must repaint the
/// others.
final watchlistProvider =
    NotifierProvider<WatchlistController, List<WatchedFigure>>(
      WatchlistController.new,
    );

class WatchlistController extends Notifier<List<WatchedFigure>> {
  WatchlistRepository get _repo => ref.read(watchlistRepositoryProvider);

  @override
  List<WatchedFigure> build() => _repo.all();

  bool isWatched(String slug) => state.any((f) => f.slug == slug);

  /// Adds or removes, returning the new state for that figure so a caller
  /// can report it ("Added to watchlist") without re-reading.
  Future<bool> toggle(WatchedFigure figure) async {
    final added = await _repo.toggle(figure);
    state = _repo.all();
    return added;
  }

  Future<void> remove(String slug) async {
    await _repo.remove(slug);
    state = _repo.all();
  }

  Future<void> clear() async {
    await _repo.clear();
    state = _repo.all();
  }

  /// Pulls in anything starred on another device. Safe to call on start:
  /// it merges rather than overwrites, and does nothing when signed out.
  Future<void> syncFromCloud() async {
    await _repo.mergeFromCloud();
    state = _repo.all();
  }
}
