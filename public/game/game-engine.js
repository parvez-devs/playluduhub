'use strict';
(()=>{
  const GENERAL=[
    [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
    [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
    [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
    [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14]
  ];
  const SAFE=new Set([0,8,13,21,26,34,39,47]);
  const COLOURS=['#1295e7','#049645'];
  const NAMES=['blue','green'];
  const HOME=[
    [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]]
  ];
  const ALL_HOME={
    blue:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    red:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    green:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    yellow:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
  };
  const YARDS=[
    [[1.5,10.2],[3.5,10.2],[1.5,12.2],[3.5,12.2]],
    [[10.5,1.2],[12.5,1.2],[10.5,3.2],[12.5,3.2]]
  ];
  const START_CLASSES=new Map([
    ['6,13','start-blue'],['1,6','start-red'],['8,1','start-green'],['13,8','start-yellow']
  ]);
  const tokenEls=new Map(),lastProgress=new Map(),animationVersion=new Map();
  let boardRef=null,stateRef=null,myIdRef=null,onTokenRef=null;

  function key(x,y){return x+','+y;}
  function canMove(progress,dice){if(dice==null||progress===57)return false;if(progress===-1)return dice===6;return progress+dice<=57;}
  function coordFor(seat,progress,tokenId){
    if(progress===-1)return YARDS[seat][tokenId];
    if(progress>=0&&progress<52)return GENERAL[(progress+(seat===1?26:0))%52];
    if(progress>=52&&progress<=57)return HOME[seat][progress-52];
    return YARDS[seat][tokenId];
  }
  function buildYard(name){
    const y=document.createElement('div');y.className='yard '+name;
    const inner=document.createElement('div');inner.className='yard-inner';
    for(let i=0;i<4;i++){const h=document.createElement('span');h.className='yard-hole';inner.appendChild(h);}
    y.appendChild(inner);return y;
  }
  function buildBoard(board){
    if(board.dataset.v5Built)return;
    board.dataset.v5Built='1';
    const art=board.querySelector('#boardArt');
    art.append(buildYard('red'),buildYard('green'),buildYard('blue'),buildYard('yellow'));
    const center=document.createElement('div');center.className='home-center';
    for(const n of ['blue','red','green','yellow']){const t=document.createElement('span');t.className='tri '+n;center.appendChild(t);}
    art.appendChild(center);
    const grid=document.createElement('div');grid.className='board-grid';
    const generalIndex=new Map(GENERAL.map((c,i)=>[key(c[0],c[1]),i]));
    const homeMap=new Map();
    for(const [name,coords] of Object.entries(ALL_HOME))for(const c of coords)homeMap.set(key(c[0],c[1]),name);
    for(let y=0;y<15;y++)for(let x=0;x<15;x++){
      const cell=document.createElement('span');cell.className='board-cell';
      const k=key(x,y),gi=generalIndex.get(k),home=homeMap.get(k);
      if(gi!==undefined){cell.classList.add('track');if(SAFE.has(gi))cell.classList.add('safe');const sc=START_CLASSES.get(k);if(sc)cell.classList.add(sc);}
      if(home){cell.classList.add('home-lane','home-'+home);}
      grid.appendChild(cell);
    }
    art.appendChild(grid);
  }
  function tokenSvg(colour){
    return '<svg viewBox="0 0 6.6145832 10.395" aria-hidden="true">'+
      '<circle cx="3.2954681" cy="2.9856167" r="1.9285219" fill="'+colour+'" stroke="#000" stroke-width=".36"/>'+
      '<path fill="#c4c4c4" stroke="#000" stroke-width=".38" stroke-linecap="round" stroke-linejoin="round" d="M3.1295321 9.7939401C2.2845619 7.9256536.53665551 4.006563.34551669 3.5517238.25691473 3.3408843.24716233 3.3064799.24143802 3.1845594.2337783 3.0214167.25899442 2.8256839.31977005 2.576529.56954314 1.5525634 1.340042.72049031 2.3435691.39099851 3.0819463.14856432 3.9021053.2005165 4.6055247.5342799 5.1265566.78150289 5.611332 1.2145903 5.905353 1.6955172 6.1696785 2.1278719 6.3254638 2.6280288 6.3598214 3.154614L6.36981 3.307732 5.362197 5.568294C4.375839 7.7811692 3.7574616 9.1664313 3.4617027 9.8256991c-.0813.1812239-.1525362.3294989-.1583018.3294989-.00576 0-.084006-.1625664-.1738688-.3612579zM3.7162743 4.9228615C4.1095107 4.8293096 4.4159721 4.6598997 4.6928617 4.3830101 4.9306057 4.1452661 5.07272 3.9128522 5.1836267 3.5804128 5.3046516 3.2176431 5.3046516 2.75359 5.1836267 2.3908205 5.0722049 2.0568363 4.9295919 1.8231777 4.6936225 1.5879921 4.4598902 1.3550358 4.2018078 1.1962578 3.8988882 1.0990541 3.6743057 1.0269879 3.5970439 1.0166493 3.2875286 1.0172472c-.2500273.000483-.31492.00586-.4358082.036107-.69382.1736-1.2139033.6495791-1.4368359 1.3149885-.075602.2256569-.1009956.419225-.091394.6966715.011823.341638.093487.63435.2525236.9051298.2969749.5056371.7534792.8335569 1.3383471.9613714.121772.026612.1840274.030098.4208061.023568.1689575-.00466.3183516-.017293.381107-.032222z"/>'+
      '</svg>';
  }
  function ensureToken(layer,seat,i){
    const k=seat+':'+i;if(tokenEls.has(k))return tokenEls.get(k);
    const b=document.createElement('button');b.type='button';b.className='token';b.dataset.seat=seat;b.dataset.token=i;
    b.style.setProperty('--token-colour',COLOURS[seat]);b.innerHTML=tokenSvg(COLOURS[seat])+'<span class="token-number">'+(i+1)+'</span>';
    b.addEventListener('click',()=>{if(!b.classList.contains('playable'))return;onTokenRef?.(i);});
    layer.appendChild(b);tokenEls.set(k,b);return b;
  }
  function setPosition(el,seat,progress,i){
    const [x,y]=coordFor(seat,progress,i);
    el.style.left=((x+.5)/15*100)+'%';el.style.top=((y+.5)/15*100)+'%';
  }
  function ring(el,on){
    const old=el.querySelector('.playable-ring');
    if(!on){old?.remove();return;}
    if(old)return;
    const r=document.createElement('span');r.className='playable-ring';
    for(let i=0;i<8;i++){const d=document.createElement('i');d.style.setProperty('--i',i);r.appendChild(d);}
    el.appendChild(r);
  }
  function animateProgress(el,seat,from,to,i,k){
    const version=(animationVersion.get(k)||0)+1;animationVersion.set(k,version);
    if(to===-1&&from>=0){
      el.classList.add('captured');
      setTimeout(()=>{if(animationVersion.get(k)!==version)return;setPosition(el,seat,-1,i);el.classList.remove('captured');},170);
      return;
    }
    const seq=[];
    if(from===-1&&to===0)seq.push(0);
    else if(from>=0&&to>from&&to-from<=6)for(let p=from+1;p<=to;p++)seq.push(p);
    else {setPosition(el,seat,to,i);return;}
    let n=0;
    const step=()=>{if(animationVersion.get(k)!==version)return;if(n>=seq.length)return;setPosition(el,seat,seq[n++],i);if(n<seq.length)setTimeout(step,145);};
    step();
  }
  function draw(board,state,myId,onToken){
    boardRef=board;stateRef=state;myIdRef=myId;onTokenRef=onToken;buildBoard(board);
    const layer=board.querySelector('#tokenLayer');
    if(!state?.players){
      for(const el of tokenEls.values())el.remove();tokenEls.clear();lastProgress.clear();return;
    }
    const currentId=state.players[state.turnSeat]?.id;
    const activeMine=state.phase==='active'&&currentId===myId&&state.rolled!=null;
    state.players.forEach((p,seat)=>p.tokens.forEach((progress,i)=>{
      const k=seat+':'+i,el=ensureToken(layer,seat,i),old=lastProgress.get(k);
      el.classList.toggle('mine',p.id===myId);
      const playable=activeMine&&p.id===myId&&canMove(progress,state.rolled);
      el.classList.toggle('playable',playable);el.disabled=!playable;ring(el,playable);
      if(old===undefined)setPosition(el,seat,progress,i);else if(old!==progress)animateProgress(el,seat,old,progress,i,k);else setPosition(el,seat,progress,i);
      lastProgress.set(k,progress);
    }));
  }
  window.GameRenderer={draw,canMove,coordFor,GENERAL,HOME,NAMES,COLOURS};
})();
