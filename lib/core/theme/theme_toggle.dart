/// Appearance switcher used in app bars and on the home screen.
///
/// Presents the three supported modes — System, Light and Dark — in a
/// popup menu, so the user can pick explicitly rather than guessing
/// what a single icon will do next.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_theme.dart';
import 'theme_controller.dart';

class ThemeToggle extends ConsumerWidget {
  const ThemeToggle({super.key, this.compact = false});

  /// Renders a bare icon with no surrounding pill — for dense app bars.
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final palette = context.palette;
    final brand = Theme.of(context).colorScheme.primary;

    return PopupMenuButton<ThemeMode>(
      tooltip: 'Appearance — ${mode.label}',
      initialValue: mode,
      position: PopupMenuPosition.under,
      onSelected: (value) => ref.read(themeModeProvider.notifier).set(value),
      itemBuilder:
          (context) =>
              ThemeMode.values.map((value) {
                final selected = value == mode;
                return PopupMenuItem<ThemeMode>(
                  value: value,
                  // The default PopupMenuItem height is 48 minus padding,
                  // which leaves the row under the 48dp minimum touch
                  // target on both Android and iOS.
                  height: 48,
                  child: Row(
                    children: [
                      Icon(
                        value.icon,
                        size: 18,
                        color: selected ? brand : palette.textSecondary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              value.label,
                              style: Theme.of(
                                context,
                              ).textTheme.labelLarge?.copyWith(
                                color: selected ? brand : palette.textPrimary,
                              ),
                            ),
                            Text(
                              value.description,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      if (selected) ...[
                        const SizedBox(width: 12),
                        Icon(Icons.check_rounded, size: 16, color: brand),
                      ],
                    ],
                  ),
                );
              }).toList(),
      child:
          compact
              // 48dp square: the minimum touch target on both Android and
              // iOS. Padding alone left this at 40 and failed the
              // guideline, which the accessibility test now catches.
              ? const SizedBox(width: 48, height: 48, child: _CompactIcon())
              // SizedBox for the touch target, Center(widthFactor: 1) to
              // size the pill to its content.
              //
              // This was a Container with `alignment: Alignment.center`
              // and no explicit size. A Container given an alignment
              // expands to fill whatever bounded constraints it receives,
              // so inside the home screen's Stack it stretched to the full
              // height of the page and drew an empty panel down the right
              // edge. The alignment was there only to centre a row that is
              // already centred by its own layout.
              : SizedBox(
                height: 48,
                child: Center(
                  widthFactor: 1,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: palette.card,
                      borderRadius: AppTheme.radiusSm,
                      border: Border.all(color: palette.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(mode.icon, size: 16, color: palette.textPrimary),
                        const SizedBox(width: 6),
                        Text(
                          mode.label,
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(color: palette.textPrimary),
                        ),
                        Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 16,
                          color: palette.textMuted,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
    );
  }
}

/// The compact toggle's glyph, sized inside a 48dp touch target.
///
/// A separate widget so the parent can stay `const` while still reading
/// the current mode and palette from context.
class _CompactIcon extends ConsumerWidget {
  const _CompactIcon();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    return Center(
      child: Icon(mode.icon, size: 20, color: context.palette.textPrimary),
    );
  }
}
