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
8. **Configure Downloads do Firefox Linux uma vez:** Firefox → Configurações → Geral → Arquivos e Aplicativos → Downloads → Salvar arquivos em → selecione `/storage/emulated/0/Download` usando `Ctrl+L` no seletor de pastas, se necessário. Não selecione `ESPANHOL` como raiz: a extensão criará a subpasta `KLAUS AUT. FLUX MAX/ESPANHOL` dentro de `Download`. Se o caminho ainda não estiver acessível, use o atalho Termux `$HOME/storage/downloads` como pasta-base, que corresponde ao mesmo armazenamento compartilhado.
9. No painel, clique **Vincular aba**, depois **Marcar campo Prompt**. Na aba fal.ai, clique no campo. Volte ao painel, clique **Marcar botão Run** e selecione o botão Run na página. A captura impede o clique de realmente gerar durante a marcação.
10. Cole até 25 prompts separados por linha `---`, ou por títulos `PROMPT 01 —`, `PROMPT 02 —`, etc. Também importa `.json` com lista `prompts` e `.txt` com separadores.
11. Clique **Salvar fila**. Confira a indicação **Free** no Sandbox e então **Iniciar lote**.

O painel avança após o Firefox confirmar o download na subpasta `KLAUS AUT. FLUX MAX/ESPANHOL/` relativa à pasta-base atual do Firefox. No teste real, essa pasta-base era `$HOME/Downloads`, dentro do Termux. Se o site mudar o HTML, o envio falhar ou uma geração não for detectada, a fila pausa em revisão sem clicar em Run outra vez. Preserve os vídeos e confirme manualmente se necessário.

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

## Destino de vídeos espanhóis

Pasta compartilhada do robô: `/storage/emulated/0/Download/KLAUS AUT. FLUX MAX/ESPANHOL`.

A extensão usa nomes não conflitantes `klaus_ext_es_01.mp4` … `klaus_ext_es_25.mp4` e `conflictAction: uniquify`, preservando arquivos anteriores. A API de downloads do Firefox **não permite escolher caminho absoluto para cada arquivo**: o caminho relativo é `KLAUS AUT. FLUX MAX/ESPANHOL/klaus_ext_es_NN.mp4`, resolvido em relação à pasta-base configurada no Firefox.

Se a extensão detectar que o download concluído foi salvo fora de ESPANHOL, **ela pausa e não reenvia** a geração. O usuário pode mover o arquivo manualmente e confirmar o item sem perda de créditos.

A própria extensão verifica operação Text To Video antes do envio. O print inicial mostrava Text To Image com 3 modelos, o que impediria a fila de 25 vídeos; altere para Text To Video e um modelo gratuito.

## Continuação após o primeiro vídeo

O primeiro ciclo foi validado no aparelho: `klaus_ext_es_01.mp4` com vídeo 704x1280, áudio e duração 15,04 s. A página fal.ai mostra o cartão do resultado e um ícone "Download" que aparece ao passar o mouse. A extensão já consegue baixar o MP4 **diretamente do URL de mídia detectado**, sem movimentar o mouse nem clicar repetidamente. Quando existir também link de download no cartão, o detector coleta esse URL. Um botão JS sem URL reconhecível não será clicado às cegas.

Para evitar geração repetida ao continuar o mesmo lote:
1. Depois da atualização do GitHub, carregue a extensão via `Reload` em `about:debugging` (o estado concluído é persistido no perfil do Firefox).
2. Cole no painel apenas os prompts **02 a 25**; não cole o PROMPT 01 de novo.
3. Use **Acrescentar prompts 02–25 sem repetir o 01**, NÃO **Salvar fila**. O painel conserva o trabalho 01 como concluído e o próximo será 02/25.
4. Confira que a fila mostra 25, com 1 concluído e 24 pendentes. Só então clique em Iniciar.
5. A fila comprovada continua sequencial: enviar → aguardar a renderização → baixar → avançar. O modo de envio paralelo a cada 3 segundos ainda não foi validado e não está ligado automaticamente.

**Destino real confirmado:** `$HOME/Downloads/KLAUS AUT. FLUX MAX/ESPANHOL/` é a pasta-base atual do Firefox Linux no Termux. O arquivo teste e o MP4 foram salvos lá. Ao final, é possível copiar sem remover os originais para `/storage/emulated/0/Download/KLAUS AUT. FLUX MAX/ESPANHOL/`, preservando vídeos existentes. A verificação da extensão confirma a subpasta `ESPANHOL`, mas o arquivo pode estar no armazenamento privado do Termux. Não confunda um teste de subpasta aprovado com acesso aos Downloads compartilhados do Android.

## Monitoramento com o AVNC minimizado

Depois que o primeiro vídeo foi comprovado por `ffprobe`, o usuário observou que o Sandbox só atualizava a prévia quando voltava manualmente à aba. O Firefox pode reduzir timers e adiar renderização de abas inativas. A partir desta versão, **Iniciar** e **Retomar** selecionam automaticamente a aba `fal.ai/sandbox`; durante a espera da mídia, o monitor volta a selecioná-la se estiver em outra aba. Se o Sandbox informar `document.hidden`, o monitor tenta reativar a janela Firefox sem recarregar o site. A aba Klaus Auto Video pode ser consultada, mas o monitor pode retornar ao Sandbox para manter o vídeo ativo.

**Importante:** isso melhora o processamento de abas em segundo plano, mas não garante execução contínua se o Android matar ou suspender o processo Termux/Firefox. Não abre uma nova sessão, não interrompe o robô FLUX MAX :0, não altera a fila, não repete prompt e não gera fora da ação do usuário.

**Aplicação da atualização sem perder trabalhos em andamento:**
1. `git pull --ff-only` apenas atualiza os arquivos no disco.
2. O código novo só entra em vigor depois de `Reload` no `about:debugging`.
3. Se a extensão estiver **Executando**, não use `Reload` direto. Aguarde um ponto seguro no painel e acione **Pausar**; certifique-se que não está na fase "Enviando". Confirme que o JSON de progresso foi exportado (contém prompts e situação da fila).
4. `Reload` no Firefox carrega a versão nova sem apagar o armazenamento `browser.storage.local`. Abra novamente o painel e confirme a posição, a quantidade de baixados e o status.
5. Se o trabalho atual estiver em "Gerando" ou "Baixando", use **Retomar** e a extensão continuará acompanhando o mesmo item, sem clicar novamente em Run. Se estiver em "Revisar", confira primeiro a situação na fal.ai e não reenvie sem certeza.
6. Ao iniciar ou retomar, o Firefox selecionará o Sandbox automaticamente. Pode-se minimizar o visualizador AVNC do Android, mas manter Termux, VNC e Firefox abertos.

## Detector rápido de resultados (02/11/2026)

**Sintoma relatado:** fal.ai já mostra o vídeo pronto, mas o Klaus Auto Video só baixa após o usuário voltar à aba, abrir o painel ou rolar a página, deixando a sequência lenta.

**Mudança implementada:** a extensão observa eventos de inserção de `video`/`source`/links de mídia no DOM com `MutationObserver` e avisa imediatamente o background (`MEDIA_SIGNAL`). O monitor não depende somente do temporizador antigo de 3,5 segundos: agora tem verificação de contingência em ~1,7 s e detecção de conclusão de download via `browser.downloads.onChanged`. A cada algumas verificações, tenta rolar automaticamente a lista de resultados até o topo para fazer o site montar a prévia preguiçosa (*lazy loading*). Continua exigindo URL de mídia nova após a geração, sem clicar cegamente no botão de download, nem reexecutar Run.

**Limitação real:** só é possível detectar mídia que fal.ai expôs no DOM ou nas URLs dos vídeos; caso a página não busque/monte o resultado até ser reativada, uma extensão que depende do DOM não consegue assegurar funcionamento totalmente independente. A otimização **não converteu o lote em envios paralelos**. Um modo paralelo exigiria mapear cada job ao vídeo certo e testar a quota antes do uso.

**Como aplicar sem perder a fila:** não reinicie o Firefox ou a extensão em `Enviando`. Clique **Pausar** depois que um job indicar `Gerando` ou `Baixando`, confirme que está pausado e mantenha seu JSON de backup. Atualize `git pull --ff-only`, use `Reload` em `about:debugging`, volte ao painel e confirme a posição antes de clicar **Retomar**. Uma atualização dos arquivos do GitHub por si só não altera a extensão que já está em execução.

## Importação sem digitar pelo AVNC (novo lote de 25)

Depois que o lote anterior concluiu, a tela mostra **📥 Importar + preparar NOVO lote (25)**.

1. Coloque o arquivo `.json` (objeto `{"prompts":["PROMPT 01 — ...",...,"PROMPT 25 — ..."]}`) ou `.txt` (25 blocos iniciados por `PROMPT 01 —` a `PROMPT 25 —`) nos **Downloads do Android**.
2. Na janela de seleção de arquivos do **Firefox Linux no AVNC**, abra **Home → storage → downloads**. Isso funciona quando o Termux recebeu permissão para acesso ao armazenamento compartilhado (`termux-setup-storage`). Também é possível escolher arquivo da pasta Linux `~/Downloads`.
3. Clique no arquivo uma única vez. O JavaScript do Firefox o lê e valida **instantaneamente**, sem colar 25 roteiros nem simular digitação de teclado pelo VNC.
4. O painel mostra a confirmação antes de alterar qualquer fila. Com o lote anterior concluído, a extensão salva um arquivo de progresso em **`~/Downloads/KLAUS AUT. FLUX MAX/ESPANHOL/Backups/klaus_lote_NN_progresso.json`**, arquiva uma cópia no armazenamento privado da extensão e então prepara o lote novo.
5. Verifique que aparece **25 na fila, 0 baixados, 1/25**. Abra `fal.ai/sandbox`, mantenha o formulário Text To Video expandido, selecione um modelo com indicação Free, 15s e 9:16, confirme a conta e a quota livre, e clique **▶ Iniciar lote**. A importação nunca inicia uma geração por conta própria.
6. Os MP4 ficam na mesma pasta do Firefox, com nomes próprios por lote: `klaus_ext_es_lote02_01.mp4` a `klaus_ext_es_lote02_25.mp4`, sem sobrescrever os anteriores. Continue usando `conflictAction: uniquify`.

O preenchimento automático do campo no Sandbox já usa o setter nativo JavaScript com eventos `input`/`change`, não uma sequência de teclas. O que demorava era colar milhares de caracteres **manualmente através do VNC**. A importação pelo navegador elimina essa etapa.

**Segurança:** só é permitido substituir a fila quando a anterior terminou e não possui geração em andamento, revisões ou downloads pendentes. Se o arquivo não contiver exatamente 25 prompts com os números 01–25, ou se o backup não puder ser confirmado, a fila anterior permanece. Não há remoção de MP4, perfis, backups ou pastas.

O Sandbox pode oferecer menos que 25 gerações gratuitas na conta atual. A importação não confere quota; a extensão ainda verifica a indicação Free antes de cada Run e para quando não a encontrar.

