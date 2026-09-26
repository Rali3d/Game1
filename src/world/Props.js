import * as THREE from 'three';
import { heightAt } from './Terrain.js';
import { createWeapon } from '../entities/Gear.js';

let glowTexture;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTexture(), color, opacity, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(size);
  return s;
}

// A faint vertical light beam so objectives can be spotted from far away.
function beam(color, height, opacity) {
  const geo = new THREE.CylinderGeometry(0.12, 0.35, height, 8, 1, true).translate(0, height / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  }));
  m.renderOrder = 5;
  return m;
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function grounded(group, x, z) {
  group.position.set(x, heightAt(x, z), z);
  return group;
}

export function createCampfire(x, z) {
  const g = grounded(new THREE.Group(), x, z);
  const stone = std(0x77736d, { flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = mesh(new THREE.DodecahedronGeometry(0.2, 0), stone, Math.cos(a) * 0.75, 0.08, Math.sin(a) * 0.75);
    s.rotation.set(i, i * 2, 0);
    g.add(s);
  }
  const wood = std(0x4a3222);
  for (let i = 0; i < 4; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.1, 6), wood, 0, 0.12, 0);
    log.rotation.set(0, (i * Math.PI) / 4, Math.PI / 2);
    g.add(log);
  }
  const seat = mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.7, 8), wood, -1.9, 0.2, 0.7);
  seat.rotation.set(0, 0.4, Math.PI / 2);
  g.add(seat);
  g.add(mesh(new THREE.BoxGeometry(0.75, 0.08, 1.8), std(0x7a3b2e), 1.3, 0.05, -1.9));

  const flames = [];
  const flameMat = (c) => new THREE.MeshBasicMaterial({
    color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  [[0.3, 0.9, 0xff6a1a], [0.2, 0.7, 0xffb13b], [0.12, 0.5, 0xffe38a]].forEach(([r, h, c]) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8).translate(0, h / 2, 0), flameMat(c));
    f.position.y = 0.1;
    g.add(f);
    flames.push(f);
  });
  const fireGlow = glowSprite(0xff8a3a, 3.2, 0.7);
  fireGlow.position.y = 0.6;
  g.add(fireGlow);
  const light = new THREE.PointLight(0xff8c3a, 30, 22, 1.6);
  light.position.y = 1.0;
  g.add(light);

  const smokeMat = () => new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0x8a8a8a, transparent: true, depthWrite: false });
  const smoke = Array.from({ length: 6 }, () => {
    const s = new THREE.Sprite(smokeMat());
    g.add(s);
    return s;
  });

  return {
    group: g,
    position: g.position,
    update(t) {
      flames.forEach((f, i) => {
        f.scale.set(1 + Math.sin(t * 11 + i) * 0.08, 1 + Math.sin(t * 13 + i * 2) * 0.2, 1 + Math.cos(t * 9 + i) * 0.08);
        f.rotation.y = t * (0.6 + i * 0.3);
      });
      light.intensity = 28 + Math.sin(t * 17) * 4 + Math.sin(t * 7.3) * 3;
      smoke.forEach((s, i) => {
        const k = (t * 0.25 + i / smoke.length) % 1;
        s.position.set(Math.sin(t * 0.7 + i) * 0.3 * k, 0.9 + k * 4, Math.cos(t * 0.5 + i) * 0.3 * k);
        s.scale.setScalar(0.5 + k * 2.2);
        s.material.opacity = (1 - k) * 0.28 * Math.min(1, k * 5);
      });
    },
  };
}

export function createStandingStones(x, z) {
  const g = grounded(new THREE.Group(), x, z);
  const rockMat = std(0x8a867d, { flatShading: true });
  const runeMat = new THREE.MeshBasicMaterial({
    color: 0x7fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const colliders = [];
  const count = 8, radius = 7;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const px = Math.cos(a) * radius, pz = Math.sin(a) * radius;
    const h = 3.6 + ((i * 37) % 10) / 10 * 1.8;
    const pillar = new THREE.Group();
    pillar.position.set(px, 0, pz);
    pillar.rotation.y = -a + Math.PI / 2;
    if (i === 5) {
      // one fallen stone
      const fallen = mesh(new THREE.BoxGeometry(1.1, h, 0.75), rockMat, 0, 0.35, 0);
      fallen.rotation.set(Math.PI / 2 - 0.1, 0, 0.3);
      pillar.add(fallen);
    } else {
      const stone = mesh(new THREE.BoxGeometry(1.1, h, 0.75), rockMat, 0, h / 2 - 0.3, 0);
      stone.rotation.z = (((i * 13) % 7) - 3) * 0.02;
      pillar.add(stone);
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.22, h * 0.45), runeMat);
      // Pillar-local +z points away from the circle, so the rune goes on the inner (-z) face.
      rune.position.set(0, h * 0.5, -0.38);
      rune.rotation.y = Math.PI;
      pillar.add(rune);
    }
    g.add(pillar);
    colliders.push({ x: x + px, z: z + pz, r: 0.8 });
  }
  const altar = mesh(new THREE.BoxGeometry(1.8, 0.9, 1.1), rockMat, 0, 0.35, 0);
  g.add(altar);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2), runeMat);
  disc.position.y = 0.81;
  g.add(disc);
  const glow = glowSprite(0x7fe8ff, 5, 0);
  glow.position.y = 1.6;
  g.add(glow);
  const light = new THREE.PointLight(0x7fe8ff, 0, 26, 1.6);
  light.position.y = 2.5;
  g.add(light);
  colliders.push({ x, z, r: 1.15 });

  let level = 0; // 0 dormant, 1 calling to the player, 2 awakened
  return {
    group: g,
    colliders,
    altarPosition: g.position.clone(),
    setLevel(l) {
      level = l;
    },
    update(t) {
      const pulse = 0.5 + 0.5 * Math.sin(t * (level === 1 ? 2.5 : 1.2));
      const target = level === 0 ? 0.05 : level === 1 ? 0.35 + pulse * 0.45 : 0.8 + pulse * 0.2;
      runeMat.opacity = target;
      glow.material.opacity = target * 0.8;
      light.intensity = level === 0 ? 0 : target * 40;
    },
  };
}

export function createShard(x, z) {
  const g = grounded(new THREE.Group(), x, z);
  const floater = new THREE.Group();
  g.add(floater);
  const crystal = mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({
    color: 0x9ff3ff, emissive: 0x4fd8ff, emissiveIntensity: 1.8, roughness: 0.2, transparent: true, opacity: 0.92,
  }));
  crystal.scale.set(1, 1.9, 1);
  floater.add(crystal, glowSprite(0x6fe0ff, 2.4, 0.9));
  g.add(beam(0x6fe0ff, 45, 0.1));
  return {
    group: g,
    update(t) {
      floater.position.y = 1.15 + Math.sin(t * 2 + x) * 0.15;
      crystal.rotation.y = t * 1.3;
    },
  };
}

export function createLetter(x, z) {
  const g = grounded(new THREE.Group(), x, z);
  const paper = mesh(new THREE.PlaneGeometry(0.34, 0.44).rotateX(-Math.PI / 2), std(0xe8dcc0, { side: THREE.DoubleSide }), 0, 0.04, 0);
  paper.rotation.y = 0.5;
  const glow = glowSprite(0xfff1c2, 1.4, 0.7);
  glow.position.y = 0.3;
  g.add(paper, glow, beam(0xfff1c2, 10, 0.08));
  return {
    group: g,
    update(t) {
      glow.material.opacity = 0.45 + Math.sin(t * 3) * 0.25;
    },
  };
}

// A weapon lying in the world, waiting to be picked up. pose: 'ground' | 'stump' | 'lean' | 'rack'.
export function createWeaponPickup(x, z, itemId, pose = 'ground', rotY = 0) {
  const g = grounded(new THREE.Group(), x, z);
  g.rotation.y = rotY;
  const weapon = createWeapon(itemId);
  let glowY = 0.9;

  if (pose === 'ground') {
    weapon.rotation.set(Math.PI / 2, 0, 0.18); // blade down, planted in the earth
    weapon.position.y = 0.78;
  } else if (pose === 'stump') {
    const wood = std(0x5a4130);
    g.add(mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 10), wood, 0, 0.3, 0));
    g.add(mesh(new THREE.CircleGeometry(0.45, 10).rotateX(-Math.PI / 2), std(0xb89a6a), 0, 0.605, 0));
    for (let i = 0; i < 5; i++) {
      const log = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 7), wood, 1.3, 0.16 + (i > 2 ? 0.3 : 0), -0.4 + (i % 3) * 0.34 + (i > 2 ? 0.17 : 0));
      log.rotation.z = Math.PI / 2;
      g.add(log);
    }
    weapon.rotation.set(Math.PI / 2 - 0.25, 0, 0); // head buried in the stump top
    weapon.position.set(0, 1.25, -0.15);
    glowY = 1.2;
  } else if (pose === 'lean') {
    const rock = mesh(new THREE.DodecahedronGeometry(0.75, 0), std(0x7b766d, { flatShading: true }), 0, 0.35, 0.75);
    rock.scale.set(1, 0.9, 0.8);
    g.add(rock);
    // An abandoned hunter's camp: a collapsed tent and a cold fire ring.
    const tent = mesh(new THREE.ConeGeometry(1.3, 1.6, 4, 1, true), std(0x8a7a5a, { side: THREE.DoubleSide }), -2.6, 0.55, 0.6);
    tent.rotation.set(0.35, 0.6, 0.2);
    g.add(tent);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.add(mesh(new THREE.DodecahedronGeometry(0.16, 0), std(0x3d3a36), -1.2 + Math.cos(a) * 0.5, 0.06, -1.6 + Math.sin(a) * 0.5));
    }
    weapon.rotation.set(-(Math.PI / 2 - 0.35), 0, 0); // shaft leaning back against the rock
    weapon.position.set(0, 0.7, 0);
    glowY = 1.4;
  } else if (pose === 'rack') {
    const wood = std(0x6b4a2e);
    g.add(mesh(box(0.1, 1.5, 0.1), wood, -0.45, 0.75, 0), mesh(box(0.1, 1.5, 0.1), wood, 0.45, 0.75, 0));
    g.add(mesh(box(1.1, 0.08, 0.14), wood, 0, 1.35, 0), mesh(box(1.1, 0.08, 0.14), wood, 0, 0.3, 0));
    weapon.rotation.set(-Math.PI / 2, 0, 0); // hung point-up on the rack
    weapon.position.set(0, 0.45, 0.1);
    glowY = 1.0;
  }

  const glow = glowSprite(0xffe2a8, 1.3, 0.5);
  glow.position.y = glowY;
  g.add(weapon, glow);
  return {
    group: g,
    // Only the weapon disappears when taken; the stump, rock or rack stays.
    weapon,
    glow,
    update(t) {
      glow.material.opacity = 0.3 + Math.sin(t * 2.4 + x) * 0.2;
    },
  };
}

export function createHerb(x, z) {
  const g = grounded(new THREE.Group(), x, z);
  const leaf = std(0x3f7a33);
  for (let i = 0; i < 3; i++) {
    const l = mesh(new THREE.ConeGeometry(0.06, 0.38, 4), leaf, 0, 0.16, 0);
    l.rotation.set(0.4, (i / 3) * Math.PI * 2, 0);
    l.position.set(Math.sin((i / 3) * Math.PI * 2) * 0.07, 0.16, Math.cos((i / 3) * Math.PI * 2) * 0.07);
    g.add(l);
  }
  const flower = mesh(new THREE.SphereGeometry(0.1, 8, 6), std(0xd4b3ff, { emissive: 0x6a3fb0, emissiveIntensity: 0.6 }), 0, 0.4, 0);
  const glow = glowSprite(0xc9a3ff, 0.8, 0.5);
  glow.position.y = 0.4;
  g.add(flower, glow);
  return {
    group: g,
    update(t) {
      glow.material.opacity = 0.3 + Math.sin(t * 2 + x) * 0.2;
    },
  };
}

// A small ridge tent the player can pitch, with a bedroll peeking out. Faces +z (the open flap).
export function createTent() {
  const g = new THREE.Group();
  const canvas = std(0x8a6a3a, { side: THREE.DoubleSide, flatShading: true });
  const shape = new THREE.Shape();
  shape.moveTo(-1.3, 0);
  shape.lineTo(1.3, 0);
  shape.lineTo(0, 1.6);
  shape.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false }).translate(0, 0, -1.2), canvas);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), new THREE.MeshBasicMaterial({ color: 0x1a120a }));
  flap.position.set(0, 0.6, 1.21);
  g.add(flap);
  const pole = std(0x4a3222);
  for (const z of [-1.3, 1.3]) g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 5), pole, 0, 0.9, z));
  g.add(mesh(box(0.8, 0.1, 1.0), std(0x7a3b2e), 0, 0.05, 1.5));
  return { group: g, update() {} };
}
