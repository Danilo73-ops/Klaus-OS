#!/usr/bin/env bash
# Bash / scripts/plasma/vnc-session.sh / Termux Bash / KDE Plasma X11 on TigerVNC :2
set -Eeuo pipefail
DATA="$HOME/.local/share/klaus-os"
# Isolated KDE preferences and runtime. Existing XFCE and robot stay untouched.
mkdir -p "$DATA/vnc/runtime" "$DATA/vnc/config" "$DATA/vnc/data" "$DATA/vnc/cache" "$DATA/logs"
chmod 700 "$DATA/vnc/runtime"
export DISPLAY=:2
export XDG_RUNTIME_DIR="$DATA/vnc/runtime"
export XDG_CONFIG_HOME="$DATA/vnc/config"
export XDG_DATA_HOME="$DATA/vnc/data"
export XDG_CACHE_HOME="$DATA/vnc/cache"
export XDG_SESSION_TYPE=x11
export XDG_CURRENT_DESKTOP=KDE
export DESKTOP_SESSION=plasma
export KDE_FULL_SESSION=true
export KDE_SESSION_VERSION=6
export QT_QPA_PLATFORM=xcb
export QT_X11_NO_MITSHM=1
export LIBGL_ALWAYS_SOFTWARE=1
export KWIN_COMPOSE=N
unset WAYLAND_DISPLAY
# Only this session receives DISPLAY=:2 and its own D-Bus session.
if command -v startplasma-x11 >/dev/null 2>&1; then
  exec dbus-launch --exit-with-session startplasma-x11
fi
if command -v startplasma >/dev/null 2>&1; then
  exec dbus-launch --exit-with-session startplasma
fi
echo '[KLAUS PLASMA] KDE Plasma X11 nao encontrado.' >&2
exit 127
