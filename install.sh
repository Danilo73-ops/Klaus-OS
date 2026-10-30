#!/usr/bin/env bash
# Bash / install.sh / Termux Bash / Android XFCE on Termux:X11
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")" && pwd)"
DATA="$HOME/.local/share/klaus-os"
BACKUP_ROOT="$DATA/backups"
log() { printf '[KLAUS OS] %s\n' "$*"; }
fail() { printf '[KLAUS OS] ERRO: %s\n' "$*" >&2; exit 1; }
command -v xfconf-query >/dev/null || fail 'XFCE ausente. Execute: pkg install xfce'
command -v xfce4-panel >/dev/null || fail 'xfce4-panel ausente.'
test -s "$ROOT/assets/klaus-night.svg" || fail 'Wallpaper SVG ausente.'
pid="$(pgrep -x xfce4-session 2>/dev/null | head -n1 || true)"
test -n "$pid" || fail 'Abra primeiro a sessão XFCE no Termux:X11.'
if test -r "/proc/$pid/environ"; then
  while IFS= read -r -d '' item; do
    case "$item" in DBUS_SESSION_BUS_ADDRESS=*|DISPLAY=*|XAUTHORITY=*) export "$item" ;; esac
  done < "/proc/$pid/environ"
fi
export DISPLAY=:1
xfconf-query -c xfce4-panel -p /panels >/dev/null 2>&1 || fail 'Não foi possível acessar o XFCE ativo. Abra o X11 e tente novamente.'
test -d "$HOME/.config/xfce4" || fail 'Configuração XFCE ainda não existe; não há backup seguro.'
mkdir -p "$BACKUP_ROOT"
BACKUP="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$BACKUP"
cp -a "$HOME/.config/xfce4" "$BACKUP/xfce4"
for ch in xfce4-panel xfce4-desktop xsettings xfwm4; do
  xfconf-query -c "$ch" -lv > "$BACKUP/$ch.txt" 2>/dev/null || true
done
if command -v termux-x11-preference >/dev/null; then
  timeout 4 termux-x11-preference list > "$BACKUP/x11-prefs.txt" 2>/dev/null || true
fi
printf '%s\n' "$BACKUP" > "$DATA/last-backup"
log "Backup criado: $BACKUP"

setting() {
  local ch="$1" key="$2" typ="$3" val="$4"
  if xfconf-query -c "$ch" -p "$key" >/dev/null 2>&1; then
    xfconf-query -c "$ch" -p "$key" -s "$val" >/dev/null
  else
    xfconf-query -c "$ch" -p "$key" --create -t "$typ" -s "$val" >/dev/null
  fi
}
ids="$(xfconf-query -c xfce4-panel -p /panels | grep -E '^[0-9]+$' || true)"
test -n "$ids" || fail 'Nenhum painel XFCE identificado.'
PRIMARY="$(printf '%s\n' "$ids" | head -n1)"
if printf '%s\n' "$ids" | grep -qx 1; then PRIMARY=1; fi
panel="/panels/panel-$PRIMARY"
log 'Montando barra de tarefas inferior estilo PC...'
setting xfce4-panel "$panel/position" string 'p=12;x=0;y=0'
setting xfce4-panel "$panel/size" int 42
setting xfce4-panel "$panel/length" int 100
setting xfce4-panel "$panel/length-adjust" bool false
setting xfce4-panel "$panel/position-locked" bool true
setting xfce4-panel "$panel/autohide-behavior" int 0
setting xfce4-panel "$panel/background-style" int 1
setting xfce4-panel "$panel/background-alpha" int 92

if command -v pkg >/dev/null && ! dpkg -s xfce4-whiskermenu-plugin 2>/dev/null | grep -q 'Status: install ok installed'; then
  log 'Tentando instalar o menu Iniciar Whisker...'
  pkg install -y xfce4-whiskermenu-plugin || log 'Whisker indisponível; menu atual mantido.'
fi
whisker=false
if test -f "$PREFIX/lib/xfce4/panel/plugins/libwhiskermenu.so"; then whisker=true; fi

main="$(xfconf-query -c xfce4-panel -p "$panel/plugin-ids" 2>/dev/null | grep -E '^[0-9]+$' || true)"
new=""
pins=""
for id in $ids; do
  test "$id" = "$PRIMARY" && continue
  others="$(xfconf-query -c xfce4-panel -p "/panels/panel-$id/plugin-ids" 2>/dev/null | grep -E '^[0-9]+$' || true)"
  for p in $others; do
    kind="$(xfconf-query -c xfce4-panel -p "/plugins/plugin-$p" 2>/dev/null || true)"
    if test "$kind" = launcher && ! printf ' %s ' "$main $pins" | grep -q " $p "; then pins="$pins $p"; fi
  done
done
for p in $main; do
  kind="$(xfconf-query -c xfce4-panel -p "/plugins/plugin-$p" 2>/dev/null || true)"
  if test "$kind" = applicationsmenu && test "$whisker" = true; then
    xfconf-query -c xfce4-panel -p "/plugins/plugin-$p" -s whiskermenu >/dev/null || true
  fi
  new="$new $p"
  case "$kind" in applicationsmenu|whiskermenu) new="$new $pins" ;; esac
done
if test -n "$new"; then
  set --
  for p in $new; do set -- "$@" -t int -s "$p"; done
  xfconf-query -c xfce4-panel -p "$panel/plugin-ids" "$@" -a >/dev/null
fi
xfconf-query -c xfce4-panel -p /panels -t int -s "$PRIMARY" -a >/dev/null

log 'Aplicando tema escuro, fontes e wallpaper...'
setting xsettings /Net/ThemeName string Adwaita-dark
setting xsettings /Net/IconThemeName string Adwaita
setting xsettings /Gtk/FontName string 'Sans 11'
setting xsettings /Xft/Antialias int 1
setting xsettings /Xft/Hinting int 1
setting xsettings /Xft/HintStyle string hintslight
WALL_DIR="$DATA/wallpapers"
mkdir -p "$WALL_DIR"
cp -f "$ROOT/assets/klaus-night.svg" "$WALL_DIR/klaus-night.svg"
wall_props="$(xfconf-query -c xfce4-desktop -p /backdrop -l 2>/dev/null | grep '/last-image$' || true)"
test -n "$wall_props" || wall_props='/backdrop/screen0/monitor0/workspace0/last-image'
for prop in $wall_props; do
  setting xfce4-desktop "$prop" string "$WALL_DIR/klaus-night.svg"
  setting xfce4-desktop "$(dirname "$prop")/image-style" int 5
done
xfce4-panel -r >/dev/null 2>&1 || log 'Reabra o XFCE se a barra não atualizar.'
xfdesktop --reload >/dev/null 2>&1 || true
log 'Klaus OS V1 aplicado. Confira no Termux:X11.'
log "Backup: $BACKUP"
