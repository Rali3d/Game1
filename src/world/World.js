import * as THREE from 'three';
import { createTerrainMesh, createWater, heightAt, LANDMARKS } from './Terrain.js';
import { Sky } from './Sky.js';
import { Vegetation } from './Vegetation.js';
import { createCampfire, createStandingStones, getGlowTexture } from './Props.js';

// Assembles the static world and owns collision + safe-zone queries.
export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // vertical cylinders: { x, z, r }
    this.animated = []; // anything with update(t, dt)
    const { spawn, camp, stones, oak } = LANDMARKS;
    this.safeZones = [{ x: camp.x, z: camp.z, r: 15 }];

    scene.add(createTerrainMesh(), createWater());
    this.sky = new Sky(scene);

    // Keep landmarks clear of trees; `grass` is the radius kept free of grass tufts.
    const avoid = [
      { ...spawn, r: 16 },
      { ...camp, r: 10, grass: 3.5 },
      { ...stones, r: 15, grass: 1.5 },
      { ...oak, r: 6 },
    ];
    this.vegetation = new Vegetation(scene, this.colliders, avoid, oak);

    this.campfire = createCampfire(camp.x, camp.z);
    scene.add(this.campfire.group);
    this.colliders.push({ x: camp.x, z: camp.z, r: 0.95 });
    this.animated.push(this.campfire);

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

  isSafe(x, z, pad = 0) {
    return this.safeZones.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + pad);
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
