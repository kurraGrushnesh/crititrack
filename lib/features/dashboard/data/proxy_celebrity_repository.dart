/// Celebrity repository backed by the CritiTrack Cloud Functions proxy.
///
/// One HTTPS call to `getCelebrity` returns the fully assembled payload
/// (biography + structured controversies + sentiment + media). The app
/// holds no third-party API keys.
///
/// Client-side post-processing that does not need secrets stays here:
/// anomaly annotation (Phase 1) and the linear forecast (Phase 4).
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'package:crititrack/core/constants/api_config.dart';
import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/error/failures.dart';
import 'package:crititrack/core/error/result.dart';
import 'package:crititrack/core/security/api_credentials.dart';
import 'package:crititrack/core/utils/anomaly_detection.dart';
import 'package:crititrack/core/utils/forecasting.dart';
import 'package:crititrack/features/dashboard/data/celebrity_repository.dart';

class ProxyCelebrityRepository extends CelebrityRepository {
  ProxyCelebrityRepository({http.Client? client, ApiCredentials? credentials})
    : _client = client ?? http.Client(),
      _credentials = credentials ?? const ApiCredentials();

  final http.Client _client;

  /// Supplies the ID and App Check tokens the backend requires (SEC-02).
  final ApiCredentials _credentials;

  @override
  Future<Result<Celebrity>> getCelebrity(String name, {String? qid}) =>
      _fetch(name, qid: qid);

  @override
  Future<Result<Celebrity>> forceRefresh(String name) =>
      _fetch(name, bustCache: true);

  Future<Result<Celebrity>> _fetch(
    String name, {
    bool bustCache = false,
    String? qid,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/getCelebrity').replace(
      queryParameters: {
        'name': name,
        // Pins resolution to a specific person when the reader has
        // picked one from the disambiguation list. The server
        // validates it as a qid rather than trusting it.
        if (qid != null && qid.isNotEmpty) 'qid': qid,
        if (bustCache) 't': DateTime.now().millisecondsSinceEpoch.toString(),
      },
    );

    try {
      final headers = await _credentials.headers();
      final response = await _client
          .get(uri, headers: headers)
          .timeout(const Duration(seconds: 120));

      if (response.statusCode == 401) {
        return Error(
          ApiKeyFailure(
            serviceName: 'CritiTrack',
            message:
                'This app could not authenticate with the CritiTrack '
                'backend. ${_errorMessage(response)}',
          ),
        );
      }
      if (response.statusCode == 429 || response.statusCode == 503) {
        // 429 is this user's quota; 503 is the global daily ceiling. Both
        // mean "try later", which is what RateLimitFailure communicates.
        final retry = response.headers['retry-after'];
        return Error(
          RateLimitFailure(message: _rateLimitMessage(response, retry)),
        );
      }
      if (response.statusCode >= 500) {
        return Error(ServerFailure(message: _errorMessage(response)));
      }
      if (response.statusCode != 200) {
        return Error(
          ServerFailure(
            message:
                'Backend returned HTTP ${response.statusCode}. '
                '${_errorMessage(response)}',
          ),
        );
      }

      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return Success(_parseCelebrity(json));
    } on http.ClientException {
      // The device may be online while the backend is simply unreachable —
      // during development that is almost always a stopped emulator, and
      // "check your internet connection" would send the user hunting in
      // the wrong place.
      return Error(
        NetworkFailure(
          message:
              ApiConfig.isLocal
                  ? 'Could not reach the local backend at '
                      '${ApiConfig.baseUrl}. Start it with: '
                      'firebase emulators:start --only functions'
                  : 'Could not reach the CritiTrack backend. Check your '
                      'internet connection and try again.',
        ),
      );
    } on FormatException catch (e, st) {
      return Error(
        ParseFailure(
          message: 'Malformed response from backend: ${e.message}',
          stackTrace: st,
        ),
      );
    } catch (e, st) {
      return Error(
        ServerFailure(message: 'Request failed: $e', stackTrace: st),
      );
    }
  }

  Celebrity _parseCelebrity(Map<String, dynamic> json) {
    final biography = Biography.fromMap(
      (json['biography'] as Map?)?.cast<String, dynamic>() ?? const {},
    );

    final media =
        ((json['media'] as List?) ?? const []).whereType<Map>().map((m) {
          final data = m.cast<String, dynamic>();
          return MediaItem.fromFirestore(
            data['id']?.toString() ?? UniqueKey().toString(),
            data,
          );
        }).toList();

    final sentiment = _parseSentiment(
      (json['sentiment'] as Map?)?.cast<String, dynamic>() ?? const {},
    );

    final image = (json['image'] as Map?)?.cast<String, dynamic>();
    final entity = (json['entity'] as Map?)?.cast<String, dynamic>();

    return Celebrity(
      slug: json['slug'] as String? ?? '',
      name: json['name'] as String? ?? '',
      biography: biography,
      sentimentData: sentiment,
      mediaItems: media,
      fetchedAt:
          DateTime.tryParse(json['fetchedAt'] as String? ?? '') ??
          DateTime.now(),
      imageUrl: image?['url'] as String?,
      wikidataId: entity?['qid'] as String?,
      facts: PersonFacts.fromMap(
        (entity?['facts'] as Map?)?.cast<String, dynamic>(),
      ),
      candidates: [
        for (final c in (entity?['candidates'] as List?) ?? const [])
          if (c is Map)
            if (EntityCandidate.fromMap(c) case final e?) e,
      ],
      verified: json['verified'] as bool? ?? false,
    );
  }

  SentimentData _parseSentiment(Map<String, dynamic> s) {
    final dominantEmotion = s['dominantEmotion'] as String? ?? 'neutral';

    final rawTrend = (s['trendData'] as List?) ?? const [];
    final snapshots =
        rawTrend.whereType<Map>().map((e) {
          final d = e.cast<String, dynamic>();
          // Snapshots now come from the sentiment_snapshots collection
          // rather than the model's generated series, so they carry the
          // counts that were actually measured on the day.
          return SentimentSnapshot(
            date: d['date'] as String? ?? d['day'] as String? ?? '',
            positiveCount: (d['positiveCount'] as num?)?.toInt() ?? 0,
            negativeCount: (d['negativeCount'] as num?)?.toInt() ?? 0,
            neutralCount: (d['neutralCount'] as num?)?.toInt() ?? 0,
            totalMentions: (d['totalMentions'] as num?)?.toInt() ?? 0,
            dominantEmotion:
                d['dominantEmotion'] as String? ?? dominantEmotion,
            score: (d['score'] as num?)?.toDouble() ?? 50.0,
          );
        }).toList();

    final evidence =
        ((s['evidence'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) {
              final d = e.cast<String, dynamic>();
              return SentimentEvidence(
                fragment: d['fragment'] as String? ?? '',
                source: d['source'] as String? ?? 'news',
                mediaId: d['mediaId'] as String?,
              );
            })
            .where((e) => e.fragment.isNotEmpty)
            .toList();

    // Client-side enrichment (no secrets needed).
    final annotated = annotateSnapshots(snapshots);
    final forecast =
        linearForecast(annotated.map((x) => x.score).toList())?.forecast ??
        const [];

    return SentimentData(
      overallScore: (s['overallScore'] as num?)?.toDouble() ?? 50.0,
      positiveRatio: (s['positiveRatio'] as num?)?.toDouble() ?? 0.33,
      negativeRatio: (s['negativeRatio'] as num?)?.toDouble() ?? 0.33,
      neutralRatio: (s['neutralRatio'] as num?)?.toDouble() ?? 0.34,
      trendDirection: s['trendDirection'] as String? ?? 'stable',
      explanation: s['explanation'] as String? ?? '',
      dominantEmotion: dominantEmotion,
      trendData: annotated,
      evidence: evidence,
      forecast: forecast,
      scoreNews: (s['scoreNews'] as num?)?.toDouble(),
      scoreYoutube: (s['scoreYoutube'] as num?)?.toDouble(),
      scoreInstagram: (s['scoreInstagram'] as num?)?.toDouble(),
      confidence: (s['confidence'] as num?)?.toDouble(),
      confidenceLabel: s['confidenceLabel'] as String?,
      scoreLow: (s['scoreLow'] as num?)?.toDouble(),
      scoreHigh: (s['scoreHigh'] as num?)?.toDouble(),
      sampleSize: (s['sampleSize'] as num?)?.toInt(),
    );
  }

  /// Turns a quota rejection into something a person can act on.
  String _rateLimitMessage(http.Response response, String? retryAfter) {
    final base = _errorMessage(response);
    final seconds = int.tryParse(retryAfter ?? '');
    if (seconds == null) {
      return base.isEmpty ? 'Too many requests. Please try again later.' : base;
    }
    final minutes = (seconds / 60).ceil();
    final wait =
        minutes < 60
            ? '$minutes ${minutes == 1 ? "minute" : "minutes"}'
            : '${(minutes / 60).ceil()} hours';
    return '${base.isEmpty ? "Too many requests." : base} Try again in $wait.';
  }

  String _errorMessage(http.Response response) {
    try {
      final j = jsonDecode(response.body) as Map<String, dynamic>;
      return j['message'] as String? ?? j['error'] as String? ?? '';
    } catch (_) {
      return '';
    }
  }

  void dispose() => _client.close();
}
