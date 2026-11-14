#!/usr/bin/env bash
# Baut das Spiel und verpackt es als Android-APK -> release/LetzteAusfahrt.apk
# Voraussetzungen: Node 18+, JDK 17+, Gradle 8.9+, Android SDK (ANDROID_HOME oder android/local.properties)
set -euo pipefail
cd "$(dirname "$0")"
[ -d web/public/assets/tex ] || python3 tools/fetch_assets.py
(cd web && npm install --no-audit --no-fund && npx vite build)
(cd android && gradle assembleDebug --console=plain -q)
mkdir -p release && cp android/app/build/outputs/apk/debug/app-debug.apk release/LetzteAusfahrt.apk
ls -lh release/LetzteAusfahrt.apk
