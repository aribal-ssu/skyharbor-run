// Skyharbor Run — entry point and game loop.
// Owns the canvas, the state machine (title -> flying -> ended), fixed-step
// physics and the wiring between input, physics, render, hud and audio.
// With ?shot= in the URL it renders one frozen frame instead (shots.js).

import { MISSION } from './config.js';
import { Input } from './input.js';
import { buildWorld } from './world.js';
import { createPlane, stepPlane } from './physics.js';
import { drawScene } from './render.js';
import { drawHud, drawTitle, drawEnd } from './hud.js';
import { EngineAudio, ringBlip, touchdownThump } from './audio.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 1) || 1;
const mission = { totalRings: MISSION.ringCount };

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = Math.round(window.innerWidth * dpr);
  let h = Math.round(window.innerHeight * dpr);
  const scale = Math.min(1, 1280 / w, 720 / h);
  canvas.width = Math.max(320, Math.round(w * scale));
  canvas.height = Math.max(240, Math.round(h * scale));
}
window.addEventListener('resize', resize);
resize();

// --- screenshot mode: one static frame, no loop --------------------------------
const shot = setupShot(params);
if (shot) {
  const { state, world, mode } = shot;
  drawScene(ctx, canvas.width, canvas.height, state, world, { time: 1.6 });
  if (mode === 'title') drawTitle(ctx, canvas.width, canvas.height);
  if (mode === 'play') drawHud(ctx, canvas.width, canvas.height, state, mission);
  if (mode === 'end') {
    drawHud(ctx, canvas.width, canvas.height, state, mission);
    drawEnd(ctx, canvas.width, canvas.height, state, mission);
  }
  document.title = 'shot-ready';
} else {
  runGame();
}

function runGame() {
  const world = buildWorld(seed);
  const input = new Input(window);
  const audio = new EngineAudio();
  let state = createPlane();
  // The renderer reads this smoothed copy, never the raw physics state:
  // position and attitude ease toward the truth each frame, so the chase
  // camera floats instead of jittering with every physics substep. The HUD
  // keeps reading the raw state — instruments must be exact.
  let view = { ...state };
  let mode = 'title'; // 'title' | 'flying' | 'ended'
  let paused = false;
  let endTimer = 0;
  let viewTime = 0;
  let last = performance.now();
  let accumulator = 0;
  const STEP = 1 / 120;
  let prev = { pause: false, mute: false, restart: false };
  let rungRings = 0;         // ringsPassed as of the last ring blip
  let prevStatus = 'flying'; // last frame's status, for the touchdown thump

  function reset() {
    state = createPlane();
    view = { ...state };
    mode = 'title';
    paused = false;
    endTimer = 0;
    rungRings = 0;
    prevStatus = 'flying';
  }

  // Shortest-path angular lerp, in degrees.
  function angleLerp(a, b, t) {
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return (a + d * t + 360) % 360;
  }

  function smoothView(dt) {
    const posK = 1 - Math.exp(-dt * 14);
    const attK = 1 - Math.exp(-dt * 9);
    view.x += (state.x - view.x) * posK;
    view.y += (state.y - view.y) * posK;
    view.z += (state.z - view.z) * posK;
    view.pitch += (state.pitch - view.pitch) * attK;
    view.roll += (state.roll - view.roll) * attK;
    view.heading = angleLerp(view.heading, state.heading, attK);
    view.speed = state.speed;
    view.throttle = state.throttle;
    view.status = state.status;
    view.ringIndex = state.ringIndex;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const controls = input.snapshot();

    if (controls.pause && !prev.pause && mode === 'flying') paused = !paused;
    if (controls.mute && !prev.mute) audio.setMuted(!audio.muted);
    prev = controls;

    if (mode === 'title' && controls.start) {
      audio.start();
      mode = 'flying';
    }
    if (mode === 'ended' && controls.restart) reset();

    if (mode === 'flying' && !paused) {
      viewTime += dt;
      accumulator += dt;
      while (accumulator >= STEP) {
        stepPlane(state, controls, STEP, world);
        accumulator -= STEP;
        if (state.status !== 'flying') break;
      }
      if (state.status !== 'flying') {
        endTimer += dt;
        if (endTimer > 0.9) mode = 'ended';
      }
      // One-shot audio cues, edge-triggered off the physics state.
      if (state.ringsPassed > rungRings) {
        rungRings = state.ringsPassed;
        ringBlip(audio);
      }
      if (state.status !== 'flying' && prevStatus === 'flying') touchdownThump(audio);
      prevStatus = state.status;
      audio.update(state);
    }

    smoothView(dt);
    const w = canvas.width;
    const h = canvas.height;
    drawScene(ctx, w, h, view, world, { time: viewTime });
    if (mode === 'title') {
      drawHud(ctx, w, h, state, mission);
      drawTitle(ctx, w, h);
    } else {
      drawHud(ctx, w, h, state, mission);
      if (paused) drawPaused(ctx, w, h);
      if (mode === 'ended') drawEnd(ctx, w, h, state, mission);
    }
  }

  requestAnimationFrame(frame);
}

function drawPaused(ctx, w, h) {
  ctx.fillStyle = 'rgba(5,12,20,0.4)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', w / 2, h / 2);
}
