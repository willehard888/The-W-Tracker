#!/bin/bash
# ios-rebuild.sh — one-shot iOS rebuild
#
# Runs: clean → npm install → npm run build → cap sync ios → pod install → cap open ios
# Always executes from the project root, regardless of where it's invoked from.
#
# Usage:
#   bash scripts/ios-rebuild.sh
#   ./scripts/ios-rebuild.sh
set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve project root from this script's location (works from any CWD)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_APP_DIR="$ROOT_DIR/ios/App"

if [[ ! -f "$ROOT_DIR/package.json" ]]; then
  echo "❌ package.json not found at $ROOT_DIR — is this script in <project>/scripts/?"
  exit 1
fi

if [[ ! -d "$IOS_APP_DIR" ]]; then
  echo "❌ iOS app dir missing at $IOS_APP_DIR — run 'npx cap add ios' first"
  exit 1
fi

cd "$ROOT_DIR"
echo "ℹ️  Project root : $ROOT_DIR"
echo "ℹ️  iOS app dir  : $IOS_APP_DIR"

# ---------------------------------------------------------------------------
# 1. Clean
# ---------------------------------------------------------------------------
echo ""
echo "🧹 [1/6] Cleaning Pods, Podfile.lock, node_modules, dist..."
rm -rf "$IOS_APP_DIR/Pods" "$IOS_APP_DIR/Podfile.lock" "$ROOT_DIR/node_modules" "$ROOT_DIR/dist"

# ---------------------------------------------------------------------------
# 2. npm install
# ---------------------------------------------------------------------------
echo ""
echo "📦 [2/6] Installing npm dependencies..."
if [[ -f "$ROOT_DIR/package-lock.json" ]]; then
  npm ci --legacy-peer-deps --no-audit --no-fund || \
    npm install --legacy-peer-deps --no-audit --no-fund
else
  npm install --legacy-peer-deps --no-audit --no-fund
fi

# ---------------------------------------------------------------------------
# 3. Web build
# ---------------------------------------------------------------------------
echo ""
echo "🔨 [3/6] Building web assets..."
npm run build

# ---------------------------------------------------------------------------
# 4. Capacitor sync
# ---------------------------------------------------------------------------
echo ""
echo "🔄 [4/6] Syncing Capacitor iOS..."
npx cap sync ios || echo "⚠️ cap sync emitted warnings — continuing"

# ---------------------------------------------------------------------------
# 5. CocoaPods install (with CDN fallback + retry)
# ---------------------------------------------------------------------------
echo ""
echo "📦 [5/6] Running pod install..."
cd "$IOS_APP_DIR"

if ! command -v pod &>/dev/null; then
  echo "📥 CocoaPods not found — installing via Homebrew..."
  brew install cocoapods || sudo gem install cocoapods
fi

export COCOAPODS_DISABLE_STATS=1

if ! curl -sf --max-time 15 https://cdn.cocoapods.org/CocoaPods-version.yml > /dev/null; then
  echo "⚠️ CocoaPods CDN unreachable — adding GitHub Specs mirror"
  pod repo remove trunk 2>/dev/null || true
  pod repo add trunk https://github.com/CocoaPods/Specs.git 2>/dev/null || \
    pod repo add-cdn trunk https://cdn.cocoapods.org/ 2>/dev/null || true
fi

pod_attempt=1
pod_max=3
pod_ok=0
while [[ $pod_attempt -le $pod_max ]]; do
  echo "📦 pod install attempt $pod_attempt/$pod_max..."
  if [[ $pod_attempt -eq 1 ]]; then
    if pod install; then pod_ok=1; break; fi
  else
    if pod install --repo-update; then pod_ok=1; break; fi
  fi
  echo "⚠️ attempt $pod_attempt failed — retrying in $((pod_attempt * 5))s"
  sleep $((pod_attempt * 5))
  pod_attempt=$((pod_attempt + 1))
done

cd "$ROOT_DIR"

if [[ $pod_ok -ne 1 ]]; then
  echo "❌ pod install failed after $pod_max attempts"
  exit 2
fi

# ---------------------------------------------------------------------------
# 6. Open Xcode (macOS only)
# ---------------------------------------------------------------------------
echo ""
if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "🚀 [6/6] Opening Xcode workspace..."
  npx cap open ios || echo "⚠️ cap open ios failed — open $IOS_APP_DIR/App.xcworkspace manually"
else
  echo "ℹ️  [6/6] Skipping cap open ios (not macOS)"
fi

echo ""
echo "✅ Done. iOS workspace ready at: $IOS_APP_DIR/App.xcworkspace"
