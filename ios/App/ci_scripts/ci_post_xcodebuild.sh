#!/bin/bash
# Runs after `xcodebuild archive` regardless of success/failure.
# Collects everything we need to debug Capacitor SwiftCompile crashes and
# drops it into $CI_ARCHIVE_PATH so it's downloadable from App Store Connect
# as a build artifact alongside the .xcarchive.
#
# Why this exists: Xcode Cloud's web UI collapses SwiftCompile failures to a
# one-line "Command SwiftCompile failed with a nonzero exit code" and hides
# the actual `error:` line. The .xcresult bundle + swift-frontend .ips crash
# reports are where the real diagnostic lives — this script makes sure they
# always survive.

set -uo pipefail   # NOT -e: we want to keep collecting even if one step fails

echo "📦 Running post-xcodebuild diagnostics collection..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_APP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$IOS_APP_DIR/../.." && pwd)"

# Xcode Cloud exposes these. Fall back to /Volumes/workspace/* paths used in
# the Xcode Cloud runner image.
ARCHIVE_DEST="${CI_ARCHIVE_PATH:-/Volumes/workspace/build.xcarchive}"
RESULT_BUNDLE="${CI_RESULT_BUNDLE_PATH:-/Volumes/workspace/resultbundle.xcresult}"
DERIVED_DATA="${CI_DERIVED_DATA_PATH:-/Volumes/workspace/DerivedData}"

# Final destination — Xcode Cloud surfaces anything dropped here.
DIAG_DIR="${CI_ARCHIVE_PATH:-/Volumes/workspace}/BuildDiagnostics"
mkdir -p "$DIAG_DIR" 2>/dev/null || {
  # Fallback if $CI_ARCHIVE_PATH isn't writable yet (build failed before archive).
  DIAG_DIR="/Volumes/workspace/artifacts/BuildDiagnostics"
  mkdir -p "$DIAG_DIR"
}

echo "ℹ️  DIAG_DIR=$DIAG_DIR"
echo "ℹ️  RESULT_BUNDLE=$RESULT_BUNDLE"

# ---------------------------------------------------------------------------
# 1. Extract human-readable errors from the .xcresult bundle.
#    `xcrun xcresulttool` knows how to dump SwiftCompile errors line-by-line.
# ---------------------------------------------------------------------------
if [[ -d "$RESULT_BUNDLE" ]]; then
  echo "📋 Extracting errors from xcresult bundle..."

  # Modern xcresulttool (Xcode 16+) uses --legacy for the old JSON schema.
  # Try both forms; whichever works wins.
  xcrun xcresulttool get build-results \
      --path "$RESULT_BUNDLE" \
      --format json > "$DIAG_DIR/build-results.json" 2>"$DIAG_DIR/xcresulttool.err" \
    || xcrun xcresulttool get \
         --path "$RESULT_BUNDLE" \
         --format json --legacy > "$DIAG_DIR/build-results.json" 2>>"$DIAG_DIR/xcresulttool.err" \
    || echo "⚠️  xcresulttool extraction failed (see xcresulttool.err)"

  # Pull just the failures into a plain-text file that's quick to read.
  if [[ -s "$DIAG_DIR/build-results.json" ]]; then
    python3 - "$DIAG_DIR/build-results.json" "$DIAG_DIR/errors.txt" <<'PY' \
      || echo "⚠️  Failed to extract errors from build-results.json"
import json, sys
src, dst = sys.argv[1], sys.argv[2]
with open(src) as f:
    data = json.load(f)

lines = []

def walk(node, depth=0):
    if isinstance(node, dict):
        # Common shapes across xcresulttool versions
        sev  = node.get('severity') or node.get('issueType')
        msg  = node.get('message') or node.get('title') or node.get('text')
        loc  = node.get('documentLocationInCreatingWorkspace') or node.get('location') or {}
        url  = loc.get('url') if isinstance(loc, dict) else None
        if sev and msg and ('error' in str(sev).lower() or 'fail' in str(sev).lower()):
            lines.append(f"[{sev}] {msg}")
            if url:
                lines.append(f"  at {url}")
            lines.append("")
        for v in node.values():
            walk(v, depth+1)
    elif isinstance(node, list):
        for v in node:
            walk(v, depth+1)

walk(data)

with open(dst, 'w') as f:
    if lines:
        f.write('\n'.join(lines))
    else:
        f.write('(no error-severity issues found in build-results.json — '
                'the failure may have aborted before issues were recorded)\n')
print(f'wrote {len(lines)} lines to {dst}')
PY
  fi

  # Always copy the raw bundle too — it's the source of truth.
  echo "📋 Copying raw xcresult bundle..."
  cp -R "$RESULT_BUNDLE" "$DIAG_DIR/resultbundle.xcresult" 2>/dev/null \
    || echo "⚠️  Could not copy xcresult bundle"
else
  echo "⚠️  No xcresult bundle at $RESULT_BUNDLE"
fi

# ---------------------------------------------------------------------------
# 2. Swift / clang frontend crash reports (.ips). These are the *only* place
#    the actual ASSERT_failure stack lives when the type-checker aborts.
# ---------------------------------------------------------------------------
echo "💥 Collecting swift-frontend / clang crash reports..."
CRASH_DIR="$DIAG_DIR/CrashReports"
mkdir -p "$CRASH_DIR"
for src in \
    "$HOME/Library/Logs/DiagnosticReports" \
    "/Library/Logs/DiagnosticReports"; do
  if [[ -d "$src" ]]; then
    find "$src" -maxdepth 1 -type f \
      \( -name 'swift-frontend*.ips' -o -name 'swift-frontend*.crash' \
         -o -name 'clang*.ips'        -o -name 'clang*.crash' \
         -o -name 'SwiftCompile*.ips'                                 \) \
      -mtime -1 \
      -exec cp {} "$CRASH_DIR/" \; 2>/dev/null || true
  fi
done
crash_count=$(find "$CRASH_DIR" -type f | wc -l | tr -d ' ')
echo "ℹ️  Collected $crash_count crash report(s)"

# ---------------------------------------------------------------------------
# 3. Pods xcconfig snapshot — proves what flags Xcode was actually given.
# ---------------------------------------------------------------------------
echo "🧾 Snapshotting Pods xcconfigs..."
PODS_TSF="$IOS_APP_DIR/Pods/Target Support Files"
if [[ -d "$PODS_TSF" ]]; then
  XCCONFIG_DIR="$DIAG_DIR/PodsXcconfigs"
  mkdir -p "$XCCONFIG_DIR"
  # Flatten so artifact browsing is one click deep.
  find "$PODS_TSF" -name '*.xcconfig' -print0 \
    | while IFS= read -r -d '' f; do
        # Convert "Pods/Target Support Files/Capacitor/Capacitor.release.xcconfig"
        # into "Capacitor__Capacitor.release.xcconfig"
        rel="${f#$PODS_TSF/}"
        flat="${rel//\//__}"
        cp "$f" "$XCCONFIG_DIR/$flat"
      done
fi

# ---------------------------------------------------------------------------
# 4. Headline summary file — first thing anyone opens.
# ---------------------------------------------------------------------------
SUMMARY="$DIAG_DIR/SUMMARY.txt"
{
  echo "Xcode Cloud build diagnostics"
  echo "============================="
  echo "Build:        ${CI_BUILD_NUMBER:-unknown}"
  echo "Workflow:     ${CI_WORKFLOW:-unknown}"
  echo "Xcode:        ${CI_XCODE_VERSION:-unknown}"
  echo "macOS:        ${CI_MACOS_VERSION:-unknown}"
  echo "Generated:    $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo ""
  echo "Files in this bundle:"
  echo "  SUMMARY.txt              — this file"
  echo "  errors.txt               — extracted error: lines from xcresult"
  echo "  build-results.json       — full xcresulttool JSON dump"
  echo "  resultbundle.xcresult/   — raw .xcresult bundle"
  echo "  CrashReports/            — swift-frontend / clang .ips crash reports"
  echo "  PodsXcconfigs/           — flattened snapshot of every Pods xcconfig"
  echo ""
  if [[ -s "$DIAG_DIR/errors.txt" ]]; then
    echo "First 50 error lines:"
    echo "---------------------"
    head -n 50 "$DIAG_DIR/errors.txt"
  fi
} > "$SUMMARY"

echo "📄 SUMMARY.txt:"
cat "$SUMMARY"

# ---------------------------------------------------------------------------
# 5. Make sure these paths are dumped into the build log too — Xcode Cloud
#    captures stdout, so the URLs/paths are at least searchable in the log.
# ---------------------------------------------------------------------------
echo ""
echo "📦 Diagnostics bundled at: $DIAG_DIR"
ls -la "$DIAG_DIR" 2>/dev/null || true
echo ""
if [[ -d "$DIAG_DIR/CrashReports" ]]; then
  echo "💥 Crash reports collected:"
  ls -la "$DIAG_DIR/CrashReports" 2>/dev/null || true
fi

echo "✅ post-xcodebuild diagnostics collection complete"
exit 0
