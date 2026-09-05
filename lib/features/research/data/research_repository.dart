/// Storage for Research Workspaces.
///
/// Local-first, same convention as `watchlist_repository.dart`: Hive is
/// authoritative on the device, so opening a workspace, adding an item,
/// or writing a note works instantly and offline. Firestore is a
/// best-effort mirror for cross-device sync, keyed by uid under
/// `users/{uid}/researchWorkspaces/{workspaceId}` — same path
/// `research-store.ts` uses on the web, and the same
/// `request.auth.uid == userId` rule in `firestore.rules`.
///
/// Unlike the watchlist (one small document mirrors the whole list),
/// a workspace can hold many items, so each workspace/item/activity
/// entry is written to its own Firestore document — the same shape as
/// the Hive-local write it accompanies, so a mutation is one local write
/// plus one best-effort remote write, never a full-list recomputation.
library;

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:crititrack/core/utils/research.dart';

const String researchWorkspacesBoxName = 'research_workspaces';
const String researchItemsBoxName = 'research_items';
const String researchActivityBoxName = 'research_activity';

String _itemKey(String workspaceId, String itemId) => '$workspaceId::$itemId';

class ResearchRepository {
  ResearchRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _injectedFirestore = firestore,
      _injectedAuth = auth;

  final FirebaseFirestore? _injectedFirestore;
  final FirebaseAuth? _injectedAuth;

  static const String _collection = 'researchWorkspaces';

  Box<dynamic>? get _workspaces =>
      Hive.isBoxOpen(researchWorkspacesBoxName) ? Hive.box(researchWorkspacesBoxName) : null;
  Box<dynamic>? get _items => Hive.isBoxOpen(researchItemsBoxName) ? Hive.box(researchItemsBoxName) : null;
  Box<dynamic>? get _activity =>
      Hive.isBoxOpen(researchActivityBoxName) ? Hive.box(researchActivityBoxName) : null;

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

  // ── Workspaces ──────────────────────────────────────────────────────

  List<ResearchWorkspace> allWorkspaces() {
    final box = _workspaces;
    if (box == null) return const [];
    final out = <ResearchWorkspace>[];
    for (final value in box.values) {
      final w = ResearchWorkspace.fromMap(_asMap(value));
      if (w != null) out.add(w);
    }
    out.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return out;
  }

  ResearchWorkspace? getWorkspace(String workspaceId) =>
      ResearchWorkspace.fromMap(_asMap(_workspaces?.get(workspaceId)));

  Future<void> saveWorkspace(ResearchWorkspace workspace) async {
    await _workspaces?.put(workspace.workspaceId, workspace.toMap());
    unawaited(_mirrorWorkspace(workspace));
  }

  Future<void> deleteWorkspace(String workspaceId) async {
    await _workspaces?.delete(workspaceId);
    final items = _items;
    if (items != null) {
      final toDrop = items.keys.where((k) => '$k'.startsWith('$workspaceId::')).toList();
      for (final k in toDrop) {
        await items.delete(k);
      }
    }
    final activity = _activity;
    if (activity != null) {
      final toDrop = activity.keys.where((k) => '$k'.startsWith('$workspaceId::')).toList();
      for (final k in toDrop) {
        await activity.delete(k);
      }
    }
    unawaited(_deleteWorkspaceFromCloud(workspaceId));
  }

  // ── Items ───────────────────────────────────────────────────────────

  List<ResearchItem> itemsFor(String workspaceId) {
    final box = _items;
    if (box == null) return const [];
    final out = <ResearchItem>[];
    for (final key in box.keys) {
      if (!'$key'.startsWith('$workspaceId::')) continue;
      final item = ResearchItem.fromMap(_asMap(box.get(key)));
      if (item != null) out.add(item);
    }
    return out;
  }

  ResearchItem? findItemByReference(String workspaceId, ResearchItemType type, String referenceId) {
    final key = stableItemKey(type, referenceId);
    if (key == null) return null;
    return ResearchItem.fromMap(_asMap(_items?.get(_itemKey(workspaceId, key))));
  }

  /// Writes an item keyed by its stable id when it has one — the same
  /// dedup identity `addResearchItem` uses in memory, so a second save
  /// of the same (type, referenceId) is a local overwrite, never a
  /// second row.
  Future<void> upsertItem(ResearchItem item) async {
    final id = stableItemKey(item.type, item.referenceId) ?? item.itemId;
    final stored = id == item.itemId ? item : ResearchItem(
      itemId: id,
      workspaceId: item.workspaceId,
      type: item.type,
      entityId: item.entityId,
      title: item.title,
      summary: item.summary,
      referenceId: item.referenceId,
      addedAt: item.addedAt,
      updatedAt: item.updatedAt,
      note: item.note,
      tags: item.tags,
      position: item.position,
      status: item.status,
      metadata: item.metadata,
    );
    await _items?.put(_itemKey(item.workspaceId, id), stored.toMap());
    unawaited(_mirrorItem(stored));
  }

  Future<void> removeItem(String workspaceId, String itemId) async {
    await _items?.delete(_itemKey(workspaceId, itemId));
    unawaited(_deleteItemFromCloud(workspaceId, itemId));
  }

  // ── Activity ─────────────────────────────────────────────────────────

  Future<void> appendActivity(ActivityEntry entry) async {
    await _activity?.put(_itemKey(entry.workspaceId, entry.activityId), entry.toMap());
    unawaited(_mirrorActivity(entry));
  }

  List<ActivityEntry> activityFor(String workspaceId) {
    final box = _activity;
    if (box == null) return const [];
    final out = <ActivityEntry>[];
    for (final key in box.keys) {
      if (!'$key'.startsWith('$workspaceId::')) continue;
      final entry = ActivityEntry.fromMap(_asMap(box.get(key)));
      if (entry != null) out.add(entry);
    }
    out.sort((a, b) => b.at.compareTo(a.at));
    return out;
  }

  // ── Cloud mirror (best-effort; never blocks or throws outward) ──────

  Future<void> _mirrorWorkspace(ResearchWorkspace w) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db
          .collection('users')
          .doc(uid)
          .collection(_collection)
          .doc(w.workspaceId)
          .set(w.toMap(), SetOptions(merge: true));
    } catch (e) {
      debugPrint('Research workspace cloud mirror skipped: $e');
    }
  }

  Future<void> _mirrorItem(ResearchItem item) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db
          .collection('users')
          .doc(uid)
          .collection(_collection)
          .doc(item.workspaceId)
          .collection('items')
          .doc(item.itemId)
          .set(item.toMap(), SetOptions(merge: true));
    } catch (e) {
      debugPrint('Research item cloud mirror skipped: $e');
    }
  }

  Future<void> _mirrorActivity(ActivityEntry entry) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db
          .collection('users')
          .doc(uid)
          .collection(_collection)
          .doc(entry.workspaceId)
          .collection('activity')
          .doc(entry.activityId)
          .set(entry.toMap());
    } catch (e) {
      debugPrint('Research activity cloud mirror skipped: $e');
    }
  }

  Future<void> _deleteWorkspaceFromCloud(String workspaceId) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db.collection('users').doc(uid).collection(_collection).doc(workspaceId).delete();
    } catch (e) {
      debugPrint('Research workspace cloud delete skipped: $e');
    }
  }

  Future<void> _deleteItemFromCloud(String workspaceId, String itemId) async {
    final db = _firestore;
    final uid = _uid;
    if (db == null || uid == null) return;
    try {
      await db
          .collection('users')
          .doc(uid)
          .collection(_collection)
          .doc(workspaceId)
          .collection('items')
          .doc(itemId)
          .delete();
    } catch (e) {
      debugPrint('Research item cloud delete skipped: $e');
    }
  }

  /// Pulls every remote workspace (and its items) down and merges into
  /// the local boxes — union, not overwrite: a workspace created
  /// offline on this device and one created on another must both
  /// survive. Ties on a workspace go to the more recently updated copy.
  Future<void> mergeFromCloud() async {
    final db = _firestore;
    final uid = _uid;
    final box = _workspaces;
    if (db == null || uid == null || box == null) return;

    try {
      final snap = await db.collection('users').doc(uid).collection(_collection).get();
      for (final doc in snap.docs) {
        final remote = ResearchWorkspace.fromMap(doc.data());
        if (remote == null) continue;
        final local = getWorkspace(remote.workspaceId);
        if (local == null || remote.updatedAt.isAfter(local.updatedAt)) {
          await box.put(remote.workspaceId, remote.toMap());
        }

        final itemsSnap = await doc.reference.collection('items').get();
        for (final itemDoc in itemsSnap.docs) {
          final remoteItem = ResearchItem.fromMap(itemDoc.data());
          if (remoteItem == null) continue;
          final key = _itemKey(remoteItem.workspaceId, remoteItem.itemId);
          final localItem = ResearchItem.fromMap(_asMap(_items?.get(key)));
          if (localItem == null || remoteItem.updatedAt.isAfter(localItem.updatedAt)) {
            await _items?.put(key, remoteItem.toMap());
          }
        }
      }
    } catch (e) {
      debugPrint('Research workspace cloud merge skipped: $e');
    }
  }
}
