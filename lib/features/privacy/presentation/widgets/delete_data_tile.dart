/// The "Delete my data" control promised by the privacy policy.
///
/// Deliberately blunt: it names exactly what will be removed before
/// asking, requires a second confirmation, and reports honestly when
/// something could not be deleted rather than showing a success the user
/// cannot verify.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/privacy/data/data_deletion_service.dart';
import 'package:crititrack/features/watchlist/presentation/providers/watchlist_providers.dart';

final dataDeletionServiceProvider = Provider<DataDeletionService>(
  (ref) => DataDeletionService(),
);

class DeleteDataTile extends ConsumerStatefulWidget {
  const DeleteDataTile({super.key});

  @override
  ConsumerState<DeleteDataTile> createState() => _DeleteDataTileState();
}

class _DeleteDataTileState extends ConsumerState<DeleteDataTile> {
  bool _busy = false;

  Future<void> _confirmAndDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Delete your data?'),
            content: const Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('This permanently removes:'),
                SizedBox(height: 10),
                _Bullet('Your watchlist, on this device and on our servers'),
                _Bullet('Your recent searches'),
                _Bullet('Your appearance preference'),
                _Bullet('Your anonymous account and its usage counters'),
                SizedBox(height: 12),
                Text(
                  'Profiles of public figures are shared reference data and '
                  'are not affected. This cannot be undone.',
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error,
                ),
                child: const Text('Delete everything'),
              ),
            ],
          ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    final result =
        await ref.read(dataDeletionServiceProvider).deleteEverything();

    // The in-memory watchlist must be refreshed or the UI keeps showing
    // rows whose storage has already been cleared.
    await ref.read(watchlistProvider.notifier).syncFromCloud();

    if (!mounted) return;
    setState(() => _busy = false);

    final messenger = ScaffoldMessenger.of(context);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            result.complete
                ? 'Your data has been deleted.'
                : 'Deleted what we could. ${result.problems.join(' ')}',
          ),
          duration: Duration(seconds: result.complete ? 3 : 6),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    return ListTile(
      leading:
          _busy
              ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
              : Icon(
                Icons.delete_outline_rounded,
                color: theme.colorScheme.error,
              ),
      title: Text(
        'Delete my data',
        style: theme.textTheme.titleSmall?.copyWith(
          color: palette.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        'Removes your watchlist, searches and anonymous account',
        style: theme.textTheme.bodySmall?.copyWith(
          color: palette.textSecondary,
        ),
      ),
      onTap: _busy ? null : _confirmAndDelete,
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [const Text('• '), Expanded(child: Text(text))],
      ),
    );
  }
}
