#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ANDROID_BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-../toolchain/android-15}"
ANDROID_JAR="${ANDROID_JAR:-../toolchain/android-35/android.jar}"
ECJ_JAR="${ECJ_JAR:-../toolchain/ecj.jar}"
mkdir -p build/classes build/dex build/generated
"$ANDROID_BUILD_TOOLS/aapt2" compile --dir res -o build/resources.zip
"$ANDROID_BUILD_TOOLS/aapt2" link -o build/base.apk -I "$ANDROID_JAR" --manifest AndroidManifest.xml --java build/generated -A assets --min-sdk-version 23 --target-sdk-version 35 -0 ogg build/resources.zip
find src build/generated -name '*.java' > build/sources.txt
java -jar "$ECJ_JAR" -8 -encoding UTF-8 -nowarn -bootclasspath "$ANDROID_JAR" -d build/classes @build/sources.txt
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
with ZipFile('build/classes.jar','w',ZIP_DEFLATED) as z:
 for p in Path('build/classes').rglob('*.class'):z.write(p,str(p.relative_to('build/classes')))
PY
java -cp "$ANDROID_BUILD_TOOLS/lib/d8.jar" com.android.tools.r8.D8 --min-api 23 --lib "$ANDROID_JAR" --output build/dex build/classes.jar
python3 - <<'PY'
from zipfile import ZipFile,ZIP_DEFLATED
import shutil
shutil.copyfile('build/base.apk','build/unaligned.apk')
with ZipFile('build/unaligned.apk','a',ZIP_DEFLATED) as z:z.write('build/dex/classes.dex','classes.dex')
PY
"$ANDROID_BUILD_TOOLS/zipalign" -f -p 4 build/unaligned.apk build/aligned.apk
if [ ! -f dev-signing.p12 ]; then
 keytool -genkeypair -keystore dev-signing.p12 -storepass android -keypass android -alias slime-dev -dname 'CN=Slime Sweep Development' -keyalg RSA -keysize 2048 -validity 10000
fi
java -jar "$ANDROID_BUILD_TOOLS/lib/apksigner.jar" sign --ks dev-signing.p12 --ks-key-alias slime-dev --ks-pass pass:android --key-pass pass:android --out build/Slime-Sweep-0.2.apk build/aligned.apk
java -jar "$ANDROID_BUILD_TOOLS/lib/apksigner.jar" verify --verbose build/Slime-Sweep-0.2.apk
"$ANDROID_BUILD_TOOLS/aapt2" dump badging build/Slime-Sweep-0.2.apk
