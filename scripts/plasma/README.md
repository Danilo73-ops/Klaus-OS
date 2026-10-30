# Klaus OS Plasma

Mantem o XFCE em :1. Instala Plasma 6 nativo do repositorio Termux X11, e testa em :2 sem apagar projetos.

Instalar: cd "$HOME/Klaus-OS" && git pull --ff-only && bash -n scripts/plasma/install.sh && bash scripts/plasma/install.sh

Testar: cd "$HOME/Klaus-OS" && bash scripts/plasma/start-test.sh

Voltar ao XFCE: bash "$HOME/Klaus-OS/scripts/plasma/start-xfce.sh"

Logs em ~/.local/share/klaus-os/logs/. Instalacao pode consumir dados moveis.
