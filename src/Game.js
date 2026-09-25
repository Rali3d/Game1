import * as THREE from 'three';
import { Engine } from './engine/Engine.js';
import { Input } from './engine/Input.js';
import { events } from './engine/EventBus.js';
import { smoothstep } from './engine/math.js';
import { mulberry32 } from './engine/noise.js';
import { World } from './world/World.js';
import { LANDMARKS, heightAt, isWater } from './world/Terrain.js';
import { createLetter, createShard, createSwordInGround, createHerb } from './world/Props.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { Spawner } from './systems/Spawner.js';
import { CameraController } from './systems/CameraController.js';
import { QuestSystem } from './systems/QuestSystem.js';
import { Inventory } from './systems/Inventory.js';
import { Interactions } from './systems/Interactions.js';
import { saveGame, loadGame } from './systems/SaveGame.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';
import { DialogueUI } from './ui/DialogueUI.js';
import { Screens } from './ui/Screens.js';
import { ITEMS } from './data/items.js';
import { wandererTree } from './data/dialogue.js';
import { INTRO_LINES, LETTER, SHARD_MEMORIES, STONES_REVEAL, CHAPTER_END } from './data/story.js';

const SPOTS = {
  letter: { x: 5, z: -9 },
  sword: { x: -12, z: 7 },
  shards: [{ x: 38, z: -57 }, { x: 74, z: 50 }, { x: -80, z: -24 }],
};
const tmp = new THREE.Vector3();

// Modes: title -> intro -> waking -> play <-> (dialogue | card | menu | paused | dead)
export class Game {
  constructor() {
    this.engine = new Engine(document.getElementById('game'));
    const { scene, camera, renderer } = this.engine;
    this.scene = scene;
    this.camera = camera;
    this.canvas = renderer.domElement;
    this.input = new Input(this.canvas);

    this.world = new World(scene);
    this.player = new Player(scene);
    this.inventory = new Inventory();
    this.counters = {};
    this.flags = {};
    this.collected = new Set();
    this.memories = [];
    this.playerName = '???';
    this.day = 1;

    this.hud = new HUD(this);
    this.quests = new QuestSystem(this);
    this.cam = new CameraController(camera, this.input);
    this.spawner = new Spawner(scene, this.world);
    this.interactions = new Interactions(this.world);
    this.dialogue = new DialogueUI();
    this.screens = new Screens(this);
    this.minimap = new Minimap(document.getElementById('minimap'), this);

    const { camp } = LANDMARKS;
    this.oswin = new NPC(scene, camp.x + 2.4, camp.z + 1.2, -2.0);
    this.world.colliders.push({ x: this.oswin.position.x, z: this.oswin.position.z, r: 0.5 });
    this.setupInteractables();
    this.bindEvents();

    const { spawn } = LANDMARKS;
    this.player.position.set(spawn.x, heightAt(spawn.x, spawn.z), spawn.z);
    this.player.getUp = 0;
    this.player.update(0, this.input, 0, this.world, false);

    this.mode = 'title';
    this.engine.onUpdate((dt, t) => this.update(dt, t));
    this.engine.start();
    this.screens.showTitle(!!loadGame());
  }

  // ---------------------------------------------------------------- setup
  setupInteractables() {
    const I = this.interactions, W = this.world;
    const at = (p) => ({ x: p.x, y: heightAt(p.x, p.z), z: p.z });
    const place = (factory, p) => {
      const prop = W.add(factory(p.x, p.z));
      this.scene.add(prop.group);
      return prop;
    };

    I.add({
      id: 'letter', position: at(SPOTS.letter), radius: 2.2, prop: place(createLetter, SPOTS.letter),
      label: () => '[E] Pick up the paper',
      onUse: () => {
        this.collect('letter');
        this.giveItem('torn_letter', 1, false);
        this.showCard(LETTER);
        this.hud.toast('Something glints in the grass to the west.');
      },
    });

    I.add({
      id: 'sword', position: at(SPOTS.sword), radius: 2.2, prop: place(createSwordInGround, SPOTS.sword),
      label: () => '[E] Pull the sword from the earth',
      onUse: () => {
        this.collect('sword');
        this.giveItem('rusty_sword', 1, false);
        this.player.equip('rusty_sword');
        this.hud.toast('You pull the <b>Rusty Sword</b> free. It fits your hand as if it always has.', 'quest');
      },
    });

    SPOTS.shards.forEach((p, i) => I.add({
      id: `shard${i}`, position: at(p), radius: 2.4, prop: place(createShard, p),
      label: () => '[E] Touch the glowing shard',
      onUse: () => {
        this.collect(`shard${i}`);
        const n = this.counter('shard');
        this.memories.push(n);
        this.showCard({ kind: `Memory ${n + 1} of 3`, style: 'memory', ...SHARD_MEMORIES[n] });
        this.bump('shard');
        this.grantXp(25);
      },
    }));

    // Moonpetals scattered around the meadow.
    const rng = mulberry32(77);
    for (let i = 0, placed = 0; i < 200 && placed < 16; i++) {
      const a = rng() * Math.PI * 2, r = 18 + rng() * 75;
      const p = { x: Math.cos(a) * r, z: Math.sin(a) * r };
      if (isWater(p.x, p.z, 0.5) || this.world.isSafe(p.x, p.z)) continue;
      const id = `herb${placed++}`;
      I.add({
        id, position: at(p), radius: 1.8, prop: place(createHerb, p),
        label: () => '[E] Pick the moonpetal',
        onUse: () => {
          this.collect(id);
          this.giveItem('herb');
        },
      });
    }

    I.add({
      id: 'campfire', position: at(LANDMARKS.camp), radius: 2.6,
      label: () => '[E] Rest by the fire',
      onUse: () => this.rest(),
    });

    I.add({
      id: 'oswin', position: this.oswin.position, radius: 2.8,
      label: () => `[E] Talk to ${this.flags.knowsName ? 'Oswin' : 'the stranger'}`,
      onUse: () => this.talkToOswin(),
    });

    I.add({
      id: 'altar', position: this.world.stones.altarPosition, radius: 2.8,
      label: () => '[E] Touch the altar',
      onUse: () => this.touchAltar(),
    });
  }

  bindEvents() {
    events.on('enemy:killed', ({ enemy }) => {
      this.player.gainXp(enemy.def.xp);
      this.hud.floater(enemy.position, `+${enemy.def.xp} XP`, 'xp', 2.2);
      for (const [id, chance] of enemy.def.loot) if (Math.random() < chance) this.giveItem(id);
      this.bump(`kill:${enemy.type}`);
    });
    events.on('player:hurt', (dmg) => {
      this.hud.hurt();
      this.hud.floater(this.player.position, `-${dmg}`, 'hurt', 2.0);
      this.cam.shake(0.2);
    });
    events.on('player:died', () => {
      this.deadT = 0;
      this.setMode('dead');
    });
    events.on('player:levelup', (lvl) => {
      this.hud.toast(`<b>Level ${lvl}!</b> You feel stronger.`, 'level');
      this.hud.floater(this.player.position, 'LEVEL UP', 'level', 2.4);
    });
    events.on('inventory:changed', () => this.quests.check());
    events.on('quest:completed', (id) => this.onQuestComplete(id));
    events.on('quest:started', (id) => {
      if (id === 'stones') this.world.stones.setLevel(1);
    });

    this.canvas.addEventListener('click', () => {
      if (this.mode === 'play' && !this.input.pointerLocked) this.tryLock();
    });
    document.addEventListener('pointerlockchange', () => {
      // Esc releases pointer lock in the browser; treat that as a pause request.
      if (!document.pointerLockElement && this.mode === 'play') this.pause();
    });
  }

  // ---------------------------------------------------------------- state helpers
  counter(name) {
    return name.startsWith('item:') ? this.inventory.count(name.slice(5)) : this.counters[name] || 0;
  }

  bump(name, n = 1) {
    this.counters[name] = (this.counters[name] || 0) + n;
    this.quests.check();
  }

  giveItem(id, n = 1, announce = true) {
    this.inventory.add(id, n);
    if (announce) this.hud.toast(`${ITEMS[id].icon} ${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}`, 'loot');
  }

  grantXp(n) {
    this.player.gainXp(n);
    this.hud.floater(this.player.position, `+${n} XP`, 'xp', 2.2);
  }

  collect(id) {
    this.collected.add(id);
    this.interactions.remove(id);
  }

  tryLock() {
    try {
      const p = this.canvas.requestPointerLock?.();
      p?.catch?.(() => {});
    } catch { /* pointer lock unavailable; drag-to-look still works */ }
  }

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'play') {
      this.hud.setPrompt(null);
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  showCard(card) {
    if (this.mode === 'play') this.setMode('card');
    this.screens.showCard(card);
  }

  onCardsClosed() {
    if (this.mode === 'card') this.setMode('play');
  }

  // ---------------------------------------------------------------- flow
  newGame() {
    this.screens.hideTitle();
    this.setMode('intro');
    this.screens.showIntro(INTRO_LINES, () => this.beginWaking());
  }

  beginWaking() {
    this.setMode('waking');
    this.wakeT = 0;
    this.screens.fadeEl.style.transition = 'none';
  }

  continueGame() {
    const data = loadGame();
    if (!data) return this.newGame();
    this.screens.hideTitle();
    this.applySave(data);
    this.cam.yaw = this.player.facing + Math.PI;
    this.cam.snapFocus(this.player.position);
    this.cam.startBlend(1.2);
    this.hud.show();
    this.setMode('play');
    this.tryLock();
    this.hud.toast('You pick up where you left off.');
  }

  pause() {
    this.pausedAt = performance.now();
    this.setMode('paused');
    this.screens.showPause();
  }

  resume() {
    this.screens.hidePause();
    this.setMode('play');
    this.tryLock();
  }

  rest() {
    if (this.spawner.anyHunting(this.player.position, 30)) {
      this.hud.toast("You can't rest while something is hunting you.", 'warn');
      return;
    }
    this.setMode('card');
    this.screens.fadeThrough(() => {
      const s = this.player.stats;
      s.hp = s.maxHp;
      s.stamina = s.maxStamina;
      this.world.sky.time = (this.world.sky.time + 0.1) % 1;
      this.setMode('play');
      this.save(false);
      this.hud.toast('You rest by the fire. <i>(Game saved)</i>');
    });
  }

  respawn() {
    this.screens.hideDeath();
    this.screens.fadeThrough(() => {
      const { camp } = LANDMARKS;
      // Wake on the far side of the fire from Oswin, facing it, so the camera sits clear of him.
      const p = this.player;
      p.revive(camp.x - 1.6, camp.z - 2.6);
      p.facing = Math.atan2(camp.x - p.position.x, camp.z - p.position.z);
      this.cam.yaw = p.facing + Math.PI;
      this.cam.snapFocus(p.position);
      this.setMode('play');
      this.tryLock();
      this.hud.toast('You come to beside the campfire. Someone dragged you here.');
    });
  }

  quickHeal() {
    if (this.inventory.has('potion')) this.useItem('potion');
    else if (this.inventory.has('herb')) this.useItem('herb');
    else this.hud.toast('You have nothing to heal with.', 'warn');
  }

  useItem(id) {
    const it = ITEMS[id], p = this.player;
    if (!it || !this.inventory.has(id)) return;
    if (id === 'torn_letter') {
      this.screens.closeMenu();
      this.showCard(LETTER);
    } else if (it.type === 'consumable') {
      if (p.stats.hp >= p.stats.maxHp) return this.hud.toast("You're already at full health.", 'warn');
      this.inventory.remove(id);
      p.heal(it.heal);
      this.hud.floater(p.position, `+${it.heal}`, 'heal', 2.0);
    } else if (it.type === 'weapon' || it.type === 'armor') {
      p.equip(id);
      this.hud.toast(`Equipped ${it.name}.`);
    }
  }

  talkToOswin() {
    this.setMode('dialogue');
    this.oswin.talking = true;
    this.dialogue.open(() => (this.flags.knowsName ? 'Oswin' : 'Stranger'), wandererTree(this), 'greet', () => {
      this.oswin.talking = false;
      if (this.mode === 'dialogue') this.setMode('play');
      this.tryLock();
    });
  }

  oswinHasNews() {
    const q = this.quests;
    return !this.flags.metOswin
      || q.readyFor('wanderer').length > 0
      || (!q.status('slimes'))
      || (q.isDone('slimes') && !q.status('pelts'))
      || (this.flags.chapter1 && !this.flags.toldOswin);
  }

  touchAltar() {
    if (this.flags.chapter1) return this.hud.toast('The stones hum softly, content.');
    if (!this.quests.isActive('stones')) {
      const n = this.counter('shard');
      return this.hud.toast(n < 3
        ? `The stones are cold. Something is missing. <i>(${n}/3 memories)</i>`
        : 'The stones hum faintly... but you feel you should speak to someone first.');
    }
    this.bump('touch:stones');
  }

  onQuestComplete(id) {
    if (id === 'stones') {
      this.flags.chapter1 = true;
      this.playerName = 'Aren';
      this.world.stones.setLevel(2);
      this.showCard({ style: 'memory', ...STONES_REVEAL });
      this.showCard({ style: 'chapter', ...CHAPTER_END });
    }
    this.save(false);
  }

  // Minimap markers for points of interest and current objectives.
  mapMarkers() {
    const q = this.quests, m = [];
    const { camp, stones } = LANDMARKS;
    const needsCamp = q.isActive('echoes') && !this.counter('talk:wanderer');
    m.push({ x: camp.x, z: camp.z, color: '#ff9a3c', r: 4, edge: needsCamp || q.readyFor('wanderer').length > 0 });
    if (this.oswinHasNews()) m.push({ x: this.oswin.position.x, z: this.oswin.position.z - 3, color: '#ffd35a', shape: 'diamond' });
    if (q.isActive('stones') || this.flags.chapter1) m.push({ x: stones.x, z: stones.z, color: '#7fe8ff', shape: 'diamond', edge: q.isActive('stones') });
    if (this.interactions.has('letter')) m.push({ x: SPOTS.letter.x, z: SPOTS.letter.z, color: '#fff1c2', r: 3.5, edge: true });
    if (q.isActive('echoes')) {
      SPOTS.shards.forEach((p, i) => {
        if (this.interactions.has(`shard${i}`)) m.push({ x: p.x, z: p.z, color: '#6fe0ff', r: 4 });
      });
    }
    return m;
  }

  // ---------------------------------------------------------------- save/load
  save(announce) {
    const p = this.player;
    const ok = saveGame({
      v: 1,
      name: this.playerName,
      day: this.day,
      time: this.world.sky.time,
      player: {
        x: p.position.x, z: p.position.z, facing: p.facing,
        stats: { ...p.stats }, equipment: { ...p.equipment },
      },
      inventory: { ...this.inventory.items },
      counters: { ...this.counters },
      flags: { ...this.flags },
      quests: this.quests.serialize(),
      collected: [...this.collected],
      memories: [...this.memories],
    });
    if (announce) this.hud.toast(ok ? 'Game saved.' : 'Could not save. Browser storage is unavailable.', ok ? 'info' : 'warn');
  }

  applySave(d) {
    const p = this.player;
    this.playerName = d.name;
    this.day = d.day;
    this.world.sky.time = d.time;
    Object.assign(p.stats, d.player.stats);
    p.equip(d.player.equipment.weapon);
    p.equip(d.player.equipment.armor);
    p.position.set(d.player.x, heightAt(d.player.x, d.player.z), d.player.z);
    p.facing = d.player.facing;
    p.getUp = 1;
    p.distanceWalked = d.counters.distance || 0;
    this.counters = { ...d.counters };
    this.flags = { ...d.flags };
    this.memories = [...d.memories];
    this.quests.load(d.quests);
    this.inventory.load(d.inventory);
    for (const id of d.collected) this.collect(id);
    if (this.flags.chapter1) this.world.stones.setLevel(2);
    else if (this.quests.isActive('stones')) this.world.stones.setLevel(1);
  }

  // ---------------------------------------------------------------- frame
  update(dt, t) {
    const { input, player } = this;
    if (this.world.update(dt, t, player.position, this.camera)) this.day++;
    this.oswin.update(dt, t, player.position);
    this.oswin.setMarker(this.mode !== 'title' && this.oswinHasNews());

    switch (this.mode) {
      case 'title':
      case 'intro':
        this.updateTitleCamera(t);
        if (this.mode === 'intro') this.screens.updateIntro(dt, input);
        break;
      case 'waking':
        this.updateWaking(dt);
        break;
      case 'play':
        this.updatePlay(dt);
        break;
      case 'dialogue':
        this.dialogue.update(dt, input);
        this.idle(dt);
        break;
      case 'card':
        if (input.wasPressed('KeyE', 'Space', 'Enter', 'Escape')) this.screens.closeCard();
        this.idle(dt);
        break;
      case 'menu':
        this.screens.handleMenuInput(input);
        this.idle(dt);
        break;
      case 'paused':
        // The Esc that released pointer lock can also arrive as a keypress; don't let it un-pause instantly.
        if (input.wasPressed('Escape') && performance.now() - this.pausedAt > 300) this.resume();
        break;
      case 'dead':
        this.deadT += dt;
        player.update(dt, input, this.cam.yaw, this.world, false);
        this.spawner.update(dt, player, this.camera, 1 - this.world.sky.daylight);
        this.cam.update(dt, player.position, false);
        if (this.deadT > 1.6 && this.deadT - dt <= 1.6) this.screens.showDeath();
        break;
    }

    if (this.mode !== 'title' && this.mode !== 'intro') {
      this.hud.update();
      this.minimap.draw();
    }
    this.hud.updateFloaters(dt, this.camera);
    input.endFrame();
  }

  // The world keeps breathing while a dialogue or menu is open, but nothing can hurt you.
  idle(dt) {
    this.player.update(dt, this.input, this.cam.yaw, this.world, false);
    this.cam.update(dt, this.player.position, false);
  }

  updateTitleCamera(t) {
    const { spawn } = LANDMARKS;
    const a = t * 0.05 + 0.6;
    const y = heightAt(spawn.x, spawn.z);
    this.camera.position.set(spawn.x + Math.cos(a) * 24, y + 9, spawn.z + Math.sin(a) * 24);
    this.camera.lookAt(spawn.x, y + 1, spawn.z);
  }

  updateWaking(dt) {
    this.wakeT += dt;
    const t = this.wakeT, p = this.player;
    // Two slow blinks before the eyes stay open.
    let o = 0;
    if (t < 0.5) o = 1 - (t / 0.5) * 0.7;
    else if (t < 0.8) o = 0.3 + ((t - 0.5) / 0.3) * 0.6;
    else if (t < 1.8) o = 0.9 - ((t - 0.8) / 1.0) * 0.9;
    this.screens.fadeEl.style.opacity = o;

    // First person from where he lies: blinking up at the sky. Then the view pulls back
    // behind him as he gets to his feet.
    if (!this.wakeEye) {
      this.wakeEye = p.h.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0));
      this.wakeSky = this.wakeEye.clone().add(new THREE.Vector3(0.6, 10, -3.5));
      this.cam.yaw = p.facing + Math.PI;
      this.cam.snapFocus(p.position);
    }
    p.getUp = smoothstep(2.0, 3.8, t);
    p.update(dt, this.input, this.cam.yaw, this.world, false);
    this.cam.update(dt, p.position, false); // where the orbit camera wants to be
    const k = smoothstep(2.2, 4.4, t);
    this.camera.position.lerpVectors(this.wakeEye, this.camera.position, k);
    this.camera.lookAt(tmp.lerpVectors(this.wakeSky, this.cam.focus, k));

    if (t > 4.4) {
      this.wakeEye = null;
      this.screens.fadeEl.style.opacity = '';
      this.screens.fadeEl.style.transition = '';
      this.hud.show();
      this.setMode('play');
      this.quests.start('awakening');
      this.hud.toast('<i>Where... am I?</i>');
      this.tryLock();
    }
  }

  updatePlay(dt) {
    const { input, player } = this;
    if (input.wasPressed('KeyI', 'Tab')) {
      this.setMode('menu');
      return this.screens.openMenu('inventory');
    }
    if (input.wasPressed('KeyJ')) {
      this.setMode('menu');
      return this.screens.openMenu('journal');
    }
    if (input.wasPressed('Escape')) return this.pause();
    if (input.wasPressed('Digit1')) this.quickHeal();

    player.update(dt, input, this.cam.yaw, this.world, true);
    if (input.wasPressed('KeyF') || input.primaryClick) player.startAttack();
    this.resolvePlayerAttack();
    this.spawner.update(dt, player, this.camera, 1 - this.world.sky.daylight);

    const walked = Math.floor(player.distanceWalked);
    if (walked !== (this.counters.distance || 0) && walked <= 100) {
      this.counters.distance = walked;
      this.quests.check();
    }

    const near = this.interactions.nearest(player.position);
    this.hud.setPrompt(near ? near.label() : null);
    if (near && input.wasPressed('KeyE')) near.onUse();

    if (this.mode === 'play') this.cam.update(dt, player.position, true);
  }

  // Deal damage once per swing, at the moment the blade comes down, to enemies in a frontal arc.
  resolvePlayerAttack() {
    const p = this.player;
    if (!p.hitPending || p.attackProgress < 0.42) return;
    p.hitPending = false;
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    let hit = false;
    for (const e of this.spawner.enemies) {
      if (!e.alive) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
      const d = Math.hypot(dx, dz);
      if (d > p.reach + e.def.radius) continue;
      if (d > 0.5 && (dx * fx + dz * fz) / d < 0.25) continue;
      const crit = Math.random() < 0.12;
      const dmg = Math.round(p.attackPower * (0.85 + Math.random() * 0.3) * (crit ? 1.8 : 1));
      e.takeDamage(dmg, p.position);
      this.hud.floater(e.position, crit ? `${dmg}!` : `${dmg}`, crit ? 'crit' : 'dmg', e.barHeight);
      hit = true;
    }
    if (hit) this.cam.shake(0.12);
  }
}
