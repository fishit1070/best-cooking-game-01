// orders.js — Ticket / order logic for Rush Hour Ramen.
// Pure logic only: no DOM, no timers, no globals besides the ticket
// id counter managed inside this module.

import { MENU } from './recipes.js';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

/**
 * Create a small seeded pseudo-random number generator.
 *
 * @param {number} seed Any integer seed; equal seeds produce equal streams.
 * @returns {() => number} A function returning floats in [0, 1).
 */
export function createRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;

  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Ticket generation
// ---------------------------------------------------------------------------

let nextTicketId = 1;

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Recipe complexity score for a menu item: more toppings (and a higher
 * price tier) means a more complex, more "deluxe" bowl.
 */
function complexityOf(item) {
  return item.toppings.length;
}

/**
 * Weight for picking a menu item at a given rush level.
 * Simpler bowls dominate early; deluxe bowls gain weight as the rush grows.
 */
function weightOf(item, rushLevel) {
  const complexity = complexityOf(item);
  // Simple bowls start with a strong bias.
  const simplicityBias = Math.max(0.3, 7 - complexity * 1.2);
  // Deluxe bowls (4+ toppings) scale up noticeably with the rush,
  // simpler bowls only creep up slightly.
  const rushBias =
    complexity >= 4
      ? 1 + rushLevel * (complexity / 3) * 0.4
      : 1 + rushLevel * 0.05;
  return simplicityBias * rushBias;
}

/**
 * Create a new order ticket.
 *
 * @param {() => number} rng Random source returning floats in [0, 1),
 *   e.g. the function returned by createRng (or Math.random).
 * @param {number} [rushLevel] How busy the rush is (0 = quiet opening).
 *   Higher levels make deluxe bowls more likely.
 * @returns {{id: number, item: string, broth: string, noodle: string,
 *   toppings: string[], price: number, patienceMax: number,
 *   patience: number}} A fresh ticket; patience starts at patienceMax.
 */
export function makeTicket(rng, rushLevel = 0) {
  const random = typeof rng === 'function' ? rng : Math.random;
  const rush = Math.max(0, Number(rushLevel) || 0);

  // Weighted pick over the menu.
  const weights = MENU.map((item) => weightOf(item, rush));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * totalWeight;
  let picked = MENU[MENU.length - 1];
  for (let i = 0; i < MENU.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      picked = MENU[i];
      break;
    }
  }

  // Patience (seconds): scaled a bit by recipe complexity, slightly
  // randomised, and trimmed a little as the rush intensifies.
  const complexity = complexityOf(picked);
  const patienceMax = Math.max(
    25,
    round2(35 + complexity * 7 + random() * 12 - Math.min(rush * 1.5, 10)),
  );

  return {
    id: nextTicketId++,
    item: picked.name,
    broth: picked.broth,
    noodle: picked.noodle,
    toppings: [...picked.toppings],
    price: picked.price,
    patienceMax,
    patience: patienceMax,
  };
}

// ---------------------------------------------------------------------------
// Patience
// ---------------------------------------------------------------------------

/**
 * Drain a ticket's patience.
 *
 * @param {object} ticket A ticket from makeTicket.
 * @param {number} dtSeconds Elapsed seconds to drain.
 * @returns {boolean} True if the ticket has expired (patience <= 0).
 */
export function tickTicket(ticket, dtSeconds) {
  const dt = Math.max(0, Number(dtSeconds) || 0);
  ticket.patience = Math.max(0, ticket.patience - dt);
  return ticket.patience <= 0;
}

// ---------------------------------------------------------------------------
// Scoring a served bowl
// ---------------------------------------------------------------------------

/**
 * Score a served bowl against a ticket.
 *
 * Exact broth + noodle + the same topping set (order-insensitive) earns
 * the full price plus a tip scaled by the remaining patience fraction.
 * Each mistake (wrong broth, wrong noodle, each missing / extra topping)
 * cuts the payout by 25% and is listed.
 *
 * @param {object} ticket A ticket from makeTicket.
 * @param {{broth: string, noodle: string, toppings: string[]}} bowl
 *   The bowl that was actually served, by id.
 * @returns {{earned: number, tip: number, mistakes: string[],
 *   perfect: boolean}} earned is the total payout (price share + tip).
 */
export function scoreServed(ticket, bowl) {
  const mistakes = [];

  if (!bowl || bowl.broth !== ticket.broth) {
    mistakes.push('wrong broth');
  }
  if (!bowl || bowl.noodle !== ticket.noodle) {
    mistakes.push('wrong noodle');
  }

  const wanted = new Set(ticket.toppings || []);
  const served = new Set((bowl && bowl.toppings) || []);

  for (const toppingId of wanted) {
    if (!served.has(toppingId)) {
      mistakes.push(`missing topping: ${toppingId}`);
    }
  }
  for (const toppingId of served) {
    if (!wanted.has(toppingId)) {
      mistakes.push(`extra topping: ${toppingId}`);
    }
  }

  const perfect = mistakes.length === 0;

  const patienceFraction =
    ticket.patienceMax > 0
      ? Math.min(1, Math.max(0, ticket.patience / ticket.patienceMax))
      : 0;

  const tip = perfect ? round2(ticket.price * 0.4 * patienceFraction) : 0;
  const payoutFactor = Math.max(0, 1 - 0.25 * mistakes.length);
  const earned = perfect
    ? round2(ticket.price + tip)
    : round2(ticket.price * payoutFactor);

  return { earned, tip, mistakes, perfect };
}
