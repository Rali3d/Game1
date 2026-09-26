import * as THREE from 'three';
import { smoothstep } from '../engine/math.js';

const $ = (s) => document.querySelector(s);

// Only touch the DOM when a value actually changes.
function setText(el, v) {
  if (el._v !== v) { el.textContent = v; el._v = v; }
}
function setWidth(el, frac) {
  const v = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  if (el._w !== v) { el.style.width = v; el._w = v; }
}

export class HUD {
  constructor(game) {
    this.g = game;
    this.root = $('#hud');
    this.hpFill = $('#bar-hp .fill');
    this.hpLabel = $('#bar-hp .label');
    this.stFill = $('#bar-st .fill');
    this.xpFill = $('#bar-xp .fill');
    this.name = $('#char-name');
    this.level = $('#char-level');
    this.tracker = $('#tracker');
    this.prompt = $('#prompt');
    this.log = $('#log');
    this.clock = $('#clock');
    this.healIcon = $('#slot-heal .icon');
    this.healCount = $('#slot-heal .count');
    this.lockHint = $('#lock-hint');
    this.mpBar = $('#bar-mp');
    this.mpFill = $('#bar-mp .fill');
    this.coins = $('#coins');
    this.slotFire = $('#slot-fire');
    this.slotLantern = $('#slot-lantern');
    this.slotTent = $('#slot-tent');
    this.bossBar = $('#bossbar');
    this.bossFill = $('#bossbar .fill');
    this.bossName = $('#bossbar .name');
    this.where = $('#where');
    this.floaterLayer = $('#floaters');
    this.vignette = $('#vignette');
    this.floaters = [];
    this.trackerDirty = true;
    this.v = new THREE.Vector3();
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  update() {
    const g = this.g, p = g.player, s = p.stats;
    setWidth(this.hpFill, s.hp / s.maxHp);
    setText(this.hpLabel, `${Math.ceil(s.hp)} / ${s.maxHp}`);
    setWidth(this.stFill, s.stamina / s.maxStamina);
    setWidth(this.xpFill, s.xp / p.xpToNext);
    setText(this.name, g.playerName);
    setText(this.level, `Lv ${s.level}`);

    const hours = g.world.sky.hours;
    const hh = String(Math.floor(hours)).padStart(2, '0');
    const mm = String(Math.floor((hours % 1) * 4) * 15).padStart(2, '0');
    setText(this.clock, `${g.world.sky.isNight ? '☾' : '☀'} Day ${g.day} · ${hh}:${mm}`);

    this.mpBar.classList.toggle('hidden', !g.flags.fireball);
    setWidth(this.mpFill, s.mana / s.maxMana);
    setText(this.coins, `🪙 ${g.coins}`);
    this.slotFire.classList.toggle('hidden', !g.flags.fireball);
    this.slotFire.classList.toggle('dim', s.mana < 15);
    this.slotLantern.classList.toggle('hidden', !g.inventory.has('lantern'));
    this.slotLantern.classList.toggle('on', p.lanternOn);
    this.slotTent.classList.toggle('hidden', !g.inventory.has('tent'));
    setText(this.where, g.locationName());

    const boss = g.boss?.alive && g.boss.state === 'chase' ? g.boss : null;
    this.bossBar.classList.toggle('hidden', !boss);
    if (boss) {
      setWidth(this.bossFill, boss.hp / boss.def.hp);
      setText(this.bossName, boss.def.name);
    }

    const potions = g.inventory.count('potion');
    const useHerb = potions === 0 && g.inventory.count('herb') > 0;
    setText(this.healIcon, useHerb ? '🌸' : '🧪');
    setText(this.healCount, String(useHerb ? g.inventory.count('herb') : potions));

    this.lockHint.classList.toggle('hidden', g.mode !== 'play' || g.input.pointerLocked);
    if (this.trackerDirty) this.renderTracker();
  }

  renderTracker() {
    this.trackerDirty = false;
    const list = this.g.quests.list();
    this.tracker.innerHTML = list.map((q) => `
      <div class="tq ${q.status}">
        <div class="tq-title">${q.title}</div>
        ${q.status === 'ready'
          ? `<div class="tq-obj">Return to ${q.turnInName}</div>`
          : q.objectives.map((o) => `
            <div class="tq-obj ${o.have >= o.need ? 'done' : ''}">${o.text}${o.need > 1 ? ` <span>${o.have}/${o.need}</span>` : ''}</div>`).join('')}
      </div>`).join('');
  }

  setPrompt(text) {
    if (text === this._prompt) return;
    this._prompt = text;
    this.prompt.classList.toggle('hidden', !text);
    if (text) this.prompt.innerHTML = text.replace(/^\[(\w)\]/, '<kbd>$1</kbd>');
  }

  toast(html, kind = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = html;
    this.log.appendChild(el);
    while (this.log.children.length > 6) this.log.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 4500);
    setTimeout(() => el.remove(), 5200);
  }

  floater(pos, text, cls = 'dmg', height = 1.6) {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    this.floaterLayer.appendChild(el);
    this.floaters.push({ el, pos: pos.clone(), t: 0, height, drift: (Math.random() - 0.5) * 30 });
  }

  updateFloaters(dt, camera) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 1.1) {
        f.el.remove();
        this.floaters.splice(i, 1);
        continue;
      }
      this.v.copy(f.pos);
      this.v.y += f.height + f.t * 1.2;
      this.v.project(camera);
      if (this.v.z > 1) { f.el.style.opacity = 0; continue; }
      const x = (this.v.x * 0.5 + 0.5) * innerWidth + f.drift * f.t;
      const y = (-this.v.y * 0.5 + 0.5) * innerHeight;
      const pop = 1 + Math.max(0, 0.15 - f.t) * 4;
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${pop})`;
      f.el.style.opacity = 1 - smoothstep(0.7, 1.1, f.t);
    }
  }

  // A short message in the middle of the screen, for things the player tried that didn't work.
  notice(text) {
    const el = document.getElementById('notice');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('show');
  }

  // Big centred location title, e.g. on entering a village.
  banner(title, subtitle = '') {
    const el = document.getElementById('banner');
    el.querySelector('h2').textContent = title;
    el.querySelector('p').textContent = subtitle;
    el.classList.add('hidden');
    void el.offsetWidth; // restart the CSS animation
    el.classList.remove('hidden');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => el.classList.add('hidden'), 4300);
  }

  hurt() {
    this.vignette.classList.remove('hit');
    void this.vignette.offsetWidth; // restart the CSS animation
    this.vignette.classList.add('hit');
  }
}
