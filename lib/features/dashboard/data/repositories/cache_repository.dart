/// Central cache repository that orchestrates all API calls and
/// Firestore persistence.
///
/// **Cache strategy:**
/// 1. Check Firestore for existing `celebrities/{slug}` doc.
/// 2. If `fetchedAt` is within the last 24 hours → return cached data.
/// 3. If the same slug was fetched in the last 5 minutes → return
///    cached data unconditionally (rate-limit guard).
/// 4. Otherwise, run all API services in parallel via `Future.wait()`,
///    assemble the [Celebrity] model, write it to Firestore, and return.
///
/// Enhanced with:
/// - Phase 1: Anomaly detection on snapshots
/// - Phase 2: Evidence via extended prompt
/// - Phase 4: Linear-trend forecast
/// - Phase 5: Source-level decomposition (cache-miss only)
///
/// Dependencies: [OpenAiService], [NewsApiService], [YouTubeApiService],
/// [InstagramApiService], and [FirebaseFirestore].
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/domain/models/celebrity.dart';
import '../../../../core/domain/models/media_item.dart';
import '../../../../core/domain/models/sentiment_data.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/error/result.dart';
import '../../../../core/utils/anomaly_detection.dart';
import '../../../../core/utils/forecasting.dart';
import '../../../../core/utils/helpers.dart';
import '../datasources/openai_service.dart';
import '../../../media_feed/data/datasources/news_api_service.dart';
import '../../../media_feed/data/datasources/youtube_api_service.dart';
import '../../../media_feed/data/datasources/instagram_api_service.dart';

/// Manages the fetch → cache → return lifecycle for celebrity data.
///
/// All writes include Firestore sub-collections for media_items and
/// sentiment_snapshots, enabling granular queries in the dashboard.
class CacheRepository {
  CacheRepository({
    required this.firestore,
    required this.openAiService,
    required this.newsApiService,
    required this.youTubeApiService,
    required this.instagramApiService,
  });

  /// Creates a CacheRepository with all services wired up.
  /// Firebase must be initialized before calling this.
  static Future<CacheRepository> create() async {
    return CacheRepository(
      firestore: FirebaseFirestore.instance,
      openAiService: OpenAiService(),
      newsApiService: NewsApiService(),
      youTubeApiService: YouTubeApiService(),
      instagramApiService: InstagramApiService(),
    );
  }

  final FirebaseFirestore firestore;
  final OpenAiService openAiService;
  final NewsApiService newsApiService;
  final YouTubeApiService youTubeApiService;
  final InstagramApiService instagramApiService;

  /// In-memory rate-limit tracker: slug → last fetch timestamp.
  /// Prevents re-fetching the same celebrity within 5 minutes,
  /// regardless of Firestore cache state.
  final Map<String, DateTime> _rateLimitCache = {};

  /// Fetches celebrity data, using Firestore cache when available.
  ///
  /// Returns a [Celebrity] from cache if fresh, or fetches from all
  /// APIs in parallel and caches the result if stale/missing.
  Future<Result<Celebrity>> getCelebrity(String name) async {
    final slug = toSlug(name);

    try {
      // ── Rate-limit guard (5-minute window) ──────────────────────
      final lastFetch = _rateLimitCache[slug];
      if (lastFetch != null &&
          DateTime.now().difference(lastFetch) < AppConstants.rateLimitWindow) {
        final cached = await _readFromFirestore(slug);
        if (cached != null) return Success(cached);
      }

      // ── Check Firestore cache (24-hour TTL) ─────────────────────
      final cached = await _readFromFirestore(slug);
      if (cached != null && cached.isFresh) {
        return Success(cached);
      }

      // ── Cache miss or stale: fetch fresh data ───────────────────
      return await _fetchAndCache(name, slug);
    } on FirebaseException catch (e, st) {
      return Error(
        FirebaseFailure(
          message: 'Firestore error: ${e.message}',
          stackTrace: st,
        ),
      );
    } catch (e, st) {
      return Error(
        ServerFailure(
          message: 'Unexpected error: ${e.toString()}',
          stackTrace: st,
        ),
      );
    }
  }

  /// Runs all four API services in parallel and caches the result.
  Future<Result<Celebrity>> _fetchAndCache(String name, String slug) async {
    // Run all API calls in parallel for speed
    final results = await Future.wait([
      openAiService.fetchBiography(name), // [0] Biography
      newsApiService.fetchNews(name), // [1] News
      youTubeApiService.fetchVideos(name), // [2] YouTube
      instagramApiService.fetchPosts(name), // [3] Instagram
    ]);

    final bioResult = results[0] as Result<Biography>;
    final newsResult = results[1] as Result<List<MediaItem>>;
    final ytResult = results[2] as Result<List<MediaItem>>;
    final igResult = results[3] as Result<List<MediaItem>>;

    // ── Check for critical failures ─────────────────────────────
    // Biography is required — if it fails, propagate the error
    if (bioResult.isError) {
      return Error((bioResult as Error<Biography>).failure);
    }

    final biography = (bioResult as Success<Biography>).value;

    // Media items are optional — use empty lists on failure
    final newsItems = newsResult.getOrElse(() => []);
    final ytItems = ytResult.getOrElse(() => []);
    final igItems = igResult.getOrElse(() => []);

    // Combine all media items
    final allMediaItems = [...newsItems, ...ytItems, ...igItems];

    // ── Collect texts by source ──────────────────────────────────
    final newsHeadlines =
        newsItems.map((item) => item.title).where((t) => t.isNotEmpty).toList();
    final ytTitles =
        ytItems.map((item) => item.title).where((t) => t.isNotEmpty).toList();
    final igCaptions =
        igItems.map((item) => item.title).where((t) => t.isNotEmpty).toList();

    // Build combined headlines with source labels
    final allHeadlines = <String>[];
    final sourceLabels = <String>[];
    for (final h in newsHeadlines) {
      allHeadlines.add(h);
      sourceLabels.add('news');
    }
    for (final h in ytTitles) {
      allHeadlines.add(h);
      sourceLabels.add('youtube');
    }
    for (final h in igCaptions) {
      allHeadlines.add(h);
      sourceLabels.add('instagram');
    }

    // ── Main sentiment analysis (with evidence — Phase 2) ────────
    final sentimentResult = await openAiService.analyzeSentiment(
      name,
      allHeadlines,
      sourceLabels: sourceLabels,
    );

    var sentimentData = sentimentResult.getOrElse(
      () => SentimentData(
        overallScore: 50.0,
        positiveRatio: 0.33,
        negativeRatio: 0.33,
        neutralRatio: 0.34,
        trendDirection: 'stable',
        explanation: 'Sentiment analysis unavailable.',
        trendData: const [],
        dominantEmotion: 'neutral',
      ),
    );

    // ── Phase 5: Source-level decomposition (cache-miss only) ────
    double? scoreNews;
    double? scoreYoutube;
    double? scoreInstagram;

    if (newsHeadlines.isNotEmpty ||
        ytTitles.isNotEmpty ||
        igCaptions.isNotEmpty) {
      final sourceResults = await Future.wait([
        if (newsHeadlines.isNotEmpty)
          openAiService.analyzeSourceSentiment(name, newsHeadlines, 'news')
        else
          Future.value(
            const Error<double>(NotFoundFailure(message: 'No news texts')),
          ),
        if (ytTitles.isNotEmpty)
          openAiService.analyzeSourceSentiment(name, ytTitles, 'YouTube')
        else
          Future.value(
            const Error<double>(NotFoundFailure(message: 'No YouTube texts')),
          ),
        if (igCaptions.isNotEmpty)
          openAiService.analyzeSourceSentiment(name, igCaptions, 'Instagram')
        else
          Future.value(
            const Error<double>(NotFoundFailure(message: 'No Instagram texts')),
          ),
      ]);

      int sourceIdx = 0;
      if (newsHeadlines.isNotEmpty) {
        scoreNews = sourceResults[sourceIdx].getOrElse(
          () => sentimentData.overallScore,
        );
        sourceIdx++;
      }
      if (ytTitles.isNotEmpty) {
        scoreYoutube = sourceResults[sourceIdx].getOrElse(
          () => sentimentData.overallScore,
        );
        sourceIdx++;
      }
      if (igCaptions.isNotEmpty) {
        scoreInstagram = sourceResults[sourceIdx].getOrElse(
          () => sentimentData.overallScore,
        );
      }

      debugPrint(
        'Source scores: news=$scoreNews, yt=$scoreYoutube, ig=$scoreInstagram',
      );
    }

    // ── Phase 1: Anomaly detection ──────────────────────────────
    final annotatedTrend = annotateSnapshots(sentimentData.trendData);

    // ── Phase 4: Forecast computation ───────────────────────────
    final scores = annotatedTrend.map((s) => s.score).toList();
    final forecastResult = linearForecast(scores);
    final forecast = forecastResult?.forecast ?? [];

    // ── Assemble final sentiment data ───────────────────────────
    sentimentData = sentimentData.copyWith(
      trendData: annotatedTrend,
      forecast: forecast,
      scoreNews: scoreNews,
      scoreYoutube: scoreYoutube,
      scoreInstagram: scoreInstagram,
    );

    // ── Assemble the Celebrity model ────────────────────────────
    final now = DateTime.now();
    final celebrity = Celebrity(
      slug: slug,
      name: name,
      biography: biography,
      sentimentData: sentimentData,
      mediaItems: allMediaItems,
      fetchedAt: now,
    );

    // ── Write to Firestore cache ────────────────────────────────
    await _writeToFirestore(celebrity);

    // ── Update rate-limit tracker ───────────────────────────────
    _rateLimitCache[slug] = now;

    return Success(celebrity);
  }

  /// Reads cached celebrity data from Firestore, including
  /// sub-collections for media items and sentiment snapshots.
  Future<Celebrity?> _readFromFirestore(String slug) async {
    final docRef = firestore
        .collection(AppConstants.celebritiesCollection)
        .doc(slug);

    final docSnap = await docRef.get();
    if (!docSnap.exists || docSnap.data() == null) return null;

    // Fetch media items sub-collection
    final mediaSnap =
        await docRef
            .collection(AppConstants.mediaItemsSubcollection)
            .orderBy('publishedAt', descending: true)
            .get();

    final mediaItems =
        mediaSnap.docs
            .map((doc) => MediaItem.fromFirestore(doc.id, doc.data()))
            .toList();

    // Fetch sentiment snapshots sub-collection
    final sentimentSnap =
        await docRef
            .collection(AppConstants.sentimentSnapshotsSubcollection)
            .orderBy('date')
            .get();

    final snapshots =
        sentimentSnap.docs
            .map((doc) => SentimentSnapshot.fromFirestore(doc.data()))
            .toList();

    return Celebrity.fromFirestore(
      slug,
      docSnap.data()!,
      mediaItems: mediaItems,
      sentimentSnapshots: snapshots,
    );
  }

  /// Writes the celebrity data to Firestore, including sub-collections.
  ///
  /// Uses a batch write for atomicity — either all documents are
  /// written or none are.
  Future<void> _writeToFirestore(Celebrity celebrity) async {
    final docRef = firestore
        .collection(AppConstants.celebritiesCollection)
        .doc(celebrity.slug);

    final batch = firestore.batch();

    // Write main celebrity document
    batch.set(docRef, celebrity.toFirestore());

    // Write media items sub-collection
    for (final item in celebrity.mediaItems) {
      final itemRef = docRef
          .collection(AppConstants.mediaItemsSubcollection)
          .doc(item.id);
      batch.set(itemRef, item.toFirestore());
    }

    // Write sentiment snapshots sub-collection
    for (final snapshot in celebrity.sentimentData.trendData) {
      final snapRef = docRef
          .collection(AppConstants.sentimentSnapshotsSubcollection)
          .doc(snapshot.date);
      batch.set(snapRef, snapshot.toFirestore());
    }

    await batch.commit();
  }

  /// Forces a fresh fetch, ignoring all cache layers.
  ///
  /// Useful for pull-to-refresh on the dashboard.
  Future<Result<Celebrity>> forceRefresh(String name) async {
    final slug = toSlug(name);
    return _fetchAndCache(name, slug);
  }
}
