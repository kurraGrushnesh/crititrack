/// One saved comparison: entity headers, key differences, filterable
/// sections, and turning points. Sections/rows are exactly `compare.dart`'s
/// `buildComparison` output — this screen only renders them.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/utils/compare.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/core/utils/historical.dart';
import 'package:crititrack/core/utils/relationships.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:crititrack/features/research/presentation/providers/compare_providers.dart';

class CompareViewScreen extends ConsumerWidget {
  const CompareViewScreen({super.key, required this.comparisonId});
  final String comparisonId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final comparison = ref.watch(comparisonViewProvider(comparisonId));
    if (comparison == null) {
      return Scaffold(appBar: AppBar(title: const Text('Compare')), body: const Center(child: Text('This comparison was not found.')));
    }

    final slugA = toSlug(comparison.entityIds.first);
    final slugB = comparison.entityIds.length > 1 ? toSlug(comparison.entityIds[1]) : slugA;
    final asyncA = ref.watch(dashboardProvider(slugA));
    final asyncB = ref.watch(dashboardProvider(slugB));

    return Scaffold(
      appBar: AppBar(title: Text(comparison.title)),
      body: asyncA.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load: $e')),
        data: (celebrityA) => asyncB.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Could not load: $e')),
          data: (celebrityB) {
            final contextA = buildEntityContextFromCelebrity(celebrityA);
            final contextB = buildEntityContextFromCelebrity(celebrityB);
            final sections = buildComparison(
              a: contextA,
              b: contextB,
              filters: comparison.filters,
              timeRange: comparison.timeRange,
            );
            final diffs = keyDifferences(sections);
            final points = turningPointsFor(contextA, contextB);
            final directRels = directRelationshipsBetween(contextA.relationships, contextB.entityId, contextB.entityName);
            final shared = sharedConnections(contextA.relationships, contextB.relationships);

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    Expanded(child: _EntityCard(context: contextA)),
                    const SizedBox(width: 12),
                    Expanded(child: _EntityCard(context: contextB)),
                  ],
                ),
                const SizedBox(height: 16),
                const Text('Relationship', style: TextStyle(fontWeight: FontWeight.bold)),
                if (directRels.isNotEmpty)
                  for (final r in directRels)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        '${contextA.entityName} — ${relationshipTypeLabel(r.relationshipType)} — ${contextB.entityName} · ${r.confidence.name} confidence',
                      ),
                    )
                else
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text('No documented direct relationship found in the available data.'),
                  ),
                if (shared.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Shared organization${shared.length == 1 ? "" : "s"}: '
                      '${shared.map((s) => "${s.organizationName} (${relationshipTypeLabel(s.aType)} / ${relationshipTypeLabel(s.bType)})").join("; ")}. '
                      'This is a shared affiliation, not a direct relationship.',
                      style: const TextStyle(fontStyle: FontStyle.italic, fontSize: 12),
                    ),
                  ),
                if (diffs.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text('Key differences', style: TextStyle(fontWeight: FontWeight.bold)),
                  for (final d in diffs) Padding(padding: const EdgeInsets.only(top: 4), child: Text('• $d')),
                ],
                const SizedBox(height: 16),
                _FilterRow(comparisonId: comparisonId),
                const SizedBox(height: 16),
                if (sections.isEmpty)
                  const Text('No comparison data matches the current filters.')
                else
                  for (final s in sections) _SectionCard(section: s, nameA: contextA.entityName, nameB: contextB.entityName),
                const SizedBox(height: 16),
                if (points.any((p) => p.points.isNotEmpty)) ...[
                  const Text('Turning points', style: TextStyle(fontWeight: FontWeight.bold)),
                  for (final p in points)
                    if (p.points.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(p.entityName, style: const TextStyle(fontWeight: FontWeight.w600)),
                            for (final tp in p.points) Text('${tp.date} — ${tp.title}'),
                          ],
                        ),
                      ),
                ],
                const SizedBox(height: 16),
                const Text(
                  'This comparison describes real differences in CritiTrack\'s existing intelligence — '
                  'it never ranks who is "better", and unequal data coverage is disclosed rather than '
                  'treated as a result.',
                  style: TextStyle(fontStyle: FontStyle.italic, fontSize: 12),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _EntityCard extends StatelessWidget {
  const _EntityCard({required this.context});
  final EntityComparisonContext context;

  @override
  Widget build(BuildContext buildContext) {
    final c = context;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(c.entityName, style: const TextStyle(fontWeight: FontWeight.bold)),
            if (c.profession != null) Text(c.profession!),
            if (c.currentRole != null) Text(c.currentRole!),
            Text('CritiScore: ${c.critiScore != null ? c.critiScore!.round() : "Unavailable"}${c.critiScoreBandLabel != null ? " (${c.critiScoreBandLabel})" : ""}'),
            Text('Sentiment: ${c.sentimentScore != null ? c.sentimentScore!.round() : "Unavailable"}${c.sentimentBandLabel != null ? " (${c.sentimentBandLabel})" : ""}'),
          ],
        ),
      ),
    );
  }
}

class _FilterRow extends ConsumerWidget {
  const _FilterRow({required this.comparisonId});
  final String comparisonId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final comparison = ref.watch(comparisonViewProvider(comparisonId))!;
    final controller = ref.read(comparisonViewProvider(comparisonId).notifier);
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        DropdownButton<ComparisonTopic>(
          value: comparison.filters.topic,
          items: [for (final t in ComparisonTopic.values) DropdownMenuItem(value: t, child: Text(t.name))],
          onChanged: (t) {
            if (t != null) controller.setTopic(t);
          },
        ),
        DropdownButton<ComparisonDataMode>(
          value: comparison.filters.dataMode,
          items: [for (final m in ComparisonDataMode.values) DropdownMenuItem(value: m, child: Text(m.name))],
          onChanged: (m) {
            if (m != null) controller.setDataMode(m);
          },
        ),
        DropdownButton<HistoricalTimeRange>(
          value: comparison.timeRange,
          items: [for (final r in HistoricalTimeRange.values) DropdownMenuItem(value: r, child: Text(r.label))],
          onChanged: (r) {
            if (r != null) controller.setTimeRange(r);
          },
        ),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.section, required this.nameA, required this.nameB});
  final ComparisonSection section;
  final String nameA;
  final String nameB;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(top: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(section.title, style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            for (final r in section.rows)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r.metric, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    Text('$nameA: ${r.valueA}   ·   $nameB: ${r.valueB}', style: const TextStyle(fontSize: 13)),
                    if (r.note != null) Text(r.note!, style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic)),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
