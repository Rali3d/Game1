import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.js';
import { smoothstep } from '../engine/math.js';
import { heightAt, isWater, pathDistance, WORLD_RADIUS } from './Terrain.js';

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

// Trees, rocks, grass and flowers, all instanced so thousands of them cost only a few draw calls.
export class Vegetation {
  constructor(scene, colliders, avoid, landmarkOak) {
    this.uniforms = { uTime: { value: 0 } };
    this.treePoints = [];
    const rng = mulberry32(2024);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const blocked = (x, z, pad = 0) => avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + pad);

    // ---- Trees ----
    const pines = [], oaks = [];
    oaks.push({ x: landmarkOak.x, z: landmarkOak.z, y: heightAt(landmarkOak.x, landmarkOak.z), s: 1.9, r: 0.4 });
    for (let i = 0; i < 2600; i++) {
      const x = (rng() * 2 - 1) * WORLD_RADIUS, z = (rng() * 2 - 1) * WORLD_RADIUS;
      const d = Math.hypot(x, z);
      if (d > WORLD_RADIUS + 12 || d < 22) continue;
      const density = 0.025 + smoothstep(70, 120, d) * 0.55 - smoothstep(165, 205, d) * 0.4;
      if (rng() > density) continue;
      const y = heightAt(x, z);
      if (isWater(x, z, 0.5) || slopeAt(x, z) > 0.9 || blocked(x, z, 3) || pathDistance(x, z) < 4) continue;
      const tree = { x, y, z, s: 0.8 + rng() * 0.8, r: rng() * Math.PI * 2 };
      (d > 95 && rng() < 0.75 ? pines : oaks).push(tree);
    }

    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.27, 2.4, 6).translate(0, 1.2, 0);
    const coneGeo = new THREE.ConeGeometry(1.5, 2.6, 7).translate(0, 1.3, 0);
    const blobGeo = new THREE.IcosahedronGeometry(1.6, 1);
    const flatMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });

    const trunks = instanced(trunkGeo, flatMat(), pines.length + oaks.length);
    const cones = instanced(coneGeo, flatMat(), pines.length * 3);
    const blobs = instanced(blobGeo, flatMat(), oaks.length * 2);
    let ti = 0, ci = 0, bi = 0;
    const place = (mesh, idx, x, y, z, sx, sy, sz, ry) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
    };

    for (const t of [...pines, ...oaks]) {
      place(trunks, ti, t.x, t.y - 0.1, t.z, t.s, t.s, t.s, t.r);
      trunks.setColorAt(ti++, color.setHSL(0.07, 0.35, 0.2 + rng() * 0.08));
      colliders.push({ x: t.x, z: t.z, r: 0.42 * t.s });
      this.treePoints.push(t);
    }
    for (const t of pines) {
      const layers = [[1.3, 1], [2.5, 0.78], [3.5, 0.55]];
      color.setHSL(0.33 + rng() * 0.05, 0.42, 0.2 + rng() * 0.08);
      for (const [ly, ls] of layers) {
        place(cones, ci, t.x, t.y + ly * t.s, t.z, t.s * ls, t.s * ls, t.s * ls, t.r);
        cones.setColorAt(ci++, color);
      }
    }
    for (const t of oaks) {
      color.setHSL(0.24 + rng() * 0.06, 0.5, 0.28 + rng() * 0.1);
      place(blobs, bi, t.x, t.y + 3.4 * t.s, t.z, 1.25 * t.s, t.s, 1.25 * t.s, t.r);
      blobs.setColorAt(bi++, color);
      const ox = Math.cos(t.r) * 0.8 * t.s, oz = Math.sin(t.r) * 0.8 * t.s;
      place(blobs, bi, t.x + ox, t.y + 2.8 * t.s, t.z + oz, 0.8 * t.s, 0.75 * t.s, 0.8 * t.s, t.r + 1);
      blobs.setColorAt(bi++, color.offsetHSL(0, 0, 0.04));
    }
    scene.add(trunks, cones, blobs);

    // ---- Rocks ----
    const rocks = [];
    for (let i = 0; i < 700; i++) {
      const x = (rng() * 2 - 1) * WORLD_RADIUS, z = (rng() * 2 - 1) * WORLD_RADIUS;
      const d = Math.hypot(x, z);
      if (d < 14 || d > WORLD_RADIUS + 15) continue;
      const density = 0.07 + smoothstep(80, 130, d) * 0.12 + smoothstep(145, 180, d) * 0.4;
      if (rng() > density || blocked(x, z, 2) || isWater(x, z, 0.2) || pathDistance(x, z) < 2.5) continue;
      const s = (0.3 + rng() * 1.3) * (d > 150 ? 1.8 : 1);
      rocks.push({ x, z, s });
    }
    const rockMesh = instanced(new THREE.DodecahedronGeometry(1, 0), flatMat(), rocks.length);
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, heightAt(r.x, r.z) - r.s * 0.25, r.z);
      dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      dummy.scale.set(r.s * (0.8 + rng() * 0.5), r.s * (0.5 + rng() * 0.4), r.s * (0.8 + rng() * 0.5));
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
      rockMesh.setColorAt(i, color.setHSL(0.08, 0.05, 0.36 + rng() * 0.16));
      if (r.s > 0.55) colliders.push({ x: r.x, z: r.z, r: r.s * 0.9 });
    });
    scene.add(rockMesh);

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

  update(t) {
    this.uniforms.uTime.value = t;
  }
}
