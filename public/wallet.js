(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const money=v=>`৳${Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const formObj=f=>Object.fromEntries(new FormData(f).entries());
let depositMethods=[],withdrawMethods=[],walletMode='deposit',loading=false;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function brandName(m){return m==='bkash'?'bKash':m==='nagad'?'Nagad':String(m||'Wallet');}
function brandMark(m){return m==='bkash'?'bK':m==='nagad'?'N':'৳';}
function uniqueMethods(items){
  const out=[];for(const x of items||[]){if(['bkash','nagad'].includes(x.method)&&!out.some(y=>y.method===x.method))out.push(x);}
  return out;
}
function setWalletMode(mode){
  walletMode=mode==='withdraw'?'withdraw':'deposit';
  $$('[data-wallet-mode]').forEach(b=>b.classList.toggle('active',b.dataset.walletMode===walletMode));
  $$('[data-wallet-panel]').forEach(p=>p.classList.toggle('active',p.dataset.walletPanel===walletMode));
  const title=$('#walletPageTitle');if(title)title.textContent=walletMode==='deposit'?'জমা দিন':'উত্তোলন';
  if(walletMode==='deposit')renderDepositNumbers();
  else updateWithdrawPreview();
}
function setFormAvailable(form,available){
  if(!form)return;
  [...form.elements].forEach(el=>{if(el.matches('[name="sourceBucket"],[name="accountNumber"],[name="amount"],[name="transactionId"],button[type="submit"]'))el.disabled=!available;});
  form.classList.toggle('payment-disabled',!available);
}
function renderMethodOptions(items,sel){
  const node=$(sel);if(!node)return;
  const unique=uniqueMethods(items),prev=node.value;
  node.innerHTML=unique.map(x=>`<option value="${esc(x.method)}">${esc(x.label||brandName(x.method))}</option>`).join('');
  if(unique.some(x=>x.method===prev))node.value=prev;
}
function renderMethodCards(items,boxSel,selectSel,kind){
  const box=$(boxSel),select=$(selectSel);if(!box||!select)return;
  const unique=uniqueMethods(items);
  if(!unique.length){
    box.innerHTML=`<div class="payment-empty-state"><span>!</span><div><b>কোনো ${kind==='deposit'?'deposit':'withdrawal'} method চালু নেই</b><small>Admin Hub → Payment Methods থেকে method Enable করলে এখানে দেখাবে।</small></div></div>`;
    setFormAvailable(kind==='deposit'?$('#depositForm'):$('#withdrawForm'),false);
    if(kind==='deposit')renderDepositNumbers();
    return;
  }
  setFormAvailable(kind==='deposit'?$('#depositForm'):$('#withdrawForm'),true);
  if(!unique.some(x=>x.method===select.value))select.value=unique[0].method;
  box.innerHTML=unique.map(x=>`
    <button type="button" class="payment-method-card ${x.method===select.value?'selected':''}" data-pay-method="${esc(x.method)}" data-pay-kind="${kind}">
      <span class="method-logo ${esc(x.method)}">${esc(brandMark(x.method))}</span>
      <span class="method-card-copy"><b>${esc(brandName(x.method))}</b><small>${kind==='deposit'?'Send Money':'Payout Wallet'}</small></span>
      <i>✓</i>
    </button>`).join('');
  box.querySelectorAll('[data-pay-method]').forEach(btn=>btn.addEventListener('click',()=>{
    select.value=btn.dataset.payMethod;
    box.querySelectorAll('.payment-method-card').forEach(x=>x.classList.toggle('selected',x===btn));
    if(kind==='deposit')renderDepositNumbers();else updateWithdrawPreview();
  }));
}
function renderDepositNumbers(){
  const box=$('#depositNumbers');if(!box)return;
  const method=$('#depositMethod')?.value;
  const list=depositMethods.filter(x=>!method||x.method===method);
  if(!list.length){
    box.innerHTML='<div class="merchant-empty"><span>◇</span><div><b>Merchant number এখনো available নয়</b><small>Admin Hub-এ Deposit method হিসেবে number add ও Enable করলে এখানে automatically দেখা যাবে।</small></div></div>';
    return;
  }
  box.innerHTML=list.map((x,i)=>`
    <article class="merchant-card ${esc(x.method)}">
      <div class="merchant-logo ${esc(x.method)}">${esc(brandMark(x.method))}</div>
      <div class="merchant-info">
        <small>${esc(x.label||brandName(x.method))}</small>
        <b>${esc(x.account_number)}</b>
        <span>Send Money • Merchant ${i+1}</span>
      </div>
      <button type="button" class="copybtn" data-copy="${esc(x.account_number)}"><span>▣</span> কপি</button>
    </article>`).join('');
  box.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(b.dataset.copy);PLH.toast('Merchant number copied');}
    catch{PLH.toast(b.dataset.copy);}
  }));
}
function maskAccount(v){
  const s=String(v||'').replace(/\D/g,'');if(!s)return'01•••••••••';if(s.length<=5)return s;
  return s.slice(0,3)+'•••••'+s.slice(-3);
}
function updateWithdrawPreview(){
  const method=$('#withdrawMethod')?.value||'nagad';
  const mark=$('#withdrawBrandMark');if(mark){mark.textContent=brandMark(method);mark.className='preview-brand-mark '+method;}
  if($('#withdrawBrandName'))$('#withdrawBrandName').textContent=brandName(method);
  if($('#withdrawMasked'))$('#withdrawMasked').textContent=maskAccount($('#withdrawAccount')?.value);
}
function renderHistory(sel,items,isDeposit){
  const box=$(sel);if(!box)return;
  box.innerHTML=(items||[]).slice(0,8).map(x=>`
    <div class="premium-request-row">
      <div class="history-icon ${esc(x.method)}">${esc(brandMark(x.method))}</div>
      <div class="history-copy">
        <b>${esc(brandName(x.method))} <span>•</span> ${money(x.amount)}</b>
        <small>${isDeposit?'TxID: '+esc(x.transaction_id):'Account: '+esc(maskAccount(x.account_number))}</small>
      </div>
      <span class="pill-status ${esc(x.status)}">${esc(String(x.status).toUpperCase())}</span>
    </div>`).join('')||'<div class="premium-empty"><span>▤</span><b>এখনও কোনো রেকর্ড নেই</b><small>আপনার সাম্প্রতিক লেনদেন এখানে দেখাবে।</small></div>';
}
async function loadWalletData(showToast=false){
  if(loading)return;loading=true;
  try{
    const [methods,wMethods,deps,wds]=await Promise.all([
      PLH.api('/api/payment-methods?kind=deposit'),
      PLH.api('/api/payment-methods?kind=withdrawal'),
      PLH.api('/api/deposits'),
      PLH.api('/api/withdrawals')
    ]);
    depositMethods=methods.items||[];withdrawMethods=wMethods.items||[];
    renderMethodOptions(depositMethods,'#depositMethod');
    renderMethodOptions(withdrawMethods,'#withdrawMethod');
    renderMethodCards(depositMethods,'#depositMethodCards','#depositMethod','deposit');
    renderMethodCards(withdrawMethods,'#withdrawMethodCards','#withdrawMethod','withdraw');
    renderDepositNumbers();updateWithdrawPreview();
    renderHistory('#depositHistory',deps.items||[],true);renderHistory('#withdrawHistory',wds.items||[],false);
    if(showToast)PLH.toast('Payment methods refreshed');
  }catch(e){console.warn(e);if(showToast)PLH.toast(e.message,true);}
  finally{loading=false;}
}

window.addEventListener('plh:me',e=>{
  const w=e.detail.wallet,cfg=PLH.state.config||{};
  const vals={cash:w.cashBalance,wins:w.winningsBalance,locked:w.lockedBalance,bonus:w.bonusBalance,walletHeroCash:w.cashBalance,topBalance:w.cashBalance,totalDeposited:w.totalDeposited,totalWithdrawn:w.totalWithdrawn,withdrawAvailable:w.cashBalance};
  for(const [id,v] of Object.entries(vals)){const el=document.getElementById(id);if(el)el.textContent=money(v);}
  if($('#depositLimitText'))$('#depositLimitText').textContent=cfg.minDeposit!=null&&cfg.maxDeposit!=null?`${money(cfg.minDeposit)} – ${money(cfg.maxDeposit)}`:'';
  if($('#withdrawLimitText'))$('#withdrawLimitText').textContent=cfg.minWithdraw!=null&&cfg.maxWithdraw!=null?`${money(cfg.minWithdraw)} – ${money(cfg.maxWithdraw)}`:'';
  loadWalletData();
});

$$('[data-wallet-mode]').forEach(b=>b.addEventListener('click',()=>setWalletMode(b.dataset.walletMode)));
$$('[data-page-target="wallet"],[data-wallet-open]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>loadWalletData(),60)));
$('#walletRefresh')?.addEventListener('click',async()=>{try{await PLH.refreshMe();await loadWalletData(true);}catch(e){PLH.toast(e.message,true);}});
$('#depositMethod')?.addEventListener('change',()=>{renderMethodCards(depositMethods,'#depositMethodCards','#depositMethod','deposit');renderDepositNumbers();});
$('#withdrawMethod')?.addEventListener('change',()=>{renderMethodCards(withdrawMethods,'#withdrawMethodCards','#withdrawMethod','withdraw');updateWithdrawPreview();});
$('#withdrawAccount')?.addEventListener('input',updateWithdrawPreview);

$$('.amount-chip').forEach(b=>b.addEventListener('click',()=>{if($('#depositAmount'))$('#depositAmount').value=b.dataset.amount;$$('.amount-chip').forEach(x=>x.classList.toggle('selected',x===b));}));
$$('.withdraw-amount-chip').forEach(b=>b.addEventListener('click',()=>{if($('#withdrawAmount'))$('#withdrawAmount').value=b.dataset.amount;$$('.withdraw-amount-chip').forEach(x=>x.classList.toggle('selected',x===b));}));

$('#depositForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const b=e.submitter,x=formObj(e.target);x.amount=Number(x.amount);PLH.busy(b,true);
  try{
    await PLH.api('/api/deposits',{method:'POST',headers:{'idempotency-key':PLH.idem()},body:x});
    PLH.toast('Deposit request submitted');e.target.reset();$$('.amount-chip').forEach(x=>x.classList.remove('selected'));renderDepositNumbers();await loadWalletData();
  }catch(err){PLH.toast(err.message,true);}finally{PLH.busy(b,false);}
});
$('#withdrawForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const b=e.submitter,x=formObj(e.target);x.amount=Number(x.amount);PLH.busy(b,true);
  try{
    await PLH.api('/api/withdrawals',{method:'POST',headers:{'idempotency-key':PLH.idem()},body:x});
    PLH.toast('Withdrawal request submitted');e.target.reset();$$('.withdraw-amount-chip').forEach(x=>x.classList.remove('selected'));updateWithdrawPreview();await PLH.refreshMe();await loadWalletData();
  }catch(err){PLH.toast(err.message,true);}finally{PLH.busy(b,false);}
});
setWalletMode('deposit');
})();