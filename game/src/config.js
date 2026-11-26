// Skyharbor Run — shared constants.
// World axes: x = east, y = north, z = up (metres above sea level).
// Heading: degrees, 0 = north, 90 = east, clockwise.

export const WORLD = {
  size: 6000,          // world spans -size/2 .. +size/2 on x and y
  seaLevel: 0,         // water plane height (m)
  shoreY: -1150,       // coastline: south of this y is open sea
  mountainY: 1500,     // terrain climbs hard north of this y
  ceiling: 1600,       // soft altitude cap for the camera/world feel (m)
};

export const RUNWAY = {
  x: 0,
  y: -880,             // just inland from the shore
  heading: 90,         // runway points east
  length: 920,
  width: 46,
  elevation: 6,        // flat plateau height at the strip (m)
};

export const PLANE = {
  stallSpeed: 27,      // m/s — below this the wing stops flying
  maxSpeed: 80,        // m/s at full throttle, level
  idleSpeed: 0,
  accelRate: 9,        // m/s gained per second at full throttle
  dragCoef: 0.0035,    // quadratic drag
  climbPenalty: 0.55,  // speed bled per m/s of climb
  maxRoll: 62,         // degrees of bank at full input
  rollRate: 140,       // degrees of bank per second toward target
  pitchRate: 55,       // degrees of pitch per second at full input
  maxPitchUp: 32,
  maxPitchDown: -38,
  turnFactor: 0.42,    // heading deg/s per degree of bank at 40 m/s
  gravitySink: 9.2,    // m/s^2 pulling the nose down in a stall
};

export const MISSION = {
  ringCount: 8,
  ringRadius: 42,      // pass-through tolerance (m)
  ringScore: 250,
  landingBonus: 500,
  fuelCapacity: 100,   // abstract fuel units
  fuelBurn: 0.55,      // units per second at full throttle
  fuelIdle: 0.06,      // units per second at idle
  startFuel: 82,
};

export const COLORS = {
  skyTop: '#2e6fb7',
  skyMid: '#7db6e6',
  skyHorizon: '#dceefb',
  sun: '#fff3c4',
  cloud: 'rgba(255,255,255,0.85)',
  water: '#1d5f8a',
  waterDeep: '#174e75',
  sand: '#d9c08a',
  fieldA: '#79a84b',
  fieldB: '#a9bd5c',
  meadow: '#8fbf67',
  forest: '#3e7d3a',
  rock: '#8d8578',
  snow: '#f4f7f9',
  runway: '#4a4d52',
  runwayMark: '#f5f5f0',
  ringNext: '#ffc21f',
  ringAhead: '#2fd4c4',
  ringDone: 'rgba(120,140,150,0.35)',
  planeBody: '#e8e4da',
  planeAccent: '#d84f35',
  planeWing: '#c9452c',
  canopy: '#20303c',
  hudPanel: 'rgba(8,18,28,0.55)',
  hudText: '#eaf6ff',
  hudAccent: '#ffc21f',
  hudGood: '#7be382',
  hudBad: '#ff6b57',
};
