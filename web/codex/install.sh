#!/bin/sh
# PZ AI Cut – připojení Codexu (macOS). Spuštění v Terminálu:
#   curl -fsSL https://pz-ai-cut.pages.dev/codex/install.sh | sh
# Stáhne konektor do ~/.pz-ai-cut a zapíše ho do nastavení Codexu (~/.codex/config.toml, se zálohou).
set -e
BASE="https://pz-ai-cut.pages.dev/codex"
DIR="$HOME/.pz-ai-cut"
mkdir -p "$DIR/server"
for f in server/index.js server/tools.js start.sh; do curl -fsSL "$BASE/$f" -o "$DIR/$f"; done
chmod +x "$DIR/start.sh"
CH="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$CH"
CFG="$CH/config.toml"
if [ -f "$CFG" ]; then
  cp "$CFG" "$CFG.bak-pz-ai-cut"
  awk '/^[[:space:]]*\[/{skip = ($0 ~ /^[[:space:]]*\[[[:space:]]*mcp_servers\.("?)pz-ai-cut"?[[:space:]]*[].]/)} !skip' "$CFG.bak-pz-ai-cut" > "$CFG"
fi
cat >> "$CFG" <<TOML

# PZ AI Cut (https://pz-ai-cut.pages.dev) - connector to the editor in Chrome
[mcp_servers.pz-ai-cut]
command = "/bin/sh"
args = ["$DIR/start.sh"]
startup_timeout_sec = 30
tool_timeout_sec = 300
default_tools_approval_mode = "approve"
TOML
echo ""
echo "PZ AI Cut je připojený ke Codexu. / PZ AI Cut is connected to Codex."
echo "Ukonči Codex úplně a spusť ho znovu. / Quit Codex completely and start it again."
