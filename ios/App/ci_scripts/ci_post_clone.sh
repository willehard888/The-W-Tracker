#!/bin/sh

# Xcode Cloud post-clone script
# Installs dependencies, builds web assets, syncs iOS, and resolves Swift packages.

set -e

echo "📦 Installing Node.js dependencies..."
cd "$CI_PRIMARY_REPOSITORY_PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "🔧 Installing Node.js via Homebrew..."
  brew install node
fi

npm install
echo "✅ Node.js dependencies installed successfully"

echo "🔨 Building web assets..."
CAPACITOR_BUILD=true npm run build
echo "✅ Web assets built successfully"

echo "🔄 Syncing Capacitor..."
npx cap sync ios
echo "✅ Capacitor synced successfully"

if command -v xcodebuild >/dev/null 2>&1; then
  echo "📦 Resolving Swift packages..."
  xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
  echo "✅ Swift packages resolved successfully"
fi