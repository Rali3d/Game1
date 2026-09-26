import * as THREE from 'three';
import { CharacterModel, normaliseAppearance, SKIN_TONES } from './CharacterModel.js';
import { createWeapon, createHandLantern, GRIP_R, GRIP_POS, SHEATH_POS, SHEATH_ROT, SHEATH_POS_LONG, SHEATH_ROT_LONG, LANTERN_OFFSET } from './Gear.js';
import { clamp, damp, dampAngle } from '../engine/math.js';
import { events } from '../engine/EventBus.js';
import { ITEMS } from '../data/items.js';

const WALK = 4.8, RUN = 8.5, JUMP = 7.5, GRAVITY = 24, RADIUS = 0.4;

export const DEFAULT_APPEARANCE = normaliseAppearance({
  gender: 'male', outfit: 'peasant', skin: SKIN_TONES[1], hair: 0x3a2a1a, hairStyle: 'parted', beard: false, dye: 0xffffff,
});

// The player moves through a "space" (the outdoor world, a building interior or a cave). A space provides
// groundAt(x, z), collide(pos, r), clamp(pos) and inWater(x, z).
export class Player {
  constructor(scene, appearance = DEFAULT_APPEARANCE) {
    this.scene = scene;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.facing = Math.PI; // facing north (-z)
    this.grounded = true;
    this.airTime = 0;
    this.attackTime = -1;
    this.attackDuration = 0.5;
    this.attackProgress = -1;
    this.castTime = -1;
    this.hitPending = false;
    this.invuln = 0;
    this.sinceHurt = 99;
    this.dead = false;
    this.deadT = 0;
    this.lying = false;
    this.distanceWalked = 0;
    this.lanternOn = false;
    this.stats = {
      level: 1, xp: 0, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, mana: 50, maxMana: 50, baseAttack: 5,
    };
    this.equipment = { weapon: null, armor: null };

    // The lantern light lives on the player so it follows them into every scene.
    this.light = new THREE.PointLight(0xffc27a, 0, 18, 1.5);
    this.light.position.set(0.25, 1.3, 0.35);
    this.setAppearance(appearance);
  }

  // (Re)builds the body, keeping position, equipment and lantern.
  setAppearance(appearance) {
    this.appearance = normaliseAppearance(appearance);
    const parent = this.mesh?.parent ?? this.scene;
    this.model?.dispose();
    this.model = new CharacterModel(this.appearance);
    this.mesh = this.model.root;
    this.mesh.position.copy(this.position);
    this.position = this.mesh.position;
    this.mesh.rotation.y = this.facing;
    this.mesh.add(this.light);
    this.lanternMesh = createHandLantern();
    this.model.follow(this.lanternMesh, 'hand_l', LANTERN_OFFSET);
    const weapon = this.equipment.weapon;
    this.equipment.weapon = null;
    this.weaponMesh = null;
    if (weapon) this.equip(weapon);
    this.applyArmorVisual();
    this.setLantern(this.lanternOn);
    if (this.lying) this.lie();
    else this.model.loop('idle', { fade: 0 });
    parent.add(this.mesh);
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
      if (this.weaponMesh) this.model.unfollow(this.weaponMesh);
      this.weaponMesh = createWeapon(id);
      this.sheathe();
    }
    if (item?.type === 'armor') {
      this.equipment.armor = id;
      this.applyArmorVisual();
    }
  }

  // Weapons ride on your back and come into your hand to fight (there's no "walk with a sword" animation,
  // and a hanging, swinging hand makes a held blade flail about).
  sheathe() {
    const w = this.weaponMesh;
    if (!w) return;
    this.drawn = false;
    const long = ['spear', 'staff'].includes(ITEMS[this.equipment.weapon]?.model);
    this.model.follow(w, 'spine_03', long ? SHEATH_POS_LONG : SHEATH_POS);
    w.quaternion.copy(long ? SHEATH_ROT_LONG : SHEATH_ROT);
  }

  draw() {
    const w = this.weaponMesh;
    if (!w) return;
    this.drawnT = 2.5; // seconds before it goes back on your back
    if (this.drawn) return;
    this.drawn = true;
    this.model.unfollow(w);
    this.model.handR.add(w);
    w.rotation.copy(GRIP_R);
    w.position.copy(GRIP_POS);
  }

  // Body armour dyes the outfit. Cloaks don't show: the models have no cloth that fits the characters.
  applyArmorVisual() {
    const armor = ITEMS[this.equipment.armor];
    const dye = new THREE.Color(armor?.visual === 'body' ? armor.tint : this.appearance.dye).lerp(new THREE.Color(0xffffff), 0.55);
    for (const m of this.model.materials) if (/Peasant|Ranger/.test(m.name)) m.color.copy(dye);
  }

  setLantern(on) {
    this.lanternOn = on;
    this.light.intensity = on ? 16 : 0;
    this.lanternMesh.visible = on;
  }

  // Lying on your back in the grass (before waking, and before the intro).
  lie() {
    this.lying = true;
    this.model.pose('getUp', 0);
  }

  // Get up from lying down; takes about `duration` seconds.
  standUp(duration = 1.8) {
    const act = this.model.action('getUp');
    act.paused = false;
    act.timeScale = act.getClip().duration / duration;
    this.model.oneShot = { action: act, hold: false, onDone: () => {
      this.lying = false;
      this.model.reset('idle');
    } };
  }

  gainXp(n) {
    const s = this.stats;
    s.xp += n;
    while (s.xp >= this.xpToNext) {
      s.xp -= this.xpToNext;
      s.level++;
      s.maxHp += 15;
      s.maxStamina += 5;
      s.maxMana += 5;
      s.baseAttack += 1;
      s.hp = s.maxHp;
      s.mana = s.maxMana;
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
      this.castTime = -1;
      this.model.once('death', { hold: true });
      events.emit('player:died');
    } else if (this.attackTime < 0 && this.castTime < 0) {
      this.model.once('hit', { duration: 0.45 });
    }
    return dmg;
  }

  revive(x, y, z) {
    this.dead = false;
    this.stats.hp = this.stats.maxHp;
    this.stats.stamina = this.stats.maxStamina;
    this.stats.mana = this.stats.maxMana;
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.model.reset('idle');
    this.invuln = 2;
  }

  startAttack() {
    if (this.dead || this.lying || this.attackTime >= 0 || this.castTime >= 0 || this.stats.stamina < 6) return false;
    this.attackTime = 0;
    this.attackDuration = this.swingTime;
    this.hitPending = true;
    this.stats.stamina -= 6;
    this.draw();
    // Alternate between two swings so repeated attacks don't look identical.
    this.swingAlt = !this.swingAlt;
    this.model.once(this.swingAlt ? 'attack' : 'attackB', { duration: this.attackDuration * 1.5 });
    return true;
  }

  // Casting is a short thrust of the hand; the spell system spawns the projectile.
  startCast(cost) {
    if (this.dead || this.lying || this.castTime >= 0 || this.attackTime >= 0 || this.stats.mana < cost) return false;
    this.stats.mana -= cost;
    this.castTime = 0;
    this.model.once('cast', { duration: 0.6 });
    return true;
  }

  update(dt, input, camYaw, space, controlsEnabled) {
    const s = this.stats, pos = this.position;
    this.invuln = Math.max(0, this.invuln - dt);
    this.sinceHurt += dt;
    const canMove = controlsEnabled && !this.dead && !this.lying;

    let mx = 0, mz = 0;
    if (canMove) {
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
    // Running out of stamina leaves you winded until it's a third full again, rather than stuttering
    // between a run and a walk every frame as it trickles back.
    if (s.stamina <= 0.5) this.winded = true;
    else if (s.stamina > 30) this.winded = false;
    const running = moving && (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && !this.winded;
    let speed = running ? RUN : WALK;
    if (this.attackTime >= 0 || this.castTime >= 0) speed *= 0.35;
    const swimming = space.inWater(pos.x, pos.z);
    if (swimming) speed *= 0.55;

    const accel = this.grounded ? 12 : 3;
    this.velocity.x = damp(this.velocity.x, mx * speed, accel, dt);
    this.velocity.z = damp(this.velocity.z, mz * speed, accel, dt);

    if (running) s.stamina = Math.max(0, s.stamina - 22 * dt);
    else if (this.attackTime < 0) s.stamina = Math.min(s.maxStamina, s.stamina + 20 * dt);
    s.mana = Math.min(s.maxMana, s.mana + 3 * dt);

    if (canMove && input.wasPressed('Space') && this.grounded && s.stamina >= 10) {
      this.velocity.y = JUMP;
      this.grounded = false;
      this.jumped = true;
      s.stamina -= 10;
    }
    this.velocity.y -= GRAVITY * dt;

    const px = pos.x, pz = pos.z;
    pos.addScaledVector(this.velocity, dt);
    space.collide(pos, RADIUS);
    space.clamp(pos);

    const ground = space.groundAt(pos.x, pos.z);
    // Stick to the ground when walking downhill instead of hopping off every bump.
    if (pos.y <= ground || (this.grounded && this.velocity.y <= 0 && pos.y - ground < 0.4)) {
      pos.y = ground;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    if (this.grounded) this.jumped = false;

    this.distanceWalked += Math.hypot(pos.x - px, pos.z - pz);
    if (moving) this.facing = dampAngle(this.facing, Math.atan2(mx, mz), 12, dt);
    this.mesh.rotation.y = this.facing;

    this.attackProgress = -1;
    if (this.attackTime >= 0) {
      this.attackTime += dt;
      this.attackProgress = this.attackTime / this.attackDuration;
      if (this.attackProgress >= 1) {
        this.attackTime = -1;
        this.attackProgress = -1;
      }
    }
    if (this.castTime >= 0) {
      this.castTime += dt;
      if (this.castTime > 0.45) this.castTime = -1;
    }

    if (!this.dead && this.sinceHurt > 5 && s.hp < s.maxHp) this.heal(2 * dt);
    if (this.drawn && this.attackTime < 0 && (this.drawnT -= dt) <= 0) this.sheathe();

    // Animation: locomotion loops underneath one-shots (attacks, casting, hits, death).
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    if (!this.dead && !this.lying) {
      if (swimming) this.model.loop(hs > 0.5 ? 'Swim_Fwd_Loop' : 'Swim_Idle_Loop');
      // Only show the jump pose for real jumps and long falls, not every little bump when running downhill.
      else if ((this.jumped && this.airTime > 0.05) || this.airTime > 0.45) this.model.loop('jump', { fade: 0.15 });
      else this.model.locomote(clamp(hs, 0, RUN));
    }
    this.model.update(dt);

    const t = performance.now() / 1000;
    if (this.lanternOn) this.light.intensity = 16 + Math.sin(t * 9) * 0.8;
    if (this.dead) this.deadT += dt;
    this.mesh.visible = this.invuln <= 0 || this.dead || Math.floor(this.invuln * 20) % 2 === 0;
  }
}
