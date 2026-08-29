/// The device half of spike alerts: permission, token, and what happens
/// when a notification arrives or is tapped.
///
/// Deliberately thin. It owns no policy — which figures produce alerts
/// and when the user may be disturbed are decided on the server, because
/// only the server can decide them *before* the phone makes a noise. What
/// is left here is plumbing, and plumbing is what breaks silently, so
/// every path logs.
library;

import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// A tapped or received alert, reduced to what the app acts on.
///
/// Built from the `data` block rather than `notification`, because data
/// survives every delivery path identically — a notification block is
/// consumed by the system tray when the app is backgrounded and is not
/// always handed back intact.
@immutable
class AlertMessage {
  const AlertMessage({
    required this.slug,
    required this.title,
    required this.body,
  });

  final String slug;
  final String title;
  final String body;

  /// Returns null for anything that is not a spike alert we can act on,
  /// so an unrecognised or malformed message is ignored rather than
  /// navigating somewhere meaningless.
  static AlertMessage? from(RemoteMessage? message) {
    if (message == null) return null;

    final data = message.data;
    if (data['kind'] != 'spike') return null;

    final slug = data['slug'];
    if (slug is! String || slug.isEmpty) return null;

    final notification = message.notification;
    return AlertMessage(
      slug: slug,
      title: notification?.title ?? 'Sentiment moved sharply',
      body: notification?.body ?? '',
    );
  }
}

/// Handles a message delivered while the app is in the background or
/// terminated.
///
/// Must be a top-level function annotated for the AOT entry point, since
/// it runs in a separate isolate that does not share any of the app's
/// state. It does nothing but return: the payload carries a `notification`
/// block, so the system tray has already displayed it, and the isolate
/// has no UI to update. It exists because registering a handler is what
/// makes Flutter wake for the message at all.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Intentionally empty. See the doc comment above before adding to it —
  // work done here runs without the app, with no navigator and no
  // providers.
}

class PushService {
  PushService({FirebaseMessaging? messaging}) : _injected = messaging;

  final FirebaseMessaging? _injected;

  StreamSubscription<RemoteMessage>? _onMessage;
  StreamSubscription<RemoteMessage>? _onOpened;
  StreamSubscription<String>? _onTokenRefresh;

  FirebaseMessaging? get _fm {
    if (_injected != null) return _injected;
    if (Firebase.apps.isEmpty) return null;
    return FirebaseMessaging.instance;
  }

  /// Whether the user has granted notification permission.
  ///
  /// On Android 13+ this shows the system POST_NOTIFICATIONS prompt; on
  /// older Android it is granted without a prompt. Provisional
  /// authorisation counts as granted — on iOS it means notifications are
  /// delivered quietly, which is a preference, not a refusal.
  Future<bool> requestPermission() async {
    final fm = _fm;
    if (fm == null) return false;

    try {
      final settings = await fm.requestPermission();
      final status = settings.authorizationStatus;
      return status == AuthorizationStatus.authorized ||
          status == AuthorizationStatus.provisional;
    } catch (e) {
      debugPrint('Notification permission request failed: $e');
      return false;
    }
  }

  Future<bool> hasPermission() async {
    final fm = _fm;
    if (fm == null) return false;

    try {
      final settings = await fm.getNotificationSettings();
      final status = settings.authorizationStatus;
      return status == AuthorizationStatus.authorized ||
          status == AuthorizationStatus.provisional;
    } catch (e) {
      debugPrint('Could not read notification settings: $e');
      return false;
    }
  }

  Future<String?> token() async {
    final fm = _fm;
    if (fm == null) return null;

    try {
      return await fm.getToken();
    } catch (e) {
      // Commonly a device with no Play Services, which is not an error
      // worth surfacing — the rest of the app works without alerts.
      debugPrint('Could not obtain FCM token: $e');
      return null;
    }
  }

  /// Wires up the three delivery paths.
  ///
  /// [onOpened] fires when the user taps a notification, from either the
  /// background or a cold start. [onForeground] fires for a message that
  /// arrives while the app is visible — the system tray does not display
  /// those, and a system notification would be the wrong affordance for
  /// something the user is already looking at, so the app shows its own
  /// banner instead.
  Future<void> start({
    required void Function(AlertMessage) onOpened,
    required void Function(AlertMessage) onForeground,
    required void Function(String) onToken,
  }) async {
    final fm = _fm;
    if (fm == null) return;

    await stop();

    _onMessage = FirebaseMessaging.onMessage.listen((m) {
      final alert = AlertMessage.from(m);
      if (alert != null) onForeground(alert);
    });

    _onOpened = FirebaseMessaging.onMessageOpenedApp.listen((m) {
      final alert = AlertMessage.from(m);
      if (alert != null) onOpened(alert);
    });

    _onTokenRefresh = fm.onTokenRefresh.listen(onToken);

    // A tap that launched the app from terminated is not delivered to
    // onMessageOpenedApp; it is waiting here instead. Missing this is why
    // "the notification opens the app but lands on the home screen".
    try {
      final initial = AlertMessage.from(await fm.getInitialMessage());
      if (initial != null) onOpened(initial);
    } catch (e) {
      debugPrint('Could not read the launching message: $e');
    }
  }

  Future<void> stop() async {
    await _onMessage?.cancel();
    await _onOpened?.cancel();
    await _onTokenRefresh?.cancel();
    _onMessage = null;
    _onOpened = null;
    _onTokenRefresh = null;
  }
}
