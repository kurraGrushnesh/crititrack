/// "Save to research" (Step 19, spec section 23): one tap opens a short
/// list of existing workspaces plus "New workspace"; picking one saves
/// immediately. Drop this on any evidence, claim, controversy, or event
/// card — pass a stable `referenceId` so saving the same thing twice
/// never duplicates (see `core/utils/research.dart`'s `stableItemKey`).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/utils/research.dart';
import 'package:crititrack/features/research/presentation/providers/research_providers.dart';

class SaveToResearchButton extends ConsumerStatefulWidget {
  const SaveToResearchButton({
    super.key,
    required this.type,
    this.entityId,
    required this.title,
    this.summary = '',
    this.referenceId,
    this.metadata = const {},
  });

  final ResearchItemType type;
  final String? entityId;
  final String title;
  final String summary;
  final String? referenceId;
  final Map<String, Object?> metadata;

  @override
  ConsumerState<SaveToResearchButton> createState() => _SaveToResearchButtonState();
}

class _SaveToResearchButtonState extends ConsumerState<SaveToResearchButton> {
  String? _savedTo;

  Future<void> _pick(BuildContext context) async {
    final workspaces = ref.read(researchWorkspacesProvider).where((w) => w.status == WorkspaceStatus.active).toList();
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final w in workspaces.take(6))
              ListTile(title: Text(w.title), onTap: () => Navigator.pop(context, w.workspaceId)),
            ListTile(
              leading: const Icon(Icons.add),
              title: const Text('New workspace'),
              onTap: () => Navigator.pop(context, '_new'),
            ),
          ],
        ),
      ),
    );
    if (choice == null || !context.mounted) return;

    final controller = ref.read(researchWorkspacesProvider.notifier);
    final workspaceId = choice == '_new'
        ? (await controller.create(entityNames: widget.type == ResearchItemType.entity ? [widget.title] : const [])).workspaceId
        : choice;
    await controller.saveItem(
      workspaceId,
      type: widget.type,
      entityId: widget.entityId,
      title: widget.title,
      summary: widget.summary,
      referenceId: widget.referenceId,
      metadata: widget.metadata,
    );
    final workspace = ref.read(researchWorkspacesProvider).firstWhere((w) => w.workspaceId == workspaceId);
    if (mounted) setState(() => _savedTo = workspace.title);
  }

  @override
  Widget build(BuildContext context) {
    if (_savedTo != null) {
      return Chip(avatar: const Icon(Icons.check, size: 16), label: Text('Saved to $_savedTo'));
    }
    return OutlinedButton.icon(
      onPressed: () => _pick(context),
      icon: const Icon(Icons.bookmark_add_outlined, size: 16),
      label: const Text('Save to research'),
    );
  }
}
