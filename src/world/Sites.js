import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.js';
import { Assets } from '../engine/Assets.js';
import { heightAt } from './Terrain.js';
import { mergeByMaterial } from './merge.js';
import { glowSprite } from './Props.js';

// Places outside the towns: ruined keeps and shrines (Modular Ruins kit), dungeon doors (Modular Dungeon kit),
// and the dragon's roost on Emberfall Peak.

function piece(group, key, x, z, ry, baseY, s = 1) {
  if (!Assets.has(key)) return null;
  const m = Assets.clone(key);
  m.position.set(x, heightAt(x, z) - baseY, z);
  m.rotation.y = ry;
  m.scale.multiplyScalar(s);
  group.add(m);
  return m;
}

const WALLS = ['ruins/Wall', 'ruins/Wall_Broken', 'ruins/Wall_Broken', 'ruins/Wall_Overgrown', 'ruins/Wall_Half', null, null];
const CLUTTER = ['ruins/Pot1', 'ruins/Pot2', 'ruins/Pot1_Broken', 'ruins/Bricks', 'ruins/Brick', 'ruins/Skull', 'ruins/Candles_1'];

// A roofless ruin: a broken rectangle of walls on a cracked floor, with an archway, columns and clutter.
// Returns the mesh, its colliders, and where the treasure chest sits (world coordinates).
export function createRuin(scene, colliders, site) {
  const rng = mulberry32(site.seed * 977);
  const baseY = heightAt(site.x, site.z);
  const local = new THREE.Group(); // pieces placed in world x/z around the site, heights relative to baseY
  const ry = rng() * Math.PI * 2;
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const toWorld = (lx, lz) => ({ x: site.x + lx * cos + lz * sin, z: site.z - lx * sin + lz * cos });
  const cols = [];
  const W = Math.max(3, Math.floor(site.size / 3)), D = Math.max(3, Math.floor(site.size / 3.5));
  const hw = W, hd = D; // in metres: the floor spans [-W, W] x [-D, D] (2 m tiles)

  // Cracked floor, with tiles missing.
  for (let i = -W + 1; i < W; i += 2) {
    for (let j = -D + 1; j < D; j += 2) {
      if (rng() < 0.35) continue;
      const p = toWorld(i, j);
      piece(local, rng() < 0.7 ? 'ruins/Floor_Standard' : 'ruins/Floor_Squares', p.x, p.z, ry + Math.floor(rng() * 4) * Math.PI / 2, baseY - 0.1);
    }
  }
  // Walls around the edge, some fallen; an archway in the middle of the front.
  const edge = (fromX, fromZ, dx, dz, n, wallRy, front) => {
    for (let k = 0; k < n; k++) {
      const lx = fromX + dx * (k * 2 + 1), lz = fromZ + dz * (k * 2 + 1);
      const mid = front && k === Math.floor(n / 2);
      const p = toWorld(lx, lz);
      if (mid) {
        piece(local, rng() < 0.5 ? 'ruins/Arch_Gothic' : 'ruins/Wall_ArchRound_Overgrown_Broken', p.x, p.z, ry + wallRy, baseY, 0.66);
        for (const side of [-1.3, 1.3]) {
          const q = toWorld(lx + side * Math.abs(dx), lz + side * Math.abs(dz));
          cols.push({ ...q, r: 0.35 });
        }
        continue;
      }
      const key = WALLS[Math.floor(rng() * WALLS.length)];
      if (!key) continue;
      piece(local, key, p.x, p.z, ry + wallRy, baseY);
      cols.push({ ...p, hw: 1.0, hd: 0.25, rot: ry + wallRy });
    }
  };
  edge(-hw, -hd, 1, 0, W, 0, false); // back
  edge(-hw, hd, 1, 0, W, Math.PI, true); // front, with the arch
  edge(-hw, -hd, 0, 1, D, Math.PI / 2, false); // left
  edge(hw, -hd, 0, 1, D, -Math.PI / 2, false); // right
  // Columns at the corners.
  for (const [cx, cz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
    if (rng() < 0.3) continue;
    const p = toWorld(cx, cz);
    piece(local, rng() < 0.5 ? 'ruins/Column_Round' : 'ruins/Column_Round_Short', p.x, p.z, rng() * 6, baseY);
    cols.push({ ...p, r: 0.45 });
  }
  // A statue watching over the back of the hall.
  if (site.statue) {
    const p = toWorld(0, -hd + 1.6);
    piece(local, `ruins/${site.statue}`, p.x, p.z, ry, baseY, 0.8);
    cols.push({ ...p, r: 1.1 });
  }
  // Pots, bricks and bones.
  for (let n = 0; n < 6 + site.size / 2; n++) {
    const lx = (rng() * 2 - 1) * (hw - 0.8), lz = (rng() * 2 - 1) * (hd - 0.8);
    const p = toWorld(lx, lz);
    piece(local, CLUTTER[Math.floor(rng() * CLUTTER.length)], p.x, p.z, rng() * 6, baseY, 0.8);
  }
  const cart = toWorld(hw + 3, hd - 2);
  piece(local, 'ruins/Cart', cart.x, cart.z, ry + 0.4, baseY, 0.7);
  cols.push({ ...cart, r: 1.4 });

  const merged = mergeByMaterial(local);
  merged.position.y = baseY;
  scene.add(merged);
  colliders.push(...cols);
  const chest = toWorld(site.statue ? 1.8 : 0, -hd + 1.2);
  return { group: merged, chest: { ...chest, y: heightAt(chest.x, chest.z), ry }, centre: { x: site.x, z: site.z } };
}

// A stone doorway set into a grassy mound: the way down into a dungeon. Faces `ry`.
export function createDungeonDoor(scene, colliders, def) {
  const g = new THREE.Group();
  const y = heightAt(def.x, def.z);
  const ry = Math.atan2(-def.x, -def.z); // face the middle of the world
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(7, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x5a6a3e, roughness: 1, flatShading: true }),
  );
  mound.scale.set(1, 0.55, 1);
  mound.position.set(0, -0.5, -5.2);
  mound.receiveShadow = mound.castShadow = true;
  g.add(mound);
  const kitParts = new THREE.Group();
  const add = (key, x, yy, z, rot = 0, s = 1) => {
    if (!Assets.has(key)) return;
    const m = Assets.clone(key);
    m.position.set(x, yy, z);
    m.rotation.y = rot;
    m.scale.multiplyScalar(s);
    kitParts.add(m);
  };
  add('dungeon/Arch', 0, 0, 0);
  add('dungeon/Arch_Door', 0, 0, -0.35);
  for (const sx of [-3.05, 3.05]) {
    add('dungeon/Wall_Modular', sx, 1, 0);
    add('dungeon/Wall_Modular', sx, 3, 0);
  }
  add('dungeon/Skull', -1.5, 0, 1.2, 0.6, 0.6);
  const lights = [];
  for (const sx of [-2.2, 2.2]) {
    add('dungeon/Torch', sx, 2.2, 0.3);
    const glow = glowSprite(0xffa24a, 1.4, 0.8);
    glow.position.set(sx, 2.75, 0.55);
    g.add(glow);
    lights.push(glow);
  }
  g.add(mergeByMaterial(kitParts));
  g.position.set(def.x, y, def.z);
  g.rotation.y = ry;
  scene.add(g);
  const at = (lx, lz) => ({ x: def.x + lx * Math.cos(ry) + lz * Math.sin(ry), z: def.z - lx * Math.sin(ry) + lz * Math.cos(ry) });
  for (const [lx, lz, r] of [[-3.1, 0, 1.3], [3.1, 0, 1.3], [0, -5, 5.5], [-5.5, -3, 3], [5.5, -3, 3]]) colliders.push({ ...at(lx, lz), r });
  const front = at(0, 2.4);
  return {
    def, group: g, glows: lights,
    front: { ...front, y: heightAt(front.x, front.z), facing: ry },
    update(t) {
      lights.forEach((l, i) => l.scale.setScalar(1.3 + Math.sin(t * 8 + i * 2) * 0.12));
    },
  };
}

// The dragon's roost: a ring of scorched boulders and old bones on the flat top of Emberfall Peak.
export function createRoost(scene, colliders, site) {
  const g = new THREE.Group();
  const rng = mulberry32(99);
  const y = heightAt(site.x, site.z);
  const rock = new THREE.MeshStandardMaterial({ color: 0x3a2a26, roughness: 1, flatShading: true });
  const geo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.2, r = site.r - 2 + rng() * 3;
    if (Math.abs(((a - Math.PI * 1.25) % (Math.PI * 2))) < 0.35) continue; // a gap where the path arrives
    const m = new THREE.Mesh(geo, rock);
    const s = 1 + rng() * 1.4;
    m.position.set(Math.cos(a) * r, s * 0.5, Math.sin(a) * r);
    m.scale.set(s, s * (0.8 + rng() * 0.6), s);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    colliders.push({ x: site.x + m.position.x, z: site.z + m.position.z, r: s });
  }
  const bones = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const a = rng() * Math.PI * 2, r = 3 + rng() * (site.r - 8);
    if (!Assets.has('dungeon/Skull')) break;
    const s = Assets.clone('dungeon/Skull');
    s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    s.rotation.y = rng() * 6;
    s.scale.multiplyScalar(0.7 + rng() * 0.5);
    bones.add(s);
  }
  g.add(mergeByMaterial(bones));
  g.position.set(site.x, y, site.z);
  scene.add(g);
  return { group: g, centre: { x: site.x, y, z: site.z } };
}
