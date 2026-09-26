import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Loads the glTF models in assets/ (built by tools/build_assets.py) once, up front, and hands out
// shared scenes, geometry and animation clips. Callers clone what they need.
// Many models share the same few texture sheets; let three.js fetch each file once.
THREE.Cache.enabled = true;
const loader = new GLTFLoader();
const models = new Map();
const clips = new Map();
const partsCache = new Map();
let manifest = null;

// The animation libraries: every Quaternius character shares their skeleton.
const ANIMATION_FILES = ['anims/UAL1.glb', 'anims/UAL2.glb'];

export const Assets = {
  async load(onProgress = () => {}) {
    manifest = await (await fetch('assets/manifest.json')).json();
    const files = [...ANIMATION_FILES];
    for (const [folder, names] of Object.entries(manifest)) for (const n of names) files.push(`${folder}/${n}.gltf`);
    let done = 0;
    const loadOne = async (path) => {
      const gltf = await loader.loadAsync(`assets/${path}`);
      if (path.startsWith('anims/')) {
        for (const clip of gltf.animations) clips.set(clip.name, clip);
      } else {
        // The nature kit stores wind weights in vertex colours; they aren't meant to tint the leaves.
        const dataColours = path.startsWith('nature/');
        gltf.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (dataColours) o.material.vertexColors = false;
          }
        });
        models.set(path.replace(/\.gltf$/, ''), gltf);
      }
      onProgress(++done / files.length, path);
    };
    // A handful at a time keeps the (single-threaded) dev server happy.
    const queue = [...files];
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length) await loadOne(queue.shift());
    });
    await Promise.all(workers);
    shareTextures();
  },

  has(key) {
    return models.has(key);
  },

  // key like 'props/Barrel' or 'characters/Male_Peasant'
  gltf(key) {
    const g = models.get(key);
    if (!g) throw new Error(`Model not loaded: ${key}`);
    return g;
  },

  // A plain (non-skinned) copy of a model, sharing geometry and materials.
  clone(key) {
    return this.gltf(key).scene.clone(true);
  },

  clip(name) {
    return clips.get(name) ?? null;
  },

  // Every mesh in a model, flattened into { geometry, material } with its transform baked in —
  // what an InstancedMesh needs.
  meshParts(key) {
    if (partsCache.has(key)) return partsCache.get(key);
    const scene = this.gltf(key).scene;
    scene.updateMatrixWorld(true);
    const parts = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
      parts.push({ geometry, material: o.material });
    });
    partsCache.set(key, parts);
    return parts;
  },

  names(folder) {
    return manifest?.[folder] ?? [];
  },
};

// Models that use the same image file each get their own Texture from the loader, which would upload
// the same image to the GPU once per model. Point them all at one Texture per image instead.
function shareTextures() {
  const byImage = new Map();
  for (const { scene } of models.values()) {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const key of ['map', 'emissiveMap']) {
          const tex = m[key];
          if (!tex?.image) continue;
          if (!byImage.has(tex.image)) byImage.set(tex.image, tex);
          m[key] = byImage.get(tex.image);
        }
      }
    });
  }
}

// Size of a model's bounding box, handy for scaling props to fit.
export function modelSize(key) {
  const box = new THREE.Box3().setFromObject(Assets.gltf(key).scene);
  return box.getSize(new THREE.Vector3());
}
