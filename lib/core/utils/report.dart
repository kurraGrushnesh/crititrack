/// Professional Research Reports — the Dart twin of `site/lib/report.ts`.
/// Turns a Research Workspace's selected items into a structured,
/// evidence-backed document. Generation is deterministic template
/// composition over already-real data (never a language model) for the
/// same reasons documented in the TypeScript file: every rule here (no
/// invented facts, no invented citations, uncertainty preserved,
/// verification never upgraded) is trivially true of a pure function
/// and needs no new backend endpoint or external API call.
library;

import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/historical.dart';
import 'package:crititrack/core/utils/methodology.dart';
import 'package:crititrack/core/utils/research.dart';

const String kReportMethodologyVersion = 'report-1';

// ── Report model ────────────────────────────────────────────────────

enum ReportStatus { draft, ready, archived }

enum ReportTemplate { standard, accountability, profileResearch, historicalReview, comparativeResearch }

class ResearchReport {
  const ResearchReport({
    required this.reportId,
    required this.workspaceId,
    required this.userId,
    required this.title,
    required this.subtitle,
    required this.description,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    required this.generatedAt,
    required this.methodologyVersion,
    required this.entityIds,
    required this.sectionIds,
    required this.template,
    required this.version,
  });

  final String reportId;
  final String workspaceId;
  final String userId;
  final String title;
  final String subtitle;
  final String description;
  final ReportStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? generatedAt;
  final String methodologyVersion;
  final List<String> entityIds;
  final List<String> sectionIds;
  final ReportTemplate template;
  final int version;

  ResearchReport copyWith({
    String? title,
    String? subtitle,
    ReportStatus? status,
    DateTime? updatedAt,
    DateTime? generatedAt,
    List<String>? sectionIds,
    int? version,
  }) => ResearchReport(
    reportId: reportId,
    workspaceId: workspaceId,
    userId: userId,
    title: title ?? this.title,
    subtitle: subtitle ?? this.subtitle,
    description: description,
    status: status ?? this.status,
    createdAt: createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    generatedAt: generatedAt ?? this.generatedAt,
    methodologyVersion: methodologyVersion,
    entityIds: entityIds,
    sectionIds: sectionIds ?? this.sectionIds,
    template: template,
    version: version ?? this.version,
  );

  Map<String, dynamic> toMap() => {
    'reportId': reportId,
    'workspaceId': workspaceId,
    'userId': userId,
    'title': title,
    'subtitle': subtitle,
    'description': description,
    'status': status.name,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'generatedAt': generatedAt?.toIso8601String(),
    'methodologyVersion': methodologyVersion,
    'entityIds': entityIds,
    'sectionIds': sectionIds,
    'template': template.name,
    'version': version,
  };

  static ResearchReport? fromMap(Map<dynamic, dynamic>? map) {
    if (map == null) return null;
    final reportId = map['reportId'];
    final workspaceId = map['workspaceId'];
    final userId = map['userId'];
    final createdAt = DateTime.tryParse('${map['createdAt']}');
    final updatedAt = DateTime.tryParse('${map['updatedAt']}');
    if (reportId is! String || workspaceId is! String || userId is! String || createdAt == null || updatedAt == null) {
      return null;
    }
    return ResearchReport(
      reportId: reportId,
      workspaceId: workspaceId,
      userId: userId,
      title: (map['title'] as String?) ?? 'Untitled report',
      subtitle: (map['subtitle'] as String?) ?? '',
      description: (map['description'] as String?) ?? '',
      status: ReportStatus.values.firstWhere((s) => s.name == map['status'], orElse: () => ReportStatus.draft),
      createdAt: createdAt,
      updatedAt: updatedAt,
      generatedAt: DateTime.tryParse('${map['generatedAt']}'),
      methodologyVersion: (map['methodologyVersion'] as String?) ?? kReportMethodologyVersion,
      entityIds: (map['entityIds'] as List?)?.whereType<String>().toList() ?? const [],
      sectionIds: (map['sectionIds'] as List?)?.whereType<String>().toList() ?? const [],
      template: ReportTemplate.values.firstWhere((t) => t.name == map['template'], orElse: () => ReportTemplate.standard),
      version: (map['version'] as num?)?.toInt() ?? 1,
    );
  }
}

ResearchReport createReport({
  required String reportId,
  required String workspaceId,
  required String userId,
  required List<String> entityIds,
  String? title,
  String? subtitle,
  ReportTemplate template = ReportTemplate.standard,
  required DateTime now,
}) => ResearchReport(
  reportId: reportId,
  workspaceId: workspaceId,
  userId: userId,
  title: (title?.trim().isNotEmpty ?? false) ? title!.trim() : 'Untitled report',
  subtitle: subtitle?.trim() ?? '',
  description: '',
  status: ReportStatus.draft,
  createdAt: now,
  updatedAt: now,
  generatedAt: null,
  methodologyVersion: kReportMethodologyVersion,
  entityIds: entityIds,
  sectionIds: const [],
  template: template,
  version: 1,
);

ResearchReport renameReport(ResearchReport r, String title, DateTime now) {
  final trimmed = title.trim();
  if (trimmed.isEmpty) return r;
  return r.copyWith(title: trimmed, updatedAt: now);
}

ResearchReport setReportSubtitle(ResearchReport r, String subtitle, DateTime now) =>
    r.copyWith(subtitle: subtitle.trim(), updatedAt: now);

ResearchReport setReportStatus(ResearchReport r, ReportStatus status, DateTime now) {
  if (r.status == status) return r;
  return r.copyWith(status: status, updatedAt: now);
}

ResearchReport archiveReport(ResearchReport r, DateTime now) => setReportStatus(r, ReportStatus.archived, now);

// ── Sections ─────────────────────────────────────────────────────────

enum ReportSectionKind {
  executiveSummary,
  scopeEntities,
  professionalBackground,
  careerHistory,
  majorEvents,
  controversies,
  claims,
  news,
  sentimentHistory,
  critiscoreHistory,
  attentionHistory,
  evidenceSources,
  dataCoverage,
  methodology,
  researchNotes,
  conclusion,
}

extension ReportSectionKindLabel on ReportSectionKind {
  String get label => switch (this) {
    ReportSectionKind.executiveSummary => 'Executive Summary',
    ReportSectionKind.scopeEntities => 'Scope & Entities',
    ReportSectionKind.professionalBackground => 'Professional Background',
    ReportSectionKind.careerHistory => 'Career & Organization History',
    ReportSectionKind.majorEvents => 'Major Events',
    ReportSectionKind.controversies => 'Controversies',
    ReportSectionKind.claims => 'Claims & Verification',
    ReportSectionKind.news => 'News & Public Coverage',
    ReportSectionKind.sentimentHistory => 'Sentiment History',
    ReportSectionKind.critiscoreHistory => 'CritiScore History',
    ReportSectionKind.attentionHistory => 'Attention History',
    ReportSectionKind.evidenceSources => 'Evidence & Sources',
    ReportSectionKind.dataCoverage => 'Data Coverage & Limitations',
    ReportSectionKind.methodology => 'Methodology',
    ReportSectionKind.researchNotes => 'Research Notes',
    ReportSectionKind.conclusion => 'Conclusion / Findings',
  };
}

const List<ReportSectionKind> kDefaultSectionOrder = ReportSectionKind.values;

enum ContentBlockKind { fact, analysis, userNote, limitation }

class ContentBlock {
  const ContentBlock({required this.blockId, required this.kind, required this.text, required this.citationIds});
  final String blockId;
  final ContentBlockKind kind;
  final String text;
  final List<String> citationIds;

  Map<String, dynamic> toMap() => {'blockId': blockId, 'kind': kind.name, 'text': text, 'citationIds': citationIds};

  static ContentBlock? fromMap(Map<dynamic, dynamic>? map) {
    if (map == null) return null;
    final blockId = map['blockId'];
    if (blockId is! String) return null;
    return ContentBlock(
      blockId: blockId,
      kind: ContentBlockKind.values.firstWhere((k) => k.name == map['kind'], orElse: () => ContentBlockKind.fact),
      text: (map['text'] as String?) ?? '',
      citationIds: (map['citationIds'] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}

ContentBlock _fact(String id, String text, [List<String> citationIds = const []]) =>
    ContentBlock(blockId: id, kind: ContentBlockKind.fact, text: text, citationIds: citationIds);
ContentBlock _limitation(String id, String text) =>
    ContentBlock(blockId: id, kind: ContentBlockKind.limitation, text: text, citationIds: const []);
ContentBlock _userNote(String id, String text) =>
    ContentBlock(blockId: id, kind: ContentBlockKind.userNote, text: text, citationIds: const []);

class ReportSection {
  const ReportSection({
    required this.sectionId,
    required this.kind,
    required this.title,
    required this.visible,
    required this.order,
    required this.blocks,
  });
  final String sectionId;
  final ReportSectionKind kind;
  final String title;
  final bool visible;
  final int order;
  final List<ContentBlock> blocks;

  ReportSection copyWith({bool? visible}) =>
      ReportSection(sectionId: sectionId, kind: kind, title: title, visible: visible ?? this.visible, order: order, blocks: blocks);

  Map<String, dynamic> toMap() => {
    'sectionId': sectionId,
    'kind': kind.name,
    'title': title,
    'visible': visible,
    'order': order,
    'blocks': blocks.map((b) => b.toMap()).toList(),
  };

  static ReportSection? fromMap(Map<dynamic, dynamic>? map) {
    if (map == null) return null;
    final sectionId = map['sectionId'];
    if (sectionId is! String) return null;
    final kind = ReportSectionKind.values.firstWhere(
      (k) => k.name == map['kind'],
      orElse: () => ReportSectionKind.researchNotes,
    );
    return ReportSection(
      sectionId: sectionId,
      kind: kind,
      title: (map['title'] as String?) ?? kind.label,
      visible: map['visible'] != false,
      order: (map['order'] as num?)?.toInt() ?? 0,
      blocks: (map['blocks'] as List?)?.map((b) => ContentBlock.fromMap(b as Map?)).whereType<ContentBlock>().toList() ?? const [],
    );
  }
}

ReportSection? _section(ReportSectionKind kind, int order, List<ContentBlock> blocks) {
  if (blocks.isEmpty) return null;
  return ReportSection(sectionId: kind.name, kind: kind, title: kind.label, visible: true, order: order, blocks: blocks);
}

// ── Citations ────────────────────────────────────────────────────────

class Citation {
  const Citation({
    required this.citationId,
    required this.number,
    required this.title,
    required this.publisher,
    required this.date,
    required this.url,
    required this.relatedEntityId,
    required this.relatedReferenceId,
  });
  final String citationId;
  final int number;
  final String title;
  final String? publisher;
  final String? date;
  final String? url;
  final String? relatedEntityId;
  final String? relatedReferenceId;

  Map<String, dynamic> toMap() => {
    'citationId': citationId,
    'number': number,
    'title': title,
    'publisher': publisher,
    'date': date,
    'url': url,
    'relatedEntityId': relatedEntityId,
    'relatedReferenceId': relatedReferenceId,
  };

  static Citation? fromMap(Map<dynamic, dynamic>? map) {
    if (map == null) return null;
    final citationId = map['citationId'];
    if (citationId is! String) return null;
    return Citation(
      citationId: citationId,
      number: (map['number'] as num?)?.toInt() ?? 0,
      title: (map['title'] as String?) ?? '',
      publisher: map['publisher'] as String?,
      date: map['date'] as String?,
      url: map['url'] as String?,
      relatedEntityId: map['relatedEntityId'] as String?,
      relatedReferenceId: map['relatedReferenceId'] as String?,
    );
  }
}

String? _str(Object? v) => (v is String && v.isNotEmpty) ? v : null;

String _citationKey({required String title, String? date, String? url}) =>
    url != null ? 'url:$url' : 'td:$title|${date ?? ''}';

/// Builds a deduplicated, numbered citation list from every included
/// EVIDENCE/SOURCE item's own saved metadata.
List<Citation> buildCitations(List<ResearchItem> includedItems) {
  final relevant = includedItems.where((i) => i.type == ResearchItemType.evidence || i.type == ResearchItemType.source);
  final byKey = <String, Citation>{};
  var n = 0;
  for (final item in relevant) {
    final title = _str(item.metadata['sourceName']) ?? item.title;
    final date = _str(item.metadata['publicationDate']);
    final url = _str(item.metadata['sourceUrl']);
    final key = _citationKey(title: title, date: date, url: url);
    if (byKey.containsKey(key)) continue;
    n += 1;
    byKey[key] = Citation(
      citationId: 'cite-$n',
      number: n,
      title: title,
      publisher: _str(item.metadata['sourceType']),
      date: date,
      url: url,
      relatedEntityId: item.entityId,
      relatedReferenceId: item.referenceId,
    );
  }
  return byKey.values.toList();
}

List<String> _citationNumbersFor(List<Citation> citations, ResearchItem item) {
  final title = _str(item.metadata['sourceName']) ?? item.title;
  final date = _str(item.metadata['publicationDate']);
  final url = _str(item.metadata['sourceUrl']);
  final key = _citationKey(title: title, date: date, url: url);
  return citations
      .where((c) => _citationKey(title: c.title, date: c.date, url: c.url) == key)
      .map((c) => '${c.number}')
      .toList();
}

// ── Selection ────────────────────────────────────────────────────────

class SelectionSummary {
  const SelectionSummary({
    required this.includedCount,
    required this.excludedCount,
    required this.needsReviewCount,
    required this.hasNeedsReview,
  });
  final int includedCount;
  final int excludedCount;
  final int needsReviewCount;
  final bool hasNeedsReview;
}

SelectionSummary summarizeSelection(List<ResearchItem> items) {
  final included = items.where((i) => i.status == FindingStatus.included).length;
  final excluded = items.where((i) => i.status == FindingStatus.excluded).length;
  final needsReview = items.where((i) => i.status == FindingStatus.needsReview).length;
  return SelectionSummary(
    includedCount: included,
    excludedCount: excluded,
    needsReviewCount: needsReview,
    hasNeedsReview: needsReview > 0,
  );
}

// ── Per-entity canonical context ────────────────────────────────────

class ReportAttentionSummary {
  const ReportAttentionSummary({
    required this.peakDate,
    required this.peakViews,
    required this.latestViews,
    required this.changePct,
  });
  final String peakDate;
  final int peakViews;
  final int latestViews;
  final double changePct;
}

class EntityReportContext {
  const EntityReportContext({
    required this.entityId,
    required this.entityName,
    this.profession,
    this.currentCritiScore,
    this.currentSentimentScore,
    this.coverageReport,
    this.historicalOverview,
    this.attentionSummary,
  });
  final String entityId;
  final String entityName;
  final String? profession;
  final double? currentCritiScore;
  final double? currentSentimentScore;
  final CoverageReport? coverageReport;
  final HistoricalOverview? historicalOverview;
  final ReportAttentionSummary? attentionSummary;
}

// ── Generation ───────────────────────────────────────────────────────

class GeneratedReport {
  const GeneratedReport({required this.sections, required this.citations, required this.selection});
  final List<ReportSection> sections;
  final List<Citation> citations;
  final SelectionSummary selection;
}

/// Builds every non-empty section from the workspace's Included items
/// plus whatever optional per-entity canonical context the caller
/// supplies. A section with nothing to show is omitted entirely.
GeneratedReport generateReport({
  required List<ResearchItem> items,
  required List<EntityReportContext> entities,
  required DateTime now,
}) {
  final included = items.where((i) => i.status == FindingStatus.included).toList();
  final selection = summarizeSelection(items);
  final citations = buildCitations(included);

  List<ResearchItem> byType(ResearchItemType t) => included.where((i) => i.type == t).toList();

  var seq = 0;
  String nextId() => 'b${++seq}';

  final sections = <ReportSection?>[];

  // 1. Executive Summary
  {
    final evidenceCount = byType(ResearchItemType.evidence).length;
    final claimCount = byType(ResearchItemType.claim).length;
    final controversyCount = byType(ResearchItemType.controversy).length;
    final entityNames = entities.map((e) => e.entityName).toList();
    final blocks = <ContentBlock>[];
    if (entityNames.isNotEmpty) {
      blocks.add(
        _fact(
          nextId(),
          'This report covers ${entityNames.length == 1 ? entityNames.first : entityNames.join(", ")}, '
          'compiled from ${included.length} selected workspace item${included.length == 1 ? "" : "s"} '
          'out of ${items.length} collected.',
        ),
      );
    }
    if (evidenceCount > 0 || claimCount > 0 || controversyCount > 0) {
      final parts = <String>[];
      if (controversyCount > 0) parts.add('$controversyCount documented controversy record${controversyCount == 1 ? "" : "s"}');
      if (claimCount > 0) parts.add('$claimCount verified claim${claimCount == 1 ? "" : "s"}');
      if (evidenceCount > 0) parts.add('$evidenceCount evidence citation${evidenceCount == 1 ? "" : "s"}');
      blocks.add(_fact(nextId(), 'CritiTrack records include ${parts.join(", ")} selected for this report.'));
    }
    if (selection.hasNeedsReview) {
      blocks.add(
        _limitation(
          nextId(),
          '${selection.needsReviewCount} workspace item${selection.needsReviewCount == 1 ? "" : "s"} '
          '${selection.needsReviewCount == 1 ? "is" : "are"} marked Needs Review and '
          '${selection.needsReviewCount == 1 ? "was" : "were"} not included in this report.',
        ),
      );
    }
    blocks.add(
      _limitation(
        nextId(),
        'This summary reflects only the sources and records selected for this report, and is not a '
        'determination of guilt, wrongdoing, or truth beyond what the cited sources themselves state.',
      ),
    );
    sections.add(_section(ReportSectionKind.executiveSummary, 0, blocks));
  }

  // 2. Scope & Entities
  {
    final blocks = entities
        .map(
          (e) => _fact(
            nextId(),
            '${e.entityName}${e.profession != null ? " — ${e.profession}" : ""}'
            '${e.currentCritiScore != null ? ". CritiScore: ${e.currentCritiScore!.round()}." : ""}'
            '${e.currentSentimentScore != null ? " Sentiment: ${e.currentSentimentScore!.round()}." : ""}',
          ),
        )
        .toList();
    sections.add(_section(ReportSectionKind.scopeEntities, 1, blocks));
  }

  // 3. Professional Background
  {
    final entityItems = byType(ResearchItemType.entity).where((i) => i.summary.isNotEmpty);
    final blocks = entityItems.map((i) => _fact(nextId(), '${i.title}: ${i.summary}')).toList();
    sections.add(_section(ReportSectionKind.professionalBackground, 2, blocks));
  }

  // 4. Career & Organization History
  {
    final careerEvents = included.where(
      (i) => i.type == ResearchItemType.changeEvent && '${i.metadata['changeType'] ?? ''}'.toLowerCase().contains('career'),
    );
    final blocks = careerEvents.map((i) => _fact(nextId(), '${i.title}${i.summary.isNotEmpty ? " — ${i.summary}" : ""}')).toList();
    sections.add(_section(ReportSectionKind.careerHistory, 3, blocks));
  }

  // 5. Major Events (excluding anything already a controversy)
  {
    final controversyRefs = byType(ResearchItemType.controversy).map((i) => i.referenceId).toSet();
    final events = [...byType(ResearchItemType.timelineEvent), ...byType(ResearchItemType.changeEvent)]
        .where((i) => !controversyRefs.contains(i.referenceId));
    final blocks = events
        .map(
          (i) => _fact(
            nextId(),
            '${i.metadata['date'] ?? i.addedAt.toIso8601String().substring(0, 10)} — ${i.title}'
            '${i.summary.isNotEmpty ? ": ${i.summary}" : ""}',
          ),
        )
        .toList();
    sections.add(_section(ReportSectionKind.majorEvents, 4, blocks));
  }

  // 6. Controversies
  {
    final blocks = byType(ResearchItemType.controversy).map((i) {
      final parts = <String>[
        if (i.metadata['severity'] != null) 'severity ${i.metadata['severity']}',
        if (_str(i.metadata['status']) != null) _str(i.metadata['status'])!,
        if (i.metadata['year'] != null) '${i.metadata['year']}',
      ];
      return _fact(
        nextId(),
        '${i.title}${parts.isNotEmpty ? " (${parts.join(", ")})" : ""}${i.summary.isNotEmpty ? ". ${i.summary}" : ""}',
      );
    }).toList();
    sections.add(_section(ReportSectionKind.controversies, 5, blocks));
  }

  // 7. Claims & Verification
  {
    final blocks = <ContentBlock>[];
    for (final i in byType(ResearchItemType.claim)) {
      blocks.add(
        _fact(
          nextId(),
          'Claim: "${i.title}". Verification status: ${_str(i.metadata['status']) ?? "unknown"}. '
          'Confidence: ${_str(i.metadata['confidence']) ?? "unknown"}.'
          '${i.metadata['evidenceCount'] != null ? " Evidence: ${i.metadata['evidenceCount']} source(s)." : ""}',
        ),
      );
      if (i.note.isNotEmpty) blocks.add(_userNote(nextId(), i.note));
    }
    sections.add(_section(ReportSectionKind.claims, 6, blocks));
  }

  // 8. News & Public Coverage
  {
    final blocks = byType(ResearchItemType.newsEvent)
        .map((i) => _fact(nextId(), '${i.title}${i.summary.isNotEmpty ? " — ${i.summary}" : ""}', _citationNumbersFor(citations, i)))
        .toList();
    sections.add(_section(ReportSectionKind.news, 7, blocks));
  }

  // 9. Sentiment History
  {
    final blocks = <ContentBlock>[];
    for (final e in entities) {
      final h = e.historicalOverview;
      if (h == null || !h.hasHistory) continue;
      blocks.add(
        _fact(
          nextId(),
          '${e.entityName}: sentiment tracked from ${h.firstSnapshotDate} to ${h.latestSnapshotDate} '
          '(${h.snapshotCount} measured snapshots).',
        ),
      );
      for (final tp in h.turningPoints.where((t) => t.kind == TurningPointKind.sentiment)) {
        blocks.add(_fact(nextId(), '${tp.date} — ${tp.title}'));
      }
    }
    sections.add(_section(ReportSectionKind.sentimentHistory, 8, blocks));
  }

  // 10. CritiScore History
  {
    final blocks = <ContentBlock>[];
    for (final e in entities) {
      final h = e.historicalOverview;
      if (h == null) continue;
      final scoreCovMatches = h.coverage.where((c) => c.key == HistoricalDimensionKey.critiScore);
      final scoreCov = scoreCovMatches.isEmpty ? null : scoreCovMatches.first;
      if (scoreCov != null && scoreCov.level != CoverageLevel.unavailable) {
        blocks.add(_fact(nextId(), '${e.entityName}: ${scoreCov.reasons.join("; ")}.'));
      }
      for (final tp in h.turningPoints.where((t) => t.kind == TurningPointKind.score)) {
        blocks.add(_fact(nextId(), '${tp.date} — ${tp.title}: ${tp.summary}'));
      }
    }
    sections.add(_section(ReportSectionKind.critiscoreHistory, 9, blocks));
  }

  // 11. Attention History
  {
    final blocks = <ContentBlock>[];
    for (final e in entities) {
      final a = e.attentionSummary;
      if (a == null) continue;
      blocks.add(
        _fact(
          nextId(),
          '${e.entityName}: peak attention on ${a.peakDate} (${a.peakViews} views); '
          'latest ${a.latestViews} views (${a.changePct >= 0 ? "+" : ""}${a.changePct.round()}%).',
        ),
      );
    }
    sections.add(_section(ReportSectionKind.attentionHistory, 10, blocks));
  }

  // 12. Evidence & Sources
  {
    final blocks = citations
        .map((c) => _fact(nextId(), '[${c.number}] ${c.title}${c.date != null ? " — ${c.date}" : ""}${c.url != null ? " (${c.url})" : ""}'))
        .toList();
    sections.add(_section(ReportSectionKind.evidenceSources, 11, blocks));
  }

  // 13. Data Coverage & Limitations
  {
    final blocks = <ContentBlock>[];
    for (final e in entities) {
      final cov = e.coverageReport;
      if (cov == null) continue;
      for (final d in cov.dimensions) {
        if (d.level == CoverageLevel.unavailable) {
          blocks.add(_limitation(nextId(), '${e.entityName} — ${d.label}: ${d.reasons.isNotEmpty ? d.reasons.join("; ") : "unavailable"}.'));
        }
      }
    }
    sections.add(_section(ReportSectionKind.dataCoverage, 12, blocks));
  }

  // 14. Methodology — only the systems this report's own content
  // actually drew on, using each system's own tracked label/version
  // (never a new methodology). Descriptions mirror the public
  // methodology content on the web (site/lib/methodology.ts), which
  // Flutter has no separate content-page twin of.
  {
    final relevantSystems = <MethodologySystem>{MethodologySystem.entityResolution, MethodologySystem.evidence};
    if (byType(ResearchItemType.claim).isNotEmpty) relevantSystems.add(MethodologySystem.claims);
    if (byType(ResearchItemType.controversy).isNotEmpty) relevantSystems.add(MethodologySystem.critiscore);
    if (entities.any((e) => e.currentSentimentScore != null || (e.historicalOverview?.hasHistory ?? false))) {
      relevantSystems.add(MethodologySystem.sentiment);
    }
    if (entities.any((e) => e.coverageReport != null)) relevantSystems.add(MethodologySystem.coverage);

    const descriptions = {
      MethodologySystem.entityResolution:
          'Matches a searched name against Wikidata using occupation, notability, and available aliases/dates — never name alone — and reports a confidence band rather than a bare yes/no.',
      MethodologySystem.evidence:
          'Normalises every retrieved article, video, or citation into one evidence record with a source type, date, and deterministic strength rating; syndicated copies of the same story are grouped, not counted as separate confirmations.',
      MethodologySystem.claims:
          'Breaks a controversy into the discrete things actually claimed, each with its own evidence-based status — never a bare true/false verdict.',
      MethodologySystem.critiscore:
          'A fixed, deterministic formula over documented, corroborated controversy records — never a language model — weighted by severity, recency, and unresolved status.',
      MethodologySystem.sentiment:
          'A three-method ensemble blended with reach weighting; the spread between methods becomes the reported confidence band.',
      MethodologySystem.coverage:
          'Rates how much usable data exists per dimension (high/medium/low/insufficient/unavailable) — never a single combined score, never derived from popularity.',
      MethodologySystem.timeline: 'Merges every dated signal onto one axis by real, already-computed importance.',
    };

    final blocks = relevantSystems
        .map((s) => _fact(nextId(), '${s.label} (v${s.version}): ${descriptions[s] ?? ''}'))
        .toList();
    sections.add(_section(ReportSectionKind.methodology, 13, blocks));
  }

  // 15. Research Notes
  {
    final noteItems = byType(ResearchItemType.note);
    final annotated = included.where((i) => i.type != ResearchItemType.note && i.note.isNotEmpty);
    final blocks = [
      ...noteItems.map((i) => _userNote(nextId(), i.note)),
      ...annotated.map((i) => _userNote(nextId(), '${i.title}: ${i.note}')),
    ];
    sections.add(_section(ReportSectionKind.researchNotes, 14, blocks));
  }

  // 16. Conclusion
  {
    final blocks = [
      _fact(
        nextId(),
        'This report presents the research selected as of ${now.toIso8601String().substring(0, 10)}. '
        'It is a structured presentation of existing CritiTrack records, not an independent finding, '
        'and should be read alongside the cited sources.',
      ),
    ];
    sections.add(_section(ReportSectionKind.conclusion, 15, blocks));
  }

  final finalSections = sections.whereType<ReportSection>().toList();
  return GeneratedReport(sections: finalSections, citations: citations, selection: selection);
}
