import * as THREE from 'three';
import { createHumanoid, animateHumanoid, createCape } from './Humanoid.js';
import { damp, dampAngle, angleDiff, clamp, rand } from '../engine/math.js';
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

// A townsperson or traveller. Options:
//   look: humanoid appearance { gender, skin, shirt, pants, hair, hairStyle, beard }
//   cloak (colour), apron (colour), staff (lantern staff), scale
//   wander: radius to stroll around the spawn point (otherwise the NPC stands still)
// `space` is where they live: the outdoor world or a building interior.
export class NPC {
  constructor(scene, x, z, facing, opts = {}, space) {
    this.space = space;
    const h = (this.h = createHumanoid({ ...opts.look, beard: opts.beard ?? opts.look?.beard }));
    if (opts.cloak) {
      h.cape = createCape(opts.cloak);
      h.torso.add(h.cape);
    }
    if (opts.apron) {
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.85, 0.04),
        new THREE.MeshStandardMaterial({ color: opts.apron, roughness: 0.95 }));
      apron.position.set(0, 0.05, 0.18);
      apron.castShadow = true;
      h.torso.add(apron);
    }
    if (opts.staff) this.addStaff();

    this.mesh = h.root;
    this.mesh.scale.setScalar(opts.scale ?? 1);
    this.mesh.position.set(x, space.groundAt(x, z), z);
    this.position = this.mesh.position;
    this.home = new THREE.Vector3(x, 0, z);
    this.baseFacing = facing;
    this.facing = facing;
    this.mesh.rotation.y = facing;
    this.wander = opts.wander ?? 0;
    this.target = this.home.clone();
    this.wait = rand(1, 4);
    this.walkPhase = 0;
    this.moveAmount = 0;
    this.talking = false;
    // A collider that moves with the NPC so the player can't walk through them.
    this.collider = { x, z, r: 0.45 * (opts.scale ?? 1) };

    this.marker = markerSprite();
    this.marker.position.y = 2.45;
    this.mesh.add(this.marker);
    scene.add(this.mesh);
  }

  addStaff() {
    const staff = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.9 }));
    pole.castShadow = true;
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb347, emissiveIntensity: 1.5 }));
    lantern.position.y = 1.02;
    const glow = glowSprite(0xffc46b, 1.2, 0.7);
    glow.position.y = 1.02;
    staff.add(pole, lantern, glow);
    staff.position.set(0, 0.45, 0.05);
    this.h.handL.add(staff);
    this.hasStaff = true;
  }

  setMarker(visible) {
    this.marker.visible = visible;
  }

  update(dt, t, playerPos) {
    const dx = playerPos.x - this.position.x, dz = playerPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);

    let speed = 0;
    if (this.wander && !this.talking && dist > 2.5) {
      const tx = this.target.x - this.position.x, tz = this.target.z - this.position.z;
      const td = Math.hypot(tx, tz);
      if (this.wait > 0) this.wait -= dt;
      else if (td < 0.4) {
        this.wait = rand(1.5, 5);
        const a = rand(0, Math.PI * 2), r = rand(0, this.wander);
        this.target.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
      } else {
        speed = 1.4;
        this.facing = dampAngle(this.facing, Math.atan2(tx, tz), 6, dt);
        this.position.x += (tx / td) * speed * dt;
        this.position.z += (tz / td) * speed * dt;
        this.collider.x = Infinity; // don't collide with our own collider
        this.space.collide(this.position, this.collider.r);
        this.position.y = this.space.groundAt(this.position.x, this.position.z);
      }
    } else if (this.talking) {
      this.facing = dampAngle(this.facing, toPlayer, 4, dt);
    } else if (!this.wander) {
      this.facing = dampAngle(this.facing, this.baseFacing, 4, dt);
    }
    this.collider.x = this.position.x;
    this.collider.z = this.position.z;
    this.mesh.rotation.y = this.facing;

    // Follow the player with their eyes when nearby.
    const look = dist < 9 ? clamp(angleDiff(this.facing, toPlayer), -1.1, 1.1) : 0;
    this.h.head.rotation.y = dampAngle(this.h.head.rotation.y, look, 5, dt);

    this.moveAmount = damp(this.moveAmount, speed / 3, 8, dt);
    this.walkPhase += dt * speed * 2.6;
    animateHumanoid(this.h, { phase: this.walkPhase, amount: this.moveAmount, t });
    if (this.hasStaff) this.h.armL.rotation.x = -0.35; // holding the staff out front
    this.marker.position.y = 2.45 + Math.sin(t * 3) * 0.08;
  }
}
