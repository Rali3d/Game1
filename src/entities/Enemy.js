import * as THREE from 'three';
import { damp, dampAngle, rand } from '../engine/math.js';
import { events } from '../engine/EventBus.js';
import { CharacterModel } from './CharacterModel.js';
import { MonsterModel } from './Creatures.js';
import { createCape, createUprightStaff, CAPE_OFFSET, STAFF_OFFSET } from './Gear.js';

export const ENEMY_TYPES = {
  slime: {
    name: 'Meadow Slime', hp: 22, damage: 6, speed: 1.6, chaseSpeed: 3.2, aggro: 10, reach: 1.5,
    windup: 0.45, cooldown: 1.4, xp: 14, radius: 0.6, coins: [0, 3],
    loot: [['slime_gel', 0.6], ['herb', 0.15]],
  },
  wolf: {
    name: 'Grey Wolf', hp: 45, damage: 11, speed: 2.0, chaseSpeed: 6.0, aggro: 16, reach: 1.9,
    windup: 0.35, cooldown: 1.1, xp: 32, radius: 0.7, coins: [0, 2],
    loot: [['wolf_pelt', 0.6], ['potion', 0.08]],
  },
  bat: {
    name: 'Cave Bat', hp: 14, damage: 5, speed: 2.5, chaseSpeed: 6.5, aggro: 11, reach: 1.4,
    windup: 0.25, cooldown: 1.0, xp: 12, radius: 0.4, coins: [0, 2],
    loot: [['bat_wing', 0.5]],
  },
  skeleton: {
    name: 'Restless Bones', hp: 60, damage: 13, speed: 1.4, chaseSpeed: 3.4, aggro: 12, reach: 2.0,
    windup: 0.55, cooldown: 1.3, xp: 45, radius: 0.5, coins: [3, 10],
    loot: [['bone', 0.6], ['cave_crystal', 0.2], ['potion', 0.1]],
  },
  imp: {
    name: 'Cave Imp', hp: 42, damage: 10, speed: 1.8, chaseSpeed: 5.0, aggro: 13, reach: 1.7,
    windup: 0.35, cooldown: 1.0, xp: 30, radius: 0.5, coins: [2, 8],
    loot: [['cave_crystal', 0.2], ['mana_potion', 0.12]], model: 'Imp', fallback: 'bat',
  },
  puglin: {
    name: 'Puglin', hp: 30, damage: 8, speed: 1.8, chaseSpeed: 4.6, aggro: 12, reach: 1.3,
    windup: 0.4, cooldown: 1.1, xp: 22, radius: 0.45, coins: [3, 12],
    loot: [['bread', 0.3], ['potion', 0.08]], model: 'Puglin', fallback: 'wolf',
  },
  warden: {
    name: 'Corvin, the Man in Grey', hp: 520, damage: 17, speed: 2.2, chaseSpeed: 4.2, aggro: 40, reach: 2.4,
    windup: 0.5, cooldown: 1.2, xp: 400, radius: 0.55, coins: [0, 0], loot: [], boss: true,
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

// Bestiary monsters are only present when built locally (their files can't be shared in the repo);
// without them, each falls back to a similar creature.
export function availableType(type) {
  const def = ENEMY_TYPES[type];
  return def?.model && !MonsterModel.available(def.model) ? def.fallback : type;
}

// States: wander -> chase (sees player) -> return (lost player / leashed) -> wander.
// Enemies live in a "space" (world or cave) that provides groundAt, collide, isSafe and blocked.
export class Enemy {
  constructor(type, x, z, scene, space) {
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.scene = scene;
    this.space = space;
    this.hp = this.def.hp;
    this.alive = true;
    this.removed = false;
    this.home = new THREE.Vector3(x, 0, z);
    this.size = type === 'slime' ? rand(0.85, 1.25) : 1;
    const builders = {
      slime: 'buildSlime', wolf: 'buildWolf', bat: 'buildBat', skeleton: 'buildSkeleton', warden: 'buildWarden',
      imp: 'buildMonster', puglin: 'buildMonster',
    };
    this.mesh = this[builders[type]]();
    this.position = this.mesh.position;
    this.position.set(x, space.groundAt(x, z), z);
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
    if (!this.def.boss) this.buildHealthBar();
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

  buildBat() {
    const g = new THREE.Group();
    this.pivot = new THREE.Group();
    g.add(this.pivot);
    const skin = stdMat(0x2e2628);
    part(this.pivot, new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 0, 0).scale.set(1, 0.9, 1.2);
    part(this.pivot, new THREE.ConeGeometry(0.05, 0.14, 4), skin, -0.1, 0.18, 0.05);
    part(this.pivot, new THREE.ConeGeometry(0.05, 0.14, 4), skin, 0.1, 0.18, 0.05);
    const eyes = new THREE.MeshBasicMaterial({ color: 0xff4a3a });
    part(this.pivot, new THREE.SphereGeometry(0.03, 6, 4), eyes, -0.07, 0.05, 0.2);
    part(this.pivot, new THREE.SphereGeometry(0.03, 6, 4), eyes, 0.07, 0.05, 0.2);
    const wingMat = stdMat(0x3a2e30, { side: THREE.DoubleSide });
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0.75, 0.05, -0.05, 0, 0, -0.15, 0.55, -0.1, -0.2, 0, 0, -0.15, 0.75, 0.05, -0.05], 3));
    wingGeo.computeVertexNormals();
    this.wings = [1, -1].map((side) => {
      const w = new THREE.Group();
      const m = new THREE.Mesh(wingGeo, wingMat);
      m.scale.x = side;
      w.add(m);
      this.pivot.add(w);
      return w;
    });
    this.materials = [skin];
    this.barHeight = 2.2;
    return g;
  }

  // The restless dead: pale, ragged, shambling, with cold glowing eyes. They claw rather than swing.
  buildSkeleton() {
    const m = (this.model = new CharacterModel({
      gender: Math.random() < 0.5 ? 'male' : 'female', outfit: 'peasant', skin: 0x9aa89a, hair: 0x6a6a60,
      hairStyle: Math.random() < 0.5 ? 'bald' : 'long', dye: 0x5a5a50,
    }));
    const eyes = new THREE.MeshBasicMaterial({ color: 0x7fe0ff });
    for (const x of [-0.035, 0.035]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), eyes);
      eye.position.set(x, 0.1, 0.1); // in front of the eyes, in head-bone space (y up, z forward)
      m.head.add(eye);
    }
    this.materials = m.materials;
    this.barHeight = 2.2;
    this.idleAnim = 'zombieIdle';
    this.walkAnim = 'zombieWalk';
    this.attackAnim = 'zombieAttack';
    m.loop('zombieIdle', { fade: 0 });
    m.mixer.setTime(Math.random() * 3);
    return m.root;
  }

  // Imps and Puglins: Bestiary models driven by the character animation library.
  buildMonster() {
    const m = (this.model = new MonsterModel(this.def.model, 1 + Math.floor(Math.random() * 3)));
    this.materials = m.materials;
    this.barHeight = this.type === 'puglin' ? 1.35 : 2.0;
    this.idleAnim = 'idle';
    this.walkAnim = null; // regular locomotion
    this.attackAnim = this.type === 'puglin' ? 'Punch_Cross' : 'Melee_Hook';
    m.loop('idle', { fade: 0 });
    m.mixer.setTime(Math.random() * 3);
    return m.root;
  }

  // Corvin: tall, grey-cloaked, grey-bearded, with a staff that throws pale orbs.
  buildWarden() {
    const m = (this.model = new CharacterModel({
      gender: 'male', outfit: 'ranger', skin: 0xe8d2c2, hair: 0x9a9da3, hairStyle: 'long', beard: true, dye: 0x6f7378,
    }));
    m.follow(createCape(0x6f7378), 'spine_03', CAPE_OFFSET);
    m.follow(createUprightStaff(), 'hand_r', STAFF_OFFSET);
    this.materials = m.materials;
    this.barHeight = 2.3;
    this.idleAnim = 'idle';
    this.walkAnim = null; // regular locomotion
    this.attackAnim = 'attack';
    this.blinkT = 0;
    this.orbCd = 3;
    this.hitsSinceBlink = 0;
    m.loop('idle', { fade: 0 });
    return m.root;
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

  takeDamage(amount, fromPos, knock = 7) {
    if (!this.alive) return;
    this.hp -= amount;
    this.flash = 0.15;
    this.aggroTimer = 8;
    this.state = 'chase';
    const dx = this.position.x - fromPos.x, dz = this.position.z - fromPos.z;
    const l = Math.hypot(dx, dz) || 1;
    const k = this.def.boss ? knock * 0.3 : knock;
    this.knock.set((dx / l) * k, 0, (dz / l) * k);
    if (this.windup >= 0 && this.windup < 0.2) this.windup = -1; // early hits interrupt the attack
    if (this.def.boss) this.hitsSinceBlink++;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      if (this.bar) this.bar.visible = false;
      events.emit(this.def.boss ? 'boss:defeated' : 'enemy:killed', { enemy: this });
    }
  }

  dispose() {
    this.mesh.removeFromParent();
    this.bar?.removeFromParent();
    // Character models share geometry with the loaded assets, so only their own materials are freed.
    this.model?.dispose();
    for (const root of [this.model ? null : this.mesh, this.bar]) {
      root?.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose?.();
      });
    }
    this.removed = true;
  }

  // Boss behaviour layered on top of the normal chase: blinks away when pressed, and throws orbs.
  wardenTricks(dt, player, spells, dist) {
    this.orbCd -= dt;
    if (this.hitsSinceBlink >= 4) {
      this.hitsSinceBlink = 0;
      const a = Math.random() * Math.PI * 2;
      const nx = player.position.x + Math.cos(a) * 7, nz = player.position.z + Math.sin(a) * 7;
      const test = new THREE.Vector3(nx, 0, nz);
      this.space.collide(test, 0.6);
      events.emit('boss:blink', { from: this.position.clone(), to: test.clone() });
      this.position.x = test.x;
      this.position.z = test.z;
      this.windup = -1;
      this.orbCd = Math.min(this.orbCd, 0.6);
    }
    if (this.orbCd <= 0 && dist > 3 && dist < 20 && spells) {
      const enraged = this.hp < this.def.hp * 0.5;
      this.orbCd = enraged ? 2.2 : 3.4;
      const base = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
      const spread = enraged ? [-0.35, -0.12, 0.12, 0.35] : [-0.25, 0, 0.25];
      for (const s of spread) spells.spawnOrb(this, base + s);
      this.castAnim = 0.4;
    }
  }

  update(dt, player, camera, night, spells) {
    const d = this.def, pos = this.position, space = this.space;
    if (!this.alive) {
      if (d.boss) {
        this.model.update(dt); // the boss's defeat is a scripted scene; keep him animating
        return;
      }
      this.deathT += dt;
      if (this.model) {
        // Characters fall over, lie still a moment, then sink away.
        if (!this.deathStarted) {
          this.deathStarted = true;
          this.model.once('death', { hold: true });
        }
        this.model.update(dt);
        if (this.deathT > 1.8) this.position.y -= dt * 0.8;
        if (this.deathT > 2.6) this.dispose();
        return;
      }
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
    this.castAnim = Math.max(0, (this.castAnim ?? 0) - dt);

    const px = player.position.x - pos.x, pz = player.position.z - pos.z;
    const dist = Math.hypot(px, pz);
    const hidden = player.dead || space.isSafe(player.position.x, player.position.z);
    const aggro = d.aggro * (1 + 0.35 * night); // wolves hunt further at night
    const leash = Math.hypot(pos.x - this.home.x, pos.z - this.home.z);

    if (this.state !== 'chase') {
      if (!hidden && (dist < aggro || this.aggroTimer > 0)) this.state = 'chase';
    } else if (hidden || (dist > aggro * 2 && this.aggroTimer <= 0) || (leash > 55 && !d.boss)) {
      this.state = 'return';
      this.windup = -1;
    }
    if (d.boss && this.state === 'chase') this.wardenTricks(dt, player, spells, dist);

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
    space.collide(pos, d.radius * 0.8);
    // Stay out of water and safe places (towns, camps).
    if (space.blocked(pos.x, pos.z)) {
      pos.x = ox; pos.z = oz;
      this.target.copy(this.home);
    }
    const ground = space.groundAt(pos.x, pos.z);
    this.mesh.rotation.y = this.facing;
    this.animate(dt, ground, speed, hop);

    const f = (this.flash / 0.15) * 0.9;
    for (const m of this.materials) m.emissive.setRGB(f, f * 0.35, f * 0.35);

    if (this.bar) {
      this.bar.visible = this.hp < d.hp && this.state === 'chase';
      if (this.bar.visible) {
        this.bar.position.set(pos.x, pos.y + this.barHeight, pos.z);
        this.bar.quaternion.copy(camera.quaternion);
        this.barFill.scale.x = Math.max(0.001, this.hp / d.hp);
      }
    }
  }

  animate(dt, ground, speed, hop) {
    const d = this.def, pos = this.position;
    if (this.type === 'slime') {
      pos.y = ground + (speed > 0 ? hop * 0.55 : 0);
      let sy = 1 + Math.sin(this.phase * 3) * 0.04;
      if (speed > 0) sy = 1 + (hop - 0.3) * 0.3;
      if (this.windup >= 0) sy = 1 - 0.35 * (this.windup / d.windup);
      if (this.lunge > 0) sy = 1.3;
      this.pivot.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    } else if (this.type === 'wolf') {
      pos.y = ground;
      const swing = Math.sin(this.phase * 12) * Math.min(1, this.speedNow / 3) * 0.7;
      this.legs.forEach((leg, i) => (leg.rotation.x = (i === 0 || i === 3 ? 1 : -1) * swing));
      this.head.rotation.x = this.windup >= 0 ? 0.4 : this.lunge > 0 ? -0.3 : 0;
      this.tail.rotation.y = Math.sin(this.phase * 4) * 0.3;
    } else if (this.type === 'bat') {
      const dive = this.windup >= 0 ? -0.6 * (this.windup / d.windup) : 0;
      pos.y = ground + 1.7 + Math.sin(this.phase * 3) * 0.25 + dive;
      const flap = Math.sin(this.phase * 26) * 0.9;
      this.wings[0].rotation.z = flap;
      this.wings[1].rotation.z = -flap;
    } else {
      pos.y = ground;
      const m = this.model;
      // Start the swing as the wind-up begins, timed so the blow lands when the damage does.
      if (this.windup >= 0 && !this.swinging) {
        this.swinging = true;
        m.once(this.attackAnim, { duration: d.windup + 0.4, onDone: () => (this.swinging = false) });
      }
      if (this.castAnim > 0.35 && !m.busy) m.once('cast', { duration: 0.6 });
      if (this.walkAnim) m.loop(this.speedNow > 0.3 ? this.walkAnim : this.idleAnim, { speed: this.speedNow > 0.3 ? this.speedNow / 1.6 : 1 });
      else m.locomote(this.speedNow);
      m.update(dt);
    }
  }
}
