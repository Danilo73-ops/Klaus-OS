// JavaScript / clipboard-bridge-ui.js / Chrome Android + Node test / Klaus OS
"use strict";
(function () {
  const MAX_ITEMS = 25;
  const STORAGE_KEY = "klausClipboardQueueV2";

  function asText(item) {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") return item.prompt || item.text || item.content || "";
    return "";
  }

  function parseBatch(input) {
    const source = String(input || "").replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "").trim();
    if (!source) throw Error("Arquivo ou texto vazio.");
    let items = null;
    try {
      const data = JSON.parse(source);
      const list = Array.isArray(data) ? data : data && (data.prompts || data.items || data.jobs || data.queue);
      if (!Array.isArray(list)) throw Error("JSON sem lista de prompts.");
      items = list.map(asText).map(x => String(x).trim()).filter(Boolean);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    if (!items) {
      // First try anchored titles. Fall back to collapsed headings for an Android
      // clipboard that has flattened line breaks. Keep all original body text.
      let matches = [...source.matchAll(/^\s*(?:PROMPT|V[IÍ]DEO)\s+(\d{1,2})\s*[-–—:.]/gim)];
      if (matches.length < 2) {
        const any = [...source.matchAll(/\b(?:PROMPT|V[IÍ]DEO)\s+(\d{1,2})\s*[-–—:.]/gi)];
        if (any.length > matches.length) matches = any;
      }
      if (matches.length) {
        const before = source.slice(0, matches[0].index).trim();
        if (before.length > 80) throw Error("Texto inesperado antes do primeiro PROMPT.");
        items = matches.map((m,i) => source.slice(m.index, matches[i+1]?.index ?? source.length).trim());
      } else if (/^\s*(?:---+|===+)\s*$/m.test(source)) {
        items = source.split(/^\s*(?:---+|===+)\s*$/gm).map(x => x.trim()).filter(Boolean);
      } else {
        items = [source];
      }
    }
    if (!items.length || items.length > MAX_ITEMS)
      throw Error("Esperava de 1 a 25 prompts. Detectei " + items.length + ".");
    const numbers = items.map(t => {
      const m = /^\s*PROMPT\s+(\d{1,2})\s*[-–—:.]/i.exec(t);
      return m ? Number(m[1]) : null;
    });
    if (numbers.every(n => n !== null)) {
      const broken = numbers.findIndex((n,i) => i && n !== numbers[i-1]+1);
      if (broken >= 0) throw Error("Numeração fora de ordem: " + numbers[broken-1] + " → " + numbers[broken] + ".");
      if (new Set(numbers).size !== numbers.length) throw Error("Há títulos repetidos.");
    }
    return items;
  }

  if (typeof module === "object" && module.exports) module.exports = {parseBatch};
  if (typeof document === "undefined") return;

  const el = id => document.getElementById(id);
  const box=el("prompt"), notice=el("notice"), preview=el("queueStatus");
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

  async function loadBatch(raw, origin) {
    const items=parseBatch(raw);
    if(queue.length && !confirm("Substituir o lote local de "+queue.length+
      " prompts por "+items.length+" prompts de "+origin+"? Nenhum arquivo do Termux será apagado.")) return;
    queue=items;
    index=0;
    delivered=items.map(()=>false);
    save();
    render();
    notice.textContent="✅ "+items.length+" prompts carregados! Clique em Enviar atual e depois Ctrl+V no Firefox.";
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
