import { Enemy } from '../entities/Enemy.js';
import { isWater, LANDMARKS } from '../world/Terrain.js';
import { lerp } from '../engine/math.js';

// Keeps each zone populated: slimes in the meadow, wolves in the woods. Dead enemies respawn later, out of sight.
export class Spawner {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.enemies = [];
    this.queue = [];
    this.zones = [
      { type: 'slime', count: 10, minR: 26, maxR: 88 },
      { type: 'wolf', count: 8, minR: 98, maxR: 165 },
    ];
    for (const z of this.zones) for (let i = 0; i < z.count; i++) this.spawn(z);
  }

  findSpot(zone, avoidPos) {
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(lerp(zone.minR ** 2, zone.maxR ** 2, Math.random()));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (isWater(x, z, 0.5)) continue;
      if (this.world.isSafe(x, z, 10)) continue;
      if (Math.hypot(x - LANDMARKS.spawn.x, z - LANDMARKS.spawn.z) < 24) continue;
      if (avoidPos && Math.hypot(x - avoidPos.x, z - avoidPos.z) < 40) continue;
      return { x, z };
    }
    return null;
  }

  spawn(zone, avoidPos) {
    const spot = this.findSpot(zone, avoidPos);
    if (!spot) return false;
    const e = new Enemy(zone.type, spot.x, spot.z, this.scene);
    e.zone = zone;
    this.enemies.push(e);
    return true;
  }

  anyHunting(pos, radius) {
    return this.enemies.some((e) => e.alive && e.state === 'chase' && Math.hypot(e.position.x - pos.x, e.position.z - pos.z) < radius);
  }

  update(dt, player, camera, night) {
    for (const e of this.enemies) e.update(dt, player, this.world, camera, night);

    // Keep enemies from stacking on top of each other.
    const live = this.enemies.filter((e) => e.alive);
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
      if (this.enemies[i].removed) {
        this.queue.push({ zone: this.enemies[i].zone, t: 40 });
        this.enemies.splice(i, 1);
      }
    }
    for (const q of this.queue) q.t -= dt;
    this.queue = this.queue.filter((q) => q.t > 0 || !this.spawn(q.zone, player.position));
  }
}
