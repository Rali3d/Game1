import * as THREE from 'three';
import { glowSprite } from '../world/Props.js';
import { ITEMS } from '../data/items.js';

export const FIREBALL_COST = 15;

// Projectiles: the player's fireballs and the boss's grey orbs. They live in whichever scene is active.
export class Spells {
  constructor(game) {
    this.g = game;
    this.projectiles = [];
    this.bursts = [];
    // One reusable light that rides the newest fireball (a constant light count avoids shader recompiles).
    this.light = new THREE.PointLight(0xff8a3a, 0, 14, 1.6);
    this.fireGeo = new THREE.IcosahedronGeometry(0.28, 1);
  }

  fireballDamage() {
    const g = this.g, p = g.player;
    return 12 + p.stats.level * 3 + (g.flags.embersRead ? 8 : 0) + (ITEMS[p.equipment.weapon]?.spellPower ?? 0);
  }

  castFireball() {
    const g = this.g, p = g.player;
    if (!g.flags.fireball) return;
    if (p.stats.mana < FIREBALL_COST) {
      g.hud.toast('Not enough mana.', 'warn');
      return;
    }
    if (!p.startCast(FIREBALL_COST)) return;

    // Aim where the camera looks, nudged onto the nearest enemy roughly in that direction.
    let dx = -Math.sin(g.cam.yaw), dz = -Math.cos(g.cam.yaw);
    let best = null, bestScore = 0.93;
    for (const e of g.activeEnemies()) {
      if (!e.alive) continue;
      const ex = e.position.x - p.position.x, ez = e.position.z - p.position.z, d = Math.hypot(ex, ez);
      if (d > 32 || d < 0.1) continue;
      const score = (ex * dx + ez * dz) / d;
      if (score > bestScore) { bestScore = score; best = { x: ex / d, z: ez / d }; }
    }
    if (best) { dx = best.x; dz = best.z; }
    p.facing = Math.atan2(dx, dz);

    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(this.fireGeo, new THREE.MeshBasicMaterial({ color: 0xffb35a })));
    mesh.add(glowSprite(0xff7a2a, 1.8, 0.95));
    mesh.position.set(p.position.x + dx * 0.9, p.position.y + 1.35, p.position.z + dz * 0.9);
    g.activeScene.add(mesh);
    this.projectiles.push({ mesh, vx: dx * 24, vz: dz * 24, life: 1.6, owner: 'player', damage: this.fireballDamage(), color: 0xff7a2a });
  }

  // An enemy's bolt: Corvin's pale homing orbs by default; others pass their own colour, damage and speed.
  // `from` is the launch height; the bolt drops towards the player's chest height as it flies.
  spawnOrb(enemy, angle, { color = 0x8fa8ff, core = 0xcfd8ff, damage = 11, speed = 10, homing = 1.2, from = 1.4, size = 1 } = {}) {
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 * size, 1), new THREE.MeshBasicMaterial({ color: core })));
    mesh.add(glowSprite(color, 1.5 * size, 0.9));
    mesh.position.set(enemy.position.x + Math.sin(angle) * 0.8, enemy.position.y + from, enemy.position.z + Math.cos(angle) * 0.8);
    this.g.activeScene.add(mesh);
    const p = this.g.player.position;
    const flight = Math.max(0.3, Math.hypot(p.x - mesh.position.x, p.z - mesh.position.z) / speed);
    const vy = (p.y + 1.1 - mesh.position.y) / flight;
    this.projectiles.push({ mesh, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, vy, life: 3, owner: 'enemy', damage, color, homing });
  }

  explode(p) {
    const pos = p.mesh.position;
    for (let i = 0; i < 7; i++) {
      const s = glowSprite(p.color, 0.9, 0.9);
      s.position.copy(pos);
      const a = (i / 7) * Math.PI * 2;
      this.g.activeScene.add(s);
      this.bursts.push({ s, vx: Math.cos(a) * 4, vy: 1 + Math.random() * 2, vz: Math.sin(a) * 4, t: 0 });
    }
    p.dead = true;
    p.mesh.removeFromParent();
  }

  clear() {
    for (const p of this.projectiles) p.mesh.removeFromParent();
    for (const b of this.bursts) b.s.removeFromParent();
    this.projectiles = [];
    this.bursts = [];
    this.light.intensity = 0;
  }

  update(dt, space) {
    const g = this.g, player = g.player;
    let lit = null;
    for (const p of this.projectiles) {
      const pos = p.mesh.position;
      if (p.homing && !player.dead) {
        // Gently curve towards the player.
        const tx = player.position.x - pos.x, tz = player.position.z - pos.z, d = Math.hypot(tx, tz) || 1;
        const sp = Math.hypot(p.vx, p.vz);
        p.vx += (tx / d) * sp * p.homing * dt;
        p.vz += (tz / d) * sp * p.homing * dt;
        const n = Math.hypot(p.vx, p.vz) / sp;
        p.vx /= n;
        p.vz /= n;
      }
      pos.x += p.vx * dt;
      pos.z += p.vz * dt;
      if (p.vy) {
        pos.y += p.vy * dt;
        if (pos.y < player.position.y + 1.1) p.vy = 0; // level off at chest height
      }
      p.life -= dt;
      p.mesh.children[0].rotation.y += dt * 8;

      // Hit walls and hillsides.
      const probe = pos.clone();
      space.collide(probe, 0.2);
      const hitWall = Math.hypot(probe.x - pos.x, probe.z - pos.z) > 0.05;
      const hitGround = pos.y < space.groundAt(pos.x, pos.z) + 0.3;
      if (p.life <= 0 || hitWall || hitGround) {
        this.explode(p);
        continue;
      }

      if (p.owner === 'player') {
        for (const e of g.activeEnemies()) {
          if (!e.alive) continue;
          const dx = e.position.x - pos.x, dz = e.position.z - pos.z;
          const dy = e.position.y + 0.8 - pos.y;
          if (Math.hypot(dx, dz) < e.def.radius + 0.55 && Math.abs(dy) < 1.8 + (e.def.radius > 1.5 ? 3 : 0)) {
            e.takeDamage(p.damage, pos, 5);
            g.hud.floater(e.position, `${p.damage}`, 'crit', e.barHeight);
            this.explode(p);
            break;
          }
        }
        if (!p.dead) lit = p;
      } else if (!player.dead) {
        const dx = player.position.x - pos.x, dz = player.position.z - pos.z;
        if (Math.hypot(dx, dz) < 0.8 && Math.abs(player.position.y + 1 - pos.y) < 1.6) {
          player.takeDamage(p.damage, pos);
          this.explode(p);
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    for (const b of this.bursts) {
      b.t += dt;
      b.s.position.x += b.vx * dt;
      b.s.position.y += b.vy * dt;
      b.s.position.z += b.vz * dt;
      b.s.material.opacity = Math.max(0, 0.9 - b.t * 2.2);
      if (b.t > 0.45) b.s.removeFromParent();
    }
    this.bursts = this.bursts.filter((b) => b.t <= 0.45);

    if (this.light.parent !== g.activeScene) g.activeScene.add(this.light);
    this.light.intensity = lit ? 18 : 0;
    if (lit) this.light.position.copy(lit.mesh.position);
  }
}
