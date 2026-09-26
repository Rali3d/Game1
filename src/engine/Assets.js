import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Loads the glTF models in assets/ (built by tools/build_assets.py) once, up front, and hands out
// shared scenes, geometry and animation clips. Callers clone what they need.
// Many models share the same few texture sheets; let three.js fetch each file once.
THREE.Cache.enabled = true;
const loader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const retargeted = new Map();
const models = new Map();
const clips = new Map();
const partsCache = new Map();
let manifest = null;

// The animation libraries: every Quaternius character shares their skeleton.
const ANIMATION_FILES = ['anims/UAL1.glb', 'anims/UAL2.glb'];
// Folders of FBX models. The older packs are in centimetres with plain coloured materials; the static ones
// (no animations) are scaled to metres here so they can be used like the glTF kits.
const FBX_FOLDERS = new Set(['animals', 'monsters', 'weapons', 'dungeon', 'ruins']);
const STATIC_FBX = new Set(['weapons', 'dungeon', 'ruins']);
let leafTexture = null;

// FBX materials arrive as Phong with a transparency three.js reads as invisible. Swap in the same
// Standard material the glTF kits use, so everything is lit alike.
function fbxMaterial(m, folder) {
  const out = new THREE.MeshStandardMaterial({ name: m.name, color: m.color.clone(), map: m.map ?? null, roughness: 0.85, metalness: 0 });
  if (/Steel|Metal|Gold/i.test(m.name)) Object.assign(out, { roughness: 0.45, metalness: 0.6 });
  if (/Fire/i.test(m.name)) Object.assign(out, { emissive: new THREE.Color(0xff6a1a), emissiveIntensity: 1.5 });
  if (folder === 'ruins' && /Leaf|Green/i.test(m.name)) {
    leafTexture ??= new THREE.TextureLoader().load('assets/textures/ruins/Leaf_Texture.png', (t) => { t.colorSpace = THREE.SRGBColorSpace; });
    Object.assign(out, { map: leafTexture, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(0x9fc46a) });
  }
  if (/Cobweb/i.test(m.name)) Object.assign(out, { transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  return out;
}

export const Assets = {
  async load(onProgress = () => {}) {
    manifest = await (await fetch('assets/manifest.json')).json();
    // Models that can't be shared in the repo (the Bestiary) are listed in a local manifest, if built.
    try {
      const local = await fetch('assets/manifest.local.json');
      if (local.ok) Object.assign(manifest, await local.json());
    } catch { /* not built locally: those models are simply absent */ }
    const files = [...ANIMATION_FILES];
    for (const [folder, names] of Object.entries(manifest)) {
      for (const n of names) files.push(`${folder}/${n}.${FBX_FOLDERS.has(folder) ? 'fbx' : 'gltf'}`);
    }
    let done = 0;
    const loadOne = async (path) => {
      if (path.endsWith('.fbx')) {
        // FBX models load as a Group with their animations attached.
        const group = await fbxLoader.loadAsync(`assets/${path}`);
        const folder = path.split('/')[0];
        group.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          o.material = Array.isArray(o.material) ? o.material.map((m) => fbxMaterial(m, folder)) : fbxMaterial(o.material, folder);
          o.geometry = compactGroups(o.geometry);
        });
        if (STATIC_FBX.has(folder)) group.scale.multiplyScalar(0.01);
        models.set(path.replace(/\.fbx$/, ''), { scene: group, animations: group.animations });
        onProgress(++done / files.length, path);
        return;
      }
      const gltf = await loader.loadAsync(`assets/${path}`);
      if (path.startsWith('anims/')) {
        for (const clip of gltf.animations) clips.set(clip.name, clip);
      } else {
        // The nature kit stores wind weights in vertex colours; they aren't meant to tint the leaves.
        const dataColours = path.startsWith('nature');
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

  // A copy of a library clip for a creature with different proportions: rotations only (bone lengths stay
  // the creature's own), with the hips' height scaled to match.
  retargetedClip(name, hipScale) {
    const key = `${name}@${hipScale.toFixed(3)}`;
    if (retargeted.has(key)) return retargeted.get(key);
    const src = clips.get(name);
    if (!src) return null;
    const tracks = [];
    for (const t of src.tracks) {
      if (t.name.endsWith('.quaternion')) tracks.push(t);
      else if (t.name === 'pelvis.position') {
        const c = t.clone();
        for (let i = 0; i < c.values.length; i++) c.values[i] *= hipScale;
        tracks.push(c);
      }
    }
    const clip = new THREE.AnimationClip(`${name}~`, src.duration, tracks);
    retargeted.set(key, clip);
    return clip;
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
      const geometry = compactGroups(o.geometry.clone().applyMatrix4(o.matrixWorld));
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

// FBX geometry can switch material hundreds of times (a draw call each). Reorder the triangles so each
// material's are together: one group, and one draw call, per material.
function compactGroups(geo) {
  if (geo.groups.length <= 1) return geo;
  if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
  const src = geo.index.array, byMat = new Map();
  for (const g of geo.groups) {
    if (!byMat.has(g.materialIndex)) byMat.set(g.materialIndex, []);
    byMat.get(g.materialIndex).push(src.subarray(g.start, g.start + g.count));
  }
  const out = [];
  geo.clearGroups();
  for (const [mat, runs] of [...byMat].sort((a, b) => a[0] - b[0])) {
    const start = out.length;
    for (const r of runs) for (const v of r) out.push(v);
    geo.addGroup(start, out.length - start, mat);
  }
  geo.setIndex(out);
  return geo;
}

// Size of a model's bounding box, handy for scaling props to fit.
export function modelSize(key) {
  const box = new THREE.Box3().setFromObject(Assets.gltf(key).scene);
  return box.getSize(new THREE.Vector3());
}
