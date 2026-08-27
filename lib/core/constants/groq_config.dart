/// Centralized Groq API configuration.
///
/// Single source of truth for all model IDs and endpoint URLs.
/// When Groq deprecates a model, update *only this file*.
library;

abstract final class GroqConfig {
  /// Primary model — used for all LLM calls by default.
  ///
  /// Confirmed live via `GET /v1/models` on 2026-08-26.
  static const String primaryModel = 'openai/gpt-oss-120b';

  /// Fallback model — used automatically when the primary returns
  /// HTTP 404 (model deprecated / not found).
  ///
  /// Confirmed live via `GET /v1/models` on 2026-08-26.
  static const String fallbackModel = 'qwen/qwen3.6-27b';

  /// Groq chat completions endpoint (OpenAI-compatible).
  static const String baseUrl =
      'https://api.groq.com/openai/v1/chat/completions';
}
