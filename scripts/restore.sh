#!/usr/bin/env bash
# Bash / scripts/restore.sh / Termux Bash / Android XFCE restore
set -Eeuo pipefail
DATA="$HOME/.local/share/klaus-os"
test -s "$DATA/last-backup" || { echo 'Nenhum backup registrado.' >&2; exit 1; }
read -r BK < "$DATA/last-backup"
test -d "$BK/xfce4" || { echo "Backup incompleto: $BK" >&2; exit 1; }
if pgrep -x xfce4-session >/dev/null 2>&1 || pgrep -x xfconfd >/dev/null 2>&1; then
  echo 'Encerre a sessão XFCE e xfconfd antes de restaurar. Nada foi modificado.'
  exit 1
fi
mkdir -p "$HOME/.config/xfce4"
cp -a "$BK/xfce4/." "$HOME/.config/xfce4/"
echo "Configuração XFCE restaurada de $BK. Inicie o desktop novamente."
