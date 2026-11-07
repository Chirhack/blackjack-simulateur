// Moteur de jeu pur : 6 paquets, S17, DAS, 3:2, peek, pas d'abandon ni d'assurance, 4 mains max, coupe à 234 cartes.
// Mêmes règles et même stratégie que ../sim.mjs ; test.mjs vérifie que l'espérance retombe sur la même valeur.
export const DECKS = 6, SHOE_N = 312, CUT = 234, MAX_HANDS = 4, TABLE_MAX = 500, BANK0 = 1000;
export const EDGE_A = -0.38, EDGE_B = 0.49;
export const edgeOf = (tc) => EDGE_A + EDGE_B * tc;

export const valueOf = (card) => Math.min(card.r, 10);
export const tagOf = (card) => { const v = valueOf(card); return v >= 2 && v <= 6 ? 1 : v === 10 || v === 1 ? -1 : 0; };

export function totalOf(vals) {
  let s = 0, aces = 0;
  for (const v of vals) { s += v; if (v === 1) aces++; }
  const soft = aces > 0 && s + 10 <= 21;
  return { total: soft ? s + 10 : s, soft };
}
const handVals = (h) => h.cards.map(valueOf);
export const handTotal = (h) => totalOf(handVals(h));
const isBJ = (cards) => cards.length === 2 && totalOf(cards.map(valueOf)).total === 21;

// La stratégie de base. H tirer, S rester, D doubler, P séparer.
export function strategy(vals, up, canSplit, canDouble) {
  const d = up === 1 ? 11 : up;
  if (canSplit && vals.length === 2 && vals[0] === vals[1]) {
    const p = vals[0];
    if (p === 1 || p === 8) return "P";
    if ((p === 2 || p === 3 || p === 7) && d <= 7) return "P";
    if (p === 4 && (d === 5 || d === 6)) return "P";
    if (p === 6 && d <= 6) return "P";
    if (p === 9 && d !== 7 && d <= 9) return "P";
  }
  const { total: t, soft } = totalOf(vals);
  if (soft) {
    if (t >= 19) return "S";
    if (t === 18) { if (d >= 3 && d <= 6) return canDouble ? "D" : "S"; return d >= 9 ? "H" : "S"; }
    if (t === 17 && d >= 3 && d <= 6) return canDouble ? "D" : "H";
    if ((t === 15 || t === 16) && d >= 4 && d <= 6) return canDouble ? "D" : "H";
    if ((t === 13 || t === 14) && d >= 5 && d <= 6) return canDouble ? "D" : "H";
    return "H";
  }
  if (t >= 17) return "S";
  if (t >= 13) return d <= 6 ? "S" : "H";
  if (t === 12) return d >= 4 && d <= 6 ? "S" : "H";
  if (t === 11) return d <= 10 ? (canDouble ? "D" : "H") : "H";
  if (t === 10) return d <= 9 ? (canDouble ? "D" : "H") : "H";
  if (t === 9) return d >= 3 && d <= 6 ? (canDouble ? "D" : "H") : "H";
  return "H";
}

// Le tableau affiché est calculé par strategy() : il ne peut pas diverger du conseil.
export const COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];
const hardVals = (t) => (t <= 8 ? [3, 5] : t <= 12 ? [2, t - 2] : [10, t - 10]);
export const CHART = {
  hard: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((t) => ({ key: "h" + t, label: t === 8 ? "≤ 8" : t === 17 ? "17 +" : String(t), vals: hardVals(t), split: false })),
  soft: [2, 3, 4, 5, 6, 7, 8, 9].map((k) => ({ key: "s" + (k + 11), label: "A," + k, vals: [1, k], split: false })),
  pair: [2, 3, 4, 5, 6, 7, 8, 9, 10, 1].map((v) => ({ key: "p" + v, label: v === 1 ? "A,A" : v + "," + v, vals: [v, v], split: true })),
};
export function cellOf(row, up) {
  const a = strategy(row.vals, up, row.split, true);
  if (a !== "D") return a;
  return strategy(row.vals, up, false, false) === "S" ? "Ds" : "D";
}
export function rowKeyOf(h, splitAllowed) {
  const vals = handVals(h);
  if (splitAllowed && vals.length === 2 && vals[0] === vals[1]) return "p" + vals[0];
  const { total, soft } = totalOf(vals);
  if (soft) return "s" + Math.max(13, Math.min(20, total));
  return "h" + Math.max(8, Math.min(17, total));
}

export function newGame(rng = Math.random, bank = BANK0) {
  const shoe = [];
  for (let d = 0; d < DECKS; d++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) shoe.push({ r, s });
  const g = { rng, bank, shoe, pos: 0, rc: 0, seen: 0, phase: "bet", hands: [], dealer: [], active: 0, holeUp: false, events: [] };
  shuffle(g);
  return g;
}
function shuffle(g) {
  const a = g.shoe;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(g.rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  g.pos = 0; g.rc = 0; g.seen = 0;
}
const see = (g, card) => { g.rc += tagOf(card); g.seen++; };
function give(g, to, hand, down = false) {
  const card = g.shoe[g.pos++];
  if (!down) see(g, card);
  (to === "d" ? g.dealer : g.hands[hand].cards).push(card);
  g.events.push({ t: "card", to, hand, card, down, rc: g.rc });
  return card;
}
export const decksLeft = (g) => (SHOE_N - g.seen) / 52;
export const trueCount = (g) => g.rc / decksLeft(g);

export function deal(g, bet) {
  if (g.phase !== "bet" || bet <= 0 || bet > g.bank) return false;
  g.events = [];
  if (g.pos >= CUT) { shuffle(g); g.events.push({ t: "shuffle" }); }
  g.bank -= bet;
  g.hands = [{ cards: [], bet, aces: false, doubled: false, res: null, net: 0 }];
  g.dealer = []; g.active = 0; g.holeUp = false;
  give(g, "p", 0); give(g, "d"); give(g, "p", 0); give(g, "d", 0, true);
  const pBJ = isBJ(g.hands[0].cards), dBJ = isBJ(g.dealer);
  g.phase = "play";
  if (pBJ || dBJ) { reveal(g); settle(g); }
  return true;
}
function reveal(g) {
  if (g.holeUp) return;
  g.holeUp = true; see(g, g.dealer[1]);
  g.events.push({ t: "flip", rc: g.rc });
}
const current = (g) => g.hands[g.active];
export function legal(g) {
  if (g.phase !== "play") return { H: false, S: false, D: false, P: false };
  const h = current(g), two = h.cards.length === 2, funds = g.bank >= h.bet;
  const pair = two && valueOf(h.cards[0]) === valueOf(h.cards[1]);
  return { H: true, S: true, D: two && funds, P: pair && funds && g.hands.length < MAX_HANDS };
}
export function advice(g) {
  const h = current(g), l = legal(g);
  return { act: strategy(handVals(h), valueOf(g.dealer[0]), l.P, l.D), row: rowKeyOf(h, g.hands.length < MAX_HANDS), up: valueOf(g.dealer[0]) };
}
export function act(g, a) {
  if (g.phase !== "play" || !legal(g)[a]) return false;
  g.events = [];
  const h = current(g);
  if (a === "H") { give(g, "p", g.active); if (handTotal(h).total >= 21) next(g); }
  else if (a === "S") next(g);
  else if (a === "D") {
    g.bank -= h.bet; h.bet *= 2; h.doubled = true;
    g.events.push({ t: "double", hand: g.active });
    give(g, "p", g.active); next(g);
  } else if (a === "P") {
    g.bank -= h.bet;
    const c = h.cards.pop(), aces = valueOf(c) === 1;
    h.aces = aces;
    g.hands.push({ cards: [c], bet: h.bet, aces, doubled: false, res: null, net: 0 });
    g.events.push({ t: "split", from: g.active, hand: g.hands.length - 1 });
    give(g, "p", g.active);
    if (aces || handTotal(h).total >= 21) next(g);
  }
  return true;
}
function next(g) {
  g.active++;
  while (g.active < g.hands.length) {
    const h = current(g);
    g.events.push({ t: "active", hand: g.active });
    if (h.cards.length === 1) {
      give(g, "p", g.active);
      if (h.aces || handTotal(h).total >= 21) { g.active++; continue; }
    }
    return;
  }
  dealerPlay(g);
}
function dealerPlay(g) {
  reveal(g);
  const live = g.hands.some((h) => handTotal(h).total <= 21);
  if (live) while (totalOf(g.dealer.map(valueOf)).total < 17) give(g, "d");
  settle(g);
}
function settle(g) {
  const d = totalOf(g.dealer.map(valueOf)).total, dBJ = isBJ(g.dealer);
  let net = 0;
  g.hands.forEach((h) => {
    const t = handTotal(h).total, pBJ = g.hands.length === 1 && isBJ(h.cards);
    let back = 0;
    if (dBJ) { h.res = pBJ ? "push" : "lose"; back = pBJ ? h.bet : 0; }
    else if (pBJ) { h.res = "bj"; back = h.bet * 2.5; }
    else if (t > 21) { h.res = "bust"; }
    else if (d > 21 || t > d) { h.res = "win"; back = h.bet * 2; }
    else if (t < d) { h.res = "lose"; }
    else { h.res = "push"; back = h.bet; }
    h.net = back - h.bet; net += h.net; g.bank += back;
  });
  g.phase = "bet";
  g.lastNet = net;
  g.events.push({ t: "settle" });
}
