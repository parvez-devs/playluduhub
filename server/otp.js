'use strict';
const {db}=require('./db');
const {uid}=require('./utils');

const OTP_TTL_MS=10*60*1000;
const RESEND_MS=60*1000;
const MAX_CHECKS=6;
const MAX_SENDS=5;

function err(code,status=400){return Object.assign(new Error(code),{code,status});}

function normalizePhone(input){
  let s=String(input||'').trim().replace(/[\s()-]/g,'');
  if(/^01\d{9}$/.test(s))return '+88'+s;
  if(/^8801\d{9}$/.test(s))return '+'+s;
  if(/^\+8801\d{9}$/.test(s))return s;
  if(/^\+[1-9]\d{7,14}$/.test(s))return s;
  throw err('INVALID_PHONE',400);
}
function phoneVariants(e164){
  const out=new Set([e164,e164.replace(/^\+/, '')]);
  if(/^\+8801\d{9}$/.test(e164))out.add(e164.slice(3));
  return [...out];
}
function credentials(){
  const serviceSid=process.env.TWILIO_VERIFY_SERVICE_SID||'';
  const user=process.env.TWILIO_API_KEY||process.env.TWILIO_ACCOUNT_SID||'';
  const pass=process.env.TWILIO_API_SECRET||process.env.TWILIO_AUTH_TOKEN||'';
  if(!serviceSid||!user||!pass)throw err('OTP_PROVIDER_NOT_CONFIGURED',503);
  return {serviceSid,user,pass};
}
async function twilioPost(path,params){
  const {serviceSid,user,pass}=credentials();
  const body=new URLSearchParams(params);
  let r;
  try{
    r=await fetch('https://verify.twilio.com/v2/Services/'+encodeURIComponent(serviceSid)+path,{
      method:'POST',
      headers:{authorization:'Basic '+Buffer.from(user+':'+pass).toString('base64'),'content-type':'application/x-www-form-urlencoded'},
      body,
      signal:AbortSignal.timeout(12000)
    });
  }catch{throw err('OTP_PROVIDER_UNAVAILABLE',503);}
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    if(r.status===429)throw err('OTP_RATE_LIMIT',429);
    throw err('OTP_PROVIDER_ERROR',502);
  }
  return data;
}
async function sendProvider(phone){
  if(process.env.NODE_ENV!=='production'&&process.env.OTP_DEV_CODE){
    console.log('[otp-dev] verification requested for',phone);
    return {status:'pending'};
  }
  return twilioPost('/Verifications',{To:phone,Channel:'sms'});
}
async function checkProvider(phone,code){
  if(process.env.NODE_ENV!=='production'&&process.env.OTP_DEV_CODE){
    return {status:String(code)===String(process.env.OTP_DEV_CODE)?'approved':'pending'};
  }
  return twilioPost('/VerificationCheck',{To:phone,Code:String(code)});
}
function getSession(id){
  const row=db.prepare('SELECT * FROM phone_verifications WHERE id=?').get(String(id||''));
  if(!row)throw err('OTP_SESSION_NOT_FOUND',404);
  return row;
}
async function startForUser(userId,phone){
  const t=Date.now(),id=uid('otp');
  db.prepare("UPDATE phone_verifications SET status='expired' WHERE user_id=? AND status='pending'").run(userId);
  await sendProvider(phone);
  db.prepare("INSERT INTO phone_verifications(id,user_id,phone,status,expires_at,send_count,attempt_count,last_sent_at,created_at) VALUES(?,?,?,'pending',?,1,0,?,?)")
    .run(id,userId,phone,t+OTP_TTL_MS,t,t);
  return {id,expiresAt:t+OTP_TTL_MS,resendAfter:t+RESEND_MS};
}
async function resend(id){
  const row=getSession(id),t=Date.now();
  if(row.status==='verified')throw err('PHONE_ALREADY_VERIFIED');
  if(row.send_count>=MAX_SENDS)throw err('OTP_SEND_LIMIT',429);
  if(t-Number(row.last_sent_at||0)<RESEND_MS)throw err('OTP_RESEND_TOO_SOON',429);
  const user=db.prepare('SELECT phone_verified,status FROM users WHERE id=?').get(row.user_id);
  if(!user)throw err('USER_NOT_FOUND',404);
  if(user.phone_verified)throw err('PHONE_ALREADY_VERIFIED');
  await sendProvider(row.phone);
  db.prepare("UPDATE phone_verifications SET status='pending',expires_at=?,send_count=send_count+1,last_sent_at=? WHERE id=?")
    .run(t+OTP_TTL_MS,t,row.id);
  return {id:row.id,expiresAt:t+OTP_TTL_MS,resendAfter:t+RESEND_MS};
}
async function verify(id,code){
  const row=getSession(id),t=Date.now();
  if(row.status==='verified'){
    const u=db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id);
    return {user:u,alreadyVerified:true};
  }
  if(row.status!=='pending'||Number(row.expires_at)<=t)throw err('OTP_EXPIRED',400);
  if(Number(row.attempt_count||0)>=MAX_CHECKS)throw err('OTP_ATTEMPTS_EXCEEDED',429);
  const value=String(code||'').trim();
  if(!/^\d{4,10}$/.test(value))throw err('INVALID_OTP',400);
  const result=await checkProvider(row.phone,value);
  db.prepare('UPDATE phone_verifications SET attempt_count=attempt_count+1 WHERE id=?').run(row.id);
  if(result.status!=='approved')throw err('INVALID_OTP',400);
  db.transaction(()=>{
    db.prepare("UPDATE phone_verifications SET status='verified',verified_at=? WHERE id=?").run(t,row.id);
    db.prepare('UPDATE users SET phone_verified=1,updated_at=? WHERE id=?').run(t,row.user_id);
  })();
  return {user:db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id),alreadyVerified:false};
}
module.exports={normalizePhone,phoneVariants,startForUser,resend,verify,OTP_TTL_MS,RESEND_MS};
