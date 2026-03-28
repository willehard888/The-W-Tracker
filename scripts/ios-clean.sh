#!/bin/bash
set -e

echo "🧹 Removing old iOS platform..."
rm -rf ios

echo "📱 Adding iOS platform..."
npx cap add ios

echo "🔨 Building web assets..."
CAPACITOR_BUILD=true npm run build

echo "🔄 Syncing Capacitor..."
npx cap sync ios

echo "📦 Resolving SPM packages..."
cd ios/App
xcodebuild -resolvePackageDependencies -workspace App.xcworkspace -scheme App
cd ../..

echo "🚀 Opening Xcode..."
npx cap open ios

echo "✅ Done! Open App.xcworkspace in Xcode (not .xcodeproj)"
