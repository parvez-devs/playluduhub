'use strict';
const crypto=require('crypto');
const nodemailer=require('nodemailer');
const {db}=require('./db');
const {uid,hmac,timingSafeEqual}=require('./utils');

const OTP_TTL_MS=10*60*1000;
const RESEND_MS=60*1000;
const MAX_CHECKS=6;
const MAX_SENDS=5;
let transporter=null;

function err(code,status=400){return Object.assign(new Error(code),{code,status});}
function normalizePhone(input){
  const s=String(input||'').trim().replace(/[\s()-]/g,'');
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
function httpsMailEnabled(){return !!(process.env.EMAIL_HTTPS_ENDPOINT&&process.env.EMAIL_HTTPS_SECRET);}
function smtpMailEnabled(){return !!(process.env.EMAIL_SMTP_USER&&process.env.EMAIL_SMTP_PASS);}
function mailEnabled(){return httpsMailEnabled()||smtpMailEnabled();}
function mailer(){
  if(!mailEnabled())throw err('EMAIL_OTP_NOT_CONFIGURED',503);
  if(transporter)return transporter;
  const port=Number(process.env.EMAIL_SMTP_PORT||465);
  transporter=nodemailer.createTransport({
    host:process.env.EMAIL_SMTP_HOST||'smtp.gmail.com',
    port,
    secure:String(process.env.EMAIL_SMTP_SECURE||'1')!=='0',
    auth:{user:process.env.EMAIL_SMTP_USER,pass:process.env.EMAIL_SMTP_PASS},
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000
  });
  return transporter;
}
function secret(){const s=process.env.SESSION_SECRET||'';if(!s)throw err('SESSION_SECRET_REQUIRED',500);return s;}
function codeHash(id,code){return hmac(secret(),id+':'+String(code));}
function makeCode(){return String(crypto.randomInt(100000,1000000));}
function maskEmail(email){const [a,b]=String(email).split('@');if(!b)return email;return (a.slice(0,2)||'*')+'***@'+b;}
function messageFor(code){
  return {
    subject:'PLAY LUDU HUB verification code',
    text:'Your PLAY LUDU HUB verification code is '+code+'. It expires in 10 minutes. Do not share this code.',
    html:'<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;background:#101018;color:#fff;border-radius:18px"><div style="font-size:12px;letter-spacing:2px;color:#b8a0ff">PLAY LUDU HUB</div><h2 style="margin:8px 0 4px">Verify your email</h2><p style="color:#b8b3c0">Use this one-time code to finish creating your account.</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;padding:18px 0;color:#fff">'+code+'</div><p style="color:#8f8997;font-size:12px">This code expires in 10 minutes. Do not share it with anyone.</p></div>'
  };
}
async function sendHttps(email,code){
  const endpoint=String(process.env.EMAIL_HTTPS_ENDPOINT||'').trim(),secret=String(process.env.EMAIL_HTTPS_SECRET||'');
  if(!endpoint||!secret)throw err('EMAIL_OTP_NOT_CONFIGURED',503);
  const msg=messageFor(code);
  let r;
  try{
    r=await fetch(endpoint,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({secret,to:email,fromName:'PLAY LUDU HUB',subject:msg.subject,text:msg.text,html:msg.html}),
      signal:AbortSignal.timeout(12000)
    });
  }catch(e){console.error('email https send',e?.message||e);throw err('EMAIL_OTP_SEND_FAILED',503);}
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.ok!==true){console.error('email https provider error',r.status,data?.error||'unknown');throw err('EMAIL_OTP_SEND_FAILED',503);}
}
async function sendCode(email,code){
  if(process.env.NODE_ENV!=='production'&&process.env.EMAIL_OTP_DEV_CODE){
    console.log('[email-otp-dev]',email,process.env.EMAIL_OTP_DEV_CODE);
    return;
  }
  try{
    if(httpsMailEnabled())return await sendHttps(email,code);
    if(!smtpMailEnabled())throw err('EMAIL_OTP_NOT_CONFIGURED',503);
    const msg=messageFor(code);
    await mailer().sendMail({
      from:process.env.EMAIL_FROM||('PLAY LUDU HUB <'+process.env.EMAIL_SMTP_USER+'>'),
      to:email,subject:msg.subject,text:msg.text,html:msg.html
    });
  }catch(e){
    if(e?.code==='EMAIL_OTP_NOT_CONFIGURED')throw e;
    console.error('email otp send',e?.message||e);throw err('EMAIL_OTP_SEND_FAILED',503);
  }
}
function getSession(id){
  const row=db.prepare('SELECT * FROM email_verifications WHERE id=?').get(String(id||''));
  if(!row)throw err('OTP_SESSION_NOT_FOUND',404);
  return row;
}
async function startForUser(userId,email){
  const t=Date.now(),id=uid('eotp'),code=process.env.NODE_ENV!=='production'&&process.env.EMAIL_OTP_DEV_CODE?String(process.env.EMAIL_OTP_DEV_CODE):makeCode();
  db.prepare("UPDATE email_verifications SET status='expired' WHERE user_id=? AND status='pending'").run(userId);
  db.prepare("INSERT INTO email_verifications(id,user_id,email,code_hash,status,expires_at,send_count,attempt_count,last_sent_at,created_at) VALUES(?,?,?,?, 'pending',?,1,0,?,?)")
    .run(id,userId,email,codeHash(id,code),t+OTP_TTL_MS,t,t);
  try{await sendCode(email,code);}catch(e){db.prepare('DELETE FROM email_verifications WHERE id=?').run(id);throw e;}
  return {id,maskedEmail:maskEmail(email),expiresAt:t+OTP_TTL_MS,resendAfter:t+RESEND_MS};
}
async function resend(id){
  const row=getSession(id),t=Date.now();
  if(row.status==='verified')throw err('EMAIL_ALREADY_VERIFIED');
  if(row.send_count>=MAX_SENDS)throw err('OTP_SEND_LIMIT',429);
  if(t-Number(row.last_sent_at||0)<RESEND_MS)throw err('OTP_RESEND_TOO_SOON',429);
  const user=db.prepare('SELECT email_verified FROM users WHERE id=?').get(row.user_id);
  if(!user)throw err('USER_NOT_FOUND',404);
  if(user.email_verified)throw err('EMAIL_ALREADY_VERIFIED');
  const code=process.env.NODE_ENV!=='production'&&process.env.EMAIL_OTP_DEV_CODE?String(process.env.EMAIL_OTP_DEV_CODE):makeCode();
  await sendCode(row.email,code);
  db.prepare("UPDATE email_verifications SET status='pending',code_hash=?,expires_at=?,send_count=send_count+1,last_sent_at=? WHERE id=?")
    .run(codeHash(row.id,code),t+OTP_TTL_MS,t,row.id);
  return {id:row.id,maskedEmail:maskEmail(row.email),expiresAt:t+OTP_TTL_MS,resendAfter:t+RESEND_MS};
}
async function verify(id,code){
  const row=getSession(id),t=Date.now();
  if(row.status==='verified')return {user:db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id),alreadyVerified:true};
  if(row.status!=='pending'||Number(row.expires_at)<=t)throw err('OTP_EXPIRED');
  if(Number(row.attempt_count||0)>=MAX_CHECKS)throw err('OTP_ATTEMPTS_EXCEEDED',429);
  const value=String(code||'').trim();
  if(!/^\d{6}$/.test(value))throw err('INVALID_OTP');
  db.prepare('UPDATE email_verifications SET attempt_count=attempt_count+1 WHERE id=?').run(row.id);
  if(!timingSafeEqual(codeHash(row.id,value),row.code_hash))throw err('INVALID_OTP');
  db.transaction(()=>{
    db.prepare("UPDATE email_verifications SET status='verified',verified_at=? WHERE id=?").run(t,row.id);
    db.prepare('UPDATE users SET email_verified=1,updated_at=? WHERE id=?').run(t,row.user_id);
  })();
  return {user:db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id),alreadyVerified:false};
}
module.exports={normalizePhone,phoneVariants,mailEnabled,startForUser,resend,verify,OTP_TTL_MS,RESEND_MS};
