/// What this device wants to be interrupted for.
///
/// These preferences are enforced on the *server*, before a message is
/// sent — see `functions/lib/push.js`. That is the whole reason the app
/// addresses devices individually instead of using an FCM topic per
/// figure: a topic subscriber is anonymous, so the backend could not know
/// whether it was the middle of the night for them, and quiet hours would
/// only ever suppress the notification after the phone had already made a
/// noise.
///
/// This class therefore has two jobs. It is the local source of truth for
/// the settings screen, and it produces the exact field shape the server
/// reads. The quiet-hours predicate is duplicated here so the UI can say
/// "quiet until 07:00" without a round trip — and
/// `alert_preferences_test.dart` pins it against the same cases as the
/// Node test, because two implementations of one rule that disagree are
/// worse than one implementation that is merely wrong.
library;

import 'package:equatable/equatable.dart';

class AlertPreferences extends Equatable {
  const AlertPreferences({
    this.enabled = true,
    this.mutedSlugs = const <String>{},
    this.quietEnabled = false,
    this.quietStartMin = defaultQuietStart,
    this.quietEndMin = defaultQuietEnd,
  });

  static const int minutesPerDay = 1440;
  static const int defaultQuietStart = 22 * 60;
  static const int defaultQuietEnd = 7 * 60;

  /// Master switch. Off means the device registers an empty slug list, so
  /// the server stops selecting it at all rather than sending messages
  /// the client then discards.
  final bool enabled;

  /// Figures the user follows but does not want alerts about. Kept as
  /// mutes rather than an opt-in list so that starring a new figure opts
  /// into alerts by default, which is what starring means.
  final Set<String> mutedSlugs;

  final bool quietEnabled;

  /// Minutes since local midnight. Stored as plain integers so the
  /// comparison is unambiguous on both sides of the wire and needs no
  /// date library.
  final int quietStartMin;
  final int quietEndMin;

  bool isMuted(String slug) => mutedSlugs.contains(slug);

  /// The figures the server should alert this device about.
  ///
  /// Sorted so that an unchanged set always serialises identically —
  /// otherwise reordering the watchlist would rewrite the device document
  /// on every launch for no reason.
  List<String> slugsForAlerts(Iterable<String> watched) {
    if (!enabled) return const <String>[];

    final out =
        watched
            .where((s) => s.isNotEmpty && !mutedSlugs.contains(s))
            .toSet()
            .toList()
          ..sort();
    return out;
  }

  /// Whether [local] falls inside the do-not-disturb window.
  ///
  /// Half-open: the start minute is quiet and the end minute is not, so a
  /// 22:00–07:00 window and an 07:00–22:00 window tile the day exactly
  /// once instead of overlapping at the seam.
  bool isQuietAt(DateTime local) {
    if (!quietEnabled) return false;

    final start = _asMinute(quietStartMin);
    final end = _asMinute(quietEndMin);
    if (start == null || end == null) return false;

    // A zero-length window is off, not permanently silent — otherwise
    // dragging both ends of the picker together would mute the app
    // forever with no obvious way back.
    if (start == end) return false;

    final now = local.hour * 60 + local.minute;

    return start < end
        ? now >= start && now < end
        // Wraps past midnight, the normal case for a sleep window.
        : now >= start || now < end;
  }

  /// The fields the server reads. This is the contract with
  /// `selectRecipients` in `functions/lib/push.js`.
  Map<String, dynamic> toDeviceFields({
    required List<String> slugs,
    required int utcOffsetMinutes,
  }) => {
    'slugs': slugs,
    'quietEnabled': quietEnabled,
    'quietStartMin': quietStartMin,
    'quietEndMin': quietEndMin,
    'utcOffsetMinutes': utcOffsetMinutes,
  };

  AlertPreferences copyWith({
    bool? enabled,
    Set<String>? mutedSlugs,
    bool? quietEnabled,
    int? quietStartMin,
    int? quietEndMin,
  }) => AlertPreferences(
    enabled: enabled ?? this.enabled,
    mutedSlugs: mutedSlugs ?? this.mutedSlugs,
    quietEnabled: quietEnabled ?? this.quietEnabled,
    quietStartMin: quietStartMin ?? this.quietStartMin,
    quietEndMin: quietEndMin ?? this.quietEndMin,
  );

  AlertPreferences toggleMute(String slug) {
    final next = Set<String>.from(mutedSlugs);
    if (!next.remove(slug)) next.add(slug);
    return copyWith(mutedSlugs: next);
  }

  Map<String, dynamic> toMap() => {
    'enabled': enabled,
    'mutedSlugs': mutedSlugs.toList(),
    'quietEnabled': quietEnabled,
    'quietStartMin': quietStartMin,
    'quietEndMin': quietEndMin,
  };

  /// Falls back to defaults field by field, so a partially corrupted
  /// record degrades to "alerts on, no quiet hours" rather than throwing
  /// on a screen the user opened to fix their settings.
  factory AlertPreferences.fromMap(Map<dynamic, dynamic> map) {
    return AlertPreferences(
      // `as bool?` throws on a String rather than yielding null, which
      // would defeat the whole point of this constructor. Test-driven:
      // the corrupt-record case failed until these became `is` checks.
      enabled: map['enabled'] is bool ? map['enabled'] as bool : true,
      mutedSlugs: {
        for (final s
            in (map['mutedSlugs'] is List
                ? map['mutedSlugs'] as List<dynamic>
                : const <dynamic>[]))
          if (s is String && s.isNotEmpty) s,
      },
      quietEnabled:
          map['quietEnabled'] is bool ? map['quietEnabled'] as bool : false,
      quietStartMin: _asMinute(map['quietStartMin']) ?? defaultQuietStart,
      quietEndMin: _asMinute(map['quietEndMin']) ?? defaultQuietEnd,
    );
  }

  @override
  List<Object?> get props => [
    enabled,
    // Set equality is not structural in Equatable's list comparison, so
    // compare a deterministic ordering instead.
    (mutedSlugs.toList()..sort()).join(','),
    quietEnabled,
    quietStartMin,
    quietEndMin,
  ];
}

/// Coerces a stored minute-of-day, rejecting anything out of range.
int? _asMinute(Object? v) {
  final n = v is int ? v : (v is num ? v.toInt() : null);
  if (n == null) return null;
  return n >= 0 && n < AlertPreferences.minutesPerDay ? n : null;
}
