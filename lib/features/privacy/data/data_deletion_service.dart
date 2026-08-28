/// Erases everything CritiTrack holds about the person using it.
///
/// The privacy policy promises this, so it has to actually work rather
/// than clear the visible parts and leave records behind. The order
/// matters: server records are deleted while the account still exists to
/// authorise it, and the account is deleted last.
///
/// Every step is independent and failures are collected rather than
/// thrown, so one unreachable service cannot leave the rest of the data in
/// place. The caller is told what could not be removed rather than being
/// shown a success that did not happen.
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:crititrack/core/theme/theme_controller.dart';
import 'package:crititrack/features/watchlist/data/watchlist_repository.dart';

/// What actually happened, so the UI can be honest about it.
@immutable
class DeletionResult {
  const DeletionResult({
    required this.localCleared,
    required this.remoteCleared,
    required this.accountDeleted,
    this.problems = const [],
  });

  final bool localCleared;
  final bool remoteCleared;
  final bool accountDeleted;

  /// Human-readable descriptions of anything that could not be removed.
  final List<String> problems;

  /// True only when nothing was left behind anywhere.
  bool get complete =>
      localCleared && remoteCleared && accountDeleted && problems.isEmpty;
}

class DataDeletionService {
  DataDeletionService({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _injectedFirestore = firestore,
      _injectedAuth = auth;

  final FirebaseFirestore? _injectedFirestore;
  final FirebaseAuth? _injectedAuth;

  /// Boxes holding anything about the user. The appearance choice is
  /// included: it is a preference they expressed, and "delete everything"
  /// that quietly keeps one setting is not what was promised.
  static const List<String> _boxes = [
    'search_recents',
    watchlistBoxName,
    settingsBoxName,
  ];

  Future<DeletionResult> deleteEverything() async {
    final problems = <String>[];

    final localCleared = await _clearLocal(problems);
    final remoteCleared = await _clearRemote(problems);
    // Last: deleting the account first would remove the authorisation the
    // server-side deletes above depend on.
    final accountDeleted = await _deleteAccount(problems);

    return DeletionResult(
      localCleared: localCleared,
      remoteCleared: remoteCleared,
      accountDeleted: accountDeleted,
      problems: problems,
    );
  }

  Future<bool> _clearLocal(List<String> problems) async {
    var ok = true;
    for (final name in _boxes) {
      try {
        if (Hive.isBoxOpen(name)) {
          await Hive.box<dynamic>(name).clear();
        }
      } catch (e) {
        ok = false;
        problems.add('Could not clear local $name storage.');
        debugPrint('Failed clearing box $name: $e');
      }
    }
    return ok;
  }

  Future<bool> _clearRemote(List<String> problems) async {
    final db = _firestore;
    final uid = _uid;

    // Nothing was ever written server-side without an account, so there is
    // nothing to fail at here.
    if (db == null || uid == null) return true;

    var ok = true;
    // `usage` holds the rate-limit counters; `watchlists` and
    // `search_history` hold the only per-user content we store.
    for (final collection in ['watchlists', 'search_history', 'usage']) {
      try {
        await db.collection(collection).doc(uid).delete();
      } catch (e) {
        ok = false;
        problems.add('Could not delete your $collection record.');
        debugPrint('Failed deleting $collection/$uid: $e');
      }
    }
    return ok;
  }

  Future<bool> _deleteAccount(List<String> problems) async {
    final auth = _auth;
    final user = auth?.currentUser;
    if (auth == null || user == null) return true;

    try {
      await user.delete();
      return true;
    } on FirebaseAuthException catch (e) {
      // A long-lived session can require a fresh sign-in before deletion.
      // Signing out at least ends the session on this device; the record
      // is reported as remaining rather than glossed over.
      if (e.code == 'requires-recent-login') {
        problems.add(
          'Your anonymous account could not be removed automatically. '
          'Reopen the app and try again.',
        );
      } else {
        problems.add('Your anonymous account could not be removed.');
      }
      debugPrint('Account deletion failed: ${e.code}');
      try {
        await auth.signOut();
      } catch (_) {
        // Already the failure path; nothing further to do.
      }
      return false;
    } catch (e) {
      problems.add('Your anonymous account could not be removed.');
      debugPrint('Account deletion failed: $e');
      return false;
    }
  }

  FirebaseFirestore? get _firestore {
    if (_injectedFirestore != null) return _injectedFirestore;
    try {
      if (Firebase.apps.isEmpty) return null;
      return FirebaseFirestore.instance;
    } catch (_) {
      return null;
    }
  }

  FirebaseAuth? get _auth {
    if (_injectedAuth != null) return _injectedAuth;
    try {
      if (Firebase.apps.isEmpty) return null;
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  String? get _uid {
    try {
      return _auth?.currentUser?.uid;
    } catch (_) {
      return null;
    }
  }
}
