#!/usr/bin/env bash
# Bash / scripts/plasma/start-test.sh / Termux Bash / Termux:X11 KDE Plasma test
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$HOME/.local/share/klaus-os"
mkdir -p "$DATA/logs"
LOG="$DATA/logs/plasma-test.log"
say() { printf '[KLAUS PLASMA] %s\n' "$*"; }

command -v termux-x11 >/dev/null || { say 'Termux:X11 nao encontrado.'; exit 1; }
if ! command -v startplasma-x11 >/dev/null && ! command -v startplasma >/dev/null; then
  say 'Instale primeiro: bash scripts/plasma/install.sh'
  exit 1
fi

# Nunca reinicia ou modifica o servidor ativo do robo em :0.
# O segundo servidor deve usar um display livre, totalmente separado.
if pgrep -af '[t]ermux-x11' | grep -Eq 'termux-x11([[:space:]]+com\.termux\.x11)?[[:space:]]+:2([[:space:]]|$)'; then
  say 'Display :2 ja tem um servidor ativo. Nao vou inicia-lo novamente.'
  exit 0
fi
for socket in "$TMPDIR/.X11-unix/X2" "/tmp/.X11-unix/X2"; do
  if test -S "$socket"; then
    say "Display :2 ja possui socket X11 ($socket). Nao alterei nada."
    exit 1
  fi
done

say 'Iniciando KDE no display :2. Nao sera enviado sinal aos processos em :0.'
say 'Esta versao do Termux:X11 nao aceita -tag; os displays compartilham a janela Android.'
say 'Ao abrir o Termux:X11, a janela pode alternar para :2. O robo em :0 permanece rodando.'
say "Log: $LOG"

# Nao usar -tag: a instalacao presente rejeita esse parametro.
termux-x11 :2 -xstartup "dbus-launch --exit-with-session $ROOT/scripts/plasma/session.sh" 2>&1 | tee -a "$LOG"
