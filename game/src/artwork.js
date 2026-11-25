// artwork.js — Painted art assets for Rush Hour Ramen.
//
// Loads the five painterly paintings that live in game/assets/ (paths are
// relative to game/index.html, the page that loads this module) and hands
// them to the renderer. Loading is settle-based: loadArtwork() resolves
// once every painting has either loaded or failed, so the game can wait
// for the art before its first frame without ever wedging on a bad file.
// A painting that fails to load simply never becomes ready, and the
// renderer falls back to its hand-drawn vector art for that slot.
//
// Also provides drawArtworkFeathered(), a scene-blending helper that
// draws a painting cover-fit with its alpha feathered to transparent at
// all four edges, so paintings can be blended into one continuous
// kitchen scene (the V4 scene-first look) instead of framed panels.

const ART_SOURCES = Object.freeze({
  backdrop: 'assets/backdrop.jpg',
  pot: 'assets/station-pot.jpg',
  board: 'assets/station-chop.jpg',
  plating: 'assets/station-plating.jpg',
  pass: 'assets/station-serve.jpg',
});

const images = Object.create(null); // key -> HTMLImageElement
const states = Object.create(null); // key -> 'pending' | 'ready' | 'failed'

let loadPromise = null;

// Start loading every painting (idempotent) and return a promise that
// resolves when all of them have settled, loaded or not.
export function loadArtwork() {
  if (loadPromise) return loadPromise;
  const jobs = Object.entries(ART_SOURCES).map(([key, src]) => new Promise((resolve) => {
    const img = new Image();
    images[key] = img;
    states[key] = 'pending';
    img.onload = () => {
      states[key] = 'ready';
      resolve();
    };
    img.onerror = () => {
      states[key] = 'failed';
      resolve();
    };
    img.src = src;
  }));
  loadPromise = Promise.all(jobs);
  return loadPromise;
}

// The loaded Image for `key`, or null when it is still loading or failed
// (callers treat null as "use the hand-drawn fallback").
export function artworkImage(key) {
  return states[key] === 'ready' ? images[key] : null;
}

// True once loadArtwork() has settled (every painting loaded or failed).
export function artworkSettled() {
  return loadPromise !== null
    && Object.keys(ART_SOURCES).every((key) => states[key] === 'ready' || states[key] === 'failed');
}

// Draw the painting for `key` into the rect (x, y, w, h) with cover-fit:
// scaled to fill the rect, centred, overflow cropped by the caller's
// clip — never stretched. Returns false (drawing nothing) when the
// painting is unavailable, so the caller can run its fallback instead.
export function drawArtworkCover(ctx, key, x, y, w, h) {
  const img = artworkImage(key);
  if (!img || !img.naturalWidth || !img.naturalHeight) return false;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  return true;
}

const featheredCache = new Map(); // cacheKey -> offscreen canvas (masked)

// Draw the painting for `key` into the rect (x, y, w, h) with cover-fit,
// like drawArtworkCover, but with the crop window centred on the
// normalised focus point (focusX, focusY in 0..1 of the source image,
// clamped so the crop never leaves the image) and with the painting's
// alpha feathered to fully transparent at all four edges, so it blends
// into a continuous scene. Returns false (drawing nothing) when the
// painting is unavailable, so the caller can run its fallback instead.
export function drawArtworkFeathered(ctx, key, x, y, w, h, options = {}) {
  const { feather = 0.18, focusX = 0.5, focusY = 0.5 } = options || {};
  const img = artworkImage(key);
  if (!img || !img.naturalWidth || !img.naturalHeight) return false;
  if (!w || !h) return false;

  const cacheKey = `${key}|${w}|${h}|${feather}|${focusX}|${focusY}`;
  let canvas = featheredCache.get(cacheKey);

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const cw = canvas.width;
    const ch = canvas.height;
    const mctx = canvas.getContext('2d');

    // Cover-fit crop window centred on the focus point, clamped inside.
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih);
    const sw = cw / scale;
    const sh = ch / scale;
    const fx = Math.min(1, Math.max(0, focusX));
    const fy = Math.min(1, Math.max(0, focusY));
    const sx = Math.min(iw - sw, Math.max(0, fx * iw - sw / 2));
    const sy = Math.min(ih - sh, Math.max(0, fy * ih - sh / 2));
    mctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);

    // Feather mask: elliptical radial gradient via a scaled context, so
    // the gradient's unit circle stretches to the rect's aspect ratio.
    // Fully opaque out to (1 - feather) of the radius, then fading
    // linearly to transparent at the edges (distance 1 = mid-edge;
    // corners are further out, so they are transparent too).
    const f = Math.min(1, Math.max(0, feather));
    mctx.save();
    mctx.globalCompositeOperation = 'destination-in';
    mctx.translate(cw / 2, ch / 2);
    mctx.scale(cw / 2, ch / 2);
    const grad = mctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(Math.max(0, 1 - f), 'rgba(0, 0, 0, 1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    mctx.fillStyle = grad;
    mctx.fillRect(-1, -1, 2, 2);
    mctx.restore();

    featheredCache.set(cacheKey, canvas);
  }

  ctx.drawImage(canvas, x, y);
  return true;
}
