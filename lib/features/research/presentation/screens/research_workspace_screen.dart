/// One research workspace: overview counts, evidence-quality summary,
/// and a filterable/searchable feed of saved items. Statuses
/// (Included/Excluded/Needs Review) and tags are the user's own
/// research decisions — never CritiTrack's verification state.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/utils/research.dart';
import 'package:crititrack/features/research/presentation/providers/research_providers.dart';

class ResearchWorkspaceScreen extends ConsumerStatefulWidget {
  const ResearchWorkspaceScreen({super.key, required this.workspaceId});
  final String workspaceId;

  @override
  ConsumerState<ResearchWorkspaceScreen> createState() => _ResearchWorkspaceScreenState();
}

class _ResearchWorkspaceScreenState extends ConsumerState<ResearchWorkspaceScreen> {
  ResearchItemType? _typeFilter;
  ItemSort _sort = ItemSort.newest;
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(researchRepositoryProvider);
    final workspace = repo.getWorkspace(widget.workspaceId);
    final items = ref.watch(researchItemsProvider(widget.workspaceId));

    if (workspace == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Workspace')),
        body: const Center(child: Text('This workspace was not found.')),
      );
    }

    final counts = overviewCounts(items);
    final quality = evidenceQualitySummary(items);
    final visible = sortResearchItems(
      searchResearchItems(filterItemsByType(items, _typeFilter), _query),
      _sort,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(workspace.title),
        actions: [
          PopupMenuButton<ItemSort>(
            icon: const Icon(Icons.sort),
            tooltip: 'Sort',
            initialValue: _sort,
            onSelected: (s) => setState(() => _sort = s),
            itemBuilder: (context) => const [
              PopupMenuItem(value: ItemSort.newest, child: Text('Newest first')),
              PopupMenuItem(value: ItemSort.oldest, child: Text('Oldest first')),
            ],
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 12,
                    runSpacing: 6,
                    children: [
                      _StatChip('Entities', workspace.entityIds.length),
                      _StatChip('Evidence', counts.evidence),
                      _StatChip('Claims', counts.claims),
                      _StatChip('Events', counts.events),
                      _StatChip('Sources', counts.sources),
                      _StatChip('Notes', counts.notes),
                    ],
                  ),
                  if (quality.evidenceCollected > 0) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Evidence quality: ${quality.highConfidence} high · '
                      '${quality.mediumConfidence} medium · ${quality.lowConfidence} low'
                      '${quality.claimsNeedingReview > 0 ? " · ${quality.claimsNeedingReview} need review" : ""}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Search this workspace…',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (v) => setState(() => _query = v),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  _FilterChip(label: 'All', selected: _typeFilter == null, onTap: () => setState(() => _typeFilter = null)),
                  for (final t in ResearchItemType.values)
                    _FilterChip(
                      label: t.label,
                      selected: _typeFilter == t,
                      onTap: () => setState(() => _typeFilter = t),
                    ),
                ],
              ),
            ),
          ),
          if (visible.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'Nothing here yet. Use "Save to research" on evidence, claims, '
                    'controversies, or events elsewhere in the app to collect them here.',
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            )
          else
            SliverList.builder(
              itemCount: visible.length,
              itemBuilder: (context, i) => _ItemCard(item: visible[i], workspaceId: widget.workspaceId),
            ),
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Statuses and tags are your own research decisions — they never '
                'change CritiTrack\'s own verification state, confidence, or scores.',
                style: TextStyle(fontStyle: FontStyle.italic, fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip(this.label, this.count);
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) => Chip(label: Text('$label: $count'));
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap()),
  );
}

class _ItemCard extends ConsumerStatefulWidget {
  const _ItemCard({required this.item, required this.workspaceId});
  final ResearchItem item;
  final String workspaceId;

  @override
  ConsumerState<_ItemCard> createState() => _ItemCardState();
}

class _ItemCardState extends ConsumerState<_ItemCard> {
  bool _editingNote = false;
  late final TextEditingController _noteController = TextEditingController(text: widget.item.note);

  @override
  Widget build(BuildContext context) {
    final controller = ref.read(researchItemsProvider(widget.workspaceId).notifier);
    final item = widget.item;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Chip(label: Text(item.type.label), visualDensity: VisualDensity.compact),
                const SizedBox(width: 8),
                Expanded(child: Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600))),
              ],
            ),
            if (item.summary.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(item.summary, style: Theme.of(context).textTheme.bodySmall),
            ],
            if (item.metadata['confidence'] != null) ...[
              const SizedBox(height: 4),
              Text('CritiTrack confidence: ${item.metadata['confidence']}', style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 8),
            DropdownButton<FindingStatus>(
              value: item.status,
              isDense: true,
              items: [
                for (final s in FindingStatus.values) DropdownMenuItem(value: s, child: Text(s.label)),
              ],
              onChanged: (s) {
                if (s != null) controller.setStatus(item.itemId, s);
              },
            ),
            Wrap(
              spacing: 6,
              children: [
                for (final t in item.tags)
                  InputChip(label: Text(t), onDeleted: () => controller.removeTag(item.itemId, t)),
              ],
            ),
            if (_editingNote)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(controller: _noteController, minLines: 1, maxLines: 3),
                  Row(
                    children: [
                      TextButton(
                        onPressed: () {
                          controller.setNote(item.itemId, _noteController.text);
                          setState(() => _editingNote = false);
                        },
                        child: const Text('Save note'),
                      ),
                      TextButton(onPressed: () => setState(() => _editingNote = false), child: const Text('Cancel')),
                    ],
                  ),
                ],
              )
            else if (item.note.isNotEmpty)
              GestureDetector(
                onTap: () => setState(() => _editingNote = true),
                child: Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Research note: ', style: TextStyle(fontWeight: FontWeight.w600)),
                      TextSpan(text: item.note),
                    ],
                  ),
                ),
              )
            else
              TextButton(onPressed: () => setState(() => _editingNote = true), child: const Text('+ Add research note')),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => controller.remove(item.itemId),
                icon: const Icon(Icons.close, size: 16),
                label: const Text('Remove'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
