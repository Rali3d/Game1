import * as THREE from 'three';
import { heightAt, isWater } from '../world/Terrain.js';
import { damp, dampAngle, rand } from '../engine/math.js';
import { events } from '../engine/EventBus.js';

export const ENEMY_TYPES = {
  slime: {
    name: 'Meadow Slime', hp: 22, damage: 6, speed: 1.6, chaseSpeed: 3.2, aggro: 10, reach: 1.5,
    windup: 0.45, cooldown: 1.4, xp: 14, radius: 0.6,
    loot: [['slime_gel', 0.6], ['herb', 0.15]],
  },
  wolf: {
    name: 'Grey Wolf', hp: 45, damage: 11, speed: 2.0, chaseSpeed: 6.0, aggro: 16, reach: 1.9,
    windup: 0.35, cooldown: 1.1, xp: 32, radius: 0.7,
    loot: [['wolf_pelt', 0.6], ['potion', 0.08]],
  },
};

const stdMat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
function part(parent, geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// States: wander -> chase (sees player) -> return (lost player / leashed) -> wander.
export class Enemy {
  constructor(type, x, z, scene) {
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.scene = scene;
    this.hp = this.def.hp;
    this.alive = true;
    this.removed = false;
    this.home = new THREE.Vector3(x, 0, z);
    this.size = type === 'slime' ? rand(0.85, 1.25) : 1;
    this.mesh = type === 'slime' ? this.buildSlime() : this.buildWolf();
    this.position = this.mesh.position;
    this.position.set(x, heightAt(x, z), z);
    scene.add(this.mesh);

    this.facing = rand(0, Math.PI * 2);
    this.state = 'wander';
    this.target = new THREE.Vector3(x, 0, z);
    this.wait = rand(0, 3);
    this.attackCd = 0;
    this.windup = -1;
    this.knock = new THREE.Vector3();
    this.flash = 0;
    this.aggroTimer = 0;
    this.deathT = 0;
    this.phase = rand(0, 10);
    this.speedNow = 0;
    this.lunge = 0;
    this.buildHealthBar();
  }

  buildSlime() {
    const g = new THREE.Group();
    const color = new THREE.Color().setHSL(0.28 + rand(-0.04, 0.06), 0.6, 0.5);
    const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.25, transparent: true, opacity: 0.86 });
    this.pivot = new THREE.Group();
    g.add(this.pivot);
    part(this.pivot, new THREE.SphereGeometry(0.6, 20, 14), skin, 0, 0.5, 0);
    part(this.pivot, new THREE.SphereGeometry(0.22, 10, 8), stdMat(color.clone().multiplyScalar(0.45)), 0, 0.45, 0);
    const eye = stdMat(0x111111, { roughness: 0.3 });
    part(this.pivot, new THREE.SphereGeometry(0.07, 8, 6), eye, -0.18, 0.62, 0.5);
    part(this.pivot, new THREE.SphereGeometry(0.07, 8, 6), eye, 0.18, 0.62, 0.5);
    g.scale.setScalar(this.size);
    this.materials = [skin];
    this.barHeight = 1.5 * this.size;
    return g;
  }

  buildWolf() {
    const g = new THREE.Group();
    const fur = stdMat(new THREE.Color().setHSL(0.08, 0.06, rand(0.3, 0.45)), { flatShading: true });
    const dark = stdMat(0x2a2724);
    part(g, new THREE.BoxGeometry(0.5, 0.48, 1.15), fur, 0, 0.78, 0);
    part(g, new THREE.BoxGeometry(0.58, 0.56, 0.42), fur, 0, 0.82, 0.36);
    this.head = new THREE.Group();
    this.head.position.set(0, 1.0, 0.72);
    g.add(this.head);
    part(this.head, new THREE.BoxGeometry(0.36, 0.34, 0.38), fur, 0, 0, 0);
    part(this.head, new THREE.BoxGeometry(0.2, 0.17, 0.32), fur, 0, -0.06, 0.3);
    part(this.head, new THREE.BoxGeometry(0.08, 0.07, 0.06), dark, 0, -0.02, 0.47);
    part(this.head, new THREE.ConeGeometry(0.07, 0.18, 4), fur, -0.11, 0.22, -0.05);
    part(this.head, new THREE.ConeGeometry(0.07, 0.18, 4), fur, 0.11, 0.22, -0.05);
    const eyes = new THREE.MeshBasicMaterial({ color: 0xffd84a }); // glow in the dark
    part(this.head, new THREE.BoxGeometry(0.06, 0.04, 0.02), eyes, -0.1, 0.05, 0.195);
    part(this.head, new THREE.BoxGeometry(0.06, 0.04, 0.02), eyes, 0.1, 0.05, 0.195);
    this.legs = [];
    for (const [lx, lz] of [[-0.17, 0.4], [0.17, 0.4], [-0.17, -0.4], [0.17, -0.4]]) {
      const leg = new THREE.Group();
      leg.position.set(lx, 0.62, lz);
      g.add(leg);
      part(leg, new THREE.BoxGeometry(0.13, 0.56, 0.14), fur, 0, -0.28, 0);
      part(leg, new THREE.BoxGeometry(0.15, 0.08, 0.18), dark, 0, -0.58, 0.02);
      this.legs.push(leg);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.92, -0.58);
    tail.rotation.x = -0.6;
    g.add(tail);
    part(tail, new THREE.BoxGeometry(0.1, 0.1, 0.5), fur, 0, 0, -0.25);
    this.tail = tail;
    this.materials = [fur];
    this.barHeight = 1.7;
    return g;
  }

  buildHealthBar() {
    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.11),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthTest: false, fog: false }));
    const fillGeo = new THREE.PlaneGeometry(0.96, 0.07).translate(0.48, 0, 0);
    this.barFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xe04b3a, depthTest: false, fog: false }));
    this.barFill.position.set(-0.48, 0, 0.001);
    bg.renderOrder = 998;
    this.barFill.renderOrder = 999;
    this.bar.add(bg, this.barFill);
    this.bar.visible = false;
    this.scene.add(this.bar);
  }

  takeDamage(amount, fromPos) {
    if (!this.alive) return;
    this.hp -= amount;
    this.flash = 0.15;
    this.aggroTimer = 8;
    this.state = 'chase';
    const dx = this.position.x - fromPos.x, dz = this.position.z - fromPos.z;
    const l = Math.hypot(dx, dz) || 1;
    this.knock.set((dx / l) * 7, 0, (dz / l) * 7);
    if (this.windup >= 0 && this.windup < 0.2) this.windup = -1; // early hits interrupt the attack
    if (this.hp <= 0) {
      this.alive = false;
      this.bar.visible = false;
      events.emit('enemy:killed', { enemy: this });
    }
  }

  dispose() {
    this.mesh.removeFromParent();
    this.bar.removeFromParent();
    const toDispose = [this.mesh, this.bar];
    for (const root of toDispose) {
      root.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose?.();
      });
    }
    this.removed = true;
  }

  update(dt, player, world, camera, night) {
    const d = this.def, pos = this.position;
    if (!this.alive) {
      this.deathT += dt;
      const k = Math.max(0.01, 1 - this.deathT * 1.6);
      this.mesh.scale.set(this.size * (1 + (1 - k) * 0.4), this.size * k, this.size * (1 + (1 - k) * 0.4));
      if (this.deathT > 0.65) this.dispose();
      return;
    }

    this.attackCd -= dt;
    this.flash = Math.max(0, this.flash - dt);
    this.aggroTimer -= dt;
    this.phase += dt;
    this.lunge = Math.max(0, this.lunge - dt);

    const px = player.position.x - pos.x, pz = player.position.z - pos.z;
    const dist = Math.hypot(px, pz);
    const hidden = player.dead || world.isSafe(player.position.x, player.position.z);
    const aggro = d.aggro * (1 + 0.35 * night); // wolves hunt further at night
    const leash = Math.hypot(pos.x - this.home.x, pos.z - this.home.z);

    if (this.state !== 'chase') {
      if (!hidden && (dist < aggro || this.aggroTimer > 0)) this.state = 'chase';
    } else if (hidden || (dist > aggro * 2 && this.aggroTimer <= 0) || leash > 55) {
      this.state = 'return';
      this.windup = -1;
    }

    let tx = pos.x, tz = pos.z, speed = 0;
    if (this.state === 'wander') {
      if (this.wait > 0) this.wait -= dt;
      else if (Math.hypot(this.target.x - pos.x, this.target.z - pos.z) < 0.6) {
        this.wait = rand(1.5, 5);
        const a = rand(0, Math.PI * 2), r = rand(2, 9);
        this.target.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
      } else {
        tx = this.target.x; tz = this.target.z; speed = d.speed;
      }
    } else if (this.state === 'return') {
      tx = this.home.x; tz = this.home.z; speed = d.speed * 1.6;
      if (leash < 2) {
        this.state = 'wander';
        this.hp = d.hp;
      }
    } else if (this.windup >= 0) {
      this.windup += dt;
      if (this.windup >= d.windup) {
        this.windup = -1;
        this.attackCd = d.cooldown;
        this.lunge = 0.2;
        if (dist < d.reach + 0.5) player.takeDamage(d.damage * rand(0.85, 1.15), pos);
      }
    } else if (dist < d.reach) {
      if (this.attackCd <= 0) this.windup = 0;
    } else {
      tx = player.position.x; tz = player.position.z; speed = d.chaseSpeed;
    }

    let mx = 0, mz = 0;
    if (speed > 0) {
      const dx = tx - pos.x, dz = tz - pos.z, l = Math.hypot(dx, dz);
      if (l > 0.01) {
        mx = dx / l; mz = dz / l;
        this.facing = dampAngle(this.facing, Math.atan2(mx, mz), 6, dt);
      }
    } else if (this.state === 'chase') {
      this.facing = dampAngle(this.facing, Math.atan2(px, pz), 8, dt);
    }

    // Slimes only move while airborne in their hop.
    const hop = Math.max(0, Math.sin(this.phase * 6));
    const move = this.type === 'slime' && speed > 0 ? speed * hop * 1.8 : speed;
    this.speedNow = damp(this.speedNow, move, 8, dt);

    const ox = pos.x, oz = pos.z;
    pos.x += (mx * this.speedNow + this.knock.x) * dt;
    pos.z += (mz * this.speedNow + this.knock.z) * dt;
    this.knock.multiplyScalar(Math.exp(-6 * dt));
    world.collide(pos, d.radius * 0.8);
    // Stay out of the pond and out of the safe camp.
    if (isWater(pos.x, pos.z, 0.1) || world.isSafe(pos.x, pos.z)) {
      pos.x = ox; pos.z = oz;
      this.target.copy(this.home);
    }
    const ground = heightAt(pos.x, pos.z);
    this.mesh.rotation.y = this.facing;

    if (this.type === 'slime') {
      const airborne = speed > 0 ? hop * 0.55 : 0;
      pos.y = ground + airborne;
      let sy = 1 + Math.sin(this.phase * 3) * 0.04;
      if (speed > 0) sy = 1 + (hop - 0.3) * 0.3;
      if (this.windup >= 0) sy = 1 - 0.35 * (this.windup / d.windup);
      if (this.lunge > 0) sy = 1.3;
      this.pivot.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    } else {
      pos.y = ground;
      const swing = Math.sin(this.phase * 12) * Math.min(1, this.speedNow / 3) * 0.7;
      this.legs.forEach((leg, i) => (leg.rotation.x = (i === 0 || i === 3 ? 1 : -1) * swing));
      this.head.rotation.x = this.windup >= 0 ? 0.4 : this.lunge > 0 ? -0.3 : 0;
      this.tail.rotation.y = Math.sin(this.phase * 4) * 0.3;
    }

    const f = (this.flash / 0.15) * 0.9;
    for (const m of this.materials) m.emissive.setRGB(f, f * 0.35, f * 0.35);

    this.bar.visible = this.hp < d.hp && this.state === 'chase';
    if (this.bar.visible) {
      this.bar.position.set(pos.x, pos.y + this.barHeight, pos.z);
      this.bar.quaternion.copy(camera.quaternion);
      this.barFill.scale.x = Math.max(0.001, this.hp / d.hp);
    }
  }
}
