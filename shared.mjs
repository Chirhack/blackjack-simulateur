import { iso, extrude, roundedPlan, slabOf, onTop, lineSvg, solidSvg, dotsSvg, coil, cylinder, knurl, sideArc, segment, ring, lineOnTop, pathOf } from "file:///C:/Users/chichi/.claude/skills/anatomy/kit/iso-kit.mjs";

// ---- Le modèle : mesuré par sim.mjs (70 M de coups, 6 paquets, S17, DAS, 3:2, coupe à 234) ----
export const DECKS = 6, CARDS = 312, CUT = 234;
export const EDGE_A = -0.38, EDGE_B = 0.49;
export const RC_STOP = 24, TC_STOP = 12;
export const tagOf = (rank) => (rank >= 2 && rank <= 6 ? 1 : rank >= 10 || rank === 1 ? -1 : 0);
export const edgeOf = (tc) => EDGE_A + EDGE_B * tc;
export const betOf = (tc) => Math.max(1, Math.min(8, Math.round(2 * tc)));

// ---- Géométrie : le plan de la machine. x vers l'avant droite, y vers l'avant gauche, z vers le haut ----
export const OX = 60, KX = 24, KY = 2, LR = 48;
export const PER_TC = (LR * KY) / KX;              // 4 unités de course du coulisseau par point de TC
export const CARD_U = KX / 52;
export const CARD_W = 30, CARD_H = 42, CARD_Y = -118;
export const ARM_Z = 21, ARM_H = 3;
export const WHEEL = [42, -72], WHEEL_TEETH = 16, WHEEL_R = 11;
export const PULLEY_R = (WHEEL_TEETH * KY) / (2 * Math.PI);
export const IDLER = [122, 0], IDLER_R = 8, IDLER_N = 20;
export const GEAR = [156, 0], GEAR_R = 26, GEAR_N = 65;
export const RACK_X = 114, PITCH = (2 * Math.PI * IDLER_R) / IDLER_N;
export const DIAL_R = 23, DIAL_TOP = 20;
export const CHIP_T = 1.6, CHIP_R = 9, TUBE = [110, 65], TUBE_TOP = 31;
export const TRAY = { x: 138, y: -139, w: CARD_W, d: CARD_H, r: 1 }, TRAY_Z = 2, TRAY_U = 0.07;
export const TRACK_Z = 20;

export const pinX = (d) => OX - d * KX;
export const barY = (rc) => -rc * KY;
export const sliderY = (tc) => tc * PER_TC;
const polar = (cx, cy, r, a) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
const DEG = Math.PI / 180;
export const needleAngle = (tc, P) => (P.azimuth - 90) * DEG + ((tc + EDGE_A / EDGE_B) * PER_TC) / GEAR_R;

export function teethRing(cx, cy, rp, n, angle, add = 0.9, ded = 1) {
  const out = [], step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a = angle + i * step;
    out.push(polar(cx, cy, rp - ded, a - step * 0.3), polar(cx, cy, rp + add, a - step * 0.14), polar(cx, cy, rp + add, a + step * 0.14), polar(cx, cy, rp - ded, a + step * 0.3));
  }
  return out;
}

export function wheelHtml(rc, P) {
  const [x, y] = WHEEL, a = (rc * Math.PI * 2) / WHEEL_TEETH;
  const body = extrude(teethRing(x, y, WHEEL_R - 1, WHEEL_TEETH, a, 1, 1.3), 8, 3, P, { convex: false });
  const spokes = [0, 1, 2, 3].map((i) => {
    const t = a + i * Math.PI / 2 + Math.PI / 16;
    return lineOnTop(polar(x, y, 3, t), polar(x, y, 7.4, t), 11.6, P);
  }).join("");
  return solidSvg(body, { tone: "mid", crease: "none" }) + solidSvg(cylinder(x, y, 8.4, 8.4, 3.2, P, 36, 0.3), { tone: "hi", crease: "lo", inner: lineSvg(ring(x, y, 7.4, 11.6, P, 36) + spokes, { tone: "lo" }) });
}

export function idlerHtml(tc, P) {
  const [x, y] = IDLER, a = (sliderY(tc) / IDLER_R) + (Math.PI * 2) / IDLER_N / 2;
  const mark = lineOnTop(polar(x, y, 2.6, a), polar(x, y, 6, a), 8, P);
  return solidSvg(extrude(teethRing(x, y, IDLER_R, IDLER_N, a, 0.8, 0.9), 3, 5, P, { convex: false }), { tone: "mid", inner: lineSvg(ring(x, y, 6, 8, P, 32) + mark, { tone: "lo" }) });
}

export function gearHtml(tc, P) {
  const [x, y] = GEAR, a = sliderY(tc) / GEAR_R;
  return solidSvg(extrude(teethRing(x, y, GEAR_R, GEAR_N, a, 0.8, 0.9), 3, 5, P, { convex: false }), { tone: "lo", crease: "none", inner: lineSvg(ring(x, y, 24, 8, P, 72), { tone: "faint" }) });
}

export function needlePath(tc, P) {
  const [x, y] = GEAR, a = needleAngle(tc, P);
  return lineOnTop(polar(x, y, -4.5, a), polar(x, y, DIAL_R - 5.5, a), DIAL_TOP + 0.2, P);
}

// Le bras : une seule barre rigide, deux lumières. Sa pente est RC / paquets.
export const ARM_L = 163, ARM_RIGHT = 72;
export function armAngle(rc, d) { return Math.atan2(rc * KY, d * KX); }
export function armHtml(rc, d, P) {
  const al = armAngle(rc, d), c = Math.cos(al), s = Math.sin(al);
  const put = ([u, v]) => [OX + u * c - v * s, u * s + v * c];
  const plan = (p, steps) => roundedPlan(p, steps).map(put);
  const top = ARM_Z + ARM_H;
  const bar = extrude(plan({ x: -ARM_L, y: -5, w: ARM_L + ARM_RIGHT, d: 10, r: 5 }, 6), ARM_Z, ARM_H, P, { bevel: 0.5 });
  const slots = onTop(plan({ x: -157.5, y: -1.9, w: 126, d: 3.8, r: 1.9 }, 5), top, P, true) + onTop(plan({ x: 43.5, y: -1.9, w: 25, d: 3.8, r: 1.9 }, 5), top, P, true);
  const rivets = [-27, -25, 25, 27].map((u) => iso([...put([u, u < -26 || u > 26 ? 3 : -3]), top], P));
  return `${solidSvg(bar, { tone: "hi", lit: true })}<path class="bj-slot" d="${slots}"/>${lineSvg(slots, { tone: "hi" })}${dotsSvg(rivets, { size: 0.45, tone: "hi" })}`;
}

// Le sabot : chaque trait du dessus est un paquet de 4 cartes ; le poussoir ferme la pile.
export const STACK_Z0 = 3, STACK_Z1 = 33;
export function stackHtml(d, cut, P) {
  const px = pinX(d), y0 = CARD_Y - CARD_H / 2, y1 = CARD_Y + CARD_H / 2;
  if (OX - px < 0.3) return "";
  const body = slabOf({ x: px, y: y0, w: OX - px, d: CARD_H, r: 0.3 }, STACK_Z0, STACK_Z1 - STACK_Z0, P, 1);
  let lines = "";
  for (let x = OX - 1.85; x > px + 0.4; x -= CARD_U * 4) lines += pathOf([iso([x, y0, STACK_Z1], P), iso([x, y1, STACK_Z1], P), iso([x, y1, 15], P)]);
  let out = solidSvg(body, { tone: "mid", crease: "lo", inner: lineSvg(lines, { tone: "lo" }) });
  if (cut) {
    const cx = px + 1.5 * KX;
    if (cx < OX) out += solidSvg(slabOf({ x: cx - 0.5, y: y0 - 0.4, w: 1, d: CARD_H + 0.8, r: 0.1 }, STACK_Z1 - 2, 6, P, 1), { tone: "mid", crease: "lo" });
  }
  return out;
}

// Les deux plongeurs : le ressort ramène le cliquet après chaque carte.
export const REAR_Y = WHEEL[1] - 9, FRONT_Y = WHEEL[1] + 9, ROD_Z = 9.5;
export function plungerHtml(y, s, P) {
  const tip = 53.5 - 4.6 * s, collar = 58.5 - 4.6 * s, base = 66;
  const spring = coil(collar + 1, base, [y, ROD_Z], 2.3, 4.5, "x", P);
  const rod = slabOf({ x: tip, y: y - 0.9, w: base + 2 - tip, d: 1.8, r: 0.7 }, ROD_Z - 0.9, 1.8, P, 2);
  const head = slabOf({ x: tip - 1.2, y: y - 1.5, w: 2.2, d: 3, r: 0.6 }, ROD_Z - 1.4, 2.8, P, 2);
  const ring3 = slabOf({ x: collar, y: y - 2.5, w: 1.2, d: 5, r: 0.5 }, ROD_Z - 2.5, 5, P, 2);
  return `${lineSvg(spring.back, { tone: "lo" })}${solidSvg(rod, { tone: "hi", crease: "none" })}${solidSvg(head, { tone: "hi", crease: "none" })}${solidSvg(ring3, { tone: "mid", crease: "none" })}${lineSvg(spring.front, { tone: "mid" })}`;
}

export function trayHtml(n, P) {
  if (n < 1) return "";
  const h = n * TRAY_U;
  let seams = "";
  for (let c = 52; c < n; c += 52) {
    const z = TRAY_Z + c * TRAY_U;
    seams += pathOf([iso([TRAY.x, TRAY.y + TRAY.d, z], P), iso([TRAY.x + TRAY.w, TRAY.y + TRAY.d, z], P), iso([TRAY.x + TRAY.w, TRAY.y, z], P)]);
  }
  return solidSvg(slabOf(TRAY, TRAY_Z, h, P, 2), { tone: "mid", crease: "lo", inner: lineSvg(seams, { tone: "lo" }) });
}

// Une carte est un plan : en projection parallèle, c'est une simple matrice affine.
export function cardMatrix(c, right, down, P) {
  const o = iso(c, P);
  const a = iso([c[0] + right[0], c[1] + right[1], c[2] + right[2]], P);
  const b = iso([c[0] + down[0], c[1] + down[1], c[2] + down[2]], P);
  const m = [a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]];
  return { m: `matrix(${m.map((v) => v.toFixed(3)).join(" ")})`, face: m[0] * m[3] - m[1] * m[2] > 0 };
}

// La trajectoire d'une carte, t de 0 à 1 : basculer, glisser au lecteur, glisser au bac, tomber.
export const T_TIP = 0.3, T_READ = 0.56, T_OUT = 0.86;
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
export function cardAt(t, trayTop) {
  const flatZ = TRACK_Z + 0.2;
  if (t < T_TIP) {
    const u = ease(t / T_TIP), phi = u * Math.PI / 2;
    const R = [Math.sin(phi), 0, Math.cos(phi)];
    const px = lerp(OX, 64, u), pz = lerp(STACK_Z0, flatZ, Math.min(1, u * 1.15));
    return { c: [px + R[0] * CARD_W / 2, CARD_Y, pz + R[2] * CARD_W / 2], R };
  }
  const R = [1, 0, 0];
  if (t < T_READ) return { c: [lerp(79, 100, ease((t - T_TIP) / (T_READ - T_TIP))), CARD_Y, flatZ], R };
  if (t < T_OUT) return { c: [lerp(100, TRAY.x + CARD_W / 2, ease((t - T_READ) / (T_OUT - T_READ))), CARD_Y, flatZ], R };
  const u = (t - T_OUT) / (1 - T_OUT);
  return { c: [TRAY.x + CARD_W / 2, CARD_Y, lerp(flatZ, trayTop, u * u)], R };
}
