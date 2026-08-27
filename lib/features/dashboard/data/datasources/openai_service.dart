/// Groq LLM service — biography, sentiment, and source-level analysis.
///
/// All calls go through [_callGroq], which:
/// 1. Tries `GroqConfig.primaryModel`.
/// 2. On HTTP 404 (model deprecated) → retries with `GroqConfig.fallbackModel`.
/// 3. On 401/429/5xx → returns the appropriate typed failure immediately.
///
/// The model that actually served a successful response is logged via
/// `debugPrint` so deprecations show up in the console.
library;

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../../../core/constants/api_keys.dart';
import '../../../../core/constants/groq_config.dart';
import '../../../../core/domain/models/celebrity.dart';
import '../../../../core/domain/models/sentiment_data.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/error/result.dart';

class OpenAiService {
  OpenAiService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${ApiKeys.groqApiKey}',
  };

  // ── Core Groq call with fallback chain ─────────────────────────────

  /// Sends a chat completion request to Groq with automatic model fallback.
  ///
  /// If the primary model returns 404, retries once with the fallback model.
  /// Returns the raw [http.Response] on success, or a typed [Result] error.
  Future<http.Response> _callGroq({
    required String prompt,
    double temperature = 0.4,
    bool jsonMode = true,
  }) async {
    // Try primary model first
    var response = await _postCompletion(
      model: GroqConfig.primaryModel,
      prompt: prompt,
      temperature: temperature,
      jsonMode: jsonMode,
    );

    if (response.statusCode == 404) {
      debugPrint(
        '⚠️ Groq primary model "${GroqConfig.primaryModel}" returned 404 '
        '(deprecated). Falling back to "${GroqConfig.fallbackModel}".',
      );

      response = await _postCompletion(
        model: GroqConfig.fallbackModel,
        prompt: prompt,
        temperature: temperature,
        jsonMode: jsonMode,
      );

      if (response.statusCode == 200) {
        debugPrint('✓ Fallback model "${GroqConfig.fallbackModel}" succeeded.');
      }
    } else if (response.statusCode == 200) {
      debugPrint('✓ Primary model "${GroqConfig.primaryModel}" succeeded.');
    }

    return response;
  }

  /// Low-level POST to the Groq chat completions endpoint.
  Future<http.Response> _postCompletion({
    required String model,
    required String prompt,
    required double temperature,
    required bool jsonMode,
  }) async {
    final body = jsonEncode({
      'model': model,
      'messages': [
        {'role': 'user', 'content': prompt},
      ],
      'temperature': temperature,
      if (jsonMode) 'response_format': {'type': 'json_object'},
    });

    return _client.post(
      Uri.parse(GroqConfig.baseUrl),
      headers: _headers,
      body: body,
    );
  }

  // ── Biography ──────────────────────────────────────────────────────

  Future<Result<Biography>> fetchBiography(String celebrityName) async {
    try {
      final prompt =
          '''You are a celebrity biography expert. Return ONLY valid JSON with this exact structure:
{
  "profession": "string — their primary profession/title",
  "summary": "string — 2-3 sentence overview of who they are",
  "background": "string — 2-3 paragraphs covering early life, career trajectory, and current status",
  "notableWorks": ["string array — 5-8 most notable achievements, albums, films, companies, etc."],
  "controversies": ["string array — 0-5 notable controversies or issues, empty array if none"]
}
Do not include any text outside the JSON object. Do not wrap in markdown code blocks.

Generate a comprehensive biography for: $celebrityName''';

      final response = await _callGroq(prompt: prompt, temperature: 0.4);
      return _handleBiographyResponse(response);
    } on http.ClientException {
      return Error(const NetworkFailure());
    } catch (e, st) {
      return Error(
        ParseFailure(
          message: 'Biography generation failed: ${e.toString()}',
          stackTrace: st,
        ),
      );
    }
  }

  // ── Sentiment (with Phase 2 evidence) ──────────────────────────────

  Future<Result<SentimentData>> analyzeSentiment(
    String celebrityName,
    List<String> headlines, {
    List<String> sourceLabels = const [],
  }) async {
    if (headlines.isEmpty) {
      return Success(
        SentimentData(
          overallScore: 50.0,
          positiveRatio: 0.33,
          negativeRatio: 0.33,
          neutralRatio: 0.34,
          trendDirection: 'stable',
          explanation: 'No recent headlines available for sentiment analysis.',
          trendData: _generateDefaultTrend(),
          dominantEmotion: 'neutral',
        ),
      );
    }

    try {
      final headlineList = headlines
          .asMap()
          .entries
          .map((e) {
            final label =
                e.key < sourceLabels.length ? ' [${sourceLabels[e.key]}]' : '';
            return '${e.key + 1}. ${e.value}$label';
          })
          .join('\n');

      // Phase 2: Extended prompt with evidence field
      final prompt =
          '''You are a sentiment analysis expert specializing in celebrity media coverage.
Analyze the provided headlines and return ONLY valid JSON with no markdown or code blocks:
{
  "positiveRatio": 0.0,
  "negativeRatio": 0.0,
  "neutralRatio": 0.0,
  "overallScore": 0,
  "trendDirection": "up",
  "dominantEmotion": "string",
  "trendData": [
    {"day": "Mon", "score": 0},
    {"day": "Tue", "score": 0},
    {"day": "Wed", "score": 0},
    {"day": "Thu", "score": 0},
    {"day": "Fri", "score": 0},
    {"day": "Sat", "score": 0},
    {"day": "Sun", "score": 0}
  ],
  "explanation": "string — 2-3 paragraphs explaining the sentiment trend",
  "evidence": [
    {"fragment": "≤ 12 word excerpt that drove the score", "source": "news|youtube|instagram"},
    {"fragment": "≤ 12 word excerpt that drove the score", "source": "news|youtube|instagram"}
  ]
}
Rules: ratios must sum to 1.0. overallScore is 0-100 (0=very negative, 100=very positive).
trendDirection is one of: "up", "down", "stable".
evidence should contain 1-2 short excerpts from the headlines that most influenced the score.
Each evidence fragment must be ≤ 12 words and include the source type.

Analyze sentiment for $celebrityName based on these recent headlines:

$headlineList''';

      final response = await _callGroq(prompt: prompt, temperature: 0.3);
      return _handleSentimentResponse(response);
    } on http.ClientException {
      return Error(const NetworkFailure());
    } catch (e, st) {
      return Error(
        ParseFailure(
          message: 'Sentiment analysis failed: ${e.toString()}',
          stackTrace: st,
        ),
      );
    }
  }

  // ── Phase 5: Source-Level Sentiment ─────────────────────────────────

  /// Analyzes sentiment for a single source's texts.
  ///
  /// Returns a score 0-100 for just this source. Only called on
  /// cache miss — never re-decompose an already-cached day.
  Future<Result<double>> analyzeSourceSentiment(
    String celebrityName,
    List<String> texts,
    String sourceName,
  ) async {
    if (texts.isEmpty) {
      return Error(
        const NotFoundFailure(
          message: 'No text available for source-level analysis.',
        ),
      );
    }

    try {
      final textList = texts
          .asMap()
          .entries
          .map((e) => '${e.key + 1}. ${e.value}')
          .join('\n');

      final prompt =
          '''You are a sentiment analysis expert. Analyze the following $sourceName content about $celebrityName.
Return ONLY valid JSON: {"sentimentScore": 0}
sentimentScore is 0-100 (0=very negative, 100=very positive).
Do not include any text outside the JSON.

Content:
$textList''';

      final response = await _callGroq(prompt: prompt, temperature: 0.3);

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final content = json['choices'][0]['message']['content'] as String;
        final cleaned =
            content
                .replaceAll(RegExp(r'```json\s*'), '')
                .replaceAll(RegExp(r'```\s*'), '')
                .trim();
        final parsed = jsonDecode(cleaned) as Map<String, dynamic>;
        final score = (parsed['sentimentScore'] as num?)?.toDouble() ?? 50.0;
        return Success(score.clamp(0.0, 100.0));
      }

      return _mapHttpError<double>(response);
    } on http.ClientException {
      return Error(const NetworkFailure());
    } catch (e, st) {
      return Error(
        ParseFailure(
          message: 'Source sentiment analysis failed: ${e.toString()}',
          stackTrace: st,
        ),
      );
    }
  }

  // ── Response Handlers ──────────────────────────────────────────────

  Result<Biography> _handleBiographyResponse(http.Response response) {
    switch (response.statusCode) {
      case 200:
        try {
          final json = jsonDecode(response.body) as Map<String, dynamic>;
          final content = json['choices'][0]['message']['content'] as String;

          final cleaned =
              content
                  .replaceAll(RegExp(r'```json\s*'), '')
                  .replaceAll(RegExp(r'```\s*'), '')
                  .trim();

          final bioJson = jsonDecode(cleaned) as Map<String, dynamic>;
          return Success(Biography.fromMap(bioJson));
        } catch (e, st) {
          return Error(
            ParseFailure(
              message: 'Failed to parse biography JSON: ${e.toString()}',
              stackTrace: st,
            ),
          );
        }
      default:
        return _mapHttpError<Biography>(response);
    }
  }

  Result<SentimentData> _handleSentimentResponse(http.Response response) {
    switch (response.statusCode) {
      case 200:
        try {
          final json = jsonDecode(response.body) as Map<String, dynamic>;
          final content = json['choices'][0]['message']['content'] as String;

          final cleaned =
              content
                  .replaceAll(RegExp(r'```json\s*'), '')
                  .replaceAll(RegExp(r'```\s*'), '')
                  .trim();

          final sentimentJson = jsonDecode(cleaned) as Map<String, dynamic>;

          final trendData =
              (sentimentJson['trendData'] as List<dynamic>?)
                  ?.asMap()
                  .entries
                  .map((e) {
                    final item = e.value as Map<String, dynamic>;
                    return SentimentSnapshot(
                      date: item['day'] as String? ?? 'Day ${e.key + 1}',
                      positiveCount: 0,
                      negativeCount: 0,
                      neutralCount: 0,
                      totalMentions: 0,
                      dominantEmotion:
                          sentimentJson['dominantEmotion'] as String? ??
                          'neutral',
                      score: (item['score'] as num?)?.toDouble() ?? 50.0,
                    );
                  })
                  .toList() ??
              _generateDefaultTrend();

          // Phase 2: Parse evidence array
          final evidence =
              (sentimentJson['evidence'] as List<dynamic>?)
                  ?.map((e) {
                    final item = e as Map<String, dynamic>;
                    return SentimentEvidence(
                      fragment: item['fragment'] as String? ?? '',
                      source: item['source'] as String? ?? 'news',
                    );
                  })
                  .where((e) => e.fragment.isNotEmpty)
                  .toList() ??
              [];

          return Success(
            SentimentData(
              overallScore:
                  (sentimentJson['overallScore'] as num?)?.toDouble() ?? 50.0,
              positiveRatio:
                  (sentimentJson['positiveRatio'] as num?)?.toDouble() ?? 0.33,
              negativeRatio:
                  (sentimentJson['negativeRatio'] as num?)?.toDouble() ?? 0.33,
              neutralRatio:
                  (sentimentJson['neutralRatio'] as num?)?.toDouble() ?? 0.34,
              trendDirection:
                  sentimentJson['trendDirection'] as String? ?? 'stable',
              explanation: sentimentJson['explanation'] as String? ?? '',
              trendData: trendData,
              dominantEmotion:
                  sentimentJson['dominantEmotion'] as String? ?? 'neutral',
              evidence: evidence,
            ),
          );
        } catch (e, st) {
          return Error(
            ParseFailure(
              message: 'Failed to parse sentiment JSON: ${e.toString()}',
              stackTrace: st,
            ),
          );
        }
      default:
        return _mapHttpError<SentimentData>(response);
    }
  }

  /// Maps non-200 HTTP status codes to typed failures.
  ///
  /// 404 after the fallback chain means both models are gone.
  Result<T> _mapHttpError<T>(http.Response response) {
    switch (response.statusCode) {
      case 401:
        return Error<T>(
          const ApiKeyFailure(
            serviceName: 'Groq',
            message: 'Invalid Groq API key. Check your .env file.',
          ),
        );
      case 404:
        debugPrint('Groq 404 (both models failed): ${response.body}');
        return Error<T>(const ModelNotFoundFailure());
      case 429:
        return Error<T>(const RateLimitFailure());
      default:
        debugPrint('Groq error ${response.statusCode}: ${response.body}');

        // Extract the JSON error message if possible
        String groqErrorMsg = '';
        try {
          final json = jsonDecode(response.body);
          if (json['error'] != null && json['error']['message'] != null) {
            groqErrorMsg = json['error']['message'];
          } else {
            groqErrorMsg = response.body;
          }
        } catch (_) {
          groqErrorMsg = response.body;
        }

        return Error<T>(
          ServerFailure(
            message:
                'Groq returned HTTP ${response.statusCode}\n'
                'Details: $groqErrorMsg',
          ),
        );
    }
  }

  List<SentimentSnapshot> _generateDefaultTrend() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days
        .map(
          (day) => SentimentSnapshot(
            date: day,
            positiveCount: 0,
            negativeCount: 0,
            neutralCount: 0,
            totalMentions: 0,
            dominantEmotion: 'neutral',
            score: 50.0,
          ),
        )
        .toList();
  }

  void dispose() => _client.close();
}
