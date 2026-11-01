// JavaScript / prompt-parser.js / Firefox WebExtension + Node 18+ / Klaus Auto Video
"use strict";
(function (root) {
  function textOf(item) {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") return item.prompt || item.text || item.content || "";
    return "";
  }
  function numberOf(value) {
    const match = /^\s*PROMPT\s+(0?[1-9]|1\d|2[0-5])\s*[-–—:.]/i.exec(value);
    return match ? Number(match[1]) : null;
  }
  function parse(raw) {
    const source=String(raw || "").replace(/\r\n?/g,"\n").replace(/^\uFEFF/,"").trim();
    if (!source) throw Error("Cole os prompts antes de continuar.");
    try {
      const data=JSON.parse(source);
      const list=Array.isArray(data)?data:
        (data && (data.prompts || data.items || data.jobs || data.queue));
      if (Array.isArray(list)) {
        const items=list.map(textOf).map(x=>String(x).trim()).filter(Boolean);
        if (!items.length) throw Error("O JSON não contém prompts válidos.");
        if (items.length>25) throw Error("Limite máximo: 25 prompts.");
        return items;
      }
    } catch(e) {
      if (!(e instanceof SyntaxError)) throw e;
    }

    // The Android clipboard may flatten all newlines into a single line.
    // Detect numbered headings at ANY position, without modifying story text.
    const heads=[...source.matchAll(/\bPROMPT\s+(0?[1-9]|1\d|2[0-5])\s*[-–—:.][\t ]*/gi)];
    let items;
    if (heads.length) {
      const before=source.slice(0,heads[0].index).trim();
      if (before.length > 60)
        throw Error("Encontrei texto antes do primeiro título PROMPT. Remova esse trecho.");
      items=heads.map((m,i)=>source.slice(m.index,heads[i+1]?.index ?? source.length).trim());
    } else if (/^\s*(?:---+|===+)\s*$/m.test(source)) {
      items=source.split(/^\s*(?:---+|===+)\s*$/gm).map(x=>x.trim()).filter(Boolean);
    } else {
      items=[source];
    }
    if (items.length > 25) throw Error("Detectei "+items.length+" blocos; o máximo é 25.");
    return items;
  }
  function inspect(raw) {
    const prompts=parse(raw);
    const numbers=prompts.map(numberOf);
    return {prompts,numbers,count:prompts.length};
  }
  const api={parse,inspect,numberOf};
  root.KlausPromptParser=api;
  if(typeof module==="object" && module.exports) module.exports=api;
})(typeof globalThis==="object"?globalThis:this);
