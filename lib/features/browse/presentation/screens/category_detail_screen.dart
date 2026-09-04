import 'package:flutter/material.dart';

import 'package:crititrack/core/data/catalog.dart';
import 'package:crititrack/core/domain/models/figure_category.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/browse/presentation/widgets/person_tile.dart';

enum _Sort { prominence, name, age }

/// A category's preset Top 10, then the full roster with a birth-decade
/// filter and a sort, chosen from a bottom sheet.
class CategoryDetailScreen extends StatefulWidget {
  const CategoryDetailScreen({super.key, required this.slug});

  final String slug;

  @override
  State<CategoryDetailScreen> createState() => _CategoryDetailScreenState();
}

class _CategoryDetailScreenState extends State<CategoryDetailScreen> {
  int? _decade;
  _Sort _sort = _Sort.prominence;

  FigureCategory? get _category => CatalogAdapter.categoryBySlug(widget.slug);

  List<RosterEntry> get _filtered {
    final roster = CatalogAdapter.rosterFor(widget.slug);
    var list = roster.toList();
    if (_decade != null) {
      list = list.where((r) => r.decade == _decade).toList();
    }
    switch (_sort) {
      case _Sort.name:
        list.sort((a, b) => a.name.compareTo(b.name));
      case _Sort.age:
        list.sort((a, b) => a.born.compareTo(b.born));
      case _Sort.prominence:
        break;
    }
    return list;
  }

  Future<void> _openFilters() async {
    final roster = CatalogAdapter.rosterFor(widget.slug);
    final decades =
        CatalogAdapter.decades
            .where((d) => roster.any((r) => r.decade == d))
            .toList();

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder:
          (sheetContext) => StatefulBuilder(
            builder:
                (sheetContext, setSheet) => Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Born',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: [
                          ChoiceChip(
                            label: const Text('Any'),
                            selected: _decade == null,
                            onSelected: (_) {
                              setSheet(() {});
                              setState(() => _decade = null);
                            },
                          ),
                          for (final d in decades)
                            ChoiceChip(
                              label: Text('${d}s'),
                              selected: _decade == d,
                              onSelected: (_) {
                                setSheet(() {});
                                setState(() => _decade = d);
                              },
                            ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'Sort',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final s in _Sort.values)
                            ChoiceChip(
                              label: Text(switch (s) {
                                _Sort.prominence => 'Prominence',
                                _Sort.name => 'A–Z',
                                _Sort.age => 'Age',
                              }),
                              selected: _sort == s,
                              onSelected: (_) {
                                setSheet(() {});
                                setState(() => _sort = s);
                              },
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final category = _category;
    final palette = context.palette;

    if (category == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Category')),
        body: Center(
          child: Text(
            'Unknown category.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ),
      );
    }

    final top = CatalogAdapter.topTen(widget.slug);
    final filtered = _filtered;
    final filtersActive = _decade != null || _sort != _Sort.prominence;

    return Scaffold(
      appBar: AppBar(
        title: Text(category.label),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: filtersActive,
              child: const Icon(Icons.tune),
            ),
            tooltip: 'Filters',
            onPressed: _openFilters,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Text(
            category.blurb,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: palette.textMuted),
          ),
          const SizedBox(height: 20),
          Text('Top 10', style: Theme.of(context).textTheme.titleLarge),
          Text(
            'Ordered by public prominence, not by controversy.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: palette.textMuted),
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < top.length; i++) ...[
            PersonTile(entry: top[i], rank: i + 1),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Everyone in this category',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              TextButton.icon(
                onPressed: _openFilters,
                icon: const Icon(Icons.tune, size: 18),
                label: const Text('Filter'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (filtered.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child: Text(
                  'No figures here were born in the ${_decade}s.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: palette.textMuted),
                ),
              ),
            )
          else
            for (final r in filtered) ...[
              PersonTile(entry: r),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}
