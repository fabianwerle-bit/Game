#!/usr/bin/env bash
# Run the headless suites. GODOT may point at any Godot 4.6+ binary.
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
"$GODOT" --headless --path . --script tests/run_tests.gd
