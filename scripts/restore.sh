#!/usr/bin/env bash
# Bash / scripts/restore.sh / Termux Bash / Android XFCE restore
set -Eeuo pipefail
DATA="$HOME/.local/share/klaus-os"
test -s "$DATA/last-backup" || { echo 'Nenhum backup registrado.' >&2; exit 1; }
read -r BACKUP < "$DATA/last-backup"
test -d "$BACKUP/xfce4" || { echo "Backup incompleto: $BACKUP" >&2; exit 1; }
if pgrep -af 'xfce4-session' | grep -qE '(^|[[:space:]])(xfce4-session|[^[:space:]]*/xfce4-session)($|[[:space:]])'; then
  echo '[KLAUS OS] Feche a sessao XFCE antes de restaurar. Nenhum arquivo modificado.'
  exit 1
fi
if pgrep -x xfconfd >/dev/null 2>&1; then
  echo '[KLAUS OS] xfconfd ainda esta ativo. Feche-o antes de restaurar.'
  exit 1
fi
mkdir -p "$HOME/.config/xfce4" "$HOME/.config/gtk-3.0"
cp -a "$BACKUP/xfce4/." "$HOME/.config/xfce4/"
if test -f "$BACKUP/gtk.css"; then
  cp -p "$BACKUP/gtk.css" "$HOME/.config/gtk-3.0/gtk.css"
elif test -f "$BACKUP/gtk.css.did-not-exist"; then
  # Remove apenas a secao Klaus, preservando eventual CSS criado depois.
  python3 - "$HOME/.config/gtk-3.0/gtk.css" <<'PY'
from pathlib import Path
import sys
path=Path(sys.argv[1])
if path.exists():
    value=path.read_text()
    start='/* KLAUS_OS_11_START */'
    end='/* KLAUS_OS_11_END */'
    if start in value and end in value and value.index(start)<value.index(end):
        a=value.index(start); b=value.index(end,a)+len(end)
        path.write_text(value[:a]+value[b:])
PY
fi
echo "[KLAUS OS] Configuracao restaurada de $BACKUP. Abra o XFCE novamente."
