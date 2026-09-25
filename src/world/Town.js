import * as THREE from 'three';
import { heightAt, LANDMARKS } from './Terrain.js';
import { glowSprite } from './Props.js';

// Millbrook: a ring of timber-framed houses around a well, with an inn, a smithy, a market stall and
// a windmill. Everything is laid out in town-local coordinates (origin = the well, -z = north,
// where the path comes in) and converted to world space for colliders and NPC spots.

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function mesh(geo, material, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Triangular prism roof with its ridge along x.
function roofGeometry(length, depth, height) {
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

function signMaterial(text, { width = 512, height = 128, font = 64 } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a3d22';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#3a2614';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, width - 10, height - 10);
  ctx.fillStyle = '#f1dfae';
  ctx.font = `bold ${font}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
}

// Position on a ring around the well, rotated so local +z faces the well.
function ring(deg, radius) {
  const a = (deg * Math.PI) / 180;
  const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
  return { x, z, ry: Math.atan2(-x, -z) };
}

function createHouse(M, { w, d, h, wall, roof, sign }) {
  const g = new THREE.Group();
  const base = 0.35, top = base + h;
  mesh(box(w + 0.3, 0.6, d + 0.3), M.stone, 0, 0.05, 0, g);
  mesh(box(w, h, d), wall, 0, base + h / 2, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.22, h, 0.22), M.timber, (sx * w) / 2, base + h / 2, (sz * d) / 2, g);
  for (const sz of [-1, 1]) mesh(box(w + 0.1, 0.2, 0.24), M.timber, 0, top - 0.1, (sz * d) / 2, g);
  mesh(box(w + 0.1, 0.16, 0.24), M.timber, 0, base + h * 0.52, d / 2 + 0.01, g);

  const rh = d * 0.55;
  mesh(roofGeometry(w + 0.8, d + 0.9, rh), roof, 0, top, 0, g);
  mesh(box(0.6, rh + 1.0, 0.6), M.stone, w * 0.28, top + rh * 0.55, -d * 0.12, g);

  mesh(box(1.0, 1.9, 0.12), M.door, -w * 0.2, base + 0.95, d / 2 + 0.06, g);
  mesh(box(0.85, 0.8, 0.1), M.window, w * 0.22, base + h * 0.3, d / 2 + 0.05, g);
  for (const sx of [-1, 1]) mesh(box(0.1, 0.8, 0.85), M.window, sx * (w / 2 + 0.05), base + h * 0.3, 0, g);
  if (h > 3.6) {
    // second storey
    for (const x of [-w * 0.25, w * 0.25]) mesh(box(0.85, 0.75, 0.1), M.window, x, base + h * 0.78, d / 2 + 0.05, g);
  }
  if (sign) {
    const board = mesh(new THREE.PlaneGeometry(3.2, 0.8), signMaterial(sign, { font: 58 }), 0.4, base + h * 0.52 + 0.55, d / 2 + 0.14, g);
    board.castShadow = false;
  }
  return g;
}

export function createTown(scene, colliders, sky) {
  const T = LANDMARKS.town;
  const baseY = heightAt(T.x, T.z);
  const g = new THREE.Group();
  g.position.set(T.x, baseY, T.z);
  scene.add(g);

  const M = {
    stone: std(0x8a847a, { flatShading: true }),
    timber: std(0x4a3424),
    door: std(0x3b2718),
    wood: std(0x7a5a3a),
    darkWood: std(0x4f3826),
    metal: std(0x3a3a3c, { metalness: 0.6, roughness: 0.5 }),
    // Windows and lanterns glow at night (intensity driven in update()).
    window: new THREE.MeshStandardMaterial({ color: 0x2e2a22, emissive: 0xffbe5c, emissiveIntensity: 0, roughness: 0.4 }),
  };
  const walls = [0xe8dcc0, 0xd9c7a0, 0xe3d2b8, 0xcdbb98].map((c) => std(c));
  const roofs = [0x8a3b2a, 0x5d4a3a, 0x6b6f47, 0x7a3030].map((c) => std(c, { flatShading: true }));

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

  // ---- Houses (the north side is left open for the path) ----
  const houses = [
    { at: ring(-5, 17), w: 6, d: 5, h: 3.0 },
    { at: ring(35, 16.5), w: 5, d: 4.6, h: 2.8 },
    { at: ring(90, 18.5), w: 9.5, d: 6.5, h: 4.4, sign: 'The Fallen Star' },
    { at: ring(137, 17), w: 5.5, d: 5, h: 3.0 },
    { at: ring(177, 17.5), w: 6.5, d: 5, h: 3.2 },
  ];
  houses.forEach((hs, i) => {
    const house = createHouse(M, { ...hs, wall: walls[i % walls.length], roof: roofs[i % roofs.length] });
    place(house, hs.at.x, hs.at.z, hs.at.ry);
    addBox(hs.at.x, hs.at.z, (hs.w + 0.3) / 2, (hs.d + 0.3) / 2, hs.at.ry);
  });

  // ---- Well ----
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

  // ---- Market stall ----
  const stall = new THREE.Group();
  mesh(box(3, 1, 1.1), M.wood, 0, 0.5, 0, stall);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.1, 2.5, 0.1), M.darkWood, sx * 1.45, 1.25, sz * 0.8 - 0.2, stall);
  const stripeA = std(0xb8413a), stripeB = std(0xefe4c8);
  for (let i = 0; i < 6; i++) {
    const s = mesh(box(0.52, 0.05, 2.0), i % 2 ? stripeB : stripeA, -1.3 + i * 0.52, 2.55, -0.2, stall);
    s.rotation.x = -0.18;
  }
  const produce = [0xd8a23a, 0x8fbf4a, 0xc2452d];
  produce.forEach((c, i) => {
    for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(0.1, 6, 5), std(c), -1 + i * 1 + (k % 2) * 0.2, 1.08, 0.1 + (k > 1 ? 0.2 : 0), stall);
  });
  mesh(box(0.7, 0.6, 0.7), M.wood, 2.1, 0.3, 0.4, stall);
  mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.9, 10), M.darkWood, -2.1, 0.45, 0.3, stall);
  place(stall, -7, 4, Math.PI / 2 + 0.3);
  addBox(-7, 4, 1.7, 0.8, Math.PI / 2 + 0.3, false);

  // ---- Smithy: an open-sided shed with a forge, anvil and weapon rack ----
  const sm = ring(-40, 15);
  const smithy = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.2, 3, 0.2), M.timber, sx * 2.3, 1.5, sz * 1.7, smithy);
  mesh(box(5.4, 0.2, 4.4), roofs[1], 0, 3.1, 0, smithy).rotation.x = 0.12;
  mesh(box(1.7, 1.1, 1.3), M.stone, -1.3, 0.55, -1.0, smithy);
  mesh(box(0.8, 3.0, 0.8), M.stone, -1.3, 2.2, -1.35, smithy);
  const coals = mesh(box(1.3, 0.05, 0.9), new THREE.MeshBasicMaterial({ color: 0xff6a1a }), -1.3, 1.12, -0.95, smithy);
  coals.castShadow = false;
  mesh(box(0.34, 0.5, 0.34), M.metal, 0.7, 0.25, 0.5, smithy);
  mesh(box(0.8, 0.22, 0.34), M.metal, 0.7, 0.6, 0.5, smithy);
  mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.6, 10), M.darkWood, -0.2, 0.3, 1.2, smithy);
  const smithySign = mesh(new THREE.PlaneGeometry(2.2, 0.55), signMaterial('Smithy'), 0, 2.75, 1.82, smithy);
  smithySign.castShadow = false;
  const forgeGlow = glowSprite(0xff7a2a, 2.2, 0.8);
  forgeGlow.position.set(-1.3, 1.4, -0.95);
  smithy.add(forgeGlow);
  const forgeLight = new THREE.PointLight(0xff7a2a, 10, 10, 1.8);
  forgeLight.position.set(-1.3, 1.8, -0.4);
  smithy.add(forgeLight);
  place(smithy, sm.x, sm.z, sm.ry);
  // Local shed offsets -> town-local, for colliders and spots.
  const smithyPoint = (lx, lz) => {
    const c = Math.cos(sm.ry), s = Math.sin(sm.ry);
    return { x: sm.x + lx * c + lz * s, z: sm.z - lx * s + lz * c };
  };
  const forgeAt = smithyPoint(-1.3, -1.0), anvilAt = smithyPoint(0.7, 0.5), rackAt = smithyPoint(1.7, -1.1);
  addBox(forgeAt.x, forgeAt.z, 0.9, 0.7, sm.ry);
  addCircle(anvilAt.x, anvilAt.z, 0.45);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = smithyPoint(sx * 2.3, sz * 1.7);
    addCircle(p.x, p.z, 0.2);
  }

  // ---- Windmill (it's Millbrook, after all) ----
  const wm = ring(215, 25);
  const mill = new THREE.Group();
  mesh(new THREE.CylinderGeometry(1.6, 2.4, 8, 8), std(0xe0d4ba, { flatShading: true }), 0, 4, 0, mill);
  mesh(new THREE.ConeGeometry(2.1, 2.4, 8), roofs[3], 0, 9.2, 0, mill);
  mesh(box(1.0, 1.9, 0.2), M.door, 0, 0.95, 2.28, mill);
  mesh(box(0.6, 0.6, 0.15), M.window, 0, 5, 1.9, mill);
  const blades = new THREE.Group();
  blades.position.set(0, 7.2, 2.2);
  mill.add(blades);
  mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 10).rotateX(Math.PI / 2), M.darkWood, 0, 0, 0, blades);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
    mesh(box(0.14, 4.6, 0.1), M.darkWood, 0, 2.4, 0.1, arm);
    mesh(box(0.9, 3.6, 0.04), std(0xefe6d0, { side: THREE.DoubleSide }), 0.5, 2.7, 0.12, arm);
  }
  place(mill, wm.x, wm.z, wm.ry);
  addCircle(wm.x, wm.z, 2.5, true);

  // ---- Lamp posts ----
  const lampGlows = [];
  for (const deg of [-65, -115, 20, 160, 65, 115]) {
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
  const plazaLight = new THREE.PointLight(0xffb45a, 0, 34, 1.5);
  plazaLight.position.set(0, 4.5, 0);
  g.add(plazaLight);

  // ---- Entrance sign, fences and hay ----
  const signPost = new THREE.Group();
  for (const sx of [-1, 1]) mesh(box(0.14, 2.2, 0.14), M.darkWood, sx * 1.3, 1.1, 0, signPost);
  const nameBoard = mesh(new THREE.PlaneGeometry(2.8, 0.75), signMaterial('Millbrook', { font: 70 }), 0, 1.75, -0.08, signPost);
  nameBoard.rotation.y = Math.PI; // readable when arriving from the north
  mesh(box(2.9, 0.8, 0.06), M.darkWood, 0, 1.75, 0, signPost);
  place(signPost, 3.2, -25);
  addCircle(3.2 - 1.3, -25, 0.2);
  addCircle(3.2 + 1.3, -25, 0.2);

  for (const [lx, lz, len, ry] of [[-17, -8, 8, 0.5], [16, 8, 7, -0.6], [-12, 19, 6, 1.1]]) {
    const fence = new THREE.Group();
    const n = Math.round(len / 1.4);
    for (let i = 0; i <= n; i++) mesh(box(0.12, 1.0, 0.12), M.darkWood, -len / 2 + (i * len) / n, 0.5, 0, fence);
    for (const y of [0.4, 0.8]) mesh(box(len, 0.08, 0.06), M.wood, 0, y, 0, fence);
    place(fence, lx, lz, ry);
    addBox(lx, lz, len / 2, 0.1, ry, false);
  }
  for (const [lx, lz] of [[-14, 10], [-15.5, 11.5], [12, -2]]) {
    const hay = mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 12).rotateZ(Math.PI / 2), std(0xd6b45a), lx, 0.6, lz, g);
    hay.position.y = groundY(lx, lz) + 0.6;
    addCircle(lx, lz, 0.65);
  }

  const inn = houses[2].at;
  const brennaAt = smithyPoint(0.6, 1.5);
  const spots = {
    // Where townsfolk stand, and where the player wakes after resting at the inn.
    brenna: { ...toWorld(brennaAt.x, brennaAt.z), facing: sm.ry },
    tam: { ...toWorld(2.4, 12.8), facing: Math.atan2(-2.4, -12.8) },
    pip: toWorld(0, -5),
    rack: { ...toWorld(rackAt.x, rackAt.z), ry: sm.ry },
    innDoor: { ...toWorld(inn.x - 1.5, inn.z - 5.5), facing: Math.PI },
  };

  return {
    group: g,
    footprints,
    spots,
    update(t) {
      const night = 1 - sky.daylight;
      M.window.emissiveIntensity = 0.15 + night * 1.8;
      lampGlows.forEach((gl) => (gl.material.opacity = night * 0.9));
      plazaLight.intensity = night * 35;
      blades.rotation.z = t * 0.6;
      forgeLight.intensity = 9 + Math.sin(t * 13) * 1.5 + Math.sin(t * 5.1) * 1.2;
      forgeGlow.material.opacity = 0.65 + Math.sin(t * 9) * 0.15;
    },
  };
}
