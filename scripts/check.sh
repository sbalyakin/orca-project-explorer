#!/bin/sh
# Type check and node tests: the one command to run before a reload or a commit.
# Silent on success except the test summary; prints everything on failure.
cd "$(dirname "$0")/.." || exit 1

npx --yes -p typescript tsc -p . || exit 1

out=$(orca plugin test . 2>&1) || {
  echo "$out"
  exit 1
}
echo "$out" | tail -3
