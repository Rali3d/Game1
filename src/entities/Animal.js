import * as THREE from 'three';
import { AnimalModel } from './Creatures.js';
import { dampAngle, rand } from '../engine/math.js';

// A farm animal that grazes and strolls around its pasture, and shies away from the player.
// Only the cow and horse have walk and run cycles; the others hop when they move.
const RADIUS = { Cow: 0.7, Horse: 0.7, Sheep: 0.5, Pig: 0.45, Llama: 0.55, Pug: 0.25 };
const HP = { Cow: 40, Horse: 50, Sheep: 20, Pig: 25, Llama: 30 }; // Pip's dog can't be hurt

export class Animal {
  constructor(kind, x, z, space, opts = {}) {
    this.kind = kind;
    this.space = space;
    this.model = new AnimalModel(kind);
    this.mesh = this.model.root;
    this.position = this.mesh.position;
    this.position.set(x, space.groundAt(x, z), z);
    this.home = new THREE.Vector3(x, 0, z);
    this.range = opts.range ?? 14;
    this.shy = opts.shy ?? 4.5;
    this.follows = opts.follows; // a pet trots after its owner instead of keeping to a pasture
    this.maxHp = this.follows ? 0 : HP[kind] ?? 0;
    this.hp = this.maxHp;
    this.dead = false;
    this.panic = 0;
    this.facing = rand(0, Math.PI * 2);
    this.target = this.position.clone();
    this.wait = rand(0, 6);
    this.collider = { x, z, r: RADIUS[kind] ?? 0.5, dynamic: true };
    space.colliders.push(this.collider);
    this.model.loop('idle', { fade: 0 });
    this.model.mixer.setTime(Math.random() * 3);
    space.scene.add(this.mesh);
  }

  // Returns true if the blow killed it.
  takeDamage(amount, from) {
    if (this.dead || !this.hp) return false;
    this.hp -= amount;
    this.panic = 6; // bolt, and keep running a while
    const dx = this.position.x - from.x, dz = this.position.z - from.z, l = Math.hypot(dx, dz) || 1;
    this.target.set(this.position.x + (dx / l) * 14, 0, this.position.z + (dz / l) * 14);
    if (this.hp > 0) return false;
    this.dead = true;
    this.deadT = 0;
    this.respawnT = 240;
    this.collider.x = this.collider.z = Infinity; // nothing to bump into once it's down
    this.model.once('death', { hold: true });
    return true;
  }

  revive() {
    this.dead = false;
    this.gone = false;
    this.hp = this.maxHp;
    this.position.set(this.home.x, this.space.groundAt(this.home.x, this.home.z), this.home.z);
    this.target.copy(this.position);
    this.mesh.visible = true;
    this.model.reset('idle');
  }

  update(dt, playerPos) {
    const p = this.position;
    if (this.dead) {
      // Lie there a moment, then sink out of sight.
      this.deadT += dt;
      if (this.deadT > 3) p.y -= dt * 0.5;
      if (this.deadT > 5) { this.gone = true; this.mesh.visible = false; }
      this.model.update(dt);
      return;
    }
    this.panic = Math.max(0, this.panic - dt);
    if (this.follows) {
      this.home.copy(this.follows.position);
      if (Math.hypot(p.x - this.home.x, p.z - this.home.z) > this.range * 1.5) this.wait = 0; // keep up
    }
    const px = p.x - playerPos.x, pz = p.z - playerPos.z;
    const near = Math.hypot(px, pz);
    let speed = 0;

    if (this.panic > 0 && Math.hypot(this.target.x - p.x, this.target.z - p.z) > 0.5) {
      speed = this.model.canWalk ? 6 : 3;
    } else if (near < this.shy) {
      // Trot away from the player, but not too far from the pasture.
      speed = this.model.canWalk ? 4.5 : 2.4;
      this.target.set(p.x + (px / near) * 6, 0, p.z + (pz / near) * 6);
      this.target.x = this.home.x + THREE.MathUtils.clamp(this.target.x - this.home.x, -this.range, this.range);
      this.target.z = this.home.z + THREE.MathUtils.clamp(this.target.z - this.home.z, -this.range, this.range);
      this.wait = rand(2, 5);
    }
    const tx = this.target.x - p.x, tz = this.target.z - p.z;
    const td = Math.hypot(tx, tz);
    if (td > 0.4 && (speed || this.wait <= 0)) {
      speed ||= this.model.canWalk ? 1.1 : 1.4;
      this.facing = dampAngle(this.facing, Math.atan2(tx, tz), speed > 2 ? 8 : 3, dt);
      const step = Math.min(speed * dt, td);
      p.x += Math.sin(this.facing) * step;
      p.z += Math.cos(this.facing) * step;
      this.collider.x = Infinity; // don't collide with our own collider
      this.space.collide(p, this.collider.r);
      if (this.space.inWater(p.x, p.z)) { // back out of the pond and pick somewhere else
        p.x -= Math.sin(this.facing) * step;
        p.z -= Math.cos(this.facing) * step;
        this.target.copy(p);
      }
    } else if (td <= 0.4) {
      if ((this.wait -= dt) <= 0) {
        const a = rand(0, Math.PI * 2), r = rand(0, this.range);
        this.target.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
        this.wait = rand(3, 10);
      }
    } else this.wait -= dt;

    p.y = this.space.groundAt(p.x, p.z);
    this.collider.x = p.x;
    this.collider.z = p.z;
    this.mesh.rotation.y = this.facing;

    const m = this.model;
    // Far-off animals are hidden by fog anyway; don't spend time animating them.
    if (near > 110) return;
    if (!speed) m.loop('idle');
    else if (!m.canWalk) m.loop('hop', { speed: speed / 1.6 });
    else m.loop(speed > 3 ? 'run' : 'walk');
    m.update(dt);
  }
}

// Pastures around the valley, clear of the towns and roads.
export const HERDS = [
  { kind: 'Cow', x: -45, z: 50, count: 4 },
  { kind: 'Sheep', x: 22, z: 62, count: 6 },
  { kind: 'Horse', x: -60, z: -80, count: 3 },
  { kind: 'Pig', x: 88, z: 12, count: 4, range: 8 },
  { kind: 'Llama', x: 52, z: 88, count: 3 },
  { kind: 'Sheep', x: 470, z: -80, count: 5 }, // Amberly's hill pasture
  { kind: 'Pig', x: 390, z: 20, count: 3, range: 8 },
  { kind: 'Llama', x: 70, z: -430, count: 4 }, // Frosthold
  { kind: 'Cow', x: 230, z: 220, count: 4 }, // Stillwater
  { kind: 'Pig', x: 30, z: 400, count: 3, range: 8 }, // Fenwick
  { kind: 'Horse', x: -400, z: 40, count: 4 }, // Oldgate
];
