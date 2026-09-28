'use strict';
const {db}=require('./db');
const {uid}=require('./utils');
const COL={cash:'cash_balance',winnings:'winnings_balance',locked:'locked_balance',bonus:'bonus_balance',total_deposited:'total_deposited',total_withdrawn:'total_withdrawn'};
function wallet(userId){const w=db.prepare('SELECT * FROM wallets WHERE user_id=?').get(userId); if(!w) throw Object.assign(new Error('WALLET_NOT_FOUND'),{code:'WALLET_NOT_FOUND'}); return w;}
function post(userId,bucket,delta,type,refId=null,note=null){
  const col=COL[bucket]; if(!col) throw new Error('INVALID_BUCKET'); if(!Number.isInteger(delta)) throw new Error('MONEY_MUST_BE_INTEGER_PAISA');
  const w=wallet(userId), next=w[col]+delta; if(next<0) throw Object.assign(new Error('INSUFFICIENT_FUNDS'),{code:'INSUFFICIENT_FUNDS',bucket});
  db.prepare(`UPDATE wallets SET ${col}=?,updated_at=? WHERE user_id=?`).run(next,Date.now(),userId);
  db.prepare('INSERT INTO ledger(id,user_id,type,balance_bucket,amount,balance_after,ref_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(uid('led'),userId,type,bucket,delta,next,refId,note,Date.now());
  return next;
}
function transfer(userId,from,to,amount,type,refId,note){ if(amount<=0||!Number.isInteger(amount)) throw new Error('INVALID_TRANSFER'); post(userId,from,-amount,type,refId,`${note||''} [debit ${from}]`); post(userId,to,amount,type,refId,`${note||''} [credit ${to}]`); }
function adminPost(delta,type,refId=null,note=null){const a=db.prepare("SELECT * FROM admin_accounts WHERE id='main'").get(), next=a.revenue_balance+delta; if(next<0) throw new Error('ADMIN_NEGATIVE_BALANCE'); db.prepare("UPDATE admin_accounts SET revenue_balance=?,updated_at=? WHERE id='main'").run(next,Date.now()); db.prepare('INSERT INTO admin_ledger(id,type,amount,balance_after,ref_id,note,created_at) VALUES(?,?,?,?,?,?,?)').run(uid('aled'),type,delta,next,refId,note,Date.now()); return next;}
function assertWallet(userId){
  const w=wallet(userId); for(const c of Object.values(COL)) if(!Number.isInteger(w[c])||w[c]<0) throw new Error(`WALLET_INVARIANT:${c}`);
  for(const [bucket,col] of Object.entries(COL)){ const last=db.prepare('SELECT balance_after FROM ledger WHERE user_id=? AND balance_bucket=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(userId,bucket); if(last && last.balance_after!==w[col]) throw new Error(`LEDGER_BALANCE_MISMATCH:${bucket}`); }
  return true;
}
module.exports={wallet,post,transfer,adminPost,assertWallet,COL};

