# Fieldborn

A small 3D RPG in three.js and plain ES modules. There's no build step, no npm, and Node isn't installed on this machine. `README.md` covers controls, features and how to add content; read it first.

## Running it

```bash
python3 serve.py   # from this folder: no-cache server on http://localhost:5173
```

- three.js comes from the jsDelivr CDN through the import map in `index.html`. Keep it pinned (currently 0.170.0).
- **Use `serve.py`, not `python3 -m http.server`, while developing.** The plain server lets the browser cache modules heuristically, so edits sometimes don't show up after a reload. It also has a 5-connection backlog and resets connections while the models load; `serve.py` uses a large backlog and `no-cache`. If a load fails, `window.game` points at the `#game` div.
- **Preview pane:** the preview launcher can't read `~/Documents` (a macOS privacy block; python fails in `os.getcwd()`). Start the server with Bash `run_in_background`, then `preview_start` with a `launch.json` entry that only has `"url": "http://localhost:5173"`.
- **The hidden preview pane barely runs animation frames** (~2 fps) and screenshots are often a frame or two stale (take a second screenshot if it looks wrong). Drive the game from `javascript_tool` instead: the running game is `window.game`, and this steps it by hand:
  ```js
  window.step = (sec) => { const e = game.engine; for (let i = 0; i < Math.round(sec * 60); i++) { e.elapsed += 1/60; game.update(1/60, e.elapsed); } e.renderer.render(e.activeScene, e.camera); return game.mode; };
  window.key = (code, type = 'keydown') => window.dispatchEvent(new KeyboardEvent(type, { code }));
  ```
  Never `await requestAnimationFrame` in the pane; it can hang until timeout. Story cards ignore input for 450 ms of real time, and doors and rest use a ~1 s fade, so wait with `setTimeout`.
  Don't call `location.reload()` and keep using the page in the same script; reload in one call and test in the next.
- Pointer lock doesn't work reliably in the pane. When the game loses pointer lock it pauses on purpose; call `game.resume()`.

## Art assets (Quaternius)

- The raw packs live in `models/` (gitignored, about 1.1 GB). The folders `../Assets` and `../Assets2` are the user's original downloads; the game never reads them. `python3 tools/build_assets.py` rebuilds `assets/` from them: it copies the chosen glTFs, shrinks colour textures with `sips`, and drops normal and roughness maps. `assets/manifest.json` lists what the game loads.
- The Bestiary pack (Puglin, Imp) is under the Quaternius Asset License: usable in the game, but never commit its files. The build script puts them in `assets/bestiary/` and `assets/manifest.local.json`, both gitignored. Enemy types with a `model` fall back to `fallback` via `availableType()` when they're missing. The other packs are CC0.
- **Monsters** (`entities/Creatures.js`, `MonsterModel`) share the characters' bone names, so they use the UAL clips through `Assets.retargetedClip()`: rotation tracks only, plus the pelvis position scaled to the monster's height (UAL clips also key position and scale on every bone, which would stretch them).
- **FBX packs** (farm animals, the monster pack, weapons, dungeon, ruins) load through FBXLoader in `Assets`:
  - Static ones are scaled to metres (x0.01) on load. Their Phong materials become Standard, with colours converted back from the double sRGB conversion FBXLoader applies.
  - Their many material groups are compacted to one per material (`compactGroups`). Without that, a dungeon wall costs hundreds of draw calls.
  - Animated ones use `ClipModel` (`AnimalModel`, `PackMonster`) with their own clips, scaled to a height. Only Cow and Horse walk and run; the other animals hop. They face +z like the characters.
- `engine/Assets.js` loads everything before `Game` starts. Get models with `Assets.clone('props/Barrel')`, instancing data with `Assets.meshParts(key)`, and animations with `Assets.clip(name)`. It turns on `THREE.Cache` and shares one Texture per image; keep both, or shared texture sheets get fetched and uploaded dozens of times.
- **Characters** (`entities/CharacterModel.js`): an outfit glTF plus the base body (only head and neck are drawn; the rest is discarded in a shader by bind-pose position) plus hair and beard. All are re-skinned onto the outfit's skeleton, and all share the UAL skeleton. `ANIMS` maps game names to UAL clip names. `loop()` sets the locomotion loop and `once()` plays one-shots that take over and hand back. Head and chest bones are aligned with the character (x right, y up, z forward). Weapons point +z from the grip and sit in `handR` with `GRIP_R`. The player's weapon rides on the back (`SHEATH_*`, following `spine_03`) and moves to the hand only while attacking: the walk and idle clips turn the palm backwards, so a held weapon flails. Lanterns and staves use `follow()` (bone position only), never bone parenting. Cloaks have no model (nothing in the packs fits these characters); they're stats only.
- `once()` always plays a clip a single time, whatever its name, and hands back to the loop requested meanwhile. `locomote()` has overlapping speed bands so the gait doesn't flicker at the boundaries.
- **Don't dispose geometry of cloned characters or kit models**: it's shared with the loaded assets. Dispose only materials, which `CharacterModel.dispose()` does.
- The nature kit stores wind data in vertex colours; `Assets` turns vertex colours off for `nature/*`. The kit bushes borrow the green broadleaf leaves.
- Village pieces are 2 m wide and 3.12 m tall. Roofs are `Roof_RoundTiles_<span>x<length>`, and some aren't centred on their origin, so `kit(..., centre=true)` centres them from their bounding box. Each building is merged into one mesh per material (`mergeByMaterial`) to keep draw calls down.

## Architecture in one breath

`src/Game.js` is the orchestrator:
- **The land:**
  - `world/Terrain.js` computes heights once on a 2 m grid, with regions, the Vale rim and passes, lakes, and flats for towns and sites. `heightAt` interpolates exactly like the mesh triangles.
  - The ground mesh is 100 m chunks built nearest-first and hidden when far. `data/world.js` holds regions, lakes, roads and sites.
- **Collisions outdoors** go through `ColliderSet` (a spatial grid). Use `push()` and `remove()`. Colliders that move (NPCs, animals) must be marked `dynamic: true`.
- **Draw distance budget:**
  - Full trees within 110 m; tree impostors (a baked picture on crossed quads) beyond. Rocks to 230 m, undergrowth to 80 m.
  - Grass is a patch that follows the player. Towns are hidden past 380 m.
  - Towns merge their static meshes (`mergeStatic`). Anything that moves must go in its keep list.
  - Skinned meshes never frustum-cull, so NPCs, animals and enemies are hidden by distance in their update loops.
  - Point lights: two plaza lights shared by all towns, and a pool of six torch lights in dungeons. Never one light per thing.
- **Enemies outdoors** come from `Spawner`: 10-17 around the player, chosen by region, scaled by `level` (`scaledDef`), despawned beyond 240 m. Ruins spawn their own guards, and the dragon appears at Emberfall. `game.elite` is shown on the boss bar.
- **Modes:** `title → (slots) → create → intro → waking → play ⇄ dialogue | card | menu | paused | dead | transition`.
- **Spaces:** the player is always in one space, `game.space`: the outdoor `World`, an `Interior` (one per building, built lazily on first entry), a `Cave`, or a `Dungeon`. Caves and dungeons are `dark` and share the cave enemy list; `space.exitTo` is where a save made inside puts you. Every space exposes `scene`, `groundAt`, `collide`, `clamp`, `inWater`, `isSafe` (and `blocked` for enemies). `game.switchSpace()` moves the player mesh between scenes, and the engine renders `engine.activeScene`.
- **Interactions** carry a `space` id and only trigger in that space. NPCs are created per space: outdoor ones at startup, indoor ones with their interior.

Content is data in `src/data/*`:
- `world` (regions, lakes, roads, sites), `towns` (towns, caves, dungeons), `items`, `shops`, `quests`, `story`.
- `npcs` (the Vale's characters and residents, the Corvin tree) and `dialogue` (Oswin, Brenna, Tam, Pip).
- `frontier` (the five outer towns' people, shops and quest chains) and `talk` (dialogue helpers: `townTree`, `questDialogue`, `keeperTree`, `barkTree`).

A frontier NPC's `questChain` (`[[questId, afterQuestId], ...]`) drives the "!" over their head. Bounties (`systems/Bounties.js`) register generated quests into `QUESTS` at runtime and save their definitions; their `turnIn` is `'board'`.

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

- The player chooses a name, body type (masculine or feminine), outfit and look at the start. The name shows as `???` until the standing stones reveal it (end of Chapter I). Use "they" or second person for the player in text; don't assume a gender.
- **Chapter I:** wake in the meadow, find three memory shards (the first also brings back fire magic), meet **Oswin** at the campfire northeast of the spawn point, and touch the altar in the standing stones.
- **Chapter II:** the man in grey.
  - Tam gives you his old tower-stamped coin.
  - **Marisol** in Thornbury identifies it as coming from the Tower of Glass.
  - **Captain Hale** in Greywatch gives you the Vault key.
  - In the Sunken Vault you fight **Corvin, Warden of the Crossing**: your old teacher, who was following you, not hunting you.
  - The shards were pieces of a seal, now burned into you.
- **Open threads for Chapter III:**
  - Who wrote the torn letter (it warned against Corvin, maybe to isolate you).
  - What waits behind the stones and the Tower of Glass.
  - Hale's two missing soldiers.
- **Frontier side stories** point the same way. A **woman in white** from the Tower of Glass:
  - taught Morwen of Blackroot Crypt;
  - paid Rook the bandit king to watch the roads for "one who fell from the sky" (in his ledger);
  - paid Amberly in tower-stamped coins.

  The Barrow King's crown bears the tower's mark: the Tower is waking the dead.
- **Other characters:**
  - Millbrook: Brenna (smith), Tam (innkeeper, she/her) and Pip.
  - Ashford: Odo (outfitter) and Sister Maren (chapel).
  - Greywatch: Hale and Sera (armorer).
  - Thornbury: Bram (tavern) and Marisol (curios).

## Git

The remote is `https://github.com/Rali3d/Game1` on branch `main`. A GitHub token is saved in the macOS keychain, so `git push` works from this folder. `.claude/` is gitignored.
