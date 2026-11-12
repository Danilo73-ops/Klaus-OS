// Node.js 18+ / isolated regression suite for Chrome Android batch clipboard.
"use strict";
const assert=require("node:assert/strict");
const {parseBatch}=require("./clipboard-bridge-ui.js");
const prompts=Array.from({length:25},(_,i)=>"PROMPT "+String(i+1).padStart(2,"0")+
  " — HISTORIA "+(i+1)+"\nCreate complete 15s 9:16 video. "+ "No subtitles. ".repeat(10)).map(x=>x.trim());
assert.deepEqual(parseBatch(JSON.stringify({prompts})),prompts);
assert.deepEqual(parseBatch(JSON.stringify(prompts)),prompts);
assert.deepEqual(parseBatch(prompts.join("\n\n")),prompts);
assert.deepEqual(parseBatch(prompts.join("")),prompts);
assert.equal(parseBatch(prompts.slice(0,3).join("\n---\n")).length,3);
assert.equal(parseBatch("Um texto avulso").length,1);
assert.throws(()=>parseBatch(""),/vazio/i);
assert.throws(()=>parseBatch(Array.from({length:26},(_,i)=>"PROMPT "+(i+1)+" — X").join("\n")),/25/);
assert.throws(()=>parseBatch([prompts[0],prompts[2]].join("\n\n")),/fora de ordem/);
assert.throws(()=>parseBatch('{"prompts":[]}'),/1 a 25/);
console.log("Klaus OS batch clipboard: JSON, TXT, 25 prompts, ordem e erros OK.");
