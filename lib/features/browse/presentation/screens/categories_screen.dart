import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:crititrack/core/data/catalog.dart';
import 'package:crititrack/core/theme/app_theme.dart';

/// Browse landing: the six categories as cards. Each opens a preset
/// Top 10 with filters.
class CategoriesScreen extends StatelessWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final categories = CatalogAdapter.categories();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        Text(
          'Browse by category',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 4),
        Text(
          'Each category has a curated Top 10 by public prominence, plus '
          'filters. Scores and evidence come from a live analysis when you '
          'open a profile.',
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: palette.textMuted),
        ),
        const SizedBox(height: 20),
        for (final c in categories) ...[
          Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => context.go('/browse/${c.slug}'),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            c.label,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        ),
                        Icon(Icons.chevron_right, color: palette.textMuted),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      c.blurb,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: palette.textMuted),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Leads with '
                      '${CatalogAdapter.topTen(c.slug).first.name}',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: palette.brandText,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
