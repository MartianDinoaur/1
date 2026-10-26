#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$script_dir/poll-control.sh" off

echo "Autostart disabled and the poll server stopped."
