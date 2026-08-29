/// A standing notice on the published demo build.
///
/// The public build at `/app/` is deployed with no backend behind it:
/// Cloud Functions cannot run on the free Firebase plan, so every search
/// fails at the network call. The UI is real and fully interactive; the
/// data path is not there.
///
/// A visitor who is not told this concludes the app is broken, which is
/// a worse impression than a demo that says what it is. So the notice is
/// permanent rather than dismissible — it stays true for the whole
/// session, and a banner dismissed on the home screen would leave the
/// first failed search unexplained.
///
/// Shown only when `--dart-define=DEMO_MODE=true` was passed at build
/// time. A real deployment simply does not pass it.
library;

import 'package:flutter/material.dart';

import 'package:crititrack/core/constants/api_config.dart';
import 'package:crititrack/core/theme/app_theme.dart';

class DemoBanner extends StatelessWidget {
  const DemoBanner({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!ApiConfig.isDemo) return child;

    return Column(children: [const _Bar(), Expanded(child: child)]);
  }
}

class _Bar extends StatelessWidget {
  const _Bar();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppTheme.warning.withValues(alpha: 0.16),
      child: SafeArea(
        bottom: false,
        child: Semantics(
          // Announced once when the app opens, rather than being read as
          // an unlabelled decoration.
          liveRegion: true,
          label:
              'Demo build. No backend is deployed, so searches will not '
              'return results. The interface is fully interactive.',
          excludeSemantics: true,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
            child: Row(
              children: [
                const Icon(
                  Icons.science_outlined,
                  size: 15,
                  color: AppTheme.warning,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        const TextSpan(
                          text: 'Demo build. ',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const TextSpan(
                          text:
                              'No backend is deployed, so searches return '
                              'nothing. Everything else is real.',
                        ),
                      ],
                    ),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface,
                      fontSize: 11.5,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
