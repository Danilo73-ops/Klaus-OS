// JavaScript / dashboard.js / Firefox WebExtension MV2 / 25-prompt fal.ai queue UI
"use strict";
const $=id=>document.getElementById(id);
const statuses={waiting:"Aguardando",sending:"Enviando",generating:"Gerando",downloading:"Baixando",done:"Concluído",review:"Revisar",skipped:"Pulado"};
let state=null,lastMessage="",isEditing=false;
function getText(x) {return typeof x==="string"?x:(x && typeof x==="object"?(x.prompt||x.text||x.content||""):"");}
function parsePrompts(raw) {
  const text=raw.trim();if(!text)throw Error("Cole seus prompts antes de salvar.");
  try{
    const json=JSON.parse(text),list=Array.isArray(json)?json:json.prompts||json.items||json.jobs||json.queue;
    if(Array.isArray(list)){
      const items=list.map(getText).map(s=>String(s).trim()).filter(Boolean);
      if(items.length) return items;
    }
  }catch(_){}
  let items;
  if(/^\s*(?:PROMPT|V[IÍ]DEO|VIDEO)\s*0?\d+\s*(?:[-–—:.]|$)/im.test(text)) {
    items=text.split(/(?=^\s*(?:PROMPT|V[IÍ]DEO|VIDEO)\s*0?\d+\s*(?:[-–—:.]|$))/gim).map(s=>s.trim()).filter(Boolean);
  }else if(/^\s*(?:---+|===+)\s*$/m.test(text)) {
    items=text.split(/^\s*(?:---+|===+)\s*$/gm).map(s=>s.trim()).filter(Boolean);
  }else {
    items=[text];
  }
  if(!items.length || items.length>25)throw Error("O lote deve conter de 1 a 25 prompts. Detectei "+items.length+".");
  return items;
}
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
    if (!confirm("Acrescentar "+prompts.length+" prompts depois dos vídeos já baixados, sem repetir o primeiro?")) return;
    const result=await api("APPEND_REMAINING",{prompts});
    await refresh();
    msg("✅ "+prompts.length+" prompts adicionados. Próximo: "+result.next+
      "/"+result.total+". Vídeos anteriores preservados. Clique Iniciar lote quando desejar.");
  }catch(_){}
};
$("importFile").onchange=async event=>{
  const f=event.target.files?.[0];if(!f)return;
  try{$("raw").value=await f.text();msg("Arquivo importado. Confira e clique Salvar fila.");}
  catch(e){msg(e.message,true);}
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
