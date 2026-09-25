# Fieldborn

A small 3D role-playing game engine and opening chapter, built with [three.js](https://threejs.org) and plain JavaScript modules. There's no build step and nothing to install.

> You wake in an open meadow at dawn. You don't know your name, or how you got here. Scattered across the grass are clues: a torn letter, a sword planted in the earth, shards of light that hold pieces of your memory. An old wanderer by a campfire saw you fall from the sky. Down the path to the south, the village of Millbrook has heard rumours of a man in grey.

## Running it

The game loads ES modules, so it has to be served over HTTP. Opening `index.html` straight from disk won't work.

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>. Any static file server works. three.js is loaded from the jsDelivr CDN, so the first load needs an internet connection.

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
| **E** | Interact / talk / pick up |
| **1** | Drink a Healing Draught (or eat a Moonpetal) |
| **I** / **J** | Inventory / Journal |
| **Esc** | Pause: resume, save, or quit to the title screen |

## What's in it

- **World:** a procedurally generated heightmap (seeded, so it's the same every load) with a flat central meadow, rolling hills, a pond, pine woods and a mountain ring. Thousands of instanced trees, rocks, flowers and wind-animated grass tufts.
- **Day/night cycle:** a gradient sky shader with sun, moon and stars, shadow-casting sunlight that becomes moonlight, fog that follows the time of day, and fireflies at night. A full day lasts 9 minutes.
- **Character:** a jointed blocky humanoid with walk, run, jump, attack, get-up and death animations, stamina, levelling, equipment and health regen.
- **Combat:** swings hit enemies in a frontal arc at the moment the blade comes down. Includes critical hits, knockback, hit-flash, floating damage numbers and camera shake.
- **Enemies:** hopping meadow slimes and grey wolves in the woods (which hunt from further away at night). They wander, chase, wind up telegraphed attacks, give up and return home, and respawn out of sight.
- **Millbrook:** a small village south of the meadow, joined to it by a dirt path. It has timber-framed houses whose windows light up at night, the Fallen Star inn (rest and save there), a smithy with a working forge, a well, a market stall, lamp posts and a windmill. Enemies won't follow you into town.
- **Weapons:** four weapons with their own models and handling: the Rusty Sword (in the meadow), the Iron Sword (on the smithy rack), the Woodcutter's Axe (in a stump off the north path; hits hard, swings slow) and the Hunter's Spear (at an abandoned camp on the edge of the western woods; longest reach). Picking up a stronger weapon equips it; switch any time from the inventory.
- **NPCs and dialogue:** Oswin the Wanderer, Brenna the blacksmith, Tam the innkeeper and Pip, a curious child who wanders the square. Each has a branching, state-aware dialogue tree, with quest offers, turn-ins, rumours and herb brewing.
- **Quests:** a data-driven quest system with counters, turn-ins and chained quests, plus an on-screen tracker and a journal.
- **UI:** HUD bars, minimap with edge-pinned objective markers, inventory with a character sheet, story cards for letters and memories, pause and death screens.
- **Saving:** save from the pause menu or by resting at the campfire or the inn. It's stored in `localStorage`, and *Continue* appears on the title screen. *Quit to Title* in the pause menu offers to save first.

## Project layout

```
index.html            HUD/menu markup and the three.js import map
styles.css            All UI styling
src/
  main.js             Boots the game
  Game.js             Orchestrator: game modes, interactions, combat resolution, save/load
  engine/             Renderer + loop, input, event bus, math and noise helpers
  world/              Terrain (heightAt, paths), sky/lighting, vegetation, props, Town, World (collision)
  entities/           Humanoid rig, Player, Enemy, NPC
  systems/            Camera, quests, inventory, spawner, interactions, save game
  ui/                 HUD, minimap, dialogue box, overlay screens
  data/               Items, quests, dialogue trees and story text: edit these to add content
```

## Extending it

Most content lives in `src/data/` and needs no engine changes.

- **New item:** add an entry to `data/items.js` (`type`: `weapon`, `armor`, `consumable`, `material` or `key`). Weapons also take `model` (`sword`, `axe` or `spear`), `damage`, `reach` and `speed` (seconds per swing). To place one in the world, add it to `WEAPON_PICKUPS` in `Game.js`.
- **New quest:** add it to `data/quests.js`. Each objective watches a counter: `item:<id>` counts inventory, and anything else reads `game.counters` (bump one from gameplay with `game.bump('name')`). Set `turnIn` to require talking to an NPC, and `next` to chain quests.
- **New NPC:** add an entry to `NPCS` in `Game.js` (appearance options, a dialogue tree and a name) and a placement next to it.
- **New dialogue:** trees are plain objects in `data/dialogue.js`. Each node has `text`, an optional `onEnter`, and `options` with `next`, an optional `if` condition and an optional `do` action.
- **New enemy:** add a type to `ENEMY_TYPES` in `entities/Enemy.js`, give it a mesh builder, and add a zone in `systems/Spawner.js`.
- **New interactable:** `game.interactions.add({ id, position, radius, label, onUse, prop })`.

For debugging, the running game is available as `window.game` in the browser console.
