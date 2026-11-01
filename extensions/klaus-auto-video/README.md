# Klaus Auto Video | Firefox (Klaus OS VNC :3)

Extensão local para **até 25 prompts** com geração sequencial na interface web **https://fal.ai/sandbox**, download automático de resultados MP4 detectados e retomada sem reenviar trabalhos incertos.

**Atenção:** o número de gerações gratuitas é definido pela fal.ai, não pela extensão. Se a interface deixar de indicar "Free" perto de Run, o envio é bloqueado por padrão. Não usa API, não ativa pagamento, não compra créditos.

## Instalar no Firefox do Klaus OS

1. Inicie o Klaus OS KDE no TigerVNC :3 (127.0.0.1:5903). O robô FLUX MAX fica no Termux:X11 :0 e porta CDP 9261.
2. No Termux, atualize o projeto: `cd "$HOME/Klaus-OS" && git pull --ff-only`.
3. No **Firefox do KDE**, abra `about:debugging#/runtime/this-firefox`.
4. Clique em **Load Temporary Add-on** / **Carregar extensão temporária**.
5. Escolha o arquivo `/data/data/com.termux/files/home/Klaus-OS/extensions/klaus-auto-video/manifest.json`.
6. No Firefox, clique no ícone da extensão **Klaus Auto Video**, que abre um painel em uma aba persistente.
7. Abra `https://fal.ai/sandbox`. Escolha **Video → Text to Video**, somente **um** modelo com geração gratuita. Defina formato 9:16 e duração desejada manualmente. A extensão não altera esses ajustes.
8. No painel, clique **Vincular aba**, depois **Marcar campo Prompt**. Na aba fal.ai, clique no campo. Volte ao painel, clique **Marcar botão Run** e selecione o botão Run na página. A captura impede o clique de realmente gerar durante a marcação.
9. Cole até 25 prompts separados por linha `---`, ou por títulos `PROMPT 01 —`, `PROMPT 02 —`, etc. Também importa `.json` com lista `prompts` e `.txt` com separadores.
10. Clique **Salvar fila**. Confira a indicação **Free** no Sandbox e então **Iniciar lote**.

O painel avança somente após o Firefox confirmar o download na pasta `Downloads/KlausAutoVideo/`. Se o site mudar o HTML, o envio falhar ou uma geração não for detectada, a fila pausa em revisão sem clicar em Run outra vez. Preserve os vídeos e confirme manualmente se necessário.

## Limitações técnicas atuais

- A extensão **ainda não foi testada contra o DOM real de uma conta logada**. Botões, vídeos e cotas podem variar; os seletores são calibrados pelo usuário.
- O detector automático procura URLs de elementos HTML5 `video`, `source` ou links MP4/WebM. Se fal.ai usar somente streaming não exposto, botão JS de download ou `blob:` inacessível à extensão, a geração pausa em revisão e pede validação, em vez de marcar falso sucesso.
- A opção **Somente geração grátis** detecta rótulo de gratuidade na interface, não garante a contabilidade no servidor; confira a quota mostrada na fal.ai antes de Iniciar.
- Instalação via `about:debugging` é **temporária** e precisa ser repetida ao reiniciar o Firefox; os dados da fila ficam no perfil do Firefox via `browser.storage.local`.
- A página do Sandbox precisa ficar aberta no Firefox do KDE, com Android evitando suspensão de processos.
- O período de espera por resultado é de 20 minutos; se exceder, o item vira "Revisar". A extensão nunca reenvia automaticamente um trabalho incerto.
- Nenhuma função da extensão usa Playwright, Kie.ai, CDP 9261, DBus do Plasma ou terminal para executar os prompts.

## Fluxo de estados

`waiting → sending → generating → downloading → done`

Se houver falha: `review`. O usuário pode **confirmar baixado**, **liberar reenvio** ou **pular**. A retomada nunca repete uma geração sem consentimento explícito.

## Desenvolvimento

Arquivos: `manifest.json`, `background.js`, `content.js`, `dashboard.html`, `dashboard.css`, `dashboard.js`.

Verificação: `node --check` nos três módulos JavaScript, mais validação do manifesto no CI.
