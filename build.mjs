import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "file:///C:/Users/chichi/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "file:///C:/Users/chichi/.claude/skills/anatomy/scripts/inline-kit.mjs";
import * as M from "./shared.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 640, HEIGHT = 404;
const PLATE = { x: -142, y: -156, w: 350, d: 284, r: 10 };
const PLATE_H = 10, FOOT_H = 5;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [M.OX, M.CARD_Y, 44], [-96, -140, 44], [M.TUBE[0], M.TUBE[1], 46]],
  WIDTH, HEIGHT, { pad: 16, azimuth: 52, headroom: 10 },
);

// État de départ : RC +7 à 3,5 paquets, soit TC +2.
const START = { dealt: 130, rc: 7 };
const D0 = (M.CARDS - START.dealt) / 52, TC0 = START.rc / D0;

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const screws = (pts, z, size = 0.5, tone = "mid") => D(pts.map(([x, y]) => at([x, y, z])), { size, tone });
const topText = (x, y, z, text, size = 3.4, tone = "mid", anchor = "middle") => k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), text, { size, tone, anchor });
const signed = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
const box = (plan, z, h, steps = 3, bevel = 0.4) => k.slabOf(plan, z, h, P, steps, bevel);

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4.5), 0, P), { tone: "lo" }));
  const corners = k.corners(PLATE, 10);
  out.push(L(corners.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(screws(corners, 0));
  return out.join("");
}

function bed() {
  const BED = { x: -100, y: -56, w: 130, d: 112, r: 2 };
  const out = [S(k.slabOf(BED, 0, 0.5, P, 3), { tone: "lo", crease: "none" })];
  const zb = 0.5, grid = [], rays = [];
  for (let d = 2; d <= 6; d++) grid.push(k.lineOnTop([M.pinX(d), BED.y], [M.pinX(d), BED.y + BED.d], zb, P));
  for (let rc = -24; rc <= 24; rc += 8) grid.push(k.lineOnTop([BED.x, M.barY(rc)], [BED.x + BED.w, M.barY(rc)], zb, P));
  for (const tc of [1, 2, 3, 4, 6, 8, 12]) {
    for (const sign of [1, -1]) {
      const slope = (sign * tc * M.KY) / M.KX;
      const yAt = (x) => -slope * (M.OX - x);
      const y0 = yAt(BED.x + BED.w);
      let x1 = BED.x, y1 = yAt(x1);
      if (Math.abs(y1) > 56) { y1 = Math.sign(y1) * 56; x1 = M.OX + y1 / slope; }
      rays.push(k.lineOnTop([BED.x + BED.w, y0], [x1, y1], zb, P));
    }
  }
  rays.push(k.lineOnTop([BED.x + BED.w, 0], [BED.x, 0], zb, P));
  out.push(L(grid.join(""), { tone: "faint" }), `<g class="bj-rays">${L(rays.join(""), { tone: "lo" })}</g>`);
  out.push(screws(k.corners(BED, 3), zb, 0.4, "lo"));
  return out.join("");
}

function ruler(strip, ticks, labels) {
  const out = [S(k.slabOf(strip, 0, 0.6, P, 2), { tone: "lo", crease: "none" })];
  out.push(L(ticks.minor.join(""), { tone: "lo" }), L(ticks.major.join(""), { tone: "mid" }));
  out.push(labels.join(""));
  return out.join("");
}

function rulers() {
  const out = [];
  // RC, le long du rail gauche.
  const rc = { x: -137, y: -54, w: 14, d: 108, r: 1 }, x1 = rc.x + rc.w;
  const t = { minor: [], major: [] }, labels = [];
  for (let v = -24; v <= 24; v += 2) (v % 8 ? t.minor : t.major).push(k.lineOnTop([x1, M.barY(v)], [x1 - (v % 8 ? 2 : 3.6), M.barY(v)], 0.6, P));
  for (let v = -24; v <= 24; v += 8) labels.push(topText(x1 - 5, M.barY(v) + 1.1, 0.6, signed(v), 3, "mid", "end"));
  out.push(ruler(rc, t, labels));
  // Paquets restants, le long du rail avant.
  const dk = { x: -96, y: 95, w: 132, d: 14, r: 1 }, t2 = { minor: [], major: [] }, l2 = [];
  for (let c = 1.5 * 4; c <= 6 * 4; c++) {
    const d = c / 4, big = c % 4 === 0;
    (big ? t2.major : t2.minor).push(k.lineOnTop([M.pinX(d), dk.y], [M.pinX(d), dk.y + (big ? 3.6 : 2)], 0.6, P));
  }
  for (let d = 2; d <= 6; d++) l2.push(topText(M.pinX(d), dk.y + 8.6, 0.6, String(d), 3.4));
  out.push(ruler(dk, t2, l2));
  // True count, le long du coulisseau.
  const tc = { x: 87, y: -54, w: 14, d: 108, r: 1 }, x2 = tc.x + tc.w, t3 = { minor: [], major: [] }, l3 = [];
  for (let v = -12; v <= 12; v++) (v % 4 ? t3.minor : t3.major).push(k.lineOnTop([x2, M.sliderY(v)], [x2 - (v % 4 ? 2 : 3.6), M.sliderY(v)], 0.6, P));
  for (let v = -12; v <= 12; v += 4) l3.push(topText(x2 - 5, M.sliderY(v) + 1.1, 0.6, signed(v), 3, "mid", "end"));
  out.push(ruler(tc, t3, l3));
  // Plaque de firme.
  const label = { x: -126, y: 110, w: 60, d: 12, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(topText(label.x + 5, label.y + 7.6, 0.8, "HI-LO", 4.4, "mid", "start"));
  out.push(L([20, 15].map((w, i) => k.lineOnTop([label.x + 30, label.y + 4.6 + i * 3], [label.x + 30 + w, label.y + 4.6 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(screws([[label.x + label.w - 3.4, label.y + 6]], 0.8, 0.45));
  return out.join("");
}

const SHOE = { x: -106, y: -146, w: 170, d: 54, r: 3 };
const WALL_H = 20;
const FRONT_Y = SHOE.y + SHOE.d;

function shoeBack() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(SHOE, 1), 0, 6, P)}"/>`];
  out.push(S(k.slabOf(SHOE, 0, 3, P, 4, 0.6), { tone: "lo" }));
  out.push(S(box({ x: SHOE.x, y: SHOE.y, w: SHOE.w, d: 3, r: 1 }, 3, WALL_H - 3), { tone: "mid" }));
  out.push(S(box({ x: SHOE.x, y: SHOE.y, w: 3, d: SHOE.d, r: 1 }, 3, WALL_H - 3), { tone: "mid" }));
  // Le fond rainuré où glisse le poussoir.
  const guide = [SHOE.y + 12, SHOE.y + SHOE.d - 12].map((y) => k.lineOnTop([SHOE.x + 3, y], [M.OX - 1, y], 3, P));
  out.push(L(guide.join(""), { tone: "lo" }));
  return out.join("");
}

function pusher() {
  const out = [];
  const y = M.CARD_Y - M.CARD_H / 2 - 1, d = M.CARD_H + 2;
  out.push(S(box({ x: -13, y, w: 13, d, r: 1.4 }, 3, 33, 3, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan({ x: -13, y, w: 13, d, r: 1.4 }, 2), 36, P, 3), { tone: "faint" }));
  out.push(screws([[-10, y + 5], [-10, y + d - 5], [-3, y + 5], [-3, y + d - 5]], 36, 0.42));
  const [cx, cy] = [-6.5, M.CARD_Y];
  out.push(S(k.cylinder(cx, cy, 2.2, 36, 2.6, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(cx, cy, 4.6, 38.6, 5, P, 28, 0.4), { tone: "hi", crease: "lo", inner: L(k.knurl(cx, cy, 4.6, 38.8, 43.4, 22, P, 0.2), { tone: "lo" }) }));
  return out.join("");
}

function shoeFront() {
  const out = [];
  const wall = { x: SHOE.x, y: FRONT_Y - 3, w: SHOE.w, d: 3, r: 1 };
  const yf = FRONT_Y, zt = WALL_H;
  const seam = k.sideSeam(wall, 6, P, 3);
  out.push(S(box(wall, 3, WALL_H - 3), { tone: "mid", inner: L(seam, { tone: "faint" }) }));
  // La lumière du tenon, puis la règle des paquets gravée sur la paroi.
  const slot = k.pathOf(k.roundedPlan({ x: -90, y: 10.4, w: 120, d: 4.4, r: 1 }, 3).map(([x, z]) => at([x, yf, z])), true);
  out.push(`<path class="bj-slot" d="${slot}"/>`, L(slot, { tone: "lo" }));
  const minor = [], major = [], nums = [];
  for (let c = 1 * 4; c <= 6 * 4; c++) {
    const d = c / 4, big = c % 4 === 0, x = M.pinX(d);
    (big ? major : minor).push(k.segment([x, yf, zt], [x, yf, zt - (big ? 3 : 1.6)], P));
  }
  for (let d = 1; d <= 6; d++) nums.push(k.faceTextSvg(k.sideMatrix([M.pinX(d) + 1, yf], 15.2, P, "left"), String(d), { size: 3, tone: "mid" }));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }), nums.join(""));
  // Tête de sabot : deux joues qui guident la carte.
  for (const y of [SHOE.y, FRONT_Y - 3.6]) {
    const cheek = { x: M.OX, y, w: 6, d: 3.6, r: 1 };
    out.push(S(box(cheek, 3, 25), { tone: "mid" }));
    out.push(screws([[M.OX + 3, y + 1.8]], 28, 0.42));
  }
  return out.join("");
}

function trackBack() {
  const out = [];
  const T = { x: 66, y: -146, w: 66, d: 46, r: 2 };
  out.push(S(k.slabOf(T, 0, 16, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(T, 4, P, 3), { tone: "faint" }) }));
  // Évents sur la face avant du socle.
  const vents = [];
  for (let i = 0; i < 8; i++) {
    const x = 72 + i * 3.4;
    vents.push(k.pathOf(k.roundedPlan({ x, y: 7, w: 1.4, d: 6, r: 0.7 }, 3).map(([u, z]) => at([u, T.y + T.d, z])), true));
  }
  out.push(L(vents.join(""), { tone: "lo" }));
  out.push(screws([[T.x + 4, T.y + T.d - 4], [T.x + T.w - 4, T.y + T.d - 4], [T.x + 4, T.y + 4]], 16, 0.45));
  for (const y of [M.CARD_Y - 15, M.CARD_Y + 13]) {
    const rail = { x: T.x, y, w: T.w + 2, d: 2, r: 0.6 };
    out.push(S(box(rail, 16, 3.8, 2, 0.3), { tone: "hi", crease: "lo" }));
  }
  return out.join("");
}

function trayBack() {
  const out = [];
  const F = { x: 134, y: -146, w: 46, d: 54, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(F, 2), 0, 3, P)}"/>`);
  out.push(S(k.slabOf(F, 0, 2, P, 4, 0.5), { tone: "lo" }));
  const back = { x: F.x, y: F.y, w: F.w, d: 3, r: 1 };
  const decks = [1, 2, 3, 4].map((d) => k.sideSeam(back, M.TRAY_Z + d * 52 * M.TRAY_U, P, 3)).join("");
  out.push(S(box(back, 2, 28), { tone: "mid", inner: L(decks, { tone: "lo" }) }));
  // Sur la paroi arrière, un trait par paquet joué : le geste réel du compteur qui lit le bac.
  const yb = F.y + 3, nums = [];
  for (let d = 1; d <= 4; d++) {
    const z = M.TRAY_Z + d * 52 * M.TRAY_U;
    nums.push(k.faceTextSvg(k.sideMatrix([F.x + F.w - 4.2, yb], z + 0.7, P, "left"), String(d), { size: 2.6, tone: "lo" }));
  }
  out.push(nums.join(""));
  return out.join("");
}

function trayFront() {
  const out = [];
  const F = { x: 134, y: -146, w: 46, d: 54, r: 3 };
  out.push(S(box({ x: F.x + F.w - 3, y: F.y, w: 3, d: F.d, r: 1 }, 2, 6), { tone: "mid" }));
  out.push(S(box({ x: F.x, y: F.y + F.d - 3, w: F.w, d: 3, r: 1 }, 2, 6), { tone: "mid" }));
  out.push(screws([[F.x + 4, F.y + F.d - 1.5], [F.x + F.w - 4, F.y + F.d - 1.5]], 8, 0.42));
  return out.join("");
}

function reader() {
  const out = [];
  const x = 94, w = 12;
  out.push(S(box({ x: x + 1, y: -145, w: w - 2, d: 4, r: 0.8 }, 16, 15), { tone: "mid" }));
  out.push(S(box({ x: x + 1, y: -97, w: w - 2, d: 4, r: 0.8 }, 0, 31), { tone: "mid", inner: L(k.sideSeam({ x: x + 1, y: -97, w: w - 2, d: 4, r: 0.8 }, 16, P, 3), { tone: "faint" }) }));
  const beam = { x, y: -146, w, d: 54, r: 1.6 };
  out.push(S(box(beam, 31, 5, 3, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(beam, 1.8), 36, P, 3), { tone: "faint" }));
  out.push(screws([[x + 3.4, -142.6], [x + w - 3.4, -142.6], [x + 3.4, -95.4], [x + w - 3.4, -95.4]], 36, 0.42));
  // Trois voyants : +1, 0, −1.
  const lamps = [[-110, "plus"], [-118, "zero"], [-126, "minus"]];
  for (const [y, name] of lamps) {
    out.push(L(k.ring(x + w / 2, y, 2.4, 36, P, 18), { tone: "mid" }));
    out.push(`<path class="bj-lamp" data-lamp="${name}" d="${k.onTop(k.circleRing(x + w / 2, y, 1.7, 16), 36, P, true)}"/>`);
  }
  return out.join("");
}

function ratchet() {
  const out = [];
  const [x, y] = M.WHEEL;
  // Bloc des deux bobines.
  const base = { x: 62, y: -88, w: 28, d: 32, r: 2 };
  out.push(S(k.slabOf(base, 0, 2.4, P, 3, 0.5), { tone: "lo" }));
  out.push(screws(k.corners(base, 3), 2.4, 0.42));
  for (const yy of [M.REAR_Y, M.FRONT_Y]) {
    const can = { x: 66, y: yy - 5, w: 20, d: 10, r: 2 };
    out.push(S(box(can, 2.4, 13, 3, 0.6), { tone: "mid", inner: L([6.5, 9.5, 12.5].map((z) => k.sideSeam(can, z, P, 3)).join(""), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(can, 1.6), 15.4, P, 3), { tone: "faint" }));
    out.push(screws([[69, yy], [83, yy]], 15.4, 0.42));
  }
  // Palier et poulie arrière.
  const pad = { x: x - 9, y: y - 9, w: 18, d: 18, r: 2 };
  out.push(S(k.slabOf(pad, 0, 2.4, P, 3, 0.4), { tone: "lo" }));
  out.push(screws(k.corners(pad, 2), 2.4, 0.4));
  return out.join("");
}

function belt() {
  const out = [];
  const [x] = M.WHEEL, yR = M.WHEEL[1], yF = 62, r = M.PULLEY_R + 0.4;
  for (const dx of [-r, r]) {
    out.push(S(box({ x: x + dx - 0.8, y: yR, w: 1.6, d: yF - yR, r: 0.2 }, 3.6, 2.8, 1, 0), { tone: "mid", crease: "none" }));
  }
  const teeth = [-r, r].map((dx) => k.lineOnTop([x + dx, yR], [x + dx, yF], 6.4, P)).join("");
  out.push(`<path class="bj-belt" data-part="belt" d="${teeth}"/>`);
  for (const yy of [yR, yF]) {
    out.push(S(k.cylinder(x, yy, r + 0.9, 3, 0.7, P, 28), { tone: "mid" }));
    out.push(S(k.cylinder(x, yy, r + 0.4, 3.7, 2.8, P, 28), { tone: "lo", crease: "none" }));
    out.push(S(k.cylinder(x, yy, r + 0.9, 6.5, 0.7, P, 28), { tone: "mid" }));
  }
  // Tendeur de la poulie avant.
  const pad = { x: x - 8, y: yF - 8, w: 16, d: 22, r: 2 };
  out.unshift(S(k.slabOf(pad, 0, 2.4, P, 3, 0.4), { tone: "lo" }), L(k.planOutline({ x: x - 1.2, y: yF + 7, w: 2.4, d: 5, r: 1.2 }, 2.4, P, 3), { tone: "lo" }), screws([[x - 5.5, yF + 11], [x + 5.5, yF + 11]], 2.4, 0.42));
  out.push(S(k.cylinder(x, yF, 1.6, 7.2, 1.4, P, 14), { tone: "mid" }));
  out.push(screws([[x, yF]], 8.6, 0.42, "hi"));
  return out.join("");
}

function wheelCap() {
  const [x, y] = M.WHEEL;
  return S(k.cylinder(x, y, 3, 11, 2, P, 18, 0.3), { tone: "mid" }) + screws([[x, y]], 13, 0.5, "hi");
}

function rails() {
  const out = [];
  // Rail gauche, axe du compte.
  const left = { x: -119, y: -60, w: 8, d: 120, r: 1 };
  out.push(S(box(left, 0, 3), { tone: "mid" }));
  out.push(screws([-52, -26, 0, 26, 52].map((y) => [left.x + 4, y]), 3, 0.4));
  for (const y of [-64, 60]) {
    out.push(S(box({ x: left.x - 1.5, y, w: 11, d: 4, r: 1 }, 0, 6), { tone: "mid" }));
    out.push(screws([[left.x + 1.2, y + 2], [left.x + 6.8, y + 2]], 6, 0.4));
  }
  // Rail avant, axe des paquets.
  const front = { x: -100, y: 80, w: 134, d: 8, r: 1 };
  out.push(S(box(front, 0, 3), { tone: "mid" }));
  out.push(screws([-92, -58, -24, 10, 28].map((x) => [x, 84]), 3, 0.4));
  for (const x of [-104, 34]) {
    out.push(S(box({ x, y: 78.5, w: 4, d: 11, r: 1 }, 0, 6), { tone: "mid" }));
    out.push(screws([[x + 2, 81], [x + 2, 87]], 6, 0.4));
  }
  // Pivot : le zéro commun aux deux axes.
  out.push(S(k.cylinder(M.OX, 0, 9, 0, 2.4, P, 36, 0.4), { tone: "lo" }));
  out.push(screws([0, 1, 2, 3, 4, 5].map((i) => [M.OX + Math.cos(i * 1.047 + 0.4) * 7, Math.sin(i * 1.047 + 0.4) * 7]), 2.4, 0.38));
  out.push(S(k.cylinder(M.OX, 0, 5, 2.4, M.ARM_Z - 2.4, P, 28), { tone: "mid", inner: L(k.sideArc(M.OX, 0, 5, 8, P, 18) + k.sideArc(M.OX, 0, 5, 15, P, 18), { tone: "faint" }) }));
  return out.join("");
}

function rcBar() {
  const out = [];
  out.push(S(box({ x: -120, y: -6.5, w: 18, d: 13, r: 1.4 }, 3, 6, 3, 0.5), { tone: "mid" }));
  out.push(screws([[-117.5, -4], [-117.5, 4], [-104.5, -4], [-104.5, 4]], 9, 0.42));
  out.push(S(box({ x: -123.5, y: -0.7, w: 4, d: 1.4, r: 0.3 }, 8.2, 0.8, 1, 0), { tone: "hi", crease: "none" }));
  const bar = { x: -102, y: -2.5, w: 137, d: 5, r: 0.8 };
  out.push(S(box(bar, 6, 3, 2, 0.4), { tone: "hi", crease: "lo" }));
  const clamp = { x: 33, y: -5, w: 12, d: 10, r: 1.2 };
  out.push(S(box(clamp, 3.2, 6.8, 2, 0.4), { tone: "mid" }));
  out.push(screws([[35.4, -3], [35.4, 3], [42.4, -3], [42.4, 3]], 10, 0.42));
  return out.join("");
}

function dBar() {
  const out = [];
  const car = { x: -8, y: 78, w: 16, d: 12, r: 1.4 };
  out.push(S(box(car, 3, 8, 3, 0.5), { tone: "mid" }));
  out.push(screws([[-5.5, 80.5], [5.5, 80.5], [-5.5, 87.5], [5.5, 87.5]], 11, 0.42));
  out.push(S(box({ x: -0.7, y: 90, w: 1.4, d: 5, r: 0.3 }, 5, 1, 1, 0), { tone: "hi", crease: "none" }));
  out.push(S(box({ x: -2.5, y: FRONT_Y, w: 5, d: 88 - FRONT_Y, r: 0.6 }, 11, 3, 2, 0.4), { tone: "hi", crease: "lo" }));
  return out.join("");
}

function pinBlock() {
  const out = [];
  const b = { x: -6.5, y: -6.5, w: 13, d: 13, r: 2 };
  out.push(S(box(b, 4.6, 12.4, 3, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideSeam(b, 10.2, P, 3), { tone: "faint" }) }));
  out.push(screws(k.corners(b, 2), 17, 0.42));
  out.push(S(k.cylinder(0, 0, 1.7, 17, M.ARM_Z - 17, P, 16), { tone: "hi", crease: "none" }));
  return out.join("");
}

const pinHead = () => S(k.cylinder(0, 0, 1.7, M.ARM_Z + M.ARM_H, 1, P, 14), { tone: "hi", crease: "none" }) + S(k.cylinder(0, 0, 3.2, M.ARM_Z + M.ARM_H + 1, 1.4, P, 20, 0.3), { tone: "hi", crease: "lo", lit: true }) + screws([[0, 0]], M.ARM_Z + M.ARM_H + 2.4, 0.42, "hi");

function sliderRail() {
  const out = [];
  const rail = { x: 105, y: -60, w: 10, d: 118, r: 1 };
  out.push(S(box(rail, 0, 3), { tone: "mid" }));
  out.push(screws([-54, -28, 28].map((y) => [108, y]), 3, 0.4));
  return out.join("");
}

function slider() {
  const out = [];
  const main = { x: 106, y: -46, w: 8, d: 96, r: 0.6 };
  out.push(S(box(main, 3, 13, 1, 0.4), { tone: "hi", crease: "lo" }));
  // Le peigne de la crémaillère, sur la face droite.
  const comb = [[M.RACK_X - 0.05, -46]];
  for (let y = -45; y < 49; y += M.PITCH) comb.push([M.RACK_X, y], [M.RACK_X + 1.5, y + 0.55], [M.RACK_X + 1.5, y + 1.1], [M.RACK_X, y + 1.7]);
  comb.push([M.RACK_X - 0.05, 50]);
  out.push(S(k.extrude(comb, 3, 5, P, { convex: false }), { tone: "mid", crease: "faint" }));
  // Index et doigt.
  out.push(S(box({ x: 100.5, y: -0.7, w: 6, d: 1.4, r: 0.3 }, 15.2, 0.8, 1, 0), { tone: "hi", crease: "none" }));
  // L'escalier de mise : une marche par niveau.
  for (let b = 7; b >= 2; b--) {
    out.push(S(box({ x: 106, y: 50 + (7 - b) * 2, w: 8, d: 2, r: 0.1 }, 3, 3.2 + (b - 1) * M.CHIP_T - 1.4, 1, 0), { tone: "hi", crease: "lo" }));
  }
  return out.join("");
}

function sliderPin() {
  const out = [];
  const x = M.OX + M.LR;
  out.push(S(k.cylinder(x, 0, 3.2, 16, 1.6, P, 18), { tone: "mid" }));
  out.push(S(k.cylinder(x, 0, 1.7, 17.6, M.ARM_Z - 17.6, P, 14), { tone: "hi", crease: "none" }));
  return out.join("");
}
const sliderHead = () => {
  const x = M.OX + M.LR;
  return S(k.cylinder(x, 0, 1.7, M.ARM_Z + M.ARM_H, 1, P, 14), { tone: "hi", crease: "none" }) + S(k.cylinder(x, 0, 3.2, M.ARM_Z + M.ARM_H + 1, 1.4, P, 20, 0.3), { tone: "hi", crease: "lo", lit: true }) + screws([[x, 0]], M.ARM_Z + M.ARM_H + 2.4, 0.42, "hi");
};

function gearBase() {
  const out = [];
  const [gx, gy] = M.GEAR;
  const base = { x: 112, y: -34, w: 76, d: 68, r: 6 };
  out.push(S(k.slabOf({ ...base, x: 117 }, 0, 2.4, P, 5, 0.5), { tone: "lo" }));
  out.push(screws(k.corners({ ...base, x: 117, w: 71 }, 4), 2.4, 0.45));
  out.push(S(k.cylinder(M.IDLER[0], 0, 3.4, 2.4, 0.8, P, 16), { tone: "mid" }));
  out.push(S(k.cylinder(gx, gy, 8, 2.4, 0.8, P, 24), { tone: "mid" }));
  return out.join("");
}

function dial() {
  const out = [];
  const [x, y] = M.GEAR, top = M.DIAL_TOP, R = M.DIAL_R;
  out.push(S(k.cylinder(x, y, 6, 8, 4, P, 24), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 6, 10, P, 18), { tone: "faint" }) }));
  out.push(`<path class="iso-halo" style="filter:blur(4px)" d="${k.cylinder(x, y, R - 1, 8.2, 0.1, P, 40).fill}"/>`);
  out.push(S(k.cylinder(x, y, R, 12, 8, P, 72, 0.7), { tone: "hi", crease: "lo", inner: L(k.knurl(x, y, R, top - 3.2, top, 90, P, 0.3), { tone: "lo" }) + L(k.sideArc(x, y, R, top - 3.2, P, 44), { tone: "faint" }) }));
  out.push(L(k.ring(x, y, R - 1.9, top, P, 72), { tone: "lo" }));
  // Échelle : 18° par point d'avantage, centrée sur le seuil.
  const perPct = M.PER_TC / M.GEAR_R / M.EDGE_B;
  const base = M.needleAngle(-M.EDGE_A / M.EDGE_B, P);
  const span = 12 * perPct;
  const t = k.radialTicks(x, y, R - 2.6, 24, 4, top, [1.3, 2.7], P, base - span / 2, span);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const arc = (a0, a1, r) => {
    const n = 40, pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([x + Math.sin(a) * r, y - Math.cos(a) * r]); }
    return k.onTop(pts, top, P);
  };
  out.push(L(arc(base, base + span / 2, R - 2.6), { tone: "hi" }), L(arc(base - span / 2, base, R - 2.6), { tone: "lo" }));
  for (const pct of [-6, -4, -2, 0, 2, 4, 6]) {
    const a = base + pct * perPct, r = R - 8;
    out.push(topText(x + Math.sin(a) * r, y - Math.cos(a) * r + 1, top, signed(pct), 2.8, pct === 0 ? "hi" : "mid"));
  }
  out.push(L(k.lineOnTop([x + Math.sin(base) * (R - 2.6), y - Math.cos(base) * (R - 2.6)], [x + Math.sin(base) * (R - 6), y - Math.cos(base) * (R - 6)], top, P), { tone: "hi" }));
  return out.join("");
}

function dialHub() {
  const [x, y] = M.GEAR;
  return L(k.ring(x, y, 2, M.DIAL_TOP, P, 18), { tone: "hi" }) + screws([[x, y]], M.DIAL_TOP, 0.55, "hi");
}

function chipTube() {
  const out = [];
  const [x, y] = M.TUBE, top = M.TUBE_TOP, r = 11;
  for (const lx of [x - 14, x + 14]) {
    const leg = { x: lx - 2, y: y - 5, w: 4, d: 10, r: 0.8 };
    out.push(S(k.slabOf({ x: lx - 4, y: y - 7, w: 8, d: 14, r: 1 }, 0, 2, P, 2, 0.3), { tone: "lo" }));
    out.push(screws([[lx - 2, y - 5], [lx + 2, y + 5]], 2, 0.4));
    out.push(S(box(leg, 2, 16), { tone: "mid" }));
  }
  const yoke = { x: x - 17, y: y - 6, w: 34, d: 12, r: 2 };
  out.push(S(box(yoke, 18, 2, 3, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, r, 20, top - 20, P, 44, 0.4), { tone: "mid", inner: L(k.sideArc(x, y, r, 24, P, 28), { tone: "faint" }) }));
  out.push(`<path class="bj-slot" d="${k.onTop(k.circleRing(x, y, 9.7, 40), top, P, true)}"/>`);
  out.push(L(k.ring(x, y, 9.7, top, P, 44), { tone: "lo" }));
  return out.join("");
}

function chips() {
  const [x, y] = M.TUBE, top = M.TUBE_TOP, t = M.CHIP_T, R = M.CHIP_R;
  const out = [];
  for (let i = 0; i < 8; i++) {
    const z = top - 7 * t + i * t;
    const stripes = [];
    for (let n = 0; n < 16; n++) {
      const a = (n / 16) * Math.PI * 2 + 0.2;
      const nx = Math.cos(a), ny = Math.sin(a);
      if (nx * k.towardViewer(P)[0] + ny * k.towardViewer(P)[1] < 0.15) continue;
      stripes.push(k.segment([x + nx * R, y + ny * R, z], [x + nx * R, y + ny * R, z + t], P));
    }
    out.push(S(k.cylinder(x, y, R, z, t, P, 40), { tone: "hi", crease: "lo", inner: L(stripes.join(""), { tone: "mid" }) }));
  }
  out.push(L(k.ring(x, y, R - 2, top + t, P, 32), { tone: "lo" }));
  return out.join("");
}

function chipClip() {
  const [x, y] = M.TUBE, top = M.TUBE_TOP, r = 9.7;
  const [vx, vy] = k.towardViewer(P);
  const a0 = Math.atan2(vy, vx);
  const near = [];
  for (let i = 0; i <= 28; i++) { const a = a0 + Math.PI / 2 - (Math.PI * i) / 28; near.push(at([x + Math.cos(a) * r, y + Math.sin(a) * r, top])); }
  const first = near[0], last = near[near.length - 1];
  const hi = Math.min(first[1], last[1]) - 60;
  return k.pathOf([...near, [Math.max(first[0], last[0]) + 3, last[1]], [Math.max(first[0], last[0]) + 3, hi], [Math.min(first[0], last[0]) - 3, hi], [Math.min(first[0], last[0]) - 3, first[1]]], true);
}

const follower = () => S(k.cylinder(M.TUBE[0], M.TUBE[1], 2.4, 3.2, 1.6, P, 16), { tone: "hi", crease: "lo" }) + S(k.cylinder(M.TUBE[0], M.TUBE[1], 1.3, 4.8, 13.2, P, 14), { tone: "mid", crease: "none" });

function tagPlate() {
  const plate = { x: 128, y: 62, w: 70, d: 54, r: 2.4 }, z = 0.9;
  const out = [S(k.slabOf(plate, 0, z, P, 3, 0.3), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(plate, 1.8), z, P, 3), { tone: "faint" }));
  out.push(screws(k.corners(plate, 3.6), z, 0.42));
  const groups = [["+1", ["2", "3", "4", "5", "6"]], ["0", ["7", "8", "9"]], ["−1", ["10", "V", "D", "R", "A"]]];
  const y0 = plate.y + 7, row = 13.4, x0 = plate.x + 6;
  groups.forEach(([tag, ranks], i) => {
    const y = y0 + row * i;
    out.push(topText(x0 + 9, y + 5.8, z, tag, 5, "hi", "end"));
    ranks.forEach((r, j) => {
      const cell = { x: x0 + 12 + j * 9.4, y: y - 0.6, w: 8, d: 10.4, r: 1 };
      out.push(L(k.planOutline(cell, z, P, 2), { tone: "lo" }));
      out.push(topText(cell.x + 4, y + 6.4, z, r, 3.8, "mid"));
    });
  });
  return out.join("");
}

function counter() {
  const out = [];
  const c = { x: 146, y: -82, w: 42, d: 22, r: 2 }, z0 = 2.4, h = 15, top = z0 + h, yf = c.y + c.d;
  // Le palpeur qui descend du bac.
  out.push(S(box({ x: 164, y: -92, w: 3, d: 10, r: 0.5 }, 5, 2, 1, 0), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(k.insetPlan(c, -2.4), 0, 2.4, P, 3, 0.4), { tone: "lo" }));
  out.push(screws(k.corners(k.insetPlan(c, -2.4), 1.8), 2.4, 0.4));
  out.push(S(box(c, z0, h, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(c, z0 + 3, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(c, 2), top, P, 3), { tone: "faint" }));
  out.push(screws(k.corners(c, 4), top, 0.42));
  // Trois tambours derrière une fenêtre de la face avant.
  const m = k.sideMatrix([0, yf], 0, P, "left");
  const win = (x0, x1, z0w, z1w, r) => k.pathOf(k.roundedPlan({ x: x0, y: z0w, w: x1 - x0, d: z1w - z0w, r }, 3).map(([u, v]) => [u, -v]), true);
  const X0 = 155, W = 7.4, Z0 = 5.4, Z1 = 14.2;
  const drums = [`<g transform="${m}"><path class="bj-slot" d="${win(X0 - 1, X0 + W * 3 + 1, Z0, Z1, 1)}"/>`];
  for (let i = 0; i < 3; i++) drums.push(`<path class="bj-drum" d="${win(X0 + i * W + 0.3, X0 + (i + 1) * W - 0.3, Z0 + 0.5, Z1 - 0.5, 0.5)}"/><text class="bj-digit" data-digit="${i}" x="${X0 + i * W + W / 2}" y="${-(Z0 + 2.2)}" font-size="6.4" text-anchor="middle">0</text>`);
  drums.push(L(win(X0 - 1, X0 + W * 3 + 1, Z0, Z1, 1), { tone: "lo" }), `</g>`);
  out.push(drums.join(""));
  // Bouton de remise à zéro.
  const [kx, ky] = [c.x + c.w - 7, c.y + 11];
  out.push(S(k.cylinder(kx, ky, 2, top, 1.6, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(kx, ky, 3.8, top + 1.6, 3.6, P, 24, 0.3), { tone: "mid", inner: L(k.knurl(kx, ky, 3.8, top + 1.8, top + 5, 18, P, 0.2), { tone: "lo" }) }));
  return out.join("");
}

function wires() {
  const route = (from, to, via) => k.wireSvg(at(from), at(to), { via: via.map(at), tone: "mid", size: 1 });
  const a = route([98, -93, 7], [86, M.REAR_Y, 8], [[98, -93, 0.4], [98, M.REAR_Y, 0.4], [89, M.REAR_Y, 0.4]]);
  const b = route([102, -93, 7], [86, M.FRONT_Y, 8], [[102, -93, 0.4], [102, M.FRONT_Y, 0.4], [89, M.FRONT_Y, 0.4]]);
  return `<g data-part="wire-rear">${a}</g><g data-part="wire-front">${b}</g>`;
}

function cardMarkup(name) {
  const w = M.CARD_W, h = M.CARD_H, r = 2.2;
  const rect = `x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${r}"`;
  const hatch = [];
  for (let i = -5; i <= 5; i++) hatch.push(`M${i * 5 - 10} ${-h / 2 + 3}L${i * 5 + 10} ${h / 2 - 3}M${i * 5 + 10} ${-h / 2 + 3}L${i * 5 - 10} ${h / 2 - 3}`);
  const id = `bj-back-${name}`;
  return `<g data-card="${name}" style="display:none">
<g data-side="back"><rect class="bj-card" ${rect}/><clipPath id="${id}"><rect x="${-w / 2 + 3}" y="${-h / 2 + 3}" width="${w - 6}" height="${h - 6}" rx="1"/></clipPath><g clip-path="url(#${id})"><path class="bj-hatch" d="${hatch.join("")}"/></g><rect class="bj-card-in" x="${-w / 2 + 3}" y="${-h / 2 + 3}" width="${w - 6}" height="${h - 6}" rx="1"/></g>
<g data-side="face"><rect class="bj-card" ${rect}/>
<text class="bj-rank" x="${-w / 2 + 2.6}" y="${-h / 2 + 8.4}" font-size="8" data-rank></text><text class="bj-suit" x="${-w / 2 + 2.8}" y="${-h / 2 + 15}" font-size="6.2" data-suit></text>
<text class="bj-suit" x="0" y="5.6" font-size="17" text-anchor="middle" data-suit></text>
<g transform="rotate(180)"><text class="bj-rank" x="${-w / 2 + 2.6}" y="${-h / 2 + 8.4}" font-size="8" data-rank></text><text class="bj-suit" x="${-w / 2 + 2.8}" y="${-h / 2 + 15}" font-size="6.2" data-suit></text></g>
</g></g>`;
}

function shoeCard() {
  // Le dos de la prochaine carte, debout dans la bouche du sabot.
  const m = M.cardMatrix([M.OX, M.CARD_Y, M.STACK_Z0 + M.CARD_W / 2], [0, 0, 1], [0, 1, 0], P);
  const w = M.CARD_W, h = M.CARD_H;
  const hatch = [];
  for (let i = -5; i <= 5; i++) hatch.push(`M${i * 5 - 10} ${-h / 2 + 3}L${i * 5 + 10} ${h / 2 - 3}M${i * 5 + 10} ${-h / 2 + 3}L${i * 5 - 10} ${h / 2 - 3}`);
  return `<g data-part="next" transform="${m.m}"><rect class="bj-card" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="1.4"/><clipPath id="bj-next"><rect x="${-w / 2 + 3}" y="${-h / 2 + 3}" width="${w - 6}" height="${h - 6}"/></clipPath><g clip-path="url(#bj-next)"><path class="bj-hatch" d="${hatch.join("")}"/></g><rect class="bj-card-in" x="${-w / 2 + 3}" y="${-h / 2 + 3}" width="${w - 6}" height="${h - 6}" rx="1"/></g>`;
}

const part = (name, html, transform = "") => `<g data-part="${name}"${transform ? ` transform="${transform}"` : ""}>${html}</g>`;
const px0 = M.pinX(D0), by0 = M.barY(START.rc), sy0 = M.sliderY(TC0);
const lift0 = (M.betOf(TC0) - 1) * M.CHIP_T;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "Un compteur de cartes mécanique sur une platine. Un sabot de six paquets donne une carte à la fois ; un lecteur fait avancer ou reculer une roue à rochet selon la valeur Hi-Lo de la carte, ce qui déplace une barre : c'est le compte courant. Le poussoir du sabot déplace une seconde barre : ce sont les paquets restants. Un bras pivotant passe par leur croisement, sa pente est le true count ; il pousse une crémaillère qui tourne un cadran gradué en avantage et qui sort des jetons pour la mise.",
  body: [
    plate(), bed(), rulers(), tagPlate(),
    shoeBack(),
    part("stack", M.stackHtml(D0, true, P)),
    shoeCard(),
    part("pusher", pusher(), k.translateAlong(P, [px0, 0, 0])),
    trackBack(), trayBack(),
    part("tray", M.trayHtml(START.dealt, P)),
    cardMarkup("a"), cardMarkup("b"),
    trayFront(), reader(), shoeFront(), counter(),
    ratchet(),
    part("rear", M.plungerHtml(M.REAR_Y, 0, P)), part("front", M.plungerHtml(M.FRONT_Y, 0, P)),
    wires(),
    rails(), belt(),
    part("wheel", M.wheelHtml(START.rc, P)), wheelCap(),
    part("rcbar", rcBar(), k.translateAlong(P, [0, by0, 0])),
    part("dbar", dBar(), k.translateAlong(P, [px0, 0, 0])),
    part("pin", pinBlock(), k.translateAlong(P, [px0, by0, 0])),
    sliderRail(), gearBase(),
    part("idler", M.idlerHtml(TC0, P)), part("gear", M.gearHtml(TC0, P)),
    part("slider", slider(), k.translateAlong(P, [0, sy0, 0])),
    part("sliderpin", sliderPin(), k.translateAlong(P, [0, sy0, 0])),
    part("follower", follower(), k.translateAlong(P, [0, 0, lift0])),
    part("arm", M.armHtml(START.rc, D0, P)),
    part("pinhead", pinHead(), k.translateAlong(P, [px0, by0, 0])),
    part("sliderhead", sliderHead(), k.translateAlong(P, [0, sy0, 0])),
    S(k.cylinder(M.OX, 0, 7.6, M.ARM_Z + M.ARM_H, 1.8, P, 28, 0.4), { tone: "hi", crease: "lo", lit: true }),
    L(k.ring(M.OX, 0, 3.4, M.ARM_Z + M.ARM_H + 1.8, P, 20), { tone: "hi" }), screws([[M.OX, 0]], M.ARM_Z + M.ARM_H + 1.8, 0.55, "hi"),
    chipTube(),
    `<clipPath id="bj-chips"><path d="${chipClip()}"/></clipPath><g clip-path="url(#bj-chips)">${part("chips", chips(), k.translateAlong(P, [0, 0, lift0]))}</g>`,
    dial(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="" d="${M.needlePath(TC0, P)}" style="stroke-width:1.2"/>`,
    dialHub(),
  ],
});

const shared = readFileSync(join(HERE, "shared.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const live = readFileSync(join(HERE, "live.js"), "utf8").replace("__P__", JSON.stringify(P)).replace("__START__", JSON.stringify(START));

const css = `<style>
.bj-slot{fill:var(--anatomy-shade-0)}
.bj-card{fill:var(--anatomy-top);stroke:var(--anatomy-hi);stroke-width:.6px;vector-effect:non-scaling-stroke}
.bj-card-in{fill:none;stroke:var(--anatomy-lo);stroke-width:.5px;vector-effect:non-scaling-stroke}
.bj-hatch{fill:none;stroke:var(--anatomy-lo);stroke-width:.4px;vector-effect:non-scaling-stroke}
.bj-rank,.bj-suit{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:600}
[data-card][data-red] .bj-rank,[data-card][data-red] .bj-suit{fill:var(--anatomy-red)}
.bj-rays .iso-line{opacity:.8}
.bj-belt{fill:none;stroke:var(--anatomy-lo);stroke-width:1.2px;stroke-dasharray:.7 1.8}
.bj-lamp{fill:var(--anatomy-shade-0);transition:fill .35s var(--anatomy-ease)}
.bj-lamp[data-on]{fill:var(--anatomy-lit);transition:none}
[data-part^="wire"][data-on] .iso-line{stroke:var(--anatomy-lit)}
.bj-drum{fill:var(--anatomy-top)}
.bj-digit{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:600}
.bj-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.iso-stage{touch-action:pan-y;cursor:pointer;user-select:none;-webkit-user-select:none}
.iso-stage:focus{outline:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const fr = (v, n = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(n).replace(".", ",");
const body = css + k.plateHtml({
  fig: "Fig 1",
  title: "Compteur Hi-Lo",
  hint: "Clic : une carte · R : rebattre",
  readout: `RC ${fr(START.rc, 0)} · ${D0.toFixed(1).replace(".", ",")} p · TC ${fr(TC0)} · ${fr(M.edgeOf(TC0), 2)} % · mise ${M.betOf(TC0)}`,
  keys: [
    { mark: "lit", label: "Le bras et l'aiguille : la pente RC ÷ paquets, lue en avantage" },
    { mark: "raised", label: "Deux barres : le compte courant (rochet) et les paquets restants (poussoir)" },
    { mark: "edge", label: "Les rayons du plateau : une ligne par true count" },
  ],
  caption: "Hi-Lo : 2 à 6 valent +1, 7 à 9 valent 0, 10 à as valent −1. Le lecteur tourne le rochet d'une dent par carte comptée, le poussoir avance vers la bouche à mesure que le sabot se vide, et le bras passe par le croisement des deux barres : c'est une division par triangles semblables. À compte égal, le bras penche plus quand il reste peu de cartes. Le cadran vient d'une simulation de 70 millions de coups (6 paquets, S17, DAS, 3:2, coupe à 234 cartes, stratégie de base) : −0,38 % + 0,49 % par point, seuil à TC +0,8 ; à mise fixe le joueur perd 0,41 %. Seuls 36 % des coups sont favorables, et l'escalier 1 à 8 ne rapporte qu'environ 0,42 % de la somme misée, sans compter la variance ni les contre-mesures du casino. Maintenez le clic pour une rafale. Les sabots qui dépasseraient les butées (RC ±24, TC ±12, environ 2 %) sont rebattus.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Compteur de cartes. Espace ou clic distribue une carte, R rebat le sabot.">${svg}<span class="bj-sr" role="status" aria-live="polite" data-status></span></div>`,
});

const test = process.argv.includes("--test");
const name = test ? "shots/test.html" : theme === "light" ? "blackjack-light.html" : "blackjack.html";
const hook = test ? "window.__pose = (a, d) => { touring = false; rc = a; rcS = a; dS = d; dealt = Math.round(CARDS - d * 52); trayN = dealt; lift = (betOf(a / d) - 1) * CHIP_T; parts.stack.innerHTML = stackHtml(d, true, P); draw(); write(); };" : "";
const page = k.pageHtml({ title: "Compteur Hi-Lo", theme, body, script: kitScript() + shared + live + hook, width: 720 }).replace('<html lang="en">', '<html lang="fr">');
writeFileSync(join(HERE, name), page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
