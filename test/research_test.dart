// Research Workspace — the Dart twin of site/lib/research.test.ts.
import 'package:flutter_test/flutter_test.dart';
import 'package:crititrack/core/utils/research.dart';

final now = DateTime.utc(2026, 9, 5);
final later = DateTime.utc(2026, 9, 6);

void main() {
  group('createWorkspace', () {
    test('defaults the title from a single entity name', () {
      final w = createWorkspace(workspaceId: 'w1', userId: 'u1', entityNames: const ['Jane Doe'], now: now);
      expect(w.title, 'Research — Jane Doe');
      expect(w.status, WorkspaceStatus.active);
    });

    test('defaults to a compare title for exactly two entities', () {
      final w = createWorkspace(workspaceId: 'w1', userId: 'u1', entityNames: const ['A', 'B'], now: now);
      expect(w.title, 'Compare A and B');
    });

    test('an explicit title wins over the default', () {
      final w = createWorkspace(workspaceId: 'w1', userId: 'u1', entityNames: const ['A'], title: 'My research', now: now);
      expect(w.title, 'My research');
    });
  });

  group('workspace mutators', () {
    final base = createWorkspace(workspaceId: 'w1', userId: 'u1', entityNames: const ['Jane Doe'], now: now);

    test('rename ignores a blank title', () {
      expect(renameWorkspace(base, '   ', later).title, base.title);
      expect(renameWorkspace(base, 'New title', later).title, 'New title');
    });

    test('archive then reactivate round-trips status', () {
      final archived = archiveWorkspace(base, later);
      expect(archived.status, WorkspaceStatus.archived);
      expect(reactivateWorkspace(archived, later).status, WorkspaceStatus.active);
    });

    test('description is trimmed and bumps updatedAt', () {
      final updated = updateWorkspaceDescription(base, '  notes  ', later);
      expect(updated.description, 'notes');
      expect(updated.updatedAt, later);
    });

    test('adding the same entity twice is a no-op the second time', () {
      final once = addEntityToWorkspace(base, 'q2', later);
      final twice = addEntityToWorkspace(once, 'q2', later);
      expect(twice.entityIds, once.entityIds);
    });

    test('removing an entity not present is a no-op', () {
      expect(removeEntityFromWorkspace(base, 'q999', later), same(base));
    });
  });

  group('stableItemKey / addResearchItem deduplication', () {
    test('a NOTE (no referenceId) never collides', () {
      expect(stableItemKey(ResearchItemType.note, null), isNull);
    });

    test('adding the same (type, referenceId) twice updates in place rather than duplicating', () {
      final first = buildResearchItem(
        itemId: 'i1',
        workspaceId: 'w1',
        type: ResearchItemType.evidence,
        referenceId: 'E123',
        title: 'Old title',
        metadata: const {'confidence': 'medium'},
        now: now,
      );
      final afterFirst = addResearchItem(const [], first).items;
      expect(afterFirst, hasLength(1));

      final second = buildResearchItem(
        itemId: 'i2',
        workspaceId: 'w1',
        type: ResearchItemType.evidence,
        referenceId: 'E123',
        title: 'Refreshed title',
        metadata: const {'confidence': 'high'},
        now: later,
      );
      final result = addResearchItem(afterFirst, second);
      expect(result.added, isFalse);
      expect(result.items, hasLength(1));
      expect(result.items.first.itemId, 'i1');
      expect(result.items.first.title, 'Refreshed title');
      expect(result.items.first.metadata['confidence'], 'high');
    });

    test("a user's note and tags survive a metadata refresh", () {
      final first = buildResearchItem(
        itemId: 'i1',
        workspaceId: 'w1',
        type: ResearchItemType.claim,
        referenceId: 'C1',
        title: 'Claim A',
        note: 'keep me',
        tags: const ['important'],
        now: now,
      );
      final items = addResearchItem(const [], first).items;
      final refreshed = buildResearchItem(
        itemId: 'i2',
        workspaceId: 'w1',
        type: ResearchItemType.claim,
        referenceId: 'C1',
        title: 'Claim A (updated evidence count)',
        now: later,
      );
      final after = addResearchItem(items, refreshed).items;
      expect(after.first.note, 'keep me');
      expect(after.first.tags, ['important']);
    });

    test('different references never collapse into one item', () {
      final a = buildResearchItem(itemId: 'a', workspaceId: 'w1', type: ResearchItemType.evidence, referenceId: 'E1', title: 'A', now: now);
      final b = buildResearchItem(itemId: 'b', workspaceId: 'w1', type: ResearchItemType.evidence, referenceId: 'E2', title: 'B', now: now);
      final step1 = addResearchItem(const [], a).items;
      final step2 = addResearchItem(step1, b).items;
      expect(step2, hasLength(2));
    });

    test('two freestanding notes never dedupe against each other', () {
      final n1 = createNoteItem(itemId: 'n1', workspaceId: 'w1', text: 'first', now: now);
      final n2 = createNoteItem(itemId: 'n2', workspaceId: 'w1', text: 'second', now: now);
      final step1 = addResearchItem(const [], n1).items;
      final result = addResearchItem(step1, n2);
      expect(result.added, isTrue);
      expect(result.items, hasLength(2));
    });
  });

  group('item mutators', () {
    final item = buildResearchItem(itemId: 'i1', workspaceId: 'w1', type: ResearchItemType.claim, referenceId: 'C1', title: 'Claim A', now: now);

    test('removeResearchItem drops only the named item', () {
      final list = [item];
      expect(removeResearchItem(list, 'i1'), isEmpty);
      expect(removeResearchItem(list, 'missing'), list);
    });

    test('setItemStatus never touches other items', () {
      final other = buildResearchItem(itemId: 'i2', workspaceId: 'w1', type: ResearchItemType.note, title: 'Research note', now: now);
      final list = setItemStatus([item, other], 'i1', FindingStatus.needsReview, later);
      expect(list[0].status, FindingStatus.needsReview);
      expect(list[1].status, FindingStatus.undecided);
    });

    test('setItemNote updates the note text and updatedAt', () {
      final list = setItemNote([item], 'i1', 'Need to verify the date.', later);
      expect(list[0].note, 'Need to verify the date.');
      expect(list[0].updatedAt, later);
    });

    test('addResearchTag / removeResearchTag normalize case and de-duplicate', () {
      var list = addResearchTag([item], 'i1', 'Important', later);
      list = addResearchTag(list, 'i1', 'important', later);
      expect(list[0].tags, ['Important']);
      list = removeResearchTag(list, 'i1', 'IMPORTANT', later);
      expect(list[0].tags, isEmpty);
    });
  });

  group('search / filter / sort', () {
    final items = [
      buildResearchItem(itemId: '1', workspaceId: 'w1', type: ResearchItemType.evidence, entityId: 'qA', referenceId: 'E1', title: 'Financial report', now: DateTime.utc(2026, 1, 1)),
      buildResearchItem(itemId: '2', workspaceId: 'w1', type: ResearchItemType.claim, entityId: 'qB', referenceId: 'C1', title: 'Denial statement', note: 'check this', now: DateTime.utc(2026, 2, 1)),
      buildResearchItem(itemId: '3', workspaceId: 'w1', type: ResearchItemType.note, title: 'Research note', note: 'unrelated', tags: const ['follow-up'], now: DateTime.utc(2026, 3, 1)),
    ];

    test('search matches title, note, and tags case-insensitively', () {
      expect(searchResearchItems(items, 'financial'), hasLength(1));
      expect(searchResearchItems(items, 'check this'), hasLength(1));
      expect(searchResearchItems(items, 'follow-up'), hasLength(1));
      expect(searchResearchItems(items, ''), hasLength(3));
    });

    test('filterItemsByType / filterItemsByEntity narrow the list; null returns everything', () {
      expect(filterItemsByType(items, ResearchItemType.claim), hasLength(1));
      expect(filterItemsByType(items, null), hasLength(3));
      expect(filterItemsByEntity(items, 'qA'), hasLength(1));
      expect(filterItemsByEntity(items, null), hasLength(3));
    });

    test('sortResearchItems orders newest-first or oldest-first deterministically', () {
      final newest = sortResearchItems(items, ItemSort.newest);
      expect(newest.map((i) => i.itemId).toList(), ['3', '2', '1']);
      final oldest = sortResearchItems(items, ItemSort.oldest);
      expect(oldest.map((i) => i.itemId).toList(), ['1', '2', '3']);
    });
  });

  group('overviewCounts', () {
    test('counts each type, folding every event kind into one events bucket', () {
      final items = [
        buildResearchItem(itemId: '1', workspaceId: 'w', type: ResearchItemType.entity, title: 'A', now: now),
        buildResearchItem(itemId: '2', workspaceId: 'w', type: ResearchItemType.evidence, title: 'A', now: now),
        buildResearchItem(itemId: '3', workspaceId: 'w', type: ResearchItemType.claim, title: 'A', now: now),
        buildResearchItem(itemId: '4', workspaceId: 'w', type: ResearchItemType.controversy, title: 'A', now: now),
        buildResearchItem(itemId: '5', workspaceId: 'w', type: ResearchItemType.changeEvent, title: 'A', now: now),
        buildResearchItem(itemId: '6', workspaceId: 'w', type: ResearchItemType.source, title: 'A', now: now),
        buildResearchItem(itemId: '7', workspaceId: 'w', type: ResearchItemType.note, title: 'A', now: now),
      ];
      final counts = overviewCounts(items);
      expect(counts.entities, 1);
      expect(counts.evidence, 1);
      expect(counts.claims, 1);
      expect(counts.events, 2);
      expect(counts.sources, 1);
      expect(counts.notes, 1);
    });
  });

  group('evidenceQualitySummary', () {
    test('reads confidence/corroboration that was already saved — never computes new values', () {
      final items = [
        buildResearchItem(itemId: '1', workspaceId: 'w', type: ResearchItemType.evidence, title: 'A', metadata: const {'confidence': 'high'}, now: now),
        buildResearchItem(itemId: '2', workspaceId: 'w', type: ResearchItemType.evidence, title: 'B', metadata: const {'confidence': 'medium'}, now: now),
        buildResearchItem(itemId: '3', workspaceId: 'w', type: ResearchItemType.evidence, title: 'C', metadata: const {'confidence': 'low'}, now: now),
        buildResearchItem(itemId: '4', workspaceId: 'w', type: ResearchItemType.claim, title: 'D', metadata: const {'corroborated': true}, now: now),
      ];
      final withReview = setItemStatus(items, '2', FindingStatus.needsReview, now);
      final summary = evidenceQualitySummary(withReview);
      expect(summary.evidenceCollected, 3);
      expect(summary.highConfidence, 1);
      expect(summary.mediumConfidence, 1);
      expect(summary.lowConfidence, 1);
      expect(summary.corroboratedClaims, 1);
      expect(summary.claimsNeedingReview, 1);
    });

    test('an empty workspace reports zeros, not a crash', () {
      final summary = evidenceQualitySummary(const []);
      expect(summary.evidenceCollected, 0);
      expect(summary.highConfidence, 0);
      expect(summary.corroboratedClaims, 0);
      expect(summary.claimsNeedingReview, 0);
    });
  });

  group('activity log', () {
    test('groupActivityByDay labels today and yesterday, and buckets older days by date', () {
      final nowRef = DateTime.utc(2026, 9, 5, 12);
      final entries = [
        recordActivity(activityId: 'a1', workspaceId: 'w', kind: ActivityKind.itemAdded, summary: 'Added evidence', now: DateTime.utc(2026, 9, 5, 9)),
        recordActivity(activityId: 'a2', workspaceId: 'w', kind: ActivityKind.statusChanged, summary: 'Marked needs review', now: DateTime.utc(2026, 9, 4, 9)),
        recordActivity(activityId: 'a3', workspaceId: 'w', kind: ActivityKind.workspaceCreated, summary: 'Created workspace', now: DateTime.utc(2026, 9, 1, 9)),
      ];
      final groups = groupActivityByDay(entries, now: nowRef);
      expect(groups.map((g) => g.label).toList(), ['Today', 'Yesterday', '2026-09-01']);
    });
  });
}
