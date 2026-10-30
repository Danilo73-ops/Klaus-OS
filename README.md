# Klaus OS

Desktop Linux personalizado sobre XFCE e Termux:X11 no Android.

## Instalação

Com o XFCE já aberto no Termux:X11:

```bash
git clone https://github.com/Danilo73-ops/Klaus-OS.git "$HOME/Klaus-OS" && bash "$HOME/Klaus-OS/install.sh"
```

## Atualizações

```bash
cd "$HOME/Klaus-OS" && git pull --ff-only && bash install.sh
```

O instalador salva backup antes de alterar as configurações gráficas. Para desfazer, encerre a sessão XFCE e execute `bash "$HOME/Klaus-OS/scripts/restore.sh"`.

Esta é uma personalização de desktop Linux, não um substituto do Android nem uma instalação do Windows.
