// JavaScript / background.js / Firefox WebExtension MV2 / fal.ai Sandbox queue
"use strict";
const KEY = "klausAutoVideoV1";
const WAIT_STEP = 3500, RESULT_TIMEOUT = 20 * 60 * 1000;
let state, loopPromise = null, persistQueue = Promise.resolve();
const blank = () => ({
  prompts: [], cursor: 0, status: "idle", tabId: null,
  calibration: { prompt: null, run: null },
  freeOnly: true, inFlight: null, history: [], log: [], batchNo: 1, updatedAt: Date.now()
});
function log(msg) {
  state.log.unshift(new Date().toLocaleTimeString("pt-BR") + " | " + msg);
  state.log = state.log.slice(0, 100);
}
const ARCHIVE_PREFIX="klausAutoVideoArchiveV2_";
function validateBatch(prompts,requireFull=false) {
  if(!Array.isArray(prompts)||!prompts.length||prompts.length>25)
    throw Error("O arquivo precisa ter de 1 a 25 prompts.");
  if(requireFull && prompts.length!==25)
    throw Error("Novo lote requer exatamente 25 prompts. Detectei "+prompts.length+". Nenhuma fila foi alterada.");
  const texts=prompts.map(x=>String(x||"").trim());
  const nums=texts.map((t,i)=>{
    const hit=/^PROMPT\\s+(\\d{1,2})\\s*[-–—:.]/i.exec(t);
    if(!hit || Number(hit[1])!==i+1)
      throw Error("O arquivo precisa conter PROMPT "+String(i+1).padStart(2,"0")+
        " na posição "+(i+1)+". Nenhum lote foi alterado.");
    if(t.length<100 || t.length>20000)
      throw Error("PROMPT "+String(i+1).padStart(2,"0")+" incompleto ou longo demais.");
    return Number(hit[1]);
  });
  return texts;
}
async function archiveAndPrepare(prompts) {
  const texts=validateBatch(prompts,true);
  if(loopPromise || state.status==="running" || state.inFlight) {
    throw Error("Existe geração em andamento. Não mexi na fila.");
  }
  if(state.prompts.length && (state.status!=="complete" ||
    state.cursor!==state.prompts.length ||
    state.prompts.some(p=>p.status!=="done"))) {
    throw Error("O lote anterior tem pendências. Exporte o progresso e conclua antes de começar outro.");
  }
  const old=JSON.parse(JSON.stringify(state));
  const oldNo=Number.isInteger(old.batchNo)&&old.batchNo>0?old.batchNo:1;
  const nextNo=state.prompts.length?oldNo+1:oldNo;
  if(state.prompts.length) {
    // Two independent backups: browser storage AND a JSON download. If the
    // download fails, do not alter the active queue.
    const key=ARCHIVE_PREFIX+String(oldNo).padStart(3,"0")+"_"+Date.now();
    await browser.storage.local.set({[key]:old});
    const raw=JSON.stringify(old,null,2);
    const blob=new Blob([raw],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    try {
      const downloadId=await browser.downloads.download({
        url,
        filename:"KLAUS AUT. FLUX MAX/ESPANHOL/Backups/klaus_lote_"+
          String(oldNo).padStart(2,"0")+"_progresso.json",
        conflictAction:"uniquify",saveAs:false
      });
      const limit=Date.now()+30000;
      let complete=false;
      while(Date.now()<limit) {
        const results=await browser.downloads.search({id:downloadId});
        if(results[0]?.state==="complete"){complete=true;break;}
        if(results[0]?.state==="interrupted")
          throw Error("Backup JSON interrompido: "+(results[0].error||"erro"));
        await delay(350);
      }
      if(!complete) throw Error("Backup JSON não foi confirmado. O lote anterior continua intocado.");
    } finally {URL.revokeObjectURL(url);}
  }
  const next=blank();
  next.batchNo=nextNo;
  next.tabId=old.tabId;
  next.calibration=old.calibration;
  next.freeOnly=old.freeOnly!==false;
  next.prompts=texts.map((text,id)=>({id,text,status:"waiting"}));
  next.log=[new Date().toLocaleTimeString("pt-BR")+
    " | Lote "+nextNo+" preparado: "+texts.length+
    " prompts importados. Lote anterior arquivado; MP4 preservados."];
  // Save the new queue first. Switch the in-memory queue only on success.
  await persistQueue;
  await browser.storage.local.set({[KEY]:JSON.parse(JSON.stringify(next))});
  state=next;
  return {ok:true,total:texts.length,batchNo:nextNo,archive:!!old.prompts.length};
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
// Keep the existing Sandbox tab selected while the queue works.
// Inactive Firefox tabs can delay media previews and page timers.
let foregroundRequestedAt = 0, lastSandboxHiddenLog = 0;
async function foregroundSandbox(reason, force=false) {
  const tab=await ensureTab();
  const now=Date.now();
  const canRetry=force || now - foregroundRequestedAt > 25000;
  if (!canRetry) return tab;
  if (force || !tab.active) {
    foregroundRequestedAt=now;
    try {
      await browser.tabs.update(tab.id,{active:true});
      // Focus only the Firefox VNC window, never another Android/Termux process.
      try {await browser.windows.update(tab.windowId,{focused:true});}catch(_){}
      log("Sandbox selecionado automaticamente para atualizar vídeo: "+reason);
      await persist();
    } catch(e) {
      log("Não foi possível trazer o Sandbox para frente: "+e.message);
      await persist();
    }
  }
  return tab;
}

// A media mutation event wakes the download monitor immediately,
// rather than relying only on throttled Firefox background timers.
let mediaWakeResolver=null, downloadWakeResolvers=new Map();
function onMediaSignal() {
  if(mediaWakeResolver) {const wake=mediaWakeResolver;mediaWakeResolver=null;wake();}
}
async function waitMediaOrTimeout(ms) {
  await new Promise(resolve=>{
    let finished=false;
    const timer=setTimeout(done,ms);
    function done() {
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      if(mediaWakeResolver===done)mediaWakeResolver=null;
      resolve();
    }
    mediaWakeResolver=done;
  });
}
browser.downloads.onChanged.addListener(delta=>{
  if(delta && Number.isInteger(delta.id) && downloadWakeResolvers.has(delta.id)){
    const wake=downloadWakeResolvers.get(delta.id);
    downloadWakeResolvers.delete(delta.id);
    wake();
  }
});
async function waitDownloadOrTimeout(id,ms) {
  await new Promise(resolve=>{
    let finished=false;
    const timer=setTimeout(done,ms);
    function done(){
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      if(downloadWakeResolvers.get(id)===done)downloadWakeResolvers.delete(id);
      resolve();
    }
    downloadWakeResolvers.set(id,done);
  });
}
async function awaitResult(index, flight) {
  // Persisted flight.baseline makes this safe across pauses and Firefox reloads.
  // The watcher signals on newly inserted video/source/link nodes without
  // waiting for the user to scroll the Sandbox manually.
  try {await sendTab("WATCH_MEDIA",{baseline:flight.baseline});}
  catch(e) {throw Error("Não consegui ativar o detector de resultados: "+e.message);}
  let scans=0;
  while (state.status === "running" && state.cursor === index) {
    if (Date.now() - flight.startedAt > RESULT_TIMEOUT) throw Error("Aguardando o vídeo há mais de 20 min. Revisão manual para evitar geração duplicada.");
    let media;
    try {
      // If the user opens the dashboard, allow a short check, then put the
      // rendering tab back in front without needing the user to visit it.
      await foregroundSandbox("aguardando resultado");
      // Every few checks, expose the newest result area to trigger lazy media
      // mounting. This doesn't click Run and never causes another generation.
      if((scans++ % 3)===2) {
        try {await sendTab("WAKE_RESULTS");}catch(_){}
      }
      media = await sendTab("SCAN", {calibration: state.calibration});
      if (media.pageHidden && Date.now()-lastSandboxHiddenLog > 45000) {
        lastSandboxHiddenLog=Date.now();
        log("Firefox reportou Sandbox oculto. Tentando reativar a aba sem recarregar.");
        await foregroundSandbox("aba oculta",true);
        await persist();
      }
    } catch (e) {
      throw Error("Aba fal.ai indisponível ou recarregada: " + e.message);
    }
    // Only fresh media, never an output that was already on the page before Run.
    const fresh = (media.videos || []).filter(v => v.url && !flight.baseline.includes(v.url));
    const eligible = fresh.find(v => /^https?:\/\//i.test(v.url)) || fresh.find(v => /^blob:/i.test(v.url));
    if (eligible) {
      log("Mídia localizada para prompt "+(index+1)+
        " após "+Math.round((Date.now()-flight.startedAt)/1000)+"s. Iniciando download.");
      await persist();
      return eligible;
    }
    // Wake immediately on DOM mutation, otherwise perform a short fallback scan.
    await waitMediaOrTimeout(1700);
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
    await waitDownloadOrTimeout(downloadId,1600);
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
            filename:"KLAUS AUT. FLUX MAX/ESPANHOL/" +
              (state.batchNo>1?"klaus_ext_es_lote"+String(state.batchNo).padStart(2,"0")+"_":"klaus_ext_es_") +
              String(index + 1).padStart(2,"0") + ".mp4",
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
        const wantedName=(state.batchNo>1?"klaus_ext_es_lote"+String(state.batchNo).padStart(2,"0")+"_":"klaus_ext_es_")+
          String(index + 1).padStart(2,"0");
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
  case "MEDIA_SIGNAL": {
    // A result signal must originate from the bound fal.ai tab, never panel
    // messages or an unrelated browser tab. No download is auto-initiated here.
    if(sender?.tab?.id!==state.tabId || state.status!=="running" ||
      !state.inFlight || state.inFlight.stage!=="submitted") return {ok:false};
    const baseline=new Set(state.inFlight.baseline||[]);
    if(Array.isArray(msg.urls) && msg.urls.some(u=>typeof u==="string" &&
      /^(https?:|blob:)/i.test(u) && !baseline.has(u))) {
      onMediaSignal();
    }
    return {ok:true};
  }
  case "GET": return state;
  case "BIND": {
    const t = await ensureTab();
    await browser.tabs.update(t.id, {active:true});
    return {ok:true,tabId:t.id};
  }
  case "OPEN_SITE": { const t=await browser.tabs.create({url:"https://fal.ai/sandbox"}); state.tabId=t.id;await persist();return {ok:true}; }
  case "OPEN_PANEL": { await browser.tabs.create({url:browser.runtime.getURL("dashboard.html")}); return {ok:true}; }
  case "NEW_BATCH_IMPORT": {
    return archiveAndPrepare(msg.prompts);
  }
  case "LOAD": {
    if (state.status === "running" || state.inFlight) throw Error("Existe uma geração em andamento ou para revisão. Não sobrescreva a fila.");
    if (state.prompts.some(p=>p.status==="done")) throw Error("Já existe vídeo concluído. Use o botão Acrescentar, não Salvar fila, para não repetir o vídeo 01.");
    if (!Array.isArray(msg.prompts) || msg.prompts.length < 1 || msg.prompts.length > 25) throw Error("Envie de 1 a 25 prompts.");
    const texts=msg.prompts.map(s => String(s || "").trim());
    if (texts.some(s=>!s || s.length > 20000)) throw Error("Prompt vazio ou maior que 20.000 caracteres.");
    state.prompts=texts.map((text,id)=>({id,text,status:"waiting"}));
    state.cursor=0;state.inFlight=null;state.status="idle";state.history=[];
    log("Fila carregada: "+texts.length+" prompts.");await persist();return {ok:true};
  }
  case "APPEND_REMAINING": {
    // Preserve every already-completed job, filename and current cursor.
    // Allow adding the remaining scripts in several copy/paste chunks while idle.
    if (!["complete","idle"].includes(state.status) || state.inFlight ||
        !state.prompts.every((p,i)=>i<state.cursor?p.status==="done":p.status==="waiting")) {
      throw Error("Pause os trabalhos e resolva revisões antes de acrescentar.");
    }
    if (!state.prompts.length || state.prompts.length >= 25) {
      throw Error("Não existem posições disponíveis para acrescentar.");
    }
    const existing = state.prompts.length;
    if (!Array.isArray(msg.prompts) || !msg.prompts.length ||
        msg.prompts.length > 25 - existing) {
      throw Error("Envie até " + (25-existing) + " prompts restantes.");
    }
    const texts = msg.prompts.map(v => String(v || "").trim());
    if (texts.some(v => !v || v.length > 20000))
      throw Error("Há um prompt vazio ou longo demais.");
    const heading = /^PROMPT\s+(\d{1,2})\s*[-–—:.]/i;
    const previous = state.prompts.map(p => p.text.trim());
    const seen = new Set(previous);
    texts.forEach((value, n) => {
      const number = existing + n + 1;
      const hit = value.match(heading);
      if (!hit || Number(hit[1]) !== number) {
        throw Error("No bloco " + (n+1) + " eu esperava PROMPT " +
          String(number).padStart(2, "0") + ", mas recebi " +
          (hit ? "PROMPT "+hit[1] : "um texto sem título") +
          ". Nenhum item foi acrescentado.");
      }
      if (value.length < 100)
        throw Error("O PROMPT "+String(number).padStart(2,"0")+
          " parece incompleto (menos de 100 caracteres). Nenhuma alteração feita.");
      if (seen.has(value)) throw Error("Prompt duplicado detectado: " + number);
      seen.add(value);
    });
    // Only after full validation, atomically extend the persisted queue.
    texts.forEach((text,n) => state.prompts.push({
      id:existing+n, text, status:"waiting"
    }));
    state.status="idle";
    const doneCount=state.prompts.filter(p=>p.status==="done").length;
    log("Acrescentados " + texts.length + " prompts: posições " +
      (existing+1) + " a " + state.prompts.length +
      ". Concluídos preservados: "+doneCount+", próximo envio: "+(state.cursor+1));
    await persist();
    return {ok:true,total:state.prompts.length,completed:doneCount,next:state.cursor+1};
  }
  case "AUTO_MARK": {
    if (state.status==="running") throw Error("Pause antes de recalibrar.");
    await ensureTab();
    const detected=await sendTab("AUTOMARK");
    if (!detected.prompt || !detected.run) {
      throw Error("Não identifiquei os dois controles. Marque o Prompt e o Run manualmente.");
    }
    if (detected.operation!=="video") {
      throw Error("O Sandbox ainda não está em Text To Video. Nada foi alterado.");
    }
    state.calibration={prompt:detected.prompt,run:detected.run};
    log("Campo Prompt e botão Run detectados sem gerar vídeo. Modelo(s): "+detected.modelCount);
    await persist();
    return {ok:true,operation:detected.operation,free:detected.free,
      modelCount:detected.modelCount,promptLabel:detected.promptLabel,runLabel:detected.runLabel};
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
    // Firefox blocks data: URLs in downloads.download. Mozilla recommends
    // a blob: URL created by the extension background page instead.
    const sample="KLAUS AUTO VIDEO\nTeste de pasta do Firefox. Nao e um video. Nenhum credito gasto.\n";
    const testBlob = new Blob([sample], {type:"text/plain;charset=utf-8"});
    const testUrl = URL.createObjectURL(testBlob);
    let result=null;
    try {
      const downloadId=await browser.downloads.download({
        url:testUrl,
        filename:"KLAUS AUT. FLUX MAX/ESPANHOL/klaus_ext_teste_destino.txt",
        conflictAction:"uniquify",saveAs:false
      });
      for(let n=0;n<24;n++) {
        await delay(450);
        const found=await browser.downloads.search({id:downloadId});
        if(found.length && found[0].state==="complete"){result=found[0];break;}
        if(found.length && found[0].state==="interrupted")throw Error("Download de teste falhou: "+(found[0].error||"desconhecido"));
      }
      if(!result)throw Error("Download de teste ainda nao terminou. Veja o gerenciador de downloads do Firefox.");
    } finally {
      URL.revokeObjectURL(testUrl);
    }
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
    await ensureTab();state.status="running";log("Iniciando lote. O Firefox manterá o Sandbox selecionado.");await persist();
    await foregroundSandbox("início do lote",true);
    launch();return {ok:true};
  }
  case "PAUSE": {if(state.status==="running"){state.status="paused";log("Pausa solicitada. Nenhum novo vídeo será enviado.");await persist();}return {ok:true};}
  case "RESUME": {
    if(state.status!=="paused")throw Error("A fila não está pausada.");
    if(state.inFlight && !["submitted","downloading"].includes(state.inFlight.stage))throw Error("Envio incerto. Revise a página antes de continuar.");
    state.status="running";log("Retomando sem repetir envios; ativando Sandbox.");await persist();
    await foregroundSandbox("retomada",true);
    launch();return {ok:true};
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
