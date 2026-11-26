// Skyharbor Run — the world: terrain height field, the ring course, the
// runway and all scenery. Built once from a seed; every query is a pure
// function of (x, y) so rendering and physics always agree.

import { WORLD, RUNWAY, MISSION } from './config.js';
import { mulberry32, range, fbm2 } from './random.js';

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, v) {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

// The river winds north from the harbour mouth; its centreline x for a
// given y. Rendering and the terrain carve both use this.
export function riverCentreX(y) {
  return 620 * Math.sin(y * 0.00055 + 0.8) + 300 * Math.sin(y * 0.0016 + 2.1);
}

// Raw terrain height in metres (below sea level = seabed).
export function terrainHeight(x, y) {
  const hills = fbm2(x * 0.00035 + 13.7, y * 0.00035 + 4.2, 4);
  const detail = fbm2(x * 0.0021 + 91.3, y * 0.0021 + 57.9, 3);

  // Coastal plain: gentle rolling farmland.
  let inland = 9 + hills * 24 + detail * 5;

  // Northern range: ridged noise piled up the further north you go.
  const mountainMask = smoothstep(WORLD.mountainY - 500, 2700, y);
  const ridge = 1 - Math.abs(fbm2(x * 0.0005 + 3.1, y * 0.0005 + 8.4, 4));
  inland += mountainMask * (140 + ridge * ridge * 430);

  // Blend sea -> land across the shoreline.
  const landness = smoothstep(WORLD.shoreY - 160, WORLD.shoreY + 260, y);
  let h = mix(-12, inland, landness);

  // Carve the river channel through the land.
  const riverDist = Math.abs(x - riverCentreX(y));
  if (y > WORLD.shoreY - 120 && riverDist < 110) {
    const bank = smoothstep(34, 110, riverDist);
    h = Math.min(h, mix(1.2, h, bank));
  }

  // Flatten the airfield plateau around the runway.
  const along = (x - RUNWAY.x) * Math.sin(RUNWAY.heading * Math.PI / 180)
    + (y - RUNWAY.y) * Math.cos(RUNWAY.heading * Math.PI / 180);
  const cross = (x - RUNWAY.x) * Math.cos(RUNWAY.heading * Math.PI / 180)
    - (y - RUNWAY.y) * Math.sin(RUNWAY.heading * Math.PI / 180);
  const flatX = 1 - smoothstep(RUNWAY.length / 2 + 60, RUNWAY.length / 2 + 260, Math.abs(along));
  const flatY = 1 - smoothstep(RUNWAY.width / 2 + 50, RUNWAY.width / 2 + 190, Math.abs(cross));
  const plateau = Math.min(flatX, flatY);
  if (plateau > 0) h = mix(h, RUNWAY.elevation, plateau);

  return h;
}

// Height of whatever the plane would touch: terrain, or the sea surface.
export function surfaceHeight(x, y) {
  return Math.max(terrainHeight(x, y), WORLD.seaLevel);
}

// Runway-frame test: is (x, y) over the strip?
export function isOverRunway(x, y) {
  const rad = RUNWAY.heading * Math.PI / 180;
  const dx = x - RUNWAY.x;
  const dy = y - RUNWAY.y;
  const along = dx * Math.sin(rad) + dy * Math.cos(rad);
  const cross = dx * Math.cos(rad) - dy * Math.sin(rad);
  return Math.abs(along) <= RUNWAY.length / 2 && Math.abs(cross) <= RUNWAY.width / 2;
}

// The ring course: out over the bay in a wide arc and back to the strip.
// z is the ring centre altitude; r the pass tolerance.
function buildRings() {
  const r = MISSION.ringRadius;
  return [
    { x: 760, y: -1010, z: 120, r },
    { x: 1330, y: -1420, z: 165, r },
    { x: 1560, y: -2050, z: 205, r },
    { x: 1080, y: -2560, z: 185, r },
    { x: 300, y: -2720, z: 150, r },
    { x: -540, y: -2420, z: 175, r },
    { x: -1120, y: -1830, z: 195, r },
    { x: -760, y: -1180, z: 130, r },
  ];
}

function buildScenery(seed) {
  const rng = mulberry32(seed * 7919 + 17);
  const items = [];

  // Forest clusters on the inland hills.
  for (let i = 0; i < 260; i++) {
    const x = range(rng, -2800, 2800);
    const y = range(rng, WORLD.shoreY + 120, 2600);
    const h = terrainHeight(x, y);
    if (h < 14 || h > 330) continue;
    if (isOverRunway(x, y)) continue;
    if (Math.abs(x - riverCentreX(y)) < 130) continue;
    items.push({ kind: 'tree', x, y, s: range(rng, 0.7, 1.5), rot: range(rng, 0, Math.PI * 2) });
  }

  // Harbour town: houses along the shore west of the strip.
  for (let i = 0; i < 42; i++) {
    const x = range(rng, -1650, -620);
    const y = range(rng, WORLD.shoreY + 60, WORLD.shoreY + 420);
    if (terrainHeight(x, y) < 3) continue;
    items.push({ kind: 'house', x, y, s: range(rng, 0.8, 1.3), rot: range(rng, 0, Math.PI) });
  }

  // Cranes and a lighthouse around the harbour east of the strip.
  items.push({ kind: 'crane', x: 980, y: WORLD.shoreY + 40, s: 1.2, rot: 0.4 });
  items.push({ kind: 'crane', x: 1180, y: WORLD.shoreY + 10, s: 1.0, rot: -0.3 });
  items.push({ kind: 'lighthouse', x: 1560, y: WORLD.shoreY - 30, s: 1.1, rot: 0 });

  return items;
}

function buildClouds(seed) {
  const rng = mulberry32(seed * 104729 + 5);
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: range(rng, -3200, 3200),
      y: range(rng, -3200, 3200),
      z: range(rng, 420, 760),
      s: range(rng, 120, 340),
    });
  }
  return clouds;
}

export function buildWorld(seed = 1) {
  return {
    seed,
    rings: buildRings(),
    runway: RUNWAY,
    scenery: buildScenery(seed),
    clouds: buildClouds(seed),
    heightAt: terrainHeight,
    groundHeight: surfaceHeight,
    isOverRunway,
    riverCentreX,
  };
}
