#!/usr/bin/env bash
# Unit tests for the components in src/lib/ - Node only, no browser.
# These run in milliseconds; run them constantly.
set -u
cd "$(dirname "$0")/.."
fail=0
for f in tests/unit/*.test.mjs; do
  [ -e "$f" ] || { echo "no unit tests yet"; exit 0; }
  node "$f" || fail=$((fail+1))
done
[ $fail -eq 0 ] && echo "unit tests passed" || { echo "$fail unit file(s) failed"; exit 1; }
