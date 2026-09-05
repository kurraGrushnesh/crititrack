/// Research Workspace — the Dart twin of `site/lib/research.ts`. Turns
/// CritiTrack from "search and read" into "search → investigate →
/// collect evidence → analyze → organize". Every item is a reference to
/// something another system already produced (an evidence item, a
/// claim, a controversy, a change event, a resolved entity) plus the
/// user's own annotation (a note, a tag, an include/exclude/needs-review
/// decision). None of that annotation ever writes back to, or is
/// presented as, the authoritative record it references.
///
/// Pure and storage-agnostic, same as every other `core/utils` model in
/// this app: no Hive, no Firestore, no `DateTime.now()` baked into an
/// export (every function that needs "now" takes it as a parameter).
/// `features/research/data/research_repository.dart` wires this to
/// actual persistence.
library;

const String kResearchMethodologyVersion = 'research-1';

// ── Workspace ─────────────────────────────────────────────────────────

enum WorkspaceStatus { active, archived }

class ResearchWorkspace {
  const ResearchWorkspace({
    required this.workspaceId,
    required this.userId,
    required this.title,
    required this.description,
    required this.createdAt,
    required this.updatedAt,
    required this.entityIds,
    required this.status,
    required this.tags,
    required this.lastOpenedAt,
  });

  final String workspaceId;
  final String userId;
  final String title;
  final String description;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<String> entityIds;
  final WorkspaceStatus status;
  final List<String> tags;
  final DateTime? lastOpenedAt;

  ResearchWorkspace copyWith({
    String? title,
    String? description,
    DateTime? updatedAt,
    List<String>? entityIds,
    WorkspaceStatus? status,
    List<String>? tags,
    DateTime? lastOpenedAt,
  }) => ResearchWorkspace(
    workspaceId: workspaceId,
    userId: userId,
    title: title ?? this.title,
    description: description ?? this.description,
    createdAt: createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    entityIds: entityIds ?? this.entityIds,
    status: status ?? this.status,
    tags: tags ?? this.tags,
    lastOpenedAt: lastOpenedAt ?? this.lastOpenedAt,
  );

  Map<String, dynamic> toMap() => {
    'workspaceId': workspaceId,
    'userId': userId,
    'title': title,
    'description': description,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'entityIds': entityIds,
    'status': status.name,
    'tags': tags,
    'lastOpenedAt': lastOpenedAt?.toIso8601String(),
  };

  static ResearchWorkspace? fromMap(Map<dynamic, dynamic>? map) {
    if (map == null) return null;
    final workspaceId = map['workspaceId'];
    final userId = map['userId'];
    final createdAt = DateTime.tryParse('${map['createdAt']}');
    final updatedAt = DateTime.tryParse('${map['updatedAt']}');
    if (workspaceId is! String || userId is! String || createdAt == null || updatedAt == null) {
      return null;
    }
    return ResearchWorkspace(
      workspaceId: workspaceId,
      userId: userId,
      title: (map['title'] as String?)?.trim() ?? 'Untitled research',
      description: (map['description'] as String?) ?? '',
      createdAt: createdAt,
      updatedAt: updatedAt,
      entityIds: (map['entityIds'] as List?)?.whereType<String>().toList() ?? const [],
      status: map['status'] == 'archived' ? WorkspaceStatus.archived : WorkspaceStatus.active,
      tags: (map['tags'] as List?)?.whereType<String>().toList() ?? const [],
      lastOpenedAt: DateTime.tryParse('${map['lastOpenedAt']}'),
    );
  }
}

String titleForEntities(List<String> names) {
  if (names.isEmpty) return 'Untitled research';
  if (names.length == 1) return 'Research — ${names.first}';
  if (names.length == 2) return 'Compare ${names[0]} and ${names[1]}';
  return 'Research — ${names.join(', ')}';
}

ResearchWorkspace createWorkspace({
  required String workspaceId,
  required String userId,
  List<String> entityIds = const [],
  List<String> entityNames = const [],
  String? title,
  String description = '',
  required DateTime now,
}) => ResearchWorkspace(
  workspaceId: workspaceId,
  userId: userId,
  title: (title?.trim().isNotEmpty ?? false) ? title!.trim() : titleForEntities(entityNames),
  description: description.trim(),
  createdAt: now,
  updatedAt: now,
  entityIds: entityIds,
  status: WorkspaceStatus.active,
  tags: const [],
  lastOpenedAt: now,
);

ResearchWorkspace renameWorkspace(ResearchWorkspace w, String title, DateTime now) {
  final trimmed = title.trim();
  if (trimmed.isEmpty) return w;
  return w.copyWith(title: trimmed, updatedAt: now);
}

ResearchWorkspace updateWorkspaceDescription(ResearchWorkspace w, String description, DateTime now) =>
    w.copyWith(description: description.trim(), updatedAt: now);

ResearchWorkspace setWorkspaceStatus(ResearchWorkspace w, WorkspaceStatus status, DateTime now) {
  if (w.status == status) return w;
  return w.copyWith(status: status, updatedAt: now);
}

ResearchWorkspace archiveWorkspace(ResearchWorkspace w, DateTime now) => setWorkspaceStatus(w, WorkspaceStatus.archived, now);

ResearchWorkspace reactivateWorkspace(ResearchWorkspace w, DateTime now) => setWorkspaceStatus(w, WorkspaceStatus.active, now);

ResearchWorkspace markWorkspaceOpened(ResearchWorkspace w, DateTime now) => w.copyWith(lastOpenedAt: now);

ResearchWorkspace addEntityToWorkspace(ResearchWorkspace w, String entityId, DateTime now) {
  if (w.entityIds.contains(entityId)) return w;
  return w.copyWith(entityIds: [...w.entityIds, entityId], updatedAt: now);
}

ResearchWorkspace removeEntityFromWorkspace(ResearchWorkspace w, String entityId, DateTime now) {
  if (!w.entityIds.contains(entityId)) return w;
  return w.copyWith(entityIds: w.entityIds.where((id) => id != entityId).toList(), updatedAt: now);
}

// ── Items ───────────────────────────────────────────────────────────

enum ResearchItemType {
  entity,
  evidence,
  claim,
  controversy,
  newsEvent,
  timelineEvent,
  changeEvent,
  historicalEvent,
  relationship,
  source,
  note,
}

extension ResearchItemTypeLabel on ResearchItemType {
  String get label => switch (this) {
    ResearchItemType.entity => 'Entity',
    ResearchItemType.evidence => 'Evidence',
    ResearchItemType.claim => 'Claim',
    ResearchItemType.controversy => 'Controversy',
    ResearchItemType.newsEvent => 'News event',
    ResearchItemType.timelineEvent => 'Timeline event',
    ResearchItemType.changeEvent => 'Change event',
    ResearchItemType.historicalEvent => 'Historical event',
    ResearchItemType.relationship => 'Relationship',
    ResearchItemType.source => 'Source',
    ResearchItemType.note => 'Note',
  };
}

/// A workspace-level decision, distinct from — and never overwriting —
/// CritiTrack's own verification/coverage/confidence state.
enum FindingStatus { undecided, included, excluded, needsReview }

extension FindingStatusLabel on FindingStatus {
  String get label => switch (this) {
    FindingStatus.undecided => 'Undecided',
    FindingStatus.included => 'Included',
    FindingStatus.excluded => 'Excluded',
    FindingStatus.needsReview => 'Needs review',
  };
}

class ResearchItem {
  const ResearchItem({
    required this.itemId,
    required this.workspaceId,
    required this.type,
    required this.entityId,
    required this.title,
    required this.summary,
    required this.referenceId,
    required this.addedAt,
    required this.updatedAt,
    required this.note,
    required this.tags,
    required this.position,
    required this.status,
    required this.metadata,
  });

  final String itemId;
  final String workspaceId;
  final ResearchItemType type;
  final String? entityId;
  final String title;
  final String summary;
  final String? referenceId;
  final DateTime addedAt;
  final DateTime updatedAt;
  final String note;
  final List<String> tags;
  final int position;
  final FindingStatus status;

  /// A shallow, disclosed snapshot of whatever fields the canonical
  /// record carried at add-time. Never re-synced automatically.
  final Map<String, Object?> metadata;

  ResearchItem copyWith({
    String? title,
    String? summary,
    String? entityId,
    DateTime? updatedAt,
    String? note,
    List<String>? tags,
    int? position,
    FindingStatus? status,
    Map<String, Object?>? metadata,
  }) => ResearchItem(
    itemId: itemId,
    workspaceId: workspaceId,
    type: type,
    entityId: entityId ?? this.entityId,
    title: title ?? this.title,
    summary: summary ?? this.summary,
    referenceId: referenceId,
    addedAt: addedAt,
    updatedAt: updatedAt ?? this.updatedAt,
    note: note ?? this.note,
    tags: tags ?? this.tags,
    position: position ?? this.position,
    status: status ?? this.status,
    metadata: metadata ?? this.metadata,
  );

  Map<String, dynamic> toMap() => {
    'itemId': itemId,
    'workspaceId': workspaceId,
    'type': type.name,
    'entityId': entityId,
    'title': title,
    'summary': summary,
    'referenceId': referenceId,
    'addedAt': addedAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'note': note,
    'tags': tags,
    'position': position,
    'status': status.name,
    'metadata': metadata,
  };

  static ResearchItemType _typeFromName(Object? name) {
    return ResearchItemType.values.firstWhere(
      (t) => t.name == name,
      orElse: () => ResearchItemType.note,
    );
  }

  static FindingStatus _statusFromName(Object? name) {
    return FindingStatus.values.firstWhere(
      (s) => s.name == name,
      orElse: () => FindingStatus.undecided,
    );
  }

  static ResearchItem? fromMap(Map<dynamic, dynamic>? map) {
    if (map == null) return null;
    final itemId = map['itemId'];
    final workspaceId = map['workspaceId'];
    final addedAt = DateTime.tryParse('${map['addedAt']}');
    final updatedAt = DateTime.tryParse('${map['updatedAt']}');
    if (itemId is! String || workspaceId is! String || addedAt == null || updatedAt == null) {
      return null;
    }
    return ResearchItem(
      itemId: itemId,
      workspaceId: workspaceId,
      type: _typeFromName(map['type']),
      entityId: map['entityId'] as String?,
      title: (map['title'] as String?) ?? '',
      summary: (map['summary'] as String?) ?? '',
      referenceId: map['referenceId'] as String?,
      addedAt: addedAt,
      updatedAt: updatedAt,
      note: (map['note'] as String?) ?? '',
      tags: (map['tags'] as List?)?.whereType<String>().toList() ?? const [],
      position: (map['position'] as num?)?.toInt() ?? 0,
      status: _statusFromName(map['status']),
      metadata: (map['metadata'] as Map?)?.cast<String, Object?>() ?? const {},
    );
  }
}

/// The identity used as a stable document id for de-duplication: the
/// same canonical reference added twice becomes one item whose metadata
/// is refreshed, never a second row. A NOTE has no reference, so it
/// always keeps its own id.
String? stableItemKey(ResearchItemType type, String? referenceId) {
  if (referenceId == null) return null;
  return '${type.name}:$referenceId';
}

ResearchItem buildResearchItem({
  required String itemId,
  required String workspaceId,
  required ResearchItemType type,
  String? entityId,
  required String title,
  String summary = '',
  String? referenceId,
  String note = '',
  List<String> tags = const [],
  Map<String, Object?> metadata = const {},
  required DateTime now,
}) => ResearchItem(
  itemId: itemId,
  workspaceId: workspaceId,
  type: type,
  entityId: entityId,
  title: title,
  summary: summary,
  referenceId: referenceId,
  addedAt: now,
  updatedAt: now,
  note: note,
  tags: normalizeResearchTags(tags),
  position: 0,
  status: FindingStatus.undecided,
  metadata: metadata,
);

class AddItemResult {
  const AddItemResult(this.items, this.added);
  final List<ResearchItem> items;
  final bool added;
}

/// Adds an item to a list, enforcing "the same reference is never
/// accidentally duplicated": if an item with the same (type, referenceId)
/// already exists, its metadata/title/summary are refreshed in place
/// (position and user annotations — note, tags, status — are preserved).
AddItemResult addResearchItem(List<ResearchItem> items, ResearchItem next) {
  final key = stableItemKey(next.type, next.referenceId);
  if (key != null) {
    final index = items.indexWhere((i) => stableItemKey(i.type, i.referenceId) == key);
    if (index != -1) {
      final existing = items[index];
      final merged = existing.copyWith(
        title: next.title,
        summary: next.summary,
        entityId: next.entityId,
        metadata: next.metadata,
        updatedAt: next.updatedAt,
      );
      final out = [...items];
      out[index] = merged;
      return AddItemResult(out, false);
    }
  }
  return AddItemResult([...items, next], true);
}

List<ResearchItem> removeResearchItem(List<ResearchItem> items, String itemId) =>
    items.where((i) => i.itemId != itemId).toList();

List<ResearchItem> setItemStatus(List<ResearchItem> items, String itemId, FindingStatus status, DateTime now) =>
    items.map((i) => i.itemId == itemId ? i.copyWith(status: status, updatedAt: now) : i).toList();

List<ResearchItem> setItemNote(List<ResearchItem> items, String itemId, String note, DateTime now) =>
    items.map((i) => i.itemId == itemId ? i.copyWith(note: note, updatedAt: now) : i).toList();

List<String> normalizeResearchTags(List<String> raw) {
  final seen = <String>{};
  final out = <String>[];
  for (final t in raw) {
    final trimmed = t.trim();
    if (trimmed.isEmpty) continue;
    final key = trimmed.toLowerCase();
    if (seen.contains(key)) continue;
    seen.add(key);
    out.add(trimmed);
  }
  return out;
}

List<ResearchItem> addResearchTag(List<ResearchItem> items, String itemId, String tag, DateTime now) => items
    .map((i) => i.itemId == itemId ? i.copyWith(tags: normalizeResearchTags([...i.tags, tag]), updatedAt: now) : i)
    .toList();

List<ResearchItem> removeResearchTag(List<ResearchItem> items, String itemId, String tag, DateTime now) {
  final key = tag.trim().toLowerCase();
  return items
      .map((i) => i.itemId == itemId ? i.copyWith(tags: i.tags.where((t) => t.toLowerCase() != key).toList(), updatedAt: now) : i)
      .toList();
}

// ── Freestanding notes ─────────────────────────────────────────────

const List<String> kResearchNoteTags = ['follow-up', 'important', 'question', 'context'];

ResearchItem createNoteItem({
  required String itemId,
  required String workspaceId,
  String? entityId,
  required String text,
  List<String> tags = const [],
  required DateTime now,
}) => buildResearchItem(
  itemId: itemId,
  workspaceId: workspaceId,
  type: ResearchItemType.note,
  entityId: entityId,
  title: 'Research note',
  note: text,
  tags: tags,
  now: now,
);

// ── Search / filter / sort ──────────────────────────────────────────

List<ResearchItem> searchResearchItems(List<ResearchItem> items, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return items;
  return items
      .where((i) => [i.title, i.summary, i.note, ...i.tags].any((f) => f.toLowerCase().contains(q)))
      .toList();
}

List<ResearchItem> filterItemsByType(List<ResearchItem> items, ResearchItemType? type) {
  if (type == null) return items;
  return items.where((i) => i.type == type).toList();
}

List<ResearchItem> filterItemsByEntity(List<ResearchItem> items, String? entityId) {
  if (entityId == null) return items;
  return items.where((i) => i.entityId == entityId).toList();
}

enum ItemSort { newest, oldest, position }

List<ResearchItem> sortResearchItems(List<ResearchItem> items, ItemSort sort) {
  final out = [...items];
  switch (sort) {
    case ItemSort.newest:
      out.sort((a, b) => b.addedAt.compareTo(a.addedAt));
    case ItemSort.oldest:
      out.sort((a, b) => a.addedAt.compareTo(b.addedAt));
    case ItemSort.position:
      out.sort((a, b) => a.position.compareTo(b.position));
  }
  return out;
}

// ── Overview ─────────────────────────────────────────────────────────

class WorkspaceOverviewCounts {
  const WorkspaceOverviewCounts({
    required this.entities,
    required this.evidence,
    required this.claims,
    required this.events,
    required this.sources,
    required this.notes,
  });
  final int entities;
  final int evidence;
  final int claims;
  final int events;
  final int sources;
  final int notes;
}

WorkspaceOverviewCounts overviewCounts(List<ResearchItem> items) {
  int count(ResearchItemType t) => items.where((i) => i.type == t).length;
  return WorkspaceOverviewCounts(
    entities: count(ResearchItemType.entity),
    evidence: count(ResearchItemType.evidence),
    claims: count(ResearchItemType.claim),
    events: count(ResearchItemType.controversy) +
        count(ResearchItemType.newsEvent) +
        count(ResearchItemType.timelineEvent) +
        count(ResearchItemType.changeEvent) +
        count(ResearchItemType.historicalEvent),
    sources: count(ResearchItemType.source),
    notes: count(ResearchItemType.note),
  );
}

// ── Evidence quality view ────────────────────────────────────────────

/// Reads `metadata['confidence']` off saved EVIDENCE items and
/// `metadata['corroborated']` off saved CLAIM items. Never computes a
/// new confidence — only counts what was already there when each item
/// was saved.
class EvidenceQualitySummary {
  const EvidenceQualitySummary({
    required this.evidenceCollected,
    required this.highConfidence,
    required this.mediumConfidence,
    required this.lowConfidence,
    required this.corroboratedClaims,
    required this.claimsNeedingReview,
  });
  final int evidenceCollected;
  final int highConfidence;
  final int mediumConfidence;
  final int lowConfidence;
  final int corroboratedClaims;
  final int claimsNeedingReview;
}

EvidenceQualitySummary evidenceQualitySummary(List<ResearchItem> items) {
  final evidence = items.where((i) => i.type == ResearchItemType.evidence).toList();
  final claims = items.where((i) => i.type == ResearchItemType.claim).toList();
  String confidenceOf(ResearchItem i) => '${i.metadata['confidence'] ?? ''}'.toLowerCase();
  return EvidenceQualitySummary(
    evidenceCollected: evidence.length,
    highConfidence: evidence.where((i) => confidenceOf(i) == 'high' || confidenceOf(i) == 'strong').length,
    mediumConfidence: evidence.where((i) => confidenceOf(i) == 'medium').length,
    lowConfidence: evidence.where((i) => confidenceOf(i) == 'low' || confidenceOf(i) == 'weak').length,
    corroboratedClaims: claims.where((i) => i.metadata['corroborated'] == true).length,
    claimsNeedingReview: items.where((i) => i.status == FindingStatus.needsReview).length,
  );
}

// ── Activity log ─────────────────────────────────────────────────────

enum ActivityKind {
  workspaceCreated,
  itemAdded,
  itemRemoved,
  noteAdded,
  noteEdited,
  tagChanged,
  statusChanged,
}

class ActivityEntry {
  const ActivityEntry({
    required this.activityId,
    required this.workspaceId,
    required this.kind,
    required this.summary,
    required this.at,
  });
  final String activityId;
  final String workspaceId;
  final ActivityKind kind;
  final String summary;
  final DateTime at;

  Map<String, dynamic> toMap() => {
    'activityId': activityId,
    'workspaceId': workspaceId,
    'kind': kind.name,
    'summary': summary,
    'at': at.toIso8601String(),
  };

  static ActivityEntry? fromMap(Map<dynamic, dynamic>? map) {
    if (map == null) return null;
    final activityId = map['activityId'];
    final workspaceId = map['workspaceId'];
    final at = DateTime.tryParse('${map['at']}');
    if (activityId is! String || workspaceId is! String || at == null) return null;
    return ActivityEntry(
      activityId: activityId,
      workspaceId: workspaceId,
      kind: ActivityKind.values.firstWhere((k) => k.name == map['kind'], orElse: () => ActivityKind.itemAdded),
      summary: (map['summary'] as String?) ?? '',
      at: at,
    );
  }
}

ActivityEntry recordActivity({
  required String activityId,
  required String workspaceId,
  required ActivityKind kind,
  required String summary,
  required DateTime now,
}) => ActivityEntry(activityId: activityId, workspaceId: workspaceId, kind: kind, summary: summary, at: now);

class ActivityGroup {
  const ActivityGroup(this.label, this.entries);
  final String label;
  final List<ActivityEntry> entries;
}

/// Groups activity into "Today" / "Yesterday" / a date label, newest
/// first — display grouping only, never a claim about entity history.
List<ActivityGroup> groupActivityByDay(List<ActivityEntry> entries, {DateTime? now}) {
  final n = now ?? DateTime.now();
  String dayKey(DateTime d) => d.toIso8601String().substring(0, 10);
  final todayKey = dayKey(n);
  final yesterdayKey = dayKey(n.subtract(const Duration(days: 1)));

  final sorted = [...entries]..sort((a, b) => b.at.compareTo(a.at));
  final order = <String>[];
  final byLabel = <String, List<ActivityEntry>>{};
  for (final e in sorted) {
    final day = dayKey(e.at);
    final label = day == todayKey ? 'Today' : (day == yesterdayKey ? 'Yesterday' : day);
    if (!byLabel.containsKey(label)) order.add(label);
    (byLabel[label] ??= []).add(e);
  }
  return [for (final label in order) ActivityGroup(label, byLabel[label]!)];
}
