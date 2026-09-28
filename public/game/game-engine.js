'use strict';
(()=>{
const TRACK=[[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]];
const SAFE=new Set([0,8,13,21,26,34,39,47]), OFF=[0,26], HOME=[[[7,1],[7,2],[7,3],[7,4],[7,5]],[[7,13],[7,12],[7,11],[7,10],[7,9]]], COLORS=['#e74b5b','#2acb83'];
function tokenPos(seat,progress,i){if(progress===-1){const bases=[[[2,2],[4,2],[2,4],[4,4]],[[10,10],[12,10],[10,12],[12,12]]];return bases[seat][i];} if(progress===57)return [7+(i%2?0.18:-0.18),7+(i>1?0.18:-0.18)]; if(progress>=52)return HOME[seat][progress-52]||[7,7]; return TRACK[(OFF[seat]+progress)%52];}
function draw(canvas,state,myId,onToken){const ctx=canvas.getContext('2d'),S=canvas.width/15;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f7fbff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#ffd7dc';ctx.fillRect(0,0,S*6,S*6);ctx.fillStyle='#ccf6e3';ctx.fillRect(S*9,S*9,S*6,S*6);ctx.fillStyle='#e8edf4';ctx.fillRect(S*6,S*6,S*3,S*3);
  for(let i=0;i<TRACK.length;i++){cell(ctx,TRACK[i],S,SAFE.has(i)?'#d9e8ff':'#ffffff'); if(SAFE.has(i)){ctx.fillStyle='#638bb8';ctx.font=`${S*.38}px sans-serif`;ctx.fillText('★',TRACK[i][1]*S+S*.3,TRACK[i][0]*S+S*.68);}}
  HOME[0].forEach(p=>cell(ctx,p,S,'#ffb8c0'));HOME[1].forEach(p=>cell(ctx,p,S,'#a7edcf')); cell(ctx,[7,7],S,'#f3cf63');
  ctx.strokeStyle='#b8c5d3';ctx.lineWidth=1;for(let i=0;i<=15;i++){ctx.beginPath();ctx.moveTo(i*S,0);ctx.lineTo(i*S,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*S);ctx.lineTo(canvas.width,i*S);ctx.stroke();}
  const hits=[]; if(state?.players)state.players.forEach((p,seat)=>p.tokens.forEach((prog,i)=>{const [r,c]=tokenPos(seat,prog,i),x=(c+.5)*S,y=(r+.5)*S,rad=S*.31;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fillStyle=COLORS[seat];ctx.fill();ctx.lineWidth=p.id===myId?5:2;ctx.strokeStyle=p.id===myId?'#07101d':'#fff';ctx.stroke();ctx.fillStyle='#fff';ctx.font=`bold ${S*.32}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),x,y);hits.push({x,y,r:rad*1.4,playerId:p.id,tokenId:i});}));
  canvas.onclick=e=>{if(!state||!onToken)return;const b=canvas.getBoundingClientRect(),x=(e.clientX-b.left)*(canvas.width/b.width),y=(e.clientY-b.top)*(canvas.height/b.height);const h=hits.find(h=>h.playerId===myId&&Math.hypot(h.x-x,h.y-y)<=h.r);if(h)onToken(h.tokenId);};
}
function cell(ctx,[r,c],S,color){ctx.fillStyle=color;ctx.fillRect(c*S,r*S,S,S);}
window.GameRenderer={draw};
})();

