import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.js';
import { smoothstep } from '../engine/math.js';
import { heightAt, isWater, pathDistance, WORLD_RADIUS } from './Terrain.js';
import { Assets } from '../engine/Assets.js';

const slopeAt = (x, z) =>
  Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;

function instanced(geometry, material, count, { cast = true, receive = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1));
  mesh.count = count;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function grassTuftGeometry(rng) {
  const positions = [], colors = [], normals = [];
  const bottom = [0.16, 0.3, 0.09], top = [0.58, 0.8, 0.33];
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI * 2 + rng() * 0.8;
    const w = 0.05, h = 0.42 + rng() * 0.35, lean = 0.08 + rng() * 0.12;
    const ca = Math.cos(a), sa = Math.sin(a);
    const pts = [[-w, 0, 0], [w, 0, 0], [0, h, lean]];
    for (const [x, y, z] of pts) {
      positions.push(x * ca + z * sa, y, -x * sa + z * ca);
      colors.push(...(y > 0 ? top : bottom));
      normals.push(0, 1, 0); // up-facing normals read as soft, sunlit grass
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

// The kit's bushes share the twisted tree's autumn-red leaves; in a green meadow they read better green.
let greenLeaves = null;
function bushLeaves(model, material) {
  if (!model.startsWith('Bush') || material.name !== 'Leaves_TwistedTree') return material;
  if (!greenLeaves) {
    const src = Assets.meshParts('nature/CommonTree_1').find((p) => /Leaves/.test(p.material.name));
    greenLeaves = material.clone();
    greenLeaves.map = src?.material.map ?? material.map;
  }
  return greenLeaves;
}

// Place many copies of kit models cheaply: one InstancedMesh per (model part, map chunk). Chunking lets
// the renderer skip trees that are off-screen (and outside the shadow camera) instead of drawing all of them.
const CHUNK = 110;
function scatter(scene, items, { cast }) {
  const groups = new Map();
  for (const it of items) {
    const key = `${it.model}|${Math.floor(it.x / CHUNK)},${Math.floor(it.z / CHUNK)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const dummy = new THREE.Object3D();
  for (const [key, list] of groups) {
    const model = key.split('|')[0];
    if (!Assets.has(`nature/${model}`)) continue;
    for (const { geometry, material } of Assets.meshParts(`nature/${model}`)) {
      const mesh = instanced(geometry, bushLeaves(model, material), list.length, { cast, receive: true });
      list.forEach((it, i) => {
        dummy.position.set(it.x, it.y, it.z);
        dummy.rotation.set(0, it.r, 0);
        dummy.scale.setScalar(it.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
  }
}

// Trees, rocks, undergrowth, grass and flowers, all instanced so thousands of them cost only a few draw calls.
export class Vegetation {
  constructor(scene, colliders, avoid, landmarkOak) {
    this.uniforms = { uTime: { value: 0 } };
    this.treePoints = [];
    const rng = mulberry32(2024);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const blocked = (x, z, pad = 0) => avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + pad);

    // ---- Trees: Quaternius nature kit models, scattered and instanced ----
    const trees = [];
    trees.push({ x: landmarkOak.x, z: landmarkOak.z, model: 'CommonTree_2', s: 1.35, r: 0.4 });
    for (let i = 0; i < 2600; i++) {
      const x = (rng() * 2 - 1) * WORLD_RADIUS, z = (rng() * 2 - 1) * WORLD_RADIUS;
      const d = Math.hypot(x, z);
      if (d > WORLD_RADIUS + 12 || d < 22) continue;
      const density = 0.025 + smoothstep(70, 120, d) * 0.5 - smoothstep(165, 205, d) * 0.4;
      if (rng() > density) continue;
      if (isWater(x, z, 0.5) || slopeAt(x, z) > 0.9 || blocked(x, z, 3) || pathDistance(x, z) < 4) continue;
      // Broadleaf trees in the meadow, pines in the woods, a few gnarled and dead ones in the high hills.
      const roll = rng();
      let model, s;
      if (d > 150 && roll < 0.12) { model = `DeadTree_${1 + Math.floor(rng() * 2)}`; s = 0.5 + rng() * 0.15; }
      else if (d > 110 && roll < 0.16) { model = `TwistedTree_${1 + Math.floor(rng() * 2)}`; s = 0.45 + rng() * 0.12; }
      else if (d > 95 && roll < 0.8) { model = `Pine_${1 + Math.floor(rng() * 5)}`; s = 0.8 + rng() * 0.45; }
      else { model = `CommonTree_${1 + Math.floor(rng() * 5)}`; s = 0.7 + rng() * 0.4; }
      trees.push({ x, z, model, s, r: rng() * Math.PI * 2 });
    }
    for (const t of trees) {
      t.y = heightAt(t.x, t.z) - 0.15;
      colliders.push({ x: t.x, z: t.z, r: (t.model.startsWith('Twisted') ? 0.9 : 0.45) * Math.max(1, t.s) });
      this.treePoints.push({ x: t.x, z: t.z, s: t.s * 1.2 });
    }
    scatter(scene, trees, { cast: true });
    this.swayLeaves(trees);

    // ---- Rocks ----
    const rocks = [];
    for (let i = 0; i < 700; i++) {
      const x = (rng() * 2 - 1) * WORLD_RADIUS, z = (rng() * 2 - 1) * WORLD_RADIUS;
      const d = Math.hypot(x, z);
      if (d < 14 || d > WORLD_RADIUS + 15) continue;
      const density = 0.07 + smoothstep(80, 130, d) * 0.12 + smoothstep(145, 180, d) * 0.4;
      if (rng() > density || blocked(x, z, 2) || isWater(x, z, 0.2) || pathDistance(x, z) < 2.5) continue;
      const s = (0.2 + rng() * 0.55) * (d > 150 ? 1.8 : 1);
      rocks.push({ x, z, y: heightAt(x, z) - s * 0.3, s, r: rng() * Math.PI * 2, model: `Rock_Medium_${1 + Math.floor(rng() * 3)}` });
      if (s > 0.3) colliders.push({ x, z, r: s * 1.4 });
    }
    scatter(scene, rocks, { cast: true });

    // ---- Undergrowth: bushes, ferns, flower clumps, mushrooms and pebbles ----
    const small = [];
    const kinds = [
      ['Bush_Common', 0.55, 0.3], ['Bush_Common_Flowers', 0.55, 0.3], ['Fern_1', 0.12, 0.05],
      ['Flower_3_Group', 0.35, 0.15], ['Flower_4_Group', 0.3, 0.15], ['Mushroom_Common', 0.7, 0.3],
      ['Plant_1', 0.7, 0.3], ['Pebble_Round_1', 1.2, 0.5], ['Pebble_Round_3', 1.2, 0.5],
    ];
    for (let i = 0; i < 2200; i++) {
      const a = rng() * Math.PI * 2, r = 12 + Math.sqrt(rng()) * 170;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (isWater(x, z, 0.3) || slopeAt(x, z) > 0.8 || pathDistance(x, z) < 1.6 || blocked(x, z, 1)) continue;
      // Ferns and mushrooms like the woods; flowers like the open meadow.
      const [model, base, jitter] = kinds[Math.floor(rng() * kinds.length)];
      if ((model.startsWith('Fern') || model.startsWith('Mushroom')) && r < 90 && rng() < 0.7) continue;
      if (model.startsWith('Flower') && r > 120 && rng() < 0.7) continue;
      small.push({ x, z, y: heightAt(x, z) - 0.05, s: base + rng() * jitter, r: rng() * Math.PI * 2, model });
    }
    scatter(scene, small, { cast: false });

    // ---- Grass (wind-animated in the vertex shader) ----
    const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float sway = sin(uTime * 1.7 + iPos.x * 0.35 + iPos.z * 0.22) * 0.6 + sin(uTime * 3.3 + iPos.x * 0.9) * 0.25;
        transformed.x += sway * 0.2 * position.y;
        transformed.z += sway * 0.09 * position.y;`
      );
    };
    const grassSpots = [];
    for (let i = 0; i < 30000; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 110;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = heightAt(x, z);
      if (isWater(x, z, 0.25) || slopeAt(x, z) > 0.8 || pathDistance(x, z) < 1.2) continue;
      if (avoid.some((av) => av.grass && Math.hypot(x - av.x, z - av.z) < av.grass)) continue;
      grassSpots.push({ x, y, z });
    }
    const grass = instanced(grassTuftGeometry(rng), grassMat, grassSpots.length, { cast: false });
    grassSpots.forEach((g, i) => {
      const s = 0.7 + rng() * 0.8;
      dummy.position.set(g.x, g.y - 0.03, g.z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.8 + rng() * 0.5), s);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      grass.setColorAt(i, color.setRGB(0.85 + rng() * 0.3, 0.85 + rng() * 0.25, 0.75 + rng() * 0.2));
    });
    scene.add(grass);

    // ---- Wildflowers ----
    const palette = [0xf4f1e6, 0xf2d64b, 0xb89be6, 0xf0a0b8];
    const flowerSpots = [];
    for (let i = 0; i < 1400; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 90;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = heightAt(x, z);
      if (isWater(x, z, 0.4) || pathDistance(x, z) < 1.5) continue;
      if (avoid.some((av) => av.grass && Math.hypot(x - av.x, z - av.z) < av.grass)) continue;
      flowerSpots.push({ x, y, z });
    }
    const flowers = instanced(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshLambertMaterial(), flowerSpots.length, { cast: false });
    flowerSpots.forEach((f, i) => {
      dummy.position.set(f.x, f.y + 0.28 + rng() * 0.2, f.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.8 + rng() * 0.6);
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
      flowers.setColorAt(i, color.setHex(palette[Math.floor(rng() * palette.length)]));
    });
    scene.add(flowers);
  }

  // A gentle sway in the leaves, done in the vertex shader of the kit's leaf materials.
  swayLeaves(trees) {
    const done = new Set();
    for (const model of new Set(trees.map((t) => t.model))) {
      if (!Assets.has(`nature/${model}`)) continue;
      for (const { material } of Assets.meshParts(`nature/${model}`)) {
        if (done.has(material) || !/Leaves|Leaf/i.test(material.name)) continue;
        done.add(material);
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = this.uniforms.uTime;
          shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            #ifdef USE_INSTANCING
              vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            #else
              vec3 iPos = vec3(0.0);
            #endif
            float sway = sin(uTime * 1.3 + iPos.x * 0.21 + iPos.z * 0.17) * 0.04 * max(position.y - 2.0, 0.0);
            transformed.x += sway;
            transformed.z += sway * 0.6;`
          );
        };
        material.needsUpdate = true;
      }
    }
  }

  update(t) {
    this.uniforms.uTime.value = t;
  }
}
