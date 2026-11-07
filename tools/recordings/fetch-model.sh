#!/usr/bin/env bash
# Downloads the ukrainian-tts v6.0.0 model files from the upstream release
# into the given folder and checks each by SHA256; a mismatch fails (ADR 0083).
#
#   tools/recordings/fetch-model.sh <model-dir>
set -euo pipefail

release="https://github.com/robinhad/ukrainian-tts/releases/download/v6.0.0"
sums="$(cd "$(dirname "$0")" && pwd)/model.sha256"
dir="${1:?Usage: fetch-model.sh <model-dir>}"

mkdir -p "$dir"
cd "$dir"
while read -r _ file; do
  [ -f "$file" ] || curl -fsSL --retry 3 -o "$file" "$release/$file"
done < "$sums"
sha256sum --check --strict "$sums"
