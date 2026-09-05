/// Storage for the figures a user is following.
///
/// Local-first: the watchlist lives in Hive and is authoritative on the
/// device, so starring works instantly, offline, and before any sign-in
/// has completed. Firestore is a mirror for cross-device sync, written
/// best-effort — a storage failure must never lose or block a star.
///
/// The document is keyed by the caller's uid, matching the security rule
/// that lets a user read and write only their own.
library;

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:crititrack/features/watchlist/domain/watched_figure.dart';

/// Hive box opened in `main()`.
const String watchlistBoxName = 'watchlist';

class WatchlistRepository {
  WatchlistRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _injectedFirestore = firestore,
      _injectedAuth = auth;

  final FirebaseFirestore? _injectedFirestore;
  final FirebaseAuth? _injectedAuth;

  static const String _collection = 'watchlists';

  Box<dynamic>? get _box =>
      Hive.isBoxOpen(watchlistBoxName) ? Hive.box(watchlistBoxName) : null;

  /// Everything the user follows, most recently added first.
  List<WatchedFigure> all() {
    final box = _box;
    if (box == null) return const [];

    final out = <WatchedFigure>[];
    for (final value in box.values) {
      final map = _asMap(value);
      if (map == null) continue;
      final figure = WatchedFigure.fromMap(map);
      if (figure != null) out.add(figure);
    }
    out.sort((a, b) => b.addedAt.compareTo(a.addedAt));
    return out;
  }

  bool contains(String slug) => _box?.containsKey(slug) ?? false;

  /// Adds a figure. Safe to call repeatedly — re-adding refreshes the
  /// stored display name and image without moving it in the list or
  /// resetting the Watch Intelligence state (seen cursor, preferences)
  /// already recorded against it.
  Future<void> add(WatchedFigure figure) async {
    final box = _box;
    if (box == null) return;

    final existingMap = _asMap(box.get(figure.slug));
    final existingFigure = existingMap == null ? null : WatchedFigure.fromMap(existingMap);

    final toStore =
        existingFigure == null
            ? figure
            : figure.copyWith(
              addedAt: existingFigure.addedAt,
              wikidataId: figure.wikidataId ?? existingFigure.wikidataId,
              lastViewedAt: existingFigure.lastViewedAt,
              lastSeenChangeAt: existingFigure.lastSeenChangeAt,
              notificationPreferences: existingFigure.notificationPreferences,
              filters: existingFigure.filters,
            );

    await box.put(figure.slug, toStore.toMap());
    unawaited(_mirrorToCloud());
  }

  Future<void> remove(String slug) async {
    await _box?.delete(slug);
    unawaited(_mirrorToCloud());
  }

  Future<bool> toggle(WatchedFigure figure) async {
    if (contains(figure.slug)) {
      await remove(figure.slug);
      return false;
    }
    await add(figure);
    return true;
  }

  /// Records that the reader opened this watch's intelligence view.
  Future<void> markViewed(String slug, DateTime at) => _update(slug, (f) => f.copyWith(lastViewedAt: at));

  /// Advances the seen-changes cursor — call only when changes have
  /// actually been reviewed, never merely because a list rendered.
  Future<void> markChangesSeen(String slug, DateTime at) =>
      _update(slug, (f) => f.copyWith(lastSeenChangeAt: at));

  Future<void> updateNotificationPreferences(String slug, WatchNotificationPreferences prefs) =>
      _update(slug, (f) => f.copyWith(notificationPreferences: prefs));

  Future<void> updateFilters(String slug, WatchFilters filters) =>
      _update(slug, (f) => f.copyWith(filters: filters));

  Future<void> _update(String slug, WatchedFigure Function(WatchedFigure) transform) async {
    final box = _box;
    if (box == null) return;
    final existing = WatchedFigure.fromMap(_asMap(box.get(slug)) ?? {});
    if (existing == null) return;
    await box.put(slug, transform(existing).toMap());
    unawaited(_mirrorToCloud());
  }

  Future<void> clear() async {
    await _box?.clear();
    unawaited(_mirrorToCloud());
  }

  /// Pulls the cloud copy down and merges it into the local box.
  ///
  /// Union rather than overwrite: a figure starred offline on this device
  /// and one starred on another must both survive. Ties go to the earlier
  /// `addedAt`, so the list order reflects when the user first followed
  /// someone rather than which device synced last.
  Future<void> mergeFromCloud() async {
    final db = _firestore;
    final uid = _uid;
    final box = _box;
    if (db == null || uid == null || box == null) return;

    try {
      final snap = await db.collection(_collection).doc(uid).get();
      final data = snap.data();
      if (data == null) return;

      final remote = (data['figures'] as List?) ?? const [];
      for (final entry in remote) {
        final map = _asMap(entry);
        if (map == null) continue;
        final figure = WatchedFigure.fromMap(map);
        if (figure == null) continue;

        final local = WatchedFigure.fromMap(_asMap(box.get(figure.slug)) ?? {});
        if (local == null) {
          await box.put(figure.slug, figure.toMap());
        } else if (figure.addedAt.isBefore(local.addedAt)) {
          await box.put(figure.slug, figure.toMap());
        }
      }
    } catch (e) {
      debugPrint('Watchlist cloud merge skipped: $e');
    }
  }

  /// Pushes the local list to the cloud under the current uid.
  ///
  /// Awaited, unlike the fire-and-forget mirror below, because the one
  /// caller is the account upgrade: when signing in moved the session to
  /// a different uid, this is what stops the watchlist looking like it
  /// vanished at the moment the user signed in to sync it.
  Future<void> pushToCloud() => _mirrorToCloud();

  /// Best-effort mirror. Never awaited by callers, never throws outward.
  Future<void> _mirrorToCloud() async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;

    try {
      await db.collection(_collection).doc(uid).set({
        'figures': all().map((f) => f.toMap()).toList(),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Watchlist cloud mirror skipped: $e');
    }
  }

  FirebaseFirestore? get _firestore {
    if (_injectedFirestore != null) return _injectedFirestore;
    try {
      // Reaching Firebase before it is initialised — which is the normal
      // state in a unit test — must yield null rather than throw or block.
      if (Firebase.apps.isEmpty) return null;
      return FirebaseFirestore.instance;
    } catch (_) {
      return null;
    }
  }

  String? get _uid {
    try {
      final auth =
          _injectedAuth ??
          (Firebase.apps.isEmpty ? null : FirebaseAuth.instance);
      return auth?.currentUser?.uid;
    } catch (_) {
      return null;
    }
  }

  /// Hive returns `Map<dynamic, dynamic>`; the models want string keys.
  Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return null;
  }
}
