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

// A creature that brings its own animations (the FBX packs): scaled to a height, standing on the ground,
// with game animation names mapped to its clip names (which end in `|<name>`).
export class ClipModel extends AnimatedModel {
  constructor(key, height, clipNames) {
    super();
    const src = Assets.gltf(key);
    this.clips = src.animations;
    this.clipNames = clipNames;
    this.root = new THREE.Group();
    const body = SkeletonUtils.clone(src.scene);
    const box = new THREE.Box3().setFromObject(src.scene);
    body.scale.setScalar(height / (box.max.y - box.min.y));
    body.position.y = -box.min.y * body.scale.y;
    this.root.add(body);
    this.body = body;
    this.materials = [];
    prepare(body, this.materials);
    this.initAnimation(body);
  }

  clipFor(name) {
    const wanted = this.clipNames[name] ?? name;
    return this.clips.find((c) => c.name.endsWith(`|${wanted}`)) ?? null;
  }
}

// Farm animals. Only the cow and horse can walk and run; the others hop.
const ANIMAL_HEIGHT = { Cow: 1.5, Horse: 1.9, Sheep: 1.0, Pig: 0.75, Llama: 1.8, Pug: 0.42 };
const ANIMAL_CLIPS = { idle: 'Idle', walk: 'Walk', walkSlow: 'WalkSlow', run: 'Run', hop: 'Jump', death: 'Death' };

export class AnimalModel extends ClipModel {
  constructor(kind) {
    super(`animals/${kind}`, ANIMAL_HEIGHT[kind], ANIMAL_CLIPS);
    this.kind = kind;
    this.canWalk = this.clips.some((c) => c.name.endsWith('|Walk'));
  }
}

// The animated monster pack: slime, bat and dragon.
const MONSTERS = {
  Slime: { height: 0.95, clips: { idle: 'Slime_Idle', walk: 'Slime_Walk', attack: 'Slime_Attack', death: 'Slime_Death' } },
  Bat: { height: 0.7, clips: { idle: 'Bat_Flying', walk: 'Bat_Flying', attack: 'Bat_Attack', hit: 'Bat_Hit', death: 'Bat_Death' } },
  Dragon: { height: 4.2, clips: { idle: 'Dragon_Flying', walk: 'Dragon_Flying', attack: 'Dragon_Attack', attackB: 'Dragon_Attack2', hit: 'Dragon_Hit', death: 'Dragon_Death' } },
};
export class PackMonster extends ClipModel {
  static available(name) {
    return Assets.has(`monsters/${name}`);
  }

  constructor(name, { scale = 1, tint = null } = {}) {
    super(`monsters/${name}`, MONSTERS[name].height * scale, MONSTERS[name].clips);
    if (tint !== null) {
      // Recolour the main body material (named Main or Body in the pack).
      for (const m of this.materials) if (/^(Main|Body)$/.test(m.name)) m.color.set(tint);
    }
  }
}
