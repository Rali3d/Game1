import * as THREE from 'three';
import { CharacterModel } from './CharacterModel.js';
import { createUprightStaff, STAFF_OFFSET } from './Gear.js';
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

const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();

// A townsperson or traveller. Options:
//   look: appearance { gender, outfit, skin, hair, hairStyle, beard, dye }
//   staff (lantern staff), scale, idle (animation name for standing about)
//   wander: radius to stroll around the spawn point (otherwise the NPC stands still)
// `space` is where they live: the outdoor world or a building interior.
export class NPC {
  constructor(scene, x, z, facing, opts = {}, space) {
    this.space = space;
    this.model = new CharacterModel({ ...opts.look, beard: opts.beard ?? opts.look?.beard });
    const m = this.model;
    if (opts.staff) this.addStaff();

    this.mesh = m.root;
    this.mesh.scale.setScalar(opts.scale ?? 1);
    this.mesh.position.set(x, space.groundAt(x, z), z);
    this.position = this.mesh.position;
    this.home = new THREE.Vector3(x, 0, z);
    this.baseFacing = facing;
    this.facing = facing;
    this.mesh.rotation.y = facing;
    this.wander = opts.wander ?? 0;
    this.idleAnim = opts.idle ?? 'idle';
    this.target = this.home.clone();
    this.wait = rand(1, 4);
    this.speedNow = 0;
    this.headYaw = 0;
    this.talking = false;
    // A collider that moves with the NPC so the player can't walk through them.
    this.collider = { x, z, r: 0.42 * (opts.scale ?? 1), dynamic: true };
    m.loop(this.idleAnim, { fade: 0 });
    m.mixer.setTime(Math.random() * 3); // so a crowd isn't breathing in unison

    this.marker = markerSprite();
    this.marker.position.y = 2.3;
    this.mesh.add(this.marker);
    scene.add(this.mesh);
  }

  // A lantern-topped walking staff, kept upright beside the right hand.
  addStaff() {
    const staff = createUprightStaff();
    const glow = glowSprite(0xffc46b, 1.0, 0.7);
    glow.position.set(0, 0, 1.45);
    staff.add(glow);
    this.model.follow(staff, 'hand_r', STAFF_OFFSET);
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
        speed = 1.3;
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

    this.speedNow = damp(this.speedNow, speed, 8, dt);
    if (this.talking) this.model.loop('talk');
    else this.model.locomote(this.speedNow, this.idleAnim);
    this.model.update(dt);

    // Follow the player with their eyes when nearby: turn the head bone about the world's up axis.
    const look = dist < 9 ? clamp(angleDiff(this.facing, toPlayer), -1.0, 1.0) : 0;
    this.headYaw = dampAngle(this.headYaw, look, 5, dt);
    const head = this.model.head;
    head.parent.getWorldQuaternion(tmpQ).invert();
    head.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(tmpV.copy(UP).applyQuaternion(tmpQ), this.headYaw));

    this.marker.position.y = 2.3 + Math.sin(t * 3) * 0.08;
  }
}
