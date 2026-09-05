/// Storage for saved comparisons — a comparison document is small (two
/// entity ids, a title, filters), so unlike workspaces/reports it needs
/// no subcollection. Same local-first, Firestore-mirror pattern as
/// `research_repository.dart` and `report_repository.dart`.
library;

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:crititrack/core/utils/compare.dart';
import 'package:crititrack/core/utils/historical.dart';

const String comparisonsBoxName = 'saved_comparisons';

Map<String, dynamic> _comparisonToMap(Comparison c) => {
  'comparisonId': c.comparisonId,
  'userId': c.userId,
  'entityIds': c.entityIds,
  'title': c.title,
  'createdAt': c.createdAt.toIso8601String(),
  'updatedAt': c.updatedAt.toIso8601String(),
  'topic': c.filters.topic.name,
  'dataMode': c.filters.dataMode.name,
  'timeRange': c.timeRange.name,
  'methodologyVersion': c.methodologyVersion,
};

Comparison? _comparisonFromMap(Map<dynamic, dynamic>? map) {
  if (map == null) return null;
  final comparisonId = map['comparisonId'];
  final userId = map['userId'];
  final createdAt = DateTime.tryParse('${map['createdAt']}');
  final updatedAt = DateTime.tryParse('${map['updatedAt']}');
  if (comparisonId is! String || userId is! String || createdAt == null || updatedAt == null) return null;
  return Comparison(
    comparisonId: comparisonId,
    userId: userId,
    entityIds: (map['entityIds'] as List?)?.whereType<String>().toList() ?? const [],
    title: (map['title'] as String?) ?? 'Untitled comparison',
    createdAt: createdAt,
    updatedAt: updatedAt,
    filters: ComparisonFilters(
      topic: ComparisonTopic.values.firstWhere((t) => t.name == map['topic'], orElse: () => ComparisonTopic.all),
      dataMode: ComparisonDataMode.values.firstWhere((d) => d.name == map['dataMode'], orElse: () => ComparisonDataMode.all),
    ),
    timeRange: HistoricalTimeRange.values.firstWhere((r) => r.name == map['timeRange'], orElse: () => HistoricalTimeRange.y1),
    methodologyVersion: (map['methodologyVersion'] as String?) ?? kCompareMethodologyVersion,
  );
}

class CompareRepository {
  CompareRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _injectedFirestore = firestore,
      _injectedAuth = auth;

  final FirebaseFirestore? _injectedFirestore;
  final FirebaseAuth? _injectedAuth;

  static const String _collection = 'comparisons';

  Box<dynamic>? get _box => Hive.isBoxOpen(comparisonsBoxName) ? Hive.box(comparisonsBoxName) : null;

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

  List<Comparison> all() {
    final box = _box;
    if (box == null) return const [];
    final out = <Comparison>[];
    for (final value in box.values) {
      final c = _comparisonFromMap(value is Map ? value.cast<String, dynamic>() : null);
      if (c != null) out.add(c);
    }
    out.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return out;
  }

  Comparison? get(String comparisonId) {
    final value = _box?.get(comparisonId);
    return _comparisonFromMap(value is Map ? value.cast<String, dynamic>() : null);
  }

  Future<void> save(Comparison c) async {
    await _box?.put(c.comparisonId, _comparisonToMap(c));
    unawaited(_mirror(c));
  }

  Future<void> delete(String comparisonId) async {
    await _box?.delete(comparisonId);
    unawaited(_deleteFromCloud(comparisonId));
  }

  Future<void> _mirror(Comparison c) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db.collection('users').doc(uid).collection(_collection).doc(c.comparisonId).set(_comparisonToMap(c), SetOptions(merge: true));
    } catch (e) {
      debugPrint('Comparison cloud mirror skipped: $e');
    }
  }

  Future<void> _deleteFromCloud(String comparisonId) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db.collection('users').doc(uid).collection(_collection).doc(comparisonId).delete();
    } catch (e) {
      debugPrint('Comparison cloud delete skipped: $e');
    }
  }
}
