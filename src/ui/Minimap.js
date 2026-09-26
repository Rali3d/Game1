import * as THREE from 'three';
import { heightAt, isWater, pathDistance, regionWeights, WORLD_SIZE } from '../world/Terrain.js';
import { smoothstep } from '../engine/math.js';
import { REGIONS } from '../data/world.js';

const VIEW = 70; // world units from centre to edge of the map
const TEX = 560; // terrain image resolution (2.5 world units per pixel)

// North-up circular minimap drawn with 2D canvas over a pre-rendered terrain image.
export class Minimap {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.g = game;
    this.image = this.renderTerrain(game.world.vegetation.treePoints, game.world.towns.flatMap((t) => t.footprints));
  }

  // The whole land as a picture, drawn once: the minimap shows a window of it and the world map all of it.
  renderTerrain(trees, buildings, size = TEX) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const high = new THREE.Color(0x8c8a6a), water = new THREE.Color(0x35688c), snow = new THREE.Color(0xe8ecee);
    const path = new THREE.Color(0x9a7d55);
    const col = new THREE.Color();
    const scale = WORLD_SIZE / size;
    // Region colours (and snow lines), blended, on a coarse 10 m grid and interpolated per pixel.
    const RG = 10, RN = Math.ceil(WORLD_SIZE / RG) + 1;
    const lows = Object.fromEntries(Object.entries(REGIONS).map(([k, r]) => [k, new THREE.Color(r.grass[0]).lerp(new THREE.Color(r.grass[1]), 0.4)]));
    const grid = new Float32Array(RN * RN * 4);
    for (let j = 0; j < RN; j++) {
      for (let i = 0; i < RN; i++) {
        const x = i * RG - WORLD_SIZE / 2, z = j * RG - WORLD_SIZE / 2;
        const out = smoothstep(200, 280, Math.hypot(x, z));
        const v = lows.vale;
        let r = v.r * (1 - out), gg = v.g * (1 - out), b = v.b * (1 - out), sl = 38 * (1 - out);
        for (const [key, w] of regionWeights(x, z)) {
          const c = lows[key];
          r += c.r * w * out; gg += c.g * w * out; b += c.b * w * out;
          sl += (REGIONS[key].snowLine ?? 38) * w * out;
        }
        grid.set([r, gg, b, sl], (j * RN + i) * 4);
      }
    }
    const sample = (x, z, k) => {
      const fx = (x + WORLD_SIZE / 2) / RG, fz = (z + WORLD_SIZE / 2) / RG;
      const i = Math.min(RN - 2, Math.floor(fx)), j = Math.min(RN - 2, Math.floor(fz)), u = fx - i, v = fz - j;
      const at = (a, b) => grid[(b * RN + a) * 4 + k];
      return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
    };
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = -WORLD_SIZE / 2 + (px + 0.5) * scale;
        const z = -WORLD_SIZE / 2 + (py + 0.5) * scale;
        const h = heightAt(x, z);
        if (isWater(x, z)) col.copy(water);
        else if (pathDistance(x, z) < 1.6) col.copy(path);
        else {
          col.setRGB(sample(x, z, 0), sample(x, z, 1), sample(x, z, 2)).lerp(high, smoothstep(14, 55, h) * 0.6);
          col.lerp(snow, smoothstep(sample(x, z, 3) + 2, sample(x, z, 3) + 8, h) * 0.85);
          // Hill shading, lit from the north-west, so the relief reads at a glance.
          const slope = (heightAt(x - scale, z - scale) - heightAt(x + scale, z + scale)) / (scale * 2);
          col.multiplyScalar(Math.max(0.55, Math.min(1.35, 1 + slope * 0.9)));
        }
        const i = (py * size + px) * 4;
        img.data[i] = col.r * 255;
        img.data[i + 1] = col.g * 255;
        img.data[i + 2] = col.b * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = 'rgba(20, 45, 20, 0.55)';
    for (const t of trees) {
      ctx.beginPath();
      ctx.arc((t.x + WORLD_SIZE / 2) / scale, (t.z + WORLD_SIZE / 2) / scale, (2.2 * t.s) / scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rooftops of Millbrook
    ctx.fillStyle = '#7a4a34';
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 0.8;
    for (const b of buildings) {
      ctx.save();
      ctx.translate((b.x + WORLD_SIZE / 2) / scale, (b.z + WORLD_SIZE / 2) / scale);
      ctx.beginPath();
      if (b.hw !== undefined) {
        ctx.rotate(-b.rot);
        ctx.rect(-b.hw / scale, -b.hd / scale, (b.hw * 2) / scale, (b.hd * 2) / scale);
      } else {
        ctx.arc(0, 0, b.r / scale, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    return c;
  }

  draw() {
    const { ctx, canvas, g } = this;
    const W = canvas.width, R = W / 2;
    const p = g.player.position;
    const s = W / (VIEW * 2);
    const scale = WORLD_SIZE / TEX;

    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1d2a1a';
    ctx.fillRect(0, 0, W, W);
    ctx.drawImage(this.image,
      (p.x - VIEW + WORLD_SIZE / 2) / scale, (p.z - VIEW + WORLD_SIZE / 2) / scale, (VIEW * 2) / scale, (VIEW * 2) / scale,
      0, 0, W, W);

    const toScreen = (x, z) => [(x - p.x) * s + R, (z - p.z) * s + R];
    const dot = (x, z, color, r) => {
      const [sx, sy] = toScreen(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    };

    for (const e of g.spawner.enemies) {
      if (e.alive && Math.hypot(e.position.x - p.x, e.position.z - p.z) < VIEW) dot(e.position.x, e.position.z, '#e0503d', 2.5);
    }
    for (const m of g.mapMarkers()) {
      let [sx, sy] = toScreen(m.x, m.z);
      const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy);
      if (d > R - 9) {
        if (!m.edge) continue;
        // Pin off-screen objectives to the rim so they still point the way.
        sx = R + (dx / d) * (R - 9);
        sy = R + (dy / d) * (R - 9);
      }
      ctx.fillStyle = m.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (m.shape === 'diamond') {
        ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 5, sy); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 5, sy);
        ctx.closePath();
      } else {
        ctx.arc(sx, sy, m.r || 4, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.fill();
    }

    // Player arrow
    const f = g.player.facing;
    ctx.translate(R, R);
    ctx.rotate(-f + Math.PI);
    ctx.fillStyle = '#fff6dc';
    ctx.strokeStyle = '#1a1208';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(232, 214, 170, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f4e6c0';
    ctx.font = 'bold 12px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', R, 14);
  }
}
