/// One Professional Research Report: a document-style scrolling view
/// with per-section visibility toggles. Generation reuses the same
/// deterministic `generateReport` the web uses — see
/// `core/utils/report.dart` — from the workspace's currently-Included
/// items.
///
/// Known limitation, disclosed rather than hidden: this screen
/// generates from workspace items only. The web report additionally
/// fetches each entity's live profile to enrich Scope & Entities, Data
/// Coverage, and the Sentiment/CritiScore/Attention History sections;
/// wiring an equivalent "fetch a profile by resolved id" path into the
/// mobile report flow is not yet built, so those sections are simply
/// omitted here rather than approximated.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/utils/report.dart';
import 'package:crititrack/features/research/presentation/providers/report_providers.dart';
import 'package:crititrack/features/research/presentation/providers/research_providers.dart';

const Map<ContentBlockKind, String> _kBlockLabel = {
  ContentBlockKind.fact: '',
  ContentBlockKind.analysis: 'Analysis',
  ContentBlockKind.userNote: 'Research note',
  ContentBlockKind.limitation: 'Limitation',
};

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key, required this.reportId});
  final String reportId;

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  bool _generating = false;

  Future<void> _generate(String workspaceId) async {
    setState(() => _generating = true);
    try {
      final items = ref.read(researchItemsProvider(workspaceId));
      // Entity-level canonical enrichment (coverage/historical/current
      // scores) is not wired into this screen yet — see the file doc
      // comment. Generation still runs correctly from the items alone.
      await ref.read(reportViewProvider(widget.reportId).notifier).generate(
        items: items,
        entities: const <EntityReportContext>[],
      );
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final view = ref.watch(reportViewProvider(widget.reportId));

    if (view == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Report')),
        body: const Center(child: Text('This report was not found.')),
      );
    }

    final report = view.report;
    final sections = [...view.sections]..sort((a, b) => a.order.compareTo(b.order));

    return Scaffold(
      appBar: AppBar(
        title: Text(report.title),
        actions: [
          IconButton(
            icon: const Icon(Icons.archive_outlined),
            tooltip: 'Archive report',
            onPressed: () => ref.read(reportViewProvider(widget.reportId).notifier).archive(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _generate(report.workspaceId),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Status: ${report.status.name} · v${report.version}'
              '${report.generatedAt != null ? " · generated ${report.generatedAt}" : ""}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _generating ? null : () => _generate(report.workspaceId),
              icon: _generating
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.refresh),
              label: Text(_generating ? 'Generating…' : 'Refresh report from workspace'),
            ),
            const SizedBox(height: 20),
            if (report.status == ReportStatus.draft && sections.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  'Not generated yet. Tap "Refresh report from workspace" to build sections '
                  'from this workspace\'s Included items.',
                  textAlign: TextAlign.center,
                ),
              ),
            for (final s in sections) _SectionCard(reportId: widget.reportId, section: s),
            const SizedBox(height: 16),
            const Text(
              'This report presents existing CritiTrack records selected from a research '
              'workspace. It never overwrites verification, confidence, or scores — every fact '
              'traces back to a source or record, and every research note is the user\'s own '
              'words, clearly labeled.',
              style: TextStyle(fontStyle: FontStyle.italic, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends ConsumerWidget {
  const _SectionCard({required this.reportId, required this.section});
  final String reportId;
  final ReportSection section;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(section.title, style: Theme.of(context).textTheme.titleMedium)),
                TextButton(
                  onPressed: () => ref.read(reportViewProvider(reportId).notifier).toggleSectionVisibility(section.sectionId),
                  child: Text(section.visible ? 'Hide' : 'Show'),
                ),
              ],
            ),
            if (section.visible)
              for (final b in section.blocks)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: RichText(
                    text: TextSpan(
                      style: DefaultTextStyle.of(context).style,
                      children: [
                        if (_kBlockLabel[b.kind]!.isNotEmpty)
                          TextSpan(
                            text: '${_kBlockLabel[b.kind]}: ',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        TextSpan(
                          text: b.text,
                          style: b.kind == ContentBlockKind.limitation
                              ? const TextStyle(fontStyle: FontStyle.italic)
                              : null,
                        ),
                        if (b.citationIds.isNotEmpty)
                          TextSpan(
                            text: ' ${b.citationIds.map((n) => "[$n]").join(" ")}',
                            style: const TextStyle(fontWeight: FontWeight.w600),
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
}
