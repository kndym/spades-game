import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,publicObservation,applyBid,cloneState} from '../../spades-web/engine.js';
import {valueBid,valueBidFeatures,valueBidOptions} from '../../spades-web/value-bid.js';
const model=JSON.parse(fs.readFileSync(new URL('../../spades-web/value-bid-model.json',import.meta.url)));
test('value bidder consumes only observer hand and public context',()=>{
  const a=createGame({seed:40004});applyBid(a,4);const b=cloneState(a),p=a.currentPlayer;
  const others=[0,1,2,3].filter(q=>q!==p);[b.hands[others[0]],b.hands[others[1]]]=[b.hands[others[1]],b.hands[others[0]]];
  const x=publicObservation(a),y=publicObservation(b);assert.deepEqual(x,y);
  assert.deepEqual(valueBidFeatures(x,4),valueBidFeatures(y,4));assert.equal(valueBid(x,model),valueBid(y,model));
});
test('experimental bidder produces legal normal bids for all positions',()=>{
  for(let seed=50000;seed<50200;seed++){
    const s=createGame({seed});while(s.phase==='bidding'){
      const o=publicObservation(s),options=valueBidOptions(o),bid=valueBid(o,model);
      assert.equal(valueBidFeatures(o,bid).length,model.featureCount);assert(options.includes(bid));assert(Number.isInteger(bid)&&bid>=1&&bid<=13);applyBid(s,bid);
    }
  }
});
