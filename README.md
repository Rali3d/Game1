# Fieldborn

A small 3D role-playing game engine and two story chapters, built with [three.js](https://threejs.org) and plain JavaScript modules. There's no build step and nothing to install.

> You wake in an open meadow at dawn. You don't know your name, or how you got here. Scattered across the grass are clues: a torn letter, a sword planted in the earth, shards of light that hold pieces of your memory. An old wanderer by a campfire saw you fall from the sky. And across the valley, in four small towns, people are talking about a man in grey who came asking after you. Beyond the valley's hills lie eight wild regions, five more towns, and a great many people who want things done.

## Running it

The game loads ES modules, so it has to be served over HTTP. Opening `index.html` straight from disk won't work. From this folder:

```bash
python3 serve.py
```

Then open <http://localhost:5173>. `serve.py` is a tiny server that makes the browser check for changed files on every load, so code changes always show up. Any static file server works. three.js is loaded from the jsDelivr CDN, so the first load needs an internet connection.

## Art

The characters, animations, buildings, trees, props and farm animals are by [Quaternius](https://quaternius.com) (CC0). See [`assets/CREDITS.md`](assets/CREDITS.md).

The Imp and Puglin monsters are from Quaternius's Bestiary pack, whose license doesn't allow sharing the files, so they aren't in the repository. If you own the pack, put it in `models/` and run `tools/build_assets.py`; otherwise bats and wolves take their place.

- `assets/` holds only the models the game uses, with game-sized textures. It's about 47 MB, loaded behind a progress bar at startup.
- The raw packs go in `models/`, which is not in git (they're about 1 GB). If you add or change packs, rebuild `assets/` from them:
  ```bash
  python3 tools/build_assets.py
  ```

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
| **E** | Interact: talk, pick up, open doors and chests, read notice boards, take the coach |
| **1** | Eat or drink something healing |
| **L** | Light or put out your lantern |
| **T** | Pitch your tent |
| **I** / **J** / **M** | Inventory / Journal / World map |
| **Esc** | Pause: resume, save, or quit to the title screen |

## What's in it

- **Characters:** animated Quaternius characters for the player, townsfolk and the undead, with walk, jog, sprint, swim, jump, sword combos, spell casting, hits, death, talking, and getting up from the grass.
- **Character creation and save slots:** choose a name, body type, outfit (Peasant or Ranger), skin tone, hairstyle, hair colour, dye, beard and hood. Your name stays hidden (`???`) until the standing stones give it back to you. Three save slots; *Load Game* on the title screen lists them.
- **World:** about 1.2 km across and the same every load. The Vale (the starting valley) sits in the middle, ringed by hills with passes where the roads cross. Around it are eight regions, each with its own land, trees, colours, monsters and danger level:
  - The Frostreach (snowy highlands), the Ember Crags (with a dragon), Amberwood (autumn maples and birches), Stillmere (a great lake), the Mirefen (marsh pools), Blackroot Forest, the Sunder Plains (the ruins of an old kingdom) and the Barrow Downs.
  - Roads link every town. Far trees are drawn as cheap stand-ins, so the view reaches the fog.
- **Nine towns.** The Vale's four:
  - **Millbrook:** the Fallen Star inn and a smithy.
  - **Ashford:** a woodcutters' town with a general store, a chapel and a sawmill.
  - **Greywatch:** a palisaded garrison with a watchtower, an armoury and barracks.
  - **Thornbury:** a market town with a tavern, a curio shop and a fountain.

  And beyond the Vale: **Frosthold** (miners and a forge), **Amberly** (orchards and cider), **Stillwater** (a lakeside chapel that lost its bell), **Fenwick** (marsh folk and a witch who brews) and **Oldgate** (the warden who fights the bandit king).

  Every building can be entered, and each has its own furnished interior (house, inn, shop, chapel, tower, barracks, windmill) with townsfolk to talk to. Enemies won't follow you into town.
- **Notice boards** in every town post three jobs a day: hunts, gathering, deliveries to other towns, and scouting places you haven't found. Hand them in at any board.
- **Coaches** run from each town's sign to any town you've already visited, for a fare.
- **Eight caves**, pitch dark apart from glowing crystals, with treasure chests. The farthest chest in each holds something good.
- **Three dungeons** built room by room from a modular dungeon kit: torchlit halls, spike traps, and a guardian in the deepest room (the Barrow King, Morwen of the crypt, and Rook the bandit king).
- **Ruins** of the old kingdom, each with guards and a chest, and **Emberwing**, a dragon on Emberfall Peak.
- **Animals:** herds of cows, sheep, horses, pigs and llamas graze near the towns and shy away when you get close. You can hunt them for wool, hide and meat. Rest at a campfire or your tent to roast the meat. Pip has a dog (you can't hurt the dog).
- **Day/night cycle:** a sky shader with sun, moon and stars, moonlight, and time-of-day fog. Town windows and lamps light up at night, and fireflies come out. A full day lasts 9 minutes.
- **Coins and shops:** enemies, chests and quests pay coins. Six merchants sell weapons, armour, food, potions, tomes and gear, and buy your loot back.
- **Gear:**
  - Nine weapons across swords, axes, spears and a staff, each with its own model, damage, reach and swing speed.
  - Armour: body armour tints your outfit; cloaks are worn but not drawn. Eighteen weapons, from daggers to a dragon-guarded greatsword.
  - A **lantern** for the dark.
  - A **tent** you can pitch almost anywhere outdoors, sleep in until morning (it saves your game), then pack up.
- **Magic:** after your first memory returns you can throw **fireballs**. They use a mana bar that refills over time. Tomes and a staff make them hotter.
- **Combat:** swings hit in a frontal arc at the moment the blade comes down, with critical hits, knockback, hit flashes, damage numbers and camera shake. Weapons ride on your back and come to hand when you swing. Enemies (slimes, wolves, puglins, bandits, bats, imps, skeletons) appear around you according to the region, and get tougher the further you go from the Vale.
- **Story:**
  - **Chapter I, The Fieldborn:** recover your memories and your name.
  - **Chapter II, The Man in Grey:** follow his trail from Millbrook to Thornbury to Greywatch, and into the Sunken Vault.

  There are also side quests for Oswin, Tam and Captain Hale in the Vale, and a chain of side stories in each of the five frontier towns.
- **UI:** HUD bars, a minimap, a full world map, an inventory with a character sheet, a journal, a shop window, story cards, and a boss health bar.

## Project layout

```
index.html            HUD/menu markup and the three.js import map
styles.css            All UI styling
serve.py              Local dev server
assets/               The Quaternius models the game uses (built by tools/build_assets.py)
tools/                build_assets.py: copies and downsizes models from models/ into assets/
models/               The raw Quaternius packs (not in git)
src/
  main.js             Boots the game
  Game.js             Orchestrator: modes, spaces (world/interiors/caves), interactions, combat, save/load
  engine/             Renderer + loop, asset loader, input, event bus, math and noise helpers
  world/              Terrain (height map, regions), sky, vegetation (+ tree impostors, grass), props, Town builder,
                      Interior, Cave, Dungeon, Sites (ruins, dungeon doors, the dragon's roost), colliders, World
  entities/           CharacterModel (animated Quaternius characters), Creatures (monsters, farm animals), Gear (weapons, lantern), Player, Enemy, NPC, Animal
  systems/            Camera, quests, bounties, inventory, spawner, spells, interactions, save slots
  ui/                 HUD, minimap, world map, dialogue box, shop, character creator, overlay screens
  data/               World (regions, lakes, roads, sites), towns/caves/dungeons, items, shops, NPCs, frontier towns' people and quests, dialogue helpers, story text
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
- **New cave:** add it to `CAVES` in `data/towns.js` (position, seed, size, level, enemies, chests, and an optional key it's locked with).
- **New dungeon:** add it to `DUNGEONS` in `data/towns.js` (position, seed, number of rooms, level, enemies, the guardian's enemy type, chests and the prize).
- **New region:** add it to `REGIONS` in `data/world.js` with a compass bearing, hills, colours, trees, enemies and a level. Roads, lakes and ruins are in the same file.
- **New quest:** add it to `data/quests.js`. Each objective watches a counter: `item:<id>` counts inventory, and anything else reads `game.counters` (bump one from gameplay with `game.bump('name')`). Set `turnIn` to require talking to an NPC, `next` to chain quests, and `rewards` for XP, coins and items.
- **New NPC:** add an entry to `NPCS` in `data/npcs.js` (or `data/frontier.js`) with an appearance, a name, a dialogue tree and an optional shop. Place them outdoors with `outdoor`, or inside a building through the town data. `townTree()` in `data/talk.js` builds the usual shape: an intro, their quests in order, a shop, a bed if they keep an inn, and news.
- **New dialogue:** trees are plain objects. Each node has `text`, an optional `onEnter`, and `options` with `next`, an optional `if` condition and an optional `do` action.
- **New enemy:** add a type to `ENEMY_TYPES` in `entities/Enemy.js` and give it a mesh builder. Then add it to a spawn zone in `systems/Spawner.js`, or to a cave's `enemies`.

For debugging, the running game is available as `window.game` in the browser console.
