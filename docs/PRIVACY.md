# CritiTrack Privacy Policy

**Last updated: 28 August 2026**

This policy describes what CritiTrack collects, why, and what you can do
about it. It was written against the actual code, not from a template — if
you find something here that does not match the app's behaviour, that is a
bug and we want to hear about it.

---

## The short version

- We do not ask for your name, email address or phone number.
- We do not run advertising, and we do not sell or share data with data
  brokers.
- We do not use any behavioural analytics or tracking SDK.
- Your watchlist and search history stay on your device unless you sign
  in, and even then they are readable only by you.
- You can delete everything we hold from inside the app.

---

## What we collect

### An anonymous account identifier

On first launch the app signs you in anonymously with Firebase
Authentication. This produces a random identifier (a "uid") that is not
linked to any real-world identity. We use it for exactly three things:

1. Enforcing per-user request limits, so one client cannot exhaust the
   service for everyone.
2. Storing your watchlist so it can follow you to another device if you
   choose to sign in.
3. Scoping your data in our security rules, so only you can read it.

We never ask for, and never receive, an email address or phone number
unless you explicitly choose to link a Google or Apple account in a future
version of the app.

### The names you look up

When you search for a public figure, that name is sent to our backend so it
can be looked up. The backend stores:

- The resulting **public-figure profile** — biography, controversy records,
  sentiment scores, media links. This is shared reference data about a
  public figure. It is not about you and is not linked to your identifier.
- **When a figure was last requested and how many times**, so a scheduled
  job knows which profiles are worth keeping up to date. This is a count
  on the figure, not a log of who asked.

We do not keep a per-user history of what you searched for on our servers.
Your recent searches are stored **only on your device**.

### Usage counters

To enforce rate limits we store, against your anonymous identifier, a count
of requests in the current hour and the current day, and the date keys
those counts belong to. Nothing else. These reset as the hour and day roll
over.

### On your device

Three local stores, none of which leave your device unless stated:

| Store | Contents |
|---|---|
| `search_recents` | Your recent search terms |
| `watchlist` | The figures you follow |
| `settings` | Your appearance choice (system / light / dark) |

Your watchlist is also mirrored to our servers under your anonymous
identifier so it can sync across devices. Your search history is not.

### Cached images

Portraits and article thumbnails are cached on your device so the app does
not re-download them. These are ordinary image files fetched from
Wikipedia, YouTube and news publishers.

---

## What we do not collect

- No name, email, phone number or postal address
- No precise or coarse location
- No contacts, photos, files, calendar or microphone access
- No advertising identifier
- No behavioural analytics, session recording or heat mapping
- No crash-reporting SDK at the time of writing (if one is added, this
  policy will be updated before it ships)

---

## Who else is involved

The app talks to our backend. Our backend talks to these services on your
behalf. Your anonymous identifier is **never** passed to any of them; they
receive only the name of the public figure being looked up.

| Service | Purpose |
|---|---|
| **Google Firebase** | Anonymous authentication, database, hosting, abuse prevention |
| **Groq** | Generates the biography and assesses sentiment |
| **Wikidata / Wikipedia** | Resolves a name to a specific public figure, and supplies the portrait |
| **GDELT** | Open news index |
| **NewsAPI** | Supplementary news articles |
| **YouTube Data API** | Related video coverage |

Firebase App Check may use **Play Integrity** (Android) or **reCAPTCHA
Enterprise** (web) to confirm that requests come from a genuine copy of the
app rather than a script. These check the app and the device, not you.

Opening an article or video from the media feed sends you to that
publisher's site, which has its own privacy policy we do not control.

---

## How long we keep things

| Data | Retention |
|---|---|
| Rate-limit counters | Reset hourly and daily |
| Watchlist (server copy) | Until you delete it or delete your data |
| Public-figure profiles | Indefinitely — this is reference data about public figures, not about you |
| Local device storage | Until you clear it, delete your data, or uninstall |

---

## Your choices

**Delete everything.** The app has a "Delete my data" action that removes
your watchlist and search history from your device and deletes your
server-side records, including your usage counters. This cannot be undone.

**Uninstall.** Removing the app clears everything stored on the device.
Server-side records tied to your anonymous identifier remain until deleted;
use "Delete my data" first if you want them gone.

**Request a copy.** Every profile in the app can be exported as JSON or
CSV from the share menu. For the small amount of data tied to your
identifier, contact us and we will provide it.

Depending on where you live — including under the **GDPR** (Europe/UK) and
India's **Digital Personal Data Protection Act** — you may have rights to
access, correct, delete or port your data, and to object to processing.
Because we hold so little and it is not linked to a real identity, most of
these are satisfied by the in-app delete. Contact us for anything else.

---

## Children

CritiTrack is not directed at children under 13, and we do not knowingly
collect data from them. Since we collect no personal information at all,
there is nothing to identify or remove — but if you believe a child has
provided personal information, contact us.

---

## About the content

CritiTrack reports on **public figures** using published reporting.
Sentiment scores, controversy severities and the controversy index are
**algorithmically assessed, not verified fact**, and the app labels them as
such wherever they appear.

If you are the subject of a profile and believe something is inaccurate,
use the report control on the entry or contact us directly. We will review
it and correct or remove it where warranted.

---

## Security

- No third-party API key ships inside the app; all upstream calls are made
  by our backend.
- All traffic is over HTTPS. The app refuses to open any link that is not
  `https`.
- Shared data is written only by our backend. No client can modify a
  profile another user reads.
- Your watchlist and history are readable only by your own identifier,
  enforced by database security rules rather than by app code.

No system is perfectly secure, but this is the standard we hold ourselves
to and test against.

---

## Changes

If this policy changes materially we will update the date above and, for
anything that affects what we collect, tell you in the app before the
change takes effect.

---

## Contact

**Email:** _[add a contact address before publishing]_

> **Before submitting to an app store:** fill in the contact address above,
> host this page at a public URL, and put that URL in both store listings.
> Google Play and the App Store both reject submissions without a reachable
> privacy policy. Keep the Data Safety form consistent with the tables
> above — "Delete my data" must exist and work before you claim it.
