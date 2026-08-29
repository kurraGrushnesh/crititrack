/// Upgrading an anonymous session to a Google account.
///
/// The app never asks for an email to be usable — anonymous sign-in
/// happens on first launch and everything works from there. This is the
/// optional step that makes a watchlist follow someone to a second
/// device.
///
/// See [AccountUpgrade] for why linking is attempted before signing in.
library;

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

import 'package:crititrack/core/constants/api_config.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'package:crititrack/features/account/domain/account_upgrade.dart';

class AccountService {
  AccountService({FirebaseAuth? auth, GoogleSignIn? googleSignIn})
    : _injectedAuth = auth,
      _injectedGoogle = googleSignIn;

  final FirebaseAuth? _injectedAuth;
  final GoogleSignIn? _injectedGoogle;

  FirebaseAuth? get _auth {
    if (_injectedAuth != null) return _injectedAuth;
    if (Firebase.apps.isEmpty) return null;
    return FirebaseAuth.instance;
  }

  GoogleSignIn get _google =>
      _injectedGoogle ??
      GoogleSignIn(
        clientId:
            ApiConfig.googleClientId.isEmpty ? null : ApiConfig.googleClientId,
      );

  /// Whether signing in can work at all in this build.
  ///
  /// On the web the plugin needs an OAuth client id, and without one
  /// every attempt throws. Offering a button that always fails is the
  /// same mistake as an error message blaming the network for a
  /// backend that was never deployed — so the tile hides it instead
  /// and says why.
  bool get isAvailable => !kIsWeb || ApiConfig.googleClientId.isNotEmpty;

  User? get currentUser => _auth?.currentUser;

  /// True while the session is the anonymous one every install starts on.
  bool get isAnonymous => currentUser?.isAnonymous ?? true;

  /// The signed-in address, when there is one. Null while anonymous.
  String? get email => isAnonymous ? null : currentUser?.email;

  /// Attaches a Google account to this session.
  ///
  /// Never throws: every failure path returns a typed outcome, because
  /// the caller is a button and an unhandled exception there is a crash
  /// on a screen the user opened to do something optional.
  Future<AccountUpgrade> upgradeWithGoogle() async {
    final auth = _auth;
    if (auth == null) {
      return const AccountUpgrade.failed('Sign-in is unavailable right now.');
    }

    if (!isAvailable) {
      return const AccountUpgrade.failed(
        'Google sign-in is not configured for this build.',
      );
    }

    final previousUid = auth.currentUser?.uid;

    final OAuthCredential credential;
    try {
      final account = await _google.signIn();
      // Backing out of the Google sheet is not an error and must not be
      // reported as one.
      if (account == null) return const AccountUpgrade.cancelled();

      final tokens = await account.authentication;
      credential = GoogleAuthProvider.credential(
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
      );
    } catch (e) {
      debugPrint('Google sign-in failed: $e');
      return const AccountUpgrade.failed(
        'Could not reach Google to sign in. Try again.',
      );
    }

    // Link first: it keeps the uid, and the uid is what the watchlist is
    // filed under.
    try {
      final result = await auth.currentUser?.linkWithCredential(credential);
      return AccountUpgrade.fromUids(
        previousUid: previousUid,
        currentUid: result?.user?.uid ?? auth.currentUser?.uid,
      );
    } on FirebaseAuthException catch (e) {
      // The Google account already belongs to another Firebase user —
      // a reinstall, or a second device. Signing in is then correct, and
      // recoverable only because the watchlist is local-first.
      if (e.code == 'credential-already-in-use' ||
          e.code == 'email-already-in-use' ||
          e.code == 'provider-already-linked') {
        return _signIn(auth, credential, previousUid);
      }

      debugPrint('Account link failed: ${e.code}');
      return AccountUpgrade.failed(_messageFor(e.code));
    } catch (e) {
      debugPrint('Account link failed: $e');
      return const AccountUpgrade.failed('Could not complete sign-in.');
    }
  }

  Future<AccountUpgrade> _signIn(
    FirebaseAuth auth,
    OAuthCredential credential,
    String? previousUid,
  ) async {
    try {
      final result = await auth.signInWithCredential(credential);
      return AccountUpgrade.fromUids(
        previousUid: previousUid,
        currentUid: result.user?.uid,
      );
    } on FirebaseAuthException catch (e) {
      debugPrint('Sign-in failed: ${e.code}');
      return AccountUpgrade.failed(_messageFor(e.code));
    }
  }

  /// Signs out and returns to a fresh anonymous session.
  ///
  /// A signed-out app with no session at all would fail App Check and
  /// every request with it, so a new anonymous user is created
  /// immediately rather than leaving the app unusable.
  Future<void> signOut() async {
    final auth = _auth;
    if (auth == null) return;

    try {
      await _google.signOut();
    } catch (e) {
      // Losing the Google session is not worth blocking the Firebase one.
      debugPrint('Google sign-out failed: $e');
    }

    try {
      await auth.signOut();
      await auth.signInAnonymously();
    } catch (e) {
      debugPrint('Sign-out failed: $e');
    }
  }

  /// Plain-language messages. Firebase codes name internal states and
  /// mean nothing to a reader.
  static String _messageFor(String code) => switch (code) {
    'account-exists-with-different-credential' =>
      'That email is already registered with a different sign-in method.',
    'invalid-credential' => 'Google returned a sign-in we could not use.',
    'operation-not-allowed' => 'Google sign-in is not enabled for this app.',
    'user-disabled' => 'That account has been disabled.',
    'network-request-failed' =>
      'No connection. Check your network and try again.',
    _ => 'Could not complete sign-in.',
  };
}
