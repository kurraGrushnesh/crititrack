# Sentiment benchmark

Scores a labelled set with each method and reports accuracy, macro-F1 and
latency, so "the ensemble beats a single LLM call" is a number rather than
a claim.

```bash
node benchmark/run.js                                  # lexicon only
GROQ_API_KEY=$(grep '^GROQ_API_KEY=' .secret.local | cut -d= -f2-) \
  node benchmark/run.js                                # all three methods
```

Results are written to `benchmark/results.json`.

## Read the current numbers with care

The committed run looks like this:

| method   | accuracy | macro-F1 | ms/item |
|----------|---------:|---------:|--------:|
| lexicon  |    0.800 |    0.800 |    0.13 |
| llm      |    0.850 |    0.850 |  136.75 |
| ensemble |    0.975 |    0.975 |  136.88 |

**These are not publishable figures, and they should not be quoted as if
they were.** They come from a 40-item *seed* set of deliberately
unambiguous headlines, written to prove the harness runs end to end and to
catch regressions. Clean examples flatter every method, and they flatter
the ensemble most, because the two members rarely disagree on an easy case.

What the run does legitimately show:

- The harness works end to end and the numbers are reproducible.
- Blending helps rather than hurts — the ensemble is above both members,
  which is the behaviour the design predicts.
- The lexicon costs nothing and is roughly a thousand times faster, which
  is why it carries the volume and the LLM runs once per batch.

## Making it defensible

The gap between this and a figure worth publishing is one afternoon:

1. **Draw 300–500 real headlines** from coverage the app actually
   retrieved — `celebrities/{slug}/media_items` in Firestore once the
   scheduler has been running — rather than written examples. Real
   coverage is ambiguous, sarcastic and context-dependent in ways an
   invented set is not.
2. **Label them blind.** Do not look at any model's output first. Seeing a
   prediction before assigning a label contaminates the label.
3. **Include the hard cases.** Sarcasm, quoted criticism of someone else,
   neutral reporting of a negative event, "X denies allegations". These
   are where methods diverge, and where the ensemble either earns its cost
   or does not.
4. **Hold the set out.** Never tune thresholds against it. If
   `POSITIVE_AT` or `NEGATIVE_BELOW` in `run.js` get adjusted until the
   number improves, the number stops meaning anything.
5. **Re-run and commit `results.json`.** Report the figure honestly,
   including where the ensemble loses. An honest 6-point gain is far more
   persuasive than a claimed 20 — and far harder to argue with.

## Adding the transformer

The design calls for three members. The third — a fine-tuned classifier
such as `twitter-roberta-base-sentiment` behind an inference endpoint —
is not wired up, because it needs an API token this project does not have.
`blendItem` already accepts a `transformer` score and renormalises the
weights over whichever members are present, so adding it is a matter of
supplying the scores.
