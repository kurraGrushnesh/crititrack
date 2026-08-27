/// Repository for managing user search history (mock-safe version).
///
/// Uses Hive for local storage only. Firestore sync and favorites
/// are stubbed out in mock mode.
library;

import 'package:hive_flutter/hive_flutter.dart';

class SearchRepository {
  SearchRepository();

  static const String _hiveBoxName = 'search_recents';
  static const String _hiveKey = 'recent_queries';
  static const int _maxRecents = 20;

  // ── Local (Hive) Operations ───────────────────────────────────

  /// Returns the list of recent search queries from Hive local cache.
  List<String> getRecentSearches() {
    try {
      final box = Hive.box<List<String>>(_hiveBoxName);
      final recents = box.get(_hiveKey);
      if (recents == null) return [];
      return List<String>.from(recents);
    } catch (_) {
      return [];
    }
  }

  /// Adds a search query to the front of the recents list.
  Future<void> addSearch(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    try {
      final box = Hive.box<List<String>>(_hiveBoxName);
      final recents = List<String>.from(box.get(_hiveKey) ?? []);

      // Remove duplicate if it already exists
      recents.remove(trimmed);

      // Prepend new search
      recents.insert(0, trimmed);

      // Cap at max recents
      if (recents.length > _maxRecents) {
        recents.removeRange(_maxRecents, recents.length);
      }

      await box.put(_hiveKey, recents);
    } catch (_) {
      // Hive failures should never block the user
    }
  }

  /// Removes a specific query from the recents list.
  Future<void> removeSearch(String query) async {
    try {
      final box = Hive.box<List<String>>(_hiveBoxName);
      final recents = List<String>.from(box.get(_hiveKey) ?? []);
      recents.remove(query);
      await box.put(_hiveKey, recents);
    } catch (_) {
      // Fail silently
    }
  }

  /// Clears all recent searches.
  Future<void> clearSearches() async {
    try {
      final box = Hive.box<List<String>>(_hiveBoxName);
      await box.put(_hiveKey, <String>[]);
    } catch (_) {
      // Fail silently
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
