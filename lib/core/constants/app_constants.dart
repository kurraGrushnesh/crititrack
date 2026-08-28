/// Application-wide constants used across all features.
///
/// Centralizes magic numbers, durations, and configuration values so
/// they can be tuned in one place without hunting through widget trees.
library;

abstract final class AppConstants {
  // ── Cache TTLs ────────────────────────────────────────────────────
  /// How long Firestore-cached celebrity data is considered fresh.
  static const Duration cacheTtl = Duration(hours: 24);

  /// Minimum interval between re-fetches of the same celebrity slug,
  /// regardless of the 24-hour TTL. Prevents API hammering.
  static const Duration rateLimitWindow = Duration(minutes: 5);

  /// How long a server-written celebrity document counts as current.
  /// Kept in step with the `schedule` option on refreshTrackedCelebrities
  /// in functions/index.js: anything older means the timer has not covered
  /// this figure, so a live fetch is warranted.
  static const Duration serverRefreshInterval = Duration(minutes: 30);

  // ── Search ────────────────────────────────────────────────────────
  /// Debounce duration for the search bar input.
  static const Duration searchDebounce = Duration(milliseconds: 400);

  /// Number of searches before prompting Google Sign-In.
  static const int searchesBeforeSignInPrompt = 3;

  // ── API Limits ────────────────────────────────────────────────────
  static const int newsPageSize = 10;
  static const int youtubeMaxResults = 5;
  static const int instagramMaxResults = 5;

  // ── Sentiment Thresholds ──────────────────────────────────────────
  /// Score ≥ this is considered positive (green).
  static const double sentimentPositiveThreshold = 65.0;

  /// Score ≥ this but < positive threshold is neutral/amber.
  static const double sentimentNeutralThreshold = 40.0;

  // ── Animation Durations ───────────────────────────────────────────
  static const Duration typewriterInterval = Duration(milliseconds: 30);
  static const Duration shimmerTransition = Duration(milliseconds: 500);

  // ── Responsive Breakpoints ────────────────────────────────────────
  static const double mobileBreakpoint = 600.0;
  static const double tabletBreakpoint = 900.0;

  // ── Anomaly Detection ──────────────────────────────────────────────
  /// Number of trailing days used for the rolling window.
  static const int anomalyWindowSize = 7;

  /// Z-score threshold above which a day is flagged as a spike.
  static const double anomalyThreshold = 1.5;

  // ── Forecasting ───────────────────────────────────────────────────
  /// Number of trailing days used as input for the linear-trend fit.
  static const int forecastWindowSize = 7;

  /// Number of days to forecast forward.
  static const int forecastHorizon = 3;

  // ── Source Decomposition ──────────────────────────────────────────
  /// Default equal weights when volume-based weighting is unavailable.
  static const double defaultSourceWeight = 1.0 / 3.0;

  // ── Firestore Collections ─────────────────────────────────────────
  static const String celebritiesCollection = 'celebrities';
  static const String mediaItemsSubcollection = 'media_items';
  static const String sentimentSnapshotsSubcollection = 'sentiment_snapshots';
  static const String searchHistoryCollection = 'search_history';
}
