#!/usr/bin/env bash
# Build @truefoundry/assistant-ui-runtime and pack a timestamped .tgz for ai-truefoundry-chat.
# Usage: scripts/pack-dev.sh PACKS_DIR TIMESTAMP
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 PACKS_DIR TIMESTAMP" >&2
  exit 1
fi

PACKS_DIR="$1"
TIMESTAMP="$2"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
FILENAME="truefoundry-agents-assistant-ui-runtime-${VERSION}-${TIMESTAMP}.tgz"

mkdir -p "$PACKS_DIR"
ABS_PACKS="$(cd "$PACKS_DIR" && pwd)"
OUTPUT="$ABS_PACKS/$FILENAME"

cd "$ROOT"

echo "==> Building @truefoundry/assistant-ui-runtime..." >&2
pnpm build >&2

echo "==> Packing $FILENAME..." >&2
PACKED="$(pnpm pack --pack-destination "$ABS_PACKS" 2>&1 | tail -n 1)"
PACKED_PATH="$ABS_PACKS/$(basename "$PACKED")"

if [[ "$PACKED_PATH" != "$OUTPUT" ]]; then
  mv "$PACKED_PATH" "$OUTPUT"
fi

echo "$OUTPUT"
