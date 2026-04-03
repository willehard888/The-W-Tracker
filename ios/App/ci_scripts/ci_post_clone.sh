#!/bin/bash
set -euo pipefail

echo "🔧 Running post-clone setup for iOS build..."

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

while [[ ! -f "$ROOT_DIR/package.json" && "$ROOT_DIR" != "/" ]]; do
  ROOT_DIR="$(dirname "$ROOT_DIR")"
done

if [[ ! -f "$ROOT_DIR/package.json" ]]; then
  echo "❌ package.json not found. Aborting."
  exit 1
fi

cd "$ROOT_DIR"

# ── Install Node.js (Xcode Cloud does NOT include it) ──
if ! command -v node &>/dev/null; then
  echo "📥 Node.js not found – installing via Homebrew..."
  brew install node
fi

echo "ℹ️  Node $(node -v) / npm $(npm -v)"

# ── Install npm dependencies ──
echo "📦 Installing npm dependencies..."
npm ci || npm install

# ── Build web assets ──
echo "🔨 Building web assets..."
npm run build

# ── Sync Capacitor ──
echo "🔄 Syncing Capacitor iOS project..."
npx cap sync ios

# ── Ensure Package.resolved exists ──
RESOLVED_DIR="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
RESOLVED_FILE="$RESOLVED_DIR/Package.resolved"
mkdir -p "$RESOLVED_DIR"

# Remove any stale committed Package.resolved so Xcode can regenerate fresh
rm -f "$RESOLVED_FILE"

# Let Xcode resolve packages itself — this creates the authoritative Package.resolved
if command -v xcodebuild >/dev/null 2>&1; then
  echo "📦 Running xcodebuild package resolution..."
  RESOLVE_LOG="${TMPDIR:-/tmp}/xcode-package-resolve.log"

  # Temporarily enable automatic resolution by removing any stale resolved file
  if xcodebuild -resolvePackageDependencies \
    -project ios/App/App.xcodeproj \
    -scheme App \
    -clonedSourcePackagesDirPath "${TMPDIR:-/tmp}/spm-packages" \
    2>&1 | tee "$RESOLVE_LOG"; then
    echo "✅ Xcode package resolution succeeded"
  else
    echo "⚠️ xcodebuild -resolvePackageDependencies failed, generating fallback..."
    tail -50 "$RESOLVE_LOG"

    # Fallback: generate Package.resolved from Python
    python3 - "$ROOT_DIR" << 'PY'
import hashlib
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
manifest = root / "ios/App/CapApp-SPM/Package.swift"
resolved = root / "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"

if not manifest.exists():
    raise SystemExit(f"Missing Swift package manifest: {manifest}")

pattern = re.compile(r'\.package\((?:name:\s*"[^"]+",\s*)?path:\s*"([^"]+)"')

def collect_manifests(entry, seen, ordered):
    entry = entry.resolve()
    if entry in seen:
        return
    seen.add(entry)
    ordered.append(entry)
    contents = entry.read_text()
    for rel_path in pattern.findall(contents):
        child = (entry.parent / rel_path / "Package.swift").resolve()
        if child.exists():
            collect_manifests(child, seen, ordered)

manifests = []
collect_manifests(manifest, set(), manifests)

digest = hashlib.sha256()
for item in manifests:
    digest.update(str(item.relative_to(root)).encode("utf-8"))
    digest.update(b"\0")
    digest.update(item.read_bytes())
    digest.update(b"\0")

origin_hash = digest.hexdigest()
data = {
    "originHash": origin_hash,
    "pins": [
        {
            "identity": "capacitor-swift-pm",
            "kind": "remoteSourceControl",
            "location": "https://github.com/ionic-team/capacitor-swift-pm.git",
            "state": {
                "revision": "0e862e6ff13852a710c8a484180ca4d6a2cc9761",
                "version": "8.2.0",
            },
        },
        {
            "identity": "purchases-hybrid-common",
            "kind": "remoteSourceControl",
            "location": "https://github.com/RevenueCat/purchases-hybrid-common.git",
            "state": {
                "revision": "9b99aee60dd4f8b5a2e96f074f4d0b8adc53beee",
                "version": "17.52.0",
            },
        },
        {
            "identity": "purchases-ios-spm",
            "kind": "remoteSourceControl",
            "location": "https://github.com/RevenueCat/purchases-ios-spm.git",
            "state": {
                "revision": "9755c68799edb79ec03f90b22b5e35c3829d4ec8",
                "version": "5.65.0",
            },
        },
    ],
    "version": 3,
}

resolved.write_text(json.dumps(data, indent=2) + "\n")
print(f"✅ Fallback Package.resolved generated ({origin_hash})")
PY
  fi
else
  echo "⚠️ xcodebuild not available — this should not happen on Xcode Cloud"
  exit 1
fi

if [[ -f "$RESOLVED_FILE" ]]; then
  echo "✅ Package.resolved ready"
  cat "$RESOLVED_FILE"
else
  echo "❌ Package.resolved missing after resolution"
  exit 1
fi

if [[ -f "$ROOT_DIR/ios/App/App/capacitor.config.json" ]] && grep -q 'SignInWithApple' "$ROOT_DIR/ios/App/App/capacitor.config.json"; then
  echo "❌ Obsolete SignInWithApple plugin still registered in capacitor.config.json"
  exit 1
fi

# ── Copy app icon & ensure Contents.json ──
ICON_SRC="$ROOT_DIR/public/app-icon.png"
ICON_DIR="$ROOT_DIR/ios/App/App/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$ICON_DIR"
if [[ -f "$ICON_SRC" ]]; then
  cp "$ICON_SRC" "$ICON_DIR/AppIcon-512@2x.png"
  cat > "$ICON_DIR/Contents.json" << 'ICONEOF'
{
  "images" : [
    {
      "filename" : "AppIcon-512@2x.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
ICONEOF
  echo "✅ App icon copied and Contents.json written"
else
  echo "⚠️ App icon not found at $ICON_SRC"
fi

echo "✅ post-clone setup complete"
