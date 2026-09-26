import { WORLD_SIZE, WORLD_RADIUS, LANDMARKS } from '../world/Terrain.js';
import { TOWNS, CAVES, DUNGEONS } from '../data/towns.js';
import { REGIONS, SITES } from '../data/world.js';

const $ = (s) => document.querySelector(s);

// Full-screen map of the whole land (M). Towns you haven't visited show as a question mark; caves, dungeons
// and ruins appear once you've found them.
export class WorldMap {
  constructor(game) {
    this.g = game;
    this.el = $('#worldmap');
    this.canvas = $('#worldmap-canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  show() {
    const g = this.g;
    this.image = g.minimap.image;
    this.el.classList.remove('hidden');
    this.draw();
  }

  hide() {
    this.el.classList.add('hidden');
  }

  draw() {
    const { ctx, canvas, g } = this;
    const S = canvas.width, k = S / WORLD_SIZE;
    const at = (x, z) => [(x + WORLD_SIZE / 2) * k, (z + WORLD_SIZE / 2) * k];
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.image, 0, 0, S, S);

    // Darken beyond the edge of the walkable world.
    ctx.save();
    ctx.fillStyle = 'rgba(8, 6, 4, 0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, S, S);
    ctx.arc(S / 2, S / 2, WORLD_RADIUS * k, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();

    const label = (text, x, y, color = '#fbf0d2', size = 15) => {
      ctx.font = `bold ${size}px Cinzel, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20, 12, 4, 0.85)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };
    const pin = (x, y, color, r = 6, shape = 'circle') => {
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (shape === 'diamond') {
        ctx.moveTo(x, y - r - 2); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r + 2); ctx.lineTo(x - r, y);
        ctx.closePath();
      } else if (shape === 'triangle') {
        ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8);
        ctx.closePath();
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    };

    // Region names, faint, across each region.
    for (const [key, r] of Object.entries(REGIONS)) {
      if (r.bearing === undefined) continue;
      const a = r.bearing * Math.PI / 180, d = 420;
      const [x, y] = at(Math.sin(a) * d, -Math.cos(a) * d);
      ctx.globalAlpha = 0.55;
      label(r.name.toUpperCase(), x, y, '#f4ead0', 13);
      ctx.globalAlpha = 1;
    }
    for (const t of TOWNS) {
      const [x, y] = at(t.x, t.z);
      if (g.flags[`visited_${t.id}`]) label(t.name, x, y - t.r * k - 6);
      else {
        pin(x, y, 'rgba(232, 196, 106, 0.55)', 5);
        label('?', x, y - 10, '#e8c46a', 13);
      }
    }
    for (const d of DUNGEONS) {
      if (!g.flags[`found_${d.id}`]) continue;
      const [x, y] = at(d.x, d.z);
      pin(x, y, '#8a6a9a', 7, 'triangle');
      label(d.name, x, y - 12, '#e2d0ec', 12);
    }
    for (const s of SITES) {
      if (!g.flags[`found_${s.id}`]) continue;
      const [x, y] = at(s.x, s.z);
      pin(x, y, s.kind === 'peak' ? '#d0502a' : '#a89a80', 6, 'diamond');
      label(s.name, x, y - 12, '#efe4cc', 11);
    }
    const [cx, cy] = at(LANDMARKS.camp.x, LANDMARKS.camp.z);
    pin(cx, cy, '#ff9a3c', 5);
    label("Oswin's camp", cx, cy - 10, '#ffd9a8', 12);
    const [sx, sy] = at(LANDMARKS.stones.x, LANDMARKS.stones.z);
    pin(sx, sy, '#7fe8ff', 6, 'diamond');
    label('Standing Stones', sx, sy - 12, '#cff6ff', 12);
    for (const c of CAVES) {
      if (!g.flags[`found_${c.id}`]) continue;
      const [x, y] = at(c.x, c.z);
      pin(x, y, '#3a3632', 7, 'triangle');
      label(c.name, x, y - 12, '#e6dcc6', 12);
    }
    if (g.tent) {
      const [x, y] = at(g.tent.x, g.tent.z);
      pin(x, y, '#c9a24a', 5, 'triangle');
    }
    // Current objectives (the ones the minimap pins to its edge).
    for (const m of g.mapMarkers()) {
      if (!m.edge) continue;
      const [x, y] = at(m.x, m.z);
      pin(x, y, m.color, 7, 'diamond');
    }

    // You are here
    if (g.space === g.world) {
      const [px, py] = at(g.player.position.x, g.player.position.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-g.player.facing + Math.PI);
      ctx.fillStyle = '#fff6dc';
      ctx.strokeStyle = '#1a1208';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.font = 'bold 18px Cinzel, Georgia, serif';
    ctx.fillStyle = '#f4e6c0';
    ctx.textAlign = 'center';
    ctx.fillText('N', S / 2, 24);
  }
}
