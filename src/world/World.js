import * as THREE from 'three';
import { createTerrainMesh, createWater, heightAt, isPond, isWater, LANDMARKS, WORLD_RADIUS, WATER_LEVEL } from './Terrain.js';
import { Sky } from './Sky.js';
import { Vegetation } from './Vegetation.js';
import { createCampfire, createStandingStones, getGlowTexture } from './Props.js';
import { createTown } from './Town.js';
import { createCaveMouth } from './Cave.js';
import { TOWNS, CAVES } from '../data/towns.js';

// Assembles the outdoor world and owns collision + safe-zone queries. It is the "outdoor space":
// interiors and caves offer the same groundAt / collide / clamp / inWater / isSafe / blocked methods.
export class World {
  constructor(scene) {
    this.scene = scene;
    this.id = 'world';
    this.outdoors = true;
    this.colliders = []; // circles { x, z, r } or rotated boxes { x, z, hw, hd, rot }
    this.animated = []; // anything with update(t, dt)
    const { spawn, camp, stones, oak, stump, hunterCamp } = LANDMARKS;
    this.safeZones = [{ x: camp.x, z: camp.z, r: 15 }, ...TOWNS.map((t) => ({ x: t.x, z: t.z, r: t.r + 6 }))];

    scene.add(createTerrainMesh(), createWater());
    this.sky = new Sky(scene);

    // Keep landmarks clear of trees; `grass` is the radius kept free of grass tufts.
    const avoid = [
      { ...spawn, r: 16 },
      { ...camp, r: 10, grass: 3.5 },
      { ...stones, r: 15, grass: 1.5 },
      { ...oak, r: 6 },
      ...TOWNS.map((t) => ({ x: t.x, z: t.z, r: t.r + 6, grass: 15 })),
      ...CAVES.map((c) => ({ x: c.x, z: c.z, r: 9, grass: 4 })),
      { ...stump, r: 4, grass: 1.5 },
      { ...hunterCamp, r: 6, grass: 2 },
    ];
    this.vegetation = new Vegetation(scene, this.colliders, avoid, oak);

    this.campfire = createCampfire(camp.x, camp.z);
    scene.add(this.campfire.group);
    this.colliders.push({ x: camp.x, z: camp.z, r: 0.95 });
    this.animated.push(this.campfire);

    this.towns = TOWNS.map((def) => createTown(scene, this.colliders, this.sky, def));
    this.animated.push(...this.towns);
    this.doors = this.towns.flatMap((t) => t.doors);

    // Cave mouths, turned to face down into the valley.
    this.caveMouths = CAVES.map((c) => {
      const mouth = createCaveMouth(!!c.locked);
      const ry = Math.atan2(-c.x, -c.z);
      mouth.position.set(c.x, heightAt(c.x, c.z), c.z);
      mouth.rotation.y = ry;
      scene.add(mouth);
      const at = (lx, lz) => ({ x: c.x + lx * Math.cos(ry) + lz * Math.sin(ry), z: c.z - lx * Math.sin(ry) + lz * Math.cos(ry) });
      for (const [lx, lz, r] of [[-3, -0.5, 1.9], [3, -0.5, 1.9], [0, -2.6, 3]]) this.colliders.push({ ...at(lx, lz), r });
      const front = at(0, 2.2);
      return { def: c, mesh: mouth, front: { ...front, y: heightAt(front.x, front.z), facing: ry } };
    });

    this.stones = createStandingStones(stones.x, stones.z);
    scene.add(this.stones.group);
    this.colliders.push(...this.stones.colliders);
    this.animated.push(this.stones);

    this.fireflies = this.createFireflies();
    scene.add(this.fireflies.points);
  }

  createFireflies() {
    const count = 140;
    const seeds = [];
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 70;
      seeds.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, p: Math.random() * 100 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.35, map: getGlowTexture(), color: 0xd8ff7a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return { points, seeds, positions };
  }

  add(obj) {
    this.animated.push(obj);
    return obj;
  }

  remove(obj) {
    this.animated = this.animated.filter((o) => o !== obj);
    obj.group?.removeFromParent();
  }

  // Push a circle of radius r out of every collider it overlaps.
  collide(pos, r) {
    for (const c of this.colliders) {
      if (c.hw !== undefined) {
        this.collideBox(pos, r, c);
        continue;
      }
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const min = r + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
  }

  collideBox(pos, r, c) {
    const cos = Math.cos(c.rot), sin = Math.sin(c.rot);
    const dx = pos.x - c.x, dz = pos.z - c.z;
    if (Math.abs(dx) > c.hw + c.hd + r || Math.abs(dz) > c.hw + c.hd + r) return; // cheap reject
    // Into the box's local frame (inverse of a rotation about y).
    const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
    const cx = Math.max(-c.hw, Math.min(c.hw, lx)), cz = Math.max(-c.hd, Math.min(c.hd, lz));
    let px = lx - cx, pz = lz - cz;
    const d = Math.hypot(px, pz);
    if (d >= r) return;
    if (d > 1e-6) {
      px = (px / d) * (r - d);
      pz = (pz / d) * (r - d);
    } else {
      // Centre is inside the box: leave through the nearest face.
      const ex = c.hw - Math.abs(lx), ez = c.hd - Math.abs(lz);
      if (ex < ez) { px = Math.sign(lx || 1) * (ex + r); pz = 0; } else { px = 0; pz = Math.sign(lz || 1) * (ez + r); }
    }
    pos.x += px * cos + pz * sin;
    pos.z += -px * sin + pz * cos;
  }

  isSafe(x, z, pad = 0) {
    return this.safeZones.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + pad);
  }

  townAt(x, z) {
    return TOWNS.find((t) => Math.hypot(x - t.x, z - t.z) < t.r) ?? null;
  }

  // ---- space interface ----
  groundAt(x, z) {
    const h = heightAt(x, z);
    return isPond(x, z) ? Math.max(h, WATER_LEVEL - 1.1) : h; // swim at the pond's surface
  }
  inWater(x, z) {
    return isWater(x, z, -0.6);
  }
  blocked(x, z) {
    return isWater(x, z, 0.1) || this.isSafe(x, z);
  }
  clamp(pos) {
    const d = Math.hypot(pos.x, pos.z);
    if (d > WORLD_RADIUS) {
      pos.x *= WORLD_RADIUS / d;
      pos.z *= WORLD_RADIUS / d;
    }
  }

  // Returns true when a new day begins.
  update(dt, t, focus, camera) {
    const newDay = this.sky.update(dt, focus, camera);
    this.vegetation.update(t);
    for (const a of this.animated) a.update(t, dt);

    const ff = this.fireflies;
    ff.points.material.opacity = 1 - this.sky.daylight;
    if (ff.points.material.opacity > 0.01) {
      ff.seeds.forEach((s, i) => {
        const x = s.x + Math.sin(t * 0.3 + s.p) * 2.5;
        const z = s.z + Math.cos(t * 0.25 + s.p * 1.3) * 2.5;
        ff.positions.set([x, heightAt(x, z) + 0.8 + Math.sin(t * 0.9 + s.p) * 0.6, z], i * 3);
      });
      ff.points.geometry.attributes.position.needsUpdate = true;
    }
    return newDay;
  }
}
