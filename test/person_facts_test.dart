// Facts read from Wikidata, and the precision they are rendered at.
//
// The whole point of F02 is that hard facts come from a structured source
// and only the prose is generated. That is worth nothing if the rendering
// invents precision the source never claimed.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/person_facts.dart';

void main() {
  group('formatPartialDate', () {
    test('renders each precision at exactly that precision', () {
      expect(formatPartialDate('1996-09-01'), '1 September 1996');
      expect(formatPartialDate('1912-06'), 'June 1912');
      expect(formatPartialDate('1856'), '1856');
    });

    test('does not pad a year out to a day', () {
      // Wikidata precision 9 means the year is known and nothing else.
      // "1 January 1856" would state a birthday nobody recorded.
      expect(formatPartialDate('1856'), isNot(contains('January')));
      expect(formatPartialDate('1856'), isNot(contains('1 ')));
    });

    test('returns null for anything it cannot read', () {
      for (final bad in [
        null,
        '',
        'yesterday',
        '96-09-01',
        '1996-13-01',
        '1996-09-32',
        '1996-00',
      ]) {
        expect(formatPartialDate(bad), isNull, reason: 'for "$bad"');
      }
    });
  });

  group('age', () {
    test('is computed only from a full date', () {
      // A year-only birth date gives an age that is wrong for most of the
      // year, and quietly wrong is worse than absent.
      expect(const PersonFacts(birthDate: '1990').age, isNull);
      expect(const PersonFacts(birthDate: '1990-06').age, isNull);
      expect(const PersonFacts(birthDate: '1990-06-15').age, isNotNull);
    });

    test('is withheld for someone with a recorded death', () {
      const dead = PersonFacts(
        birthDate: '1940-10-09',
        deathDate: '1980-12-08',
      );
      expect(dead.age, isNull);
    });

    test('accounts for whether the birthday has passed this year', () {
      final now = DateTime.now();
      final tomorrow = now.add(const Duration(days: 2));

      final beforeBirthday = PersonFacts(
        birthDate:
            '2000-'
            '${tomorrow.month.toString().padLeft(2, '0')}-'
            '${tomorrow.day.toString().padLeft(2, '0')}',
      );

      // Born in 2000, birthday still ahead this year.
      expect(beforeBirthday.age, now.year - 2000 - 1);
    });

    test('rejects an impossible age rather than displaying it', () {
      expect(const PersonFacts(birthDate: '1600-01-01').age, isNull);
      expect(const PersonFacts(birthDate: '3000-01-01').age, isNull);
    });
  });

  group('emptiness', () {
    test('is empty when nothing was found', () {
      expect(PersonFacts.empty.isEmpty, isTrue);
      expect(const PersonFacts().isNotEmpty, isFalse);
    });

    test('is not empty when any single fact is present', () {
      expect(const PersonFacts(birthDate: '1990').isNotEmpty, isTrue);
      expect(const PersonFacts(occupations: ['Actor']).isNotEmpty, isTrue);
      expect(const PersonFacts(citizenship: ['France']).isNotEmpty, isTrue);
    });
  });

  group('fromMap', () {
    test('round-trips', () {
      const facts = PersonFacts(
        birthDate: '1996-09-01',
        deathDate: '2020-01-01',
        citizenship: ['United States'],
        occupations: ['Actor', 'Singer'],
      );
      expect(PersonFacts.fromMap(facts.toMap()), facts);
    });

    test('drops a date that is not an ISO prefix', () {
      // Better no line than a wrong one.
      final f = PersonFacts.fromMap(const {
        'birthDate': '01/09/1996',
        'deathDate': 'unknown',
      });
      expect(f.birthDate, isNull);
      expect(f.deathDate, isNull);
    });

    test('keeps only usable strings in the lists', () {
      final f = PersonFacts.fromMap(const {
        'occupations': ['Actor', '', '  ', 42, null, ' Singer '],
      });
      expect(f.occupations, ['Actor', 'Singer']);
    });

    test('survives null and the wrong shapes entirely', () {
      expect(PersonFacts.fromMap(null), PersonFacts.empty);
      expect(PersonFacts.fromMap(const {}), PersonFacts.empty);
      expect(
        PersonFacts.fromMap(const {'citizenship': 'France'}).citizenship,
        isEmpty,
      );
    });
  });

  group('EntityCandidate', () {
    test('accepts a well-formed candidate', () {
      final c = EntityCandidate.fromMap(const {
        'qid': 'Q41421',
        'label': 'Michael Jordan',
        'description': 'American basketball player',
      });
      expect(c, isNotNull);
      expect(c!.qid, 'Q41421');
    });

    test('rejects anything without a real Wikidata id', () {
      // The qid is sent back to the server to pin resolution, so a
      // malformed one must not get that far.
      for (final bad in [
        {'qid': 'P31', 'label': 'x'},
        {'qid': 'Q', 'label': 'x'},
        {'qid': 'Qabc', 'label': 'x'},
        {'qid': 41421, 'label': 'x'},
        {'label': 'x'},
      ]) {
        expect(EntityCandidate.fromMap(bad), isNull, reason: '$bad');
      }
    });

    test('rejects a candidate with no label to show', () {
      expect(EntityCandidate.fromMap(const {'qid': 'Q1', 'label': ''}), isNull);
      expect(EntityCandidate.fromMap(const {'qid': 'Q1'}), isNull);
    });
  });

  group('expanded record', () {
    test('awards parse with their year and survive a missing one', () {
      final facts = PersonFacts.fromMap({
        'awards': [
          {'label': 'Primetime Emmy', 'year': 2020},
          {'label': 'Unnamed honour'},
        ],
      });

      expect(facts.awards, hasLength(2));
      expect(facts.awards.first.label, 'Primetime Emmy');
      expect(facts.awards.first.year, 2020);
      // An award Wikidata records without a date is still an award.
      expect(facts.awards.last.year, isNull);
    });

    test('award entries missing a label are dropped, not rendered blank', () {
      final facts = PersonFacts.fromMap({
        'awards': [
          {'year': 1999},
          {'label': '   '},
          {'label': 'Real', 'year': 2001},
        ],
      });

      expect(facts.awards.map((a) => a.label), ['Real']);
    });

    test('awards tolerate a malformed payload instead of throwing', () {
      expect(PersonFacts.fromMap({'awards': 'nonsense'}).awards, isEmpty);
      expect(
        PersonFacts.fromMap({
          'awards': [1, 2],
        }).awards,
        isEmpty,
      );
    });

    test('birthPlace, education and sourced works are read', () {
      final facts = PersonFacts.fromMap({
        'birthPlace': 'Oakland',
        'education': ['Oakland School for the Arts'],
        'notableWorks': ['Euphoria'],
      });

      expect(facts.birthPlace, 'Oakland');
      expect(facts.education, ['Oakland School for the Arts']);
      expect(facts.notableWorks, ['Euphoria']);
    });

    test('only http(s) links survive', () {
      final facts = PersonFacts.fromMap({
        'links': {
          'website': 'https://example.com',
          'x': 'http://x.com/someone',
          // A profile must never render a script URL as the subject's
          // own site.
          'evil': 'javascript:alert(1)',
          'bad': 'ftp://example.com',
          'wrong': 42,
        },
      });

      expect(facts.links.keys, containsAll(['website', 'x']));
      expect(facts.links.containsKey('evil'), isFalse);
      expect(facts.links.containsKey('bad'), isFalse);
      expect(facts.links.containsKey('wrong'), isFalse);
    });

    test('a record with only expanded fields is not reported as empty', () {
      expect(PersonFacts.fromMap({'birthPlace': 'Oakland'}).isEmpty, isFalse);
      expect(
        PersonFacts.fromMap({
          'awards': [
            {'label': 'Emmy'},
          ],
        }).isEmpty,
        isFalse,
      );
      expect(PersonFacts.fromMap({}).isEmpty, isTrue);
    });
  });
}
