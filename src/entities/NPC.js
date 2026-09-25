import * as THREE from 'three';
import { createHumanoid, animateHumanoid, createCloak } from './Humanoid.js';
import { heightAt } from '../world/Terrain.js';
import { dampAngle, angleDiff, clamp } from '../engine/math.js';
import { glowSprite } from '../world/Props.js';

function markerSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(40,25,5,0.9)';
  ctx.strokeText('!', 32, 34);
  ctx.fillStyle = '#ffd35a';
  ctx.fillText('!', 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.setScalar(0.7);
  return s;
}

// Oswin the Wanderer: an old traveller with a cloak, beard and lantern staff.
export class NPC {
  constructor(scene, x, z, facing) {
    const h = (this.h = createHumanoid({ skin: 0xd9a883, shirt: 0x566070, pants: 0x4a3b2c, hair: 0xcfcfcf }));
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.1), h.materials.hair);
    beard.position.set(0, 0.12, 0.19);
    beard.castShadow = true;
    h.head.add(beard);
    h.torso.add(createCloak(0x3f4d38));

    const staff = new THREE.Group();
    staff.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.9 })), { castShadow: true }));
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb347, emissiveIntensity: 1.5 }));
    lantern.position.y = 1.02;
    const glow = glowSprite(0xffc46b, 1.2, 0.7);
    glow.position.y = 1.02;
    staff.add(lantern, glow);
    staff.position.set(0, 0.45, 0.05);
    h.handL.add(staff);

    this.mesh = h.root;
    this.mesh.position.set(x, heightAt(x, z), z);
    this.position = this.mesh.position;
    this.baseFacing = facing;
    this.facing = facing;
    this.mesh.rotation.y = facing;
    this.talking = false;
    this.marker = markerSprite();
    this.marker.position.y = 2.45;
    this.mesh.add(this.marker);
    scene.add(this.mesh);
  }

  setMarker(visible) {
    this.marker.visible = visible;
  }

  update(dt, t, playerPos) {
    const dx = playerPos.x - this.position.x, dz = playerPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);
    // Turn to face the player while talking; otherwise just follow them with his eyes.
    this.facing = dampAngle(this.facing, this.talking ? toPlayer : this.baseFacing, 4, dt);
    this.mesh.rotation.y = this.facing;
    const look = dist < 9 ? clamp(angleDiff(this.facing, toPlayer), -1.1, 1.1) : 0;
    this.h.head.rotation.y = dampAngle(this.h.head.rotation.y, look, 5, dt);

    animateHumanoid(this.h, { phase: 0, amount: 0, t });
    this.h.armL.rotation.x = -0.35; // holding the staff out front
    this.marker.position.y = 2.45 + Math.sin(t * 3) * 0.08;
  }
}
