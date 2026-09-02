/// Theme-mode preference: **System**, **Light** or **Dark**.
///
/// The choice is persisted in the Hive `settings` box so it survives
/// restarts. When the box is unavailable (e.g. a widget test that never
/// initialised Hive) the controller degrades to an in-memory value
/// defaulting to [ThemeMode.system] — the app then follows the OS.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

/// Name of the Hive box opened in `main()` for user preferences.
const String settingsBoxName = 'settings';

const String _themeModeKey = 'theme_mode';

/// The user's theme preference, watched by the root [MaterialApp].
final themeModeProvider = NotifierProvider<ThemeModeController, ThemeMode>(
  ThemeModeController.new,
);

class ThemeModeController extends Notifier<ThemeMode> {
  Box<dynamic>? get _box =>
      Hive.isBoxOpen(settingsBoxName) ? Hive.box(settingsBoxName) : null;

  @override
  ThemeMode build() => _decode(_box?.get(_themeModeKey) as String?);

  /// Selects [mode] and persists it.
  Future<void> set(ThemeMode mode) async {
    if (mode == state) return;
    state = mode;
    await _box?.put(_themeModeKey, _encode(mode));
  }

  /// Advances System → Light → Dark → System, for a one-tap toggle.
  Future<void> cycle() => set(switch (state) {
    ThemeMode.system => ThemeMode.light,
    ThemeMode.light => ThemeMode.dark,
    ThemeMode.dark => ThemeMode.system,
  });

  static String _encode(ThemeMode mode) => switch (mode) {
    ThemeMode.light => 'light',
    ThemeMode.dark => 'dark',
    ThemeMode.system => 'system',
  };

  /// Defaults to light: the app's editorial look is a light one, so a
  /// first-time visitor should see it rather than whatever their OS
  /// happens to be set to. "System" and "Dark" stay one tap away.
  static ThemeMode _decode(String? raw) => switch (raw) {
    'dark' => ThemeMode.dark,
    'system' => ThemeMode.system,
    _ => ThemeMode.light,
  };
}

/// Presentation helpers shared by the theme switcher UI.
extension ThemeModeDisplay on ThemeMode {
  String get label => switch (this) {
    ThemeMode.system => 'System',
    ThemeMode.light => 'Light',
    ThemeMode.dark => 'Dark',
  };

  IconData get icon => switch (this) {
    ThemeMode.system => Icons.brightness_auto_rounded,
    ThemeMode.light => Icons.light_mode_rounded,
    ThemeMode.dark => Icons.dark_mode_rounded,
  };

  String get description => switch (this) {
    ThemeMode.system => 'Follow device setting',
    ThemeMode.light => 'Always bright',
    ThemeMode.dark => 'Always dark',
  };
}
