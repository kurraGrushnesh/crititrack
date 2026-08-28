/// Supplies the credentials the backend requires on every request.
///
/// The API is authenticated (a Firebase ID token) and attested (an App
/// Check token) so that only real installs of this app can spend our API
/// budget — see SEC-02.
///
/// Both lookups degrade to null rather than throwing. A build running
/// against the local Functions emulator needs neither, and a transient
/// Firebase problem should surface as a normal request failure with a
/// typed error, not as an exception during header construction.
library;

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class ApiCredentials {
  const ApiCredentials();

  /// Headers to attach to a backend call. Empty when Firebase is not
  /// initialised, which is the expected state in unit tests.
  Future<Map<String, String>> headers() async {
    if (Firebase.apps.isEmpty) return const {};

    final results = await Future.wait([_idToken(), _appCheckToken()]);
    final idToken = results[0];
    final appCheckToken = results[1];

    return {
      if (idToken != null) 'Authorization': 'Bearer $idToken',
      if (appCheckToken != null) 'X-Firebase-AppCheck': appCheckToken,
    };
  }

  /// Signs in anonymously when there is no current user, so a first-time
  /// visitor is authenticated without being asked for anything.
  Future<String?> _idToken() async {
    try {
      final auth = FirebaseAuth.instance;
      final user = auth.currentUser ?? (await auth.signInAnonymously()).user;
      return await user?.getIdToken();
    } catch (e) {
      // Most commonly: the Anonymous provider is not enabled in the
      // Firebase console. The request proceeds without a token and the
      // backend answers 401, which the UI renders as a typed failure.
      debugPrint('No ID token available ($e)');
      return null;
    }
  }

  Future<String?> _appCheckToken() async {
    try {
      return await FirebaseAppCheck.instance.getToken();
    } catch (e) {
      debugPrint('No App Check token available ($e)');
      return null;
    }
  }
}
