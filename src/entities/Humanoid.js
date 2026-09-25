import * as THREE from 'three';
import { clamp, lerp, easeIn, easeOut } from '../engine/math.js';
import { ITEMS } from '../data/items.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function part(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const HAIR_STYLES = ['short', 'long', 'ponytail', 'curly', 'shaved'];

function addHair(head, style, material) {
  if (style === 'shaved') return;
  if (style === 'curly') {
    const geo = new THREE.IcosahedronGeometry(0.25, 0);
    [[0, 0.5, 0], [-0.14, 0.44, -0.08], [0.14, 0.44, -0.08], [0, 0.42, -0.16]].forEach(([x, y, z]) => head.add(part(geo, material, x, y, z)));
    return;
  }
  head.add(part(box(0.4, 0.12, 0.4), material, 0, 0.47, -0.01));
  head.add(part(box(0.4, 0.3, 0.1), material, 0, 0.32, -0.17));
  if (style === 'long') {
    head.add(part(box(0.42, 0.55, 0.1), material, 0, 0.18, -0.19));
    for (const sx of [-1, 1]) head.add(part(box(0.06, 0.42, 0.26), material, sx * 0.2, 0.26, -0.04));
  } else if (style === 'ponytail') {
    const tail = part(box(0.12, 0.42, 0.12), material, 0, 0.22, -0.3);
    tail.rotation.x = 0.35;
    head.add(tail);
  } else {
    for (const sx of [-1, 1]) head.add(part(box(0.05, 0.16, 0.2), material, sx * 0.2, 0.36, -0.06));
  }
}

// A blocky jointed figure (~1.85 units tall), origin at the feet, facing +z.
// Appearance: gender ('male' | 'female'), skin, shirt, pants, hair, hairStyle, beard.
// Returns the pivots so callers can animate limbs and attach props.
export function createHumanoid({
  gender = 'male', skin = 0xe0b18c, shirt = 0x7a6a55, pants = 0x3f3a33, hair = 0x2b1d14,
  hairStyle = 'short', beard = false, boots = 0x2b2119, belt = 0x3b2a1a,
} = {}) {
  const M = {
    skin: mat(skin), shirt: mat(shirt), pants: mat(pants), hair: mat(hair),
    boots: mat(boots), belt: mat(belt), eye: mat(0x1a1410, { roughness: 0.4 }),
  };
  const fem = gender === 'female';
  const shoulder = fem ? 0.33 : 0.38;

  const root = new THREE.Group();
  const body = new THREE.Group(); // tilted as a whole for lying down / falling
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  // Chest and waist are separate boxes so body shapes can differ.
  torso.add(part(box(fem ? 0.5 : 0.58, 0.42, fem ? 0.3 : 0.32), M.shirt, 0, 0.52, 0));
  torso.add(part(box(fem ? 0.42 : 0.52, 0.3, fem ? 0.27 : 0.3), M.shirt, 0, 0.19, 0));
  torso.add(part(box(fem ? 0.5 : 0.54, 0.09, fem ? 0.3 : 0.32), M.belt, 0, 0.06, 0));

  const head = new THREE.Group();
  head.position.y = 0.78;
  torso.add(head);
  head.add(part(box(0.12, 0.1, 0.12), M.skin, 0, 0.04, 0));
  head.add(part(box(fem ? 0.34 : 0.36, 0.38, 0.36), M.skin, 0, 0.27, 0));
  head.add(part(box(0.06, 0.05, 0.02), M.eye, -0.08, 0.3, 0.181));
  head.add(part(box(0.06, 0.05, 0.02), M.eye, 0.08, 0.3, 0.181));
  addHair(head, hairStyle, M.hair);
  if (beard) head.add(part(box(0.3, 0.24, 0.1), M.hair, 0, 0.12, 0.19));

  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(shoulder * side, 0.68, 0);
    torso.add(pivot);
    pivot.add(part(box(fem ? 0.15 : 0.17, 0.5, fem ? 0.17 : 0.19), M.shirt, 0, -0.22, 0));
    pivot.add(part(box(0.14, 0.16, 0.16), M.skin, 0, -0.55, 0));
    const hand = new THREE.Group();
    hand.position.y = -0.58;
    pivot.add(hand);
    return { pivot, hand };
  };
  // Facing +z, the character's right side is -x.
  const armL = makeArm(1), armR = makeArm(-1);

  const makeLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set((fem ? 0.12 : 0.14) * side, 0, 0);
    hips.add(pivot);
    pivot.add(part(box(fem ? 0.2 : 0.22, 0.72, 0.24), M.pants, 0, -0.38, 0));
    pivot.add(part(box(0.22, 0.2, 0.32), M.boots, 0, -0.84, 0.03));
    return pivot;
  };

  root.scale.setScalar(fem ? 0.96 : 1);
  return {
    root, body, hips, torso, head,
    armL: armL.pivot, armR: armR.pivot, handL: armL.hand, handR: armR.hand,
    legL: makeLeg(1), legR: makeLeg(-1), materials: M, cape: null,
  };
}

// attack: -1 when idle, otherwise 0..1 progress through a wind-up and overhead slash.
// cast: -1 when idle, otherwise 0..1 progress through a one-handed casting thrust.
export function animateHumanoid(h, { phase, amount, attack = -1, cast = -1, holdL = 0, t }) {
  const s = Math.sin(phase) * 0.7 * amount;
  h.legL.rotation.x = s;
  h.legR.rotation.x = -s;
  h.armL.rotation.x = cast >= 0 ? -1.5 * Math.sin(Math.PI * cast) : lerp(-s * 0.9, -0.55, holdL);
  h.armL.rotation.z = 0.06;
  h.armR.rotation.z = -0.06;
  h.hips.position.y = 0.95 + Math.abs(Math.cos(phase)) * 0.05 * amount + Math.sin(t * 2.2) * 0.008;
  h.torso.rotation.x = 0.05 * Math.min(amount, 1.3);

  if (attack >= 0) {
    let a;
    if (attack < 0.3) a = -3.1 * easeOut(attack / 0.3);
    else if (attack < 0.55) a = lerp(-3.1, -0.7, easeIn((attack - 0.3) / 0.25));
    else a = lerp(-0.7, 0, (attack - 0.55) / 0.45);
    h.armR.rotation.x = a;
    h.torso.rotation.y = Math.sin(clamp(attack, 0, 1) * Math.PI * 2) * 0.3;
  } else {
    h.armR.rotation.x = s * 0.9;
    h.torso.rotation.y = 0;
  }
  // The cape swings back as you speed up, which keeps the legs from poking through it.
  if (h.cape) h.cape.rotation.x = 0.1 + 0.32 * Math.min(amount, 1.3) + Math.sin(t * 1.7) * 0.02;
}

// Builds a held weapon from its item definition. The grip sits at the origin and the weapon points
// along +z. The swing is an overhead chop, so edges and blades face -y (the direction of the strike).
export function createWeapon(itemId) {
  const it = ITEMS[itemId] ?? {};
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: it.metal ?? 0xa39a8c, roughness: 0.4, metalness: 0.75 });
  const wood = mat(0x5e4128);
  if (it.model === 'axe') {
    g.add(part(new THREE.CylinderGeometry(0.032, 0.038, 1.05, 6).rotateX(Math.PI / 2), wood, 0, 0, 0.35));
    g.add(part(box(0.06, 0.3, 0.24), metal, 0, -0.15, 0.74));
    g.add(part(box(0.035, 0.07, 0.34), mat(0xd6d8da, { metalness: 0.8, roughness: 0.3 }), 0, -0.31, 0.74)); // edge
    g.add(part(box(0.07, 0.08, 0.1), metal, 0, 0.06, 0.74)); // poll on the back of the head
  } else if (it.model === 'spear') {
    g.add(part(new THREE.CylinderGeometry(0.026, 0.03, 2.1, 6).rotateX(Math.PI / 2), wood, 0, 0, 0.3));
    g.add(part(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6).rotateX(Math.PI / 2), mat(0x3b2a1a), 0, 0, 1.33));
    g.add(part(new THREE.ConeGeometry(0.075, 0.36, 4).rotateX(Math.PI / 2).scale(0.4, 1, 1), metal, 0, 0, 1.56));
  } else if (it.model === 'staff') {
    g.add(part(new THREE.CylinderGeometry(0.03, 0.035, 1.8, 6).rotateX(Math.PI / 2), mat(0x3a2c22), 0, 0, 0.5));
    const orb = part(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshStandardMaterial({
      color: it.metal ?? 0x9fdcff, emissive: it.metal ?? 0x6fbfff, emissiveIntensity: 1.2,
    }), 0, 0, 1.45);
    g.add(orb);
  } else {
    const len = it.bladeLength ?? 0.9;
    g.add(part(box(0.05, 0.05, 0.24), mat(0x3b2616), 0, 0, 0));
    g.add(part(box(0.07, 0.07, 0.07), mat(it.guard ?? 0x6d4a33, { metalness: 0.4 }), 0, 0, -0.14)); // pommel
    g.add(part(box(0.05, 0.28, 0.06), mat(it.guard ?? 0x6d4a33, { metalness: 0.4 }), 0, 0, 0.14)); // crossguard
    g.add(part(box(0.018, 0.065, len), metal, 0, 0, 0.17 + len / 2));
    const tip = new THREE.ConeGeometry(0.046, 0.14, 4).rotateX(Math.PI / 2).scale(0.35, 1.4, 1);
    g.add(part(tip, metal, 0, 0, 0.24 + len));
  }
  g.rotation.x = 0.35;
  return g;
}

// A back-only cape hinged at the shoulders. Attach to a humanoid's torso and set h.cape so it animates.
export function createCape(color) {
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.7, -0.03);
  const geo = new THREE.CylinderGeometry(0.3, 0.52, 1.25, 12, 1, true, Math.PI - 1.2, 2.4).translate(0, -0.625, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = true;
  pivot.add(m);
  pivot.material = m.material;
  return pivot;
}

// A small hand lantern with a glowing core (the light itself is added by the owner).
export function createHandLantern() {
  const g = new THREE.Group();
  const frame = mat(0x2e2a26, { metalness: 0.5 });
  g.add(part(box(0.16, 0.03, 0.16), frame, 0, -0.1, 0));
  g.add(part(box(0.16, 0.03, 0.16), frame, 0, 0.12, 0));
  g.add(part(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4), frame, 0, 0.19, 0));
  const glass = new THREE.Mesh(box(0.13, 0.2, 0.13), new THREE.MeshStandardMaterial({
    color: 0xffe2a0, emissive: 0xffb347, emissiveIntensity: 2, transparent: true, opacity: 0.9,
  }));
  g.add(glass);
  g.glass = glass;
  return g;
}
