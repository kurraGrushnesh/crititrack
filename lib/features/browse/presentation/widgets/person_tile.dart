import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:crititrack/core/domain/models/figure_category.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/helpers.dart';

/// A catalogue person. Carries only public facts; tapping it opens the
/// real, sourced analysis on the dashboard.
class PersonTile extends StatelessWidget {
  const PersonTile({super.key, required this.entry, this.rank});

  final RosterEntry entry;
  final int? rank;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final initials = entry.name
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .take(2)
        .map((w) => w[0].toUpperCase())
        .join();
    final hue = (entry.name.hashCode.abs() % 360).toDouble();

    return Semantics(
      button: true,
      label: 'Open ${entry.name}',
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => context.go('/dashboard/${toSlug(entry.name)}'),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: palette.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: palette.border),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor:
                    HSLColor.fromAHSL(1, hue, 0.4, 0.2).toColor(),
                child: Text(
                  initials,
                  style: TextStyle(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.name,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      entry.descriptor,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                  ],
                ),
              ),
              if (rank != null)
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Text(
                    '$rank',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: palette.brandText,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
