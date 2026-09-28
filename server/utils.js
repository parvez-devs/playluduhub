'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const now = () => Date.now();
const uid = (prefix='id') => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
const randomToken = (bytes=32) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const hmac = (key, v) => crypto.createHmac('sha256', key).update(v).digest('hex');
const timingSafeEqual = (a,b) => {
  const aa=Buffer.from(String(a)), bb=Buffer.from(String(b));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
};
const money = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error('INVALID_AMOUNT'), {code:'INVALID_AMOUNT'});
  return Math.round(n * 100); // all DB money values are integer paisa
};
const taka = (paisa) => Number(paisa) / 100;
const parseCookies = (header='') => Object.fromEntries(header.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('='); return [decodeURIComponent(i<0?x:x.slice(0,i)), decodeURIComponent(i<0?'':x.slice(i+1))];}));
const cookie = (name, value, {maxAge, httpOnly=true, secure=true, sameSite='Strict', pathName='/'}={}) => {
  const parts=[`${encodeURIComponent(name)}=${encodeURIComponent(value)}`, `Path=${pathName}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (maxAge!=null) parts.push(`Max-Age=${Math.floor(maxAge/1000)}`);
  return parts.join('; ');
};
const readJson = (req, limit=256*1024) => new Promise((resolve,reject)=>{
  let size=0, chunks=[];
  req.on('data', c=>{ size+=c.length; if(size>limit){reject(Object.assign(new Error('BODY_TOO_LARGE'),{status:413})); req.destroy();} else chunks.push(c); });
  req.on('end', ()=>{ try{ resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{}); } catch { reject(Object.assign(new Error('INVALID_JSON'),{status:400})); } });
  req.on('error', reject);
});

const readRaw = (req, limit=256*1024) => new Promise((resolve,reject)=>{
  let size=0,chunks=[]; req.on('data',c=>{size+=c.length;if(size>limit){reject(Object.assign(new Error('BODY_TOO_LARGE'),{status:413}));req.destroy();}else chunks.push(c);}); req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error',reject);
});
const json = (res, status, body, headers={}) => {
  const data=Buffer.from(JSON.stringify(body));
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','content-length':data.length,'cache-control':'no-store',...headers}); res.end(data);
};
const clientIp = (req) => process.env.TRUST_PROXY==='1' && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : (req.socket.remoteAddress||'unknown');
const ensureDir = (p) => fs.mkdirSync(p,{recursive:true});
const safeFile = (base, requested) => { const p=path.resolve(base, requested.replace(/^\/+/,'')); const b=path.resolve(base)+path.sep; return p.startsWith(b)?p:null; };
const scryptHash = (password) => new Promise((resolve,reject)=>{ const salt=crypto.randomBytes(16); crypto.scrypt(password,salt,64,{N:16384,r:8,p:1},(e,key)=> e?reject(e):resolve(`scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`)); });
const scryptVerify = (password, encoded) => new Promise((resolve)=>{ try{const [alg,N,r,p,saltB64,keyB64]=String(encoded).split('$'); if(alg!=='scrypt') return resolve(false); const salt=Buffer.from(saltB64,'base64url'), expected=Buffer.from(keyB64,'base64url'); crypto.scrypt(password,salt,expected.length,{N:+N,r:+r,p:+p},(e,key)=>resolve(!e && key.length===expected.length && crypto.timingSafeEqual(key,expected)));}catch{return resolve(false);} });
const requireProductionSecret = (name, min=24) => { const v=process.env[name]||''; if(process.env.NODE_ENV==='production' && v.length<min) throw new Error(`${name} must be configured securely in production`); return v; };
module.exports={now,uid,randomToken,sha256,hmac,timingSafeEqual,money,taka,parseCookies,cookie,readJson,readRaw,json,clientIp,ensureDir,safeFile,scryptHash,scryptVerify,requireProductionSecret};

