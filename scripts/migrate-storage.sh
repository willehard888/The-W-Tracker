#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# migrate-storage.sh
#
# Bulk-copy storage objects from Lovable's Supabase project to the destination.
# Per Lovable's inventory: 65 MB across 19 objects in two PUBLIC buckets
# (feed-images, proof-photos), organised as <user_id>/<filename>.
#
# Strategy:
#   1. List objects from each source bucket via the Storage REST API
#   2. Download to migration/storage/<bucket>/<user_id>/<filename>
#   3. Upload to the destination via the Storage REST API as well
#      (avoids depending on `supabase storage cp` which is finicky on macOS)
#
# Source buckets are PUBLIC, so the download phase needs only the anon key.
# The destination upload phase needs the destination's SERVICE-ROLE key
# (anon doesn't have insert permission to upload arbitrary user paths).
#
# Usage:
#   export SOURCE_REF=zjdljojkgrpgxurugixf
#   export SOURCE_ANON_KEY='eyJ...'         # source project's anon key
#   export DEST_REF=gcwuvijcuzhunkcauzom
#   export DEST_SERVICE_KEY='eyJ...'        # dest project's service_role key
#   bash scripts/migrate-storage.sh
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${SOURCE_REF:?SOURCE_REF is required}"
: "${SOURCE_ANON_KEY:?SOURCE_ANON_KEY is required (Lovable project Settings/API)}"
: "${DEST_REF:?DEST_REF is required}"
: "${DEST_SERVICE_KEY:?DEST_SERVICE_KEY is required (destination project's service_role key)}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${ROOT_DIR}/migration/storage"
mkdir -p "${WORK_DIR}"

SOURCE_BASE="https://${SOURCE_REF}.supabase.co/storage/v1"
DEST_BASE="https://${DEST_REF}.supabase.co/storage/v1"

# List objects under a prefix in a bucket. Recursive: returns leaf paths only.
# Uses a temp file to avoid bash 3.2 process-substitution quirks.
list_recursive() {
  bucket="$1"
  prefix="$2"
  out_file="$3"

  body=$(printf '{"limit":1000,"offset":0,"prefix":"%s","sortBy":{"column":"name","order":"asc"}}' "$prefix")
  page=$(curl -fsS "${SOURCE_BASE}/object/list/${bucket}" \
    -H "apikey: ${SOURCE_ANON_KEY}" \
    -H "Authorization: Bearer ${SOURCE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body")

  # Leaf objects (id != null) → write to out_file
  printf '%s' "$page" | jq -r --arg p "$prefix" '.[] | select(.id != null) | ($p + .name)' >> "$out_file"

  # Folders (id == null) → recurse
  printf '%s' "$page" | jq -r --arg p "$prefix" '.[] | select(.id == null) | ($p + .name + "/")' > "${out_file}.folders"
  while IFS= read -r sub; do
    [ -z "$sub" ] && continue
    list_recursive "$bucket" "$sub" "$out_file"
  done < "${out_file}.folders"
  rm -f "${out_file}.folders"
}

for bucket in feed-images proof-photos; do
  echo "🔍 Walking source bucket: ${bucket}"
  bucket_dir="${WORK_DIR}/${bucket}"
  mkdir -p "${bucket_dir}"

  list_file=$(mktemp)
  list_recursive "$bucket" "" "$list_file"
  obj_count=$(wc -l < "$list_file" | tr -d ' ')
  echo "   found ${obj_count} objects"

  while IFS= read -r path; do
    [ -z "$path" ] && continue
    local_path="${bucket_dir}/${path}"
    mkdir -p "$(dirname "$local_path")"
    if [ -f "$local_path" ]; then
      echo "   skip   ${path}"
      continue
    fi
    echo "   fetch  ${path}"
    curl -fsSL "${SOURCE_BASE}/object/public/${bucket}/${path}" -o "$local_path"
  done < "$list_file"
  rm -f "$list_file"
done

echo
echo "📊 Local mirror sizes:"
du -sh "${WORK_DIR}"/* 2>/dev/null || true
echo

echo "📤 Uploading to destination (${DEST_REF})…"
upload_count=0
fail_count=0
for bucket in feed-images proof-photos; do
  echo "  ── ${bucket} ──"
  bucket_dir="${WORK_DIR}/${bucket}"
  [ -d "$bucket_dir" ] || continue

  # Find every file under bucket_dir, upload with relative path preserved
  while IFS= read -r local_file; do
    rel_path="${local_file#${bucket_dir}/}"
    # x-upsert: true makes re-runs safe (overwrites existing)
    mime=$(file --mime-type -b "$local_file" 2>/dev/null || echo "application/octet-stream")
    if curl -fsS -X POST "${DEST_BASE}/object/${bucket}/${rel_path}" \
         -H "apikey: ${DEST_SERVICE_KEY}" \
         -H "Authorization: Bearer ${DEST_SERVICE_KEY}" \
         -H "Content-Type: ${mime}" \
         -H "x-upsert: true" \
         --data-binary "@${local_file}" > /dev/null; then
      echo "   ✅ ${rel_path}"
      upload_count=$((upload_count + 1))
    else
      echo "   ❌ ${rel_path}"
      fail_count=$((fail_count + 1))
    fi
  done < <(find "$bucket_dir" -type f)
done

echo
echo "📦 Uploaded: ${upload_count}  Failed: ${fail_count}"
if [ "$fail_count" -gt 0 ]; then
  echo "❌ Some uploads failed — re-run script to retry (existing objects are skipped)."
  exit 1
fi
echo "✅ Storage migration complete."
