// Entity Relationship Intelligence — the Dart twin of
// site/lib/relationships.test.ts.
import 'package:flutter_test/flutter_test.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/utils/relationships.dart';

RawRelationship raw({
  String type = 'SPOUSE',
  String category = 'PERSONAL',
  String direction = 'BIDIRECTIONAL',
  String targetId = 'Q100',
  String targetLabel = 'Alex Roe',
  int? start = 2015,
  int? end,
  String? sourceUrl = 'https://www.wikidata.org/wiki/Q1',
}) => RawRelationship(
  type: type,
  category: category,
  direction: direction,
  targetId: targetId,
  targetLabel: targetLabel,
  start: start,
  end: end,
  sourceUrl: sourceUrl,
);

CareerEntry careerEntry({
  String? role = 'Chief Executive Officer',
  String? organization = 'Acme Corp',
  int? start = 2019,
  int? end,
  String? sourceUrl = 'https://www.wikidata.org/wiki/Q1',
}) => CareerEntry(
  role: role,
  organization: organization,
  start: start,
  end: end,
  sourceName: 'Wikidata',
  sourceUrl: sourceUrl,
);

void main() {
  setUp(resetRelationshipIdCounter);

  group('buildRelationships — evidence requirement', () {
    test('a structured relationship with a source is surfaced; one without a source is not', () {
      final rels = buildRelationships(
        subjectEntityId: 'Q1',
        subjectName: 'Jane Doe',
        wikidataRelationships: [raw(), raw(targetId: 'Q200', targetLabel: 'No Source', sourceUrl: null)],
        career: const [],
        evidenceItems: const [],
      );
      expect(rels, hasLength(1));
      expect(rels.first.objectName, 'Alex Roe');
    });

    test('no relationship is ever created from co-occurrence alone', () {
      final rels = buildRelationships(
        subjectEntityId: 'Q1',
        subjectName: 'Jane Doe',
        wikidataRelationships: const [],
        career: const [],
        evidenceItems: const [],
      );
      expect(rels, isEmpty);
    });
  });

  group('buildRelationships — types, status, dates', () {
    test('family relationships get the personal category and a person object kind', () {
      final rels = buildRelationships(
        subjectEntityId: 'Q1',
        subjectName: 'Jane Doe',
        wikidataRelationships: [raw(type: 'SIBLING', targetLabel: 'Sam Doe')],
        career: const [],
        evidenceItems: const [],
      );
      expect(rels.first.category, RelationshipCategory.personal);
      expect(rels.first.objectKind, ObjectKind.person);
    });

    test("a career row's own role text maps to a professional relationship type", () {
      final rels = buildRelationships(
        subjectEntityId: 'Q1',
        subjectName: 'Jane Doe',
        wikidataRelationships: const [],
        career: [
          careerEntry(role: 'Founder', organization: 'Startup Inc', start: 2010, end: 2015),
          careerEntry(role: 'Chief Executive Officer', organization: 'Acme Corp', start: 2016),
          careerEntry(role: 'Software Engineer', organization: 'BigCo', start: 2005, end: 2008),
        ],
        evidenceItems: const [],
      );
      final byName = {for (final r in rels) r.objectName: r.relationshipType};
      expect(byName['Startup Inc'], 'FOUNDED');
      expect(byName['Acme Corp'], 'LEADS');
      expect(byName['BigCo'], 'EMPLOYED_BY');
    });

    test('an ended career row is ENDED; an open-ended one is ACTIVE', () {
      final rels = buildRelationships(
        subjectEntityId: 'Q1',
        subjectName: 'Jane Doe',
        wikidataRelationships: const [],
        career: [
          careerEntry(organization: 'Old Co', start: 2010, end: 2015),
          careerEntry(organization: 'New Co', start: 2016),
        ],
        evidenceItems: const [],
      );
      expect(rels.firstWhere((r) => r.objectName == 'Old Co').status, RelationshipStatus.ended);
      expect(rels.firstWhere((r) => r.objectName == 'New Co').status, RelationshipStatus.active);
    });
  });

  group('buildRelationships — deduplication', () {
    test('two career rows for the same org/role/start collapse to one, merging sources', () {
      final rels = buildRelationships(
        subjectEntityId: 'Q1',
        subjectName: 'Jane Doe',
        wikidataRelationships: const [],
        career: [
          careerEntry(start: 2016, sourceUrl: 'https://www.wikidata.org/wiki/Q1#P39'),
          careerEntry(start: 2016, sourceUrl: 'https://www.wikidata.org/wiki/Q1#P108'),
        ],
        evidenceItems: const [],
      );
      final acme = rels.where((r) => r.objectName == 'Acme Corp').toList();
      expect(acme, hasLength(1));
      expect(acme.first.sourceUrls, hasLength(2));
    });
  });

  group('filter / search / coverage', () {
    List<EntityRelationship> list() => buildRelationships(
      subjectEntityId: 'Q1',
      subjectName: 'Jane Doe',
      wikidataRelationships: [raw(type: 'SPOUSE')],
      career: [careerEntry(organization: 'Acme Corp', start: 2016), careerEntry(organization: 'Old Co', start: 2005, end: 2009)],
      evidenceItems: const [],
    );

    test('category filter narrows to one category', () {
      final out = filterRelationships(list(), const RelationshipFilters(category: RelationshipCategory.personal));
      expect(out.every((r) => r.category == RelationshipCategory.personal), isTrue);
    });

    test("'current' time filter drops ended relationships", () {
      final out = filterRelationships(list(), const RelationshipFilters(time: RelationshipTimeFilter.current));
      expect(out.every((r) => r.status != RelationshipStatus.ended), isTrue);
    });

    test('search matches the related entity name and the relationship type label', () {
      expect(searchRelationships(list(), 'acme'), hasLength(1));
      expect(searchRelationships(list(), 'spouse'), hasLength(1));
    });

    test('coverage counts confidence bands without any trust score', () {
      final cov = relationshipCoverage(list());
      expect(cov.high + cov.medium + cov.low, cov.total);
    });
  });

  group('Advanced Compare helpers', () {
    test('a shared organization is a shared connection, never a direct relationship', () {
      final aRels = buildRelationships(
        subjectEntityId: 'QA',
        subjectName: 'Person A',
        wikidataRelationships: const [],
        career: [careerEntry(role: 'Founder', organization: 'Shared Org', start: 2010)],
        evidenceItems: const [],
      );
      final bRels = buildRelationships(
        subjectEntityId: 'QB',
        subjectName: 'Person B',
        wikidataRelationships: const [],
        career: [careerEntry(role: 'Board member', organization: 'Shared Org', start: 2018)],
        evidenceItems: const [],
      );
      final shared = sharedConnections(aRels, bRels);
      expect(shared, hasLength(1));
      expect(shared.first.aType, 'FOUNDED');
      expect(shared.first.bType, 'BOARD_MEMBER_OF');
      expect(directRelationshipsBetween(aRels, 'QB', 'Person B'), isEmpty);
    });

    test('a direct relationship is found when A documents B as the object', () {
      final rels = buildRelationships(
        subjectEntityId: 'QA',
        subjectName: 'Person A',
        wikidataRelationships: [raw(type: 'SPOUSE', targetId: 'QB', targetLabel: 'Person B')],
        career: const [],
        evidenceItems: const [],
      );
      expect(directRelationshipsBetween(rels, 'QB', 'Person B'), hasLength(1));
    });
  });

  group('relationshipChanges', () {
    test('emits nothing when either snapshot is empty', () {
      final rels = buildRelationships(subjectEntityId: 'Q1', subjectName: 'Jane Doe', wikidataRelationships: [raw()], career: const [], evidenceItems: const []);
      expect(relationshipChanges('Q1', const [], rels, '2026-09-05'), isEmpty);
      expect(relationshipChanges('Q1', rels, const [], '2026-09-05'), isEmpty);
    });

    test('emits a RELATIONSHIP_CHANGE when a new documented relationship appears', () {
      resetRelationshipIdCounter();
      final before = buildRelationships(subjectEntityId: 'Q1', subjectName: 'Jane Doe', wikidataRelationships: [raw(targetId: 'Q100')], career: const [], evidenceItems: const []);
      resetRelationshipIdCounter();
      final after = buildRelationships(
        subjectEntityId: 'Q1',
        subjectName: 'Jane Doe',
        wikidataRelationships: [raw(targetId: 'Q100'), raw(type: 'MEMBER_OF', targetId: 'Q300', targetLabel: 'The Board', start: 2025)],
        career: const [],
        evidenceItems: const [],
      );
      final changes = relationshipChanges('Q1', before, after, '2026-09-05');
      expect(changes, hasLength(1));
      expect(changes.first.changeType, 'RELATIONSHIP_CHANGE');
      expect(changes.first.title, contains('The Board'));
    });
  });
}
