# Sentiment benchmark

Scores a labelled set with each method and reports accuracy, macro-F1 and
latency, so "the ensemble beats a single LLM call" can be a number rather
than a claim.

```bash
node benchmark/run.js                                  # the two lexicons
GROQ_API_KEY=$(grep '^GROQ_API_KEY=' .secret.local | cut -d= -f2-) \
  node benchmark/run.js                                # adds LLM + ensemble
```

Results are written to `benchmark/results.json`.

## The committed run

No `GROQ_API_KEY` was available, so **the LLM and full-ensemble rows are
absent rather than estimated**:

| method              | scored | skipped | accuracy | macro-F1 | ms/item |
|---------------------|-------:|--------:|---------:|---------:|--------:|
| lexicon             |     40 |       0 |    0.800 |    0.800 |    0.10 |
| domain              |     17 |      23 |    1.000 |    0.667 |    0.05 |
| lexicon + domain    |     40 |       0 |    0.850 |    0.849 |    0.15 |

### How to read these

**`domain` did not score 100%.** It abstains on headlines with no
reputational vocabulary, so it answered 17 of 40 and got those 17 right.
That is a statement about a subset it chose for itself. Its macro-F1 of
0.667 is the honest figure: it never predicts `neutral` — it abstains
instead — so one of three classes scores zero.

**The blend's gain is inside the noise.** Accuracy went from 0.800 to
0.850 on **40 items**, which is two more correct answers. That is not
evidence of anything. The direction matches what the design predicts, and
the per-class detail is mildly encouraging — the negative class improves
most (F1 0.800 → 0.923), which is where a reputation lexicon should help —
but a 40-item set cannot distinguish a real gain from a coin flip.

**The acceptance criterion is not met.** F04 is done when "the published
benchmark shows the ensemble beating a single LLM call". This run does not
contain a single-LLM arm, so it shows no such thing. What is now in place
is the harness, the third method, and both arms wired to be measured the
moment a key and a real labelled set exist.

## Why these numbers are not publishable

They come from a 40-item *seed* set of deliberately unambiguous headlines,
written to prove the harness runs end to end and to catch regressions.
Clean examples flatter every method, and they flatter a blend most,
because members rarely disagree on an easy case — and disagreement is the
entire mechanism a blend is supposed to exploit.

There is a second hazard now that a method has been added: the reputation
lexicon's terms were written from domain reasoning rather than from the
labelled items, but measuring a new method on the same small set it might
have been shaped by is how a benchmark quietly becomes a training set. The
set must be replaced before the number means anything.

## Making it defensible

1. **Draw 300–500 real headlines** from coverage the app actually
   retrieved — `celebrities/{slug}/media_items` once the scheduler has
   been running — rather than written examples. Real coverage is
   ambiguous, sarcastic and context-dependent in ways an invented set is
   not.
2. **Label them blind.** Do not look at any model's output first. Seeing a
   prediction before assigning a label contaminates the label.
3. **Include the hard cases.** Sarcasm, quoted criticism of someone else,
   neutral reporting of a negative event, "X denies allegations". These
   are where methods diverge, and where a blend either earns its cost or
   does not.
4. **Hold the set out.** Never tune thresholds against it. The bands now
   come from `tagFor` in `lib/sentiment/ensemble.js` rather than a copy
   inside the harness, precisely so that "improving the benchmark" and
   "changing the product" cannot come apart.
5. **Re-run with a key and commit `results.json`.** Report the figure
   honestly, including where the ensemble loses. An honest six-point gain
   is far more persuasive than a claimed twenty, and far harder to argue
   with.

## The three methods

| member    | what it measures | cost | independent of |
|-----------|------------------|------|----------------|
| `lexicon` | general emotional valence (VADER) | free | the other two |
| `domain`  | reputational direction | free | the other two |
| `llm`     | context, irony, who the subject is | paid | the lexicons |

The middle slot was previously named `transformer`, weighted 0.4, and
never filled by anything — so the ensemble documented three methods while
running two, and the weights silently renormalised to lexicon 0.33 / LLM
0.67. It now holds a reputation lexicon and is named for what it is.

The two lexicons genuinely disagree, which is the point. On *"Cleared of
all charges after two-year investigation"* VADER sees "charges" and
"investigation" and reads negative; the reputation lexicon sees "cleared"
and reads positive. That disagreement is what the confidence band is
computed from, and it is pinned by a test in `test/domain.test.js` rather
than left as an assertion here.
