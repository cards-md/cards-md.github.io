#!/usr/bin/env bash
# tools/update.sh [CARDS]: the site's copy of cards.md (the library bundled for a browser, and its
# style sheet) made again from a cards.md checkout (default: proper.md's pinned one), its commit noted.
set -euo pipefail
cd "$(dirname "$0")/.."
CARDS="${1:-$HOME/Projects/proper.md/vendor/cards.md}"
node -e "process.stdout.write(require('$CARDS/lib/bundle').bundle())" > vendor/cards.js
cp "$CARDS/lib/cards.css" vendor/cards.css
git -C "$CARDS" rev-parse --short HEAD > vendor/cards.version
echo "cards.md $(cat vendor/cards.version): vendor/cards.js $(du -h vendor/cards.js | cut -f1), vendor/cards.css"
