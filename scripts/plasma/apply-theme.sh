#!/usr/bin/env bash
# Bash / scripts/plasma/apply-theme.sh / Termux Bash / Klaus OS KDE Plasma VNC :3
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATA="$HOME/.local/share/klaus-os"
CONF="$DATA/vnc/config"
WALL="$DATA/vnc/wallpapers/klaus-os-blue-v1.png"
LOG="$DATA/logs"
log() { printf '[KLAUS THEME] %s\n' "$*"; }
fail() { printf '[KLAUS THEME] ERRO: %s\n' "$*" >&2; exit 1; }
command -v pgrep >/dev/null || fail 'pgrep nao disponivel.'
command -v python3 >/dev/null || fail 'Python 3 nao encontrado.'
command -v dbus-send >/dev/null || fail 'dbus-send nao encontrado. O KDE precisa do DBus.'
test -f "$ROOT/scripts/plasma/klaus-layout.js" || fail 'Arquivo de layout nao encontrado.'
test -f "$ROOT/scripts/wallpaper.py" || fail 'Gerador de wallpaper nao encontrado.'

# Attach only to the real Plasma process inside the :3 VNC session.
# Do not infer a shared session bus or touch Termux:X11's :0 display.
found=0
for pid in $(pgrep -x plasmashell 2>/dev/null || true); do
    test -r "/proc/$pid/environ" || continue
    target_display=''
    target_bus=''
    target_config=''
    while IFS= read -r -d '' entry; do
        case "$entry" in
            DISPLAY=*) target_display="${entry#DISPLAY=}" ;;
            DBUS_SESSION_BUS_ADDRESS=*) target_bus="${entry#DBUS_SESSION_BUS_ADDRESS=}" ;;
            XDG_CONFIG_HOME=*) target_config="${entry#XDG_CONFIG_HOME=}" ;;
        esac
    done < "/proc/$pid/environ"
    if test "$target_display" = ':3' && test "$target_config" = "$CONF" && test -n "$target_bus"; then
        export DISPLAY=:3
        export DBUS_SESSION_BUS_ADDRESS="$target_bus"
        export XDG_CONFIG_HOME="$CONF"
        export XDG_RUNTIME_DIR="$DATA/vnc/runtime"
        export XDG_DATA_HOME="$DATA/vnc/data"
        export XDG_CACHE_HOME="$DATA/vnc/cache"
        export XDG_SESSION_TYPE=x11
        export XDG_CURRENT_DESKTOP=KDE
        export QT_QPA_PLATFORM=xcb
        found=1
        log "Plasma correto detectado: PID $pid, DISPLAY=:3."
        break
    fi
done
test "$found" -eq 1 || fail 'Nao encontrei o Plasma :3 e seu DBus isolado. Nada foi alterado.'

# Preflight DBus before any persistent changes.
if ! dbus-send --session --print-reply --dest=org.freedesktop.DBus \
        /org/freedesktop/DBus org.freedesktop.DBus.GetNameOwner \
        string:org.kde.plasmashell >/dev/null 2>&1; then
    fail 'plasmashell nao responde no DBus desta sessao. Nada foi alterado.'
fi

mkdir -p "$DATA/backups" "$DATA/vnc/wallpapers" "$LOG"
BACKUP="$DATA/backups/plasma-vnc-theme-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$BACKUP"
for name in plasma-org.kde.plasma.desktop-appletsrc kdeglobals plasmarc kwinrc; do
    if test -f "$CONF/$name"; then cp -p "$CONF/$name" "$BACKUP/$name"; fi
done
log "Backup das configuracoes atuais: $BACKUP"

if test ! -s "$WALL"; then
    log 'Gerando wallpaper azul 1600x720 offline...'
    python3 "$ROOT/scripts/wallpaper.py" "$WALL"
fi

# Compose source from checked-in JavaScript with correctly JSON-quoted file URL.
SCRIPT_FILE="$BACKUP/klaus-layout.applied.js"
python3 - "$ROOT/scripts/plasma/klaus-layout.js" "$WALL" "$SCRIPT_FILE" <<'PY'
# Python / inline / Python 3 / prepare Plasma JS
import json
import pathlib
import sys
template = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
wallpaper_uri = pathlib.Path(sys.argv[2]).resolve().as_uri()
assert template.count("__WALLPAPER_URI__") == 2
script = template.replace("__WALLPAPER_URI__", json.dumps(wallpaper_uri))
pathlib.Path(sys.argv[3]).write_text(script, encoding="utf-8")
PY

log 'Aplicando tema escuro e novo layout sem reiniciar o Plasma...'
if command -v plasma-apply-colorscheme >/dev/null 2>&1; then
    plasma-apply-colorscheme BreezeDark || log 'BreezeDark indisponivel; tema atual mantido.'
fi
dbus-send --session --print-reply \
    --dest=org.kde.plasmashell /PlasmaShell \
    org.kde.PlasmaShell.evaluateScript "string:$(cat "$SCRIPT_FILE")"
log 'Visual aplicado. Veja a janela Klaus OS no AVNC.'
log "Para restaurar, preservamos copia das configuracoes em: $BACKUP"
