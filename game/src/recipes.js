// recipes.js — Menu data model for Rush Hour Ramen.
// Pure data + lookup helpers. No DOM, no canvas, no timers.

// ---------------------------------------------------------------------------
// Broths
// ---------------------------------------------------------------------------

export const BROTHS = Object.freeze([
  Object.freeze({ id: 'shoyu', name: 'Shoyu', color: '#4a2c17', price: 3.5 }),
  Object.freeze({ id: 'miso', name: 'Miso', color: '#c47b24', price: 3.75 }),
  Object.freeze({ id: 'spicy', name: 'Spicy Chili', color: '#c1272d', price: 4.0 }),
  Object.freeze({ id: 'shio', name: 'Shio', color: '#e8c872', price: 3.5 }),
]);

// ---------------------------------------------------------------------------
// Noodles
// ---------------------------------------------------------------------------

export const NOODLES = Object.freeze([
  Object.freeze({ id: 'thin', name: 'Thin Noodles', boilSeconds: 3 }),
  Object.freeze({ id: 'classic', name: 'Classic Noodles', boilSeconds: 5 }),
  Object.freeze({ id: 'thick', name: 'Thick Noodles', boilSeconds: 8 }),
]);

// ---------------------------------------------------------------------------
// Toppings
// chopSeconds is 0 for toppings that need no chopping / prep cutting.
// ---------------------------------------------------------------------------

export const TOPPINGS = Object.freeze([
  Object.freeze({ id: 'chashu', name: 'Chashu Pork', color: '#b5654d', chopSeconds: 0, price: 2.5 }),
  Object.freeze({ id: 'ajitama', name: 'Ajitama Egg', color: '#f2b33d', chopSeconds: 0, price: 1.5 }),
  Object.freeze({ id: 'scallions', name: 'Scallions', color: '#3f9e4d', chopSeconds: 2, price: 0.75 }),
  Object.freeze({ id: 'corn', name: 'Sweet Corn', color: '#f7d154', chopSeconds: 0, price: 1.0 }),
  Object.freeze({ id: 'nori', name: 'Nori Sheets', color: '#1f3527', chopSeconds: 0, price: 1.0 }),
  Object.freeze({ id: 'menma', name: 'Menma Bamboo', color: '#c9a35f', chopSeconds: 2, price: 1.25 }),
  Object.freeze({ id: 'chili-oil', name: 'Chili Oil', color: '#d63a22', chopSeconds: 0, price: 0.75 }),
]);

// ---------------------------------------------------------------------------
// Signature bowls (the MENU)
// Bowls deliberately share broths / noodles / toppings so cooking routes
// overlap: one pot or prep batch can feed more than one kind of order.
// Ordered roughly from simplest / cheapest to most deluxe.
// ---------------------------------------------------------------------------

export const MENU = Object.freeze([
  Object.freeze({
    name: 'Tokyo Shoyu Classic',
    broth: 'shoyu',
    noodle: 'classic',
    toppings: Object.freeze(['chashu', 'scallions', 'nori']),
    price: 12,
  }),
  Object.freeze({
    name: 'Golden Shio Garden',
    broth: 'shio',
    noodle: 'thin',
    toppings: Object.freeze(['ajitama', 'corn', 'scallions']),
    price: 11.5,
  }),
  Object.freeze({
    name: 'Sapporo Miso Butter Corn',
    broth: 'miso',
    noodle: 'thick',
    toppings: Object.freeze(['chashu', 'corn', 'scallions']),
    price: 13.5,
  }),
  Object.freeze({
    name: 'Firecracker Spicy Rush',
    broth: 'spicy',
    noodle: 'thin',
    toppings: Object.freeze(['chashu', 'scallions', 'chili-oil']),
    price: 13,
  }),
  Object.freeze({
    name: 'Midnight Miso Deluxe',
    broth: 'miso',
    noodle: 'classic',
    toppings: Object.freeze(['chashu', 'ajitama', 'menma', 'nori']),
    price: 15.5,
  }),
  Object.freeze({
    name: 'Volcano Grand Special',
    broth: 'spicy',
    noodle: 'thick',
    toppings: Object.freeze(['chashu', 'ajitama', 'menma', 'scallions', 'chili-oil']),
    price: 17,
  }),
]);

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function brothById(id) {
  return BROTHS.find((broth) => broth.id === id);
}

export function noodleById(id) {
  return NOODLES.find((noodle) => noodle.id === id);
}

export function toppingById(id) {
  return TOPPINGS.find((topping) => topping.id === id);
}

export function menuByName(name) {
  return MENU.find((item) => item.name === name);
}

// ---------------------------------------------------------------------------
// Ticket printing
// ---------------------------------------------------------------------------

/**
 * Describe an order spec as short text lines a ticket can print.
 *
 * @param {{broth: string, noodle: string, toppings: string[]}} spec
 *   Broth / noodle / topping ids.
 * @returns {string[]} Broth name first, noodle name second, then one
 *   line per topping (in the order given). Unknown ids fall back to
 *   printing the raw id so a ticket never renders blank.
 */
export function describeOrder(spec) {
  const lines = [];

  const broth = brothById(spec.broth);
  lines.push(broth ? broth.name : String(spec.broth));

  const noodle = noodleById(spec.noodle);
  lines.push(noodle ? noodle.name : String(spec.noodle));

  for (const toppingId of spec.toppings || []) {
    const topping = toppingById(toppingId);
    lines.push(topping ? topping.name : String(toppingId));
  }

  return lines;
}
