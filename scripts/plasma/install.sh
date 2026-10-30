#!/usr/bin/env bash
# Bash / scripts/plasma/install.sh / Termux Bash / Android ARM64
set -Eeuo pipefail
DATA="$HOME/.local/share/klaus-os"
mkdir -p "$DATA/logs" "$DATA/backups"
LOG="$DATA/logs/plasma-install-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
say() { printf '[KLAUS PLASMA] %s\n' "$*"; }
die() { printf '[KLAUS PLASMA] ERRO: %s\n' "$*" >&2; exit 1; }

test "$(uname -m)" = aarch64 || die 'Esperado ARM64 (Poco X6 Pro).'
command -v pkg >/dev/null || die 'Abra no Termux nativo.'
command -v xfce4-session >/dev/null || die 'XFCE de reserva nao localizado.'
command -v termux-x11 >/dev/null || die 'Termux:X11 nao encontrado.'
command -v dbus-launch >/dev/null || die 'dbus-launch nao encontrado.'
say "XFCE mantido intacto. Log: $LOG"

BK="$DATA/backups/plasma-before-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$BK"
for name in kdeglobals kwinrc plasmarc plasma-org.kde.plasma.desktop-appletsrc; do
  if test -f "$HOME/.config/$name"; then cp -p "$HOME/.config/$name" "$BK/$name"; fi
done
say "Backup KDE: $BK"

if ! apt-cache show plasma >/dev/null 2>&1; then
  say 'Atualizando indices do repositorio Termux...'
  apt-get update
fi
apt-cache show plasma >/dev/null 2>&1 || die 'Pacote plasma indisponivel. Confira x11-repo.'
set -- plasma
for optional in dolphin konsole systemsettings; do
  if apt-cache show "$optional" >/dev/null 2>&1; then set -- "$@" "$optional"; fi
done
say "Pacotes selecionados: $*"
SIM="$DATA/plasma-apt-simulation.log"
apt-get -s install --no-install-recommends "$@" > "$SIM" 2>&1 || { cat "$SIM"; die 'Simulacao do apt falhou.'; }
if grep -Eq '^(Remv |The following packages will be REMOVED:)' "$SIM"; then
  grep -E '^(Remv |The following packages will be REMOVED:)' "$SIM" || true
  die 'Instalacao removeria pacotes existentes. Interrompida.'
fi
say 'Preflight sem remocoes. Instalando...'
apt-get install -y --no-install-recommends "$@"
if command -v startplasma-x11 >/dev/null; then
  launcher="$(command -v startplasma-x11)"
elif command -v startplasma >/dev/null; then
  launcher="$(command -v startplasma)"
else
  die 'Pacotes instalados, mas startplasma-x11 ausente. Envie o log.'
fi
printf '%s\n' "$launcher" > "$DATA/plasma-launcher"
say "KDE Plasma instalado. Executavel: $launcher"
say 'Proximo passo: bash scripts/plasma/start-test.sh'
