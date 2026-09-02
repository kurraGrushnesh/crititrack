/// Application design system.
///
/// Defines a single premium visual language rendered in two skins —
/// a deep indigo **dark** theme and a soft, paper-white **light**
/// theme — plus the [AppPalette] theme extension that carries every
/// surface, text and border token that differs between them.
///
/// Widgets must never reference a raw surface/text colour. Read them
/// from the palette instead:
///
/// ```dart
/// final palette = context.palette;
/// Container(color: palette.card, ...);
/// ```
///
/// Brand and sentiment hues ([primary], [sentimentPositive], …) are
/// mid-tone **fill** colours, exposed as plain constants: dots, bars,
/// chart series and tinted chip backgrounds, where the 3:1 threshold for
/// graphical objects applies.
///
/// They are not legible as text on both skins, which this file used to
/// claim. On white the three sentiment hues measure 2.29, 1.68 and 3.03
/// against the score chip's own tint. Text and icons therefore read
/// [AppPalette.sentimentPositiveText] and its siblings, which are tuned
/// per skin — see [sentimentTextColor].
///
/// All text styles are accessed through `Theme.of(context).textTheme`
/// — no hardcoded font sizes anywhere in the widget tree.
library;

import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

abstract final class AppTheme {
  // ── Brand Palette ─────────────────────────────────────────────────
  //
  // Editorial minimalism: a single restrained sage-green accent, shared
  // with the web client (site/app/globals.css: --brand #86d1ab,
  // --brand-strong #1c7a53, --brand-ink #1b6a49). `primary` is a light
  // mint fill that takes near-black text (10:1); `primaryLight` is the
  // mint that reads as text on a dark surface; `primaryDeep` is the dark
  // sage that reads as text on white (~5.5:1) and doubles as the pressed
  // fill with white text.
  static const Color primary = Color(0xFF86D1AB); // Mint fill, dark text
  static const Color primaryDeep = Color(0xFF1B6A49); // Pressed / light text
  static const Color primaryLight = Color(0xFF8FD9B4); // Mint ink on dark
  static const Color secondary = Color(0xFF17C3B2); // Refined teal
  static const Color accent = Color(0xFFF368A0); // Orchid pink
  static const Color warning = Color(0xFFF2B544); // Amber gold
  static const Color error = Color(0xFFE05C4B); // Warm red
  static const Color success = Color(0xFF17B57E); // Emerald

  // ── Sentiment Colors ──────────────────────────────────────────────
  static const Color sentimentPositive = Color(0xFF17B57E);
  static const Color sentimentNeutral = Color(0xFFF2B544);
  static const Color sentimentNegative = Color(0xFFE05C4B);

  // ── Gradients ─────────────────────────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF1C7A53), Color(0xFF15603F)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient sentimentGradient = LinearGradient(
    colors: [sentimentPositive, secondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ── Border Radius ─────────────────────────────────────────────────
  static final BorderRadius radiusSm = BorderRadius.circular(10);
  static final BorderRadius radiusMd = BorderRadius.circular(14);
  static final BorderRadius radiusLg = BorderRadius.circular(20);
  static final BorderRadius radiusXl = BorderRadius.circular(28);

  // ── Palettes ──────────────────────────────────────────────────────

  static const AppPalette darkPalette = AppPalette(
    background: Color(0xFF0A0B12),
    card: Color(0xFF12141F),
    elevated: Color(0xFF1B1E2C),
    glass: Color(0x14FFFFFF),
    border: Color(0xFF272B3B),
    borderStrong: Color(0xFF39405A),
    textPrimary: Color(0xFFECEEF7),
    textSecondary: Color(0xFF9AA2B8),
    // Lightened from 0xFF656C82, which sat at a 3.17 contrast ratio
    // against the elevated surface — below the WCAG AA floor of 4.5.
    textMuted: Color(0xFF8A92A8),
    brandText: primaryLight, // mint ink, high contrast on dark
    // Positive and neutral already clear 4.5:1 on their own tint here;
    // negative did not (4.29 on card, 3.84 on elevated), so it is
    // lightened. The other two are unchanged.
    sentimentPositiveText: sentimentPositive,
    sentimentNeutralText: sentimentNeutral,
    sentimentNegativeText: Color(0xFFE57667),
    chartGrid: Color(0xFF272B3B),
    scrim: Color(0xFF0A0B12),
    heroTint: Color(0xFF0E2A1E), // deep green-black
    shadowColor: Color(0xFF000000),
    shadowOpacity: 0.45,
  );

  static const AppPalette lightPalette = AppPalette(
    background: Color(0xFFF5F6FB),
    card: Color(0xFFFFFFFF),
    elevated: Color(0xFFEFF1F8),
    glass: Color(0x0F101828),
    border: Color(0xFFE2E6F0),
    borderStrong: Color(0xFFCBD2E2),
    textPrimary: Color(0xFF10121A),
    textSecondary: Color(0xFF545C71),
    // Darkened from 0xFF8A92A6, which sat at a 2.76 contrast ratio.
    textMuted: Color(0xFF636A7C),
    brandText: primaryDeep, // dark sage, ~5.5:1 on white
    // All three fill hues are far too light to read on white — 2.29,
    // 1.68 and 3.03 on their own tint. Darkened to 4.56, 4.59 and 4.53.
    sentimentPositiveText: Color(0xFF0F7652),
    sentimentNeutralText: Color(0xFF8C5E0A),
    sentimentNegativeText: Color(0xFFBE3321),
    chartGrid: Color(0xFFD9DFEC),
    scrim: Color(0xFFF5F6FB),
    heroTint: Color(0xFFE6F2EB), // pale mint
    shadowColor: Color(0xFF3C4670),
    shadowOpacity: 0.14,
  );

  // ── ThemeData ─────────────────────────────────────────────────────

  /// Typeface for the whole app.
  ///
  /// `null` means the platform default — Roboto on Android, San Francisco
  /// on iOS — which is a deliberate, legible choice rather than an
  /// accident.
  ///
  /// This was previously hardcoded to `'Inter'` while no Inter asset was
  /// bundled, so Flutter silently fell back to Roboto anyway: the theme
  /// claimed a typeface the app did not ship. Naming a family here only
  /// has an effect once matching files are declared under `fonts:` in
  /// pubspec.yaml — see docs/FONTS.md.
  /// Change to `'Inter'` once the four Inter `.ttf` files are in
  /// `assets/fonts/` and declared under `fonts:` in pubspec.yaml.
  static const String? fontFamily = null;

  static ThemeData get darkTheme => _build(Brightness.dark, darkPalette);
  static ThemeData get lightTheme => _build(Brightness.light, lightPalette);

  static ThemeData _build(Brightness brightness, AppPalette palette) {
    final isDark = brightness == Brightness.dark;
    final brand = isDark ? primary : primaryDeep;
    // The sage `brand` fill is a light mint in dark mode and a dark
    // sage in light mode, so the text on it flips: near-black green on
    // the mint (10:1), white on the dark sage (5.5:1).
    final onBrand = isDark ? const Color(0xFF08281B) : Colors.white;
    final textTheme = _textTheme(palette);

    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: brand,
      onPrimary: onBrand,
      primaryContainer: brand.withValues(alpha: isDark ? 0.22 : 0.12),
      onPrimaryContainer: palette.brandText,
      secondary: secondary,
      onSecondary: Colors.white,
      tertiary: accent,
      onTertiary: Colors.white,
      error: error,
      onError: Colors.white,
      surface: palette.card,
      onSurface: palette.textPrimary,
      surfaceContainerHighest: palette.elevated,
      onSurfaceVariant: palette.textSecondary,
      outline: palette.border,
      outlineVariant: palette.borderStrong,
      shadow: palette.shadowColor,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: palette.background,
      canvasColor: palette.background,
      fontFamily: fontFamily,
      textTheme: textTheme,
      splashFactory: InkRipple.splashFactory,
      extensions: [palette],
      visualDensity: VisualDensity.adaptivePlatformDensity,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: ZoomPageTransitionsBuilder(),
          TargetPlatform.linux: ZoomPageTransitionsBuilder(),
        },
      ),
      iconTheme: IconThemeData(color: palette.textSecondary, size: 22),
      appBarTheme: _appBarTheme(palette, textTheme, isDark),
      cardTheme: CardThemeData(
        color: palette.card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: radiusLg,
          side: BorderSide(color: palette.border),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: palette.elevated,
        selectedColor: brand.withValues(alpha: 0.16),
        secondarySelectedColor: brand.withValues(alpha: 0.16),
        checkmarkColor: brand,
        labelStyle: textTheme.labelMedium!.copyWith(
          color: palette.textPrimary,
          fontWeight: FontWeight.w500,
        ),
        side: BorderSide(color: palette.border),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        shape: RoundedRectangleBorder(borderRadius: radiusSm),
      ),
      tabBarTheme: TabBarThemeData(
        indicatorColor: brand,
        labelColor: brand,
        unselectedLabelColor: palette.textSecondary,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: Colors.transparent,
        labelStyle: textTheme.labelLarge,
        unselectedLabelStyle: textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w500,
        ),
        overlayColor: WidgetStatePropertyAll(brand.withValues(alpha: 0.06)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: palette.elevated,
        border: OutlineInputBorder(
          borderRadius: radiusMd,
          borderSide: BorderSide(color: palette.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: radiusMd,
          borderSide: BorderSide(color: palette.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: radiusMd,
          borderSide: BorderSide(color: brand, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: radiusMd,
          borderSide: const BorderSide(color: error),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        hintStyle: textTheme.bodyLarge?.copyWith(color: palette.textMuted),
        prefixIconColor: palette.textMuted,
        suffixIconColor: palette.textMuted,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: brand,
          foregroundColor: onBrand,
          disabledBackgroundColor: palette.elevated,
          disabledForegroundColor: palette.textMuted,
          elevation: 0,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: radiusMd),
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 14,
            letterSpacing: 0.2,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: brand,
          foregroundColor: onBrand,
          shape: RoundedRectangleBorder(borderRadius: radiusMd),
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.textPrimary,
          side: BorderSide(color: palette.border),
          shape: RoundedRectangleBorder(borderRadius: radiusMd),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: palette.brandText,
          shape: RoundedRectangleBorder(borderRadius: radiusSm),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: palette.textSecondary,
          highlightColor: brand.withValues(alpha: 0.10),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: palette.card,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: palette.borderStrong,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: palette.card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: radiusLg,
          side: BorderSide(color: palette.border),
        ),
        titleTextStyle: textTheme.titleLarge,
        contentTextStyle: textTheme.bodyMedium,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: palette.card,
        surfaceTintColor: Colors.transparent,
        elevation: 8,
        shadowColor: palette.shadowColor.withValues(
          alpha: palette.shadowOpacity,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: radiusMd,
          side: BorderSide(color: palette.border),
        ),
        textStyle: textTheme.bodyMedium?.copyWith(color: palette.textPrimary),
      ),
      dividerTheme: DividerThemeData(
        color: palette.border,
        thickness: 1,
        space: 1,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: brand,
        linearTrackColor: palette.elevated,
        circularTrackColor: palette.elevated,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: brand,
        inactiveTrackColor: palette.elevated,
        thumbColor: brand,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected)
                  ? Colors.white
                  : palette.textMuted,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? brand : palette.elevated,
        ),
        trackOutlineColor: WidgetStatePropertyAll(palette.border),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: palette.elevated,
          borderRadius: radiusSm,
          border: Border.all(color: palette.border),
        ),
        textStyle: textTheme.labelMedium?.copyWith(color: palette.textPrimary),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: palette.elevated,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: palette.textPrimary,
        ),
        actionTextColor: brand,
        shape: RoundedRectangleBorder(borderRadius: radiusMd),
        behavior: SnackBarBehavior.floating,
        elevation: 0,
      ),
      listTileTheme: ListTileThemeData(
        iconColor: palette.textSecondary,
        textColor: palette.textPrimary,
        shape: RoundedRectangleBorder(borderRadius: radiusMd),
      ),
    );
  }

  static AppBarTheme _appBarTheme(
    AppPalette palette,
    TextTheme textTheme,
    bool isDark,
  ) {
    return AppBarTheme(
      backgroundColor: palette.background,
      foregroundColor: palette.textPrimary,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: textTheme.titleLarge,
      iconTheme: IconThemeData(color: palette.textPrimary, size: 22),
      systemOverlayStyle:
          isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
    );
  }

  static TextTheme _textTheme(AppPalette p) => TextTheme(
    displayLarge: TextStyle(
      fontSize: 34,
      fontWeight: FontWeight.w700,
      color: p.textPrimary,
      letterSpacing: -1.1,
      height: 1.15,
    ),
    displayMedium: TextStyle(
      fontSize: 28,
      fontWeight: FontWeight.w700,
      color: p.textPrimary,
      letterSpacing: -0.7,
      height: 1.2,
    ),
    headlineLarge: TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: p.textPrimary,
      letterSpacing: -0.5,
    ),
    headlineMedium: TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: p.textPrimary,
      letterSpacing: -0.3,
    ),
    titleLarge: TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w600,
      color: p.textPrimary,
      letterSpacing: -0.2,
    ),
    titleMedium: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: p.textPrimary,
    ),
    titleSmall: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w500,
      color: p.textSecondary,
    ),
    bodyLarge: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w400,
      color: p.textPrimary,
      height: 1.6,
    ),
    bodyMedium: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w400,
      color: p.textSecondary,
      height: 1.55,
    ),
    bodySmall: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w400,
      color: p.textMuted,
      height: 1.45,
    ),
    labelLarge: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: p.textPrimary,
      letterSpacing: 0.3,
    ),
    labelMedium: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w500,
      color: p.textSecondary,
    ),
    labelSmall: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.w500,
      color: p.textMuted,
      letterSpacing: 0.4,
    ),
  );
}

/// Brightness-dependent design tokens.
///
/// Registered on both [AppTheme.lightTheme] and [AppTheme.darkTheme] so
/// any widget can resolve the correct surface, text or border colour for
/// the active theme via `context.palette`.
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.background,
    required this.card,
    required this.elevated,
    required this.glass,
    required this.border,
    required this.borderStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.brandText,
    required this.sentimentPositiveText,
    required this.sentimentNeutralText,
    required this.sentimentNegativeText,
    required this.chartGrid,
    required this.scrim,
    required this.heroTint,
    required this.shadowColor,
    required this.shadowOpacity,
  });

  /// Page background, behind every scaffold.
  final Color background;

  /// Primary card / panel surface.
  final Color card;

  /// One step above [card] — chips, rows, inputs, meter tracks.
  final Color elevated;

  /// Translucent fill for glassmorphism overlays.
  final Color glass;

  /// Hairline separator and card outline.
  final Color border;

  /// Higher-contrast outline for focused or emphasised edges.
  final Color borderStrong;

  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;

  /// Brand hue tuned for legibility as *text* on [card] / [elevated].
  final Color brandText;

  /// Sentiment hues tuned for legibility as *text* and *icons*.
  ///
  /// [AppTheme.sentimentPositive] and friends are fill colours — dots,
  /// bars, chart series — where the 3:1 non-text threshold applies. The
  /// score chip puts the same hue on a 15% tint of itself, and there the
  /// 4.5:1 text threshold applies instead. Measured on that composite,
  /// the fill colours came out at 2.29, 1.68 and 3.03 in light mode:
  /// the app's headline number was effectively unreadable. These are the
  /// same hues walked in lightness until they clear 4.5:1.
  final Color sentimentPositiveText;
  final Color sentimentNeutralText;
  final Color sentimentNegativeText;

  /// Grid-line colour for fl_chart axes.
  final Color chartGrid;

  /// Colour used to fade imagery back into the page.
  final Color scrim;

  /// Tinted colour behind hero headers when no image is available.
  final Color heroTint;

  final Color shadowColor;
  final double shadowOpacity;

  /// Soft ambient shadow for raised cards.
  List<BoxShadow> get cardShadow => [
    BoxShadow(
      color: shadowColor.withValues(alpha: shadowOpacity),
      blurRadius: 28,
      offset: const Offset(0, 12),
      spreadRadius: -8,
    ),
  ];

  /// Tighter shadow for small floating elements.
  List<BoxShadow> get softShadow => [
    BoxShadow(
      color: shadowColor.withValues(alpha: shadowOpacity * 0.7),
      blurRadius: 16,
      offset: const Offset(0, 6),
      spreadRadius: -6,
    ),
  ];

  /// Coloured glow used behind the brand mark.
  List<BoxShadow> get glowShadow => [
    BoxShadow(
      color: AppTheme.primary.withValues(alpha: 0.32),
      blurRadius: 32,
      offset: const Offset(0, 10),
      spreadRadius: -6,
    ),
  ];

  /// Subtle top-left → bottom-right sheen used on the biography card.
  LinearGradient get cardGradient => LinearGradient(
    colors: [card, Color.alphaBlend(glass, card)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Glassmorphism decoration for translucent overlays.
  BoxDecoration get glassDecoration => BoxDecoration(
    color: glass,
    borderRadius: AppTheme.radiusLg,
    border: Border.all(color: border),
  );

  @override
  AppPalette copyWith({
    Color? background,
    Color? card,
    Color? elevated,
    Color? glass,
    Color? border,
    Color? borderStrong,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? brandText,
    Color? sentimentPositiveText,
    Color? sentimentNeutralText,
    Color? sentimentNegativeText,
    Color? chartGrid,
    Color? scrim,
    Color? heroTint,
    Color? shadowColor,
    double? shadowOpacity,
  }) {
    return AppPalette(
      background: background ?? this.background,
      card: card ?? this.card,
      elevated: elevated ?? this.elevated,
      glass: glass ?? this.glass,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      brandText: brandText ?? this.brandText,
      sentimentPositiveText:
          sentimentPositiveText ?? this.sentimentPositiveText,
      sentimentNeutralText: sentimentNeutralText ?? this.sentimentNeutralText,
      sentimentNegativeText:
          sentimentNegativeText ?? this.sentimentNegativeText,
      chartGrid: chartGrid ?? this.chartGrid,
      scrim: scrim ?? this.scrim,
      heroTint: heroTint ?? this.heroTint,
      shadowColor: shadowColor ?? this.shadowColor,
      shadowOpacity: shadowOpacity ?? this.shadowOpacity,
    );
  }

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(
      background: Color.lerp(background, other.background, t)!,
      card: Color.lerp(card, other.card, t)!,
      elevated: Color.lerp(elevated, other.elevated, t)!,
      glass: Color.lerp(glass, other.glass, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      brandText: Color.lerp(brandText, other.brandText, t)!,
      sentimentPositiveText:
          Color.lerp(sentimentPositiveText, other.sentimentPositiveText, t)!,
      sentimentNeutralText:
          Color.lerp(sentimentNeutralText, other.sentimentNeutralText, t)!,
      sentimentNegativeText:
          Color.lerp(sentimentNegativeText, other.sentimentNegativeText, t)!,
      chartGrid: Color.lerp(chartGrid, other.chartGrid, t)!,
      scrim: Color.lerp(scrim, other.scrim, t)!,
      heroTint: Color.lerp(heroTint, other.heroTint, t)!,
      shadowColor: Color.lerp(shadowColor, other.shadowColor, t)!,
      shadowOpacity: shadowOpacity + (other.shadowOpacity - shadowOpacity) * t,
    );
  }
}

/// Convenient access to the active [AppPalette].
extension AppPaletteX on BuildContext {
  /// The surface/text/border tokens for the currently active theme.
  ///
  /// Falls back to the dark palette if a widget is built outside an
  /// app-level [Theme] (e.g. in a bare widget test).
  AppPalette get palette =>
      Theme.of(this).extension<AppPalette>() ?? AppTheme.darkPalette;
}
