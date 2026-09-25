# Fieldborn

A small 3D role-playing game engine and two story chapters, built with [three.js](https://threejs.org) and plain JavaScript modules. There's no build step and nothing to install.

> You wake in an open meadow at dawn. You don't know your name, or how you got here. Scattered across the grass are clues: a torn letter, a sword planted in the earth, shards of light that hold pieces of your memory. An old wanderer by a campfire saw you fall from the sky. And across the valley, in four small towns, people are talking about a man in grey who came asking after you.

## Running it

The game loads ES modules, so it has to be served over HTTP. Opening `index.html` straight from disk won't work. From this folder:

```bash
python3 serve.py
```

Then open <http://localhost:5173>. `serve.py` is a tiny server that tells the browser not to cache, so code changes always show up on reload. `python3 -m http.server 5173` or any other static server also works. three.js is loaded from the jsDelivr CDN, so the first load needs an internet connection.

## Controls

| Key | Action |
| --- | --- |
| **W A S D** | Move (relative to the camera) |
| **Mouse** | Look. Click the view to capture the mouse, or drag to look without capturing |
| **Q / ← →** | Turn the camera |
| **Wheel** | Zoom |
| **Shift** | Run (uses stamina) |
| **Space** | Jump |
| **Click / F** | Attack |
| **R / right-click** | Fireball, once you've learned it (uses mana) |
| **E** | Interact: talk, pick up, open doors and chests |
| **1** | Eat or drink something healing |
| **L** | Light or put out your lantern |
| **T** | Pitch your tent |
| **I** / **J** / **M** | Inventory / Journal / World map |
| **Esc** | Pause: resume, save, or quit to the title screen |

## What's in it

- **Character creation and save slots:** choose a name, body type, skin tone, hairstyle, hair colour, tunic and beard. Your name stays hidden (`???`) until the standing stones give it back to you. Three save slots; *Load Game* on the title screen lists them.
- **World:** a procedurally generated valley (seeded, so it's the same every load) with a central meadow, rolling hills, a pond, pine woods and a mountain ring, all connected by dirt roads. There are thousands of instanced trees, rocks, flowers and wind-animated grass tufts.
- **Four towns:**
  - **Millbrook:** the Fallen Star inn and a smithy.
  - **Ashford:** a woodcutters' town with a general store, a chapel and a sawmill.
  - **Greywatch:** a palisaded garrison with a watchtower, an armoury and barracks.
  - **Thornbury:** a market town with a tavern, a curio shop and a fountain.

  Every building can be entered, and each has its own furnished interior (house, inn, shop, chapel, tower, barracks, windmill) with townsfolk to talk to. Enemies won't follow you into town.
- **Caves:** the Hollow Deep, the Whispering Grotto and the Sunken Vault. Each is a procedurally carved cave, pitch dark apart from glowing crystals, with bats, skeletons and treasure chests. The farthest chest in each holds something good.
- **Day/night cycle:** a sky shader with sun, moon and stars, moonlight, and time-of-day fog. Town windows and lamps light up at night, and fireflies come out. A full day lasts 9 minutes.
- **Coins and shops:** enemies, chests and quests pay coins. Six merchants sell weapons, armour, food, potions, tomes and gear, and buy your loot back.
- **Gear:**
  - Nine weapons across swords, axes, spears and a staff, each with its own model, damage, reach and swing speed.
  - Armour that shows on your character: a cape, or tinted body armour.
  - A **lantern** for the dark.
  - A **tent** you can pitch almost anywhere outdoors, sleep in until morning (it saves your game), then pack up.
- **Magic:** after your first memory returns you can throw **fireballs**. They use a mana bar that refills over time. Tomes and a staff make them hotter.
- **Combat:** swings hit in a frontal arc at the moment the blade comes down, with critical hits, knockback, hit flashes, damage numbers and camera shake. Enemies are slimes and wolves outdoors, bats and skeletons underground, and a boss with blink-teleports and homing orbs.
- **Story:**
  - **Chapter I, The Fieldborn:** recover your memories and your name.
  - **Chapter II, The Man in Grey:** follow his trail from Millbrook to Thornbury to Greywatch, and into the Sunken Vault.

  There are also side quests for Oswin, Tam and Captain Hale.
- **UI:** HUD bars, a minimap, a full world map, an inventory with a character sheet, a journal, a shop window, story cards, and a boss health bar.

## Project layout

```
index.html            HUD/menu markup and the three.js import map
styles.css            All UI styling
serve.py              No-cache local dev server
src/
  main.js             Boots the game
  Game.js             Orchestrator: modes, spaces (world/interiors/caves), interactions, combat, save/load
  engine/             Renderer + loop, input, event bus, math and noise helpers
  world/              Terrain, sky, vegetation, props, Town builder, Interior, Cave, World
  entities/           Humanoid rig (bodies, hair, weapons, capes), Player, Enemy (incl. boss), NPC
  systems/            Camera, quests, inventory, spawner, spells, interactions, save slots
  ui/                 HUD, minimap, world map, dialogue box, shop, character creator, overlay screens
  data/               Items, shops, towns, caves, NPCs, quests, dialogue and story text
```

## Extending it

Most content lives in `src/data/` and needs no engine changes.

- **New item:** add an entry to `data/items.js` with a `type` (`weapon`, `armor`, `consumable`, `material`, `tool`, `tome` or `key`) and a coin `value`.
  - Weapons also take `model` (`sword`, `axe`, `spear` or `staff`), `damage`, `reach` and `speed` (seconds per swing).
  - To place a weapon in the world, add it to `WEAPON_PICKUPS` in `Game.js`.
- **New shop:** add it to `data/shops.js` (what it sells and what it buys) and give a character `shop: 'id'` in `data/npcs.js`.
- **New town:** add an entry to `TOWNS` in `data/towns.js`: position, palette, and the buildings around the square. Buildings are placed by angle and radius and face the square.
  - Enterable kinds are house, inn, shop, chapel, tower, hall and windmill.
  - Give a building `npc: 'id'` or `resident: 'id'` to put someone inside.
  - Add a road to `PATHS` in `world/Terrain.js`.
- **New cave:** add it to `CAVES` in `data/towns.js` (position, seed, size, enemies, chests, and an optional key it's locked with).
- **New quest:** add it to `data/quests.js`. Each objective watches a counter: `item:<id>` counts inventory, and anything else reads `game.counters` (bump one from gameplay with `game.bump('name')`). Set `turnIn` to require talking to an NPC, `next` to chain quests, and `rewards` for XP, coins and items.
- **New NPC:** add an entry to `NPCS` in `data/npcs.js` with an appearance, a name, a dialogue tree and an optional shop. Place them outdoors with `outdoor`, or inside a building through the town data.
- **New dialogue:** trees are plain objects. Each node has `text`, an optional `onEnter`, and `options` with `next`, an optional `if` condition and an optional `do` action.
- **New enemy:** add a type to `ENEMY_TYPES` in `entities/Enemy.js` and give it a mesh builder. Then add it to a spawn zone in `systems/Spawner.js`, or to a cave's `enemies`.

For debugging, the running game is available as `window.game` in the browser console.
