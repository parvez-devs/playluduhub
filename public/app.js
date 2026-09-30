'use strict';
window.PLH={
  state:{me:null,config:null,page:'home'},
  async api(path,opts={}){const o={...opts,headers:{...(opts.headers||{})}};if(o.body&&typeof o.body!=='string'){o.headers['content-type']='application/json';o.body=JSON.stringify(o.body);}const r=await fetch(path,o);const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data.error||`HTTP_${r.status}`),{data,status:r.status});return data;},
  idem:()=>crypto.randomUUID(),
  errorText(code){const m={PHONE_NOT_VERIFIED:'Verify your phone number first.',PHONE_TAKEN:'This phone number is already registered.',USERNAME_TAKEN:'This username is already taken.',EMAIL_TAKEN:'This email is already registered.',INVALID_PHONE:'Enter a valid Bangladesh mobile number.',INVALID_OTP:'The OTP code is incorrect.',OTP_EXPIRED:'OTP expired. Request a new code.',OTP_RESEND_TOO_SOON:'Please wait before requesting another OTP.',OTP_SEND_LIMIT:'Too many OTP requests. Try again later.',OTP_ATTEMPTS_EXCEEDED:'Too many incorrect OTP attempts.',OTP_RATE_LIMIT:'Too many OTP requests. Try again later.',OTP_PROVIDER_NOT_CONFIGURED:'SMS verification is not configured yet.',OTP_PROVIDER_UNAVAILABLE:'SMS service is temporarily unavailable.',OTP_PROVIDER_ERROR:'SMS verification could not be completed.',SELF_EXCLUDED:'This account is self-excluded.',COOL_OFF_ACTIVE:'Cool-off is active.',INSUFFICIENT_CASH:'Not enough Main Balance.',INSUFFICIENT_FUNDS:'Not enough balance.',DAILY_DEPOSIT_LIMIT:'Daily deposit limit reached.',DAILY_WITHDRAW_LIMIT:'Daily withdrawal limit reached.',DUPLICATE_TRANSACTION_ID:'This transaction ID was already used.',ACCOUNT_PENDING:'Account is waiting for approval.',ACCOUNT_REJECTED:'This account was rejected.',ACCOUNT_BANNED:'This account is unavailable.',RATE_LIMIT:'Too many requests. Try again shortly.',IDEMPOTENCY_IN_PROGRESS:'This request is already processing.',MATCH_NOT_JOINABLE:'This match is no longer available.',CANNOT_JOIN_OWN_MATCH:'You cannot join your own match.',PVP_DISABLED:'PvP is currently disabled.'};return m[code]||String(code||'Something went wrong').replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());},
  busy(btn,on){if(!btn)return;btn.classList.toggle('busy',!!on);btn.disabled=!!on;},
  toast(msg,bad=false){const t=document.querySelector('#toast');t.textContent=bad?this.errorText(msg):msg;t.dataset.kind=bad?'error':'ok';t.classList.remove('hidden');requestAnimationFrame(()=>t.classList.add('show'));clearTimeout(t._timer);t._timer=setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.classList.add('hidden'),220);},3000);}
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], formObj=f=>Object.fromEntries(new FormData(f).entries());
const lowEnd=(Number(navigator.hardwareConcurrency||8)<=4)||(Number(navigator.deviceMemory||8)<=4);document.documentElement.classList.toggle('lite',lowEnd);
const money=v=>`৳${Number(v||0).toFixed(2)}`;
function avatar(el,u){if(!el)return;const letter=(u?.displayName||u?.name||u?.username||'P')[0].toUpperCase();if(u?.avatar){el.innerHTML=`<img src="${escapeAttr(u.avatar)}" alt="avatar">`;}else el.textContent=letter;}
function escapeAttr(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function openDrawer(on=true){$('#drawer').classList.toggle('open',on);$('#backdrop').classList.toggle('open',on);}
function activate(page){if(!['home','wallet','profile'].includes(page))page='home';PLH.state.page=page;$$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$$('[data-page-target]').forEach(x=>x.classList.toggle('active',x.dataset.pageTarget===page));openDrawer(false);scrollTo({top:0,behavior:lowEnd?'auto':'smooth'});}
async function boot(){try{const [cfg,me]=await Promise.all([PLH.api('/api/config'),PLH.api('/api/me')]);PLH.state.config=cfg;$('#entryFee').value=cfg.entryFee;if(cfg.appNotice){$('#notice').textContent=cfg.appNotice;$('#notice').classList.remove('hidden');}showApp(me);}catch{try{PLH.state.config=await PLH.api('/api/config');$('#entryFee').value=PLH.state.config.entryFee;}catch{}showAuth();}}
function showAuth(){$('#auth').classList.remove('hidden');$('#app').classList.add('hidden');$('#topbar').classList.add('hidden');$('#bottomNav').classList.add('hidden');}
function showApp(me){PLH.state.me=me;const u=me.user,w=me.wallet;$('#auth').classList.add('hidden');$('#app').classList.remove('hidden');$('#topbar').classList.remove('hidden');$('#bottomNav').classList.remove('hidden');$('#heroName').textContent=u.displayName||u.name||u.username;$('#drawerName').textContent=u.displayName||u.name||u.username;$('#drawerUser').textContent=`@${u.username}`;$('#profileName').textContent=u.displayName||u.name||u.username;$('#profileUser').textContent=`@${u.username}`;$('#accountInfo').innerHTML=`Status: <b>${escapeAttr(u.status)}</b> • ${escapeAttr(u.phone)}`;$('#topBalance').textContent=money(w.cashBalance);$('#walletHeroCash').textContent=money(w.cashBalance);$('#totalDeposited').textContent=money(w.totalDeposited);$('#totalWithdrawn').textContent=money(w.totalWithdrawn);avatar($('#heroAvatar'),u);avatar($('#drawerAvatar'),u);avatar($('#profileAvatar'),u);const pf=$('#profileForm');if(pf){pf.elements.displayName.value=u.displayName||'';pf.elements.avatar.value=u.avatar||'';}activate(PLH.state.page);window.dispatchEvent(new CustomEvent('plh:me',{detail:me}));}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;PLH.busy(b,true);try{await PLH.api('/api/auth/login',{method:'POST',body:formObj(e.target)});showApp(await PLH.api('/api/me'));PLH.toast('Welcome back');}catch(x){PLH.toast(x.message,true);}finally{PLH.busy(b,false);}});
let otpVerificationId=sessionStorage.getItem('plh_otp_verification')||'',otpResendAt=Number(sessionStorage.getItem('plh_otp_resend_at')||0),otpTimer=null;
function showOtp(on=true){
  const box=$('#otpVerifyForm');if(!box)return;box.classList.toggle('hidden',!on);
  if(on){setTimeout(()=>$('#otpCode')?.focus(),120);startOtpCountdown();}
}
function startOtpCountdown(){
  clearInterval(otpTimer);const label=$('#otpCountdown'),btn=$('#resendOtp');
  const tick=()=>{const left=Math.max(0,Math.ceil((otpResendAt-Date.now())/1000));if(label)label.textContent=left?('Resend available in '+left+'s'):'Didn\'t receive the code?';if(btn)btn.disabled=left>0;};
  tick();otpTimer=setInterval(tick,1000);
}
$('#signupForm').addEventListener('submit',async e=>{
  e.preventDefault();const b=e.submitter;PLH.busy(b,true);
  try{
    const r=await PLH.api('/api/auth/signup',{method:'POST',body:formObj(e.target)});
    otpVerificationId=r.verification?.id||'';otpResendAt=Number(r.verification?.resendAfter||Date.now()+60000);
    sessionStorage.setItem('plh_otp_verification',otpVerificationId);sessionStorage.setItem('plh_otp_resend_at',String(otpResendAt));
    e.target.reset();showOtp(true);PLH.toast('OTP sent to your phone');
  }catch(x){PLH.toast(x.message,true);}finally{PLH.busy(b,false);}
});
$('#otpVerifyForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const b=e.submitter,code=String(new FormData(e.target).get('code')||'').trim();
  if(!otpVerificationId){PLH.toast('Create the account again to request OTP',true);return;}
  PLH.busy(b,true);
  try{
    const r=await PLH.api('/api/auth/verify-phone',{method:'POST',body:{verificationId:otpVerificationId,code}});
    sessionStorage.removeItem('plh_otp_verification');sessionStorage.removeItem('plh_otp_resend_at');otpVerificationId='';clearInterval(otpTimer);e.target.reset();showOtp(false);
    PLH.toast(r.pendingApproval?'Phone verified. Account is pending admin approval.':'Phone verified successfully.');
  }catch(x){PLH.toast(x.message,true);}finally{PLH.busy(b,false);}
});
$('#resendOtp')?.addEventListener('click',async e=>{
  if(!otpVerificationId||Date.now()<otpResendAt)return;PLH.busy(e.currentTarget,true);
  try{const r=await PLH.api('/api/auth/resend-phone-otp',{method:'POST',body:{verificationId:otpVerificationId}});otpResendAt=Number(r.verification?.resendAfter||Date.now()+60000);sessionStorage.setItem('plh_otp_resend_at',String(otpResendAt));startOtpCountdown();PLH.toast('A new OTP was sent');}
  catch(x){PLH.toast(x.message,true);}finally{PLH.busy(e.currentTarget,false);}
});
if(otpVerificationId)showOtp(true);
async function logout(){try{await PLH.api('/api/auth/logout',{method:'POST'});}catch{}location.reload();}
$('#logout').addEventListener('click',logout);$('#drawerLogout').addEventListener('click',logout);
$('#menuBtn').addEventListener('click',()=>openDrawer(true));$('#backdrop').addEventListener('click',()=>openDrawer(false));
$$('[data-page-target]').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.pageTarget)));
$$('[data-jump-create]').forEach(b=>b.addEventListener('click',()=>{activate('home');setTimeout(()=>$('#createCard')?.scrollIntoView({behavior:lowEnd?'auto':'smooth',block:'center'}),100);}));
$('#profileForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),body={};const displayName=String(f.get('displayName')||'').trim(),avatarUrl=String(f.get('avatar')||'').trim();if(displayName)body.displayName=displayName;if(avatarUrl)body.avatar=avatarUrl;try{await PLH.api('/api/profile',{method:'PATCH',body});PLH.toast('Profile updated');await refreshMe();}catch(x){PLH.toast(x.message,true);}});
$('#selfExclude').addEventListener('click',async()=>{if(!confirm('Self-exclusion blocks gaming and deposit activity. Continue?'))return;try{await PLH.api('/api/responsible/self-exclude',{method:'POST'});PLH.toast('Self-exclusion enabled');await refreshMe();}catch(e){PLH.toast(e.message,true);}});
$('#coolOff').addEventListener('click',async()=>{if(!confirm('Enable a 24-hour cool-off?'))return;try{await PLH.api('/api/responsible/cool-off',{method:'POST',body:{hours:24}});PLH.toast('24-hour cool-off enabled');await refreshMe();}catch(e){PLH.toast(e.message,true);}});
async function refreshMe(){showApp(await PLH.api('/api/me'));}PLH.refreshMe=refreshMe;PLH.activate=activate;boot();
