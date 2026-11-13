// JavaScript / clipboard-bridge-ui.js / Chrome Android + Node test / Klaus OS
"use strict";
(function () {
  const MAX_ITEMS = 25;
  const STORAGE_KEY = "klausClipboardQueueV2";

  function parseBatch(input) {
    const source = String(input ?? "").replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "").trim();
    if (!source) throw Error("Arquivo ou texto vazio.");
    let items;
    let parsed, validJson=false;
    try { parsed=JSON.parse(source); validJson=true; }
    catch (_) {
      if (/^\s*(?:\{|\[\s*[\{"])/.test(source))
        throw Error("JSON inválido. Corrija o arquivo ou use texto TXT.");
    }
    if (validJson) {
      let list=Array.isArray(parsed) ? parsed : null;
      if (!list && parsed && typeof parsed==="object") {
        for (const key of ["prompts","items","jobs","queue","videos","scenes","data"]) {
          const candidate=parsed[key];
          if (Array.isArray(candidate)) { list=candidate; break; }
          if (candidate && Array.isArray(candidate.prompts)) { list=candidate.prompts; break; }
        }
      }
      if (!list) throw Error("JSON sem lista. Use um array ou {\"prompts\":[...] }.");
      const extract=item=>{
        if (typeof item==="string") return item;
        if (!item || typeof item!=="object") return "";
        for (const key of ["prompt","text","content","description","script","body"]) {
          if (typeof item[key]==="string" && item[key].trim()) return item[key];
        }
        return "";
      };
      items=list.map(extract).map(text=>text.trim());
      if (items.some(x=>!x)) throw Error("O JSON contém item sem texto de prompt.");
    } else {
      // Explicit, standalone delimiter. Never split on blank lines or plain ---.
      const delimiter=/^[ \t]*={3,}[ \t]*PROMPT[ \t]*={3,}[ \t]*$/gim;
      const separators=[...source.matchAll(delimiter)];
      if (separators.length) {
        const segments=source.split(/^[ \t]*={3,}[ \t]*PROMPT[ \t]*={3,}[ \t]*$/gim);
        if (segments.some(x=>!x.trim()))
          throw Error("Há separador ===PROMPT=== sem texto antes ou depois.");
        items=segments.map(x=>x.trim());
      } else {
        // Numbered headings are recognized ONLY as full lines, not words inside prose.
        const heading=/^[ \t]*(?:#{1,6}[ \t]*)?(?:\*{1,2}[ \t]*)?(?:🎬[ \t]*)?(?:PROMPT|V[IÍ]DEO|CENA)[ \t]*#?[ \t]*(\d{1,3})(?:[ \t]*[-—–:.|][ \t]*[^\n]{2,160})?[ \t]*\*{0,2}[ \t]*$/gim;
        const matches=[...source.matchAll(heading)];
        if (matches.length >= 2) {
          if (source.slice(0,matches[0].index).trim())
            throw Error("Há texto antes do primeiro título PROMPT. Use ===PROMPT=== entre roteiros.");
          const numbers=matches.map(x=>Number(x[1]));
          for (let i=1;i<numbers.length;i++) {
            if (numbers[i]<=numbers[i-1])
              throw Error("Títulos repetidos ou fora de ordem ("+numbers[i-1]+" → "+numbers[i]+"). Use separadores ===PROMPT===.");
          }
          items=matches.map((m,i)=>source.slice(m.index, matches[i+1]?.index??source.length).trim());
        } else {
          items=[source];
        }
      }
    }
    if (!items.length || items.length>25)
      throw Error("Esperava entre 1 e 25 prompts; encontrei "+items.length+".");
    if (items.some(x=>!x))
      throw Error("O lote tem um prompt vazio.");
    return items;
  }

  if (typeof module === "object" && module.exports) module.exports = {parseBatch};
  if (typeof document === "undefined") return;

const el = id=>document.getElementById(id);
  const notice=el("notice"), status=el("queueStatus"), box=el("prompt");
  const STORAGE_KEY_V2="klausClipboardQueueV2";
  const BACKUP_KEY="klausClipboardBackupBeforeSafeV3";
  let queue=[], index=0, delivered=[], reviewed=false, pending=null;

  const create=(tag,text)=>{
    const node=document.createElement(tag);
    if (text!==undefined) node.textContent=text;
    return node;
  };
  const input=el("batchText");
  const instruction=create("p","Separação segura: coloque PROMPT 01 — TÍTULO no começo de cada roteiro. Se não houver títulos, escreva ===PROMPT=== sozinho numa linha ENTRE os roteiros. Linhas vazias e --- nunca cortam um prompt.");
  instruction.style.cssText="font-size:13px;color:#bfe7ff";
  input.insertAdjacentElement("afterend",instruction);
  el("loadBatch").textContent="Analisar lote antes de carregar";

  const review=create("section");
  review.hidden=true;
  review.style.cssText="margin:14px 0;padding:12px;border:1px solid #4c7797;border-radius:12px";
  el("loadBatch").parentElement.insertAdjacentElement("afterend",review);

  const currentBody=create("textarea");
  currentBody.readOnly=true;
  currentBody.spellcheck=false;
  currentBody.setAttribute("aria-label","Prompt completo selecionado");
  currentBody.style.cssText="width:100%;height:190px;box-sizing:border-box;white-space:pre-wrap;resize:vertical;background:#091723;color:#eaf7ff;border:1px solid #496783;border-radius:10px;padding:12px";
  el("currentTitle").insertAdjacentElement("afterend",currentBody);

  const recoveryButton=create("button","⬇ Backup da fila salva");
  recoveryButton.className="secondary";
  recoveryButton.style.cssText="display:block;margin:8px 0 18px";
  el("queueStatus").insertAdjacentElement("afterend",recoveryButton);

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY_V2,JSON.stringify({version:3,reviewed,queue,index,delivered}));
      return true;
    } catch (error) {
      notice.textContent="❌ Não foi possível salvar a fila no navegador: "+error.message;
      return false;
    }
  }
  function render() {
    const total=queue.length;
    status.textContent=total ? "Fila: "+total+" prompts · atual "+(index+1)+"/"+total+
      " · enviados ao clipboard "+delivered.filter(Boolean).length+"/"+total+
      (reviewed?" · lote conferido":" · ⚠ fila antiga NÃO CONFERIDA") :
      "Nenhum lote carregado.";
    el("queueControls").hidden=!total;
    recoveryButton.hidden=!total;
    const item=total?queue[index]:"";
    el("currentTitle").textContent=total ? "Prompt "+(index+1)+"/"+total+
      " · "+item.length+" caracteres · "+item.split("\n")[0].slice(0,85):"";
    currentBody.value=item;
    el("sendCurrent").disabled=!total || !reviewed;
    el("nextPrompt").disabled=!total || !reviewed || index>=total-1 || !delivered[index];
    el("previousPrompt").disabled=!total || index===0;
  }
  function download(data,name) {
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
    const link=create("a");
    const url=URL.createObjectURL(blob);
    link.href=url;
    link.download=name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  recoveryButton.onclick=()=>{
    if(queue.length) download({version:3,reviewed,queue,index,delivered},"klaus-clipboard-fila-backup.json");
  };
  function analyze(raw,origin) {
    const items=parseBatch(raw);
    pending={items,origin};
    review.replaceChildren();
    review.hidden=false;
    review.appendChild(create("h3","Conferência: "+items.length+" prompts encontrados"));
    review.appendChild(create("p","Confira se cada roteiro começa E termina completo antes de carregar. Nada foi enviado ainda."));
    for (let i=0;i<items.length;i++) {
      const details=create("details");
      const first=items[i].split("\n")[0].slice(0,80);
      details.appendChild(create("summary",(i+1)+"/"+items.length+" · "+items[i].length+" caracteres · "+first));
      const content=create("pre",items[i]);
      content.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;background:#091723;border:1px solid #38516e;border-radius:7px;padding:8px;max-height:260px;overflow:auto;font-size:12px";
      details.appendChild(content);
      review.appendChild(details);
    }
    const buttons=create("div");
    buttons.className="row";
    const approve=create("button","✅ Confirmar "+items.length+" prompts");
    const cancel=create("button","Cancelar");
    cancel.className="secondary";
    buttons.append(approve,cancel);
    review.appendChild(buttons);
    cancel.onclick=()=>{pending=null;review.hidden=true;review.replaceChildren();notice.textContent="Análise cancelada. Fila anterior intacta.";};
    approve.onclick=()=>{
      if(!pending)return;
      if(queue.length && !confirm("Substituir a fila anterior de "+queue.length+" por "+pending.items.length+" prompts?")) return;
      if(queue.length) {
        try {
          localStorage.setItem(BACKUP_KEY,JSON.stringify({queue,index,delivered,reviewed,createdAt:new Date().toISOString()}));
        } catch(error) {
          notice.textContent="❌ Não foi possível fazer backup da fila antiga. Nada foi substituído: "+error.message;
          return;
        }
      }
      const previous={queue,index,delivered,reviewed};
      queue=pending.items.slice(); index=0; delivered=queue.map(()=>false); reviewed=true;
      if(!save()){
        queue=previous.queue;index=previous.index;delivered=previous.delivered;reviewed=previous.reviewed;
        render();
        return;
      }
      pending=null;review.hidden=true;review.replaceChildren();render();
      notice.textContent="✅ "+queue.length+" prompts conferidos e salvos. Veja o texto completo antes de enviar.";
    };
    notice.textContent="🔎 Foram encontrados "+items.length+" prompts em "+origin+". Confira cada um e confirme.";
    if(items.length===1 && raw.length>350)
      notice.textContent+=" Se você colou vários, não reconheci separadores seguros. Adicione ===PROMPT=== entre eles e analise de novo.";
  }
  el("loadBatch").onclick=()=>{
    try {analyze(input.value,"campo");}
    catch(error){review.hidden=true;pending=null;notice.textContent="❌ "+error.message;}
  };
  el("batchFile").onchange=async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try {
      if(file.size>512*1024)throw Error("O arquivo ultrapassa 512 KB.");
      analyze(await file.text(),file.name);
    } catch(error){notice.textContent="❌ "+error.message;}
    finally{event.target.value="";}
  };
  async function send(text) {
    const response=await fetch("/clipboard",{method:"POST",headers:{"Content-Type":"text/plain; charset=utf-8"},body:text});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||"Falha na transferência.");
    if(result.characters!==text.length)throw Error("Contagem de caracteres divergente, confira o clipboard.");
    return result;
  }
  el("send").onclick=async()=>{
    if(!box.value.trim()){notice.textContent="Cole um prompt avulso primeiro.";return;}
    notice.textContent="Transferindo...";
    try {
      const result=await send(box.value);
      notice.textContent="✅ "+result.characters+" caracteres transferidos. Use Ctrl+V no Firefox.";
    } catch(error){notice.textContent="❌ "+error.message;}
  };
  async function sendSelected() {
    if(!reviewed || !queue.length)throw Error("Fila não conferida. Importe e confirme o lote original primeiro.");
    const current=index;
    notice.textContent="Transferindo prompt "+(current+1)+"/"+queue.length+"...";
    const result=await send(queue[current]);
    delivered[current]=true;
    save();render();
    notice.textContent="✅ Prompt "+(current+1)+"/"+queue.length+": "+result.characters+" caracteres completos. Ctrl+V no Firefox.";
  }
  el("sendCurrent").onclick=()=>sendSelected().catch(error=>{notice.textContent="❌ "+error.message;});
  el("nextPrompt").onclick=async()=>{
    if(!queue.length||!reviewed||index>=queue.length-1||!delivered[index])return;
    const previous=index;
    index++;
    try{await sendSelected();}
    catch(error){index=previous;save();render();notice.textContent="❌ "+error.message+" Posição anterior preservada.";}
  };
  el("previousPrompt").onclick=()=>{
    if(index>0){index--;save();render();notice.textContent="Prompt "+(index+1)+"/"+queue.length+" selecionado. Leia o texto completo antes de enviar.";}
  };
  try {
    const old=JSON.parse(localStorage.getItem(STORAGE_KEY_V2)||"null");
    if(old && Array.isArray(old.queue) && old.queue.length<=25 && old.queue.every(x=>typeof x==="string")){
      queue=old.queue;
      index=Math.max(0,Math.min(queue.length-1,Number(old.index)||0));
      delivered=queue.map((_,i)=>Boolean(old.delivered?.[i]));
      reviewed=old.version===3 && old.reviewed===true;
      if(!reviewed)notice.textContent="⚠ Esta fila foi criada pelo importador antigo e pode conter fragmentos. Faça backup e carregue o lote original para conferir.";
    }
  } catch(error){notice.textContent="⚠ Não foi possível ler a fila salva. Nenhum dado foi apagado.";}
  render();
})();
