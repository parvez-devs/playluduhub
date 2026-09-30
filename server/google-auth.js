'use strict';
const {z}=require('zod');
const {db}=require('./db');
const wallet=require('./wallet');
const otp=require('./otp');
const {uid,randomToken,sha256,scryptHash}=require('./utils');

const STATE_TTL=10*60*1000, SIGNUP_TTL=15*60*1000;
function err(code,status=400){return Object.assign(new Error(code),{code,status});}
function enabled(){return !!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.PUBLIC_BASE_URL);}
function baseUrl(){return String(process.env.PUBLIC_BASE_URL||'').replace(/\/+$/,'');}
function redirectUri(){return baseUrl()+'/api/auth/google/callback';}
function requireConfig(){if(!enabled())throw err('GOOGLE_AUTH_NOT_CONFIGURED',503);}
function createState(){
  requireConfig();const state=randomToken(28),t=Date.now();
  db.prepare('INSERT INTO google_oauth_states(state_hash,expires_at,created_at) VALUES(?,?,?)').run(sha256(state),t+STATE_TTL,t);
  db.prepare('DELETE FROM google_oauth_states WHERE expires_at<?').run(t);
  return state;
}
function authorizationUrl(state){
  requireConfig();
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id',process.env.GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri',redirectUri());
  u.searchParams.set('response_type','code');
  u.searchParams.set('scope','openid email profile');
  u.searchParams.set('state',state);
  u.searchParams.set('prompt','select_account');
  return u.toString();
}
function consumeState(state){
  const h=sha256(state),row=db.prepare('SELECT * FROM google_oauth_states WHERE state_hash=?').get(h);
  db.prepare('DELETE FROM google_oauth_states WHERE state_hash=?').run(h);
  if(!row||row.expires_at<Date.now())throw err('GOOGLE_STATE_INVALID',400);
}
async function exchangeCode(code){
  requireConfig();
  let token;
  try{
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({
      code:String(code),client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri(),grant_type:'authorization_code'
    }),signal:AbortSignal.timeout(12000)});
    token=await r.json();if(!r.ok||!token.access_token)throw new Error('token');
  }catch{throw err('GOOGLE_AUTH_FAILED',502);}
  try{
    const r=await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(12000)});
    const p=await r.json();if(!r.ok||!p.id||!p.email||p.verified_email!==true)throw new Error('profile');
    return {sub:String(p.id),email:String(p.email).toLowerCase(),name:String(p.name||p.email.split('@')[0]).slice(0,80),avatar:p.picture?String(p.picture).slice(0,500):null};
  }catch{throw err('GOOGLE_PROFILE_FAILED',502);}
}
async function callback(state,code){
  consumeState(state);const profile=await exchangeCode(code);
  let user=db.prepare('SELECT * FROM users WHERE google_sub=? LIMIT 1').get(profile.sub);
  if(!user)user=db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE LIMIT 1').get(profile.email);
  if(user){
    const becameVerified=!user.email_verified;
    if(user.google_sub&&user.google_sub!==profile.sub)throw err('GOOGLE_ACCOUNT_CONFLICT',409);
    db.prepare('UPDATE users SET google_sub=COALESCE(google_sub,?),email_verified=1,avatar=COALESCE(avatar,?),updated_at=? WHERE id=?')
      .run(profile.sub,profile.avatar,Date.now(),user.id);
    user=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    return {kind:'existing',user,becameVerified};
  }
  const token=randomToken(32),t=Date.now();
  db.prepare('DELETE FROM google_signup_sessions WHERE expires_at<?').run(t);
  db.prepare('INSERT INTO google_signup_sessions(token_hash,google_sub,email,name,avatar,expires_at,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(sha256(token),profile.sub,profile.email,profile.name,profile.avatar,t+SIGNUP_TTL,t);
  return {kind:'new',token,profile:{email:profile.email,name:profile.name,avatar:profile.avatar}};
}
async function completeSignup(token,input){
  const x=z.object({username:z.string().trim().regex(/^[a-zA-Z0-9_]{3,24}$/),phone:z.string().trim().min(8).max(20)}).parse(input);
  const row=db.prepare('SELECT * FROM google_signup_sessions WHERE token_hash=?').get(sha256(token||''));
  if(!row||row.expires_at<Date.now())throw err('GOOGLE_SIGNUP_EXPIRED',400);
  const phone=otp.normalizePhone(x.phone),variants=otp.phoneVariants(phone);
  if(db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE LIMIT 1').get(x.username))throw err('USERNAME_TAKEN',409);
  if(db.prepare('SELECT 1 FROM users WHERE email=? COLLATE NOCASE LIMIT 1').get(row.email))throw err('EMAIL_TAKEN',409);
  if(db.prepare('SELECT 1 FROM users WHERE google_sub=? LIMIT 1').get(row.google_sub))throw err('GOOGLE_ACCOUNT_EXISTS',409);
  const ph=variants.map(()=>'?').join(',');
  if(db.prepare(`SELECT 1 FROM users WHERE phone IN (${ph}) LIMIT 1`).get(...variants))throw err('PHONE_TAKEN',409);
  const id=uid('usr'),passwordHash=await scryptHash(randomToken(40)),t=Date.now();
  db.transaction(()=>{
    db.prepare('INSERT INTO users(id,name,username,phone,email,password_hash,status,avatar,display_name,phone_verified,email_verified,google_sub,created_at,updated_at) VALUES(?,?,?,?,?,?,\'pending\',?,?,1,1,?,?,?)')
      .run(id,row.name,x.username,phone,row.email,passwordHash,row.avatar,row.name,row.google_sub,t,t);
    wallet.createWallet(id);
    db.prepare('DELETE FROM google_signup_sessions WHERE token_hash=?').run(sha256(token));
  })();
  return db.prepare('SELECT * FROM users WHERE id=?').get(id);
}
module.exports={enabled,createState,authorizationUrl,callback,completeSignup};
