// kitchen.js — Cooking-station state machine for Rush Hour Ramen.
// Pure logic: no DOM, no canvas, no timers. Call tick(dt) to advance time.

import { brothById, noodleById, toppingById } from './recipes.js';

export function createKitchen() {
  const pot = { noodle: null, progress: 0, done: false };
  const board = { topping: null, progress: 0 };
  const choppedReady = new Set();
  const bowl = { broth: null, noodle: null, toppings: [] };

  function clearPot() {
    pot.noodle = null;
    pot.progress = 0;
    pot.done = false;
  }

  function clearBoard() {
    board.topping = null;
    board.progress = 0;
  }

  function resetBowl() {
    bowl.broth = null;
    bowl.noodle = null;
    bowl.toppings.length = 0;
  }

  function dropNoodles(noodleId) {
    if (pot.noodle !== null || !noodleById(noodleId)) return false;
    pot.noodle = noodleId;
    pot.progress = 0;
    pot.done = false;
    return true;
  }

  function takeNoodles() {
    if (!pot.done || pot.noodle === null) return false;
    bowl.noodle = pot.noodle;
    clearPot();
    return true;
  }

  function startChop(toppingId) {
    if (board.topping !== null) return false;
    const topping = toppingById(toppingId);
    if (!topping || topping.chopSeconds <= 0) return false;
    board.topping = toppingId;
    board.progress = 0;
    return true;
  }

  function pourBroth(brothId) {
    if (!brothById(brothId)) return false;
    bowl.broth = brothId;
    return true;
  }

  function addTopping(toppingId) {
    const topping = toppingById(toppingId);
    if (!topping) return false;
    if (bowl.toppings.includes(toppingId)) return false;
    if (topping.chopSeconds > 0) {
      if (!choppedReady.has(toppingId)) return false;
      choppedReady.delete(toppingId);
    }
    bowl.toppings.push(toppingId);
    return true;
  }

  function serveBowl() {
    if (bowl.broth === null || bowl.noodle === null) return null;
    const spec = { broth: bowl.broth, noodle: bowl.noodle, toppings: [...bowl.toppings] };
    resetBowl();
    return spec;
  }

  function trashBowl() {
    resetBowl();
  }

  function tick(dtSeconds) {
    if (!(dtSeconds > 0)) return;

    if (pot.noodle !== null && !pot.done) {
      const noodle = noodleById(pot.noodle);
      if (noodle && noodle.boilSeconds > 0) {
        pot.progress = Math.min(1, pot.progress + dtSeconds / noodle.boilSeconds);
        if (pot.progress >= 1) pot.done = true;
      }
    }

    if (board.topping !== null) {
      const topping = toppingById(board.topping);
      if (topping && topping.chopSeconds > 0) {
        board.progress = Math.min(1, board.progress + dtSeconds / topping.chopSeconds);
        if (board.progress >= 1) {
          choppedReady.add(board.topping);
          clearBoard();
        }
      }
    }
  }

  function bowlStepLabel() {
    if (bowl.broth === null) return 'add broth';
    if (bowl.noodle === null) return 'boil noodles';
    if (bowl.toppings.length === 0) return 'add toppings';
    return 'ready to serve';
  }

  return {
    pot,
    board,
    choppedReady,
    bowl,
    dropNoodles,
    takeNoodles,
    startChop,
    pourBroth,
    addTopping,
    serveBowl,
    trashBowl,
    tick,
    bowlStepLabel,
  };
}
