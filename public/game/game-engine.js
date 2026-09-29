'use strict';
(()=>{
const TRACK=[[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]];
const SAFE=new Set([0,8,13,21,26,34,39,47]),OFF=[0,26];
const HOME=[[[7,1],[7,2],[7,3],[7,4],[7,5]],[[7,13],[7,12],[7,11],[7,10],[7,9]]];
const YARDS=[[[2,2],[4,2],[2,4],[4,4]],[[10,10],[12,10],[10,12],[12,12]]];
const COLORS=['#ff274c','#17d56b'];
let latest={canvas:null,state:null,myId:null,onToken:null,hits:[]};
function tokenPos(seat,progress,i){if(progress===-1)return YARDS[seat][i];if(progress===57)return [7+(i%2?.18:-.18),7+(i>1?.18:-.18)];if(progress>=52)return HOME[seat][progress-52]||[7,7];return TRACK[(OFF[seat]+progress)%52];}
function legal(progress,dice){if(dice==null||progress===57)return false;if(progress===-1)return dice===6;return progress+dice<=57;}
function cell(ctx,[r,c],S,color){ctx.fillStyle=color;ctx.fillRect(c*S,r*S,S,S);}
function drawBoard(ctx,S){
  ctx.fillStyle='#f9f7f4';ctx.fillRect(0,0,S*15,S*15);
  ctx.fillStyle='#ff274c';ctx.fillRect(0,0,S*6,S*6);ctx.fillStyle='#ffd22f';ctx.fillRect(S*9,0,S*6,S*6);ctx.fillStyle='#17d56b';ctx.fillRect(S*9,S*9,S*6,S*6);ctx.fillStyle='#168cff';ctx.fillRect(0,S*9,S*6,S*6);
  ctx.fillStyle='#fff';ctx.fillRect(S*.8,S*.8,S*4.4,S*4.4);ctx.fillRect(S*9.8,S*.8,S*4.4,S*4.4);ctx.fillRect(S*9.8,S*9.8,S*4.4,S*4.4);ctx.fillRect(S*.8,S*9.8,S*4.4,S*4.4);
  for(let i=0;i<TRACK.length;i++){cell(ctx,TRACK[i],S,SAFE.has(i)?'#ece8f0':'#fff');if(SAFE.has(i)){ctx.fillStyle='#645d69';ctx.font=`${S*.34}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('★',(TRACK[i][1]+.5)*S,(TRACK[i][0]+.52)*S);}}
  HOME[0].forEach(p=>cell(ctx,p,S,'#ff91a3'));HOME[1].forEach(p=>cell(ctx,p,S,'#79e8aa'));
  ctx.save();ctx.translate(7.5*S,7.5*S);const tri=[['#ff274c',[-1,-1,-1,1,0,0]],['#ffd22f',[-1,-1,1,-1,0,0]],['#17d56b',[1,-1,1,1,0,0]],['#168cff',[-1,1,1,1,0,0]]];for(const [color,a] of tri){ctx.beginPath();ctx.moveTo(a[0]*1.5*S,a[1]*1.5*S);ctx.lineTo(a[2]*1.5*S,a[3]*1.5*S);ctx.lineTo(0,0);ctx.closePath();ctx.fillStyle=color;ctx.fill();}ctx.restore();
  ctx.strokeStyle='#aaa3a0';ctx.lineWidth=1;for(let i=0;i<=15;i++){ctx.beginPath();ctx.moveTo(i*S,0);ctx.lineTo(i*S,15*S);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*S);ctx.lineTo(15*S,i*S);ctx.stroke();}
}
function drawTokens(ctx,S,state,myId){
  latest.hits=[];if(!state?.players)return;
  const now=performance.now()/350;
  state.players.forEach((p,seat)=>p.tokens.forEach((prog,i)=>{const [r,c]=tokenPos(seat,prog,i),x=(c+.5)*S,y=(r+.5)*S,rad=S*.31,isMine=p.id===myId,isLegal=isMine&&state.players[state.turnSeat]?.id===myId&&legal(prog,state.rolled);
    if(isLegal){const rr=rad*(1.42+.08*Math.sin(now));ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.lineDashOffset=-now*4;ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.stroke();ctx.restore();for(let d=0;d<4;d++){const a=now+d*Math.PI/2;ctx.beginPath();ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr,S*.045,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();}}
    ctx.save();ctx.shadowColor='#000a';ctx.shadowBlur=S*.18;ctx.shadowOffsetY=S*.09;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fillStyle=COLORS[seat];ctx.fill();ctx.shadowColor='transparent';ctx.lineWidth=isMine?3.8:2;ctx.strokeStyle='#fff';ctx.stroke();const g=ctx.createRadialGradient(x-rad*.28,y-rad*.32,1,x,y,rad);g.addColorStop(0,'#ffffffaa');g.addColorStop(.35,'#ffffff22');g.addColorStop(1,'#00000022');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rad*.76,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.fillStyle='#fff';ctx.font=`900 ${S*.28}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),x,y+.5);
    latest.hits.push({x,y,r:rad*1.5,playerId:p.id,tokenId:i,legal:isLegal});
  }));
}
function frame(){const {canvas,state,myId}=latest;if(!canvas)return;const ctx=canvas.getContext('2d'),S=canvas.width/15;ctx.clearRect(0,0,canvas.width,canvas.height);drawBoard(ctx,S);drawTokens(ctx,S,state,myId);}
function draw(canvas,state,myId,onToken){latest={...latest,canvas,state,myId,onToken};frame();if(!canvas._plhBound){canvas._plhBound=true;canvas.addEventListener('click',e=>{if(!latest.state||!latest.onToken)return;const b=canvas.getBoundingClientRect(),x=(e.clientX-b.left)*(canvas.width/b.width),y=(e.clientY-b.top)*(canvas.height/b.height);const h=latest.hits.find(h=>h.playerId===latest.myId&&h.legal&&Math.hypot(h.x-x,h.y-y)<=h.r);if(h)latest.onToken(h.tokenId);});}}
setInterval(()=>{if(latest.state?.rolled!=null)frame();},120);
window.GameRenderer={draw,redraw:frame};
})();
