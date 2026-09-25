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
    next: ['echoes'],
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
    rewards: { xp: 120 },
  },
  slimes: {
    title: 'A Sticky Situation',
    summary: 'Oswin wants the meadow slimes thinned out before they reach his fire.',
    turnIn: 'wanderer', turnInName: 'Oswin',
    objectives: [{ text: 'Defeat meadow slimes', counter: 'kill:slime', count: 5, fromStart: true }],
    rewards: { xp: 50, items: { potion: 2 } },
  },
  pelts: {
    title: 'Pelts for the Road',
    summary: "Oswin will stitch you a proper cloak if you bring him three wolf pelts from the pinewoods beyond the meadow.",
    turnIn: 'wanderer', turnInName: 'Oswin',
    objectives: [{ text: 'Collect wolf pelts', counter: 'item:wolf_pelt', count: 3 }],
    rewards: { xp: 90, take: { wolf_pelt: 3 }, items: { travelers_cloak: 1 } },
  },
};
