// Skyharbor Run — world rendering.
// A pinhole camera sits behind and above the plane; the ground is a grid of
// world-aligned cells projected one quad at a time, far to near. This file
// draws the world only — HUD, title and end screens live in hud.js.

import { COLORS, WORLD } from './config.js';
import { hash2, noise2 } from './random.js';

const DEG = Math.PI / 180;

// --- tiny colour helpers -----------------------------------------------------
const rgbCache = new Map();
function rgb(hex) {
  let c = rgbCache.get(hex);
  if (!c) {
    c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    rgbCache.set(hex, c);
  }
  return c;
}
function mixHex(a, b, t) {
  const ca = rgb(a);
  const cb = rgb(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function shade(hex, f) {
  const c = rgb(hex);
  return `rgb(${Math.min(255, c[0] * f) | 0},${Math.min(255, c[1] * f) | 0},${Math.min(255, c[2] * f) | 0})`;
}

// --- camera --------------------------------------------------------------------
function makeCamera(state) {
  const headingRad = state.heading * DEG;
  const fx = Math.sin(headingRad);
  const fy = Math.cos(headingRad);
  // Chase position: 26 m behind, 9 m above, looking at a point ahead.
  const cx = state.x - fx * 26;
  const cy = state.y - fy * 26;
  const cz = state.z + 9;
  const lookX = state.x + fx * 120;
  const lookY = state.y + fy * 120;
  const lookZ = state.z + Math.sin(state.pitch * DEG) * 60 - 2;

  let f = [lookX - cx, lookY - cy, lookZ - cz];
  const fl = Math.hypot(f[0], f[1], f[2]);
  f = [f[0] / fl, f[1] / fl, f[2] / fl];
  // right = f x world-up-ish, up = right x f
  let r = [f[1], -f[0], 0];
  const rl = Math.hypot(r[0], r[1]) || 1;
  r = [r[0] / rl, r[1] / rl, 0];
  const u = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];
  return { x: cx, y: cy, z: cz, f, r, u, roll: state.roll * DEG * 0.78 };
}

function project(cam, w, h, focal, x, y, z) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const cz = dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2];
  if (cz < 4) return null;
  const cx = dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2];
  const cy = dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2];
  let sx = w / 2 + (cx * focal) / cz;
  let sy = h / 2 - (cy * focal) / cz;
  // Bank the whole world around screen centre, opposite the plane's roll.
  if (cam.roll !== 0) {
    const cos = Math.cos(cam.roll);
    const sin = Math.sin(cam.roll);
    const ox = sx - w / 2;
    const oy = sy - h / 2;
    sx = w / 2 + ox * cos - oy * sin;
    sy = h / 2 + ox * sin + oy * cos;
  }
  return { x: sx, y: sy, depth: cz };
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

// --- sky, sun, far ridges, clouds ----------------------------------------------
function drawSky(ctx, w, h, state) {
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.72);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(0.55, COLORS.skyMid);
  grad.addColorStop(1, COLORS.skyHorizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Sun: fixed in the north-west; slides across the sky as heading changes.
  const sunAngle = ((-140 - state.heading + 540) % 360) - 180;
  const sunX = w / 2 + (sunAngle / 70) * w * 0.5;
  const sunY = h * 0.16;
  if (sunX > -80 && sunX < w + 80) {
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(0.25, 'rgba(255,243,196,0.45)');
    glow.addColorStop(1, 'rgba(255,243,196,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
    ctx.fillStyle = COLORS.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 17, 0, Math.PI * 2);
    ctx.fill();
  }

  // Two parallax ridge silhouettes hugging the horizon.
  const horizonY = h * 0.52 + state.pitch * 2.2;
  drawRidge(ctx, w, horizonY, state.heading * 0.7, 0.05, h * 0.10, 'rgba(70,105,140,0.55)', 7);
  drawRidge(ctx, w, horizonY + h * 0.03, state.heading * 1.15 + 40, 0.09, h * 0.07, 'rgba(52,84,116,0.75)', 11);
}

function drawRidge(ctx, w, baseY, offsetDeg, stepDeg, amp, colour, seed) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(-4, baseY + amp);
  const steps = Math.ceil(w / 46) + 2;
  for (let i = 0; i <= steps; i++) {
    const worldAngle = offsetDeg + i * stepDeg * 10;
    const n = noise2(worldAngle * 0.11, seed);
    const peak = baseY - Math.abs(n) * amp - amp * 0.25;
    ctx.lineTo(i * 46 - 4, peak);
  }
  ctx.lineTo(w + 4, baseY + amp);
  ctx.closePath();
  ctx.fill();
}

function drawClouds(ctx, cam, w, h, focal, world, time) {
  ctx.save();
  for (const cloud of world.clouds) {
    const drift = Math.sin(time * 0.01 + cloud.x) * 12;
    const p = project(cam, w, h, focal, cloud.x + drift, cloud.y, cloud.z);
    if (!p) continue;
    const size = (cloud.s * focal) / p.depth;
    if (size < 8 || size > w) continue;
    ctx.fillStyle = COLORS.cloud;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(p.x + i * size * 0.32, p.y + Math.abs(i) * size * 0.05, size * 0.34, size * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// --- terrain ---------------------------------------------------------------------
// Base colour for the ground plane under the projected grid: the same
// palette cellColour uses, reduced to its coarsest branch — water where the
// terrain at the point is at/below sea level, the lowland field green else.
function groundBaseColour(world, x, y) {
  return world.heightAt(x, y) <= WORLD.seaLevel ? COLORS.water : COLORS.meadow;
}

// Fill everything from just above the horizon line to the bottom of the
// frame with the ground base colour. The projected cell grid only covers a
// disc around the plane; at low camera angles the corners below the horizon
// would otherwise show bare sky gradient. Terrain, runway and scenery draw
// over this base, so no void can show.
function drawGroundBase(ctx, w, h, state, world, cam) {
  const top = h * 0.46 + state.pitch * 2.2;
  ctx.fillStyle = groundBaseColour(world, cam.x, cam.y);
  ctx.fillRect(0, top, w, h - top);
}

function cellColour(world, cx, cy, avgH, fogT) {
  let base;
  const terrain = world.heightAt(cx, cy);
  if (terrain < 0.2) {
    // Open water: one surface with a gentle noise tint. A hard two-tone
    // checker here reads as a chessboard from altitude, so blend the two
    // water colours continuously instead of alternating them per cell.
    const t = Math.max(0, Math.min(1, 0.5 + noise2(cx * 0.0016, cy * 0.0016) * 0.5));
    const deep = rgb(COLORS.waterDeep);
    const shallow = rgb(COLORS.water);
    const fog = rgb(COLORS.skyHorizon);
    const f = fogT * 0.8;
    const ch = (i) => Math.round((deep[i] + (shallow[i] - deep[i]) * t) * (1 - f) + fog[i] * f);
    return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
  }
  const riverDist = Math.abs(cx - world.riverCentreX(cy));
  if (riverDist < 46 && terrain < 7) base = COLORS.water;
  else if (avgH < 4.5) base = COLORS.sand;
  else if (avgH > 430) base = COLORS.snow;
  else if (avgH > 215) base = COLORS.rock;
  else {
    const patch = hash2(Math.round(cx / 180), Math.round(cy / 180));
    const wooded = noise2(cx * 0.0011, cy * 0.0011) > 0.32;
    base = wooded ? COLORS.forest : patch > 0.62 ? COLORS.fieldA : patch > 0.3 ? COLORS.fieldB : COLORS.meadow;
  }
  return mixHex(base, COLORS.skyHorizon, fogT);
}

function drawTerrain(ctx, cam, w, h, focal, state, world) {
  const CELL = 95;
  const RADIUS = 15;
  const originX = Math.round(state.x / CELL) * CELL;
  const originY = Math.round(state.y / CELL) * CELL;
  const cells = [];

  for (let ix = -RADIUS; ix < RADIUS; ix++) {
    for (let iy = -RADIUS; iy < RADIUS; iy++) {
      const x0 = originX + ix * CELL;
      const y0 = originY + iy * CELL;
      const dx = x0 + CELL / 2 - state.x;
      const dy = y0 + CELL / 2 - state.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1750) continue;
      cells.push({ x0, y0, dist });
    }
  }
  cells.sort((a, b) => b.dist - a.dist);

  for (const cell of cells) {
    const { x0, y0 } = cell;
    const corners = [
      [x0, y0], [x0 + CELL, y0], [x0 + CELL, y0 + CELL], [x0, y0 + CELL],
    ].map(([px, py]) => {
      const z = Math.max(world.heightAt(px, py), WORLD.seaLevel);
      return project(cam, w, h, focal, px, py, z);
    });
    if (corners.some((c) => c === null)) continue;
    const avgH = world.heightAt(x0 + CELL / 2, y0 + CELL / 2);
    const fogT = Math.min(0.82, cell.dist / 2100);
    ctx.fillStyle = cellColour(world, x0 + CELL / 2, y0 + CELL / 2, avgH, fogT);
    poly(ctx, corners);
    ctx.fill();
  }
}

// --- runway ------------------------------------------------------------------------
function drawRunway(ctx, cam, w, h, focal, world) {
  const rw = world.runway;
  const rad = rw.heading * DEG;
  const dirX = Math.sin(rad);
  const dirY = Math.cos(rad);
  const sideX = Math.cos(rad);
  const sideY = -Math.sin(rad);
  const hl = rw.length / 2;
  const hw = rw.width / 2;
  const z = rw.elevation + 0.35;
  const corner = (along, cross) => project(cam, w, h, focal,
    rw.x + dirX * along + sideX * cross, rw.y + dirY * along + sideY * cross, z);
  const pts = [corner(-hl, -hw), corner(hl, -hw), corner(hl, hw), corner(-hl, hw)];
  if (pts.some((p) => p === null)) return;

  ctx.fillStyle = COLORS.runway;
  poly(ctx, pts);
  ctx.fill();

  // Centreline dashes and thresholds.
  ctx.strokeStyle = COLORS.runwayMark;
  ctx.lineWidth = Math.max(1.5, focal / 300);
  ctx.setLineDash([18, 14]);
  const a = corner(-hl + 30, 0);
  const b = corner(hl - 30, 0);
  if (a && b) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Edge lights.
  ctx.fillStyle = '#ffe9a3';
  for (let along = -hl; along <= hl; along += 92) {
    for (const cross of [-hw - 3, hw + 3]) {
      const p = corner(along, cross);
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.2, focal / p.depth * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// --- rings ----------------------------------------------------------------------------
function drawRings(ctx, cam, w, h, focal, state, world, time) {
  const rings = world.rings;
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    // Hoop plane faces along the course direction (prev -> next).
    const prev = i === 0 ? { x: world.runway.x, y: world.runway.y } : rings[i - 1];
    const next = i === rings.length - 1 ? ring : rings[i + 1];
    let nx = next.x - prev.x;
    let ny = next.y - prev.y;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    // In-plane axes: horizontal = perpendicular of normal, vertical = world up adjusted.
    const hx = -ny;
    const hy = nx;

    const isNext = i === state.ringIndex;
    const isDone = i < state.ringIndex;
    const pts = [];
    let visible = true;
    const SEG = 26;
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;
      const px = ring.x + hx * Math.cos(a) * ring.r;
      const py = ring.y + hy * Math.cos(a) * ring.r;
      const pz = ring.z + Math.sin(a) * ring.r;
      const p = project(cam, w, h, focal, px, py, pz);
      if (!p) { visible = false; break; }
      pts.push(p);
    }
    if (!visible) continue;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let s = 1; s < pts.length; s++) ctx.lineTo(pts[s].x, pts[s].y);
    ctx.closePath();
    if (isNext) {
      const pulse = 0.75 + Math.sin(time * 5) * 0.25;
      ctx.strokeStyle = COLORS.ringNext;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = Math.max(3, focal / 130);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = isDone ? COLORS.ringDone : COLORS.ringAhead;
      ctx.lineWidth = Math.max(1.6, focal / 220);
      ctx.stroke();
    }
  }
}

// --- scenery -----------------------------------------------------------------------------
function drawScenery(ctx, cam, w, h, focal, state, world) {
  const items = [];
  for (const item of world.scenery) {
    const d = Math.hypot(item.x - state.x, item.y - state.y);
    if (d < 1500) items.push({ item, d });
  }
  items.sort((a, b) => b.d - a.d);

  for (const { item } of items) {
    const groundZ = Math.max(world.heightAt(item.x, item.y), 0);
    const base = project(cam, w, h, focal, item.x, item.y, groundZ);
    if (!base) continue;
    const unit = focal / base.depth; // screen px per metre here
    if (unit < 0.02) continue;

    if (item.kind === 'tree') {
      const hh = 13 * item.s * unit;
      const ww = 5.5 * item.s * unit;
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(base.x - ww * 0.08, base.y - hh * 0.25, ww * 0.16, hh * 0.25);
      ctx.fillStyle = shade(COLORS.forest, 0.85 + (hash2(item.x | 0, item.y | 0) - 0.5) * 0.3);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - hh);
      ctx.lineTo(base.x - ww, base.y - hh * 0.2);
      ctx.lineTo(base.x + ww, base.y - hh * 0.2);
      ctx.closePath();
      ctx.fill();
    } else if (item.kind === 'house') {
      const ww = 11 * item.s * unit;
      const hh = 6.5 * item.s * unit;
      ctx.fillStyle = '#ddd6c4';
      ctx.fillRect(base.x - ww / 2, base.y - hh, ww, hh);
      ctx.fillStyle = '#a34a38';
      ctx.beginPath();
      ctx.moveTo(base.x - ww * 0.62, base.y - hh);
      ctx.lineTo(base.x, base.y - hh * 1.55);
      ctx.lineTo(base.x + ww * 0.62, base.y - hh);
      ctx.closePath();
      ctx.fill();
    } else if (item.kind === 'crane') {
      const hh = 26 * item.s * unit;
      const ww = 17 * item.s * unit;
      ctx.strokeStyle = '#c96a2e';
      ctx.lineWidth = Math.max(1.2, unit * 0.7);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x, base.y - hh);
      ctx.lineTo(base.x + ww, base.y - hh);
      ctx.moveTo(base.x, base.y - hh * 0.55);
      ctx.lineTo(base.x + ww * 0.8, base.y);
      ctx.stroke();
    } else if (item.kind === 'lighthouse') {
      const hh = 21 * item.s * unit;
      const ww = 4.6 * item.s * unit;
      for (let band = 0; band < 4; band++) {
        ctx.fillStyle = band % 2 ? '#e8e4da' : '#c33d2a';
        ctx.fillRect(base.x - ww / 2, base.y - hh + (hh / 4) * band, ww, hh / 4);
      }
      ctx.fillStyle = '#ffe9a3';
      ctx.fillRect(base.x - ww * 0.3, base.y - hh - unit * 1.6, ww * 0.6, unit * 1.6);
    }
  }
}

// --- the plane (chase view, drawn at screen centre) --------------------------------------
function drawPlane(ctx, w, h, state, time) {
  const cx = w / 2;
  const cy = h * 0.60 + Math.sin(state.pitch * DEG) * h * 0.06;
  const s = w / 1280; // scale unit at the 1280 reference width
  const rollRad = state.roll * DEG * 0.9;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rollRad);
  ctx.scale(s, s);

  // Propeller blur (nose points away from camera; a faint disc at the front).
  const propSpin = state.throttle > 0.02 && state.status === 'flying';
  if (propSpin) {
    ctx.fillStyle = 'rgba(230,235,240,0.20)';
    ctx.beginPath();
    ctx.ellipse(0, -2, 30, 30 * (0.32 + Math.sin(time * 61) * 0.02), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Main wing.
  ctx.fillStyle = COLORS.planeWing;
  ctx.beginPath();
  ctx.moveTo(-118, 6);
  ctx.lineTo(-16, -4);
  ctx.lineTo(16, -4);
  ctx.lineTo(118, 6);
  ctx.lineTo(112, 16);
  ctx.lineTo(-112, 16);
  ctx.closePath();
  ctx.fill();

  // Fuselage (rear view: rounded body tapering up to the fin).
  ctx.fillStyle = COLORS.planeBody;
  ctx.beginPath();
  ctx.moveTo(-15, 20);
  ctx.quadraticCurveTo(-19, -14, -7, -30);
  ctx.lineTo(7, -30);
  ctx.quadraticCurveTo(19, -14, 15, 20);
  ctx.quadraticCurveTo(0, 27, -15, 20);
  ctx.closePath();
  ctx.fill();

  // Accent stripe.
  ctx.fillStyle = COLORS.planeAccent;
  ctx.fillRect(-15.5, 2, 31, 5);

  // Vertical fin.
  ctx.fillStyle = COLORS.planeAccent;
  ctx.beginPath();
  ctx.moveTo(-3.4, -30);
  ctx.lineTo(0, -58);
  ctx.lineTo(3.4, -30);
  ctx.closePath();
  ctx.fill();

  // Tailplane.
  ctx.fillStyle = COLORS.planeWing;
  ctx.beginPath();
  ctx.moveTo(-40, -26);
  ctx.lineTo(40, -26);
  ctx.lineTo(36, -19);
  ctx.lineTo(-36, -19);
  ctx.closePath();
  ctx.fill();

  // Canopy.
  ctx.fillStyle = COLORS.canopy;
  ctx.beginPath();
  ctx.ellipse(0, -12, 7.5, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,245,0.65)';
  ctx.beginPath();
  ctx.ellipse(-2.4, -16, 2.6, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Nav lights: red port, green starboard.
  ctx.fillStyle = '#ff4444';
  ctx.beginPath(); ctx.arc(-116, 10, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3aff7a';
  ctx.beginPath(); ctx.arc(116, 10, 3.2, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// --- scene entry point ---------------------------------------------------------------------
export function drawScene(ctx, w, h, state, world, view = {}) {
  const time = view.time ?? 0;
  const focal = h * 1.05;
  const cam = makeCamera(state);
  drawSky(ctx, w, h, state);
  drawGroundBase(ctx, w, h, state, world, cam);
  drawClouds(ctx, cam, w, h, focal, world, time);
  drawTerrain(ctx, cam, w, h, focal, state, world);
  drawRunway(ctx, cam, w, h, focal, world);
  drawScenery(ctx, cam, w, h, focal, state, world);
  drawRings(ctx, cam, w, h, focal, state, world, time);
  drawPlane(ctx, w, h, state, time);
}
