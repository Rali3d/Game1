import * as THREE from 'three';
import { createHumanoid, animateHumanoid, createWeapon, createCloak } from './Humanoid.js';
import { heightAt, isPond, isWater, WORLD_RADIUS, WATER_LEVEL } from '../world/Terrain.js';
import { clamp, damp, dampAngle, lerp, easeInOut } from '../engine/math.js';
import { events } from '../engine/EventBus.js';
import { ITEMS } from '../data/items.js';

const WALK = 4.8, RUN = 8.5, JUMP = 7.5, GRAVITY = 24, RADIUS = 0.4;

export class Player {
  constructor(scene) {
    this.h = createHumanoid({ shirt: 0x8a7a62, pants: 0x3f3a33 });
    this.mesh = this.h.root;
    scene.add(this.mesh);
    this.weaponMesh = null;
    this.cloak = createCloak(0x6e3b2c);
    this.cloak.visible = false;
    this.h.torso.add(this.cloak);

    this.position = this.mesh.position;
    this.velocity = new THREE.Vector3();
    this.facing = Math.PI; // facing north (-z)
    this.grounded = true;
    this.walkPhase = 0;
    this.moveAmount = 0;
    this.attackTime = -1;
    this.attackDuration = 0.5;
    this.attackProgress = -1;
    this.hitPending = false;
    this.invuln = 0;
    this.sinceHurt = 99;
    this.dead = false;
    this.deadT = 0;
    this.distanceWalked = 0;
    this.getUp = 1; // 0 = lying in the grass, 1 = standing
    this.stats = { level: 1, xp: 0, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, baseAttack: 5 };
    this.equipment = { weapon: null, armor: null };
  }

  get xpToNext() {
    return Math.floor(60 * Math.pow(1.45, this.stats.level - 1));
  }
  get attackPower() {
    return this.stats.baseAttack + (this.stats.level - 1) * 2 + (ITEMS[this.equipment.weapon]?.damage ?? 0);
  }
  get defense() {
    return (this.stats.level - 1) + (ITEMS[this.equipment.armor]?.defense ?? 0);
  }
  get reach() {
    return ITEMS[this.equipment.weapon]?.reach ?? 1.8;
  }
  get swingTime() {
    return ITEMS[this.equipment.weapon]?.speed ?? 0.42;
  }

  equip(id) {
    const item = ITEMS[id];
    if (item?.type === 'weapon' && id !== this.equipment.weapon) {
      this.equipment.weapon = id;
      this.weaponMesh?.removeFromParent();
      this.weaponMesh = createWeapon(id);
      this.h.handR.add(this.weaponMesh);
    }
    if (item?.type === 'armor') this.equipment.armor = id;
    this.cloak.visible = !!this.equipment.armor;
  }

  gainXp(n) {
    const s = this.stats;
    s.xp += n;
    while (s.xp >= this.xpToNext) {
      s.xp -= this.xpToNext;
      s.level++;
      s.maxHp += 15;
      s.maxStamina += 5;
      s.baseAttack += 1;
      s.hp = s.maxHp;
      events.emit('player:levelup', s.level);
    }
  }

  heal(n) {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + n);
  }

  // Returns the damage actually dealt (0 if ignored).
  takeDamage(amount, fromPos) {
    if (this.dead || this.invuln > 0) return 0;
    const dmg = Math.max(1, Math.round(amount - this.defense));
    this.stats.hp -= dmg;
    this.invuln = 0.45;
    this.sinceHurt = 0;
    if (fromPos) {
      const dx = this.position.x - fromPos.x, dz = this.position.z - fromPos.z;
      const l = Math.hypot(dx, dz) || 1;
      this.velocity.x += (dx / l) * 6;
      this.velocity.z += (dz / l) * 6;
    }
    events.emit('player:hurt', dmg);
    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
      this.dead = true;
      this.deadT = 0;
      this.attackTime = -1;
      events.emit('player:died');
    }
    return dmg;
  }

  revive(x, z) {
    this.dead = false;
    this.stats.hp = this.stats.maxHp;
    this.stats.stamina = this.stats.maxStamina;
    this.position.set(x, heightAt(x, z), z);
    this.velocity.set(0, 0, 0);
    this.h.body.rotation.x = 0;
    this.h.body.position.y = 0;
    this.invuln = 2;
  }

  startAttack() {
    if (this.dead || this.attackTime >= 0 || this.stats.stamina < 6) return false;
    this.attackTime = 0;
    this.attackDuration = this.swingTime;
    this.hitPending = true;
    this.stats.stamina -= 6;
    return true;
  }

  update(dt, input, camYaw, world, controlsEnabled) {
    const s = this.stats, pos = this.position;
    this.invuln = Math.max(0, this.invuln - dt);
    this.sinceHurt += dt;

    let mx = 0, mz = 0;
    if (controlsEnabled && !this.dead) {
      const f = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
      const r = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
      // Camera sits at +(sin yaw, cos yaw) from the player, so "forward" is the opposite.
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      mx = fx * f + rx * r;
      mz = fz * f + rz * r;
      const len = Math.hypot(mx, mz);
      if (len > 0) { mx /= len; mz /= len; }
    }
    const moving = mx !== 0 || mz !== 0;
    const running = moving && (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && s.stamina > 1;
    let speed = running ? RUN : WALK;
    if (this.attackTime >= 0) speed *= 0.35;
    const inWater = isWater(pos.x, pos.z, -0.6);
    if (inWater) speed *= 0.55;

    const accel = this.grounded ? 12 : 3;
    this.velocity.x = damp(this.velocity.x, mx * speed, accel, dt);
    this.velocity.z = damp(this.velocity.z, mz * speed, accel, dt);

    if (running) s.stamina = Math.max(0, s.stamina - 22 * dt);
    else if (this.attackTime < 0) s.stamina = Math.min(s.maxStamina, s.stamina + 20 * dt);

    if (controlsEnabled && !this.dead && input.wasPressed('Space') && this.grounded && s.stamina >= 10) {
      this.velocity.y = JUMP;
      this.grounded = false;
      s.stamina -= 10;
    }
    this.velocity.y -= GRAVITY * dt;

    const px = pos.x, pz = pos.z;
    pos.addScaledVector(this.velocity, dt);
    world.collide(pos, RADIUS);
    const d = Math.hypot(pos.x, pos.z);
    if (d > WORLD_RADIUS) {
      pos.x *= WORLD_RADIUS / d;
      pos.z *= WORLD_RADIUS / d;
    }

    let ground = heightAt(pos.x, pos.z);
    if (isPond(pos.x, pos.z)) ground = Math.max(ground, WATER_LEVEL - 1.1); // swim at the pond's surface
    // Stick to the ground when walking downhill instead of hopping off every bump.
    if (pos.y <= ground || (this.grounded && this.velocity.y <= 0 && pos.y - ground < 0.4)) {
      pos.y = ground;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    this.distanceWalked += Math.hypot(pos.x - px, pos.z - pz);
    if (moving) this.facing = dampAngle(this.facing, Math.atan2(mx, mz), 12, dt);
    this.mesh.rotation.y = this.facing;

    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    this.moveAmount = damp(this.moveAmount, clamp(hs / WALK, 0, 1.3), 10, dt);
    this.walkPhase += dt * hs * 1.9;

    this.attackProgress = -1;
    if (this.attackTime >= 0) {
      this.attackTime += dt;
      this.attackProgress = this.attackTime / this.attackDuration;
      if (this.attackProgress >= 1) {
        this.attackTime = -1;
        this.attackProgress = -1;
      }
    }

    if (!this.dead && this.sinceHurt > 5 && s.hp < s.maxHp) this.heal(2 * dt);

    animateHumanoid(this.h, { phase: this.walkPhase, amount: this.moveAmount, attack: this.attackProgress, t: performance.now() / 1000 });

    // Lying in the grass at the start, and collapsing on death.
    let lie = 1 - easeInOut(this.getUp);
    if (this.dead) {
      this.deadT += dt;
      lie = easeInOut(Math.min(1, this.deadT * 1.6));
    }
    this.h.body.rotation.x = -Math.PI / 2 * lie;
    this.h.body.position.y = lerp(0, 0.18, lie);

    this.mesh.visible = this.invuln <= 0 || this.dead || Math.floor(this.invuln * 20) % 2 === 0;
  }
}
