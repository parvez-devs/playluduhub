'use strict';
window.PLH={
  state:{me:null,config:null,page:'home'},
  async api(path,opts={}){
    const o={...opts,headers:{...(opts.headers||{})}};
    if(o.body&&typeof o.body!=='string'){o.headers['content-type']='application/json';o.body=JSON.stringify(o.body);}
    const r=await fetch(path,o),data=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(data.error||`HTTP_${r.status}`),{data,status:r.status});
    return data;
  },
  idem:()=>crypto.randomUUID(),
  errorText(code){
    const m={
      EMAIL_NOT_VERIFIED:'Verify your email before continuing.',
      EMAIL_TAKEN:'This email is already registered.',
      PHONE_TAKEN:'This phone number is already linked to another account.',
      USERNAME_TAKEN:'This username is already taken.',
      INVALID_PHONE:'Enter a valid mobile number.',
      INVALID_OTP:'The email verification code is incorrect.',
      OTP_EXPIRED:'The verification code expired. Request a new code.',
      OTP_RESEND_TOO_SOON:'Please wait before requesting another code.',
      OTP_SEND_LIMIT:'Too many verification emails. Try again later.',
      OTP_ATTEMPTS_EXCEEDED:'Too many incorrect code attempts.',
      EMAIL_OTP_NOT_CONFIGURED:'Email verification is not configured yet.',
      EMAIL_OTP_SEND_FAILED:'Verification email could not be sent. Try again shortly.',
      GOOGLE_AUTH_NOT_CONFIGURED:'Google sign-in is not configured yet.',
      GOOGLE_AUTH_FAILED:'Google sign-in could not be completed.',
      GOOGLE_PROFILE_FAILED:'Could not read your Google profile.',
      GOOGLE_STATE_INVALID:'Google login session expired. Try again.',
      GOOGLE_SIGNUP_EXPIRED:'Google signup session expired. Start again.',
      GOOGLE_ACCOUNT_CONFLICT:'This Google account is already linked elsewhere.',
      GOOGLE_ACCOUNT_EXISTS:'This Google account already exists.',
      SELF_EXCLUDED:'This account is self-excluded.',
      COOL_OFF_ACTIVE:'Cool-off is active.',
      INSUFFICIENT_CASH:'Not enough Main Balance.',
      INSUFFICIENT_FUNDS:'Not enough balance.',
      DAILY_DEPOSIT_LIMIT:'Daily deposit limit reached.',
      DAILY_WITHDRAW_LIMIT:'Daily withdrawal limit reached.',
      DUPLICATE_TRANSACTION_ID:'This transaction ID was already used.',
      ACCOUNT_PENDING:'Account is waiting for admin approval.',
      ACCOUNT_REJECTED:'This account was rejected.',
      ACCOUNT_BANNED:'This account is unavailable.',
      RATE_LIMIT:'Too many requests. Try again shortly.',
      IDEMPOTENCY_IN_PROGRESS:'This request is already processing.',
      MATCH_NOT_JOINABLE:'This match is no longer available.',
      CANNOT_JOIN_OWN_MATCH:'You cannot join your own match.',
      PVP_DISABLED:'PvP is currently disabled.'
    };
    return m[code]||String(code||'Something went wrong').replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
  },
  busy(btn,on){if(!btn)return;btn.classList.toggle('busy',!!on);btn.disabled=!!on;},
  toast(msg,bad=false){
    const t=document.querySelector('#toast');if(!t)return;
    t.textContent=bad?this.errorText(msg):msg;t.dataset.kind=bad?'error':'ok';t.classList.remove('hidden');
    requestAnimationFrame(()=>t.classList.add('show'));clearTimeout(t._timer);
    t._timer=setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.classList.add('hidden'),220);},3000);
  }
};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],formObj=f=>Object.fromEntries(new FormData(f).entries());
const lowEnd=(Number(navigator.hardwareConcurrency||8)<=4)||(Number(navigator.deviceMemory||8)<=4);
document.documentElement.classList.toggle('lite',lowEnd);
const money=v=>`৳${Number(v||0).toFixed(2)}`;
function setText(sel,v){const e=$(sel);if(e)e.textContent=v;}
function avatar(el,u){if(!el)return;const letter=(u?.displayName||u?.name||u?.username||'P')[0].toUpperCase();if(u?.avatar)el.innerHTML=`<img src="${escapeAttr(u.avatar)}" alt="avatar">`;else el.textContent=letter;}
function escapeAttr(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtDate(v){if(!v)return'—';try{return new Intl.DateTimeFormat('bn-BD',{year:'numeric',month:'short',day:'numeric'}).format(new Date(Number(v)));}catch{return'—';}}
function openDrawer(on=true){$('#drawer')?.classList.toggle('open',on);$('#backdrop')?.classList.toggle('open',on);}
function activate(page){
  if(!['home','wallet','profile'].includes(page))page='home';PLH.state.page=page;
  $$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  $$('[data-page-target]').forEach(x=>x.classList.toggle('active',x.dataset.pageTarget===page));
  openDrawer(false);scrollTo({top:0,behavior:lowEnd?'auto':'smooth'});
}
function setAuthTab(tab){
  const signup=tab==='signup';
  $$('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===tab));
  $('#authLoginPane')?.classList.toggle('active',!signup);$('#authSignupPane')?.classList.toggle('active',signup);
  $('#authLoginPane')?.classList.toggle('hidden',signup);$('#authSignupPane')?.classList.toggle('hidden',!signup);
  $('#googleCompleteForm')?.classList.add('hidden');$('#authTabs')?.classList.remove('hidden');$('#authDivider')?.classList.remove('hidden');
  setText('#authTitle',signup?'Create your account':'Welcome back');
  setText('#authSubtitle',signup?'Verify your email, then wait for admin approval.':'Sign in to continue to your account.');
}
function showGoogleComplete(){
  $('#authLoginPane')?.classList.add('hidden');$('#authSignupPane')?.classList.add('hidden');$('#authTabs')?.classList.add('hidden');$('#authDivider')?.classList.add('hidden');$('#googleAuthBtn')?.classList.add('hidden');
  $('#googleCompleteForm')?.classList.remove('hidden');$('#googleCompleteForm')?.classList.add('active');
  setText('#authTitle','Finish Google signup');setText('#authSubtitle','Your Google email is verified. Complete your unique player identity.');
}
function authStatus(text,kind='info'){
  const e=$('#authStatus');if(!e)return;e.textContent=text;e.dataset.kind=kind;e.classList.remove('hidden');
}
function cleanAuthQuery(){
  const u=new URL(location.href);['google','auth'].forEach(k=>u.searchParams.delete(k));history.replaceState(null,'',u.pathname+(u.searchParams.size?'?'+u.searchParams.toString():'')+u.hash);
}
function showAuth(){
  $('#auth')?.classList.remove('hidden');$('#app')?.classList.add('hidden');$('#topbar')?.classList.add('hidden');$('#bottomNav')?.classList.add('hidden');
  const p=new URLSearchParams(location.search),google=p.get('google'),status=p.get('auth');
  if(google==='complete')showGoogleComplete();
  else{
    setAuthTab('login');
    if(status==='pending')authStatus('Google email verified. Your account is waiting for admin approval.','ok');
    else if(status==='rejected')authStatus('This account was rejected.','bad');
    else if(status==='banned')authStatus('This account is unavailable.','bad');
  }
}
function showApp(me){
  PLH.state.me=me;const u=me.user,w=me.wallet;
  $('#auth')?.classList.add('hidden');$('#app')?.classList.remove('hidden');$('#topbar')?.classList.remove('hidden');$('#bottomNav')?.classList.remove('hidden');
  setText('#heroName',u.displayName||u.name||u.username);setText('#drawerName',u.displayName||u.name||u.username);setText('#drawerUser','@'+u.username);
  setText('#profileName',u.displayName||u.name||u.username);setText('#profileUser','@'+u.username);setText('#profileUsernameText','@'+u.username);
  setText('#profilePhone',u.phone||'—');setText('#profileEmail',u.email||'—');setText('#profileJoined',fmtDate(u.createdAt));setText('#profileStatus',String(u.status||'approved').toUpperCase());
  const vals={cash:w.cashBalance,wins:w.winningsBalance,locked:w.lockedBalance,bonus:w.bonusBalance,topBalance:w.cashBalance,dashboardCash:w.cashBalance,walletHeroCash:w.cashBalance,totalDeposited:w.totalDeposited,totalWithdrawn:w.totalWithdrawn,profileCash:w.cashBalance,profileTotalDeposited:w.totalDeposited,profileTotalWithdrawn:w.totalWithdrawn,profileLocked:w.lockedBalance,profileBonus:w.bonusBalance};
  for(const [id,v] of Object.entries(vals))setText('#'+id,money(v));
  if($('#profileSupportText')&&PLH.state.config?.supportText)$('#profileSupportText').textContent=PLH.state.config.supportText;
  avatar($('#heroAvatar'),u);avatar($('#drawerAvatar'),u);avatar($('#profileAvatar'),u);
  const pf=$('#profileForm');if(pf){pf.elements.displayName.value=u.displayName||'';pf.elements.avatar.value=u.avatar||'';}
  activate(PLH.state.page);window.dispatchEvent(new CustomEvent('plh:me',{detail:me}));cleanAuthQuery();
}
async function boot(){
  try{
    const cfg=await PLH.api('/api/config');PLH.state.config=cfg;
    if($('#entryFee'))$('#entryFee').value=cfg.entryFee;
    if(cfg.appNotice&&$('#notice')){$('#notice').textContent=cfg.appNotice;$('#notice').classList.remove('hidden');}
    $('#googleAuthBtn')?.classList.toggle('hidden',!cfg.googleAuthEnabled);
    setText('#signupSubmit',cfg.emailOtpRequired?'CREATE ACCOUNT & SEND EMAIL OTP':'CREATE ACCOUNT');
    try{showApp(await PLH.api('/api/me'));}catch{showAuth();}
  }catch{showAuth();}
}

$$('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>setAuthTab(b.dataset.authTab)));
$('#googleAuthBtn')?.addEventListener('click',()=>{location.href='/api/auth/google/start';});
$('#loginForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const b=e.submitter;PLH.busy(b,true);
  try{await PLH.api('/api/auth/login',{method:'POST',body:formObj(e.target)});showApp(await PLH.api('/api/me'));PLH.toast('Welcome back');}
  catch(x){PLH.toast(x.message,true);}finally{PLH.busy(b,false);}
});

let otpVerificationId=sessionStorage.getItem('plh_email_verification')||'',otpResendAt=Number(sessionStorage.getItem('plh_email_resend_at')||0),otpTimer=null;
function showOtp(on=true,masked=''){
  const box=$('#otpVerifyForm');if(!box)return;box.classList.toggle('hidden',!on);
  $('#signupForm')?.classList.toggle('hidden',on);
  if(masked)setText('#otpDestination','We sent a 6-digit code to '+masked);
  if(on){setTimeout(()=>$('#otpCode')?.focus(),100);startOtpCountdown();}
}
function startOtpCountdown(){
  clearInterval(otpTimer);const label=$('#otpCountdown'),btn=$('#resendOtp');
  const tick=()=>{const left=Math.max(0,Math.ceil((otpResendAt-Date.now())/1000));if(label)label.textContent=left?('Resend available in '+left+'s'):'Didn\'t receive the code?';if(btn)btn.disabled=left>0;};
  tick();otpTimer=setInterval(tick,1000);
}
$('#signupForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const b=e.submitter;PLH.busy(b,true);
  try{
    const r=await PLH.api('/api/auth/signup',{method:'POST',body:formObj(e.target)});e.target.reset();
    if(r.verification?.id){
      otpVerificationId=r.verification.id;otpResendAt=Number(r.verification.resendAfter||Date.now()+60000);
      sessionStorage.setItem('plh_email_verification',otpVerificationId);sessionStorage.setItem('plh_email_resend_at',String(otpResendAt));sessionStorage.setItem('plh_email_mask',r.verification.maskedEmail||'your email');
      showOtp(true,r.verification.maskedEmail);PLH.toast('Verification code sent to your email');
    }else{PLH.toast('Account created. Waiting for admin approval.');setAuthTab('login');}
  }catch(x){PLH.toast(x.message,true);}finally{PLH.busy(b,false);}
});
$('#otpVerifyForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const b=e.submitter,code=String(new FormData(e.target).get('code')||'').trim();
  if(!otpVerificationId){PLH.toast('Create the account again to request a code',true);return;}
  PLH.busy(b,true);
  try{
    const r=await PLH.api('/api/auth/verify-email',{method:'POST',body:{verificationId:otpVerificationId,code}});
    sessionStorage.removeItem('plh_email_verification');sessionStorage.removeItem('plh_email_resend_at');sessionStorage.removeItem('plh_email_mask');otpVerificationId='';clearInterval(otpTimer);e.target.reset();showOtp(false);setAuthTab('login');
    authStatus('Email verified. Your account is now waiting for admin approval.','ok');PLH.toast('Email verified successfully');
  }catch(x){PLH.toast(x.message,true);}finally{PLH.busy(b,false);}
});
$('#resendOtp')?.addEventListener('click',async e=>{
  if(!otpVerificationId||Date.now()<otpResendAt)return;PLH.busy(e.currentTarget,true);
  try{
    const r=await PLH.api('/api/auth/resend-email-otp',{method:'POST',body:{verificationId:otpVerificationId}});
    otpResendAt=Number(r.verification?.resendAfter||Date.now()+60000);sessionStorage.setItem('plh_email_resend_at',String(otpResendAt));startOtpCountdown();PLH.toast('A new code was sent');
  }catch(x){PLH.toast(x.message,true);}finally{PLH.busy(e.currentTarget,false);}
});
if(otpVerificationId){setAuthTab('signup');showOtp(true,sessionStorage.getItem('plh_email_mask')||'your email');}

$('#googleCompleteForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const b=e.submitter;PLH.busy(b,true);
  try{
    const r=await PLH.api('/api/auth/google/complete',{method:'POST',body:formObj(e.target)});
    e.target.reset();cleanAuthQuery();setAuthTab('login');authStatus('Google account created. Waiting for admin approval.','ok');PLH.toast('Account created successfully');
  }catch(x){PLH.toast(x.message,true);}finally{PLH.busy(b,false);}
});

async function logout(){try{await PLH.api('/api/auth/logout',{method:'POST'});}catch{}location.reload();}
$('#logout')?.addEventListener('click',logout);$('#drawerLogout')?.addEventListener('click',logout);$('#profileLogoutShortcut')?.addEventListener('click',logout);
$('#menuBtn')?.addEventListener('click',()=>openDrawer(true));$('#menuBtnProxy')?.addEventListener('click',()=>openDrawer(true));$('#backdrop')?.addEventListener('click',()=>openDrawer(false));
$$('[data-page-target]').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.pageTarget)));
$$('[data-jump-create]').forEach(b=>b.addEventListener('click',()=>{activate('home');setTimeout(()=>$('#createCard')?.scrollIntoView({behavior:lowEnd?'auto':'smooth',block:'center'}),100);}));
$('#profileForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const f=new FormData(e.target),body={},displayName=String(f.get('displayName')||'').trim(),avatarUrl=String(f.get('avatar')||'').trim();
  if(displayName)body.displayName=displayName;if(avatarUrl)body.avatar=avatarUrl;
  try{await PLH.api('/api/profile',{method:'PATCH',body});PLH.toast('Profile updated');await refreshMe();}catch(x){PLH.toast(x.message,true);}
});
$('#selfExclude')?.addEventListener('click',async()=>{if(!confirm('Self-exclusion blocks gaming and deposit activity. Continue?'))return;try{await PLH.api('/api/responsible/self-exclude',{method:'POST'});PLH.toast('Self-exclusion enabled');await refreshMe();}catch(e){PLH.toast(e.message,true);}});
$('#coolOff')?.addEventListener('click',async()=>{if(!confirm('Enable a 24-hour cool-off?'))return;try{await PLH.api('/api/responsible/cool-off',{method:'POST',body:{hours:24}});PLH.toast('24-hour cool-off enabled');await refreshMe();}catch(e){PLH.toast(e.message,true);}});
$('#copyProfilePhone')?.addEventListener('click',async()=>{const v=PLH.state.me?.user?.phone||'';if(!v)return;try{await navigator.clipboard.writeText(v);PLH.toast('Phone number copied');}catch{PLH.toast(v);}});
['#profileRefresh','#profileBalanceRefresh','#walletRefresh'].forEach(s=>$(s)?.addEventListener('click',async()=>{try{await refreshMe();PLH.toast('Balance refreshed');}catch(e){PLH.toast(e.message,true);}}));
$$('[data-profile-jump]').forEach(b=>b.addEventListener('click',()=>{const id={account:'profileAccountCard',records:'profileRecordsCard',safety:'profileSafetyCard',support:'profileSupportCard'}[b.dataset.profileJump];document.getElementById(id)?.scrollIntoView({behavior:lowEnd?'auto':'smooth',block:'start'});}));
async function refreshMe(){showApp(await PLH.api('/api/me'));}
PLH.refreshMe=refreshMe;PLH.activate=activate;
boot();
