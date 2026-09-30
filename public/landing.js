(()=>{
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
if(!document.querySelector('link[href^="/landing.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/landing.css?v=product-v10';document.head.appendChild(l);}

const GENERAL=[
  [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14]
];
const SAFE=new Set([0,8,13,21,26,34,39,47]);
const HOME=[[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]]];
const ALL_HOME={blue:HOME[0],red:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],green:HOME[1],yellow:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]};
const YARDS=[[[1.55,10.2],[3.45,10.2],[1.55,12.2],[3.45,12.2]],[[10.55,1.2],[12.45,1.2],[10.55,3.2],[12.45,3.2]]];
const generalMap=new Map(GENERAL.map((c,i)=>[c.join(','),i])),homeMap=new Map();
for(const [name,coords] of Object.entries(ALL_HOME))for(const p of coords)homeMap.set(p.join(','),name);

function coordFor(seat,progress,tokenId){
  if(progress===-1)return YARDS[seat]?.[tokenId]||[7,7];
  if(progress>=0&&progress<52)return GENERAL[(progress+(seat===1?26:0))%52];
  if(progress>=52&&progress<=57)return HOME[seat]?.[progress-52]||[7,7];
  return YARDS[seat]?.[tokenId]||[7,7];
}
function cells(){
  let h='';
  for(let y=0;y<15;y++)for(let x=0;x<15;x++){
    const k=x+','+y,gi=generalMap.get(k),home=homeMap.get(k),cls=['arena-cell'];
    if(gi!==undefined){cls.push('track');if(SAFE.has(gi))cls.push('safe');}
    if(home)cls.push('home-lane','home-'+home);
    h+='<i class="'+cls.join(' ')+'"></i>';
  }
  return h;
}
const BOARD_CELLS=cells();
function tokenMarkup(state){
  const players=state?.players?.length?state.players:[{seat:0,tokens:[-1,-1,-1,-1]},{seat:1,tokens:[-1,-1,-1,-1]}];
  let h='';
  for(const p of players.slice(0,2)){
    const seat=Number(p.seat??0);
    (p.tokens||[]).slice(0,4).forEach((progress,i)=>{
      const [x,y]=coordFor(seat,Number(progress),i);
      h+=`<b class="arena-token seat-${seat}" style="--tx:${((x+.5)/15*100).toFixed(3)}%;--ty:${((y+.5)/15*100).toFixed(3)}%" aria-hidden="true">${i+1}</b>`;
    });
  }
  return h;
}
function diceFace(v){
  const n=Number(v);if(!(n>=1&&n<=6))return '<span class="dice-wait">•</span>';
  return '<span class="dice-num">'+n+'</span>';
}
function board(state=null,hero=false){
  const turn=Number(state?.turnSeat||0),rolled=state?.rolled;
  return `<div class="arena-board ${hero?'hero-arena-board':''}" aria-hidden="true">
    <div class="arena-board-grid">${BOARD_CELLS}</div>
    <div class="arena-yard yard-red"><span></span><span></span><span></span><span></span></div>
    <div class="arena-yard yard-green"><span></span><span></span><span></span><span></span></div>
    <div class="arena-yard yard-blue"><span></span><span></span><span></span><span></span></div>
    <div class="arena-yard yard-yellow"><span></span><span></span><span></span><span></span></div>
    <div class="arena-center"></div>
    <div class="arena-tokens">${tokenMarkup(state)}</div>
    <div class="arena-dice seat-${turn}">${diceFace(rolled)}</div>
    <div class="arena-turn-chip seat-${turn}">${state?'TURN '+(turn===0?'BLUE':'GREEN'):'LIVE PVP'}</div>
  </div>`;
}

const landing=`<section id="landing" class="landing">
  <div class="landing-wrap">
    <header class="landing-nav">
      <div class="landing-brand"><i>◆</i><span>PLAY LUDU HUB<small>PREMIUM REAL-TIME PVP</small></span></div>
      <div class="landing-nav-actions"><button id="landingLogin" class="landing-btn secondary" type="button">LOGIN</button><button id="landingPlay" class="landing-btn primary" type="button">PLAY NOW</button></div>
    </header>

    <section class="landing-hero">
      <div class="landing-copy">
        <span class="landing-kicker"><i></i> REAL-TIME ARENA</span>
        <h1>Fast Ludo.<br><span>Premium experience.</span></h1>
        <p>Two-player server-controlled Ludo with live arena tables, fast turns, secure account access and a mobile-first interface.</p>
        <div class="landing-cta"><button id="landingPlayHero" class="landing-btn primary big" type="button">PLAY NOW <b>→</b></button><button id="landingExplore" class="landing-btn secondary big" type="button">LIVE TABLES</button></div>
        <div class="landing-trust"><span>Server dice</span><span>10s turn control</span><span>Live table status</span></div>
      </div>
      <div class="hero-board-shell" id="heroBoardShell">
        <div class="hero-table-top"><span><i></i> <b id="heroPreviewLabel">DEMO PREVIEW</b></span><b id="heroPreviewStatus">SERVER VERIFIED</b></div>
        <div id="heroArenaBoard">${board({turnSeat:0,rolled:6,players:[{seat:0,tokens:[0,9,25,-1]},{seat:1,tokens:[0,14,31,-1]}]},true)}</div>
        <div class="hero-table-footer"><div><small>BLUE</small><b>Blue player</b></div><strong id="heroPreviewMeta">DEMO</strong><div><small>GREEN</small><b>Green player</b></div></div>
      </div>
    </section>

    <section id="landingLive" class="landing-section">
      <div class="landing-section-head"><div><span class="section-kicker">LIVE NOW</span><h2>Arena tables</h2><small>Actual match status and sanitized board positions</small></div><p><b id="publicActiveTotal">0</b> active <span>•</span> <b id="publicWaitingTotal">0</b> waiting</p></div>
      <div id="publicLiveMatches" class="live-strip"></div>
    </section>

    <section class="landing-section landing-enter-section">
      <div class="landing-access"><div><span class="section-kicker">ENTER THE ARENA</span><h2>Your table is ready.</h2><p>Login with an approved account or create a verified account to enter PvP.</p></div><div class="landing-access-actions"><button id="landingCreate" class="landing-btn secondary big" type="button">CREATE ACCOUNT</button><button id="landingPlayBottom" class="landing-btn primary big" type="button">LOGIN & PLAY</button></div></div>
    </section>
  </div>
</section>`;

const auth=document.querySelector('#auth');if(auth&&!document.querySelector('#landing'))auth.insertAdjacentHTML('beforebegin',landing);
const money=v=>`৳${Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtTime=ms=>{const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60),r=s%60;return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;};
let matches=[];
function tile(m,i){
  const started=Number(m.startedAt||m.createdAt||Date.now()),active=m.status==='active';
  return `<article class="live-tile" data-status="${esc(m.status)}" data-started="${started}">
    <div class="live-tile-head"><div><small>TABLE</small><b>#${esc(m.tableNumber||i+1)}</b></div><span class="live-status">${active?'LIVE':'WAITING'}</span></div>
    ${board(m.board||null)}
    <div class="live-money"><div><small>BET</small><strong>${money(m.betAmount)}</strong></div><div><small>ENTRY</small><strong>${money(m.entryFee)}</strong></div></div>
    <div class="live-clock"><span>${active?'MATCH TIME':'WAITING TIME'}</span><b data-clock>${fmtTime(Date.now()-started)}</b></div>
  </article>`;
}
function emptyArena(){
  return `<div class="live-empty">
    <div class="live-empty-icon">♜</div>
    <div><span>ARENA READY</span><h3>No public tables right now</h3><p>There is no active or waiting table at this moment. Sign in to create the next PvP match.</p></div>
    <button type="button" data-empty-play>CREATE A TABLE <b>→</b></button>
  </div>`;
}
function updateHero(){
  const live=matches.find(x=>x.status==='active'&&x.board);
  const waiting=!live&&matches.find(x=>x.status==='waiting');
  const host=$('#heroArenaBoard'),label=$('#heroPreviewLabel'),meta=$('#heroPreviewMeta'),status=$('#heroPreviewStatus');
  if(!host)return;
  if(live){
    host.innerHTML=board(live.board,true);
    if(label)label.textContent='LIVE MATCH PREVIEW';
    if(meta)meta.textContent='TABLE #'+String(live.tableNumber||1)+' • '+money(live.betAmount)+' BET';
    if(status)status.textContent='LIVE • SERVER VERIFIED';
    return;
  }
  if(waiting){
    host.innerHTML=board(null,true);
    if(label)label.textContent='WAITING TABLE';
    if(meta)meta.textContent='TABLE #'+String(waiting.tableNumber||1)+' • WAITING';
    if(status)status.textContent='SERVER VERIFIED';
    return;
  }
  host.innerHTML=board({turnSeat:0,rolled:6,players:[{seat:0,tokens:[0,9,25,-1]},{seat:1,tokens:[0,14,31,-1]}]},true);
  if(label)label.textContent='DEMO PREVIEW';
  if(meta)meta.textContent='DEMO';
  if(status)status.textContent='SERVER VERIFIED';
}
function render(){
  const box=$('#publicLiveMatches');if(!box)return;
  box.classList.toggle('is-empty',!matches.length);
  box.innerHTML=matches.length?matches.slice(0,4).map(tile).join(''):emptyArena();
  box.querySelector('[data-empty-play]')?.addEventListener('click',toAuth);
  updateHero();
}
async function load(){
  try{
    const r=await fetch('/api/public/arena',{headers:{accept:'application/json'},cache:'no-store'});
    if(!r.ok)throw new Error('arena');
    const d=await r.json();matches=Array.isArray(d.items)?d.items:[];render();
    if($('#publicActiveTotal'))$('#publicActiveTotal').textContent=String(d.activeCount||0);
    if($('#publicWaitingTotal'))$('#publicWaitingTotal').textContent=String(d.waitingCount||0);
  }catch{matches=[];render();}
}
function tick(){document.querySelectorAll('.live-tile[data-started]').forEach(el=>{const span=el.querySelector('[data-clock]');if(span)span.textContent=fmtTime(Date.now()-Number(el.dataset.started||Date.now()));});}
function toAuth(){document.querySelector('#auth')?.scrollIntoView({behavior:document.documentElement.classList.contains('lite')?'auto':'smooth',block:'start'});setTimeout(()=>document.querySelector('#loginForm input[name="login"]')?.focus({preventScroll:true}),350);}
function toSignup(){document.querySelector('#auth')?.scrollIntoView({behavior:document.documentElement.classList.contains('lite')?'auto':'smooth',block:'start'});setTimeout(()=>{document.querySelector('[data-auth-tab="signup"]')?.click();document.querySelector('#signupForm input[name="name"]')?.focus({preventScroll:true});},350);}
['#landingPlay','#landingPlayHero','#landingPlayBottom','#landingLogin'].forEach(s=>$(s)?.addEventListener('click',toAuth));
$('#landingCreate')?.addEventListener('click',toSignup);
$('#landingExplore')?.addEventListener('click',()=>$('#landingLive')?.scrollIntoView({behavior:'smooth',block:'start'}));
window.addEventListener('plh:me',()=>$('#landing')?.classList.add('hidden'));
load();setInterval(()=>{if(!document.hidden&&!$('#landing')?.classList.contains('hidden'))load();},8000);setInterval(tick,1000);
})();