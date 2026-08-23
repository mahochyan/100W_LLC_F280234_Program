#!/usr/bin/env bash
# Repeatable clean Debug build using the project-declared C2000 CGT v16.9.3.LTS.
# This script runs from WSL/Linux and invokes the Windows batch file through cmd.exe.
set -euo pipefail
cd "$(dirname "$0")/.."
# Ensure batch file uses CRLF? Windows cmd tolerates LF in most cases, but convert to be safe.
if command -v unix2dos >/dev/null 2>&1; then
  unix2dos -q tools/build_debug.bat
fi
cd /mnt/c
cmd.exe /c "D:\\CCS21_workspace\\Codex_Project\\tools\\build_debug.bat" < /dev/null
