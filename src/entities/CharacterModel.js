import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Assets } from '../engine/Assets.js';

// Animated characters built from the Quaternius kits: an outfit (arms, body, legs, feet), the base
// body's head, a hairstyle and an optional beard, all bound to one skeleton and driven by the Universal
// Animation Library. Appearance: { gender, outfit, skin, hair, hairStyle, beard, dye }.

export const HAIR_STYLES = ['parted', 'long', 'buns', 'buzzed', 'bald'];
export const HAIR_NAMES = { parted: 'Parted', long: 'Long', buns: 'Buns', buzzed: 'Buzzed', bald: 'Bald' };
export const OUTFITS = ['peasant', 'ranger'];

// Older saves used the blocky model's hairstyles.
const LEGACY_HAIR = { short: 'parted', ponytail: 'buns', curly: 'buzzed', shaved: 'bald' };

// Skin swatches are multipliers on the painted skin texture (which is a mid tone).
export const SKIN_TONES = [0xfff0e6, 0xe8d2c2, 0xc9a58f, 0x9c7560, 0x6e4c3a, 0x4a3024];

const hairFile = (style, female) => ({
  parted: 'Hair_SimpleParted', long: 'Hair_Long', buns: 'Hair_Buns',
  buzzed: female ? 'Hair_BuzzedFemale' : 'Hair_Buzzed',
})[style];

// Animation names in the library, by what the game asks for.
export const ANIMS = {
  idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', run: 'Sprint_Loop',
  jump: 'Jump_Loop', attack: 'Sword_Attack', attackB: 'Sword_Regular_B', cast: 'Spell_Simple_Shoot',
  hit: 'Hit_Chest', death: 'Death01', getUp: 'LayToIdle', talk: 'Idle_Talking_Loop', foldArms: 'Idle_FoldArms_Loop',
  kneel: 'Fixing_Kneeling', interact: 'Interact', pickup: 'PickUp_Table', drink: 'Consume',
  zombieIdle: 'Zombie_Idle_Loop', zombieWalk: 'Zombie_Walk_Fwd_Loop', zombieAttack: 'Zombie_Scratch',
  sit: 'Sitting_Idle_Loop', chop: 'TreeChopping_Loop', lantern: 'Idle_Lantern_Loop',
};
const ONE_SHOTS = new Set(['attack', 'attackB', 'cast', 'hit', 'death', 'getUp', 'interact', 'pickup', 'drink', 'zombieAttack']);

// Only keep the base body above the collar (head, neck); the outfit covers the rest. Positions are the
// body's bind pose, in metres, standing at the origin.
function headOnly(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBindPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBindPos;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vBindPos.y < 1.47 || abs(vBindPos.x) > 0.15) discard;');
  };
  material.customProgramCacheKey = () => 'headOnly';
}

// Map any colour (e.g. from an older save) to the closest skin tone by brightness.
function nearestSkin(hex) {
  if (hex == null) return SKIN_TONES[1];
  if (SKIN_TONES.includes(hex)) return hex;
  const lum = (h) => new THREE.Color(h).getHSL({}).l;
  const target = lum(hex);
  return SKIN_TONES.reduce((best, t) => (Math.abs(lum(t) - target) < Math.abs(lum(best) - target) ? t : best));
}

export function normaliseAppearance(a = {}) {
  const style = LEGACY_HAIR[a.hairStyle] ?? a.hairStyle;
  return {
    gender: a.gender === 'female' ? 'female' : 'male',
    outfit: OUTFITS.includes(a.outfit) ? a.outfit : 'peasant',
    skin: nearestSkin(a.skin),
    hair: a.hair ?? 0x3a2a1a,
    hairStyle: HAIR_STYLES.includes(style) ? style : 'parted',
    beard: !!a.beard,
    hood: !!a.hood,
    dye: a.dye ?? a.shirt ?? 0xffffff,
  };
}

// Shared animation plumbing for anything skinned: a mixer, cross-faded loops, one-shots that take over,
// bone followers and a hit flash. Subclasses build `root`/`bones`/`materials`, then call initAnimation().
export class AnimatedModel {
  initAnimation(animRoot) {
    this.followers ??= [];
    this.mixer = new THREE.AnimationMixer(animRoot);
    this.actions = {};
    this.current = null;
    this.oneShot = null;
    this.mixer.addEventListener('finished', (e) => {
      const shot = this.oneShot;
      if (!shot || e.action !== shot.action) return;
      if (!shot.hold) this.oneShot = null;
      shot.onDone?.();
    });
  }

  // Which AnimationClip plays for a game animation name. Subclasses can retarget.
  clipFor(name) {
    return Assets.clip(ANIMS[name] ?? name);
  }

  action(name) {
    if (this.actions[name]) return this.actions[name];
    const clip = this.clipFor(name);
    if (!clip) return null;
    const act = this.mixer.clipAction(clip);
    if (ONE_SHOTS.has(name)) {
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
    }
    return (this.actions[name] = act);
  }

  // Switch the looping base animation (idle, walk, run...). Cross-fades; no-op if already playing.
  // While a one-shot is playing, this just records what to return to afterwards.
  loop(name, { fade = 0.25, speed = 1 } = {}) {
    const act = this.action(name);
    if (!act) return;
    act.timeScale = speed;
    if (this.oneShot) {
      this.wanted = act;
      return;
    }
    if (this.current === act) return;
    act.reset().setEffectiveWeight(1).fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = act;
  }

  // Play an animation once, taking over from the loop (an attack, a hit, a death...).
  // `duration` stretches it to fit; `hold` keeps the last frame (death) until something else plays.
  once(name, { duration, fade = 0.12, onDone, hold = false } = {}) {
    const act = this.action(name);
    if (!act) return onDone?.();
    const previous = this.oneShot?.action;
    act.reset();
    act.setLoop(THREE.LoopOnce, 1); // whatever the clip, a one-shot plays through once
    act.clampWhenFinished = true;
    act.timeScale = duration ? act.getClip().duration / duration : 1;
    act.setEffectiveWeight(1).fadeIn(fade).play();
    if (previous && previous !== act) previous.fadeOut(fade);
    this.current?.fadeOut(fade);
    this.wanted = this.current;
    this.current = null;
    this.oneShot = {
      action: act, hold, onDone: () => {
        onDone?.();
        if (hold) return;
        // Hand back to whichever loop was asked for in the meantime.
        const next = this.wanted;
        this.wanted = null;
        act.fadeOut(0.2);
        if (next) {
          next.reset().setEffectiveWeight(1).fadeIn(0.2).play();
          this.current = next;
        }
      },
    };
  }

  // Freeze on a pose (used for lying in the grass before waking).
  pose(name, time = 0) {
    const act = this.action(name);
    if (!act) return;
    this.mixer.stopAllAction();
    act.reset().play();
    act.paused = true;
    act.time = time;
    this.current = null;
    this.wanted = null;
    this.oneShot = { action: act, hold: true };
  }

  // Drop any held pose or one-shot and go straight back to a loop.
  reset(name = 'idle') {
    this.mixer.stopAllAction();
    this.oneShot = null;
    this.current = null;
    this.wanted = null;
    this.loop(name, { fade: 0 });
  }

  get busy() {
    return !!this.oneShot;
  }

  // Locomotion from horizontal speed (m/s). Each gait has a band with some overlap (hysteresis), so a
  // speed hovering near a boundary doesn't flicker between two animations every frame.
  locomote(speed, extraIdle) {
    const bands = { idle: [0, 0.4], walk: [0.2, 3.5], jog: [2.9, 7.0], run: [6.2, Infinity] };
    let gait = this.gait ?? 'idle';
    const [lo, hi] = bands[gait];
    if (speed < lo || speed > hi) gait = speed < 0.3 ? 'idle' : speed < 3.2 ? 'walk' : speed < 6.6 ? 'jog' : 'run';
    this.gait = gait;
    if (gait === 'idle') this.loop(extraIdle ?? 'idle');
    else if (gait === 'walk') this.loop('walk', { speed: Math.max(0.7, speed / 2.2) });
    else if (gait === 'jog') this.loop('jog', { speed: Math.max(0.7, speed / 4.6) });
    else this.loop('run', { speed: speed / 7.5 });
  }

  // Keep `obj` at a bone's position (plus an offset in the character's frame), without inheriting the
  // bone's rotation. Good for things that should hang straight down however the arm or spine is bent.
  follow(obj, boneName, offset = new THREE.Vector3()) {
    this.root.add(obj);
    this.followers.push({ obj, bone: this.bones[boneName], offset });
    return obj;
  }

  unfollow(obj) {
    this.followers = this.followers.filter((f) => f.obj !== obj);
    obj.removeFromParent();
  }

  update(dt) {
    this.mixer.update(dt);
    if (!this.followers.length) return;
    this.root.updateMatrixWorld(true);
    for (const f of this.followers) {
      f.bone.getWorldPosition(f.obj.position);
      this.root.worldToLocal(f.obj.position).add(f.offset);
    }
  }

  setFlash(f) {
    for (const m of this.materials) m.emissive.setRGB(f, f * 0.35, f * 0.35);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    for (const m of this.materials) m.dispose();
  }
}

export class CharacterModel extends AnimatedModel {
  constructor(appearance) {
    super();
    const a = (this.appearance = normaliseAppearance(appearance));
    const female = a.gender === 'female';
    const G = female ? 'Female' : 'Male';
    const outfitKey = `characters/${G}_${a.outfit === 'ranger' ? 'Ranger' : 'Peasant'}`;

    this.root = new THREE.Group(); // stands at the feet, faces +z
    const body = (this.body = SkeletonUtils.clone(Assets.gltf(outfitKey).scene));
    this.root.add(body);

    const bones = {};
    body.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    this.bones = bones;
    const anchor = body.getObjectByProperty('type', 'SkinnedMesh').parent;

    // Everything else is re-skinned onto the outfit's skeleton.
    const adopt = (key, prepare) => {
      const src = SkeletonUtils.clone(Assets.gltf(key).scene);
      const meshes = [];
      src.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
      for (const m of meshes) {
        const skeleton = new THREE.Skeleton(m.skeleton.bones.map((b) => bones[b.name]), m.skeleton.boneInverses);
        anchor.add(m);
        m.bind(skeleton, m.bindMatrix);
        prepare?.(m);
      }
    };

    // Materials are cloned so each character can have its own skin, hair and dye colours.
    this.materials = [];
    const own = (m) => {
      m.material = m.material.clone();
      this.materials.push(m.material);
      return m.material;
    };
    const tone = (hex) => new THREE.Color(hex).multiplyScalar(1.45); // the painted skin is a mid tone
    // The ranger's hood is optional (it hides the hair).
    const hoods = [];
    body.traverse((o) => { if (/Hood/.test(o.name) || /Hood/.test(o.parent?.name ?? '')) hoods.push(o); });
    if (!a.hood) hoods.forEach((o) => o.removeFromParent());
    body.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const mat = own(o);
      if (/Regular/.test(mat.name)) mat.color.copy(tone(a.skin));
      else mat.color.set(a.dye).lerp(new THREE.Color(0xffffff), 0.55); // a gentle dye over the cloth
    });
    adopt(`characters/Superhero_${G}_FullBody`, (m) => {
      const mat = own(m);
      if (/Superhero/.test(mat.name)) {
        mat.color.copy(tone(a.skin));
        headOnly(mat);
      } else if (/Hair/.test(mat.name)) {
        mat.color.set(a.hair); // eyebrows
      }
    });
    const hair = hairFile(a.hairStyle, female);
    const hooded = a.hood && hoods.length > 0;
    if (hair && !(hooded && a.hairStyle !== 'buzzed')) adopt(`characters/${hair}`, (m) => own(m).color.set(a.hair));
    if (a.beard) adopt('characters/Hair_Beard', (m) => own(m).color.set(a.hair));
    for (const m of this.materials) m.emissive ??= new THREE.Color();
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false; // skinned bounds don't follow the animation
      }
    });

    // Things that follow a bone's position but keep their own upright orientation (lanterns, staffs).
    this.followers = [];
    // Sockets for things held or worn.
    this.handR = new THREE.Group();
    this.handL = new THREE.Group();
    bones.hand_r.add(this.handR);
    bones.hand_l.add(this.handL);
    this.head = bones.Head;

    this.initAnimation(body);
  }

}
