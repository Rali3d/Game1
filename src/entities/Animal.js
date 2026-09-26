import * as THREE from 'three';
import { AnimalModel } from './Creatures.js';
import { dampAngle, rand } from '../engine/math.js';

// A farm animal that grazes and strolls around its pasture, and shies away from the player.
// Only the cow and horse have walk and run cycles; the others hop when they move.
const RADIUS = { Cow: 0.7, Horse: 0.7, Sheep: 0.5, Pig: 0.45, Llama: 0.55, Pug: 0.25 };

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
    this.facing = rand(0, Math.PI * 2);
    this.target = this.position.clone();
    this.wait = rand(0, 6);
    this.collider = { x, z, r: RADIUS[kind] ?? 0.5 };
    space.colliders.push(this.collider);
    this.model.loop('idle', { fade: 0 });
    this.model.mixer.setTime(Math.random() * 3);
    space.scene.add(this.mesh);
  }

  update(dt, playerPos) {
    const p = this.position;
    if (this.follows) {
      this.home.copy(this.follows.position);
      if (Math.hypot(p.x - this.home.x, p.z - this.home.z) > this.range * 1.5) this.wait = 0; // keep up
    }
    const px = p.x - playerPos.x, pz = p.z - playerPos.z;
    const near = Math.hypot(px, pz);
    let speed = 0;

    if (near < this.shy) {
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
];
