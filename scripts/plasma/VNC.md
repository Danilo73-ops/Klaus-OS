# Klaus OS Plasma | Sessao independente via TigerVNC

O Termux:X11 instalado no aparelho rejeita uma segunda conexao de servidor X11 enquanto o robo opera em :0. Nao tente iniciar um segundo termux-x11; isso gera "already has an active X server connection".

## Solucao

- Robo: servidor Termux:X11 :0, Chrome com porta CDP 9261, processos intactos.
- Klaus OS: servidor TigerVNC independente :2, porta localhost 5902, KDE Plasma X11 e sessao D-Bus separada.
- O KDE usa configuracoes isoladas em ~/.local/share/klaus-os/vnc/.
- Para visualizar: um aplicativo VNC Viewer Android em 127.0.0.1:5902. Um portal web no navegador pode ser adicionado depois com noVNC.

## Iniciar

    cd "$HOME/Klaus-OS" && git pull --ff-only && bash -n scripts/plasma/start-vnc.sh && bash scripts/plasma/start-vnc.sh

Na primeira execucao, o script pode instalar tigervnc (sem remover pacotes) e solicitar senha VNC. Digite-a apenas no terminal, nao envie a senha no chat.

## Operacao

Nao use comandos globais de kill. O script nao para nenhum processo. Se o display :2 ou a porta 5902 estiverem ocupados, ele se recusa a iniciar outro servidor.

A visualizacao VNC e local; acesso pela rede nao foi habilitado. O Firefox e sua extensao serao configurados apos confirmar KDE funcional.

Para investigar erros veja os logs no diretorio ~/.vnc/.

## Limitacoes

VNC usa processamento adicional e o KDE pode precisar de desativacao de compositor. No Android, o navegador pode suspender quando o app vai ao segundo plano. O servidor VNC independe do aplicativo Termux:X11.
