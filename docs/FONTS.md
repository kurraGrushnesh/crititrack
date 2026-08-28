# Typography

The app currently renders in the **platform default** typeface — Roboto on
Android, San Francisco on iOS. That is a deliberate state, not an
oversight.

## What was wrong before

`app_theme.dart` set `fontFamily: 'Inter'` while `pubspec.yaml` declared no
font asset at all. Flutter cannot resolve a family it was never given, so
it silently fell back to Roboto. The theme claimed a typeface the app did
not ship, and nothing warned about it — the app looked subtly different
from the design intent and no one could tell why.

`AppTheme.fontFamily` is now derived from `_bundledFontFamily`, which is
empty. Empty means "use the platform default", so what the theme says and
what the app renders are the same thing.

## Adding Inter properly

1. Download the Inter static `.ttf` files (SIL Open Font License) from
   <https://fonts.google.com/specimen/Inter> and place these four in
   `assets/fonts/`:

   ```
   Inter-Regular.ttf
   Inter-Medium.ttf
   Inter-SemiBold.ttf
   Inter-Bold.ttf
   ```

2. Add the declaration to `pubspec.yaml`, directly under `assets:`:

   ```yaml
     fonts:
       - family: Inter
         fonts:
           - asset: assets/fonts/Inter-Regular.ttf
             weight: 400
           - asset: assets/fonts/Inter-Medium.ttf
             weight: 500
           - asset: assets/fonts/Inter-SemiBold.ttf
             weight: 600
           - asset: assets/fonts/Inter-Bold.ttf
             weight: 700
   ```

3. Set the constant in `lib/core/theme/app_theme.dart`:

   ```dart
   static const String _bundledFontFamily = 'Inter';
   ```

4. `flutter pub get`, then restart the app — hot reload does not pick up
   new font assets.

Ship only the weights the theme actually uses. Each unused weight is
roughly 300 KB of install size for nothing.

## Why not `google_fonts`

The `google_fonts` package fetches faces over the network on first use.
That means a flash of fallback text on a cold start, a failure mode when
offline, and a request to a third party on every new install. Bundling the
files is larger in the repository and smaller in every way that a user
notices.
