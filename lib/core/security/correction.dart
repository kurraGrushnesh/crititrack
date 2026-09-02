/// Validation for the "report a correction" form.
///
/// This is the Dart twin of `functions/lib/correction.js` (the endpoint,
/// which is authoritative) and `site/lib/correction.ts` (the web form).
/// The three must agree: a change to a bound or an allowed value here
/// needs the identical change in the other two, plus a matching test
/// case in each suite.
///
/// The form runs this before it will submit, so the user sees inline
/// errors; the endpoint runs its own copy again because it cannot trust
/// that the client did.
library;

import 'safe_url.dart';

/// Which part of a profile a report is about.
enum CorrectionField { biography, controversy, sentiment, image, other }

/// The field names as sent to the endpoint. Must match
/// `CORRECTION_FIELDS` in the JavaScript and TypeScript copies.
extension CorrectionFieldWire on CorrectionField {
  String get wire => switch (this) {
    CorrectionField.biography => 'biography',
    CorrectionField.controversy => 'controversy',
    CorrectionField.sentiment => 'sentiment',
    CorrectionField.image => 'image',
    CorrectionField.other => 'other',
  };
}

/// A validated, normalised correction report, ready to serialise.
class CleanCorrection {
  const CleanCorrection({
    required this.slug,
    required this.field,
    required this.claim,
    required this.correction,
    this.evidenceUrl,
    this.email,
  });

  final String slug;
  final CorrectionField field;
  final String claim;
  final String correction;
  final String? evidenceUrl;
  final String? email;

  Map<String, dynamic> toJson() => {
    'slug': slug,
    'field': field.wire,
    'claim': claim,
    'correction': correction,
    if (evidenceUrl != null) 'evidenceUrl': evidenceUrl,
    if (email != null) 'email': email,
  };
}

/// Thrown for the first problem found. [field] names the offending input
/// so the form can highlight it.
class CorrectionError implements Exception {
  const CorrectionError(this.field, this.code, this.message);

  final String field;
  final String code;
  final String message;

  @override
  String toString() => 'CorrectionError($field, $code): $message';
}

/// Bounds, kept identical to the JavaScript and TypeScript copies.
abstract final class CorrectionLimits {
  static const int slugMaxLength = 90;
  static const int claimMinLength = 10;
  static const int claimMaxLength = 600;
  static const int correctionMinLength = 10;
  static const int correctionMaxLength = 1000;
  static const int emailMaxLength = 254;
}

final RegExp _slugPattern = RegExp(r'^[a-z0-9]+(?:-[a-z0-9]+)*$');
final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
final RegExp _whitespace = RegExp(r'\s+');

const List<String> _injectionMarkers = [
  'ignore previous',
  'ignore prior',
  'ignore all',
  'disregard',
  'system prompt',
  'you are now',
  'new instructions',
  'act as',
];

String _collapse(String v) => v.replaceAll(_whitespace, ' ').trim();

void _assertNoInjection(String field, String text) {
  final lowered = text.toLowerCase();
  if (_injectionMarkers.any(lowered.contains)) {
    throw CorrectionError(
      field,
      'looks_like_instruction',
      'That reads as an instruction rather than a description.',
    );
  }
}

CorrectionField? _parseField(String wire) {
  for (final f in CorrectionField.values) {
    if (f.wire == wire) return f;
  }
  return null;
}

/// Validates and normalises a correction report. Throws
/// [CorrectionError] on the first problem.
CleanCorrection validateCorrection({
  String? slug,
  String? field,
  String? claim,
  String? correction,
  String? evidenceUrl,
  String? email,
}) {
  final cleanSlug = (slug ?? '').trim().toLowerCase();
  if (cleanSlug.isEmpty) {
    throw const CorrectionError('slug', 'missing', 'No profile was named.');
  }
  if (cleanSlug.length > CorrectionLimits.slugMaxLength ||
      !_slugPattern.hasMatch(cleanSlug)) {
    throw const CorrectionError(
      'slug',
      'invalid',
      'That profile id is not valid.',
    );
  }

  final fieldValue = (field ?? '').trim().toLowerCase();
  final parsedField = _parseField(fieldValue);
  if (parsedField == null) {
    throw const CorrectionError(
      'field',
      'invalid',
      'Choose which part of the profile is wrong.',
    );
  }

  final cleanClaim = _collapse(claim ?? '');
  if (cleanClaim.length < CorrectionLimits.claimMinLength) {
    throw const CorrectionError(
      'claim',
      'too_short',
      'Quote the part you are disputing.',
    );
  }
  if (cleanClaim.length > CorrectionLimits.claimMaxLength) {
    throw CorrectionError(
      'claim',
      'too_long',
      'Keep the disputed text under '
          '${CorrectionLimits.claimMaxLength} characters.',
    );
  }
  _assertNoInjection('claim', cleanClaim);

  final cleanCorrection = _collapse(correction ?? '');
  if (cleanCorrection.length < CorrectionLimits.correctionMinLength) {
    throw const CorrectionError(
      'correction',
      'too_short',
      'Say what it should say instead.',
    );
  }
  if (cleanCorrection.length > CorrectionLimits.correctionMaxLength) {
    throw CorrectionError(
      'correction',
      'too_long',
      'Keep the correction under '
          '${CorrectionLimits.correctionMaxLength} characters.',
    );
  }
  _assertNoInjection('correction', cleanCorrection);

  String? cleanUrl;
  final rawUrl = (evidenceUrl ?? '').trim();
  if (rawUrl.isNotEmpty) {
    final parsed = SafeUrl.parse(rawUrl);
    if (parsed == null) {
      throw const CorrectionError(
        'evidenceUrl',
        'unsafe',
        'The evidence link must be a plain https web address.',
      );
    }
    cleanUrl = parsed.toString();
  }

  String? cleanEmail;
  final rawEmail = (email ?? '').trim();
  if (rawEmail.isNotEmpty) {
    if (rawEmail.length > CorrectionLimits.emailMaxLength ||
        !_emailPattern.hasMatch(rawEmail)) {
      throw const CorrectionError(
        'email',
        'invalid',
        'That email address is not valid.',
      );
    }
    cleanEmail = rawEmail;
  }

  return CleanCorrection(
    slug: cleanSlug,
    field: parsedField,
    claim: cleanClaim,
    correction: cleanCorrection,
    evidenceUrl: cleanUrl,
    email: cleanEmail,
  );
}
