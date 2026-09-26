import * as THREE from 'three';
import { ITEMS } from '../data/items.js';
import { Assets } from '../engine/Assets.js';

// Held gear: weapons and the hand lantern. Characters themselves are in CharacterModel.

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function part(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// How a weapon (grip at the origin, pointing +z) sits in a character's right hand bone. Measured from the
// skeleton: the fist closes around the hand bone's z axis (thumb side +z), fingers run along +y, and the
// palm faces -x. The crossguard / axe head lines up with the fingers.
export const GRIP_R = new THREE.Euler(0, 0, Math.PI / 2);
export const GRIP_POS = new THREE.Vector3(-0.035, 0.09, 0);

// Sheathed on the back: handle up behind the right shoulder, pointing down across to the left hip.
// Offset is from the chest bone (spine_03), in the character's own frame (x left, y up, z forward).
export const SHEATH_POS = new THREE.Vector3(-0.14, 0.22, -0.2);
export const SHEATH_ROT = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.38, -0.92, -0.08).normalize());

// Spears and staves are too long to point down: they ride upright across the back, tip over the right shoulder.
export const SHEATH_POS_LONG = new THREE.Vector3(0.08, 0.02, -0.2);
export const SHEATH_ROT_LONG = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(-0.3, 0.95, -0.1).normalize());

// Builds a weapon from its item definition: grip at the origin, pointing along +z.
// Swords and axes use the Quaternius prop models (tinted per item); spears and staves are built here.
export function createWeapon(itemId) {
  const it = ITEMS[itemId] ?? {};
  const g = new THREE.Group();
  // The medieval weapons pack: models stand up +y from the grip; scale to length and point them +z.
  if (it.mesh && Assets.has(it.mesh)) {
    const m = Assets.clone(it.mesh);
    const box = new THREE.Box3().setFromObject(m);
    m.scale.multiplyScalar((it.length ?? 1) / (box.max.y - box.min.y));
    m.rotation.x = Math.PI / 2;
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(m);
    return g;
  }
  const kitModel = { sword: 'props/Sword_Bronze', axe: 'props/Axe_Bronze' }[it.model];
  if (kitModel && Assets.has(kitModel)) {
    const m = Assets.clone(kitModel);
    m.rotation.x = Math.PI / 2; // the kit models point up (+y)
    const length = it.model === 'sword' ? (it.bladeLength ?? 0.9) / 0.95 : it.damage > 20 ? 1.2 : 1;
    m.scale.set(length > 1 ? 1.05 : 1, length, length > 1 ? 1.05 : 1);
    if (it.tint) {
      // The kit weapons are bronze. Iron and steel take the colour out of the texture first, since a tint
      // on its own can only darken orange, not turn it grey.
      const desat = it.desaturate ?? 0;
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        o.material.color.set(it.tint);
        if (desat > 0) {
          o.material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), ${desat.toFixed(2)});`);
          };
          o.material.customProgramCacheKey = () => `desat${desat}`;
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

// A staff held upright in the hand (grip at the origin, standing along +y), for CharacterModel.follow()
// on the right hand bone with STAFF_OFFSET.
export const STAFF_OFFSET = new THREE.Vector3(0.02, -0.12, 0.06);
export function createUprightStaff(itemId = 'ember_staff') {
  const staff = createWeapon(itemId);
  staff.rotation.x = -Math.PI / 2; // +z -> +y
  return staff;
}

// A small hand lantern with a glowing core (the light itself is added by the owner). Hang it from the left
// hand with CharacterModel.follow() and LANTERN_OFFSET so it always hangs upright.
export const LANTERN_OFFSET = new THREE.Vector3(0, -0.2, 0.04);
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
  return g;
}
