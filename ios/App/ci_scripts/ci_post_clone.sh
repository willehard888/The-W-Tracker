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

# ── Install Node.js (Xcode Cloud does NOT include it) ──
if ! command -v node &>/dev/null; then
  echo "📥 Node.js not found – installing via Homebrew..."
  brew install node
fi

echo "ℹ️  Node $(node -v) / npm $(npm -v)"

# ── Install npm dependencies ──
echo "📦 Installing npm dependencies..."
# Regenerate package-lock.json to guarantee it matches package.json
rm -f package-lock.json
npm install --legacy-peer-deps

# ── Build web assets ──
echo "🔨 Building web assets..."
npm run build

# ── Sync Capacitor ──
echo "🔄 Syncing Capacitor iOS project..."
npx cap sync ios

# ── Fix Package.resolved originHash ──
RESOLVED_DIR="ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
RESOLVED_FILE="$RESOLVED_DIR/Package.resolved"
mkdir -p "$RESOLVED_DIR"

echo "📦 Updating Package.resolved originHash..."
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

local_pattern = re.compile(r'\.package\((?:name:\s*"[^"]+",\s*)?path:\s*"([^"]+)"')
remote_pattern = re.compile(r'\.package\(url:\s*"([^"]+)",\s*(exact|from):\s*"([^"]+)"')

def package_identity(url):
    return url.rstrip("/").split("/")[-1].removesuffix(".git").lower()

def collect_manifests(entry, seen, ordered):
    entry = entry.resolve()
    if entry in seen:
        return
    seen.add(entry)
    ordered.append(entry)
    contents = entry.read_text()
    for rel_path in local_pattern.findall(contents):
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

if resolved.exists():
    data = json.loads(resolved.read_text())
else:
    data = {"originHash": "", "pins": [], "version": 3}

existing_pins = {pin["identity"]: pin for pin in data.get("pins", [])}
fallback_revisions = {
    "capacitor-swift-pm": {
        "8.2.0": "0e862e6ff13852a710c8a484180ca4d6a2cc9761",
    },
    "purchases-hybrid-common": {
        "17.52.0": "9b99aee60dd4f8b5a2e96f074f4d0b8adc53beee",
    },
}

required_pins = {}
for item in manifests:
    contents = item.read_text()
    for url, requirement_type, version in remote_pattern.findall(contents):
        identity = package_identity(url)
        existing = required_pins.get(identity)
        if existing is None or requirement_type == "exact" or existing["requirement_type"] != "exact":
            required_pins[identity] = {
                "identity": identity,
                "kind": "remoteSourceControl",
                "location": url,
                "version": version,
                "requirement_type": requirement_type,
            }

pins = []
for identity in sorted(required_pins):
    spec = required_pins[identity]
    existing_pin = existing_pins.get(identity)
    if existing_pin and existing_pin.get("state", {}).get("version") == spec["version"]:
        state = existing_pin["state"]
    else:
        state = {"version": spec["version"]}
        revision = fallback_revisions.get(identity, {}).get(spec["version"])
        if revision:
            state = {"revision": revision, "version": spec["version"]}

    pins.append(
        {
            "identity": identity,
            "kind": spec["kind"],
            "location": spec["location"],
            "state": state,
        }
    )

data = {
    "originHash": origin_hash,
    "pins": pins,
    "version": 3,
}

resolved.write_text(json.dumps(data, indent=2) + "\n")
print(f"✅ Package.resolved originHash updated: {origin_hash[:16]}...")
PY

if [[ -f "$RESOLVED_FILE" ]]; then
  echo "✅ Package.resolved ready"
else
  echo "❌ Package.resolved missing"
  exit 1
fi

if command -v xcodebuild &>/dev/null; then
  echo "📦 Verifying Swift package graph with updated Package.resolved..."
  RESOLVE_LOG="${TMPDIR:-/tmp}/xcode-package-resolve.log"
  if xcodebuild -resolvePackageDependencies \
    -project "$ROOT_DIR/ios/App/App.xcodeproj" \
    -scheme App \
    -clonedSourcePackagesDirPath "${TMPDIR:-/tmp}/spm-packages" \
    > "$RESOLVE_LOG" 2>&1; then
    echo "✅ Swift package graph verified"
    tail -5 "$RESOLVE_LOG"
  else
    echo "⚠️ Swift package verification failed in script; continuing with freshly updated Package.resolved"
    tail -30 "$RESOLVE_LOG" || true
  fi
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
  echo "✅ App icon copied"
else
  echo "⚠️ App icon not found at $ICON_SRC"
fi

echo "✅ post-clone setup complete"
