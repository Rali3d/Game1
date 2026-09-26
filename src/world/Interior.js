import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.js';
import { glowSprite } from './Props.js';
import { signMaterial } from './Town.js';
import { Assets } from '../engine/Assets.js';

// Building interiors are separate little scenes you step into through a door. Rooms have no ceiling
// so the orbit camera can look down into them. Like the outdoor World, an interior is a "space":
// it provides groundAt / collide / clamp / inWater / isSafe for the player and NPCs.

const ROOM = {
  house: { w: 9, d: 8 },
  inn: { w: 15, d: 11 },
  shop: { w: 10, d: 8 },
  chapel: { w: 9, d: 14 },
  tower: { w: 9, d: 9 },
  hall: { w: 13, d: 9 },
  mill: { w: 8, d: 8 },
};
const WALL_H = 2.8;

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

let plankTexture;
function planks() {
  if (plankTexture) return plankTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const rng = mulberry32(5);
  for (let row = 0; row < 8; row++) {
    const shade = 120 + rng() * 40;
    ctx.fillStyle = `rgb(${shade}, ${shade * 0.72}, ${shade * 0.48})`;
    ctx.fillRect(0, row * 32, 256, 32);
    ctx.fillStyle = 'rgba(40,25,10,0.5)';
    ctx.fillRect(0, row * 32, 256, 2);
    const seam = rng() * 256;
    ctx.fillRect(seam, row * 32, 2, 32);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = `rgba(60,35,15,${0.08 + rng() * 0.1})`;
      ctx.fillRect(rng() * 256, row * 32 + 4 + rng() * 24, 30 + rng() * 60, 1);
    }
  }
  plankTexture = new THREE.CanvasTexture(c);
  plankTexture.wrapS = plankTexture.wrapT = THREE.RepeatWrapping;
  plankTexture.colorSpace = THREE.SRGBColorSpace;
  return plankTexture;
}

export class Interior {
  // def: { interiorId, kind, name, seed, outside, npc, resident } (a door record from Town)
  constructor(def, sky) {
    this.id = def.interiorId;
    this.def = def;
    this.kind = def.kind;
    this.sky = sky;
    this.outdoors = false;
    const { w, d } = ROOM[def.kind] ?? ROOM.house;
    this.w = w;
    this.d = d;
    this.colliders = [];
    this.animated = [];
    const rng = (this.rng = mulberry32(def.seed * 97 + 13));

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x0e0a07);
    this.hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a2a1a, 0.85);
    scene.add(this.hemi);
    this.light = new THREE.PointLight(0xffb866, 22, 22, 1.4);
    this.light.position.set(0, 2.6, 0);
    scene.add(this.light);

    const M = (this.M = {
      wall: std([0xd9ccb0, 0xcfc0a0, 0xe0d4bc][Math.floor(rng() * 3)]),
      stoneWall: std(0x8f8a80, { flatShading: true }),
      timber: std(0x4a3424),
      wood: std(0x7a5a3a),
      dark: std(0x4f3826),
      cloth: std([0x7a3030, 0x3f5a7a, 0x5a6b3a, 0x7a5a2a][Math.floor(rng() * 4)]),
      stone: std(0x77736d, { flatShading: true }),
      metal: std(0x55565a, { metalness: 0.6, roughness: 0.4 }),
      window: new THREE.MeshStandardMaterial({ color: 0x9fc4e8, emissive: 0xbfe0ff, emissiveIntensity: 0.8 }),
    });
    const floorTex = planks().clone();
    floorTex.needsUpdate = true;
    floorTex.repeat.set(w / 4, d / 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floor.receiveShadow = true;
    scene.add(floor);

    this.buildWalls(def.kind === 'tower' || def.kind === 'hall' ? M.stoneWall : M.wall);
    this.furnish(def.kind);

    // Spawn just inside the door (south wall, +z), facing into the room.
    this.entry = { x: 0, z: d / 2 - 1.3, facing: Math.PI };
    this.exitPoint = { x: 0, z: d / 2 - 0.4 };
  }

  add(obj, x, y, z, ry = 0) {
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    obj.traverse?.((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(obj);
    return obj;
  }

  mesh(geo, mat, x, y, z, parent = this.scene) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  block(x, z, hw, hd) {
    this.colliders.push({ x, z, hw, hd });
  }

  buildWalls(wallMat) {
    const { w, d, M } = this;
    const t = 0.3, door = 1.6;
    const wall = (ww, dd, x, z) => this.mesh(box(ww, WALL_H, dd), wallMat, x, WALL_H / 2, z);
    wall(w + t * 2, t, 0, -d / 2 - t / 2);
    wall(t, d, -w / 2 - t / 2, 0);
    wall(t, d, w / 2 + t / 2, 0);
    const side = (w - door) / 2;
    wall(side, t, -(door / 2 + side / 2), d / 2 + t / 2);
    wall(side, t, door / 2 + side / 2, d / 2 + t / 2);
    this.block(0, -d / 2 - t / 2, w / 2 + t, t / 2);
    this.block(-w / 2 - t / 2, 0, t / 2, d / 2);
    this.block(w / 2 + t / 2, 0, t / 2, d / 2);
    this.block(-(door / 2 + side / 2), d / 2 + t / 2, side / 2, t / 2);
    this.block(door / 2 + side / 2, d / 2 + t / 2, side / 2, t / 2);
    // Something to stop you wandering out of the open doorway (you leave with E instead).
    this.block(0, d / 2 + t, door / 2, 0.1);

    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.mesh(box(0.28, WALL_H + 0.1, 0.28), M.timber, sx * w / 2, WALL_H / 2, sz * d / 2);
    for (const sz of [-1, 1]) this.mesh(box(w + 0.6, 0.22, 0.34), M.timber, 0, WALL_H, sz * (d / 2 + 0.15));
    // Doorway: frame and a bright threshold where daylight comes in.
    this.mesh(box(0.2, 2.2, 0.4), M.timber, -door / 2, 1.1, d / 2 + 0.15);
    this.mesh(box(0.2, 2.2, 0.4), M.timber, door / 2, 1.1, d / 2 + 0.15);
    this.mesh(box(door + 0.2, 0.2, 0.4), M.timber, 0, 2.2, d / 2 + 0.15);
    this.doorGlow = this.mesh(new THREE.PlaneGeometry(door, 2.1), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.55 }), 0, 1.05, d / 2 + 0.36);
    this.doorGlow.rotation.y = Math.PI;
    // Windows on the side walls let daylight in (dimmer at night).
    for (const sx of [-1, 1]) {
      const win = this.mesh(new THREE.PlaneGeometry(1.1, 0.9), M.window, sx * (w / 2 - 0.01), 1.7, -d * 0.15);
      win.rotation.y = -sx * Math.PI / 2;
    }
  }

  // ---- furniture helpers ----
  // A Quaternius prop, if loaded. Returns null otherwise so the caller can build a simple stand-in.
  kitProp(key, x, z, ry = 0, sx = 1, sy = sx, sz = sx, y = 0) {
    if (!Assets.has(`props/${key}`)) return null;
    const m = Assets.clone(`props/${key}`);
    m.scale.set(sx, sy, sz);
    return this.add(m, x, y, z, ry);
  }
  table(x, z, ry = 0, w = 1.6, d = 0.9) {
    if (this.kitProp('Table_Large', x, z, ry, w / 2.85, 1, d / 1.1)) {
      if (this.rng() < 0.7) this.kitProp(this.rng() < 0.5 ? 'CandleStick_Triple' : 'Mug', x + (this.rng() - 0.5) * w * 0.5, z, 0, 1, 1, 1, 0.81);
      this.block(x, z, (ry ? d : w) / 2, (ry ? w : d) / 2);
      return;
    }
    const g = new THREE.Group();
    this.mesh(box(w, 0.08, d), this.M.wood, 0, 0.78, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.mesh(box(0.08, 0.76, 0.08), this.M.dark, sx * (w / 2 - 0.1), 0.38, sz * (d / 2 - 0.1), g);
    this.add(g, x, 0, z, ry);
    this.block(x, z, (ry ? d : w) / 2, (ry ? w : d) / 2);
    return g;
  }
  stool(x, z) {
    if (this.kitProp('Stool', x, z, this.rng() * 3)) return;
    const g = new THREE.Group();
    this.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), this.M.wood, 0, 0.48, 0, g);
    this.mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.46, 5), this.M.dark, 0, 0.23, 0, g);
    this.add(g, x, 0, z);
  }
  bed(x, z, ry = 0) {
    if (this.kitProp(this.rng() < 0.5 ? 'Bed_Twin1' : 'Bed_Twin2', x, z, ry + Math.PI, 0.6, 0.8, 0.88)) {
      this.block(x, z, ry ? 1.05 : 0.6, ry ? 0.6 : 1.05);
      return;
    }
    const g = new THREE.Group();
    this.mesh(box(1.1, 0.35, 2.1), this.M.dark, 0, 0.25, 0, g);
    this.mesh(box(1.0, 0.14, 1.9), std(0xe8e0d0), 0, 0.48, 0, g);
    this.mesh(box(1.02, 0.1, 1.3), this.M.cloth, 0, 0.56, 0.3, g);
    this.mesh(box(0.7, 0.12, 0.35), std(0xf2ece0), 0, 0.6, -0.72, g);
    this.mesh(box(1.1, 0.8, 0.1), this.M.dark, 0, 0.5, -1.05, g);
    this.add(g, x, 0, z, ry);
    this.block(x, z, ry ? 1.05 : 0.55, ry ? 0.55 : 1.05);
  }
  shelf(x, z, ry = 0, w = 2.2, goods = true) {
    if (this.kitProp(goods ? 'Bookcase_2' : 'Shelf_Simple', x, z, ry, w / 1.46, goods ? 0.85 : 1, 1, goods ? 0 : 1.4)) {
      this.block(x, z, ry ? 0.22 : w / 2, ry ? w / 2 : 0.22);
      return;
    }
    const g = new THREE.Group();
    for (const sx of [-1, 1]) this.mesh(box(0.08, 2, 0.4), this.M.dark, sx * w / 2, 1, 0, g);
    const colours = [0x8a3b2a, 0x3f5a7a, 0xd6b45a, 0x5a8a4a, 0xcfc0a0, 0x6b4a8a];
    for (const y of [0.4, 1.0, 1.6]) {
      this.mesh(box(w, 0.05, 0.4), this.M.wood, 0, y, 0, g);
      if (!goods) continue;
      for (let i = 0; i < 5; i++) {
        const c = colours[Math.floor(this.rng() * colours.length)];
        const bottle = this.rng() < 0.5;
        const geo = bottle ? new THREE.CylinderGeometry(0.06, 0.08, 0.26, 8) : box(0.22, 0.2, 0.22);
        this.mesh(geo, std(c, bottle ? { roughness: 0.3 } : {}), -w / 2 + 0.25 + i * (w - 0.5) / 4, y + 0.14, 0, g);
      }
    }
    this.add(g, x, 0, z, ry);
    this.block(x, z, ry ? 0.22 : w / 2, ry ? w / 2 : 0.22);
  }
  hearth(x, z, ry = 0) {
    const g = new THREE.Group();
    this.mesh(box(1.8, 1.2, 0.6), this.M.stone, 0, 0.6, 0, g);
    this.mesh(box(1.0, 0.7, 0.2), new THREE.MeshBasicMaterial({ color: 0x1a0d05 }), 0, 0.45, 0.25, g);
    this.mesh(box(0.8, 1.6, 0.5), this.M.stone, 0, 2.0, -0.05, g);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 7), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    flame.position.set(0, 0.35, 0.28);
    g.add(flame);
    const glow = glowSprite(0xff8a3a, 1.8, 0.8);
    glow.position.set(0, 0.5, 0.45);
    g.add(glow);
    this.add(g, x, 0, z, ry);
    this.block(x, z, ry ? 0.3 : 0.9, ry ? 0.9 : 0.3);
    this.animated.push((t) => {
      flame.scale.set(1, 1 + Math.sin(t * 12) * 0.2, 1);
      glow.material.opacity = 0.7 + Math.sin(t * 9) * 0.15;
    });
    this.light.position.set(x, 1.6, z + (ry ? 0 : 0.8));
  }
  counter(x, z, w, ry = 0) {
    const g = new THREE.Group();
    this.mesh(box(w, 1.05, 0.7), this.M.wood, 0, 0.52, 0, g);
    this.mesh(box(w + 0.1, 0.08, 0.8), this.M.dark, 0, 1.08, 0, g);
    this.add(g, x, 0, z, ry);
    // A few things left out on the counter.
    for (let i = 0; i < 3; i++) {
      const key = ['Mug', 'Bottle_1', 'CandleStick', 'Potion_1', 'Coin_Pile'][Math.floor(this.rng() * 5)];
      this.kitProp(key, x - w / 2 + 0.4 + this.rng() * (w - 0.8), z + (this.rng() - 0.5) * 0.3, this.rng() * 3, 1, 1, 1, 1.12);
    }
    this.block(x, z, ry ? 0.35 : w / 2, ry ? w / 2 : 0.35);
  }
  barrel(x, z) {
    if (this.kitProp(this.rng() < 0.3 ? 'Barrel_Apples' : 'Barrel', x, z, this.rng() * 3, 1.1)) {
      this.colliders.push({ x, z, r: 0.4 });
      return;
    }
    const g = new THREE.Group();
    this.mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.95, 12), this.M.wood, 0, 0.48, 0, g);
    for (const y of [0.18, 0.78]) this.mesh(new THREE.TorusGeometry(0.39, 0.025, 4, 16).rotateX(Math.PI / 2), this.M.metal, 0, y, 0, g);
    this.add(g, x, 0, z);
    this.colliders.push({ x, z, r: 0.4 });
  }
  crate(x, z, s = 0.7) {
    if (this.kitProp('Crate_Wooden', x, z, this.rng(), s / 0.9)) {
      this.colliders.push({ x, z, r: s * 0.6 });
      return;
    }
    this.add(new THREE.Mesh(box(s, s, s), this.M.wood), x, s / 2, z, this.rng());
    this.colliders.push({ x, z, r: s * 0.6 });
  }
  rug(x, z, w, d) {
    const r = this.mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), this.M.cloth, x, 0.01, z);
    r.receiveShadow = true;
  }
  candle(x, y, z) {
    this.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), std(0xf2ece0), x, y + 0.1, z);
    const glow = glowSprite(0xffc46b, 0.5, 0.9);
    glow.position.set(x, y + 0.28, z);
    this.scene.add(glow);
  }

  furnish(kind) {
    const { w, d, M } = this;
    const back = -d / 2 + 0.5;
    if (kind === 'house') {
      this.hearth(0, -d / 2 + 0.3);
      this.bed(w / 2 - 0.8, -d / 2 + 1.4);
      this.table(-w / 2 + 2, 0.2);
      this.stool(-w / 2 + 1.1, 0.2);
      this.stool(-w / 2 + 2.9, 0.2);
      this.shelf(-w / 2 + 0.3, -d / 2 + 1.8, Math.PI / 2, 1.8);
      this.rug(0.5, 0.5, 2.6, 1.8);
      this.barrel(w / 2 - 0.6, d / 2 - 1.2);
      if (this.kitProp('Chest_Wood', w / 2 - 0.9, -d / 2 + 3.1, Math.PI, 0.7)) this.block(w / 2 - 0.9, -d / 2 + 3.1, 0.45, 0.3);
      if (this.kitProp('Nightstand_Shelf', w / 2 - 2.0, -d / 2 + 0.45, 0, 0.9)) this.block(w / 2 - 2.0, -d / 2 + 0.45, 0.35, 0.2);
    } else if (kind === 'inn') {
      this.counter(-1, back + 1.6, 6);
      this.shelf(-1, back, 0, 5);
      for (let i = 0; i < 4; i++) this.stool(-3.5 + i * 1.6, back + 2.5);
      this.hearth(-w / 2 + 0.3, 1.5, Math.PI / 2);
      for (const [tx, tz] of [[1.5, 1.5], [4.5, 1.5], [1.5, 3.8]]) {
        this.table(tx, tz, 0, 1.4, 1.0);
        for (const sx of [-1, 1]) this.stool(tx + sx * 1.0, tz);
      }
      for (let i = 0; i < 2; i++) this.bed(w / 2 - 0.8, -d / 2 + 1.4 + i * 2.6, 0);
      this.barrel(-w / 2 + 0.6, -d / 2 + 0.6);
      this.barrel(-w / 2 + 1.4, -d / 2 + 0.6);
      this.rug(1, 2.5, 5, 3);
    } else if (kind === 'shop') {
      this.counter(0, back + 1.9, 4.5);
      this.shelf(-2.4, back, 0, 3.4);
      this.shelf(2.4, back, 0, 3.4);
      this.shelf(-w / 2 + 0.3, 1, Math.PI / 2, 2.6);
      this.crate(w / 2 - 0.7, 1.5);
      this.crate(w / 2 - 0.8, 2.4, 0.55);
      this.barrel(w / 2 - 0.6, 0.3);
      this.rug(0, 1.8, 3, 2);
      if (this.kitProp('Cabinet', w / 2 - 0.25, -0.8, -Math.PI / 2)) this.block(w / 2 - 0.25, -0.8, 0.2, 0.7);
      this.kitProp('Shelf_Small_Bottles', w / 2 - 0.02, -0.8, -Math.PI / 2, 1, 1, 1, 1.6);
      if (this.kitProp('Chest_Wood', -w / 2 + 0.9, d / 2 - 1.4, Math.PI / 2, 0.8)) this.block(-w / 2 + 0.9, d / 2 - 1.4, 0.35, 0.55);
      this.light.position.set(0, 2.6, 0);
    } else if (kind === 'chapel') {
      for (let row = 0; row < 4; row++) {
        for (const sx of [-1, 1]) {
          if (!this.kitProp('Bench', sx * 2.2, 1.1 + row * 1.5, 0, 1)) {
            this.mesh(box(2.8, 0.5, 0.5), M.wood, sx * 2.2, 0.25, 1 + row * 1.5);
            this.mesh(box(2.8, 0.6, 0.1), M.dark, sx * 2.2, 0.75, 1.2 + row * 1.5);
          }
          this.block(sx * 2.2, 1.05 + row * 1.5, 1.4, 0.3);
        }
      }
      for (const sx of [-1, 1]) this.kitProp('CandleStick_Stand', sx * 1.6, back + 1.4, 0, 1);
      this.mesh(box(2.2, 1.0, 0.9), std(0xe6dcc6), 0, 0.5, back + 1.4);
      this.block(0, back + 1.4, 1.1, 0.45);
      for (const x of [-0.8, -0.3, 0.3, 0.8]) this.candle(x, 1.0, back + 1.3);
      const stained = this.mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshStandardMaterial({ color: 0x5a4a9a, emissive: 0x8a6adf, emissiveIntensity: 0.9 }), 0, 2.0, -d / 2 + 0.01);
      stained.castShadow = false;
      this.rug(0, 1.5, 1.4, d - 3.5);
      this.light.color.setHex(0xffd9a0);
      this.light.position.set(0, 2.4, back + 2);
    } else if (kind === 'tower') {
      this.table(0, -0.5, 0, 2.4, 1.4);
      const map = this.mesh(new THREE.PlaneGeometry(2.2, 1.2).rotateX(-Math.PI / 2), signMaterial('THE VALLEY', { bg: '#d9c8a0', fg: '#5a3d22', font: 40 }), 0, 0.83, -0.5);
      map.castShadow = false;
      // Weapon racks and a stair up the wall
      for (const sx of [-1, 1]) {
        if (this.kitProp('WeaponStand', sx * (w / 2 - 0.6), 0.2, sx * -Math.PI / 2)) {
          this.block(sx * (w / 2 - 0.6), 0.2, 0.5, 0.7);
          continue;
        }
        const rack = new THREE.Group();
        this.mesh(box(1.8, 0.08, 0.2), M.dark, 0, 1.4, 0, rack);
        this.mesh(box(1.8, 0.08, 0.2), M.dark, 0, 0.4, 0, rack);
        for (let i = 0; i < 4; i++) this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 4), M.metal, -0.6 + i * 0.4, 1.0, 0.05, rack);
        this.add(rack, sx * (w / 2 - 0.25), 0, 0, sx * -Math.PI / 2);
        this.block(sx * (w / 2 - 0.25), 0, 0.2, 0.9);
      }
      for (let i = 0; i < 7; i++) {
        this.mesh(box(1.2, 0.2, 0.6), M.stone, w / 2 - 1.0 - i * 0.62, 0.2 + i * 0.36, -d / 2 + 0.6);
      }
      this.block(w / 2 - 2.9, -d / 2 + 0.6, 2.2, 0.35);
      this.barrel(-w / 2 + 0.7, -d / 2 + 0.7);
    } else if (kind === 'hall') {
      for (let i = 0; i < 4; i++) this.bed(-w / 2 + 1.2 + i * 1.6, -d / 2 + 1.3);
      this.table(1, 1.5, 0, 4, 1.0);
      for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) this.stool(-0.5 + i * 1.0, 1.5 + sz * 0.8);
      this.hearth(w / 2 - 0.3, 0, -Math.PI / 2);
      this.shelf(-w / 2 + 0.3, 1.8, Math.PI / 2, 2, false);
      if (this.kitProp('WeaponStand', -w / 2 + 0.7, d / 2 - 1.6, Math.PI / 2)) this.block(-w / 2 + 0.7, d / 2 - 1.6, 0.5, 0.7);
      if (this.kitProp('Dummy', w / 2 - 1.2, d / 2 - 1.4, -2.4)) this.colliders.push({ x: w / 2 - 1.2, z: d / 2 - 1.4, r: 0.4 });
    } else if (kind === 'mill') {
      const stone = this.mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.35, 16), M.stone, 0, 0.5, -0.5);
      this.mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 16), M.stone, 0, 0.15, -0.5);
      this.mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6), M.dark, 0, 1.4, -0.5);
      this.colliders.push({ x: 0, z: -0.5, r: 1.3 });
      this.animated.push((t) => (stone.rotation.y = t * 0.6));
      for (let i = 0; i < 5; i++) {
        const sack = this.mesh(new THREE.SphereGeometry(0.35, 8, 6), std(0xd6c49a), -w / 2 + 0.8 + (i % 3) * 0.6, 0.3, d / 2 - 1.2 - Math.floor(i / 3) * 0.6);
        sack.scale.set(1, 1.2, 0.8);
      }
      this.block(-w / 2 + 1.4, d / 2 - 1.5, 1.1, 0.6);
      this.crate(w / 2 - 0.8, -d / 2 + 0.8);
    }
  }

  // Where the building's keeper or resident stands (behind the counter, by the altar, ...).
  get keeperSpot() {
    const back = -this.d / 2 + 0.5;
    switch (this.kind) {
      case 'inn': return { x: -1, z: back + 0.85, facing: 0 };
      case 'shop': return { x: 0, z: back + 1.1, facing: 0 };
      case 'chapel': return { x: 0, z: back + 2.5, facing: 0 };
      case 'tower': return { x: 0, z: -2.1, facing: 0 }; // behind the map table
      default: return { x: 0.8, z: 1.2, facing: 0, wander: 1.6 };
    }
  }

  // ---- space interface ----
  groundAt() {
    return 0;
  }
  inWater() {
    return false;
  }
  isSafe() {
    return true;
  }
  clamp() {}

  collide(pos, r) {
    for (const c of this.colliders) {
      if (c.r !== undefined) {
        const dx = pos.x - c.x, dz = pos.z - c.z, min = r + c.r, d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (min - d);
          pos.z += (dz / d) * (min - d);
        }
        continue;
      }
      const cx = Math.max(c.x - c.hw, Math.min(c.x + c.hw, pos.x));
      const cz = Math.max(c.z - c.hd, Math.min(c.z + c.hd, pos.z));
      const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d > 1e-6) {
        pos.x += (dx / d) * (r - d);
        pos.z += (dz / d) * (r - d);
      } else {
        const ex = c.hw - Math.abs(pos.x - c.x), ez = c.hd - Math.abs(pos.z - c.z);
        if (ex < ez) pos.x += Math.sign(pos.x - c.x || 1) * (ex + r);
        else pos.z += Math.sign(pos.z - c.z || 1) * (ez + r);
      }
    }
  }

  update(t) {
    const day = this.sky.daylight;
    this.M.window.emissiveIntensity = 0.1 + day * 0.9;
    this.doorGlow.material.color.setHex(day > 0.3 ? 0xfff0c8 : 0x2a3450);
    this.hemi.intensity = 0.45 + day * 0.5;
    this.light.intensity = 22 + Math.sin(t * 7) * 1.5;
    for (const fn of this.animated) fn(t);
  }
}
