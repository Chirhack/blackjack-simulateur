
const P = __P__;
const START = __START__;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (name) => svg.querySelector('[data-part="' + name + '"]');
const parts = Object.fromEntries(["stack", "next", "pusher", "tray", "rear", "front", "wheel", "rcbar", "dbar", "pin", "idler", "gear", "slider", "sliderpin", "arm", "pinhead", "sliderhead", "chips", "follower", "needle", "belt", "wire-rear", "wire-front"].map((n) => [n, $(n)]));
const cards = ["a", "b"].map((n) => svg.querySelector('[data-card="' + n + '"]'));
const lamps = { 1: svg.querySelector('[data-lamp="plus"]'), 0: svg.querySelector('[data-lamp="zero"]'), "-1": svg.querySelector('[data-lamp="minus"]') };
const digits = [0, 1, 2].map((i) => svg.querySelector('[data-digit="' + i + '"]'));
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "V", "D", "R"];
const SUITS = ["♠︎", "♥︎", "♦︎", "♣︎"];

// Un sabot mélangé, gardé seulement s'il reste dans les butées de la machine.
function fits(order, want) {
  let rc = 0;
  for (let i = 0; i < CUT; i++) {
    rc += tagOf(order[i].rank);
    const d = (CARDS - i - 1) / 52;
    if (Math.abs(rc) > RC_STOP || Math.abs(rc / d) > TC_STOP) return false;
    if (want && i + 1 === want.dealt && rc !== want.rc) return false;
  }
  return true;
}
function newShoe(want) {
  const order = [];
  for (let d = 0; d < DECKS; d++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) order.push({ rank: r, suit: s });
  for (let tries = 0; tries < 20000; tries++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (fits(order, want)) break;
  }
  return order;
}

let order = newShoe(START);
let dealt = START.dealt, rc = START.rc;              // ce que la machine a compté
let rcS = rc, dS = (CARDS - dealt) / 52, lift = (betOf(rc / dS) - 1) * CHIP_T;
let trayN = dealt;
let flight = null, slot = 0, resting = null, queued = 0, holding = false, shuffling = 0;
let pulse = { rear: 0, front: 0 };
let frame = 0, last = 0, visible = false, touring = !still.matches, idle = 0, wait = 1.2;
let drawn = { rc: null, d: null, tray: null, cut: null };

const fr = (v, n = 1) => (Math.round(Math.abs(v) * 10 ** n) === 0 ? "" : v > 0 ? "+" : "−") + Math.abs(v).toFixed(n).replace(".", ",");
const say = (text) => { status.textContent = text; };

function paintCard(el, card) {
  const red = card.suit === 1 || card.suit === 2;
  el.toggleAttribute("data-red", red);
  el.querySelectorAll("[data-rank]").forEach((t) => (t.textContent = RANKS[card.rank]));
  el.querySelectorAll("[data-suit]").forEach((t) => (t.textContent = SUITS[card.suit]));
}
function placeCard(el, t, top) {
  const { c, R } = cardAt(t, top);
  const { m, face } = cardMatrix(c, [R[0] * 0.999, 0, R[2] * 0.999], [0, 1, 0], P);
  el.setAttribute("transform", m);
  el.style.display = "";
  el.children[0].style.display = face ? "none" : "";
  el.children[1].style.display = face ? "" : "none";
}
const trayTop = () => TRAY_Z + trayN * TRAY_U + 0.2;

function deal() {
  if (flight || shuffling) return false;
  if (dealt >= CUT) { shuffle(); return false; }
  const card = order[dealt];
  const el = cards[slot];
  paintCard(el, card);
  flight = { card, el, t: 0, read: false, out: false };
  dealt++;
  say(RANKS[card.rank] + " : " + (tagOf(card.rank) > 0 ? "plus un" : tagOf(card.rank) < 0 ? "moins un" : "neutre"));
  run();
  return true;
}
function shuffle() {
  if (shuffling || flight) return;
  shuffling = 1; queued = 0;
  cards.forEach((c) => (c.style.display = "none"));
  resting = null;
  order = newShoe();
  dealt = 0; rc = 0; trayN = 0;
  say("Carte de coupe : le sabot est rebattu.");
  run();
}

function write() {
  const shown = rc / ((CARDS - dealt) / 52);
  const text = shuffling ? "on rebat · RC 0 · 6,0 p" : "RC " + fr(rc, 0) + " · " + ((CARDS - dealt) / 52).toFixed(1).replace(".", ",") + " p · TC " + (fr(shown) || "0,0") + " · " + fr(edgeOf(shown), 2) + " % · mise " + betOf(shown);
  if (readout.textContent !== text) readout.textContent = text;
}

function draw() {
  const tc = rcS / dS;
  const moved = drawn.rc !== rcS || drawn.d !== dS;
  if (moved) {
    const px = pinX(dS), by = barY(rcS), sy = sliderY(tc);
    parts.rcbar.setAttribute("transform", translateAlong(P, [0, by, 0]));
    parts.dbar.setAttribute("transform", translateAlong(P, [px, 0, 0]));
    parts.pusher.setAttribute("transform", translateAlong(P, [px, 0, 0]));
    const both = translateAlong(P, [px, by, 0]), side = translateAlong(P, [0, sy, 0]);
    parts.pin.setAttribute("transform", both); parts.pinhead.setAttribute("transform", both);
    parts.slider.setAttribute("transform", side); parts.sliderpin.setAttribute("transform", side); parts.sliderhead.setAttribute("transform", side);
    parts.arm.innerHTML = armHtml(rcS, dS, P);
    parts.wheel.innerHTML = wheelHtml(rcS, P);
    parts.idler.innerHTML = idlerHtml(tc, P);
    parts.gear.innerHTML = gearHtml(tc, P);
    parts.needle.setAttribute("d", needlePath(tc, P));
    parts.belt.style.strokeDashoffset = (rcS * KY * 1.4).toFixed(2);
  }
  const cut = dealt < CUT;
  if (drawn.d !== dS || drawn.cut !== cut) parts.stack.innerHTML = stackHtml(dS, cut, P);
  if (drawn.tray !== trayN) parts.tray.innerHTML = trayHtml(trayN, P);
  parts.next.style.display = dS * 52 < 2 ? "none" : "";
  const up = translateAlong(P, [0, 0, lift]);
  parts.chips.setAttribute("transform", up); parts.follower.setAttribute("transform", up);
  const count = String(trayN).padStart(3, "0");
  digits.forEach((d, i) => { if (d.textContent !== count[i]) d.textContent = count[i]; });
  drawn = { rc: rcS, d: dS, tray: trayN, cut };
}

const fire = (tag) => {
  for (const key of Object.keys(lamps)) lamps[key].toggleAttribute("data-on", Number(key) === tag);
  if (tag > 0) { pulse.front = 1; parts["wire-front"].toggleAttribute("data-on", true); }
  if (tag < 0) { pulse.rear = 1; parts["wire-rear"].toggleAttribute("data-on", true); }
};
const pulseAt = { rear: 0, front: 0 };

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  const fast = holding || queued > 1;
  const speed = fast ? 3.4 : calm ? 8 : 1 / 0.95;

  if (touring && !flight && !shuffling) { wait -= dt; if (wait <= 0) { wait = 0.16; deal(); } }
  if (holding && !flight) deal();
  if (queued > 0 && !flight && !shuffling && deal()) queued--;

  if (flight) {
    const f = flight;
    f.t = Math.min(1, f.t + dt * speed);
    if (!f.out && f.t > 0.02) { f.out = true; }
    if (f.t >= T_READ && !f.read) {
      f.read = true;
      const tag = tagOf(f.card.rank);
      rc += tag;
      fire(tag);
    }
    placeCard(f.el, f.t, trayTop());
    if (f.t >= 1) {
      trayN++;
      if (resting && resting !== f.el) resting.style.display = "none";
      resting = f.el;
      placeCard(f.el, 1, trayTop());
      flight = null;
      slot = 1 - slot;
      for (const key of Object.keys(lamps)) lamps[key].removeAttribute("data-on");
      parts["wire-front"].removeAttribute("data-on"); parts["wire-rear"].removeAttribute("data-on");
      if (dealt >= CUT) { wait = 1.6; if (touring || holding) { setTimeout(() => { if (dealt >= CUT) shuffle(); }, 1600); } say("Carte de coupe atteinte."); }
    }
  }

  // Les chaînes suivent : rochet et barre, poussoir et seconde barre.
  const wantD = (CARDS - dealt) / 52;
  const follow = (v, to, tau, eps) => { const n = calm ? to : v + (to - v) * (1 - Math.exp(-dt / tau)); return Math.abs(to - n) < eps ? to : n; };
  rcS = follow(rcS, rc, shuffling ? 0.32 : fast ? 0.05 : 0.09, 0.002);
  dS = follow(dS, wantD, shuffling ? 0.32 : fast ? 0.05 : 0.14, 0.0004);
  const bet = betOf(rcS / dS);
  lift = follow(lift, (bet - 1) * CHIP_T, 0.08, 0.002);
  if (shuffling && rcS === rc && dS === wantD) { shuffling = 0; wait = 1.2; say("Sabot neuf : six paquets."); }

  for (const key of ["rear", "front"]) {
    if (pulse[key] > 0) { pulseAt[key] = Math.min(1, pulseAt[key] + dt * 26); if (pulseAt[key] >= 1) pulse[key] = 0; }
    else if (pulseAt[key] > 0) pulseAt[key] = Math.max(0, pulseAt[key] - dt * 7);
  }
  if (pulseAt.rear !== tick.r) { parts.rear.innerHTML = plungerHtml(REAR_Y, pulseAt.rear, P); tick.r = pulseAt.rear; }
  if (pulseAt.front !== tick.f) { parts.front.innerHTML = plungerHtml(FRONT_Y, pulseAt.front, P); tick.f = pulseAt.front; }

  draw();
  write();
  const busy = touring || holding || flight || queued || shuffling || rcS !== rc || dS !== wantD || pulseAt.rear || pulseAt.front || Math.abs(lift - (bet - 1) * CHIP_T) > 0;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }

function takeOver() {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => { if (still.matches) return; touring = true; wait = 0.4; run(); }, 7000);
}
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

let pressTimer = 0;
stage.addEventListener("pointerdown", (event) => {
  if (event.button) return;
  takeOver();
  if (dealt >= CUT && !flight) { shuffle(); return; }
  queued = flight ? 1 : queued;
  if (!flight) deal();
  pressTimer = setTimeout(() => { holding = true; run(); }, 320);
});
const release = () => { clearTimeout(pressTimer); holding = false; };
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("pointerleave", release);
stage.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === " " || event.key === "Enter") { event.preventDefault(); takeOver(); if (event.repeat) { holding = true; run(); } else if (dealt >= CUT && !flight) shuffle(); else if (flight) queued = 1; else deal(); }
  if (event.key === "r" || event.key === "R") { takeOver(); if (!flight) shuffle(); }
});
stage.addEventListener("keyup", (event) => { if (event.key === " " || event.key === "Enter") holding = false; });
window.addEventListener("blur", release);
resting = cards[1];
paintCard(resting, order[dealt - 1]);
placeCard(resting, 1, trayTop());
draw();
write();
