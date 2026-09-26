import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.js';
import { smoothstep } from '../engine/math.js';
import { heightAt, isWater, lakeAt, pathDistance, regionAt, regionWeights, WORLD_RADIUS, TERRAIN_CHUNK } from './Terrain.js';
import { REGIONS, VALE_RADIUS } from '../data/world.js';
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

// The kit's bushes share the twisted tree's autumn-red leaves; in a green meadow they read better green.
let greenLeaves = null, oliveLeaves = null;
function bushLeaves(model, material) {
  if (material.name !== 'Leaves_TwistedTree') return material;
  // Twisted trees keep their shape but get dark olive leaves: gnarled marsh and forest trees, not autumn.
  if (model.includes('TwistedTree')) {
    if (!oliveLeaves) {
      const src = Assets.meshParts('nature/CommonTree_1').find((p) => /Leaves/.test(p.material.name));
      oliveLeaves = material.clone();
      oliveLeaves.map = src?.material.map ?? material.map;
      oliveLeaves.color = new THREE.Color(0x9aa070);
    }
    return oliveLeaves;
  }
  if (!model.includes('Bush_Common')) return material;
  if (!greenLeaves) {
    const src = Assets.meshParts('nature/CommonTree_1').find((p) => /Leaves/.test(p.material.name));
    greenLeaves = material.clone();
    greenLeaves.map = src?.material.map ?? material.map;
    // Low bushes sit in their own shade and read as black blobs; a little self-light keeps them green.
    greenLeaves.emissive = new THREE.Color(0x2a4a1a);
    greenLeaves.emissiveMap = greenLeaves.map;
  }
  return greenLeaves;
}

// Weighted pick from [[prefix, count, weight, scale], ...] -> a model key and a base scale.
function pickModel(list, rng) {
  let total = 0;
  for (const e of list) total += e[2];
  let roll = rng() * total;
  for (const [prefix, n, w, s] of list) {
    if ((roll -= w) <= 0) return { model: `${prefix}${1 + Math.floor(rng() * n)}`, s };
  }
  const [prefix, n, , s] = list[0];
  return { model: `${prefix}${1 + Math.floor(rng() * n)}`, s };
}

// A region picked at random in proportion to how much each claims the point, so borders mingle.
function regionRoll(x, z, rng) {
  const d = Math.hypot(x, z);
  const out = smoothstep(VALE_RADIUS, VALE_RADIUS + 80, d);
  if (rng() >= out) return 'vale';
  let roll = rng();
  for (const [key, w] of regionWeights(x, z)) if ((roll -= w) <= 0) return key;
  return 'vale';
}

// What grows underfoot in each region: [model, base scale, jitter].
const UNDERGROWTH = {
  vale: [['nature/Bush_Common', 0.55, 0.3], ['nature/Bush_Common_Flowers', 0.55, 0.3], ['nature/Fern_1', 0.12, 0.05],
    ['nature/Flower_3_Group', 0.35, 0.15], ['nature/Flower_4_Group', 0.3, 0.15], ['nature/Mushroom_Common', 0.7, 0.3],
    ['nature/Plant_1', 0.7, 0.3], ['nature/Pebble_Round_1', 1.2, 0.5], ['nature/Pebble_Round_3', 1.2, 0.5]],
  frost: [['nature/Fern_1', 0.12, 0.05], ['nature/Pebble_Round_2', 1.4, 0.6], ['nature/Pebble_Round_4', 1.4, 0.6], ['nature/Plant_7', 0.6, 0.2]],
  crags: [['nature/Pebble_Round_1', 1.6, 0.8], ['nature/Pebble_Round_5', 1.6, 0.8], ['nature/Plant_7', 0.6, 0.2]],
  amber: [['nature2/Bush_Large', 0.5, 0.2], ['nature2/Bush_Large_Flowers', 0.5, 0.2], ['nature2/Flower_1_Clump', 0.9, 0.3],
    ['nature2/Flower_3_Clump', 0.9, 0.3], ['nature/Mushroom_Common', 0.7, 0.3], ['nature/Fern_1', 0.12, 0.05]],
  lake: [['nature2/Flower_2_Clump', 0.9, 0.3], ['nature2/Flower_4_Clump', 0.9, 0.3], ['nature/Bush_Common', 0.55, 0.3], ['nature/Plant_1', 0.7, 0.3]],
  fen: [['nature/Plant_7', 0.9, 0.4], ['nature/Plant_1', 0.8, 0.3], ['nature/Mushroom_Common', 0.8, 0.3], ['nature/Fern_1', 0.14, 0.05]],
  blackroot: [['nature/Fern_1', 0.15, 0.06], ['nature/Mushroom_Common', 0.8, 0.3], ['nature/Plant_1', 0.7, 0.3]],
  sunder: [['nature/Plant_7', 0.7, 0.3], ['nature/Pebble_Round_3', 1.3, 0.5], ['nature2/Flower_5_Clump', 0.8, 0.3]],
  barrow: [['nature/Fern_1', 0.13, 0.05], ['nature/Pebble_Round_2', 1.3, 0.5], ['nature2/Flower_5_Clump', 0.8, 0.3]],
};
const VIEW = { tree: 110, rock: 230, small: 80 };
const GRASS_DENSITY = { vale: 1, frost: 0.35, crags: 0.3, amber: 0.8, lake: 1, fen: 1, blackroot: 0.45, sunder: 1, barrow: 0.75 };
const FLOWER_COLOURS = {
  vale: [0xf4f1e6, 0xf2d64b, 0xb89be6, 0xf0a0b8], amber: [0xf2b84b, 0xe8703a, 0xf4f1e6], lake: [0xf4f1e6, 0x9ab8f0, 0xf0a0b8],
  barrow: [0x9a6ab8, 0xb88ad0, 0x7a5a9a], sunder: [0xf2d64b, 0xe0c060],
};

// Trees, rocks and undergrowth across the whole land, instanced per (model, chunk) so thousands of them cost
// only a few draw calls, and far chunks can be hidden wholesale. Grass is a patch that follows the player.
export class Vegetation {
  constructor(scene, colliders, avoid, landmarkOak) {
    this.scene = scene;
    this.uniforms = { uTime: { value: 0 }, uFocus: { value: new THREE.Vector2() } };
    this.treePoints = [];
    this.avoid = avoid;
    this.chunks = new Map(); // chunk key -> { group, x, z, near }
    const rng = mulberry32(2024);
    const blocked = (x, z, pad = 0) => avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + pad);
    const R = WORLD_RADIUS + 20;

    // ---- Trees: jittered grid, density and species by region ----
    const trees = [{ x: landmarkOak.x, z: landmarkOak.z, model: 'nature/CommonTree_2', s: 1.35, r: 0.4 }];
    const STEP = 7;
    for (let gz = -R; gz < R; gz += STEP) {
      for (let gx = -R; gx < R; gx += STEP) {
        const x = gx + rng() * STEP, z = gz + rng() * STEP;
        const d = Math.hypot(x, z);
        if (d > R || d < 22) continue;
        const region = regionRoll(x, z, rng);
        let density, pick;
        if (region === 'vale') {
          density = 0.025 + smoothstep(70, 120, d) * 0.5 - smoothstep(165, 205, d) * 0.4;
          // Broadleaf trees in the meadow, pines in the woods, a few gnarled and dead ones on the rim.
          const roll = rng();
          if (d > 150 && roll < 0.12) pick = { model: `nature/DeadTree_${1 + Math.floor(rng() * 2)}`, s: 0.5 };
          else if (d > 110 && roll < 0.16) pick = { model: `nature/TwistedTree_${1 + Math.floor(rng() * 2)}`, s: 0.45 };
          else if (d > 95 && roll < 0.8) pick = { model: `nature/Pine_${1 + Math.floor(rng() * 5)}`, s: 0.8 };
          else pick = { model: `nature/CommonTree_${1 + Math.floor(rng() * 5)}`, s: 0.7 };
        } else {
          const r = REGIONS[region];
          // Trees grow in clumps and glades rather than evenly.
          const clump = 0.35 + Math.sin(x * 0.021 + Math.sin(z * 0.017) * 2) * Math.cos(z * 0.019 - x * 0.007) * 0.65;
          density = r.treeDensity * Math.max(0, clump) * 1.6;
          pick = pickModel(r.trees, rng);
        }
        if (d > WORLD_RADIUS - 10) density += 0.3; // the forest thickens at the foot of the mountains
        if (rng() > density * 0.5) continue;
        if (isWater(x, z, 0.8) || slopeAt(x, z) > 0.9 || blocked(x, z, 3) || pathDistance(x, z) < 4) continue;
        if (!Assets.has(pick.model)) continue;
        trees.push({ x, z, model: pick.model, s: pick.s * (0.85 + rng() * 0.45), r: rng() * Math.PI * 2 });
      }
    }
    for (const t of trees) {
      t.y = heightAt(t.x, t.z) - 0.15;
      colliders.push({ x: t.x, z: t.z, r: (t.model.includes('Twisted') ? 0.9 : 0.45) * Math.max(1, t.s) });
      this.treePoints.push({ x: t.x, z: t.z, s: t.s * 1.2 });
    }
    this.trees = trees;
    this.scatter(trees, { cast: true, tier: 'tree' });
    this.swayLeaves(trees);

    // ---- Rocks: more in the high country, the crags and the plains ----
    const rocks = [];
    for (let i = 0; i < 9000; i++) {
      const x = (rng() * 2 - 1) * R, z = (rng() * 2 - 1) * R;
      const d = Math.hypot(x, z);
      if (d < 14 || d > R) continue;
      const region = regionAt(x, z);
      let density = 0.07 + smoothstep(80, 130, d) * 0.12 + smoothstep(145, 180, d) * 0.3 * (1 - smoothstep(230, 280, d));
      if (region === 'crags' || region === 'frost') density += 0.3;
      if (region === 'sunder' || region === 'barrow') density += 0.12;
      if (region === 'fen' || region === 'lake') density *= 0.4;
      if (d > WORLD_RADIUS - 30) density += 0.4;
      if (rng() > density * 0.35 || blocked(x, z, 2) || isWater(x, z, 0.2) || pathDistance(x, z) < 2.5) continue;
      const big = d > 150 && d < 260 ? 1.8 : region === 'crags' ? 2.2 : 1;
      const s = (0.2 + rng() * 0.55) * big;
      rocks.push({ x, z, y: heightAt(x, z) - s * 0.3, s, r: rng() * Math.PI * 2, model: `nature/Rock_Medium_${1 + Math.floor(rng() * 3)}` });
      if (s > 0.3) colliders.push({ x, z, r: s * 1.4 });
    }
    this.scatter(rocks, { cast: true, tier: 'rock' });

    // ---- Undergrowth: bushes, ferns, flowers, mushrooms and pebbles (shown only close up) ----
    const small = [];
    for (let i = 0; i < 26000; i++) {
      const x = (rng() * 2 - 1) * R, z = (rng() * 2 - 1) * R;
      const d = Math.hypot(x, z);
      if (d < 12 || d > WORLD_RADIUS) continue;
      if (isWater(x, z, 0.3) || slopeAt(x, z) > 0.8 || pathDistance(x, z) < 1.6 || blocked(x, z, 1)) continue;
      const region = regionRoll(x, z, rng);
      const kinds = UNDERGROWTH[region];
      const [model, base, jitter] = kinds[Math.floor(rng() * kinds.length)];
      if (region === 'vale') {
        // Ferns and mushrooms like the woods; flowers like the open meadow.
        if ((model.includes('Fern') || model.includes('Mushroom')) && d < 90 && rng() < 0.7) continue;
        if (model.includes('Flower') && d > 120 && rng() < 0.7) continue;
      }
      if (!Assets.has(model)) continue;
      small.push({ x, z, y: heightAt(x, z) - 0.05, s: base + rng() * jitter, r: rng() * Math.PI * 2, model });
    }
    this.scatter(small, { cast: false, tier: 'small' });

    this.grass = new GrassField(scene, avoid, this.uniforms);
  }

  // Place many copies of kit models cheaply: one InstancedMesh per (model part, map chunk), all of a chunk's
  // meshes in one group that's hidden when the chunk is far away.
  scatter(items, { cast, tier }) {
    const groups = new Map();
    const size = TERRAIN_CHUNK;
    for (const it of items) {
      const key = `${Math.floor(it.x / size)},${Math.floor(it.z / size)}|${tier}`;
      if (!groups.has(key)) groups.set(key, new Map());
      const byModel = groups.get(key);
      if (!byModel.has(it.model)) byModel.set(it.model, []);
      byModel.get(it.model).push(it);
    }
    const dummy = new THREE.Object3D();
    for (const [key, byModel] of groups) {
      const [cx, cz] = key.split('|')[0].split(',').map(Number);
      const group = new THREE.Group();
      for (const [model, list] of byModel) {
        for (const { geometry, material } of Assets.meshParts(model)) {
          const mesh = instanced(geometry, bushLeaves(model, material), list.length, { cast, receive: true });
          list.forEach((it, i) => {
            dummy.position.set(it.x, it.y, it.z);
            dummy.rotation.set(0, it.r, 0);
            dummy.scale.setScalar(it.s);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
          });
          mesh.computeBoundingSphere();
          group.add(mesh);
        }
      }
      this.scene.add(group);
      this.chunks.set(key, { group, x: (cx + 0.5) * size, z: (cz + 0.5) * size, tier, size });
    }
  }

  // A gentle sway in the leaves, done in the vertex shader of the kits' leaf materials.
  swayLeaves(trees) {
    const done = new Set();
    for (const model of new Set(trees.map((t) => t.model))) {
      for (const { material } of Assets.meshParts(model)) {
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

  // Needs the renderer, so it's called once the engine exists.
  buildImpostors(renderer) {
    this.impostors = new TreeImpostors(this.scene, this.trees, renderer, { uFocus: { value: new THREE.Vector2() } });
  }

  update(t, focus, daylight) {
    this.uniforms.uTime.value = t;
    if (!focus) return;
    this.uniforms.uFocus.value.set(focus.x, focus.z);
    // Full trees close by (impostors stand in beyond), rocks out to the fog, undergrowth only close by.
    // Distances are to the nearest point of the chunk.
    for (const c of this.chunks.values()) {
      const dx = Math.max(Math.abs(c.x - focus.x) - c.size / 2, 0), dz = Math.max(Math.abs(c.z - focus.z) - c.size / 2, 0);
      c.group.visible = Math.hypot(dx, dz) < VIEW[c.tier];
    }
    this.impostors?.update(focus, daylight);
    this.grass.update(focus);
  }
}

// ---------------------------------------------------------------- tree impostors
// Far trees are drawn as two crossed, textured quads: a picture of the tree baked once at startup. The full
// models only render within VIEW.tree; a shader hides each impostor while its chunk shows the real tree.
export class TreeImpostors {
  constructor(scene, trees, renderer, uniforms) {
    this.uniforms = { ...uniforms, uNear: { value: VIEW.tree }, uChunk: { value: TERRAIN_CHUNK }, uShade: { value: 1 } };
    this.meshes = [];
    const byModel = new Map();
    for (const t of trees) {
      if (!byModel.has(t.model)) byModel.set(t.model, []);
      byModel.get(t.model).push(t);
    }
    const dummy = new THREE.Object3D();
    for (const [model, list] of byModel) {
      const { texture, box } = this.bake(model, renderer);
      const w = box.max.x - box.min.x, h = box.max.y - box.min.y, cx = (box.max.x + box.min.x) / 2;
      const quad = new THREE.PlaneGeometry(w, h).translate(cx, box.min.y + h / 2, 0);
      const cross = mergeQuads(quad, quad.clone().rotateY(Math.PI / 2));
      const mat = new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.45, side: THREE.DoubleSide });
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.uniforms);
        shader.vertexShader = 'uniform vec2 uFocus;\nuniform float uNear;\nuniform float uChunk;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec2 iPos = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          vec2 lo = floor(iPos / uChunk) * uChunk;
          vec2 dd = max(max(lo - uFocus, uFocus - (lo + uChunk)), vec2(0.0));
          if (length(dd) < uNear) transformed *= 0.0; // the real tree is showing`
        );
        shader.fragmentShader = 'uniform float uShade;\n' + shader.fragmentShader.replace(
          '#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= uShade;');
      };
      const mesh = instanced(cross, mat, list.length, { cast: false, receive: false });
      list.forEach((t, i) => {
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.r, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  // Render the model side-on into a small transparent texture.
  bake(model, renderer) {
    const parts = Assets.meshParts(model);
    const box = new THREE.Box3();
    for (const p of parts) {
      p.geometry.computeBoundingBox();
      box.union(p.geometry.boundingBox);
    }
    const w = box.max.x - box.min.x, h = box.max.y - box.min.y;
    const size = new THREE.Vector2(128, Math.min(512, Math.round(128 * (h / w) / 32) * 32 || 128));
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x55624a, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.4, 1, 1);
    scene.add(sun);
    for (const p of parts) scene.add(new THREE.Mesh(p.geometry, bushLeaves(model, p.material)));
    const cam = new THREE.OrthographicCamera(box.min.x, box.max.x, box.max.y, box.min.y, -50, 50);
    cam.position.set(0, 0, 20);
    const prevTarget = renderer.getRenderTarget(), prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x3a4a2a, 0); // leaf-coloured, fully transparent: no dark fringe when mipmapped
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevColor, prevAlpha);
    return { texture: target.texture, box };
  }

  update(focus, daylight = 1) {
    this.uniforms.uFocus.value.set(focus.x, focus.z);
    this.uniforms.uShade.value = 0.28 + daylight * 0.72;
  }
}

function mergeQuads(a, b) {
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const A = a.attributes[name], B = b.attributes[name];
    const arr = new Float32Array(A.array.length + B.array.length);
    arr.set(A.array);
    arr.set(B.array, A.array.length);
    geo.setAttribute(name, new THREE.BufferAttribute(arr, A.itemSize));
  }
  const offset = a.attributes.position.count;
  geo.setIndex([...a.index.array, ...Array.from(b.index.array, (i) => i + offset)]);
  return geo;
}

// ---------------------------------------------------------------- grass
function grassTuftGeometry() {
  const rng = mulberry32(5);
  const positions = [], colors = [], normals = [];
  for (let b = 0; b < 7; b++) {
    const a = (b / 7) * Math.PI * 2 + rng() * 0.8;
    const w = 0.025, h = 0.14 + rng() * 0.14, lean = 0.05 + rng() * 0.08, off = (rng() - 0.5) * 0.18;
    const ca = Math.cos(a), sa = Math.sin(a);
    const pts = [[-w + off, 0, 0], [w + off, 0, 0], [off, h, lean]];
    for (const [x, y, z] of pts) {
      positions.push(x * ca + z * sa, y, -x * sa + z * ca);
      colors.push(...(y > 0 ? [1.3, 1.3, 1.2] : [0.62, 0.66, 0.58])); // dark roots read as spikes; keep them close to the ground's colour
      normals.push(0, 1, 0); // up-facing normals read as soft, sunlit grass
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

// Short grass tufts and wildflowers in a square of cells around the player. When the player moves on,
// cells that fall behind are refilled ahead, so only a strip is rebuilt at a time.
class GrassField {
  constructor(scene, avoid, uniforms) {
    this.avoid = avoid;
    this.cell = 9;
    this.span = 5; // cells either side of the player's cell
    this.per = 230; // tufts per cell
    this.flowersPer = 8;
    const cells = (this.span * 2 + 1) ** 2;
    this.blocks = Array.from({ length: cells }, (_, i) => i);
    this.owner = new Map(); // cell key -> block index
    this.last = null;

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uFocus = uniforms.uFocus;
      shader.vertexShader = 'uniform float uTime;\nuniform vec2 uFocus;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        // Shrink towards the edge of the patch so there's no hard line where the grass stops.
        transformed *= 1.0 - smoothstep(30.0, 45.0, distance(iPos.xz, uFocus));
        float sway = sin(uTime * 1.7 + iPos.x * 0.35 + iPos.z * 0.22) * 0.6 + sin(uTime * 3.3 + iPos.x * 0.9) * 0.25;
        transformed.x += sway * 0.14 * position.y;
        transformed.z += sway * 0.06 * position.y;`
      );
      // Both sides of a blade face the sky: without this, back faces get a flipped normal and render black.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
    };
    this.tufts = instanced(grassTuftGeometry(), mat, cells * this.per, { cast: false });
    this.tufts.frustumCulled = false;
    this.tufts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cells * this.per * 3), 3);
    this.flowers = instanced(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshLambertMaterial(), cells * this.flowersPer, { cast: false });
    this.flowers.frustumCulled = false;
    this.flowers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cells * this.flowersPer * 3), 3);
    scene.add(this.tufts, this.flowers);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
  }

  update(focus) {
    const ci = Math.floor(focus.x / this.cell), cj = Math.floor(focus.z / this.cell);
    const key = `${ci},${cj}`;
    if (key === this.last) return;
    this.last = key;
    const wanted = new Set();
    for (let dj = -this.span; dj <= this.span; dj++) for (let di = -this.span; di <= this.span; di++) wanted.add(`${ci + di},${cj + dj}`);
    const free = [];
    for (const [k, block] of this.owner) {
      if (!wanted.has(k)) {
        this.owner.delete(k);
        free.push(block);
      }
    }
    if (!this.owner.size && !free.length) free.push(...this.blocks);
    for (const k of wanted) {
      if (this.owner.has(k)) continue;
      const block = free.pop();
      this.owner.set(k, block);
      const [i, j] = k.split(',').map(Number);
      this.fill(block, i, j);
    }
    this.tufts.instanceMatrix.needsUpdate = true;
    this.tufts.instanceColor.needsUpdate = true;
    this.flowers.instanceMatrix.needsUpdate = true;
    this.flowers.instanceColor.needsUpdate = true;
  }

  fill(block, i, j) {
    const { cell, per, dummy, color } = this;
    const rng = mulberry32((i * 73856093) ^ (j * 19349663));
    const x0 = i * cell, z0 = j * cell;
    const region = regionAt(x0 + cell / 2, z0 + cell / 2);
    // The same colours as the ground there, a touch brighter at the tips.
    const r = REGIONS[region];
    const tint = new THREE.Color(r.grass[0]).lerp(new THREE.Color(r.grass[1]), 0.6).multiplyScalar(1.2);
    const density = GRASS_DENSITY[region] ?? 1;
    const top = (REGIONS[region].snowLine ?? 36) + 4; // no grass on snow
    const hide = () => { dummy.scale.setScalar(0); dummy.updateMatrix(); };
    for (let n = 0; n < per; n++) {
      const x = x0 + rng() * cell, z = z0 + rng() * cell;
      const idx = block * per + n;
      if (rng() > density || !this.grows(x, z, top)) hide();
      else {
        const s = 0.8 + rng() * 0.5;
        dummy.position.set(x, heightAt(x, z) - 0.03, z);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.scale.set(s, s * (0.75 + rng() * 0.5), s);
        dummy.updateMatrix();
        const v = 0.85 + rng() * 0.3;
        this.tufts.setColorAt(idx, color.setRGB(tint.r * v, tint.g * (0.92 + rng() * 0.16), tint.b * v));
      }
      this.tufts.setMatrixAt(idx, dummy.matrix);
    }
    const palette = FLOWER_COLOURS[region];
    for (let n = 0; n < this.flowersPer; n++) {
      const x = x0 + rng() * cell, z = z0 + rng() * cell;
      const idx = block * this.flowersPer + n;
      if (!palette || !this.grows(x, z, top)) hide();
      else {
        dummy.position.set(x, heightAt(x, z) + 0.2 + rng() * 0.12, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.8 + rng() * 0.6);
        dummy.updateMatrix();
        this.flowers.setColorAt(idx, color.setHex(palette[Math.floor(rng() * palette.length)]));
      }
      this.flowers.setMatrixAt(idx, dummy.matrix);
    }
  }

  grows(x, z, top) {
    if (Math.hypot(x, z) > WORLD_RADIUS + 20) return false;
    if (lakeAt(x, z) && isWater(x, z, 0.25)) return false;
    if (pathDistance(x, z) < 1.2 || slopeAt(x, z) > 0.8) return false;
    if (heightAt(x, z) > top) return false;
    return !this.avoid.some((a) => a.grass && Math.hypot(x - a.x, z - a.z) < a.grass);
  }
}
