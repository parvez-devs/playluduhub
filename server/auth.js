'use strict';
const {z}=require('zod'); const {db}=require('./db'); const {uid,randomToken,sha256,hmac,timingSafeEqual,scryptHash,scryptVerify,parseCookies}=require('./utils'); const wallet=require('./wallet'); const otp=require('./otp');
const SESSION_MS=30*24*60*60*1000;
const signupSchema=z.object({name:z.string().trim().min(2).max(80),username:z.string().trim().regex(/^[a-zA-Z0-9_]{3,24}$/),phone:z.string().trim().regex(/^\+?[0-9]{8,15}$/),email:z.string().trim().email().max(160),password:z.string().min(10).max(200)});
const loginSchema=z.object({login:z.string().trim().min(3).max(160),password:z.string().min(1).max(200)});
async function signup(input){
  const x=signupSchema.parse(input),phone=otp.normalizePhone(x.phone),variants=otp.phoneVariants(phone),email=x.email.toLowerCase();
  if(db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE LIMIT 1').get(x.username))throw err('USERNAME_TAKEN');
  if(db.prepare('SELECT 1 FROM users WHERE email=? COLLATE NOCASE LIMIT 1').get(email))throw err('EMAIL_TAKEN');
  const placeholders=variants.map(()=>'?').join(',');
  if(db.prepare(`SELECT 1 FROM users WHERE phone IN (${placeholders}) LIMIT 1`).get(...variants))throw err('PHONE_TAKEN');
  const id=uid('usr'),ph=await scryptHash(x.password),t=Date.now();
  db.transaction(()=>{
    db.prepare('INSERT INTO users(id,name,username,phone,email,password_hash,display_name,phone_verified,created_at,updated_at) VALUES(?,?,?,?,?,?,?,0,?,?)').run(id,x.name,x.username,phone,email,ph,x.name,t,t);
    wallet.createWallet(id);
  })();
  try{
    const verification=await otp.startForUser(id,phone);
    return {user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)),verification};
  }catch(e){
    db.prepare('DELETE FROM users WHERE id=? AND status=\'pending\' AND phone_verified=0').run(id);
    throw e;
  }
}
async function login(input,meta={}){
  const x=loginSchema.parse(input);let u;
  try{
    const phone=otp.normalizePhone(x.login),variants=otp.phoneVariants(phone),ph=variants.map(()=>'?').join(',');
    u=db.prepare(`SELECT * FROM users WHERE phone IN (${ph}) LIMIT 1`).get(...variants);
  }catch{}
  if(!u)u=db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE LIMIT 1').get(x.login,x.login);
  const fake='scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const ok=await scryptVerify(x.password,u?.password_hash||fake);
  if(!u||!ok)throw err('INVALID_CREDENTIALS');
  if(!u.phone_verified)throw err('PHONE_NOT_VERIFIED');
  if(u.status!=='approved')throw err(`ACCOUNT_${u.status.toUpperCase()}`);
  return {user:publicUser(u),token:createSession(u.id,meta)};
}
function createSession(userId,{ip='',userAgent=''}={}){const id=uid('ses'), secret=randomToken(32), base=`${id}.${secret}`, sig=hmac(requireSecret(),base), token=`${base}.${sig}`, t=Date.now(); db.transaction(()=>{db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId); db.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at,ip_hash,user_agent_hash) VALUES(?,?,?,?,?,?,?,?)').run(id,userId,sha256(token),t+SESSION_MS,t,t,ip?sha256(ip):null,userAgent?sha256(userAgent):null);})(); return token;}
function verifyToken(token){try{const [id,secret,sig]=String(token||'').split('.'); if(!id||!secret||!sig||!timingSafeEqual(hmac(requireSecret(),`${id}.${secret}`),sig))return null; const s=db.prepare('SELECT s.*,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.token_hash=?').get(id,sha256(token)); const now=Date.now(); if(!s||s.expires_at<=now||s.status!=='approved')return null; if(now-Number(s.last_seen_at||0)>=60000)db.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?').run(now,id); return s;}catch{return null;}}
function fromRequest(req){const auth=String(req.headers.authorization||''); const bearer=auth.startsWith('Bearer ')?auth.slice(7):null; const token=bearer||parseCookies(req.headers.cookie||'').plh_session; const s=verifyToken(token); if(!s)return null; const u=db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id); return {session:s,user:u,token};}
function logout(token){if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token));}
function publicUser(u){return {id:u.id,name:u.name,username:u.username,phone:u.phone,email:u.email,status:u.status,avatar:u.avatar,displayName:u.display_name,createdAt:u.created_at,phoneVerified:!!u.phone_verified,selfExcluded:!!u.self_excluded,coolOffUntil:u.cool_off_until,dailyDepositLimit:u.daily_deposit_limit==null?null:u.daily_deposit_limit/100};}
async function verifyPhone(input){
  const x=z.object({verificationId:z.string().min(8).max(120),code:z.string().trim().regex(/^\d{4,10}$/)}).parse(input);
  const out=await otp.verify(x.verificationId,x.code);
  return {user:publicUser(out.user),alreadyVerified:out.alreadyVerified};
}
async function resendPhoneOtp(input){
  const x=z.object({verificationId:z.string().min(8).max(120)}).parse(input);
  return otp.resend(x.verificationId);
}
function requireSecret(){const s=process.env.SESSION_SECRET||'development-session-secret-change-me'; if(process.env.NODE_ENV==='production'&&s.length<32)throw new Error('SESSION_SECRET_TOO_SHORT'); return s;}
function err(code){return Object.assign(new Error(code),{code});}
module.exports={signup,verifyPhone,resendPhoneOtp,login,verifyToken,fromRequest,logout,publicUser,SESSION_MS};

