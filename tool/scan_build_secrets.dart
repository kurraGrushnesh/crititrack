/// SEC-01 regression gate: no credential may reach a build artifact.
///
/// Scans a built web bundle for credential-shaped strings.
///
///   dart run tool/scan_build_secrets.dart [buildDir] [optionsFile]
///
/// Written in Dart rather than as a shell script so that the identical
/// check runs on the Linux CI runner and on a Windows development
/// machine. `bash` in PowerShell resolves to WSL, which need not have a
/// distribution installed, so a .sh gate is one that only CI can run —
/// and a check nobody runs locally is a check that fails at push time.
/// This matches how tool/check_coverage.dart is invoked.
///
/// ## On the Firebase client keys
///
/// Firebase's web and Android `apiKey` values are public client
/// identifiers, not secrets. They ship in every Firebase app and are
/// documented as safe to expose; what protects the project is App Check
/// and the Firestore rules, not the key being hidden.
///
/// They are nevertheless shaped exactly like a Google Cloud API key,
/// which is what a leaked YouTube Data key looks like — and that one is
/// a real secret. So the AIza pattern has to stay, and the declared
/// client keys are allow-listed instead. The allow-list is read out of
/// lib/firebase_options.dart rather than hardcoded here, so it tracks
/// the source: any AIza-shaped string in the bundle that is not a
/// declared client key still fails the build.
library;

import 'dart:convert';
import 'dart:io';

/// Patterns that are a leak whatever the context.
final _hard = RegExp(
  r'gsk_[A-Za-z0-9]{20}'
  r'|IGQ[A-Za-z0-9_-]{20}'
  r'|sk-[A-Za-z0-9]{20}'
  r'|GROQ_API_KEY'
  r'|NEWS_API_KEY'
  r'|YOUTUBE_API_KEY'
  r'|INSTAGRAM_ACCESS_TOKEN',
);

/// Google API keys, which need the allow-list applied before judging.
final _googleKey = RegExp(r'AIza[A-Za-z0-9_-]{20,}');

void main(List<String> args) {
  final buildDir = Directory(args.isNotEmpty ? args[0] : 'build/web');
  final optionsFile = File(
    args.length > 1 ? args[1] : 'lib/firebase_options.dart',
  );

  if (!buildDir.existsSync()) {
    _fail('${buildDir.path} does not exist — nothing was built.');
    exit(1);
  }

  // An empty allow-list would silently pass a real key through, so a
  // missing or moved options file is a hard failure rather than a
  // permissive default.
  if (!optionsFile.existsSync()) {
    _fail('${optionsFile.path} not found; the allow-list cannot be built.');
    exit(1);
  }
  final allowed =
      _googleKey
          .allMatches(optionsFile.readAsStringSync())
          .map((m) => m[0]!)
          .toSet();
  if (allowed.isEmpty) {
    _fail(
      'No client keys found in ${optionsFile.path}, so the allow-list '
      'would let a real key through. Check the file.',
    );
    exit(1);
  }

  stdout.writeln('Scanning ${buildDir.path} for credential patterns...');
  stdout.writeln(
    'Allow-listing ${allowed.length} public Firebase client '
    'key(s).',
  );

  var failed = false;

  for (final entity in buildDir.listSync(recursive: true)) {
    if (entity is! File) continue;

    final name = entity.uri.pathSegments.last;
    if (name.startsWith('.env')) {
      _fail('A .env file was bundled into the build output: ${entity.path}');
      failed = true;
      continue;
    }

    // latin1 never throws on arbitrary bytes, so compiled assets and
    // fonts can be scanned alongside source without special-casing.
    final text = latin1.decode(entity.readAsBytesSync(), allowInvalid: true);

    if (_hard.hasMatch(text)) {
      _fail('Credential-shaped string found in ${entity.path}.');
      failed = true;
    }

    for (final match in _googleKey.allMatches(text)) {
      final key = match[0]!;
      if (allowed.contains(key)) continue;
      _fail(
        'Google API key in ${entity.path} that is not a declared Firebase '
        'client key: ${key.substring(0, 10)}...',
      );
      failed = true;
    }
  }

  if (failed) {
    stderr.writeln('SEC-01: the build output carries a credential.');
    exit(1);
  }

  stdout.writeln('Clean: no credentials in build output.');
}

/// GitHub Actions renders `::error::` lines as annotations on the run;
/// elsewhere it is just a prefixed message.
void _fail(String message) => stderr.writeln('::error::$message See SEC-01.');
