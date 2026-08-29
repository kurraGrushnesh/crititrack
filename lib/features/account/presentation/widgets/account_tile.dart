/// The optional sign-in, and the only place an email is ever asked for.
///
/// Deliberately framed as a sync feature rather than as an account. There
/// is no signup wall anywhere in this app: everything works on the
/// anonymous session created at first launch, and this exists solely so a
/// watchlist can follow someone to a second device.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/account/domain/account_upgrade.dart';
import 'package:crititrack/features/account/presentation/providers/account_providers.dart';

class AccountTile extends ConsumerWidget {
  const AccountTile({super.key});

  Future<void> _upgrade(BuildContext context, WidgetRef ref) async {
    final result =
        await ref.read(accountControllerProvider.notifier).upgradeWithGoogle();

    if (!context.mounted) return;

    // Backing out is not a failure and gets no message at all.
    if (result.outcome == AccountUpgradeOutcome.cancelled) return;

    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(switch (result.outcome) {
          AccountUpgradeOutcome.linked =>
            'Signed in. Your watchlist will sync across your devices.',
          AccountUpgradeOutcome.switched =>
            'Signed in to your existing account. Your watchlists have '
                'been merged.',
          _ => result.message ?? 'Could not complete sign-in.',
        }),
      ),
    );
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Sign out?'),
            content: const Text(
              'The app keeps working and your watchlist stays on this device. '
              'It just stops syncing to your other ones.\n\n'
              'To remove your data entirely, use Delete my data instead.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Sign out'),
              ),
            ],
          ),
    );

    if (confirmed != true) return;
    await ref.read(accountControllerProvider.notifier).signOut();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final busy = ref.watch(accountControllerProvider);
    final status = ref.watch(accountStatusProvider);

    final signedIn = !status.anonymous;
    final available = ref.watch(accountServiceProvider).isAvailable;

    return ListTile(
      // 48dp minimum, matching the accessibility guards.
      minVerticalPadding: 12,
      leading: Icon(
        signedIn ? Icons.cloud_done_outlined : Icons.devices_outlined,
        size: 20,
        color: signedIn ? AppTheme.success : palette.textSecondary,
      ),
      title: Text(
        signedIn ? 'Syncing across your devices' : 'Sync across devices',
        style: theme.textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        signedIn
            ? (status.email ?? 'Signed in')
            : available
            ? 'Optional. Sign in with Google to carry your watchlist to '
                'another device. Nothing else changes.'
            : 'Not available in this build. Your watchlist still works — it '
                'just stays on this device.',
        style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted),
      ),
      trailing:
          !signedIn && !available
              ? null
              : busy
              ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
              : SizedBox(
                height: 48,
                child: TextButton(
                  onPressed:
                      signedIn
                          ? () => _signOut(context, ref)
                          : () => _upgrade(context, ref),
                  child: Text(signedIn ? 'Sign out' : 'Sign in'),
                ),
              ),
    );
  }
}
