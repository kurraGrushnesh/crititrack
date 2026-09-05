// Change Detection's snapshot comparison — regression tests confirm
// noise (ordering, formatting, timestamps) never fires an event, and
// that popularity/attention never gets reframed as controversy.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/changes.dart';

CareerEntry careerEntry({
  String? role = 'Analyst',
  String? organization = 'Firm A',
  int? start = 2020,
  String? sourceUrl = 'https://www.wikidata.org/wiki/Q1',
}) => CareerEntry(
  role: role,
  organization: organization,
  start: start,
  end: null,
  sourceName: 'Wikidata',
  sourceUrl: sourceUrl,
);

Controversy controversy({
  String title = 'Fraud allegations',
  int severity = 4,
  String status = ControversyStatus.ongoing,
  List<String> sources = const ['https://reuters.com/1'],
}) => Controversy(
  title: title,
  summary: 'The executive was accused of misrepresenting finances.',
  category: ControversyCategory.financial,
  severity: severity,
  status: status,
  year: 2024,
  sources: sources,
);

MediaItem media({
  String id = 'm1',
  String title = 'Story',
  String url = 'https://reuters.com/story-1',
  String? source = 'Reuters',
  MediaType type = MediaType.news,
  DateTime? publishedAt,
}) => MediaItem(
  id: id,
  type: type,
  title: title,
  url: url,
  source: source,
  publishedAt: publishedAt ?? DateTime.utc(2026, 1, 1),
);

Celebrity celebrity({
  List<CareerEntry> career = const [],
  List<String> organizations = const [],
  List<Controversy> controversies = const [],
  List<MediaItem> media = const [],
  String profession = 'Executive',
  String summary = 'Jane Doe is an executive.',
  double sentimentScore = 50,
  int? sampleSize = 50,
  double? confidence = 0.8,
  List<EntityCandidate> candidates = const [],
}) => Celebrity(
  slug: 'jane-doe',
  name: 'Jane Doe',
  candidates: candidates,
  biography: Biography(
    profession: profession,
    summary: summary,
    background: '',
    notableWorks: const [],
    controversies: controversies,
  ),
  sentimentData: SentimentData(
    overallScore: sentimentScore,
    positiveRatio: 0.3,
    negativeRatio: 0.3,
    neutralRatio: 0.4,
    trendDirection: 'stable',
    explanation: '',
    trendData: const [],
    dominantEmotion: 'neutral',
    sampleSize: sampleSize,
    confidence: confidence,
  ),
  mediaItems: media,
  fetchedAt: DateTime.utc(2026, 9, 5),
  facts: PersonFacts(career: career, organizations: organizations),
);

void main() {
  setUp(resetChangeIdCounter);

  group('scenario 1 & 2: nothing to compare / no changes', () {
    test('comparing a celebrity against itself produces nothing', () {
      final c = celebrity();
      expect(detectChanges(c, c, c.fetchedAt), isEmpty);
    });

    test('reordered career entries never fire a change', () {
      final a = careerEntry(role: 'Analyst');
      final b = careerEntry(role: 'Manager', start: 2022);
      final before = celebrity(career: [a, b]);
      final after = celebrity(career: [b, a]);
      expect(detectChanges(before, after, after.fetchedAt), isEmpty);
    });
  });

  group('scenario 3 & 4: new controversy vs. new article about an existing one', () {
    test('scenario 3: a genuinely new controversy fires controversyChange', () {
      final before = celebrity(controversies: const []);
      final after = celebrity(controversies: [controversy()]);
      final events = detectChanges(before, after, after.fetchedAt);
      final c = events.firstWhere((e) => e.changeType == ChangeType.controversyChange);
      expect(c.title, contains('New supported controversy'));
      expect(c.severity, ChangeSeverity.major);
    });

    test('scenario 4: a new article about an already-tracked controversy is not a new controversy or a news event', () {
      final existing = controversy();
      final before = celebrity(
        controversies: [existing],
        media: [media(id: 'm1', url: 'https://reuters.com/story-1', title: 'Fraud allegations reported')],
      );
      final after = celebrity(
        controversies: [existing],
        media: [
          media(id: 'm1', url: 'https://reuters.com/story-1', title: 'Fraud allegations reported'),
          media(id: 'm2', url: 'https://apnews.com/story-2', title: 'More on the fraud allegations', source: 'AP'),
        ],
      );
      final events = detectChanges(before, after, after.fetchedAt);
      expect(events.any((e) => e.changeType == ChangeType.newsChange), isFalse);
      final controversyEvents = events.where((e) => e.changeType == ChangeType.controversyChange);
      expect(controversyEvents.every((e) => e.title.contains('New supporting evidence')), isTrue);
    });
  });

  group('scenario 5: new career role', () {
    test('a new sourced role fires careerChange with high confidence', () {
      final before = celebrity(career: const []);
      final after = celebrity(career: [careerEntry(role: 'CEO', organization: 'Acme')]);
      final events = detectChanges(before, after, after.fetchedAt);
      final c = events.firstWhere((e) => e.changeType == ChangeType.careerChange);
      expect(c.title, contains('CEO at Acme'));
      expect(c.confidence, ChangeConfidence.high);
    });

    test('an unsourced role surfaces at low confidence', () {
      final before = celebrity(career: const []);
      final after = celebrity(career: [careerEntry(role: 'Advisor', organization: 'Startup X', sourceUrl: null)]);
      final events = detectChanges(before, after, after.fetchedAt);
      final c = events.firstWhere((e) => e.changeType == ChangeType.careerChange);
      expect(c.confidence, ChangeConfidence.low);
    });
  });

  group('scenario 6 & 7: sentiment shift with vs. without enough data', () {
    test('scenario 6: a band shift with a healthy sample fires a real sentimentChange', () {
      final before = celebrity(sentimentScore: 70, sampleSize: 100);
      final after = celebrity(sentimentScore: 20, sampleSize: 120, confidence: 0.8);
      final events = detectChanges(before, after, after.fetchedAt);
      final s = events.firstWhere((e) => e.changeType == ChangeType.sentimentChange);
      expect(s.currentValue, 'Negative');
      expect(s.summary, isNot(contains('insufficient')));
    });

    test('scenario 7: a band shift with a tiny sample reads honestly insufficient', () {
      final before = celebrity(sentimentScore: 70, sampleSize: 100);
      final after = celebrity(sentimentScore: 20, sampleSize: 3);
      final events = detectChanges(before, after, after.fetchedAt);
      final s = events.firstWhere((e) => e.changeType == ChangeType.sentimentChange);
      expect(s.summary, 'Sentiment data insufficient to determine a meaningful change.');
      expect(s.confidence, ChangeConfidence.low);
    });

    test('no sentiment sample -> no event manufactured', () {
      final before = celebrity(sentimentScore: 70, sampleSize: 100);
      final after = celebrity(sentimentScore: 20, sampleSize: null);
      expect(
        detectChanges(before, after, after.fetchedAt).any((e) => e.changeType == ChangeType.sentimentChange),
        isFalse,
      );
    });
  });

  group('scenario 9: CritiScore change uses the real deterministic formula', () {
    test('adding a severe new episode raises the score and explains why', () {
      final before = celebrity(controversies: const []);
      final after = celebrity(controversies: [controversy(severity: 5)]);
      final events = detectChanges(before, after, after.fetchedAt);
      final s = events.firstWhere((e) => e.changeType == ChangeType.critiscoreChange);
      expect(int.parse(s.currentValue!), greaterThan(int.parse(s.previousValue!)));
      expect(s.summary, contains('newly supported episode'));
      expect(s.severity, ChangeSeverity.major);
    });

    test('no controversy change -> no CritiScore change event', () {
      final c = celebrity(controversies: [controversy()]);
      expect(
        detectChanges(c, c, c.fetchedAt).any((e) => e.changeType == ChangeType.critiscoreChange),
        isFalse,
      );
    });
  });

  group('scenario 10: provider failure reads as data-availability, never as reduced activity', () {
    test('YouTube data disappearing never reads as "activity dropped"', () {
      final before = celebrity(
        media: [media(id: 'y1', type: MediaType.youtube, source: 'Channel A')],
      );
      final after = celebrity(media: const []);
      final events = detectChanges(before, after, after.fetchedAt);
      final a = events.firstWhere(
        (e) => e.changeType == ChangeType.dataAvailabilityChange && e.title.contains('YouTube'),
      );
      expect(a.title, isNot(matches(RegExp(r'disappeared|dropped', caseSensitive: false))));
      expect(a.summary, contains('no usable data'));
    });
  });

  group('scenario 11: duplicate/syndicated news never inflates into multiple events', () {
    test('re-seeing the same URL is not a new article', () {
      final shared = media(id: 'm1', url: 'https://reuters.com/story-1');
      final before = celebrity(media: [shared]);
      final after = celebrity(media: [shared]);
      expect(
        detectChanges(before, after, after.fetchedAt).any((e) => e.changeType == ChangeType.newsChange),
        isFalse,
      );
    });

    test('a single new single-source article is noise, not an event', () {
      final before = celebrity(media: const []);
      final after = celebrity(media: [media(id: 'solo', title: 'A minor mention')]);
      expect(
        detectChanges(before, after, after.fetchedAt).any((e) => e.changeType == ChangeType.newsChange),
        isFalse,
      );
    });

    test('two independent publishers on one real event -> one grouped newsChange', () {
      final before = celebrity(media: const []);
      final after = celebrity(
        media: [
          media(id: 'a', title: 'Company X announces acquisition of Y', source: 'Reuters'),
          media(id: 'b', title: 'Company X announces acquisition of Y deal', source: 'AP'),
        ],
      );
      final events = detectChanges(before, after, after.fetchedAt).where((e) => e.changeType == ChangeType.newsChange);
      expect(events, hasLength(1));
      expect(events.first.evidenceIds, hasLength(2));
    });
  });

  group('scenario 12: conflicting evidence surfaces as a claim status change', () {
    test('a claim moving toward conflicting reports real evidence ids', () {
      final before = celebrity(
        controversies: [controversy()],
        media: [media(id: 'm1', url: 'https://reuters.com/story-1', title: 'Fraud allegations reported')],
      );
      final after = celebrity(
        controversies: [controversy()],
        media: [
          media(id: 'm1', url: 'https://reuters.com/story-1', title: 'Fraud allegations reported'),
          media(
            id: 'm2',
            url: 'https://apnews.com/story-2',
            title: 'Charges dropped in fraud allegations case',
            source: 'AP',
          ),
        ],
      );
      final events = detectChanges(before, after, after.fetchedAt);
      final claimEvent = events.where((e) => e.changeType == ChangeType.claimChange);
      expect(claimEvent, isNotEmpty);
      expect(claimEvent.first.currentValue, 'conflicting');
      expect(claimEvent.first.evidenceIds, isNotEmpty);
    });
  });

  group('formatting-only / noise changes never fire', () {
    test('whitespace-only summary rewording is ignored', () {
      final before = celebrity(summary: 'Jane Doe   is an executive.');
      final after = celebrity(summary: 'Jane doe is an executive.');
      expect(detectChanges(before, after, after.fetchedAt), isEmpty);
    });
  });

  group('filterChanges', () {
    test('separates change types into the documented filter buckets', () {
      final events = [
        ChangeEvent(
          changeId: '1',
          entityId: 'x',
          changeType: ChangeType.careerChange,
          severity: ChangeSeverity.minor,
          title: 't',
          summary: 's',
          previousValue: null,
          currentValue: null,
          detectedAt: DateTime.utc(2026, 9, 5),
          effectiveDate: null,
          evidenceIds: const [],
          relatedClaimIds: const [],
          methodologyVersion: '1.0',
          confidence: ChangeConfidence.high,
          sourceCoverage: null,
        ),
      ];
      expect(filterChanges(events, ChangeFilter.career), hasLength(1));
      expect(filterChanges(events, ChangeFilter.score), isEmpty);
      expect(filterChanges(events, ChangeFilter.all), hasLength(1));
    });
  });

  group('no change event ever leaks popularity language', () {
    test('a rich diff never mentions followers/upvotes/trending', () {
      final before = celebrity(controversies: const [], career: const []);
      final after = celebrity(
        controversies: [controversy()],
        career: [careerEntry()],
        sentimentScore: 10,
        sampleSize: 200,
      );
      final events = detectChanges(before, after, after.fetchedAt);
      for (final e in events) {
        final text = '${e.title} ${e.summary}'.toLowerCase();
        expect(text, isNot(matches(RegExp(r'follower|upvote|trending|view count'))));
      }
    });
  });

  group('scenario 4: profession change', () {
    test('a real profession change fires professionChange with the actual before/after', () {
      final before = celebrity(profession: 'Software Engineer');
      final after = celebrity(profession: 'Chief Technology Officer');
      final events = detectChanges(before, after, after.fetchedAt);
      final p = events.firstWhere((e) => e.changeType == ChangeType.professionChange);
      expect(p.previousValue, 'Software Engineer');
      expect(p.currentValue, 'Chief Technology Officer');
      expect(p.confidence, ChangeConfidence.high);
    });

    test('case-only / whitespace-only profession differences are ignored', () {
      final before = celebrity(profession: 'Executive');
      final after = celebrity(profession: 'executive ');
      expect(detectChanges(before, after, after.fetchedAt), isEmpty);
    });
  });

  group('scenario 5: organization change', () {
    test('joining a new organization fires its own organizationChange', () {
      final before = celebrity(organizations: const ['Firm A']);
      final after = celebrity(organizations: const ['Firm A', 'Firm B']);
      final events = detectChanges(before, after, after.fetchedAt);
      final o = events.firstWhere(
        (e) => e.changeType == ChangeType.organizationChange && e.title.contains('New organization'),
      );
      expect(o.currentValue, 'Firm B');
    });

    test('leaving an organization fires its own organizationChange', () {
      final before = celebrity(organizations: const ['Firm A', 'Firm B']);
      final after = celebrity(organizations: const ['Firm A']);
      final events = detectChanges(before, after, after.fetchedAt);
      final o = events.firstWhere(
        (e) => e.changeType == ChangeType.organizationChange && e.title.contains('No longer listed'),
      );
      expect(o.previousValue, 'Firm B');
    });
  });

  group('scenario 15: profile metadata change', () {
    test('a genuine summary rewrite fires profileChange', () {
      final before = celebrity(summary: 'Jane Doe is a software engineer.');
      final after = celebrity(summary: 'Jane Doe is now a company director.');
      final events = detectChanges(before, after, after.fetchedAt);
      expect(events.any((e) => e.changeType == ChangeType.profileChange), isTrue);
    });
  });

  group('scenario 17: data coverage change (not an availability failure)', () {
    test('news coverage improving reads as sourceCoverageChange, not dataAvailabilityChange', () {
      final before = celebrity(media: [media(id: '1', source: 'OnlyOutlet')]);
      final after = celebrity(
        media: List.generate(60, (i) => media(id: '$i', source: 'Publisher ${i % 6}')),
      );
      final events = detectChanges(before, after, after.fetchedAt);
      expect(
        events.any((e) => e.changeType == ChangeType.sourceCoverageChange && e.title.startsWith('News')),
        isTrue,
      );
      expect(
        events.any((e) => e.changeType == ChangeType.dataAvailabilityChange && e.title.startsWith('News')),
        isFalse,
      );
    });
  });

  group('scenario 22: ambiguous entity resolution never produces changes', () {
    const someone = EntityCandidate(qid: 'Q2', label: 'Someone Else');

    test('candidates offered on either snapshot suppresses the whole comparison', () {
      final before = celebrity(controversies: const [], candidates: const [someone]);
      final after = celebrity(controversies: [controversy()]);
      expect(detectChanges(before, after, after.fetchedAt), isEmpty);
    });

    test('an unambiguous pair on both sides still produces real changes', () {
      final before = celebrity(controversies: const []);
      final after = celebrity(controversies: [controversy()]);
      expect(detectChanges(before, after, after.fetchedAt), isNotEmpty);
    });
  });

  group('scenario 24: repeated comparisons of the same pair are deterministic', () {
    test('calling detectChanges twice on identical snapshots yields the same change types both times', () {
      final before = celebrity(controversies: const []);
      final after = celebrity(controversies: [controversy()]);
      final first = detectChanges(before, after, after.fetchedAt).map((e) => e.changeType).toList()..sort(
        (a, b) => a.index.compareTo(b.index),
      );
      final second = detectChanges(before, after, after.fetchedAt).map((e) => e.changeType).toList()..sort(
        (a, b) => a.index.compareTo(b.index),
      );
      expect(second, first);
    });
  });
}
