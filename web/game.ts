import './game.css';

const root=document.querySelector<HTMLDivElement>('#root');
if(!root)throw new Error('ROOT_NOT_FOUND');

root.innerHTML=`
<div id="boot" class="boot" aria-label="Loading Play Ludu Hub">
  <div class="loader-card">
    <div class="dice-loader" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
    <h1>PLAY LUDU HUB</h1>
    <p>Preparing live match…</p>
    <div class="loading-track"><span></span></div>
  </div>
</div>

<div class="game">
  <header class="game-topbar">
    <button id="exitBtn" class="exit-btn" type="button" aria-label="Exit match">‹</button>
    <div class="game-title">
      <span>PLAY LUDU HUB</span>
      <strong id="matchCode">LIVE MATCH</strong>
    </div>
    <span class="secure-badge">● LIVE</span>
  </header>

  <section class="match-strip" aria-label="Players">
    <div id="p0" class="player-pill blue">
      <span class="player-avatar" data-avatar>A</span>
      <div class="player-copy"><b>BLUE</b><small data-name>Player A</small><span data-home>0 / 4 HOME</span></div>
      <em data-strikes></em>
    </div>
    <div class="match-mid">
      <div class="connection-row">
        <span id="connection" class="connection">Connecting…</span>
        <span id="latency" class="latency">-- ms</span>
      </div>
      <strong id="stakes">SECURE PVP</strong>
      <small id="status" aria-live="polite">Loading match state…</small>
    </div>
    <div id="p1" class="player-pill green">
      <span class="player-avatar" data-avatar>B</span>
      <div class="player-copy"><b>GREEN</b><small data-name>Player B</small><span data-home>0 / 4 HOME</span></div>
      <em data-strikes></em>
    </div>
  </section>

  <main class="stage">
    <div class="board-shell">
      <div class="board-topline">
        <span id="turnBanner">WAITING FOR MATCH</span>
        <small>SERVER VERIFIED</small>
      </div>
      <div id="board" class="board" aria-label="Ludo board">
        <div id="boardArt" class="board-art" aria-hidden="true"></div>
        <div id="tokenLayer" class="token-layer"></div>
        <div id="waitingOverlay" class="waiting-overlay hidden">
          <div class="waiting-spinner"></div>
          <b>WAITING FOR OPPONENT</b>
          <span>Your stake is locked safely until the match starts.</span>
        </div>
      </div>
    </div>

    <div id="gameToast" class="game-toast hidden" aria-live="polite"></div>
    <div id="netOverlay" class="net-overlay hidden"><span></span><b>RECONNECTING</b><small>Restoring live match state…</small></div>

    <section class="control-rail" aria-label="Turn controls">
      <div id="diceStation" class="dice-container shared blue">
        <span id="turnColour" class="turn-colour">BLUE TURN</span>
        <span id="rollHint" class="roll-hint">WAITING</span>
        <button id="roll" class="dice" type="button" disabled aria-label="Roll dice">
          <div id="diceFace" class="dice-face" aria-hidden="true"></div>
        </button>
        <div class="turn-panel">
          <span id="turnDot" class="turn-dot"></span>
          <span class="turn-text">PLAYER</span>
          <strong id="turnPlayer">WAITING</strong>
          <span class="timer-chip"><b id="timer">--</b>s</span>
        </div>
      </div>
    </section>

    <div class="match-tools">
      <span id="strikeText">Timeout 0 / 2</span>
      <button id="soundToggle" class="tool sound-tool" type="button">🔊 Sound</button>
      <button id="cancelWaiting" class="tool hidden" type="button">Cancel waiting match</button>
      <button id="dispute" class="tool danger" type="button">Dispute</button>
    </div>

    <details class="events">
      <summary>Match chat & events</summary>
      <div id="log" class="log"></div>
      <form id="chat" class="chat-form">
        <input name="text" maxlength="250" placeholder="Message opponent">
        <button type="submit">SEND</button>
      </form>
    </details>
  </main>
</div>

<div id="resultOverlay" class="result-overlay hidden">
  <div class="result-card">
    <div class="result-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <span>PLAY LUDU HUB</span>
    <h2 id="resultTitle">MATCH FINISHED</h2>
    <p id="resultText"></p>
    <button id="resultBack" type="button">BACK TO ARENA</button>
  </div>
</div>`;

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
    await loadScript('/game/game-engine.js?v=ts-v2');
    await loadScript('/game/pvp-client.js?v=ts-v2');
  }catch(err){
    console.error(err);
    const boot=document.querySelector('#boot');
    if(boot)boot.innerHTML='<div class="loader-card error-card"><h1>Unable to start match</h1><p>Refresh the page or return to the arena.</p><button onclick="location.href=\'/\'">BACK TO ARENA</button></div>';
  }
})();