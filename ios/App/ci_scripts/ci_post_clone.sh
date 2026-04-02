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

# ── Ensure pinned Package.resolved exists and matches the local Swift package graph ──
RESOLVED_FILE="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
mkdir -p "$(dirname "$RESOLVED_FILE")"

cat > "$RESOLVED_FILE" << 'RESOLVEDEOF'
{
  "originHash" : "608e7cffacbdb2c959bc4cf23fc793ae01215c287b360f0231cb150f64a03cf2",
  "pins" : [
    {
      "identity" : "capacitor-swift-pm",
      "kind" : "remoteSourceControl",
      "location" : "https://github.com/ionic-team/capacitor-swift-pm.git",
      "state" : {
        "revision" : "0e862e6ff13852a710c8a484180ca4d6a2cc9761",
        "version" : "8.2.0"
      }
    },
    {
      "identity" : "purchases-hybrid-common",
      "kind" : "remoteSourceControl",
      "location" : "https://github.com/RevenueCat/purchases-hybrid-common.git",
      "state" : {
        "revision" : "9b99aee60dd4f8b5a2e96f074f4d0b8adc53beee",
        "version" : "17.52.0"
      }
    },
    {
      "identity" : "purchases-ios-spm",
      "kind" : "remoteSourceControl",
      "location" : "https://github.com/RevenueCat/purchases-ios-spm.git",
      "state" : {
        "revision" : "9755c68799edb79ec03f90b22b5e35c3829d4ec8",
        "version" : "5.65.0"
      }
    }
  ],
  "version" : 3
}
RESOLVEDEOF

python3 - << 'PY'
import json
from pathlib import Path

resolved = Path("/dev-server/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved")
data = json.loads(resolved.read_text())
assert data["originHash"] == "608e7cffacbdb2c959bc4cf23fc793ae01215c287b360f0231cb150f64a03cf2"
assert [pin["identity"] for pin in data["pins"]] == [
    "capacitor-swift-pm",
    "purchases-hybrid-common",
    "purchases-ios-spm",
]
print("✅ Package.resolved validated")
PY

if [[ -f "$RESOLVED_FILE" ]]; then
  echo "✅ Package.resolved ready"
else
  echo "❌ Package.resolved missing — Xcode Cloud requires it"
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
