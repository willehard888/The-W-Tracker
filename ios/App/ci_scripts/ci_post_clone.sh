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

echo "✅ post-clone setup complete"
