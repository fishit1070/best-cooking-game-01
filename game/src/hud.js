// hud.js — Overlay drawing for Rush Hour Ramen: score HUD, day progress,
// transient banners, the title screen and the end-of-day results receipt.
// Pure canvas drawing on the same 1280×720 canvas as render.js.
// V4 scene-first: the HUD is made of objects inside the kitchen scene —
// a twine day-string with a travelling sun/moon charm, a standing wooden
// score sign in the foreground, hanging paper/wood signs — never flat
// dashboard bars or floating panels. Warm ramen-ya styling: cream paper,
// red-brown ink, gold accents, chalk on dark wood.

const CANVAS_W = 1280;
const CANVAS_H = 720;

const INK = '#4a2410';
const INK_SOFT = '#7a4a22';
const PAPER = '#fff8e6';
const PAPER_DARK = '#f3e3bd';
const GOLD = '#e8b64c';
const GOLD_BRIGHT = '#ffd98a';
const RED = '#c1272d';
const GREEN = '#2e7d32';
const CHALK = '#f5e6c8';
const CHALK_RED = '#e88a7a';

// ---------------------------------------------------------------------------
// Small drawing helpers (kept local, mirroring render.js)
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

function label(ctx, text, x, y, { size = 12, color = '#f5e6c8', align = 'left', weight = '600', font = 'sans-serif', style = '' } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${style ? `${style} ` : ''}${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function dimScene(ctx, alpha = 0.72) {
  ctx.save();
  ctx.fillStyle = `rgba(12,6,3,${alpha})`;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
}

// Radial pool of warm (or pale) light, fading to transparent at radius r.
function glowPool(ctx, x, y, r, rgb, alpha) {
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

// A crescent moon: a pale disc with an offset cut-out circle laid over it
// (the same drawn-crescent technique as v3 — never a glyph).
function crescentMoon(ctx, cx, cy, r, cutColor) {
  ctx.save();
  ctx.fillStyle = '#e8ecf5';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cutColor;
  ctx.beginPath();
  ctx.arc(cx + r * 0.38, cy - r * 0.24, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// In-game HUD
// ---------------------------------------------------------------------------

// The day string: a piece of twine sagging on a quadratic curve under the
// ticket rail, with a sun/moon charm travelling along it by dayFrac, and
// the rush label on a small dark-wood hanging tag at the left.
function drawDayProgress(ctx, view) {
  const frac = clamp01(view.dayFrac);
  const rushLabel = view.rushLabel || '';

  // Twine endpoints and the sagging control point between them.
  const p0 = { x: 196, y: 160 };
  const pc = { x: 726, y: 174 };
  const p1 = { x: 1256, y: 152 };

  ctx.save();
  // The twine itself: a soft shadow pass, then the fibre line.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y + 2);
  ctx.quadraticCurveTo(pc.x, pc.y + 2, p1.x, p1.y + 2);
  ctx.stroke();
  ctx.strokeStyle = '#c9a35f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(pc.x, pc.y, p1.x, p1.y);
  ctx.stroke();

  // Small peg dots at both ends of the string.
  ctx.fillStyle = '#5a3410';
  for (const p of [p0, p1]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(p.x - 1, p.y - 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3410';
  }
  ctx.restore();

  // Sun/moon charm travelling along the quadratic curve by dayFrac.
  const t = frac;
  const mt = 1 - t;
  const charmX = mt * mt * p0.x + 2 * mt * t * pc.x + t * t * p1.x;
  const charmY = mt * mt * p0.y + 2 * mt * t * pc.y + t * t * p1.y;
  ctx.save();
  if (frac < 0.5) {
    // Gold sun disc with short rays.
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(charmX + Math.cos(a) * 11, charmY + Math.sin(a) * 11);
      ctx.lineTo(charmX + Math.cos(a) * 14.5, charmY + Math.sin(a) * 14.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(charmX, charmY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(122,74,34,0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    // Pale moon disc with a crescent cut-out.
    crescentMoon(ctx, charmX, charmY, 9, 'rgba(24,20,44,0.55)');
  }
  ctx.restore();

  // Tiny crescent moon sitting at the string's right end — where the day
  // is heading.
  crescentMoon(ctx, 1268, 152, 7, 'rgba(24,20,44,0.55)');

  // Rush label on a small dark-wood hanging tag at the left.
  const tagX = 16;
  const tagY = 146;
  const tagW = 172;
  const tagH = 26;
  ctx.save();
  // Two short strings up from the tag.
  ctx.strokeStyle = 'rgba(20,10,5,0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(tagX + 18, tagY + 2);
  ctx.lineTo(tagX + 18, 138);
  ctx.moveTo(tagX + tagW - 18, tagY + 2);
  ctx.lineTo(tagX + tagW - 18, 138);
  ctx.stroke();
  // Shadow + dark wood tag.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, tagX + 2, tagY + 3, tagW, tagH, 5);
  ctx.fill();
  const tagWood = ctx.createLinearGradient(tagX, tagY, tagX, tagY + tagH);
  tagWood.addColorStop(0, '#4a2c15');
  tagWood.addColorStop(1, '#2a1709');
  roundRect(ctx, tagX, tagY, tagW, tagH, 5);
  ctx.fillStyle = tagWood;
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,162,77,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (rushLabel) {
    label(ctx, rushLabel, tagX + tagW / 2, tagY + 18, {
      size: 11, color: CHALK, align: 'center', weight: '700',
    });
  }
  ctx.restore();
}

// One teardrop flame tongue: pointed tip at the top, rounded base.
function flameShape(ctx, cx, baseY, w, h) {
  ctx.beginPath();
  ctx.moveTo(cx, baseY - h);
  ctx.bezierCurveTo(cx + w * 0.55, baseY - h * 0.6, cx + w * 0.5, baseY - h * 0.22, cx, baseY);
  ctx.bezierCurveTo(cx - w * 0.5, baseY - h * 0.22, cx - w * 0.55, baseY - h * 0.6, cx, baseY - h);
  ctx.closePath();
}

// Layered combo flame: orange outer, yellow inner, near-white core. Height
// grows with the combo count (capped) and flickers via view.comboFrac.
function drawComboFlame(ctx, cx, baseY, combo, comboFrac) {
  const flicker = Math.sin(clamp01(comboFrac) * Math.PI * 4) * 1.6;
  const h = Math.min(27, 15 + combo * 1.6) + flicker;
  const w = 15 + Math.min(5, combo * 0.5);
  ctx.save();
  ctx.fillStyle = '#e8641e';
  flameShape(ctx, cx, baseY, w, h);
  ctx.fill();
  ctx.fillStyle = '#f6b73c';
  flameShape(ctx, cx, baseY, w * 0.66, h * 0.66);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  flameShape(ctx, cx, baseY, w * 0.36, h * 0.4);
  ctx.fill();
  ctx.restore();
}

// The score as a STANDING wooden sign in the bottom-left foreground: it
// stands in front of the counter on two small angled feet, chalk writing
// in one row — earned / served / lost, plus the combo group when lit.
function drawScorePanel(ctx, view) {
  const money = view.money ?? 0;
  const served = view.served ?? 0;
  const lost = view.lost ?? 0;
  const combo = view.combo ?? 0;
  const showCombo = combo >= 2;

  const signX = 18;
  const signY = 662;
  const signW = 610;
  const signH = 52;

  ctx.save();
  // Two small angled feet at the bottom corners, planted on the floor.
  ctx.fillStyle = '#2a1708';
  for (const fx of [signX + 26, signX + signW - 62]) {
    ctx.beginPath();
    ctx.moveTo(fx, signY + signH - 2);
    ctx.lineTo(fx + 36, signY + signH - 2);
    ctx.lineTo(fx + 44, CANVAS_H);
    ctx.lineTo(fx - 8, CANVAS_H);
    ctx.closePath();
    ctx.fill();
  }

  // Shadow + dark wood board.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, signX + 3, signY + 4, signW, signH, 8);
  ctx.fill();
  const wood = ctx.createLinearGradient(signX, signY, signX, signY + signH);
  wood.addColorStop(0, '#5d3a1e');
  wood.addColorStop(0.5, '#472a12');
  wood.addColorStop(1, '#331c09');
  roundRect(ctx, signX, signY, signW, signH, 8);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Gold pin-line inset.
  ctx.strokeStyle = 'rgba(232,182,76,0.45)';
  ctx.lineWidth = 1;
  roundRect(ctx, signX + 6, signY + 6, signW - 12, signH - 12, 5);
  ctx.stroke();
  // Four corner bolts.
  ctx.fillStyle = GOLD;
  for (const [bx, by] of [
    [signX + 13, signY + 13],
    [signX + signW - 13, signY + 13],
    [signX + 13, signY + signH - 13],
    [signX + signW - 13, signY + signH - 13],
  ]) {
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chalk row, vertically centred on the board. Widths are measured so
  // the combo group fits into the same sign — spacing shrinks to fit.
  const earnedText = `EARNED ¥${money}`;
  const servedText = `SERVED ${served}`;
  const lostText = `LOST ${lost}`;
  const comboText = showCombo ? `COMBO ×${combo}` : '';
  let size = 15;
  const measureRow = (s) => {
    ctx.font = `700 ${s}px sans-serif`;
    const flameW = showCombo ? 24 : 0;
    return ctx.measureText(earnedText).width
      + ctx.measureText(servedText).width
      + ctx.measureText(lostText).width
      + (showCombo ? flameW + ctx.measureText(comboText).width : 0);
  };
  let gap = showCombo ? 26 : 40;
  while (size > 12 && measureRow(size) + gap * (showCombo ? 3 : 2) > signW - 52) {
    size -= 1;
  }
  if (measureRow(size) + gap * (showCombo ? 3 : 2) > signW - 52) {
    gap = Math.max(12, Math.floor((signW - 52 - measureRow(size)) / (showCombo ? 3 : 2)));
  }

  const textY = signY + signH / 2 + size * 0.36;
  let cursor = signX + 26;
  ctx.font = `700 ${size}px sans-serif`;
  label(ctx, earnedText, cursor, textY, { size, color: CHALK, weight: '700' });
  cursor += ctx.measureText(earnedText).width + gap;
  label(ctx, servedText, cursor, textY, { size, color: CHALK, weight: '700' });
  cursor += ctx.measureText(servedText).width + gap;
  label(ctx, lostText, cursor, textY, {
    size, color: lost > 0 ? CHALK_RED : CHALK, weight: '700',
  });
  cursor += ctx.measureText(lostText).width + gap;

  if (showCombo) {
    // Flame immediately left of the combo text.
    drawComboFlame(ctx, cursor + 9, signY + signH - 15, combo, view.comboFrac);
    const comboX = cursor + 24;
    label(ctx, comboText, comboX, textY, { size, color: CHALK_RED, weight: '800' });
    // Combo timer as a thin chalk underline beneath the combo text,
    // its filled width draining with comboFrac.
    ctx.font = `800 ${size}px sans-serif`;
    const comboW = ctx.measureText(comboText).width;
    const barY = signY + signH - 11;
    roundRect(ctx, comboX, barY, comboW, 3, 1.5);
    ctx.fillStyle = 'rgba(245,230,200,0.22)';
    ctx.fill();
    const filled = comboW * clamp01(view.comboFrac);
    if (filled > 0) {
      roundRect(ctx, comboX, barY, Math.max(3, filled), 3, 1.5);
      ctx.fillStyle = '#f0a35e';
      ctx.fill();
    }
  }
  ctx.restore();
}

// Transient banner: a hanging paper sign (kept from v3 — strings, paper
// gradient, coloured trim by tone, centred text, steam wisps).
function drawBanner(ctx, view) {
  if (!view.message) return;
  const text = String(view.message);
  const trim = view.messageTone === 'good' ? GREEN : view.messageTone === 'bad' ? RED : GOLD;

  ctx.save();
  ctx.font = '700 22px sans-serif';
  const textW = ctx.measureText(text).width;
  const w = Math.max(300, Math.min(900, textW + 72));
  const h = 62;
  const x = (CANVAS_W - w) / 2;
  const y = 258;

  // Hanging strings.
  ctx.strokeStyle = 'rgba(20,10,5,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 36, y - 26);
  ctx.lineTo(x + 36, y);
  ctx.moveTo(x + w - 36, y - 26);
  ctx.lineTo(x + w - 36, y);
  ctx.stroke();

  // Shadow + paper sign.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, x + 3, y + 4, w, h, 8);
  ctx.fill();
  const paper = ctx.createLinearGradient(x, y, x, y + h);
  paper.addColorStop(0, PAPER);
  paper.addColorStop(1, PAPER_DARK);
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 4;
  ctx.stroke();
  // Gold inner pin-line.
  ctx.strokeStyle = 'rgba(232,182,76,0.65)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 5);
  ctx.stroke();

  label(ctx, text, CANVAS_W / 2, y + 40, { size: 22, color: INK, align: 'center', weight: '700' });

  // Two tiny steam wisps curling up from the sign's top corners.
  ctx.fillStyle = 'rgba(255,250,238,0.35)';
  for (const wx of [x + 20, x + w - 20]) {
    ctx.beginPath();
    ctx.arc(wx, y - 7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wx + 3, y - 15, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw the in-game HUD overlay: day progress, score panel and banner.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{money: number, served: number, lost: number, combo: number,
 *   comboFrac: number, dayFrac: number, rushLabel: string,
 *   message: (string|null), messageTone: ('good'|'bad'|null)}} view
 */
export function drawHud(ctx, view) {
  const v = view || {};
  ctx.save();
  drawDayProgress(ctx, v);
  drawScorePanel(ctx, v);
  drawBanner(ctx, v);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------------

/**
 * Draw the full-screen title overlay.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawTitle(ctx) {
  ctx.save();
  dimScene(ctx, 0.72);

  // Hanging wooden sign.
  const signW = 820;
  const signH = 196;
  const signX = (CANVAS_W - signW) / 2;
  const signY = 168;

  ctx.strokeStyle = 'rgba(20,10,5,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(signX + 90, 0);
  ctx.lineTo(signX + 90, signY);
  ctx.moveTo(signX + signW - 90, 0);
  ctx.lineTo(signX + signW - 90, signY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, signX + 5, signY + 7, signW, signH, 12);
  ctx.fill();
  const wood = ctx.createLinearGradient(signX, signY, signX, signY + signH);
  wood.addColorStop(0, '#6b4423');
  wood.addColorStop(0.5, '#54331a');
  wood.addColorStop(1, '#40250f');
  roundRect(ctx, signX, signY, signW, signH, 12);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,182,76,0.4)';
  ctx.lineWidth = 1;
  roundRect(ctx, signX + 9, signY + 9, signW - 18, signH - 18, 8);
  ctx.stroke();
  // Wood grain + corner bolts.
  ctx.strokeStyle = 'rgba(30,16,6,0.35)';
  ctx.lineWidth = 1;
  for (const off of [52, 98, 144]) {
    ctx.beginPath();
    ctx.moveTo(signX + 18, signY + off);
    ctx.lineTo(signX + signW - 18, signY + off);
    ctx.stroke();
  }
  ctx.fillStyle = GOLD;
  for (const [bx, by] of [
    [signX + 22, signY + 22],
    [signX + signW - 22, signY + 22],
    [signX + 22, signY + signH - 22],
    [signX + signW - 22, signY + signH - 22],
  ]) {
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  label(ctx, 'RUSH HOUR RAMEN', CANVAS_W / 2, signY + 96, {
    size: 62, color: GOLD_BRIGHT, align: 'center', weight: '800',
  });
  label(ctx, 'the little noodle stall that could', CANVAS_W / 2, signY + 142, {
    size: 21, color: '#f5e6c8', align: 'center', weight: '400', style: 'italic',
  });
  label(ctx, '— night market · hand-pulled noodles · made to order —', CANVAS_W / 2, signY + 172, {
    size: 12, color: '#c9a878', align: 'center', weight: '400',
  });

  // Pulsing call to action.
  const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 380);
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.65 * pulse;
  label(ctx, 'CLICK TO OPEN THE SHOP', CANVAS_W / 2, 478, {
    size: 26, color: GOLD_BRIGHT, align: 'center', weight: '800',
  });
  ctx.restore();

  label(ctx, 'Tap a ticket, boil the noodles, chop, plate — and ring the bell before patience runs out.', CANVAS_W / 2, 540, {
    size: 14, color: 'rgba(245,230,200,0.75)', align: 'center', weight: '400',
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// End-of-day results
// ---------------------------------------------------------------------------

function starRating(stats) {
  const served = Math.max(0, Number(stats.served) || 0);
  const perfect = Math.max(0, Number(stats.perfect) || 0);
  const lost = Math.max(0, Number(stats.lost) || 0);
  const total = served + lost;
  if (total === 0 || served === 0) return 1;
  const servedShare = served / total; // 0..1 of customers who got fed
  const perfectShare = perfect / served; // 0..1 of served bowls that were perfect
  const score = servedShare * 3 + perfectShare * 2; // 0..5
  return Math.max(1, Math.min(5, Math.round(score)));
}

// One five-pointed star polygon centred on (cx, cy).
function starPath(ctx, cx, cy, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

const BROTH_COLORS = ['#4a2c17', '#c47b24', '#c1272d', '#e8c872']; // shoyu, miso, spicy, shio
const TOPPING_DOTS = ['#3f9e4d', '#e58a8a', '#f2a03c']; // scallion, chashu, egg yolk

// One mini finished bowl (~76px wide) standing on a shelf whose top edge is
// at baseY. All variety derives from the bowl index — fully deterministic.
function drawMiniBowl(ctx, cx, baseY, index) {
  const w = 76;
  const rimY = baseY - 29;

  // Soft shadow on the shelf.
  ctx.save();
  ctx.fillStyle = 'rgba(20,8,2,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 1, w * 0.52, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Foot.
  ctx.fillStyle = '#d9c9a3';
  ctx.fillRect(cx - 14, baseY - 7, 28, 7);

  // Bowl body: a rounded half-bowl from rim to foot.
  const body = ctx.createLinearGradient(cx, rimY, cx, baseY);
  body.addColorStop(0, '#fdf6df');
  body.addColorStop(1, '#e6d3a8');
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, rimY);
  ctx.bezierCurveTo(cx - w / 2, baseY - 8, cx - 16, baseY - 6, cx - 14, baseY - 6);
  ctx.lineTo(cx + 14, baseY - 6);
  ctx.bezierCurveTo(cx + 16, baseY - 6, cx + w / 2, baseY - 8, cx + w / 2, rimY);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,74,34,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Patterned rim hint: two-tone rim band (upper arc one tone, lower arc
  // another), then the broth surface inside it.
  ctx.beginPath();
  ctx.ellipse(cx, rimY, w / 2, 8, 0, Math.PI, Math.PI * 2);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, rimY, w / 2, 8, 0, 0, Math.PI);
  ctx.strokeStyle = '#31567a';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, rimY, w / 2 - 4.5, 6.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = BROTH_COLORS[index % BROTH_COLORS.length];
  ctx.fill();

  // 3 topping dots chosen by index.
  const dotCount = 3;
  const dotOffsets = [[-15, -1.5], [12, 1.5], [0, -3.5]];
  for (let k = 0; k < dotCount; k += 1) {
    const kind = (index + k) % 3;
    const [dx, dy] = dotOffsets[k];
    ctx.beginPath();
    ctx.arc(cx + dx, rimY + dy, 4.6, 0, Math.PI * 2);
    if (kind === 2) {
      // Egg: white disc with a yolk centre.
      ctx.fillStyle = '#fffdf4';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + dx, rimY + dy, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = TOPPING_DOTS[2];
      ctx.fill();
    } else {
      ctx.fillStyle = TOPPING_DOTS[kind];
      ctx.fill();
    }
  }

  // Steam wisp on every 3rd bowl: two translucent stacked circles.
  if (index % 3 === 0) {
    ctx.fillStyle = 'rgba(255,250,238,0.3)';
    ctx.beginPath();
    ctx.arc(cx - 4, rimY - 18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,238,0.22)';
    ctx.beginPath();
    ctx.arc(cx + 4, rimY - 30, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// A clean empty plate standing on a shelf (used when nothing was served).
function drawCleanPlate(ctx, cx, baseY) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,8,2,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 1, 24, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 3, 23, 5.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fdf6df';
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,74,34,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 3, 13, 3, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(49,86,122,0.6)';
  ctx.stroke();
  ctx.restore();
}

// One wooden wall shelf (board + brackets + soft shadow) with its top edge
// at shelfY, holding up to 8 mini bowls (or clean plates when count is 0).
function drawServiceShelf(ctx, shelfX, shelfW, shelfY, count, startIndex) {
  ctx.save();
  // Soft shadow under the shelf.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, shelfX + 4, shelfY + 14, shelfW, 10, 5);
  ctx.fill();
  // Board.
  const wood = ctx.createLinearGradient(shelfX, shelfY, shelfX, shelfY + 12);
  wood.addColorStop(0, '#7a4e28');
  wood.addColorStop(1, '#4e2d12');
  roundRect(ctx, shelfX, shelfY, shelfW, 12, 3);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,182,76,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Brackets.
  ctx.fillStyle = '#3a2110';
  for (const bx of [shelfX + 42, shelfX + shelfW - 54]) {
    ctx.beginPath();
    ctx.moveTo(bx, shelfY + 12);
    ctx.lineTo(bx + 12, shelfY + 12);
    ctx.lineTo(bx + 12, shelfY + 30);
    ctx.closePath();
    ctx.fill();
  }

  const slots = 8;
  const step = shelfW / slots;
  if (count <= 0) {
    for (let i = 0; i < 5; i += 1) {
      drawCleanPlate(ctx, shelfX + (shelfW * (i + 0.5)) / 5, shelfY);
    }
  } else {
    for (let i = 0; i < count; i += 1) {
      drawMiniBowl(ctx, shelfX + step * (i + 0.5), shelfY, startIndex + i);
    }
  }
  ctx.restore();
}

/**
 * Draw the full-screen end-of-day results scene: the same kitchen at
 * night — the receipt on the left, and on the right a hanging
 * "TONIGHT'S SERVICE" sign over two shelves of the day's finished bowls,
 * all hung directly on the night kitchen wall (no back panel).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{served: number, perfect: number, lost: number, earned: number,
 *   bestCombo: number}} stats
 */
export function drawResults(ctx, stats) {
  const s = stats || {};
  const served = s.served ?? 0;
  const perfect = s.perfect ?? 0;
  const lost = s.lost ?? 0;
  const earned = s.earned ?? 0;
  const bestCombo = s.bestCombo ?? 0;
  const stars = starRating(s);

  ctx.save();
  // Night grade over the whole kitchen scene.
  ctx.fillStyle = 'rgba(14,20,52,0.40)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Bottom band sinking the idle counter (empty plating bowl, its step
  // chip, the board's chalk hint) into night shadow.
  const band = ctx.createLinearGradient(0, 400, 0, CANVAS_H);
  band.addColorStop(0, 'rgba(10,14,38,0)');
  band.addColorStop(1, 'rgba(10,14,38,0.35)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 400, CANVAS_W, CANVAS_H - 400);

  // Warm lantern glow pools hanging over the night kitchen.
  glowPool(ctx, 330, 120, 240, '255,176,84', 0.20);
  glowPool(ctx, 950, 110, 240, '255,176,84', 0.20);
  // A softer pool over the service-shelf area on the right.
  glowPool(ctx, 885, 430, 320, '255,176,84', 0.16);

  // Small moon with a glow at the top-right.
  glowPool(ctx, 1218, 44, 52, '200,214,255', 0.35);
  crescentMoon(ctx, 1218, 44, 16, 'rgba(14,20,52,0.88)');

  // Paper receipt panel, on the left of the scene exactly as v3.
  const w = 420;
  const h = 500;
  const x = 70;
  const y = (CANVAS_H - h) / 2;
  const cx = x + w / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, x + 5, y + 7, w, h, 10);
  ctx.fill();
  const paper = ctx.createLinearGradient(x, y, x, y + h);
  paper.addColorStop(0, PAPER);
  paper.addColorStop(1, PAPER_DARK);
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Perforation dots along the top and bottom edges of the receipt.
  ctx.fillStyle = 'rgba(122,74,34,0.5)';
  for (let px = x + 18; px < x + w - 8; px += 18) {
    ctx.beginPath();
    ctx.arc(px, y + 12, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, y + h - 12, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  label(ctx, 'END OF DAY', cx, y + 66, {
    size: 34, color: INK, align: 'center', weight: '800',
  });
  label(ctx, '· RUSH HOUR RAMEN ·', cx, y + 92, {
    size: 12, color: INK_SOFT, align: 'center', weight: '600',
  });

  // Divider.
  ctx.strokeStyle = 'rgba(122,74,34,0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x + 36, y + 112);
  ctx.lineTo(x + w - 36, y + 112);
  ctx.stroke();
  ctx.setLineDash([]);

  // One line per stat: label on the left, value on the right.
  const rows = [
    ['Served', `${served}`],
    ['Perfect bowls', `${perfect}`],
    ['Customers lost', `${lost}`],
    ['Earned', `¥${earned}`],
    ['Best combo', `×${bestCombo}`],
  ];
  rows.forEach(([name, value], i) => {
    const rowY = y + 152 + i * 38;
    label(ctx, name, x + 44, rowY, { size: 17, color: INK, weight: '600' });
    label(ctx, value, x + w - 44, rowY, { size: 17, color: INK, align: 'right', weight: '800' });
  });

  // Star rating: five drawn star polygons, gold-filled up to the rating,
  // dark-outlined and empty for the rest.
  for (let i = 0; i < 5; i += 1) {
    const starX = cx + (i - 2) * 46;
    const starY = y + 378;
    starPath(ctx, starX, starY, 19, 8.5);
    if (i < stars) {
      ctx.fillStyle = '#e8a33d';
      ctx.fill();
      ctx.strokeStyle = 'rgba(122,74,34,0.8)';
    } else {
      ctx.fillStyle = 'rgba(122,74,34,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(74,36,16,0.75)';
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  label(ctx, `${stars} OF 5 STARS`, cx, y + 422, {
    size: 11, color: INK_SOFT, align: 'center', weight: '700',
  });

  label(ctx, 'THANK YOU FOR PLAYING', cx, y + h - 34, {
    size: 16, color: RED, align: 'center', weight: '800',
  });

  // --- Right side: hanging sign over two shelves of tonight's bowls. ---
  const signX = 600;
  const signY = 118;
  const signW = 570;
  const signH = 104;
  const signCx = signX + signW / 2;

  // Hanging strings.
  ctx.strokeStyle = 'rgba(20,10,5,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(signX + 70, 0);
  ctx.lineTo(signX + 70, signY);
  ctx.moveTo(signX + signW - 70, 0);
  ctx.lineTo(signX + signW - 70, signY);
  ctx.stroke();

  // Shadow + wooden sign.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, signX + 5, signY + 7, signW, signH, 12);
  ctx.fill();
  const signWood = ctx.createLinearGradient(signX, signY, signX, signY + signH);
  signWood.addColorStop(0, '#6b4423');
  signWood.addColorStop(0.5, '#54331a');
  signWood.addColorStop(1, '#40250f');
  roundRect(ctx, signX, signY, signW, signH, 12);
  ctx.fillStyle = signWood;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,182,76,0.4)';
  ctx.lineWidth = 1;
  roundRect(ctx, signX + 8, signY + 8, signW - 16, signH - 16, 8);
  ctx.stroke();
  // Corner bolts.
  ctx.fillStyle = GOLD;
  for (const [bx, by] of [
    [signX + 20, signY + 20],
    [signX + signW - 20, signY + 20],
    [signX + 20, signY + signH - 20],
    [signX + signW - 20, signY + signH - 20],
  ]) {
    ctx.beginPath();
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  label(ctx, "TONIGHT'S SERVICE", signCx, signY + 50, {
    size: 30, color: GOLD_BRIGHT, align: 'center', weight: '800',
  });
  label(ctx, `${served} BOWLS SERVED`, signCx, signY + 82, {
    size: 16, color: '#f5e6c8', align: 'center', weight: '700',
  });

  // Two shelves holding the day's finished bowls: the served count in
  // total, capped at 16 (8 per shelf); empty shelves get clean plates.
  const bowlTotal = Math.max(0, Math.min(16, Math.floor(Number(served) || 0)));
  const topCount = Math.min(8, bowlTotal);
  const bottomCount = bowlTotal - topCount;
  drawServiceShelf(ctx, 570, 640, 390, topCount, 0);
  drawServiceShelf(ctx, 570, 640, 560, served > 0 ? bottomCount : 0, topCount);

  ctx.restore();
}

export default drawHud;
