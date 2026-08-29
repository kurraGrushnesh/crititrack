/// Hard facts about a person, read from Wikidata rather than generated.
///
/// The distinction this file exists to hold is the one F02 asks for:
/// every hard fact on a profile comes from a structured source, and only
/// the prose summary is generated. A model asked for a birth date will
/// produce a plausible one for someone it knows nothing about, and there
/// is no way to tell that apart from a real one on screen.
///
/// Dates arrive at whatever precision Wikidata actually asserts —
/// `1996-09-01`, `1912-06`, or just `1856` — and are rendered at that
/// precision. Padding a year out to 1 January would state a birthday
/// nobody recorded.
library;

import 'package:equatable/equatable.dart';

class PersonFacts extends Equatable {
  const PersonFacts({
    this.birthDate,
    this.deathDate,
    this.citizenship = const [],
    this.occupations = const [],
  });

  /// `YYYY`, `YYYY-MM` or `YYYY-MM-DD`.
  final String? birthDate;
  final String? deathDate;

  final List<String> citizenship;
  final List<String> occupations;

  static const PersonFacts empty = PersonFacts();

  bool get isEmpty =>
      birthDate == null &&
      deathDate == null &&
      citizenship.isEmpty &&
      occupations.isEmpty;

  bool get isNotEmpty => !isEmpty;

  /// Age in whole years, or null.
  ///
  /// Only computed from a full date, and only for someone with no
  /// recorded death. A year-only birth date gives an age that is wrong
  /// for most of the year, and quietly wrong is worse than absent.
  int? get age {
    if (deathDate != null) return null;

    final born = _parseFull(birthDate);
    if (born == null) return null;

    final now = DateTime.now();
    var years = now.year - born.year;
    final hadBirthday =
        now.month > born.month ||
        (now.month == born.month && now.day >= born.day);
    if (!hadBirthday) years--;

    return years >= 0 && years < 130 ? years : null;
  }

  String? get birthDisplay => formatPartialDate(birthDate);
  String? get deathDisplay => formatPartialDate(deathDate);

  Map<String, dynamic> toMap() => {
    'birthDate': birthDate,
    'deathDate': deathDate,
    'citizenship': citizenship,
    'occupations': occupations,
  };

  factory PersonFacts.fromMap(Map<dynamic, dynamic>? map) {
    if (map == null) return empty;

    return PersonFacts(
      birthDate: _asDate(map['birthDate']),
      deathDate: _asDate(map['deathDate']),
      citizenship: _asStrings(map['citizenship']),
      occupations: _asStrings(map['occupations']),
    );
  }

  @override
  List<Object?> get props => [
    birthDate,
    deathDate,
    citizenship.join(','),
    occupations.join(','),
  ];
}

/// One of several people a name could have meant.
class EntityCandidate extends Equatable {
  const EntityCandidate({
    required this.qid,
    required this.label,
    this.description = '',
  });

  /// Wikidata item id. Sent back as `?qid=` to pin the lookup, because
  /// searching again by label would be circular — two people can share a
  /// label exactly, which is how the ambiguity arose.
  final String qid;

  final String label;
  final String description;

  static EntityCandidate? fromMap(Map<dynamic, dynamic> map) {
    final qid = map['qid'];
    if (qid is! String || !RegExp(r'^Q\d+$').hasMatch(qid)) return null;

    final label = map['label'];
    if (label is! String || label.isEmpty) return null;

    return EntityCandidate(
      qid: qid,
      label: label,
      description: map['description'] as String? ?? '',
    );
  }

  @override
  List<Object?> get props => [qid, label, description];
}

const List<String> _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// Renders a partial ISO date at exactly the precision it carries.
///
/// `1996-09-01` → `1 September 1996`
/// `1912-06`    → `June 1912`
/// `1856`       → `1856`
///
/// Returns null for anything it cannot read, so a malformed value shows
/// no line rather than a wrong one.
String? formatPartialDate(String? iso) {
  if (iso == null || iso.isEmpty) return null;

  final parts = iso.split('-');
  final year = int.tryParse(parts[0]);
  if (year == null || parts[0].length != 4) return null;

  if (parts.length == 1) return '$year';

  final month = int.tryParse(parts[1]);
  if (month == null || month < 1 || month > 12) return null;
  final monthName = _months[month - 1];

  if (parts.length == 2) return '$monthName $year';

  final day = int.tryParse(parts[2]);
  if (day == null || day < 1 || day > 31) return null;

  return '$day $monthName $year';
}

DateTime? _parseFull(String? iso) {
  if (iso == null) return null;
  final parts = iso.split('-');
  if (parts.length != 3) return null;

  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  return DateTime(y, m, d);
}

String? _asDate(Object? v) {
  if (v is! String || v.isEmpty) return null;
  return RegExp(r'^\d{4}(-\d{2}(-\d{2})?)?$').hasMatch(v) ? v : null;
}

List<String> _asStrings(Object? v) {
  if (v is! List) return const [];
  return [
    for (final e in v)
      if (e is String && e.trim().isNotEmpty) e.trim(),
  ];
}
