#!/usr/bin/env bash
# Build (CGT 16.9.3) then run static/script tests.
set -euo pipefail
cd "$(dirname "$0")/.."
./tools/build_debug.sh
python3 ./tools/test_static.py
echo "ALL TESTS PASSED"
