import './game.css';
import './real-theme.css';

const root=document.querySelector<HTMLDivElement>('#root');
if(!root)throw new Error('ROOT_NOT_FOUND');

root.innerHTML=`
<div id="boot" class="boot" aria-label="Loading Play Ludu Hub">
  <div class="loader-card">
    <div class="dice-loader" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
    <h1>PLAY LUDU HUB</h1>
    <p>Preparing live match…</p>
    <div class="loading-track"><span></span></div>
  </div>
</div>

<div class="game">
  <header class="game-topbar">
    <button id="exitBtn" class="exit-btn" type="button" aria-label="Exit match">‹</button>
    <div class="game-title">
      <span>PLAY LUDU HUB</span>
      <strong id="matchCode">LIVE MATCH</strong>
    </div>
    <span class="secure-badge">● LIVE</span>
  </header>

  <section class="match-strip" aria-label="Players">
    <div id="p0" class="player-pill blue">
      <span class="player-avatar" data-avatar>A</span>
      <div class="player-copy"><b>BLUE</b><small data-name>Player A</small><span data-home>0 / 4 HOME</span></div>
      <em data-strikes></em>
    </div>
    <div class="match-mid">
      <div class="connection-row">
        <span id="connection" class="connection">Connecting…</span>
        <span id="latency" class="latency">-- ms</span>
      </div>
      <strong id="stakes">SECURE PVP</strong>
      <small id="status" aria-live="polite">Loading match state…</small>
    </div>
    <div id="p1" class="player-pill green">
      <span class="player-avatar" data-avatar>B</span>
      <div class="player-copy"><b>GREEN</b><small data-name>Player B</small><span data-home>0 / 4 HOME</span></div>
      <em data-strikes></em>
    </div>
  </section>

  <main class="stage">
    <div class="board-shell">
      <div class="board-topline">
        <span id="turnBanner">WAITING FOR MATCH</span>
        <small>SERVER VERIFIED</small>
      </div>
      <div id="board" class="board" aria-label="Ludo board">
        <div id="boardArt" class="board-art" aria-hidden="true"></div>
        <div id="tokenLayer" class="token-layer"></div>
        <div id="waitingOverlay" class="waiting-overlay hidden">
          <div class="waiting-spinner"></div>
          <b>WAITING FOR OPPONENT</b>
          <span>Your stake is locked safely until the match starts.</span>
        </div>
      </div>
    </div>

    <div id="gameToast" class="game-toast hidden" aria-live="polite"></div>
    <div id="netOverlay" class="net-overlay hidden"><span></span><b>RECONNECTING</b><small>Restoring live match state…</small></div>

    <section class="control-rail" aria-label="Turn controls">
      <div id="diceStation" class="dice-container shared blue">
        <span id="turnColour" class="turn-colour">BLUE TURN</span>
        <span id="rollHint" class="roll-hint">WAITING</span>
        <button id="roll" class="dice" type="button" disabled aria-label="Roll dice">
          <div id="diceFace" class="dice-face" aria-hidden="true"></div>
        </button>
        <div class="turn-panel">
          <span id="turnDot" class="turn-dot"></span>
          <span class="turn-text">PLAYER</span>
          <strong id="turnPlayer">WAITING</strong>
          <span class="timer-chip"><b id="timer">--</b>s</span>
        </div>
      </div>
    </section>

    <div class="match-tools">
      <span id="strikeText">Timeout 0 / 2</span>
      <button id="soundToggle" class="tool sound-tool" type="button">🔊 Sound</button>
      <button id="cancelWaiting" class="tool hidden" type="button">Cancel waiting match</button>
      <button id="dispute" class="tool danger" type="button">Dispute</button>
    </div>

    <details class="events">
      <summary>Match chat & events</summary>
      <div id="log" class="log"></div>
      <form id="chat" class="chat-form">
        <input name="text" maxlength="250" placeholder="Message opponent">
        <button type="submit">SEND</button>
      </form>
    </details>
  </main>
</div>

<div id="resultOverlay" class="result-overlay hidden">
  <div class="result-card">
    <div class="result-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <span>PLAY LUDU HUB</span>
    <h2 id="resultTitle">MATCH FINISHED</h2>
    <p id="resultText"></p>
    <button id="resultBack" type="button">BACK TO ARENA</button>
  </div>
</div>`;


type Obj=Record<string,any>;
type State={revision:number;players:Array<{id:string;seat:number;tokens:number[]}>;turnSeat:number;rolled:number|null;deadline:number|null;phase:string;winnerId?:string|null};
const params=new URLSearchParams(location.search),matchId=params.get('matchId')||'';
if(!matchId)location.replace('/');
const $=<T extends Element=HTMLElement>(s:string)=>document.querySelector<T>(s);
let me:Obj=null,cfg:Obj={turnSeconds:10,timeoutStrikes:2},match:Obj=null,state:State|null=null,ws:WebSocket|null=null;
let reconnectTimer:any,pingTimer:any,timerTick:any,diceSpin:any,retry=0,rolling=false,rollPending=false,movePending=false,lastTimer='';
let soundEnabled=localStorage.getItem('plh_sound')!=='0',audio:AudioContext|null=null,toastTimer:any;
const strikes=new Map<string,number>(),names=new Map<string,string>();
const GENERAL:number[][]=[[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14]];
const HOME=[[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]]];
const YARD=[[[1.5,10.2],[3.5,10.2],[1.5,12.2],[3.5,12.2]],[[10.5,1.2],[12.5,1.2],[10.5,3.2],[12.5,3.2]]];
const SAFE=new Set([0,8,13,21,26,34,39,47]);
const PIPS:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const gIndex=new Map(GENERAL.map((c,i)=>[c.join(','),i]));
const homeCells:Record<string,number[][]>={blue:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],red:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],green:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],yellow:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]};
const homeIndex=new Map<string,string>();Object.entries(homeCells).forEach(([n,cs])=>cs.forEach(c=>homeIndex.set(c.join(','),n)));
const startClass=new Map<string,string>([['6,13','start-blue'],['1,6','start-red'],['8,1','start-green'],['13,8','start-yellow']]);

async function api(path:string,opts:Obj={}){const o:any={...opts,headers:{...(opts.headers||{})}};if(o.body&&typeof o.body!=='string'){o.headers['content-type']='application/json';o.body=JSON.stringify(o.body)}const r=await fetch(path,o),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'REQUEST_FAILED');return d}
const send=(x:Obj)=>{if(ws?.readyState!==WebSocket.OPEN)return false;ws.send(JSON.stringify(x));return true};
const initials=(v:any)=>String(v||'P').replace(/^@/,'').trim().slice(0,1).toUpperCase();
const pname=(id:string)=>id===me?.id?(me?.username?'@'+me.username:'YOU'):(names.get(id)||'Opponent');
function haptic(p:any=10){try{navigator.vibrate?.(p)}catch{}}
function audioCtx(){if(!soundEnabled)return null;try{audio=audio||new AudioContext();if(audio.state==='suspended')audio.resume();return audio}catch{return null}}
function tone(freq:number,d=.04,g=.025,delay=0,type:OscillatorType='sine'){const a=audioCtx();if(!a)return;const at=a.currentTime+delay,o=a.createOscillator(),v=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);v.gain.setValueAtTime(.0001,at);v.gain.exponentialRampToValueAtTime(g,at+.006);v.gain.exponentialRampToValueAtTime(.0001,at+d);o.connect(v);v.connect(a.destination);o.start(at);o.stop(at+d+.02)}
function sound(k:string){if(k==='dice'){tone(270,.03,.02);tone(390,.03,.022,.06);tone(590,.05,.028,.13)}else if(k==='step')tone(390,.025,.012,0,'triangle');else if(k==='capture'){tone(520,.05,.03);tone(290,.08,.034,.05,'square')}else if(k==='home'){tone(523,.05,.03);tone(659,.05,.03,.06);tone(784,.09,.035,.12)}else if(k==='turn')tone(650,.05,.022);else if(k==='win'){tone(523,.06,.035);tone(659,.06,.035,.07);tone(784,.13,.04,.14)}else tone(250,.035,.018)}
function toast(t:string,kind=''){const el=$<HTMLElement>('#gameToast');if(!el)return;el.textContent=t;el.className='game-toast show '+kind;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='game-toast hidden',1300)}
function append(t:string){const el=$('#log');if(!el)return;const d=document.createElement('div');d.textContent=t;el.appendChild(d);while(el.children.length>40)el.firstChild?.remove();el.scrollTop=el.scrollHeight}
function setConn(t:string,kind=''){const e=$('#connection'),n=$('#netOverlay');if(e){e.textContent=t;e.className='connection '+kind}n?.classList.toggle('hidden',kind!=='bad')}
function diceHtml(n:number){const on=PIPS[n]||[];return Array.from({length:9},(_,i)=>'<span class="'+(on.includes(i)?'on':'')+'"></span>').join('')}
function showDice(n:number){const f=$('#diceFace');if(f)f.innerHTML=diceHtml(n)}
function spinDice(final:number){rolling=true;$('#roll')?.classList.add('rolling');clearInterval(diceSpin);diceSpin=setInterval(()=>showDice(1+Math.floor(Math.random()*6)),86);setTimeout(()=>{clearInterval(diceSpin);showDice(final);rolling=false;rollPending=false;$('#roll')?.classList.remove('rolling');render()},720)}
function canMove(p:number,d:number|null){if(d==null||p===57)return false;if(p===-1)return d===6;return p+d<=57}
function viewerSeat(){return state?.players.findIndex(x=>x.id===me?.id)===1?1:0}
function visualSeat(serverSeat:number){return serverSeat===viewerSeat()?0:1}
function visualColour(serverSeat:number){return visualSeat(serverSeat)===0?'#168fd6':'#139b55'}
function coord(seat:number,p:number,id:number){if(p===-1)return YARD[seat][id];if(p<52)return GENERAL[(p+(seat===1?26:0))%52];return HOME[seat][Math.max(0,Math.min(5,p-52))]}
function visibleCoord(seat:number,p:number,id:number){const c=coord(seat,p,id);return viewerSeat()===1?[14-c[0],14-c[1]]:c}
function buildBoard(){
  const art=$('#boardArt');if(!art||art.childElementCount)return;
  const yard=(n:string)=>'<div class="yard '+n+'"><div class="yard-inner"><span class="yard-hole"></span><span class="yard-hole"></span><span class="yard-hole"></span><span class="yard-hole"></span></div></div>';
  let cells='';for(let y=0;y<15;y++)for(let x=0;x<15;x++){const k=x+','+y,gi=gIndex.get(k),h=homeIndex.get(k),cl=['board-cell'];if(gi!==undefined){cl.push('track');if(SAFE.has(gi))cl.push('safe')}if(h)cl.push('home-lane','home-'+h);const st=startClass.get(k);if(st)cl.push(st);cells+='<i class="'+cl.join(' ')+'"></i>'}
  art.innerHTML=yard('red')+yard('green')+yard('blue')+yard('yellow')+'<div class="home-center"><span class="tri blue"></span><span class="tri red"></span><span class="tri green"></span><span class="tri yellow"></span></div><div class="board-grid">'+cells+'</div>';
}
function tokenSvg(colour:string){return '<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="81" rx="34" ry="11" fill="#111" opacity=".2"/><path d="M31 72c4-14 10-22 13-29h12c3 7 9 15 13 29-10 8-28 8-38 0z" fill="'+colour+'" stroke="#16202a" stroke-width="4"/><circle cx="50" cy="31" r="19" fill="'+colour+'" stroke="#16202a" stroke-width="4"/><circle cx="44" cy="25" r="5" fill="#fff" opacity=".34"/></svg>'}
function renderTokens(){
  const layer=$('#tokenLayer');if(!layer)return;if(!state){layer.innerHTML='';return}
  const all=state.players.flatMap((p,seat)=>p.tokens.map((progress,id)=>({seat,id,progress})));
  const current=state.players[state.turnSeat]?.id,mine=current===me.id&&state.rolled!=null&&state.phase==='active',mySeat=state.players.findIndex(p=>p.id===me.id);
  const groups=new Map<string,Array<{seat:number;id:number;progress:number}>>();
  for(const t of all){const c=visibleCoord(t.seat,t.progress,t.id),k=c.join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k)!.push(t)}
  layer.innerHTML=all.map(t=>{const c=visibleCoord(t.seat,t.progress,t.id),group=groups.get(c.join(','))||[],idx=group.findIndex(x=>x.seat===t.seat&&x.id===t.id),a=group.length>1?Math.PI*2*idx/group.length:0,r=group.length>1?.18:0,left=(c[0]+.5+Math.cos(a)*r)/15*100,top=(c[1]+.5+Math.sin(a)*r)/15*100,play=mine&&t.seat===mySeat&&canMove(t.progress,state!.rolled),color=visualColour(t.seat);return '<button class="token '+(play?'playable ':'')+'" style="left:'+left+'%;top:'+top+'%;--tx:0px;--ty:0px;--token-colour:'+color+'" data-token="'+t.id+'" '+(play?'':'disabled')+'>'+tokenSvg(color)+'<span class="token-number">'+(t.id+1)+'</span><span class="playable-ring"><i></i><i></i><i></i><i></i></span></button>'}).join('');
  layer.querySelectorAll<HTMLButtonElement>('[data-token]').forEach(b=>b.onclick=()=>moveToken(Number(b.dataset.token)));
}
function syncStats(){for(const p of match?.playerStats||[]){if(p.username)names.set(p.userId,'@'+p.username);strikes.set(p.userId,Number(p.timeoutStrikes||0))}}
function renderPlayers(){if(!state)return;const current=state.players[state.turnSeat]?.id;state.players.forEach((p,serverSeat)=>{const card=$('#p'+visualSeat(serverSeat)),n=card?.querySelector('[data-name]'),a=card?.querySelector('[data-avatar]'),h=card?.querySelector('[data-home]'),st=card?.querySelector('[data-strikes]'),stat=(match?.playerStats||[]).find((x:any)=>x.userId===p.id);if(n)n.textContent=pname(p.id);if(a)a.textContent=initials(pname(p.id));if(h)h.textContent=p.tokens.filter(x=>x===57).length+' / 4 HOME';if(st)st.textContent=(strikes.get(p.id)||0)?'⚠ '+strikes.get(p.id):'';card?.classList.toggle('active',p.id===current);card?.classList.toggle('online',!!stat?.connected)})}
function render(){
  buildBoard();
  if(match){const code=$('#matchCode'),stakes=$('#stakes');if(code)code.textContent='MATCH '+String(match.id||matchId).slice(-8).toUpperCase();if(stakes)stakes.textContent='ENTRY ৳'+Number(match.entryFee||0).toFixed(2)+' • BET ৳'+Number(match.betAmount||0).toFixed(2)}
  const waiting=match?.status==='waiting'&&!state;$('#waitingOverlay')?.classList.toggle('hidden',!waiting);$('#cancelWaiting')?.classList.toggle('hidden',!(waiting&&match?.playerAId===me?.id));
  if(!state){const st=$('#status');if(st)st.textContent=waiting?'Waiting for opponent':'Loading match state…';renderTokens();return}
  renderPlayers();renderTokens();
  const current=state.players[state.turnSeat]?.id,mine=current===me.id,seat=state.turnSeat,finished=state.phase==='finished',mySeat=state.players.findIndex(p=>p.id===me.id),turnVisual=visualSeat(seat);
  $('.game')?.classList.toggle('viewer-green',mySeat===1);const board=$('#board');board?.classList.toggle('turn-blue',turnVisual===0&&!finished);board?.classList.toggle('turn-green',turnVisual===1&&!finished);board?.classList.toggle('my-turn',mine&&!finished);board?.classList.toggle('roll-phase',mine&&!finished&&state.rolled==null);board?.classList.toggle('move-phase',mine&&!finished&&state.rolled!=null);
  const station=$('#diceStation');station?.classList.toggle('blue',turnVisual===0);station?.classList.toggle('green',turnVisual===1);station?.classList.toggle('dock-left',seat===mySeat);station?.classList.toggle('dock-right',seat!==mySeat);
  const banner=$('#turnBanner');if(banner)banner.textContent=finished?'MATCH FINISHED':mine?(state.rolled==null?'YOUR TURN • ROLL DICE':'YOUR TURN • MOVE TOKEN'):pname(current)+' TURN';
  const col=$('#turnColour');if(col)col.textContent=finished?'MATCH END':turnVisual===0?'BLUE TURN':'GREEN TURN';
  const hint=$('#rollHint');if(hint)hint.textContent=finished?'COMPLETE':mine?(state.rolled==null?'TAP DICE TO ROLL':'SELECT A TOKEN'):'OPPONENT PLAYING';
  const tp=$('#turnPlayer');if(tp)tp.textContent=finished?'FINISHED':mine?'YOU':pname(current);
  const status=$('#status');if(status)status.textContent=finished?'Match complete':mine?(state.rolled==null?'Your turn — roll dice':'Choose a highlighted token'):pname(current)+' is playing';
  const strike=$('#strikeText');if(strike)strike.textContent='Timeout '+(strikes.get(current)||0)+' / '+Number(cfg.timeoutStrikes||2);
  const roll=$<HTMLButtonElement>('#roll');if(roll)roll.disabled=finished||!mine||state.rolled!=null||rollPending||rolling;
  if(state.rolled!=null&&!rolling)showDice(state.rolled);if(finished&&state.winnerId)showResult(state.winnerId,match?.endReason||'finished')
}
function ping(){send({type:'ping',at:Date.now()})}
function connect(){
  clearTimeout(reconnectTimer);if(ws&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(ws.readyState))return;
  ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
  ws.onopen=()=>{retry=0;setConn('Connected','good');send({type:'join_match',matchId,lastKnownState:state?.revision??null});ping();clearInterval(pingTimer);pingTimer=setInterval(ping,5000);toast('LIVE CONNECTION RESTORED','good')};
  ws.onclose=()=>{clearInterval(pingTimer);setConn('Reconnecting…','bad');const l=$('#latency');if(l)l.textContent='-- ms';reconnectTimer=setTimeout(connect,Math.min(5000,700*Math.pow(1.55,retry++)))};
  ws.onerror=()=>setConn('Connection issue','bad');
  ws.onmessage=ev=>{try{handle(JSON.parse(ev.data))}catch(err){console.warn(err)}};
}
function handle(m:Obj){
  if(m.type==='hello')return;
  if(m.type==='pong'){const ms=Math.max(0,Date.now()-Number(m.at||Date.now())),el=$('#latency');if(el){el.textContent=ms+' ms';el.className='latency '+(ms<120?'good':ms<250?'warn':'bad')}return}
  if(m.type==='state'){state=m.state;match=m.match||match;syncStats();rollPending=false;movePending=false;render();return}
  if(m.type==='dice'){spinDice(Number(m.value));sound('dice');haptic(8);append('🎲 '+pname(m.by)+' rolled '+m.value);if(m.forfeit)setTimeout(()=>toast('THREE SIXES • TURN LOST','warn'),800);else if(m.autoPass)setTimeout(()=>toast('NO LEGAL MOVE • TURN PASSED','warn'),800);return}
  if(m.type==='move'){movePending=false;if(m.reachedHome){sound('home');haptic([15,30,15]);toast('TOKEN HOME • EXTRA TURN','good')}else if(m.captured?.length){sound('capture');haptic([20,25,20]);toast('CAPTURE • EXTRA TURN','warn')}else if(m.extraTurn)toast('SIX • EXTRA TURN','good');append('Token '+(Number(m.tokenId)+1)+' moved by '+pname(m.by));return}
  if(m.type==='turn'){if(state)state.deadline=m.deadline;if(m.playerId===me.id){sound('turn');haptic(12);toast('YOUR TURN','good')}return}
  if(m.type==='chat'){append(pname(m.by)+': '+m.text);return}
  if(m.type==='end'){showResult(m.winnerId,m.reason);return}
  if(m.type==='error'){rollPending=false;movePending=false;clearInterval(diceSpin);rolling=false;$('#roll')?.classList.remove('rolling');if(m.code==='TURN_TIMEOUT'&&m.playerId)strikes.set(m.playerId,Number(m.strikes||0));append('⚠ '+String(m.code||'ERROR').replaceAll('_',' '));if(m.code==='STALE_STATE')send({type:'join_match',matchId});render()}
}
function rollDice(){if(!state||rollPending||rolling||state.players[state.turnSeat]?.id!==me.id||state.rolled!=null)return;rollPending=true;sound('tap');haptic(8);showDice(1);rolling=true;$('#roll')?.classList.add('rolling');clearInterval(diceSpin);diceSpin=setInterval(()=>showDice(1+Math.floor(Math.random()*6)),86);if(!send({type:'roll_dice',matchId,expectedState:state.revision})){clearInterval(diceSpin);rolling=false;rollPending=false;render()}}
function moveToken(id:number){if(!state||movePending||rolling||state.players[state.turnSeat]?.id!==me.id||state.rolled==null)return;movePending=true;sound('tap');haptic(8);if(!send({type:'move_token',matchId,tokenId:id,expectedState:state.revision})){movePending=false}}
function startTimer(){clearInterval(timerTick);timerTick=setInterval(()=>{if(!state?.deadline)return;const rem=Math.max(0,state.deadline-Date.now()),sec=Math.ceil(rem/1000),el=$('#timer'),chip=el?.closest<HTMLElement>('.timer-chip');if(el&&String(sec)!==lastTimer){lastTimer=String(sec);el.textContent=String(sec)}if(chip){chip.style.setProperty('--turn-pct',Math.max(0,Math.min(100,rem/(Math.max(1,Number(cfg.turnSeconds||10))*10)))+'%');chip.classList.toggle('warning',sec<=5&&sec>3);chip.classList.toggle('danger',sec<=3)}},120)}
async function cancelWaiting(){if(!confirm('Cancel this waiting match and unlock your funds?'))return;try{await api('/api/pvp/'+encodeURIComponent(matchId)+'/cancel',{method:'POST',headers:{'idempotency-key':crypto.randomUUID()},body:{}});location.href='/'}catch(x:any){toast(x.message,'warn')}}
async function dispute(){const reason=prompt('Describe the dispute (max 500 characters):');if(!reason)return;try{await api('/api/pvp/'+encodeURIComponent(matchId)+'/dispute',{method:'POST',body:{reason}});toast('Dispute opened for admin review','warn')}catch(x:any){toast(x.message,'warn')}}
function showResult(winner:string,reason:string){const box=$('#resultOverlay');if(!box||!box.classList.contains('hidden'))return;const won=winner===me.id,t=$('#resultTitle'),p=$('#resultText');if(t)t.textContent=won?'YOU WON!':'MATCH FINISHED';if(p)p.textContent=(won?'The server settled the pot into your Main Balance. ':'Winner: '+pname(winner)+'. ')+'Reason: '+String(reason||'finished').replaceAll('_',' ')+'.';box.classList.toggle('won',won);box.classList.remove('hidden');if(won)sound('win')}
function bind(){
  showDice(1);buildBoard();
  $('#roll')?.addEventListener('click',rollDice);
  $('#exitBtn')?.addEventListener('click',()=>{if(match?.status==='active'&&!confirm('Leave live match screen? Disconnect rules may apply.'))return;location.href='/'});
  $('#resultBack')?.addEventListener('click',()=>location.href='/');
  $('#soundToggle')?.addEventListener('click',()=>{soundEnabled=!soundEnabled;localStorage.setItem('plh_sound',soundEnabled?'1':'0');const b=$('#soundToggle');if(b)b.textContent=soundEnabled?'🔊 Sound':'🔇 Sound';if(soundEnabled)sound('turn')});
  $('#cancelWaiting')?.addEventListener('click',cancelWaiting);$('#dispute')?.addEventListener('click',dispute);
  $<HTMLFormElement>('#chat')?.addEventListener('submit',ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget),text=String(f.get('text')||'').trim();if(text){send({type:'chat',matchId,text});ev.currentTarget.reset()}});
  document.addEventListener('pointerdown',()=>audioCtx(),{once:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(!ws||ws.readyState===WebSocket.CLOSED))connect()});
}
(async()=>{try{bind();const [m,c]=await Promise.all([api('/api/me'),api('/api/config')]);me=m.user;cfg={...cfg,...c};const s=$('#soundToggle');if(s)s.textContent=soundEnabled?'🔊 Sound':'🔇 Sound';startTimer();connect();setTimeout(()=>$('#boot')?.classList.add('hide'),220);setTimeout(()=>$('#boot')?.remove(),500)}catch{location.replace('/')}})();
