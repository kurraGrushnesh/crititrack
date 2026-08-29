/// Publishes this device's push registration to Firestore.
///
/// The server reads these rows in `readDevicesForSlug` and filters them
/// in `selectRecipients` (functions/lib/push.js). Everything the user can
/// change — which figures they want alerts for, and when they do not want
/// to be disturbed — is enforced there, before a message is sent, rather
/// than on arrival.
///
/// Written best-effort. A registration failure must never block a star or
/// a settings toggle: the local preference is authoritative, and the next
/// launch re-registers.
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

import 'package:crititrack/features/alerts/domain/alert_preferences.dart';

class DeviceRegistrar {
  DeviceRegistrar({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _injectedFirestore = firestore,
      _injectedAuth = auth;

  final FirebaseFirestore? _injectedFirestore;
  final FirebaseAuth? _injectedAuth;

  static const String _collection = 'devices';

  FirebaseFirestore? get _db {
    if (_injectedFirestore != null) return _injectedFirestore;
    if (Firebase.apps.isEmpty) return null;
    return FirebaseFirestore.instance;
  }

  String? get _uid {
    if (_injectedAuth != null) return _injectedAuth.currentUser?.uid;
    if (Firebase.apps.isEmpty) return null;
    return FirebaseAuth.instance.currentUser?.uid;
  }

  /// Writes (or refreshes) this install's row.
  ///
  /// The UTC offset is re-read on every call, which is what bounds the
  /// daylight-saving staleness the server comments on: the window can be
  /// wrong only between a clock change and the next app launch.
  Future<void> register({
    required String installId,
    required String token,
    required AlertPreferences prefs,
    required List<String> slugs,
  }) async {
    final db = _db;
    final uid = _uid;
    if (db == null || uid == null || installId.isEmpty || token.isEmpty) {
      return;
    }

    try {
      await db.collection(_collection).doc(installId).set({
        ...prefs.toDeviceFields(
          slugs: slugs,
          utcOffsetMinutes: DateTime.now().timeZoneOffset.inMinutes,
        ),
        'token': token,
        // The security rule requires this to match the caller, so a
        // device row can only ever be written by its own owner.
        'uid': uid,
        'platform': defaultTargetPlatform.name,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Device registration failed: $e');
    }
  }

  /// Removes this install's row.
  ///
  /// Called when alerts are switched off and by the delete-my-data flow.
  /// Leaving the row and clearing its slugs would also stop messages, but
  /// it would leave a token behind on a server the user has just asked to
  /// forget them.
  Future<void> unregister(String installId) async {
    final db = _db;
    if (db == null || installId.isEmpty) return;

    try {
      await db.collection(_collection).doc(installId).delete();
    } catch (e) {
      debugPrint('Device unregistration failed: $e');
    }
  }
}
