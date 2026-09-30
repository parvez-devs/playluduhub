'use strict';
(()=>{
  const qs=new URLSearchParams(location.search),matchId=qs.get('matchId');
  if(!matchId){location.href='/';return;}
  const $=s=>document.querySelector(s);
  let ws,state=null,me=null,match=null,reconnectTimer=null,timerTick=null,rolling=false,rollPending=false,movePending=false,diceSpinTimer=null;
  let reconnectAttempt=0,renderQueued=false,lastTimerText='',resultShown=false,toastTimer=null,lastTurnId=null;
  let config={turnSeconds:10,timeoutStrikes:2,disconnectGraceSeconds:15};
  const strikes=new Map(),playerNames=new Map();
  let audioCtx=null,soundEnabled=localStorage.getItem('plh_sound')!=='0';
  const PIPS={
    1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]
  };
  const lowEnd=(Number(navigator.hardwareConcurrency||8)<=4)||(Number(navigator.deviceMemory||8)<=4);
  document.documentElement.classList.toggle('lite',lowEnd);

  async function api(path,opts={}){
    const o={...opts,headers:{...(opts.headers||{})}};
    if(o.body&&typeof o.body!=='string'){o.headers['content-type']='application/json';o.body=JSON.stringify(o.body);}
    const r=await fetch(path,o),d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Request failed');
    return d;
  }
  function hideBoot(){const b=$('#boot');if(!b)return;b.classList.add('hide');setTimeout(()=>b.remove(),180);}
  function setConnection(text,kind=''){
    const e=$('#connection');if(e){e.textContent=text;e.className='connection '+kind;}
    const overlay=$('#netOverlay');if(overlay)overlay.classList.toggle('hidden',kind!=='bad');
  }
  function initials(v){const s=String(v||'P').replace(/^@/,'').trim();return (s[0]||'P').toUpperCase();}
  function haptic(pattern=10){try{navigator.vibrate?.(pattern);}catch{}}
  function gameToast(text,kind=''){
    const el=$('#gameToast');if(!el)return;clearTimeout(toastTimer);el.textContent=text;el.className='game-toast '+kind;
    requestAnimationFrame(()=>el.classList.add('show'));toastTimer=setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.classList.add('hidden'),130);},1100);
  }
  function short(id){return String(id||'').slice(0,10)}
  function name(id){if(!id)return'—';return id===me?.id?(me?.username?('@'+me.username):'YOU'):(playerNames.get(id)||short(id))}
  function log(text){const el=$('#log');if(!el)return;const d=document.createElement('div');d.textContent=text;el.appendChild(d);while(el.children.length>40)el.firstChild.remove();el.scrollTop=el.scrollHeight;}
  function send(obj){if(ws?.readyState!==WebSocket.OPEN)return false;ws.send(JSON.stringify(obj));return true;}
  function ensureAudio(){
    if(!soundEnabled)return null;
    try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}catch{return null;}
  }
  function tone(freq=440,duration=.045,gain=.035,delay=0,type='sine'){
    const a=ensureAudio();if(!a)return;const at=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,at);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+.006);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    o.connect(g);g.connect(a.destination);o.start(at);o.stop(at+duration+.015);
  }
  function sound(kind){
    if(!soundEnabled)return;
    if(kind==='tap')tone(240,.035,.025,0,'square');
    else if(kind==='dice'){tone(330,.04,.03);tone(520,.055,.032,.045);}
    else if(kind==='move')tone(420,.035,.022);
    else if(kind==='capture'){tone(520,.045,.035);tone(300,.07,.038,.05,'square');}
    else if(kind==='home'){tone(523,.05,.035);tone(659,.05,.035,.055);tone(784,.08,.04,.11);}
    else if(kind==='turn'){tone(640,.045,.025);}
    else if(kind==='win'){tone(523,.06,.04);tone(659,.06,.04,.07);tone(784,.12,.045,.14);}
    else if(kind==='lose'){tone(330,.08,.028);tone(247,.12,.03,.08);}
  }
  function queueRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;render();});}

  function buildDice(){
    const f=$('#diceFace');if(!f||f.children.length)return;
    const frag=document.createDocumentFragment();
    for(let i=0;i<9;i++){const p=document.createElement('span');frag.appendChild(p);}
    f.appendChild(frag);showDice(1);
  }
  function showDice(n){
    const on=PIPS[n]||[],kids=$('#diceFace')?.children;if(!kids)return;
    for(let i=0;i<kids.length;i++)kids[i].classList.toggle('on',on.includes(i));
  }
  function startDiceSpin(){
    if(rolling)return;
    rolling=true;$('#roll')?.classList.add('rolling');
    clearInterval(diceSpinTimer);
    diceSpinTimer=setInterval(()=>showDice(1+Math.floor(Math.random()*6)),lowEnd?82:68);
  }
  function stopDiceSpin(finalValue){
    clearInterval(diceSpinTimer);diceSpinTimer=null;
    if(finalValue!=null)showDice(finalValue);
    $('#roll')?.classList.remove('rolling');rolling=false;rollPending=false;queueRender();
  }
  function animateDice(finalValue){
    if(!rolling)startDiceSpin();
    setTimeout(()=>stopDiceSpin(finalValue),lowEnd?90:120);
  }
  function syncPlayerStats(){
    for(const p of match?.playerStats||[]){strikes.set(p.userId,Number(p.timeoutStrikes||0));if(p.username)playerNames.set(p.userId,'@'+p.username);}
  }

  function connect(){
    clearTimeout(reconnectTimer);
    if(ws&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(ws.readyState))return;
    const proto=location.protocol==='https:'?'wss':'ws';
    ws=new WebSocket(proto+'://'+location.host+'/ws');
    ws.onopen=()=>{reconnectAttempt=0;setConnection('Connected','good');send({type:'join_match',matchId,lastKnownState:state?.revision??null});gameToast('LIVE CONNECTION RESTORED','good');};
    ws.onclose=()=>{
      setConnection('Reconnecting…','bad');
      const delay=Math.min(5000,700*Math.pow(1.55,reconnectAttempt++));
      reconnectTimer=setTimeout(connect,delay);
    };
    ws.onerror=()=>setConnection('Connection issue','bad');
    ws.onmessage=e=>{try{handle(JSON.parse(e.data));}catch(err){console.warn('game message',err);}};
  }
  function handle(m){
    if(m.type==='hello')return;
    if(m.type==='state'){
      const oldRevision=state?.revision;
      state=m.state;match=m.match||match;syncPlayerStats();
      if(state?.revision!==oldRevision){rollPending=false;movePending=false;GameRenderer.clearPending?.();}
      queueRender();return;
    }
    if(m.type==='dice'){animateDice(m.value);sound('dice');haptic(8);log('🎲 '+name(m.by)+' rolled '+m.value);return;}
    if(m.type==='move'){if(m.reachedHome){sound('home');haptic([15,30,15]);gameToast('TOKEN HOME • EXTRA TURN','good');}else if(m.captured?.length){sound('capture');haptic([20,25,20]);gameToast('CAPTURE! • EXTRA TURN','warn');}else sound('move');log('Token '+(Number(m.tokenId)+1)+' moved by '+name(m.by)+(m.captured?.length?' • capture!':m.reachedHome?' • home!':''));return;}
    if(m.type==='turn'){if(state)state.deadline=m.deadline;if(m.playerId===me?.id&&lastTurnId!==m.playerId){sound('turn');haptic(12);gameToast('YOUR TURN','good');}lastTurnId=m.playerId;return;}
    if(m.type==='chat'){log(name(m.by)+': '+m.text);return;}
    if(m.type==='end'){rollPending=false;movePending=false;stopDiceSpin(null);GameRenderer.clearPending?.();log('🏁 Winner: '+name(m.winnerId)+' ('+m.reason+')');showResult(m.winnerId,m.reason);return;}
    if(m.type==='error'){
      rollPending=false;movePending=false;stopDiceSpin(null);GameRenderer.clearPending?.();
      if(m.code==='TURN_TIMEOUT'&&m.playerId){strikes.set(m.playerId,Number(m.strikes||0));log('⚠ '+name(m.playerId)+' timeout strike '+m.strikes);}
      else log('⚠ '+m.code);
      if(m.code==='STALE_STATE')send({type:'join_match',matchId});
      queueRender();
    }
  }

  function renderPlayers(){
    if(!state?.players)return;
    const current=state.players[state.turnSeat]?.id;
    state.players.forEach((p,i)=>{
      const el=$('#p'+i);if(!el)return;
      const nameEl=el.querySelector('[data-name]'),strikeEl=el.querySelector('[data-strikes]'),avatarEl=el.querySelector('[data-avatar]'),homeEl=el.querySelector('[data-home]');
      const playerName=p.id===me.id?(me?.username?('@'+me.username):'YOU'):(playerNames.get(p.id)||short(p.id));
      if(nameEl)nameEl.textContent=playerName;if(avatarEl)avatarEl.textContent=initials(playerName);
      if(homeEl)homeEl.textContent=p.tokens.filter(x=>x===57).length+' / 4 HOME';
      const s=strikes.get(p.id)||0;if(strikeEl)strikeEl.textContent=s?'⚠ '+s:'';
      el.classList.toggle('active',p.id===current&&state.phase==='active');
    });
  }
  function render(){
    if(match){$('#stakes').textContent='ENTRY ৳'+Number(match.entryFee||0).toFixed(2)+' • BET ৳'+Number(match.betAmount||0).toFixed(2);if($('#matchCode'))$('#matchCode').textContent='MATCH '+String(match.id||matchId).slice(-8).toUpperCase();}
    const waiting=match?.status==='waiting'&&!state;
    $('#waitingOverlay')?.classList.toggle('hidden',!waiting);
    $('#cancelWaiting')?.classList.toggle('hidden',!(waiting&&match?.playerAId===me?.id));

    if(!state){
      $('#status').textContent=waiting?'Waiting for opponent':'Loading match state…';if($('#turnBanner'))$('#turnBanner').textContent=waiting?'WAITING FOR OPPONENT':'SYNCING MATCH';if($('#rollHint'))$('#rollHint').textContent='WAITING';
      $('#turnPlayer').textContent='WAITING';$('#roll').disabled=true;
      $('#strikeText').textContent='Timeout 0 / '+Number(config.timeoutStrikes||2);
      GameRenderer.draw($('#board'),null,me?.id,moveToken);return;
    }

    renderPlayers();
    const current=state.players[state.turnSeat]?.id,seat=Number(state.turnSeat||0),mySeat=state.players.findIndex(p=>p.id===me.id),mine=current===me.id,finished=state.phase==='finished';
    document.querySelector('.game')?.classList.toggle('viewer-green',mySeat===1);
    const station=$('#diceStation');station?.classList.toggle('blue',seat===0);station?.classList.toggle('green',seat===1);station?.classList.toggle('dock-left',seat===mySeat);station?.classList.toggle('dock-right',seat!==mySeat);
    const turnColour=$('#turnColour');if(turnColour)turnColour.textContent=finished?'MATCH END':(seat===0?'BLUE TURN':'GREEN TURN');
    const banner=$('#turnBanner');if(banner)banner.textContent=finished?'MATCH FINISHED':(mine?'YOUR TURN':name(current)+' TURN');
    const hint=$('#rollHint');if(hint)hint.textContent=finished?'COMPLETE':(mine?(state.rolled==null?'TAP DICE TO ROLL':'SELECT A TOKEN'):'OPPONENT PLAYING');
    $('#turnPlayer').textContent=finished?'FINISHED':(mine?'YOU':name(current));
    $('#status').textContent=finished?'Match complete':mine?(state.rolled==null?'Your turn — roll dice':'Choose a playable token'):name(current)+"'s turn";
    $('#strikeText').textContent='Timeout '+(strikes.get(current)||0)+' / '+Number(config.timeoutStrikes||2);
    $('#roll').disabled=rollPending||rolling||finished||!mine||state.rolled!=null;
    if(state.rolled!=null&&!rolling)showDice(state.rolled);
    GameRenderer.draw($('#board'),state,me.id,moveToken);
    if(finished)showResult(state.winnerId,match?.endReason||'finished');
  }

  function moveToken(tokenId){
    if(movePending||rollPending||!state||state.players[state.turnSeat]?.id!==me.id||state.rolled==null)return;
    movePending=true;sound('tap');haptic(8);GameRenderer.markPending?.(Number(state.turnSeat||0),tokenId);
    if(!send({type:'move_token',matchId,tokenId,expectedState:state.revision})){movePending=false;GameRenderer.clearPending?.();}
  }
  function showResult(winnerId,reason){
    if(!winnerId||resultShown)return;resultShown=true;
    $('#resultTitle').textContent=winnerId===me?.id?'YOU WON!':'MATCH FINISHED';sound(winnerId===me?.id?'win':'lose');
    $('#resultText').textContent=(winnerId===me?.id?'The server settled the pot into your Main Balance. ':'Winner: '+name(winnerId)+'. ')+(reason?'Reason: '+reason+'.':'');
    $('#resultOverlay').classList.remove('hidden');$('#roll').disabled=true;
  }
  function startTimer(){
    clearInterval(timerTick);
    timerTick=setInterval(()=>{
      const text=state?.deadline?String(Math.max(0,Math.ceil((state.deadline-Date.now())/1000))):'--';
      if(text!==lastTimerText){lastTimerText=text;const el=$('#timer'),chip=el?.closest('.timer-chip');if(el)el.textContent=text;if(chip){const n=Number(text);chip.classList.toggle('warning',Number.isFinite(n)&&n<=5&&n>3);chip.classList.toggle('danger',Number.isFinite(n)&&n<=3);}}
    },250);
  }

  $('#roll').onclick=()=>{
    if(rollPending||rolling||!state||$('#roll').disabled)return;
    rollPending=true;$('#roll').disabled=true;sound('tap');haptic(8);startDiceSpin();
    if(!send({type:'roll_dice',matchId,expectedState:state.revision})){rollPending=false;stopDiceSpin(null);queueRender();}
  };
  $('#soundToggle').onclick=()=>{soundEnabled=!soundEnabled;localStorage.setItem('plh_sound',soundEnabled?'1':'0');$('#soundToggle').textContent=soundEnabled?'🔊 Sound':'🔇 Sound';if(soundEnabled){ensureAudio();sound('turn');}};
  document.addEventListener('pointerdown',()=>ensureAudio(),{once:true,passive:true});
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
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(!ws||ws.readyState===WebSocket.CLOSED)){clearTimeout(reconnectTimer);connect();}});

  (async()=>{
    try{
      buildDice();
      const [meRes,cfg]=await Promise.all([api('/api/me'),api('/api/config')]);
      me=meRes.user;config={...config,...cfg};if($('#soundToggle'))$('#soundToggle').textContent=soundEnabled?'🔊 Sound':'🔇 Sound';startTimer();connect();setTimeout(hideBoot,220);
    }catch{location.href='/';}
  })();
})();
