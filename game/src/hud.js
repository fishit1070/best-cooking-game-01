// hud.js — Overlay drawing for Rush Hour Ramen: score HUD, day progress,
// transient banners, the title screen and the end-of-day results receipt.
// Pure canvas drawing on the same 1280×720 canvas as render.js.
// Warm ramen-ya styling: cream paper, red-brown ink, gold accents.

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

function bar(ctx, x, y, w, h, frac, fillColor, bg = 'rgba(0,0,0,0.35)') {
  const f = clamp01(frac);
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

function dimScene(ctx, alpha = 0.72) {
  ctx.save();
  ctx.fillStyle = `rgba(12,6,3,${alpha})`;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// In-game HUD
// ---------------------------------------------------------------------------

function drawDayProgress(ctx, view) {
  const frac = clamp01(view.dayFrac);
  const rushLabel = view.rushLabel || '';

  // Slim backing strip tucked under the ticket row.
  ctx.save();
  ctx.fillStyle = 'rgba(18,9,4,0.55)';
  ctx.fillRect(0, 148, CANVAS_W, 22);
  ctx.restore();

  // Rush label at the left of the bar.
  if (rushLabel) {
    label(ctx, rushLabel, 24, 164, { size: 12, color: GOLD_BRIGHT, weight: '700' });
  }

  // The bar itself.
  const barX = 300;
  const barY = 152;
  const barW = CANVAS_W - barX - 24;
  const barH = 12;
  ctx.save();
  roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  if (frac > 0) {
    const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    grad.addColorStop(0, '#f2b33d');
    grad.addColorStop(0.6, '#e07f2e');
    grad.addColorStop(1, '#7a86c8');
    roundRect(ctx, barX, barY, Math.max(barH, barW * frac), barH, barH / 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(232,182,76,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.stroke();
  ctx.restore();

  // Sun -> moon marker travelling along the bar.
  const markerX = barX + frac * barW;
  const markerY = barY + barH / 2;
  ctx.save();
  ctx.fillStyle = frac < 0.5 ? '#ffd94d' : '#e8ecf5';
  ctx.beginPath();
  ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(74,36,16,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (frac < 0.5) {
    // Little sun rays.
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(markerX + Math.cos(a) * 10, markerY + Math.sin(a) * 10);
      ctx.lineTo(markerX + Math.cos(a) * 13, markerY + Math.sin(a) * 13);
      ctx.stroke();
    }
  } else {
    // Crescent cut-out.
    ctx.fillStyle = 'rgba(18,9,4,0.55)';
    ctx.beginPath();
    ctx.arc(markerX + 3.5, markerY - 2, 6.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // End-point moon at the right-hand end of the day.
  label(ctx, '☾', barX + barW + 2, barY + 11, { size: 11, color: '#aab4d8', weight: '400' });
  ctx.restore();
}

function drawScorePanel(ctx, view) {
  const money = view.money ?? 0;
  const served = view.served ?? 0;
  const lost = view.lost ?? 0;
  const combo = view.combo ?? 0;
  const showCombo = combo >= 2;

  const panelX = 24;
  const panelY = 676;
  const panelW = showCombo ? 672 : 430;
  const panelH = 38;

  ctx.save();
  // Shadow + cream paper panel over the floor strip.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, panelX + 2, panelY + 3, panelW, panelH, 8);
  ctx.fill();
  const paper = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  paper.addColorStop(0, PAPER);
  paper.addColorStop(1, PAPER_DARK);
  roundRect(ctx, panelX, panelY, panelW, panelH, 8);
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const textY = panelY + 25;
  label(ctx, `EARNED ¥${money}`, panelX + 16, textY, { size: 15, color: INK, weight: '700' });
  label(ctx, `SERVED ${served}`, panelX + 196, textY, { size: 15, color: INK, weight: '700' });
  label(ctx, `LOST ${lost}`, panelX + 316, textY, { size: 15, color: lost > 0 ? RED : INK_SOFT, weight: '700' });

  if (showCombo) {
    const comboX = panelX + 424;
    label(ctx, `COMBO ×${combo}`, comboX, textY, { size: 15, color: RED, weight: '800' });
    // Combo timer bar draining with comboFrac, under/next to the combo text.
    bar(ctx, comboX + 118, panelY + 15, 118, 9, view.comboFrac, '#e07f2e', 'rgba(74,36,16,0.22)');
  }
  ctx.restore();
}

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

/**
 * Draw the full-screen end-of-day results receipt.
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
  dimScene(ctx, 0.72);

  // Paper receipt panel.
  const w = 420;
  const h = 500;
  const x = (CANVAS_W - w) / 2;
  const y = (CANVAS_H - h) / 2;

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

  label(ctx, 'END OF DAY', CANVAS_W / 2, y + 66, {
    size: 34, color: INK, align: 'center', weight: '800',
  });
  label(ctx, '· RUSH HOUR RAMEN ·', CANVAS_W / 2, y + 92, {
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

  // Star rating.
  const starText = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  label(ctx, starText, CANVAS_W / 2, y + 386, {
    size: 38, color: '#e8a33d', align: 'center', weight: '400',
  });
  label(ctx, `${stars} OF 5 STARS`, CANVAS_W / 2, y + 414, {
    size: 11, color: INK_SOFT, align: 'center', weight: '700',
  });

  label(ctx, 'THANK YOU FOR PLAYING', CANVAS_W / 2, y + h - 34, {
    size: 16, color: RED, align: 'center', weight: '800',
  });
  ctx.restore();
}

export default drawHud;
