'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'../..');
const files=[]; function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory() && e.name!=='node_modules')walk(p); else if(e.isFile()&&p.endsWith('.js'))files.push(p);}} walk(root);
let bad=0; for(const f of files){const r=cp.spawnSync(process.execPath,['--check',f],{encoding:'utf8'}); if(r.status!==0){bad++; console.error(r.stderr||r.stdout);}} console.log(`${files.length-bad}/${files.length} JS files parsed`); process.exitCode=bad?1:0;

