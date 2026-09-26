import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.js';
import { Assets } from '../engine/Assets.js';
import { glowSprite } from './Props.js';

// Dungeons: rooms joined by corridors on a 2 m grid, built from the Modular Dungeon kit (floor tiles, walls,
// arches, columns, torches). Like caves, a dungeon is a "space" and is dark apart from its torches.
// The first room is by the entrance stairs; the room farthest away holds the dungeon's guardian.
export const DCELL = 2;
const N = 46;
const LIGHTS = 6; // torch lights share a fixed pool, moved to the torches nearest the player

export class Dungeon {
  constructor(def) {
    this.def = def;
    this.id = `dungeon:${def.id}`;
    this.outdoors = false;
    this.dark = true;
    this.camPitch = 1.0; // look down steeply enough to see over the corridor walls
    this.N = N;
    this.rng = mulberry32(def.seed * 131);
    this.layout();
    this.buildScene();
  }

  idx(i, j) {
    return j * N + i;
  }
  isWall(i, j) {
    return i < 0 || j < 0 || i >= N || j >= N || this.grid[this.idx(i, j)] === 0;
  }
  cellCenter(i, j) {
    return { x: (i - N / 2 + 0.5) * DCELL, z: (j - N / 2 + 0.5) * DCELL };
  }
  cellOf(x, z) {
    return { i: Math.floor(x / DCELL + N / 2), j: Math.floor(z / DCELL + N / 2) };
  }

  // ---- layout: rooms placed at random without overlapping, then chained together by corridors ----
  layout() {
    const rng = this.rng;
    const grid = (this.grid = new Uint8Array(N * N)); // 0 wall, 1 room, 2 corridor
    const rooms = (this.rooms = []);
    // The entrance room sits at the south edge.
    rooms.push({ i: N / 2 - 3, j: N - 9, w: 6, h: 6 });
    for (let tries = 0; tries < 400 && rooms.length < this.def.rooms; tries++) {
      const w = 5 + Math.floor(rng() * 5), h = 5 + Math.floor(rng() * 5);
      const r = { i: 2 + Math.floor(rng() * (N - w - 4)), j: 2 + Math.floor(rng() * (N - h - 12)), w, h };
      if (rooms.some((o) => r.i < o.i + o.w + 2 && o.i < r.i + r.w + 2 && r.j < o.j + o.h + 2 && o.j < r.j + r.h + 2)) continue;
      rooms.push(r);
    }
    // The boss gets the biggest room far from the door: order the rest by distance from the entrance.
    const c = (r) => ({ x: r.i + r.w / 2, z: r.j + r.h / 2 });
    const e = c(rooms[0]);
    const rest = rooms.slice(1).sort((a, b) => Math.hypot(c(a).x - e.x, c(a).z - e.z) - Math.hypot(c(b).x - e.x, c(b).z - e.z));
    this.rooms = [rooms[0], ...rest];
    for (const r of this.rooms) for (let j = r.j; j < r.j + r.h; j++) for (let i = r.i; i < r.i + r.w; i++) grid[this.idx(i, j)] = 1;
    // Corridors: each room to the nearest earlier one, two cells wide, bending once.
    this.doorways = [];
    for (let n = 1; n < this.rooms.length; n++) {
      const a = c(this.rooms[n]);
      let best = this.rooms[0], bd = Infinity;
      for (let m = 0; m < n; m++) {
        const b = c(this.rooms[m]), d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < bd) { bd = d; best = this.rooms[m]; }
      }
      this.corridor(a, c(best), rng() < 0.5);
    }
    // One extra loop, so it isn't all dead ends.
    if (this.rooms.length > 4) this.corridor(c(this.rooms[this.rooms.length - 2]), c(this.rooms[2]), true);
    // The stairs up, south of the first room.
    const si = N / 2 - 1;
    for (let j = this.rooms[0].j + this.rooms[0].h; j < N - 1; j++) for (let di = 0; di < 2; di++) grid[this.idx(si + di, j)] = 2;
    this.entryCell = { i: si, j: N - 2 };

    // Distances from the entrance (for placing enemies and treasure).
    const dist = (this.dist = new Int32Array(N * N).fill(-1));
    const queue = [this.idx(si, N - 2)];
    dist[queue[0]] = 0;
    for (let q = 0; q < queue.length; q++) {
      const cc = queue[q], i = cc % N, j = Math.floor(cc / N);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const k = y * N + x;
        if (grid[k] && dist[k] < 0) { dist[k] = dist[cc] + 1; queue.push(k); }
      }
    }
    this.boss = this.rooms.reduce((a, b) => (dist[this.idx(Math.floor(c(b).x), Math.floor(c(b).z))] > dist[this.idx(Math.floor(c(a).x), Math.floor(c(a).z))] ? b : a));
  }

  corridor(a, b, xFirst) {
    const carve = (i, j) => {
      for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
        const k = this.idx(Math.min(N - 2, Math.max(1, i + di)), Math.min(N - 2, Math.max(1, j + dj)));
        if (!this.grid[k]) this.grid[k] = 2;
      }
    };
    let i = Math.floor(a.x), j = Math.floor(a.z);
    const ti = Math.floor(b.x), tj = Math.floor(b.z);
    const stepX = () => { while (i !== ti) { carve(i, j); i += Math.sign(ti - i); } };
    const stepZ = () => { while (j !== tj) { carve(i, j); j += Math.sign(tj - j); } };
    if (xFirst) { stepX(); stepZ(); } else { stepZ(); stepX(); }
    carve(i, j);
  }

  // Floor cells in rooms (not corridors) at least minDist from the entrance, farthest first.
  farCells(minDist) {
    const out = [];
    for (let k = 0; k < N * N; k++) if (this.grid[k] === 1 && this.dist[k] >= minDist) out.push({ i: k % N, j: Math.floor(k / N), d: this.dist[k] });
    return out.sort((a, b) => b.d - a.d);
  }

  roomCells(room) {
    const out = [];
    for (let j = room.j + 1; j < room.j + room.h - 1; j++) for (let i = room.i + 1; i < room.i + room.w - 1; i++) out.push({ i, j });
    return out;
  }

  wallNeighbours(i, j) {
    let n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && this.isWall(i + di, j + dj)) n++;
    return n;
  }

  // ---- building the scene ----
  buildScene() {
    const rng = this.rng;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x030202);
    scene.fog = new THREE.Fog(0x030202, 10, 34);
    scene.add(new THREE.HemisphereLight(0x6a5a4a, 0x100a08, 0.3));
    this.objects = []; // extra colliders { x, z, r }
    const place = new Map(); // model key -> [matrix]
    const dummy = new THREE.Object3D();
    const put = (key, x, y, z, ry = 0, s = 1) => {
      if (!Assets.has(key)) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      if (!place.has(key)) place.set(key, []);
      place.get(key).push(dummy.matrix.clone());
    };

    // Floors, and walls on every edge between floor and rock (two courses high).
    const torches = (this.torchSpots = []);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (this.isWall(i, j)) continue;
        const p = this.cellCenter(i, j);
        put('dungeon/Floor_Modular', p.x, -0.125, p.z, Math.floor(rng() * 4) * Math.PI / 2);
        for (const [di, dj, ry] of [[0, -1, 0], [0, 1, Math.PI], [1, 0, -Math.PI / 2], [-1, 0, Math.PI / 2]]) {
          if (!this.isWall(i + di, j + dj)) continue;
          const wx = p.x + di * DCELL / 2, wz = p.z + dj * DCELL / 2;
          put('dungeon/Wall_Modular', wx, 1, wz, ry);
          put('dungeon/Wall_Modular', wx, 3, wz, ry);
          // Now and then a torch on the wall, facing into the room.
          if (this.grid[this.idx(i, j)] === 1 && rng() < 0.09) {
            const tx = p.x + di * (DCELL / 2 - 0.3), tz = p.z + dj * (DCELL / 2 - 0.3);
            put('dungeon/Torch', tx, 2.0, tz, ry + Math.PI);
            torches.push({ x: tx - di * 0.15, y: 2.55, z: tz - dj * 0.15 });
          } else if (this.grid[this.idx(i, j)] === 1 && rng() < 0.04) {
            put('dungeon/Banner_wall', p.x + di * (DCELL / 2 - 0.25), 0.3, p.z + dj * (DCELL / 2 - 0.25), ry + Math.PI, 0.8);
          }
        }
      }
    }

    // Rooms: columns in the corners, arches in the doorways, clutter along the walls.
    const clutter = ['dungeon/Barrel', 'dungeon/Barrel2', 'dungeon/Crate', 'dungeon/Vase', 'dungeon/Skull', 'dungeon/Cobweb', 'dungeon/Cobweb2', 'dungeon/Bag_Coins'];
    this.traps = [];
    this.rooms.forEach((r, n) => {
      const corners = [[r.i, r.j], [r.i + r.w - 1, r.j], [r.i, r.j + r.h - 1], [r.i + r.w - 1, r.j + r.h - 1]];
      for (const [ci, cj] of corners) {
        const p = this.cellCenter(ci, cj);
        put('dungeon/Column', p.x, 0, p.z, 0, 0.8);
        this.objects.push({ x: p.x, z: p.z, r: 0.55 });
      }
      for (const cell of this.roomCells(r)) {
        if (rng() > 0.12 || this.wallNeighbours(cell.i, cell.j) < 1) continue;
        const nearWall = [[0, -1], [0, 1], [1, 0], [-1, 0]].some(([di, dj]) => this.isWall(cell.i + di * 2, cell.j + dj * 2));
        if (!nearWall) continue;
        const p = this.cellCenter(cell.i, cell.j);
        const key = clutter[Math.floor(rng() * clutter.length)];
        put(key, p.x + (rng() - 0.5), 0, p.z + (rng() - 0.5), rng() * 6, key.includes('Cobweb') ? 1.2 : 1);
        if (/Barrel|Crate/.test(key)) this.objects.push({ x: p.x, z: p.z, r: 0.55 });
      }
      // A table and chairs in some middle rooms; a fire pit in others.
      if (n > 0 && r !== this.boss && rng() < 0.35) {
        const p = this.cellCenter(r.i + Math.floor(r.w / 2), r.j + Math.floor(r.h / 2));
        put('dungeon/Table_Big', p.x, 0, p.z, rng() < 0.5 ? 0 : Math.PI / 2);
        put('dungeon/Chair', p.x + 1.2, 0, p.z, -Math.PI / 2);
        this.objects.push({ x: p.x, z: p.z, r: 1.4 });
      } else if (n > 0 && r !== this.boss && rng() < 0.3) {
        const p = this.cellCenter(r.i + Math.floor(r.w / 2), r.j + Math.floor(r.h / 2));
        put('dungeon/Woodfire', p.x, 0, p.z);
        torches.push({ x: p.x, y: 0.8, z: p.z });
        this.objects.push({ x: p.x, z: p.z, r: 0.7 });
      }
    });
    // The guardian's hall: statues and a pedestal of treasure.
    const b = this.boss;
    const bp = this.cellCenter(b.i + Math.floor(b.w / 2), b.j + 1);
    put('dungeon/Pedestal', bp.x, 0, bp.z, 0, 0.7);
    put('dungeon/Coin_Pile', bp.x, 1.55, bp.z, 0, 2.5);
    this.objects.push({ x: bp.x, z: bp.z, r: 1.0 });
    for (const sx of [-1, 1]) {
      const sp = this.cellCenter(b.i + (sx < 0 ? 1 : b.w - 2), b.j + 1);
      put('dungeon/Statue_Horse', sp.x, 0, sp.z + 0.4, Math.PI, 0.45);
      this.objects.push({ x: sp.x, z: sp.z, r: 0.8 });
    }
    // Spike traps in some corridors.
    for (let k = 0; k < N * N; k++) {
      if (this.grid[k] !== 2 || this.dist[k] < 8 || rng() > 0.025) continue;
      const i = k % N, j = Math.floor(k / N);
      const p = this.cellCenter(i, j);
      this.traps.push({ x: p.x, z: p.z, phase: rng() * 3 });
    }
    // Arches where corridors meet rooms.
    for (const r of this.rooms) {
      for (let i = r.i; i < r.i + r.w; i++) {
        for (const j of [r.j - 1, r.j + r.h]) {
          if (this.grid[this.idx(i, j)] === 2 && this.grid[this.idx(i + 1, j)] === 2 && this.isWall(i - 1, j)) {
            const p = this.cellCenter(i, j);
            put('dungeon/Arch', p.x + DCELL / 2, 0, j < r.j ? p.z + DCELL / 2 : p.z - DCELL / 2, 0, 1);
          }
        }
      }
    }

    for (const [key, mats] of place) {
      for (const { geometry, material } of Assets.meshParts(key)) {
        const mesh = new THREE.InstancedMesh(geometry, material, mats.length);
        mats.forEach((m, n) => mesh.setMatrixAt(n, m));
        mesh.castShadow = !key.includes('Floor') && !key.includes('Cobweb');
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        scene.add(mesh);
      }
    }

    // Spike traps: a plate with spikes that rise and fall.
    this.trapMeshes = this.traps.map((t) => {
      const plate = Assets.has('dungeon/Trap_spikes') ? Assets.clone('dungeon/Trap_spikes') : new THREE.Group();
      plate.position.set(t.x, -0.6, t.z);
      scene.add(plate);
      return plate;
    });

    // Torchlight: glows at every torch, and a pool of real lights that follows the player around.
    this.glows = torches.map((t) => {
      const g = glowSprite(0xffa04a, 1.6, 0.85);
      g.position.set(t.x, t.y, t.z);
      scene.add(g);
      return g;
    });
    this.lights = Array.from({ length: LIGHTS }, () => {
      const l = new THREE.PointLight(0xff9a4a, 0, 13, 1.6);
      scene.add(l);
      return l;
    });

    const entry = this.cellCenter(this.entryCell.i, this.entryCell.j);
    this.entry = { x: entry.x + DCELL / 2, z: entry.z - DCELL * 1.5, facing: Math.PI };
    this.exitPoint = { x: entry.x + DCELL / 2, z: entry.z };
    const daylight = new THREE.PointLight(0xdfe8ff, 18, 12, 1.4);
    daylight.position.set(this.exitPoint.x, 3, this.exitPoint.z);
    scene.add(daylight);
  }

  // ---- space interface ----
  groundAt() {
    return 0;
  }
  inWater() {
    return false;
  }
  isSafe() {
    return false;
  }
  blocked() {
    return false;
  }
  clamp() {}

  collide(pos, r) {
    const { i: ci, j: cj } = this.cellOf(pos.x, pos.z);
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (!this.isWall(i, j)) continue;
        const p = this.cellCenter(i, j), h = DCELL / 2;
        const cx = Math.max(p.x - h, Math.min(p.x + h, pos.x)), cz = Math.max(p.z - h, Math.min(p.z + h, pos.z));
        const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d > 1e-6) {
          pos.x += (dx / d) * (r - d);
          pos.z += (dz / d) * (r - d);
        } else {
          pos.x += Math.sign(pos.x - p.x || 1) * (h - Math.abs(pos.x - p.x) + r);
        }
      }
    }
    for (const o of this.objects) {
      const dx = pos.x - o.x, dz = pos.z - o.z, min = r + o.r, d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2), push = (min - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
  }

  // Spikes that are up right now at (x, z)?
  spikesAt(x, z, t) {
    return this.traps.some((tr) => Math.abs(x - tr.x) < 0.95 && Math.abs(z - tr.z) < 0.95 && Math.sin(t * 1.6 + tr.phase) > 0.55);
  }

  update(t, dt, focus) {
    this.glows.forEach((g, n) => g.scale.setScalar(1.5 + Math.sin(t * 9 + n * 1.7) * 0.12));
    this.traps.forEach((tr, n) => {
      const up = Math.sin(t * 1.6 + tr.phase) > 0.55;
      const m = this.trapMeshes[n];
      m.position.y += ((up ? 0 : -0.6) - m.position.y) * Math.min(1, (dt ?? 0.016) * 18);
    });
    if (!focus) return;
    // The nearest torches get the real lights.
    const near = this.glows
      .map((g) => ({ g, d: (g.position.x - focus.x) ** 2 + (g.position.z - focus.z) ** 2 }))
      .sort((a, b) => a.d - b.d);
    this.lights.forEach((l, n) => {
      const e = near[n];
      if (!e) { l.intensity = 0; return; }
      l.position.copy(e.g.position);
      l.intensity = 14 + Math.sin(t * 11 + n) * 1.5;
    });
  }
}
