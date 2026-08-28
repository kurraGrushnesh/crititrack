import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// SEC-07: release signing credentials live in android/key.properties, which
// is gitignored, or in the environment for CI. They are never committed.
//
// When the file is absent the release build falls back to the debug key so
// `flutter run --release` still works locally — but `assembleRelease` then
// produces an artifact that must never be published. The check at the
// bottom of this file fails the build if that is attempted in CI.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.crititrack.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.crititrack.app"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = keystoreProperties["storeFile"]?.let { file(it) }
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }

            // R8 in full mode: shrinks, optimises and obfuscates. Without
            // this the APK decompiles to readable logic, and every class
            // name in the app is a hint about how it works.
            isMinifyEnabled = true
            isShrinkResources = true

            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }

        debug {
            // Keep debug builds fast and readable; shrinking here only
            // costs build time and makes stack traces useless.
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }

    // Per-ABI splits keep the download small. Play serves the right one.
    // Irrelevant to App Bundles, which split automatically, but this makes
    // a directly-distributed APK sane too.
    splits {
        abi {
            isEnable = true
            reset()
            include("armeabi-v7a", "arm64-v8a", "x86_64")
            isUniversalApk = false
        }
    }

    packaging {
        resources {
            // Duplicate licence files from transitive dependencies would
            // otherwise fail the merge.
            excludes += setOf(
                "META-INF/AL2.0",
                "META-INF/LGPL2.1",
                "META-INF/*.kotlin_module",
            )
        }
    }
}

flutter {
    source = "../.."
}

// A release artifact signed with the debug key must never reach a store.
// Locally that fallback is a convenience; in CI it is a mistake, so fail
// loudly rather than producing an unpublishable bundle that looks fine.
gradle.taskGraph.whenReady {
    val buildingRelease = allTasks.any {
        it.name.contains("Release") && (
            it.name.startsWith("assemble") || it.name.startsWith("bundle")
        )
    }
    val isCi = System.getenv("CI") != null
    if (buildingRelease && isCi && !hasReleaseKeystore) {
        throw GradleException(
            "Release build requested in CI without android/key.properties. " +
                "Refusing to sign with the debug key — see docs/RELEASE.md.",
        )
    }
}
