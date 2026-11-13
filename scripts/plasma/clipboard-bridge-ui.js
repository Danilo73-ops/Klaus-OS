// JavaScript / clipboard-bridge-ui.js / Chrome Android + Node test / Klaus OS
"use strict";
(function () {
  const MAX_ITEMS = 25;
  const STORAGE_KEY = "klausClipboardQueueV2";

  function asText(item) {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    for (const key of ["prompt", "text", "content", "description", "script", "body"]) {
      const value = item[key];
      if (typeof value === "string" && value.trim()) return value;
      if (value && typeof value === "object") {
        const nested = asText(value);
        if (nested) return nested;
      }
    }
    return "";
  }

  function parseBatch(input, splitMode = "auto") {
    const source = String(input ?? "").replace(/\r\n?/g,"\n").replace(/^\uFEFF/,"").trim();
    if (!source) throw Error("Arquivo ou texto vazio.");
    let items;
    let parsed;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      if (/^\s*\{|^\s*\[\s*[{"]/.test(source)) throw Error("JSON inválido. Confira vírgulas e aspas ou importe um TXT.");
    }
    if (parsed !== undefined) {
      let list = Array.isArray(parsed) ? parsed : null;
      if (!list && parsed && typeof parsed === "object") {
        for (const key of ["prompts","items","jobs","queue","videos","scenes","data"]) {
          if (Array.isArray(parsed[key])) { list = parsed[key]; break; }
          if (parsed[key] && Array.isArray(parsed[key].prompts)) { list = parsed[key].prompts; break; }
        }
      }
      if (!list) throw Error("JSON sem lista. Use um array ou {\"prompts\":[...] }.");
      items = list.map(asText).map(x => String(x).trim()).filter(Boolean);
      if (items.length !== list.length) throw Error("Um ou mais itens do JSON não possuem texto de prompt.");
    } else if (splitMode === "blanks") {
      items = source.split(/\n[ \t]*\n+/).map(x=>x.trim()).filter(Boolean);
    } else if (splitMode === "lines") {
      items = source.split("\n").map(x=>x.trim()).filter(Boolean);
    } else {
      const kind = "(?:PROMPT|V[IÍ]DEO|CENA)";
      const heading = new RegExp("^[ \\t]*(?:#{1,6}[ \\t]*)?(?:\\*{1,2}[ \\t]*)?(?:🎬[ \\t]*)?(?:(?:"+kind+")[ \\t]*#?[ \\t]*(\\d{1,3})|(\\d{1,3})[ \\t]*[.)-][ \\t]*(?:"+kind+"))(?=[ \\t]|[-—–:.|*]|$)", "gim");
      let matches = [...source.matchAll(heading)];
      if (matches.length < 2) {
        const flattened = new RegExp("\\b(?:"+kind+")[ \\t]*#?[ \\t]*(\\d{1,3})(?=[ \\t]*[-—–:.|])", "gi");
        const candidates = [...source.matchAll(flattened)];
        if (candidates.length > matches.length) matches = candidates;
      }
      if (matches.length) {
        const leading = source.slice(0,matches[0].index).trim();
        if (leading.length > 200) throw Error("Há texto longo antes do primeiro PROMPT. Revise o início do lote.");
        items = matches.map((match,i)=>
          source.slice(match.index, matches[i+1]?.index ?? source.length).trim()
            .replace(/(?:\n[ \t]*(?:---+|===+|\*\*\*+)[ \t]*)+$/,"").trim());
      } else if (/^[ \t]*(?:---+|===+|\*\*\*+)[ \t]*$/m.test(source)) {
        items = source.split(/^[ \t]*(?:---+|===+|\*\*\*+)[ \t]*$/gm).map(x=>x.trim()).filter(Boolean);
      } else {
        items = [source];
      }
    }
    if (!items.length || items.length > MAX_ITEMS)
      throw Error("Esperava de 1 a 25 prompts. Detectei "+items.length+".");
    const numbered = items.map(t => {
      const match = /^\s*(?:#{1,6}\s*)?(?:\*{1,2}\s*)?(?:🎬\s*)?(?:PROMPT|V[IÍ]DEO|CENA)\s*#?\s*(\d{1,3})(?=[ \t]|[-—–:.|*]|$)/i.exec(t);
      return match ? Number(match[1]) : null;
    });
    if (numbered.length > 1 && numbered.every(n=>n!==null)) {
      for (let i=1;i<numbered.length;i++) {
        if (numbered[i] !== numbered[i-1]+1) throw Error("Numeração fora de ordem: "+numbered[i-1]+" → "+numbered[i]+".");
      }
    }
    return items;
  }

  if (typeof module === "object" && module.exports) module.exports = {parseBatch};
  if (typeof document === "undefined") return;

  const el = id => document.getElementById(id);
  const box=el("prompt"), notice=el("notice"), preview=el("queueStatus");

  // Optional import modes keep multi-paragraph prompts intact unless the user opts in.
  const modeLabel = document.createElement("label");
  modeLabel.textContent = "Como separar os prompts: ";
  modeLabel.style.cssText = "display:block;margin:10px 0;color:#bfe7ff;font-size:14px";
  const mode = document.createElement("select");
  mode.id = "batchSplitMode";
  mode.style.cssText = "max-width:100%;padding:10px;background:#091723;color:#fff;border:1px solid #496783;border-radius:8px";
  [["auto","Automático (títulos PROMPT, JSON ou ---)"],["blanks","Separar por linhas vazias"],["lines","Um prompt por linha"]].forEach(([value,label])=>{
    const option=document.createElement("option");
    option.value=value;
    option.textContent=label;
    mode.appendChild(option);
  });
  modeLabel.appendChild(mode);
  el("batchText").insertAdjacentElement("afterend",modeLabel);
  let queue=[], index=0, delivered=[];

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({queue,index,delivered}));
    } catch (_) {
      notice.textContent="⚠ Armazenamento do navegador indisponível. Não feche esta página.";
    }
  }

  function render() {
    const total=queue.length;
    preview.textContent=total ? "Lote carregado: "+total+" prompts · atual "+(index+1)+"/"+total+
      " · enviados ao clipboard "+delivered.filter(Boolean).length+"/"+total :
      "Nenhum lote carregado.";
    el("currentTitle").textContent=total ? (queue[index].split("\n")[0].slice(0,115)) : "Sem prompt selecionado";
    el("sendCurrent").disabled=!total;
    el("nextPrompt").disabled=!total || index>=total-1 || !delivered[index];
    el("previousPrompt").disabled=!total || index===0;
    el("queueControls").hidden=!total;
  }

  async function send(text) {
    const response=await fetch("/clipboard",{
      method:"POST",
      headers:{"Content-Type":"text/plain; charset=utf-8"},
      body:text
    });
    const result=await response.json();
    if(!response.ok) throw Error(result.error || "Falha na transferência.");
    return result;
  }

  el("send").onclick=async()=>{
    if(!box.value.trim()) {notice.textContent="Cole um prompt primeiro.";return;}
    notice.textContent="Transferindo...";
    try {
      const result=await send(box.value);
      notice.textContent="✅ "+result.characters+" caracteres no Klaus OS. Use Ctrl+V no Firefox.";
    } catch(error) {notice.textContent="❌ "+error.message;}
  };

  function loadBatch(raw, origin) {
    const items=parseBatch(raw, mode.value);
    if(queue.length && !confirm("Substituir o lote local de "+queue.length+
      " prompts por "+items.length+" prompts de "+origin+"? Nenhum arquivo do Termux será apagado.")) return;
    queue=items;
    index=0;
    delivered=items.map(()=>false);
    save();
    render();
    notice.textContent="✅ "+items.length+" prompts carregados! Clique em Enviar atual e depois Ctrl+V no Firefox."+(items.length===1 && raw.length>700 ? " Se esperava vários, escolha outro modo de separação e carregue novamente." : "");
  }

  el("loadBatch").onclick=()=>{
    try {loadBatch(el("batchText").value,"texto");}
    catch(error){notice.textContent="❌ "+error.message;}
  };

  el("batchFile").onchange=async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    try {
      if(file.size>512*1024) throw Error("O arquivo ultrapassa 512 KB.");
      await loadBatch(await file.text(),file.name);
    } catch(error){notice.textContent="❌ "+error.message;}
    finally{e.target.value="";}
  };

  async function sendSelected() {
    if(!queue.length)return;
    notice.textContent="Transferindo prompt "+(index+1)+"/"+queue.length+"...";
    const result=await send(queue[index]);
    delivered[index]=true;
    save();
    render();
    notice.textContent="✅ PROMPT "+(index+1)+"/"+queue.length+
      " pronto ("+result.characters+" caracteres). Volte ao Firefox e use Ctrl+V.";
  }

  el("sendCurrent").onclick=()=>sendSelected().catch(error=>{
    notice.textContent="❌ "+error.message;
  });

  el("nextPrompt").onclick=async()=>{
    if(!queue.length || index>=queue.length-1 || !delivered[index]) return;
    const old=index;
    index++;
    try {await sendSelected();}
    catch(error){
      index=old;
      save();
      render();
      notice.textContent="❌ "+error.message+" O índice anterior foi preservado.";
    }
  };

  el("previousPrompt").onclick=()=>{
    if(index>0) {
      index--;
      save();
      render();
      notice.textContent="Voltamos ao prompt "+(index+1)+". Clique em Enviar atual se quiser copiá-lo novamente.";
    }
  };

  try {
    const old=JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if(old && Array.isArray(old.queue) && old.queue.length<=MAX_ITEMS &&
       old.queue.every(x=>typeof x==="string")) {
      queue=old.queue;
      index=Math.min(Math.max(0,Number(old.index)||0),queue.length-1);
      delivered=queue.map((_,i)=>Boolean(old.delivered?.[i]));
    }
  } catch (_) {}
  render();
})();
