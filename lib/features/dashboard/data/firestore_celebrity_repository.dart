/// Firestore-first celebrity repository.
///
/// The scheduled `refreshTrackedCelebrities` Cloud Function keeps
/// `celebrities/{slug}` warm in the background. This repository reads
/// that document first and only falls through to the HTTP proxy when the
/// cached copy is missing or older than [freshWindow] — so a user opening
/// a recently-refreshed dashboard gets an instant render instead of
/// waiting on Groq, NewsAPI and YouTube.
///
/// Every layer here degrades rather than fails: any Firestore problem
/// (offline, rules, unsigned-in user) is logged and treated as a cache
/// miss, leaving the proxy path exactly as it behaved before.
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import 'package:crititrack/core/constants/app_constants.dart';
import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/error/result.dart';
import 'package:crititrack/core/utils/anomaly_detection.dart';
import 'package:crititrack/core/utils/forecasting.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/dashboard/data/celebrity_repository.dart';

class FirestoreCelebrityRepository extends CelebrityRepository {
  FirestoreCelebrityRepository({
    required CelebrityRepository remote,
    FirebaseFirestore? firestore,
    this.freshWindow = AppConstants.serverRefreshInterval,
  }) : _remote = remote,
       _firestore = firestore ?? FirebaseFirestore.instance;

  /// The network repository consulted on a cache miss.
  final CelebrityRepository _remote;

  final FirebaseFirestore _firestore;

  /// How long a server-written document counts as current. Matched to the
  /// scheduler's cadence: anything older means the timer has not covered
  /// this celebrity, so a live fetch is warranted.
  final Duration freshWindow;

  @override
  Future<Result<Celebrity>> getCelebrity(String name, {String? qid}) async {
    final cached = await _read(toSlug(name));

    if (cached != null &&
        DateTime.now().difference(cached.fetchedAt) < freshWindow) {
      debugPrint('Firestore hit for ${cached.slug} (${cached.fetchedAt})');
      return Success(cached);
    }

    final fresh = await _remote.getCelebrity(name, qid: qid);

    // A stale cached copy still beats an error screen when the upstream
    // APIs are down.
    if (fresh.isError && cached != null) {
      debugPrint('Remote failed; serving stale Firestore copy');
      return Success(cached);
    }
    return fresh;
  }

  /// Always goes to the network — pull-to-refresh means "ignore caches".
  /// The function writes the result back to Firestore as a side effect.
  @override
  Future<Result<Celebrity>> forceRefresh(String name) =>
      _remote.forceRefresh(name);

  /// Reads the document plus its two sub-collections, or null on any
  /// miss or error.
  Future<Celebrity?> _read(String slug) async {
    try {
      final docRef = _firestore
          .collection(AppConstants.celebritiesCollection)
          .doc(slug);

      final doc = await docRef.get();
      final data = doc.data();
      if (!doc.exists || data == null) return null;

      final results = await Future.wait([
        docRef.collection(AppConstants.mediaItemsSubcollection).get(),
        docRef
            .collection(AppConstants.sentimentSnapshotsSubcollection)
            .orderBy('date')
            .get(),
      ]);

      final mediaItems =
          results[0].docs
              .map((d) => MediaItem.fromFirestore(d.id, d.data()))
              .toList()
            ..sort((a, b) {
              final ad = a.publishedAt;
              final bd = b.publishedAt;
              if (ad == null || bd == null) return 0;
              return bd.compareTo(ad);
            });

      final snapshots =
          results[1].docs
              .map((d) => SentimentSnapshot.fromFirestore(d.data()))
              .toList();

      final celebrity = Celebrity.fromFirestore(
        slug,
        data,
        mediaItems: mediaItems,
        sentimentSnapshots: snapshots,
      );

      // The server stores raw snapshots; anomaly flags and the forecast
      // are derived client-side, exactly as the proxy path does.
      final annotated = annotateSnapshots(celebrity.sentimentData.trendData);
      final forecast =
          linearForecast(annotated.map((s) => s.score).toList())?.forecast ??
          const <double>[];

      return celebrity.copyWith(
        sentimentData: celebrity.sentimentData.copyWith(
          trendData: annotated,
          forecast: forecast,
        ),
      );
    } catch (e) {
      debugPrint('Firestore read failed for $slug: $e');
      return null;
    }
  }
}
