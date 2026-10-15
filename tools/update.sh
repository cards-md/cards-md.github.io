#!/usr/bin/env bash
# tools/update.sh [CARDS]: the site made again from a cards.md checkout (default: proper.md's
# pinned one): cards.md's editing bench over a public GitHub repo, read only
# (`node proto/build.js --site`), one page for every path; its commit noted.
set -euo pipefail
cd "$(dirname "$0")/.."
CARDS="${1:-$HOME/Projects/proper.md/vendor/cards.md}"
node "$CARDS/proto/build.js" --site > index.html
cp index.html 404.html
git -C "$CARDS" rev-parse --short HEAD > cards.version
echo "cards.md $(cat cards.version): index.html and 404.html, $(du -h index.html | cut -f1)"
