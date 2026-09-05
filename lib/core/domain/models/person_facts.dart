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
    this.birthPlace,
    this.citizenship = const [],
    this.occupations = const [],
    this.awards = const [],
    this.education = const [],
    this.notableWorks = const [],
    this.career = const [],
    this.organizations = const [],
    this.relationships = const [],
    this.links = const {},
  });

  /// `YYYY`, `YYYY-MM` or `YYYY-MM-DD`.
  final String? birthDate;
  final String? deathDate;
  final String? birthPlace;

  final List<String> citizenship;
  final List<String> occupations;

  /// Awards actually recorded against this person, newest first.
  ///
  /// Sourced, unlike the generated "notable achievements" the model used
  /// to supply on its own: an award is a dated, checkable event, which is
  /// the kind of claim this app is supposed to be made of.
  final List<Award> awards;

  final List<String> education;

  /// Works recorded on Wikidata. Frequently empty — many people have no
  /// `P800` — in which case the biography's generated list stands in and
  /// the screen says which it is showing.
  final List<String> notableWorks;

  /// Dated career steps from Wikidata "position held" / "employer",
  /// oldest first. Sourced and dated — never generated.
  final List<CareerEntry> career;

  /// The organisations a career touched, most-recent first.
  final List<String> organizations;

  /// Structured Wikidata relationship rows (Step 22) — spouse, family,
  /// membership, ownership. Career-derived relationships (employer,
  /// position) are NOT here; they come from [career]. Empty on a payload
  /// assembled before relationship extraction shipped.
  final List<RawRelationship> relationships;

  /// Primary sources: the subject's own site and accounts, plus IMDb.
  /// Keys are `imdb`, `x`, `instagram`, `website`.
  final Map<String, String> links;

  static const PersonFacts empty = PersonFacts();

  bool get isEmpty =>
      birthDate == null &&
      deathDate == null &&
      birthPlace == null &&
      citizenship.isEmpty &&
      occupations.isEmpty &&
      awards.isEmpty &&
      education.isEmpty &&
      notableWorks.isEmpty &&
      career.isEmpty &&
      organizations.isEmpty &&
      links.isEmpty;

  /// True when there is a sourced career timeline to show.
  bool get hasCareer => career.isNotEmpty;

  /// Career insight lines, derived strictly from [career] — no invention.
  CareerInsights get careerInsights => CareerInsights._from(career);

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
      birthPlace: switch (map['birthPlace']) {
        final String s when s.trim().isNotEmpty => s.trim(),
        _ => null,
      },
      citizenship: _asStrings(map['citizenship']),
      occupations: _asStrings(map['occupations']),
      awards: Award.listFrom(map['awards']),
      education: _asStrings(map['education']),
      notableWorks: _asStrings(map['notableWorks']),
      career: CareerEntry.listFrom(map['career']),
      organizations: _asStrings(map['organizations']),
      relationships: RawRelationship.listFrom(map['relationships']),
      links: _asLinks(map['links']),
    );
  }

  @override
  List<Object?> get props => [
    birthDate,
    deathDate,
    birthPlace,
    citizenship.join(','),
    occupations.join(','),
    awards,
    education.join(','),
    notableWorks.join(','),
    career,
    organizations.join(','),
    relationships.length,
    links.toString(),
  ];
}

/// A structured Wikidata relationship row (Step 22). `direction` is from
/// the subject toward the target: OUTGOING, INCOMING, BIDIRECTIONAL, or
/// UNKNOWN. Dates are years, when the claim carries P580/P582.
class RawRelationship extends Equatable {
  const RawRelationship({
    required this.type,
    required this.category,
    required this.direction,
    required this.targetId,
    required this.targetLabel,
    this.start,
    this.end,
    this.sourceUrl,
  });

  final String type;
  final String category;
  final String direction;
  final String targetId;
  final String targetLabel;
  final int? start;
  final int? end;
  final String? sourceUrl;

  static List<RawRelationship> listFrom(Object? raw) {
    if (raw is! List) return const [];
    final out = <RawRelationship>[];
    for (final entry in raw) {
      if (entry is! Map) continue;
      final targetId = _trimOrNull(entry['targetId']);
      final targetLabel = _trimOrNull(entry['targetLabel']);
      if (targetId == null || targetLabel == null) continue;
      out.add(RawRelationship(
        type: _trimOrNull(entry['type']) ?? 'UNKNOWN_DOCUMENTED',
        category: _trimOrNull(entry['category']) ?? 'OTHER',
        direction: _trimOrNull(entry['direction']) ?? 'UNKNOWN',
        targetId: targetId,
        targetLabel: targetLabel,
        start: _asYear(entry['start']),
        end: _asYear(entry['end']),
        sourceUrl: _httpOrNull(entry['sourceUrl']),
      ));
    }
    return out;
  }

  @override
  List<Object?> get props => [type, targetId, start, end];
}

/// One dated step in a career, from Wikidata "position held" (P39) or
/// "employer" (P108). Every entry keeps a source link.
class CareerEntry extends Equatable {
  const CareerEntry({
    this.role,
    this.organization,
    this.location,
    this.start,
    this.end,
    this.sourceName = 'Wikidata',
    this.sourceUrl,
  });

  final String? role;
  final String? organization;
  final String? location;
  final int? start;
  final int? end;
  final String sourceName;
  final String? sourceUrl;

  /// Open-ended — no recorded end date.
  bool get isCurrent => end == null;

  /// "2014 – 2019", "2021 – present", "until 2019", "date unknown".
  /// A one-year span collapses to the single year.
  String get span {
    if (start != null && end != null) {
      return start == end ? '$start' : '$start – $end';
    }
    if (start != null) return isCurrent ? '$start – present' : '$start';
    if (end != null) return 'until $end';
    return 'date unknown';
  }

  /// "Engineer, Company Y" — whatever is known, never blank.
  String get label {
    final parts = [role, organization].whereType<String>().toList();
    return parts.isEmpty ? 'Role' : parts.join(', ');
  }

  static List<CareerEntry> listFrom(Object? raw) {
    if (raw is! List) return const [];

    final out = <CareerEntry>[];
    for (final entry in raw) {
      if (entry is! Map) continue;
      final role = _trimOrNull(entry['role']);
      final org = _trimOrNull(entry['organization']);
      if (role == null && org == null) continue;
      final source = entry['source'];
      out.add(
        CareerEntry(
          role: role,
          organization: org,
          location: _trimOrNull(entry['location']),
          start: _asYear(entry['start']),
          end: _asYear(entry['end']),
          sourceName:
              source is Map
                  ? _trimOrNull(source['name']) ?? 'Wikidata'
                  : 'Wikidata',
          sourceUrl: source is Map ? _httpOrNull(source['url']) : null,
        ),
      );
    }
    out.sort((a, b) {
      final sa = a.start ?? a.end ?? 1 << 30;
      final sb = b.start ?? b.end ?? 1 << 30;
      return sa.compareTo(sb);
    });
    return out;
  }

  @override
  List<Object?> get props => [role, organization, location, start, end];
}

/// Career facts distilled to a few lines. Built from [CareerEntry] rows
/// only — if the rows do not support a line, it is null/empty.
class CareerInsights extends Equatable {
  const CareerInsights({
    this.start,
    this.current,
    this.transitions = const [],
    this.leadershipRoles = const [],
    this.founder = false,
  });

  final String? start;
  final String? current;
  final List<String> transitions;
  final List<String> leadershipRoles;
  final bool founder;

  bool get isEmpty =>
      start == null &&
      current == null &&
      transitions.isEmpty &&
      leadershipRoles.isEmpty &&
      !founder;

  static final RegExp _leadership = RegExp(
    r'\b(chief|ceo|cfo|coo|cto|chair(person|man|woman)?|president|'
    r'managing director|director|head of|founder|owner|partner|principal|'
    r'editor-in-chief|secretary-general|prime minister)\b',
    caseSensitive: false,
  );
  static final RegExp _founder = RegExp(
    r'\b(co[-\s]?)?founder\b|\bfounded\b',
    caseSensitive: false,
  );

  factory CareerInsights._from(List<CareerEntry> rows) {
    if (rows.isEmpty) return const CareerInsights();

    final dated = rows.where((r) => r.start != null).toList();
    CareerEntry? current;
    for (final r in dated.where((r) => r.isCurrent)) {
      if (current == null || (r.start ?? 0) > (current.start ?? 0)) current = r;
    }

    final transitions = <String>[];
    for (var i = 1; i < rows.length; i++) {
      final prev = rows[i - 1];
      final next = rows[i];
      if (prev.organization != null &&
          next.organization != null &&
          prev.organization != next.organization &&
          next.start != null) {
        transitions.add(
          '${next.start} · ${prev.organization} → ${next.organization}',
        );
      }
    }

    final leadership =
        <String>{
          for (final r in rows)
            if (r.role != null && _leadership.hasMatch(r.role!)) r.role!,
        }.toList();

    return CareerInsights(
      start:
          dated.isEmpty ? null : '${dated.first.start} · ${dated.first.label}',
      current:
          current == null ? null : '${current.label} · since ${current.start}',
      transitions: transitions.take(6).toList(),
      leadershipRoles: leadership,
      founder: rows.any((r) => r.role != null && _founder.hasMatch(r.role!)),
    );
  }

  @override
  List<Object?> get props => [
    start,
    current,
    transitions,
    leadershipRoles,
    founder,
  ];
}

String? _trimOrNull(Object? v) =>
    v is String && v.trim().isNotEmpty ? v.trim() : null;

int? _asYear(Object? v) {
  final n = v is int ? v : (v is num ? v.toInt() : int.tryParse('$v'));
  return n != null && n > 1000 && n < 3000 ? n : null;
}

String? _httpOrNull(Object? v) =>
    v is String && RegExp(r'^https?://', caseSensitive: false).hasMatch(v)
        ? v
        : null;

/// A dated award, as recorded on Wikidata.
class Award extends Equatable {
  const Award({required this.label, this.year});

  final String label;

  /// Null when Wikidata records the award but not when it was given.
  /// Undated awards sort last rather than being dropped — the award
  /// still happened.
  final int? year;

  static List<Award> listFrom(Object? raw) {
    if (raw is! List) return const [];

    final out = <Award>[];
    for (final entry in raw) {
      if (entry is! Map) continue;
      final label = entry['label'];
      if (label is! String || label.trim().isEmpty) continue;
      final year = entry['year'];
      out.add(
        Award(
          label: label.trim(),
          year: year is int ? year : (year is num ? year.toInt() : null),
        ),
      );
    }
    return out;
  }

  @override
  List<Object?> get props => [label, year];
}

/// Only `http(s)` survives. Anything else on a profile would be a link
/// the subject did not publish, rendered as though they had.
Map<String, String> _asLinks(Object? raw) {
  if (raw is! Map) return const {};

  final out = <String, String>{};
  for (final entry in raw.entries) {
    final key = entry.key;
    final value = entry.value;
    if (key is! String || value is! String) continue;
    if (!RegExp(r'^https?://', caseSensitive: false).hasMatch(value)) continue;
    out[key] = value;
  }
  return out;
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
