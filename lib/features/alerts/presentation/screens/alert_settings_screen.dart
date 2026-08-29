/// Per-figure alert settings and quiet hours.
///
/// Every control here is enforced on the server before a message is sent,
/// so what this screen shows is the truth rather than a local filter
/// applied after the phone has already buzzed.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/features/alerts/presentation/providers/alert_providers.dart';
import 'package:crititrack/features/watchlist/presentation/providers/watchlist_providers.dart';

class AlertSettingsScreen extends ConsumerWidget {
  const AlertSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(alertPreferencesProvider);
    final controller = ref.read(alertPreferencesProvider.notifier);
    final watchlist = ref.watch(watchlistProvider);
    final permission = ref.watch(notificationPermissionProvider);

    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          _Explainer(
            'You are told when a figure you follow moves sharply against '
            'their own recent average — not every time they are in the '
            'news. The threshold is deliberately high, and you will hear '
            'about any one figure at most once a day.',
          ),

          SwitchListTile(
            value: prefs.enabled,
            onChanged: controller.setEnabled,
            title: const Text('Spike alerts'),
            subtitle: Text(
              prefs.enabled
                  ? 'On for ${_countLabel(prefs.slugsForAlerts(watchlist.map((f) => f.slug)).length)}'
                  : 'Off — this device is not registered for alerts',
            ),
          ),

          // Permission can be revoked in system settings at any time, and
          // a switch that reads "on" while the OS silently drops every
          // message is worse than no switch at all.
          if (prefs.enabled && permission.valueOrNull == false)
            _PermissionWarning(
              onRetry: () async {
                await ref.read(pushServiceProvider).requestPermission();
                ref.invalidate(notificationPermissionProvider);
              },
            ),

          const Divider(height: 32),

          _SectionHeader('Quiet hours'),
          SwitchListTile(
            value: prefs.quietEnabled,
            onChanged:
                prefs.enabled
                    ? (v) => controller.setQuietHours(enabled: v)
                    : null,
            title: const Text('Do not disturb'),
            subtitle: Text(
              prefs.quietEnabled
                  ? 'Held between ${_fmt(prefs.quietStartMin)} and '
                      '${_fmt(prefs.quietEndMin)}'
                  : 'Alerts can arrive at any time',
            ),
          ),
          if (prefs.enabled && prefs.quietEnabled) ...[
            _TimeRow(
              label: 'From',
              minutes: prefs.quietStartMin,
              onPicked: (m) => controller.setQuietHours(startMin: m),
            ),
            _TimeRow(
              label: 'Until',
              minutes: prefs.quietEndMin,
              onPicked: (m) => controller.setQuietHours(endMin: m),
            ),
            if (prefs.quietStartMin == prefs.quietEndMin)
              _Explainer(
                'Both ends are set to the same time, which covers no part '
                'of the day — quiet hours are not being applied.',
                tone: _Tone.warning,
              ),
          ],

          const Divider(height: 32),

          _SectionHeader('Per figure'),
          if (watchlist.isEmpty)
            _Explainer(
              'Follow a figure to get alerts about them. Everything you '
              'follow is included unless you mute it here.',
            )
          else
            ...watchlist.map(
              (figure) => SwitchListTile(
                value: !prefs.isMuted(figure.slug),
                onChanged:
                    prefs.enabled
                        ? (_) => controller.toggleMute(figure.slug)
                        : null,
                title: Text(figure.name),
                subtitle: Text(
                  prefs.isMuted(figure.slug) ? 'Muted' : 'Alerts on',
                ),
                secondary: CircleAvatar(
                  backgroundColor: theme.colorScheme.surfaceContainerHighest,
                  foregroundImage:
                      figure.imageUrl == null
                          ? null
                          : NetworkImage(figure.imageUrl!),
                  child: Text(_initial(figure.name)),
                ),
              ),
            ),

          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

String _initial(String name) =>
    name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();

String _countLabel(int n) =>
    n == 1 ? '1 figure' : '$n figures';

/// Minutes since midnight as a 24-hour clock time.
String _fmt(int minutes) {
  final h = (minutes ~/ 60).toString().padLeft(2, '0');
  final m = (minutes % 60).toString().padLeft(2, '0');
  return '$h:$m';
}

class _TimeRow extends StatelessWidget {
  const _TimeRow({
    required this.label,
    required this.minutes,
    required this.onPicked,
  });

  final String label;
  final int minutes;
  final ValueChanged<int> onPicked;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(label),
      trailing: Text(
        _fmt(minutes),
        style: Theme.of(context).textTheme.titleMedium,
      ),
      // Named so a screen reader announces the value rather than just
      // "button", which is what an unlabelled trailing Text gives you.
      onTap: () async {
        final picked = await showTimePicker(
          context: context,
          initialTime: TimeOfDay(hour: minutes ~/ 60, minute: minutes % 60),
          helpText: '$label — quiet hours',
        );
        if (picked != null) onPicked(picked.hour * 60 + picked.minute);
      },
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Text(
        text.toUpperCase(),
        style: theme.textTheme.labelSmall?.copyWith(
          letterSpacing: 1.2,
          fontWeight: FontWeight.w700,
          color: theme.colorScheme.primary,
        ),
      ),
    );
  }
}

enum _Tone { info, warning }

class _Explainer extends StatelessWidget {
  const _Explainer(this.text, {this.tone = _Tone.info});

  final String text;
  final _Tone tone;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final warning = tone == _Tone.warning;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Text(
        text,
        style: theme.textTheme.bodySmall?.copyWith(
          color:
              warning
                  ? theme.colorScheme.error
                  : theme.colorScheme.onSurfaceVariant,
          height: 1.45,
        ),
      ),
    );
  }
}

class _PermissionWarning extends StatelessWidget {
  const _PermissionWarning({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Notifications are blocked',
            style: theme.textTheme.titleSmall?.copyWith(
              color: theme.colorScheme.onErrorContainer,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Your system settings are blocking notifications, so alerts '
            'will not arrive even though they are switched on here.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onErrorContainer,
            ),
          ),
          const SizedBox(height: 8),
          // 48dp minimum target, matching the accessibility guards.
          SizedBox(
            height: 48,
            child: TextButton(
              onPressed: onRetry,
              child: const Text('Ask again'),
            ),
          ),
        ],
      ),
    );
  }
}
