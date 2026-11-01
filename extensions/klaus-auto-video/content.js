// JavaScript / content.js / Firefox WebExtension MV2 / fal.ai Sandbox page automation
"use strict";
(() => {
  if (window.__klausAutoVideoLoaded) return;
  window.__klausAutoVideoLoaded = true;
  let picker = null;
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none";
  };
  const inputs = () => [...document.querySelectorAll('textarea, input[type="text"], [role="textbox"], [contenteditable="true"], [data-testid*="prompt"]')].filter(visible);
  function pickPrompt() {
    return inputs().find(e => /prompt|describe|descri/i.test([e.getAttribute("placeholder"),e.getAttribute("aria-label"),e.getAttribute("data-testid"),e.getAttribute("name")].join(" "))) ||
      inputs().find(e => e.tagName.toLowerCase() === "textarea") || null;
  }
  const buttons = () => [...document.querySelectorAll('button,[role="button"],input[type="submit"]')].filter(visible);
  const runLabel = el => [el.innerText, el.textContent, el.getAttribute("aria-label"),el.getAttribute("title"),el.value].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
  function pickRun() {
    return buttons().find(b => /^(Run|Generate|Gerar)(\s*\([^)]*\))?$/i.test(runLabel(b))) ||
      buttons().filter(b => /\b(Run|Generate|Gerar)\b/i.test(runLabel(b))).at(-1) || null;
  }
  const q = selector => {
    if (!selector) return null;
    try { return document.querySelector(selector); } catch (_) { return null; }
  };
  function esc(value) { return CSS.escape(String(value)); }
  function selector(el) {
    if (el.id) return "#" + esc(el.id);
    for (const key of ["data-testid","data-test","name","aria-label","placeholder"]) {
      const v=el.getAttribute(key);
      if (v && v.length < 110) {
        const css=el.tagName.toLowerCase()+'['+key+'="'+v.replaceAll("\\","\\\\").replaceAll('"','\\"')+'"]';
        try { if (document.querySelectorAll(css).length===1) return css; }catch(_){}
      }
    }
    const parts=[];
    while(el && el.nodeType===1 && el!==document.body) {
      let part=el.tagName.toLowerCase();
      if(el.id) {parts.unshift("#"+esc(el.id));break;}
      const p=el.parentElement;
      if(p) {
        const siblings=[...p.children].filter(x=>x.tagName===el.tagName);
        if(siblings.length>1) part+=":nth-of-type("+([...p.children].filter(x=>x.tagName===el.tagName).indexOf(el)+1)+")";
      }
      parts.unshift(part);el=p;
    }
    return "body > "+parts.join(" > ");
  }
  function promptElement(sel) {
    const el=q(sel) || pickPrompt();
    if (!el || !visible(el)) throw Error("Campo de prompt indisponível. Use Marcar prompt.");
    return el;
  }
  function runElement(sel) {
    const el=q(sel) || pickRun();
    if (!el || !visible(el)) throw Error("Botão Run indisponível. Use Marcar Run.");
    return el;
  }
  function inputValue(el) {
    if ("value" in el) return el.value;
    return el.innerText || el.textContent || "";
  }
  function fillPrompt(el, text) {
    el.focus();
    if ("value" in el) {
      const proto=el.tagName.toLowerCase()==="textarea"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;
      if (setter) setter.call(el,text);else el.value=text;
      el.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:text}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
    } else if (el.isContentEditable) {
      el.textContent=text;
      el.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:text}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
    } else throw Error("Elemento selecionado não aceita texto.");
  }
  function runContext(el) {
    // Check the pricing indication closest to the button; never trust an old free quota banner elsewhere.
    let parent=el.parentElement, text="";
    for(let i=0;parent && i<3;i++,parent=parent.parentElement) {
      const t=(parent.innerText||"").trim();
      if(t.length>0 && t.length<480) text=t;
      if(/\bfree\b|gr[aá]tis|\$\s?\d/i.test(t) && t.length<480) {text=t;break;}
    }
    return text;
  }
  function pricingFree(el) {
    if(!el || !visible(el)) return false;
    const text=runContext(el);
    const free=/\bfree\b|gr[aá]tis|sem custo/i.test(text);
    // Paid total near Run takes precedence over a generic free banner elsewhere.
    const costs=[...text.matchAll(/(?:\$|USD\s*)(\d+(?:\.\d+)?)/gi)].map(m=>Number(m[1]));
    return free && !costs.some(n=>n>0);
  }
  function selectedOperation() {
    // Check the operation selected in the Sandbox editor, not items in a hidden menu.
    const labels=buttons().map(b=>runLabel(b)).filter(t=>t.length<100);
    const chosen=labels.find(t=>/\bText\s*To\s*(Video|Image)\b/i.test(t));
    if (!chosen) return "unknown";
    return /\bText\s*To\s*Video\b/i.test(chosen) ? "video" : "image";
  }
  function modelCount(run) {
    const t=run?runContext(run):"";
    const matches=[...t.matchAll(/\b(\d+)\s+models?\b/gi)];
    if(!matches.length) return 0;
    return Number(matches[matches.length-1][1]);
  }
  function linkUrl(url) {
    if(!url) return null;
    try {
      const resolved=new URL(url,document.baseURI).href;
      if (/^(https?:|blob:)/.test(resolved)) return resolved;
    } catch(_){}
    return null;
  }
  function scanVideos() {
    const collected=new Map();
    const add=(url,kind)=>{const resolved=linkUrl(url);if(resolved&&!collected.has(resolved))collected.set(resolved,{url:resolved,kind});};
    for(const video of document.querySelectorAll("video")) {
      // Do not require visible: media elements often live in hidden output cards.
      add(video.currentSrc || video.src || video.getAttribute("src"),"video");
      for(const source of video.querySelectorAll("source[src]")) add(source.getAttribute("src"),"source");
    }
    // The preview has a small Download control shown on hover (observed in fal.ai).
    // If that control is a native <a href>, resolve its media URL and reuse the
    // verified Firefox downloads.download path with predictable file naming.
    // Never blindly click a button here: that can open a dialog or duplicate downloads.
    for(const a of document.querySelectorAll('a[href]')) {
      const h=a.getAttribute("href")||"";
      const label=[a.getAttribute("title"),a.getAttribute("aria-label"),
        a.getAttribute("data-testid"),a.getAttribute("download"),a.textContent]
        .filter(Boolean).join(" ");
      const mediaUrl=/\.mp4(?:[?#]|$)|\.webm(?:[?#]|$)|\/video\//i.test(h);
      const downloadControl=/\b(download|baixar|descargar)\b/i.test(label);
      if(mediaUrl || (a.hasAttribute("download") && /video|mp4|download/i.test(label)) ||
         (downloadControl && /\.(?:mp4|webm)(?:[?#]|$)/i.test(h))) {
        add(h,downloadControl?"preview-download-link":"link");
      }
    }
    return [...collected.values()];
  }
  // Event-driven result discovery. No tab timer is required to notice newly
  // inserted <video> or media links, including when fal.ai updates the DOM later.
  let watch={enabled:false,baseline:new Set(),lastSignature:"",lastPoke:0};
  function signalMediaChange(force=false) {
    if(!watch.enabled) return;
    const urls=scanVideos().map(v=>v.url).filter(url=>!watch.baseline.has(url));
    if(!urls.length) return;
    const signature=urls.slice(0,30).sort().join("|");
    if(!force && signature===watch.lastSignature) return;
    watch.lastSignature=signature;
    browser.runtime.sendMessage({type:"MEDIA_SIGNAL", urls:urls.slice(0,40)})
      .catch(()=>{});
  }
  let mediaSignalScheduled=false;
  function mediaChanged() {
    if(!watch.enabled || mediaSignalScheduled) return;
    mediaSignalScheduled=true;
    queueMicrotask(()=>{
      mediaSignalScheduled=false;
      try{signalMediaChange();}catch(_){}
    });
  }
  const mediaObserver=new MutationObserver(mutations=>{
    if(!watch.enabled) return;
    if(mutations.some(m=>m.type==="childList" ||
      ["src","href","data-src","poster"].includes(m.attributeName))) mediaChanged();
  });
  mediaObserver.observe(document.documentElement,{
    subtree:true,childList:true,attributes:true,
    attributeFilter:["src","href","data-src","poster"]
  });
  document.addEventListener("visibilitychange",mediaChanged);
  window.addEventListener("pageshow",mediaChanged);
  window.addEventListener("scroll",mediaChanged,{passive:true});
  function wakeLatestResult() {
    if(!watch.enabled) return;
    if(Date.now()-watch.lastPoke<5000) return;
    watch.lastPoke=Date.now();
    // fal.ai places newest generations at the top of the result timeline;
    // bring that area into the viewport so lazy media elements can mount.
    const root=document.scrollingElement || document.documentElement;
    if(root && root.scrollTop>0) root.scrollTop=0;
    const scrolls=[...document.querySelectorAll("main,section,[role='main']")].filter(el=>{
      try {return el.scrollHeight>el.clientHeight+80 &&
        getComputedStyle(el).overflowY!=="visible";}catch(_){return false;}
    });
    for(const el of scrolls.slice(0,3)) if(el.scrollTop>0) el.scrollTop=0;
    mediaChanged();
  }
  function showOverlay(message) {
    const id="klaus-auto-video-picker";
    document.getElementById(id)?.remove();
    const bar=document.createElement("div");
    bar.id=id;
    Object.assign(bar.style,{position:"fixed",zIndex:"2147483647",top:"12px",right:"12px",padding:"15px 18px",maxWidth:"420px",background:"#11243b",color:"#e1f5ff",border:"2px solid #64ddf4",borderRadius:"12px",font:"600 15px sans-serif",boxShadow:"0 8px 28px #0008"});
    bar.textContent=message+" | Esc cancela.";
    document.body.appendChild(bar);
    return bar;
  }
  function beginPick(kind) {
    if(picker) picker.cleanup();
    const bar=showOverlay(kind==="prompt"?"Clique no campo em que você escreve o prompt.":"Clique no botão Run sem iniciar geração.");
    let hover=null;
    function clear() {if(hover)hover.style.outline="";hover=null;}
    function move(e) {
      let el=e.target.closest(kind==="prompt"?'textarea,input,[role="textbox"],[contenteditable="true"]':'button,[role="button"],input[type="submit"]');
      if(el===hover)return;
      clear();
      if(el){hover=el;hover.style.outline="3px solid #19d1ef";}
    }
    async function click(e) {
      // Touchscreen AVNC can dispatch click without a preceding pointermove.
      const target=e.target.closest(kind==="prompt"
        ? 'textarea,input,[role="textbox"],[contenteditable="true"]'
        : 'button,[role="button"],input[type="submit"]');
      if(!target)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const sel=selector(target);
      cleanup();
      try {
        const r=await browser.runtime.sendMessage({type:"PICKED",kind,selector:sel});
        if(r?.error) throw Error(r.error);
        const note=showOverlay("✅ "+(kind==="prompt"?"Campo":"Run")+" salvo. Volte ao painel da extensão.");
        setTimeout(()=>note.remove(),3300);
      }catch(err){const note=showOverlay("Erro: "+err.message);setTimeout(()=>note.remove(),3500);}
    }
    function key(e){if(e.key==="Escape")cleanup();}
    function cleanup(){document.removeEventListener("pointermove",move,true);document.removeEventListener("click",click,true);document.removeEventListener("keydown",key,true);clear();bar.remove();picker=null;}
    picker={cleanup};
    document.addEventListener("pointermove",move,true);
    document.addEventListener("click",click,true);
    document.addEventListener("keydown",key,true);
    return {ok:true};
  }
  browser.runtime.onMessage.addListener(async msg => {
    switch(msg.op) {
    case "WATCH_MEDIA": {
      watch.enabled=true;
      watch.baseline=new Set(Array.isArray(msg.baseline)?msg.baseline:[]);
      watch.lastSignature="";
      watch.lastPoke=0;
      signalMediaChange(true);
      return {ok:true};
    }
    case "UNWATCH_MEDIA": {
      watch.enabled=false;
      return {ok:true};
    }
    case "WAKE_RESULTS": {
      wakeLatestResult();
      return {ok:true,visibility:document.visibilityState};
    }
    case "AUTOMARK": {
      const p=pickPrompt(), r=pickRun();
      return {
        prompt:p?selector(p):null,
        run:r?selector(r):null,
        operation:selectedOperation(),
        free:pricingFree(r),
        modelCount:modelCount(r),
        promptLabel:p?[p.tagName,p.getAttribute("placeholder")||""].join(" "):"",
        runLabel:r?runLabel(r):""
      };
    }
    case "PICK": return beginPick(msg.kind);
    case "SCAN": {
      const p=q(msg.calibration?.prompt)||pickPrompt();
      const r=q(msg.calibration?.run)||pickRun();
      return {promptFound:!!p,runFound:!!r,operation:selectedOperation(),free:pricingFree(r),modelCount:modelCount(r),videos:scanVideos(),pageHidden:document.hidden,visibility:document.visibilityState,priceHint:r?runContext(r).slice(-180):""};
    }
    case "FILL": {fillPrompt(promptElement(msg.selector),msg.text);return {ok:true};}
    case "READ_PROMPT": return {text:inputValue(promptElement(msg.selector))};
    case "RUN": {
      const b=runElement(msg.selector);
      if(selectedOperation() !== "video") throw Error("Operação diferente de Text To Video. Nada foi enviado.");
      if(msg.requireFree&&!pricingFree(b)) throw Error("Custo grátis não confirmado perto de Run.");
      if(b.disabled || b.getAttribute("aria-disabled")==="true") throw Error("Botão Run desabilitado.");
      b.click();
      return {clicked:true};
    }
    default: throw Error("Ação não reconhecida pelo site.");
    }
  });
})();
