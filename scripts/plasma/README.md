# Klaus OS Plasma | segunda sessao segura

O robo FLUX MAX usa atualmente o display **:0** e CDP **9261**.
O Klaus OS com KDE Plasma deve usar **:2**, sem tocar no servidor :0, no Chrome nem nos perfis do robo.

## Instalar pacotes
Em outra aba do Termux:

```bash
cd "$HOME/Klaus-OS" && git pull --ff-only && bash scripts/plasma/install.sh
```

## Iniciar KDE em :2

```bash
cd "$HOME/Klaus-OS" && bash scripts/plasma/start-test.sh
```

O Termux:X11 instalado no celular nao reconhece a opcao `-tag`. A versao atual do script abre :2 **sem -tag**. Isso mantem os processos de :0 separados, mas as duas sessoes **podem compartilhar a mesma janela do aplicativo Android Termux:X11**. Portanto, nao garantimos duas janelas Android simultaneas. Para janelas graficas totalmente independentes, sera preciso instalar uma versao compativel com -tag ou usar outro visualizador separado, sem interromper o robo atual.

## Log de diagnostico

`~/.local/share/klaus-os/logs/plasma-test.log`

Nenhum script de KDE mata, reinicia ou edita os arquivos do robo.
