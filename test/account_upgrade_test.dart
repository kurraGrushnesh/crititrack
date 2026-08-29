// F08's acceptance criterion: "an upgrade preserves their watchlist".
//
// The watchlist lives in Firestore under watchlists/{uid}. Firebase gives
// two ways to attach a Google account to a session and they differ in
// exactly the wrong place — one keeps the uid, one replaces it. Getting
// that wrong makes a user's watchlist disappear at the moment they signed
// in to sync it, so the decision is classified from the uids themselves
// and pinned here.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/features/account/domain/account_upgrade.dart';

void main() {
  group('linking, where the identity survives', () {
    test('an unchanged uid is a link', () {
      final upgrade = AccountUpgrade.fromUids(
        previousUid: 'abc123',
        currentUid: 'abc123',
      );

      expect(upgrade.outcome, AccountUpgradeOutcome.linked);
      expect(upgrade.succeeded, isTrue);
      expect(upgrade.preservedIdentity, isTrue);
    });

    test('a link needs no watchlist push', () {
      // The cloud document is already filed under the right uid.
      final upgrade = AccountUpgrade.fromUids(
        previousUid: 'abc123',
        currentUid: 'abc123',
      );
      expect(upgrade.needsWatchlistPush, isFalse);
    });
  });

  group('switching, where the identity changes', () {
    test('a changed uid is a switch', () {
      // The Google account already belonged to another Firebase user —
      // a reinstall, or a second device.
      final upgrade = AccountUpgrade.fromUids(
        previousUid: 'anon-old',
        currentUid: 'google-new',
      );

      expect(upgrade.outcome, AccountUpgradeOutcome.switched);
      expect(upgrade.succeeded, isTrue);
      expect(upgrade.preservedIdentity, isFalse);
    });

    test('a switch must push the local watchlist up', () {
      // This is the single line standing between "an upgrade preserves
      // your watchlist" and watching it vanish.
      final upgrade = AccountUpgrade.fromUids(
        previousUid: 'anon-old',
        currentUid: 'google-new',
      );
      expect(upgrade.needsWatchlistPush, isTrue);
    });

    test('an upgrade from no previous session is still a switch', () {
      // Nothing to preserve, but the local list still has to be written
      // somewhere.
      final upgrade = AccountUpgrade.fromUids(
        previousUid: null,
        currentUid: 'google-new',
      );
      expect(upgrade.outcome, AccountUpgradeOutcome.switched);
      expect(upgrade.needsWatchlistPush, isTrue);
    });
  });

  group('failure and cancellation', () {
    test('a sign-in that produced no uid is a failure, not a switch', () {
      // Treating it as a switch would push the watchlist to nowhere and
      // report success.
      for (final uid in [null, '']) {
        final upgrade = AccountUpgrade.fromUids(
          previousUid: 'anon-old',
          currentUid: uid,
        );
        expect(upgrade.outcome, AccountUpgradeOutcome.failed);
        expect(upgrade.succeeded, isFalse);
        expect(upgrade.needsWatchlistPush, isFalse);
      }
    });

    test('cancelling is not a failure', () {
      // Backing out of the Google sheet is a choice, and reporting it as
      // an error trains people to distrust every other error.
      const upgrade = AccountUpgrade.cancelled();

      expect(upgrade.outcome, AccountUpgradeOutcome.cancelled);
      expect(upgrade.succeeded, isFalse);
      expect(upgrade.needsWatchlistPush, isFalse);
      expect(upgrade.message, isNull);
    });

    test('a failure carries a message meant for a person', () {
      const upgrade = AccountUpgrade.failed('No connection.');

      expect(upgrade.outcome, AccountUpgradeOutcome.failed);
      expect(upgrade.message, 'No connection.');
      expect(upgrade.succeeded, isFalse);
      expect(upgrade.needsWatchlistPush, isFalse);
    });
  });

  group('equality', () {
    test('two identical outcomes compare equal', () {
      expect(
        AccountUpgrade.fromUids(previousUid: 'a', currentUid: 'a'),
        AccountUpgrade.fromUids(previousUid: 'a', currentUid: 'a'),
      );
    });

    test('a link and a switch are never equal', () {
      expect(
        AccountUpgrade.fromUids(previousUid: 'a', currentUid: 'a'),
        isNot(AccountUpgrade.fromUids(previousUid: 'a', currentUid: 'b')),
      );
    });
  });
}
