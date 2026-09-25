import * as THREE from 'three';
import { clamp, lerp, easeIn, easeOut } from '../engine/math.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function part(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A blocky jointed figure (~1.85 units tall), origin at the feet, facing +z.
// Returns the pivots so callers can animate limbs and attach props.
export function createHumanoid({
  skin = 0xe0b18c, shirt = 0x7a6a55, pants = 0x3f3a33, hair = 0x2b1d14, boots = 0x2b2119, belt = 0x3b2a1a,
} = {}) {
  const M = {
    skin: mat(skin), shirt: mat(shirt), pants: mat(pants), hair: mat(hair),
    boots: mat(boots), belt: mat(belt), eye: mat(0x1a1410, { roughness: 0.4 }),
  };
  const root = new THREE.Group();
  const body = new THREE.Group(); // tilted as a whole for lying down / falling
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(part(box(0.56, 0.7, 0.32), M.shirt, 0, 0.38, 0));
  torso.add(part(box(0.58, 0.09, 0.34), M.belt, 0, 0.06, 0));

  const head = new THREE.Group();
  head.position.y = 0.78;
  torso.add(head);
  head.add(part(box(0.12, 0.1, 0.12), M.skin, 0, 0.04, 0));
  head.add(part(box(0.36, 0.38, 0.36), M.skin, 0, 0.27, 0));
  head.add(part(box(0.4, 0.12, 0.4), M.hair, 0, 0.47, -0.01));
  head.add(part(box(0.4, 0.3, 0.1), M.hair, 0, 0.32, -0.17));
  head.add(part(box(0.06, 0.05, 0.02), M.eye, -0.08, 0.3, 0.181));
  head.add(part(box(0.06, 0.05, 0.02), M.eye, 0.08, 0.3, 0.181));

  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.37 * side, 0.68, 0);
    torso.add(pivot);
    pivot.add(part(box(0.17, 0.5, 0.19), M.shirt, 0, -0.22, 0));
    pivot.add(part(box(0.15, 0.16, 0.17), M.skin, 0, -0.55, 0));
    const hand = new THREE.Group();
    hand.position.y = -0.58;
    pivot.add(hand);
    return { pivot, hand };
  };
  // Facing +z, the character's right side is -x.
  const armL = makeArm(1), armR = makeArm(-1);

  const makeLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.14 * side, 0, 0);
    hips.add(pivot);
    pivot.add(part(box(0.22, 0.72, 0.25), M.pants, 0, -0.38, 0));
    pivot.add(part(box(0.24, 0.2, 0.32), M.boots, 0, -0.84, 0.03));
    return pivot;
  };

  return {
    root, body, hips, torso, head,
    armL: armL.pivot, armR: armR.pivot, handL: armL.hand, handR: armR.hand,
    legL: makeLeg(1), legR: makeLeg(-1), materials: M,
  };
}

// attack: -1 when idle, otherwise 0..1 progress through a wind-up and overhead slash.
export function animateHumanoid(h, { phase, amount, attack = -1, t }) {
  const s = Math.sin(phase) * 0.7 * amount;
  h.legL.rotation.x = s;
  h.legR.rotation.x = -s;
  h.armL.rotation.x = -s * 0.9;
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
}

export function createSword() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xa39a8c, roughness: 0.45, metalness: 0.7 });
  const rust = mat(0x6d4a33, { roughness: 0.9 });
  g.add(part(box(0.05, 0.05, 0.24), mat(0x3b2616), 0, 0, 0));
  g.add(part(box(0.28, 0.05, 0.06), rust, 0, 0, 0.14));
  g.add(part(box(0.065, 0.018, 0.9), metal, 0, 0, 0.62));
  const tip = new THREE.ConeGeometry(0.046, 0.14, 4).rotateX(Math.PI / 2).scale(1.4, 0.35, 1);
  g.add(part(tip, metal, 0, 0, 1.14));
  g.rotation.x = 0.35;
  return g;
}

// Open-fronted cloak that hangs from the shoulders; attach to a humanoid's torso.
export function createCloak(color) {
  const geo = new THREE.CylinderGeometry(0.3, 0.6, 1.3, 14, 1, true, 0.7, Math.PI * 2 - 1.4);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }));
  m.position.set(0, 0.03, -0.03);
  m.castShadow = true;
  return m;
}
