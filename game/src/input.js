// input.js — Pointer input for Rush Hour Ramen.
// Converts pointer events on the (CSS-scaled) canvas into canvas-space
// coordinates, and hit-tests points against the shared layout geometry
// from render.js: ticket cards first, then ingredient bins, then stations.

import { binRects, stationRect, ticketRect } from './render.js';

const STATION_NAMES = Object.freeze(['pot', 'board', 'plating', 'pass']);

function inside(x, y, r) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/**
 * Hit-test a canvas-space point.
 *
 * @param {number} x Canvas-space x coordinate.
 * @param {number} y Canvas-space y coordinate.
 * @param {number} ticketCount How many ticket cards are currently shown;
 *   only ticket indices below this count can be hit.
 * @returns {{type: 'ticket', index: number}
 *   | {type: 'bin', kind: string, id: string}
 *   | {type: 'station', name: string}
 *   | null} The topmost layout element under the point, or null.
 */
export function hitTest(x, y, ticketCount) {
  const count = Math.max(0, Math.floor(Number(ticketCount) || 0));

  for (let index = 0; index < count; index += 1) {
    if (inside(x, y, ticketRect(index))) {
      return { type: 'ticket', index };
    }
  }

  for (const bin of binRects()) {
    if (inside(x, y, bin)) {
      return { type: 'bin', kind: bin.kind, id: bin.id };
    }
  }

  for (const name of STATION_NAMES) {
    const rect = stationRect(name);
    if (rect && inside(x, y, rect)) {
      return { type: 'station', name };
    }
  }

  return null;
}

/**
 * Attach pointer input to a canvas.
 *
 * Listens for pointerdown, converts client coordinates to canvas
 * coordinates using getBoundingClientRect scaling (the canvas is
 * CSS-scaled, so client pixels are not canvas pixels), and calls
 * handler(x, y) with canvas-space floats.
 *
 * @param {HTMLCanvasElement} canvas The game canvas.
 * @param {(x: number, y: number) => void} handler Called on pointerdown.
 * @returns {() => void} Unsubscribe function removing the listener.
 */
export function attachInput(canvas, handler) {
  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const canvasW = canvas.width || 1280;
    const canvasH = canvas.height || 720;
    const x = (event.clientX - rect.left) * (canvasW / rect.width);
    const y = (event.clientY - rect.top) * (canvasH / rect.height);
    handler(x, y);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  return function unsubscribe() {
    canvas.removeEventListener('pointerdown', onPointerDown);
  };
}

export default attachInput;
