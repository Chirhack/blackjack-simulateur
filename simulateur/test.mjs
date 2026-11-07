// Vérifie le moteur : il doit retrouver l'espérance de ../sim.mjs quand il joue la stratégie de base.
import { newGame, deal, act, advice, legal, handTotal, CHART, COLS, cellOf, strategy, CUT } from "./game.mjs";

const ROUNDS = Number(process.argv[2] || 6e6);
let seed = 0x1234567;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
const g = newGame(rnd, 1e15);
let sum = 0, sum2 = 0, splits = 0, doubles = 0, bj = 0, maxHands = 0, cardsOver = 0;
for (let i = 0; i < ROUNDS; i++) {
  const before = g.bank;
  deal(g, 1);
  while (g.phase === "play") {
    const a = advice(g);
    if (!legal(g)[a.act]) throw new Error("conseil illégal " + a.act);
    if (a.act === "P") splits++;
    if (a.act === "D") doubles++;
    act(g, a.act);
  }
  const net = g.bank - before;
  if (Math.abs(net - g.lastNet) > 1e-9) throw new Error("solde incohérent");
  if (g.hands[0].res === "bj") bj++;
  maxHands = Math.max(maxHands, g.hands.length);
  if (g.pos > 312 - 20) cardsOver++;
  sum += net; sum2 += net * net;
}
const mean = sum / ROUNDS, sd = Math.sqrt(sum2 / ROUNDS - mean * mean), se = sd / Math.sqrt(ROUNDS);
console.log("espérance", (mean * 100).toFixed(3) + " %", "±" + (se * 100).toFixed(3), "écart-type par coup", sd.toFixed(3));
console.log("blackjacks", (bj / ROUNDS * 100).toFixed(2) + " %", "doubles", (doubles / ROUNDS * 100).toFixed(2) + " %", "séparations", (splits / ROUNDS * 100).toFixed(2) + " %", "mains max", maxHands);

// Le tableau : chaque case doit correspondre à strategy().
let cells = 0;
for (const kind of Object.values(CHART)) for (const row of kind) for (const up of COLS) {
  const c = cellOf(row, up), s = strategy(row.vals, up, row.split, true);
  if ((c === "Ds" ? "D" : c) !== s) throw new Error("case " + row.key + " " + up);
  cells++;
}
console.log("cases du tableau", cells, "conformes");
// Quelques cases connues de la stratégie de base S17 DAS.
const known = [["h16", 10, "H"], ["h16", 6, "S"], ["h12", 3, "H"], ["h12", 4, "S"], ["h11", 1, "H"], ["h11", 10, "D"], ["s18", 3, "Ds"], ["s18", 9, "H"], ["s18", 7, "S"], ["p8", 1, "P"], ["p9", 7, "S"], ["p10", 6, "S"], ["p5", 6, "D"], ["p4", 5, "P"], ["p1", 1, "P"]];
const rows = [...CHART.hard, ...CHART.soft, ...CHART.pair];
for (const [key, up, want] of known) { const got = cellOf(rows.find((r) => r.key === key), up); if (got !== want) throw new Error(`${key} vs ${up}: ${got} au lieu de ${want}`); }
console.log("cases connues", known.length, "OK");
