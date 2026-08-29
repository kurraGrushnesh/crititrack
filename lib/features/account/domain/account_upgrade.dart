/// What happened when an anonymous account was upgraded to a real one.
///
/// The distinction this file exists to hold is the one F08's acceptance
/// criterion turns on: *an upgrade preserves their watchlist*.
///
/// The watchlist is stored in Firestore under `watchlists/{uid}`. Firebase
/// offers two ways to attach a Google account to a session and they differ
/// in exactly the wrong place:
///
///   * `linkWithCredential` attaches the provider to the *existing*
///     anonymous user. The uid is unchanged, so the cloud watchlist is
///     already under the right key and nothing needs moving.
///   * `signInWithCredential` starts a *new* session. The uid changes,
///     the old document is orphaned, and the user watches their watchlist
///     vanish at the exact moment they signed in to sync it.
///
/// Linking is always attempted first. It fails when that Google account is
/// already attached to another Firebase user — someone reinstalling, or
/// signing in on a second device — and only then is signing in the right
/// move. That case is recoverable precisely because the watchlist is
/// local-first: the device still holds its own copy, so it can be pushed
/// up under the new uid.
library;

import 'package:equatable/equatable.dart';

enum AccountUpgradeOutcome {
  /// The Google account was attached to the existing anonymous user. Same
  /// uid, so the cloud watchlist needs no work.
  linked,

  /// The Google account already belonged to a different Firebase user, so
  /// the session moved to it. New uid: the local watchlist has to be
  /// pushed up before it looks like it was lost.
  switched,

  /// The user backed out of the Google sheet. Not an error, and must not
  /// be reported as one.
  cancelled,

  failed,
}

class AccountUpgrade extends Equatable {
  const AccountUpgrade({
    required this.outcome,
    this.previousUid,
    this.currentUid,
    this.message,
  });

  final AccountUpgradeOutcome outcome;

  /// The anonymous uid the session had before the attempt.
  final String? previousUid;

  /// The uid it has now. Equal to [previousUid] when linking worked.
  final String? currentUid;

  /// Shown to the user on [AccountUpgradeOutcome.failed]. Never a raw
  /// exception string: those name internal classes and leak stack detail
  /// into a dialog.
  final String? message;

  const AccountUpgrade.cancelled()
    : outcome = AccountUpgradeOutcome.cancelled,
      previousUid = null,
      currentUid = null,
      message = null;

  const AccountUpgrade.failed(String this.message)
    : outcome = AccountUpgradeOutcome.failed,
      previousUid = null,
      currentUid = null;

  /// Classifies a completed sign-in by whether the identity survived it.
  ///
  /// Comparing the uids rather than trusting which API path was taken:
  /// that is the fact the watchlist actually depends on, and it stays
  /// true if the flow is ever restructured.
  factory AccountUpgrade.fromUids({
    required String? previousUid,
    required String? currentUid,
  }) {
    if (currentUid == null || currentUid.isEmpty) {
      return const AccountUpgrade.failed('Sign-in did not complete.');
    }

    return AccountUpgrade(
      outcome:
          previousUid == currentUid
              ? AccountUpgradeOutcome.linked
              : AccountUpgradeOutcome.switched,
      previousUid: previousUid,
      currentUid: currentUid,
    );
  }

  bool get succeeded =>
      outcome == AccountUpgradeOutcome.linked ||
      outcome == AccountUpgradeOutcome.switched;

  /// Whether the identity survived, so the cloud copy is already correct.
  bool get preservedIdentity => outcome == AccountUpgradeOutcome.linked;

  /// Whether the local watchlist must be pushed to the new uid.
  ///
  /// This is the single line standing between "an upgrade preserves your
  /// watchlist" and a user watching it disappear.
  bool get needsWatchlistPush => outcome == AccountUpgradeOutcome.switched;

  @override
  List<Object?> get props => [outcome, previousUid, currentUid, message];
}
