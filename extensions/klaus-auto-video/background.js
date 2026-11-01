// JavaScript / background.js / Firefox WebExtension MV2 / fal.ai Sandbox queue
"use strict";
const KEY = "klausAutoVideoV1";
const WAIT_STEP = 3500, RESULT_TIMEOUT = 20 * 60 * 1000;
let state, loopPromise = null, persistQueue = Promise.resolve();
const blank = () => ({
  prompts: [], cursor: 0, status: "idle", tabId: null,
  calibration: { prompt: null, run: null },
  freeOnly: true, inFlight: null, history: [], log: [], updatedAt: Date.now()
});
function log(msg) {
  state.log.unshift(new Date().toLocaleTimeString("pt-BR") + " | " + msg);
  state.log = state.log.slice(0, 100);
}
function persist() {
  state.updatedAt = Date.now();
  const snapshot = JSON.parse(JSON.stringify(state));
  persistQueue = persistQueue.catch(() => {}).then(() => browser.storage.local.set({[KEY]: snapshot}));
  return persistQueue;
}
function sendTab(op, args={}) {
  if (!state.tabId) throw Error("Nenhuma aba fal.ai vinculada. Abra fal.ai/sandbox e clique em Vincular aba.");
  return browser.tabs.sendMessage(state.tabId, {op, ...args});
}
function pause(reason, review=true) {
  if (state.status === "running") state.status = "paused";
  if (reason) {
    log(reason);
    if (review && state.inFlight && state.prompts[state.inFlight.index]) {
      state.prompts[state.inFlight.index].status = "review";
      state.prompts[state.inFlight.index].error = reason;
    }
  }
  return persist();
}
async function ensureTab() {
  if (state.tabId) {
    try {
      const t = await browser.tabs.get(state.tabId);
      if (t.url && /^https:\/\/fal\.ai\/sandbox(?:[/?#]|$)/.test(t.url)) return t;
    } catch (_) {}
  }
  const tabs = await browser.tabs.query({});
  const tab = tabs.find(t => /^https:\/\/fal\.ai\/sandbox(?:[/?#]|$)/.test(t.url || ""));
  if (!tab) throw Error("Abra primeiro https://fal.ai/sandbox no Firefox.");
  state.tabId = tab.id;
  await persist();
  return tab;
}
async function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function awaitResult(index, flight) {
  while (state.status === "running" && state.cursor === index) {
    if (Date.now() - flight.startedAt > RESULT_TIMEOUT) throw Error("Aguardando o vídeo há mais de 20 min. Revisão manual para evitar geração duplicada.");
    let media;
    try { media = await sendTab("SCAN", {calibration: state.calibration}); }
    catch (e) { throw Error("Aba fal.ai indisponível ou recarregada: " + e.message); }
    // Only fresh media, never an output that was already on the page before Run.
    const fresh = (media.videos || []).filter(v => v.url && !flight.baseline.includes(v.url));
    const eligible = fresh.find(v => /^https?:\/\//i.test(v.url)) || fresh.find(v => /^blob:/i.test(v.url));
    if (eligible) return eligible;
    await delay(WAIT_STEP);
  }
  return null;
}
async function awaitDownload(downloadId) {
  const limit = Date.now() + 15 * 60 * 1000;
  while (state.status === "running") {
    const found = await browser.downloads.search({id:downloadId});
    if (!found.length) throw Error("Download não encontrado no Firefox.");
    if (found[0].state === "complete") return found[0];
    if (found[0].state === "interrupted") throw Error("Download interrompido: " + (found[0].error || "erro desconhecido"));
    if (Date.now() > limit) throw Error("Download demorou mais de 15 min. Verifique o gerenciador do Firefox.");
    await delay(1500);
  }
  return null;
}
async function processQueue() {
  try {
    await ensureTab();
    for (; state.status === "running" && state.cursor < state.prompts.length;) {
      const index = state.cursor, item = state.prompts[index];
      let flight = state.inFlight;
      if (item.status === "done") { state.cursor++; await persist(); continue; }
      if (flight && flight.index !== index) throw Error("Estado de geração inconsistente. Revise o lote antes de continuar.");
      if (flight && flight.stage !== "submitted" && flight.stage !== "downloading") {
        throw Error("Envio anterior pode ter ocorrido. Não será repetido automaticamente.");
      }
      if (!flight) {
        const baseline = await sendTab("SCAN", {calibration: state.calibration});
        if (!baseline.promptFound || !baseline.runFound) throw Error("Campo do prompt ou botão Run não encontrado. Calibre os dois na página.");
        if (baseline.operation !== "video") {
          throw Error("Sandbox não está em Text To Video. Selecione Text To Video antes de iniciar; nada foi enviado.");
        }
        if (baseline.modelCount > 1) throw Error("Mais de um modelo detectado. Deixe apenas um modelo de vídeo selecionado.");
        if (state.freeOnly && baseline.free !== true) {
          throw Error("A interface não confirma custo grátis no controle Run. Sem clicar para evitar cobrança.");
        }
        await sendTab("FILL", {selector:state.calibration.prompt, text:item.text});
        const check = await sendTab("READ_PROMPT", {selector:state.calibration.prompt});
        if (!check || check.text !== item.text) throw Error("Campo não confirmou o prompt integral; envio cancelado.");
        flight = {index, stage:"sending", baseline:baseline.videos.map(v => v.url), startedAt:Date.now()};
        state.inFlight = flight; item.status = "sending"; await persist();
        // After persistence, a failure must NEVER auto-reclick Run.
        let result;
        try { result = await sendTab("RUN", {selector:state.calibration.run, requireFree:state.freeOnly}); }
        catch (e) { throw Error("Envio incerto, verificar na página antes de retomar: " + e.message); }
        if (!result || !result.clicked) throw Error("Não foi possível confirmar clique no Run; revisão manual necessária.");
        flight.stage = "submitted"; item.status = "generating"; log("Enviado " + (index+1) + "/" + state.prompts.length); await persist();
      }
      if (flight.stage === "submitted") {
        const result = await awaitResult(index, flight);
        if (!result) return;
        flight.videoUrl = result.url; flight.stage = "downloading";
        item.status = "downloading"; await persist();
        let id;
        try {
          id = await browser.downloads.download({
            url:result.url,
            filename:"KLAUS AUT. FLUX MAX/ESPANHOL/klaus_ext_es_" + String(index + 1).padStart(2,"0") + ".mp4",
            conflictAction:"uniquify", saveAs:false
          });
        } catch (e) { throw Error("Falha ao iniciar download do vídeo: " + e.message); }
        flight.downloadId = id;
        await persist();
      }
      if (flight.stage === "downloading") {
        if (!Number.isInteger(flight.downloadId)) throw Error("Download foi preparado, mas ID não foi confirmado. Verifique a pasta Downloads.");
        const download = await awaitDownload(flight.downloadId);
        if (!download) return;
        // Firefox resolves relative filenames under its own configured download folder.
        // Require that the completed file is actually under the requested ESPANHOL folder.
        const savedTo = (download.filename || "").replace(/\\/g, "/");
        const savedParts=savedTo.toLowerCase().split("/").filter(Boolean);
        const baseIndex=savedParts.findIndex(x=>x==="download"||x==="downloads");
        const wantedName="klaus_ext_es_"+String(index + 1).padStart(2,"0");
        const actualName=savedParts[baseIndex+3]||"";
        const inSpanishFolder=baseIndex>=0 &&
          savedParts[baseIndex+1]==="klaus aut. flux max" &&
          savedParts[baseIndex+2]==="espanhol" &&
          actualName.startsWith(wantedName) && actualName.endsWith(".mp4");
        if (!inSpanishFolder) {
          item.filename = savedTo; item.videoUrl = flight.videoUrl;
          throw Error("Download terminado fora da pasta ESPANHOL: " + savedTo +
            ". Configure Downloads do Firefox para /storage/emulated/0/Download, mova o arquivo e confirme manualmente. Nao sera baixado novamente.");
        }
        item.status = "done"; item.filename = savedTo; item.videoUrl = flight.videoUrl;
        item.error = null; item.finishedAt = Date.now();
        state.history.push({index,filename:item.filename,finishedAt:item.finishedAt});
        log("Baixado " + (index+1) + "/" + state.prompts.length + ": " + item.filename);
        state.inFlight = null; state.cursor = index + 1;
        await persist();
      }
    }
    if (state.status === "running" && state.cursor >= state.prompts.length) {
      state.status = "complete";
      log("Lote concluído: " + state.cursor + " vídeos."); await persist();
    }
  } catch (e) {
    await pause(e.message, true);
  } finally {
    loopPromise = null;
  }
}
async function launch() {
  if (loopPromise) return;
  if (state.status === "running") loopPromise = processQueue();
}
async function handle(msg, sender) {
  await ready;
  switch(msg.type) {
  case "GET": return state;
  case "BIND": {
    const t = await ensureTab();
    await browser.tabs.update(t.id, {active:true});
    return {ok:true,tabId:t.id};
  }
  case "OPEN_SITE": { const t=await browser.tabs.create({url:"https://fal.ai/sandbox"}); state.tabId=t.id;await persist();return {ok:true}; }
  case "OPEN_PANEL": { await browser.tabs.create({url:browser.runtime.getURL("dashboard.html")}); return {ok:true}; }
  case "LOAD": {
    if (state.status === "running" || state.inFlight) throw Error("Existe uma geração em andamento ou para revisão. Não sobrescreva a fila.");
    if (!Array.isArray(msg.prompts) || msg.prompts.length < 1 || msg.prompts.length > 25) throw Error("Envie de 1 a 25 prompts.");
    const texts=msg.prompts.map(s => String(s || "").trim());
    if (texts.some(s=>!s || s.length > 20000)) throw Error("Prompt vazio ou maior que 20.000 caracteres.");
    state.prompts=texts.map((text,id)=>({id,text,status:"waiting"}));
    state.cursor=0;state.inFlight=null;state.status="idle";state.history=[];
    log("Fila carregada: "+texts.length+" prompts.");await persist();return {ok:true};
  }
  case "PICK": {
    await ensureTab();
    return sendTab("PICK", {kind:msg.kind});
  }
  case "PICKED": {
    if (!["prompt","run"].includes(msg.kind) || typeof msg.selector!=="string") return {ok:false};
    state.calibration[msg.kind] = msg.selector;log("Elemento marcado: "+msg.kind);
    await persist();return {ok:true};
  }
  case "TEST_FOLDER": {
    if (state.status==="running") throw Error("Teste de pasta indisponível com o lote executando.");
    const sample="KLAUS AUTO VIDEO\\nTeste de pasta do Firefox. Nao e um video. Nenhum credito gasto.\\n";
    const downloadId=await browser.downloads.download({
      url:"data:text/plain;charset=utf-8,"+encodeURIComponent(sample),
      filename:"KLAUS AUT. FLUX MAX/ESPANHOL/klaus_ext_teste_destino.txt",
      conflictAction:"uniquify",saveAs:false
    });
    let result=null;
    for(let n=0;n<24;n++) {
      await delay(450);
      const found=await browser.downloads.search({id:downloadId});
      if(found.length && found[0].state==="complete"){result=found[0];break;}
      if(found.length && found[0].state==="interrupted")throw Error("Download de teste falhou: "+(found[0].error||"desconhecido"));
    }
    if(!result)throw Error("Download de teste ainda nao terminou. Veja o gerenciador de downloads do Firefox.");
    const path=(result.filename||"").replace(/\\/g,"/");
    const chunks=path.toLowerCase().split("/").filter(Boolean);
    const root=chunks.findIndex(x=>x==="download"||x==="downloads");
    const correct=root>=0 && chunks[root+1]==="klaus aut. flux max" &&
      chunks[root+2]==="espanhol" &&
      (chunks[root+3]||"").startsWith("klaus_ext_teste_destino") &&
      (chunks[root+3]||"").endsWith(".txt");
    if(correct)log("Pasta ESPANHOL verificada pelo download de teste: "+path);
    else log("Pasta do Firefox nao corresponde ao Download do Android: "+path);
    await persist();
    return {ok:correct,path,note:correct?"Pasta correta. O teste TXT ficou salvo.":"Altere a pasta-base do Firefox para /storage/emulated/0/Download e teste novamente."};
  }
  case "FREE_ONLY": {if(state.status==="running")throw Error("Pause antes de alterar.");state.freeOnly=!!msg.value;await persist();return {ok:true};}
  case "START": {
    if (!state.prompts.length) throw Error("Carregue os prompts.");
    if (state.inFlight) throw Error("Há envio pendente de revisão. Não clique novamente para evitar duplicar.");
    if (!state.calibration.prompt || !state.calibration.run) throw Error("Marque o campo Prompt e o botão Run no site.");
    if (state.cursor >= state.prompts.length) throw Error("Fila já concluída.");
    await ensureTab();state.status="running";log("Iniciando lote.");await persist();launch();return {ok:true};
  }
  case "PAUSE": {if(state.status==="running"){state.status="paused";log("Pausa solicitada. Nenhum novo vídeo será enviado.");await persist();}return {ok:true};}
  case "RESUME": {
    if(state.status!=="paused")throw Error("A fila não está pausada.");
    if(state.inFlight && !["submitted","downloading"].includes(state.inFlight.stage))throw Error("Envio incerto. Revise a página antes de continuar.");
    state.status="running";log("Retomando sem repetir envios.");await persist();launch();return {ok:true};
  }
  case "REVIEW_DONE": {
    if(state.status==="running")throw Error("Pause antes de confirmar.");
    if(!state.inFlight)throw Error("Nenhum envio sob revisão.");
    const i=state.inFlight.index;
    state.prompts[i].status="done";state.prompts[i].error=null;state.prompts[i].finishedAt=Date.now();
    state.history.push({index:i,filename:"Confirmado manualmente",finishedAt:Date.now()});
    state.cursor=i+1;state.inFlight=null;log("Vídeo "+(i+1)+" confirmado manualmente.");await persist();return {ok:true};
  }
  case "REVIEW_RETRY": {
    if(state.status==="running")throw Error("Pause antes de reenviar.");
    if(!state.inFlight)throw Error("Nenhum envio sob revisão.");
    const i=state.inFlight.index;
    state.prompts[i].status="waiting";state.prompts[i].error=null;
    state.inFlight=null;log("Reenvio liberado manualmente para "+(i+1)+"; pode consumir outra geração.");await persist();return {ok:true};
  }
  case "SKIP": {
    if(state.status==="running")throw Error("Pause antes de pular.");
    if(!state.prompts[state.cursor])throw Error("Sem item pendente.");
    state.prompts[state.cursor].status="skipped";state.cursor++;state.inFlight=null;
    log("Item pulado pelo usuário.");await persist();return {ok:true};
  }
  default: throw Error("Ação desconhecida.");
  }
}
const ready=browser.storage.local.get(KEY).then(data=>{
  state=data[KEY] || blank();
  if(state.status==="running"){state.status="paused";state.log.unshift("Sessão reiniciada; pausa de segurança para evitar duplicações.");return persist();}
});
browser.runtime.onMessage.addListener((msg,sender)=>handle(msg,sender).catch(e=>({error:e.message})));
browser.browserAction.onClicked.addListener(()=>browser.tabs.create({url:browser.runtime.getURL("dashboard.html")}));
