#!/usr/bin/env bash
# Bash / scripts/plasma/start-vnc.sh / Termux Bash / isolated KDE Plasma TigerVNC :2
set -Eeuo pipefail
DATA="$HOME/.local/share/klaus-os"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$DATA/logs"
log() { printf '[KLAUS VNC] %s\n' "$*"; }
fail() { printf '[KLAUS VNC] ERRO: %s\n' "$*" >&2; exit 1; }
command -v pkg >/dev/null || fail 'Use o Termux nativo.'
command -v dbus-launch >/dev/null || fail 'dbus-launch nao encontrado.'
if ! command -v startplasma-x11 >/dev/null && ! command -v startplasma >/dev/null; then
  fail 'KDE Plasma nao encontrado; execute primeiro o instalador Plasma.'
fi
test -x "$ROOT/scripts/plasma/vnc-session.sh" || fail 'vnc-session.sh ausente ou nao executavel.'

# Do not terminate any X11 server or the robot. Confirm the new display and RFB port.
if pgrep -af '[X]vnc' | grep -Eq '(^|[[:space:]]):2([[:space:]]|$)'; then
  log 'Ja existe Xvnc em :2. Nada foi alterado.'
  exit 0
fi
for socket in "$PREFIX/tmp/.X11-unix/X2" "$TMPDIR/.X11-unix/X2"; do
  if test -S "$socket"; then fail "Display :2 ocupado: $socket"; fi
done
python3 - <<'PY'
import socket, sys
s=socket.socket()
try:
    s.bind(("127.0.0.1", 5902))
except OSError as exc:
    print("[KLAUS VNC] Porta 5902 ocupada: "+str(exc), file=sys.stderr)
    sys.exit(1)
finally:
    s.close()
PY

if ! command -v vncserver >/dev/null 2>&1; then
  log 'TigerVNC ausente. Verificando instalacao sem remover pacotes...'
  if ! apt-cache show tigervnc >/dev/null 2>&1; then
    fail 'tigervnc nao esta disponivel no x11-repo. Confira o repositorio.'
  fi
  SIM="$DATA/logs/tigervnc-apt-simulation.txt"
  apt-get -s install tigervnc > "$SIM" 2>&1 || fail "Falha na simulacao. Verifique: $SIM"
  if grep -Eq '^(Remv |The following packages will be REMOVED:)' "$SIM"; then
    fail "Instalacao removeria pacotes existentes. Verifique: $SIM"
  fi
  pkg install tigervnc -y
fi

# If no VNC password was configured, let the user define it interactively.
# Never print or save the password in the repository or in logs.
if ! test -s "$HOME/.vnc/passwd"; then
  log 'Defina uma senha VNC para acesso local. A senha nao sera exibida.'
  mkdir -p "$HOME/.vnc"
  chmod 700 "$HOME/.vnc"
  vncpasswd
fi
chmod 600 "$HOME/.vnc/passwd"

log 'Iniciando servidor TigerVNC local :2 (127.0.0.1:5902)...'
log 'Nenhuma mudanca no servidor do robo em :0 ou porta CDP 9261.'
vncserver :2 -localhost -geometry 1600x720 -depth 24 \
  -SecurityTypes VncAuth -xstartup "$ROOT/scripts/plasma/vnc-session.sh"
log 'Servidor iniciado. Conecte um visualizador VNC a 127.0.0.1:5902.'
log 'Se nao abrir o desktop, envie o final do log em ~/.vnc/ e nao reinicie o robo.'
