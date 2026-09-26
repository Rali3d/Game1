import { QUESTS } from '../data/quests.js';
import { ITEMS } from '../data/items.js';
import { TOWNS, CAVES, DUNGEONS } from '../data/towns.js';
import { REGIONS, SITES } from '../data/world.js';
import { ENEMY_TYPES } from '../entities/Enemy.js';
import { mulberry32 } from '../engine/noise.js';

// Notice boards: every town posts three odd jobs a day. Accepted jobs become ordinary quests (registered in
// QUESTS at runtime and kept in the save), handed in at any notice board.
const MAX_ACTIVE = 3;
const GATHER = ['wool', 'hide', 'wolf_pelt', 'slime_gel', 'bat_wing', 'bone', 'cave_crystal', 'iron_ore', 'herb', 'raw_meat'];
const PLURAL = { wolf: 'wolves', puglin: 'puglins', imp: 'imps', slime: 'slimes', bat: 'bats', skeleton: 'skeletons', bandit: 'bandits' };
const NAMES = { wolf: 'wolves', puglin: 'Puglins', imp: 'imps', slime: 'slimes', bat: 'bats', skeleton: 'restless dead', bandit: 'bandits' };
const POSTERS = ['the town council', 'a worried farmer', 'the merchants\' guild', 'an anonymous well-wisher', 'the innkeeper', 'a nervous shepherd'];

export class Bounties {
  constructor(game) {
    this.g = game;
    this.defs = {}; // accepted bounties: id -> quest def
    this.taken = new Set(); // offer ids already accepted
  }

  // Today's offers on a town's board (the same all day, different tomorrow).
  offers(townId) {
    const g = this.g;
    const town = TOWNS.find((t) => t.id === townId);
    const region = REGIONS[town.region ?? 'vale'];
    const level = region.level;
    const rng = mulberry32(townId.length * 7919 + g.day * 104729 + townId.charCodeAt(0));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const out = [];
    const kinds = ['hunt', 'gather', 'deliver', 'scout'];
    for (let n = 0; n < 3; n++) {
      const id = `bounty:${townId}:${g.day}:${n}`;
      const kind = kinds[(Math.floor(rng() * 4) + n) % 4];
      const poster = pick(POSTERS);
      let def;
      if (kind === 'hunt') {
        const pool = Object.keys(region.enemies ?? { slime: 1, wolf: 1, puglin: 1 }).filter((t) => ENEMY_TYPES[t]);
        const type = pick(pool);
        const count = 4 + Math.floor(rng() * 4);
        def = {
          title: `Cull the ${NAMES[type] ?? type}`,
          summary: `Posted by ${poster} in ${town.name}: ${NAMES[type] ?? type} have been troubling the roads. Put down ${count} of them, then report to any notice board.`,
          objectives: [{ text: `Defeat ${PLURAL[type] ?? type}`, counter: `kill:${type}`, count, fromStart: true }],
          rewards: { xp: 22 * count * level, coins: 12 * count * level },
        };
      } else if (kind === 'gather') {
        const item = pick(GATHER);
        const count = 3 + Math.floor(rng() * 4);
        def = {
          title: `Wanted: ${ITEMS[item].name}`,
          summary: `Posted by ${poster} in ${town.name}: will pay well for ${count} × ${ITEMS[item].name.toLowerCase()}. Bring them to any notice board.`,
          objectives: [{ text: `${ITEMS[item].name}`, counter: `item:${item}`, count }],
          rewards: { xp: 15 * count * level, coins: Math.round(Math.max(4, ITEMS[item].value) * count * 2.2), take: { [item]: count } },
        };
      } else if (kind === 'deliver') {
        const others = TOWNS.filter((t) => t.id !== townId);
        const to = pick(others);
        const dist = Math.hypot(to.x - town.x, to.z - town.z);
        def = {
          title: `A parcel for ${to.name}`,
          summary: `Posted by ${poster} in ${town.name}: carry a sealed parcel to the notice board in ${to.name}. Don't open it.`,
          objectives: [{ text: `Deliver the parcel to ${to.name}'s notice board`, counter: `deliver:${id}`, count: 1 }],
          rewards: { xp: Math.round(dist * 0.6), coins: Math.round(20 + dist * 0.35) },
          deliverTo: to.id, givesParcel: true,
        };
      } else {
        const places = [...CAVES.map((c) => ({ id: c.id, name: c.name })), ...DUNGEONS.map((d) => ({ id: d.id, name: d.name })),
          ...SITES.map((s) => ({ id: s.id, name: s.name }))].filter((p) => !g.flags[`found_${p.id}`]);
        if (!places.length) continue;
        const place = pick(places);
        def = {
          title: `Scout ${place.name}`,
          summary: `Posted by ${poster} in ${town.name}: somebody needs to find ${place.name} and report back on it. Your map will help once you're close.`,
          objectives: [{ text: `Find ${place.name}`, counter: `visit:${place.id}`, count: 1 }],
          rewards: { xp: 120 * level, coins: 40 * level },
          scout: place.id,
        };
      }
      out.push({ id, ...def, turnIn: 'board', turnInName: 'any notice board', bounty: true });
    }
    return out;
  }

  get active() {
    return Object.keys(this.defs).filter((id) => ['active', 'ready'].includes(this.g.quests.status(id)));
  }

  accept(offer) {
    const g = this.g;
    if (this.active.length >= MAX_ACTIVE) return g.hud.toast(`You can only take ${MAX_ACTIVE} jobs at a time.`, 'warn');
    this.defs[offer.id] = offer;
    QUESTS[offer.id] = offer;
    this.taken.add(offer.id);
    if (offer.givesParcel) g.giveItem('parcel');
    g.quests.start(offer.id);
  }

  // At a board: finish deliveries addressed here, then hand in anything that's ready.
  visitBoard(townId) {
    const g = this.g;
    for (const id of this.active) {
      const d = this.defs[id];
      if (d.deliverTo === townId && g.quests.isActive(id) && g.inventory.has('parcel')) {
        g.inventory.remove('parcel');
        g.bump(`deliver:${id}`);
      }
    }
    for (const id of g.quests.readyFor('board')) g.quests.complete(id);
  }

  serialize() {
    return { defs: this.defs, taken: [...this.taken] };
  }

  load(data) {
    this.defs = data?.defs ?? {};
    this.taken = new Set(data?.taken ?? []);
    Object.assign(QUESTS, this.defs);
  }
}
