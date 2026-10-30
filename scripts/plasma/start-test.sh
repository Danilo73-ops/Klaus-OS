#!/usr/bin/env bash
# Bash / scripts/plasma/start-test.sh / Termux Bash / Termux:X11 Plasma test
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$HOME/.local/share/klaus-os"
mkdir -p "$DATA/logs"
if ! command -v startplasma-x11 >/dev/null && ! command -v startplasma >/dev/null; then
  echo 'Instale primeiro: bash scripts/plasma/install.sh' >&2
  exit 1
fi
if pgrep -af 'termux-x11' | grep -Eq 'termux-x11([[:space:]]+com\.termux\.x11)?[[:space:]]+:2([[:space:]]|$)'; then
  echo '[KLAUS PLASMA] Sessao :2 ja iniciada. Verifique o Termux:X11.'
  exit 0
fi
echo '[KLAUS PLASMA] Abrindo KDE no display :2 sem fechar o XFCE :1.'
echo "[KLAUS PLASMA] Log: $DATA/logs/plasma-test.log"
termux-x11 :2 -tag plasma -xstartup "dbus-launch --exit-with-session $ROOT/scripts/plasma/session.sh" 2>&1 | tee -a "$DATA/logs/plasma-test.log"
