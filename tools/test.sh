#!/usr/bin/env bash
# Run the headless suites. GODOT may point at any Godot 4.6+ binary.
#
# The import pass refreshes Godot's global class cache. Without it a newly
# added `class_name` script is invisible to the suites and every reference to
# it fails to parse.
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
"$GODOT" --headless --path . --script tests/run_tests.gd
