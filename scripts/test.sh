#!/usr/bin/env bash
# Run the suite.
#
# The list of tests is DISCOVERED, not written down: every tests/t_*.js runs.
# A hand-written list goes stale the moment somebody adds a file, and a test that
# silently stops running is worse than no test at all.
#
# Each test prints a line of measurements. Read the numbers - most of them report
# HOW MANY things were wrong rather than pass/fail, and a count creeping up from
# zero is the signal you want.
#
#   bash scripts/test.sh              everything
#   bash scripts/test.sh sec          only tests whose name contains "sec"
#   bash scripts/test.sh -q           just the failures
set -u
cd "$(dirname "$0")/.."

FILTER=""; QUIET=0
for a in "$@"; do
  case "$a" in
    -q|--quiet) QUIET=1 ;;
    *) FILTER="$a" ;;
  esac
done

echo "building..."
python3 scripts/build.py || { echo "BUILD FAILED - nothing was tested"; exit 1; }
python3 scripts/artwork.py || { echo "ARTWORK PATCH FAILED"; exit 1; }
echo

ran=0; failed=0; failures=""
for f in tests/t_*.js; do
  name=$(basename "$f" .js)
  if [ -n "$FILTER" ]; then
    case "$name" in *"$FILTER"*) ;; *) continue ;; esac
  fi

  [ "$QUIET" -eq 0 ] && printf '%-14s ' "$name"
  out=$(timeout 180 node "$f" 2>&1); rc=$?
  ran=$((ran+1))

  if [ $rc -ne 0 ]; then
    failed=$((failed+1)); failures="$failures $name"
    [ "$QUIET" -eq 1 ] && printf '%-14s ' "$name"
    echo "FAILED (exit $rc)"
    echo "$out" | tail -4 | sed 's/^/    /'
  elif [ "$QUIET" -eq 0 ]; then
    echo "$out" | grep -v pageerror | tail -1
  fi
done

echo
echo "$ran test(s) ran"
if [ $failed -gt 0 ]; then
  echo "$failed failed:$failures"
  exit 1
fi
echo "none failed - now read the numbers above"
