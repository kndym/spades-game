import {createGame, applyBid, playCard, nextHand, legalCards, publicObservation, cardInfo} from './engine.js';

const $ = id => document.getElementById(id);
const names = ['You','West','North','East'];
let settings = {difficulty:'standard',target:500,pace:'normal'};
try { settings = {...settings,...JSON.parse(localStorage.getItem('spades-table-settings') || '{}')}; } catch {}
if (!['easy','standard','expert'].includes(settings.difficulty)) settings.difficulty = 'standard';
if (![250,500,1000].includes(Number(settings.target))) settings.target = 500;
let state, selectedBid = 3, generation = 0, thinking = false, resolving = false, visibleTrick = null, history = [];
let worker = null, requestId = 0;
const pending = new Map();
try {
  worker = new Worker(new URL('./ai-worker.js',import.meta.url),{type:'module'});
  worker.onmessage = ({data}) => {const request = pending.get(data.id); if (request) {pending.delete(data.id); clearTimeout(request.timeout); data.error ? request.reject(new Error(data.error)) : request.resolve(data);}};
  worker.onerror = () => {for (const request of pending.values()) {clearTimeout(request.timeout);request.reject(new Error('AI worker unavailable'));}pending.clear();worker?.terminate();worker=null;};
} catch {}
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
const pace = () => settings.pace === 'quick' ? 180 : 420;
function askAI(observation) {
  if (!worker) return import('./ai.js').then(({chooseAction}) => chooseAction(observation,{difficulty:'easy'}));
  return new Promise((resolve,reject) => {const id = ++requestId;const timeout = setTimeout(() => {pending.delete(id);reject(new Error('AI search timed out'));},15000);pending.set(id,{resolve,reject,timeout});worker.postMessage({id,observation,difficulty:settings.difficulty});});
}
function cardMarkup(id) {
  const c = cardInfo(id), rank = c.rank === 14 ? 'A' : c.rank === 13 ? 'K' : c.rank === 12 ? 'Q' : c.rank === 11 ? 'J' : String(c.rank);
  return `<span class="card-corner">${rank}<span>${c.symbol}</span></span><span class="card-center" aria-hidden="true">${c.symbol}</span><span class="card-bottom" aria-hidden="true">${rank}${c.symbol}</span>`;
}
function cardLabel(id) {const c=cardInfo(id);return `${c.rank===14?'Ace':c.rank===13?'King':c.rank===12?'Queen':c.rank===11?'Jack':c.rank} of ${c.suitName}`;}
function playerMarkup(player) {
  const bid = state.bids[player], tricks = state.tricks[player];
  return `<span class="avatar" aria-hidden="true">${player === 0 ? 'S' : names[player][0]}</span><div><div class="player-name">${names[player]}${player === 2 ? '<span class="player-tag">partner</span>' : ''}</div><div class="player-stats">${bid === null || bid === undefined ? 'Not bid yet' : `<strong>${bid === 0 ? 'Nil' : bid}</strong> bid <span aria-hidden="true">·</span> <strong>${tricks}</strong> taken`}</div></div>`;
}
function turnMessage() {
  if (resolving) return `${names[state.lastTrickWinner]} ${state.lastTrickWinner === 0 ? 'win' : 'wins'} the trick`;
  if (state.phase === 'bidding') return state.currentPlayer === 0 ? 'Read your hand. Choose your bid.' : `${names[state.currentPlayer]} is bidding`;
  if (state.phase === 'playing') return state.currentPlayer === 0 ? (state.currentTrick.length ? 'Your turn · follow suit if you can' : 'Your lead') : `${names[state.currentPlayer]} is thinking`;
  return '';
}
function render() {
  $('score-us').textContent = state.scores[0];$('score-them').textContent = state.scores[1];
  $('bags-us').textContent = `${state.bags[0]} bag${state.bags[0] === 1 ? '' : 's'}`;$('bags-them').textContent = `${state.bags[1]} bag${state.bags[1] === 1 ? '' : 's'}`;
  $('hand-number').textContent = `HAND ${state.handNumber || history.length + 1}`;$('target-label').textContent = `FIRST TO ${state.target || settings.target}`;
  for (let player=0;player<4;player++) {const element=$(`player-${player}`);element.innerHTML=playerMarkup(player);element.classList.toggle('active',state.currentPlayer===player && !resolving && ['bidding','playing'].includes(state.phase));}
  const trick = visibleTrick || state.currentTrick;
  $('trick').innerHTML = trick.map(({player,card}) => `<div class="card trick-card seat-${player} ${cardInfo(card).red ? 'red' : ''} ${resolving && player === state.lastTrickWinner ? 'winning' : ''}" aria-label="${names[player]} played ${cardLabel(card)}">${cardMarkup(card)}</div>`).join('');
  $('table-watermark').hidden=trick.length>0;
  $('message').textContent=turnMessage();$('message').classList.toggle('thinking',thinking && !resolving);
  const humanTurn = state.phase === 'playing' && state.currentPlayer === 0 && !resolving;
  const valid = humanTurn ? new Set(legalCards(state,0)) : new Set();
  const hand = [...state.hands[0]].sort((a,b) => a-b);
  $('hand').classList.toggle('playing',state.phase==='playing');
  $('hand').innerHTML = hand.map((card,index) => `<button type="button" class="card ${cardInfo(card).red ? 'red' : ''} ${valid.has(card) ? 'playable' : ''}" style="z-index:${index+1}" data-card="${card}" aria-label="${cardLabel(card)}${humanTurn && !valid.has(card) ? (state.currentTrick.length ? ', cannot play: follow suit' : ', cannot lead: spades are unbroken') : ''}" ${valid.has(card) ? '' : 'disabled'}>${cardMarkup(card)}</button>`).join('');
  $('hand-instruction').textContent = humanTurn ? 'Choose a highlighted card' : state.phase === 'bidding' ? 'Your hand · 13 cards' : state.phase === 'playing' ? `${hand.length} cards in your hand` : 'Hand complete';
  $('spades-status').textContent = state.spadesBroken ? '♠ Spades broken' : '♠ Spades unbroken';
  $('bid-panel').hidden=!(state.phase==='bidding' && state.currentPlayer===0);
  $('player-0').hidden=!$('bid-panel').hidden || ['handEnd','gameOver'].includes(state.phase);
  document.querySelector('.table').classList.toggle('human-bidding',!$('bid-panel').hidden);
  if (!$('bid-panel').hidden) {const existingBids=[2,1,3].filter(p=>state.bids[p]!==null).map(p=>`${names[p]} bid ${state.bids[p]===0?'nil':state.bids[p]}`);$('bid-hint').textContent=existingBids.length?existingBids.join(' · '):'Bid what you can win. Your partner bids separately.';}
  if (!$('bid-panel').hidden) renderBids();
  const isEnded = ['handEnd','gameOver'].includes(state.phase) && !resolving;
  $('result-panel').hidden=!isEnded;
  if (isEnded) renderResult();
  const contracts = [0,1].map(team => {const bids=[state.bids[team],state.bids[team+2]];return bids.some(b=>b===null || b===undefined) ? '—' : bids.reduce((a,b)=>a+b,0);});
  $('contract-summary').textContent = state.phase === 'bidding' ? 'Make your bid. Protect your partner.' : `Team contracts: you + North ${contracts[0]} · West + East ${contracts[1]}`;
}
function renderBids() {
  $('bid-options').innerHTML=Array.from({length:14},(_,bid)=>`<button type="button" data-bid="${bid}" class="${bid===selectedBid?'selected':''}" aria-pressed="${bid===selectedBid}">${bid===0?'Nil':bid}</button>`).join('');
  $('submit-bid').textContent=selectedBid===0?'Bid nil':`Bid ${selectedBid} trick${selectedBid===1?'':'s'}`;
}
function signed(value) {return value>0?`+${value}`:String(value);}
function renderResult() {
  const end = state.phase === 'gameOver', last = state.lastHand;
  const winner = state.winner;
  $('result-panel').innerHTML=`<span class="eyebrow">${end?'MATCH COMPLETE':'HAND COMPLETE'}</span><h2>${end ? (winner===0?'Your table. Your win.':'Another hand, another chance.') : 'The cards are counted.'}</h2><div class="result-score"><div><span>You + North</span><strong>${state.scores[0]}</strong><small>${last ? `${signed(last.delta[0])} this hand` : ''}</small></div><div><span>West + East</span><strong>${state.scores[1]}</strong><small>${last ? `${signed(last.delta[1])} this hand` : ''}</small></div></div><button class="primary" id="next-hand">${end?'Play again':'Deal the next hand'} <span aria-hidden="true">→</span></button>`;
  $('next-hand').addEventListener('click',() => {if(end) startGame();else{nextHand(state);visibleTrick=null;selectedBid=3;render();drive();}});
}
async function applyCard(card) {
  const previous = state.completedTricks.length;
  playCard(state,card);
  if(state.completedTricks.length>previous) {
    visibleTrick=state.lastTrick || state.completedTricks.at(-1).cards;resolving=true;thinking=false;render();
    const thisGeneration=generation;await wait(settings.pace==='quick'?650:1200);
    if(thisGeneration!==generation)return;
    visibleTrick=null;resolving=false;
    if(['handEnd','gameOver'].includes(state.phase)) history.push({hand:state.handNumber || history.length+1,...structuredClone(state.lastHand)});
  }
  render();
}
async function drive() {
  const thisGeneration=generation;
  if(thinking || resolving || !['bidding','playing'].includes(state.phase) || state.currentPlayer===0) return;
  thinking=true;render();
  const actingPlayer=state.currentPlayer, phase=state.phase;
  try {
    const started=performance.now();
    let response;
    try {response=await askAI(publicObservation(state,actingPlayer));}
    catch {const {chooseAction}=await import('./ai.js');response=chooseAction(publicObservation(state,actingPlayer),{difficulty:'easy'});}
    await wait(Math.max(0,pace()-(performance.now()-started)));
    if(thisGeneration!==generation)return;
    thinking=false;
    const value=response.value ?? response.action ?? response;
    if(phase==='bidding') {applyBid(state,Math.max(0,Math.min(13,Math.round(Number(value)))));render();}
    else {const valid=legalCards(state,actingPlayer);await applyCard(valid.includes(value)?value:valid[0]);}
    if(thisGeneration===generation) drive();
  } catch(error) {
    if(thisGeneration!==generation)return;
    thinking=false;$('message').textContent='This hand could not continue. Start a new game.';$('message').classList.add('toast-error');console.error(error);
  }
}
function startGame() {
  generation++;thinking=false;resolving=false;visibleTrick=null;history=[];selectedBid=3;
  const seed=globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
  state=createGame({seed,target:Number(settings.target)});$('message').classList.remove('toast-error');render();drive();
}
$('hand').addEventListener('click',async event => {const button=event.target.closest('[data-card]');if(!button || button.disabled || thinking || resolving || state.currentPlayer!==0 || state.phase!=='playing')return;const card=Number(button.dataset.card);if(!legalCards(state,0).includes(card))return;await applyCard(card);drive();});
$('bid-options').addEventListener('click',event => {const button=event.target.closest('[data-bid]');if(!button)return;selectedBid=Number(button.dataset.bid);renderBids();});
$('submit-bid').addEventListener('click',() => {if(state.phase!=='bidding' || state.currentPlayer!==0)return;applyBid(state,selectedBid);render();drive();});
for(const [button,dialog] of [['rules-button','rules-dialog'],['settings-button','settings-dialog'],['history-button','history-dialog']]) $(button).addEventListener('click',() => {if(dialog==='history-dialog')renderHistory();$(dialog).showModal();});
for(const button of document.querySelectorAll('.close-dialog')) button.addEventListener('click',() => button.closest('dialog').close());
for(const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click',event => {if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close();}});
$('new-game').addEventListener('click',() => $('restart-dialog').showModal());
$('confirm-restart').addEventListener('click',() => {$('restart-dialog').close();startGame();});
$('settings-done').addEventListener('click',() => $('settings-dialog').close());
for(const id of ['difficulty','target','pace']) {$(id).value=String(settings[id]);$(id).addEventListener('change',() => {settings[id]=id==='target'?Number($(id).value):$(id).value;try{localStorage.setItem('spades-table-settings',JSON.stringify(settings));}catch{}});}
function renderHistory() {
  $('history-content').innerHTML=history.length ? `<table class="score-table"><thead><tr><th>Hand</th><th>You + North</th><th>West + East</th></tr></thead><tbody>${history.map(h=>`<tr><td>${h.hand}</td><td>${signed(h.delta[0])} <small>(${h.scores[0]})</small></td><td>${signed(h.delta[1])} <small>(${h.scores[1]})</small></td></tr>`).join('')}</tbody></table><p>Hand points (running total). Nil and bag penalties are included.</p>` : '<p>The first hand is still on the table. Completed hands will appear here.</p>';
}
startGame();
