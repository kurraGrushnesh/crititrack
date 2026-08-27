/// Application theme providing a cohesive dark-mode-first design
/// system with curated HSL color palettes, glassmorphism surface
/// treatments, and typography powered by the Inter font family.
///
/// All text styles are accessed through `Theme.of(context).textTheme`
/// — no hardcoded font sizes anywhere in the widget tree.
library;

import 'package:flutter/material.dart';

abstract final class AppTheme {
  // ── Brand Palette (HSL-derived) ───────────────────────────────────
  static const Color primary = Color(0xFF6C5CE7); // Vivid violet
  static const Color primaryLight = Color(0xFFA29BFE); // Soft lavender
  static const Color secondary = Color(0xFF00CEC9); // Electric teal
  static const Color accent = Color(0xFFFD79A8); // Hot pink
  static const Color warning = Color(0xFFFDCB6E); // Amber gold
  static const Color error = Color(0xFFE17055); // Warm red
  static const Color success = Color(0xFF00B894); // Mint green

  // ── Sentiment Colors ──────────────────────────────────────────────
  static const Color sentimentPositive = Color(0xFF00B894);
  static const Color sentimentNeutral = Color(0xFFFDCB6E);
  static const Color sentimentNegative = Color(0xFFE17055);

  // ── Surface Colors ────────────────────────────────────────────────
  static const Color surfaceDark = Color(0xFF0D1117);
  static const Color surfaceCard = Color(0xFF161B22);
  static const Color surfaceElevated = Color(0xFF21262D);
  static const Color surfaceGlass = Color(0x1AFFFFFF); // 10% white
  static const Color border = Color(0xFF30363D);

  // ── Text Colors ───────────────────────────────────────────────────
  static const Color textPrimary = Color(0xFFF0F6FC);
  static const Color textSecondary = Color(0xFF8B949E);
  static const Color textMuted = Color(0xFF484F58);

  // ── Gradients ─────────────────────────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primary, Color(0xFF8B5CF6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGradient = LinearGradient(
    colors: [surfaceCard, Color(0xFF1A1F2E)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient sentimentGradient = LinearGradient(
    colors: [sentimentPositive, secondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ── Border Radius ─────────────────────────────────────────────────
  static final BorderRadius radiusSm = BorderRadius.circular(8);
  static final BorderRadius radiusMd = BorderRadius.circular(12);
  static final BorderRadius radiusLg = BorderRadius.circular(16);
  static final BorderRadius radiusXl = BorderRadius.circular(24);

  // ── Shadows ───────────────────────────────────────────────────────
  static List<BoxShadow> get cardShadow => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.3),
      blurRadius: 20,
      offset: const Offset(0, 8),
    ),
  ];

  static List<BoxShadow> get glowShadow => [
    BoxShadow(
      color: primary.withValues(alpha: 0.3),
      blurRadius: 30,
      spreadRadius: -5,
    ),
  ];

  // ── Glass Decoration ──────────────────────────────────────────────
  static BoxDecoration get glassDecoration => BoxDecoration(
    color: surfaceGlass,
    borderRadius: radiusLg,
    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
  );

  // ── ThemeData ─────────────────────────────────────────────────────
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: surfaceDark,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        secondary: secondary,
        tertiary: accent,
        surface: surfaceCard,
        error: error,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: textPrimary,
        onError: Colors.white,
      ),
      fontFamily: 'Inter',
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: textPrimary,
          letterSpacing: -1.0,
          height: 1.2,
        ),
        displayMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          color: textPrimary,
          letterSpacing: -0.5,
          height: 1.2,
        ),
        headlineLarge: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w600,
          color: textPrimary,
          letterSpacing: -0.5,
        ),
        headlineMedium: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: textPrimary,
        ),
        titleLarge: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: textPrimary,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: textPrimary,
        ),
        titleSmall: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: textSecondary,
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: textPrimary,
          height: 1.6,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: textSecondary,
          height: 1.5,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: textMuted,
          height: 1.4,
        ),
        labelLarge: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: textPrimary,
          letterSpacing: 0.5,
        ),
        labelMedium: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: textSecondary,
        ),
        labelSmall: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w500,
          color: textMuted,
          letterSpacing: 0.5,
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceDark,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: true,
      ),
      cardTheme: CardThemeData(
        color: surfaceCard,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: radiusMd),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: surfaceElevated,
        labelStyle: const TextStyle(
          color: textPrimary,
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
        side: const BorderSide(color: border),
        shape: RoundedRectangleBorder(borderRadius: radiusSm),
      ),
      tabBarTheme: const TabBarThemeData(
        indicatorColor: primary,
        labelColor: primary,
        unselectedLabelColor: textSecondary,
        indicatorSize: TabBarIndicatorSize.label,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceElevated,
        border: OutlineInputBorder(
          borderRadius: radiusMd,
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: radiusMd,
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: radiusMd,
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 16,
        ),
        hintStyle: const TextStyle(color: textMuted),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: radiusMd),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surfaceCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      dividerTheme: const DividerThemeData(color: border, thickness: 1),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: surfaceElevated,
        contentTextStyle: const TextStyle(color: textPrimary),
        shape: RoundedRectangleBorder(borderRadius: radiusMd),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
