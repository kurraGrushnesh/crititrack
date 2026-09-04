// Widget tests for the mobile Claim Verification Matrix.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/evidence.dart';
import 'package:crititrack/features/controversy/presentation/widgets/claims_matrix.dart';

Widget host(Widget child) => MaterialApp(
  theme: AppTheme.darkTheme,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

EvidenceItem ev(String id, {String title = 'Star faces new allegations'}) =>
    EvidenceItem(
      evidenceId: id,
      sourceUrl: 'https://reuters.com/$id',
      sourceName: 'Reuters',
      sourceType: SourceType.news,
      title: title,
      publicationDate: '2024-01-01',
      snippet: null,
      category: EvidenceCategory.controversy,
      relatedControversies: const ['New allegations'],
      relatedToSentiment: false,
      duplicateCount: 1,
      independentSourceCount: 3,
      evidenceStrength: EvidenceStrength.strong,
      strengthReason: '3 independent publishers reported it',
    );

void main() {
  testWidgets('renders nothing when there are no claims for this controversy', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(const ClaimsMatrix(claims: [], evidenceItems: [])),
    );
    expect(find.text('CLAIMS'), findsNothing);
  });

  testWidgets('shows a claim card with status and confidence, expandable', (
    tester,
  ) async {
    const claim = Claim(
      claimId: 'new-allegations-base',
      entityId: null,
      controversyId: 'new-allegations',
      timelineEventId: null,
      claimText: 'Person was accused of misconduct.',
      claimType: ClaimType.allegation,
      dateContext: '2024-01-01',
      status: ClaimStatus.supported,
      confidence: ClaimConfidence.high,
      supportingEvidenceIds: ['media-1'],
      contradictingEvidenceIds: [],
      neutralEvidenceIds: [],
      responseEvidenceIds: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      methodologyVersion: 'cvm-1',
      statusReason: '3 independently reporting sources support this claim.',
    );

    await tester.pumpWidget(
      host(ClaimsMatrix(claims: const [claim], evidenceItems: [ev('media-1')])),
    );

    expect(find.text('CLAIMS'), findsOneWidget);
    expect(find.text('Person was accused of misconduct.'), findsOneWidget);
    expect(find.text('Supported by available evidence'), findsOneWidget);
    expect(find.text('High confidence'), findsOneWidget);

    await tester.tap(find.text('Person was accused of misconduct.'));
    await tester.pumpAndSettle();
    expect(
      find.text('3 independently reporting sources support this claim.'),
      findsOneWidget,
    );

    await tester.tap(find.textContaining('View evidence'));
    await tester.pumpAndSettle();
    expect(find.text('Supporting (1)'), findsOneWidget);
    expect(find.text('Star faces new allegations'), findsOneWidget);
  });

  testWidgets('the evidence sheet is honest when nothing is found', (
    tester,
  ) async {
    const claim = Claim(
      claimId: 'x-base',
      entityId: null,
      controversyId: 'x',
      timelineEventId: null,
      claimText: 'Reported event with no retrieved source.',
      claimType: ClaimType.reportedEvent,
      dateContext: null,
      status: ClaimStatus.insufficientEvidence,
      confidence: ClaimConfidence.low,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      neutralEvidenceIds: [],
      responseEvidenceIds: [],
      createdAt: null,
      updatedAt: null,
      methodologyVersion: 'cvm-1',
      statusReason: 'No supporting evidence currently available.',
    );

    await tester.pumpWidget(
      host(const ClaimsMatrix(claims: [claim], evidenceItems: [])),
    );

    await tester.tap(find.text('Reported event with no retrieved source.'));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('View evidence'));
    await tester.pumpAndSettle();

    expect(find.text('No supporting source found.'), findsOneWidget);
  });

  testWidgets('filter chips narrow the visible claims', (tester) async {
    const supported = Claim(
      claimId: 'a-base',
      entityId: null,
      controversyId: 'a',
      timelineEventId: null,
      claimText: 'Supported claim text.',
      claimType: ClaimType.reportedEvent,
      dateContext: null,
      status: ClaimStatus.supported,
      confidence: ClaimConfidence.high,
      supportingEvidenceIds: ['m1'],
      contradictingEvidenceIds: [],
      neutralEvidenceIds: [],
      responseEvidenceIds: [],
      createdAt: null,
      updatedAt: null,
      methodologyVersion: 'cvm-1',
      statusReason: 'reason',
    );
    const denial = Claim(
      claimId: 'a-response-0',
      entityId: null,
      controversyId: 'a',
      timelineEventId: null,
      claimText: 'Denial claim text.',
      claimType: ClaimType.denial,
      dateContext: null,
      status: ClaimStatus.reportedUncorroborated,
      confidence: ClaimConfidence.low,
      supportingEvidenceIds: ['m2'],
      contradictingEvidenceIds: [],
      neutralEvidenceIds: [],
      responseEvidenceIds: ['m2'],
      createdAt: null,
      updatedAt: null,
      methodologyVersion: 'cvm-1',
      statusReason: 'reason',
    );

    await tester.pumpWidget(
      host(
        const ClaimsMatrix(claims: [supported, denial], evidenceItems: []),
      ),
    );

    expect(find.text('Supported claim text.'), findsOneWidget);
    expect(find.text('Denial claim text.'), findsOneWidget);

    await tester.tap(find.text('Responses'));
    await tester.pumpAndSettle();

    expect(find.text('Supported claim text.'), findsNothing);
    expect(find.text('Denial claim text.'), findsOneWidget);
  });
}
