/// Shared utility helpers used across all features.
///
/// Contains date formatting, slug generation, and sentiment
/// color mapping — logic that belongs to no single feature.
library;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../constants/app_constants.dart';
import '../theme/app_theme.dart';

/// Converts a celebrity display name into a Firestore-safe slug.
///
/// "Taylor Swift" → "taylor-swift"
/// "BTS"          → "bts"
String toSlug(String name) {
  return name
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9\s-]'), '')
      .replaceAll(RegExp(r'\s+'), '-');
}

/// Converts a slug back to a display-friendly title.
///
/// "taylor-swift" → "Taylor Swift"
String fromSlug(String slug) {
  return slug
      .split('-')
      .map(
        (word) =>
            word.isEmpty ? '' : '${word[0].toUpperCase()}${word.substring(1)}',
      )
      .join(' ');
}

/// Returns a human-readable "time ago" string relative to [dateTime].
///
/// Examples: "Just now", "5m ago", "2h ago", "3d ago", "Jan 15"
String timeAgo(DateTime dateTime) {
  final now = DateTime.now();
  final diff = now.difference(dateTime);

  if (diff.inSeconds < 60) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';

  return DateFormat('MMM d').format(dateTime);
}

/// Formats a [DateTime] as "Updated 5 minutes ago" for cache display.
String cacheTimestamp(DateTime fetchedAt) {
  final diff = DateTime.now().difference(fetchedAt);

  if (diff.inMinutes < 1) return 'Updated just now';
  if (diff.inMinutes < 60) return 'Updated ${diff.inMinutes}m ago';
  if (diff.inHours < 24) return 'Updated ${diff.inHours}h ago';

  return 'Updated ${DateFormat('MMM d, h:mm a').format(fetchedAt)}';
}

/// The sentiment colour to use when the score is drawn as **text or an
/// icon** rather than as a fill.
///
/// [sentimentColor] returns the fill hue, which only has to clear the
/// 3:1 threshold for graphical objects. Text needs 4.5:1, and the score
/// chip makes that harder by tinting its own background with the same
/// hue — in light mode the fill hues landed at 2.29, 1.68 and 3.03 on
/// that composite. This reads the theme-tuned variants instead, so the
/// number stays legible in both skins.
Color sentimentTextColor(BuildContext context, double score) {
  final palette = context.palette;
  if (score >= AppConstants.sentimentPositiveThreshold) {
    return palette.sentimentPositiveText;
  } else if (score >= AppConstants.sentimentNeutralThreshold) {
    return palette.sentimentNeutralText;
  } else {
    return palette.sentimentNegativeText;
  }
}

/// Returns the appropriate sentiment color based on a 0–100 score.
///
/// This is the **fill** hue — dots, bars, chart series, tinted chip
/// backgrounds. For text or icons use [sentimentTextColor].
Color sentimentColor(double score) {
  if (score >= AppConstants.sentimentPositiveThreshold) {
    return AppTheme.sentimentPositive;
  } else if (score >= AppConstants.sentimentNeutralThreshold) {
    return AppTheme.sentimentNeutral;
  } else {
    return AppTheme.sentimentNegative;
  }
}

/// Returns the sentiment label for a 0–100 score.
String sentimentLabel(double score) {
  if (score >= AppConstants.sentimentPositiveThreshold) return 'Positive';
  if (score >= AppConstants.sentimentNeutralThreshold) return 'Mixed';
  return 'Negative';
}

/// Returns a trend arrow icon based on the direction string.
IconData trendIcon(String direction) {
  return switch (direction.toLowerCase()) {
    'up' => Icons.trending_up_rounded,
    'down' => Icons.trending_down_rounded,
    _ => Icons.trending_flat_rounded,
  };
}

/// Returns a trend color based on the direction string.
Color trendColor(String direction) {
  return switch (direction.toLowerCase()) {
    'up' => AppTheme.sentimentPositive,
    'down' => AppTheme.sentimentNegative,
    _ => AppTheme.sentimentNeutral,
  };
}
