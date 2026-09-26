import { Enemy, availableType } from '../entities/Enemy.js';
import { isWater, LANDMARKS, regionAt } from '../world/Terrain.js';
import { REGIONS, SITES } from '../data/world.js';
import { TOWNS } from '../data/towns.js';

// Keeps the land around the player populated. Enemies appear out of sight (70-150 m away), chosen by the
// region they appear in and scaled to its danger level, and quietly leave once the player is far away.
// Ruins keep their own guards, and Emberwing roosts on her peak until someone brings her down.
const NEAR = 160; // count enemies within this range towards the target
const FAR = 240; // enemies further than this (and not hunting) are removed

// The Vale keeps its old ecology: slimes in the meadow, wolves and puglins in the woods beyond.
function valeType(d, night, r) {
  if (d < 95) return night && r < 0.15 ? 'bat' : 'slime';
  if (d < 150) return r < 0.6 ? 'wolf' : 'puglin';
  return r < 0.5 ? 'wolf' : r < 0.8 || !night ? 'puglin' : 'skeleton'; // the dead only walk the rim at night
}

function pickWeighted(table, r) {
  const total = Object.values(table).reduce((a, b) => a + b, 0);
  let roll = r * total;
  for (const [type, w] of Object.entries(table)) if ((roll -= w) <= 0) return type;
  return Object.keys(table)[0];
}

export class Spawner {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.enemies = [];
    this.timer = 0;
    this.guardClock = {}; // site id -> time its guards may return
    this.clock = 0;
  }

  findSpot(player, minD, maxD) {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, r = minD + Math.random() * (maxD - minD);
      const x = player.x + Math.cos(a) * r, z = player.z + Math.sin(a) * r;
      if (Math.hypot(x, z) > 590 || isWater(x, z, 0.5)) continue;
      if (this.world.isSafe(x, z, 14)) continue;
      if (Math.hypot(x - LANDMARKS.spawn.x, z - LANDMARKS.spawn.z) < 24) continue;
      if (TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 25)) continue;
      return { x, z };
    }
    return null;
  }

  spawnAround(player, night, minD = 70) {
    const spot = this.findSpot(player, minD, 150);
    if (!spot) return;
    const key = regionAt(spot.x, spot.z), region = REGIONS[key];
    let type;
    if (key === 'vale') type = valeType(Math.hypot(spot.x, spot.z), night > 0.5, Math.random());
    else type = pickWeighted(night > 0.5 && Math.random() < 0.4 ? region.night : region.enemies, Math.random());
    this.add(type, spot.x, spot.z, region.level);
  }

  add(type, x, z, level, extra = {}) {
    const e = new Enemy(availableType(type), x, z, this.scene, this.world, { level });
    Object.assign(e, extra);
    this.enemies.push(e);
    return e;
  }

  anyHunting(pos, radius) {
    return this.enemies.some((e) => e.alive && e.state === 'chase' && Math.hypot(e.position.x - pos.x, e.position.z - pos.z) < radius);
  }

  // Ruins spawn their guards when you approach; once killed, they stay gone for a few in-game days.
  guardSites(p) {
    for (const s of SITES) {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d > 110 || this.clock < (this.guardClock[s.id] ?? 0)) continue;
      if (this.enemies.some((e) => e.site === s.id)) continue;
      const level = REGIONS[regionAt(s.x, s.z)].level;
      if (s.kind === 'peak') {
        if (this.game.flags.dragonSlain) continue;
        const e = this.add('dragon', s.x, s.z, 1, { site: s.id });
        this.game.elite = e;
      } else {
        for (const [type, n] of Object.entries(s.guards)) {
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random(), r = 3 + Math.random() * s.size * 0.6;
            this.add(type, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, level + 1, { site: s.id });
          }
        }
      }
      this.guardClock[s.id] = this.clock + 600; // ten minutes before they can return
    }
  }

  update(dt, player, camera, night, spells) {
    const p = player.position;
    this.clock += dt;
    for (const e of this.enemies) {
      const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
      // Far-off enemies stand still and unseen; they'll be tidied away below.
      const near = d < 170 || e.state === 'chase';
      e.mesh.visible = near;
      if (near || !e.alive) e.update(dt, player, camera, night, spells);
    }

    // Keep enemies from stacking on top of each other.
    const live = this.enemies.filter((e) => e.alive && e.mesh.visible);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i].position, b = live[j].position;
        const dx = a.x - b.x, dz = a.z - b.z;
        const min = live[i].def.radius + live[j].def.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = ((min - d) / d) * 0.5;
          a.x += dx * push; a.z += dz * push;
          b.x -= dx * push; b.z -= dz * push;
        }
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
      if (!e.removed && e.alive && d > FAR && e.state !== 'chase') e.dispose();
      if (e.removed) {
        if (e === this.game.elite) this.game.elite = null;
        this.enemies.splice(i, 1);
      }
    }

    // Top up the neighbourhood, a little at a time (faster when it's empty, e.g. after a long trip).
    this.timer -= dt;
    if (this.timer <= 0) {
      this.guardSites(p);
      const region = regionAt(p.x, p.z);
      const target = (region === 'vale' ? 10 : 13) + Math.round(night * 4);
      const count = this.enemies.filter((e) => e.alive && !e.site && Math.hypot(e.position.x - p.x, e.position.z - p.z) < NEAR).length;
      if (count < target) this.spawnAround(p, night, count < target / 2 ? 45 : 70);
      this.timer = count < target / 2 ? 0.15 : 1.2;
    }
  }

  // Everything goes (used when loading a save far from where the game started).
  clear() {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
  }
}
