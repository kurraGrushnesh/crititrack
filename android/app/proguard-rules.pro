# R8 / ProGuard keep rules for CritiTrack (SEC-07).
#
# R8 full mode removes and renames everything it cannot prove is used.
# Anything reached only reflectively — by the Flutter engine, by a plugin's
# platform channel, or by a JSON deserialiser — looks unused to it and
# disappears. The symptom is always the same and always at runtime, never
# at build time: a plugin silently does nothing in release while working
# perfectly in debug.
#
# Each rule below exists for a reason. Do not add blanket `-keep class **`
# rules to make a problem go away; that disables the shrinking this file
# exists to make safe.

# ── Flutter engine ────────────────────────────────────────────────────
# The embedding is instantiated by name from AndroidManifest.
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# ── Firebase ──────────────────────────────────────────────────────────
# Firestore maps documents onto classes reflectively, and the Play
# Integrity / App Check providers are resolved by name at runtime.
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Firestore serialises model fields by reflection; renaming them breaks
# the mapping silently, producing empty documents rather than an error.
-keepclassmembers class * {
    @com.google.firebase.firestore.PropertyName <fields>;
    @com.google.firebase.firestore.PropertyName <methods>;
}

# ── Play Core / deferred components ───────────────────────────────────
# Flutter references these even when split installs are unused.
-dontwarn com.google.android.play.core.**

# ── WebView ───────────────────────────────────────────────────────────
# JavaScript interfaces are bound by name. We disable JS by default
# (SEC-06), but the binding must survive for the cases that enable it.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Kotlin ────────────────────────────────────────────────────────────
-keep class kotlin.Metadata { *; }
-keepclassmembers class **$WhenMappings { <fields>; }

# ── Annotations and signatures ────────────────────────────────────────
# Generic signatures are needed to deserialise parameterised types, and
# annotations are how several of the rules above find their targets.
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Line numbers are kept so an obfuscated stack trace can still be mapped
# back. `SourceFile` is renamed so the original file names do not leak.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Deliberately NOT kept ─────────────────────────────────────────────
# The app's own classes are obfuscated. Nothing in lib/ is reached by
# reflection: models are hand-written to and from maps rather than
# generated, so R8 can rename all of it safely. If a future change adds
# reflective JSON binding, that model will need a keep rule here — and the
# failure will look like empty fields at runtime, not a build error.
