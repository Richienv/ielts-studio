#!/bin/zsh
set -e
cd "$(dirname "$0")/web"
if ! command -v node >/dev/null 2>&1; then
  print 'Node.js is required. Install Node.js 22 or newer, then reopen this launcher.'
  read -k 1
  exit 1
fi
if curl -fsS http://127.0.0.1:4173/ 2>/dev/null | /usr/bin/grep -q 'IELTS Studio'; then
  open http://127.0.0.1:4173/
  exit 0
fi
if [[ ! -d node_modules ]]; then
  npm install
fi
(sleep 2; open http://127.0.0.1:4173/) &
npm run dev
