'use strict';
const crypto=require('crypto');
const LOOP=52, FINISH=57;
const START_OFFSETS=[0,26]; // 2-player Ludo uses opposite colors/seats
const SAFE_CELLS=new Set([0,8,13,21,26,34,39,47]);
function newGame(playerIds,config={}){
  if(!Array.isArray(playerIds)||playerIds.length!==2) throw new Error('TWO_PLAYERS_REQUIRED');
  return {version:1,revision:0,players:playerIds.map((id,seat)=>({id,seat,tokens:[-1,-1,-1,-1]})),turnSeat:0,rolled:null,consecutiveSixes:0,winnerId:null,phase:'active',lastMove:null,deadline:null,config:{extraTurnOnSix:config.extraTurnOnSix!==false,extraTurnOnCapture:true,extraTurnOnFinish:true}};
}
function clone(s){return JSON.parse(JSON.stringify(s));}
function current(s){return s.players[s.turnSeat];}
function globalCell(seat,progress){return progress>=0&&progress<LOOP?(START_OFFSETS[seat]+progress)%LOOP:null;}
function canMoveToken(progress,dice){if(progress===FINISH)return false; if(progress===-1)return dice===6; return progress+dice<=FINISH;}
function legalTokens(s){if(s.rolled==null)return[]; return current(s).tokens.map((p,i)=>canMoveToken(p,s.rolled)?i:null).filter(i=>i!==null);}
function advanceTurn(s){s.turnSeat=(s.turnSeat+1)%s.players.length; s.rolled=null; s.consecutiveSixes=0; s.deadline=null;}
function rollDice(state,playerId){
  const s=clone(state); if(s.phase!=='active')throw code('GAME_NOT_ACTIVE'); if(current(s).id!==playerId)throw code('NOT_YOUR_TURN'); if(s.rolled!=null)throw code('ALREADY_ROLLED');
  const value=crypto.randomInt(1,7); s.revision++;
  if(value===6){s.consecutiveSixes++; if(s.consecutiveSixes>=3){s.rolled=null; advanceTurn(s); s.lastMove={type:'third_six_forfeit',by:playerId,value}; return {state:s,value,forfeit:true,legal:[]};}}
  else s.consecutiveSixes=0;
  s.rolled=value; const legal=legalTokens(s); if(legal.length===0){const extra=value===6&&s.config.extraTurnOnSix; s.rolled=null; if(!extra) advanceTurn(s); else s.deadline=null;}
  s.lastMove={type:'roll',by:playerId,value}; return {state:s,value,forfeit:false,legal};
}
function moveToken(state,playerId,tokenId){
  const s=clone(state); if(s.phase!=='active')throw code('GAME_NOT_ACTIVE'); const p=current(s); if(p.id!==playerId)throw code('NOT_YOUR_TURN'); if(s.rolled==null)throw code('ROLL_REQUIRED'); if(!Number.isInteger(tokenId)||tokenId<0||tokenId>3)throw code('INVALID_TOKEN');
  const dice=s.rolled, from=p.tokens[tokenId]; if(!canMoveToken(from,dice))throw code('ILLEGAL_MOVE');
  const to=from===-1?0:from+dice; p.tokens[tokenId]=to; const path=makePath(p.seat,from,to); let captured=[];
  const gc=globalCell(p.seat,to); if(gc!=null&&!SAFE_CELLS.has(gc)){
    for(const op of s.players){ if(op.id===p.id)continue; op.tokens.forEach((prog,i)=>{if(globalCell(op.seat,prog)===gc){op.tokens[i]=-1; captured.push({playerId:op.id,tokenId:i});}}); }
  }
  const finished=p.tokens.every(x=>x===FINISH), reachedHome=to===FINISH, gotSix=dice===6; s.rolled=null; s.revision++; s.lastMove={type:'move',by:playerId,tokenId,from,to,dice,captured,path,reachedHome};
  if(finished){s.phase='finished'; s.winnerId=playerId; s.deadline=null; return {state:s,path,captured,reachedHome,extraTurn:false,finished:true};}
  // PLAY LUDU HUB rules: a six, a capture, or bringing a token exactly home earns another roll.
  const extra=(gotSix&&s.config.extraTurnOnSix)||(captured.length>0)||reachedHome; if(!extra)advanceTurn(s); else s.deadline=null;
  return {state:s,path,captured,reachedHome,extraTurn:extra,finished:false};
}
function makePath(seat,from,to){const out=[]; const start=from===-1?0:from+1; for(let p=start;p<=to;p++){out.push({progress:p,globalCell:globalCell(seat,p),homeLane:p>=LOOP&&p<FINISH,finished:p===FINISH});} return out;}
function code(c){return Object.assign(new Error(c),{code:c});}
function publicState(s){return clone(s);}
module.exports={newGame,rollDice,moveToken,legalTokens,publicState,globalCell,SAFE_CELLS,FINISH};

