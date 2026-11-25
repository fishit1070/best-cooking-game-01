// render.js — All canvas drawing for Rush Hour Ramen (V4 scene-first).
// ONE continuous kitchen scene: the painted backdrop fills the canvas,
// the four station paintings are feathered into it (soft transparent
// edges, no framed panels), and every dynamic element — tickets, bins,
// progress, the live assembly bowl, chips, steam — is code-drawn on top.
// Wherever a painting failed to load, a compact hand-drawn vector
// version of that element is used as the fallback for that slot.
// Canvas is 1280×720. Warm night-time ramen-ya.

import {
  BROTHS,
  NOODLES,
  TOPPINGS,
  brothById,
  noodleById,
  toppingById,
  describeOrder,
} from './recipes.js';
import { artworkImage, drawArtworkCover, drawArtworkFeathered } from './artwork.js';

// ---------------------------------------------------------------------------
// Layout geometry (shared with the input handler) — V4 contract
// ---------------------------------------------------------------------------

const TICKET_X = 24;
const TICKET_Y = 16;
const TICKET_W = 168;
const TICKET_H = 126;
const TICKET_GAP = 12;

const BIN_X = 24;
const BIN_W = 112;
const BIN_H = 54;
const BIN_GAP = 10;
const BIN_ROW1_Y = 302;
const BIN_ROW2_Y = 366;

const STATION_Y = 436;
const STATION_H = 256;

const STATIONS = Object.freeze({
  pot: Object.freeze({ x: 36, y: STATION_Y, w: 272, h: STATION_H }),
  board: Object.freeze({ x: 332, y: STATION_Y, w: 272, h: STATION_H }),
  plating: Object.freeze({ x: 628, y: STATION_Y, w: 300, h: STATION_H }),
  pass: Object.freeze({ x: 952, y: STATION_Y, w: 292, h: STATION_H }),
});

export function ticketRect(index) {
  return {
    x: TICKET_X + index * (TICKET_W + TICKET_GAP),
    y: TICKET_Y,
    w: TICKET_W,
    h: TICKET_H,
  };
}

export function binRects() {
  const rects = [];
  const row1 = [
    ...BROTHS.map((b) => ({ kind: 'broth', id: b.id })),
    ...NOODLES.map((n) => ({ kind: 'noodle', id: n.id })),
  ];
  row1.forEach((item, i) => {
    rects.push({
      ...item,
      x: BIN_X + i * (BIN_W + BIN_GAP),
      y: BIN_ROW1_Y,
      w: BIN_W,
      h: BIN_H,
    });
  });
  TOPPINGS.forEach((t, i) => {
    rects.push({
      kind: 'topping',
      id: t.id,
      x: BIN_X + i * (BIN_W + BIN_GAP),
      y: BIN_ROW2_Y,
      w: BIN_W,
      h: BIN_H,
    });
  });
  return rects;
}

export function stationRect(name) {
  const r = STATIONS[name];
  return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
}

export const LAYOUT = Object.freeze({
  canvas: Object.freeze({ w: 1280, h: 720 }),
  ticket: Object.freeze({
    x: TICKET_X, y: TICKET_Y, w: TICKET_W, h: TICKET_H, gap: TICKET_GAP,
  }),
  bin: Object.freeze({
    x: BIN_X, y: BIN_ROW1_Y, w: BIN_W, h: BIN_H, gap: BIN_GAP,
    row2Y: BIN_ROW2_Y,
    areaY: 292, areaBottom: 428,
  }),
  stations: STATIONS,
  binRects,
  stationRect,
  ticketRect,
});

// ---------------------------------------------------------------------------
// Small drawing helpers (adapted from v3)
// ---------------------------------------------------------------------------

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function label(ctx, text, x, y, { size = 12, color = '#f5e6c8', align = 'left', weight = '600', font = 'sans-serif' } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Deterministic 0..1 hash from a numeric seed — fixed positions derived
// from a seed parameter, never from a random source.
function hash01(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function patienceColor(frac) {
  if (frac > 0.5) return '#57c256';
  if (frac > 0.25) return '#e8a33d';
  return '#d9402e';
}

// Soft elliptical contact shadow (radial-gradient disc squashed flat).
function softShadow(ctx, x, y, rx, ry, alpha = 0.32) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / Math.max(1, rx));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.7, `rgba(0,0,0,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Wood surface: warm gradient, a few darker grain streaks, light top edge.
function woodFill(ctx, x, y, w, h, { light = '#8a5a30', dark = '#54341a', seed = 1 } = {}) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(43,22,6,0.20)';
  ctx.lineWidth = 1;
  const streaks = Math.max(3, Math.floor(w / 64));
  for (let i = 0; i < streaks; i += 1) {
    const gy = y + 3 + hash01(seed * 131.7 + i * 17.31) * Math.max(1, h - 6);
    const gx = x + hash01(seed * 57.3 + i * 29.77) * w * 0.45;
    const len = 34 + hash01(seed * 91.1 + i * 7.93) * w * 0.3;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.bezierCurveTo(gx + len * 0.35, gy + 1.2, gx + len * 0.7, gy - 1.2, gx + len, gy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,222,164,0.30)';
  ctx.fillRect(x, y, w, 2);
  ctx.restore();
}

// Cream paper: warm gradient plus faint fibre specks (v3 paper texture).
// Callers clip first if the paper shape is not a plain rect.
function paperFill(ctx, x, y, w, h, seed = 1) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#fff8e6');
  g.addColorStop(1, '#f1dfb6');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 26; i += 1) {
    const px = x + hash01(seed * 89.3 + i * 7.13) * w;
    const py = y + hash01(seed * 53.9 + i * 3.71) * h;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(150,110,60,0.10)';
    ctx.fillRect(px, py, 2.4, 1.1);
  }
  ctx.strokeStyle = 'rgba(150,110,60,0.13)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 7; i += 1) {
    const px = x + hash01(seed * 31.7 + i * 11.3) * (w - 8);
    const py = y + hash01(seed * 71.9 + i * 5.17) * h;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 3.5, py + 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

// Radial pool of warm light.
function glowPool(ctx, x, y, r, alpha = 0.16, rgb = '255,180,90') {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function steamPuff(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(0.55, alpha));
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(255,250,240,0.9)');
  g.addColorStop(1, 'rgba(255,250,240,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A curled wisp of steam: two stacked translucent puffs rising with a
// sideways sway, driven purely by the steam phase.
function steamCurl(ctx, x, y, phase, scale = 1, peak = 0.36) {
  for (let k = 0; k < 2; k += 1) {
    const t = ((phase * 0.45 + k * 0.5) % 1 + 1) % 1;
    const yy = y - t * 36 * scale;
    const xx = x + Math.sin(phase * 2 + k * 2.4 + t * 3.2) * 5 * scale;
    const r = (6 + t * 9) * scale;
    steamPuff(ctx, xx, yy, r, peak * (1 - t));
    ctx.save();
    ctx.globalAlpha = peak * 0.55 * (1 - t);
    ctx.strokeStyle = '#fffaf0';
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.arc(xx, yy, r * 0.62, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
  }
}

// Small cream paper chip with ink text, centred on (cx, cy).
function paperChip(ctx, text, cx, cy, { size = 10.5, color = '#4a3010', padX = 8, h = 19 } = {}) {
  ctx.save();
  ctx.font = `600 ${size}px sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 4);
  ctx.fillStyle = '#f7ead0';
  ctx.fill();
  ctx.restore();
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 4);
  ctx.strokeStyle = 'rgba(150,110,60,0.45)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  label(ctx, text, cx, cy + size * 0.36, { size, color, align: 'center' });
  ctx.restore();
  return w;
}

// Small dark chip with cream text, centred on (cx, cy).
function darkChip(ctx, text, cx, cy, { size = 11, color = '#ffe9bd', padX = 10, h = 22 } = {}) {
  ctx.save();
  ctx.font = `600 ${size}px sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(14,7,2,0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,162,77,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  label(ctx, text, cx, cy + size * 0.36, { size, color, align: 'center' });
  ctx.restore();
  return w;
}

// ---------------------------------------------------------------------------
// Scene step 1 — background
// ---------------------------------------------------------------------------

function drawBackground(ctx, steamPhase) {
  if (drawArtworkCover(ctx, 'backdrop', 0, 0, 1280, 720)) return;
  // Fallback: a compact hand-drawn room — no panels.
  const wall = ctx.createLinearGradient(0, 0, 0, 436);
  wall.addColorStop(0, '#241612');
  wall.addColorStop(0.55, '#3a2115');
  wall.addColorStop(1, '#4a2b18');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 1280, 436);
  ctx.save();
  ctx.strokeStyle = 'rgba(12,5,2,0.5)';
  ctx.lineWidth = 2;
  for (let yy = 52; yy < 436; yy += 52) {
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(1280, yy); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,205,140,0.05)';
  for (let yy = 54; yy < 436; yy += 52) ctx.fillRect(0, yy, 1280, 1.5);
  ctx.restore();
  // A shelf line on the wall.
  woodFill(ctx, 60, 236, 1160, 14, { light: '#7d5327', dark: '#4e3016', seed: 5 });
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(60, 250, 1160, 4);
  // Two lantern glows.
  for (const [lx, ly] of [[330, 108], [950, 100]]) {
    const flicker = 1 + Math.sin(steamPhase * 1.7 + lx) * 0.04;
    glowPool(ctx, lx, ly, 120 * flicker, 0.30);
    const body = ctx.createRadialGradient(lx - 8, ly - 8, 2, lx, ly, 30);
    body.addColorStop(0, '#ffe9b0');
    body.addColorStop(0.6, '#ffb84d');
    body.addColorStop(1, '#e07f2e');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(lx, ly, 25, 31, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,5,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - 31); ctx.stroke();
    ctx.fillStyle = '#5a3410';
    ctx.fillRect(lx - 9, ly - 34, 18, 6);
    ctx.fillRect(lx - 9, ly + 28, 18, 6);
  }
  // Counter band across the lower half.
  woodFill(ctx, 0, 428, 1280, 292, { light: '#8a5a30', dark: '#57371b', seed: 21 });
  ctx.fillStyle = '#9c6c3a';
  ctx.fillRect(0, 428, 1280, 9);
  ctx.fillStyle = 'rgba(255,220,160,0.30)';
  ctx.fillRect(0, 428, 1280, 3);
  glowPool(ctx, 640, 580, 430, 0.12);
}

// ---------------------------------------------------------------------------
// Station name tags — small dark-wood hanging tags with chalk text
// ---------------------------------------------------------------------------

function drawStationTag(ctx, r, text) {
  const cx = r.x + r.w / 2;
  const w = 132;
  const h = 24;
  const x = cx - w / 2;
  const y = r.y - 4;
  ctx.save();
  // Two tiny strings going up 8px.
  ctx.strokeStyle = 'rgba(20,10,4,0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x + 14, y + 2); ctx.lineTo(x + 14, y - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - 14, y + 2); ctx.lineTo(x + w - 14, y - 8); ctx.stroke();
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#4a2c15');
  g.addColorStop(1, '#2a1709');
  roundRect(ctx, x, y, w, h, 5);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, w, h, 5);
  ctx.strokeStyle = 'rgba(201,162,77,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  label(ctx, text, cx, y + h / 2 + 4.2, { size: 12, color: '#f5e6c8', align: 'center' });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Scene step 3 fallbacks — compact hand-drawn vector stations (adapted
// from v3), used only when that station's painting is missing. Cooking-
// state overlays are drawn separately in step 4 either way.
// ---------------------------------------------------------------------------

function fallbackPot(ctx, r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + 138;
  ctx.save();
  glowPool(ctx, cx, cy + 62, 96, 0.18, '255,120,40');
  ctx.strokeStyle = '#241207';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 58, cy + 54); ctx.lineTo(cx + 58, cy + 54); ctx.stroke();
  softShadow(ctx, cx, cy + 56, 82, 8, 0.35);
  const steel = ctx.createLinearGradient(cx - 74, 0, cx + 74, 0);
  steel.addColorStop(0, '#79828a');
  steel.addColorStop(0.22, '#c9d1d8');
  steel.addColorStop(0.45, '#eef2f5');
  steel.addColorStop(0.72, '#a7b0b8');
  steel.addColorStop(1, '#626b73');
  ctx.fillStyle = steel;
  roundRect(ctx, cx - 74, cy - 32, 148, 84, 12);
  ctx.fill();
  ctx.strokeStyle = '#4c545c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(cx - 52, cy - 26, 9, 70);
  const rimGrad = ctx.createLinearGradient(cx - 78, 0, cx + 78, 0);
  rimGrad.addColorStop(0, '#8f979f');
  rimGrad.addColorStop(0.4, '#dde3e8');
  rimGrad.addColorStop(1, '#79828a');
  ctx.fillStyle = rimGrad;
  roundRect(ctx, cx - 78, cy - 40, 156, 15, 7);
  ctx.fill();
  ctx.strokeStyle = '#4c545c';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#8d99a3';
  ctx.beginPath(); ctx.ellipse(cx, cy - 32, 70, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function fallbackBoard(ctx, r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + 138;
  ctx.save();
  softShadow(ctx, cx, cy + 46, 104, 9, 0.38);
  ctx.save();
  roundRect(ctx, cx - 100, cy - 44, 200, 84, 10);
  ctx.clip();
  woodFill(ctx, cx - 100, cy - 44, 200, 84, { light: '#d9ab6d', dark: '#b08244', seed: 13 });
  ctx.restore();
  roundRect(ctx, cx - 100, cy - 44, 200, 84, 10);
  ctx.strokeStyle = '#7d5a28';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(110,74,30,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy - 2, 88, 34, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function fallbackPlating(ctx, r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + 128;
  ctx.save();
  softShadow(ctx, cx, cy + 62, 108, 10, 0.36);
  const trayGrad = ctx.createRadialGradient(cx - 20, cy + 34, 8, cx, cy + 48, 108);
  trayGrad.addColorStop(0, '#a4713d');
  trayGrad.addColorStop(0.75, '#7d5327');
  trayGrad.addColorStop(1, '#5d3c1e');
  ctx.fillStyle = trayGrad;
  ctx.beginPath(); ctx.ellipse(cx, cy + 48, 106, 21, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4e3016';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function fallbackPass(ctx, r) {
  const cx = r.x + r.w / 2;
  ctx.save();
  softShadow(ctx, cx, r.y + 176, r.w / 2 - 16, 7, 0.34);
  woodFill(ctx, r.x + 18, r.y + 160, r.w - 36, 12, { light: '#96683a', dark: '#66401f', seed: 17 });
  ctx.strokeStyle = '#4e3016';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(r.x + 18, r.y + 160, r.w - 36, 12);
  const railGrad = ctx.createLinearGradient(0, r.y + 152, 0, r.y + 158);
  railGrad.addColorStop(0, '#ffe9a8');
  railGrad.addColorStop(0.5, '#c9a24d');
  railGrad.addColorStop(1, '#8a6420');
  ctx.fillStyle = railGrad;
  ctx.fillRect(r.x + 18, r.y + 153, r.w - 36, 4);
  // Red heat-lamp shade over the pass.
  const spotX = cx - 28;
  ctx.strokeStyle = '#180c04';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(spotX, r.y + 30); ctx.lineTo(spotX, r.y + 48); ctx.stroke();
  const shadeGrad = ctx.createLinearGradient(spotX - 24, 0, spotX + 24, 0);
  shadeGrad.addColorStop(0, '#8f1f26');
  shadeGrad.addColorStop(0.45, '#d63a3a');
  shadeGrad.addColorStop(1, '#7c181e');
  ctx.fillStyle = shadeGrad;
  ctx.beginPath();
  ctx.moveTo(spotX - 9, r.y + 48);
  ctx.lineTo(spotX + 9, r.y + 48);
  ctx.lineTo(spotX + 25, r.y + 70);
  ctx.lineTo(spotX - 25, r.y + 70);
  ctx.closePath();
  ctx.fill();
  glowPool(ctx, spotX, r.y + 108, 80, 0.20, '255,150,60');
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Garnish painters for the plating bowl, keyed by topping id (from v3)
// ---------------------------------------------------------------------------

function drawGarnish(ctx, id, cx, cy) {
  ctx.save();
  if (id === 'ajitama') {
    for (const [ox, oy, rot] of [[-27, -7, -0.4], [29, 9, 0.5]]) {
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.rotate(rot);
      const white = ctx.createRadialGradient(-3, -3, 1, 0, 0, 15);
      white.addColorStop(0, '#fffdf2');
      white.addColorStop(0.75, '#fdf0cd');
      white.addColorStop(1, '#ecd9a4');
      ctx.fillStyle = white;
      ctx.beginPath(); ctx.ellipse(0, 0, 14.5, 9.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(190,150,90,0.55)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      const yolk = ctx.createRadialGradient(-1.8, -2, 0.5, 0, 0, 6);
      yolk.addColorStop(0, '#ffb84d');
      yolk.addColorStop(0.6, '#f28c28');
      yolk.addColorStop(1, '#d96f14');
      ctx.fillStyle = yolk;
      ctx.beginPath(); ctx.arc(0, 0, 5.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(-1.9, -2.1, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } else if (id === 'chashu') {
    for (const [ox, oy, rot] of [[-9, 10, 0.3], [15, -12, -0.2]]) {
      ctx.save(); ctx.translate(cx + ox, cy + oy); ctx.rotate(rot);
      const meat = ctx.createRadialGradient(-3, -3, 2, 0, 0, 16);
      meat.addColorStop(0, '#d08a6d');
      meat.addColorStop(0.65, '#b5654d');
      meat.addColorStop(1, '#8f4a33');
      ctx.fillStyle = meat;
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,232,214,0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0.2, Math.PI * 0.15, Math.PI * 1.25); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,232,214,0.55)';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.ellipse(0, 0, 3.8, 2.3, 0.2, Math.PI * 1.1, Math.PI * 2.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(70,32,18,0.75)';
      ctx.lineWidth = 1.6;
      for (const sx of [-8, -3, 2, 7]) {
        ctx.beginPath();
        ctx.moveTo(sx, 8.2);
        ctx.lineTo(sx + 1.5, 5.6);
        ctx.stroke();
      }
      ctx.restore();
    }
  } else if (id === 'scallions') {
    for (let i = 0; i < 14; i += 1) {
      const px = cx - 36 + hash01(13.7 + i * 8.9) * 72;
      const py = cy - 11 + hash01(47.3 + i * 5.1) * 22;
      ctx.fillStyle = i % 3 === 0 ? '#359146' : '#3f9e4d';
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(46,125,58,0.8)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.fillStyle = '#cdeecb';
      ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  } else if (id === 'corn') {
    for (let i = 0; i < 12; i += 1) {
      const kx = cx - 46 + hash01(23.5 + i * 6.7) * 30;
      const ky = cy + 8 + hash01(59.9 + i * 4.3) * 13;
      const kernel = ctx.createRadialGradient(kx - 1, ky - 1, 0.4, kx, ky, 3.6);
      kernel.addColorStop(0, '#ffe98a');
      kernel.addColorStop(1, '#eebd2e');
      ctx.fillStyle = kernel;
      ctx.beginPath(); ctx.arc(kx, ky, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(190,140,20,0.7)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(kx - 1, ky - 1.1, 0.85, 0, Math.PI * 2); ctx.fill();
    }
  } else if (id === 'nori') {
    for (const [ox, oy, rot, w, h] of [[40, -18, 0.25, 19, 28], [55, -10, 0.5, 17, 25]]) {
      ctx.save(); ctx.translate(cx + ox, cy + oy); ctx.rotate(rot);
      const sheet = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      sheet.addColorStop(0, '#2e4a38');
      sheet.addColorStop(1, '#16281c');
      ctx.fillStyle = sheet;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(120,190,135,0.6)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 4, h / 2 - 3);
      ctx.lineTo(-w / 2 + 7, -h / 2 + 4);
      ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'menma') {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i += 1) {
      const x1 = cx - 54 + i * 7;
      const y1 = cy - 15 + i * 3;
      const x2 = cx - 45 + i * 7;
      const y2 = cy + 3 + i * 3;
      ctx.strokeStyle = '#c9a35f';
      ctx.lineWidth = 4.4;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,242,205,0.75)';
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x1 - 1.2, y1); ctx.lineTo(x2 - 1.2, y2); ctx.stroke();
    }
    ctx.restore();
  } else if (id === 'chili-oil') {
    ctx.save();
    ctx.strokeStyle = 'rgba(214,58,34,0.75)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 4.4; a += 0.22) {
      const rr = 3 + a * 2.5;
      const px = cx + Math.cos(a + 0.6) * rr * 1.35;
      const py = cy + Math.sin(a + 0.6) * rr * 0.5;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    for (let i = 0; i < 6; i += 1) {
      const px = cx - 34 + hash01(71.1 + i * 9.7) * 68;
      const py = cy - 10 + hash01(37.7 + i * 6.1) * 20;
      ctx.fillStyle = 'rgba(224,86,58,0.8)';
      ctx.beginPath(); ctx.arc(px, py, 1.6 + hash01(i * 3.3) * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,140,0.7)';
      ctx.beginPath(); ctx.arc(px - 0.6, py - 0.6, 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else {
    const t = toppingById(id);
    ctx.fillStyle = t ? t.color : '#ccc';
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// The assembly bowl: patterned ceramic bowl, broth-colour surface,
// noodle mound, per-topping garnishes (adapted from v3 drawBowlContents).
// An empty bowl (broth null) still draws as an empty patterned bowl.
// Steam is NOT drawn here — it is scene step 9, drawn last.
function drawBowlContents(ctx, bowl, cx, cy, scale = 1) {
  const shade = (hex, amt) => {
    const n = parseInt(String(hex).slice(1), 16);
    if (Number.isNaN(n)) return hex;
    const cl = (v) => Math.max(0, Math.min(255, v));
    const rr = cl((n >> 16) + amt);
    const gg = cl(((n >> 8) & 0xff) + amt);
    const bb = cl((n & 0xff) + amt);
    return 'rgb(' + rr + ',' + gg + ',' + bb + ')';
  };

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  const broth = bowl.broth ? brothById(bowl.broth) : null;
  const brothColor = broth ? broth.color : '#d9d2c2';

  softShadow(ctx, cx, cy + 63, 60, 8, 0.34);

  const bodyGrad = ctx.createLinearGradient(0, cy, 0, cy + 64);
  bodyGrad.addColorStop(0, '#3a6ea8');
  bodyGrad.addColorStop(0.55, '#274b73');
  bodyGrad.addColorStop(1, '#16293f');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0.08 * Math.PI, 0.92 * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0.08 * Math.PI, 0.92 * Math.PI);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(cx - 34, cy + 26, 20, 30, 0.35, Math.PI * 0.7, Math.PI * 1.35);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(cx + 26, cy + 8, 36, 56);
  ctx.restore();
  ctx.fillStyle = '#122336';
  roundRect(ctx, cx - 25, cy + 55, 50, 9, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(cx - 25, cy + 55, 50, 2);

  // Rim band with an alternating blue arc/dot pattern.
  ctx.fillStyle = '#f3ead6';
  ctx.beginPath(); ctx.ellipse(cx, cy, 66, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#274b73';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  for (let i = 0; i < 28; i += 1) {
    const a = (i / 28) * Math.PI * 2;
    const px = cx + Math.cos(a) * 62.5;
    const py = cy + Math.sin(a) * 20.5;
    if (i % 2 === 0) {
      ctx.fillStyle = '#274b73';
      ctx.beginPath(); ctx.arc(px, py, 1.7, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#7fa8cc';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 62.5, 20.5, 0, a - 0.07, a + 0.07);
      ctx.stroke();
    }
  }

  // Broth surface: radial gradient, lighter at the centre.
  const surf = ctx.createRadialGradient(cx - 8, cy - 4, 3, cx, cy, 58);
  surf.addColorStop(0, shade(brothColor, 52));
  surf.addColorStop(0.6, brothColor);
  surf.addColorStop(1, shade(brothColor, -26));
  ctx.fillStyle = surf;
  ctx.beginPath(); ctx.ellipse(cx, cy, 58, 18, 0, 0, Math.PI * 2); ctx.fill();

  if (broth) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 4.2; a += 0.2) {
      const rr = 2.5 + a * 2.6;
      const px = cx + Math.cos(a + 0.8) * rr * 1.5;
      const py = cy + Math.sin(a + 0.8) * rr * 0.46;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 5; i += 1) {
      const px = cx - 38 + hash01(17.9 + i * 12.3) * 76;
      const py = cy - 9 + hash01(43.5 + i * 7.9) * 17;
      ctx.fillStyle = 'rgba(255,232,170,0.55)';
      ctx.beginPath(); ctx.arc(px, py, 2 + hash01(i * 4.1) * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(px - 0.7, py - 0.7, 0.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 1, 40, 12, -0.1, Math.PI * 1.08, Math.PI * 1.55);
    ctx.stroke();
  }

  // Noodles: a raised mound of wavy strands in the centre.
  if (bowl.noodle) {
    ctx.save();
    ctx.fillStyle = 'rgba(247,220,143,0.5)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 1, 40, 12.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round';
    for (let s = 0; s < 8; s += 1) {
      const off = -33 + s * 9.5;
      const peak = -8 - hash01(29.3 + s * 6.1) * 7;
      ctx.strokeStyle = '#f2d67c';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx + off, cy + 9);
      ctx.bezierCurveTo(cx + off + 7, cy + peak, cx + off - 7, cy + peak - 3, cx + off + 2, cy - 1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,185,0.9)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx + off - 1.5, cy + 8);
      ctx.bezierCurveTo(cx + off + 5, cy + peak - 1, cx + off - 8, cy + peak - 4, cx + off, cy - 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#f7dc8f';
    ctx.lineWidth = 2.2;
    for (const off of [-8, 5]) {
      ctx.beginPath();
      ctx.moveTo(cx + off, cy - 6);
      ctx.bezierCurveTo(cx + off + 4, cy - 18, cx + off + 12, cy - 19, cx + off + 15, cy - 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const id of bowl.toppings || []) drawGarnish(ctx, id, cx, cy);

  // Chopsticks resting across the rim when the bowl is non-empty.
  if (bowl.broth || bowl.noodle) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 4.4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + 31, cy - 10); ctx.lineTo(cx + 75, cy - 48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 41, cy - 4); ctx.lineTo(cx + 87, cy - 36); ctx.stroke();
    const stick = (x1, y1, x2, y2) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * 2.1;
      const ny = (dx / len) * 2.1;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, '#a06a30');
      grad.addColorStop(1, '#7c4a21');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x1 + nx * 0.45, y1 + ny * 0.45);
      ctx.lineTo(x2 + nx, y2 + ny);
      ctx.lineTo(x2 - nx, y2 - ny);
      ctx.lineTo(x1 - nx * 0.45, y1 - ny * 0.45);
      ctx.closePath();
      ctx.fill();
    };
    stick(cx + 30, cy - 14, cx + 74, cy - 52);
    stick(cx + 40, cy - 8, cx + 86, cy - 40);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Scene step 4 — station dynamic overlays (+ name tags)
// ---------------------------------------------------------------------------

function drawPotOverlay(ctx, view) {
  const r = STATIONS.pot;
  const pot = view.kitchen.pot;
  const steamPhase = view.steamPhase || 0;
  drawStationTag(ctx, r, 'NOODLE POT');
  if (!pot.noodle) return;
  const noodle = noodleById(pot.noodle);
  // Paper chip at the zone's bottom-left naming the noodle.
  paperChip(ctx, noodle ? noodle.name : pot.noodle, r.x + 62, r.y + r.h - 20, { size: 10 });
  // Bubble dots over the pot's water area while cooking.
  if (!pot.done) {
    for (let i = 0; i < 7; i += 1) {
      const t = ((steamPhase * 0.6 + hash01(7.7 + i * 3.3)) % 1 + 1) % 1;
      const bx = r.x + r.w / 2 - 48 + hash01(19.1 + i * 11.7) * 96;
      const by = r.y + 128 + Math.sin(t * Math.PI) * 2 - t * 2;
      ctx.fillStyle = 'rgba(255,246,210,' + (0.3 + 0.4 * Math.sin(t * Math.PI)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bx, by, 1.5 + t * 2.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Brass progress ring at the zone's bottom-right (raised ~14px so it
  // and the READY chip clear the standing score sign's top edge).
  const ringX = r.x + r.w - 34;
  const ringY = r.y + r.h - 52;
  const pulse = pot.done ? 1 + Math.sin(steamPhase * 4) * 0.08 : 1;
  ctx.save();
  ctx.translate(ringX, ringY);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(14,7,2,0.72)';
  ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#8a6420';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, Math.PI * 2); ctx.stroke();
  if (pot.done) {
    ctx.save();
    ctx.shadowColor = 'rgba(87,194,86,0.8)';
    ctx.shadowBlur = 8 + Math.sin(steamPhase * 4) * 3;
    ctx.strokeStyle = '#57c256';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = '#e8c872';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 16.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, pot.progress || 0)));
    ctx.stroke();
  }
  ctx.fillStyle = '#c9a24d';
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (pot.done) {
    // Small green READY chip just left of the ring.
    ctx.save();
    const grad = ctx.createLinearGradient(0, ringY - 10, 0, ringY + 10);
    grad.addColorStop(0, '#6fce6c');
    grad.addColorStop(1, '#3f9240');
    roundRect(ctx, ringX - 82, ringY - 10, 52, 20, 6);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    label(ctx, 'READY', ringX - 56, ringY + 4, { size: 11, color: '#fff', align: 'center' });
    ctx.restore();
  }
}

function drawBoardOverlay(ctx, view) {
  const r = STATIONS.board;
  const kitchen = view.kitchen;
  const board = kitchen.board;
  const cx = r.x + r.w / 2;
  const cy = r.y + 132;
  drawStationTag(ctx, r, 'CHOPPING BOARD');
  if (board.topping) {
    const topping = toppingById(board.topping);
    const color = topping ? topping.color : '#ccc';
    const prog = Math.max(0, Math.min(1, board.progress || 0));
    const pieces = Math.floor(prog * 14);
    ctx.save();
    if (board.topping === 'scallions') {
      const bundleLen = 74 * (1 - prog * 0.72);
      ctx.lineCap = 'round';
      for (let s = 0; s < 5; s += 1) {
        const sy = cy - 18 + s * 8;
        ctx.strokeStyle = s % 2 ? '#359146' : '#3f9e4d';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(cx - 78, sy); ctx.lineTo(cx - 78 + bundleLen, sy - 1.5); ctx.stroke();
        ctx.strokeStyle = 'rgba(220,255,220,0.75)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(cx - 78, sy - 1.6); ctx.lineTo(cx - 78 + bundleLen, sy - 3); ctx.stroke();
      }
      ctx.fillStyle = '#e9f2d8';
      ctx.beginPath(); ctx.ellipse(cx - 78, cy - 2, 4, 17, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < pieces; i += 1) {
        const px = cx + 12 + hash01(41.7 + i * 9.3) * 62;
        const py = cy - 22 + hash01(83.1 + i * 5.7) * 42;
        ctx.fillStyle = '#3f9e4d';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cdeecb';
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (board.topping === 'menma') {
      const stickLen = 66 * (1 - prog * 0.7);
      ctx.lineCap = 'round';
      for (let s = 0; s < 4; s += 1) {
        const sx = cx - 76 + s * 3;
        const sy = cy - 20 + s * 12;
        ctx.strokeStyle = '#c9a35f';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(sx, sy + 12); ctx.lineTo(sx + stickLen * 0.45, sy + 12 - stickLen * 0.28); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,200,0.7)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sx - 1.4, sy + 10.5); ctx.lineTo(sx + stickLen * 0.45 - 1.4, sy + 10.5 - stickLen * 0.28); ctx.stroke();
      }
      for (let i = 0; i < pieces; i += 1) {
        const px = cx + 14 + hash01(31.9 + i * 8.1) * 60;
        const py = cy - 20 + hash01(67.3 + i * 6.3) * 40;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(hash01(i * 3.7) * 1.6 - 0.8);
        ctx.fillStyle = '#c9a35f';
        roundRect(ctx, -6, -3, 12, 6, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,240,200,0.65)';
        ctx.fillRect(-4.5, -2.2, 9, 1.4);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx - 40, cy, 22 - prog * 11, 14 - prog * 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < pieces; i += 1) {
        const px = cx + 6 + hash01(51.3 + i * 7.9) * 68;
        const py = cy - 20 + hash01(91.7 + i * 4.9) * 38;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(i * 0.7);
        ctx.fillStyle = color;
        ctx.fillRect(-6, -3.5, 12, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(-6, -3.5, 12, 2);
        ctx.restore();
      }
    }
    ctx.restore();
    // Segmented progress: 8 dots on a small dark pill just under the
    // board's name tag (the zone bottom is covered by the score sign).
    const stripW = 8 * 13 + 10;
    const stripX = cx - stripW / 2;
    const stripY = r.y + 40;
    ctx.save();
    roundRect(ctx, stripX, stripY, stripW, 20, 10);
    ctx.fillStyle = 'rgba(14,7,2,0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,162,77,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const filled = Math.round(prog * 8);
    for (let d = 0; d < 8; d += 1) {
      const dx = stripX + 12 + d * 13;
      const dy = stripY + 10;
      ctx.fillStyle = d < filled ? '#e8a33d' : 'rgba(255,240,210,0.22)';
      ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fill();
      if (d < filled) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(dx - 1.2, dy - 1.4, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    return;
  }
  const ready = kitchen.choppedReady ? [...kitchen.choppedReady] : [];
  if (ready.length) {
    const names = ready.map((id) => {
      const t = toppingById(id);
      return t ? t.name : id;
    }).join(', ');
    ctx.save();
    ctx.font = '600 10.5px sans-serif';
    const text = `ready: ${names}`;
    const w = Math.min(r.w - 24, Math.ceil(ctx.measureText(text).width) + 30);
    const x = r.x + 12;
    const y = r.y + r.h - 32;
    roundRect(ctx, x, y, w, 21, 5);
    ctx.fillStyle = '#f7ead0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,60,0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = '#3f9240';
    ctx.beginPath(); ctx.arc(x + 11, y + 10.5, 4, 0, Math.PI * 2); ctx.fill();
    label(ctx, text, x + 20, y + 14.5, { size: 10.5, color: '#4a3010' });
    ctx.restore();
  } else {
    label(ctx, 'chop scallions · menma', cx, r.y + r.h - 16, {
      size: 11, color: 'rgba(245,230,200,0.38)', align: 'center', weight: '400',
    });
  }
}

function drawPlatingOverlay(ctx, view) {
  const r = STATIONS.plating;
  const kitchen = view.kitchen;
  drawStationTag(ctx, r, 'PLATING');
  // Live assembly bowl at (zone centre-x, zone bottom − 64), scale ≈1.15.
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h - 64;
  drawBowlContents(ctx, kitchen.bowl, cx, cy, 1.15);
  // Step chip under the bowl.
  let step = '';
  try { step = kitchen.bowlStepLabel ? kitchen.bowlStepLabel() : ''; } catch { step = ''; }
  if (step) {
    const readyServe = step === 'ready to serve';
    darkChip(ctx, step, cx, r.y + r.h - 16, {
      size: 11.5, color: readyServe ? '#7dd87a' : '#ffe9bd', h: 23,
    });
  }
}

function drawPassOverlay(ctx, view) {
  const r = STATIONS.pass;
  drawStationTag(ctx, r, 'SERVE →');
  const flash = view.servedFlash;
  const active = typeof flash === 'number' && flash > 0;
  // Brass bell at the zone's top-right (dome + clapper + highlight),
  // glowing while servedFlash > 0.
  const bellX = r.x + r.w - 40;
  const bellY = r.y + 44;
  ctx.save();
  if (active) glowPool(ctx, bellX, bellY, 34, 0.35 * Math.min(1, flash), '255,210,110');
  softShadow(ctx, bellX, bellY + 9, 17, 3.5, 0.3);
  ctx.fillStyle = '#8a6420';
  ctx.beginPath(); ctx.ellipse(bellX, bellY + 7, 17, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  const bellGrad = ctx.createRadialGradient(bellX - 5, bellY - 8, 1.5, bellX, bellY, 15);
  bellGrad.addColorStop(0, '#ffedb0');
  bellGrad.addColorStop(0.5, '#f2c14e');
  bellGrad.addColorStop(1, '#b8860b');
  ctx.fillStyle = bellGrad;
  ctx.beginPath(); ctx.arc(bellX, bellY + 5, 13.5, Math.PI, 0); ctx.fill();
  ctx.fillRect(bellX - 13.5, bellY + 5, 27, 3.5);
  ctx.fillStyle = '#6e5416';
  ctx.beginPath(); ctx.arc(bellX, bellY + 10.5, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(bellX - 5.5, bellY - 2.5, 3.6, 5.5, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a6420';
  roundRect(ctx, bellX - 2.2, bellY - 12, 4.4, 5, 2);
  ctx.fill();
  ctx.fillStyle = '#c9a24d';
  ctx.beginPath(); ctx.arc(bellX, bellY - 13.5, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (active) {
    const a = Math.max(0, Math.min(1, flash));
    const cx = r.x + r.w / 2;
    ctx.save();
    ctx.globalAlpha = a;
    glowPool(ctx, cx, r.y + 130, 130, 0.4, '255,200,90');
    // Sparkles.
    ctx.fillStyle = '#ffe066';
    const sparkles = [[-92, 58], [-6, 40], [-110, 108], [30, 84], [70, 150], [-60, 170]];
    sparkles.forEach(([ox, oy], i) => {
      const sx = cx + ox;
      const sy = r.y + oy + Math.sin((view.steamPhase || 0) * 5 + i * 1.8) * 3;
      const s = 5 + a * 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * 0.28, sy - s * 0.28); ctx.lineTo(sx + s, sy);
      ctx.lineTo(sx + s * 0.28, sy + s * 0.28); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s * 0.28, sy + s * 0.28);
      ctx.lineTo(sx - s, sy); ctx.lineTo(sx - s * 0.28, sy - s * 0.28);
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    darkChip(ctx, 'SERVED!', cx, r.y + 34, { size: 13, color: '#ffd94d', h: 25 });
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Scene step 7 — ingredient shelf + bins
// ---------------------------------------------------------------------------

// Vessel painters (adapted from v3's per-ingredient bin art). Each draws
// centred on (cx, cy) in roughly a 38×30 box.
function drawBrothPotVessel(ctx, cx, cy, broth) {
  ctx.save();
  ctx.strokeStyle = '#7c4a21';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx + 5, cy - 9); ctx.lineTo(cx + 19, cy - 21); ctx.stroke();
  ctx.fillStyle = '#a06a30';
  ctx.beginPath(); ctx.arc(cx + 20, cy - 22, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const steel = ctx.createLinearGradient(cx - 17, cy, cx + 17, cy);
  steel.addColorStop(0, '#8f979f');
  steel.addColorStop(0.35, '#dde3e8');
  steel.addColorStop(0.75, '#aeb6bd');
  steel.addColorStop(1, '#6f777f');
  ctx.fillStyle = steel;
  roundRect(ctx, cx - 17, cy - 10, 34, 23, 5);
  ctx.fill();
  ctx.strokeStyle = '#565e66';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#c3cad0';
  ctx.beginPath(); ctx.ellipse(cx, cy - 10, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = broth ? broth.color : '#888';
  ctx.beginPath(); ctx.ellipse(cx, cy - 10, 14, 3.9, 0, 0, Math.PI * 2); ctx.fill();
  // Label dot in the broth colour on the pot front.
  ctx.fillStyle = broth ? broth.color : '#888';
  ctx.beginPath(); ctx.arc(cx, cy + 5, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(cx - 1, cy - 10.6, 9.5, 2.4, -0.12, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
}

function drawNoodleBasketVessel(ctx, cx, cy) {
  ctx.save();
  ctx.strokeStyle = '#f5d98b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let s = 0; s < 5; s += 1) {
    const off = -12 + s * 6;
    ctx.beginPath();
    ctx.moveTo(cx + off, cy - 3);
    ctx.bezierCurveTo(cx + off - 3, cy - 12 - (s % 3) * 2, cx + off + 5, cy - 13 - ((s + 1) % 3) * 2, cx + off + 7, cy - 4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#b98d54';
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 4);
  ctx.lineTo(cx + 18, cy - 4);
  ctx.lineTo(cx + 14, cy + 14);
  ctx.lineTo(cx - 14, cy + 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7d5a28';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(125,90,40,0.65)';
  ctx.lineWidth = 1;
  for (const wy of [1, 6, 11]) {
    ctx.beginPath();
    ctx.moveTo(cx - 17 + (wy * 0.35), cy + wy - 4);
    ctx.lineTo(cx + 17 - (wy * 0.35), cy + wy - 4);
    ctx.stroke();
  }
  ctx.save();
  ctx.strokeStyle = '#f5d98b';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  for (const off of [-10, 1, 11]) {
    ctx.beginPath();
    ctx.moveTo(cx + off, cy - 4);
    ctx.bezierCurveTo(cx + off - 2, cy + 2, cx + off + 3, cy + 5, cx + off + 1, cy + 11);
    ctx.stroke();
  }
  ctx.restore();
}

function drawToppingBowlVessel(ctx, cx, cy, bin) {
  if (bin.id === 'chili-oil') {
    softShadow(ctx, cx, cy + 14, 14, 3, 0.25);
    ctx.fillStyle = '#d63a22';
    roundRect(ctx, cx - 10, cy - 4, 20, 17, 4);
    ctx.fill();
    ctx.fillStyle = '#e0563a';
    ctx.fillRect(cx - 10, cy - 4, 20, 5);
    ctx.fillStyle = 'rgba(220,235,240,0.28)';
    roundRect(ctx, cx - 12, cy - 8, 24, 23, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,242,246,0.7)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(cx - 5, cy + 2, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4, cy + 8, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a35f';
    roundRect(ctx, cx - 8, cy - 14, 16, 7, 2.5);
    ctx.fill();
    return;
  }
  ctx.save();
  if (bin.id === 'chashu') {
    const slices = [[-8, -5, -0.25], [7, -6, 0.2], [0, -11, 0.05]];
    for (const [ox, oy, rot] of slices) {
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.rotate(rot);
      ctx.fillStyle = '#b5654d';
      ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 5.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8a58c';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 2.8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  } else if (bin.id === 'ajitama') {
    for (const [ox, oy, rot] of [[-7, -6, -0.3], [8, -5, 0.35]]) {
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.rotate(rot);
      ctx.fillStyle = '#fff6dd';
      ctx.beginPath(); ctx.ellipse(0, 0, 7.6, 5.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(190,150,90,0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = '#f28c28';
      ctx.beginPath(); ctx.arc(0, 0, 3.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } else if (bin.id === 'scallions') {
    const rings = [[-10, -4], [-3, -8], [4, -8], [11, -4], [-7, -11], [1, -12], [8, -11], [-1, -5]];
    for (const [ox, oy] of rings) {
      ctx.fillStyle = '#3f9e4d';
      ctx.beginPath(); ctx.arc(cx + ox, cy + oy, 3.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bfe8bf';
      ctx.beginPath(); ctx.arc(cx + ox, cy + oy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  } else if (bin.id === 'corn') {
    const kernels = [[-10, -3], [-4, -6], [3, -6], [10, -3], [-7, -10], [0, -11], [7, -10], [-2, -3], [5, -2]];
    for (const [ox, oy] of kernels) {
      ctx.fillStyle = '#f7d154';
      ctx.beginPath(); ctx.arc(cx + ox, cy + oy, 2.9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(217,169,46,0.8)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  } else if (bin.id === 'nori') {
    const sheets = [[-9, -15, -0.06], [-7, -13, 0.03], [-5, -11, 0.1]];
    sheets.forEach(([ox, oy, rot], si) => {
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.rotate(rot);
      ctx.fillStyle = si === 2 ? '#2e4a38' : '#1f3527';
      ctx.fillRect(0, 0, 17, 13);
      ctx.restore();
    });
  } else if (bin.id === 'menma') {
    ctx.save();
    ctx.lineCap = 'round';
    const sticks = [[-10, -3, -8, -13], [-3, -2, 0, -14], [4, -2, 8, -12], [10, -3, 13, -10], [-6, -4, -3, -15]];
    for (const [x1, y1, x2, y2] of sticks) {
      ctx.strokeStyle = '#c9a35f';
      ctx.lineWidth = 3.6;
      ctx.beginPath(); ctx.moveTo(cx + x1, cy + y1); ctx.lineTo(cx + x2, cy + y2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,200,0.65)';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(cx + x1 - 0.8, cy + y1); ctx.lineTo(cx + x2 - 0.8, cy + y2); ctx.stroke();
    }
    ctx.restore();
  } else {
    const topping = toppingById(bin.id);
    ctx.fillStyle = topping ? topping.color : '#888';
    ctx.beginPath(); ctx.arc(cx, cy - 6, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Ceramic bowl holding the heap.
  const bowlGrad = ctx.createLinearGradient(cx, cy - 2, cx, cy + 14);
  bowlGrad.addColorStop(0, '#f4f7fa');
  bowlGrad.addColorStop(1, '#c9d4de');
  ctx.fillStyle = bowlGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 17, cy - 2);
  ctx.ellipse(cx, cy - 2, 17, 6, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#274b73';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(cx, cy - 2, 17, 6, 0, 0, Math.PI * 2); ctx.stroke();
}

function binName(bin) {
  if (bin.kind === 'broth') {
    const b = brothById(bin.id);
    return b ? b.name : bin.id;
  }
  if (bin.kind === 'noodle') {
    const n = noodleById(bin.id);
    return n ? n.name : bin.id;
  }
  const t = toppingById(bin.id);
  return t ? t.name : bin.id;
}

function drawBins(ctx, view) {
  const kitchen = view.kitchen || {};
  const board = kitchen.board || {};
  const bowl = kitchen.bowl || {};
  const choppedReady = kitchen.choppedReady || new Set();

  // Readability scrim behind the bins only (no full-width shelf face):
  // a soft vertical gradient band over the bins' extent, feathered at
  // both ends so it has no hard edges anywhere.
  ctx.save();
  const scrim = ctx.createLinearGradient(0, 288, 0, 432);
  scrim.addColorStop(0, 'rgba(20,10,4,0)');
  scrim.addColorStop(0.29, 'rgba(20,10,4,0.20)');
  scrim.addColorStop(0.71, 'rgba(20,10,4,0.20)');
  scrim.addColorStop(1, 'rgba(20,10,4,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(14, 288, 866, 144);
  ctx.restore();

  // One wooden plank under each row's vessels, spanning only the bins'
  // extent. Vessel bases (vesselY + ~15) sit just at each plank's top.
  for (const [rowIdx, rowY] of [BIN_ROW1_Y, BIN_ROW2_Y].entries()) {
    const plankY = rowY + 34;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.ellipse(447, plankY + 14, 433, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    woodFill(ctx, 14, plankY, 866, 12, { light: '#8a5a30', dark: '#54341a', seed: 31 + rowIdx * 7 });
    // Warm 1px highlight on the plank's top edge.
    ctx.save();
    ctx.fillStyle = 'rgba(255,222,164,0.55)';
    ctx.fillRect(14, plankY, 866, 1);
    ctx.restore();
  }

  for (const bin of binRects()) {
    const cx = bin.x + bin.w / 2;
    const vesselY = bin.y + 17; // vessel centre in the upper ~60%
    const isChopping = bin.kind === 'topping' && board.topping === bin.id;
    const isReady = bin.kind === 'topping' && choppedReady.has(bin.id);
    const inBowl = (bin.kind === 'broth' && bowl.broth === bin.id)
      || (bin.kind === 'noodle' && bowl.noodle === bin.id)
      || (bin.kind === 'topping' && Array.isArray(bowl.toppings) && bowl.toppings.includes(bin.id));

    ctx.save();
    if (isReady) glowPool(ctx, cx, vesselY + 2, 30, 0.30, '255,190,90');
    // Contact shadow under the vessel, sitting on the shelf.
    softShadow(ctx, cx, vesselY + 15, 24, 3.6, 0.32);
    if (isChopping) ctx.globalAlpha = 0.45;
    if (bin.kind === 'broth') drawBrothPotVessel(ctx, cx, vesselY, brothById(bin.id));
    else if (bin.kind === 'noodle') drawNoodleBasketVessel(ctx, cx, vesselY);
    else drawToppingBowlVessel(ctx, cx, vesselY, bin);
    ctx.restore();

    if (isReady) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,190,90,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, vesselY + 1, 27, 19, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (isChopping) {
      // Thin progress arc around the vessel showing board.progress.
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, vesselY + 1, 29, 21, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#e8a33d';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(cx, vesselY + 1, 29, 21, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, board.progress || 0)));
      ctx.stroke();
      ctx.restore();
    }

    // Cream paper name tag at the bottom of the bin rect.
    const tagW = bin.w - 14;
    const tagH = 17;
    const tagX = bin.x + 7;
    const tagY = bin.y + bin.h - tagH - 2;
    ctx.save();
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    roundRect(ctx, tagX, tagY, tagW, tagH, 3);
    ctx.fillStyle = '#f7ead0';
    ctx.fill();
    ctx.restore();
    roundRect(ctx, tagX, tagY, tagW, tagH, 3);
    ctx.strokeStyle = isReady ? 'rgba(63,146,64,0.85)' : 'rgba(150,110,60,0.45)';
    ctx.lineWidth = isReady ? 1.4 : 0.8;
    ctx.stroke();
    // Tiny pin dot at the tag's top centre.
    ctx.fillStyle = '#c9a24d';
    ctx.beginPath(); ctx.arc(tagX + tagW / 2, tagY + 2.5, 1.6, 0, Math.PI * 2); ctx.fill();
    // Ingredient name, shrunk to fit one line.
    let size = 10.5;
    ctx.font = `600 ${size}px sans-serif`;
    const name = binName(bin);
    while (ctx.measureText(name).width > tagW - 10 && size > 7.5) {
      size -= 0.5;
      ctx.font = `600 ${size}px sans-serif`;
    }
    label(ctx, name, tagX + tagW / 2, tagY + tagH / 2 + size * 0.36, { size, color: '#4a3010', align: 'center' });
    // Gold check dot at the tag's right corner when already in the bowl.
    if (inBowl) {
      ctx.fillStyle = '#d9a03c';
      ctx.beginPath(); ctx.arc(tagX + tagW - 6, tagY + 4, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff6dd';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tagX + tagW - 8.2, tagY + 4);
      ctx.lineTo(tagX + tagW - 6.6, tagY + 5.6);
      ctx.lineTo(tagX + tagW - 3.8, tagY + 2.4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Scene step 8 — tickets on their rail
// ---------------------------------------------------------------------------

function drawTickets(ctx, view) {
  const tickets = view.tickets || [];
  const steamPhase = view.steamPhase || 0;
  // The rail: a twine string sagging slightly across the top, with tiny
  // peg dots at both ends.
  ctx.save();
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 10);
  ctx.quadraticCurveTo(640, 20, 1264, 10);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,160,0.25)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(16, 9);
  ctx.quadraticCurveTo(640, 19, 1264, 9);
  ctx.stroke();
  for (const px of [16, 1264]) {
    ctx.fillStyle = '#6b4423';
    ctx.beginPath(); ctx.arc(px, 10, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,180,0.5)';
    ctx.beginPath(); ctx.arc(px - 1.2, 8.8, 1.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  if (!tickets.length) {
    // One small hanging paper tag, quiet and scene-true.
    ctx.save();
    ctx.strokeStyle = 'rgba(20,10,4,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(150, 12); ctx.lineTo(150, 30); ctx.stroke();
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, 96, 30, 108, 24, 4);
    ctx.fillStyle = '#f3e3bd';
    ctx.fill();
    ctx.restore();
    roundRect(ctx, 96, 30, 108, 24, 4);
    ctx.strokeStyle = 'rgba(150,110,60,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    label(ctx, 'NO ORDERS YET', 150, 46, { size: 11, color: 'rgba(90,64,32,0.8)', align: 'center' });
    ctx.restore();
    return;
  }

  tickets.forEach((ticket, i) => {
    const r = ticketRect(i);
    const active = ticket.id === view.activeTicketId;
    const frac = ticket.patienceMax > 0 ? Math.max(0, Math.min(1, ticket.patience / ticket.patienceMax)) : 0;
    const critical = frac < 0.25;
    // Deterministic small tilt from a hash of the index (±1.2°).
    const angle = (hash01(i * 3.71 + 0.37) * 2 - 1) * 1.2 * (Math.PI / 180);
    const topCx = r.x + r.w / 2;
    ctx.save();
    ctx.translate(topCx, r.y);
    ctx.rotate(angle);
    ctx.translate(-topCx, -r.y);

    // Paper slip with a soft shadow (canvas shadow on the paper fill).
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 9;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 5);
    ctx.fillStyle = '#f7ead0';
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 5);
    ctx.clip();
    paperFill(ctx, r.x, r.y, r.w, r.h, 3 + i * 7);
    ctx.restore();

    // Strokes: critical red glow first, then the active gold stroke.
    if (critical) {
      ctx.save();
      ctx.shadowColor = 'rgba(217,64,46,0.9)';
      ctx.shadowBlur = 10 + Math.sin(steamPhase * 7) * 4;
      roundRect(ctx, r.x, r.y, r.w, r.h, 5);
      ctx.strokeStyle = '#d9402e';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }
    roundRect(ctx, r.x, r.y, r.w, r.h, 5);
    ctx.strokeStyle = active ? '#d9a03c' : 'rgba(120,90,50,0.45)';
    ctx.lineWidth = active ? 2.5 : 1.2;
    ctx.stroke();

    // Brass pin at the top-centre of the slip.
    const pinGrad = ctx.createRadialGradient(topCx - 1.5, r.y + 5.5, 0.5, topCx, r.y + 7, 5);
    pinGrad.addColorStop(0, '#ffe9a8');
    pinGrad.addColorStop(0.55, '#d9a03c');
    pinGrad.addColorStop(1, '#8a6420');
    ctx.fillStyle = pinGrad;
    ctx.beginPath(); ctx.arc(topCx, r.y + 7, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(topCx - 1.6, r.y + 5.4, 1.3, 0, Math.PI * 2); ctx.fill();

    // Content — ink on paper, clearing the patience strip at the bottom.
    const stripH = 7;
    const stripY = r.y + r.h - stripH - 4;
    const lines = describeOrder(ticket);
    // Item name, bold ≈13px, shrunk to fit one line.
    let nameSize = 13;
    ctx.fillStyle = '#33200e';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${nameSize}px sans-serif`;
    while (ctx.measureText(ticket.item).width > r.w - 16 && nameSize > 9) {
      nameSize -= 1;
      ctx.font = `700 ${nameSize}px sans-serif`;
    }
    ctx.fillText(ticket.item, r.x + 8, r.y + 27);
    label(ctx, `#${ticket.id} · $${Number(ticket.price).toFixed(2)}`, r.x + 8, r.y + 41, {
      size: 10, color: '#8a6a3d', weight: '600',
    });
    // describeOrder lines ≈10.5px, tightened only as far as needed so
    // the last line always clears the patience strip.
    const descFirst = r.y + 56;
    const descLastMax = stripY - 5;
    let descSize = 10.5;
    let descLH = 12.5;
    if (lines.length > 1) {
      const maxLH = (descLastMax - descFirst) / (lines.length - 1);
      if (maxLH < descLH) {
        descLH = Math.max(8, maxLH);
        descSize = Math.max(8, Math.min(10.5, descLH - 1.5));
      }
    }
    lines.forEach((line, li) => {
      label(ctx, `• ${line}`, r.x + 10, descFirst + li * descLH, {
        size: descSize, color: '#5a4020', weight: '400',
      });
    });

    // Patience strip along the bottom inside edge of the slip.
    ctx.save();
    roundRect(ctx, r.x + 6, stripY, r.w - 12, stripH, stripH / 2);
    ctx.fillStyle = 'rgba(60,35,10,0.30)';
    ctx.fill();
    if (frac > 0) {
      roundRect(ctx, r.x + 6, stripY, Math.max(stripH, (r.w - 12) * frac), stripH, stripH / 2);
      ctx.fillStyle = patienceColor(frac);
      ctx.fill();
    }
    ctx.restore();

    // Critical badge: red circle with a white "!" at the top-right.
    if (critical) {
      const bx = r.x + r.w - 11;
      const by = r.y + 11;
      ctx.fillStyle = '#d9402e';
      ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,244,230,0.9)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      label(ctx, '!', bx, by + 4, { size: 11, color: '#fff', align: 'center', weight: '700' });
    }
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------
// Main entry point — draws the scene in exactly the V4 order:
// backdrop → contact shadows → feathered station paintings → station
// overlays → attention glow → warm grade/vignette → shelf + bins →
// tickets → steam (last, so it reads bright). No vector cook figure is
// drawn anywhere: the chef lives in the plating painting.
// ---------------------------------------------------------------------------

export function drawKitchen(ctx, view) {
  const v = view || {};
  const safeView = {
    kitchen: v.kitchen,
    tickets: v.tickets || [],
    activeTicketId: v.activeTicketId,
    cookX: typeof v.cookX === 'number' ? v.cookX : 1090,
    steamPhase: typeof v.steamPhase === 'number' ? v.steamPhase : 0,
    servedFlash: v.servedFlash,
  };
  const kitchen = safeView.kitchen || {};
  safeView.kitchen = {
    pot: kitchen.pot || { noodle: null, progress: 0, done: false },
    board: kitchen.board || { topping: null, progress: 0 },
    choppedReady: kitchen.choppedReady || new Set(),
    bowl: kitchen.bowl || { broth: null, noodle: null, toppings: [] },
    bowlStepLabel: kitchen.bowlStepLabel,
  };
  const steamPhase = safeView.steamPhase;

  ctx.save();

  // 1. Background.
  drawBackground(ctx, steamPhase);

  // 2. Contact shadows under each station zone.
  for (const name of ['pot', 'board', 'plating', 'pass']) {
    const r = STATIONS[name];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(r.x + r.w / 2, r.y + r.h - 8, r.w / 2 - 6, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3. Station paintings, feathered into the scene (fallback if missing).
  const potR = STATIONS.pot;
  if (!drawArtworkFeathered(ctx, 'pot', potR.x - 10, potR.y - 10, potR.w + 20, potR.h + 20, { feather: 0.22 })) {
    fallbackPot(ctx, potR);
  }
  const boardR = STATIONS.board;
  if (!drawArtworkFeathered(ctx, 'board', boardR.x - 10, boardR.y - 10, boardR.w + 20, boardR.h + 20, { feather: 0.22 })) {
    fallbackBoard(ctx, boardR);
  }
  const platingR = STATIONS.plating;
  if (!drawArtworkFeathered(ctx, 'plating', 618, 392, 320, 300, { feather: 0.22, focusX: 0.52, focusY: 0.40 })) {
    fallbackPlating(ctx, platingR);
  }
  const passR = STATIONS.pass;
  if (!drawArtworkFeathered(ctx, 'pass', passR.x - 10, passR.y - 10, passR.w + 20, passR.h + 20, { feather: 0.22 })) {
    fallbackPass(ctx, passR);
  }

  // 4. Station dynamic overlays (incl. name tags).
  drawPotOverlay(ctx, safeView);
  drawBoardOverlay(ctx, safeView);
  drawPlatingOverlay(ctx, safeView);
  drawPassOverlay(ctx, safeView);

  // 5. Attention glow at the station nearest the cook.
  let nearest = STATIONS.pot;
  let nearestDist = Infinity;
  for (const name of ['pot', 'board', 'plating', 'pass']) {
    const r = STATIONS[name];
    const d = Math.abs(r.x + r.w / 2 - safeView.cookX);
    if (d < nearestDist) { nearestDist = d; nearest = r; }
  }
  glowPool(ctx, nearest.x + nearest.w / 2, nearest.y + nearest.h / 2, 150, 0.13);

  // 6. Warm grade + vignette.
  glowPool(ctx, 330, 120, 260, 0.10, '255,170,80');
  glowPool(ctx, 950, 110, 260, 0.10, '255,170,80');
  ctx.save();
  const vig = ctx.createRadialGradient(640, 380, 0, 640, 380, 840);
  vig.addColorStop(0, 'rgba(24,10,2,0)');
  vig.addColorStop(0.55, 'rgba(24,10,2,0)');
  vig.addColorStop(1, 'rgba(24,10,2,0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.restore();

  // 7. Ingredient shelf + bins.
  drawBins(ctx, safeView);

  // 8. Tickets on their rail.
  drawTickets(ctx, safeView);

  // 9. Steam, drawn last so it reads bright.
  if (safeView.kitchen.pot.noodle) {
    steamCurl(ctx, potR.x + potR.w / 2 - 26, potR.y + 74, steamPhase, 1.2);
    steamCurl(ctx, potR.x + potR.w / 2 + 24, potR.y + 70, steamPhase + 0.42, 1.05);
  }
  if (safeView.kitchen.bowl.broth) {
    steamCurl(ctx, platingR.x + platingR.w / 2 - 8, platingR.y + platingR.h - 92, steamPhase + 0.2, 1.0, 0.3);
  }

  ctx.restore();
}

export default drawKitchen;
