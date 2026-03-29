#!/bin/bash
set -euo pipefail

ensure_spm_lockfile() {
  local resolved_path="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
  mkdir -p "$(dirname "$resolved_path")"
  cat > "$resolved_path" << 'EOF'
{
  "pins": [
    {
      "identity": "capacitor-swift-pm",
      "kind": "remoteSourceControl",
      "location": "https://github.com/ionic-team/capacitor-swift-pm.git",
      "state": {
        "revision": "0e862e6ff13852a710c8a484180ca4d6a2cc9761",
        "version": "8.2.0"
      }
    },
    {
      "identity": "purchases-hybrid-common",
      "kind": "remoteSourceControl",
      "location": "https://github.com/RevenueCat/purchases-hybrid-common.git",
      "state": {
        "revision": "9b99aee60dd4f8b5a2e96f074f4d0b8adc53beee",
        "version": "17.52.0"
      }
    }
  ],
  "version": 2
}
EOF
  echo "🔐 Wrote Swift Package lockfile to $resolved_path"
}

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
ensure_spm_lockfile

# ── Validate Package.resolved ──
RESOLVED="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
if [[ ! -f "$ROOT_DIR/$RESOLVED" ]]; then
  echo "❌ Package.resolved not found at $RESOLVED"
  exit 1
fi
if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$ROOT_DIR/$RESOLVED" 2>/dev/null; then
  echo "❌ Package.resolved is not valid JSON"
  exit 1
fi
echo "✅ Package.resolved exists and is valid JSON"

# ── Copy app icon ──
ICON_SRC="$ROOT_DIR/public/app-icon.png"
ICON_DST="$ROOT_DIR/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
if [[ -f "$ICON_SRC" ]]; then
  cp "$ICON_SRC" "$ICON_DST"
  echo "✅ App icon copied"
fi

echo "✅ post-clone setup complete"
