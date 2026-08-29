/// Riverpod wiring for spike alerts.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/features/alerts/data/alert_preferences_store.dart';
import 'package:crititrack/features/alerts/data/device_registrar.dart';
import 'package:crititrack/features/alerts/data/push_service.dart';
import 'package:crititrack/features/alerts/domain/alert_preferences.dart';
import 'package:crititrack/features/watchlist/presentation/providers/watchlist_providers.dart';

final alertPreferencesStoreProvider = Provider<AlertPreferencesStore>(
  (ref) => AlertPreferencesStore(),
);

final deviceRegistrarProvider = Provider<DeviceRegistrar>(
  (ref) => DeviceRegistrar(),
);

final pushServiceProvider = Provider<PushService>((ref) => PushService());

/// Whether the OS currently permits notifications.
///
/// Read rather than assumed: permission can be revoked in system settings
/// at any time, and a settings screen that claims alerts are on when the
/// OS is dropping them is worse than one that says nothing.
final notificationPermissionProvider = FutureProvider<bool>(
  (ref) => ref.read(pushServiceProvider).hasPermission(),
);

final alertPreferencesProvider =
    NotifierProvider<AlertPreferencesController, AlertPreferences>(
      AlertPreferencesController.new,
    );

class AlertPreferencesController extends Notifier<AlertPreferences> {
  AlertPreferencesStore get _store => ref.read(alertPreferencesStoreProvider);
  DeviceRegistrar get _registrar => ref.read(deviceRegistrarProvider);
  PushService get _push => ref.read(pushServiceProvider);

  @override
  AlertPreferences build() {
    // Starring a figure changes which alerts this device should receive,
    // so the registration has to follow the watchlist rather than only
    // being written when the settings screen is opened.
    ref.listen(watchlistProvider, (_, __) => unawaited(syncRegistration()));
    return _store.read();
  }

  Future<void> setEnabled(bool value) async {
    if (value && !await _push.requestPermission()) {
      // Permission refused: leave the preference off rather than showing
      // a switch that is on while the OS discards every message.
      ref.invalidate(notificationPermissionProvider);
      return;
    }

    await _update(state.copyWith(enabled: value));
    ref.invalidate(notificationPermissionProvider);
  }

  Future<void> toggleMute(String slug) => _update(state.toggleMute(slug));

  Future<void> setQuietHours({bool? enabled, int? startMin, int? endMin}) =>
      _update(
        state.copyWith(
          quietEnabled: enabled,
          quietStartMin: startMin,
          quietEndMin: endMin,
        ),
      );

  Future<void> _update(AlertPreferences next) async {
    state = next;
    await _store.write(next);
    await syncRegistration();
  }

  /// Pushes the current preferences to the server.
  ///
  /// Safe to call often and from anywhere: it is idempotent, it never
  /// throws, and [AlertPreferences.slugsForAlerts] sorts its output so an
  /// unchanged set does not rewrite the document.
  Future<void> syncRegistration() async {
    final installId = _store.installId();
    if (installId.isEmpty) return;

    // Alerts off means removing the row outright, not registering an
    // empty one — a device that wants nothing should not be read on
    // every future alert, and should not leave a token on the server.
    if (!state.enabled) {
      await _registrar.unregister(installId);
      return;
    }

    final slugs = state.slugsForAlerts(
      ref.read(watchlistProvider).map((f) => f.slug),
    );

    // Nothing to alert about yet, so the same reasoning applies.
    if (slugs.isEmpty) {
      await _registrar.unregister(installId);
      return;
    }

    // Asked here, not at launch. A notification prompt shown before the
    // user has followed anyone has no context to justify it, and a
    // denial is close to permanent on both platforms — so the first star
    // is the moment, because that is when there is finally something to
    // be told about.
    if (!await _push.hasPermission() && !await _push.requestPermission()) {
      return;
    }

    final token = await _push.token();
    if (token == null || token.isEmpty) return;

    await _registrar.register(
      installId: installId,
      token: token,
      prefs: state,
      slugs: slugs,
    );
  }

  /// Removes this device's registration. Used by the delete-my-data flow.
  Future<void> forgetDevice() => _registrar.unregister(_store.installId());
}
