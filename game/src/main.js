// main.js — Game loop, serving flow and screenshot scenes for
// Rush Hour Ramen. Wires together recipes / orders / kitchen / render /
// hud / input into the playable game on the #game canvas.

import { toppingById, noodleById } from './recipes.js';
import { createRng, makeTicket, tickTicket, scoreServed } from './orders.js';
import { createKitchen } from './kitchen.js';
import { drawKitchen, stationRect, ticketRect } from './render.js';
import { loadArtwork } from './artwork.js';
import { drawHud, drawTitle, drawResults } from './hud.js';
import { attachInput, hitTest } from './input.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_LENGTH = 150; // seconds per day
const MAX_TICKETS = 6;
const COMBO_WINDOW = 6; // seconds
const MESSAGE_TIME = 2.2; // seconds
const FIRST_SPAWN_DELAY = 1.5; // seconds
const SPAWN_START = 6; // seconds between tickets at day start
const SPAWN_END = 2.4; // seconds between tickets at day end

const SHOT_NAMES = ['cover', 'chop', 'rush', 'results'];

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centreX(rect) {
  return rect ? rect.x + rect.w / 2 : 0;
}

function stationCentreX(name) {
  return centreX(stationRect(name));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function dayFraction() {
  return clamp01(dayTime / DAY_LENGTH);
}

function rushLabelFor(frac) {
  const phase = frac < 0.4 ? 'WARMING UP' : frac < 0.75 ? 'LUNCH RUSH' : 'LAST ORDERS';
  return `DAY 1 · ${phase}`;
}

function setMessage(text, tone) {
  message = text;
  messageTone = tone || null;
  messageTimer = MESSAGE_TIME;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let screen = 'title'; // 'title' | 'play' | 'results'
let kitchen = createKitchen();
let tickets = [];
let rng = createRng(Date.now());

let money = 0;
let served = 0;
let perfect = 0;
let lost = 0;
let combo = 0;
let bestCombo = 0;
let comboTimer = 0;

let activeTicketId = null;
let cookX = stationCentreX('plating');
let cookTargetX = cookX;
let steamPhase = 0;
let servedFlash = 0;

let message = null;
let messageTone = null;
let messageTimer = 0;

let dayTime = 0;
let spawnTimer = FIRST_SPAWN_DELAY;

// Fixed stats used only by the 'results' screenshot scene.
let shotStats = null;

// ---------------------------------------------------------------------------
// Day / ticket flow
// ---------------------------------------------------------------------------

function startDay() {
  kitchen = createKitchen();
  tickets = [];
  rng = createRng(Date.now());

  money = 0;
  served = 0;
  perfect = 0;
  lost = 0;
  combo = 0;
  bestCombo = 0;
  comboTimer = 0;

  activeTicketId = null;
  servedFlash = 0;
  message = null;
  messageTone = null;
  messageTimer = 0;

  dayTime = 0;
  spawnTimer = FIRST_SPAWN_DELAY;
  shotStats = null;

  cookTargetX = stationCentreX('plating');
  screen = 'play';
}

function spawnInterval() {
  return SPAWN_START + (SPAWN_END - SPAWN_START) * dayFraction();
}

function spawnTicket() {
  if (tickets.length >= MAX_TICKETS) return;
  const rushLevel = 1 + Math.floor(dayFraction() * 3);
  tickets.push(makeTicket(rng, rushLevel));
}

function currentStats() {
  if (shotStats) return shotStats;
  return { served, perfect, lost, earned: money, bestCombo };
}

// ---------------------------------------------------------------------------
// Serving
// ---------------------------------------------------------------------------

function serveActiveBowl() {
  if (!tickets.length) {
    setMessage('No orders waiting!', null);
    return;
  }

  const spec = kitchen.serveBowl();
  if (!spec) {
    setMessage('The bowl needs broth and noodles first!', null);
    return;
  }

  const target = tickets.find((t) => t.id === activeTicketId) || tickets[0];
  const result = scoreServed(target, spec);

  money += result.earned + result.tip;
  served += 1;

  if (result.perfect) {
    perfect += 1;
    combo += 1;
    setMessage(`PERFECT BOWL! +¥${result.tip} tip`, 'good');
  } else {
    combo = result.mistakes.length === 0 ? combo + 1 : 0;
    if (result.mistakes.length) {
      setMessage(`Hmm: ${result.mistakes[0]}`, 'bad');
    } else {
      setMessage('Served!', 'good');
    }
  }

  bestCombo = Math.max(bestCombo, combo);
  comboTimer = COMBO_WINDOW;

  tickets = tickets.filter((t) => t.id !== target.id);
  if (activeTicketId === target.id) activeTicketId = null;

  servedFlash = 1;
  cookTargetX = stationCentreX('pass');
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function onTap(x, y) {
  if (shotMode) return;

  if (screen === 'title') {
    startDay();
    return;
  }
  if (screen === 'results') {
    screen = 'title';
    return;
  }
  if (screen !== 'play') return;

  const hit = hitTest(x, y, tickets.length);
  if (!hit) return;

  if (hit.type === 'ticket') {
    const ticket = tickets[hit.index];
    if (ticket) {
      activeTicketId = ticket.id;
      cookTargetX = centreX(ticketRect(hit.index));
    }
    return;
  }

  if (hit.type === 'bin') {
    if (hit.kind === 'broth') {
      kitchen.pourBroth(hit.id);
      cookTargetX = stationCentreX('plating');
    } else if (hit.kind === 'noodle') {
      kitchen.dropNoodles(hit.id);
      cookTargetX = stationCentreX('pot');
    } else if (hit.kind === 'topping') {
      const topping = toppingById(hit.id);
      if (topping && topping.chopSeconds > 0) {
        kitchen.startChop(hit.id);
        cookTargetX = stationCentreX('board');
      } else {
        kitchen.addTopping(hit.id);
        cookTargetX = stationCentreX('plating');
      }
    }
    return;
  }

  if (hit.type === 'station') {
    if (hit.name === 'pot') {
      kitchen.takeNoodles();
      cookTargetX = stationCentreX('pot');
    } else if (hit.name === 'board') {
      cookTargetX = stationCentreX('board');
    } else if (hit.name === 'plating') {
      cookTargetX = stationCentreX('plating');
    } else if (hit.name === 'pass') {
      serveActiveBowl();
    }
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

function update(dt) {
  steamPhase += dt;

  if (shotMode) return; // frozen scene: only the steam animates

  // The cook eases toward wherever he was last sent.
  const ease = Math.min(1, dt * 8);
  cookX += (cookTargetX - cookX) * ease;

  if (servedFlash > 0) servedFlash = Math.max(0, servedFlash - dt);
  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) {
      message = null;
      messageTone = null;
      messageTimer = 0;
    }
  }

  if (screen !== 'play') return;

  dayTime += dt;
  if (dayTime >= DAY_LENGTH) {
    dayTime = DAY_LENGTH;
    screen = 'results';
    return;
  }

  // Ticket spawning.
  spawnTimer -= dt;
  while (spawnTimer <= 0) {
    if (tickets.length >= MAX_TICKETS) {
      spawnTimer = 0.5;
      break;
    }
    spawnTicket();
    spawnTimer += spawnInterval();
  }

  // Ticket patience.
  for (const ticket of [...tickets]) {
    if (tickTicket(ticket, dt)) {
      tickets = tickets.filter((t) => t.id !== ticket.id);
      if (activeTicketId === ticket.id) activeTicketId = null;
      lost += 1;
      combo = 0;
      comboTimer = 0;
      setMessage('A customer left hungry!', 'bad');
    }
  }

  kitchen.tick(dt);

  // Combo window decay.
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      comboTimer = 0;
      combo = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render() {
  const frac = dayFraction();

  drawKitchen(ctx, {
    kitchen,
    tickets,
    activeTicketId,
    cookX,
    steamPhase,
    servedFlash,
  });

  if (screen === 'play') {
    drawHud(ctx, {
      money,
      served,
      lost,
      combo,
      comboFrac: clamp01(comboTimer / COMBO_WINDOW),
      dayFrac: frac,
      rushLabel: rushLabelFor(frac),
      message,
      messageTone,
    });
  } else if (screen === 'title') {
    drawTitle(ctx);
  } else if (screen === 'results') {
    drawResults(ctx, currentStats());
  }
}

// ---------------------------------------------------------------------------
// Screenshot scenes (deterministic; gameplay frozen)
// ---------------------------------------------------------------------------

// Generate `count` tickets whose menu items are all DIFFERENT: keep
// drawing with the advancing rng until each item name is unused.
function makeDistinctTickets(rng, rushLevel, count) {
  const result = [];
  const usedItems = new Set();
  let guard = 0;
  while (result.length < count && guard < 200) {
    guard += 1;
    const ticket = makeTicket(rng, rushLevel);
    if (usedItems.has(ticket.item)) continue;
    usedItems.add(ticket.item);
    result.push(ticket);
  }
  return result;
}

// Put the chopping board mid-action: start chopping `preferredId` (or a
// fallback) and advance half its chop time so pieces + progress show.
// The extra tick also advances the pot, so callers do this last.
function startBoardMidChop(preferredId) {
  if (kitchen.board.topping) return; // already mid-chop
  const preferred = toppingById(preferredId);
  const chopId = preferred && preferred.chopSeconds > 0 ? preferredId : 'scallions';
  if (!kitchen.startChop(chopId)) return;
  const topping = toppingById(chopId);
  kitchen.tick(topping ? topping.chopSeconds / 2 : 1);
}

function setPatienceFractions(fractions) {
  tickets.forEach((ticket, i) => {
    const f = fractions[i];
    if (typeof f === 'number') ticket.patience = f * ticket.patienceMax;
  });
}

function addToppingWithPrep(ticketToppingId) {
  const topping = toppingById(ticketToppingId);
  if (topping && topping.chopSeconds > 0) kitchen.choppedReady.add(ticketToppingId);
  kitchen.addTopping(ticketToppingId);
}

function buildBowlFor(ticket, toppingIds) {
  kitchen.pourBroth(ticket.broth);
  kitchen.dropNoodles(ticket.noodle);
  kitchen.tick(99); // pot finishes
  kitchen.takeNoodles();
  for (const toppingId of toppingIds) addToppingWithPrep(toppingId);
}

function setShotDay(frac) {
  dayTime = frac * DAY_LENGTH;
}

function buildCoverScene(shotRng) {
  screen = 'play';
  tickets = makeDistinctTickets(shotRng, 2, 3);
  setPatienceFractions([0.8, 0.6, 0.4]);
  activeTicketId = tickets[0].id;

  const first = tickets[0];
  buildBowlFor(first, first.toppings.slice(0, 2));

  // Second ticket's noodles mid-boil in the pot.
  const second = tickets[1];
  kitchen.dropNoodles(second.noodle);
  const noodle = noodleById(second.noodle);
  kitchen.tick(noodle ? noodle.boilSeconds / 2 : 1);

  // Board mid-action: a choppable topping from the third ticket, half
  // chopped, so pieces and the progress bar show instead of hint text.
  // (Done last: its tick also nudges the pot, which stays mid-boil.)
  const third = tickets[2];
  const boardChopId = third
    ? third.toppings.find((id) => {
      const t = toppingById(id);
      return t && t.chopSeconds > 0;
    })
    : null;
  startBoardMidChop(boardChopId || 'scallions');

  servedFlash = 0.85;
  money = 2340;
  served = 7;
  combo = 3;
  comboTimer = 0.7 * COMBO_WINDOW;
  setShotDay(0.45);
  cookX = stationCentreX('plating');
  cookTargetX = cookX;
}

function buildChopScene(shotRng) {
  screen = 'play';
  tickets = [makeTicket(shotRng, 1), makeTicket(shotRng, 1)];
  setPatienceFractions([0.85, 0.65]);
  activeTicketId = tickets[0].id;

  const first = tickets[0];
  kitchen.pourBroth(first.broth);

  const chopId =
    first.toppings.find((id) => {
      const t = toppingById(id);
      return t && t.chopSeconds > 0;
    }) || 'scallions';
  kitchen.startChop(chopId);
  const topping = toppingById(chopId);
  kitchen.tick(topping ? topping.chopSeconds / 2 : 1);

  setShotDay(0.3);
  money = 860;
  served = 3;
  cookX = stationCentreX('board');
  cookTargetX = cookX;
}

function buildRushScene(shotRng) {
  screen = 'play';
  tickets = makeDistinctTickets(shotRng, 3, 6);
  setPatienceFractions([0.5, 0.38, 0.3, 0.18, 0.42, 0.24]);
  activeTicketId = tickets[0].id;

  combo = 7;
  comboTimer = 0.8 * COMBO_WINDOW;

  const first = tickets[0];
  buildBowlFor(first, first.toppings.slice(0, -1));

  // A finished noodle waiting in the pot.
  const anyNoodle = tickets[1] ? tickets[1].noodle : 'classic';
  kitchen.dropNoodles(anyNoodle);
  kitchen.tick(99);

  // Board mid-action too (it was empty): half-chop a choppable topping
  // from one of the waiting tickets. The pot is already done, so the
  // extra tick only advances the board.
  let rushChopId = null;
  for (const ticket of tickets) {
    rushChopId = ticket.toppings.find((id) => {
      const t = toppingById(id);
      return t && t.chopSeconds > 0;
    });
    if (rushChopId) break;
  }
  startBoardMidChop(rushChopId || 'scallions');

  servedFlash = 0.9;
  money = 6840;
  served = 19;
  setShotDay(0.78);
  message = 'RUSH HOUR!';
  messageTone = 'good';
  messageTimer = MESSAGE_TIME;
  cookX = stationCentreX('pass');
  cookTargetX = cookX;
}

function buildResultsScene() {
  screen = 'results';
  kitchen = createKitchen();
  tickets = [];
  activeTicketId = null;
  shotStats = { served: 23, perfect: 9, lost: 2, earned: 4860, bestCombo: 8 };
}

function buildShotScene(name, seed) {
  kitchen = createKitchen();
  tickets = [];
  activeTicketId = null;
  const shotRng = createRng(seed);

  if (name === 'cover') buildCoverScene(shotRng);
  else if (name === 'chop') buildChopScene(shotRng);
  else if (name === 'rush') buildRushScene(shotRng);
  else if (name === 'results') buildResultsScene();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10);
const shotParam = params.get('shot');
const shotMode = SHOT_NAMES.includes(shotParam);

if (shotMode) {
  buildShotScene(shotParam, Number.isFinite(seed) ? seed : 1);
} else {
  screen = 'title';
}

attachInput(canvas, onTap);

let lastTime = null;
let shotPainted = false;
function frame(now) {
  if (lastTime === null) lastTime = now;
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(dt);
  render();
  // Headless screenshot capture waits for this signal: the first complete
  // frame of a shot scene, rendered only after the paintings have settled
  // (so the art is actually on the canvas, or its fallback is).
  if (shotMode && !shotPainted) {
    shotPainted = true;
    window.__SHOT_READY = true;
  }
  requestAnimationFrame(frame);
}

// Preload the painted art before the first frame: the render loop starts
// only once every painting has loaded or failed (failed paintings fall
// back to the hand-drawn art per slot). A timeout keeps a wedged load
// from ever blocking the game.
const ART_WAIT_TIMEOUT_MS = 5000;
Promise.race([
  loadArtwork(),
  new Promise((resolve) => { setTimeout(resolve, ART_WAIT_TIMEOUT_MS); }),
]).then(() => {
  requestAnimationFrame(frame);
});
