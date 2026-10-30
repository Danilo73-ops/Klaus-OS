#!/usr/bin/env bash
# Bash / scripts/plasma/start-xfce.sh / Termux Bash / XFCE fallback
set -Eeuo pipefail
if pgrep -af 'xfce4-session' | grep -qE '[[:space:]]xfce4-session([[:space:]]|$)'; then
  echo 'XFCE ja esta ativo na sessao atual do Termux:X11.'
  exit 0
fi
exec termux-x11 :1 -xstartup "dbus-launch --exit-with-session xfce4-session"
