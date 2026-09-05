/// Riverpod wiring for Research Workspaces — same shape as
/// `watchlist_providers.dart`: a repository provider plus one
/// [Notifier] per screen's concern, all reading through
/// [ResearchRepository] so Hive stays the single source of truth and
/// Firestore stays a best-effort mirror.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/utils/research.dart';
import 'package:crititrack/features/research/data/research_repository.dart';

final researchRepositoryProvider = Provider<ResearchRepository>((ref) => ResearchRepository());

/// The workspace list — most recently updated first.
final researchWorkspacesProvider = NotifierProvider<ResearchWorkspacesController, List<ResearchWorkspace>>(
  ResearchWorkspacesController.new,
);

class ResearchWorkspacesController extends Notifier<List<ResearchWorkspace>> {
  ResearchRepository get _repo => ref.read(researchRepositoryProvider);

  @override
  List<ResearchWorkspace> build() => _repo.allWorkspaces();

  Future<ResearchWorkspace> create({List<String> entityNames = const [], String? title}) async {
    final now = DateTime.now();
    final workspaceId = 'ws-${now.microsecondsSinceEpoch}';
    final workspace = createWorkspace(
      workspaceId: workspaceId,
      // Cosmetic only: the Firestore mirror path is built from the
      // signed-in uid at write time (see ResearchRepository), not from
      // this field, so a workspace created before sign-in still mirrors
      // correctly once a uid exists.
      userId: 'local',
      entityNames: entityNames,
      title: title,
      now: now,
    );
    await _repo.saveWorkspace(workspace);
    await _repo.appendActivity(
      recordActivity(
        activityId: 'created-${now.microsecondsSinceEpoch}',
        workspaceId: workspaceId,
        kind: ActivityKind.workspaceCreated,
        summary: 'Created "${workspace.title}"',
        now: now,
      ),
    );
    state = _repo.allWorkspaces();
    return workspace;
  }

  Future<void> archive(ResearchWorkspace w) async {
    await _repo.saveWorkspace(archiveWorkspace(w, DateTime.now()));
    state = _repo.allWorkspaces();
  }

  Future<void> reactivate(ResearchWorkspace w) async {
    await _repo.saveWorkspace(reactivateWorkspace(w, DateTime.now()));
    state = _repo.allWorkspaces();
  }

  Future<void> remove(String workspaceId) async {
    await _repo.deleteWorkspace(workspaceId);
    state = _repo.allWorkspaces();
  }

  /// Pulls in anything saved on another device signed into the same
  /// account. Safe to call on start: it merges, never overwrites.
  Future<void> syncFromCloud() async {
    await _repo.mergeFromCloud();
    state = _repo.allWorkspaces();
  }

  /// The fast "save to research" path, usable from any screen. Returns
  /// whether this was a genuinely new item (false when an existing
  /// (type, referenceId) was refreshed instead of duplicated).
  Future<bool> saveItem(
    String workspaceId, {
    required ResearchItemType type,
    String? entityId,
    required String title,
    String summary = '',
    String? referenceId,
    Map<String, Object?> metadata = const {},
  }) async {
    final now = DateTime.now();
    final existing = referenceId != null ? _repo.findItemByReference(workspaceId, type, referenceId) : null;
    final item = buildResearchItem(
      itemId: existing?.itemId ?? '$workspaceId-${now.microsecondsSinceEpoch}',
      workspaceId: workspaceId,
      type: type,
      entityId: entityId,
      title: title,
      summary: summary,
      referenceId: referenceId,
      metadata: metadata,
      now: now,
    );
    await _repo.upsertItem(item);
    await _repo.appendActivity(
      recordActivity(
        activityId: 'item-${item.itemId}-${now.microsecondsSinceEpoch}',
        workspaceId: workspaceId,
        kind: ActivityKind.itemAdded,
        summary: existing != null ? 'Refreshed "${item.title}"' : 'Added ${type.label.toLowerCase()}: "${item.title}"',
        now: now,
      ),
    );
    // Bump the workspace's own updatedAt so it resorts to the top.
    final workspace = _repo.getWorkspace(workspaceId);
    if (workspace != null) await _repo.saveWorkspace(workspace.copyWith(updatedAt: now));
    state = _repo.allWorkspaces();
    return existing == null;
  }
}

/// One workspace's items — a family keyed by workspaceId, so several
/// workspace screens can be open (e.g. during navigation) without
/// sharing state.
final researchItemsProvider = NotifierProvider.family<ResearchItemsController, List<ResearchItem>, String>(
  ResearchItemsController.new,
);

class ResearchItemsController extends FamilyNotifier<List<ResearchItem>, String> {
  ResearchRepository get _repo => ref.read(researchRepositoryProvider);
  String get _workspaceId => arg;

  @override
  List<ResearchItem> build(String arg) => _repo.itemsFor(arg);

  Future<void> remove(String itemId) async {
    await _repo.removeItem(_workspaceId, itemId);
    state = _repo.itemsFor(_workspaceId);
  }

  Future<void> setStatus(String itemId, FindingStatus status) async {
    final next = setItemStatus(state, itemId, status, DateTime.now());
    state = next;
    final changed = next.firstWhere((i) => i.itemId == itemId);
    await _repo.upsertItem(changed);
  }

  Future<void> setNote(String itemId, String note) async {
    final next = setItemNote(state, itemId, note, DateTime.now());
    state = next;
    final changed = next.firstWhere((i) => i.itemId == itemId);
    await _repo.upsertItem(changed);
  }

  Future<void> addTag(String itemId, String tag) async {
    final next = addResearchTag(state, itemId, tag, DateTime.now());
    state = next;
    final changed = next.firstWhere((i) => i.itemId == itemId);
    await _repo.upsertItem(changed);
  }

  Future<void> removeTag(String itemId, String tag) async {
    final next = removeResearchTag(state, itemId, tag, DateTime.now());
    state = next;
    final changed = next.firstWhere((i) => i.itemId == itemId);
    await _repo.upsertItem(changed);
  }
}
