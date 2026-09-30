import './player.css';

type AnyObj=Record<string,any>;
type Page='home'|'wallet'|'profile';
const root=document.querySelector<HTMLDivElement>('#root')!;
const state:{cfg:AnyObj|null;me:AnyObj|null;page:Page;walletMode:'deposit'|'withdraw';otp:AnyObj|null}={cfg:null,me:null,page:'home',walletMode:'deposit',otp:null};
let otpTick:any=null;

const e=(v:any)=>String(v??'').replace(/[&<>"']/g,(c:string)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as AnyObj)[c]);
const money=(v:any)=>'৳'+Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const idem=()=>crypto.randomUUID();
const errText=(v:any)=>({INVALID_CREDENTIALS:'Incorrect login or password.',ACCOUNT_PENDING:'Your account is waiting for admin approval.',ACCOUNT_REJECTED:'This account was rejected.',ACCOUNT_BANNED:'This account is unavailable.',EMAIL_NOT_VERIFIED:'Verify your email before signing in.',EMAIL_TAKEN:'This email is already registered.',PHONE_TAKEN:'This phone is already linked to another account.',USERNAME_TAKEN:'This username is already taken.',INVALID_PHONE:'Enter a valid mobile number.',INVALID_OTP:'The verification code is incorrect.',OTP_EXPIRED:'The verification code expired.',OTP_RESEND_TOO_SOON:'Please wait before requesting another code.',OTP_SEND_LIMIT:'Too many verification codes requested. Try again later.',OTP_SESSION_NOT_FOUND:'Verification session expired. Create the account again.',EMAIL_OTP_SEND_FAILED:'Verification email could not be sent.',INSUFFICIENT_CASH:'Not enough Main Balance.',DUPLICATE_TRANSACTION_ID:'This TxID was already used.',MATCH_NOT_JOINABLE:'This match is no longer available.',CANNOT_JOIN_OWN_MATCH:'You cannot join your own table.',PVP_DISABLED:'PvP is currently disabled.'} as AnyObj)[v]||String(v||'Something went wrong').replaceAll('_',' ').toLowerCase().replace(/^./,(x:string)=>x.toUpperCase());

async function api(path:string,opts:AnyObj={}){
  const o:any={...opts,headers:{...(opts.headers||{})}};
  if(o.body&&typeof o.body!=='string'){o.headers['content-type']='application/json';o.body=JSON.stringify(o.body);}
  const r=await fetch(path,o),data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(data.error||'REQUEST_FAILED'),{data,status:r.status});
  return data;
}
function shell(html:string){root.innerHTML=html+'<div id="toast" class="toast"></div>';}
function toast(msg:string,bad=false){const t=document.querySelector<HTMLDivElement>('#toast');if(!t)return;t.textContent=bad?errText(msg):msg;t.className='toast show '+(bad?'bad':'ok');clearTimeout((t as any)._t);(t as any)._t=setTimeout(()=>t.className='toast',2800);}
function busy(b:HTMLButtonElement|null,on:boolean,label='PLEASE WAIT…'){if(!b)return;if(on){b.dataset.old=b.textContent||'';b.disabled=true;b.textContent=label;}else{b.disabled=false;b.textContent=b.dataset.old||'';}}
function brand(){return '<div class="brand"><span>◆</span><div><b>PLAY LUDU HUB</b><small>REAL-TIME PVP</small></div></div>';}
function initials(u:any){return String(u?.displayName||u?.name||u?.username||'P').trim().slice(0,1).toUpperCase();}
function avatar(u:any,large=false){return '<div class="avatar '+(large?'large':'')+'">'+(u?.avatar?'<img src="'+e(u.avatar)+'" alt="">':e(initials(u)))+'</div>';}

const TRACK:number[][]=[
  [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14]
];
const LANES:number[][][]=[
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]]
];
const YARD_POS:number[][][]=[
  [[2.15,11.1],[3.85,11.1],[2.15,12.9],[3.85,12.9]],
  [[11.15,2.1],[12.85,2.1],[11.15,3.9],[12.85,3.9]]
];
function boardCoord(seat:number,progress:number,token:number){
  if(progress<0)return YARD_POS[seat]?.[token]||[7,7];
  if(progress<52)return TRACK[(progress+(seat===1?26:0))%52];
  return LANES[seat]?.[Math.min(5,progress-52)]||[7,7];
}
function boardTokens(board:any){
  const players=Array.isArray(board?.players)?board.players:[];
  return players.slice(0,2).flatMap((p:any,seat:number)=>(Array.isArray(p.tokens)?p.tokens:[]).slice(0,4).map((progress:any,token:number)=>{
    const [x,y]=boardCoord(seat,Number(progress),token);
    return '<b class="live-pawn s'+seat+'" style="--px:'+(((x+.5)/15)*100).toFixed(2)+'%;--py:'+(((y+.5)/15)*100).toFixed(2)+'%">'+(token+1)+'</b>';
  })).join('');
}
function ludoBoard(board:any=null,demo=false){
  const turn=Number(board?.turnSeat||0),rolled=board?.rolled;
  return '<div class="ludo-mini '+(board?'has-live-state':'')+'">'+
    '<i class="home red"></i><i class="home green"></i><i class="home blue"></i><i class="home yellow"></i><i class="cross v"></i><i class="cross h"></i><i class="center"></i>'+
    (board?'<div class="live-pawns">'+boardTokens(board)+'</div><span class="mini-dice s'+turn+'">'+(rolled==null?'•':e(rolled))+'</span><small class="mini-turn s'+turn+'">'+(turn===0?'BLUE':'GREEN')+' TURN</small>':
      demo?'<b class="pawn p1">1</b><b class="pawn p2">2</b><b class="pawn g1">1</b><b class="pawn g2">2</b>':'')+
  '</div>';
}
function demoBoard(){return ludoBoard(null,true);}

async function renderLanding(){
  shell('<div class="landing">'+
    '<header class="landing-nav">'+brand()+'<div class="landing-actions"><button class="btn ghost" data-auth="login">Sign in</button><button class="btn primary" data-auth="signup">Create account</button></div></header>'+
    '<main class="landing-main">'+
      '<section class="hero"><div class="hero-copy"><span class="live"><i></i> REAL-TIME LUDO ARENA</span><h1>Play fast.<br><em>Play clean.</em></h1><p>Server-controlled dice, real-time two-player matches and a focused mobile experience built for competitive PvP.</p><div class="hero-actions"><button class="btn primary xl" data-auth="signup">Start playing →</button><button class="btn ghost xl" data-arena>Live arena</button></div><div class="trust"><span>✓ Server-authoritative</span><span>✓ 10s turns</span><span>✓ Real-time sync</span></div></div>'+
      '<aside class="hero-game"><div class="hero-game-head"><span id="heroPreviewTitle">DEMO PREVIEW</span><b>SERVER VERIFIED</b></div><div id="heroBoard">'+demoBoard()+'</div><div class="hero-game-foot"><span>BLUE</span><b id="heroTableLabel">DEMO TABLE</b><span>GREEN</span></div></aside></section>'+
      '<section id="arenaSection" class="arena-section"><div class="section-head"><div><span>LIVE NOW</span><h2>Arena tables</h2></div><b id="arenaCount">0 active • 0 waiting</b></div><div id="publicArena" class="arena-grid"><div class="loading">Loading arena…</div></div></section>'+
      '<section class="cta-panel"><div><span>PLAYER ACCESS</span><h2>Ready for your next match?</h2><p>Sign in with an approved account or create a verified player profile.</p></div><button class="btn primary xl" data-auth="login">Enter arena →</button></section>'+
    '</main><footer class="landing-footer">'+brand()+'<small>PLAY LUDU HUB • Secure PvP Platform</small></footer></div>');
  document.querySelectorAll<HTMLElement>('[data-auth]').forEach(x=>x.onclick=()=>renderAuth((x.dataset.auth||'login') as any));
  document.querySelector('[data-arena]')?.addEventListener('click',()=>document.querySelector('#arenaSection')?.scrollIntoView({behavior:'smooth'}));
  loadPublicArena();
}
async function loadPublicArena(){
  try{
    const r=await api('/api/public/arena'),box=document.querySelector('#publicArena'),count=document.querySelector('#arenaCount');
    if(count)count.textContent=String(r.activeCount||0)+' active • '+String(r.waitingCount||0)+' waiting';
    const items=r.items||[];
    if(box)box.innerHTML=items.length?items.map((m:any,i:number)=>'<article class="arena-card"><div class="arena-top"><span>TABLE #'+(m.tableNumber||i+1)+'</span><b class="'+e(m.status)+'">'+e(String(m.status).toUpperCase())+'</b></div>'+ludoBoard(m.status==='active'?m.board:null,false)+'<div class="arena-stakes"><span><small>BET</small><b>'+money(m.betAmount)+'</b></span><span><small>ENTRY</small><b>'+money(m.entryFee)+'</b></span></div></article>').join(''):'<div class="empty wide"><span>♜</span><h3>No public tables right now</h3><p>Sign in and create the next PvP table.</p><button class="btn primary" data-auth-empty>Enter arena</button></div>';
    document.querySelector('[data-auth-empty]')?.addEventListener('click',()=>renderAuth('login'));
    const live=items.find((x:any)=>x.status==='active'&&x.board),waiting=!live&&items.find((x:any)=>x.status==='waiting');
    const heroBoard=document.querySelector('#heroBoard'),lab=document.querySelector('#heroTableLabel'),title=document.querySelector('#heroPreviewTitle');
    if(live){
      if(heroBoard)heroBoard.innerHTML=ludoBoard(live.board,false);
      if(lab)lab.textContent='TABLE #'+live.tableNumber+' • '+money(live.betAmount)+' BET';
      if(title)title.textContent='LIVE MATCH';
    }else if(waiting){
      if(heroBoard)heroBoard.innerHTML=ludoBoard(null,false);
      if(lab)lab.textContent='TABLE #'+waiting.tableNumber+' • WAITING';
      if(title)title.textContent='WAITING TABLE';
    }else{
      if(heroBoard)heroBoard.innerHTML=demoBoard();
      if(lab)lab.textContent='DEMO TABLE';
      if(title)title.textContent='DEMO PREVIEW';
    }
  }catch{}
}

function authPanel(mode:string){
  if(mode==='otp')return '<div class="otp-box"><div class="otp-icon">✉</div><h3>Check your email</h3><p>Enter the 6-digit code sent to <b>'+e(state.otp?.maskedEmail||'your email')+'</b>.</p><form id="otpForm"><input class="otp-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required><button class="btn primary xl full">Verify email</button></form><div id="otpMeta" class="otp-meta">Code expires soon</div><button id="resendOtp" class="text-button" type="button" disabled>Resend code</button></div>';
  if(mode==='google')return '<form id="googleCompleteForm" class="form"><div class="field"><label>Username</label><input name="username" required></div><div class="field"><label>Phone</label><input name="phone" required></div><button class="btn primary xl full">Complete signup</button></form>';
  if(mode==='signup')return '<form id="signupForm" class="form"><div class="two"><div class="field"><label>Full name</label><input name="name" required></div><div class="field"><label>Username</label><input name="username" required></div></div><div class="field"><label>Phone</label><input name="phone" placeholder="01XXXXXXXXX" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Password</label><input name="password" type="password" minlength="8" required></div><div class="identity"><b>✓</b><span>One phone number can belong to only one account.</span></div><button class="btn primary xl full">'+(state.cfg?.emailOtpRequired?'Create & verify email':'Create account')+'</button></form>';
  return '<form id="loginForm" class="form"><div class="field"><label>Username / Phone / Email</label><input name="login" autocomplete="username" required></div><div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn primary xl full">Sign in</button></form>';
}
function bindOtpClock(){
  clearInterval(otpTick);
  const btn=document.querySelector<HTMLButtonElement>('#resendOtp'),meta=document.querySelector<HTMLElement>('#otpMeta');
  if(!btn||!state.otp)return;
  const tick=()=>{
    const now=Date.now(),resendAt=Number(state.otp?.resendAfter||0),expiresAt=Number(state.otp?.expiresAt||0);
    const resendIn=Math.max(0,Math.ceil((resendAt-now)/1000)),expiresIn=Math.max(0,Math.ceil((expiresAt-now)/1000));
    btn.disabled=resendIn>0||expiresIn<=0;
    btn.textContent=expiresIn<=0?'Code expired':resendIn>0?'Resend available in '+resendIn+'s':'Resend code';
    if(meta){const m=Math.floor(expiresIn/60),s=expiresIn%60;meta.textContent=expiresIn>0?'Code expires in '+m+':'+String(s).padStart(2,'0'):'This code expired. Request a new code.';}
  };
  tick();otpTick=setInterval(tick,1000);
}
function renderAuth(mode:'login'|'signup'|'otp'|'google'='login'){
  clearInterval(otpTick);
  shell('<div class="auth-page"><button id="authBack" class="back">‹</button><div class="auth-shell"><aside class="auth-side">'+brand()+'<div><span>SECURE PLAYER ACCESS</span><h1>'+(mode==='signup'?'Create your player account.':'Welcome back to the arena.')+'</h1><p>Email verification, unique phone identity and admin approval keep accounts cleaner.</p></div><ul><li>◆ Email verification</li><li>◆ Unique phone identity</li><li>◆ Admin approval</li></ul></aside><main class="auth-card"><div class="mobile-brand">'+brand()+'</div><div class="auth-title"><span>PLAYER ACCESS</span><h2>'+(mode==='signup'?'Create account':mode==='otp'?'Verify email':mode==='google'?'Finish signup':'Sign in')+'</h2></div>'+((mode==='login'||mode==='signup')?'<div class="tabs"><button class="'+(mode==='login'?'active':'')+'" data-tab="login">Sign in</button><button class="'+(mode==='signup'?'active':'')+'" data-tab="signup">Create account</button></div>':'')+(state.cfg?.googleAuthEnabled&&(mode==='login'||mode==='signup')?'<button id="googleBtn" class="google"><b>G</b> Continue with Google</button><div class="or"><i></i><span>OR CONTINUE WITH DETAILS</span><i></i></div>':'')+authPanel(mode)+'<div id="authMsg" class="msg hidden"></div></main></div></div>');
  document.querySelector('#authBack')?.addEventListener('click',renderLanding);
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(x=>x.onclick=()=>renderAuth(x.dataset.tab as any));
  document.querySelector('#googleBtn')?.addEventListener('click',()=>location.href='/api/auth/google/start');
  const show=(m:any,bad=false)=>{const el=document.querySelector('#authMsg');if(el){el.textContent=bad?errText(m):m;el.className='msg '+(bad?'bad':'good');}};
  if(mode==='otp')bindOtpClock();
  document.querySelector<HTMLFormElement>('#loginForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.submitter as HTMLButtonElement,fd=new FormData(ev.currentTarget);busy(b,true,'SIGNING IN…');try{await api('/api/auth/login',{method:'POST',body:{login:fd.get('login'),password:fd.get('password')}});state.me=await api('/api/me');renderApp();}catch(x:any){show(x.message,true);busy(b,false);}});
  document.querySelector<HTMLFormElement>('#signupForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.submitter as HTMLButtonElement,fd=new FormData(ev.currentTarget);busy(b,true,'CREATING…');try{const r=await api('/api/auth/signup',{method:'POST',body:{name:fd.get('name'),username:fd.get('username'),phone:fd.get('phone'),email:fd.get('email'),password:fd.get('password')}});if(r.verification){state.otp=r.verification;renderAuth('otp');}else show('Account created. Wait for admin approval.');}catch(x:any){show(x.message,true);busy(b,false);}});
  document.querySelector<HTMLFormElement>('#otpForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.submitter as HTMLButtonElement,fd=new FormData(ev.currentTarget);busy(b,true,'VERIFYING…');try{await api('/api/auth/verify-email',{method:'POST',body:{verificationId:state.otp.id,code:fd.get('code')}});clearInterval(otpTick);state.otp=null;renderAuth('login');setTimeout(()=>{const el=document.querySelector('#authMsg');if(el){el.textContent='Email verified. Wait for admin approval.';el.className='msg good';}},0);}catch(x:any){show(x.message,true);busy(b,false);}});
  document.querySelector('#resendOtp')?.addEventListener('click',async()=>{const b=document.querySelector<HTMLButtonElement>('#resendOtp');if(!b||b.disabled||!state.otp)return;b.disabled=true;b.textContent='Sending…';try{const r=await api('/api/auth/resend-email-otp',{method:'POST',body:{verificationId:state.otp.id}});state.otp=r.verification;bindOtpClock();toast('Verification code resent');}catch(x:any){bindOtpClock();toast(x.message,true);}});
  document.querySelector<HTMLFormElement>('#googleCompleteForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.submitter as HTMLButtonElement,fd=new FormData(ev.currentTarget);busy(b,true,'FINISHING…');try{await api('/api/auth/google/complete',{method:'POST',body:{username:fd.get('username'),phone:fd.get('phone')}});renderAuth('login');}catch(x:any){show(x.message,true);busy(b,false);}});
}

function header(title:string,kicker:string){return '<header class="app-head"><button class="menu" data-menu>☰</button><div><span>'+e(kicker)+'</span><h1>'+e(title)+'</h1></div><button class="cash" data-nav="wallet"><small>Main balance</small><b>'+money(state.me?.wallet.cashBalance)+'</b></button></header>';}
function renderApp(){
  shell('<div class="app"><div id="shade" class="shade"></div><aside id="drawer" class="drawer"><div class="drawer-user">'+avatar(state.me?.user)+'<div><b>'+e(state.me?.user.displayName||state.me?.user.name)+'</b><span>@'+e(state.me?.user.username)+'</span></div></div><nav><button data-nav="home">⌂ <b>Arena</b></button><button data-nav="wallet">◈ <b>Wallet</b></button><button data-nav="profile">◎ <b>Profile</b></button></nav><button id="logoutDrawer" class="logout">↪ Log out</button></aside><main id="page"></main><nav class="bottom"><button data-nav="home"><span>⌂</span><b>Arena</b></button><button data-nav="wallet"><span>◈</span><b>Wallet</b></button><button data-nav="profile"><span>◎</span><b>Profile</b></button></nav></div>');
  bindShell();go(state.page);
}
function bindShell(){document.querySelectorAll<HTMLElement>('[data-nav]').forEach(x=>x.onclick=()=>go(x.dataset.nav as Page));document.querySelector('[data-menu]')?.addEventListener('click',openDrawer);document.querySelector('#shade')?.addEventListener('click',closeDrawer);document.querySelector('#logoutDrawer')?.addEventListener('click',logout);}
function openDrawer(){document.querySelector('#drawer')?.classList.add('open');document.querySelector('#shade')?.classList.add('open');}
function closeDrawer(){document.querySelector('#drawer')?.classList.remove('open');document.querySelector('#shade')?.classList.remove('open');}
function go(page:Page){state.page=page;closeDrawer();document.querySelectorAll<HTMLElement>('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===page));if(page==='home')dashboard();else if(page==='wallet')walletPage();else profilePage();scrollTo({top:0,behavior:'auto'});}

function dashboard(){
  const me=state.me!,c=state.cfg!,p=document.querySelector('#page')!;
  p.innerHTML=header('Arena','PLAY LUDU HUB')+'<div class="page-body">'+(c.appNotice?'<div class="notice">'+e(c.appNotice)+'</div>':'')+
  '<section class="welcome"><div><span class="kicker"><i></i> READY FOR PVP</span><h2>Hi, '+e(me.user.displayName||me.user.name||me.user.username)+'</h2><p>Create a stake table or join a waiting player.</p><div class="welcome-actions"><button class="btn primary" data-focus>CREATE TABLE →</button><button class="btn ghost" data-nav="wallet">ADD BALANCE</button></div></div><div class="status-card">'+avatar(me.user)+'<b>APPROVED</b><span>READY TO PLAY</span></div></section>'+
  '<section class="balances"><article class="main"><small>MAIN BALANCE</small><strong>'+money(me.wallet.cashBalance)+'</strong><span>Available</span></article><article><small>LOCKED</small><strong>'+money(me.wallet.lockedBalance)+'</strong><span>Active stakes</span></article><article><small>BONUS</small><strong>'+money(me.wallet.bonusBalance)+'</strong><span>Promotional</span></article><article><small>DEPOSITED</small><strong>'+money(me.wallet.totalDeposited)+'</strong><span>Lifetime</span></article></section>'+
  '<div class="section-title"><span>START A MATCH</span><h3>Create PvP table</h3><p>Entry '+money(c.entryFee)+' • Bet '+money(c.minBet)+' – '+money(c.maxBet)+'</p></div>'+
  '<section class="create-card"><div class="create-visual">'+demoBoard()+'<div><span>SERVER TABLE</span><b>BLUE vs GREEN</b><small>'+c.turnSeconds+'s turns • server dice • live sync</small></div></div><form id="createForm"><div class="field"><label>Entry fee</label><div class="readout">'+money(c.entryFee)+'</div></div><div class="field"><label>Bet amount</label><input id="bet" name="bet" type="number" min="'+c.minBet+'" max="'+c.maxBet+'" required></div><button class="btn primary xl">CREATE MATCH →</button></form></section>'+
  '<div class="section-row"><div class="section-title"><span>LIVE ARENA</span><h3>Open tables</h3><p>Join a waiting player.</p></div><button id="refresh" class="refresh">↻ Refresh</button></div><section id="lobby" class="lobby"><div class="loading">Loading tables…</div></section></div>';
  document.querySelector('[data-focus]')?.addEventListener('click',()=>document.querySelector<HTMLInputElement>('#bet')?.focus());
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach(x=>x.onclick=()=>go(x.dataset.nav as Page));
  document.querySelector('#refresh')?.addEventListener('click',loadLobby);
  document.querySelector<HTMLFormElement>('#createForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.submitter as HTMLButtonElement,fd=new FormData(ev.currentTarget);busy(b,true,'CREATING…');try{const r=await api('/api/pvp/create',{method:'POST',headers:{'idempotency-key':idem()},body:{entryFee:c.entryFee,betAmount:Number(fd.get('bet'))}});location.href='/game/?matchId='+encodeURIComponent(r.match.id);}catch(x:any){toast(x.message,true);busy(b,false);}});
  loadLobby();
}
async function loadLobby(){const box=document.querySelector('#lobby');if(!box)return;try{const r=await api('/api/pvp/open'),items=r.items||[];box.innerHTML=items.length?items.map((m:any,i:number)=>'<article class="lobby-card"><div class="num">#'+(i+1)+'</div><div class="player"><b>@'+e(m.creatorUsername||'player')+'</b><small>Waiting for opponent</small></div><div class="stake"><span>BET <b>'+money(m.betAmount)+'</b></span><span>ENTRY <b>'+money(m.entryFee)+'</b></span></div>'+(m.playerAId===state.me!.user.id?'<button class="btn ghost" data-open="'+e(m.id)+'">OPEN</button>':'<button class="btn primary" data-join="'+e(m.id)+'">JOIN</button>')+'</article>').join(''):'<div class="empty"><span>♜</span><h3>No open tables</h3><p>Create the first table.</p></div>';box.querySelectorAll<HTMLElement>('[data-open]').forEach(x=>x.onclick=()=>location.href='/game/?matchId='+encodeURIComponent(x.dataset.open!));box.querySelectorAll<HTMLElement>('[data-join]').forEach(x=>x.onclick=()=>join(x.dataset.join!,x as HTMLButtonElement));}catch(x:any){box.innerHTML='<div class="empty bad"><h3>Could not load tables</h3><p>'+e(errText(x.message))+'</p></div>';}}
async function join(id:string,b:HTMLButtonElement){busy(b,true,'JOINING…');try{await api('/api/pvp/'+encodeURIComponent(id)+'/join',{method:'POST',headers:{'idempotency-key':idem()},body:{}});location.href='/game/?matchId='+encodeURIComponent(id);}catch(x:any){toast(x.message,true);busy(b,false);}}

async function walletPage(){
  const m=state.me!,p=document.querySelector('#page')!;p.innerHTML=header('Wallet','PAYMENT CENTER')+'<div class="page-body"><section class="wallet-hero"><div><small>MAIN BALANCE</small><strong>'+money(m.wallet.cashBalance)+'</strong><span>Manual bKash / Nagad settlement</span></div><button id="walletReload">↻</button></section><div class="wallet-stats"><article><small>TOTAL DEPOSITED</small><b>'+money(m.wallet.totalDeposited)+'</b></article><article><small>TOTAL WITHDRAWN</small><b>'+money(m.wallet.totalWithdrawn)+'</b></article></div><div class="segment"><button data-mode="deposit" class="'+(state.walletMode==='deposit'?'active':'')+'">Deposit</button><button data-mode="withdraw" class="'+(state.walletMode==='withdraw'?'active':'')+'">Withdraw</button></div><div id="walletBody"><div class="loading">Loading payment methods…</div></div></div>';
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach(x=>x.onclick=()=>go(x.dataset.nav as Page));document.querySelectorAll<HTMLElement>('[data-mode]').forEach(x=>x.onclick=()=>{state.walletMode=x.dataset.mode as any;walletPage();});document.querySelector('#walletReload')?.addEventListener('click',async()=>{await refresh();walletPage();});loadWallet();
}
async function loadWallet(){
  const box=document.querySelector('#walletBody');if(!box)return;try{const kind=state.walletMode==='deposit'?'deposit':'withdrawal',mr=await api('/api/payment-methods?kind='+kind),hr=await api(state.walletMode==='deposit'?'/api/deposits':'/api/withdrawals'),methods=mr.items||[];if(state.walletMode==='deposit')depositUI(box,methods,hr.items||[]);else withdrawUI(box,methods,hr.items||[]);}catch(x:any){box.innerHTML='<div class="empty bad"><h3>Wallet unavailable</h3><p>'+e(errText(x.message))+'</p></div>';}}
function methodIcon(m:string){return m==='bkash'?'bK':'N';}
function methodsUI(items:any[],attr:string){const uniq=[...new Map(items.map((x:any)=>[x.method,x])).values()] as any[];return uniq.map((m:any,i:number)=>'<button type="button" class="method '+(i===0?'active':'')+'" '+attr+'="'+e(m.method)+'"><span class="method-icon '+e(m.method)+'">'+methodIcon(m.method)+'</span><div><b>'+e(m.label||m.method)+'</b><small>Manual verification</small></div><i>✓</i></button>').join('');}
function merchants(items:any[],method:string){const a=items.filter((x:any)=>x.method===method);return a.length?a.map((x:any)=>'<article class="merchant"><span class="method-icon '+e(x.method)+'">'+methodIcon(x.method)+'</span><div><small>'+e(x.label)+'</small><b>'+e(x.account_number)+'</b><span>Send Money</span></div><button type="button" data-copy="'+e(x.account_number)+'">COPY</button></article>').join(''):'<div class="inline-empty">No enabled merchant number.</div>';}
function history(items:any[],dep:boolean){return '<div class="history-title"><span>RECENT</span><h3>'+(dep?'Deposit':'Withdrawal')+' history</h3></div><div class="history">'+(items.slice(0,8).map((x:any)=>'<article><span class="method-icon small '+e(x.method)+'">'+methodIcon(x.method)+'</span><div><b>'+money(x.amount)+'</b><small>'+(dep?'TxID '+e(x.transaction_id||'—'):'Account '+e(String(x.account_number||'—')) )+'</small></div><em class="'+e(x.status)+'">'+e(String(x.status).toUpperCase())+'</em></article>').join('')||'<div class="inline-empty">No recent activity.</div>')+'</div>';}
function depositUI(box:Element,items:any[],hist:any[]){
  const uniq=[...new Map(items.map((x:any)=>[x.method,x])).values()] as any[],first=uniq[0]?.method||'';
  box.innerHTML='<div class="section-title"><span>DEPOSIT</span><h3>Choose payment method</h3><p>Send Money to an enabled number, then submit TxID.</p></div><div class="methods">'+methodsUI(items,'data-dep-method')+'</div><form id="depositForm" class="payment-form"><input id="depMethod" name="method" type="hidden" value="'+e(first)+'"><div id="merchantList">'+merchants(items,first)+'</div><div class="two"><div class="field"><label>Amount</label><input name="amount" type="number" min="'+state.cfg!.minDeposit+'" max="'+state.cfg!.maxDeposit+'" required></div><div class="field"><label>Transaction ID</label><input name="transactionId" required></div></div><button class="btn primary xl full" '+(!uniq.length?'disabled':'')+'>SUBMIT DEPOSIT →</button></form>'+history(hist,true);
  box.querySelectorAll<HTMLElement>('[data-dep-method]').forEach(x=>x.onclick=()=>{box.querySelectorAll('[data-dep-method]').forEach(z=>z.classList.remove('active'));x.classList.add('active');(box.querySelector('#depMethod') as HTMLInputElement).value=x.dataset.depMethod!;(box.querySelector('#merchantList') as HTMLElement).innerHTML=merchants(items,x.dataset.depMethod!);bindCopies(box);});bindCopies(box);
  box.querySelector<HTMLFormElement>('#depositForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.submitter as HTMLButtonElement,fd=new FormData(ev.currentTarget);busy(b,true,'SUBMITTING…');try{await api('/api/deposits',{method:'POST',headers:{'idempotency-key':idem()},body:{method:fd.get('method'),amount:Number(fd.get('amount')),transactionId:fd.get('transactionId')}});toast('Deposit request submitted');await refresh();loadWallet();}catch(x:any){toast(x.message,true);busy(b,false);}});
}
function bindCopies(rootEl:Element){rootEl.querySelectorAll<HTMLElement>('[data-copy]').forEach(x=>x.onclick=async()=>{try{await navigator.clipboard.writeText(x.dataset.copy||'');toast('Number copied');}catch{toast(x.dataset.copy||'');}});}
function withdrawUI(box:Element,items:any[],hist:any[]){
  const uniq=[...new Map(items.map((x:any)=>[x.method,x])).values()] as any[],first=uniq[0]?.method||'';
  box.innerHTML='<div class="section-title"><span>WITHDRAW</span><h3>Withdraw Main Balance</h3><p>Choose payout wallet and destination number.</p></div><form id="withdrawForm" class="payment-form"><div class="methods">'+methodsUI(items,'data-wd-method')+'</div><input id="wdMethod" name="method" type="hidden" value="'+e(first)+'"><div class="two"><div class="field"><label>Account number</label><input name="accountNumber" required></div><div class="field"><label>Amount</label><input name="amount" type="number" min="'+state.cfg!.minWithdraw+'" max="'+state.cfg!.maxWithdraw+'" required></div></div><div class="available"><span>Available Main Balance</span><b>'+money(state.me!.wallet.cashBalance)+'</b></div><button class="btn primary xl full" '+(!uniq.length?'disabled':'')+'>SUBMIT WITHDRAWAL →</button></form>'+history(hist,false);
  box.querySelectorAll<HTMLElement>('[data-wd-method]').forEach(x=>x.onclick=()=>{box.querySelectorAll('[data-wd-method]').forEach(z=>z.classList.remove('active'));x.classList.add('active');(box.querySelector('#wdMethod') as HTMLInputElement).value=x.dataset.wdMethod!;});
  box.querySelector<HTMLFormElement>('#withdrawForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.submitter as HTMLButtonElement,fd=new FormData(ev.currentTarget);busy(b,true,'SUBMITTING…');try{await api('/api/withdrawals',{method:'POST',headers:{'idempotency-key':idem()},body:{method:fd.get('method'),accountNumber:fd.get('accountNumber'),amount:Number(fd.get('amount')),sourceBucket:'cash'}});toast('Withdrawal request submitted');await refresh();loadWallet();}catch(x:any){toast(x.message,true);busy(b,false);}});
}

function profilePage(){
  const u=state.me!.user,w=state.me!.wallet,p=document.querySelector('#page')!;p.innerHTML=header('Profile','MEMBER CENTER')+'<div class="page-body"><section class="profile-card"><div class="profile-main">'+avatar(u,true)+'<div><span>✓ APPROVED MEMBER</span><h2>'+e(u.displayName||u.name)+'</h2><p>@'+e(u.username)+' • '+e(u.phone)+'</p></div></div><div class="profile-cash"><div><small>MAIN BALANCE</small><strong>'+money(w.cashBalance)+'</strong></div><button class="btn ghost" data-nav="wallet">OPEN WALLET</button></div></section><section class="profile-info"><article><small>EMAIL</small><b>'+e(u.email)+'</b><span>'+(u.emailVerified?'Verified':'Not verified')+'</span></article><article><small>PHONE</small><b>'+e(u.phone)+'</b><span>Unique identity</span></article><article><small>DEPOSITED</small><b>'+money(w.totalDeposited)+'</b><span>Lifetime</span></article><article><small>WITHDRAWN</small><b>'+money(w.totalWithdrawn)+'</b><span>Lifetime</span></article></section><section class="profile-section"><div class="section-title"><span>ACCOUNT</span><h3>Profile details</h3></div><form id="profileForm"><div class="two"><div class="field"><label>Display name</label><input name="displayName" value="'+e(u.displayName||'')+'"></div><div class="field"><label>Avatar URL</label><input name="avatar" value="'+e(u.avatar||'')+'"></div></div><button class="btn primary">SAVE PROFILE</button></form></section><section class="profile-section"><div class="section-title"><span>RESPONSIBLE PLAY</span><h3>Safety controls</h3><p>These controls restrict account activity.</p></div><div class="safety"><button id="cool" class="btn warning">24-HOUR COOL-OFF</button><button id="exclude" class="btn danger">SELF-EXCLUDE</button></div></section><section class="support"><b>?</b><div><span>SUPPORT</span><h3>Need help?</h3><p>'+e(state.cfg?.supportText||'Contact the authorized operator for account or payment support.')+'</p></div></section><button id="logoutProfile" class="logout-wide">LOG OUT</button></div>';
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach(x=>x.onclick=()=>go(x.dataset.nav as Page));
  document.querySelector<HTMLFormElement>('#profileForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.submitter as HTMLButtonElement,fd=new FormData(ev.currentTarget);busy(b,true,'SAVING…');try{await api('/api/profile',{method:'PATCH',body:{displayName:String(fd.get('displayName')||'').trim()||undefined,avatar:String(fd.get('avatar')||'').trim()||null}});await refresh();toast('Profile updated');profilePage();}catch(x:any){toast(x.message,true);busy(b,false);}});
  document.querySelector('#cool')?.addEventListener('click',async()=>{if(!confirm('Enable a 24-hour cool-off?'))return;try{await api('/api/responsible/cool-off',{method:'POST',body:{hours:24}});toast('Cool-off enabled');}catch(x:any){toast(x.message,true);}});
  document.querySelector('#exclude')?.addEventListener('click',async()=>{if(!confirm('Self-exclusion is restrictive. Continue?'))return;try{await api('/api/responsible/self-exclude',{method:'POST',body:{}});await logout();}catch(x:any){toast(x.message,true);}});
  document.querySelector('#logoutProfile')?.addEventListener('click',logout);
}
async function refresh(){state.me=await api('/api/me');}
async function logout(){try{await api('/api/auth/logout',{method:'POST',body:{}});}catch{}state.me=null;state.page='home';renderLanding();}

async function boot(){
  try{state.cfg=await api('/api/config');}catch{state.cfg={entryFee:5,minBet:1,maxBet:100000,turnSeconds:10,minDeposit:100,maxDeposit:50000,minWithdraw:100,maxWithdraw:50000,emailOtpRequired:true,googleAuthEnabled:false};}
  const q=new URLSearchParams(location.search);
  if(q.get('google')==='complete'){renderAuth('google');return;}
  try{state.me=await api('/api/me');renderApp();}catch{if(q.get('auth')){renderAuth('login');setTimeout(()=>{const m=document.querySelector('#authMsg');if(m){m.textContent=q.get('auth')==='pending'?'Your account is waiting for admin approval.':String(q.get('auth'));m.className='msg '+(q.get('auth')==='pending'?'good':'bad');}},0);}else renderLanding();}
}
boot();
