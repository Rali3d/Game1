import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.js';
import { glowSprite } from './Props.js';

// Caves are grid maps grown with a cellular automaton, rendered as instanced rock walls around a dark floor.
// A cave is a "space" (groundAt / collide / clamp / inWater / isSafe / blocked), like the outdoor World.
export const CELL = 2.6;
const WALL_H = 4.5;

export class Cave {
  constructor(def) {
    this.def = def;
    this.id = `cave:${def.id}`;
    this.outdoors = false;
    this.dark = true;
    const N = (this.N = def.size);
    let seed = def.seed;
    // Regenerate until the connected cave is roomy enough.
    do this.generate(seed++);
    while (this.floorCount < N * N * 0.28);
    this.buildScene();
  }

  idx(i, j) {
    return j * this.N + i;
  }
  isWall(i, j) {
    return i < 0 || j < 0 || i >= this.N || j >= this.N || this.grid[this.idx(i, j)] === 1;
  }
  cellCenter(i, j) {
    return { x: (i - this.N / 2 + 0.5) * CELL, z: (j - this.N / 2 + 0.5) * CELL };
  }
  cellOf(x, z) {
    return { i: Math.floor(x / CELL + this.N / 2), j: Math.floor(z / CELL + this.N / 2) };
  }

  generate(seed) {
    const N = this.N, rng = (this.rng = mulberry32(seed));
    let grid = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const edge = i === 0 || j === 0 || i === N - 1 || j === N - 1;
        grid[j * N + i] = edge || rng() < 0.45 ? 1 : 0;
      }
    }
    for (let step = 0; step < 5; step++) {
      const next = new Uint8Array(N * N);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          let walls = 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            if (di || dj) {
              const x = i + di, y = j + dj;
              walls += x < 0 || y < 0 || x >= N || y >= N ? 1 : grid[y * N + x];
            }
          }
          const edge = i === 0 || j === 0 || i === N - 1 || j === N - 1;
          next[j * N + i] = edge ? 1 : walls >= 5 ? 1 : walls <= 3 ? 0 : grid[j * N + i];
        }
      }
      grid = next;
    }
    // The mouth: a tunnel cut in from the south edge.
    const ei = Math.floor(N / 2);
    for (let j = N - 2; j > N - 10; j--) for (let di = -1; di <= 0; di++) grid[j * N + ei + di] = 0;
    this.grid = grid;
    this.entryCell = { i: ei, j: N - 2 };

    // Keep only what's reachable from the mouth, and remember how far each cell is from it.
    const dist = new Int32Array(N * N).fill(-1);
    const queue = [this.idx(ei, N - 2)];
    dist[queue[0]] = 0;
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q], i = c % N, j = Math.floor(c / N);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const n = y * N + x;
        if (grid[n] === 0 && dist[n] < 0) {
          dist[n] = dist[c] + 1;
          queue.push(n);
        }
      }
    }
    let floor = 0;
    for (let c = 0; c < N * N; c++) {
      if (grid[c] === 0 && dist[c] < 0) grid[c] = 1;
      if (grid[c] === 0) floor++;
    }
    this.dist = dist;
    this.floorCount = floor;
  }

  // Floor cells at least minDist steps from the mouth, farthest first.
  farCells(minDist) {
    const out = [];
    for (let c = 0; c < this.N * this.N; c++) {
      if (this.grid[c] === 0 && this.dist[c] >= minDist) out.push({ i: c % this.N, j: Math.floor(c / this.N), d: this.dist[c] });
    }
    return out.sort((a, b) => b.d - a.d);
  }

  wallNeighbours(i, j) {
    let n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && this.isWall(i + di, j + dj)) n++;
    return n;
  }

  buildScene() {
    const N = this.N, rng = this.rng;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x020203);
    scene.fog = new THREE.Fog(0x020203, 8, 30);
    this.hemi = new THREE.HemisphereLight(0x5a6a8a, 0x120e0a, 0.22);
    scene.add(this.hemi);

    // Floor: one plane with a mottled, slightly bumpy surface.
    const size = N * CELL;
    const floorGeo = new THREE.PlaneGeometry(size, size, N * 2, N * 2).rotateX(-Math.PI / 2);
    const pos = floorGeo.attributes.position, colors = [];
    const c = new THREE.Color();
    for (let v = 0; v < pos.count; v++) {
      pos.setY(v, (rng() - 0.5) * 0.12);
      c.setHSL(0.08, 0.12, 0.13 + rng() * 0.07);
      colors.push(c.r, c.g, c.b);
    }
    floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    floor.receiveShadow = true;
    scene.add(floor);

    // Walls: only cells touching open floor need rock.
    const border = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (!this.isWall(i, j)) continue;
        if (!this.isWall(i + 1, j) || !this.isWall(i - 1, j) || !this.isWall(i, j + 1) || !this.isWall(i, j - 1)
          || !this.isWall(i + 1, j + 1) || !this.isWall(i - 1, j - 1) || !this.isWall(i - 1, j + 1) || !this.isWall(i + 1, j - 1)) {
          border.push([i, j]);
        }
      }
    }
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, border.length * 2);
    const dummy = new THREE.Object3D();
    let k = 0;
    for (const [i, j] of border) {
      const p = this.cellCenter(i, j);
      for (let layer = 0; layer < 2; layer++) {
        dummy.position.set(p.x + (rng() - 0.5) * 0.6, layer ? WALL_H * 0.62 : WALL_H * 0.3, p.z + (rng() - 0.5) * 0.6);
        dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        dummy.scale.set(CELL * (0.75 + rng() * 0.2), WALL_H * (layer ? 0.3 : 0.45), CELL * (0.75 + rng() * 0.2));
        dummy.updateMatrix();
        rocks.setMatrixAt(k, dummy.matrix);
        rocks.setColorAt(k++, c.setHSL(0.07 + rng() * 0.03, 0.1, 0.2 + rng() * 0.1));
      }
    }
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    scene.add(rocks);

    // Glowing crystals clustered along the walls; they're the only light besides your lantern.
    this.crystals = [];
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0x9fe6ff, emissive: 0x3fb8ff, emissiveIntensity: 1.6, roughness: 0.2 });
    const floorCells = this.farCells(0).filter((f) => this.wallNeighbours(f.i, f.j) >= 3);
    for (let n = 0; n < 16 && floorCells.length; n++) {
      const f = floorCells.splice(Math.floor(rng() * floorCells.length), 1)[0];
      const p = this.cellCenter(f.i, f.j);
      const g = new THREE.Group();
      for (let s = 0; s < 3; s++) {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + rng() * 0.15, 0), crystalMat);
        m.scale.y = 2.2;
        m.position.set((rng() - 0.5) * 0.5, 0.3, (rng() - 0.5) * 0.5);
        m.rotation.z = (rng() - 0.5) * 0.6;
        g.add(m);
      }
      const glow = glowSprite(0x5fc8ff, 2.8, 0.6);
      glow.position.y = 0.6;
      g.add(glow);
      g.position.set(p.x, 0, p.z);
      scene.add(g);
      this.crystals.push(glow);
    }

    // Daylight spilling in at the mouth.
    const mouth = this.cellCenter(this.entryCell.i, this.entryCell.j);
    this.entry = { x: mouth.x - CELL / 2, z: mouth.z - CELL * 0.8, facing: Math.PI };
    this.exitPoint = { x: mouth.x - CELL / 2, z: mouth.z + CELL * 0.2 };
    const daylight = new THREE.PointLight(0xdfe8ff, 26, 16, 1.4);
    daylight.position.set(this.exitPoint.x, 3, this.exitPoint.z);
    scene.add(daylight);
    const shaft = glowSprite(0xe8f0ff, 5, 0.6);
    shaft.position.set(this.exitPoint.x, 1.6, this.exitPoint.z + 0.6);
    scene.add(shaft);
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
        const p = this.cellCenter(i, j), h = CELL / 2;
        const cx = Math.max(p.x - h, Math.min(p.x + h, pos.x)), cz = Math.max(p.z - h, Math.min(p.z + h, pos.z));
        const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d > 1e-6) {
          pos.x += (dx / d) * (r - d);
          pos.z += (dz / d) * (r - d);
        } else {
          // Somehow inside a wall: step back towards the cell we came from.
          pos.x += Math.sign(pos.x - p.x || 1) * (h - Math.abs(pos.x - p.x) + r);
        }
      }
    }
  }

  update(t) {
    this.crystals.forEach((g, n) => (g.material.opacity = 0.45 + Math.sin(t * 1.3 + n) * 0.15));
  }
}

// A treasure chest that opens when looted.
export function createChest() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.65), wood);
  base.position.y = 0.28;
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.32);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.65), wood);
  lidMesh.position.set(0, 0.11, 0.32);
  lid.add(lidMesh);
  for (const x of [-0.35, 0.35]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.68), brass);
    band.position.set(x, 0.38, 0);
    g.add(band);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.05), brass);
  lock.position.set(0, 0.5, 0.34);
  g.add(base, lid, lock);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const glow = glowSprite(0xffd98a, 1.4, 0.5);
  glow.position.y = 0.8;
  g.add(glow);
  g.open = () => {
    lid.rotation.x = -1.9;
    glow.visible = false;
  };
  return g;
}

// The rocky arch at a cave's mouth, out in the world. Faces +z; the dark opening is its interaction point.
export function createCaveMouth(locked) {
  const g = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 1, flatShading: true });
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const add = (x, y, z, sx, sy, sz, r) => {
    const m = new THREE.Mesh(geo, rock);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(r, r * 2, r * 0.5);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  add(-2.2, 1.6, 0, 1.4, 2.2, 1.6, 0.3);
  add(2.2, 1.6, 0, 1.4, 2.2, 1.6, 1.1);
  add(0, 3.9, 0, 3.2, 1.3, 1.7, 0.7);
  add(-3.6, 1.0, -1.2, 1.6, 1.8, 2.0, 2.1);
  add(3.6, 1.2, -1.2, 1.7, 2.0, 2.0, 0.9);
  add(0, 3.2, -2.2, 4.2, 2.8, 2.2, 1.7);
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.4), new THREE.MeshBasicMaterial({ color: 0x050403 }));
  dark.position.set(0, 1.6, 0.2);
  g.add(dark);
  if (locked) {
    const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: 0.7, roughness: 0.4 });
    const gate = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5), iron);
      bar.position.set(-1.25 + i * 0.5, 1.6, 0.4);
      gate.add(bar);
    }
    for (const y of [0.6, 2.6]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.08), iron);
      rail.position.set(0, y, 0.4);
      gate.add(rail);
    }
    g.add(gate);
    g.gate = gate;
  }
  return g;
}
