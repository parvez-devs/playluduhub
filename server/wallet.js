'use strict';
const {db,getConfig}=require('./db');
const ledger=require('./ledger');
const {uid}=require('./utils');

function createWallet(userId){db.prepare('INSERT INTO wallets(user_id,updated_at) VALUES(?,?)').run(userId,Date.now());}
function lockMatchFunds(userId,entryFee,betAmount,matchId){
  const total=entryFee+betAmount;
  const tx=db.transaction(()=>{
    const w=ledger.wallet(userId); if(w.cash_balance<total) throw Object.assign(new Error('INSUFFICIENT_CASH'),{code:'INSUFFICIENT_CASH'});
    ledger.transfer(userId,'cash','locked',entryFee,'entry_fee',matchId,'PvP entry fee escrow');
    ledger.transfer(userId,'cash','locked',betAmount,'bet_lock',matchId,'PvP bet escrow');
    ledger.assertWallet(userId);
  }); tx(); return ledger.wallet(userId);
}
function unlockMatchFunds(userId,amount,matchId,reason='Match cancelled'){const tx=db.transaction(()=>{ledger.transfer(userId,'locked','cash',amount,'adjustment',matchId,reason); ledger.assertWallet(userId);}); tx();}
function creditDeposit(userId,amount,depositId){const tx=db.transaction(()=>{ledger.post(userId,'cash',amount,'deposit',depositId,'Verified merchant deposit'); ledger.post(userId,'total_deposited',amount,'deposit',depositId,'Lifetime deposited'); ledger.assertWallet(userId);}); tx();}
function addWelcomeBonus(userId){const c=getConfig(), amount=Math.round(Number(c.welcomeBonus||0)*100); if(amount<=0)return; db.transaction(()=>{ledger.post(userId,'bonus',amount,'bonus_credit','welcome','Welcome bonus'); ledger.assertWallet(userId);})();}
function lockWithdrawal(userId,amount,sourceBucket,withdrawalId){db.transaction(()=>{ledger.transfer(userId,sourceBucket,'locked',amount,'withdraw_lock',withdrawalId,'Withdrawal pending'); ledger.assertWallet(userId);})();}
function finalizeWithdrawal(userId,amount,fee,withdrawalId){db.transaction(()=>{const payout=amount-fee; if(payout<0)throw new Error('WITHDRAW_FEE_EXCEEDS_AMOUNT'); if(payout)ledger.post(userId,'locked',-payout,'withdraw_paid',withdrawalId,'Payout confirmed'); if(fee){ledger.post(userId,'locked',-fee,'admin_fee',withdrawalId,'Withdrawal fee settled'); ledger.adminPost(fee,'admin_fee',withdrawalId,'Withdrawal fee');} ledger.post(userId,'total_withdrawn',payout,'withdraw_paid',withdrawalId,'Lifetime external payout'); ledger.assertWallet(userId);})();}
function refundWithdrawal(userId,amount,sourceBucket,withdrawalId,reason='Withdrawal refunded'){db.transaction(()=>{ledger.transfer(userId,'locked',sourceBucket,amount,'withdraw_refund',withdrawalId,reason); ledger.assertWallet(userId);})();}
function adjust(userId,bucket,delta,note,refId=uid('adj')){db.transaction(()=>{ledger.post(userId,bucket,delta,'adjustment',refId,note); ledger.assertWallet(userId);})(); return ledger.wallet(userId);}
module.exports={createWallet,lockMatchFunds,unlockMatchFunds,creditDeposit,addWelcomeBonus,lockWithdrawal,finalizeWithdrawal,refundWithdrawal,adjust};

