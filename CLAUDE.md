# Fieldborn

A small 3D RPG in three.js and plain ES modules. There's no build step, no npm, and Node isn't installed on this machine. `README.md` covers controls, features and how to add content; read it first.

## Running it

```bash
python3 -m http.server 5173   # from this folder, then open http://localhost:5173
```

- three.js comes from the jsDelivr CDN through the import map in `index.html`. Keep it pinned (currently 0.170.0).
- **Preview pane:** the preview launcher can't read `~/Documents` (a macOS privacy block; python fails in `os.getcwd()`). Start the server with Bash `run_in_background`, then `preview_start` with a `launch.json` entry that only has `"url": "http://localhost:5173"`.
- **The hidden preview pane barely runs animation frames** (~2 fps) and screenshots can be stale. Drive the game from `javascript_tool` instead: the running game is `window.game`, and this steps it by hand:
  ```js
  window.step = (sec) => { const e = game.engine; for (let i = 0; i < Math.round(sec * 60); i++) { e.elapsed += 1/60; game.update(1/60, e.elapsed); } e.renderer.render(e.scene, e.camera); return game.mode; };
  window.key = (code, type = 'keydown') => window.dispatchEvent(new KeyboardEvent(type, { code }));
  ```
  Never `await requestAnimationFrame` in the pane; it can hang until timeout. Story cards ignore input for 450 ms of real time, so wait with `setTimeout` before closing one.
- Pointer lock doesn't work reliably in the pane. When the game loses pointer lock it pauses on purpose; call `game.resume()`.

## Architecture in one breath

`src/Game.js` is the orchestrator. It holds game modes (`title → intro → waking → play ⇄ dialogue | card | menu | paused | dead`), interactions, combat resolution, save/load, and the `NPCS` and `WEAPON_PICKUPS` tables. The world is built from `src/world/*` (Terrain, Sky, Vegetation, Props, Town, World), and systems live in `src/systems/*`. Content is data in `src/data/*`: items, quests, dialogue, story.

## Rules and gotchas

- **Coordinates:** -z is north. `heightAt(x, z)` is a pure function; use it for ground height instead of raycasting the mesh.
- **Water** is only the pond. Use `isWater`/`isPond`, never a bare `h < WATER_LEVEL` check; low dips elsewhere are dry land.
- **Colliders** are circles `{x, z, r}` or rotated boxes `{x, z, hw, hd, rot}` in `world.colliders`. NPC colliders move with the NPC.
- **`Object3D.position` is read-only.** Never `Object.assign(mesh, { position })`; it throws in modules.
- **Dialogue nodes:** `text()` is evaluated *before* `onEnter`, and `options()` *after*. Greetings that check "first meeting" flags rely on this order.
- **Quests** count counters (`game.bump('name')`), or inventory for `item:<id>`. Objectives with `fromStart` only count progress made after the quest starts.
- **Save file** (`localStorage` key `fieldborn-save-v1`) stores collected interaction ids. Never rename existing ids such as `sword`, `letter`, `shard0-2`, `herbN`, `rack_sword`, `axe_pickup` or `spear_pickup`, or old saves break. Wrap all storage access in try/catch.
- Match the existing style: small focused modules, sparse comments that explain *why*, and data-driven content over special cases.

## Story canon

- The player wakes in a meadow at dawn with amnesia. His name shows as `???` until the standing stones reveal it as **Aren** (end of Chapter I).
- **Oswin**: a wanderer at the campfire northeast of the spawn point.
- **Millbrook**: the village to the south. **Brenna** is the blacksmith, **Tam** the innkeeper at the Fallen Star (she/her), and **Pip** a child who wanders the square.
- **The man in grey** is an unresolved hook. The torn letter warns against him; he passed through Millbrook asking about something that fell from the sky, then headed north to the stones. He's a good thread for Chapter II.

## Git

The remote is `https://github.com/Rali3d/Game1` on branch `main`. A GitHub token is saved in the macOS keychain, so `git push` works from this folder. `.claude/` is gitignored.
