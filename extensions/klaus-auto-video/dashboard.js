// JavaScript / dashboard.js / Firefox WebExtension MV2 / 25-prompt fal.ai queue UI
"use strict";
const $=id=>document.getElementById(id);
const statuses={waiting:"Aguardando",sending:"Enviando",generating:"Gerando",downloading:"Baixando",done:"Concluído",review:"Revisar",skipped:"Pulado"};
let state=null,lastMessage="",isEditing=false;
// Parse numbered prompts even when Android clipboard merges all newlines.
const parsePrompts=raw=>KlausPromptParser.parse(raw);
const numberOf=prompt=>KlausPromptParser.numberOf(prompt);
function renderParsePreview() {
  const area=$("parseInfo"),raw=$("raw").value.trim();
  if(!raw) {area.textContent="Cole os prompts para conferir quantos foram identificados.";return;}
  try {
    const found=KlausPromptParser.inspect(raw);
    const labels=found.numbers.map(n=>n==null?"sem número":String(n).padStart(2,"0"));
    const existing=state?.prompts?.length || 0;
    const next=existing + 1;
    const mismatch=found.numbers.findIndex((n,i)=>n!==next+i);
    const text=found.count+" prompt(s) identificado(s): "+labels.join(", ")+".";
    if(existing>0 && mismatch>=0) {
      area.textContent=text+" ⚠ Esperava PROMPT "+String(next+mismatch).padStart(2,"0")+
        " na posição "+(mismatch+1)+". Revise os blocos copiados antes de Acrescentar.";
      area.style.color="#ffad82";
    }else {
      area.textContent=text+(existing?" ✅ Próximo esperado: "+String(next).padStart(2,"0")+".":"");
      area.style.color="#69e0ca";
    }
  } catch(e){area.textContent="⚠ "+e.message;area.style.color="#ffad82";}
}
const DRAFT_KEY="klausAutoVideoDraftV1";
let draftTimer=null;
$("raw").addEventListener("input",()=>{
  renderParsePreview();
  clearTimeout(draftTimer);
  draftTimer=setTimeout(()=>{
    browser.storage.local.set({[DRAFT_KEY]:$("raw").value}).catch(()=>{});
  },350);
});
browser.storage.local.get(DRAFT_KEY).then(data=>{
  if(!$("raw").value && data[DRAFT_KEY]) $("raw").value=data[DRAFT_KEY];
  renderParsePreview();
}).catch(()=>{});
function msg(text,error=false) {
  lastMessage=text;$("message").style.color=error?"#ff9a92":"#68f1c7";$("message").textContent=text;
}
async function api(type,more={}) {
  try {
    const r=await browser.runtime.sendMessage({type,...more});
    if(r && r.error) throw Error(r.error);
    return r;
  }catch(e){msg("Erro: "+e.message,true);throw e;}
}
async function action(type,more={},success) {
  try {await api(type,more);if(success)msg(success);await refresh();}catch(_){}
}
function show(s) {
  state=s;if(!s)return;
  const status=s.status||"idle";
  $("status").textContent=({idle:"PARADO",running:"EXECUTANDO",paused:"PAUSADO",complete:"CONCLUÍDO"})[status]||status.toUpperCase();
  $("status").style.background=status==="running"?"#0c614b":status==="paused"?"#68501f":status==="complete"?"#126b59":"#23364b";
  $("promptMark").textContent=s.calibration?.prompt?"✓ Marcado":"Não marcado";
  $("runMark").textContent=s.calibration?.run?"✓ Marcado":"Não marcado";
  if(document.activeElement!==$("freeOnly")) $("freeOnly").checked=s.freeOnly!==false;
  const total=s.prompts.length,done=s.prompts.filter(p=>p.status==="done").length;
  $("metricTotal").textContent=total;
  $("metricDone").textContent=done;
  $("metricPending").textContent=s.prompts.filter(p=>!["done","skipped"].includes(p.status)).length;
  $("metricCurrent").textContent=total?Math.min(s.cursor+1,total)+"/"+total:"—";
  $("bar").style.width=(total?done/total*100:0)+"%";
  $("queue").replaceChildren();
  if(!total) $("queue").textContent="Nenhum prompt carregado.";
  s.prompts.forEach((p,i)=>{
    const e=document.createElement("div");e.className="queueItem";
    const no=document.createElement("strong");no.textContent=String(i+1).padStart(2,"0");
    const name=document.createElement("span");name.title=p.text;name.textContent=p.text.split("\n")[0].slice(0,130);
    const status=document.createElement("small");status.textContent=statuses[p.status]||p.status;status.className=p.status;
    e.append(no,name,status);$("queue").appendChild(e);
  });
  $("logs").textContent=s.log.length?s.log.join("\n"):"Sem eventos.";
  $("review").hidden=!(s.inFlight&&status!=="running");
  if(s.inFlight){
    const item=s.prompts[s.inFlight.index];
    $("reviewText").textContent="Prompt "+(s.inFlight.index+1)+": "+(item?.error||"Geração pendente de confirmação.");
  }
  $("start").disabled=status==="running"||status==="complete";
  $("resume").disabled=status!=="paused";
  $("pause").disabled=status!=="running";
  renderParsePreview();
}
async function refresh() {
  try {const s=await api("GET");show(s);}catch(_){}
}
$("openSite").onclick=()=>action("OPEN_SITE",{},"Sandbox aberto.");
$("bind").onclick=()=>action("BIND",{},"Aba do Sandbox vinculada.");
$("autoMark").onclick=async()=>{
  try {
    const result=await api("AUTO_MARK");
    await refresh();
    msg("✅ Campo Prompt e botão Run detectados sem gerar. "+
      "Operação: "+result.operation+" | Modelos: "+result.modelCount+
      " | Gratuito: "+(result.free?"confirmado perto do Run":"não confirmado")+
      "\nBotão encontrado: "+result.runLabel);
  }catch(_){}
};
$("testFolder").onclick=async()=>{
  try {
    const result=await api("TEST_FOLDER");
    msg((result.ok?"✅ Pasta ESPANHOL confirmada!":"⚠ Destino incorreto.")+"\n"+
      (result.path||"")+"\n"+(result.note||""),!result.ok);
    const snapshot=await api("GET");
    show(snapshot);
  }catch(_){}
};
for(const [id,kind] of [["pickPrompt","prompt"],["pickRun","run"]]) {
  $(id).onclick=()=>action("PICK",{kind},"Agora clique no "+(kind==="prompt"?"campo Prompt":"botão Run")+" na aba do Sandbox.");
}
$("load").onclick=()=>{
  try {
    const prompts=parsePrompts($("raw").value);
    action("LOAD",{prompts},"Fila salva: "+prompts.length+" prompts.");
  }catch(e){msg(e.message,true);}
};
$("append").onclick=async()=>{
  try {
    const prompts=parsePrompts($("raw").value);
    const next=(state?.prompts?.length||0)+1;
    const actual=prompts.map(numberOf);
    const mismatch=actual.findIndex((n,i)=>n!==next+i);
    if(mismatch>=0) {
      const expected=String(next+mismatch).padStart(2,"0");
      const received=actual[mismatch]==null?"sem título":"PROMPT "+String(actual[mismatch]).padStart(2,"0");
      throw Error("Encontrei "+prompts.length+" blocos. Na posição "+(mismatch+1)+
        " era esperado PROMPT "+expected+", mas apareceu "+received+
        ". Nenhum vídeo ou histórico foi alterado.");
    }
    const summary=prompts.length+" prompts ("+String(actual[0]).padStart(2,"0")+
      " até "+String(actual[actual.length-1]).padStart(2,"0")+").";
    if(!confirm("Acrescentar "+summary+" Os vídeos concluídos serão preservados.")) return;
    const result=await api("APPEND_REMAINING",{prompts});
    await refresh();
    msg("✅ "+prompts.length+" prompts adicionados. Fila total: "+result.total+
      ", baixados: "+result.completed+", próximo: "+result.next+
      ". Os vídeos já concluídos foram preservados.");
  }catch(e){msg("Erro: "+e.message,true);}
};
$("importFile").onchange=async event=>{
  const selected=event.target.files?.[0];
  if(!selected)return;
  try {
    // Read in native Firefox file picker; never paste huge text through AVNC.
    const content=await selected.text();
    const prompts=parsePrompts(content);
    if(prompts.length!==25) throw Error(
      "Este botão prepara 25 vídeos. O arquivo contém "+prompts.length+
      " prompts. Nada foi modificado.");
    const numbers=prompts.map(numberOf);
    const missing=numbers.findIndex((n,i)=>n!==i+1);
    if(missing>=0) throw Error("A numeração precisa ser PROMPT 01 a PROMPT 25. Falha no bloco "+
      (missing+1)+". Nada foi alterado.");
    const prior=await api("GET");
    if(prior.prompts?.length && !(prior.status==="complete" &&
      prior.cursor===prior.prompts.length && prior.prompts.every(p=>p.status==="done")))
      throw Error("O lote anterior não está 100% concluído. Arquive ou conclua pendências antes de importar outro.");
    if(prior.prompts?.length===25 && prior.prompts.every((p,i)=>p.text===prompts[i]))
      throw Error("Você selecionou os mesmos 25 prompts do lote anterior. Escolha o arquivo NOVO.");
    const notice=prior.prompts?.length
      ? "O lote anterior concluído será arquivado automaticamente em JSON. Nenhum vídeo será apagado."
      : "O lote novo ficará pronto para iniciar.";
    if(!confirm("Importar "+prompts.length+" prompts de "+selected.name+"?\\n"+notice+
      "\\nNenhuma geração será enviada até você clicar em Iniciar lote."))return;
    msg("Validando arquivo e arquivando o lote anterior; nenhuma geração será enviada.");
    const result=await api("NEW_BATCH_IMPORT",{prompts});
    $("raw").value="";
    clearTimeout(draftTimer);
    await browser.storage.local.set({[DRAFT_KEY]:""});
    await refresh();
    renderParsePreview();
    msg("✅ LOTE "+String(result.batchNo).padStart(2,"0")+" PRONTO! 25 prompts importados direto do arquivo "+
      selected.name+". Histórico anterior "+(result.archive?"arquivado em JSON.":"sem lote anterior.")+
      " Agora confira Free, 15s e 9:16 no Sandbox e clique em ▶ Iniciar lote.");
  } catch(e) {
    msg("Erro na importação: "+e.message,true);
  } finally {
    event.target.value="";
  }
};
$("freeOnly").onchange=event=>action("FREE_ONLY",{value:event.target.checked});
$("start").onclick=async()=>{
  if(!state?.prompts?.length){msg("Carregue a fila primeiro.",true);return;}
  if(!confirm("Iniciar "+state.prompts.length+" prompts sequencialmente no fal.ai? Confirme antes no Sandbox o modelo e o custo GRÁTIS. A extensão só vai prosseguir quando o botão Run indicar gratuidade."))return;
  await action("START",{},"Lote iniciado. Mantenha Firefox e Sandbox abertos.");
};
$("pause").onclick=()=>action("PAUSE",{},"Pausa solicitada; não será iniciada outra geração.");
$("resume").onclick=()=>action("RESUME",{},"Retomada solicitada.");
$("reviewDone").onclick=()=>{
  if(confirm("Você conferiu que o vídeo desta posição já foi baixado?"))action("REVIEW_DONE",{},"Marcado como concluído. Clique Retomar.");
};
$("reviewRetry").onclick=()=>{
  if(confirm("CONFIRME: você checou o site e este vídeo NÃO foi gerado? Reenviar pode gastar outra geração."))action("REVIEW_RETRY",{},"Reenvio autorizado. Clique Retomar.");
};
$("skip").onclick=()=>{if(confirm("Pular esse prompt sem baixar o vídeo?"))action("SKIP",{},"Item pulado. Clique Retomar.");};
$("export").onclick=()=>{
  if(!state)return;
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const u=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=u;a.download="klaus-video-progresso.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);
};
refresh();setInterval(refresh,2000);
