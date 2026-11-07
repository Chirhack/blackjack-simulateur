// Monte Carlo : 6 paquets, S17, DAS, 3:2, peek, pas d'abandon, coupe à 234 cartes, 1 joueur, stratégie de base fixe.
// Mesure l'espérance par true count Hi-Lo (compté au début du coup) : c'est ce que lit le cadran de la figure.
import { writeFileSync } from "node:fs";

const DECKS = 6, N = DECKS * 52, CUT = 234;
const ROUNDS = Number(process.argv[2] || 2e7);

let seed = 0x9e3779b9 ^ Number(process.argv[3] || 1);
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };

const shoe = new Uint8Array(N);
for (let i = 0; i < N; i++) { const r = (i % 13) + 1; shoe[i] = r > 10 ? 10 : r; }
let pos = 0, rc = 0;
const tag = (c) => (c >= 2 && c <= 6 ? 1 : c === 10 || c === 1 ? -1 : 0);
function shuffle() { for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = shoe[i]; shoe[i] = shoe[j]; shoe[j] = t; } pos = 0; rc = 0; }
const draw = () => { const c = shoe[pos++]; rc += tag(c); track(); return c; };

// Excursions du sabot, pour dimensionner les butées de la machine.
let shoeMaxRc = 0, shoeMaxTc = 0;
function track() {
  const a = Math.abs(rc); if (a > shoeMaxRc) shoeMaxRc = a;
  const t = a / ((N - pos) / 52); if (t > shoeMaxTc) shoeMaxTc = t;
}

function total(cards) { let s = 0, aces = 0; for (const c of cards) { s += c; if (c === 1) aces++; } const soft = aces > 0 && s + 10 <= 21; return [soft ? s + 10 : s, soft]; }

function action(cards, up, canSplit, canDouble) {
  const d = up === 1 ? 11 : up;
  if (canSplit && cards.length === 2 && cards[0] === cards[1]) {
    const p = cards[0];
    if (p === 1 || p === 8) return "P";
    if ((p === 2 || p === 3 || p === 7) && d <= 7) return "P";
    if (p === 4 && (d === 5 || d === 6)) return "P";
    if (p === 6 && d <= 6) return "P";
    if (p === 9 && d !== 7 && d <= 9) return "P";
  }
  const [t, soft] = total(cards);
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

function round() {
  const p1 = draw(), up = draw(), p2 = draw(), hole = draw();
  const pBJ = (p1 === 1 && p2 === 10) || (p1 === 10 && p2 === 1);
  const dBJ = (up === 1 && hole === 10) || (up === 10 && hole === 1);
  if (dBJ) return pBJ ? 0 : -1;
  if (pBJ) return 1.5;
  const hands = [{ cards: [p1, p2], bet: 1, aces: false, done: false }];
  for (let i = 0; i < hands.length; i++) {
    const h = hands[i];
    if (h.cards.length === 1) { h.cards.push(draw()); if (h.aces) continue; }
    while (true) {
      const canSplit = hands.length < 4;
      const a = action(h.cards, up, canSplit, h.cards.length === 2);
      if (a === "S") break;
      if (a === "H") { h.cards.push(draw()); if (total(h.cards)[0] >= 21) break; continue; }
      if (a === "D") { h.bet = 2; h.cards.push(draw()); break; }
      if (a === "P") {
        const c = h.cards[0], aces = c === 1;
        h.cards = [c]; h.aces = aces; hands.push({ cards: [c], bet: 1, aces, done: false });
        h.cards.push(draw());
        if (aces) break;
      }
    }
  }
  let live = false;
  for (const h of hands) if (total(h.cards)[0] <= 21) live = true;
  const dealer = [up, hole];
  if (live) while (total(dealer)[0] < 17) dealer.push(draw());
  const dt = total(dealer)[0];
  let net = 0;
  for (const h of hands) { const t = total(h.cards)[0]; if (t > 21) net -= h.bet; else if (dt > 21 || t > dt) net += h.bet; else if (t < dt) net -= h.bet; }
  return net;
}

let betSum = 0, betWon = 0;
const BIN = 12;
const sum = new Float64Array(2 * BIN + 1), sum2 = new Float64Array(2 * BIN + 1), cnt = new Float64Array(2 * BIN + 1);
let shoes = 0, overRc = 0, overTc = 0;
const RC_LIMIT = 24, TC_LIMIT = 12;
shuffle();
for (let r = 0; r < ROUNDS; r++) {
  if (pos >= CUT) {
    shoes++; if (shoeMaxRc > RC_LIMIT) overRc++; if (shoeMaxTc > TC_LIMIT) overTc++;
    shoeMaxRc = 0; shoeMaxTc = 0; shuffle();
  }
  const tc = rc / ((N - pos) / 52);
  const b = Math.max(-BIN, Math.min(BIN, Math.round(tc))) + BIN;
  const net = round();
  const bb = Math.max(1, Math.min(8, Math.round(2 * tc))); betSum += bb; betWon += bb * net;
  sum[b] += net; sum2[b] += net * net; cnt[b]++;
}

let total_n = 0, total_s = 0;
const rows = [];
for (let i = 0; i < sum.length; i++) {
  total_n += cnt[i]; total_s += sum[i];
  if (!cnt[i]) continue;
  const mean = sum[i] / cnt[i], sd = Math.sqrt(sum2[i] / cnt[i] - mean * mean);
  rows.push({ tc: i - BIN, n: cnt[i], share: 0, ev: mean, se: sd / Math.sqrt(cnt[i]), sd });
}
rows.forEach((row) => (row.share = row.n / total_n));

// Droite pondérée sur -6..+6.
const fit = rows.filter((r) => Math.abs(r.tc) <= 6);
let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
for (const r of fit) { const w = 1 / (r.se * r.se); sw += w; sx += w * r.tc; sy += w * r.ev; sxx += w * r.tc * r.tc; sxy += w * r.tc * r.ev; }
const slope = (sw * sxy - sx * sy) / (sw * sxx - sx * sx), intercept = (sy - slope * sx) / sw;

const flat = total_s / total_n;
const positive = rows.filter((r) => r.ev > 0);
const staked = betSum, won = betWon;

const out = {
  rules: "6 paquets, S17, DAS, 3:2, peek, pas d'abandon, coupe à 234 cartes, stratégie de base fixe",
  rounds: total_n,
  flatEdge: flat,
  fit: { intercept, slope },
  breakEven: -intercept / slope,
  sharePositive: positive.reduce((s, r) => s + r.share, 0),
  firstPositiveTc: positive.length ? positive[0].tc : null,
  spread: { perStaked: won / staked, perRound: won / total_n, avgBet: staked / total_n },
  shoes, overRc: overRc / shoes, overTc: overTc / shoes,
  rows,
};
writeFileSync(new URL("./sim-result.json", import.meta.url), JSON.stringify(out, null, 1));
console.log("coups", total_n, "sabots", shoes);
console.log("flat", (flat * 100).toFixed(3) + " %", "droite", (intercept * 100).toFixed(3), "+", (slope * 100).toFixed(3), "x TC", "seuil TC", (-intercept / slope).toFixed(2));
console.log("part des coups à EV>0", (out.sharePositive * 100).toFixed(1) + " %", "dès TC", out.firstPositiveTc);
console.log("écart 1-8 : par unité misée", (out.spread.perStaked * 100).toFixed(3) + " %", "par coup", (out.spread.perRound * 100).toFixed(3) + " u", "mise moy.", out.spread.avgBet.toFixed(2));
console.log("sabots hors butée RC±24", (out.overRc * 100).toFixed(2) + " %", "TC±12", (out.overTc * 100).toFixed(2) + " %");
for (const r of rows) console.log(String(r.tc).padStart(4), (r.share * 100).toFixed(2).padStart(6) + " %", (r.ev * 100).toFixed(2).padStart(7) + " %", "±" + (r.se * 100).toFixed(2));
