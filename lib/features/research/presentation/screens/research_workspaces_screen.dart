/// Research Workspace list — private, local-first investigation
/// workspaces (see `core/utils/research.dart` and
/// `data/research_repository.dart`). Pull-to-refresh merges anything
/// saved on another device signed into the same account; there is no
/// separate "sync" button.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:crititrack/core/utils/research.dart';
import 'package:crititrack/features/research/presentation/providers/research_providers.dart';

class ResearchWorkspacesScreen extends ConsumerStatefulWidget {
  const ResearchWorkspacesScreen({super.key});

  @override
  ConsumerState<ResearchWorkspacesScreen> createState() => _ResearchWorkspacesScreenState();
}

class _ResearchWorkspacesScreenState extends ConsumerState<ResearchWorkspacesScreen> {
  @override
  void initState() {
    super.initState();
    // Best-effort — does nothing when signed out, never blocks first paint.
    ref.read(researchWorkspacesProvider.notifier).syncFromCloud();
  }

  Future<void> _createWorkspace() async {
    final controller = TextEditingController();
    final title = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('New research workspace'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Title (optional)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Create')),
        ],
      ),
    );
    if (title == null) return;
    final workspace = await ref.read(researchWorkspacesProvider.notifier).create(title: title.trim());
    if (!mounted) return;
    context.push('/research/${workspace.workspaceId}');
  }

  @override
  Widget build(BuildContext context) {
    final workspaces = ref.watch(researchWorkspacesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Research Workspace')),
      floatingActionButton: FloatingActionButton(
        onPressed: _createWorkspace,
        tooltip: 'New workspace',
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(researchWorkspacesProvider.notifier).syncFromCloud(),
        child: workspaces.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 80),
                  Icon(Icons.travel_explore_outlined, size: 48),
                  SizedBox(height: 12),
                  Text(
                    'No research workspaces yet',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Create one here, or use "Save to research" on any evidence, '
                    'claim, controversy, or event on a profile. Private to this '
                    'device unless you sign in to sync it.',
                    textAlign: TextAlign.center,
                  ),
                ],
              )
            : ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: workspaces.length,
                itemBuilder: (context, i) {
                  final w = workspaces[i];
                  return Dismissible(
                    key: ValueKey(w.workspaceId),
                    direction: DismissDirection.endToStart,
                    background: Container(
                      color: Theme.of(context).colorScheme.errorContainer,
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 20),
                      child: const Icon(Icons.delete_outline),
                    ),
                    confirmDismiss: (_) => showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: Text('Delete "${w.title}"?'),
                        content: const Text('This removes everything saved in it.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
                        ],
                      ),
                    ).then((v) => v ?? false),
                    onDismissed: (_) => ref.read(researchWorkspacesProvider.notifier).remove(w.workspaceId),
                    child: ListTile(
                      title: Text(w.title),
                      subtitle: Text(
                        w.description.isNotEmpty
                            ? w.description
                            : '${w.entityIds.length} entit${w.entityIds.length == 1 ? 'y' : 'ies'}'
                                '${w.status == WorkspaceStatus.archived ? ' · archived' : ''}',
                      ),
                      trailing: IconButton(
                        icon: Icon(w.status == WorkspaceStatus.active ? Icons.archive_outlined : Icons.unarchive_outlined),
                        tooltip: w.status == WorkspaceStatus.active ? 'Archive' : 'Reactivate',
                        onPressed: () => w.status == WorkspaceStatus.active
                            ? ref.read(researchWorkspacesProvider.notifier).archive(w)
                            : ref.read(researchWorkspacesProvider.notifier).reactivate(w),
                      ),
                      onTap: () => context.push('/research/${w.workspaceId}'),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
