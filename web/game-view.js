'use strict';

function viewerSeatFor(players,meId){
  const i=Array.isArray(players)?players.findIndex(p=>p&&p.id===meId):-1;
  return i===1?1:0;
}
function visualSeatFor(serverSeat,viewerSeat){
  return Number(serverSeat)===Number(viewerSeat)?0:1;
}
function rotateCoordForViewer(coord,viewerSeat){
  if(!Array.isArray(coord)||coord.length!==2)throw new Error('INVALID_COORD');
  return Number(viewerSeat)===1?[14-Number(coord[0]),14-Number(coord[1])]:[Number(coord[0]),Number(coord[1])];
}
module.exports={viewerSeatFor,visualSeatFor,rotateCoordForViewer};
