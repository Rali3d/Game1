import * as THREE from 'three';
import { Engine } from './engine/Engine.js';
import { Input } from './engine/Input.js';
import { events } from './engine/EventBus.js';
import { smoothstep, rand } from './engine/math.js';
import { mulberry32 } from './engine/noise.js';
import { World } from './world/World.js';
import { LANDMARKS, heightAt, isWater } from './world/Terrain.js';
import { createLetter, createShard, createWeaponPickup, createHerb, createTent } from './world/Props.js';
import { Interior } from './world/Interior.js';
import { Cave, createChest } from './world/Cave.js';
import { Player, DEFAULT_APPEARANCE } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { Enemy } from './entities/Enemy.js';
import { Spawner } from './systems/Spawner.js';
import { CameraController } from './systems/CameraController.js';
import { QuestSystem } from './systems/QuestSystem.js';
import { Inventory } from './systems/Inventory.js';
import { Interactions } from './systems/Interactions.js';
import { Spells } from './systems/Spells.js';
import { saveGame, loadGame } from './systems/SaveGame.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';
import { DialogueUI } from './ui/DialogueUI.js';
import { Screens } from './ui/Screens.js';
import { ShopUI } from './ui/ShopUI.js';
import { WorldMap } from './ui/WorldMap.js';
import { CharacterCreator } from './ui/CharacterCreator.js';
import { ITEMS } from './data/items.js';
import { NPCS, residentDef, corvinTree } from './data/npcs.js';
import { TOWNS, CAVES, townById } from './data/towns.js';
import {
  INTRO_LINES, LETTER, SHARD_MEMORIES, stonesReveal, CHAPTER_END, FIRE_AWAKENS, WARDEN_FALLS, CHAPTER_II_END,
} from './data/story.js';

const SPOTS = {
  letter: { x: 5, z: -9 },
  shards: [{ x: 38, z: -57 }, { x: 74, z: 50 }, { x: -80, z: -24 }],
};

// Weapons lying around the world. `id` is the interaction id (kept stable for save files).
const WEAPON_PICKUPS = [
  { id: 'sword', item: 'rusty_sword', at: { x: -12, z: 7 }, pose: 'ground',
    label: '[E] Pull the sword from the earth', text: 'You pull the <b>Rusty Sword</b> free. It fits your hand as if it always has.' },
  { id: 'axe_pickup', item: 'woodcutters_axe', at: LANDMARKS.stump, pose: 'stump',
    label: '[E] Wrench the axe from the stump', text: "You wrench the <b>Woodcutter's Axe</b> out of the stump. Heavy, and slow, and very satisfying." },
  { id: 'spear_pickup', item: 'hunters_spear', at: LANDMARKS.hunterCamp, pose: 'lean', rotY: 0.8,
    label: "[E] Take the hunter's spear", text: "You take the <b>Hunter's Spear</b>. Whoever camped here left in a hurry." },
];

// Chest loot: coins plus a pick from the pool. Each cave's farthest chest holds something special.
const CHEST_POOL = ['potion', 'potion', 'mana_potion', 'cave_crystal', 'stew', 'bread', 'cave_crystal'];
const CAVE_PRIZE = { hollow: 'battle_axe', grotto: 'ember_staff', vault: 'chainmail' };
const START_COINS = 12;
const tmp = new THREE.Vector3();

// Modes: title -> slots -> create -> intro -> waking -> play <-> (dialogue | card | menu | paused | dead | transition)
export class Game {
  constructor() {
    this.engine = new Engine(document.getElementById('game'));
    const { scene, camera, renderer } = this.engine;
    this.scene = scene;
    this.camera = camera;
    this.canvas = renderer.domElement;
    this.input = new Input(this.canvas);

    this.world = new World(scene);
    this.space = this.world; // where the player is: the world, an interior or a cave
    this.player = new Player(scene);
    this.inventory = new Inventory();
    this.counters = {};
    this.flags = {};
    this.collected = new Set();
    this.memories = [];
    this.coins = START_COINS;
    this.hero = { name: 'Aren', appearance: { ...DEFAULT_APPEARANCE } };
    this.day = 1;
    this.slot = 1;
    this.tent = null;
    this.interiors = new Map();
    this.caves = new Map();
    this.caveEnemies = [];
    this.boss = null;

    this.hud = new HUD(this);
    this.quests = new QuestSystem(this);
    this.cam = new CameraController(camera, this.input);
    this.cam.space = this.world;
    this.spawner = new Spawner(scene, this.world);
    this.interactions = new Interactions(this.world);
    this.spells = new Spells(this);
    this.dialogue = new DialogueUI();
    this.screens = new Screens(this);
    this.minimap = new Minimap(document.getElementById('minimap'), this);
    this.minimapWrap = document.getElementById('minimap-wrap');
    this.shopUI = new ShopUI(this);
    this.worldMap = new WorldMap(this);
    this.creator = new CharacterCreator(this);

    // A soft front light for the character creator's close-up (off otherwise; kept in the scene so
    // toggling it never changes the light count and forces shaders to recompile).
    this.portraitLight = new THREE.DirectionalLight(0xfff1dc, 0);
    scene.add(this.portraitLight, this.portraitLight.target);

    this.npcs = {};
    this.setupOutdoorNpcs();
    this.setupInteractables();
    this.bindEvents();

    const { spawn } = LANDMARKS;
    this.player.position.set(spawn.x, heightAt(spawn.x, spawn.z), spawn.z);
    this.player.getUp = 0;
    this.player.update(0, this.input, 0, this.world, false);

    this.mode = 'title';
    this.engine.onUpdate((dt, t) => this.update(dt, t));
    this.engine.start();
    this.screens.showTitle();
  }

  get activeScene() {
    return this.space.scene;
  }

  // ---------------------------------------------------------------- setup
  spawnNpc(id, def, x, z, facing, space) {
    const npc = new NPC(space.scene, x, z, facing, def.opts, space);
    npc.def = def;
    npc.id = id;
    space.colliders.push(npc.collider);
    this.npcs[id] = npc;
    this.interactions.add({
      // Indoors people often stand behind a counter or table, so you can talk from a bit further away.
      id, space: space.id, position: npc.position, radius: space.outdoors ? 2.6 : 3.4,
      label: () => `[E] Talk to ${def.name(this)}`,
      onUse: () => this.talkTo(id),
    });
    return npc;
  }

  setupOutdoorNpcs() {
    const { camp } = LANDMARKS;
    const millbrook = this.world.towns.find((t) => t.id === 'millbrook');
    for (const [id, def] of Object.entries(NPCS)) {
      const o = def.outdoor;
      if (!o) continue;
      if (o === 'camp') this.spawnNpc(id, def, camp.x + 2.4, camp.z + 1.2, -2.0, this.world);
      else if (o === 'smithy') {
        const s = millbrook.spots.smithKeeper;
        this.spawnNpc(id, def, s.x, s.z, s.facing, this.world);
      } else {
        const t = townById(o.town);
        this.spawnNpc(id, def, t.x + o.x, t.z + o.z, 0, this.world);
      }
    }
  }

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

    const addWeapon = (w, prop, radius = 2.2) => I.add({
      id: w.id, position: at(w.at), radius,
      label: () => w.label,
      onUse: () => this.pickUpWeapon(w.id, w.item, w.text),
      onRemove: () => {
        prop.weapon.visible = false;
        prop.glow.visible = false;
      },
    });
    for (const w of WEAPON_PICKUPS) {
      addWeapon(w, place((x, z) => createWeaponPickup(x, z, w.item, w.pose, w.rotY), w.at));
    }
    // The iron sword on Brenna's rack in the Millbrook smithy.
    const rack = this.world.towns.find((t) => t.id === 'millbrook').spots.rack;
    this.rackSpot = rack;
    const rackProp = place((x, z) => createWeaponPickup(x, z, 'iron_sword', 'rack', rack.ry), rack);
    addWeapon({ id: 'rack_sword', item: 'iron_sword', at: rack, label: '[E] Take the Iron Sword from the rack' }, rackProp, 1.8);

    SPOTS.shards.forEach((p, i) => I.add({
      id: `shard${i}`, position: at(p), radius: 2.4, prop: place(createShard, p),
      label: () => '[E] Touch the glowing shard',
      onUse: () => {
        this.collect(`shard${i}`);
        const n = this.counter('shard');
        this.memories.push(n);
        this.showCard({ kind: `Memory ${n + 1} of 3`, style: 'memory', ...SHARD_MEMORIES[n] });
        if (!this.flags.fireball) {
          this.flags.fireball = true;
          this.showCard({ style: 'memory', ...FIRE_AWAKENS });
        }
        this.bump('shard');
        this.grantXp(25);
      },
    }));

    // Moonpetals scattered around the meadow.
    const rng = mulberry32(77);
    for (let i = 0, placed = 0; i < 300 && placed < 24; i++) {
      const a = rng() * Math.PI * 2, r = 18 + rng() * 80;
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
      onUse: () => this.rest('camp'),
    });

    I.add({
      id: 'altar', position: this.world.stones.altarPosition, radius: 2.8,
      label: () => '[E] Touch the altar',
      onUse: () => this.touchAltar(),
    });

    // Every building door leads to its interior.
    for (const door of this.world.doors) {
      I.add({
        id: `door:${door.interiorId}`, position: door.outside, radius: 1.8,
        label: () => `[E] Enter ${door.kind === 'house' ? 'the house' : door.name}`,
        onUse: () => this.enterInterior(door),
      });
    }

    // Cave mouths.
    for (const mouth of this.world.caveMouths) {
      const c = mouth.def;
      I.add({
        id: `cave:${c.id}`, position: mouth.front, radius: 3,
        label: () => (c.locked && !this.inventory.has(c.locked) ? `[E] ${c.name} (the gate is locked)` : `[E] Enter ${c.name}`),
        onUse: () => {
          if (c.locked && !this.inventory.has(c.locked)) {
            return this.hud.toast('An iron gate bars the way. Someone must have the key.', 'warn');
          }
          mouth.mesh.gate?.removeFromParent();
          this.enterCave(c, mouth);
        },
      });
    }
  }

  bindEvents() {
    events.on('enemy:killed', ({ enemy }) => {
      this.player.gainXp(enemy.def.xp);
      this.hud.floater(enemy.position, `+${enemy.def.xp} XP`, 'xp', 2.2);
      const [lo, hi] = enemy.def.coins;
      const coins = Math.floor(rand(lo, hi + 1));
      if (coins > 0) this.giveCoins(coins, enemy.position);
      for (const [id, chance] of enemy.def.loot) if (Math.random() < chance) this.giveItem(id);
      this.bump(`kill:${enemy.type}`);
    });
    events.on('boss:defeated', () => this.onBossDefeated());
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
  get playerName() {
    return this.flags.chapter1 ? this.hero.name : '???';
  }

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

  giveCoins(n, at) {
    this.coins += n;
    if (at) this.hud.floater(at, `+${n} 🪙`, 'coin', 1.6);
    else this.hud.toast(`🪙 +${n} coins`, 'loot');
  }

  grantXp(n) {
    this.player.gainXp(n);
    this.hud.floater(this.player.position, `+${n} XP`, 'xp', 2.2);
  }

  collect(id) {
    this.collected.add(id);
    this.interactions.remove(id);
  }

  activeEnemies() {
    if (this.space === this.world) return this.spawner.enemies;
    return this.caveEnemies;
  }

  locationName() {
    if (this.space !== this.world) return this.space.def?.name ?? '';
    const p = this.player.position;
    const town = this.world.townAt(p.x, p.z);
    if (town) return town.name;
    if (Math.hypot(p.x - LANDMARKS.camp.x, p.z - LANDMARKS.camp.z) < 16) return "Oswin's camp";
    if (Math.hypot(p.x - LANDMARKS.stones.x, p.z - LANDMARKS.stones.z) < 30) return 'The Standing Stones';
    return Math.hypot(p.x, p.z) < 60 ? 'The Hollow Meadow' : 'The wilds';
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
    const next = this.afterCards;
    this.afterCards = null;
    next?.();
  }

  // ---------------------------------------------------------------- spaces (world / interiors / caves)
  // Fade out, move the player into another space, fade back in.
  travel(space, at, facing, after) {
    this.setMode('transition');
    this.screens.fadeThrough(() => {
      this.switchSpace(space, at, facing);
      this.setMode('play');
      after?.();
    });
  }

  switchSpace(space, at, facing) {
    const p = this.player;
    this.spells.clear();
    if (this.space !== space && this.space.dark) this.leaveCave();
    this.space = space;
    this.engine.activeScene = space.scene;
    space.scene.add(p.mesh);
    p.position.set(at.x, space.groundAt(at.x, at.z), at.z);
    p.velocity.set(0, 0, 0);
    p.facing = facing;
    this.cam.space = space;
    this.cam.yaw = facing + Math.PI;
    this.cam.snapFocus(p.position);
    this.minimapWrap.classList.toggle('hidden', !space.outdoors);
  }

  interiorFor(door) {
    let room = this.interiors.get(door.interiorId);
    if (room) return room;
    room = new Interior(door, this.world.sky);
    room.id = door.interiorId;
    this.interiors.set(door.interiorId, room);
    const keeper = door.npc ?? door.resident;
    if (keeper) {
      const def = NPCS[keeper] ?? residentDef(keeper);
      const s = room.keeperSpot;
      const npc = this.spawnNpc(keeper, { ...def, opts: { ...def.opts, wander: s.wander ?? 0 } }, s.x, s.z, s.facing, room);
      npc.home.set(s.x, 0, s.z);
    }
    this.interactions.add({
      id: `exit:${door.interiorId}`, space: room.id, position: { ...room.exitPoint, y: 0 }, radius: 1.6,
      label: () => '[E] Leave',
      onUse: () => this.travel(this.world, door.outside, door.outside.facing),
    });
    return room;
  }

  enterInterior(door) {
    const room = this.interiorFor(door);
    this.travel(room, room.entry, room.entry.facing, () => this.hud.banner(door.name));
  }

  enterCave(def, mouth) {
    let cave = this.caves.get(def.id);
    if (!cave) {
      cave = new Cave(def);
      this.caves.set(def.id, cave);
      this.addCaveInteractables(cave, mouth);
    }
    this.travel(cave, cave.entry, cave.entry.facing, () => {
      this.populateCave(cave);
      this.hud.banner(def.name, def.boss && !this.flags.chapter2 ? 'Something is waiting in the dark.' : '');
      if (!this.player.lanternOn) {
        this.hud.toast(this.inventory.has('lantern')
          ? "It's very dark in here. <b>Press L</b> to light your lantern."
          : "It's very dark in here. A lantern would help. Odo in Ashford sells them.", 'warn');
      }
    });
  }

  addCaveInteractables(cave, mouth) {
    const def = cave.def;
    this.interactions.add({
      id: `exit:${cave.id}`, space: cave.id, position: { ...cave.exitPoint, y: 0 }, radius: 2.2,
      label: () => '[E] Leave the cave',
      onUse: () => this.travel(this.world, mouth.front, mouth.front.facing + Math.PI),
    });
    // Chests in the far reaches; the farthest holds the cave's prize.
    const far = cave.farCells(10).filter((c) => cave.wallNeighbours(c.i, c.j) >= 5);
    const picks = [];
    for (const c of far) {
      if (picks.length >= def.chests) break;
      if (picks.every((p) => Math.hypot(p.i - c.i, p.j - c.j) > 6)) picks.push(c);
    }
    picks.forEach((c, n) => {
      const id = `chest:${def.id}:${n}`;
      const pos = cave.cellCenter(c.i, c.j);
      const chest = createChest();
      chest.position.set(pos.x, 0, pos.z);
      chest.rotation.y = cave.rng() * Math.PI * 2;
      cave.scene.add(chest);
      if (this.collected.has(id)) {
        chest.open();
        return;
      }
      this.interactions.add({
        id, space: cave.id, position: { x: pos.x, y: 0, z: pos.z }, radius: 1.8,
        label: () => '[E] Open the chest',
        onUse: () => {
          this.collect(id);
          chest.open();
          const coins = 15 + Math.floor(Math.random() * 30);
          this.giveCoins(coins);
          const item = n === 0 && CAVE_PRIZE[def.id] ? CAVE_PRIZE[def.id] : CHEST_POOL[Math.floor(Math.random() * CHEST_POOL.length)];
          this.giveItem(item);
        },
      });
    });
  }

  // Enemies are rolled fresh each visit; the boss only appears while his quest is open.
  populateCave(cave) {
    this.leaveCave();
    const def = cave.def;
    const cells = cave.farCells(8);
    const take = () => cells.splice(Math.floor(Math.random() * cells.length), 1)[0];
    for (const [type, count] of Object.entries(def.enemies)) {
      for (let n = 0; n < count && cells.length; n++) {
        const c = take();
        const p = cave.cellCenter(c.i, c.j);
        this.caveEnemies.push(new Enemy(type, p.x, p.z, cave.scene, cave));
      }
    }
    if (def.boss && !this.flags.chapter2 && this.quests.isActive('grey4')) {
      const c = cave.farCells(0)[0];
      const p = cave.cellCenter(c.i, c.j);
      this.boss = new Enemy('warden', p.x, p.z, cave.scene, cave);
      this.boss.state = 'wander';
      this.caveEnemies.push(this.boss);
    }
  }

  leaveCave() {
    for (const e of this.caveEnemies) if (!e.removed) e.dispose();
    this.caveEnemies = [];
    this.boss = null;
  }

  updateCaveEnemies(dt) {
    for (const e of this.caveEnemies) e.update(dt, this.player, this.camera, 1, this.spells);
    this.caveEnemies = this.caveEnemies.filter((e) => !e.removed);
  }

  // ---------------------------------------------------------------- the Man in Grey
  onBossDefeated() {
    const boss = this.boss;
    boss.h.hips.position.y = 0.55; // down on one knee
    boss.h.body.rotation.x = 0.25;
    this.spells.clear();
    this.setMode('card');
    this.screens.showCard({ style: 'memory', ...WARDEN_FALLS });
    this.afterCards = () => {
      this.setMode('dialogue');
      this.dialogue.open('Corvin', corvinTree(this), 'greet', () => {
        this.screens.fadeThrough(() => {
          boss.dispose();
          this.caveEnemies = this.caveEnemies.filter((e) => e !== boss);
          this.boss = null;
          this.setMode('play');
          this.bump('defeat:warden');
        });
      });
    };
  }

  // ---------------------------------------------------------------- flow
  newGame(slot) {
    this.slot = slot;
    this.screens.hideTitle();
    this.setMode('create');
    const p = this.player;
    p.getUp = 1;
    p.facing = 0;
    this.creator.open((name, appearance) => {
      this.hero = { name, appearance };
      this.camera.clearViewOffset();
      this.portraitLight.intensity = 0;
      p.getUp = 0;
      p.facing = Math.PI;
      this.setMode('intro');
      this.screens.showIntro(INTRO_LINES, () => this.beginWaking());
    }, () => {
      this.camera.clearViewOffset();
      this.portraitLight.intensity = 0;
      p.getUp = 0;
      this.setMode('title');
      this.screens.showSlots('new');
    });
  }

  beginWaking() {
    this.setMode('waking');
    this.wakeT = 0;
    this.screens.fadeEl.style.transition = 'none';
  }

  continueGame(slot) {
    const data = loadGame(slot);
    if (!data) return this.newGame(slot);
    this.slot = slot;
    this.screens.hideTitle();
    this.applySave(data);
    this.cam.startBlend(1.2);
    this.hud.show();
    this.setMode('play');
    this.tryLock();
    this.hud.toast(`You pick up where you left off. <i>(Slot ${slot})</i>`);
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

  quitToTitle(saveFirst) {
    if (saveFirst) this.save(false);
    // A reload is the cleanest way to reset every system back to the title screen.
    location.reload();
  }

  // place: 'camp' | 'millbrook' | 'thornbury' (the inns) | 'tent'. Sets where you wake after a defeat.
  rest(place = 'camp', { untilMorning = false } = {}) {
    if (this.space === this.world && this.spawner.anyHunting(this.player.position, 30)) {
      this.hud.toast("You can't rest while something is hunting you.", 'warn');
      return;
    }
    this.setMode('transition');
    this.screens.fadeThrough(() => {
      const s = this.player.stats;
      s.hp = s.maxHp;
      s.stamina = s.maxStamina;
      s.mana = s.maxMana;
      const sky = this.world.sky;
      if (untilMorning) {
        if (sky.time > 0.27) this.day++;
        sky.time = 0.27;
      } else {
        sky.time = (sky.time + 0.1) % 1;
      }
      this.flags.restPoint = place;
      this.setMode('play');
      this.save(false);
      const where = { camp: 'by the fire', tent: 'in your tent', millbrook: 'at the Fallen Star', thornbury: 'at the Thorn & Thistle' }[place];
      this.hud.toast(`You rest ${where}. <i>(Game saved)</i>`);
    });
  }

  respawn() {
    this.screens.hideDeath();
    this.setMode('transition');
    this.screens.fadeThrough(() => {
      const p = this.player, rp = this.flags.restPoint;
      p.revive(p.position.x, p.position.y, p.position.z);
      let spot, message;
      const innDoor = this.world.doors.find((d) => d.town === rp && d.kind === 'inn');
      if (innDoor) {
        spot = { x: innDoor.outside.x, z: innDoor.outside.z, facing: innDoor.outside.facing };
        message = 'You wake at the inn. The innkeeper says a farmer carried you in.';
      } else if (rp === 'tent' && this.tent) {
        spot = { x: this.tent.x + Math.sin(this.tent.ry) * 3, z: this.tent.z + Math.cos(this.tent.ry) * 3, facing: this.tent.ry };
        message = 'You crawl out of your tent, aching all over.';
      } else {
        // Wake on the far side of the fire from Oswin, facing it, so the camera sits clear of him.
        const { camp } = LANDMARKS;
        spot = { x: camp.x - 1.6, z: camp.z - 2.6 };
        spot.facing = Math.atan2(camp.x - spot.x, camp.z - spot.z);
        message = 'You come to beside the campfire. Someone dragged you here.';
      }
      this.switchSpace(this.world, spot, spot.facing);
      this.setMode('play');
      this.tryLock();
      this.hud.toast(message);
    });
  }

  quickHeal() {
    if (this.inventory.has('potion')) this.useItem('potion');
    else if (this.inventory.has('stew')) this.useItem('stew');
    else if (this.inventory.has('bread')) this.useItem('bread');
    else if (this.inventory.has('herb')) this.useItem('herb');
    else this.hud.toast('You have nothing to heal with.', 'warn');
  }

  useItem(id) {
    const it = ITEMS[id], p = this.player;
    if (!it || !this.inventory.has(id)) return;
    if (id === 'torn_letter') {
      this.screens.closeMenu();
      this.showCard(LETTER);
    } else if (id === 'lantern') {
      this.toggleLantern();
    } else if (id === 'tent') {
      this.screens.closeMenu();
      this.pitchTent();
    } else if (id === 'tome_embers') {
      this.inventory.remove(id);
      this.flags.embersRead = true;
      this.hud.toast('You read the <b>Tome of Embers</b>. Your fireballs burn hotter (+8 damage).', 'quest');
    } else if (it.type === 'consumable') {
      if (it.mana) {
        if (p.stats.mana >= p.stats.maxMana) return this.hud.toast('Your mana is already full.', 'warn');
        this.inventory.remove(id);
        p.stats.mana = Math.min(p.stats.maxMana, p.stats.mana + it.mana);
        this.hud.floater(p.position, `+${it.mana} mana`, 'mana', 2.0);
        return;
      }
      if (p.stats.hp >= p.stats.maxHp) return this.hud.toast("You're already at full health.", 'warn');
      this.inventory.remove(id);
      p.heal(it.heal);
      this.hud.floater(p.position, `+${it.heal}`, 'heal', 2.0);
    } else if (it.type === 'weapon' || it.type === 'armor') {
      p.equip(id);
      this.hud.toast(`Equipped ${it.name}.`);
    }
  }

  toggleLantern() {
    if (!this.inventory.has('lantern')) return this.hud.toast("You don't have a lantern.", 'warn');
    this.player.setLantern(!this.player.lanternOn);
  }

  openShop(id) {
    this.setMode('menu');
    this.screens.menu = 'shop';
    this.shopUI.open(id);
  }

  openMap() {
    this.setMode('menu');
    this.screens.menu = 'map';
    this.worldMap.show();
  }

  // ---------------------------------------------------------------- the tent
  pitchTent() {
    const p = this.player;
    if (!this.inventory.has('tent')) return;
    if (this.tent) return this.hud.toast('Your tent is already pitched. Pack it up first.', 'warn');
    if (this.space !== this.world) return this.hud.toast("There's no room to pitch a tent in here.", 'warn');
    const x = p.position.x + Math.sin(p.facing) * 3, z = p.position.z + Math.cos(p.facing) * 3;
    if (this.world.townAt(x, z)) return this.hud.toast('Not in the middle of town. The inn has beds.', 'warn');
    if (isWater(x, z, 0.5)) return this.hud.toast("You can't pitch a tent in the water.", 'warn');
    if (this.spawner.anyHunting(p.position, 25)) return this.hud.toast('Not while something is hunting you.', 'warn');
    this.placeTent({ x, z, ry: p.facing + Math.PI });
    this.hud.toast('You pitch your tent. <b>E</b> to rest inside or pack it up.', 'quest');
  }

  placeTent({ x, z, ry }) {
    const prop = this.world.add(createTent());
    prop.group.position.set(x, heightAt(x, z), z);
    prop.group.rotation.y = ry;
    this.scene.add(prop.group);
    const collider = { x, z, r: 1.3 };
    this.world.colliders.push(collider);
    this.tent = { x, z, ry, prop, collider };
    const flap = { x: x + Math.sin(ry) * 2, z: z + Math.cos(ry) * 2 };
    this.interactions.add({
      id: 'tent', position: { ...flap, y: heightAt(flap.x, flap.z) }, radius: 2.2,
      label: () => '[E] Your tent',
      onUse: () => this.openTentMenu(),
    });
  }

  packTent() {
    const t = this.tent;
    if (!t) return;
    this.world.remove(t.prop);
    this.world.colliders.splice(this.world.colliders.indexOf(t.collider), 1);
    this.interactions.remove('tent');
    this.tent = null;
    if (this.flags.restPoint === 'tent') this.flags.restPoint = 'camp';
    this.hud.toast('You pack the tent away.');
  }

  openTentMenu() {
    this.setMode('dialogue');
    const night = this.world.sky.isNight;
    this.dialogue.open('Your tent', {
      greet: {
        text: night ? 'The canvas is cold, but the bedroll is dry.' : 'A good spot. The canvas snaps in the breeze.',
        options: [
          { text: 'Sleep until morning. (Heal and save)', next: null, do: () => this.rest('tent', { untilMorning: true }) },
          { text: 'Rest a while. (Heal and save)', next: null, do: () => this.rest('tent') },
          { text: 'Pack up the tent.', next: null, do: () => this.packTent() },
          { text: 'Leave it be.', next: null },
        ],
      },
    }, 'greet', () => {
      if (this.mode === 'dialogue') this.setMode('play');
    });
  }

  // ---------------------------------------------------------------- talking
  pickUpWeapon(id, itemId, text) {
    const item = ITEMS[itemId], current = ITEMS[this.player.equipment.weapon];
    this.collect(id);
    this.giveItem(itemId, 1, false);
    if (id === 'rack_sword') {
      text = this.flags.brennaOffered
        ? 'You lift the <b>Iron Sword</b> from the rack. Brenna nods once.'
        : 'You lift the <b>Iron Sword</b> from the rack. Brenna: <i>"Go on, then. It\'s waited long enough."</i>';
    }
    // Equip it straight away if it hits harder than what you're holding.
    if (!current || item.damage > current.damage) {
      this.player.equip(itemId);
      this.hud.toast(`${text} <b>Equipped.</b>`, 'quest');
    } else {
      this.hud.toast(`${text} <i>(Press I to equip it.)</i>`, 'quest');
    }
  }

  talkTo(id) {
    const npc = this.npcs[id], def = npc.def;
    this.setMode('dialogue');
    npc.talking = true;
    const speaker = () => def.name(this).replace(/^the /, '').replace(/^./, (c) => c.toUpperCase());
    this.dialogue.open(speaker, def.tree(this), 'greet', () => {
      npc.talking = false;
      if (id === 'oswin' && !this.flags.gotLantern) {
        this.flags.gotLantern = true;
        this.giveItem('lantern', 1, false);
        this.hud.toast('Oswin presses a spare lantern into your hands. <i>"Nights get dark out here." (Press L to light it.)</i>', 'quest');
      }
      if (this.mode === 'dialogue') {
        this.setMode('play');
        this.tryLock();
      }
    });
  }

  // Whether an NPC shows a "!" (someone new to meet, a quest to offer or turn in).
  npcHasNews(id) {
    const q = this.quests, f = this.flags;
    switch (id) {
      case 'oswin':
        return !f.metOswin || q.readyFor('wanderer').length > 0 || !q.status('slimes')
          || (q.isDone('slimes') && !q.status('pelts')) || (f.chapter1 && !f.toldOswin);
      case 'brenna': return !f.metBrenna;
      case 'tam': return !f.metTam || q.readyFor('tam').length > 0 || !q.status('petals') || q.isActive('grey1');
      case 'pip': return !f.metPip;
      case 'marisol': return q.isActive('grey2');
      case 'hale': return !f.met_hale || q.isActive('grey3') || q.readyFor('hale').length > 0 || (f.chapter1 && !q.status('bones'));
      default: return false;
    }
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
      this.world.stones.setLevel(2);
      this.showCard({ style: 'memory', ...stonesReveal(this.hero.name) });
      this.showCard({ style: 'chapter', ...CHAPTER_END });
    }
    if (id === 'grey4') {
      this.flags.chapter2 = true;
      this.showCard({ style: 'chapter', ...CHAPTER_II_END });
    }
    this.save(false);
  }

  // Minimap markers for points of interest and current objectives.
  mapMarkers() {
    const q = this.quests, m = [];
    const { camp, stones } = LANDMARKS;
    const needsCamp = q.isActive('echoes') && !this.counter('talk:wanderer');
    m.push({ x: camp.x, z: camp.z, color: '#ff9a3c', r: 4, edge: needsCamp || q.readyFor('wanderer').length > 0 });
    for (const [id, npc] of Object.entries(this.npcs)) {
      if (npc.space === this.world && this.npcHasNews(id)) m.push({ x: npc.position.x, z: npc.position.z - 2, color: '#ffd35a', shape: 'diamond', r: 3 });
    }
    // People with news indoors are shown at their building's door.
    for (const d of this.world.doors) {
      if (d.npc && this.npcHasNews(d.npc)) m.push({ x: d.outside.x, z: d.outside.z, color: '#ffd35a', shape: 'diamond', r: 3 });
    }
    const questDoor = (town, kind) => this.world.doors.find((d) => d.town === town && d.kind === kind);
    const objective = (d) => d && m.push({ x: d.outside.x, z: d.outside.z, color: '#e8c46a', shape: 'diamond', edge: true });
    for (const t of TOWNS) m.push({ x: t.x, z: t.z, color: '#e8c46a', r: 5, edge: t.id === 'millbrook' && (q.isActive('millbrook') || q.readyFor('tam').length > 0) });
    if (q.isActive('grey1')) objective(questDoor('millbrook', 'inn'));
    if (q.isActive('grey2')) objective(questDoor('thornbury', 'shop'));
    if (q.isActive('grey3')) objective(questDoor('greywatch', 'tower'));
    if (q.isActive('grey4')) {
      const v = CAVES.find((c) => c.id === 'vault');
      m.push({ x: v.x, z: v.z, color: '#b8c2d9', shape: 'diamond', edge: true });
    }
    if (q.isActive('stones') || this.flags.chapter1) m.push({ x: stones.x, z: stones.z, color: '#7fe8ff', shape: 'diamond', edge: q.isActive('stones') });
    if (this.interactions.has('letter')) m.push({ x: SPOTS.letter.x, z: SPOTS.letter.z, color: '#fff1c2', r: 3.5, edge: true });
    if (q.isActive('echoes')) {
      SPOTS.shards.forEach((p, i) => {
        if (this.interactions.has(`shard${i}`)) m.push({ x: p.x, z: p.z, color: '#6fe0ff', r: 4 });
      });
    }
    for (const w of [...WEAPON_PICKUPS, { id: 'rack_sword', at: this.rackSpot }]) {
      if (this.interactions.has(w.id)) m.push({ x: w.at.x, z: w.at.z, color: '#e6e6e6', r: 2.5 });
    }
    for (const c of CAVES) if (this.flags[`found_${c.id}`]) m.push({ x: c.x, z: c.z, color: '#5a544c', r: 4.5 });
    if (this.tent) m.push({ x: this.tent.x, z: this.tent.z, color: '#c9a24a', r: 3.5 });
    return m;
  }

  // ---------------------------------------------------------------- save/load
  save(announce) {
    const p = this.player;
    // Saving inside a cave puts you back at its mouth on load; interiors are remembered.
    let where = { space: 'world', x: p.position.x, z: p.position.z, facing: p.facing };
    if (this.space.dark) {
      const mouth = this.world.caveMouths.find((m) => this.space.def.id === m.def.id);
      where = { space: 'world', x: mouth.front.x, z: mouth.front.z, facing: mouth.front.facing + Math.PI };
    } else if (this.space !== this.world) {
      where = { space: this.space.id, x: p.position.x, z: p.position.z, facing: p.facing };
    }
    const ok = saveGame(this.slot, {
      v: 2,
      hero: this.hero,
      name: this.hero.name,
      where: this.locationName(),
      day: this.day,
      time: this.world.sky.time,
      coins: this.coins,
      player: { ...where, stats: { ...p.stats }, equipment: { ...p.equipment }, lantern: p.lanternOn },
      tent: this.tent ? { x: this.tent.x, z: this.tent.z, ry: this.tent.ry } : null,
      inventory: { ...this.inventory.items },
      counters: { ...this.counters },
      flags: { ...this.flags },
      quests: this.quests.serialize(),
      collected: [...this.collected],
      memories: [...this.memories],
    });
    if (announce) this.hud.toast(ok ? `Game saved to slot ${this.slot}.` : 'Could not save. Browser storage is unavailable.', ok ? 'info' : 'warn');
  }

  applySave(d) {
    const p = this.player;
    this.hero = d.hero ?? { name: d.name && d.name !== '???' ? d.name : 'Aren', appearance: { ...DEFAULT_APPEARANCE } };
    p.setAppearance(this.hero.appearance);
    this.day = d.day;
    this.world.sky.time = d.time;
    this.coins = d.coins ?? START_COINS;
    Object.assign(p.stats, { mana: 50, maxMana: 50 + ((d.player.stats.level ?? 1) - 1) * 5 }, d.player.stats);
    p.equip(d.player.equipment.weapon);
    p.equip(d.player.equipment.armor);
    p.getUp = 1;
    p.distanceWalked = d.counters.distance || 0;
    this.counters = { ...d.counters };
    this.flags = { ...d.flags };
    // Saves from before the fireball existed: grant it if a shard was already found.
    if ((this.counters.shard ?? 0) > 0) this.flags.fireball = true;
    this.memories = [...d.memories];
    this.quests.load(d.quests);
    // Older saves finished Chapter I before Chapter II existed.
    if (this.flags.chapter1 && !this.quests.status('grey1')) this.quests.start('grey1');
    this.inventory.load(d.inventory);
    for (const id of d.collected) this.collect(id);
    if (this.flags.chapter1) this.world.stones.setLevel(2);
    else if (this.quests.isActive('stones')) this.world.stones.setLevel(1);
    if (d.tent) this.placeTent(d.tent);
    p.setLantern(!!d.player.lantern && this.inventory.has('lantern'));

    const w = d.player;
    const door = w.space && w.space !== 'world' ? this.world.doors.find((dd) => dd.interiorId === w.space) : null;
    if (door) this.switchSpace(this.interiorFor(door), { x: w.x, z: w.z }, w.facing);
    else this.switchSpace(this.world, { x: w.x, z: w.z }, w.facing);
  }

  // ---------------------------------------------------------------- frame
  update(dt, t) {
    const { input, player } = this;
    if (this.world.update(dt, t, player.position, this.camera)) this.day++;
    if (this.space !== this.world) this.space.update(t, dt);

    const frozen = this.mode === 'paused' || this.mode === 'menu';
    for (const [id, npc] of Object.entries(this.npcs)) {
      if (npc.space !== this.space) continue;
      if (!frozen) npc.update(dt, t, player.position);
      npc.setMarker(this.mode !== 'title' && this.npcHasNews(id));
    }

    switch (this.mode) {
      case 'title':
      case 'intro':
        this.updateTitleCamera(t);
        if (this.mode === 'intro') this.screens.updateIntro(dt, input);
        break;
      case 'create':
        this.updateCreatorCamera(dt, t);
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
        if (this.screens.menu === 'map' && input.wasPressed('KeyM')) this.screens.closeMenu();
        else this.screens.handleMenuInput(input);
        this.idle(dt);
        break;
      case 'transition':
        this.idle(dt);
        break;
      case 'paused':
        // The Esc that released pointer lock can also arrive as a keypress; don't let it un-pause instantly.
        if (input.wasPressed('Escape') && performance.now() - this.pausedAt > 300 && !this.screens.cancelQuit()) this.resume();
        break;
      case 'dead':
        this.deadT += dt;
        player.update(dt, input, this.cam.yaw, this.space, false);
        this.updateEnemies(dt);
        this.cam.update(dt, player.position, false);
        if (this.deadT > 1.6 && this.deadT - dt <= 1.6) this.screens.showDeath();
        break;
    }

    if (!['title', 'intro', 'create'].includes(this.mode)) {
      this.hud.update();
      if (this.space.outdoors) this.minimap.draw();
    }
    this.hud.updateFloaters(dt, this.camera);
    input.endFrame();
  }

  updateEnemies(dt) {
    if (this.space === this.world) this.spawner.update(dt, this.player, this.camera, 1 - this.world.sky.daylight);
    else if (this.space.dark) this.updateCaveEnemies(dt);
  }

  // The world keeps breathing while a dialogue or menu is open, but nothing can hurt you.
  idle(dt) {
    this.player.update(dt, this.input, this.cam.yaw, this.space, false);
    this.cam.update(dt, this.player.position, false);
  }

  updateTitleCamera(t) {
    const { spawn } = LANDMARKS;
    const a = t * 0.05 + 0.6;
    const y = heightAt(spawn.x, spawn.z);
    this.camera.position.set(spawn.x + Math.cos(a) * 24, y + 9, spawn.z + Math.sin(a) * 24);
    this.camera.lookAt(spawn.x, y + 1, spawn.z);
  }

  // Character creation: a slow turntable around the player, shifted right of the options panel.
  updateCreatorCamera(dt, t) {
    const p = this.player;
    p.update(dt, this.input, 0, this.world, false);
    const a = Math.sin(t * 0.4) * 0.6;
    this.camera.position.set(p.position.x + Math.sin(a) * 3.6, p.position.y + 1.7, p.position.z + Math.cos(a) * 3.6);
    this.camera.lookAt(p.position.x, p.position.y + 1.05, p.position.z);
    this.portraitLight.position.copy(this.camera.position).add(tmp.set(0, 2, 0));
    this.portraitLight.target.position.copy(p.position);
    this.portraitLight.intensity = 1.6;
    const w = innerWidth, h = innerHeight;
    if (w > 900) this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    else this.camera.setViewOffset(w, h, 0, h * 0.22, w, h);
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

    // First person from where the hero lies: blinking up at the sky. Then the view pulls back
    // behind them as they get to their feet.
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
      this.hud.toast(`Your pockets hold 🪙 ${START_COINS} old silver coins, stamped with a tower. You don't recognise them.`);
      this.save(false);
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
    if (input.wasPressed('KeyM')) return this.openMap();
    if (input.wasPressed('Escape')) return this.pause();
    if (input.wasPressed('Digit1')) this.quickHeal();
    if (input.wasPressed('KeyL')) this.toggleLantern();
    if (input.wasPressed('KeyT') && this.inventory.has('tent')) this.pitchTent();
    if (input.wasPressed('KeyR') || input.secondaryClick) this.spells.castFireball();

    player.update(dt, input, this.cam.yaw, this.space, true);
    if (input.wasPressed('KeyF') || input.primaryClick) player.startAttack();
    this.resolvePlayerAttack();
    this.updateEnemies(dt);
    this.spells.update(dt, this.space);

    if (this.space === this.world) this.updateOutdoors();

    const near = this.interactions.nearest(player.position, this.space.id);
    this.hud.setPrompt(near ? near.label() : null);
    if (near && input.wasPressed('KeyE')) near.onUse();

    if (this.mode === 'play') this.cam.update(dt, player.position, true);
  }

  updateOutdoors() {
    const p = this.player.position;
    const walked = Math.floor(this.player.distanceWalked);
    if (walked !== (this.counters.distance || 0) && walked <= 100) {
      this.counters.distance = walked;
      this.quests.check();
    }

    const town = this.world.townAt(p.x, p.z);
    if (town && town !== this.inTown) {
      const first = !this.flags[`visited_${town.id}`];
      this.flags[`visited_${town.id}`] = true;
      this.hud.banner(town.name, first ? town.subtitle : '');
      if (town.id === 'millbrook') this.bump('reach:town');
    }
    this.inTown = town;

    for (const m of this.world.caveMouths) {
      const key = `found_${m.def.id}`;
      if (!this.flags[key] && Math.hypot(p.x - m.def.x, p.z - m.def.z) < 30) {
        this.flags[key] = true;
        this.hud.toast(`Discovered: <b>${m.def.name}</b>`, 'quest');
      }
    }
  }

  // Deal damage once per swing, at the moment the blade comes down, to enemies in a frontal arc.
  resolvePlayerAttack() {
    const p = this.player;
    if (!p.hitPending || p.attackProgress < 0.42) return;
    p.hitPending = false;
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    let hit = false;
    for (const e of this.activeEnemies()) {
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
