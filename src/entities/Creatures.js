import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Assets } from '../engine/Assets.js';
import { AnimatedModel, ANIMS } from './CharacterModel.js';

const textureLoader = new THREE.TextureLoader();

function prepare(root, materials) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    // FBX meshes can carry several materials.
    const own = (m) => {
      const c = m.clone();
      c.emissive ??= new THREE.Color();
      // These old FBX exports carry a transparency value three.js reads as fully see-through.
      if (c.opacity === 0) {
        c.opacity = 1;
        c.transparent = false;
      }
      materials.push(c);
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    o.castShadow = true;
    o.frustumCulled = false; // skinned bounds don't follow the animation
  });
}

// Bestiary monsters (Imp, Puglin). They share the characters' bone names, so the Universal Animation
// Library drives them too, retargeted: rotations only, hips scaled to the monster's height.
export class MonsterModel extends AnimatedModel {
  static available(name) {
    return Assets.has(`bestiary/${name}`);
  }

  constructor(name, variant = 1) {
    super();
    this.root = new THREE.Group();
    const body = SkeletonUtils.clone(Assets.gltf(`bestiary/${name}`).scene);
    this.root.add(body);
    this.bones = {};
    body.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.materials = [];
    prepare(body, this.materials);

    // Colour variants ship as alternate base colour textures.
    if (variant > 1) {
      const tex = textureLoader.load(`assets/textures/bestiary/T_${name}_BaseColor_${variant}.jpg`);
      tex.flipY = false; // glTF texture convention
      tex.colorSpace = THREE.SRGBColorSpace;
      for (const m of this.materials) if (m.map) m.map = tex;
    }

    body.updateMatrixWorld(true);
    this.hipScale = this.bones.pelvis.getWorldPosition(new THREE.Vector3()).y / 0.95;
    this.handR = new THREE.Group();
    this.bones.hand_r?.add(this.handR);
    this.head = this.bones.Head;
    this.initAnimation(body);
  }

  clipFor(name) {
    return Assets.retargetedClip(ANIMS[name] ?? name, this.hipScale);
  }
}

// Farm animals (FBX, with their own animations). Only the cow and horse can walk and run; the others hop.
const ANIMAL_HEIGHT = { Cow: 1.5, Horse: 1.9, Sheep: 1.0, Pig: 0.75, Llama: 1.8, Pug: 0.42 };
const ANIMAL_CLIPS = { idle: 'Idle', walk: 'Walk', walkSlow: 'WalkSlow', run: 'Run', hop: 'Jump', death: 'Death' };

export class AnimalModel extends AnimatedModel {
  constructor(kind) {
    super();
    this.kind = kind;
    const src = Assets.gltf(`animals/${kind}`);
    this.clips = src.animations;
    this.root = new THREE.Group();
    const body = SkeletonUtils.clone(src.scene);
    const box = new THREE.Box3().setFromObject(src.scene);
    body.scale.setScalar(ANIMAL_HEIGHT[kind] / (box.max.y - box.min.y));
    body.position.y = -box.min.y * body.scale.y;
    this.root.add(body);
    this.materials = [];
    prepare(body, this.materials);
    this.canWalk = this.clips.some((c) => c.name.endsWith('|Walk'));
    this.initAnimation(body);
  }

  clipFor(name) {
    const wanted = ANIMAL_CLIPS[name] ?? name;
    return this.clips.find((c) => c.name.endsWith(`|${wanted}`)) ?? null;
  }
}
