/// Category catalogue models.
///
/// The twin of `site/lib/catalog.ts`. Both hold only verifiable public
/// facts — a name, the field a person is known for, a neutral descriptor,
/// an approximate birth year. Nothing here is a score, a claim, or an
/// allegation. When a profile is opened the real API is queried and
/// returns the sourced, confidence-rated, evidence-linked data.
///
/// Per-category ordering is editorial prominence, never a controversy
/// ranking, and every screen that shows it says so.
library;

import 'package:equatable/equatable.dart';

class FigureCategory extends Equatable {
  const FigureCategory({
    required this.slug,
    required this.label,
    required this.blurb,
  });

  final String slug;
  final String label;

  /// One neutral sentence about who the category covers.
  final String blurb;

  @override
  List<Object?> get props => [slug];
}

class RosterEntry extends Equatable {
  const RosterEntry({
    required this.name,
    required this.category,
    required this.descriptor,
    required this.born,
  });

  final String name;
  final String category;

  /// A neutral, factual descriptor. No evaluation.
  final String descriptor;

  /// Approximate birth year, for the decade filter.
  final int born;

  int get decade => (born ~/ 10) * 10;

  @override
  List<Object?> get props => [name];
}
