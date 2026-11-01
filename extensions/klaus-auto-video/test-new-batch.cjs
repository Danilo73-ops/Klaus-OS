// JavaScript / test-new-batch.cjs / Node.js 18+ / Firefox extension state regression
"use strict";
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const content=fs.readFileSync(require("node:path").join(__dirname,"background.js"),"utf8");
function start(previous){
  const key="klausAutoVideoV1",data=new Map(previous?[[key,previous]]:[]);
  const downloads=[];
  let recv=null;
  const browser={
    storage:{local:{
      async get(k){return {[k]:data.get(k)};},
      async set(obj){for(const [k,v] of Object.entries(obj))data.set(k,v);}
    }},
    downloads:{
      onChanged:{addListener(){}},
      async download(x){downloads.push(x);return downloads.length;},
      async search(){return [{state:"complete",filename:"/home/Downloads/test.json"}];}
    },
    runtime:{onMessage:{addListener(f){recv=f;}}},
    browserAction:{onClicked:{addListener(){}}}
  };
  vm.runInNewContext(content,{browser,Blob,URL,Date,Promise,JSON,
    setTimeout,clearTimeout,console});
  return {call:async message=>recv(message,null),data,downloads};
}
const scripts=Array.from({length:25},(_,i)=>
  "PROMPT "+String(i+1).padStart(2,"0")+
  " — HISTORIA NUEVA "+(i+1)+"\\n"+
  "Create a complete 15s 9:16 Spanish dialogue drama with natural voices. ".repeat(3));
function oldBatch(status="complete"){
  return {
    prompts:scripts.map((text,id)=>({id,text,status:"done",
      filename:"/home/Downloads/ESPANHOL/klaus_ext_es_"+String(id+1).padStart(2,"0")+".mp4"})),
    cursor:25,status,tabId:7,calibration:{prompt:"#input",run:"#run"},
    freeOnly:true,inFlight:null,history:[{index:0,filename:"old.mp4"}],
    log:["all done"],updatedAt:1
  };
}
(async()=>{
  const t=start(oldBatch());
  const result=await t.call({type:"NEW_BATCH_IMPORT",prompts:scripts.map((s,i)=>s.replace("HISTORIA NUEVA","HISTORIA DIFERENTE"))});
  assert.equal(result.ok,true);
  assert.equal(result.batchNo,2);
  assert.equal(result.total,25);
  const fresh=t.data.get("klausAutoVideoV1");
  assert.equal(fresh.cursor,0);
  assert.equal(fresh.batchNo,2);
  assert.equal(fresh.prompts.length,25);
  assert(fresh.prompts.every(x=>x.status==="waiting"));
  assert.equal(fresh.tabId,7);
  assert.equal(fresh.history.length,0);
  const archived=[...t.data.entries()].filter(([k])=>k.startsWith("klausAutoVideoArchiveV2_"));
  assert.equal(archived.length,1);
  assert.equal(archived[0][1].prompts.length,25);
  assert.equal(archived[0][1].prompts[0].filename,"/home/Downloads/ESPANHOL/klaus_ext_es_01.mp4");
  assert.equal(t.downloads.length,1);
  assert(t.downloads[0].filename.includes("/Backups/"));
  assert.equal(t.downloads[0].conflictAction,"uniquify");
  const blocked=start(oldBatch("paused"));
  const rejected=await blocked.call({type:"NEW_BATCH_IMPORT",prompts:scripts});
  assert.match(rejected.error,/pendências/);
  assert.equal(blocked.data.get("klausAutoVideoV1").status,"paused");
  assert.equal(blocked.downloads.length,0);
  const missing=start(oldBatch());
  const bad=await missing.call({type:"NEW_BATCH_IMPORT",prompts:scripts.slice(1)});
  assert.match(bad.error,/exatamente 25/);
  assert.equal(missing.data.get("klausAutoVideoV1").prompts.length,25);
  console.log("NEW_BATCH_IMPORT: archives old 25, backs up JSON, preserves MP4, prepares 25, blocks invalid/active.");
})().catch(e=>{console.error(e);process.exitCode=1;});
