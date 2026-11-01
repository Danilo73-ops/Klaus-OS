# Klaus OS Plasma | Sessao independente via TigerVNC

O Termux:X11 instalado no aparelho rejeita abrir outro servidor enquanto o robo opera em :0.

## Organizacao

- Robo FLUX MAX: Termux:X11 :0, Chromium via CDP 9261, nenhum processo interrompido.
- Klaus OS: TigerVNC :3, porta TCP 5903 restrita a localhost, KDE Plasma e configuracoes isoladas.
- O display :2 ficou com lock cujo PID nao e verificavel pelo Termux. Nunca modificar nem remover esse lock automaticamente.

## Iniciar

```bash
cd "$HOME/Klaus-OS" && git pull --ff-only && bash -n scripts/plasma/start-vnc.sh && bash scripts/plasma/start-vnc.sh
```

Se :3 ja estiver ocupado, o inicializador para sem alterar arquivos de outro processo. O programa nao usa kill nem reinicia o robo.

Na primeira execucao, o script pode instalar TigerVNC e solicitar senha VNC. Nao compartilhe a senha no chat.

Para visualizar no Android, conectar um visualizador VNC a 127.0.0.1:5903 (ou ao display :3). No futuro, pode-se oferecer noVNC no navegador, quando Plasma estiver confirmado funcional.

## Diagnostico

Use os logs produzidos em ~/.vnc/; por exemplo, `tail -n 40 ~/.vnc/localhost:3.log`.

A interface VNC roda independentemente do aplicativo Android Termux:X11, embora ambos compartilhem CPU e RAM do aparelho.
