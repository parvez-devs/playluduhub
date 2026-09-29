'use strict';
(()=>{
  const qs=new URLSearchParams(location.search),matchId=qs.get('matchId');
  if(!matchId){location.href='/';return;}
  const $=s=>document.querySelector(s);
  let ws,state=null,me=null,match=null,reconnectTimer=null,timerTick=null,rolling=false;
  let config={turnSeconds:10,timeoutStrikes:2};
  const strikes=new Map();
  const PIP_MAP={
    1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]
  };

  async function api(path,opts={}){
    const o={...opts,headers:{...(opts.headers||{})}};
    if(o.body&&typeof o.body!=='string'){o.headers['content-type']='application/json';o.body=JSON.stringify(o.body);}
    const r=await fetch(path,o),d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Request failed');
    return d;
  }
  function hideBoot(){const b=$('#boot');if(!b)return;b.classList.add('hide');setTimeout(()=>b.remove(),200);}
  function setConnection(text,kind=''){const e=$('#connection');e.textContent=text;e.className='connection '+kind;}
  function short(id){return String(id||'').slice(0,10)}
  function name(id){if(!id)return'—';return id===me?.id?'YOU':short(id)}
  function log(text){const el=$('#log'),d=document.createElement('div');d.textContent=text;el.appendChild(d);while(el.children.length>80)el.firstChild.remove();el.scrollTop=el.scrollHeight;}
  function send(obj){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}

  function buildDice(){
    const f=$('#diceFace');if(f.children.length)return;
    for(let i=0;i<9;i++){const p=document.createElement('span');p.dataset.pip=i;f.appendChild(p);}
    showDice(1);
  }
  function showDice(n){
    const on=new Set(PIP_MAP[n]||[]);
    [...$('#diceFace').children].forEach((p,i)=>p.classList.toggle('on',on.has(i)));
  }
  function animateDice(finalValue){
    if(rolling)return;
    rolling=true;$('#roll').classList.add('rolling');
    let count=0;
    const tick=()=>{showDice(1+Math.floor(Math.random()*6));if(++count<9)return setTimeout(tick,55);showDice(finalValue);$('#roll').classList.remove('rolling');rolling=false;render();};
    tick();
  }

  function connect(){
    clearTimeout(reconnectTimer);
    const proto=location.protocol==='https:'?'wss':'ws';
    ws=new WebSocket(proto+'://'+location.host+'/ws');
    ws.onopen=()=>{setConnection('Connected','good');send({type:'join_match',matchId,lastKnownState:state?.revision??null});};
    ws.onclose=()=>{setConnection('Reconnecting…','bad');reconnectTimer=setTimeout(connect,1000);};
    ws.onerror=()=>setConnection('Connection issue','bad');
    ws.onmessage=e=>{try{handle(JSON.parse(e.data));}catch(err){console.warn(err);}};
  }
  function handle(m){
    if(m.type==='hello')return;
    if(m.type==='state'){state=m.state;match=m.match||match;render();return;}
    if(m.type==='dice'){animateDice(m.value);log('🎲 '+name(m.by)+' rolled '+m.value);return;}
    if(m.type==='move'){log('Token '+(Number(m.tokenId)+1)+' moved by '+name(m.by));return;}
    if(m.type==='turn'){if(state)state.deadline=m.deadline;render();return;}
    if(m.type==='chat'){log(name(m.by)+': '+m.text);return;}
    if(m.type==='end'){log('🏁 Winner: '+name(m.winnerId)+' ('+m.reason+')');showResult(m.winnerId,m.reason);return;}
    if(m.type==='error'){
      if(m.code==='TURN_TIMEOUT'&&m.playerId){strikes.set(m.playerId,Number(m.strikes||0));log('⚠ '+name(m.playerId)+' timeout strike '+m.strikes);}
      else log('⚠ '+m.code);
      if(m.code==='STALE_STATE')send({type:'join_match',matchId});
      render();
    }
  }

  function playerRender(){
    if(!state?.players)return;
    const current=state.players[state.turnSeat]?.id;
    state.players.forEach((p,i)=>{
      const el=$('#p'+i);if(!el)return;
      el.querySelector('[data-name]').textContent=p.id===me.id?'YOU':short(p.id);
      const s=strikes.get(p.id)||0;
      el.querySelector('[data-strikes]').textContent=s?'⚠ '+s:'';
      el.classList.toggle('active',p.id===current&&state.phase==='active');
    });
  }
  function render(){
    if(match)$('#stakes').textContent='ENTRY ৳'+Number(match.entryFee||0).toFixed(2)+' • BET ৳'+Number(match.betAmount||0).toFixed(2);
    const waiting=match?.status==='waiting'&&!state;
    $('#waitingOverlay').classList.toggle('hidden',!waiting);
    $('#cancelWaiting').classList.toggle('hidden',!(waiting&&match?.playerAId===me?.id));

    if(!state){
      $('#status').textContent=waiting?'Waiting for opponent':'Loading match state…';
      $('#turnPlayer').textContent='WAITING';$('#roll').disabled=true;$('#strikeText').textContent='Timeout 0 / '+Number(config.timeoutStrikes||2);
      GameRenderer.draw($('#board'),null,me?.id,moveToken);return;
    }

    playerRender();
    const current=state.players[state.turnSeat]?.id,seat=state.turnSeat||0,mine=current===me.id,finished=state.phase==='finished';
    $('#diceStation').classList.toggle('blue',seat===0);$('#diceStation').classList.toggle('green',seat===1);
    $('#turnPlayer').textContent=finished?'FINISHED':(mine?'YOU':short(current));
    $('#status').textContent=finished?'Match complete':mine?(state.rolled==null?'Your turn — roll dice':'Choose a playable token'):name(current)+"'s turn";
    $('#strikeText').textContent='Timeout '+(strikes.get(current)||0)+' / '+Number(config.timeoutStrikes||2);
    $('#roll').disabled=rolling||finished||!mine||state.rolled!=null;
    if(state.rolled!=null&&!rolling)showDice(state.rolled);
    GameRenderer.draw($('#board'),state,me.id,moveToken);
    if(finished)showResult(state.winnerId,match?.endReason||'finished');
  }

  function moveToken(tokenId){
    if(!state||state.players[state.turnSeat]?.id!==me.id||state.rolled==null)return;
    send({type:'move_token',matchId,tokenId,expectedState:state.revision});
  }
  function showResult(winnerId,reason){
    if(!winnerId)return;
    $('#resultTitle').textContent=winnerId===me?.id?'YOU WON!':'MATCH FINISHED';
    $('#resultText').textContent=(winnerId===me?.id?'The server settled the pot into your Main Balance. ':'Winner: '+name(winnerId)+'. ')+(reason?'Reason: '+reason+'.':'');
    $('#resultOverlay').classList.remove('hidden');
    $('#roll').disabled=true;
  }
  function startTimer(){
    clearInterval(timerTick);
    timerTick=setInterval(()=>{
      const left=state?.deadline?Math.max(0,Math.ceil((state.deadline-Date.now())/1000)):0;
      $('#timer').textContent=state?.deadline?String(left):'--';
    },150);
  }

  $('#roll').onclick=()=>{if(state&&!$('#roll').disabled)send({type:'roll_dice',matchId,expectedState:state.revision});};
  $('#exitBtn').onclick=()=>{if(match?.status==='active'&&!confirm('Leave the live match screen? Disconnect rules may apply.'))return;location.href='/';};
  $('#resultBack').onclick=()=>location.href='/';
  $('#cancelWaiting').onclick=async()=>{
    if(!confirm('Cancel this waiting match and unlock your funds?'))return;
    try{await api('/api/pvp/'+encodeURIComponent(matchId)+'/cancel',{method:'POST',headers:{'idempotency-key':crypto.randomUUID()},body:{}});location.href='/';}
    catch(e){log('⚠ '+e.message);}
  };
  $('#chat').onsubmit=e=>{e.preventDefault();const i=e.target.elements.text,t=i.value.trim();if(t){send({type:'chat',matchId,text:t});i.value='';}};
  $('#dispute').onclick=async()=>{
    const reason=prompt('Describe the dispute (max 500 chars):');if(!reason)return;
    try{await api('/api/pvp/'+encodeURIComponent(matchId)+'/dispute',{method:'POST',body:{reason}});log('⚠ Dispute opened for admin review.');}
    catch(e){log('⚠ '+e.message);}
  };

  (async()=>{
    try{
      buildDice();
      const [meRes,cfg]=await Promise.all([api('/api/me'),api('/api/config')]);
      me=meRes.user;config={...config,...cfg};
      startTimer();connect();setTimeout(hideBoot,300);
    }catch{location.href='/';}
  })();
})();
