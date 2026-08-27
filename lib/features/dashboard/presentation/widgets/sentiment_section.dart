/// Sentiment analysis dashboard section with stat cards, charts,
/// and AI explanation typewriter animation.
///
/// Contains three StatCard metrics, a TabBarView with PieChart,
/// LineChart, and BarChart (fl_chart), and an AI explanation text
/// rendered with character-by-character typewriter animation.
///
/// Enhanced with:
/// - Phase 1: Spike markers on trend line chart + tap-to-inspect
/// - Phase 2: Evidence panel (via EvidencePanel widget)
/// - Phase 4: Dashed forecast segment on line chart
/// - Phase 5: Source breakdown chips (via SourceBreakdown widget)
/// - NFR-6: "Algorithmically generated" indicators
library;

import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import 'package:crititrack/core/constants/app_constants.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/evidence_panel.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/source_breakdown.dart';

class SentimentSection extends StatefulWidget {
  const SentimentSection({
    super.key,
    required this.sentimentData,
    this.mediaItems = const [],
  });
  final SentimentData sentimentData;

  /// Media items for displaying on spike-tap. Grouped by day internally.
  final List<MediaItem> mediaItems;

  @override
  State<SentimentSection> createState() => _SentimentSectionState();
}

class _SentimentSectionState extends State<SentimentSection>
    with SingleTickerProviderStateMixin {
  late TabController _chartTabController;
  int _touchedPieIndex = -1;

  // Typewriter state
  String _displayedExplanation = '';
  Timer? _typewriterTimer;
  int _charIdx = 0;

  @override
  void initState() {
    super.initState();
    _chartTabController = TabController(length: 3, vsync: this);
    _startTypewriter();
  }

  void _startTypewriter() {
    final text = widget.sentimentData.explanation;
    if (text.isEmpty) return;
    _typewriterTimer = Timer.periodic(AppConstants.typewriterInterval, (t) {
      if (_charIdx < text.length) {
        setState(() {
          _displayedExplanation = text.substring(0, _charIdx + 1);
          _charIdx++;
        });
      } else {
        t.cancel();
      }
    });
  }

  @override
  void dispose() {
    _chartTabController.dispose();
    _typewriterTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final data = widget.sentimentData;

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceCard,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(
              children: [
                const Icon(
                  Icons.insights_rounded,
                  size: 20,
                  color: AppTheme.accent,
                ),
                const SizedBox(width: 8),
                Text('Sentiment Analysis', style: theme.textTheme.titleMedium),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Stat Cards ──────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: _StatCard(
                    label: 'Overall',
                    value: '${data.overallScore.toInt()}',
                    color: sentimentColor(data.overallScore),
                    icon: Icons.speed_rounded,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _StatCard(
                    label: 'Emotion',
                    value: data.dominantEmotion,
                    color: AppTheme.accent,
                    icon: Icons.emoji_emotions_rounded,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _StatCard(
                    label: 'Trend',
                    value: data.trendDirection,
                    color: trendColor(data.trendDirection),
                    icon: trendIcon(data.trendDirection),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ── Source Breakdown (Phase 5) ──────────────────────────
          SourceBreakdown(sentimentData: data),

          // ── Chart TabBar ────────────────────────────────────────
          TabBar(
            controller: _chartTabController,
            indicatorSize: TabBarIndicatorSize.label,
            dividerHeight: 0,
            tabs: const [
              Tab(text: 'Sentiment Split'),
              Tab(text: '7-Day Trend'),
              Tab(text: 'Daily Mentions'),
            ],
          ),
          const SizedBox(height: 8),

          // ── Charts ──────────────────────────────────────────────
          SizedBox(
            height: 250,
            child: TabBarView(
              controller: _chartTabController,
              children: [
                _buildPieChart(data),
                _buildLineChart(data),
                _buildBarChart(data),
              ],
            ),
          ),

          // ── NFR-6: Algorithmically generated indicator ─────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
            child: Row(
              children: [
                Icon(
                  Icons.auto_fix_high_rounded,
                  size: 10,
                  color: AppTheme.warning.withValues(alpha: 0.7),
                ),
                const SizedBox(width: 4),
                Text(
                  'Scores and charts are algorithmically generated',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppTheme.textMuted,
                    fontSize: 9,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),

          // ── Evidence Panel (Phase 2) ───────────────────────────
          if (data.evidence.isNotEmpty) ...[
            const SizedBox(height: 8),
            EvidencePanel(evidence: data.evidence),
          ],

          // ── AI Explanation ──────────────────────────────────────
          if (data.explanation.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Row(
                children: [
                  Icon(
                    Icons.auto_awesome_rounded,
                    size: 16,
                    color: AppTheme.primary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'AI Analysis',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Text(
                _displayedExplanation,
                style: theme.textTheme.bodyMedium?.copyWith(height: 1.6),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Pie Chart ──────────────────────────────────────────────────

  Widget _buildPieChart(SentimentData data) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: PieChart(
              PieChartData(
                pieTouchData: PieTouchData(
                  touchCallback: (event, response) {
                    setState(() {
                      if (!event.isInterestedForInteractions ||
                          response == null ||
                          response.touchedSection == null) {
                        _touchedPieIndex = -1;
                        return;
                      }
                      _touchedPieIndex =
                          response.touchedSection!.touchedSectionIndex;
                    });
                  },
                ),
                sectionsSpace: 3,
                centerSpaceRadius: 32,
                sections: [
                  _pieSection(
                    0,
                    data.positiveRatio * 100,
                    AppTheme.sentimentPositive,
                    'Positive',
                  ),
                  _pieSection(
                    1,
                    data.negativeRatio * 100,
                    AppTheme.sentimentNegative,
                    'Negative',
                  ),
                  _pieSection(
                    2,
                    data.neutralRatio * 100,
                    AppTheme.sentimentNeutral,
                    'Neutral',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 16),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _legendItem(
                'Positive',
                AppTheme.sentimentPositive,
                '${(data.positiveRatio * 100).toStringAsFixed(1)}%',
              ),
              const SizedBox(height: 8),
              _legendItem(
                'Negative',
                AppTheme.sentimentNegative,
                '${(data.negativeRatio * 100).toStringAsFixed(1)}%',
              ),
              const SizedBox(height: 8),
              _legendItem(
                'Neutral',
                AppTheme.sentimentNeutral,
                '${(data.neutralRatio * 100).toStringAsFixed(1)}%',
              ),
            ],
          ),
        ],
      ),
    );
  }

  PieChartSectionData _pieSection(
    int index,
    double value,
    Color color,
    String title,
  ) {
    final isTouched = _touchedPieIndex == index;
    final radius = isTouched ? 55.0 : 45.0;
    final fontSize = isTouched ? 14.0 : 11.0;

    return PieChartSectionData(
      color: color,
      value: value,
      title: '${value.toStringAsFixed(0)}%',
      radius: radius,
      titleStyle: TextStyle(
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
      titlePositionPercentageOffset: 0.55,
    );
  }

  Widget _legendItem(String label, Color color, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
        ),
        const SizedBox(width: 8),
        Text(
          value,
          style: const TextStyle(
            color: AppTheme.textPrimary,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  // ── Line Chart (with spikes + forecast) ────────────────────────

  Widget _buildLineChart(SentimentData data) {
    if (data.trendData.isEmpty) {
      return const Center(child: Text('No trend data available'));
    }

    // Actual data spots
    final spots =
        data.trendData
            .asMap()
            .entries
            .map((e) => FlSpot(e.key.toDouble(), e.value.score))
            .toList();

    // Phase 4: Forecast spots (dashed segment)
    final forecastSpots = <FlSpot>[];
    if (data.forecast.isNotEmpty) {
      // Start from the last actual data point
      final lastIdx = data.trendData.length - 1;
      forecastSpots.add(FlSpot(lastIdx.toDouble(), data.trendData.last.score));
      for (int i = 0; i < data.forecast.length; i++) {
        forecastSpots.add(
          FlSpot((lastIdx + 1 + i).toDouble(), data.forecast[i]),
        );
      }
    }

    final totalPoints = data.trendData.length + data.forecast.length;

    // Phase 1: Collect spike indices
    final spikeIndices = <int>{};
    for (int i = 0; i < data.trendData.length; i++) {
      if (data.trendData[i].isSpike) {
        spikeIndices.add(i);
      }
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 24, 16),
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
                  if (idx < 0 || idx >= totalPoints) {
                    return const SizedBox.shrink();
                  }
                  // Actual data labels
                  if (idx < data.trendData.length) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        data.trendData[idx].date,
                        style: const TextStyle(
                          color: AppTheme.textMuted,
                          fontSize: 10,
                        ),
                      ),
                    );
                  }
                  // Forecast labels
                  final fIdx = idx - data.trendData.length;
                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'F${fIdx + 1}',
                      style: TextStyle(
                        color: AppTheme.accent.withValues(alpha: 0.7),
                        fontSize: 10,
                        fontStyle: FontStyle.italic,
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
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              getTooltipItems: (touchedSpots) {
                return touchedSpots.map((spot) {
                  final idx = spot.x.toInt();
                  String label;
                  if (idx < data.trendData.length) {
                    final day = data.trendData[idx].date;
                    final spikeTag =
                        data.trendData[idx].isSpike ? ' ⚡ SPIKE' : '';
                    label = '$day\n${spot.y.toStringAsFixed(0)}$spikeTag';
                  } else {
                    final fIdx = idx - data.trendData.length;
                    label =
                        'Forecast +${fIdx + 1}\n'
                        '${spot.y.toStringAsFixed(0)}';
                  }
                  return LineTooltipItem(
                    label,
                    const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  );
                }).toList();
              },
            ),
          ),
          lineBarsData: [
            // Actual data line
            LineChartBarData(
              spots: spots,
              isCurved: true,
              color: AppTheme.primary,
              barWidth: 3,
              isStrokeCapRound: true,
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppTheme.primary.withValues(alpha: 0.3),
                    AppTheme.primary.withValues(alpha: 0.0),
                  ],
                ),
              ),
              dotData: FlDotData(
                show: true,
                getDotPainter: (spot, _, __, ___) {
                  final idx = spot.x.toInt();
                  // Phase 1: Spike dots get a red glow
                  if (spikeIndices.contains(idx)) {
                    return FlDotCirclePainter(
                      radius: 6,
                      color: AppTheme.error,
                      strokeWidth: 3,
                      strokeColor: AppTheme.error.withValues(alpha: 0.3),
                    );
                  }
                  return FlDotCirclePainter(
                    radius: 4,
                    color: AppTheme.primary,
                    strokeWidth: 2,
                    strokeColor: Colors.white,
                  );
                },
              ),
            ),
            // Phase 4: Forecast dashed line
            if (forecastSpots.isNotEmpty)
              LineChartBarData(
                spots: forecastSpots,
                isCurved: true,
                color: AppTheme.accent,
                barWidth: 2,
                isStrokeCapRound: true,
                dashArray: [6, 4],
                belowBarData: BarAreaData(show: false),
                dotData: FlDotData(
                  show: true,
                  getDotPainter:
                      (_, __, ___, ____) => FlDotCirclePainter(
                        radius: 3,
                        color: AppTheme.accent,
                        strokeWidth: 1,
                        strokeColor: AppTheme.accent.withValues(alpha: 0.4),
                      ),
                ),
              ),
          ],
          // Extra room on the right for forecast points
          extraLinesData:
              forecastSpots.isNotEmpty
                  ? ExtraLinesData(
                    verticalLines: [
                      VerticalLine(
                        x: (data.trendData.length - 1).toDouble(),
                        color: AppTheme.textMuted.withValues(alpha: 0.3),
                        strokeWidth: 1,
                        dashArray: [4, 4],
                        label: VerticalLineLabel(
                          show: true,
                          alignment: Alignment.topRight,
                          style: TextStyle(
                            fontSize: 8,
                            color: AppTheme.accent.withValues(alpha: 0.7),
                            fontStyle: FontStyle.italic,
                          ),
                          labelResolver: (_) => 'Baseline forecast →',
                        ),
                      ),
                    ],
                  )
                  : null,
        ),
      ),
    );
  }

  // ── Bar Chart ──────────────────────────────────────────────────

  Widget _buildBarChart(SentimentData data) {
    if (data.trendData.isEmpty) {
      return const Center(child: Text('No mention data available'));
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 24, 16),
      child: BarChart(
        BarChartData(
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
                  if (idx < 0 || idx >= data.trendData.length) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      data.trendData[idx].date,
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
          barGroups:
              data.trendData.asMap().entries.map((e) {
                final snapshot = e.value;
                return BarChartGroupData(
                  x: e.key,
                  barRods: [
                    BarChartRodData(
                      toY: snapshot.totalMentions.toDouble(),
                      width: 18,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(4),
                        topRight: Radius.circular(4),
                      ),
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          _emotionColor(
                            snapshot.dominantEmotion,
                          ).withValues(alpha: 0.6),
                          _emotionColor(snapshot.dominantEmotion),
                        ],
                      ),
                    ),
                  ],
                );
              }).toList(),
          barTouchData: BarTouchData(
            touchTooltipData: BarTouchTooltipData(
              getTooltipItem: (group, groupIndex, rod, rodIndex) {
                final snapshot = data.trendData[groupIndex];
                return BarTooltipItem(
                  '${snapshot.date}\n${snapshot.totalMentions} mentions',
                  const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  Color _emotionColor(String emotion) => switch (emotion.toLowerCase()) {
    'joy' || 'admiration' || 'excitement' => AppTheme.sentimentPositive,
    'anger' || 'controversy' => AppTheme.sentimentNegative,
    _ => AppTheme.sentimentNeutral,
  };
}

// ── Stat Card Widget ─────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  final String label;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(height: 6),
          Text(
            value.length > 8 ? '${value.substring(0, 8)}…' : value,
            style: theme.textTheme.titleSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: theme.textTheme.labelSmall,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
