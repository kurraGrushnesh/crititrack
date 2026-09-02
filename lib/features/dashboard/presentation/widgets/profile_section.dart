import 'package:flutter/material.dart';

import 'package:crititrack/core/theme/app_theme.dart';

/// One section of the editorial profile: a hairline rule, a small label,
/// then the content. No card, no shadow — the page is a single column
/// separated by thin lines, matching the web.
///
/// Horizontal padding is left to the child, so each section's own
/// content controls its measure; this widget only owns the rule, the
/// label, and the vertical rhythm.
class ProfileSection extends StatelessWidget {
  const ProfileSection({
    super.key,
    this.label,
    required this.child,
    this.first = false,
  });

  final String? label;
  final Widget child;

  /// The first section skips the top rule.
  final bool first;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!first)
          Divider(height: 48, thickness: 1, color: palette.border),
        if (label != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
            child: Text(
              label!.toUpperCase(),
              style: theme.textTheme.labelMedium?.copyWith(
                color: palette.textMuted,
                letterSpacing: 1,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        child,
      ],
    );
  }
}
