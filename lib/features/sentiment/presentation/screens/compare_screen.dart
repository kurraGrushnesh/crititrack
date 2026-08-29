/// Comparative sentiment analytics screen.
///
/// Phase 3 — Multi-select celebrity picker → overlay line chart →
/// pairwise Pearson correlation matrix with plain-language labels.
///
/// No new LLM calls — reads cached snapshot data.
library;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/compare_analytics.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';

/// Colors assigned to each celebrity in the overlay chart.
const _chartColors = [
  AppTheme.primary,
  AppTheme.secondary,
  AppTheme.accent,
  AppTheme.warning,
  AppTheme.success,
  AppTheme.error,
];

class CompareScreen extends ConsumerStatefulWidget {
  const CompareScreen({super.key});

  @override
  ConsumerState<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends ConsumerState<CompareScreen> {
  final _searchController = TextEditingController();
  final _selectedSlugs = <String>[];
  final _loadedCelebrities = <String, Celebrity>{};

  /// Defaults to a month rather than a week because history is still
  /// shallow — a seven-day default would show almost nothing today and
  /// look like a broken screen rather than a narrow window.
  CompareWindow _window = CompareWindow.month;

  /// A figure's trend, narrowed to the selected window.
  Map<String, double> _windowedSeries(Celebrity c) =>
      withinWindow(_seriesOf(c), _window, DateTime.now());

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _addCelebrity(String name) {
    final slug = toSlug(name.trim());
    if (slug.isEmpty || _selectedSlugs.contains(slug)) return;

    setState(() {
      _selectedSlugs.add(slug);
      _searchController.clear();
    });

    // Trigger loading
    ref.read(dashboardProvider(slug));
  }

  void _removeCelebrity(String slug) {
    setState(() {
      _selectedSlugs.remove(slug);
      _loadedCelebrities.remove(slug);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    // Watch all selected celebrities
    final celebrities = <Celebrity>[];
    for (final slug in _selectedSlugs) {
      final asyncValue = ref.watch(dashboardProvider(slug));
      asyncValue.whenData((celeb) {
        _loadedCelebrities[slug] = celeb;
      });
      if (_loadedCelebrities.containsKey(slug)) {
        celebrities.add(_loadedCelebrities[slug]!);
      }
    }

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => GoRouter.of(context).go('/'),
        ),
        title: const Text('Compare Sentiment'),
        actions: [
          if (_selectedSlugs.length >= 2)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Chip(
                avatar: Icon(
                  Icons.compare_arrows_rounded,
                  size: 16,
                  color: theme.colorScheme.primary,
                ),
                label: Text(
                  '${celebrities.length} selected',
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Celebrity Search / Add ───────────────────────────
            _buildSearchSection(theme),
            const SizedBox(height: 12),

            // ── Selected Celebrity Chips ────────────────────────
            if (_selectedSlugs.isNotEmpty) ...[
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children:
                    _selectedSlugs.asMap().entries.map((e) {
                      final idx = e.key;
                      final slug = e.value;
                      final color = _chartColors[idx % _chartColors.length];
                      final name =
                          _loadedCelebrities[slug]?.name ?? fromSlug(slug);

                      return Chip(
                        avatar: CircleAvatar(radius: 8, backgroundColor: color),
                        label: Text(name, style: const TextStyle(fontSize: 12)),
                        deleteIcon: const Icon(Icons.close, size: 16),
                        onDeleted: () => _removeCelebrity(slug),
                        backgroundColor: color.withValues(alpha: 0.1),
                        side: BorderSide(color: color.withValues(alpha: 0.3)),
                      );
                    }).toList(),
              ),
              const SizedBox(height: 20),
            ],

            // ── Overlay Chart ───────────────────────────────────
            if (celebrities.length >= 2) ...[
              _WindowSelector(
                selected: _window,
                onChanged: (w) => setState(() => _window = w),
              ),
              const SizedBox(height: 14),
              _buildOverlayChart(celebrities, theme),
              const SizedBox(height: 20),

              // ── Controversy comparison ───────────────────────
              // Sentiment is how coverage feels this week; the index is
              // the accumulated record. Two figures can diverge sharply
              // on one while matching on the other, and seeing both side
              // by side is the point of comparing at all.
              _ControversyComparison(celebrities: celebrities),
              const SizedBox(height: 20),

              // ── Category profile ─────────────────────────────
              // What kind of trouble, as distinct from how much —
              // which is what the bars above already answer.
              _CategoryRadar(celebrities: celebrities),
              const SizedBox(height: 20),

              // ── Who moved together ───────────────────────────
              _buildMovedTogether(celebrities, theme),
              const SizedBox(height: 12),

              // ── NFR-6 indicator ───────────────────────────────
              Row(
                children: [
                  Icon(
                    Icons.auto_fix_high_rounded,
                    size: 10,
                    color: AppTheme.warning.withValues(alpha: 0.7),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Correlations are algorithmically generated from cached data',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: palette.textMuted,
                      fontSize: 9,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ),
            ] else if (_selectedSlugs.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: palette.card,
                  borderRadius: AppTheme.radiusMd,
                  border: Border.all(color: palette.border),
                ),
                child: Center(
                  child: Text(
                    _selectedSlugs.length == 1
                        ? 'Add at least one more celebrity to compare'
                        : 'Loading celebrity data…',
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
              ),
            ] else
              Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: palette.card,
                  borderRadius: AppTheme.radiusMd,
                  border: Border.all(color: palette.border),
                ),
                child: Center(
                  child: Column(
                    children: [
                      Icon(
                        Icons.compare_arrows_rounded,
                        size: 48,
                        color: palette.textMuted,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Search and add 2+ celebrities to compare\ntheir sentiment trajectories',
                        style: theme.textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchSection(ThemeData theme) {
    return TextField(
      controller: _searchController,
      onSubmitted: (value) {
        if (value.trim().isNotEmpty) _addCelebrity(value);
      },
      decoration: InputDecoration(
        hintText: 'Search celebrity to add…',
        prefixIcon: const Icon(Icons.person_add_alt_1_rounded),
        suffixIcon: IconButton(
          icon: const Icon(Icons.add_rounded),
          onPressed: () {
            if (_searchController.text.trim().isNotEmpty) {
              _addCelebrity(_searchController.text);
            }
          },
        ),
      ),
    );
  }

  Widget _buildOverlayChart(List<Celebrity> celebrities, ThemeData theme) {
    final palette = context.palette;

    // One shared, sorted date axis across every selected figure.
    //
    // Each series used to be plotted against its own index while the
    // axis was labelled with the *first* figure's dates, so two figures
    // first tracked days apart were drawn over each other with their
    // points describing different days. The correlation had the same
    // defect and was fixed; this is the copy of it people actually look
    // at.
    final windowed = [for (final c in celebrities) _windowedSeries(c)];
    final dates =
        <String>{for (final w in windowed) ...w.keys}.toList()..sort();

    if (dates.isEmpty) {
      return _EmptyCard(
        'No snapshots in ${_window.label.toLowerCase()}. '
        'Try a wider window.',
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
        boxShadow: palette.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Sentiment Overlay', style: theme.textTheme.titleMedium),
          const SizedBox(height: 16),
          SizedBox(
            height: 250,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: 20,
                  getDrawingHorizontalLine:
                      (value) =>
                          FlLine(color: palette.chartGrid, strokeWidth: 1),
                ),
                titlesData: FlTitlesData(
                  rightTitles: const AxisTitles(),
                  topTitles: const AxisTitles(),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 35,
                      interval: 20,
                      getTitlesWidget:
                          (v, _) => Text(
                            '${v.toInt()}',
                            style: TextStyle(
                              color: palette.textMuted,
                              fontSize: 10,
                            ),
                          ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      interval: (dates.length / 5).ceilToDouble().clamp(
                        1.0,
                        double.infinity,
                      ),
                      getTitlesWidget: (v, _) {
                        final idx = v.toInt();
                        if (idx < 0 || idx >= dates.length) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            _shortDate(dates[idx]),
                            style: TextStyle(
                              color: palette.textMuted,
                              fontSize: 10,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                minY: 0,
                maxY: 100,
                lineBarsData:
                    celebrities.asMap().entries.map((e) {
                      final idx = e.key;
                      final color = _chartColors[idx % _chartColors.length];
                      // Positioned on the shared axis, so a gap in one
                      // figure's history is a gap rather than a shift.
                      final series = windowed[idx];
                      final spots = <FlSpot>[
                        for (var i = 0; i < dates.length; i++)
                          if (series[dates[i]] != null)
                            FlSpot(i.toDouble(), series[dates[i]]!),
                      ];

                      return LineChartBarData(
                        spots: spots,
                        isCurved: true,
                        color: color,
                        barWidth: 2.5,
                        isStrokeCapRound: true,
                        belowBarData: BarAreaData(show: false),
                        dotData: FlDotData(
                          show: true,
                          getDotPainter:
                              (_, __, ___, ____) => FlDotCirclePainter(
                                radius: 3,
                                color: color,
                                strokeWidth: 1,
                                strokeColor: palette.card,
                              ),
                        ),
                      );
                    }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Legend
          Wrap(
            spacing: 16,
            runSpacing: 4,
            children:
                celebrities.asMap().entries.map((e) {
                  final idx = e.key;
                  final color = _chartColors[idx % _chartColors.length];
                  return Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 10, height: 3, color: color),
                      const SizedBox(width: 4),
                      Text(
                        e.value.name,
                        style: TextStyle(
                          fontSize: 11,
                          color: palette.textSecondary,
                        ),
                      ),
                    ],
                  );
                }).toList(),
          ),
        ],
      ),
    );
  }

  /// Pairwise co-movement, strongest relationship first.
  ///
  /// Replaces the old correlation matrix, which reported an r from as
  /// few as two overlapping days — where Pearson's coefficient is always
  /// exactly plus or minus one, because two points determine a line. That
  /// read as "strongly moving together" precisely when there was least
  /// reason to believe it.
  Widget _buildMovedTogether(List<Celebrity> celebrities, ThemeData theme) {
    final palette = context.palette;

    final pairs = rankPairs([
      for (final c in celebrities)
        (slug: c.name, name: c.name, scores: _windowedSeries(c)),
    ]);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
        boxShadow: palette.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Who moved together', style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'Over ${_window.label.toLowerCase()}, computed only on days '
            'these figures actually share',
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: 14),
          for (final pair in pairs)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: palette.elevated,
                borderRadius: AppTheme.radiusMd,
                border: Border.all(color: palette.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${pair.nameA}  ·  ${pair.nameB}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: palette.textPrimary,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          pair.hasEnoughData
                              ? '${pair.label} · ${pair.overlap} shared '
                                  '${pair.overlap == 1 ? "day" : "days"}'
                              // Says what is missing, rather than leaving a
                              // blank row the reader cannot interpret.
                              : '${pair.label} · needs ${pair.daysShort} more',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: palette.textMuted,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    pair.hasEnoughData
                        ? 'r = ${pair.r.toStringAsFixed(2)}'
                        : '—',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _rColor(pair),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// A figure's trend as a date-keyed map, for [alignByDate].
///
/// Snapshots written by the scheduler are keyed by ISO date; the older
/// weekday labels ("Mon") still key correctly against each other, so a
/// cached document from before the change still compares sensibly.
Map<String, double> _seriesOf(Celebrity c) {
  return {
    for (final s in c.sentimentData.trendData)
      if (s.date.isNotEmpty) s.date: s.score,
  };
}

/// Controversy indexes side by side, as proportional bars.
///
/// Bars rather than another line chart: the index is a standing figure,
/// not a time series, and drawing it as one would imply movement the data
/// does not contain.
class _ControversyComparison extends StatelessWidget {
  const _ControversyComparison({required this.celebrities});

  final List<Celebrity> celebrities;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    final rows =
        celebrities.asMap().entries.map((e) {
            final index = computeControversyIndex(
              e.value.biography.controversies,
            );
            return (
              name: e.value.name,
              index: index,
              color: _chartColors[e.key % _chartColors.length],
            );
          }).toList()
          ..sort((a, b) => b.index.score.compareTo(a.index.score));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Controversy Index', style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'Severity, recency and how much is unresolved — not a count',
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: 14),
          for (final row in rows) ...[
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: row.color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    row.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  '${row.index.rounded}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: Stack(
                children: [
                  Container(height: 6, color: palette.elevated),
                  FractionallySizedBox(
                    // Never zero-width: a figure with no controversies
                    // should read as "nothing found", not as a missing bar
                    // that looks like missing data.
                    widthFactor: (row.index.score / 100).clamp(0.015, 1.0),
                    child: Container(height: 6, color: row.color),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              row.index.total == 0
                  ? 'No documented episodes'
                  : '${row.index.label} · ${row.index.total} '
                      '${row.index.total == 1 ? "episode" : "episodes"}'
                      '${row.index.ongoingCount > 0 ? ", ${row.index.ongoingCount} ongoing" : ""}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: palette.textMuted,
                fontSize: 10,
              ),
            ),
            const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }
}

/// Colour for a coefficient, muted when it is not yet trustworthy.
Color _rColor(PairCorrelation pair) {
  if (!pair.hasEnoughData) return AppTheme.sentimentNeutral;
  if (pair.r > 0.5) return AppTheme.sentimentPositive;
  if (pair.r < -0.5) return AppTheme.sentimentNegative;
  return AppTheme.sentimentNeutral;
}

/// `2026-01-15` as `01-15`; anything unparseable is shown as-is.
String _shortDate(String iso) {
  final parts = iso.split('-');
  return parts.length == 3 ? '${parts[1]}-${parts[2]}' : iso;
}

/// The span of history every figure on this screen is measured over.
class _WindowSelector extends StatelessWidget {
  const _WindowSelector({required this.selected, required this.onChanged});

  final CompareWindow selected;
  final ValueChanged<CompareWindow> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final window in CompareWindow.values)
          ChoiceChip(
            label: Text(window.label, style: const TextStyle(fontSize: 12)),
            selected: window == selected,
            onSelected: (_) => onChanged(window),
          ),
      ],
    );
  }
}

/// Short spoke labels. The full category names do not fit on a radar at
/// phone width and wrap into one another.
const _categoryShortLabels = <String, String>{
  ControversyCategory.legal: 'Legal',
  ControversyCategory.financial: 'Financial',
  ControversyCategory.socialMedia: 'Social',
  ControversyCategory.personalConduct: 'Conduct',
  ControversyCategory.political: 'Political',
  ControversyCategory.professional: 'Work',
  ControversyCategory.relationships: 'Personal',
  ControversyCategory.other: 'Other',
};

/// The shape of each figure's controversy record, by category.
///
/// Shares rather than totals, so this answers "what kind of trouble"
/// while the bars above answer "how much". Plotting totals would make
/// this a second, worse copy of the bars, in which the figure with the
/// longest record simply encloses everyone else.
class _CategoryRadar extends StatelessWidget {
  const _CategoryRadar({required this.celebrities});

  final List<Celebrity> celebrities;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    final profiles = [
      for (final c in celebrities) categoryProfile(c.biography.controversies),
    ];

    // With nothing on record every share is zero, and a radar of zeroes
    // is both meaningless and a division by zero waiting to happen.
    final hasAnything = profiles.any((p) => p.values.any((v) => v > 0));
    if (!hasAnything) {
      return const _EmptyCard(
        'No documented episodes to profile for these figures yet.',
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
        boxShadow: palette.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Category profile', style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'Severity-weighted share of each record — the shape of the '
            'trouble, not its size',
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 260,
            child: RadarChart(
              RadarChartData(
                radarShape: RadarShape.polygon,
                radarBackgroundColor: Colors.transparent,
                borderData: FlBorderData(show: false),
                radarBorderData: BorderSide(color: palette.chartGrid),
                gridBorderData: BorderSide(color: palette.chartGrid),
                tickBorderData: const BorderSide(color: Colors.transparent),
                // The rings are the scale; printing numbers on them just
                // crowds eight spokes at phone width.
                ticksTextStyle: const TextStyle(color: Colors.transparent),
                tickCount: 3,
                titlePositionPercentageOffset: 0.16,
                titleTextStyle: TextStyle(
                  fontSize: 9,
                  color: palette.textSecondary,
                ),
                getTitle:
                    (index, angle) => RadarChartTitle(
                      text:
                          _categoryShortLabels[ControversyCategory
                              .all[index]] ??
                          '',
                    ),
                dataSets: [
                  for (var i = 0; i < profiles.length; i++)
                    RadarDataSet(
                      fillColor: _chartColors[i % _chartColors.length]
                          .withValues(alpha: 0.14),
                      borderColor: _chartColors[i % _chartColors.length],
                      borderWidth: 2,
                      entryRadius: 2,
                      dataEntries: [
                        for (final category in ControversyCategory.all)
                          RadarEntry(value: profiles[i][category] ?? 0),
                      ],
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            runSpacing: 4,
            children: [
              for (var i = 0; i < celebrities.length; i++)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 10,
                      height: 3,
                      color: _chartColors[i % _chartColors.length],
                    ),
                    const SizedBox(width: 4),
                    Text(
                      celebrities[i].name,
                      style: TextStyle(
                        fontSize: 11,
                        color: palette.textSecondary,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A plain card for "there is nothing here yet", which is a different
/// statement from an error and should not look like one.
class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted),
      ),
    );
  }
}
