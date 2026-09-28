'use strict';
const fs=require('fs'),path=require('path'); const {db,DB_PATH}=require('../db'); const {ensureDir}=require('../utils');
(async()=>{const dir=path.resolve(process.env.BACKUP_DIR||path.join(path.dirname(DB_PATH),'backups')); ensureDir(dir); const stamp=new Date().toISOString().replace(/[:.]/g,'-'); const dest=path.join(dir,`db-${stamp}.sqlite`); await db.backup(dest); const files=fs.readdirSync(dir).filter(x=>x.endsWith('.sqlite')).map(x=>({x,t:fs.statSync(path.join(dir,x)).mtimeMs})).sort((a,b)=>b.t-a.t); for(const f of files.slice(7))fs.unlinkSync(path.join(dir,f.x)); console.log(dest);})().catch(e=>{console.error(e);process.exit(1);});

