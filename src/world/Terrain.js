import * as THREE from 'three';
import { createNoise2D, fbm } from '../engine/noise.js';
import { smoothstep, lerp } from '../engine/math.js';
import { TOWNS, CAVES, DUNGEONS } from '../data/towns.js';
import { REGIONS, LAKES, ROADS, SITES, VALE_RADIUS } from '../data/world.js';

export const WORLD_SIZE = 1400; // the terrain mesh, including the mountains around the edge
export const WORLD_RADIUS = 600; // how far you can walk from the centre
export const WATER_LEVEL = -1.0; // the meadow pond; other lakes have their own level

// -z is north. The player wakes at the centre of a flat meadow ringed by hills, woods and mountains.
export const LANDMARKS = {
  spawn: { x: 0, z: 4 },
  camp: { x: 24, z: -26 },
  pond: LAKES[0],
  stones: { x: -6, z: -124 },
  oak: { x: 41, z: -61 },
  stump: { x: -19, z: 44 }, // woodcutter's axe
  hunterCamp: { x: -98, z: 36 }, // hunter's spear, at the edge of the wolf woods
};
export const PATHS = ROADS;

const hills = createNoise2D(1337);
const detail = createNoise2D(4242);
const ridges = createNoise2D(777);
const far = createNoise2D(9001);
const borders = createNoise2D(31);

// ---------------------------------------------------------------- regions
const OUTER = Object.entries(REGIONS).filter(([, r]) => r.bearing !== undefined);
const DEG = Math.PI / 180;

// How much each outer region claims this point (sums to 1), with ragged borders between them.
export function regionWeights(x, z) {
  const bearing = Math.atan2(x, -z) + fbm(borders, x * 0.004, z * 0.004, 2) * 0.45;
  let total = 0;
  const w = OUTER.map(([key, r]) => {
    const c = Math.max(0, Math.cos(bearing - r.bearing * DEG)) ** 16;
    total += c;
    return [key, c];
  });
  for (const e of w) e[1] /= total || 1;
  return w;
}

// How far out of the Vale this point is: 0 inside, 1 fully in an outer region.
const outness = (x, z) => smoothstep(VALE_RADIUS, VALE_RADIUS + 80, Math.hypot(x, z));

export function regionAt(x, z) {
  if (outness(x, z) < 0.5) return 'vale';
  let best = 'vale', bw = -1;
  for (const [key, w] of regionWeights(x, z)) if (w > bw) { bw = w; best = key; }
  return best;
}

// ---------------------------------------------------------------- the height field
// Heights are computed once on a 2 m grid and interpolated exactly like the mesh's triangles, so gameplay
// reads the same ground the player sees, cheaply.
const GRID = 2;
const HALF = WORLD_SIZE / 2;
const N = WORLD_SIZE / GRID + 1;
let heights = null, roadDist = null;

// Distance to the nearest road, capped at ROAD_CAP, rasterised segment by segment.
const ROAD_CAP = 50;
function buildRoadField() {
  roadDist = new Float32Array(N * N).fill(ROAD_CAP);
  for (const line of ROADS) {
    for (let s = 0; s < line.length - 1; s++) {
      const [ax, az] = line[s], [bx, bz] = line[s + 1];
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - ROAD_CAP + HALF) / GRID));
      const i1 = Math.min(N - 1, Math.ceil((Math.max(ax, bx) + ROAD_CAP + HALF) / GRID));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - ROAD_CAP + HALF) / GRID));
      const j1 = Math.min(N - 1, Math.ceil((Math.max(az, bz) + ROAD_CAP + HALF) / GRID));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const d = segmentDistance(i * GRID - HALF, j * GRID - HALF, ax, az, bx, bz);
          const k = j * N + i;
          if (d < roadDist[k]) roadDist[k] = d;
        }
      }
    }
  }
}

function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

// The natural lie of the land, before towns, lakes and landmarks are carved into it.
function naturalHeight(x, z, road) {
  const d = Math.hypot(x, z);
  // The Vale: a flat meadow in the middle, rolling hills around it.
  const field = smoothstep(32, 120, d);
  let h = fbm(hills, x * 0.0085, z * 0.0085, 4) * 22 * field;
  h += fbm(detail, x * 0.045, z * 0.045, 2) * 0.6;

  // Beyond it, each region's own country.
  const out = outness(x, z);
  if (out > 0) {
    let amp = 0, lift = 0, rocky = 0;
    for (const [key, w] of regionWeights(x, z)) {
      const r = REGIONS[key];
      amp += (r.hills ?? 10) * w;
      lift += (r.lift ?? 0) * w;
      if (r.rocky) rocky += w;
    }
    let hr = fbm(far, x * 0.006, z * 0.006, 4) * amp + lift + fbm(detail, x * 0.045, z * 0.045, 2) * 0.8;
    if (rocky > 0) hr += (1 - Math.abs(fbm(ridges, x * 0.012, z * 0.012, 3))) ** 3 * 22 * rocky;
    h = lerp(h, hr, out);
  }

  // A rim of hills around the Vale, broken by passes where the roads cross.
  const rim = smoothstep(145, 195, d) * (1 - smoothstep(215, 290, d));
  const pass = smoothstep(10, 45, road);
  h += rim * (20 + fbm(ridges, x * 0.03, z * 0.03, 3) * 14) * (0.15 + 0.85 * pass);

  // Mountains at the edge of the world.
  h += smoothstep(570, 660, d) * (45 + fbm(ridges, x * 0.02, z * 0.02, 3) * 25);
  return h;
}

// Places levelled flat into the land: towns, cave mouths, dungeon doors and ruins.
const FLATS = [
  ...TOWNS.map((t) => ({ x: t.x, z: t.z, inner: t.r - 2, outer: t.r + 18 })),
  ...CAVES.map((c) => ({ x: c.x, z: c.z, inner: 6, outer: 16 })),
  ...DUNGEONS.map((c) => ({ x: c.x, z: c.z, inner: 8, outer: 20 })),
  ...SITES.filter((s) => s.kind === 'ruin').map((s) => ({ x: s.x, z: s.z, inner: s.size, outer: s.size + 14 })),
];

function shapedHeight(x, z, road) {
  let h = naturalHeight(x, z, road);
  for (const f of FLATS) {
    const df = Math.hypot(x - f.x, z - f.z);
    if (df < f.outer) h = lerp(h, f.y, 1 - smoothstep(f.inner, f.outer, df));
  }
  // Flat-topped hill for the standing stones.
  const s = LANDMARKS.stones;
  h = lerp(h, 14, 1 - smoothstep(9, 46, Math.hypot(x - s.x, z - s.z)));
  // Emberfall Peak: a steep cone with a flat top where the dragon roosts.
  for (const p of SITES) {
    if (p.kind !== 'peak') continue;
    const dp = Math.hypot(x - p.x, z - p.z);
    const cone = p.height * (1 - smoothstep(p.r, p.r + 95, dp)) + fbm(ridges, x * 0.05, z * 0.05, 2) * 3 * smoothstep(p.r, p.r + 20, dp);
    h = Math.max(h, cone);
  }
  // Lakes: a basin below the water level, with a raised rim so the shore never floats over lower ground.
  for (const l of LAKES) {
    const dl = Math.hypot(x - l.x, z - l.z);
    if (dl > l.r * 2.2) continue;
    h = lerp(h, Math.max(h, l.level + 1.2), 1 - smoothstep(l.r * 1.3, l.r * 2.2, dl));
    h = lerp(h, l.level - 2.2, 1 - smoothstep(l.r * 0.3, l.r * 1.3, dl));
  }
  return h;
}

function buildHeights() {
  buildRoadField();
  for (const f of FLATS) f.y = naturalHeight(f.x, f.z, sampleGrid(roadDist, f.x, f.z));
  heights = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const z = j * GRID - HALF;
    for (let i = 0; i < N; i++) heights[j * N + i] = shapedHeight(i * GRID - HALF, z, roadDist[j * N + i]);
  }
}

function sampleGrid(grid, x, z) {
  const fx = Math.min(Math.max((x + HALF) / GRID, 0), N - 1.001), fz = Math.min(Math.max((z + HALF) / GRID, 0), N - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const k = j * N + i;
  // Same split as the mesh: each cell is two triangles divided along the (i+1, j) -> (i, j+1) diagonal.
  if (u + v <= 1) return grid[k] + u * (grid[k + 1] - grid[k]) + v * (grid[k + N] - grid[k]);
  return grid[k + N + 1] + (1 - u) * (grid[k + N] - grid[k + N + 1]) + (1 - v) * (grid[k + 1] - grid[k + N + 1]);
}

export function heightAt(x, z) {
  if (!heights) buildHeights();
  return sampleGrid(heights, x, z);
}

export function pathDistance(x, z) {
  if (!heights) buildHeights();
  return sampleGrid(roadDist, x, z);
}

export function lakeAt(x, z) {
  for (const l of LAKES) if (Math.hypot(x - l.x, z - l.z) < l.r * 1.4) return l;
  return null;
}
export const isPond = (x, z) => !!lakeAt(x, z);

// True where a lake's water is deeper than `margin` below this point's ground (negative margin = shoreline).
export function isWater(x, z, margin = 0) {
  const l = lakeAt(x, z);
  return !!l && heightAt(x, z) < l.level + margin;
}

// ---------------------------------------------------------------- colours
const C = (hex) => new THREE.Color(hex);
const ROCK = C(0x77736b), SAND = C(0xb9a77a), SNOW = C(0xe6ebee), DIRT = C(0x6b5638);
const PATH = C(0x8a7050), COBBLE = C(0x8d8274), EMBER = C(0x5a4038);
const regionColours = Object.fromEntries(Object.entries(REGIONS).map(([k, r]) => [k, { a: C(r.grass[0]), b: C(r.grass[1]), dry: C(r.dry) }]));
const tmpA = new THREE.Color(), tmpB = new THREE.Color(), tmpDry = new THREE.Color();
const sumA = new THREE.Color(), sumB = new THREE.Color(), sumDry = new THREE.Color();
const addScaled = (sum, c, w) => { sum.r += c.r * w; sum.g += c.g * w; sum.b += c.b * w; };

// The ground colour at a point. `ny` is the up component of the surface normal (1 = flat).
export function groundColor(x, z, y, ny, out = new THREE.Color()) {
  const vale = regionColours.vale;
  tmpA.copy(vale.a); tmpB.copy(vale.b); tmpDry.copy(vale.dry);
  const o = outness(x, z);
  let snowLine = 38;
  if (o > 0) {
    sumA.setRGB(0, 0, 0); sumB.setRGB(0, 0, 0); sumDry.setRGB(0, 0, 0);
    let sl = 0;
    for (const [key, w] of regionWeights(x, z)) {
      if (w < 0.01) continue;
      const rc = regionColours[key];
      addScaled(sumA, rc.a, w); addScaled(sumB, rc.b, w); addScaled(sumDry, rc.dry, w);
      sl += (REGIONS[key].snowLine ?? 38) * w;
    }
    tmpA.lerp(sumA, o); tmpB.lerp(sumB, o); tmpDry.lerp(sumDry, o);
    snowLine = lerp(38, sl, o);
  }
  out.copy(tmpA).lerp(tmpB, fbm(detail, x * 0.05, z * 0.05, 2) * 0.5 + 0.5);
  out.lerp(tmpDry, smoothstep(0.55, 0.9, fbm(hills, x * 0.02 + 50, z * 0.02, 2) * 0.5 + 0.5) * 0.6);
  const lake = lakeAt(x, z);
  if (lake) out.lerp(SAND, smoothstep(lake.level + 0.9, lake.level + 0.1, y));
  out.lerp(ROCK, smoothstep(0.86, 0.7, ny));
  out.lerp(SNOW, smoothstep(snowLine, snowLine + 8, y) * smoothstep(0.62, 0.85, ny));
  const { camp, stones } = LANDMARKS;
  out.lerp(DIRT, (1 - smoothstep(2.5, 5, Math.hypot(x - camp.x, z - camp.z))) * 0.8);
  out.lerp(DIRT, (1 - smoothstep(6, 10, Math.hypot(x - stones.x, z - stones.z))) * 0.35);
  for (const p of SITES) if (p.kind === 'peak') out.lerp(EMBER, (1 - smoothstep(p.r, p.r + 12, Math.hypot(x - p.x, z - p.z))) * 0.8);
  out.lerp(PATH, (1 - smoothstep(0.9, 2.0, pathDistance(x, z))) * 0.85);
  for (const t of TOWNS) {
    const dt = Math.hypot(x - t.x, z - t.z);
    if (dt < 15) out.lerp(COBBLE, 1 - smoothstep(11, 14, dt));
  }
  return out;
}

// ---------------------------------------------------------------- the mesh
// The ground is cut into square chunks so off-screen parts can be skipped and far ones hidden.
export const TERRAIN_CHUNK = 100;
const CELLS = TERRAIN_CHUNK / GRID;

function terrainMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // Break up the flat vertex colours with a little world-space noise, so the ground reads as grass and earth
  // rather than painted plastic.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGroundPos;
        float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 gp = vGroundPos.xz;
        float g = gNoise(gp * 0.12) * 0.5 + gNoise(gp * 0.7) * 0.3 + gNoise(gp * 2.9) * 0.2;
        diffuseColor.rgb *= 0.84 + g * 0.3;`);
  };
  return mat;
}

function buildChunk(ci, cj, material) {
  const V = CELLS + 1;
  const pos = new Float32Array(V * V * 3), nrm = new Float32Array(V * V * 3), col = new Float32Array(V * V * 3);
  const i0 = ci * CELLS, j0 = cj * CELLS;
  const c = new THREE.Color();
  const h = (i, j) => heights[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  for (let b = 0; b < V; b++) {
    for (let a = 0; a < V; a++) {
      const i = i0 + a, j = j0 + b, k = (b * V + a) * 3;
      const x = i * GRID - HALF, z = j * GRID - HALF, y = h(i, j);
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      // Smooth normals from the height field, so chunk edges match.
      const nx = h(i - 1, j) - h(i + 1, j), nz = h(i, j - 1) - h(i, j + 1), ny = 2 * GRID;
      const l = Math.hypot(nx, ny, nz);
      nrm[k] = nx / l; nrm[k + 1] = ny / l; nrm[k + 2] = nz / l;
      groundColor(x, z, y, ny / l, c);
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
  }
  const index = [];
  for (let b = 0; b < CELLS; b++) {
    for (let a = 0; a < CELLS; a++) {
      const v00 = b * V + a, v10 = v00 + 1, v01 = v00 + V, v11 = v01 + 1;
      index.push(v00, v01, v10, v10, v01, v11);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

// The whole ground, as a group of chunk meshes. Chunks near the player are built first; the rest follow a
// few per frame (see update), and far ones are hidden.
export class TerrainMesh {
  constructor(scene, focus = { x: 0, z: 0 }) {
    if (!heights) buildHeights();
    this.group = new THREE.Group();
    this.material = terrainMaterial();
    this.count = WORLD_SIZE / TERRAIN_CHUNK;
    this.chunks = new Map();
    scene.add(this.group);
    this.update(focus, Infinity, 200);
  }

  chunkCentre(ci, cj) {
    return { x: (ci + 0.5) * TERRAIN_CHUNK - HALF, z: (cj + 0.5) * TERRAIN_CHUNK - HALF };
  }

  // Build missing chunks within `buildRadius` (at most `budget` this call) and show only those in view range.
  update(focus, budget = 2, buildRadius = 440, showRadius = 400) {
    const todo = [];
    const half = TERRAIN_CHUNK / 2;
    for (let cj = 0; cj < this.count; cj++) {
      for (let ci = 0; ci < this.count; ci++) {
        const c = this.chunkCentre(ci, cj);
        // Distance to the nearest point of the chunk.
        const d = Math.hypot(Math.max(Math.abs(c.x - focus.x) - half, 0), Math.max(Math.abs(c.z - focus.z) - half, 0));
        const key = cj * this.count + ci;
        const chunk = this.chunks.get(key);
        if (chunk) chunk.visible = d < showRadius;
        else if (d < buildRadius) todo.push({ ci, cj, d, key });
      }
    }
    todo.sort((a, b) => a.d - b.d);
    for (const t of todo.slice(0, budget)) {
      const mesh = buildChunk(t.ci, t.cj, this.material);
      this.chunks.set(t.key, mesh);
      this.group.add(mesh);
    }
  }
}

export function createWaters() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2f6f96, transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.2,
  });
  return LAKES.map((l) => {
    const geo = new THREE.CircleGeometry(l.r * 1.4, Math.min(96, 24 + Math.round(l.r))).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(l.x, l.level, l.z);
    mesh.receiveShadow = true;
    return mesh;
  });
}
