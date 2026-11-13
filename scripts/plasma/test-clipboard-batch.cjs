// Node.js 18+ / Regression tests for safe, lossless Chrome Android clipboard batches.
"use strict";
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {join}=require("node:path");
const {parseBatch}=require("./clipboard-bridge-ui.js");

const prompts=Array.from({length:25},(_,i)=>
  "PROMPT "+String(i+1).padStart(2,"0")+" — CENA "+(i+1)+"\n"+
  "Exactly 15 seconds, vertical 9:16. 🎬\n\n"+
  "First beat: original dialogue "+(i+1)+".\n\n"+
  "CAMERA: single continuous movement.\n\n"+
  "Final beat: end of a complete script "+(i+1)+"."
);
for(const n of [2,4,25]){
  const items=prompts.slice(0,n);
  assert.deepEqual(parseBatch(items.join("\n\n")),items,"never split inner blank lines");
  assert.deepEqual(parseBatch(JSON.stringify({prompts:items})),items,"JSON array values");
  assert.deepEqual(parseBatch(JSON.stringify(items)),items,"bare JSON array");
  assert.deepEqual(parseBatch(JSON.stringify({jobs:items.map(prompt=>({prompt}))})),items,"JSON jobs");
}
assert.deepEqual(parseBatch(prompts.slice(0,4).join("\n===PROMPT===\n")),prompts.slice(0,4));
assert.deepEqual(parseBatch(["Primeiro roteiro\n\nFala interna.", "Segundo roteiro\n\nOutra fala.", "Terceiro", "Quarto"].join("\n===PROMPT===\n")),
  ["Primeiro roteiro\n\nFala interna.", "Segundo roteiro\n\nOutra fala.", "Terceiro", "Quarto"]);
const markdown=prompts.slice(0,4).map(s=>"# **"+s.replace("PROMPT","PROMPT")+"**").join("\n\n");
assert.equal(parseBatch(markdown).length,4,"markdown headings");
assert.equal(parseBatch(prompts.slice(0,4).join(" ")).length,1,"flattened text remains one instead of dangerous guessing");
assert.equal(parseBatch("Primeira cena\n\nSegunda cena\n\n---\n\nOutra cena").length,1,"no splitting at blanks or ---");
assert.equal(parseBatch("A personagem fala PROMPT 02 — no diálogo\n\nDepois continua.").length,1,"inline heading never splits");
assert.throws(()=>parseBatch(""),/vazio/);
assert.throws(()=>parseBatch('{"prompts":[}'),/JSON inválido/);
assert.throws(()=>parseBatch('{"prompts":[{}]}'),/item sem texto/);
assert.throws(()=>parseBatch("===PROMPT===\nSem texto anterior"),/sem texto/);
assert.throws(()=>parseBatch(prompts.join("\n\n")+"\n\nPROMPT 26 — Extra\nÚltimo roteiro"),/25/);
assert.throws(()=>parseBatch(prompts[2]+"\n\n"+prompts[1]),/fora de ordem/);
const ui=readFileSync(join(__dirname,"clipboard-bridge-ui.js"),"utf8");
assert.match(ui,/Conferência:/);
assert.match(ui,/reviewed=old.version===3/);
assert.match(ui,/Array\.from\(text\)\.length/);
assert.doesNotMatch(ui,/splitMode === "blanks"/);
assert.doesNotMatch(ui,/const flattened/);
assert.doesNotMatch(ui,/async function loadBatch/);
console.log("Klaus clipboard SAFE V3: 4/25 completos, sem cortes por parágrafos, conferência e backup OK.");
