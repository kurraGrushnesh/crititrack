// Unit tests for helper utility functions.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/core/theme/app_theme.dart';

void main() {
  group('toSlug', () {
    test('converts space-separated name to slug', () {
      expect(toSlug('Taylor Swift'), 'taylor-swift');
    });

    test('handles single word', () {
      expect(toSlug('BTS'), 'bts');
    });

    test('removes special characters', () {
      expect(toSlug('Beyoncé Knowles'), 'beyonc-knowles');
    });

    test('trims whitespace', () {
      expect(toSlug('  Elon Musk  '), 'elon-musk');
    });

    test('handles multiple spaces', () {
      expect(toSlug('Cristiano  Ronaldo'), 'cristiano-ronaldo');
    });
  });

  group('fromSlug', () {
    test('converts slug to title case', () {
      expect(fromSlug('taylor-swift'), 'Taylor Swift');
    });

    test('handles single word slug', () {
      expect(fromSlug('bts'), 'Bts');
    });
  });

  group('timeAgo', () {
    test('returns Just now for recent times', () {
      expect(timeAgo(DateTime.now()), 'Just now');
    });

    test('returns minutes ago', () {
      final thirtyMinAgo = DateTime.now().subtract(const Duration(minutes: 30));
      expect(timeAgo(thirtyMinAgo), '30m ago');
    });

    test('returns hours ago', () {
      final fiveHoursAgo = DateTime.now().subtract(const Duration(hours: 5));
      expect(timeAgo(fiveHoursAgo), '5h ago');
    });

    test('returns days ago', () {
      final threeDaysAgo = DateTime.now().subtract(const Duration(days: 3));
      expect(timeAgo(threeDaysAgo), '3d ago');
    });
  });

  group('sentimentColor', () {
    test('returns green for positive scores', () {
      expect(sentimentColor(75.0), AppTheme.sentimentPositive);
    });

    test('returns amber for neutral scores', () {
      expect(sentimentColor(50.0), AppTheme.sentimentNeutral);
    });

    test('returns red for negative scores', () {
      expect(sentimentColor(30.0), AppTheme.sentimentNegative);
    });

    test('returns green at exact threshold', () {
      expect(sentimentColor(65.0), AppTheme.sentimentPositive);
    });
  });

  group('sentimentLabel', () {
    test('returns Positive for high scores', () {
      expect(sentimentLabel(80.0), 'Positive');
    });

    test('returns Mixed for medium scores', () {
      expect(sentimentLabel(50.0), 'Mixed');
    });

    test('returns Negative for low scores', () {
      expect(sentimentLabel(20.0), 'Negative');
    });
  });

  group('trendIcon', () {
    test('returns trending up for "up"', () {
      expect(trendIcon('up'), Icons.trending_up_rounded);
    });

    test('returns trending down for "down"', () {
      expect(trendIcon('down'), Icons.trending_down_rounded);
    });

    test('returns flat for "stable"', () {
      expect(trendIcon('stable'), Icons.trending_flat_rounded);
    });
  });

  group('cacheTimestamp', () {
    test('returns "Updated just now" for recent', () {
      expect(cacheTimestamp(DateTime.now()), 'Updated just now');
    });

    test('returns "Updated Xm ago" for minutes', () {
      final tenMinAgo = DateTime.now().subtract(const Duration(minutes: 10));
      expect(cacheTimestamp(tenMinAgo), 'Updated 10m ago');
    });
  });
}
