'use strict';
const qs=new URLSearchParams(location.search),matchId=qs.get('matchId');if(!matchId)location.href='/';
const $=s=>document.querySelector(s);
let ws,state=null,me=null,match=null,reconnectTimer=null,timerTick=null,config={turnSeconds:10,timeoutStrikes:2},rolling=false;
const strikes=new Map(),DICE=['','⚀','⚁','⚂','⚃','⚄','⚅'];
async function api(path,opts={}){const o={...opts,headers:{...(opts.headers||{})}};if(o.body&&typeof o.body!=='string'){o.headers['content-type']='application/json';o.body=JSON.stringify(o.body);}const r=await fetch(path,o);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d;}
(async()=>{try{const [m,c]=await Promise.all([api('/api/me'),api('/api/config')]);me=m.user;config={...config,...c};connect();startTimer();setTimeout(()=>{const b=$('#boot');if(b){b.classList.add('hide');setTimeout(()=>b.remove(),180);}},300);}catch{location.href='/';}})();
function connect(){clearTimeout(reconnectTimer);const proto=location.protocol==='https:'?'wss':'ws';ws=new WebSocket(`${proto}://${location.host}/ws`);ws.onopen=()=>{setConnection('Connected','good');send({type:'join_match',matchId,lastKnownState:state?.revision??null});};ws.onclose=()=>{setConnection('Reconnecting…','bad');reconnectTimer=setTimeout(connect,1000);};ws.onerror=()=>setConnection('Connection issue','bad');ws.onmessage=e=>{try{handle(JSON.parse(e.data));}catch{}};}
function setConnection(t,cls=''){const el=$('#connection');el.textContent=t;el.className=`connection ${cls}`;}
function send(x){if(ws?.readyState===1)ws.send(JSON.stringify(x));}
function handle(m){
  if(m.type==='state'){state=m.state;match=m.match||match;render();return;}
  if(m.type==='dice'){animateDice(m.value);log(`🎲 ${name(m.by)} rolled ${m.value}`);return;}
  if(m.type==='move'){log(`Token ${Number(m.tokenId)+1} moved by ${name(m.by)}`);const b=$('#boardShell');b.classList.remove('land');void b.offsetWidth;b.classList.add('land');return;}
  if(m.type==='turn'){if(state)state.deadline=m.deadline;render();return;}
  if(m.type==='chat'){log(`${name(m.by)}: ${m.text}`);return;}
  if(m.type==='end'){log(`🏁 Winner: ${name(m.winnerId)} (${m.reason})`);$('#status').textContent=`Match finished — ${name(m.winnerId)} won`;$('#hint').textContent=m.reason||'finished';$('#roll').disabled=true;return;}
  if(m.type==='error'){if(m.code==='TURN_TIMEOUT'&&m.playerId){strikes.set(m.playerId,Number(m.strikes||0));log(`⚠ ${name(m.playerId)} timeout strike ${m.strikes}`);render();}else log(`⚠ ${m.code}`);if(m.code==='STALE_STATE')send({type:'join_match',matchId});}
}
function render(){
  if(match)$('#stakes').textContent=`ENTRY ৳${Number(match.entryFee||0).toFixed(2)} • BET ৳${Number(match.betAmount||0).toFixed(2)}`;
  $('#cancelWaiting').classList.toggle('hidden',!(match?.status==='waiting'&&match?.playerAId===me?.id));
  if(!state){$('#status').textContent=match?.status==='waiting'?'Waiting for an opponent…':'Loading match state…';$('#hint').textContent='Your locked stake stays in escrow while waiting.';$('#turnName').textContent='WAITING';$('#turnText').textContent='Opponent needed';$('#roll').disabled=true;GameRenderer.draw($('#board'),null,me?.id,moveToken);return;}
  const turn=state.players[state.turnSeat]?.id;
  state.players.forEach((p,i)=>{const el=$(`#p${i}`);if(!el)return;el.querySelector('[data-name]').textContent=p.id===me.id?'YOU':short(p.id);el.querySelector('[data-strikes]').textContent=strikes.get(p.id)?`⚠ ${strikes.get(p.id)}`:'';el.classList.toggle('active',p.id===turn&&state.phase==='active');});
  const mine=turn===me.id,finished=state.phase==='finished';
  $('#status').textContent=finished?`Finished — ${name(state.winnerId)} won`:(mine?(state.rolled==null?'Your turn — roll the dice':`You rolled ${state.rolled} — choose a glowing token`):`${name(turn)}'s turn`);
  $('#hint').textContent=finished?'Settlement is handled by the server.':mine?(state.rolled==null?'Tap the dice before the timer ends.':state.rolled===6?'Six! Playable tokens are marked with rotating dots.':'Tap a glowing legal token.'):'Opponent action in progress…';
  $('#turnName').textContent=finished?'MATCH COMPLETE':(mine?'YOUR TURN':name(turn).toUpperCase());
  $('#turnText').textContent=finished?'Result settled':state.rolled==null?'Roll phase':`Dice: ${state.rolled} • move phase`;
  const seat=Math.max(0,state.players.findIndex(p=>p.id===turn));$('#console').style.setProperty('--turn',seat===0?'var(--red)':'var(--green)');$('#turnDot').style.background=seat===0?'var(--red)':'var(--green)';$('#turnDot').style.boxShadow=`0 0 14px ${seat===0?'var(--red)':'var(--green)'}`;
  $('#strikeText').textContent=`${strikes.get(turn)||0} / ${Number(config.timeoutStrikes||2)}`;
  $('#roll').disabled=rolling||finished||!mine||state.rolled!=null;
  if(state.rolled!=null&&!rolling)$('#dice').textContent=DICE[state.rolled];
  GameRenderer.draw($('#board'),state,me.id,moveToken);
}
function moveToken(tokenId){if(!state||state.players[state.turnSeat].id!==me.id||state.rolled==null)return;send({type:'move_token',matchId,tokenId,expectedState:state.revision});}
function animateDice(finalValue){rolling=true;$('#roll').classList.add('rolling');let n=0;const tick=()=>{n++;$('#dice').textContent=DICE[1+Math.floor(Math.random()*6)];if(n<8)return setTimeout(tick,38);$('#dice').textContent=DICE[finalValue];$('#roll').classList.remove('rolling');rolling=false;render();};tick();}
$('#roll').onclick=()=>state&&send({type:'roll_dice',matchId,expectedState:state.revision});
$('#back').onclick=()=>location.href='/';
$('#cancelWaiting').onclick=async()=>{if(!confirm('Cancel this waiting match and unlock the funds?'))return;try{await api(`/api/pvp/${encodeURIComponent(matchId)}/cancel`,{method:'POST',headers:{'idempotency-key':crypto.randomUUID()},body:{}});location.href='/';}catch(e){log(`⚠ ${e.message}`);}};
$('#chat').onsubmit=e=>{e.preventDefault();const i=e.target.elements.text,t=i.value.trim();if(t){send({type:'chat',matchId,text:t});i.value='';}};
$('#dispute').onclick=async()=>{const reason=prompt('Describe the dispute (max 500 chars):');if(!reason)return;try{await api(`/api/pvp/${encodeURIComponent(matchId)}/dispute`,{method:'POST',body:{reason}});log('⚠ Dispute opened for admin review.');}catch(e){log(`⚠ ${e.message}`);}};
function startTimer(){clearInterval(timerTick);timerTick=setInterval(()=>{const total=Math.max(1,Number(config.turnSeconds||10))*1000,left=state?.deadline?Math.max(0,state.deadline-Date.now()):0,ratio=state?.deadline?Math.max(0,Math.min(1,left/total)):0;$('#timerText').textContent=state?.deadline?String(Math.ceil(left/1000)):'--';$('#timerArc').style.strokeDashoffset=String(113.1*(1-ratio));$('#timerBox').classList.toggle('warning',ratio<=.5&&ratio>.25);$('#timerBox').classList.toggle('danger',ratio<=.25&&state?.deadline);},120);}
function log(t){const el=$('#log'),d=document.createElement('div');d.textContent=t;el.appendChild(d);while(el.children.length>60)el.firstChild.remove();el.scrollTop=el.scrollHeight;}
function short(id){return String(id||'').slice(0,10);}function name(id){if(!id)return'—';return id===me?.id?'You':short(id);}
