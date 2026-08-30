// Alert preferences, and the rule the client shares with the server.
//
// The quiet-hours predicate exists twice: here, so the settings screen
// can say "quiet until 07:00" without a round trip, and in
// functions/lib/push.js, where it actually decides whether a message is
// sent. Two implementations of one rule that disagree are worse than one
// implementation that is merely wrong, so the cases below deliberately
// mirror those in functions/test/push.test.js. If you change one, change
// both.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/features/alerts/domain/alert_preferences.dart';

/// A local wall-clock time on a fixed date.
DateTime at(int hour, [int minute = 0]) => DateTime(2026, 1, 15, hour, minute);

const quiet = AlertPreferences(
  quietEnabled: true,
  quietStartMin: 22 * 60,
  quietEndMin: 7 * 60,
);

void main() {
  group('quiet hours', () {
    test('is quiet inside a window that wraps past midnight', () {
      expect(quiet.isQuietAt(at(23)), isTrue);
      expect(quiet.isQuietAt(at(1)), isTrue);
    });

    test('is not quiet outside that window', () {
      expect(quiet.isQuietAt(at(18)), isFalse);
      expect(quiet.isQuietAt(at(12)), isFalse);
    });

    test('includes the start minute and excludes the end minute', () {
      expect(quiet.isQuietAt(at(22, 0)), isTrue);
      expect(quiet.isQuietAt(at(7, 0)), isFalse);
      expect(quiet.isQuietAt(at(6, 59)), isTrue);
    });

    test('handles a same-day window that does not wrap', () {
      const day = AlertPreferences(
        quietEnabled: true,
        quietStartMin: 9 * 60,
        quietEndMin: 17 * 60,
      );
      expect(day.isQuietAt(at(12)), isTrue);
      expect(day.isQuietAt(at(8)), isFalse);
      expect(day.isQuietAt(at(18)), isFalse);
    });

    test('treats a zero-length window as off, not permanently silent', () {
      const zero = AlertPreferences(
        quietEnabled: true,
        quietStartMin: 60,
        quietEndMin: 60,
      );
      expect(zero.isQuietAt(at(1)), isFalse);
      expect(zero.isQuietAt(at(13)), isFalse);
    });

    test('respects the enabled flag', () {
      expect(quiet.copyWith(quietEnabled: false).isQuietAt(at(23)), isFalse);
    });
  });

  group('slugsForAlerts', () {
    test('is the watchlist minus anything muted', () {
      const prefs = AlertPreferences(mutedSlugs: {'b'});
      expect(prefs.slugsForAlerts(['a', 'b', 'c']), ['a', 'c']);
    });

    test('is empty when alerts are switched off entirely', () {
      // The device registers nothing, so the server stops selecting it —
      // rather than sending messages the client would discard.
      const prefs = AlertPreferences(enabled: false);
      expect(prefs.slugsForAlerts(['a', 'b']), isEmpty);
    });

    test('is sorted and deduplicated so an unchanged set is stable', () {
      // Reordering the watchlist must not rewrite the device document.
      const prefs = AlertPreferences();
      expect(prefs.slugsForAlerts(['c', 'a', 'b']), ['a', 'b', 'c']);
      expect(prefs.slugsForAlerts(['b', 'c', 'a']), ['a', 'b', 'c']);
      expect(prefs.slugsForAlerts(['a', 'a']), ['a']);
    });

    test('drops empty slugs', () {
      const prefs = AlertPreferences();
      expect(prefs.slugsForAlerts(['', 'a']), ['a']);
    });
  });

  group('mutes', () {
    test('toggles on and back off', () {
      const prefs = AlertPreferences();
      final muted = prefs.toggleMute('x');
      expect(muted.isMuted('x'), isTrue);
      expect(muted.toggleMute('x').isMuted('x'), isFalse);
    });

    test('does not mutate the original', () {
      const prefs = AlertPreferences();
      prefs.toggleMute('x');
      expect(prefs.isMuted('x'), isFalse);
    });
  });

  group('device fields', () {
    test('match the contract selectRecipients reads', () {
      const prefs = AlertPreferences(
        quietEnabled: true,
        quietStartMin: 1320,
        quietEndMin: 420,
      );
      final fields = prefs.toDeviceFields(
        slugs: const ['a'],
        utcOffsetMinutes: 330,
      );

      expect(fields, {
        'slugs': ['a'],
        'quietEnabled': true,
        'quietStartMin': 1320,
        'quietEndMin': 420,
        'utcOffsetMinutes': 330,
      });
    });
  });

  group('persistence', () {
    test('round-trips', () {
      const prefs = AlertPreferences(
        enabled: false,
        mutedSlugs: {'a', 'b'},
        quietEnabled: true,
        quietStartMin: 100,
        quietEndMin: 200,
      );
      expect(AlertPreferences.fromMap(prefs.toMap()), prefs);
    });

    test('degrades to safe defaults on a corrupt record', () {
      // Opened precisely when the user is trying to fix their settings,
      // so it must not throw.
      final p = AlertPreferences.fromMap({
        'enabled': 'yes',
        'mutedSlugs': [1, null, 'ok'],
        'quietStartMin': 99999,
        'quietEndMin': null,
      });

      expect(p.enabled, isTrue);
      expect(p.mutedSlugs, {'ok'});
      expect(p.quietStartMin, AlertPreferences.defaultQuietStart);
      expect(p.quietEndMin, AlertPreferences.defaultQuietEnd);
    });

    test('an empty record is the default', () {
      expect(AlertPreferences.fromMap(const {}), const AlertPreferences());
    });
  });
}
