// render.js — All canvas drawing for Rush Hour Ramen.
// Pure canvas vector drawing: no images, no external assets.
// Canvas is 1280×720. Warm night-time ramen-ya: dark wood counter,
// paper-lantern glow, steam.

import {
  BROTHS,
  NOODLES,
  TOPPINGS,
  brothById,
  toppingById,
  describeOrder,
} from './recipes.js';

// ---------------------------------------------------------------------------
// Layout geometry (shared with the input handler)
// ---------------------------------------------------------------------------

const TICKET_X = 24;
const TICKET_Y = 18;
const TICKET_W = 168;
const TICKET_H = 128;
const TICKET_GAP = 12;

const BIN_X = 24;
const BIN_Y = 300;
const BIN_W = 112;
const BIN_H = 48;
const BIN_GAP = 10;

const STATION_Y = 452;
const STATION_H = 216;

const STATIONS = Object.freeze({
  pot: Object.freeze({ x: 60, y: STATION_Y, w: 250, h: STATION_H }),
  board: Object.freeze({ x: 350, y: STATION_Y, w: 250, h: STATION_H }),
  plating: Object.freeze({ x: 640, y: STATION_Y, w: 250, h: STATION_H }),
  pass: Object.freeze({ x: 930, y: STATION_Y, w: 290, h: STATION_H }),
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
      y: BIN_Y,
      w: BIN_W,
      h: BIN_H,
    });
  });
  TOPPINGS.forEach((t, i) => {
    rects.push({
      kind: 'topping',
      id: t.id,
      x: BIN_X + i * (BIN_W + BIN_GAP),
      y: BIN_Y + BIN_H + BIN_GAP,
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
    x: BIN_X, y: BIN_Y, w: BIN_W, h: BIN_H, gap: BIN_GAP,
    row2Y: BIN_Y + BIN_H + BIN_GAP,
    areaY: 300, areaBottom: 412,
  }),
  stations: STATIONS,
  binRects,
  stationRect,
  ticketRect,
});

// ---------------------------------------------------------------------------
// Small drawing helpers
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

function progressBar(ctx, x, y, w, h, frac, fillColor, bg = 'rgba(0,0,0,0.35)') {
  const f = Math.max(0, Math.min(1, frac || 0));
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  if (f > 0) {
    roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
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

function patienceColor(frac) {
  if (frac > 0.5) return '#57c256';
  if (frac > 0.28) return '#e8a33d';
  return '#d9402e';
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

function drawBackground(ctx, steamPhase) {
  // Back wall: warm dark gradient.
  const wall = ctx.createLinearGradient(0, 0, 0, 452);
  wall.addColorStop(0, '#241612');
  wall.addColorStop(0.55, '#3a2115');
  wall.addColorStop(1, '#4a2b18');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 1280, 452);

  // Hanging menu board silhouette (right of the tickets, above bins).
  ctx.save();
  ctx.fillStyle = '#1c110a';
  roundRect(ctx, 940, 168, 300, 104, 8);
  ctx.fill();
  ctx.strokeStyle = '#6b4a26';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#120b06';
  ctx.fillRect(1004, 152, 4, 18);
  ctx.fillRect(1172, 152, 4, 18);
  label(ctx, '— TONIGHT’S RAMEN —', 1090, 196, { size: 14, color: '#e8c872', align: 'center' });
  label(ctx, 'Shoyu · Miso · Spicy · Shio', 1090, 222, { size: 12, color: '#c9a878', align: 'center', weight: '400' });
  label(ctx, 'hand-pulled noodles, made to order', 1090, 246, { size: 11, color: '#a8835c', align: 'center', weight: '400' });
  ctx.restore();

  // Paper lanterns with glow.
  const lanterns = [
    { x: 1050, y: 44, r: 26 },
    { x: 1140, y: 62, r: 20 },
    { x: 1212, y: 40, r: 23 },
    { x: 880, y: 58, r: 18 },
  ];
  for (let i = 0; i < lanterns.length; i += 1) {
    const L = lanterns[i];
    const flicker = 1 + Math.sin(steamPhase * 1.7 + i * 1.9) * 0.05;
    ctx.save();
    const glow = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 3.2 * flicker);
    glow.addColorStop(0, 'rgba(255,180,80,0.38)');
    glow.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(L.x, L.y, L.r * 3.2 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,5,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L.x, 0);
    ctx.lineTo(L.x, L.y - L.r);
    ctx.stroke();
    const body = ctx.createRadialGradient(L.x - L.r * 0.3, L.y - L.r * 0.3, 2, L.x, L.y, L.r);
    body.addColorStop(0, '#ffe9b0');
    body.addColorStop(0.6, '#ffb84d');
    body.addColorStop(1, '#e07f2e');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(L.x, L.y, L.r * 0.82, L.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,80,20,0.55)';
    ctx.lineWidth = 1;
    for (const t of [-0.55, 0, 0.55]) {
      ctx.beginPath();
      ctx.ellipse(L.x, L.y, Math.abs(L.r * 0.82 * Math.cos(Math.asin(t))) || 1, L.r, 0, 0, Math.PI * 2);
      ctx.moveTo(L.x + t * L.r * 0.82, L.y - L.r * 0.92);
      ctx.lineTo(L.x + t * L.r * 0.82, L.y + L.r * 0.92);
      ctx.stroke();
    }
    ctx.fillStyle = '#5a3410';
    ctx.fillRect(L.x - 8, L.y - L.r - 3, 16, 6);
    ctx.fillRect(L.x - 8, L.y + L.r - 3, 16, 6);
    ctx.restore();
  }

  // Wooden counter band across the lower half.
  const counter = ctx.createLinearGradient(0, 430, 0, 690);
  counter.addColorStop(0, '#7a4e28');
  counter.addColorStop(0.12, '#8a5a30');
  counter.addColorStop(1, '#5d3a1e');
  ctx.fillStyle = counter;
  ctx.fillRect(0, 430, 1280, 260);
  ctx.save();
  ctx.strokeStyle = 'rgba(50,28,10,0.35)';
  ctx.lineWidth = 1;
  for (const yy of [478, 540, 604]) {
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(1280, yy);
    ctx.stroke();
  }
  ctx.fillStyle = '#9c6c3a';
  ctx.fillRect(0, 430, 1280, 10);
  ctx.fillStyle = 'rgba(255,220,160,0.25)';
  ctx.fillRect(0, 430, 1280, 3);
  ctx.restore();

  // Floor strip at the very bottom.
  ctx.fillStyle = '#1a0f08';
  ctx.fillRect(0, 690, 1280, 30);
  ctx.fillStyle = 'rgba(255,190,110,0.08)';
  ctx.fillRect(0, 690, 1280, 4);
}

// ---------------------------------------------------------------------------
// Order board / tickets
// ---------------------------------------------------------------------------

function drawTickets(ctx, view) {
  const { tickets = [], activeTicketId, steamPhase = 0 } = view;
  // Corkboard strip across the top.
  ctx.save();
  const cork = ctx.createLinearGradient(0, 0, 0, 160);
  cork.addColorStop(0, '#8a6238');
  cork.addColorStop(1, '#6f4c28');
  ctx.fillStyle = cork;
  ctx.fillRect(0, 0, 1280, 160);
  ctx.fillStyle = '#4e3319';
  ctx.fillRect(0, 156, 1280, 5);
  ctx.fillStyle = 'rgba(255,230,180,0.10)';
  for (let i = 0; i < 60; i += 1) {
    const px = (i * 211) % 1280;
    const py = (i * 67) % 156;
    ctx.fillRect(px, py, 3, 2);
  }
  ctx.restore();

  tickets.forEach((ticket, i) => {
    const r = ticketRect(i);
    const active = ticket.id === activeTicketId;
    const frac = ticket.patienceMax > 0 ? ticket.patience / ticket.patienceMax : 0;
    const low = frac <= 0.28;
    const flash = low && Math.sin(steamPhase * 7) > 0;

    ctx.save();
    // Card shadow + paper.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, r.x + 3, r.y + 4, r.w, r.h, 6);
    ctx.fill();
    const paper = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    paper.addColorStop(0, '#fff8e6');
    paper.addColorStop(1, '#f3e3bd');
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fillStyle = paper;
    ctx.fill();
    ctx.lineWidth = active ? 4 : 1.5;
    ctx.strokeStyle = active ? '#f2b33d' : 'rgba(120,90,50,0.5)';
    ctx.stroke();
    if (flash) {
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.strokeStyle = '#d9402e';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // Pin.
    ctx.fillStyle = active ? '#d9402e' : '#8a5a30';
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + 7, 4, 0, Math.PI * 2);
    ctx.fill();

    // Layout: the patience bar owns a fixed slot at the very bottom of
    // the card, and the whole text block must fit above it. Tall tickets
    // (many description lines) tighten their spacing and shrink the
    // description type slightly so the last line always clears the bar.
    const lines = describeOrder(ticket);
    const barY = r.y + r.h - 16;
    const tall = lines.length > 5;
    const nameBaseline = tall ? r.y + 23 : r.y + 26;
    const metaBaseline = tall ? r.y + 36 : r.y + 42;
    const descFirstBaseline = tall ? r.y + 49 : r.y + 60;
    const descLastMax = barY - 5; // last baseline stays clear of the bar
    let descSize = 10;
    let descLineHeight = 12;
    if (lines.length > 1) {
      const maxLineHeight = (descLastMax - descFirstBaseline) / (lines.length - 1);
      if (maxLineHeight < descLineHeight) {
        descLineHeight = maxLineHeight;
        descSize = Math.max(7.5, Math.min(10, descLineHeight - 1.5));
      }
    }

    // Item name (shrink to fit).
    ctx.fillStyle = '#33200e';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let size = tall ? 12 : 13;
    ctx.font = `700 ${size}px sans-serif`;
    while (ctx.measureText(ticket.item).width > r.w - 16 && size > 9) {
      size -= 1;
      ctx.font = `700 ${size}px sans-serif`;
    }
    ctx.fillText(ticket.item, r.x + 8, nameBaseline);
    label(ctx, `#${ticket.id}  ·  $${Number(ticket.price).toFixed(2)}`, r.x + 8, metaBaseline, { size: 10, color: '#8a6a3d', weight: '600' });

    // Recipe lines in small type, fitted above the patience bar.
    lines.forEach((line, li) => {
      label(ctx, `• ${line}`, r.x + 10, descFirstBaseline + li * descLineHeight, { size: descSize, color: '#5a4020', weight: '400' });
    });

    // Patience bar: fixed bottom slot, a few px above the card edge.
    const barColor = flash ? '#ff5a3c' : patienceColor(frac);
    progressBar(ctx, r.x + 8, barY, r.w - 16, 9, frac, barColor, 'rgba(60,35,10,0.25)');
    ctx.restore();
  });

  if (!tickets.length) {
    label(ctx, 'No orders yet — the calm before the rush…', 36, 88, { size: 14, color: '#ffe9bd' });
  }
}

// ---------------------------------------------------------------------------
// Ingredient bins
// ---------------------------------------------------------------------------

function drawBins(ctx, view) {
  const kitchen = view.kitchen;
  const choppingId = kitchen && kitchen.board ? kitchen.board.topping : null;

  // Shelf panel behind the bins.
  ctx.save();
  ctx.fillStyle = 'rgba(20,11,5,0.45)';
  roundRect(ctx, 12, 284, 892, 140, 10);
  ctx.fill();
  ctx.restore();
  label(ctx, 'INGREDIENTS — tap a bin', 24, 296, { size: 11, color: '#e8c872' });

  for (const bin of binRects()) {
    const dimmed = bin.kind === 'topping' && bin.id === choppingId;
    ctx.save();
    if (dimmed) ctx.globalAlpha = 0.38;

    const wood = ctx.createLinearGradient(bin.x, bin.y, bin.x, bin.y + bin.h);
    wood.addColorStop(0, '#6b4423');
    wood.addColorStop(1, '#4e3016');
    roundRect(ctx, bin.x, bin.y, bin.w, bin.h, 7);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = dimmed ? '#555' : '#9c6c3a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Colour swatch.
    const cx = bin.x + 20;
    const cy = bin.y + bin.h / 2;
    if (bin.kind === 'broth') {
      const broth = brothById(bin.id);
      ctx.fillStyle = '#c8ccd2';
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = broth ? broth.color : '#888';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (bin.kind === 'noodle') {
      ctx.strokeStyle = '#f5d98b';
      ctx.lineWidth = 2;
      for (let s = -2; s <= 2; s += 1) {
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + s * 5);
        ctx.bezierCurveTo(cx - 4, cy + s * 5 - 4, cx + 4, cy + s * 5 + 4, cx + 10, cy + s * 5);
        ctx.stroke();
      }
    } else {
      const topping = toppingById(bin.id);
      ctx.fillStyle = topping ? topping.color : '#888';
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (bin.id === 'ajitama') {
        ctx.fillStyle = '#fff6dd';
        ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f28c28';
        ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, Math.PI * 2); ctx.fill();
      } else if (bin.id === 'nori') {
        ctx.fillStyle = '#2e4a38';
        ctx.fillRect(cx - 7, cy - 9, 14, 18);
      }
    }

    // Name in small caps (two lines if needed).
    const item = bin.kind === 'broth'
      ? brothById(bin.id)
      : bin.kind === 'topping'
        ? toppingById(bin.id)
        : null;
    const rawName = item ? item.name : (bin.id === 'thin' ? 'Thin Noodles' : bin.id === 'classic' ? 'Classic Noodles' : bin.id === 'thick' ? 'Thick Noodles' : bin.id);
    const words = rawName.toUpperCase().split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > 11 && cur) { lines.push(cur); cur = w; } else { cur = (cur + ' ' + w).trim(); }
    }
    if (cur) lines.push(cur);
    lines.slice(0, 2).forEach((line, li) => {
      label(ctx, line, bin.x + 38, bin.y + (lines.length > 1 ? 22 + li * 13 : 29), { size: 9.5, color: dimmed ? '#999' : '#f5e6c8' });
    });
    if (dimmed) {
      label(ctx, 'CHOPPING…', bin.x + 38, bin.y + bin.h - 5, { size: 8, color: '#ffb0a0' });
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Stations (shared frame)
// ---------------------------------------------------------------------------

function stationFrame(ctx, name, title, accent) {
  const r = stationRect(name);
  ctx.save();
  ctx.fillStyle = 'rgba(24,13,6,0.55)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,170,100,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  label(ctx, title, r.x + r.w / 2, r.y + 24, { size: 13, color: accent, align: 'center' });
  ctx.restore();
  return r;
}

function drawPot(ctx, view) {
  const r = stationFrame(ctx, 'pot', '🍜  NOODLE POT', '#ffd98a');
  const kitchen = view.kitchen;
  const pot = kitchen.pot;
  const cx = r.x + r.w / 2;
  const cy = r.y + 118;
  const steamPhase = view.steamPhase || 0;

  // Burner glow.
  ctx.save();
  ctx.fillStyle = pot.noodle ? 'rgba(255,110,40,0.5)' : 'rgba(120,60,20,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 52, 62, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pot body (steel).
  const steel = ctx.createLinearGradient(cx - 78, cy, cx + 78, cy);
  steel.addColorStop(0, '#8f979f');
  steel.addColorStop(0.3, '#d7dde2');
  steel.addColorStop(0.7, '#aeb6bd');
  steel.addColorStop(1, '#767e86');
  ctx.fillStyle = steel;
  roundRect(ctx, cx - 78, cy - 34, 156, 84, 12);
  ctx.fill();
  ctx.strokeStyle = '#565e66';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Handles.
  ctx.strokeStyle = '#565e66';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx - 84, cy + 4, 10, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 84, cy + 4, 10, Math.PI * 1.5, Math.PI * 0.5); ctx.stroke();
  // Water surface.
  ctx.fillStyle = pot.noodle ? '#e8b64c' : '#7d8b91';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 30, 72, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  if (pot.noodle) {
    // Bubbles.
    ctx.fillStyle = 'rgba(255,246,210,0.75)';
    for (let i = 0; i < 7; i += 1) {
      const bx = cx - 52 + ((i * 37 + Math.sin(steamPhase * 3 + i) * 6 + 60) % 104);
      const by = cy - 32 + Math.sin(steamPhase * 4 + i * 1.7) * 3;
      ctx.beginPath();
      ctx.arc(bx, by, 2.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    // Noodle strands.
    ctx.strokeStyle = '#f7dc8f';
    ctx.lineWidth = 2.5;
    for (let s = 0; s < 5; s += 1) {
      const off = -36 + s * 18;
      ctx.beginPath();
      ctx.moveTo(cx + off, cy - 36);
      ctx.bezierCurveTo(cx + off + 8, cy - 22, cx + off - 8, cy - 10, cx + off + 3, cy + 2);
      ctx.stroke();
    }
    // Steam puffs animated by steamPhase.
    for (let i = 0; i < 3; i += 1) {
      const t = ((steamPhase * 0.55 + i / 3) % 1);
      steamPuff(ctx, cx - 22 + i * 22 + Math.sin(steamPhase * 2 + i * 2) * 6, cy - 52 - t * 34, 9 + t * 13, 0.5 * (1 - t));
    }
    // Circular progress ring.
    const ringX = cx + 96;
    const ringY = cy - 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(ringX, ringY, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = pot.done ? '#57c256' : '#f2b33d';
    ctx.beginPath();
    ctx.arc(ringX, ringY, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, pot.progress)));
    ctx.stroke();
    if (pot.done) {
      ctx.fillStyle = '#57c256';
      roundRect(ctx, ringX - 26, ringY + 24, 52, 18, 5);
      ctx.fill();
      label(ctx, 'READY', ringX, ringY + 37, { size: 11, color: '#fff', align: 'center' });
    }
  } else {
    label(ctx, 'drop noodles in', cx, cy + 14, { size: 11, color: '#e8ddc8', align: 'center', weight: '400' });
  }
  ctx.restore();
}

function drawBoard(ctx, view) {
  const r = stationFrame(ctx, 'board', 'CHOPPING BOARD', '#ffd98a');
  const kitchen = view.kitchen;
  const board = kitchen.board;
  const cx = r.x + r.w / 2;
  const cy = r.y + 122;

  // Wooden board.
  ctx.save();
  const wood = ctx.createLinearGradient(cx - 95, cy, cx + 95, cy);
  wood.addColorStop(0, '#c99a5b');
  wood.addColorStop(1, '#a87c40');
  ctx.fillStyle = wood;
  roundRect(ctx, cx - 95, cy - 38, 190, 76, 12);
  ctx.fill();
  ctx.strokeStyle = '#7d5a28';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(125,90,40,0.4)';
  ctx.lineWidth = 1;
  for (const off of [-20, 0, 20]) {
    ctx.beginPath(); ctx.moveTo(cx - 86, cy + off); ctx.lineTo(cx + 86, cy + off); ctx.stroke();
  }

  if (board.topping) {
    const topping = toppingById(board.topping);
    const color = topping ? topping.color : '#ccc';
    const pieces = 2 + Math.floor(board.progress * 7);
    // Whole piece shrinking + chopped pieces multiplying.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx - 42, cy, 20 - board.progress * 10, 13 - board.progress * 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < pieces; i += 1) {
      const px = cx - 8 + (i % 4) * 18;
      const py = cy - 14 + Math.floor(i / 4) * 20;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(i * 0.7);
      ctx.fillStyle = color;
      ctx.fillRect(-6, -3.5, 12, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(-6, -3.5, 12, 2);
      ctx.restore();
    }
    // Knife, rocking with progress.
    const rock = Math.sin((view.steamPhase || 0) * 9) * 0.18;
    ctx.save();
    ctx.translate(cx + 52, cy - 22);
    ctx.rotate(-0.5 + rock);
    ctx.fillStyle = '#d7dde2';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(44, 6); ctx.lineTo(42, 18); ctx.lineTo(2, 14); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a3220';
    roundRect(ctx, -16, 2, 18, 9, 4);
    ctx.fill();
    ctx.restore();
    label(ctx, topping ? topping.name : board.topping, cx, cy + 58, { size: 11, color: '#ffe9bd', align: 'center', weight: '400' });
    progressBar(ctx, cx - 70, cy + 66, 140, 8, board.progress, '#e8a33d');
  } else {
    label(ctx, 'chop scallions & menma here', cx, cy + 4, { size: 11, color: '#5a4020', align: 'center', weight: '400' });
  }
  ctx.restore();

  // Side dish of chopped toppings waiting.
  const ready = kitchen.choppedReady ? [...kitchen.choppedReady] : [];
  if (ready.length) {
    ctx.save();
    const dx = r.x + r.w - 44;
    const dy = r.y + 52;
    ctx.fillStyle = '#eef1f3';
    ctx.beginPath(); ctx.ellipse(dx, dy, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b9c0c6'; ctx.lineWidth = 1.5; ctx.stroke();
    ready.forEach((id, i) => {
      const t = toppingById(id);
      ctx.fillStyle = t ? t.color : '#999';
      for (let k = 0; k < 4; k += 1) {
        ctx.fillRect(dx - 18 + i * 14 + (k % 2) * 6, dy - 8 + Math.floor(k / 2) * 6, 7, 4);
      }
    });
    label(ctx, 'ready', dx, dy + 26, { size: 9, color: '#ffe9bd', align: 'center', weight: '400' });
    ctx.restore();
  }
}

// Garnish painters for the plating bowl, keyed by topping id.
function drawGarnish(ctx, id, cx, cy) {
  ctx.save();
  if (id === 'ajitama') {
    // Halved egg with yolk.
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath(); ctx.ellipse(cx - 26, cy - 8, 15, 10, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f28c28';
    ctx.beginPath(); ctx.arc(cx - 26, cy - 8, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath(); ctx.ellipse(cx + 30, cy + 8, 13, 9, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f28c28';
    ctx.beginPath(); ctx.arc(cx + 30, cy + 8, 4.8, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'chashu') {
    // Pink-brown slices.
    for (const [ox, oy, rot] of [[-8, 10, 0.3], [16, -12, -0.2]]) {
      ctx.save(); ctx.translate(cx + ox, cy + oy); ctx.rotate(rot);
      ctx.fillStyle = '#b5654d';
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8a58c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'scallions') {
    ctx.fillStyle = '#3f9e4d';
    for (let i = 0; i < 12; i += 1) {
      const a = i * 2.4;
      ctx.fillRect(cx + Math.cos(a) * 30 - 2, cy + Math.sin(a * 1.3) * 12 - 1.5, 5, 3);
    }
  } else if (id === 'corn') {
    ctx.fillStyle = '#f7d154';
    ctx.strokeStyle = '#d9a92e'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 10; i += 1) {
      const kx = cx - 44 + (i % 5) * 10;
      const ky = cy + 14 + Math.floor(i / 5) * 8;
      ctx.beginPath(); ctx.arc(kx, ky, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  } else if (id === 'nori') {
    // Dark sheets at the rim.
    ctx.fillStyle = '#1f3527';
    ctx.save(); ctx.translate(cx + 40, cy - 20); ctx.rotate(0.25); ctx.fillRect(-9, -16, 18, 26); ctx.restore();
    ctx.save(); ctx.translate(cx + 54, cy - 12); ctx.rotate(0.5); ctx.fillRect(-8, -14, 16, 23); ctx.restore();
    ctx.fillStyle = 'rgba(120,180,130,0.35)';
    ctx.fillRect(cx + 33, cy - 32, 3, 20);
  } else if (id === 'menma') {
    ctx.strokeStyle = '#c9a35f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx - 52 + i * 7, cy - 16 + i * 3);
      ctx.lineTo(cx - 44 + i * 7, cy + 2 + i * 3);
      ctx.stroke();
    }
  } else if (id === 'chili-oil') {
    // Red drizzle.
    ctx.strokeStyle = '#d63a22';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 38, cy - 4);
    ctx.bezierCurveTo(cx - 14, cy - 16, cx + 10, cy + 8, cx + 38, cy - 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy + 12);
    ctx.bezierCurveTo(cx - 6, cy + 2, cx + 14, cy + 18, cx + 32, cy + 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(214,58,34,0.5)';
    ctx.beginPath(); ctx.arc(cx + 4, cy - 14, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    const t = toppingById(id);
    ctx.fillStyle = t ? t.color : '#ccc';
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBowlContents(ctx, bowl, cx, cy, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  // Bowl body.
  ctx.fillStyle = '#274b73';
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0.08 * Math.PI, 0.92 * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1d3857';
  ctx.fillRect(cx - 26, cy + 56, 52, 8);
  // Rim + soup surface.
  ctx.fillStyle = '#f3ead6';
  ctx.beginPath(); ctx.ellipse(cx, cy, 66, 22, 0, 0, Math.PI * 2); ctx.fill();
  const broth = bowl.broth ? brothById(bowl.broth) : null;
  ctx.fillStyle = broth ? broth.color : '#d9d2c2';
  ctx.beginPath(); ctx.ellipse(cx, cy, 58, 18, 0, 0, Math.PI * 2); ctx.fill();
  if (broth) {
    ctx.fillStyle = 'rgba(255,235,190,0.28)';
    ctx.beginPath(); ctx.ellipse(cx - 16, cy - 5, 22, 6, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  // Noodles: wavy strands.
  if (bowl.noodle) {
    ctx.strokeStyle = '#f7dc8f';
    ctx.lineWidth = 2.5;
    for (let s = 0; s < 6; s += 1) {
      const off = -34 + s * 13;
      ctx.beginPath();
      ctx.moveTo(cx + off, cy - 10);
      ctx.bezierCurveTo(cx + off + 9, cy - 2, cx + off - 9, cy + 4, cx + off + 2, cy + 11);
      ctx.stroke();
    }
  }
  // Toppings, each its own garnish.
  for (const id of bowl.toppings || []) drawGarnish(ctx, id, cx, cy);
  // Chopsticks when there is anything in the bowl.
  if (bowl.broth || bowl.noodle) {
    ctx.strokeStyle = '#8a5a30';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + 30, cy - 14); ctx.lineTo(cx + 74, cy - 52); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 40, cy - 8); ctx.lineTo(cx + 86, cy - 40); ctx.stroke();
  }
  ctx.restore();
}

function drawPlating(ctx, view) {
  const r = stationFrame(ctx, 'plating', 'PLATING', '#ffd98a');
  const kitchen = view.kitchen;
  const cx = r.x + r.w / 2;
  const cy = r.y + 108;
  drawBowlContents(ctx, kitchen.bowl, cx, cy, 1);
  // Step label beside / under the bowl.
  let step = '';
  try { step = kitchen.bowlStepLabel ? kitchen.bowlStepLabel() : ''; } catch { step = ''; }
  if (step) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, cx - 72, r.y + r.h - 38, 144, 24, 12);
    ctx.fill();
    label(ctx, `next: ${step}`, cx, r.y + r.h - 22, { size: 12, color: '#ffe9bd', align: 'center' });
    ctx.restore();
  }
}

function drawPass(ctx, view) {
  const r = stationFrame(ctx, 'pass', 'SERVE  →', '#ffb84d');
  const cx = r.x + r.w / 2;
  // Shelf.
  ctx.save();
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(r.x + 18, r.y + 138, r.w - 36, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(r.x + 18, r.y + 148, r.w - 36, 4);
  // Bell.
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.arc(cx + 88, r.y + 62, 13, Math.PI, 0); ctx.fill();
  ctx.fillRect(cx + 75, r.y + 62, 26, 4);
  ctx.fillStyle = '#8a5a30';
  ctx.beginPath(); ctx.arc(cx + 88, r.y + 52, 3.5, 0, Math.PI * 2); ctx.fill();
  label(ctx, 'ring when ready!', cx + 88, r.y + 88, { size: 9, color: '#c9a878', align: 'center', weight: '400' });
  ctx.restore();

  const flash = view.servedFlash;
  if (typeof flash === 'number' && flash > 0) {
    const a = Math.max(0, Math.min(1, flash));
    ctx.save();
    ctx.globalAlpha = a;
    const pop = 0.9 + 0.1 * a;
    drawBowlContents(ctx, { broth: 'miso', noodle: 'classic', toppings: ['ajitama', 'scallions'] }, cx - 28, r.y + 108, pop * 0.92);
    // Sparkles.
    ctx.fillStyle = '#ffe066';
    const sparkles = [[-92, 58], [-6, 40], [-110, 108], [30, 84]];
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
    label(ctx, 'SERVED!', cx - 28, r.y + 178, { size: 14, color: '#ffe066', align: 'center' });
    ctx.restore();
  } else {
    label(ctx, 'finished bowls land here', cx, r.y + 122, { size: 11, color: '#c9a878', align: 'center', weight: '400' });
  }
}

// ---------------------------------------------------------------------------
// The cook
// ---------------------------------------------------------------------------

function drawCook(ctx, view) {
  // The cook stands in the STATIONS band, in front of the station panels:
  // feet at y≈676 and total height ≈130px, so the sprite lives entirely
  // within y ≈ 546–676 and never overlaps the ingredient bins (y 300–412).
  // He is centred about 100px LEFT of the cookX anchor so that at a station
  // he stands beside the pot / board / bowl art, tending it, instead of
  // covering its centre (100px also keeps his body clear of the plating
  // station's "next: …" step pill).
  const anchorX = typeof view.cookX === 'number' ? view.cookX : 1090;
  const x = anchorX - 100;
  const bob = Math.sin((view.steamPhase || 0) * 2.2) * 3;
  const baseY = 676 + bob; // feet at the bottom of the stations band
  ctx.save();
  ctx.translate(x, baseY);

  // Apron body.
  const bodyGrad = ctx.createLinearGradient(0, -74, 0, 0);
  bodyGrad.addColorStop(0, '#f5f0e6');
  bodyGrad.addColorStop(1, '#d9d2c0');
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, -26, -74, 52, 74, 12);
  ctx.fill();
  ctx.fillStyle = '#c1272d'; // apron
  roundRect(ctx, -18, -48, 36, 48, 6);
  ctx.fill();
  ctx.fillStyle = '#e8b64c';
  ctx.fillRect(-18, -48, 36, 4);
  label(ctx, '麺', 0, -18, { size: 13, color: '#ffe9bd', align: 'center' });
  // Arms.
  ctx.strokeStyle = '#f5f0e6';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-24, -64); ctx.lineTo(-40, -34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24, -64); ctx.lineTo(40, -37 + Math.sin((view.steamPhase || 0) * 3) * 3); ctx.stroke();
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath(); ctx.arc(-41, -32, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(41, -35 + Math.sin((view.steamPhase || 0) * 3) * 3, 5.5, 0, Math.PI * 2); ctx.fill();

  // Head.
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath(); ctx.arc(0, -94, 21, 0, Math.PI * 2); ctx.fill();
  // Rosy cheeks + face.
  ctx.fillStyle = 'rgba(230,120,90,0.45)';
  ctx.beginPath(); ctx.arc(-11, -87, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(11, -87, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b1a10';
  ctx.beginPath(); ctx.arc(-7, -96, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(7, -96, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2b1a10';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, -90, 6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  // Brows.
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-11, -103); ctx.lineTo(-3, -104.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -104.5); ctx.lineTo(11, -103); ctx.stroke();

  // White cap (hachimaki-style toque) with red band.
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, -22, -120, 44, 18, 7);
  ctx.fill();
  ctx.fillStyle = '#eef1f3';
  roundRect(ctx, -15, -130, 30, 12, 6);
  ctx.fill();
  ctx.fillStyle = '#c1272d';
  ctx.fillRect(-22, -106, 44, 4);
  ctx.restore();

  // A wisp of steam drifting past the cook, down by the stations.
  steamPuff(ctx, x - 46, 606 + bob + Math.sin((view.steamPhase || 0) * 1.4) * 5, 11, 0.22);
}

// ---------------------------------------------------------------------------
// Main entry point
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
  ctx.save();
  drawBackground(ctx, safeView.steamPhase);
  drawTickets(ctx, safeView);
  drawBins(ctx, safeView);
  drawPot(ctx, safeView);
  drawBoard(ctx, safeView);
  drawPlating(ctx, safeView);
  drawPass(ctx, safeView);
  drawCook(ctx, safeView);
  ctx.restore();
}

export default drawKitchen;
