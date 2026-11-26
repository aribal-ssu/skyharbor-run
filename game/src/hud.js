// Skyharbor Run — HUD and screens.
// Everything the pilot reads: instrument panels, bars, warnings, the title
// card and the end-of-sortie panel. The world itself is render.js's job.

import { COLORS, MISSION } from './config.js';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const toFeet = (m) => Math.round(m * 3.281);
const toKnots = (ms) => Math.round(ms * 1.944);

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function label(ctx, x, y, text, size = 13, colour = COLORS.hudText, align = 'left') {
  ctx.fillStyle = colour;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function bar(ctx, x, y, w, h, frac, colour) {
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function missionMessage(state, totalRings) {
  if (state.flameout) return 'Fuel gone — glide for the runway if you can';
  if (state.onGround && state.speed < 4 && state.ringIndex === 0) {
    return 'Throttle up with W, rotate at 55 kt with ↑';
  }
  if (state.ringIndex < totalRings) return 'Fly through the gold ring';
  return 'All rings done — return to the runway and land gently';
}

// Compass ribbon across the top centre: a sliding tape of ticks and
// cardinal letters, with an accent caret marking the current heading.
function drawCompass(ctx, w, state) {
  const cw = 360;
  const cx = w / 2;
  const x0 = cx - cw / 2;
  const y0 = 14;
  const hh = 34;
  panel(ctx, x0, y0, cw, hh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + 4, y0, cw - 8, hh);
  ctx.clip();
  const pxPerDeg = 3.4;
  const reach = cw / 2 / pxPerDeg + 6;
  for (let hv = 0; hv < 360; hv += 5) {
    const d = ((hv - state.heading + 540) % 360) - 180;
    if (Math.abs(d) > reach) continue;
    const x = cx + d * pxPerDeg;
    if (hv % 45 === 0) {
      const letter = COMPASS[Math.round(hv / 45) % 8];
      label(ctx, x, y0 + 17, letter, 13, hv === 0 ? COLORS.hudAccent : COLORS.hudText, 'center');
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.moveTo(x, y0 + 22);
      ctx.lineTo(x, y0 + hh - 3);
      ctx.stroke();
    } else if (hv % 15 === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(x, y0 + 24);
      ctx.lineTo(x, y0 + hh - 3);
      ctx.stroke();
      if (hv % 30 === 0) {
        label(ctx, x, y0 + 17, String(hv / 10).padStart(2, '0'), 10, COLORS.hudText, 'center');
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(x, y0 + 28);
      ctx.lineTo(x, y0 + hh - 3);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Centre caret: the heading you are actually on.
  ctx.fillStyle = COLORS.hudAccent;
  ctx.beginPath();
  ctx.moveTo(cx - 5, y0 + hh);
  ctx.lineTo(cx + 5, y0 + hh);
  ctx.lineTo(cx, y0 + hh - 7);
  ctx.closePath();
  ctx.fill();
}

export function drawHud(ctx, w, h, state, mission) {
  const totalRings = mission.totalRings;
  const compass = COMPASS[Math.round(state.heading / 45) % 8];

  // Crosshair.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 13, h / 2);
  ctx.lineTo(w / 2 - 4, h / 2);
  ctx.moveTo(w / 2 + 4, h / 2);
  ctx.lineTo(w / 2 + 13, h / 2);
  ctx.moveTo(w / 2, h / 2 - 4);
  ctx.lineTo(w / 2, h / 2 + 9);
  ctx.stroke();

  // Left panel: the three big readouts.
  panel(ctx, 16, 16, 168, 118);
  label(ctx, 30, 44, `ALT  ${toFeet(state.z)} ft`, 19);
  label(ctx, 30, 76, `SPD  ${toKnots(state.speed)} kt`, 19);
  label(ctx, 30, 108, `HDG  ${String(Math.round(state.heading) % 360).padStart(3, '0')}° ${compass}`, 19);

  // Right panel: mission progress.
  const minutes = Math.floor(state.time / 60);
  const seconds = Math.floor(state.time % 60);
  panel(ctx, w - 184, 16, 168, 118);
  label(ctx, w - 170, 44, `RING  ${Math.min(state.ringIndex + (state.ringIndex < totalRings ? 1 : 0), totalRings)}/${totalRings}`, 19,
    state.ringIndex >= totalRings ? COLORS.hudGood : COLORS.hudText);
  label(ctx, w - 170, 76, `SCORE  ${state.score}`, 19);
  label(ctx, w - 170, 108, `TIME  ${minutes}:${String(seconds).padStart(2, '0')}`, 19);

  drawCompass(ctx, w, state);

  // Bottom-left: throttle and fuel bars.
  panel(ctx, 16, h - 86, 208, 70);
  label(ctx, 30, h - 58, 'THR', 12);
  bar(ctx, 74, h - 68, 136, 10, state.throttle, COLORS.hudAccent);
  label(ctx, 30, h - 30, 'FUEL', 12);
  const fuelFrac = state.fuel / MISSION.fuelCapacity;
  bar(ctx, 74, h - 40, 136, 10, fuelFrac, fuelFrac < 0.22 ? COLORS.hudBad : COLORS.hudGood);

  drawHorizon(ctx, w - 74, h - 66, 46, state);
  drawWind(ctx, w - 168, h - 66, state);

  // Warnings.
  if (state.stalled) {
    const blink = Math.floor(performance.now() / 280) % 2 === 0;
    if (blink) label(ctx, w / 2, h * 0.3, 'STALL', 34, COLORS.hudBad, 'center');
  } else if (state.flameout) {
    label(ctx, w / 2, h * 0.3, 'FLAMEOUT', 24, COLORS.hudBad, 'center');
  } else if (fuelFrac < 0.22 && !state.onGround) {
    label(ctx, w / 2, h * 0.3, 'LOW FUEL', 18, COLORS.hudAccent, 'center');
  }

  // Mission message along the bottom.
  label(ctx, w / 2, h - 22, missionMessage(state, totalRings), 17, COLORS.hudText, 'center');
}

// Wind readout: a small dial whose arrow shows where the wind comes FROM
// relative to the nose (up = ahead), with the strength in knots beneath.
function drawWind(ctx, cx, cy, state) {
  if (state.windDir === undefined || state.windSpeed === undefined) return;
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.arc(cx, cy, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 17, 0, Math.PI * 2);
  ctx.stroke();

  const rel = ((((state.windDir - state.heading) % 360) + 540) % 360) - 180;
  const rad = rel * Math.PI / 180;
  const ax = Math.sin(rad);
  const ay = -Math.cos(rad);
  ctx.strokeStyle = COLORS.hudAccent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + ax * 12, cy + ay * 12);
  ctx.lineTo(cx - ax * 5, cy - ay * 5);
  ctx.stroke();
  // Arrowhead at the inner end, barbs swept back along the shaft.
  const hx = cx - ax * 5;
  const hy = cy - ay * 5;
  const dx = -ax;
  const dy = -ay;
  const c = -0.866;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + (dx * c - dy * 0.5) * 6.5, hy + (dx * 0.5 + dy * c) * 6.5);
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + (dx * c + dy * 0.5) * 6.5, hy + (-dx * 0.5 + dy * c) * 6.5);
  ctx.stroke();

  label(ctx, cx, cy - 24, 'WIND', 10, COLORS.hudText, 'center');
  label(ctx, cx, cy + 32, `${toKnots(state.windSpeed)} KT`, 11, COLORS.hudText, 'center');
}

// Artificial horizon: a small ball that rolls and pitches with the plane.
function drawHorizon(ctx, cx, cy, r, state) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-state.roll * Math.PI / 180);
  const pitchPx = state.pitch * 1.1;
  ctx.fillStyle = '#3f7fbf';
  ctx.fillRect(-r, -r + pitchPx, r * 2, r * 2);
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(-r, pitchPx, r * 2, r * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx - r * 0.15, cy);
  ctx.lineTo(cx, cy + r * 0.18);
  ctx.lineTo(cx + r * 0.15, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawTitle(ctx, w, h) {
  ctx.fillStyle = 'rgba(5,12,20,0.42)';
  ctx.fillRect(0, 0, w, h);
  // Name and subtitle in the upper third; the middle of the frame stays
  // clear so the plane, strip and rings show through.
  label(ctx, w / 2, h * 0.20, 'SKYHARBOR RUN', 64, COLORS.hudText, 'center');
  label(ctx, w / 2, h * 0.20 + 38, 'A ring-run sortie over Skyharbor Bay', 20, COLORS.hudAccent, 'center');

  const lines = [
    'W / S — throttle        ↑ / ↓ or mouse — pitch',
    'A / D or ← / → — bank and turn',
    'Thread all 8 rings, then land back on the strip.',
    'Watch your fuel. Respect the stall.',
  ];
  // Controls in the lower third, on a translucent panel.
  const panelW = 600;
  const panelH = lines.length * 26 + 30;
  const panelX = (w - panelW) / 2;
  const panelY = h * 0.66;
  panel(ctx, panelX, panelY, panelW, panelH);
  lines.forEach((line, i) => label(ctx, w / 2, panelY + 36 + i * 26, line, 16, COLORS.hudText, 'center'));
  label(ctx, w / 2, panelY + panelH + 36, 'Press Enter to fly', 22, COLORS.hudGood, 'center');
}

export function drawEnd(ctx, w, h, state, mission) {
  ctx.fillStyle = 'rgba(5,12,20,0.45)';
  ctx.fillRect(0, 0, w, h);
  const pw = 430;
  const ph = 252;
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  panel(ctx, px, py, pw, ph);

  if (state.status === 'landed') {
    label(ctx, w / 2, py + 52, 'SORTIE COMPLETE', 30, COLORS.hudGood, 'center');
    label(ctx, w / 2, py + 82, state.endReason, 14, COLORS.hudText, 'center');
    const rows = [
      [`Rings threaded`, `${state.ringsPassed}/${mission.totalRings}  ·  ${state.ringsPassed * MISSION.ringScore}`],
      [`Time`, `${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`],
      [`Fuel in the tanks`, `${state.fuel.toFixed(0)} units`],
      [`TOTAL SCORE`, `${state.score}`],
    ];
    rows.forEach((row, i) => {
      label(ctx, px + 36, py + 122 + i * 26, row[0], 15);
      label(ctx, px + pw - 36, py + 122 + i * 26, row[1], 15, COLORS.hudText, 'right');
    });
  } else {
    label(ctx, w / 2, py + 58, 'CRASHED', 34, COLORS.hudBad, 'center');
    label(ctx, w / 2, py + 96, state.endReason, 15, COLORS.hudText, 'center');
    label(ctx, w / 2, py + 140, `Rings threaded: ${state.ringsPassed}/${mission.totalRings}  ·  Score ${state.score}`, 16, COLORS.hudText, 'center');
  }
  label(ctx, w / 2, py + ph - 22, 'Press R to fly again', 16, COLORS.hudAccent, 'center');
}
