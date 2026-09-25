# Fieldborn

A small 3D RPG in three.js and plain ES modules. There's no build step, no npm, and Node isn't installed on this machine. `README.md` covers controls, features and how to add content; read it first.

## Running it

```bash
python3 serve.py   # from this folder: no-cache server on http://localhost:5173
```

- three.js comes from the jsDelivr CDN through the import map in `index.html`. Keep it pinned (currently 0.170.0).
- **Use `serve.py`, not `python3 -m http.server`, while developing.** The plain server lets the browser cache modules heuristically, so edits sometimes don't show up after a reload. `serve.py` also handles parallel requests; the plain server occasionally resets connections mid-load, which leaves `window.game` pointing at the `#game` div.
- **Preview pane:** the preview launcher can't read `~/Documents` (a macOS privacy block; python fails in `os.getcwd()`). Start the server with Bash `run_in_background`, then `preview_start` with a `launch.json` entry that only has `"url": "http://localhost:5173"`.
- **The hidden preview pane barely runs animation frames** (~2 fps) and screenshots are often a frame or two stale (take a second screenshot if it looks wrong). Drive the game from `javascript_tool` instead: the running game is `window.game`, and this steps it by hand:
  ```js
  window.step = (sec) => { const e = game.engine; for (let i = 0; i < Math.round(sec * 60); i++) { e.elapsed += 1/60; game.update(1/60, e.elapsed); } e.renderer.render(e.activeScene, e.camera); return game.mode; };
  window.key = (code, type = 'keydown') => window.dispatchEvent(new KeyboardEvent(type, { code }));
  ```
  Never `await requestAnimationFrame` in the pane; it can hang until timeout. Story cards ignore input for 450 ms of real time, and doors and rest use a ~1 s fade, so wait with `setTimeout`.
  Don't call `location.reload()` and keep using the page in the same script; reload in one call and test in the next.
- Pointer lock doesn't work reliably in the pane. When the game loses pointer lock it pauses on purpose; call `game.resume()`.

## Architecture in one breath

`src/Game.js` is the orchestrator:
- **Modes:** `title → (slots) → create → intro → waking → play ⇄ dialogue | card | menu | paused | dead | transition`.
- **Spaces:** the player is always in one space, `game.space`: the outdoor `World`, an `Interior` (one per building, built lazily on first entry), or a `Cave`. Every space exposes `scene`, `groundAt`, `collide`, `clamp`, `inWater`, `isSafe` (and `blocked` for enemies). `game.switchSpace()` moves the player mesh between scenes, and the engine renders `engine.activeScene`.
- **Interactions** carry a `space` id and only trigger in that space. NPCs are created per space: outdoor ones at startup, indoor ones with their interior.

Content is data in `src/data/*`: `items`, `shops`, `towns` (towns and caves), `npcs` (characters, residents, the shopkeeper helper, the Corvin tree), `dialogue` (Oswin, Brenna, Tam, Pip), `quests` and `story`.

## Rules and gotchas

- **Coordinates:** -z is north. `heightAt(x, z)` is a pure function; use it for ground height instead of raycasting the mesh. Towns and cave mouths are flattened inside it.
- **Water** is only the pond. Use `isWater`/`isPond` (or `space.inWater`), never a bare `h < WATER_LEVEL` check; low dips elsewhere are dry land.
- **Colliders** are circles `{x, z, r}` or boxes `{x, z, hw, hd, rot}` (outdoors, rotated) in each space's `colliders`. NPC colliders move with the NPC.
- **Light count per scene must stay constant** or every material recompiles (a visible hitch). Toggle a light's `intensity` instead of adding or removing it: the player's lantern, the fireball light and the creator's portrait light all do this.
- **`Object3D.position` is read-only.** Never `Object.assign(mesh, { position })`; it throws in modules.
- **Dialogue nodes:** `text()` is evaluated *before* `onEnter`, and `options()` *after*. Greetings that check "first meeting" flags rely on this order. Esc picks the last option with `next: null` and no `do`, so a "Goodbye" should have no `do`.
- **Quests** count counters (`game.bump('name')`), or inventory for `item:<id>`. Objectives with `fromStart` only count progress made after the quest starts. Counters persist, so a quest whose counter is already met completes the moment it starts.
- **Saves:** three slots in `localStorage` (`fieldborn-slot-1..3`). The old single save `fieldborn-save-v1` is migrated into slot 1. Saves store collected interaction ids, so never rename existing ids such as `sword`, `letter`, `shard0-2`, `herbN`, `rack_sword`, `axe_pickup`, `spear_pickup` or `chest:<cave>:<n>`. `applySave` has fallbacks for older saves; keep them. Wrap all storage access in try/catch.
- Match the existing style: small focused modules, sparse comments that explain *why*, and data-driven content over special cases.

## Story canon

- The player chooses a name, body type (masculine or feminine) and look at the start. The name shows as `???` until the standing stones reveal it (end of Chapter I). Use "they" or second person for the player in text; don't assume a gender.
- **Chapter I:** wake in the meadow, find three memory shards (the first also brings back fire magic), meet **Oswin** at the campfire northeast of the spawn point, and touch the altar in the standing stones.
- **Chapter II:** the man in grey.
  - Tam gives you his old tower-stamped coin.
  - **Marisol** in Thornbury identifies it as coming from the Tower of Glass.
  - **Captain Hale** in Greywatch gives you the Vault key.
  - In the Sunken Vault you fight **Corvin, Warden of the Crossing**: your old teacher, who was following you, not hunting you.
  - The shards were pieces of a seal, now burned into you.
- **Open threads for Chapter III:** who wrote the torn letter (it warned against Corvin, maybe to isolate you); what waits behind the stones and the Tower of Glass; and Hale's two missing soldiers.
- **Other characters:**
  - Millbrook: Brenna (smith), Tam (innkeeper, she/her) and Pip.
  - Ashford: Odo (outfitter) and Sister Maren (chapel).
  - Greywatch: Hale and Sera (armorer).
  - Thornbury: Bram (tavern) and Marisol (curios).

## Git

The remote is `https://github.com/Rali3d/Game1` on branch `main`. A GitHub token is saved in the macOS keychain, so `git push` works from this folder. `.claude/` is gitignored.
