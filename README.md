# Fieldborn

A small 3D role-playing game engine and opening chapter, built with [three.js](https://threejs.org) and plain JavaScript modules. There's no build step and nothing to install.

> You wake in an open meadow at dawn. You don't know your name, or how you got here. Scattered across the grass are clues: a torn letter, a sword planted in the earth, shards of light that hold pieces of your memory. An old wanderer by a campfire saw you fall from the sky.

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
| **Esc** | Pause (save from here, or rest at a campfire) |

## What's in it

- **World:** a procedurally generated heightmap (seeded, so it's the same every load) with a flat central meadow, rolling hills, a pond, pine woods and a mountain ring. Thousands of instanced trees, rocks, flowers and wind-animated grass tufts.
- **Day/night cycle:** a gradient sky shader with sun, moon and stars, shadow-casting sunlight that becomes moonlight, fog that follows the time of day, and fireflies at night. A full day lasts 9 minutes.
- **Character:** a jointed blocky humanoid with walk, run, jump, attack, get-up and death animations, stamina, levelling, equipment and health regen.
- **Combat:** swings hit enemies in a frontal arc at the moment the blade comes down. Includes critical hits, knockback, hit-flash, floating damage numbers and camera shake.
- **Enemies:** hopping meadow slimes and grey wolves in the woods (which hunt from further away at night). They wander, chase, wind up telegraphed attacks, give up and return home, and respawn out of sight.
- **NPC and dialogue:** Oswin the Wanderer, with a branching, state-aware dialogue tree, quest offers and turn-ins, and herb brewing.
- **Quests:** a data-driven quest system with counters, turn-ins and chained quests, plus an on-screen tracker and a journal.
- **UI:** HUD bars, minimap with edge-pinned objective markers, inventory with a character sheet, story cards for letters and memories, pause and death screens.
- **Saving:** save from the pause menu or by resting at the campfire. It's stored in `localStorage`, and *Continue* appears on the title screen.

## Project layout

```
index.html            HUD/menu markup and the three.js import map
styles.css            All UI styling
src/
  main.js             Boots the game
  Game.js             Orchestrator: game modes, interactions, combat resolution, save/load
  engine/             Renderer + loop, input, event bus, math and noise helpers
  world/              Terrain (heightAt), sky/lighting, vegetation, props, World (collision)
  entities/           Humanoid rig, Player, Enemy, NPC
  systems/            Camera, quests, inventory, spawner, interactions, save game
  ui/                 HUD, minimap, dialogue box, overlay screens
  data/               Items, quests, dialogue trees and story text: edit these to add content
```

## Extending it

Most content lives in `src/data/` and needs no engine changes.

- **New item:** add an entry to `data/items.js` (`type`: `weapon`, `armor`, `consumable`, `material` or `key`).
- **New quest:** add it to `data/quests.js`. Each objective watches a counter: `item:<id>` counts inventory, and anything else reads `game.counters` (bump one from gameplay with `game.bump('name')`). Set `turnIn` to require talking to an NPC, and `next` to chain quests.
- **New dialogue:** trees are plain objects in `data/dialogue.js`. Each node has `text`, an optional `onEnter`, and `options` with `next`, an optional `if` condition and an optional `do` action.
- **New enemy:** add a type to `ENEMY_TYPES` in `entities/Enemy.js`, give it a mesh builder, and add a zone in `systems/Spawner.js`.
- **New interactable:** `game.interactions.add({ id, position, radius, label, onUse, prop })`.

For debugging, the running game is available as `window.game` in the browser console.
