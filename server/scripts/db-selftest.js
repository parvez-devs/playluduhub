'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');

const base=path.join(os.tmpdir(),`plh-v13-${process.pid}-${Date.now()}`);
process.env.DB_PATH=base+'.sqlite';
process.env.NODE_ENV='test';

const {db,getConfig}=require('../db');

try{
  const userCols=db.prepare('PRAGMA table_info(users)').all().map(x=>x.name);
  assert(userCols.includes('referral_code'),'users.referral_code missing');
  assert(userCols.includes('referred_by'),'users.referred_by missing');

  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
  for(const name of ['referrals','referral_games','matches','match_players','wallets','ledger'])assert(tables.has(name),name+' table missing');

  const cfg=getConfig();
  assert.strictEqual(Number(cfg.speedTurnSeconds),7);
  assert.strictEqual(Number(cfg.blitzTurnSeconds),5);
  assert.strictEqual(Number(cfg.referralGamesRequired),2);
  assert.strictEqual(cfg.referralEnabled,true);

  const versions=db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(x=>x.version);
  assert(versions.includes(4),'schema migration v4 missing');
  console.log('v13 database schema invariants passed');
} finally {
  db.close();
  for(const suffix of ['','.sqlite-wal','.sqlite-shm']){
    const file=suffix?base+suffix:base+'.sqlite';
    try{fs.rmSync(file,{force:true});}catch{}
  }
}
