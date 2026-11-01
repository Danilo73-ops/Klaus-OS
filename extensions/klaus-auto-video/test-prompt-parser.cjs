// JavaScript / test-prompt-parser.cjs / Node.js 18+ / Klaus Auto Video regression suite
"use strict";
const assert = require("node:assert/strict");
const {parse, inspect, numberOf} = require("./prompt-parser.js");
const story=n => "PROMPT "+String(n).padStart(2,"0")+" — La historia "+n+
"\nCreate complete 15 seconds video. CAST: " + "details ".repeat(30)+
"\nCONTINUITY: End without issues.";
const list=Array.from({length:24},(_,i)=>story(i+2));
assert.equal(parse(list.join("\n\n")).length,24);
assert.equal(parse(list.join("")).length,24,"joined without whitespace");
const flat=list.join(" ").replace(/\n/g,"");
assert.deepEqual(inspect(flat).numbers,Array.from({length:24},(_,i)=>i+2));
assert.equal(inspect(story(2)+"\n\n"+story(4)+"\n\n"+story(25)).count,3);
assert.deepEqual(inspect(story(2)+"\n\n"+story(4)+"\n\n"+story(25)).numbers,[2,4,25]);
assert.deepEqual(inspect(JSON.stringify({prompts:list})).numbers,Array.from({length:24},(_,i)=>i+2));
assert.equal(numberOf("PROMPT 02 — NO VAS A DECIDIR POR MÍCreate a complete"),2);
assert.equal(parse(story(2)).length,1);
assert.throws(()=>parse(""),/Cole os prompts/);
console.log("Klaus Auto Video: parser de prompts 02–25 OK (multiline, flattened, JSON, missing heading).");
