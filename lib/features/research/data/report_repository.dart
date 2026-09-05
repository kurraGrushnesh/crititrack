/// Storage for Professional Research Reports — the same local-first,
/// Firestore-mirror pattern as `research_repository.dart`. Sections and
/// citations are stored under their own Hive keys (mirroring
/// `report-store.ts`'s Firestore subcollections) so a long, heavily
/// cited report is never one giant blob.
library;

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:crititrack/core/utils/report.dart';

const String reportsBoxName = 'research_reports';
const String reportSectionsBoxName = 'research_report_sections';
const String reportCitationsBoxName = 'research_report_citations';

String _subKey(String reportId, String id) => '$reportId::$id';

class ReportRepository {
  ReportRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _injectedFirestore = firestore,
      _injectedAuth = auth;

  final FirebaseFirestore? _injectedFirestore;
  final FirebaseAuth? _injectedAuth;

  static const String _collection = 'researchReports';

  Box<dynamic>? get _reports => Hive.isBoxOpen(reportsBoxName) ? Hive.box(reportsBoxName) : null;
  Box<dynamic>? get _sections => Hive.isBoxOpen(reportSectionsBoxName) ? Hive.box(reportSectionsBoxName) : null;
  Box<dynamic>? get _citations => Hive.isBoxOpen(reportCitationsBoxName) ? Hive.box(reportCitationsBoxName) : null;

  FirebaseFirestore? get _firestore {
    if (_injectedFirestore != null) return _injectedFirestore;
    if (Firebase.apps.isEmpty) return null;
    return FirebaseFirestore.instance;
  }

  FirebaseAuth? get _authInstance {
    if (_injectedAuth != null) return _injectedAuth;
    if (Firebase.apps.isEmpty) return null;
    return FirebaseAuth.instance;
  }

  String? get _uid => _authInstance?.currentUser?.uid;

  Map<String, dynamic>? _asMap(Object? v) => v is Map ? v.cast<String, dynamic>() : null;

  List<ResearchReport> allReports({String? workspaceId}) {
    final box = _reports;
    if (box == null) return const [];
    final out = <ResearchReport>[];
    for (final value in box.values) {
      final r = ResearchReport.fromMap(_asMap(value));
      if (r == null) continue;
      if (workspaceId != null && r.workspaceId != workspaceId) continue;
      out.add(r);
    }
    out.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return out;
  }

  ResearchReport? getReport(String reportId) => ResearchReport.fromMap(_asMap(_reports?.get(reportId)));

  Future<void> saveReport(ResearchReport report) async {
    await _reports?.put(report.reportId, report.toMap());
    unawaited(_mirrorReport(report));
  }

  Future<void> deleteReport(String reportId) async {
    await _reports?.delete(reportId);
    for (final box in [_sections, _citations]) {
      if (box == null) continue;
      final toDrop = box.keys.where((k) => '$k'.startsWith('$reportId::')).toList();
      for (final k in toDrop) {
        await box.delete(k);
      }
    }
    unawaited(_deleteReportFromCloud(reportId));
  }

  List<ReportSection> sectionsFor(String reportId) {
    final box = _sections;
    if (box == null) return const [];
    final out = <ReportSection>[];
    for (final key in box.keys) {
      if (!'$key'.startsWith('$reportId::')) continue;
      final s = ReportSection.fromMap(_asMap(box.get(key)));
      if (s != null) out.add(s);
    }
    out.sort((a, b) => a.order.compareTo(b.order));
    return out;
  }

  List<Citation> citationsFor(String reportId) {
    final box = _citations;
    if (box == null) return const [];
    final out = <Citation>[];
    for (final key in box.keys) {
      if (!'$key'.startsWith('$reportId::')) continue;
      final c = Citation.fromMap(_asMap(box.get(key)));
      if (c != null) out.add(c);
    }
    out.sort((a, b) => a.number.compareTo(b.number));
    return out;
  }

  Future<void> saveSection(String reportId, ReportSection section) async {
    await _sections?.put(_subKey(reportId, section.sectionId), section.toMap());
    unawaited(_mirrorSection(reportId, section));
  }

  /// Replaces every section/citation for a report in one local write —
  /// used after (re)generation, so a reader never sees half the new
  /// content next to half the old.
  Future<void> replaceGeneratedContent(String reportId, List<ReportSection> sections, List<Citation> citations) async {
    final sectionsBox = _sections;
    final citationsBox = _citations;
    if (sectionsBox != null) {
      final toDrop = sectionsBox.keys.where((k) => '$k'.startsWith('$reportId::')).toList();
      for (final k in toDrop) {
        await sectionsBox.delete(k);
      }
      for (final s in sections) {
        await sectionsBox.put(_subKey(reportId, s.sectionId), s.toMap());
      }
    }
    if (citationsBox != null) {
      final toDrop = citationsBox.keys.where((k) => '$k'.startsWith('$reportId::')).toList();
      for (final k in toDrop) {
        await citationsBox.delete(k);
      }
      for (final c in citations) {
        await citationsBox.put(_subKey(reportId, c.citationId), c.toMap());
      }
    }
    unawaited(_mirrorGeneratedContent(reportId, sections, citations));
  }

  Future<void> _mirrorReport(ResearchReport r) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db.collection('users').doc(uid).collection(_collection).doc(r.reportId).set(r.toMap(), SetOptions(merge: true));
    } catch (e) {
      debugPrint('Report cloud mirror skipped: $e');
    }
  }

  Future<void> _mirrorSection(String reportId, ReportSection s) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db
          .collection('users')
          .doc(uid)
          .collection(_collection)
          .doc(reportId)
          .collection('sections')
          .doc(s.sectionId)
          .set(s.toMap());
    } catch (e) {
      debugPrint('Report section cloud mirror skipped: $e');
    }
  }

  Future<void> _mirrorGeneratedContent(String reportId, List<ReportSection> sections, List<Citation> citations) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      final base = db.collection('users').doc(uid).collection(_collection).doc(reportId);
      final existingSections = await base.collection('sections').get();
      for (final d in existingSections.docs) {
        await d.reference.delete();
      }
      final existingCitations = await base.collection('citations').get();
      for (final d in existingCitations.docs) {
        await d.reference.delete();
      }
      final batch = db.batch();
      for (final s in sections) {
        batch.set(base.collection('sections').doc(s.sectionId), s.toMap());
      }
      for (final c in citations) {
        batch.set(base.collection('citations').doc(c.citationId), c.toMap());
      }
      await batch.commit();
    } catch (e) {
      debugPrint('Report content cloud mirror skipped: $e');
    }
  }

  Future<void> _deleteReportFromCloud(String reportId) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db.collection('users').doc(uid).collection(_collection).doc(reportId).delete();
    } catch (e) {
      debugPrint('Report cloud delete skipped: $e');
    }
  }
}
