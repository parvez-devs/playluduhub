import './admin.css';

const root=document.querySelector<HTMLDivElement>('#root');
if(!root)throw new Error('ROOT_NOT_FOUND');

root.innerHTML=`
<section id="adminLogin" class="gate">
  <div class="gate-card">
    <div class="shield">◆</div>
    <div class="eyebrow">PRIVATE OPERATOR ROUTE</div>
    <h1>Admin Hub</h1>
    <p class="muted">Server-side PIN verification. Three failed attempts lock this browser/device identity for 30 minutes.</p>
    <form id="adminLoginForm">
      <label>Admin PIN</label>
      <div class="pin-row">
        <input type="password" name="pin" autocomplete="off" maxlength="128" placeholder="Enter private PIN" required>
        <button type="submit">UNLOCK</button>
      </div>
    </form>
    <div class="gate-status">Manual payments • Ledger • PvP • AML • Audit</div>
    <a class="back-link" href="/">← Main player site</a>
  </div>
</section>

<section id="adminApp" class="admin-app hidden">
  <header class="topbar">
    <div class="brand"><span>◆</span><div><b>PLAY LUDU HUB</b><small>ADMIN CONTROL CENTER</small></div></div>
    <div class="top-actions"><span>Secure server session</span><a href="/">Player site</a></div>
  </header>
  <main class="shell">
    <nav class="adminnav" id="nav">
      <button data-tab="dashboard">Dashboard</button>
      <button data-tab="pending">Pending</button>
      <button data-tab="users">Users</button>
      <button data-tab="matches">Live Matches</button>
      <button data-tab="payments">Payment Methods</button>
      <button data-tab="config">Config</button>
      <button data-tab="ledger">Ledger</button>
      <button data-tab="aml">AML</button>
      <button data-tab="audit">Audit</button>
      <button data-tab="recon">Reconciliation</button>
    </nav>
    <section id="view"></section>
  </main>
</section>

<div id="toast" class="toast hidden"></div>
<div id="modal" class="modal hidden"><div class="modal-card"><button id="closeModal" class="secondary">Close</button><div id="modalBody"></div></div></div>`;

function loadScript(src:string){
  return new Promise<void>((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;s.async=false;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('Failed to load '+src));
    document.body.appendChild(s);
  });
}
(async()=>{
  try{
    await loadScript('/adminhub/withdraw.js?v=ts-v2');
    await loadScript('/adminhub/admin.js?v=ts-v2');
  }catch(err){
    console.error(err);
    root.innerHTML='<section class="gate"><div class="gate-card"><div class="shield">!</div><h1>Admin UI failed to load</h1><p class="muted">Reload the page and try again.</p><a class="back-link" href="/">← Player site</a></div></section>';
  }
})();