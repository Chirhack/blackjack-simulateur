
const P = __P__;
const NS = "http://www.w3.org/2000/svg";
const svg = document.querySelector(".iso-stage svg");
const $p = (n) => svg.querySelector('[data-part="' + n + '"]');
const layers = { cards: $p("cards"), chips: $p("chips"), pills: $p("pills"), shoe: $p("shoe"), pusher: $p("pusher"), discard: $p("discard"), next: $p("next") };
const spotEls = [...svg.querySelectorAll("[data-spot]")];
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const adviceEl = document.querySelector("[data-advice]");
const statEls = Object.fromEntries([...document.querySelectorAll("[data-stat]")].map((e) => [e.dataset.stat, e]));
const statsBox = document.querySelector(".bj-stats");
const betRow = document.querySelector("[data-bet]"), playRow = document.querySelector("[data-play]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "V", "D", "R"];
const SUITS = ["♠︎", "♥︎", "♦︎", "♣︎"];
const ACT = { H: "Tirer", S: "Rester", D: "Doubler", P: "Séparer" };
const RES = { win: "gagné", bj: "blackjack", lose: "perdu", bust: "brûlé", push: "égalité" };

const g = newGame();
let bet = 0, lastBet = 5, busy = false, auto = !still.matches, demo = auto, coach = true, speed = 1;
let discardN = 0;
const stats = { hands: 0, dec: 0, ok: 0, start: BANK0 };
const handViews = [], dealerView = { cards: [], pill: null };
const fmt = (v) => { const s = Math.abs(v) % 1 ? Math.abs(v).toFixed(1).replace(".", ",") : String(Math.abs(v)).replace(/\B(?=(\d{3})+$)/g, " "); return s; };
const sgn = (v, t = fmt(v)) => (v > 0 ? "+" : v < 0 ? "−" : "") + t;

// --- le temps : une seule boucle, active seulement pendant un mouvement ---
const tweens = new Set();
let frame = 0, last = 0;
function loop(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  for (const t of tweens) {
    t.at = Math.min(1, t.at + dt / t.dur);
    t.fn(t.at * t.at * (3 - 2 * t.at));
    if (t.at >= 1) { tweens.delete(t); t.done(); }
  }
  frame = tweens.size ? requestAnimationFrame(loop) : 0;
  if (!frame) last = 0;
}
function tween(dur, fn) {
  const d = dur / speed;
  if (still.matches || d <= 0) { fn(1); return Promise.resolve(); }
  return new Promise((done) => { tweens.add({ at: 0, dur: d, fn, done }); if (!frame) frame = requestAnimationFrame(loop); });
}
const wait = (s) => new Promise((r) => setTimeout(r, still.matches ? 0 : (s * 1000) / speed));

// --- les cartes : un plan, donc une matrice affine ---
function makeCard(card) {
  const w = CARD_W, h = CARD_H, el = document.createElementNS(NS, "g");
  const red = card.s === 1 || card.s === 2, rank = RANKS[card.r], suit = SUITS[card.s];
  if (red) el.setAttribute("data-red", "");
  const index = `<text class="bj-rank" x="${-w / 2 + 3}" y="${-h / 2 + 11.5}" font-size="11.5">${rank}</text><text class="bj-suit" x="${-w / 2 + 3.2}" y="${-h / 2 + 21}" font-size="9">${suit}</text>`;
  el.innerHTML = `<g><rect class="bj-card" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="2.6"/><rect class="bj-back" x="${-w / 2 + 3}" y="${-h / 2 + 3}" width="${w - 6}" height="${h - 6}" rx="1.4"/></g><g><rect class="bj-card" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="2.6"/>${index}<text class="bj-suit" x="3" y="9" font-size="21" text-anchor="middle">${suit}</text><g transform="rotate(180)">${index}</g></g>`;
  layers.cards.appendChild(el);
  return { el, x: 0, y: 0, z: FZ + 0.4, phi: 0 };
}
function place(c) {
  const R = [Math.cos(c.phi), 0, Math.sin(c.phi)];
  const { m, face } = cardMatrix([c.x, c.y, c.z], R, [0, 1, 0], P);
  c.el.setAttribute("transform", m);
  c.el.children[0].style.display = face ? "none" : "";
  c.el.children[1].style.display = face ? "" : "none";
}
function flyTo(c, x, y, phi, dur = 0.3, z1 = FZ + 0.4) {
  const a = { x: c.x, y: c.y, z: c.z, phi: c.phi };
  return tween(dur, (t) => {
    c.x = a.x + (x - a.x) * t; c.y = a.y + (y - a.y) * t;
    c.z = a.z + (z1 - a.z) * t + Math.sin(t * Math.PI) * 9;
    c.phi = a.phi + (phi - a.phi) * t;
    place(c);
  });
}
function slotOf(view, n, count) {
  const step = count > 4 ? Math.min(13, 44 / (count - 1)) : 13;
  const [x, y] = view.at;
  return [x - ((count - 1) * step) / 2 + n * step, y + n * 4 - (count - 1) * 2];
}
async function layoutHand(view, skip) {
  const count = view.cards.length, jobs = [];
  view.cards.forEach((c, n) => {
    if (c === skip) return;
    const [x, y] = slotOf(view, n, count);
    if (Math.abs(c.x - x) + Math.abs(c.y - y) > 0.1) jobs.push(flyTo(c, x, y, c.phi, 0.16));
  });
  await Promise.all(jobs);
}

// --- les jetons ---
function makeStack(x, y, amount) {
  const el = document.createElementNS(NS, "g");
  el.innerHTML = stackHtml(x, y, amount, P);
  layers.chips.appendChild(el);
  return { el, x, y, amount, dx: 0, dy: 0 };
}
function slide(s, to, dur = 0.34) {
  const a = [s.dx, s.dy], b = [to[0] - s.x, to[1] - s.y];
  return tween(dur, (t) => {
    s.dx = a[0] + (b[0] - a[0]) * t; s.dy = a[1] + (b[1] - a[1]) * t;
    s.el.setAttribute("transform", translateAlong(P, [s.dx, s.dy, 0]));
  });
}
const clearChips = () => { layers.chips.innerHTML = ""; };
let pendingStack = null;
function showPending() {
  if (pendingStack) pendingStack.el.remove();
  pendingStack = null;
  if (bet > 0) { const [x, y] = spotOf(0); pendingStack = makeStack(x, y, bet); }
}

// --- les étiquettes posées sur le feutre ---
function setPill(view, text, res) {
  if (!text) { if (view.pill) view.pill.remove(); view.pill = null; return; }
  if (!view.pill) {
    view.pill = document.createElementNS(NS, "g");
    view.pill.setAttribute("class", "bj-pill");
    view.pill.innerHTML = '<rect rx="3"/><text font-size="10" text-anchor="middle"></text>';
    layers.pills.appendChild(view.pill);
    view.pill.setAttribute("transform", topMatrix(view.pillAt, FZ, P, "x"));
  }
  const w = text.length * 6.3 + 10;
  const r = view.pill.children[0];
  r.setAttribute("x", -w / 2); r.setAttribute("y", -8.5); r.setAttribute("width", w); r.setAttribute("height", 16);
  view.pill.children[1].textContent = text;
  view.pill.children[1].setAttribute("y", 3.6);
  if (res) view.pill.setAttribute("data-res", res); else view.pill.removeAttribute("data-res");
}
const labelOf = (cards) => { const { total, soft } = totalOf(cards.map(valueOf)); return soft && total < 21 ? total - 10 + "/" + total : String(total); };

// --- le sabot et la défausse ---
function drawShoe() {
  layers.shoe.innerHTML = shoeStackHtml(g.pos, true, P);
  layers.pusher.setAttribute("transform", translateAlong(P, [pusherX(g.pos), 0, 0]));
}
const drawDiscard = () => { layers.discard.innerHTML = discardHtml(discardN, P); };

function handView(i) {
  if (!handViews[i]) {
    const [sx, sy] = spotOf(i), at = handAt(i);
    handViews[i] = { i, at, spot: [sx, sy], cards: [], stack: null, extra: null, pill: null, pillAt: [sx, sy + 36] };
  }
  return handViews[i];
}
dealerView.at = DEALER_AT.slice(); dealerView.at[0] = 0; dealerView.pillAt = [-84, -80];

const flat = 0, down = Math.PI;
async function playEvents(events) {
  for (const e of events) {
    if (e.t === "shuffle") {
      discardN = 0; drawDiscard(); drawShoe();
      say("Carte de coupe passée : le sabot est rebattu.");
      await wait(0.7);
    } else if (e.t === "card") {
      const c = makeCard(e.card), view = e.to === "d" ? dealerView : handView(e.hand);
      c.x = SHOE_MOUTH - 6; c.y = SHOE_Y; c.phi = down; c.z = FZ + 8; place(c);
      view.cards.push(c);
      const n = view.cards.length - 1;
      const [x, y] = slotOf(view, n, view.cards.length);
      drawShoe();
      layoutHand(view, c);
      await flyTo(c, x, y, e.down ? down : flat);
      refreshPills();
      syncCount(e.rc);
    } else if (e.t === "flip") {
      const c = dealerView.cards[1];
      await flyTo(c, c.x, c.y, flat, 0.3);
      refreshPills();
      syncCount(e.rc);
    } else if (e.t === "double") {
      const v = handView(e.hand), [x, y] = v.spot;
      v.extra = makeStack(x, y, g.hands[e.hand].bet / 2);
      v.extra.el.setAttribute("transform", translateAlong(P, [0, 60, 0]));
      v.extra.dy = 60;
      await slide(v.extra, [x + 22, y - 6], 0.22);
    } else if (e.t === "split") {
      const from = handView(e.from), to = handView(e.hand), c = from.cards.pop();
      to.cards.push(c);
      const [x, y] = to.spot;
      to.stack = makeStack(x, y, g.hands[e.hand].bet);
      await Promise.all([flyTo(c, ...slotOf(to, 0, 1), flat, 0.24), layoutHand(from)]);
      refreshPills();
    } else if (e.t === "active") {
      markActive(e.hand);
    } else if (e.t === "settle") {
      markActive(-1);
      await payout();
    }
  }
}
function refreshPills() {
  g.hands.forEach((h, i) => { const v = handViews[i]; if (v && v.cards.length) setPill(v, labelOf(h.cards.slice(0, v.cards.length))); });
  const shown = g.holeUp ? dealerView.cards.length : 1;
  if (dealerView.cards.length) setPill(dealerView, labelOf(g.dealer.slice(0, shown)));
}
function markActive(i) { spotEls.forEach((el, n) => (el.style.display = n === i ? "" : "none")); }
let countShown = 0;
const syncCount = (rc) => { countShown = rc; ui(); };

async function payout() {
  const jobs = [];
  g.hands.forEach((h, i) => {
    const v = handViews[i], stacks = [v.stack, v.extra].filter(Boolean), [x, y] = v.spot;
    const res = h.res;
    const t = labelOf(h.cards) + " · " + (h.net ? sgn(h.net) : "=");
    setPill(v, res === "bj" ? "BJ · " + sgn(h.net) : t, res);
    if (res === "lose" || res === "bust") stacks.forEach((s) => jobs.push(slide(s, TRAY_AT, 0.4).then(() => s.el.remove())));
    else if (res === "win" || res === "bj") {
      const p = makeStack(TRAY_AT[0], TRAY_AT[1], h.net);
      jobs.push(slide(p, [x + (v.extra ? -22 : 24), y + 2], 0.4));
    }
  });
  await Promise.all(jobs);
  const net = g.lastNet;
  say(g.hands.map((h) => RES[h.res]).join(", ") + (net ? " : " + sgn(net) : "") + ".");
  stats.hands++;
}
async function sweep() {
  const all = [...dealerView.cards, ...handViews.flatMap((v) => (v ? v.cards : []))];
  if (!all.length) return;
  const [dx, dy] = [DISCARD.x + 28, DISCARD.y + 33];
  layers.chips.querySelectorAll("g").forEach((el) => el.style.opacity = 0);
  await Promise.all(all.map((c, i) => wait(i * 0.02).then(() => flyTo(c, dx, dy, c.phi, 0.3, discardTop(discardN)))));
  all.forEach((c) => c.el.remove());
  discardN += all.length; drawDiscard();
  dealerView.cards = []; setPill(dealerView, "");
  handViews.forEach((v) => { if (v) { v.cards = []; setPill(v, ""); v.stack = v.extra = null; } });
  clearChips(); pendingStack = null;
}

// --- les commandes ---
const say = (text) => { status.textContent = text; adviceEl.textContent = text; adviceEl.removeAttribute("data-tone"); };
function clearChart() { document.querySelectorAll(".bj-chart [data-on],.bj-chart [data-hit],.bj-chart [data-dim]").forEach((e) => { e.removeAttribute("data-on"); e.removeAttribute("data-hit"); e.removeAttribute("data-dim"); }); }
function chartFor() {
  clearChart();
  if (g.phase !== "play" || busy || !coach) return;
  const a = advice(g), row = document.querySelector('.bj-chart tr[data-row="' + a.row + '"]');
  const table = row.closest("table");
  table.querySelectorAll("tbody td").forEach((td) => { if (td.parentElement !== row && td.dataset.up !== String(a.up)) td.setAttribute("data-dim", ""); });
  row.setAttribute("data-on", "");
  table.querySelector('thead [data-col="' + a.up + '"]').setAttribute("data-on", "");
  row.querySelector('td[data-up="' + a.up + '"]').setAttribute("data-hit", "");
}
function ui() {
  const inPlay = g.phase === "play", l = legal(g);
  const stake = g.hands.reduce((s, h) => s + (inPlay ? h.bet : 0), 0);
  document.querySelectorAll("[data-act]").forEach((b) => (b.disabled = busy || !l[b.dataset.act]));
  document.querySelectorAll("[data-chip]").forEach((b) => (b.disabled = busy || inPlay || bet + Number(b.dataset.chip) > Math.min(g.bank, TABLE_MAX)));
  document.querySelector('[data-do="clear"]').disabled = busy || inPlay || !bet;
  const dealBtn = document.querySelector('[data-do="deal"]');
  const want = bet || Math.min(lastBet, g.bank);
  dealBtn.disabled = busy || inPlay || want < 1;
  dealBtn.textContent = bet ? "Distribuer" : "Remiser " + fmt(want);
  betRow.hidden = inPlay; playRow.hidden = !inPlay;
  const decks = (SHOE_N - g.seen) / 52, tc = g.rc / decks;
  statEls.bank.textContent = fmt(g.bank);
  const net = g.bank + stake - stats.start;
  statEls.net.textContent = sgn(net);
  statEls.hands.textContent = String(stats.hands);
  statEls.ok.textContent = stats.dec ? Math.round((stats.ok / stats.dec) * 100) + " % (" + stats.dec + ")" : "–";
  statEls.rc.textContent = sgn(g.rc, String(Math.abs(g.rc))) || "0";
  statEls.tc.textContent = (Math.abs(tc) < 0.05 ? "" : tc > 0 ? "+" : "−") + Math.abs(tc).toFixed(1).replace(".", ",");
  statEls.decks.textContent = decks.toFixed(1).replace(".", ",");
  const e = edgeOf(tc);
  statEls.edge.textContent = sgn(e, Math.abs(e).toFixed(2).replace(".", ",")) + " %";
  const text = "solde " + fmt(g.bank) + " · mise " + fmt(inPlay ? stake : bet);
  if (readout.textContent !== text) readout.textContent = text;
  chartFor();
}
function coachLine() {
  if (g.phase !== "play") return;
  const a = advice(g);
  const v = handTotalLabel();
  adviceEl.removeAttribute("data-tone");
  adviceEl.textContent = coach ? v + " contre " + RANKS[g.dealer[0].r] + " : " + ACT[a.act].toLowerCase() + "." : v + " contre " + RANKS[g.dealer[0].r] + " : à vous.";
}
const handTotalLabel = () => { const h = g.hands[g.active], { total, soft } = handTotal(h); return (g.hands.length > 1 ? "Main " + (g.active + 1) + ", " : "") + (soft ? total + " souple" : total); };

async function startRound(amount) {
  if (busy || g.phase !== "bet" || amount < 1 || amount > g.bank) return;
  busy = true; ui();
  await sweep();
  if (pendingStack) { pendingStack.el.remove(); pendingStack = null; }
  lastBet = amount; bet = 0;
  const v = handView(0), [x, y] = v.spot;
  v.stack = makeStack(x, y, amount);
  deal(g, amount);
  markActive(0);
  await playEvents(g.events);
  busy = false; ui(); coachLine();
  afterTurn();
}
async function doAct(a) {
  if (busy || g.phase !== "play" || !legal(g)[a]) return;
  const adv = advice(g), right = adv.act === a;
  if (!auto) { stats.dec++; if (right) stats.ok++; }
  const verdict = right ? null : "Écart : le tableau disait " + ACT[adv.act].toLowerCase() + ".";
  busy = true; ui();
  act(g, a);
  await playEvents(g.events);
  busy = false; ui(); coachLine();
  if (verdict && !auto) { adviceEl.textContent = verdict + " " + adviceEl.textContent; adviceEl.setAttribute("data-tone", "bad"); }
  afterTurn();
}
function afterTurn() {
  if (g.phase === "bet" && freshOnBet) { freshOnBet = false; resetAll(); }
}
let freshOnBet = false;
function resetAll() {
  g.bank = BANK0; stats.hands = 0; stats.dec = 0; stats.ok = 0; stats.start = BANK0; bet = 0;
  if (g.phase === "bet") showPending();
  ui();
}
function takeOver() {
  if (!auto) return;
  auto = false;
  document.querySelector('[data-opt="auto"]').checked = false;
  speed = 1;
  if (demo) { demo = false; if (g.phase === "bet" && !busy) resetAll(); else freshOnBet = true; }
}
async function autoLoop() {
  while (auto) {
    await wait(0.9);
    if (!auto) break;
    if (busy) continue;
    if (g.phase === "bet") { if (g.bank < 1) resetAll(); await startRound(Math.min(5, g.bank)); await wait(0.8); }
    else await doAct(advice(g).act);
  }
}

document.querySelector(".bj-layout").addEventListener("pointerdown", (event) => { if (!event.target.closest("label,[data-do=theme]")) takeOver(); });
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.do === "theme") { const body = document.body; body.dataset.theme = body.dataset.theme === "light" ? "dark" : "light"; return; }
  takeOver();
  if (b.dataset.chip) addChip(Number(b.dataset.chip));
  if (b.dataset.do === "clear") { bet = 0; showPending(); ui(); }
  if (b.dataset.do === "deal") startRound(bet || Math.min(lastBet, g.bank));
  if (b.dataset.do === "reset") resetAll();
  if (b.dataset.act) doAct(b.dataset.act);
});
async function addChip(v) {
  if (busy || g.phase !== "bet" || bet + v > Math.min(g.bank, TABLE_MAX)) return;
  if (dealerView.cards.length) { busy = true; ui(); await sweep(); busy = false; }
  bet += v; showPending(); say("Mise : " + fmt(bet) + "."); ui();
}
document.querySelector('[data-opt="coach"]').addEventListener("change", (e) => { coach = e.target.checked; ui(); coachLine(); });
document.querySelector('[data-opt="count"]').addEventListener("change", (e) => { statsBox.toggleAttribute("data-nocount", !e.target.checked); });
document.querySelector('[data-opt="auto"]').addEventListener("change", (e) => { if (e.target.checked) { auto = true; autoLoop(); } else takeOver(); });
document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  const map = { t: "H", r: "S", d: "D", s: "P" };
  if (map[key]) { takeOver(); doAct(map[key]); }
  else if (key === "enter" || (key === " " && event.target.tagName !== "BUTTON")) { event.preventDefault(); takeOver(); if (g.phase === "bet") startRound(bet || Math.min(lastBet, g.bank)); }
  else if ("1234".includes(key)) { takeOver(); addChip([1, 5, 25, 100][Number(key) - 1]); }
  else if (key === "backspace") { takeOver(); bet = 0; showPending(); ui(); }
});

drawShoe(); drawDiscard(); ui();
if (auto) { say("Démonstration en pilote automatique : un clic ou une touche vous rend la main."); autoLoop(); }
else { document.querySelector('[data-opt="auto"]').checked = false; say("Choisissez une mise."); }
