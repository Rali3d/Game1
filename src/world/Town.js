import * as THREE from 'three';
import { heightAt } from './Terrain.js';
import { glowSprite } from './Props.js';
import { Assets } from '../engine/Assets.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeStatic } from './merge.js';

// Builds a town from its data (see data/towns.js). Everything is laid out in town-local coordinates
// (origin = the square, -z = north) and converted to world space for colliders, doors and NPC spots.

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const DEG = Math.PI / 180;

function mesh(geo, material, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Triangular prism roof with its ridge along x.
export function roofGeometry(length, depth, height) {
  const s = new THREE.Shape();
  s.moveTo(-depth / 2, 0);
  s.lineTo(depth / 2, 0);
  s.lineTo(0, height);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  g.translate(0, 0, -length / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

export function signMaterial(text, { width = 512, height = 128, font = 64, bg = '#5a3d22', fg = '#f1dfae' } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, width - 10, height - 10);
  ctx.fillStyle = fg;
  let size = font;
  do ctx.font = `bold ${size--}px Georgia, serif`;
  while (ctx.measureText(text).width > width - 40 && size > 20);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
}

// Position on a ring around the square, rotated so local +z faces the centre.
function ring(deg, radius) {
  const a = deg * DEG;
  const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
  return { x, z, ry: Math.atan2(-x, -z) };
}

// Local point of a rotated object -> its parent's coordinates.
function rotatePoint(ox, oz, ry, lx, lz) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return { x: ox + lx * c + lz * s, z: oz - lx * s + lz * c };
}

// ---------------------------------------------------------------- buildings
// Each builder returns { group, doorX } (door x offset on the front face) and adds its own parts.

function houseShell(M, { w, d, h, wall, roof, chimney = true, storeys }) {
  const g = new THREE.Group();
  const base = 0.35, top = base + h;
  mesh(box(w + 0.3, 0.6, d + 0.3), M.stone, 0, 0.05, 0, g);
  mesh(box(w, h, d), wall, 0, base + h / 2, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.22, h, 0.22), M.timber, (sx * w) / 2, base + h / 2, (sz * d) / 2, g);
  for (const sz of [-1, 1]) mesh(box(w + 0.1, 0.2, 0.24), M.timber, 0, top - 0.1, (sz * d) / 2, g);
  mesh(box(w + 0.1, 0.16, 0.24), M.timber, 0, base + h * 0.52, d / 2 + 0.01, g);
  const rh = d * 0.55;
  mesh(roofGeometry(w + 0.8, d + 0.9, rh), roof, 0, top, 0, g);
  if (chimney) mesh(box(0.6, rh + 1.0, 0.6), M.stone, w * 0.28, top + rh * 0.55, -d * 0.12, g);
  for (const sx of [-1, 1]) mesh(box(0.1, 0.8, 0.85), M.window, sx * (w / 2 + 0.05), base + h * 0.3, 0, g);
  if (storeys === 2 || h > 3.6) {
    for (const x of [-w * 0.25, w * 0.25]) mesh(box(0.85, 0.75, 0.1), M.window, x, base + h * 0.78, d / 2 + 0.05, g);
  }
  return { g, base, top, rh };
}

function buildHouse(M, b) {
  const { g, base } = houseShell(M, b);
  const doorX = -b.w * 0.2;
  mesh(box(1.0, 1.9, 0.12), M.door, doorX, base + 0.95, b.d / 2 + 0.06, g);
  mesh(box(0.85, 0.8, 0.1), M.window, b.w * 0.22, base + b.h * 0.3, b.d / 2 + 0.05, g);
  if (b.kind === 'shop') {
    // Striped awning over the shop window
    for (let i = 0; i < 5; i++) {
      const s = mesh(box(0.36, 0.04, 1.1), i % 2 ? M.awningB : M.awningA, b.w * 0.22 - 0.72 + i * 0.36, base + b.h * 0.62, b.d / 2 + 0.5, g);
      s.rotation.x = 0.35;
    }
  }
  if (b.sign) {
    const board = mesh(new THREE.PlaneGeometry(Math.min(3.4, b.w * 0.6), 0.8), signMaterial(b.sign, { font: 58 }), 0.3, base + b.h * 0.52 + 0.55, b.d / 2 + 0.14, g);
    board.castShadow = false;
  }
  return { group: g, doorX };
}

function buildChapel(M, b) {
  const { g, base, top, rh } = houseShell(M, { ...b, chimney: false });
  mesh(box(1.4, 2.3, 0.12), M.door, 0, base + 1.15, b.d / 2 + 0.06, g);
  const rose = mesh(new THREE.CircleGeometry(0.55, 16), M.stained, 0, base + b.h * 0.72, b.d / 2 + 0.07, g);
  rose.castShadow = false;
  // Bell tower over the front gable
  const tw = 1.7;
  mesh(box(tw, 2.6, tw), b.wall, 0, top + rh * 0.4 + 1.1, b.d / 2 - 0.9, g);
  mesh(new THREE.ConeGeometry(1.35, 2.2, 4).rotateY(Math.PI / 4), b.roof, 0, top + rh * 0.4 + 3.5, b.d / 2 - 0.9, g);
  mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.55, 10), M.brass, 0, top + rh * 0.4 + 1.6, b.d / 2 - 0.9 + tw / 2 + 0.01, g);
  return { group: g, doorX: 0 };
}

function buildTower(M, b) {
  const g = new THREE.Group();
  mesh(box(b.w, b.h, b.d), M.stoneLight, 0, b.h / 2, 0, g);
  mesh(box(b.w + 0.5, 0.35, b.d + 0.5), M.stone, 0, b.h, 0, g);
  for (let i = 0; i < 4; i++) {
    for (let k = -1; k <= 1; k++) {
      const along = k * (b.w / 3);
      const side = [[along, b.d / 2 + 0.1], [along, -b.d / 2 - 0.1], [b.w / 2 + 0.1, along], [-b.w / 2 - 0.1, along]][i];
      mesh(box(0.6, 0.7, 0.6), M.stone, side[0], b.h + 0.5, side[1], g);
    }
  }
  mesh(box(1.3, 2.2, 0.12), M.door, 0, 1.1, b.d / 2 + 0.06, g);
  for (const y of [3.8, 6.4]) {
    for (const x of [-1, 1]) mesh(box(0.25, 0.9, 0.1), M.window, x * 1.2, y, b.d / 2 + 0.06, g);
  }
  const banner = mesh(new THREE.PlaneGeometry(1.1, 2.4), std(0x7a1f22, { side: THREE.DoubleSide }), 0, b.h - 1.9, b.d / 2 + 0.08, g);
  banner.castShadow = false;
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 5), M.darkWood, 0, b.h + 2.2, 0, g);
  const flag = mesh(new THREE.PlaneGeometry(1.2, 0.7), std(0x7a1f22, { side: THREE.DoubleSide }), 0.62, b.h + 3.2, 0, g);
  flag.castShadow = false;
  return { group: g, doorX: 0, flag };
}

// ---------------------------------------------------------------- kit buildings
// Buildings assembled from the Quaternius Medieval Village kit: 2 m wall panels on a grid, a door panel in
// the middle of the front (+z) wall, window panels, corner posts, a tiled roof and gable ends.
const KIT_WALL = 2, STOREY = 3.12;
const ROOF_SIZES = ['4x4', '4x6', '4x8', '6x4', '6x6', '6x8', '6x10', '6x12', '6x14', '8x8', '8x10', '8x12', '8x14'];
export const kitReady = () => Assets.has('village/Wall_Plaster_Straight');

// Place a kit piece, optionally centring its bounding box on the given point (some pieces aren't centred).
function kit(group, key, x, y, z, ry = 0, centre = false) {
  const m = Assets.clone(`village/${key}`);
  m.rotation.y = ry;
  m.position.set(x, y, z);
  if (centre) {
    const box = new THREE.Box3().setFromObject(Assets.gltf(`village/${key}`).scene);
    const c = box.getCenter(new THREE.Vector3()).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    m.position.x -= c.x;
    m.position.z -= c.z;
  }
  group.add(m);
  return m;
}

// Bake a building made of dozens of kit pieces into one mesh per material (a handful of draw calls).
function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(geo);
  });
  const out = new THREE.Group();
  for (const [material, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    out.add(mesh);
    geos.forEach((gg) => gg.dispose());
  }
  return out;
}

function buildModular(b, style) {
  const g = new THREE.Group();
  const brick = style === 'brick' || b.kind === 'chapel' || b.kind === 'tower';
  const wall = brick ? 'UnevenBrick' : 'Plaster';
  const even = (v, lo, hi) => Math.max(lo, Math.min(hi, 2 * Math.round(v / 2)));
  const W = b.kind === 'tower' ? 4 : even(b.w, 4, 10);
  const D = b.kind === 'tower' ? 4 : even(b.d, 4, 8);
  const storeys = b.kind === 'tower' ? 3 : b.h > 3.8 ? 2 : 1;
  const nx = W / KIT_WALL, nz = D / KIT_WALL;
  const doorCell = Math.floor(nx / 2);
  const doorPiece = b.kind === 'chapel' || brick ? `Wall_${wall}_Door_Round` : `Wall_${wall}_Door_Flat`;
  const windowPiece = (i) => (brick ? `Wall_${wall}_Window_Thin_Round` : i % 2 ? `Wall_${wall}_Window_Wide_Flat` : `Wall_${wall}_Window_Wide_Round`);
  const windowFrame = (piece) => (/Thin_Round/.test(piece) ? 'Window_Thin_Round1' : /Wide_Round/.test(piece) ? 'Window_Wide_Round1' : 'Window_Wide_Flat1');

  for (let s = 0; s < storeys; s++) {
    const y = s * STOREY;
    for (let i = 0; i < nx; i++) {
      const x = -W / 2 + KIT_WALL / 2 + i * KIT_WALL;
      // Front: door on the ground floor, windows elsewhere. Back: mostly plain.
      if (s === 0 && i === doorCell) {
        kit(g, doorPiece, x, y, D / 2, 0);
        kit(g, /Round/.test(doorPiece) ? 'Door_1_Round' : 'Door_1_Flat', x - 0.56, y, D / 2, 0);
      } else {
        const piece = windowPiece(i + s);
        kit(g, piece, x, y, D / 2, 0);
        kit(g, windowFrame(piece), x, y, D / 2, 0);
      }
      kit(g, i % 2 && s > 0 ? windowPiece(i) : `Wall_${wall}_Straight`, x, y, -D / 2, Math.PI);
    }
    for (let j = 0; j < nz; j++) {
      const z = -D / 2 + KIT_WALL / 2 + j * KIT_WALL;
      const side = (j + s) % 2 === 0 ? windowPiece(j) : `Wall_${wall}_Straight`;
      kit(g, side, W / 2, y, z, Math.PI / 2);
      if (side !== `Wall_${wall}_Straight`) kit(g, windowFrame(side), W / 2, y, z, Math.PI / 2);
      kit(g, `Wall_${wall}_Straight`, -W / 2, y, z, -Math.PI / 2);
    }
    for (const [cx, cz] of [[W / 2, D / 2], [-W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]]) {
      kit(g, brick ? 'Corner_Exterior_Brick' : 'Corner_Exterior_Wood', cx, y, cz);
    }
  }

  const top = storeys * STOREY;
  if (b.kind === 'tower') {
    kit(g, 'Roof_Tower_RoundTiles', 0, top, 0, 0, true);
  } else {
    // The ridge runs along the longer side; the gable ends close the triangles under it.
    const alongX = W >= D;
    const span = alongX ? D : W, length = alongX ? W : D;
    const size = ROOF_SIZES.includes(`${span}x${length}`) ? `${span}x${length}` : alongX ? `${span}x${Math.min(length, 14)}` : '6x6';
    kit(g, `Roof_RoundTiles_${size}`, 0, top, 0, alongX ? Math.PI / 2 : 0, true);
    const gable = `Roof_Front_Brick${Math.min(span, 8)}`;
    if (alongX) {
      kit(g, gable, W / 2, top, 0, Math.PI / 2, true);
      kit(g, gable, -W / 2, top, 0, -Math.PI / 2, true);
    } else {
      kit(g, gable, 0, top, D / 2, 0, true);
      kit(g, gable, 0, top, -D / 2, Math.PI, true);
    }
    if (b.kind !== 'chapel') kit(g, 'Prop_Chimney', W * 0.25, top - 0.4, -D * 0.2);
  }

  if (b.sign) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(3.2, W * 0.55), 0.7), signMaterial(b.sign, { font: 58 }));
    board.position.set(-W / 2 + KIT_WALL / 2 + doorCell * KIT_WALL, 2.75, D / 2 + 0.2);
    g.add(board);
  }
  return { group: mergeByMaterial(g), doorX: -W / 2 + KIT_WALL / 2 + doorCell * KIT_WALL, w: W, d: D };
}

function buildWindmill(M, b, roofMat) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(1.6, 2.4, 8, 8), std(0xe0d4ba, { flatShading: true }), 0, 4, 0, g);
  mesh(new THREE.ConeGeometry(2.1, 2.4, 8), roofMat, 0, 9.2, 0, g);
  mesh(box(1.0, 1.9, 0.2), M.door, 0, 0.95, 2.28, g);
  mesh(box(0.6, 0.6, 0.15), M.window, 0, 5, 1.9, g);
  const blades = new THREE.Group();
  blades.position.set(0, 7.2, 2.2);
  g.add(blades);
  mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 10).rotateX(Math.PI / 2), M.darkWood, 0, 0, 0, blades);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
    mesh(box(0.14, 4.6, 0.1), M.darkWood, 0, 2.4, 0.1, arm);
    mesh(box(0.9, 3.6, 0.04), std(0xefe6d0, { side: THREE.DoubleSide }), 0.5, 2.7, 0.12, arm);
  }
  return { group: g, doorX: 0, blades };
}

// Open-sided work shed (smithy or sawmill). Returns local points of interest.
function buildShed(M, b, roofMat, kind) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.2, 3, 0.2), M.timber, sx * 2.3, 1.5, sz * 1.7, g);
  mesh(box(5.4, 0.2, 4.4), roofMat, 0, 3.1, 0, g).rotation.x = 0.12;
  const points = {};
  if (kind === 'smithy') {
    mesh(box(1.7, 1.1, 1.3), M.stone, -1.3, 0.55, -1.0, g);
    mesh(box(0.8, 3.0, 0.8), M.stone, -1.3, 2.2, -1.35, g);
    mesh(box(1.3, 0.05, 0.9), new THREE.MeshBasicMaterial({ color: 0xff6a1a }), -1.3, 1.12, -0.95, g).castShadow = false;
    if (Assets.has('props/Anvil_Log')) {
      const anvil = Assets.clone('props/Anvil_Log');
      anvil.position.set(0.7, 0, 0.5);
      g.add(anvil);
      const bench = Assets.clone('props/Workbench');
      bench.position.set(1.4, 0, -1.3);
      bench.scale.setScalar(0.8);
      g.add(bench);
    } else {
      mesh(box(0.34, 0.5, 0.34), M.metal, 0.7, 0.25, 0.5, g);
      mesh(box(0.8, 0.22, 0.34), M.metal, 0.7, 0.6, 0.5, g);
    }
    mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.6, 10), M.darkWood, -0.2, 0.3, 1.2, g);
    const glow = glowSprite(0xff7a2a, 2.2, 0.8);
    glow.position.set(-1.3, 1.4, -0.95);
    g.add(glow);
    points.glow = glow;
    points.forge = { x: -1.3, z: -1.0, hw: 0.9, hd: 0.7 };
    points.anvil = { x: 0.7, z: 0.5, r: 0.45 };
    points.keeper = { x: 0.6, z: 1.5 };
    points.rack = { x: 1.7, z: -1.1 };
  } else {
    // Sawmill: a bench with a big circular saw, and a log waiting its turn.
    mesh(box(3.6, 0.9, 1.0), M.wood, 0, 0.45, -0.4, g);
    const saw = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.04, 20).rotateX(Math.PI / 2).rotateY(Math.PI / 2), M.metal, 0, 1.0, -0.4, g);
    points.saw = saw;
    const log = mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 8).rotateZ(Math.PI / 2), M.logs, 1.2, 1.2, -0.4, g);
    log.castShadow = true;
    points.forge = { x: 0, z: -0.4, hw: 1.8, hd: 0.5 };
  }
  if (b.sign) {
    mesh(new THREE.PlaneGeometry(2.2, 0.55), signMaterial(b.sign), 0, 2.75, 1.82, g).castShadow = false;
  }
  return { group: g, points };
}

// ---------------------------------------------------------------- town
export function createTown(scene, colliders, sky, T) {
  const baseY = heightAt(T.x, T.z);
  const g = new THREE.Group();
  g.position.set(T.x, baseY, T.z);
  scene.add(g);

  const M = {
    stone: std(0x8a847a, { flatShading: true }),
    stoneLight: std(0x9d988e, { flatShading: true }),
    timber: std(0x4a3424),
    door: std(0x3b2718),
    wood: std(0x7a5a3a),
    darkWood: std(0x4f3826),
    logs: std(0x6b4a30),
    metal: std(0x3a3a3c, { metalness: 0.6, roughness: 0.5 }),
    brass: std(0xb08d3a, { metalness: 0.7, roughness: 0.4 }),
    awningA: std(0xb8413a), awningB: std(0xefe4c8),
    // Windows glow at night (intensity driven in update()).
    window: new THREE.MeshStandardMaterial({ color: 0x2e2a22, emissive: 0xffbe5c, emissiveIntensity: 0, roughness: 0.4 }),
    stained: new THREE.MeshStandardMaterial({ color: 0x3a4a8a, emissive: 0x8a6adf, emissiveIntensity: 0.3 }),
  };
  const walls = T.walls.map((c) => std(c));
  const roofs = T.roofs.map((c) => std(c, { flatShading: true }));

  const footprints = [];
  const toWorld = (lx, lz) => ({ x: T.x + lx, z: T.z + lz });
  const groundY = (lx, lz) => heightAt(T.x + lx, T.z + lz) - baseY;
  const addBox = (lx, lz, hw, hd, rot, footprint = true) => {
    const c = { ...toWorld(lx, lz), hw, hd, rot };
    colliders.push(c);
    if (footprint) footprints.push(c);
  };
  const addCircle = (lx, lz, r, footprint = false) => {
    const c = { ...toWorld(lx, lz), r };
    colliders.push(c);
    if (footprint) footprints.push(c);
  };
  const place = (obj, lx, lz, ry = 0) => {
    obj.position.set(lx, groundY(lx, lz), lz);
    obj.rotation.y = ry;
    g.add(obj);
    return obj;
  };

  const doors = [];
  const spots = {};
  // The kit's window glass is one shared material; it glows warmly after dark.
  let kitGlass = null;
  if (kitReady()) {
    Assets.gltf('village/Window_Wide_Flat1').scene.traverse((o) => {
      if (o.isMesh && /Glass/.test(o.material.name)) kitGlass = o.material;
    });
    kitGlass?.emissive.setHex(0xffbe5c);
  }
  const spinners = [];
  let flag = null;

  T.buildings.forEach((b, i) => {
    const at = ring(b.deg, b.R);
    const wall = walls[i % walls.length], roof = roofs[i % roofs.length];
    const local = (lx, lz) => rotatePoint(at.x, at.z, at.ry, lx, lz);

    if (b.kind === 'smithy' || b.kind === 'sawmill') {
      const shed = buildShed(M, b, roofs[1 % roofs.length], b.kind);
      place(shed.group, at.x, at.z, at.ry);
      const p = shed.points;
      const f = local(p.forge.x, p.forge.z);
      addBox(f.x, f.z, p.forge.hw, p.forge.hd, at.ry);
      if (p.anvil) {
        const a = local(p.anvil.x, p.anvil.z);
        addCircle(a.x, a.z, p.anvil.r);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const post = local(sx * 2.3, sz * 1.7);
        addCircle(post.x, post.z, 0.2);
      }
      if (p.keeper) {
        const k = local(p.keeper.x, p.keeper.z), r = local(p.rack.x, p.rack.z);
        spots.smithKeeper = { ...toWorld(k.x, k.z), facing: at.ry };
        spots.rack = { ...toWorld(r.x, r.z), ry: at.ry };
      }
      if (p.glow) spots.forgeGlow = p.glow;
      if (p.saw) spinners.push(p.saw);
      return;
    }

    let built;
    if (b.kind === 'windmill') built = buildWindmill(M, b, roofs[roofs.length - 1]);
    else if (kitReady()) built = buildModular(b, T.style);
    else if (b.kind === 'chapel') built = buildChapel(M, { ...b, wall, roof });
    else if (b.kind === 'tower') built = buildTower(M, b);
    else built = buildHouse(M, { ...b, wall, roof });
    place(built.group, at.x, at.z, at.ry);
    if (built.blades) spinners.push(built.blades);
    if (built.flag) flag = built.flag;
    const bw = built.w ?? b.w, bd = built.d ?? b.d;

    if (b.kind === 'windmill') addCircle(at.x, at.z, 2.5, true);
    else addBox(at.x, at.z, bw / 2 + 0.25, bd / 2 + 0.25, at.ry);

    // A barrel or crate by the front corner of most buildings.
    if (b.kind !== 'windmill' && kitReady() && (i * 7) % 3 !== 0) {
      const key = ['Barrel', 'Crate_Wooden', 'Barrel_Apples', 'FarmCrate_Apple'][(i + T.id.length) % 4];
      const spot = local(bw / 2 - 0.5, bd / 2 + 0.7);
      const prop = Assets.clone(`props/${key}`);
      place(prop, spot.x, spot.z, at.ry + i);
      addCircle(spot.x, spot.z, 0.45);
    }

    // The door: a point just outside the front face, facing away from the building.
    const frontZ = b.kind === 'windmill' ? 2.4 : bd / 2 + 0.15;
    const outside = local(built.doorX, frontZ + 1.1);
    doors.push({
      interiorId: `${T.id}:${i}`,
      town: T.id,
      kind: b.kind === 'windmill' ? 'mill' : b.kind,
      name: b.sign ?? { chapel: 'Chapel', tower: 'Watchtower', windmill: 'Windmill', hall: 'Hall' }[b.kind] ?? 'House',
      npc: b.npc ?? null,
      resident: b.resident ?? null,
      seed: i + 1 + T.id.length * 7,
      outside: { ...toWorld(outside.x, outside.z), y: heightAt(T.x + outside.x, T.z + outside.z), facing: at.ry + Math.PI },
    });
  });

  // ---- Well or fountain in the square ----
  if (T.well) {
    const well = new THREE.Group();
    mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.9, 16, 1, true), std(0x8a847a, { flatShading: true, side: THREE.DoubleSide }), 0, 0.45, 0, well);
    mesh(new THREE.TorusGeometry(1.18, 0.12, 6, 20).rotateX(Math.PI / 2), M.stone, 0, 0.9, 0, well);
    mesh(new THREE.CircleGeometry(1.05, 16).rotateX(-Math.PI / 2), std(0x1c3340, { roughness: 0.2 }), 0, 0.25, 0, well);
    for (const sx of [-1, 1]) mesh(box(0.14, 2.2, 0.14), M.timber, sx * 1.05, 1.1, 0, well);
    mesh(roofGeometry(2.6, 1.6, 0.7), roofs[0], 0, 2.2, 0, well);
    mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 6).rotateZ(Math.PI / 2), M.wood, 0, 1.7, 0, well);
    mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 8), M.wood, 0.2, 1.25, 0, well);
    place(well, 0, 0);
    addCircle(0, 0, 1.35, true);
  }
  let spray = null;
  if (T.fountain) {
    const f = new THREE.Group();
    mesh(new THREE.CylinderGeometry(1.9, 2.0, 0.6, 20, 1, true), std(0xb8b0a0, { side: THREE.DoubleSide }), 0, 0.3, 0, f);
    mesh(new THREE.TorusGeometry(1.95, 0.14, 6, 24).rotateX(Math.PI / 2), M.stoneLight, 0, 0.6, 0, f);
    mesh(new THREE.CircleGeometry(1.9, 20).rotateX(-Math.PI / 2), std(0x3a7ca5, { roughness: 0.1, metalness: 0.2 }), 0, 0.45, 0, f);
    mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.6, 8), M.stoneLight, 0, 1.0, 0, f);
    mesh(new THREE.CylinderGeometry(0.7, 0.3, 0.3, 12), M.stoneLight, 0, 1.8, 0, f);
    spray = glowSprite(0xbfe8ff, 1.6, 0.5);
    spray.position.y = 2.1;
    f.add(spray);
    place(f, 0, 0);
    addCircle(0, 0, 2.1, true);
  }

  // ---- Market stalls ----
  for (const st of T.stalls ?? []) {
    const stall = new THREE.Group();
    mesh(box(3, 1, 1.1), M.wood, 0, 0.5, 0, stall);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.1, 2.5, 0.1), M.darkWood, sx * 1.45, 1.25, sz * 0.8 - 0.2, stall);
    for (let i = 0; i < 6; i++) {
      const s = mesh(box(0.52, 0.05, 2.0), i % 2 ? M.awningB : M.awningA, -1.3 + i * 0.52, 2.55, -0.2, stall);
      s.rotation.x = -0.18;
    }
    [0xd8a23a, 0x8fbf4a, 0xc2452d].forEach((c, i) => {
      for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(0.1, 6, 5), std(c), -1 + i + (k % 2) * 0.2, 1.08, 0.1 + (k > 1 ? 0.2 : 0), stall);
    });
    mesh(box(0.7, 0.6, 0.7), M.wood, 2.1, 0.3, 0.4, stall);
    mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.9, 10), M.darkWood, -2.1, 0.45, 0.3, stall);
    place(stall, st.x, st.z, st.ry);
    addBox(st.x, st.z, 1.7, 0.8, st.ry, false);
  }

  // ---- Lamp posts and a plaza light for the evening ----
  const lampGlows = [];
  for (const deg of T.lamps ?? []) {
    const at = ring(deg, 10);
    const lamp = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.07, 0.09, 3, 6), M.darkWood, 0, 1.5, 0, lamp);
    mesh(box(0.5, 0.08, 0.08), M.darkWood, 0.2, 2.9, 0, lamp);
    mesh(box(0.22, 0.3, 0.22), M.window, 0.4, 2.7, 0, lamp);
    const glow = glowSprite(0xffc46b, 1.6, 0);
    glow.position.set(0.4, 2.7, 0);
    lamp.add(glow);
    lampGlows.push(glow);
    place(lamp, at.x, at.z, at.ry + Math.PI / 2);
    addCircle(at.x, at.z, 0.2);
  }

  // ---- Town sign by the road in. One box collider covers posts and board. ----
  const ent = ring(T.entrance, T.r - 3);
  const signPost = new THREE.Group();
  for (const sx of [-1, 1]) mesh(box(0.14, 2.2, 0.14), M.darkWood, sx * 1.3, 1.1, 0, signPost);
  mesh(new THREE.PlaneGeometry(2.8, 0.75), signMaterial(T.name, { font: 70 }), 0, 1.75, 0.04, signPost).castShadow = false;
  mesh(box(2.9, 0.8, 0.06), M.darkWood, 0, 1.75, 0, signPost);
  // Beside the road (offset sideways), turned to face travellers arriving.
  const side = rotatePoint(ent.x, ent.z, ent.ry, 3.4, 0);
  place(signPost, side.x, side.z, ent.ry + Math.PI);
  addBox(side.x, side.z, 1.5, 0.2, ent.ry + Math.PI, false);
  // The coach stops by the sign.
  const stop = rotatePoint(ent.x, ent.z, ent.ry, -2.4, -1.5);
  spots.coach = { ...toWorld(stop.x, stop.z), facing: ent.ry };

  // ---- Notice board on the square, by the road in ----
  const nb = ring(T.entrance, 7.5);
  const nbSide = rotatePoint(nb.x, nb.z, nb.ry, 3.2, 0);
  const board = new THREE.Group();
  for (const sx of [-0.9, 0.9]) mesh(box(0.12, 2.3, 0.12), M.darkWood, sx, 1.15, 0, board);
  mesh(box(2.0, 1.2, 0.08), M.wood, 0, 1.55, 0, board);
  mesh(roofGeometry(2.4, 0.5, 0.3), roofs[0], 0, 2.3, 0, board);
  const paper = std(0xefe4c8);
  [[-0.55, 1.75, 0.1], [0.1, 1.6, -0.08], [0.6, 1.8, 0.12], [-0.3, 1.3, -0.1], [0.45, 1.3, 0.06]].forEach(([x, y, r]) => {
    mesh(new THREE.PlaneGeometry(0.42, 0.52), paper, x, y, 0.05, board).rotation.z = r;
  });
  place(board, nbSide.x, nbSide.z, nb.ry); // papers facing the square
  addBox(nbSide.x, nbSide.z, 1.1, 0.2, nb.ry, false);
  const front = rotatePoint(nbSide.x, nbSide.z, nb.ry, 0, 1.2);
  spots.board = { ...toWorld(front.x, front.z) };

  // ---- Fences, hay, log piles, training dummies ----
  for (const [lx, lz, len, ry] of T.fences ?? []) {
    const fence = new THREE.Group();
    const n = Math.round(len / 1.4);
    for (let i = 0; i <= n; i++) mesh(box(0.12, 1.0, 0.12), M.darkWood, -len / 2 + (i * len) / n, 0.5, 0, fence);
    for (const y of [0.4, 0.8]) mesh(box(len, 0.08, 0.06), M.wood, 0, y, 0, fence);
    place(fence, lx, lz, ry);
    addBox(lx, lz, len / 2, 0.1, ry, false);
  }
  for (const [lx, lz] of T.hay ?? []) {
    const hay = mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 12).rotateZ(Math.PI / 2), std(0xd6b45a), lx, groundY(lx, lz) + 0.6, lz, g);
    hay.rotation.y = lx;
    addCircle(lx, lz, 0.65);
  }
  for (const [lx, lz] of T.logs ?? []) {
    const pile = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const row = i < 3 ? 0 : 1;
      mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.4, 8).rotateX(Math.PI / 2), M.logs, (i % 3) * 0.46 - 0.46 + row * 0.23, 0.22 + row * 0.4, 0, pile);
    }
    place(pile, lx, lz, lx * 0.3);
    addBox(lx, lz, 0.8, 1.2, lx * 0.3, false);
  }
  for (const [lx, lz] of T.dummies ?? []) {
    if (Assets.has('props/Dummy')) {
      const dummy = Assets.clone('props/Dummy');
      dummy.scale.setScalar(1.05);
      place(dummy, lx, lz, lx);
      addCircle(lx, lz, 0.4);
      continue;
    }
    const d = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6), M.darkWood, 0, 0.95, 0, d);
    mesh(box(1.1, 0.08, 0.08), M.darkWood, 0, 1.45, 0, d);
    mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.8, 8), std(0xc9b27a), 0, 1.25, 0, d);
    mesh(new THREE.SphereGeometry(0.2, 8, 6), std(0xc9b27a), 0, 1.85, 0, d);
    place(d, lx, lz, lx);
    addCircle(lx, lz, 0.35);
  }

  // ---- Palisade: a ring of sharpened logs with a gap for the road ----
  if (T.palisade) {
    const R = T.palisade;
    const postGeo = new THREE.CylinderGeometry(0.22, 0.25, 3.4, 6);
    const tipGeo = new THREE.ConeGeometry(0.22, 0.5, 6);
    const count = Math.round((2 * Math.PI * R) / 0.5);
    const angles = [];
    for (let i = 0; i < count; i++) {
      const deg = (i / count) * 360;
      // A gap for the main road, and for any other road that reaches the wall (`gates`).
      const open = [T.entrance, ...(T.gates ?? [])].some((gate) => Math.abs(((deg - gate) % 360 + 540) % 360 - 180) < 13);
      if (!open) angles.push(deg);
    }
    const posts = new THREE.InstancedMesh(postGeo, M.logs, angles.length);
    const tips = new THREE.InstancedMesh(tipGeo, M.logs, angles.length);
    posts.castShadow = tips.castShadow = true;
    const dummy = new THREE.Object3D();
    angles.forEach((deg, i) => {
      const x = Math.cos(deg * DEG) * R, z = Math.sin(deg * DEG) * R;
      const y = groundY(x, z);
      const h = 1 + ((i * 7) % 5) * 0.04;
      dummy.position.set(x, y + 1.7 * h - 0.2, z);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(0, i, 0);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 3.4 * h - 0.2 + 0.25;
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tips.setMatrixAt(i, dummy.matrix);
    });
    g.add(posts, tips);
    // Collide in short straight runs along the ring, each ending early at a gate gap.
    const step = (360 / count) * 1.5;
    for (let i = 0; i + 1 < angles.length;) {
      let j = i;
      while (j + 1 < angles.length && j - i < 6 && angles[j + 1] - angles[j] < step) j++;
      if (j === i) { i++; continue; }
      const a0 = angles[i] * DEG, a1 = angles[j] * DEG;
      i = j;
      const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
      const len = Math.hypot(x1 - x0, z1 - z0);
      addBox((x0 + x1) / 2, (z0 + z1) / 2, len / 2 + 0.2, 0.3, Math.atan2(-(z1 - z0), x1 - x0), false);
    }
  }

  // Each town's own roof and plaster colours on the kit's shared textures (`roofTint`, `plasterTint`).
  const tinted = new Map();
  const tints = { MI_RoundTiles: T.roofTint, MI_Plaster: T.plasterTint };
  g.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || tints[o.material.name] === undefined) return;
    if (!tinted.has(o.material)) {
      const m = o.material.clone();
      m.color.set(tints[o.material.name]);
      // Take the colour out of the roof tiles first: a tint alone can only darken red, not turn it slate.
      if (o.material.name === 'MI_RoundTiles') {
        m.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) * 1.25, 0.85);`);
        };
        m.customProgramCacheKey = () => 'desat-tint';
      }
      tinted.set(o.material, m);
    }
    o.material = tinted.get(o.material);
  });

  // Everything that doesn't move becomes one mesh per material: a whole town in a few dozen draw calls.
  mergeStatic(g, [...spinners, flag]);

  return {
    id: T.id,
    group: g,
    footprints,
    spots,
    doors,
    plaza: { x: T.x, y: baseY + 4.5, z: T.z }, // lit by one of the world's shared plaza lights at night
    update(t) {
      const night = 1 - sky.daylight;
      M.window.emissiveIntensity = 0.15 + night * 1.8;
      if (kitGlass) kitGlass.emissiveIntensity = 0.1 + night * 1.6;
      M.stained.emissiveIntensity = 0.3 + night * 0.8;
      lampGlows.forEach((gl) => (gl.material.opacity = night * 0.9));
      for (const s of spinners) s.rotation.z = t * 0.6;
      if (spots.forgeGlow) spots.forgeGlow.material.opacity = 0.65 + Math.sin(t * 9) * 0.15;
      if (flag) flag.rotation.y = Math.sin(t * 2) * 0.25;
      if (spray) spray.scale.setScalar(1.5 + Math.sin(t * 6) * 0.15);
    },
  };
}
