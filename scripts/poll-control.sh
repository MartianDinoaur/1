#!/usr/bin/env bash
set -euo pipefail

unit_name="favorite-things-poll.service"
unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
unit_file="$unit_dir/$unit_name"
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

write_unit() {
  mkdir -p "$unit_dir"
  cat > "$unit_file" <<EOF
[Unit]
Description=Favorite Things Poll
After=network.target

[Service]
Type=simple
WorkingDirectory=$project_dir
ExecStart=/usr/bin/env node server.js
Restart=on-failure
RestartSec=5
Environment=HOST=0.0.0.0
Environment=PORT=4173

[Install]
WantedBy=default.target
EOF
}

case "${1:-status}" in
  on)
    write_unit
    systemctl --user daemon-reload
    systemctl --user enable --now "$unit_name"
    systemctl --user status --no-pager "$unit_name" | sed -n '1,12p'
    ;;
  off)
    systemctl --user disable --now "$unit_name" || true
    rm -f "$unit_file"
    systemctl --user daemon-reload
    echo "Favorite Things Poll is stopped and disabled."
    ;;
  status)
    systemctl --user status --no-pager "$unit_name"
    ;;
  *)
    echo "Usage: $0 {on|off|status}" >&2
    exit 2
    ;;
esac
