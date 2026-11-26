// Skyharbor Run — flight model and mission logic.
// stepPlane advances the plane one fixed step and reports the sortie status.
// Deliberately arcade-leaning: honest throttle/stall/bank behaviour, but
// forgiving enough to finish a sortie with a keyboard.

import { PLANE, MISSION, RUNWAY } from './config.js';

const DEG = Math.PI / 180;

// Extra score for a true greaser: feather-soft, slow and on the centreline.
const GREASER_BONUS = 250;

export function headingDelta(a, b) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function createPlane() {
  // Parked at the western threshold, nose pointing down the strip.
  const rad = RUNWAY.heading * DEG;
  return {
    x: RUNWAY.x - Math.sin(rad) * (RUNWAY.length / 2 - 60),
    y: RUNWAY.y - Math.cos(rad) * (RUNWAY.length / 2 - 60),
    z: RUNWAY.elevation,
    heading: RUNWAY.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    vspeed: 0,
    throttle: 0,
    fuel: MISSION.startFuel,
    stalled: false,
    onGround: true,
    flameout: false,
    windDir: 285,      // degrees the wind blows FROM (updated every step)
    windSpeed: 4.6,    // m/s
    windHead: 0,       // headwind component, m/s (+ = on the nose)
    windCross: 0,      // crosswind component, m/s (+ = from the right)
    status: 'flying', // 'flying' | 'landed' | 'crashed'
    endReason: '',
    ringIndex: 0,
    ringsPassed: 0,
    score: 0,
    time: 0,
  };
}

function checkRingPass(state, world) {
  const ring = world.rings[state.ringIndex];
  if (!ring) return;
  const dx = state.x - ring.x;
  const dy = state.y - ring.y;
  const dz = state.z - ring.z;
  if (dx * dx + dy * dy + dz * dz < ring.r * ring.r) {
    state.ringIndex += 1;
    state.ringsPassed += 1;
    state.score += MISSION.ringScore;
  }
}

// Resolve a touchdown on the strip. Returns 'landed' | 'crashed' | null
// (null = still rolling / not a touchdown yet).
function resolveRunwayContact(state) {
  const descent = -state.vspeed;
  const headingError = Math.abs(headingDelta(state.heading, RUNWAY.heading));
  const reciprocalError = Math.abs(headingDelta(state.heading, RUNWAY.heading + 180));
  const aligned = Math.min(headingError, reciprocalError) <= 28;

  if (!aligned) {
    state.endReason = 'Touched down sideways across the runway.';
    return 'crashed';
  }
  if (descent > 7.5) {
    state.endReason = `Came down too hard — ${descent.toFixed(1)} m/s of sink.`;
    return 'crashed';
  }
  if (state.speed > PLANE.stallSpeed * 1.9) {
    state.endReason = 'Far too fast to stop — ran off the end of the strip.';
    return 'crashed';
  }
  const rough = descent > 4.5 || state.speed > PLANE.stallSpeed * 1.45 || Math.abs(state.roll) > 10;
  // Centreline offset in the runway frame (same formula as world.isOverRunway).
  const rad = RUNWAY.heading * DEG;
  const cross = (state.x - RUNWAY.x) * Math.cos(rad) - (state.y - RUNWAY.y) * Math.sin(rad);
  const greaser = !rough && descent <= 2.2 && Math.abs(cross) <= 6 && state.speed <= PLANE.stallSpeed * 1.3;
  if (greaser) {
    state.score += MISSION.landingBonus + GREASER_BONUS;
    state.endReason = 'A greaser — right on the centreline, soft as you like.';
  } else if (rough) {
    state.score += Math.floor(MISSION.landingBonus / 2);
    state.endReason = 'A rough arrival, but the aeroplane is in one piece.';
  } else {
    state.score += MISSION.landingBonus;
    state.endReason = 'A tidy landing — down safe and rolling.';
  }
  state.score += Math.round(state.fuel) * 2;
  return 'landed';
}

export function stepPlane(state, controls, dt, world) {
  if (state.status !== 'flying') return state.status;
  state.time += dt;

  // --- wind ------------------------------------------------------------------
  // A deterministic slow wander of direction and strength (fixed functions
  // of sortie time, so every run of a sortie breathes the same way). The
  // drift itself is applied in the motion section below.
  state.windDir = 285 + Math.sin(state.time * 0.011) * 26 + Math.sin(state.time * 0.0037 + 1.7) * 13;
  state.windSpeed = 4.6 + Math.sin(state.time * 0.017 + 0.6) * 1.9; // ~5-13 kt
  const windRel = headingDelta(state.windDir, state.heading) * DEG;
  state.windHead = Math.cos(windRel) * state.windSpeed;
  state.windCross = Math.sin(windRel) * state.windSpeed;

  // --- engine & fuel -------------------------------------------------------
  state.throttle = Math.max(0, Math.min(1, state.throttle + controls.throttleDelta * dt * 0.45));
  state.fuel = Math.max(0, state.fuel - (MISSION.fuelIdle + state.throttle * MISSION.fuelBurn) * dt);
  state.flameout = state.fuel <= 0;
  const throttle = state.flameout ? 0 : state.throttle;

  // --- attitude ------------------------------------------------------------
  const targetRoll = controls.rollInput * PLANE.maxRoll;
  const rollStep = PLANE.rollRate * dt;
  state.roll += Math.max(-rollStep, Math.min(rollStep, targetRoll - state.roll));

  if (!state.onGround) {
    // pitchInput is -1 for "nose up" (ArrowUp / mouse high), +1 for nose down.
    state.pitch -= controls.pitchInput * PLANE.pitchRate * dt;
    if (state.stalled) state.pitch -= 26 * dt; // the nose drops away
    state.pitch = Math.max(PLANE.maxPitchDown, Math.min(PLANE.maxPitchUp, state.pitch));
  } else {
    // On the roll, pitch only answers once there is speed to rotate.
    const rotate = state.speed > PLANE.stallSpeed * 0.82 && controls.pitchInput < 0;
    state.pitch = rotate ? Math.min(10, state.pitch + 22 * dt) : Math.max(0, state.pitch - 30 * dt);
  }

  // --- speed ----------------------------------------------------------------
  const pitchRad = state.pitch * DEG;
  const thrust = throttle * 15 * (1 - state.speed / (PLANE.maxSpeed * 1.3));
  const drag = PLANE.dragCoef * state.speed * state.speed;
  const slope = state.onGround ? 0 : 9.8 * Math.sin(pitchRad) * PLANE.climbPenalty;
  state.speed = Math.max(0, state.speed + (thrust - drag - slope) * dt);
  if (state.onGround) state.speed = Math.max(0, state.speed - (state.speed > 4 ? 0.4 : 1.6) * dt);

  state.stalled = !state.onGround && state.speed < PLANE.stallSpeed;

  // --- heading (banked turn) --------------------------------------------------
  if (!state.onGround) {
    const turnRate = Math.sin(state.roll * DEG) * 34 * PLANE.turnFactor
      * (40 / Math.max(state.speed, 24));
    state.heading = (state.heading + turnRate * dt + 360) % 360;
  }

  // --- motion -----------------------------------------------------------------
  const headingRad = state.heading * DEG;
  const forward = state.speed * Math.cos(pitchRad);
  state.x += Math.sin(headingRad) * forward * dt;
  state.y += Math.cos(headingRad) * forward * dt;

  // The air mass itself moves: while airborne the wind carries the plane
  // with it (softened — the plane mostly punches through). This is what
  // pushes you off the centreline on final if you do not correct for it.
  if (!state.onGround) {
    const windTo = (state.windDir + 180) * DEG;
    state.x += Math.sin(windTo) * state.windSpeed * 0.55 * dt;
    state.y += Math.cos(windTo) * state.windSpeed * 0.55 * dt;
  }

  const ground = world.groundHeight(state.x, state.y);

  if (state.onGround) {
    state.z = ground;
    state.vspeed = 0;
    if (state.speed > PLANE.stallSpeed && state.pitch > 3.5) {
      state.onGround = false; // rotated and airborne
    } else if (!world.isOverRunway(state.x, state.y) && state.speed > 6) {
      state.status = 'crashed';
      state.endReason = 'Ran off the side of the runway on the roll.';
      return state.status;
    }
  } else {
    let vspeed = state.speed * Math.sin(pitchRad);
    vspeed -= (1 - Math.cos(state.roll * DEG)) * state.speed * 0.14; // bank bleeds lift
    if (state.stalled) vspeed -= PLANE.gravitySink * (1 - state.speed / PLANE.stallSpeed);
    state.vspeed = vspeed;
    state.z += vspeed * dt;

    checkRingPass(state, world);

    if (state.z <= ground + 0.4) {
      state.z = ground;
      if (world.isOverRunway(state.x, state.y) && state.ringIndex >= world.rings.length) {
        state.status = resolveRunwayContact(state);
      } else if (world.isOverRunway(state.x, state.y) && state.speed < PLANE.stallSpeed * 1.3 && -state.vspeed <= 4.5) {
        // Touched down early with rings still out: roll it out and go around.
        state.onGround = true;
        state.pitch = 0;
      } else if (world.heightAt(state.x, state.y) < 0) {
        state.status = 'crashed';
        state.endReason = 'Ditched in the bay. The harbour master sends his regards.';
      } else {
        state.status = 'crashed';
        state.endReason = state.stalled
          ? 'Stalled and met the ground before the wing woke up.'
          : 'Flew into terrain that was not a runway.';
      }
    }
  }

  return state.status;
}
