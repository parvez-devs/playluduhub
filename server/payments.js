'use strict';
const {db,getConfig}=require('./db');
const wallet=require('./wallet');
const aml=require('./aml');
const {uid}=require('./utils');

/*
 * Manual payment mode
 * -------------------
 * Deposit approval means an authorized operator has manually verified the
 * bKash/Nagad transaction in the merchant/app statement.
 *
 * Withdrawal approval means an authorized operator has already sent the
 * payout manually and is now confirming it as paid.
 *
 * No payment gateway API, webhook, API key, or provider secret is required.
 */
function assertEmailVerified(userId){const u=db.prepare('SELECT email_verified FROM users WHERE id=?').get(userId);if(!u)throw err('USER_NOT_FOUND');if(!u.email_verified)throw err('EMAIL_NOT_VERIFIED');}
function createDeposit(userId,{method,amount,transactionId}){
  assertEmailVerified(userId);const c=getConfig(), paisa=Math.round(Number(amount)*100);
  if(!['bkash','nagad'].includes(method))throw err('INVALID_METHOD');
  if(paisa<Math.round(c.minDeposit*100)||paisa>Math.round(c.maxDeposit*100))throw err('DEPOSIT_LIMIT');
  const txid=String(transactionId||'').trim();
  if(!txid)throw err('TRANSACTION_ID_REQUIRED');
  const duplicate=db.prepare('SELECT id,status,method FROM deposits WHERE transaction_id=? LIMIT 1').get(txid);
  if(duplicate)throw err('DUPLICATE_TRANSACTION_ID');
  const id=uid('dep');
  aml.checkDeposit(userId,paisa,id);
  db.prepare('INSERT INTO deposits(id,user_id,method,amount,transaction_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
    .run(id,userId,method,paisa,txid,Date.now(),Date.now());
  return getDeposit(id);
}
function getDeposit(id){return db.prepare('SELECT * FROM deposits WHERE id=?').get(id);}

function approveDeposit(id,actor='admin'){
  const tx=db.transaction(()=>{
    const d=getDeposit(id);
    if(!d)throw err('NOT_FOUND');
    if(d.status==='approved')return d;
    if(d.status==='rejected')throw err('DEPOSIT_ALREADY_REJECTED');
    if(!['pending','failed'].includes(d.status))throw err('INVALID_DEPOSIT_STATUS');
    wallet.creditDeposit(d.user_id,d.amount,id);
    db.prepare("UPDATE deposits SET status='approved',gateway_ref=NULL,admin_note=?,updated_at=? WHERE id=?")
      .run(`Manually verified by ${String(actor).slice(0,120)}`,Date.now(),id);
    return getDeposit(id);
  });
  return tx();
}
function rejectDeposit(id,note='Rejected by admin',actor='admin'){
  const d=getDeposit(id);
  if(!d)throw err('NOT_FOUND');
  if(d.status==='approved')throw err('DEPOSIT_ALREADY_APPROVED');
  if(d.status==='rejected')return d;
  if(!['pending','failed'].includes(d.status))throw err('INVALID_DEPOSIT_STATUS');
  db.prepare("UPDATE deposits SET status='rejected',admin_note=?,updated_at=? WHERE id=?")
    .run(`${String(note).slice(0,180)} [${String(actor).slice(0,120)}]`,Date.now(),id);
  return getDeposit(id);
}

function createWithdrawal(userId,{method,accountNumber,amount,sourceBucket='cash'}){
  assertEmailVerified(userId);const c=getConfig(), paisa=Math.round(Number(amount)*100);
  if(!['bkash','nagad'].includes(method))throw err('INVALID_METHOD');
  if(sourceBucket==='bonus'&&!c.bonusWithdrawable)throw err('BONUS_WITHDRAW_DISABLED');
  if(!['winnings','cash','bonus'].includes(sourceBucket))throw err('INVALID_SOURCE');
  if(paisa<Math.round(c.minWithdraw*100)||paisa>Math.round(c.maxWithdraw*100))throw err('WITHDRAW_LIMIT');
  const u=db.prepare('SELECT id FROM users WHERE id=?').get(userId);
  if(!u)throw err('USER_NOT_FOUND');
  aml.checkWithdrawal(userId,paisa);
  const fee=Math.round(paisa*(Number(c.withdrawalFeePercent||0)/100)), id=uid('wd');
  db.transaction(()=>{
    wallet.lockWithdrawal(userId,paisa,sourceBucket,id);
    db.prepare('INSERT INTO withdrawals(id,user_id,method,account_number,amount,fee,source_bucket,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id,userId,method,String(accountNumber).trim(),paisa,fee,sourceBucket,Date.now(),Date.now());
  })();
  return getWithdrawal(id);
}
function getWithdrawal(id){return db.prepare('SELECT * FROM withdrawals WHERE id=?').get(id);}

function approveWithdrawal(id,actor='admin'){
  const tx=db.transaction(()=>{
    const w=getWithdrawal(id);
    if(!w)throw err('NOT_FOUND');
    if(w.status==='paid')return w;
    if(w.status==='rejected'||w.status==='failed')throw err('WITHDRAWAL_ALREADY_CLOSED');
    if(w.status!=='pending')throw err('INVALID_WITHDRAW_STATUS');
    wallet.finalizeWithdrawal(w.user_id,w.amount,w.fee,id);
    db.prepare("UPDATE withdrawals SET status='paid',gateway_ref=NULL,admin_note=?,updated_at=? WHERE id=?")
      .run(`Manual payout confirmed by ${String(actor).slice(0,120)}`,Date.now(),id);
    return getWithdrawal(id);
  });
  return tx();
}
function rejectWithdrawal(id,note='Rejected by admin',actor='admin'){
  const tx=db.transaction(()=>{
    const w=getWithdrawal(id);
    if(!w)throw err('NOT_FOUND');
    if(w.status==='paid')throw err('WITHDRAWAL_ALREADY_PAID');
    if(w.status==='rejected'||w.status==='failed')return w;
    if(w.status!=='pending')throw err('INVALID_WITHDRAW_STATUS');
    wallet.refundWithdrawal(w.user_id,w.amount,w.source_bucket,id,note);
    db.prepare("UPDATE withdrawals SET status='rejected',admin_note=?,updated_at=? WHERE id=?")
      .run(`${String(note).slice(0,180)} [${String(actor).slice(0,120)}]`,Date.now(),id);
    return getWithdrawal(id);
  });
  return tx();
}
function err(code){return Object.assign(new Error(code),{code});}
module.exports={createDeposit,approveDeposit,rejectDeposit,getDeposit,createWithdrawal,approveWithdrawal,rejectWithdrawal,getWithdrawal};
