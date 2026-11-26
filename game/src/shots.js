// Skyharbor Run — screenshot scenes.
// When the page URL carries ?shot=start|play|end&seed=N, main.js renders a
// single frozen frame from the state built here instead of running the
// game, so the dossier screenshots are real renders of this exact code,
// reproducible from the seed alone.

import { RUNWAY, MISSION } from './config.js';
import { buildWorld } from './world.js';
import { createPlane } from './physics.js';

function startState() {
  // Airborne on climb-out over the strip instead of parked at the
  // threshold: the title card floats over a flying scene — runway falling
  // away below, the first rings ahead.
  const state = createPlane();
  const rad = RUNWAY.heading * Math.PI / 180;
  const along = -RUNWAY.length / 2 + 700; // a few hundred metres past the threshold
  state.x = RUNWAY.x + Math.sin(rad) * along;
  state.y = RUNWAY.y + Math.cos(rad) * along;
  state.z = RUNWAY.elevation + 30;
  state.heading = RUNWAY.heading;
  state.speed = 47;
  state.throttle = 0.85;
  state.pitch = 7;
  state.roll = 0;
  state.fuel = 100;
  state.onGround = false;
  state.status = 'flying';
  return { state, mode: 'title' };
}

function playState(world) {
  // Airborne on the run-in to ring 3, banked gently, HUD alive.
  const state = createPlane();
  const target = world.rings[2];
  const prev = world.rings[1];
  let dx = target.x - prev.x;
  let dy = target.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  state.x = target.x - dx * 380;
  state.y = target.y - dy * 380;
  state.z = target.z - 14;
  state.heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  state.pitch = 4;
  state.roll = 12;
  state.speed = 52;
  state.vspeed = 3;
  state.throttle = 0.72;
  state.fuel = 57;
  state.onGround = false;
  state.ringIndex = 2;
  state.ringsPassed = 2;
  state.score = 2 * MISSION.ringScore;
  state.time = 74;
  return { state, mode: 'play' };
}

function endState() {
  // Rolled to a stop on the strip with a full card of rings.
  const state = createPlane();
  state.x = RUNWAY.x + 250;
  state.y = RUNWAY.y;
  state.z = RUNWAY.elevation;
  state.heading = RUNWAY.heading;
  state.speed = 0;
  state.throttle = 0;
  state.fuel = 34;
  state.ringIndex = MISSION.ringCount;
  state.ringsPassed = MISSION.ringCount;
  state.score = MISSION.ringCount * MISSION.ringScore + MISSION.landingBonus + 34 * 2;
  state.time = 212;
  state.status = 'landed';
  state.endReason = 'A greaser — right on the centreline, soft as you like.';
  return { state, mode: 'end' };
}

// Returns { state, world, mode } for a ?shot= URL, or null for normal play.
export function setupShot(searchParams) {
  const name = searchParams.get('shot');
  if (!name) return null;
  const seed = Number(searchParams.get('seed') ?? 1) || 1;
  const world = buildWorld(seed);
  if (name === 'play') {
    const { state, mode } = playState(world);
    return { state, world, mode };
  }
  if (name === 'end') {
    const { state, mode } = endState();
    return { state, world, mode };
  }
  const { state, mode } = startState();
  return { state, world, mode };
}
