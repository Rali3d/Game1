import * as THREE from 'three';
import { createNoise2D, fbm } from '../engine/noise.js';
import { smoothstep, lerp } from '../engine/math.js';

export const WORLD_SIZE = 440;
export const WORLD_RADIUS = 188;
export const WATER_LEVEL = -1.0;

// -z is north. The player wakes at the centre of a flat meadow ringed by hills, woods and mountains.
export const LANDMARKS = {
  spawn: { x: 0, z: 4 },
  camp: { x: 24, z: -26 },
  pond: { x: 60, z: 40, r: 15 },
  stones: { x: -6, z: -124 },
  oak: { x: 41, z: -61 },
};

const hills = createNoise2D(1337);
const detail = createNoise2D(4242);
const ridges = createNoise2D(777);

// Height is a pure function of (x, z) so gameplay can query it without touching the mesh.
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const field = smoothstep(32, 120, d);
  let h = fbm(hills, x * 0.0085, z * 0.0085, 4) * 22 * field;
  h += fbm(detail, x * 0.045, z * 0.045, 2) * 0.6;
  h += smoothstep(150, 215, d) * (26 + fbm(ridges, x * 0.03, z * 0.03, 3) * 16);

  // Flat-topped hill for the standing stones.
  const s = LANDMARKS.stones;
  const ds = Math.hypot(x - s.x, z - s.z);
  h = lerp(h, 14, 1 - smoothstep(9, 46, ds));

  // Pond basin with a raised rim so the water edge never floats over lower ground.
  const p = LANDMARKS.pond;
  const dp = Math.hypot(x - p.x, z - p.z);
  if (dp < p.r * 2.2) h = lerp(h, Math.max(h, 0.2), 1 - smoothstep(p.r * 1.3, p.r * 2.2, dp));
  h = lerp(h, -3.2, 1 - smoothstep(p.r * 0.3, p.r * 1.3, dp));
  return h;
}

// Only the pond holds water; other low dips in the hills stay dry.
export function isPond(x, z) {
  const p = LANDMARKS.pond;
  return Math.hypot(x - p.x, z - p.z) < p.r * 1.4;
}

// True where the pond's water is deeper than `margin` below this point's ground (negative margin = shoreline).
export function isWater(x, z, margin = 0) {
  return isPond(x, z) && heightAt(x, z) < WATER_LEVEL + margin;
}

export function createTerrainMesh() {
  const seg = 220;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const grassA = new THREE.Color(0x4f8a34), grassB = new THREE.Color(0x7aa84a);
  const dry = new THREE.Color(0xa39f5a), rock = new THREE.Color(0x77736b);
  const sand = new THREE.Color(0xb9a77a), snow = new THREE.Color(0xe6ebee), dirt = new THREE.Color(0x6b5638);
  const { camp, stones } = LANDMARKS;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), n = nrm.getY(i);
    c.copy(grassA).lerp(grassB, fbm(detail, x * 0.05, z * 0.05, 2) * 0.5 + 0.5);
    c.lerp(dry, smoothstep(0.55, 0.9, fbm(hills, x * 0.02 + 50, z * 0.02, 2) * 0.5 + 0.5) * 0.6);
    if (isPond(x, z)) c.lerp(sand, smoothstep(WATER_LEVEL + 0.9, WATER_LEVEL + 0.1, y));
    c.lerp(rock, smoothstep(0.86, 0.7, n));
    c.lerp(snow, smoothstep(34, 44, y) * smoothstep(0.7, 0.85, n));
    c.lerp(dirt, (1 - smoothstep(2.5, 5, Math.hypot(x - camp.x, z - camp.z))) * 0.8);
    c.lerp(dirt, (1 - smoothstep(6, 10, Math.hypot(x - stones.x, z - stones.z))) * 0.35);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

export function createWater() {
  const { pond } = LANDMARKS;
  const geo = new THREE.CircleGeometry(pond.r * 1.4, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2f6f96, transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pond.x, WATER_LEVEL, pond.z);
  mesh.receiveShadow = true;
  return mesh;
}
