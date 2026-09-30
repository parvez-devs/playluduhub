'use strict';
const assert=require('assert');
const {viewerSeatFor,visualSeatFor,rotateCoordForViewer}=require('../../web/game-view');

const players=[{id:'A'},{id:'B'}];
assert.strictEqual(viewerSeatFor(players,'A'),0);
assert.strictEqual(viewerSeatFor(players,'B'),1);
assert.strictEqual(visualSeatFor(0,0),0);
assert.strictEqual(visualSeatFor(1,0),1);
assert.strictEqual(visualSeatFor(1,1),0);
assert.strictEqual(visualSeatFor(0,1),1);
assert.deepStrictEqual(rotateCoordForViewer([1.5,10.2],0),[1.5,10.2]);
assert.deepStrictEqual(rotateCoordForViewer([10.5,1.2],1),[3.5,12.8]);

console.log('game-view viewer-relative mapping passed');
