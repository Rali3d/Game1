import { FRONTIER_QUESTS } from './frontier.js';

// Quests are data. Each objective watches a counter:
//   'item:<id>'  -> how many of that item the player holds
//   anything else -> game.counters[name], bumped by gameplay (e.g. 'kill:slime', 'shard', 'distance')
// fromStart: only count progress made after the quest began.
// turnIn: the quest waits in 'ready' until the player talks to that NPC.
export const QUESTS = {
  awakening: {
    title: 'Waking in the Field',
    summary: "You woke in a meadow with no memory of how you got here. Maybe there's a clue nearby.",
    objectives: [
      { text: 'Get up and look around', counter: 'distance', count: 12 },
      { text: 'Search the grass for anything familiar', counter: 'item:torn_letter', count: 1 },
    ],
    rewards: { xp: 15 },
    next: ['echoes', 'millbrook'],
  },
  echoes: {
    title: 'Echoes',
    summary: 'The torn letter speaks of a crossing, and of forgetting. Blue lights fell into the meadow with you. Pieces of you, perhaps.',
    objectives: [
      { text: 'Collect the glowing memory shards', counter: 'shard', count: 3 },
      { text: 'Find whoever lit the campfire to the northeast', counter: 'talk:wanderer', count: 1 },
    ],
    rewards: { xp: 60 },
    next: ['stones'],
  },
  stones: {
    title: 'The Circle on the Hill',
    summary: 'Every memory points to the standing stones on the north hill.',
    objectives: [{ text: 'Touch the altar within the standing stones (north)', counter: 'touch:stones', count: 1 }],
    rewards: { xp: 120, coins: 30 },
    next: ['grey1'],
  },

  // ---- Chapter II: The Man in Grey ----
  grey1: {
    title: 'The Man in Grey',
    summary: 'The torn letter warned against a man in grey, and now half the valley has seen him asking after you. Tam at the Fallen Star sees everyone who passes through Millbrook.',
    objectives: [{ text: 'Ask Tam in Millbrook about the man in grey', counter: 'clue:tam', count: 1 }],
    rewards: { xp: 40 },
    next: ['grey2'],
  },
  grey2: {
    title: 'A Coin from Nowhere',
    summary: "The man in grey paid Tam with a coin stamped with a tower. A curio dealer in Thornbury might know where it's from.",
    objectives: [{ text: 'Show the old coin to the curio dealer in Thornbury (southeast)', counter: 'clue:marisol', count: 1 }],
    rewards: { xp: 60 },
    next: ['grey3'],
  },
  grey3: {
    title: 'The Garrison',
    summary: 'The coin comes from the Tower of Glass. The man in grey bought a map of the Sunken Vault, and the Vault belongs to the garrison at Greywatch.',
    objectives: [{ text: 'Speak with Captain Hale in the Greywatch tower (northwest)', counter: 'talk:hale', count: 1 }],
    rewards: { xp: 60 },
    next: ['grey4'],
  },
  grey4: {
    title: 'The Sunken Vault',
    summary: "Captain Hale gave you the key to the Sunken Vault, north of Greywatch. The man in grey is somewhere in the dark below, and so are Hale's missing men.",
    objectives: [{ text: 'Confront the man in grey in the Sunken Vault', counter: 'defeat:warden', count: 1 }],
    rewards: { xp: 300, coins: 150, items: { grey_coat: 1 } },
  },
  bones: {
    title: 'Restless Bones',
    summary: 'Captain Hale will pay to have the walking dead in the caves put back to rest.',
    turnIn: 'hale', turnInName: 'Captain Hale',
    objectives: [{ text: 'Defeat skeletons in the caves', counter: 'kill:skeleton', count: 5, fromStart: true }],
    rewards: { xp: 150, coins: 90 },
  },
  millbrook: {
    title: 'The Village to the South',
    summary: 'Smoke rises beyond the meadow to the south. Where there is smoke, there are people, and maybe answers.',
    objectives: [{ text: 'Follow the dirt path south to the village', counter: 'reach:town', count: 1 }],
    rewards: { xp: 20 },
  },
  petals: {
    title: 'Petals for the Pot',
    summary: "Tam, the innkeeper at the Fallen Star, needs moonpetals for her famous stew.",
    turnIn: 'tam', turnInName: 'Tam',
    objectives: [{ text: 'Gather moonpetals from the meadow', counter: 'item:herb', count: 5 }],
    rewards: { xp: 60, coins: 20, take: { herb: 5 }, items: { potion: 2 } },
  },
  slimes: {
    title: 'A Sticky Situation',
    summary: 'Oswin wants the meadow slimes thinned out before they reach his fire.',
    turnIn: 'wanderer', turnInName: 'Oswin',
    objectives: [{ text: 'Defeat meadow slimes', counter: 'kill:slime', count: 5, fromStart: true }],
    rewards: { xp: 50, coins: 15, items: { potion: 2 } },
  },
  pelts: {
    title: 'Pelts for the Road',
    summary: "Oswin will stitch you a proper cloak if you bring him three wolf pelts from the pinewoods beyond the meadow.",
    turnIn: 'wanderer', turnInName: 'Oswin',
    objectives: [{ text: 'Collect wolf pelts', counter: 'item:wolf_pelt', count: 3 }],
    rewards: { xp: 90, take: { wolf_pelt: 3 }, items: { travelers_cloak: 1 } },
  },
  ...FRONTIER_QUESTS,
};
