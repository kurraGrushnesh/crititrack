/// Local storage for alert preferences and this install's identity.
///
/// Local-first for the same reason the watchlist is: toggling an alert
/// must take effect instantly and work offline. The server copy in
/// `devices/{installId}` is a projection of this, pushed best-effort.
library;

import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';

import 'package:crititrack/features/alerts/domain/alert_preferences.dart';

/// Hive box opened in `main()`.
const String alertPrefsBoxName = 'alert_prefs';

const String _prefsKey = 'preferences';
const String _installKey = 'installId';

class AlertPreferencesStore {
  Box<dynamic>? get _box =>
      Hive.isBoxOpen(alertPrefsBoxName) ? Hive.box(alertPrefsBoxName) : null;

  AlertPreferences read() {
    final raw = _box?.get(_prefsKey);
    if (raw is Map) return AlertPreferences.fromMap(raw);
    return const AlertPreferences();
  }

  Future<void> write(AlertPreferences prefs) async {
    await _box?.put(_prefsKey, prefs.toMap());
  }

  /// A stable identifier for this installation.
  ///
  /// The device document is keyed on this rather than on the FCM token.
  /// Tokens rotate — on reinstall, on restore to a new phone, and
  /// periodically for no visible reason — and keying on one would leave a
  /// dead row behind on every rotation, which the server would then read
  /// and filter out on every future alert. Keying on the install makes a
  /// rotation an update to a field.
  ///
  /// Deliberately not a hardware id: those are restricted on modern
  /// Android, and a random value that dies with the app's data is exactly
  /// the right lifetime for a push registration.
  String installId() {
    final box = _box;
    if (box == null) return '';

    final existing = box.get(_installKey);
    if (existing is String && existing.isNotEmpty) return existing;

    final fresh = const Uuid().v4();
    box.put(_installKey, fresh);
    return fresh;
  }
}
