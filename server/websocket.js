'use strict';
const {WebSocketServer,WebSocket}=require('ws'); const auth=require('./auth'); const pvp=require('./pvp');
function attach(server){
  const wss=new WebSocketServer({noServer:true,maxPayload:32*1024}); const rooms=new Map();
  server.on('upgrade',(req,socket,head)=>{try{if(process.env.NODE_ENV==='production'){const proto=req.socket.encrypted?'https':(process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-proto']||'').split(',')[0].trim():'http');if(proto!=='https'){socket.write('HTTP/1.1 426 Upgrade Required\r\n\r\n');socket.destroy();return;}} const u=new URL(req.url,'http://localhost'); if(u.pathname!=='/ws'){socket.destroy();return;} const a=auth.fromRequest(req); if(!a){socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');socket.destroy();return;} wss.handleUpgrade(req,socket,head,ws=>{ws.userId=a.user.id; ws.joined=new Set(); wss.emit('connection',ws,req);});}catch{socket.destroy();}});
  wss.on('connection',ws=>{
    ws.isAlive=true; ws.on('pong',()=>{ws.isAlive=true;});
    send(ws,{type:'hello',userId:ws.userId}); ws.msgWindow={at:Date.now(),n:0};
    ws.on('message',buf=>{const now=Date.now(); if(now-ws.msgWindow.at>1000)ws.msgWindow={at:now,n:0}; if(++ws.msgWindow.n>20)return send(ws,{type:'error',code:'RATE_LIMIT'});let m; try{m=JSON.parse(buf.toString('utf8'));}catch{return send(ws,{type:'error',code:'BAD_JSON'});} try{handle(ws,m);}catch(e){send(ws,{type:'error',code:e.code||'SERVER_ERROR'});}});
    ws.on('close',()=>{for(const id of ws.joined){leaveRoom(ws,id); pvp.connected(id,ws.userId,false);}});
  });
  function handle(ws,m){
    if(m.type==='join_match'){const matchId=String(m.matchId||''); const mr=pvp.getMatch(matchId); if(mr.player_a_id!==ws.userId&&mr.player_b_id!==ws.userId)throw code('NOT_MATCH_PLAYER'); joinRoom(ws,matchId); pvp.connected(matchId,ws.userId,true); send(ws,{type:'state',state:mr.state_json?JSON.parse(mr.state_json):null,match:pvp.serializeMatch(mr)}); return;}
    const matchId=String(m.matchId|| (ws.joined.size===1?[...ws.joined][0]:'') ); if(!ws.joined.has(matchId))throw code('JOIN_MATCH_FIRST');
    if(m.type==='roll_dice'){pvp.roll(ws.userId,matchId,m.expectedState);return;}
    if(m.type==='move_token'){pvp.move(ws.userId,matchId,Number(m.tokenId),m.expectedState);return;}
    if(m.type==='chat'){const text=String(m.text||'').trim().slice(0,250); if(text)broadcast(matchId,{type:'chat',by:ws.userId,text,at:Date.now()});return;}
    throw code('UNKNOWN_MESSAGE');
  }
  function joinRoom(ws,id){if(!rooms.has(id))rooms.set(id,new Set()); rooms.get(id).add(ws); ws.joined.add(id);}
  function leaveRoom(ws,id){rooms.get(id)?.delete(ws); if(rooms.get(id)?.size===0)rooms.delete(id); ws.joined.delete(id);}
  function broadcast(id,msg){for(const ws of rooms.get(id)||[])send(ws,msg);}
  function send(ws,obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
  pvp.events.on('message',(id,msg)=>broadcast(id,msg));
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;try{ws.ping();}catch{ws.terminate();}}},30000);heartbeat.unref();
  server.on('close',()=>clearInterval(heartbeat));
  pvp.resumeActive();
  return wss;
}
function code(c){return Object.assign(new Error(c),{code:c});}
module.exports={attach};
