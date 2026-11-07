import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "file:///C:/Users/chichi/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "file:///C:/Users/chichi/.claude/skills/anatomy/scripts/inline-kit.mjs";
import * as M from "./parts.mjs";
import * as G from "./game.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 760, HEIGHT = 432;
const { FZ, CY, R_OUT, R_FELT } = M;

const arc = (r, a0 = -90, a1 = 90, n = 96) => Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [r * Math.sin(a), CY + r * Math.cos(a)]; });
const OUTER = arc(R_OUT);
const INNER = (() => { const t = (Math.asin(8 / R_FELT) * 180) / Math.PI; return arc(R_FELT, -90 + t, 90 - t); })();
const PLINTH = arc(R_OUT - 16, -88, 88).map(([x, y]) => [x, Math.max(y, CY + 6)]);

const P = k.fitProjection(
  [...OUTER.map(([x, y]) => [x, y, 0]), ...OUTER.map(([x, y]) => [x, y, -30]), [278, -112, 44], [-272, -112, 22]],
  WIDTH, HEIGHT, { pad: 14, azimuth: 97, elevation: 50, headroom: 6 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const screws = (pts, z, size = 0.5, tone = "mid") => D(pts.map(([x, y]) => at([x, y, z])), { size, tone });
const box = (plan, z, h, steps = 3, bevel = 0.4) => k.slabOf(plan, z, h, P, steps, bevel);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function table() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.extrude(OUTER, -30, 24, P).fill}"/>`);
  const feet = [[-250, -112], [250, -112], [-190, 72], [190, 72], [0, 130]];
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 15, -30, 2, P, 32), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 11, -28, 8, P, 32), { tone: "mid", inner: L(k.sideArc(x, y, 11, -24, P, 20), { tone: "faint" }) }));
  }
  out.push(S(k.extrude(PLINTH, -22, 6, P), { tone: "lo" }));
  // Le corps en bois et le bourrelet de cuir, séparés par une couture.
  out.push(S(k.extrude(OUTER, -16, 16, P, { bevel: 1.2 }), { tone: "mid", inner: L(k.ringSeam(OUTER, -9, P) + k.ringSeam(OUTER, -12, P), { tone: "faint" }) }));
  // Piqûre du bourrelet et lignes de l'accoudoir.
  out.push(L(k.onTop(arc(R_OUT - 7), 0, P), { tone: "lo" }), `<path class="bj-stitch" d="${k.onTop(arc(R_OUT - 19), 0, P)}"/>`);
  // Boutons du bourrelet.
  const rivets = []; for (let a = -80; a <= 80; a += 20) { const r = (a * Math.PI) / 180; rivets.push([(R_OUT - 13) * Math.sin(r), CY + (R_OUT - 13) * Math.cos(r)]); }
  out.push(L(rivets.map(([x, y]) => k.ring(x, y, 1.7, 0, P, 12)).join(""), { tone: "lo" }), screws(rivets, 0, 0.45));
  // Le feutre, en creux sous le bourrelet.
  const opening = k.onTop(INNER, 0, P, true);
  out.push(`<clipPath id="bj-felt"><path d="${opening}"/></clipPath><path class="bj-wall" d="${opening}"/><g clip-path="url(#bj-felt)"><path class="bj-felt" d="${k.onTop(INNER, FZ, P, true)}"/>${felt()}</g>`);
  out.push(L(opening, { tone: "mid" }));
  return out.join("");
}

function felt() {
  const out = [];
  // Arcs imprimés, posés dans le plan du feutre.
  const m = k.topMatrix([0, CY], FZ, P, "x");
  const smile = (r) => `M${-r} 0A${r} ${r} 0 0 0 ${r} 0`;
  out.push(`<g transform="${m}"><path id="bj-a1" d="${smile(137)}" fill="none"/><path id="bj-a2" d="${smile(114)}" fill="none"/>
<text class="bj-print" font-size="13" text-anchor="middle" letter-spacing="2.4"><textPath href="#bj-a1" startOffset="50%">LE BLACKJACK PAIE 3 CONTRE 2</textPath></text>
<text class="bj-print" font-size="6.4" text-anchor="middle" letter-spacing="1.1"><textPath href="#bj-a2" startOffset="50%">LE CROUPIER TIRE JUSQU'À 16 ET RESTE SUR TOUS LES 17</textPath></text></g>`);
  // Les enseignes imprimées entre les emplacements.
  ["\u2660\uFE0E", "\u2665\uFE0E", "\u2666\uFE0E", "\u2663\uFE0E"].forEach((s, i) => {
    const a = ([-33, -11, 11, 33][i] * Math.PI) / 180, x = M.R_SPOT * Math.sin(a), y = CY + M.R_SPOT * Math.cos(a) + 3.6;
    out.push(`<text class="bj-print" transform="${k.topMatrix([x, y], FZ, P, "x")}" font-size="11" text-anchor="middle">${s}</text>`);
  });
  // Les cinq emplacements de mise.
  for (let i = 0; i < 5; i++) {
    const [x, y] = M.spotOf(i);
    out.push(L(k.ring(x, y, 27, FZ, P, 56), { tone: "mid" }), L(k.ring(x, y, 23.6, FZ, P, 56), { tone: "lo" }));
  }
  return out.join("");
}

function apron() {
  const out = [];
  // Plateau de jetons du croupier.
  const T = { x: -104, y: -128, w: 208, d: 30, r: 3 }, zt = FZ + 7;
  out.push(S(box(T, FZ, 7, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(T, FZ + 2.2, P, 4), { tone: "faint" }) }));
  const tones = [100, 100, 25, 25, 5, 5, 5, 1, 1];
  tones.forEach((v, i) => {
    const x = -88 + i * 22, y = -113;
    out.push(L(k.ring(x, y, 10.6, zt, P, 28), { tone: "lo" }));
    for (let n = 0; n < 3; n++) out.push(M.chipHtml(x, y, zt + n * M.CHIP_T - 1.4, v, P, 9.6));
  });
  out.push(screws([[T.x + 5, T.y + 5], [T.x + T.w - 5, T.y + 5], [T.x + 5, T.y + T.d - 5], [T.x + T.w - 5, T.y + T.d - 5]], zt, 0.45));
  // Fente de la caisse et sa plaque.
  const slot = { x: 120, y: -122, w: 44, d: 20, r: 2 };
  out.push(S(box(slot, FZ, 1.6, 3, 0.3), { tone: "lo", crease: "none" }));
  out.push(`<path class="bj-dark" d="${k.planOutline({ x: 128, y: -114, w: 28, d: 4, r: 1.4 }, FZ + 1.6, P, 3)}"/>`, L(k.planOutline({ x: 128, y: -114, w: 28, d: 4, r: 1.4 }, FZ + 1.6, P, 3), { tone: "lo" }));
  out.push(screws(k.corners(slot, 3), FZ + 1.6, 0.42));
  // Plaque des limites, debout sur son pied.
  const foot = { x: -176, y: -122, w: 42, d: 12, r: 2 };
  out.push(S(box(foot, FZ, 2, 3, 0.3), { tone: "lo" }));
  const sign = { x: -172, y: -118, w: 34, d: 3, r: 0.6 };
  out.push(S(box(sign, FZ + 2, 19), { tone: "mid" }));
  const yf = sign.y + sign.d;
  out.push(k.faceTextSvg(k.sideMatrix([-155, yf], 11.2, P, "left"), "MIN 1", { size: 4.6, tone: "hi", anchor: "middle" }));
  out.push(k.faceTextSvg(k.sideMatrix([-155, yf], 4.6, P, "left"), "MAX 500", { size: 4.6, tone: "mid", anchor: "middle" }));
  return out.join("");
}

function shoeBack() {
  const out = [];
  const s = M.SHOE, z0 = FZ, zt = 16;
  out.push(`<path class="iso-halo" style="filter:blur(5px)" d="${k.haloOf(s, z0, 3, P)}"/>`);
  out.push(S(box(s, z0, 3, 3, 0.5), { tone: "lo" }));
  out.push(S(box({ x: s.x + 8, y: s.y, w: s.w - 8, d: 3, r: 1 }, z0 + 3, zt - z0 - 3), { tone: "mid" }));
  out.push(S(box({ x: s.x + s.w - 3, y: s.y, w: 3, d: s.d, r: 1 }, z0 + 3, zt - z0 - 3), { tone: "mid" }));
  return out.join("");
}
function pusher() {
  const y = M.SHOE_Y - 24, h = 48;
  const out = [S(box({ x: 0, y, w: 9, d: h, r: 1 }, FZ + 3, 31, 3, 0.5), { tone: "mid" })];
  const top = FZ + 34;
  out.push(screws([[2.4, y + 4], [6.6, y + 4], [2.4, y + h - 4], [6.6, y + h - 4]], top, 0.42));
  out.push(S(k.cylinder(4.5, M.SHOE_Y, 1.8, top, 2, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(4.5, M.SHOE_Y, 4, top + 2, 4, P, 24, 0.3), { tone: "hi", crease: "lo", inner: L(k.knurl(4.5, M.SHOE_Y, 4, top + 2.2, top + 5.8, 20, P, 0.2), { tone: "lo" }) }));
  return out.join("");
}
function shoeFront() {
  const out = [];
  const s = M.SHOE, zt = 16, wall = { x: s.x + 8, y: s.y + s.d - 3, w: s.w - 8, d: 3, r: 1 };
  out.push(S(box(wall, FZ + 3, zt - FZ - 3), { tone: "mid", inner: L(k.sideSeam(wall, 2, P, 3), { tone: "faint" }) }));
  // Règle des paquets sur la paroi.
  const yf = wall.y + wall.d, ticks = [];
  for (let d = 0; d <= 6; d++) { const x = M.SHOE_MOUTH + (d / 6) * M.SHOE_LEN; ticks.push(k.segment([x, yf, zt], [x, yf, zt - (d % 2 ? 2 : 3.4)], P)); }
  out.push(L(ticks.join(""), { tone: "mid" }));
  for (const d of [2, 4, 6]) out.push(k.faceTextSvg(k.sideMatrix([M.SHOE_MOUTH + (d / 6) * M.SHOE_LEN - 1.2, yf], 7.4, P, "left"), String(d), { size: 3.4, tone: "mid" }));
  // Joues de la bouche.
  for (const y of [s.y, s.y + s.d - 3.4]) out.push(S(box({ x: s.x, y, w: 9, d: 3.4, r: 1 }, FZ + 3, 25), { tone: "mid" }));
  out.push(screws([[s.x + 4.5, s.y + 1.7], [s.x + 4.5, s.y + s.d - 1.7]], FZ + 28, 0.45));
  return out.join("");
}
function discardBack() {
  const out = [];
  const d = M.DISCARD;
  out.push(`<path class="iso-halo" style="filter:blur(5px)" d="${k.haloOf(d, FZ, 2, P)}"/>`);
  out.push(S(box(d, FZ, 2, 3, 0.4), { tone: "lo" }));
  const back = { x: d.x, y: d.y, w: d.w, d: 3, r: 1 };
  const marks = [1, 2, 3, 4].map((n) => k.sideSeam(back, FZ + 2 + n * 52 * M.DISCARD_U, P, 3)).join("");
  out.push(S(box(back, FZ + 2, 20), { tone: "mid", inner: L(marks, { tone: "lo" }) }));
  out.push(S(box({ x: d.x, y: d.y, w: 3, d: d.d, r: 1 }, FZ + 2, 20), { tone: "mid" }));
  return out.join("");
}
function discardFront() {
  const d = M.DISCARD;
  return S(box({ x: d.x, y: d.y + d.d - 3, w: d.w, d: 3, r: 1 }, FZ + 2, 4), { tone: "mid" }) + S(box({ x: d.x + d.w - 3, y: d.y, w: 3, d: d.d, r: 1 }, FZ + 2, 4), { tone: "mid" });
}

const nextCard = () => {
  const m = M.cardMatrix([M.SHOE_MOUTH, M.SHOE_Y, FZ + 15], [0, 0, 1], [0, 1, 0], P), w = 30, h = 46;
  return `<g data-part="next" transform="${m.m}"><rect class="bj-card" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="1.4"/><rect class="bj-back" x="${-w / 2 + 2.6}" y="${-h / 2 + 2.6}" width="${w - 5.2}" height="${h - 5.2}" rx="1"/></g>`;
};

const part = (name, html, tr = "") => `<g data-part="${name}"${tr ? ` transform="${tr}"` : ""}>${html}</g>`;
const spots = [0, 1, 2, 3, 4].map((i) => { const [x, y] = M.spotOf(i); return `<path class="iso-line bj-active" data-tone="lit" data-free="" data-spot="${i}" d="${k.ring(x, y, 27, FZ, P, 56)}" style="stroke-width:1.2;display:none"/>`; }).join("");

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "Une table de blackjack en demi-lune vue de trois quarts : un bourrelet de cuir, un feutre imprimé, cinq emplacements de mise, le plateau de jetons du croupier, un sabot de six paquets à droite et le bac de défausse à gauche. On y joue avec les boutons sous la table.",
  body: [
    `<defs><pattern id="bj-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="bj-hatch" d="M0 0V4M0 0H4"/></pattern></defs>`,
    table(), spots, apron(), discardBack(), part("discard", M.discardHtml(0, P)),
    shoeBack(), part("shoe", M.shoeStackHtml(0, true, P)), nextCard(), part("pusher", pusher(), k.translateAlong(P, [M.pusherX(0), 0, 0])), shoeFront(),
    discardFront(),
    `<g data-part="pills"></g><g data-part="cards"></g><g data-part="chips"></g>`,
  ],
});

// Le tableau sur le côté : généré depuis strategy(), une case par couple main × carte du croupier.
const LETTER = { H: "T", S: "R", D: "D", Ds: "Dr", P: "S" };
const head = `<tr><th></th>${G.COLS.map((c) => `<th data-col="${c}">${c === 1 ? "A" : c}</th>`).join("")}</tr>`;
const chartOf = (title, rows) => `<table class="bj-chart"><caption>${title}</caption><thead>${head}</thead><tbody>${rows.map((row) => `<tr data-row="${row.key}"><th>${row.label}</th>${G.COLS.map((up) => { const c = G.cellOf(row, up); return `<td class="c-${c}" data-up="${up}">${LETTER[c]}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
const side = `<aside class="bj-side" aria-label="Tableau de stratégie de base">
<div class="bj-stats">
<div><span>Solde</span><b data-stat="bank">1 000</b></div><div><span>Résultat</span><b data-stat="net">0</b></div>
<div><span>Mains</span><b data-stat="hands">0</b></div><div><span>Décisions justes</span><b data-stat="ok">–</b></div>
<div data-count><span>Compte courant</span><b data-stat="rc">0</b></div><div data-count><span>True count</span><b data-stat="tc">0,0</b></div>
<div data-count><span>Paquets restants</span><b data-stat="decks">6,0</b></div><div data-count><span>Avantage estimé</span><b data-stat="edge">−0,38 %</b></div>
</div>
<p class="bj-advice" data-advice aria-live="polite">Choisissez une mise.</p>
${chartOf("Mains dures", G.CHART.hard)}${chartOf("Mains souples", G.CHART.soft)}${chartOf("Paires", G.CHART.pair)}
<p class="bj-legend"><span class="c-H">T</span> tirer <span class="c-S">R</span> rester <span class="c-D">D</span> doubler, sinon tirer <span class="c-Ds">Dr</span> doubler, sinon rester <span class="c-P">S</span> séparer</p>
</aside>`;

const chipBtn = (v) => `<button class="bj-chip" data-chip="${v}" data-v="${v}" aria-label="Ajouter ${v} à la mise">${v}</button>`;
const controls = `<div class="bj-controls">
<div class="bj-row" data-bet>${[1, 5, 25, 100].map(chipBtn).join("")}<button data-do="clear">Effacer</button><button class="bj-main" data-do="deal">Distribuer</button></div>
<div class="bj-row" data-play><button data-act="H">Tirer <kbd>T</kbd></button><button data-act="S">Rester <kbd>R</kbd></button><button data-act="D">Doubler <kbd>D</kbd></button><button data-act="P">Séparer <kbd>S</kbd></button></div>
<div class="bj-row bj-opts"><label><input type="checkbox" data-opt="coach" checked> Conseil</label><label><input type="checkbox" data-opt="count" checked> Compte Hi-Lo</label><label><input type="checkbox" data-opt="auto" checked> Pilote auto</label><button data-do="theme">Thème</button><button data-do="reset">Remettre à zéro</button></div>
</div>`;

const css = `<style>
.bj-layout{display:grid;grid-template-columns:minmax(0,1fr) 372px;gap:22px;align-items:start}
@media(max-width:1060px){.bj-layout{grid-template-columns:minmax(0,1fr)}}
.iso-page{margin-top:28px!important}
.bj-wall{fill:var(--anatomy-shade-0)}
.bj-felt{fill:var(--bj-felt)}
.iso{--bj-felt:var(--anatomy-shade-3)}
.bj-print{fill:var(--anatomy-lo);font-family:var(--anatomy-mono);font-weight:600}
.bj-stitch{fill:none;stroke:var(--anatomy-lo);stroke-width:.7px;stroke-dasharray:2.4 2.4}
.bj-dark{fill:var(--anatomy-shade-0)}
.iso{--bj-paper:#efefec;--bj-ink:#1a1a1c;--bj-red:#cf2e36;--bj-edge:#8a8a8f}
.iso[data-theme="light"]{--bj-paper:#ffffff;--bj-edge:#26262a}
.bj-card{fill:var(--bj-paper);stroke:var(--bj-edge);stroke-width:.6px;vector-effect:non-scaling-stroke}
.bj-back{fill:url(#bj-hatch);stroke:var(--bj-ink);stroke-width:.5px;vector-effect:non-scaling-stroke}
.bj-hatch{fill:none;stroke:var(--bj-ink);stroke-width:.5}
.bj-rank,.bj-suit{fill:var(--bj-ink);font-family:var(--anatomy-mono);font-weight:700}
[data-red] .bj-rank,[data-red] .bj-suit{fill:var(--bj-red)}
.iso-figure{margin:0}
.bj-pill rect{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:.6px;vector-effect:non-scaling-stroke}
.bj-pill text{fill:var(--anatomy-strong);font-family:var(--anatomy-mono);font-weight:600}
.bj-pill[data-res="win"] rect,.bj-pill[data-res="bj"] rect{stroke:var(--anatomy-green)}
.bj-pill[data-res="lose"] rect,.bj-pill[data-res="bust"] rect{stroke:var(--anatomy-red)}
.bj-controls{margin-top:12px;display:grid;gap:9px}
.bj-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.bj-row[hidden]{display:none}
.bj-controls button{font:600 13px/1 var(--anatomy-mono);color:var(--anatomy-strong);background:var(--anatomy-card);border:1px solid var(--anatomy-lo);border-radius:7px;padding:10px 14px;cursor:pointer;transition:border-color .15s,opacity .15s}
.bj-controls button:hover:not(:disabled){border-color:var(--anatomy-hi)}
.bj-controls button:disabled{opacity:.35;cursor:default}
.bj-controls button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:2px}
.bj-controls .bj-main{background:var(--anatomy-strong);color:var(--anatomy-card);border-color:var(--anatomy-strong);margin-left:auto}
.bj-controls .bj-chip{width:46px;height:46px;padding:0;border-radius:50%;border:2px dashed var(--anatomy-mid)}
.bj-controls .bj-chip[data-v="25"]{border-color:var(--anatomy-hi)}
.bj-controls .bj-chip[data-v="100"]{border-color:var(--anatomy-strong);border-style:double;border-width:4px}
.bj-controls kbd{font:inherit;color:var(--anatomy-muted);margin-left:4px}
.bj-opts{font-size:12.5px;color:var(--anatomy-text)}
.bj-opts label{display:flex;align-items:center;gap:5px;cursor:pointer}
.bj-opts button{padding:6px 10px!important;font-size:12px!important}
.bj-opts button:last-child{margin-left:0}
.bj-note{font-size:12.5px;line-height:1.55;color:var(--anatomy-muted);margin:14px 2px 0}
.bj-side{display:grid;gap:10px;font-family:var(--anatomy-mono)}
.bj-stats{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--anatomy-faint);border:1px solid var(--anatomy-faint);border-radius:9px;overflow:hidden}
.bj-stats div{background:var(--anatomy-card);padding:7px 10px;display:flex;justify-content:space-between;align-items:baseline;gap:6px}
.bj-stats[data-nocount] [data-count]{display:none}
.bj-stats span{font-size:10.5px;color:var(--anatomy-muted)}
.bj-stats b{font-size:13.5px;color:var(--anatomy-strong);font-weight:600;white-space:nowrap}
.bj-advice{margin:0;min-height:40px;padding:9px 11px;font-size:12.5px;line-height:1.4;color:var(--anatomy-strong);border:1px solid var(--anatomy-lo);border-radius:9px}
.bj-advice[data-tone="bad"]{border-color:var(--anatomy-red)}
.bj-advice[data-tone="good"]{border-color:var(--anatomy-green)}
.bj-chart{width:100%;border-collapse:separate;border-spacing:1.5px;table-layout:fixed;font-size:10.5px}
.bj-chart caption{text-align:left;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);padding:0 0 3px}
.bj-chart th{font-weight:600;color:var(--anatomy-muted);padding:1.5px 0;text-align:center}
.bj-chart tbody th{width:34px;white-space:nowrap}
.bj-chart thead th:first-child{width:34px}
.bj-chart td{text-align:center;padding:2.5px 0;border-radius:3px;color:var(--anatomy-strong);font-weight:600}
.c-H{background:color-mix(in srgb,var(--anatomy-mid) 16%,transparent)}
.c-S{background:color-mix(in srgb,var(--anatomy-green) 26%,transparent)}
.c-D,.c-Ds{background:color-mix(in srgb,var(--anatomy-blue) 32%,transparent)}
.c-P{background:color-mix(in srgb,var(--anatomy-red) 28%,transparent)}
.bj-chart [data-on]{color:var(--anatomy-strong)!important}
.bj-chart tr[data-on] th{color:var(--anatomy-strong)}
.bj-chart td[data-hit]{outline:2px solid var(--anatomy-lit);outline-offset:-1px}
.bj-chart [data-dim]{opacity:.42}
.bj-legend{margin:0;font-size:10.5px;line-height:2;color:var(--anatomy-text)}
.bj-legend span{display:inline-block;min-width:19px;text-align:center;border-radius:3px;color:var(--anatomy-strong);font-weight:600;margin-left:5px}
.bj-legend span:first-child{margin-left:0}
.bj-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.iso-stage{touch-action:pan-y}
</style>`;

const plate = k.plateHtml({
  fig: "Fig 2", title: "Table de blackjack", hint: "Misez, puis distribuez",
  readout: "solde 1 000 · mise 0",
  body: `<div class="iso-stage" role="group" aria-label="Table de blackjack">${svg}<span class="bj-sr" role="status" aria-live="polite" data-status></span></div>`,
});
const body = css + `<div class="bj-layout"><div>${plate}${controls}<p class="bj-note">Jeu fictif, sans argent réel. 6 paquets, le croupier reste sur tous les 17, doublement après séparation, blackjack payé 3:2, 4 mains au plus, un seul tirage sur des as séparés, ni assurance ni abandon, coupe à 234 cartes. Le moteur rejoue la stratégie de base à −0,44 % ± 0,04 sur 8 millions de coups, et l'avantage estimé est la droite −0,38 % + 0,49 % par point de true count mesurée sur 70 millions. Clavier : T, R, D, S, Entrée pour distribuer, 1 à 4 pour les jetons.</p></div>${side}</div>`;

const strip = (f) => readFileSync(join(HERE, f), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const live = readFileSync(join(HERE, "live.js"), "utf8").replace("__P__", JSON.stringify(P));
const test = process.argv.includes("--test");
const name = test ? "shots/test.html" : theme === "light" ? "blackjack-table-light.html" : "blackjack-table.html";
const hook = test ? "window.__t = { g, stack(ranks) { ranks.forEach((r, i) => { g.shoe[g.pos + i] = { r, s: i % 4 }; }); }, turbo(v) { speed = v; auto = true; demo = false; autoLoop(); }, stop() { auto = false; speed = 1; }, nodes() { return { cards: layers.cards.children.length, chips: layers.chips.children.length, pills: layers.pills.children.length, hands: stats.hands, pos: g.pos, bank: g.bank, discard: discardN }; } };" : "";
const page = k.pageHtml({ title: "Table de blackjack", theme, body, script: kitScript() + strip("parts.mjs") + strip("game.mjs") + live + hook, width: 1190 }).replace('<html lang="en">', '<html lang="fr">');
writeFileSync(join(HERE, name), page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
