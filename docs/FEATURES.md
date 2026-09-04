# CritiTrack — Phase 6 feature guide

Twenty features shipped in one batch (branch `feature/roadmap-batch`,
merged to `main`). Each entry says **what it does**, **how to use it**,
and **where it lives** in the code.

Backend endpoints run on Render (`crititrack-api.onrender.com`); the site
is the Next.js static export at `crititrack-f7430.web.app`.

---

## Data & backend

### 1. Scheduled refresh

**What** — A GitHub Actions job (`.github/workflows/refresh.yml`) calls
`POST /refresh` twice a day. Each run re-assembles up to 10 recently
looked-up figures and writes **one measured sentiment snapshot** per
figure. That accumulating history is what turns the trend chart from a
single measured day into a real line, and it is what lets server-side
spike alerts fire.

**How to use** — Set a repository secret `REFRESH_SECRET` matching the
`REFRESH_SECRET` environment variable on the Render service. The workflow
runs on its own after that; trigger one by hand from the Actions tab with
**Run workflow**.

**Where** — `functions/lib/handlers.js` (`runScheduledRefresh`),
`functions/lib/store.js`, `.github/workflows/refresh.yml`.

### 2. Trending rail

**What** — `GET /trending` (public, no login) returns the figures people
on this deployment have searched for most, ranked by the `requestCount`
the scheduler already maintains. It is the honest form of a "trending"
list — it measures real look-ups, not a hand-picked set — so it is empty
until searches accumulate.

**How to use** — Open the home page. The **"Most searched here"** rail
appears below the categories once there is data, each card linking to
that figure's live profile. Call `GET /trending?limit=12` directly for
the raw list.

**Where** — `functions/lib/handlers.js` (`handleTrending`),
`site/lib/trending.ts`, `site/components/TrendingRail.tsx`.

### 3. Reddit as a coverage source

**What** — Alongside GDELT, NewsAPI and YouTube, each profile now pulls
recent Reddit threads about the figure (keyless public search JSON).
Threads are deduplicated into the media feed and scored like any other
item.

**How to use** — Nothing to configure. Reddit items show in the **Media
coverage** feed with an `r/<subreddit>` source label.

**Where** — `functions/lib/media.js` (`fetchReddit`),
`functions/lib/assemble.js`.

### 4. Reliability-weighted sentiment

**What** — The sentiment aggregate no longer treats every source
equally. A wire service (Reuters, AP, BBC…) counts more than an unknown
blog; a routinely-unreliable tabloid (Daily Mail, The Sun, TMZ…) and a
Reddit thread count **less** than an unknown blog. Discussion can never
outweigh reporting.

**How to use** — Automatic. The **Sentiment analysis** section's score
and confidence band already reflect it.

**Where** — `functions/lib/sentiment/reach.js`.

### 5. Weekly digest

**What** — Every Monday a GitHub Actions job calls `POST /digest`, which
sends each device registered for alerts **one** push notification
summarising how the figures it follows moved over the week. A quiet week
(no figure moved) sends nothing.

**How to use** — Same `REFRESH_SECRET` as the refresh job. The
`.github/workflows/digest.yml` workflow handles the schedule.

**Where** — `functions/lib/digest.js`,
`functions/lib/handlers.js` (`runWeeklyDigest`).

### 6. Figure timeline

**What** — One dated axis merging three things that were previously in
separate sections: recorded controversies, days when Wikipedia attention
spiked, and days when the sentiment score jumped or dropped sharply. An
attention spike is shown **unsigned** — people looked, with no direction
implied.

**How to use** — Open any profile with dated events. A **"Timeline"**
section appears, most-recent-first. A year-only controversy shows as the
year, never a false "1 January".

**Where** — `functions/lib/timeline.js`, `site/lib/timeline.ts`,
`site/components/FigureTimeline.tsx`.

### 9. Topical media classification

**What** — Each media item is tagged with a coarse topic — **legal,
financial, political, personal, professional,** or **other** — from
high-precision keyword patterns (a "fraud lawsuit" is legal, not
financial).

**How to use** — In the **Media coverage** section, use the topic chips
to narrow the feed to one kind of coverage. "All topics" clears the
filter.

**Where** — `functions/lib/media.js` (`classifyTopic`),
`site/lib/api.ts` (`filterMediaByTopic`),
`site/components/MediaCoverage.tsx`.

### 14. Subject response on corrections

**What** — The "report a correction" form now has a **"Who are you?"**
choice: a third party reporting something wrong, **or** the profile's
subject (or their representative) responding to a claim. A subject
response is stored the same way; a moderator can attach it so it shows
inline on the profile.

**How to use** — Open **Report a correction** from any profile, pick the
second option, and fill in the claim you are responding to and your
response.

**Where** — `functions/lib/correction.js`, `site/lib/correction.ts`,
`lib/core/security/correction.dart` (the three validators stay in sync),
`site/components/CorrectionForm.tsx`.

### 16. Archive links

**What** — Every cited source URL gets a one-click **Wayback Machine**
link, so an article that has since been pulled or moved is still
reachable. No snapshot is created at assembly time — the link resolves to
the latest capture the Archive holds (or its "save this page" flow).

**How to use** — In the **Media coverage** feed, each card shows a
**"· archived"** link next to the source and date.

**Where** — `functions/lib/archive.js`, `site/components/MediaCoverage.tsx`.

---

## Reading the data

### 7. "Explain this score" — Controversy Index

**What** — A collapsible panel that shows the arithmetic behind the
Controversy Index: for each episode, its severity base, recency
multiplier, and unresolved multiplier, plus that episode's share of the
final points. The rows sum to the score. Nothing here is a model output.

**How to use** — On a profile, under the Controversy Index ring, click
**"How this score was computed"**.

**Where** — `site/lib/controversy-index.ts` (`explainControversyIndex`),
`site/components/IndexExplanation.tsx`.

### 10. Search within a figure's coverage

**What** — A keyword box that filters the media feed the page already
holds — no new request. Accent- and case-insensitive; every whitespace
term must appear in the item's title, description or source.

**How to use** — In **Media coverage**, type in **"Search this
coverage…"**. Combine it with the topic chips.

**Where** — `site/lib/coverage-search.ts`,
`site/components/MediaCoverage.tsx`.

### 13. Method changelog

**What** — A versioned record of every change to how scores are computed
(recency decay, ensemble weighting, the corroboration gate…), so a share
card or screenshot stays readable as "computed under method v3".

**How to use** — Read it at the bottom of the **Method** page. New share
cards are stamped with the current version.

**Where** — `site/lib/methodology-version.ts`,
`site/app/methodology/page.tsx`.

### 15. Confidence badges

**What** — One high / moderate / low vocabulary — with a consistent
label, icon, and hover explanation — used everywhere the app shows an
assessed value: sentiment confidence, the precision of a Wikidata fact,
and whether a controversy was corroborated by retrieved coverage.

**How to use** — Look for the pill next to the **Sentiment analysis**
heading; hover for the one-line explanation.

**Where** — `site/lib/confidence.ts`, `site/components/ConfidenceBadge.tsx`.

### 20. Accessibility — chart text alternatives

**What** — The sentiment sparkline and the attention chart now carry an
SVG `<title>`/`<desc>` and a visually-hidden data table of the actual
dated figures, so a screen-reader user gets the numbers, not just
"sentiment is mixed".

**How to use** — Transparent to sighted users; screen readers announce
the description and can navigate the data table.

**Where** — `site/components/{VisuallyHidden,SentimentTrend,AttentionChart}.tsx`.

---

## Following figures & sharing

### 8. Saved comparisons

**What** — Name and save a pair of figures ("Streaming CEOs", "2024
candidates") and reopen it later. The current pair lives in the URL
(`/compare/?figures=a,b`), so a comparison is also a shareable link.

**How to use** — On the **Compare** page, choose two profiles, type a
name in **"Name this comparison"**, and click **Save this comparison**.
Saved rows appear above with **Open** and **Delete**. Saved sets are
stored only in your browser.

**Where** — `site/lib/comparisons.ts`,
`site/components/{SavedComparisons,comparisons-store}.ts`,
`site/components/CompareView.tsx`.

### 11. Watchlist tags (folders)

**What** — Group watched figures with free-text tags ("Politicians",
"Watching closely"). Old watchlist entries keep working — they just have
no tags until you add them.

**How to use** — On the **Watchlist** page, click **"+ tag"** on any
card to tag it, click a tag to remove it, and use the tag bar at the top
to filter (including an **"Untagged"** view).

**Where** — `site/lib/watchlist.ts`,
`site/components/{WatchlistView,watchlist-store}.ts`.

### 18. Offline / last-visit cache

**What** — The last 12 profiles you opened are kept in your browser. If
the backend is unreachable, the profile still loads from that copy,
clearly marked as **cached** rather than live.

**How to use** — Automatic. When you see the amber **"Showing a copy
saved …"** banner, reload once you are back online for fresh data.

**Where** — `site/lib/profile-cache.ts`, `site/lib/use-celebrity.ts`.

### 19. Shareable deep links

**What** — Link straight to a part of a profile:

| Link | Lands on |
|---|---|
| `/figure/?q=<name>#sentiment` | the sentiment section |
| `/figure/?q=<name>#controversies` | the documented-controversies list |
| `/figure/?q=<name>#controversy-<anchor>` | one specific controversy record |
| `/figure/?q=<name>#event-YYYY-MM-DD` | one timeline day |
| `/compare/?figures=<slug>,<slug>` | a comparison |

**How to use** — Open a profile with one of these fragments; the page
scrolls to that section on load.

**Where** — `site/lib/deep-link.ts`, `site/app/figure/page.tsx`,
`site/components/ControversyRecord.tsx`.

---

## Interface

### 12. Language switcher (English / हिंदी)

**What** — The site shell — navigation, search prompt, framing labels —
can be shown in English or Hindi. The analytical copy (method
explanations, disclaimers) stays English on purpose: a partial or machine
translation of careful claims about living people would be worse than one
honest language.

**How to use** — Click **EN / हिं** in the navigation bar. Your choice is
remembered in this browser and sets `<html lang>`.

**Where** — `site/lib/i18n.ts`,
`site/components/{LocaleSwitcher,locale-store}.ts`,
`site/components/PillNav.tsx`.

### 17. Android launcher icon

**What** — A real adaptive launcher icon (brand-green background, a white
"tracking" mark) replacing the default Flutter icon, plus a monochrome
layer for themed icons on Android 13+.

**Status** — Resource files only. The Android **release build has still
not been compiled** — there is no Android SDK in the build environment —
so this has not been seen on a device.

**Where** — `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`,
`android/app/src/main/res/drawable/ic_launcher_foreground.xml`.

---

## Numbering note

Items 3 and 4 shipped in one commit (the Reddit weighting depends on the
Reddit source), so there are 20 features across 19 feature commits. See
`docs/ROADMAP.md` Phase 6 for the commit range.
