#!/usr/bin/env bash
# Build a signed Android APK.
#
#   GODOT=/path/to/godot ANDROID_SDK=/path/to/sdk tools/build_android.sh
#
# Requires, once:
#   - Godot 4.6 with the matching export templates installed
#     (Editor > Manage Export Templates, or unpack the .tpz into
#      ~/.local/share/godot/export_templates/4.6.stable/)
#   - An Android SDK with build-tools and platform-tools
#   - The editor settings below, which Godot reads from
#     ~/.config/godot/editor_settings-4.6.tres
#
# Two things about this build are easy to lose and hard to diagnose:
#
#   * project.godot must keep rendering/textures/vram_compression/
#     import_etc2_astc=true. Without it Godot refuses to export for Android
#     and prints an *empty* error list, which looks like nothing is wrong.
#   * export_presets.cfg must keep the custom_template/debug and
#     custom_template/release keys, even empty. If they are absent Godot takes
#     the custom-template branch, finds nothing, and fails silently as well.
set -euo pipefail
cd "$(dirname "$0")/.."

GODOT="${GODOT:-godot}"
OUT="${OUT:-build/SlimeCleanup.apk}"

mkdir -p "$(dirname "$OUT")"

echo "== verifying the project first =="
tools/test.sh

echo
echo "== importing =="
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true

echo "== exporting $OUT =="
"$GODOT" --headless --path . --export-release "Android" "$PWD/$OUT"

echo
echo "== result =="
ls -lh "$OUT"
if [ -n "${ANDROID_SDK:-}" ]; then
	BT="$(ls -d "$ANDROID_SDK"/build-tools/* | sort -V | tail -1)"
	java -jar "$BT/lib/apksigner.jar" verify --verbose "$OUT" | head -6
	"$BT/aapt2" dump badging "$OUT" | grep -E "^package:|^application-label:|minSdkVersion|targetSdkVersion|native-code"
fi
