#!/bin/sh
# PZ AI Cut – spouštěč konektoru pro Codex (macOS). Najde Node.js: systémový, nebo ten, který má v sobě aplikace Codex.
D="$(cd "$(dirname "$0")" && pwd)"
S="$D/server/index.js"
for n in "$(command -v node 2>/dev/null)" "$CODEX_MCP_NODE_PATH" /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -n "$n" ] && [ -x "$n" ]; then exec "$n" "$S"; fi
done
for app in /Applications/Codex.app "$HOME/Applications/Codex.app" /Applications/ChatGPT.app; do
  if [ -d "$app" ]; then
    n="$(find "$app/Contents/Resources" -type f -name node -perm -u+x 2>/dev/null | head -n 1)"
    if [ -n "$n" ]; then exec "$n" "$S"; fi
  fi
done
echo "PZ AI Cut: Node.js was not found. Install it from https://nodejs.org and restart Codex." >&2
exit 1
