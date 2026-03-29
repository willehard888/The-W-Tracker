#!/bin/bash
set -euo pipefail

echo "🔧 Running post-clone setup for iOS build..."

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

echo "📦 Installing npm dependencies..."
npm ci || npm install

echo "🔨 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor iOS project..."
npx cap sync ios

echo "📦 Resolving Swift package dependencies..."
xcodebuild -resolvePackageDependencies -workspace ios/App/App.xcworkspace -scheme App

echo "✅ post-clone setup complete"