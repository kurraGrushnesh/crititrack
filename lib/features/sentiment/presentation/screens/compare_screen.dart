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
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/correlation.dart';
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
                  color: AppTheme.primary,
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
              _buildOverlayChart(celebrities, theme),
              const SizedBox(height: 20),

              // ── Correlation Matrix ────────────────────────────
              _buildCorrelationMatrix(celebrities, theme),
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
                      color: AppTheme.textMuted,
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
                  color: AppTheme.surfaceElevated,
                  borderRadius: AppTheme.radiusMd,
                  border: Border.all(color: AppTheme.border),
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
                  color: AppTheme.surfaceElevated,
                  borderRadius: AppTheme.radiusMd,
                  border: Border.all(color: AppTheme.border),
                ),
                child: Center(
                  child: Column(
                    children: [
                      Icon(
                        Icons.compare_arrows_rounded,
                        size: 48,
                        color: AppTheme.textMuted,
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
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCard,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: AppTheme.border),
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
                      (value) => FlLine(
                        color: AppTheme.border.withValues(alpha: 0.3),
                        strokeWidth: 1,
                      ),
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
                            style: const TextStyle(
                              color: AppTheme.textMuted,
                              fontSize: 10,
                            ),
                          ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      getTitlesWidget: (v, _) {
                        final idx = v.toInt();
                        // Use the first celebrity's date labels
                        final trend = celebrities.first.sentimentData.trendData;
                        if (idx < 0 || idx >= trend.length) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            trend[idx].date,
                            style: const TextStyle(
                              color: AppTheme.textMuted,
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
                      final celeb = e.value;
                      final color = _chartColors[idx % _chartColors.length];
                      final spots =
                          celeb.sentimentData.trendData
                              .asMap()
                              .entries
                              .map(
                                (s) => FlSpot(s.key.toDouble(), s.value.score),
                              )
                              .toList();

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
                                strokeColor: Colors.white,
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
                          color: AppTheme.textSecondary,
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

  Widget _buildCorrelationMatrix(List<Celebrity> celebrities, ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCard,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Correlation Matrix', style: theme.textTheme.titleMedium),
          const SizedBox(height: 12),
          ..._buildCorrelationPairs(celebrities, theme),
        ],
      ),
    );
  }

  List<Widget> _buildCorrelationPairs(
    List<Celebrity> celebrities,
    ThemeData theme,
  ) {
    final pairs = <Widget>[];

    for (int i = 0; i < celebrities.length; i++) {
      for (int j = i + 1; j < celebrities.length; j++) {
        final a = celebrities[i];
        final b = celebrities[j];

        // Extract score series
        final scoresA = a.sentimentData.trendData.map((s) => s.score).toList();
        final scoresB = b.sentimentData.trendData.map((s) => s.score).toList();

        // Align by index (both should have same length from LLM)
        final minLen =
            scoresA.length < scoresB.length ? scoresA.length : scoresB.length;

        double r = 0.0;
        String label = 'Insufficient data';
        if (minLen >= 2) {
          final alignedA = scoresA.sublist(0, minLen);
          final alignedB = scoresB.sublist(0, minLen);
          r = pearsonCorrelation(alignedA, alignedB);
          label = correlationLabel(r);
        }

        final colorI = _chartColors[i % _chartColors.length];
        final colorJ = _chartColors[j % _chartColors.length];

        pairs.add(
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.surfaceElevated,
              borderRadius: AppTheme.radiusMd,
            ),
            child: Row(
              children: [
                // Names
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(radius: 4, backgroundColor: colorI),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              a.name,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          CircleAvatar(radius: 4, backgroundColor: colorJ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              b.name,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                // Correlation value
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'r = ${r.toStringAsFixed(2)}',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: _correlationColor(r),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 10,
                        color: _correlationColor(r).withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      }
    }

    return pairs;
  }

  Color _correlationColor(double r) {
    if (r > 0.5) return AppTheme.sentimentPositive;
    if (r < -0.5) return AppTheme.sentimentNegative;
    return AppTheme.sentimentNeutral;
  }
}
