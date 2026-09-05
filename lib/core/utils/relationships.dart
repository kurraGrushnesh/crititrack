/// Entity Relationship Intelligence — the Dart twin of
/// `site/lib/relationships.ts`. Surfaces a relationship only when a real
/// record documents it: a structured Wikidata claim
/// ([PersonFacts.relationships]) or a dated Wikidata career row
/// ([PersonFacts.career]). Nothing is inferred from name similarity, a
/// shared profession, a shared country, or two people appearing in the
/// same article — news can only raise a relationship's evidence count,
/// never create one. There is no model in this file.
library;

import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/utils/claims.dart' show titleSlug;
import 'package:crititrack/core/utils/evidence.dart';

const String kRelationshipMethodologyVersion = 'relationships-1';

enum RelationshipCategory { personal, professional, business, organizational, media, sports, other }

extension RelationshipCategoryLabel on RelationshipCategory {
  String get label => switch (this) {
    RelationshipCategory.personal => 'Personal',
    RelationshipCategory.professional => 'Professional',
    RelationshipCategory.business => 'Business',
    RelationshipCategory.organizational => 'Organizational',
    RelationshipCategory.media => 'Media',
    RelationshipCategory.sports => 'Sports',
    RelationshipCategory.other => 'Other',
  };
}

enum RelationshipStatus { active, historical, ended, uncertain }

enum RelationshipConfidence { high, medium, low }

enum ObjectKind { person, organization, team, group, other }

RelationshipCategory _categoryFromName(String? name) => switch (name?.toUpperCase()) {
  'PERSONAL' => RelationshipCategory.personal,
  'PROFESSIONAL' => RelationshipCategory.professional,
  'BUSINESS' => RelationshipCategory.business,
  'ORGANIZATIONAL' => RelationshipCategory.organizational,
  'MEDIA' => RelationshipCategory.media,
  'SPORTS' => RelationshipCategory.sports,
  _ => RelationshipCategory.other,
};

/// The controlled type is kept as a normalized string (matching the web
/// taxonomy) plus a human label — a full Dart enum of 40 values would
/// add no safety here since the strings come from a fixed server map.
String relationshipTypeLabel(String type) {
  const known = {
    'FAMILY': 'Family',
    'SPOUSE': 'Spouse',
    'PARENT': 'Parent',
    'CHILD': 'Child',
    'SIBLING': 'Sibling',
    'EMPLOYED_BY': 'Employed by',
    'LEADS': 'Leads',
    'FOUNDED': 'Founded',
    'BOARD_MEMBER_OF': 'Board member of',
    'MEMBER_OF': 'Member of',
    'OWNS': 'Owns',
    'UNKNOWN_DOCUMENTED': 'Documented relationship',
  };
  return known[type] ??
      type
          .split('_')
          .map((w) => w.isEmpty ? w : w[0] + w.substring(1).toLowerCase())
          .join(' ');
}

RelationshipCategory categoryOf(String type) => switch (type) {
  'FAMILY' || 'SPOUSE' || 'PARENT' || 'CHILD' || 'SIBLING' => RelationshipCategory.personal,
  'EMPLOYED_BY' || 'LEADS' || 'FOUNDED' || 'BOARD_MEMBER_OF' || 'COFOUNDED' || 'ADVISOR_TO' => RelationshipCategory.professional,
  'OWNS' || 'INVESTED_IN' || 'EXECUTIVE_OF' || 'DIRECTOR_OF' || 'PARTNERED_WITH' => RelationshipCategory.business,
  'MEMBER_OF' || 'AFFILIATED_WITH' || 'MEMBER_OF_PARTY_OR_GROUP' => RelationshipCategory.organizational,
  'MEMBER_OF_TEAM' || 'TEAMMATE_OF' || 'REPRESENTS_TEAM' || 'COACH_OF' || 'COACHED_BY' => RelationshipCategory.sports,
  _ => RelationshipCategory.other,
};

class EntityRelationship {
  EntityRelationship({
    required this.relationshipId,
    required this.subjectEntityId,
    required this.subjectName,
    required this.objectEntityId,
    required this.objectName,
    required this.objectKind,
    required this.relationshipType,
    required this.category,
    required this.direction,
    required this.status,
    required this.confidence,
    required this.sourceUrls,
    required this.evidenceIds,
    required this.effectiveFrom,
    required this.effectiveTo,
    required this.firstObservedAt,
    required this.lastObservedAt,
  });

  final String relationshipId;
  final String subjectEntityId;
  final String subjectName;
  final String objectEntityId;
  final String objectName;
  final ObjectKind objectKind;
  final String relationshipType;
  final RelationshipCategory category;
  final String direction;
  RelationshipStatus status;
  final RelationshipConfidence confidence;
  List<String> sourceUrls;
  List<String> evidenceIds;
  final int? effectiveFrom;
  int? effectiveTo;
  final String? firstObservedAt;
  final String? lastObservedAt;
  final String methodologyVersion = kRelationshipMethodologyVersion;
}

ObjectKind _objectKindForType(String type) => switch (type) {
  'FAMILY' || 'SPOUSE' || 'PARENT' || 'CHILD' || 'SIBLING' => ObjectKind.person,
  'MEMBER_OF_TEAM' || 'TEAMMATE_OF' || 'REPRESENTS_TEAM' => ObjectKind.team,
  'MEMBER_OF_PARTY_OR_GROUP' => ObjectKind.group,
  _ => ObjectKind.organization,
};

String _typeForRole(String? role) {
  final r = (role ?? '').toLowerCase();
  if (RegExp(r'\bfound').hasMatch(r)) return 'FOUNDED';
  if (RegExp(r'\b(chair|board)\b').hasMatch(r)) return 'BOARD_MEMBER_OF';
  if (RegExp(r'\b(ceo|chief executive|president|managing director|director|head of|owner|partner)\b').hasMatch(r)) return 'LEADS';
  return 'EMPLOYED_BY';
}

RelationshipStatus _statusFor(int? start, int? end) {
  if (end != null) return RelationshipStatus.ended;
  return RelationshipStatus.active;
}

int _counter = 0;

/// Tests only — makes ids deterministic per run.
void resetRelationshipIdCounter() => _counter = 0;

String _nextId(String subjectId, String type) {
  _counter += 1;
  return '$subjectId-$type-$_counter';
}

String _dedupeKey(EntityRelationship r) =>
    '${r.subjectEntityId}|${r.objectEntityId}|${r.relationshipType}|${r.effectiveFrom ?? ""}';

List<String> _corroboratingEvidence(List<EvidenceItem> items, String subjectName, String objectName) {
  final subj = subjectName.toLowerCase();
  final obj = objectName.toLowerCase();
  if (subj.isEmpty || obj.isEmpty || subj == obj) return const [];
  return items
      .where((i) => '${i.title} ${i.snippet ?? ""}'.toLowerCase().contains(subj) && '${i.title} ${i.snippet ?? ""}'.toLowerCase().contains(obj))
      .map((i) => i.evidenceId)
      .toList();
}

List<EntityRelationship> buildRelationships({
  required String subjectEntityId,
  required String subjectName,
  required List<RawRelationship> wikidataRelationships,
  required List<CareerEntry> career,
  required List<EvidenceItem> evidenceItems,
}) {
  final byKey = <String, EntityRelationship>{};

  void add(EntityRelationship r) {
    final key = _dedupeKey(r);
    final existing = byKey[key];
    if (existing != null) {
      existing.sourceUrls = {...existing.sourceUrls, ...r.sourceUrls}.toList();
      existing.evidenceIds = {...existing.evidenceIds, ...r.evidenceIds}.toList();
      if (r.effectiveTo != null && existing.effectiveTo == null) {
        existing.effectiveTo = r.effectiveTo;
        existing.status = RelationshipStatus.ended;
      }
      return;
    }
    byKey[key] = r;
  }

  for (final raw in wikidataRelationships) {
    if (raw.targetId.isEmpty || raw.targetLabel.isEmpty) continue;
    add(EntityRelationship(
      relationshipId: _nextId(subjectEntityId, raw.type),
      subjectEntityId: subjectEntityId,
      subjectName: subjectName,
      objectEntityId: raw.targetId,
      objectName: raw.targetLabel,
      objectKind: _objectKindForType(raw.type),
      relationshipType: raw.type,
      category: _categoryFromName(raw.category),
      direction: raw.direction,
      status: _statusFor(raw.start, raw.end),
      confidence: RelationshipConfidence.high,
      sourceUrls: raw.sourceUrl != null ? [raw.sourceUrl!] : <String>[],
      evidenceIds: _corroboratingEvidence(evidenceItems, subjectName, raw.targetLabel),
      effectiveFrom: raw.start,
      effectiveTo: raw.end,
      firstObservedAt: raw.start != null ? '${raw.start}' : null,
      lastObservedAt: raw.end != null ? '${raw.end}' : null,
    ));
  }

  for (final entry in career) {
    final org = entry.organization;
    if (org == null || org.isEmpty) continue;
    final type = _typeForRole(entry.role);
    add(EntityRelationship(
      relationshipId: _nextId(subjectEntityId, type),
      subjectEntityId: subjectEntityId,
      subjectName: subjectName,
      objectEntityId: 'org:${titleSlug(org)}',
      objectName: org,
      objectKind: ObjectKind.organization,
      relationshipType: type,
      category: categoryOf(type),
      direction: 'OUTGOING',
      status: _statusFor(entry.start, entry.end),
      confidence: (entry.start != null || entry.end != null || entry.sourceUrl != null)
          ? RelationshipConfidence.high
          : RelationshipConfidence.medium,
      sourceUrls: entry.sourceUrl != null ? [entry.sourceUrl!] : <String>[],
      evidenceIds: _corroboratingEvidence(evidenceItems, subjectName, org),
      effectiveFrom: entry.start,
      effectiveTo: entry.end,
      firstObservedAt: entry.start != null ? '${entry.start}' : null,
      lastObservedAt: entry.end != null ? '${entry.end}' : (entry.isCurrent ? 'present' : null),
    ));
  }

  return byKey.values.where((r) => r.sourceUrls.isNotEmpty).toList();
}

// ── Filter / search / coverage ──────────────────────────────────────

enum RelationshipTimeFilter { current, y1, y3, y5, all }

class RelationshipFilters {
  const RelationshipFilters({
    this.category,
    this.status,
    this.confidence,
    this.time = RelationshipTimeFilter.all,
  });
  final RelationshipCategory? category;
  final RelationshipStatus? status;
  final RelationshipConfidence? confidence;
  final RelationshipTimeFilter time;

  RelationshipFilters copyWith({
    RelationshipCategory? category,
    bool clearCategory = false,
    RelationshipStatus? status,
    bool clearStatus = false,
    RelationshipConfidence? confidence,
    bool clearConfidence = false,
    RelationshipTimeFilter? time,
  }) => RelationshipFilters(
    category: clearCategory ? null : (category ?? this.category),
    status: clearStatus ? null : (status ?? this.status),
    confidence: clearConfidence ? null : (confidence ?? this.confidence),
    time: time ?? this.time,
  );
}

List<EntityRelationship> filterRelationships(
  List<EntityRelationship> list,
  RelationshipFilters filters, {
  int? currentYear,
}) {
  final year = currentYear ?? DateTime.now().year;
  return list.where((r) {
    if (filters.category != null && r.category != filters.category) return false;
    if (filters.status != null && r.status != filters.status) return false;
    if (filters.confidence != null && r.confidence != filters.confidence) return false;
    if (filters.time == RelationshipTimeFilter.current && r.status == RelationshipStatus.ended) return false;
    if (filters.time != RelationshipTimeFilter.all && filters.time != RelationshipTimeFilter.current) {
      final within = switch (filters.time) {
        RelationshipTimeFilter.y1 => 1,
        RelationshipTimeFilter.y3 => 3,
        RelationshipTimeFilter.y5 => 5,
        _ => 9999,
      };
      final end = r.effectiveTo ?? year;
      if (year - end > within) return false;
    }
    return true;
  }).toList();
}

List<EntityRelationship> searchRelationships(List<EntityRelationship> list, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return list;
  return list
      .where((r) => [r.objectName, relationshipTypeLabel(r.relationshipType), r.category.label].any((f) => f.toLowerCase().contains(q)))
      .toList();
}

class RelationshipCoverage {
  const RelationshipCoverage({required this.total, required this.high, required this.medium, required this.low, required this.supportingSources});
  final int total;
  final int high;
  final int medium;
  final int low;
  final int supportingSources;
}

RelationshipCoverage relationshipCoverage(List<EntityRelationship> list) {
  final sources = <String>{};
  for (final r in list) {
    sources.addAll(r.sourceUrls);
  }
  return RelationshipCoverage(
    total: list.length,
    high: list.where((r) => r.confidence == RelationshipConfidence.high).length,
    medium: list.where((r) => r.confidence == RelationshipConfidence.medium).length,
    low: list.where((r) => r.confidence == RelationshipConfidence.low).length,
    supportingSources: sources.length,
  );
}

// ── Advanced Compare helpers ────────────────────────────────────────

List<EntityRelationship> directRelationshipsBetween(List<EntityRelationship> aRelationships, String bEntityId, String bName) {
  final name = bName.trim().toLowerCase();
  return aRelationships
      .where((r) => r.objectEntityId == bEntityId || (name.isNotEmpty && r.objectName.trim().toLowerCase() == name))
      .toList();
}

class SharedConnection {
  const SharedConnection({required this.organizationName, required this.organizationId, required this.aType, required this.bType});
  final String organizationName;
  final String organizationId;
  final String aType;
  final String bType;
}

List<SharedConnection> sharedConnections(List<EntityRelationship> aRelationships, List<EntityRelationship> bRelationships) {
  final bByOrg = <String, EntityRelationship>{
    for (final r in bRelationships.where((r) => r.objectKind == ObjectKind.organization)) r.objectEntityId: r,
  };
  final out = <SharedConnection>[];
  for (final a in aRelationships.where((r) => r.objectKind == ObjectKind.organization)) {
    final b = bByOrg[a.objectEntityId];
    if (b == null) continue;
    out.add(SharedConnection(organizationName: a.objectName, organizationId: a.objectEntityId, aType: a.relationshipType, bType: b.relationshipType));
  }
  return out;
}

// ── Relationship change events ──────────────────────────────────────

class RelationshipChange {
  const RelationshipChange({
    required this.changeId,
    required this.entityId,
    required this.severity,
    required this.title,
    required this.summary,
    required this.previousValue,
    required this.currentValue,
    required this.effectiveDate,
    required this.confidence,
  });
  final String changeId;
  final String entityId;
  final String severity;
  final String title;
  final String summary;
  final String? previousValue;
  final String? currentValue;
  final String? effectiveDate;
  final RelationshipConfidence confidence;
  final String changeType = 'RELATIONSHIP_CHANGE';
  final String methodologyVersion = kRelationshipMethodologyVersion;
}

List<RelationshipChange> relationshipChanges(
  String entityId,
  List<EntityRelationship> previous,
  List<EntityRelationship> current,
  String detectedAt,
) {
  if (previous.isEmpty || current.isEmpty) return const [];
  final prevKeys = previous.map((r) => '${r.objectEntityId}|${r.relationshipType}').toSet();
  final currKeys = current.map((r) => '${r.objectEntityId}|${r.relationshipType}').toSet();
  final out = <RelationshipChange>[];

  for (final r in current) {
    if (prevKeys.contains('${r.objectEntityId}|${r.relationshipType}')) continue;
    out.add(RelationshipChange(
      changeId: '$entityId-REL-NEW-${r.objectEntityId}-${r.relationshipType}',
      entityId: entityId,
      severity: (r.category == RelationshipCategory.professional || r.category == RelationshipCategory.business) ? 'SIGNIFICANT' : 'MINOR',
      title: 'New documented relationship: ${relationshipTypeLabel(r.relationshipType)} ${r.objectName}',
      summary: 'A ${r.confidence.name}-confidence "${relationshipTypeLabel(r.relationshipType)}" relationship to ${r.objectName} is now documented.',
      previousValue: null,
      currentValue: '${relationshipTypeLabel(r.relationshipType)} ${r.objectName}',
      effectiveDate: r.firstObservedAt,
      confidence: r.confidence,
    ));
  }
  for (final r in previous) {
    if (currKeys.contains('${r.objectEntityId}|${r.relationshipType}')) continue;
    out.add(RelationshipChange(
      changeId: '$entityId-REL-END-${r.objectEntityId}-${r.relationshipType}',
      entityId: entityId,
      severity: 'MINOR',
      title: 'Relationship no longer documented: ${relationshipTypeLabel(r.relationshipType)} ${r.objectName}',
      summary: 'The previously-documented "${relationshipTypeLabel(r.relationshipType)}" relationship to ${r.objectName} is no longer present in the available records.',
      previousValue: '${relationshipTypeLabel(r.relationshipType)} ${r.objectName}',
      currentValue: null,
      effectiveDate: detectedAt,
      confidence: RelationshipConfidence.low,
    ));
  }
  return out;
}
