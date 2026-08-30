#!/usr/bin/env bash
#
# SEC-01 regression gate: no credential may reach a build artifact.
#
# Scans a built web bundle for credential-shaped strings. Run against
# build/web in CI, and runnable locally with the same result:
#
#   bash tool/scan_build_secrets.sh build/web
#
# On the Firebase client keys
# ---------------------------
# Firebase's web/android `apiKey` values are public client identifiers,
# not secrets — they ship in every Firebase app and are documented as
# safe to expose. What protects the project is App Check and the
# Firestore rules, not the key being hidden.
#
# They are nevertheless shaped exactly like a Google Cloud API key, which
# is what a leaked YouTube Data key looks like — and that key IS a
# secret. So the AIza pattern has to stay, and the two public values are
# allow-listed instead. The allow-list is read out of
# lib/firebase_options.dart rather than hardcoded, so it tracks the
# source: any AIza-shaped string in the bundle that is not a declared
# client key still fails the build.
set -euo pipefail

TARGET="${1:-build/web}"
OPTIONS_FILE="${2:-lib/firebase_options.dart}"

if [ ! -d "$TARGET" ]; then
  echo "::error::$TARGET does not exist — nothing was built."
  exit 1
fi

# Patterns that are always a leak, whatever they look like.
HARD='gsk_[A-Za-z0-9]{20}|IGQ[A-Za-z0-9_-]{20}|sk-[A-Za-z0-9]{20}|GROQ_API_KEY|NEWS_API_KEY|YOUTUBE_API_KEY|INSTAGRAM_ACCESS_TOKEN'

echo "Scanning $TARGET for credential patterns..."

failed=0

if grep -rEl "$HARD" "$TARGET" 2>/dev/null | grep . ; then
  echo "::error::Credential-shaped string found in build output. See SEC-01."
  failed=1
fi

# Google API keys, minus the public Firebase client keys.
allowed=$(grep -oE "AIza[A-Za-z0-9_-]{20,}" "$OPTIONS_FILE" 2>/dev/null | sort -u || true)
if [ -z "$allowed" ]; then
  echo "::error::No client keys found in $OPTIONS_FILE — the allow-list would" \
       "let a real key through. Check the path."
  exit 1
fi
echo "Allow-listing $(echo "$allowed" | wc -l) public Firebase client key(s)."

found=$(grep -rhoE "AIza[A-Za-z0-9_-]{20,}" "$TARGET" 2>/dev/null | sort -u || true)
while IFS= read -r key; do
  [ -z "$key" ] && continue
  if ! printf '%s\n' "$allowed" | grep -qxF "$key"; then
    echo "::error::Google API key in build output that is not a declared" \
         "Firebase client key: ${key:0:10}... See SEC-01."
    failed=1
  fi
done <<< "$found"

if find "$TARGET" -name '.env*' | grep . ; then
  echo "::error::A .env file was bundled into the build output. See SEC-01."
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "Clean: no credentials in build output."
