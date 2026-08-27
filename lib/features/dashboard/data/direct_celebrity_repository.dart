library;

import 'package:flutter/foundation.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/error/failures.dart';
import 'package:crititrack/core/error/result.dart';
import 'package:crititrack/core/utils/anomaly_detection.dart';
import 'package:crititrack/core/utils/forecasting.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/dashboard/data/celebrity_repository.dart';
import 'package:crititrack/features/dashboard/data/datasources/openai_service.dart';
import 'package:crititrack/features/media_feed/data/datasources/news_api_service.dart';
import 'package:crititrack/features/media_feed/data/datasources/youtube_api_service.dart';
import 'package:crititrack/features/media_feed/data/datasources/instagram_api_service.dart';

/// Fetches celebrity data directly from APIs without any caching layer.
class DirectCelebrityRepository extends CelebrityRepository {
  DirectCelebrityRepository()
    : _groq = OpenAiService(),
      _news = NewsApiService(),
      _youtube = YouTubeApiService(),
      _instagram = InstagramApiService();

  final OpenAiService _groq;
  final NewsApiService _news;
  final YouTubeApiService _youtube;
  final InstagramApiService _instagram;

  @override
  Future<Result<Celebrity>> getCelebrity(String name) async {
    return _fetchFromApis(name);
  }

  @override
  Future<Result<Celebrity>> forceRefresh(String name) async {
    return _fetchFromApis(name);
  }

  Future<Result<Celebrity>> _fetchFromApis(String name) async {
    final slug = toSlug(name);

    try {
      final List<Result<dynamic>> results = await Future.wait<Result<dynamic>>([
        _groq
            .fetchBiography(name)
            .catchError(
              (e) => Error<Biography>(ServerFailure(message: 'Groq: $e')),
            ),
        _news
            .fetchNews(name)
            .catchError(
              (e) => Error<List<MediaItem>>(ServerFailure(message: 'News: $e')),
            ),
        _youtube
            .fetchVideos(name)
            .catchError(
              (e) =>
                  Error<List<MediaItem>>(ServerFailure(message: 'YouTube: $e')),
            ),
        _instagram
            .fetchPosts(name)
            .catchError(
              (e) => Error<List<MediaItem>>(
                ServerFailure(message: 'Instagram: $e'),
              ),
            ),
      ]);

      final bioResult = results[0] as Result<Biography>;
      final newsResult = results[1] as Result<List<MediaItem>>;
      final ytResult = results[2] as Result<List<MediaItem>>;
      final igResult = results[3] as Result<List<MediaItem>>;

      debugPrint('=== API Results for "$name" ===');
      debugPrint('Groq biography: ${bioResult.isSuccess ? "✓" : "✗"}');
      debugPrint('NewsAPI: ${newsResult.isSuccess ? "✓" : "✗"}');
      debugPrint('YouTube: ${ytResult.isSuccess ? "✓" : "✗"}');
      debugPrint('Instagram: ${igResult.isSuccess ? "✓" : "✗"}');

      final newsItems = newsResult.getOrElse(() => []);
      final ytItems = ytResult.getOrElse(() => []);
      final igItems = igResult.getOrElse(() => []);
      final allMedia = [...newsItems, ...ytItems, ...igItems];

      final biography = bioResult.getOrElse(
        () => Biography(
          profession: 'Public Figure',
          summary:
              '$name — biography generation is temporarily unavailable. '
              'The app is showing live news and media data below.',
          background: _buildBioUnavailableMessage(bioResult),
          notableWorks: const [],
          controversies: const [],
        ),
      );

      if (bioResult.isError && allMedia.isEmpty) {
        final failure = (bioResult as Error<Biography>).failure;
        return Error(failure);
      }

      // ── Collect texts by source for sentiment ───────────────────
      final newsHeadlines =
          newsItems
              .map((item) => item.title)
              .where((t) => t.isNotEmpty)
              .toList();
      final ytTitles =
          ytItems.map((item) => item.title).where((t) => t.isNotEmpty).toList();
      final igCaptions =
          igItems.map((item) => item.title).where((t) => t.isNotEmpty).toList();

      // Build combined headlines with source labels for the main call
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

      // ── Main sentiment analysis (with evidence — Phase 2) ──────
      SentimentData sentimentData;
      if (allHeadlines.isNotEmpty) {
        final sentimentResult = await _groq
            .analyzeSentiment(name, allHeadlines, sourceLabels: sourceLabels)
            .catchError(
              (e) =>
                  Error<SentimentData>(ServerFailure(message: 'Sentiment: $e')),
            );
        sentimentData = sentimentResult.getOrElse(() => _defaultSentiment());
      } else {
        sentimentData = _defaultSentiment();
      }

      // ── Phase 5: Source-level decomposition ─────────────────────
      // Only runs if we have texts. Up to 3 additional LLM calls.
      double? scoreNews;
      double? scoreYoutube;
      double? scoreInstagram;

      if (newsHeadlines.isNotEmpty ||
          ytTitles.isNotEmpty ||
          igCaptions.isNotEmpty) {
        final sourceResults = await Future.wait([
          if (newsHeadlines.isNotEmpty)
            _groq
                .analyzeSourceSentiment(name, newsHeadlines, 'news')
                .catchError(
                  (e) => Error<double>(ServerFailure(message: 'News: $e')),
                )
          else
            Future.value(
              const Error<double>(NotFoundFailure(message: 'No news texts')),
            ),
          if (ytTitles.isNotEmpty)
            _groq
                .analyzeSourceSentiment(name, ytTitles, 'YouTube')
                .catchError(
                  (e) => Error<double>(ServerFailure(message: 'YT: $e')),
                )
          else
            Future.value(
              const Error<double>(NotFoundFailure(message: 'No YouTube texts')),
            ),
          if (igCaptions.isNotEmpty)
            _groq
                .analyzeSourceSentiment(name, igCaptions, 'Instagram')
                .catchError(
                  (e) => Error<double>(ServerFailure(message: 'IG: $e')),
                )
          else
            Future.value(
              const Error<double>(
                NotFoundFailure(message: 'No Instagram texts'),
              ),
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

      // ── Phase 1: Annotate snapshots with anomaly detection ─────
      final annotatedTrend = annotateSnapshots(sentimentData.trendData);

      // ── Phase 4: Compute forecast ──────────────────────────────
      final scores = annotatedTrend.map((s) => s.score).toList();
      final forecastResult = linearForecast(scores);
      final forecast = forecastResult?.forecast ?? [];

      // ── Assemble final sentiment data ──────────────────────────
      sentimentData = sentimentData.copyWith(
        trendData: annotatedTrend,
        forecast: forecast,
        scoreNews: scoreNews,
        scoreYoutube: scoreYoutube,
        scoreInstagram: scoreInstagram,
      );

      return Success(
        Celebrity(
          slug: slug,
          name: name,
          biography: biography,
          sentimentData: sentimentData,
          mediaItems: allMedia,
          fetchedAt: DateTime.now(),
        ),
      );
    } catch (e) {
      return Error(ServerFailure(message: 'API request failed: $e'));
    }
  }

  String _buildBioUnavailableMessage(Result<Biography> result) {
    if (result.isError) {
      final failure = (result as Error<Biography>).failure;
      return switch (failure) {
        ApiKeyFailure() =>
          'Groq API key is invalid or expired. Update it in '
              'lib/core/constants/api_keys.dart to enable AI biography '
              'generation and sentiment analysis.',
        RateLimitFailure() =>
          'Groq rate limit reached. Wait a moment and try again.',
        NetworkFailure() =>
          'Could not reach Groq servers. Check your internet connection.',
        _ => 'Biography generation failed: ${failure.message}',
      };
    }
    return '';
  }

  SentimentData _defaultSentiment() => SentimentData(
    overallScore: 50.0,
    positiveRatio: 0.33,
    negativeRatio: 0.33,
    neutralRatio: 0.34,
    trendDirection: 'stable',
    explanation:
        'Sentiment analysis is temporarily unavailable. '
        'This could be due to an invalid or expired Groq API key. '
        'Update your key in lib/core/constants/api_keys.dart.',
    trendData: const [],
    dominantEmotion: 'neutral',
  );
}
