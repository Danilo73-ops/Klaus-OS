#!/usr/bin/env bash
# Bash / install.sh / Termux Bash / Android XFCE on Termux:X11
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="$HOME/.local/share/klaus-os"
CONFIG="$HOME/.config"
log() { printf '[KLAUS OS 11] %s\n' "$*"; }
fail() { printf '[KLAUS OS 11] ERRO: %s\n' "$*" >&2; exit 1; }

command -v xfconf-query >/dev/null || fail 'XFCE ausente.'
command -v xfce4-panel >/dev/null || fail 'xfce4-panel ausente.'
command -v python3 >/dev/null || fail 'Python ausente. Execute pkg install python -y'
test -f "$ROOT/scripts/wallpaper.py" || fail 'Gerador de wallpaper ausente.'
# O nome do executavel no Android pode nao coincidir com pgrep -x.
pid="$(pgrep -af 'xfce4-session' 2>/dev/null | awk '($2 == "xfce4-session" || $2 ~ /\/xfce4-session$/) {print $1;exit}' || true)"
test -n "$pid" || fail 'Abra primeiro o desktop XFCE no Termux:X11.'
if test -r "/proc/$pid/environ"; then
  while IFS= read -r -d '' item; do
    case "$item" in DBUS_SESSION_BUS_ADDRESS=*|XAUTHORITY=*) export "$item";; esac
  done < "/proc/$pid/environ"
fi
export DISPLAY=:1
xfconf-query -c xfce4-panel -p /panels >/dev/null 2>&1 || fail 'XFCE nao acessivel pela sessao Termux atual.'
test -d "$CONFIG/xfce4" || fail 'Nenhuma configuracao XFCE para salvar.'

# Backup fechado antes de qualquer mudanca; nunca apaga os antigos.
mkdir -p "$DATA/backups"
BACKUP="$DATA/backups/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$BACKUP"
cp -a "$CONFIG/xfce4" "$BACKUP/xfce4"
for ch in xfce4-panel xfce4-desktop xsettings xfwm4; do
  xfconf-query -c "$ch" -lv > "$BACKUP/$ch.before.txt" 2>/dev/null || true
done
if test -f "$CONFIG/gtk-3.0/gtk.css"; then
  cp -p "$CONFIG/gtk-3.0/gtk.css" "$BACKUP/gtk.css"
else
  touch "$BACKUP/gtk.css.did-not-exist"
fi
printf '%s\n' "$BACKUP" > "$DATA/last-backup"
log "Backup salvo: $BACKUP"

setting() {
  local channel="$1" key="$2" typ="$3" val="$4"
  if xfconf-query -c "$channel" -p "$key" >/dev/null 2>&1; then
    xfconf-query -c "$channel" -p "$key" -s "$val" >/dev/null
  else
    xfconf-query -c "$channel" -p "$key" -n -t "$typ" -s "$val" >/dev/null
  fi
}
plugin_kind() { xfconf-query -c xfce4-panel -p "/plugins/plugin-$1" 2>/dev/null || true; }
ids="$(xfconf-query -c xfce4-panel -p /panels | grep -E '^[0-9]+$' || true)"
test -n "$ids" || fail 'Painel XFCE nao encontrado.'
PRIMARY="$(printf '%s\n' "$ids" | head -n1)"
printf '%s\n' "$ids" | grep -qx 1 && PRIMARY=1 || true
PANEL="/panels/panel-$PRIMARY"
main="$(xfconf-query -c xfce4-panel -p "$PANEL/plugin-ids" | grep -E '^[0-9]+$' || true)"
test -n "$main" || fail 'Painel sem plugins; mantendo a configuracao original.'

# Painel escuro, tela inteira, dimensao adequada para toque na resolucao 1600x720.
log 'Montando taskbar escura estilo Windows 11...'
setting xfce4-panel "$PANEL/position" string 'p=12;x=0;y=0'
setting xfce4-panel "$PANEL/size" int 52
setting xfce4-panel "$PANEL/icon-size" int 29
setting xfce4-panel "$PANEL/nrows" int 1
setting xfce4-panel "$PANEL/length" int 100
setting xfce4-panel "$PANEL/length-adjust" bool false
setting xfce4-panel "$PANEL/position-locked" bool true
setting xfce4-panel "$PANEL/autohide-behavior" int 0
setting xfce4-panel "$PANEL/background-style" int 1
setting xfce4-panel "$PANEL/background-alpha" int 98
# XFCE 4.20: cor RGBA de quatro doubles, sem imagem do painel.
xfconf-query -c xfce4-panel -p "$PANEL/background-rgba" -r >/dev/null 2>&1 || true
xfconf-query -c xfce4-panel -p "$PANEL/background-rgba" -n -a \
  -t double -s 0.023 -t double -s 0.054 \
  -t double -s 0.105 -t double -s 0.98 >/dev/null || log 'Cor rgba indisponivel, usando CSS escuro.'

# Seletores restritos ao painel; conserva regras GTK do usuario.
CSS_DIR="$CONFIG/gtk-3.0"
mkdir -p "$CSS_DIR"
CSS="$CSS_DIR/gtk.css"
python3 - "$CSS" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
old = path.read_text() if path.exists() else ""
start = "/* KLAUS_OS_11_START */"
end = "/* KLAUS_OS_11_END */"
while start in old and end in old and old.index(start) < old.index(end):
    a = old.index(start)
    b = old.index(end, a) + len(end)
    old = old[:a] + old[b:]
theme = """
/* KLAUS_OS_11_START */
#XfcePanelWindow, .xfce4-panel.background {
  background-color: rgba(6, 14, 29, 0.98);
  color: #e8f5ff;
  border-top: 1px solid rgba(107, 177, 255, 0.23);
}
.xfce4-panel button {
  background-image: none;
  background-color: transparent;
  border: none;
  box-shadow: none;
  color: #e8f5ff;
  border-radius: 8px;
  padding: 2px 5px;
}
.xfce4-panel button:hover, .xfce4-panel button:checked {
  background-color: rgba(58, 132, 219, 0.30);
}
.xfce4-panel .tasklist button:checked {
  border-bottom: 2px solid #37c7ff;
}
window#whiskermenu-window {
  background-color: #101e34;
}
/* KLAUS_OS_11_END */
"""
path.write_text(old.rstrip() + "\n\n" + theme + "\n")
PY
setting xsettings /Net/ThemeName string Adwaita-dark
setting xsettings /Gtk/ThemeName string Adwaita-dark
setting xsettings /Net/IconThemeName string Adwaita
setting xsettings /Gtk/FontName string 'Sans 11'
setting xsettings /Xft/Antialias int 1
setting xsettings /Xft/Hinting int 1
setting xsettings /Xft/HintStyle string hintslight

# Reaproveita launchers ja instalados no dock, agrupando-os na taskbar.
menu=''; launchers=''; tasks=''; tray=''; clock=''; other=''
for id in $main; do
  case "$(plugin_kind "$id")" in
    whiskermenu|applicationsmenu) test -n "$menu" || menu="$id" ;;
    launcher) launchers="$launchers $id" ;;
    tasklist|windowmenu) tasks="$tasks $id" ;;
    systray|notification-plugin|statusnotifier|pulseaudio) tray="$tray $id" ;;
    clock|datetime) clock="$clock $id" ;;
    pager|separator|showdesktop|actions) ;;
    *) other="$other $id" ;;
  esac
done
test -n "$menu" || fail 'Menu Iniciar nao encontrado; sem alterar o painel.'
# Whisker ja foi instalado na V1; usa o menu atual se nao estiver disponivel.
if dpkg -s xfce4-whiskermenu-plugin 2>/dev/null | grep -q 'Status: install ok installed'; then
  setting xfce4-panel "/plugins/plugin-$menu" string whiskermenu
  setting xfce4-panel "/plugins/plugin-$menu/button-title" string 'Klaus OS'
  setting xfce4-panel "/plugins/plugin-$menu/button-icon" string start-here
  setting xfce4-panel "/plugins/plugin-$menu/show-button-title" bool true
fi
for id in $tasks; do
  setting xfce4-panel "/plugins/plugin-$id/flat-buttons" bool true
  setting xfce4-panel "/plugins/plugin-$id/show-labels" bool false
done

# Separadores expansivos colocam o grupo central no meio, sem novas barras.
max_id="$(xfconf-query -c xfce4-panel -p /plugins -l 2>/dev/null | sed -nE 's@^/plugins/plugin-([0-9]+)(/.*)?$@\1@p' | sort -n | tail -n1)"
max_id="${max_id:-100}"
SPACERS="$DATA/spacers"
if test -s "$SPACERS"; then
  read -r left right < "$SPACERS"
else
  left=$((max_id+1))
  right=$((max_id+2))
  printf '%s %s\n' "$left" "$right" > "$SPACERS"
fi
for id in "$left" "$right"; do
  kind="$(plugin_kind "$id")"
  if test -n "$kind" && test "$kind" != separator; then
    fail "ID de plugin $id ocupado, nenhuma reorganizacao realizada."
  fi
  setting xfce4-panel "/plugins/plugin-$id" string separator
  setting xfce4-panel "/plugins/plugin-$id/expand" bool true
  setting xfce4-panel "/plugins/plugin-$id/style" int 0
done

ordered="$left $menu $launchers $tasks $right $other $tray $clock"
set --
for id in $ordered; do set -- "$@" -t int -s "$id"; done
xfconf-query -c xfce4-panel -p "$PANEL/plugin-ids" -a "$@" >/dev/null
xfconf-query -c xfce4-panel -p /panels -a -t int -s "$PRIMARY" >/dev/null

# Wallpaper PNG offline para evitar falhas de loaders SVG do Termux.
WALL_DIR="$DATA/wallpapers"
mkdir -p "$WALL_DIR"
WALL="$WALL_DIR/klaus-os-11.png"
log 'Gerando wallpaper 1600x720 em PNG...'
python3 "$ROOT/scripts/wallpaper.py" "$WALL"
test -s "$WALL" || fail 'Falha ao gerar wallpaper PNG.'
# Descobre os nomes reais dos monitores do XFCE; nao usa somente monitor0.
props="$(xfconf-query -c xfce4-desktop -p /backdrop -l 2>/dev/null | grep -E '/(last-image|image-path|image-style)$' || true)"
bases="$(printf '%s\n' "$props" | sed -nE 's@/(last-image|image-path|image-style)$@@p' | sort -u)"
test -n "$bases" || bases='/backdrop/screen0/monitor0/workspace0'
for base in $bases; do
  setting xfce4-desktop "$base/last-image" string "$WALL"
  setting xfce4-desktop "$base/image-style" int 5
done
# Evita acidentalmente acessar pastas fora do HOME e preserva atalhos existentes.
mkdir -p "$HOME/Desktop"
if test ! -e "$HOME/Desktop/Klaus Firefox.desktop"; then
  cat > "$HOME/Desktop/Klaus Firefox.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Firefox
Exec=firefox
Icon=firefox
Terminal=false
EOF
  chmod 755 "$HOME/Desktop/Klaus Firefox.desktop"
fi
if test ! -e "$HOME/Desktop/Klaus Terminal.desktop"; then
  cat > "$HOME/Desktop/Klaus Terminal.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Terminal
Exec=xfce4-terminal
Icon=utilities-terminal
Terminal=false
EOF
  chmod 755 "$HOME/Desktop/Klaus Terminal.desktop"
fi
xfdesktop --reload >/dev/null 2>&1 || true
xfce4-panel -r >/dev/null 2>&1 || log 'Se a barra nao atualizar, reabra a sessao grafica.'
log 'Klaus OS 11 aplicado. Abra o Termux:X11!'
log "Backup: $BACKUP"
