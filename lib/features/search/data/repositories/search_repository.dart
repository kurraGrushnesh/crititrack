/// Repository for managing user search history (mock-safe version).
///
/// Uses Hive for local storage only. Firestore sync and favorites
/// are stubbed out in mock mode.
library;

import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

class SearchRepository {
  SearchRepository();

  static const String _hiveBoxName = 'search_recents';
  static const String _hiveKey = 'recent_queries';
  static const int _maxRecents = 20;

  // ── Local (Hive) Operations ───────────────────────────────────

  /// Returns the list of recent search queries from Hive local cache.
  ///
  /// The box is deliberately untyped and the contents are converted by
  /// hand. It used to be a `Box<List<String>>`, and Hive reads a stored
  /// list back as `List<dynamic>` — so the implicit cast threw on every
  /// read after a restart, the `catch` below swallowed it, and the
  /// recents silently never appeared. They were being written correctly
  /// the whole time.
  List<String> getRecentSearches() {
    try {
      final raw = _box?.get(_hiveKey);
      if (raw is! List) return [];
      return [
        for (final entry in raw)
          if (entry is String && entry.trim().isNotEmpty) entry,
      ];
    } catch (e) {
      // Logged rather than silent. A bare `catch (_)` here is what hid
      // the type error for as long as it existed.
      debugPrint('Could not read recent searches: $e');
      return [];
    }
  }

  Box<dynamic>? get _box =>
      Hive.isBoxOpen(_hiveBoxName) ? Hive.box<dynamic>(_hiveBoxName) : null;

  /// Adds a search query to the front of the recents list.
  Future<void> addSearch(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    try {
      final recents = getRecentSearches();

      // Remove duplicate if it already exists
      recents.remove(trimmed);

      // Prepend new search
      recents.insert(0, trimmed);

      // Cap at max recents
      if (recents.length > _maxRecents) {
        recents.removeRange(_maxRecents, recents.length);
      }

      await _box?.put(_hiveKey, recents);
    } catch (e) {
      debugPrint('Could not save a recent search: $e');
    }
  }

  /// Removes a specific query from the recents list.
  Future<void> removeSearch(String query) async {
    try {
      final recents = getRecentSearches();
      recents.remove(query);
      await _box?.put(_hiveKey, recents);
    } catch (e) {
      debugPrint('Recent search update failed: $e');
    }
  }

  /// Clears all recent searches.
  Future<void> clearSearches() async {
    try {
      await _box?.put(_hiveKey, <String>[]);
    } catch (e) {
      debugPrint('Recent search update failed: $e');
    }
  }

  // ── Favorites (stubbed for mock mode) ─────────────────────────

  /// Returns favorited celebrity slugs.
  /// In mock mode, returns empty. In real mode, reads from Firestore.
  Future<List<String>> getFavorites() async => [];

  /// Toggles a celebrity slug in/out of the favorites list.
  Future<bool> toggleFavorite(String celebrityName) async => false;

  /// Returns how many searches the user has made.
  int get searchCount => getRecentSearches().length;
}
