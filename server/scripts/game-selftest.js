'use strict';
const assert=require('assert');
const engine=require('../game-engine');

function base(){
  return engine.newGame(['A','B'],{extraTurnOnSix:true});
}
function expectCode(fn,code){
  let got=null;try{fn();}catch(e){got=e.code||e.message;}
  assert.strictEqual(got,code,`expected ${code}, got ${got}`);
}

{
  const s=base();
  assert.deepStrictEqual(s.players[0].tokens,[-1,-1,-1,-1]);
  assert.deepStrictEqual(s.players[1].tokens,[-1,-1,-1,-1]);
  assert.strictEqual(s.turnSeat,0);
}

{
  const s=base();s.rolled=6;
  const r=engine.moveToken(s,'A',0);
  assert.strictEqual(r.state.players[0].tokens[0],0);
  assert.strictEqual(r.extraTurn,true);
}

{
  const s=base();s.rolled=5;
  expectCode(()=>engine.moveToken(s,'A',0),'ILLEGAL_MOVE');
}

{
  const s=base();s.players[0].tokens[0]=55;s.rolled=3;
  expectCode(()=>engine.moveToken(s,'A',0),'ILLEGAL_MOVE');
}

{
  const s=base();s.players[0].tokens[0]=55;s.rolled=2;
  const r=engine.moveToken(s,'A',0);
  assert.strictEqual(r.state.players[0].tokens[0],57);
  assert.strictEqual(r.reachedHome,true);
  assert.strictEqual(r.extraTurn,true);
}

{
  const s=base();
  s.players[0].tokens=[0,-1,-1,-1];
  s.players[1].tokens=[27,-1,-1,-1];
  s.rolled=1;
  const r=engine.moveToken(s,'A',0);
  assert.strictEqual(r.state.players[0].tokens[0],1);
  assert.strictEqual(r.state.players[1].tokens[0],-1);
  assert.strictEqual(r.captured.length,1);
  assert.strictEqual(r.extraTurn,true);
}

{
  const s=base();
  s.players[0].tokens=[7,-1,-1,-1];
  s.players[1].tokens=[34,-1,-1,-1];
  s.rolled=1;
  const r=engine.moveToken(s,'A',0);
  assert.strictEqual(r.state.players[0].tokens[0],8);
  assert.strictEqual(r.state.players[1].tokens[0],34);
  assert.strictEqual(r.captured.length,0);
}

{
  const s=base();
  s.players[0].tokens=[56,57,57,57];s.rolled=1;
  const r=engine.moveToken(s,'A',0);
  assert.strictEqual(r.finished,true);
  assert.strictEqual(r.state.phase,'finished');
  assert.strictEqual(r.state.winnerId,'A');
}

console.log('game-engine invariants passed');
