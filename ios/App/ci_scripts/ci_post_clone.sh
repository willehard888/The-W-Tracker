#!/bin/sh

# Xcode Cloud post-clone script
# Installs npm dependencies so SPM can resolve local Capacitor plugin packages

set -e

echo "📦 Installing Node.js dependencies..."

# Navigate to the project root (3 levels up from ci_scripts)
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Install Node.js if not available
if ! command -v node &> /dev/null; then
  echo "🔧 Installing Node.js via Homebrew..."
  brew install node
fi

# Install dependencies
npm install

echo "✅ Node.js dependencies installed successfully"

# Build the web assets
echo "🔨 Building web assets..."
npm run build

echo "✅ Web assets built successfully"

# Sync Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync ios

echo "✅ Capacitor synced successfully"
