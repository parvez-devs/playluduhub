'use strict';
const {EventEmitter}=require('events');
const {db,getConfig}=require('./db');
const wallet=require('./wallet'); const ledger=require('./ledger'); const engine=require('./game-engine'); const {uid}=require('./utils'); const {audit}=require('./audit');
const events=new EventEmitter(); const timers=new Map(); const disconnectTimers=new Map();
const cents=(v)=>Math.round(Number(v)*100);
function rowState(m){return m.state_json?JSON.parse(m.state_json):null;}
function saveState(matchId,state){db.prepare('UPDATE matches SET state_json=?,revision=? WHERE id=?').run(JSON.stringify(state),state.revision,matchId);}
function getMatch(id){const m=db.prepare('SELECT * FROM matches WHERE id=?').get(id); if(!m)throw err('MATCH_NOT_FOUND'); return m;}
function assertEligible(userId){const u=db.prepare('SELECT status,email_verified,self_excluded,cool_off_until FROM users WHERE id=?').get(userId); if(!u||u.status!=='approved')throw err('ACCOUNT_NOT_APPROVED'); if(!u.email_verified)throw err('EMAIL_NOT_VERIFIED'); if(u.self_excluded)throw err('SELF_EXCLUDED'); if(u.cool_off_until&&u.cool_off_until>Date.now())throw err('COOL_OFF_ACTIVE');}
function createMatch(userId,{entryFee,betAmount}){
  assertEligible(userId); const c=getConfig(); if(!c.pvpEnabled)throw err('PVP_DISABLED'); const ef=cents(entryFee??c.entryFee), bet=cents(betAmount);
  if(ef!==cents(c.entryFee))throw err('INVALID_ENTRY_FEE'); if(bet<cents(c.minBet)||bet>cents(c.maxBet))throw err('INVALID_BET');
  const id=uid('match');
  db.transaction(()=>{wallet.lockMatchFunds(userId,ef,bet,id); db.prepare("INSERT INTO matches(id,player_a_id,entry_fee,bet_amount,status,created_at) VALUES(?,?,?,?, 'waiting',?)").run(id,userId,ef,bet,Date.now()); db.prepare('INSERT INTO match_players(match_id,user_id,seat,locked_amount) VALUES(?,?,0,?)').run(id,userId,ef+bet);})();
  events.emit('lobby'); return serializeMatch(getMatch(id));
}
function joinMatch(userId,matchId){
  assertEligible(userId); const c=getConfig(); let out;
  db.transaction(()=>{const m=getMatch(matchId); if(m.status!=='waiting'||m.player_b_id)throw err('MATCH_NOT_JOINABLE'); if(m.player_a_id===userId)throw err('CANNOT_JOIN_OWN_MATCH'); wallet.lockMatchFunds(userId,m.entry_fee,m.bet_amount,m.id); const state=engine.newGame([m.player_a_id,userId],c); state.deadline=Date.now()+Number(c.turnSeconds||10)*1000; db.prepare("UPDATE matches SET player_b_id=?,status='active',state_json=?,revision=?,started_at=? WHERE id=?").run(userId,JSON.stringify(state),state.revision,Date.now(),m.id); db.prepare('INSERT INTO match_players(match_id,user_id,seat,locked_amount) VALUES(?,?,1,?)').run(m.id,userId,m.entry_fee+m.bet_amount); out=serializeMatch(getMatch(m.id));})();
  scheduleTurn(matchId); emitState(matchId); events.emit('lobby'); return out;
}
function cancelWaiting(userId,matchId){db.transaction(()=>{const m=getMatch(matchId); if(m.status!=='waiting'||m.player_a_id!==userId)throw err('CANNOT_CANCEL'); const mp=db.prepare('SELECT locked_amount FROM match_players WHERE match_id=? AND user_id=?').get(matchId,userId); wallet.unlockMatchFunds(userId,mp.locked_amount,matchId,'Waiting match cancelled'); db.prepare("UPDATE matches SET status='cancelled',ended_at=?,end_reason='cancelled_by_creator' WHERE id=?").run(Date.now(),matchId);})(); events.emit('lobby');}
function listOpen(){expireWaitingMatches();return db.prepare("SELECT m.*,u.username creator_username FROM matches m JOIN users u ON u.id=m.player_a_id WHERE m.status='waiting' ORDER BY m.created_at DESC LIMIT 100").all().map(serializeMatch);}
function listLive(){return db.prepare("SELECT * FROM matches WHERE status IN('active','disputed') ORDER BY started_at DESC LIMIT 100").all().map(serializeMatch);}
function ensurePlayer(m,userId){if(m.player_a_id!==userId&&m.player_b_id!==userId)throw err('NOT_MATCH_PLAYER');}
function roll(userId,matchId,expectedState){const m=getMatch(matchId); ensurePlayer(m,userId); if(m.status!=='active')throw err('MATCH_NOT_ACTIVE'); const st=rowState(m); if(expectedState!=null&&Number(expectedState)!==st.revision)throw err('STALE_STATE'); const r=engine.rollDice(st,userId); if(r.state.phase==='active')r.state.deadline=Date.now()+Number(getConfig().turnSeconds||10)*1000; saveState(matchId,r.state); events.emit('message',matchId,{type:'dice',value:r.value,by:userId}); if(r.forfeit||r.state.rolled===null)emitTurn(matchId,r.state); emitState(matchId); scheduleTurn(matchId); return r;}
function move(userId,matchId,tokenId,expectedState){const m=getMatch(matchId); ensurePlayer(m,userId); if(m.status!=='active')throw err('MATCH_NOT_ACTIVE'); const st=rowState(m); if(expectedState!=null&&Number(expectedState)!==st.revision)throw err('STALE_STATE'); const r=engine.moveToken(st,userId,tokenId); if(r.finished){saveState(matchId,r.state); events.emit('message',matchId,{type:'move',tokenId,path:r.path,captured:r.captured,reachedHome:r.reachedHome,extraTurn:r.extraTurn,by:userId}); settle(matchId,userId,'completed'); return r;} r.state.deadline=Date.now()+Number(getConfig().turnSeconds||10)*1000; saveState(matchId,r.state); events.emit('message',matchId,{type:'move',tokenId,path:r.path,captured:r.captured,reachedHome:r.reachedHome,extraTurn:r.extraTurn,by:userId}); emitTurn(matchId,r.state); emitState(matchId); scheduleTurn(matchId); return r;}
function scheduleTurn(matchId){clearTimeout(timers.get(matchId)); timers.delete(matchId); const m=getMatch(matchId); if(m.status!=='active')return; const st=rowState(m); if(!st.deadline){st.deadline=Date.now()+Number(getConfig().turnSeconds||10)*1000; saveState(matchId,st);} const delay=Math.max(0,st.deadline-Date.now()); timers.set(matchId,setTimeout(()=>onTimeout(matchId),delay+10));}
function onTimeout(matchId){try{const m=getMatch(matchId); if(m.status!=='active')return; const st=rowState(m), loser=st.players[st.turnSeat].id; const c=getConfig(); const mp=db.prepare('SELECT timeout_strikes FROM match_players WHERE match_id=? AND user_id=?').get(matchId,loser); const strikes=(mp?.timeout_strikes||0)+1; db.prepare('UPDATE match_players SET timeout_strikes=? WHERE match_id=? AND user_id=?').run(strikes,matchId,loser); if(strikes>=Number(c.timeoutStrikes||2)){const winner=st.players.find(p=>p.id!==loser).id; settle(matchId,winner,'timeout'); return;} engineTimeoutAdvance(st); st.revision++; st.deadline=Date.now()+Number(c.turnSeconds||10)*1000; saveState(matchId,st); events.emit('message',matchId,{type:'error',code:'TURN_TIMEOUT',strikes,playerId:loser}); emitTurn(matchId,st); emitState(matchId); scheduleTurn(matchId);}catch(e){console.error('timeout',e);}}
function engineTimeoutAdvance(st){st.rolled=null; st.consecutiveSixes=0; st.turnSeat=(st.turnSeat+1)%st.players.length; st.lastMove={type:'timeout',at:Date.now()};}
function settle(matchId,winnerId,reason,{allowDisputed=false}={}){
  clearTimeout(timers.get(matchId)); timers.delete(matchId);
  let final;
  db.transaction(()=>{const m=getMatch(matchId); if(m.status!=='active'&&!(allowDisputed&&m.status==='disputed'))return; ensurePlayer(m,winnerId); const players=db.prepare('SELECT * FROM match_players WHERE match_id=? ORDER BY seat').all(matchId); if(players.length!==2)throw err('ESCROW_INCOMPLETE'); const loserId=players.find(x=>x.user_id!==winnerId).user_id;
    for(const mp of players){ ledger.post(mp.user_id,'locked',-m.entry_fee,'admin_fee',matchId,'Entry fee settled to operator'); }
    ledger.adminPost(m.entry_fee*2,'admin_fee',matchId,'PvP entry fees');
    ledger.post(loserId,'locked',-m.bet_amount,'bet_loss',matchId,'PvP bet lost');
    ledger.post(winnerId,'locked',-m.bet_amount,'bet_win',matchId,'Winning stake released from escrow');
    ledger.post(winnerId,'cash',m.bet_amount*2,'bet_win',matchId,'PvP pot won — credited to main balance');
    ledger.assertWallet(winnerId); ledger.assertWallet(loserId);
    const st=rowState(m)||{}; st.phase='finished'; st.winnerId=winnerId; st.deadline=null; st.revision=(st.revision||0)+1;
    db.prepare("UPDATE matches SET status='finished',winner_id=?,end_reason=?,state_json=?,revision=?,ended_at=? WHERE id=?").run(winnerId,reason,JSON.stringify(st),st.revision,Date.now(),matchId); final=st;
  })();
  if(final){for(const k of [...disconnectTimers.keys()])if(k.startsWith(matchId+':')){clearTimeout(disconnectTimers.get(k));disconnectTimers.delete(k);} events.emit('message',matchId,{type:'end',winnerId,reason}); emitState(matchId); events.emit('lobby');}
}
function forceEnd(adminId,matchId,winnerId,reason='admin_force_end'){settle(matchId,winnerId,reason,{allowDisputed:true}); audit({actorType:'admin',actorId:adminId,action:'force_end_match',targetType:'match',targetId:matchId,details:{winnerId,reason}});}
function dispute(userId,matchId,reason){const m=getMatch(matchId); ensurePlayer(m,userId); if(!['active','finished'].includes(m.status))throw err('DISPUTE_NOT_ALLOWED'); const id=uid('disp'); db.transaction(()=>{db.prepare('INSERT INTO disputes(id,match_id,opened_by,reason,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,matchId,userId,String(reason).slice(0,500),Date.now(),Date.now()); if(m.status==='active')db.prepare("UPDATE matches SET status='disputed' WHERE id=?").run(matchId);})(); clearTimeout(timers.get(matchId)); events.emit('lobby'); return {id};}
function connected(matchId,userId,yes){db.prepare('UPDATE match_players SET connected=? WHERE match_id=? AND user_id=?').run(yes?1:0,matchId,userId); const key=`${matchId}:${userId}`; if(yes){clearTimeout(disconnectTimers.get(key));disconnectTimers.delete(key);return;} const c=getConfig(); if(c.disconnectLoss===false)return; const grace=Math.max(5,Number(c.disconnectGraceSeconds||15))*1000; clearTimeout(disconnectTimers.get(key)); disconnectTimers.set(key,setTimeout(()=>{try{const m=getMatch(matchId); if(m.status!=='active')return; const mp=db.prepare('SELECT connected FROM match_players WHERE match_id=? AND user_id=?').get(matchId,userId); if(mp&&mp.connected===0){const winner=m.player_a_id===userId?m.player_b_id:m.player_a_id; if(winner)settle(matchId,winner,'disconnect');}}catch(e){console.error('disconnect settlement',e)}finally{disconnectTimers.delete(key)}},grace));}
function emitState(id){const m=getMatch(id); events.emit('message',id,{type:'state',state:rowState(m),match:serializeMatch(m)});}
function emitTurn(id,st){events.emit('message',id,{type:'turn',playerId:st.players[st.turnSeat].id,deadline:st.deadline});}
function resumeActive(){db.prepare("UPDATE match_players SET connected=0 WHERE connected!=0").run();expireWaitingMatches();for(const m of db.prepare("SELECT id FROM matches WHERE status='active'").all())scheduleTurn(m.id);}
function serializeMatch(m){const stats=db.prepare('SELECT mp.user_id,mp.seat,mp.timeout_strikes,mp.connected,u.username FROM match_players mp JOIN users u ON u.id=mp.user_id WHERE mp.match_id=? ORDER BY mp.seat').all(m.id).map(x=>({userId:x.user_id,username:x.username,seat:x.seat,timeoutStrikes:x.timeout_strikes,connected:!!x.connected}));return {id:m.id,mode:m.mode,playerAId:m.player_a_id,playerBId:m.player_b_id,entryFee:m.entry_fee/100,betAmount:m.bet_amount/100,status:m.status,winnerId:m.winner_id,endReason:m.end_reason,revision:m.revision,createdAt:m.created_at,startedAt:m.started_at,endedAt:m.ended_at,state:m.state_json?JSON.parse(m.state_json):undefined,creatorUsername:m.creator_username,playerStats:stats};}
function expireWaitingMatches(){
  const ttl=Math.max(5,Number(getConfig().waitingMatchTtlMinutes||60))*60000,cutoff=Date.now()-ttl;
  const stale=db.prepare("SELECT id,player_a_id FROM matches WHERE status='waiting' AND created_at<? LIMIT 100").all(cutoff);
  for(const m of stale){try{cancelWaiting(m.player_a_id,m.id);}catch(e){if(e.code!=='CANNOT_CANCEL')console.error('waiting expiry',e);}}
}
const waitingSweep=setInterval(expireWaitingMatches,60000);waitingSweep.unref();
function err(code){return Object.assign(new Error(code),{code});}
module.exports={events,createMatch,joinMatch,cancelWaiting,listOpen,listLive,getMatch,roll,move,settle,forceEnd,dispute,connected,resumeActive,serializeMatch};

