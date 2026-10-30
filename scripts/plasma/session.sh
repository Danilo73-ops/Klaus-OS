#!/usr/bin/env bash
# Bash / scripts/plasma/session.sh / Termux Bash / KDE Plasma 6 X11
set -Eeuo pipefail
DATA="$HOME/.local/share/klaus-os"
mkdir -p "$DATA/runtime"
chmod 700 "$DATA/runtime"
export XDG_RUNTIME_DIR="$DATA/runtime"
export XDG_SESSION_TYPE=x11
export XDG_CURRENT_DESKTOP=KDE
export DESKTOP_SESSION=plasma
export KDE_FULL_SESSION=true
export KDE_SESSION_VERSION=6
export QT_QPA_PLATFORM=xcb
export DISPLAY=:2
export XDG_DATA_DIRS="$PREFIX/share"
if command -v startplasma-x11 >/dev/null; then
  exec startplasma-x11
elif command -v startplasma >/dev/null; then
  exec startplasma
else
  echo '[KLAUS PLASMA] Plasma X11 indisponivel.' >&2
  exit 127
fi
