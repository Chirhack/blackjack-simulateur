import { iso, cylinder, solidSvg, lineSvg, ring, slabOf, pathOf, towardViewer, segment } from "file:///C:/Users/chichi/.claude/skills/anatomy/kit/iso-kit.mjs";

// Le plan de la table. x vers la droite, y vers le joueur, z vers le haut ; le feutre est à FZ sous le bourrelet.
export const FZ = -3, CY = -130, R_OUT = 310, R_FELT = 284, R_SPOT = 232;
export const CARD_W = 40, CARD_H = 56, SPOT_ANGLES = [0, 22, -22, 44, -44];
export const SHOE = { x: 186, y: -112, w: 92, d: 56 }, SHOE_MOUTH = 196, SHOE_LEN = 66, SHOE_Y = -84;
export const DISCARD = { x: -272, y: -112, w: 56, d: 66 }, DISCARD_U = 0.06;
export const TRAY_AT = [0, -116], FRONT_AT = [0, 196];
export const CHIP_R = 13, CHIP_T = 2.4;
export const DEALER_AT = [-24, -58];

export const spotOf = (i) => { const a = (SPOT_ANGLES[i] * Math.PI) / 180; return [R_SPOT * Math.sin(a), CY + R_SPOT * Math.cos(a)]; };
export const handAt = (i) => { const a = (SPOT_ANGLES[i] * Math.PI) / 180, r = R_SPOT - 62; return [r * Math.sin(a), CY + r * Math.cos(a)]; };

export function cardMatrix(c, right, down, P) {
  const o = iso(c, P);
  const a = iso([c[0] + right[0], c[1] + right[1], c[2] + right[2]], P);
  const b = iso([c[0] + down[0], c[1] + down[1], c[2] + down[2]], P);
  const m = [a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]];
  return { m: `matrix(${m.map((v) => v.toFixed(3)).join(" ")})`, face: m[0] * m[3] - m[1] * m[2] > 0 };
}

// Une pile de jetons : 100, 25, 5 puis 1 de bas en haut, un ton par valeur, comme sur une table.
const TONES = { 100: "hi", 25: "hi", 5: "hi", 1: "mid" };
export function chipList(amount) {
  const out = [];
  let left = Math.floor(amount + 1e-9);
  for (const v of [100, 25, 5, 1]) while (left >= v && out.length < 14) { out.push(v); left -= v; }
  if (amount % 1 > 0.01 && out.length < 15) out.push(1);
  return out;
}
export function chipHtml(x, y, z, value, P, R = CHIP_R) {
  const t = CHIP_T, [vx, vy] = towardViewer(P), marks = [];
  const count = { 1: 6, 5: 8, 25: 12, 100: 16 }[value];
  for (let n = 0; n < count; n++) {
    const a = (n / count) * Math.PI * 2 + 0.26, nx = Math.cos(a), ny = Math.sin(a);
    if (nx * vx + ny * vy < 0.12) continue;
    marks.push(segment([x + nx * R, y + ny * R, z], [x + nx * R, y + ny * R, z + t], P));
  }
  const lit = value >= 25;
  return solidSvg(cylinder(x, y, R, z, t, P, 36), { tone: TONES[value], crease: "lo", lit, inner: lineSvg(marks.join(""), { tone: "mid" }) });
}
export function stackHtml(x, y, amount, P) {
  const list = chipList(amount);
  if (!list.length) return "";
  let out = "";
  list.forEach((v, i) => (out += chipHtml(x, y, FZ + i * CHIP_T, v, P)));
  const top = FZ + list.length * CHIP_T;
  return out + lineSvg(ring(x, y, CHIP_R - 3, top, P, 28), { tone: "mid" });
}

// Le sabot : la pile avance vers la bouche, le trait épais est la carte de coupe.
export function shoeStackHtml(pos, cut, P) {
  const left = 312 - pos, len = (left / 312) * SHOE_LEN;
  if (len < 0.4) return "";
  const y0 = SHOE_Y - 23, y1 = SHOE_Y + 23, z0 = FZ + 3, z1 = 27, x0 = SHOE_MOUTH, x1 = x0 + len;
  let lines = "";
  for (let x = x0 + 1.7; x < x1 - 0.4; x += 1.7) lines += pathOf([iso([x, y0, z1], P), iso([x, y1, z1], P), iso([x, y1, 13], P)]);
  let out = solidSvg(slabOf({ x: x0, y: y0, w: len, d: 46, r: 0.3 }, z0, z1 - z0, P, 1), { tone: "mid", crease: "lo", inner: lineSvg(lines, { tone: "lo" }) });
  if (cut) {
    const at = x0 + ((234 - pos) / 312) * SHOE_LEN;
    if (pos < 234 && at > x0) out += solidSvg(slabOf({ x: at, y: y0 - 0.4, w: 0.9, d: 46.8, r: 0.1 }, z1 - 2, 5, P, 1), { tone: "hi", crease: "lo" });
  }
  return out;
}
export function pusherX(pos) { return SHOE_MOUTH + ((312 - pos) / 312) * SHOE_LEN; }

export function discardHtml(n, P) {
  if (n < 1) return "";
  const p = { x: DISCARD.x + 6, y: DISCARD.y + 6, w: CARD_W + 4, d: CARD_H - 2, r: 1 };
  return solidSvg(slabOf(p, FZ + 2, n * DISCARD_U, P, 2), { tone: "mid", crease: "lo" });
}
export const discardTop = (n) => FZ + 2 + n * DISCARD_U + 0.2;
