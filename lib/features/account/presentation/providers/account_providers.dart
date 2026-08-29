/// Riverpod wiring for the optional account upgrade.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/features/account/data/account_service.dart';
import 'package:crititrack/features/account/domain/account_upgrade.dart';
import 'package:crititrack/features/watchlist/presentation/providers/watchlist_providers.dart';

final accountServiceProvider = Provider<AccountService>(
  (ref) => AccountService(),
);

/// Whether this session is still the anonymous one every install starts
/// on, and the address if not.
final accountStatusProvider = Provider<({bool anonymous, String? email})>((
  ref,
) {
  final service = ref.watch(accountServiceProvider);
  return (anonymous: service.isAnonymous, email: service.email);
});

final accountControllerProvider =
    NotifierProvider<AccountController, bool>(AccountController.new);

/// `state` is whether an upgrade is in flight.
class AccountController extends Notifier<bool> {
  @override
  bool build() => false;

  AccountService get _service => ref.read(accountServiceProvider);

  /// Runs the upgrade and makes sure the watchlist survives it.
  Future<AccountUpgrade> upgradeWithGoogle() async {
    if (state) return const AccountUpgrade.cancelled();
    state = true;

    try {
      final result = await _service.upgradeWithGoogle();

      if (result.needsWatchlistPush) {
        // The session moved to a uid that may already have its own
        // watchlist from another device. Pull that in first, then write
        // the union back — merging rather than letting whichever device
        // signed in last overwrite the other.
        //
        // Safe in this order because the local store is authoritative and
        // mergeFromCloud is a union, not a replace.
        await ref.read(watchlistProvider.notifier).syncFromCloud();
        await ref.read(watchlistRepositoryProvider).pushToCloud();
      } else if (result.succeeded) {
        // Linked: same uid, so the cloud document is already the right
        // one. Still worth pulling, in case another device wrote to it.
        await ref.read(watchlistProvider.notifier).syncFromCloud();
      }

      return result;
    } finally {
      state = false;
      ref.invalidate(accountStatusProvider);
    }
  }

  Future<void> signOut() async {
    state = true;
    try {
      await _service.signOut();
      // The local watchlist deliberately survives sign-out: it lives on
      // this device and was never the account's to take away. It is the
      // delete-my-data flow that removes it, because that is the one the
      // user pressed to remove it.
    } finally {
      state = false;
      ref.invalidate(accountStatusProvider);
    }
  }
}
