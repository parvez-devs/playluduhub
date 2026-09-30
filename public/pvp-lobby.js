(()=>{
'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function loadLobby(){
  if(!PLH.state.me)return;
  try{
    const r=await PLH.api('/api/pvp/open'),items=r.items||[];
    $('#lobby').innerHTML=items.length?items.map((m,i)=>`
      <article class="match-card premium-match-card">
        <div class="match-live-rail"><span></span><b>TABLE ${i+1}</b></div>
        <div class="match-main">
          <div class="avatar-dot">${esc((m.creatorUsername||'P')[0].toUpperCase())}</div>
          <div><b>@${esc(m.creatorUsername||m.playerAId)}</b><small>Waiting for opponent • secure server table</small></div>
        </div>
        <div class="match-values">
          <div><small>BET</small><strong>৳${Number(m.betAmount).toFixed(2)}</strong></div>
          <div><small>ENTRY</small><strong>৳${Number(m.entryFee).toFixed(2)}</strong></div>
        </div>
        ${m.playerAId===PLH.state.me.user.id?`<button data-open="${m.id}" class="match-action own">OPEN TABLE <b>→</b></button>`:`<button data-join="${m.id}" class="match-action join">JOIN MATCH <b>→</b></button>`}
      </article>`).join(''):`
      <div class="dashboard-empty-state"><span>♜</span><b>No open tables right now</b><small>Create a match and become the first player in the arena.</small></div>`;
    $('#lobby').querySelectorAll('[data-join]').forEach(b=>b.onclick=()=>join(b.dataset.join));
    $('#lobby').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>location.href=`/game/?matchId=${encodeURIComponent(b.dataset.open)}`);
  }catch(e){PLH.toast(e.message,true);}
}
async function join(id){const b=document.querySelector(`[data-join="${CSS.escape(id)}"]`);PLH.busy(b,true);try{await PLH.api(`/api/pvp/${id}/join`,{method:'POST',headers:{'idempotency-key':PLH.idem()},body:{}});location.href=`/game/?matchId=${encodeURIComponent(id)}`;}catch(e){PLH.toast(e.message,true);PLH.busy(b,false);}}
$('#createMatchForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter,fd=new FormData(e.target);PLH.busy(b,true);try{const r=await PLH.api('/api/pvp/create',{method:'POST',headers:{'idempotency-key':PLH.idem()},body:{entryFee:Number(fd.get('entryFee')),betAmount:Number(fd.get('betAmount'))}});location.href=`/game/?matchId=${encodeURIComponent(r.match.id)}`;}catch(x){PLH.toast(x.message,true);PLH.busy(b,false);}});
$('#refreshLobby').onclick=loadLobby;window.addEventListener('plh:me',loadLobby);setInterval(()=>{if(!document.hidden&&PLH.state.me&&PLH.state.page==='home')loadLobby();},8000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&PLH.state.me&&PLH.state.page==='home')loadLobby();});
})();
