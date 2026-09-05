/// Riverpod wiring for Professional Research Reports — same shape as
/// `research_providers.dart`.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/utils/report.dart';
import 'package:crititrack/core/utils/research.dart';
import 'package:crititrack/features/research/data/report_repository.dart';

export 'package:crititrack/core/utils/report.dart' show EntityReportContext, ReportAttentionSummary;
export 'package:crititrack/core/utils/coverage.dart' show CoverageReport;
export 'package:crititrack/core/utils/historical.dart' show HistoricalOverview;

final reportRepositoryProvider = Provider<ReportRepository>((ref) => ReportRepository());

final reportsForWorkspaceProvider = NotifierProvider.family<ReportsController, List<ResearchReport>, String>(
  ReportsController.new,
);

class ReportsController extends FamilyNotifier<List<ResearchReport>, String> {
  ReportRepository get _repo => ref.read(reportRepositoryProvider);
  String get _workspaceId => arg;

  @override
  List<ResearchReport> build(String arg) => _repo.allReports(workspaceId: arg);

  Future<ResearchReport> create({String? title, List<String> entityIds = const []}) async {
    final now = DateTime.now();
    final report = createReport(
      reportId: 'rp-${now.microsecondsSinceEpoch}',
      workspaceId: _workspaceId,
      userId: 'local',
      entityIds: entityIds,
      title: title,
      now: now,
    );
    await _repo.saveReport(report);
    state = _repo.allReports(workspaceId: _workspaceId);
    return report;
  }

  Future<void> remove(String reportId) async {
    await _repo.deleteReport(reportId);
    state = _repo.allReports(workspaceId: _workspaceId);
  }
}

/// One report's live view: metadata + sections. A [Notifier] (not a
/// family over just an id) so `generate()` can rebuild both at once.
class ReportView {
  const ReportView({required this.report, required this.sections});
  final ResearchReport report;
  final List<ReportSection> sections;
}

final reportViewProvider = NotifierProvider.family<ReportViewController, ReportView?, String>(
  ReportViewController.new,
);

class ReportViewController extends FamilyNotifier<ReportView?, String> {
  ReportRepository get _repo => ref.read(reportRepositoryProvider);
  String get _reportId => arg;

  @override
  ReportView? build(String arg) {
    final report = _repo.getReport(arg);
    if (report == null) return null;
    return ReportView(report: report, sections: _repo.sectionsFor(arg));
  }

  void refreshFromLocal() {
    final report = _repo.getReport(_reportId);
    if (report == null) {
      state = null;
      return;
    }
    state = ReportView(report: report, sections: _repo.sectionsFor(_reportId));
  }

  Future<void> rename(String title) async {
    final current = state;
    if (current == null) return;
    final next = renameReport(current.report, title, DateTime.now());
    state = ReportView(report: next, sections: current.sections);
    await _repo.saveReport(next);
  }

  Future<void> toggleSectionVisibility(String sectionId) async {
    final current = state;
    if (current == null) return;
    final sections = [
      for (final s in current.sections)
        s.sectionId == sectionId ? s.copyWith(visible: !s.visible) : s,
    ];
    state = ReportView(report: current.report, sections: sections);
    final changed = sections.firstWhere((s) => s.sectionId == sectionId);
    await _repo.saveSection(_reportId, changed);
  }

  Future<void> archive() async {
    final current = state;
    if (current == null) return;
    final next = archiveReport(current.report, DateTime.now());
    state = ReportView(report: next, sections: current.sections);
    await _repo.saveReport(next);
  }

  /// Rebuilds every section from the workspace's currently-Included
  /// items and whatever per-entity canonical context the caller
  /// already gathered (coverage/historical overview etc. — computed by
  /// the screen, which has access to a live [Celebrity], not this
  /// provider). Preserves the report's own title/subtitle. On failure,
  /// the previously-saved sections are left completely untouched.
  Future<void> generate({
    required List<ResearchItem> items,
    required List<EntityReportContext> entities,
  }) async {
    final current = state;
    if (current == null) return;
    final now = DateTime.now();
    final result = generateReport(items: items, entities: entities, now: now);
    await _repo.replaceGeneratedContent(_reportId, result.sections, result.citations);

    final updatedReport = current.report.copyWith(
      status: ReportStatus.ready,
      generatedAt: now,
      updatedAt: now,
      version: current.report.version + 1,
      sectionIds: [for (final s in result.sections) s.sectionId],
    );
    await _repo.saveReport(updatedReport);
    state = ReportView(report: updatedReport, sections: result.sections);
  }
}
