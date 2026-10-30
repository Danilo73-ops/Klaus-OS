# Klaus OS 11

Desktop Linux personalizado, inspirado no Windows 11, para Termux + Termux:X11 no Android. Nao altera o Android nem instala o Windows.

## O que vem na V11
- Barra de tarefas inferior escura, com menu Klaus OS, aplicativos e relogio.
- Icones ampliados para o modo paisagem do celular.
- Firefox, Terminal e gerenciador de arquivos do XFCE.
- Wallpaper azul em PNG 1600x720, gerado localmente sem dependencia de imagem externa.
- Menu Whisker, quando ja estiver instalado.
- Backup das configuracoes XFCE e das regras GTK antes de cada atualizacao.

## Instalar / atualizar
Com a sessao XFCE **ativa** no Termux:X11, abra outra sessao Termux e execute:

```bash
cd "$HOME/Klaus-OS" && git pull --ff-only && bash -n install.sh && python3 -m py_compile scripts/wallpaper.py && bash install.sh
```

Se ainda nao tiver clonado o repositorio, use:

```bash
git clone https://github.com/Danilo73-ops/Klaus-OS.git "$HOME/Klaus-OS" && bash "$HOME/Klaus-OS/install.sh"
```

## Restauracao
O instalador registra os backups em `~/.local/share/klaus-os/backups/`.
Feche a sessao XFCE e o serviço xfconfd antes de rodar:

```bash
bash "$HOME/Klaus-OS/scripts/restore.sh"
```

## Limites e evolucao
As barras, menu e atalhos sao plugins **reais** do XFCE, nao uma imagem estatica. O shell GTK pode variar conforme a versao do Termux. Integracoes de Wi-Fi/bateria nativas do Android nao estao garantidas e os programas Windows .exe nao executam diretamente.
