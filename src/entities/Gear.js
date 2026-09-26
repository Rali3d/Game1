import * as THREE from 'three';
import { ITEMS } from '../data/items.js';
import { Assets } from '../engine/Assets.js';

// Held and worn gear: weapons, capes and the hand lantern. Characters themselves are in CharacterModel.

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function part(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// How a weapon (grip at the origin, pointing +z) sits in a character's right hand bone.
export const GRIP_R = new THREE.Euler(0, Math.PI / 2, 0);

// Builds a weapon from its item definition: grip at the origin, pointing along +z.
// Swords and axes use the Quaternius prop models (tinted per item); spears and staves are built here.
export function createWeapon(itemId) {
  const it = ITEMS[itemId] ?? {};
  const g = new THREE.Group();
  const kitModel = { sword: 'props/Sword_Bronze', axe: 'props/Axe_Bronze' }[it.model];
  if (kitModel && Assets.has(kitModel)) {
    const m = Assets.clone(kitModel);
    m.rotation.x = Math.PI / 2; // the kit models point up (+y)
    const length = it.model === 'sword' ? (it.bladeLength ?? 0.9) / 0.95 : it.damage > 20 ? 1.2 : 1;
    m.scale.set(length > 1 ? 1.05 : 1, length, length > 1 ? 1.05 : 1);
    if (it.tint) {
      m.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.color.set(it.tint);
        }
      });
    }
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(m);
    return g;
  }
  const metal = new THREE.MeshStandardMaterial({ color: it.metal ?? 0xa39a8c, roughness: 0.4, metalness: 0.75 });
  const wood = mat(0x5e4128);
  if (it.model === 'spear') {
    g.add(part(new THREE.CylinderGeometry(0.022, 0.026, 2.1, 6).rotateX(Math.PI / 2), wood, 0, 0, 0.3));
    g.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6).rotateX(Math.PI / 2), mat(0x3b2a1a), 0, 0, 1.33));
    g.add(part(new THREE.ConeGeometry(0.065, 0.34, 4).rotateX(Math.PI / 2).scale(0.4, 1, 1), metal, 0, 0, 1.55));
  } else if (it.model === 'staff') {
    g.add(part(new THREE.CylinderGeometry(0.025, 0.03, 1.8, 6).rotateX(Math.PI / 2), mat(0x3a2c22), 0, 0, 0.5));
    g.add(part(new THREE.IcosahedronGeometry(0.09, 1), new THREE.MeshStandardMaterial({
      color: it.metal ?? 0x9fdcff, emissive: it.metal ?? 0x6fbfff, emissiveIntensity: 1.2,
    }), 0, 0, 1.45));
  } else {
    // Fallback blade, if the kit models aren't loaded.
    const len = it.bladeLength ?? 0.9;
    g.add(part(box(0.05, 0.05, 0.24), mat(0x3b2616), 0, 0, 0));
    g.add(part(box(0.05, 0.28, 0.06), mat(it.guard ?? 0x6d4a33), 0, 0, 0.14));
    g.add(part(box(0.018, 0.065, len), metal, 0, 0, 0.17 + len / 2));
  }
  return g;
}

// A back-only cape hinged at the shoulders. Attach to the chest bone (spine_03) of a character.
export function createCape(color) {
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.17, -0.11);
  const geo = new THREE.CylinderGeometry(0.21, 0.42, 1.15, 12, 1, true, Math.PI - 1.25, 2.5).translate(0, -0.575, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = true;
  pivot.add(m);
  pivot.material = m.material;
  return pivot;
}

// A small hand lantern with a glowing core (the light itself is added by the owner). Hangs from the left hand.
export function createHandLantern() {
  const g = new THREE.Group();
  const frame = mat(0x2e2a26, { metalness: 0.5 });
  g.add(part(box(0.14, 0.03, 0.14), frame, 0, -0.1, 0));
  g.add(part(box(0.14, 0.03, 0.14), frame, 0, 0.1, 0));
  g.add(part(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4), frame, 0, 0.17, 0));
  const glass = new THREE.Mesh(box(0.11, 0.17, 0.11), new THREE.MeshStandardMaterial({
    color: 0xffe2a0, emissive: 0xffb347, emissiveIntensity: 2, transparent: true, opacity: 0.9,
  }));
  g.add(glass);
  // The hand bone points down the fingers; flip so the lantern hangs below the fist.
  g.rotation.x = Math.PI;
  g.position.set(0, 0.2, 0.02);
  return g;
}
