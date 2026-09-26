// type: key | weapon | armor | consumable | material | tool | tome
// value: price in coins at a shop (merchants buy things back for less). No value = can't be sold.
// Weapons: damage adds to attack, reach is the swing range, speed is seconds per swing, tint colours the model.
// Armour: defense, plus visual 'cape' (shows a cape) or 'body' (tints the tunic), with a tint colour.
export const ITEMS = {
  // ---- Story and keys ----
  torn_letter: {
    name: 'Torn Letter', icon: '✉️', type: 'key',
    desc: 'A letter in handwriting you almost recognise. The bottom half is torn away.',
  },
  old_coin: {
    name: 'Old Silver Coin', icon: '🪙', type: 'key',
    desc: "One of the man in grey's coins, from Tam. A tower is stamped on one side. Nobody in the valley has seen this mint.",
  },
  vault_key: {
    name: 'Vault Key', icon: '🗝️', type: 'key',
    desc: 'A heavy iron key from Captain Hale. It opens the gate of the Sunken Vault, north of Greywatch.',
  },

  // ---- Weapons ----
  rusty_sword: {
    name: 'Rusty Sword', icon: '🗡️', type: 'weapon', model: 'sword', damage: 7, reach: 2.6, speed: 0.5, value: 10,
    metal: 0xa39a8c, guard: 0x6d4a33, tint: 0x9a7a64,
    desc: 'Pitted with rust, but the edge still bites. It was waiting for you.',
  },
  iron_sword: {
    name: 'Iron Sword', icon: '⚔️', type: 'weapon', model: 'sword', damage: 13, reach: 2.7, speed: 0.46, value: 60,
    metal: 0xd4d8dc, guard: 0xb08d3a, bladeLength: 1.0, tint: 0xc9c9c9,
    desc: 'Good Millbrook iron, forged twelve years ago for a man who never came back for it.',
  },
  steel_sword: {
    name: 'Steel Longsword', icon: '⚔️', type: 'weapon', model: 'sword', damage: 19, reach: 2.9, speed: 0.46, value: 160,
    metal: 0xe8ecf0, guard: 0x3a3a44, bladeLength: 1.15, tint: 0xe6eeff,
    desc: "Brenna's best work. Balanced so well it feels lighter than it is.",
  },
  woodcutters_axe: {
    name: "Woodcutter's Axe", icon: '🪓', type: 'weapon', model: 'axe', damage: 17, reach: 2.4, speed: 0.66, value: 45,
    metal: 0x7d7f82, tint: 0xb4a894,
    desc: 'Heavy and slow, but it splits more than logs.',
  },
  battle_axe: {
    name: 'Battle Axe', icon: '🪓', type: 'weapon', model: 'axe', damage: 25, reach: 2.5, speed: 0.7, value: 190,
    metal: 0xc4c8cc,
    desc: 'A proper war axe. Every swing is a commitment.',
  },
  hunters_spear: {
    name: "Hunter's Spear", icon: '🔱', type: 'weapon', model: 'spear', damage: 11, reach: 3.4, speed: 0.5, value: 50,
    metal: 0xbfc3c7,
    desc: "Long reach. Keep the wolves at arm's length, and then some.",
  },
  war_spear: {
    name: 'Greywatch Pike', icon: '🔱', type: 'weapon', model: 'spear', damage: 16, reach: 3.8, speed: 0.52, value: 170,
    metal: 0xdfe3e7,
    desc: 'Issued to the Greywatch garrison. Nothing reaches further.',
  },
  ember_staff: {
    name: 'Ember Staff', icon: '🪄', type: 'weapon', model: 'staff', damage: 6, reach: 2.4, speed: 0.45, value: 140,
    metal: 0xff9a4a, spellPower: 10,
    desc: 'A weak club, but it feeds your fire: +10 fireball damage.',
  },

  // ---- Armour ----
  leather_armor: {
    name: 'Leather Jerkin', icon: '🦺', type: 'armor', defense: 3, visual: 'body', tint: 0x6b4a2e, value: 70,
    desc: 'Boiled leather over padding. It stops the worst of a slime.',
  },
  travelers_cloak: {
    name: "Traveler's Cloak", icon: '🧥', type: 'armor', defense: 4, visual: 'cape', tint: 0x6e3b2c, value: 90,
    desc: 'Stitched from wolf pelts by Oswin. Warm, and surprisingly tough.',
  },
  chainmail: {
    name: 'Chainmail Shirt', icon: '🛡️', type: 'armor', defense: 7, visual: 'body', tint: 0x8a8f96, value: 200,
    desc: 'Heavy, noisy, and worth every ring.',
  },
  grey_coat: {
    name: "Warden's Grey Coat", icon: '🧥', type: 'armor', defense: 10, visual: 'cape', tint: 0x6f7378,
    desc: 'Corvin left it behind. It is warmer than it should be, and it never gets muddy.',
  },

  // ---- Consumables ----
  potion: {
    name: 'Healing Draught', icon: '🧪', type: 'consumable', heal: 50, value: 25,
    desc: 'Restores 50 HP. Tastes of moss and honey.',
  },
  mana_potion: {
    name: 'Ember Tonic', icon: '🔮', type: 'consumable', mana: 40, value: 30,
    desc: 'Restores 40 mana. Warm going down. Very warm.',
  },
  stew: {
    name: 'Bowl of Stew', icon: '🍲', type: 'consumable', heal: 30, value: 10,
    desc: 'Restores 30 HP. Probably moonpetal. Probably.',
  },
  bread: {
    name: 'Loaf of Bread', icon: '🍞', type: 'consumable', heal: 15, value: 4,
    desc: 'Restores 15 HP.',
  },
  herb: {
    name: 'Moonpetal', icon: '🌸', type: 'consumable', heal: 12, value: 4,
    desc: 'A pale flower that grows in the meadow. Restores 12 HP. Someone who knows herbs could brew three into a draught.',
  },

  // ---- Tools and tomes ----
  lantern: {
    name: 'Lantern', icon: '🏮', type: 'tool', value: 35,
    desc: 'Press L to light or douse it. Caves are very dark.',
  },
  tent: {
    name: 'Travel Tent', icon: '⛺', type: 'tool', value: 80,
    desc: 'Press T (or use it here) to pitch it. Rest inside, then pack it up again.',
  },
  tome_embers: {
    name: 'Tome of Embers', icon: '📕', type: 'tome', value: 150,
    desc: 'Reading it makes your fireballs hotter: +8 damage, permanently.',
  },

  // ---- Materials ----
  slime_gel: { name: 'Slime Gel', icon: '🟢', type: 'material', value: 3, desc: 'Wobbly. Faintly warm. Probably useless.' },
  wolf_pelt: { name: 'Wolf Pelt', icon: '🐺', type: 'material', value: 12, desc: 'Thick grey fur. Oswin might want these.' },
  bat_wing: { name: 'Bat Wing', icon: '🦇', type: 'material', value: 5, desc: 'Leathery. Marisol buys these for reasons she won\'t explain.' },
  bone: { name: 'Old Bone', icon: '🦴', type: 'material', value: 4, desc: 'From something that walked when it shouldn\'t have.' },
  cave_crystal: { name: 'Cave Crystal', icon: '💎', type: 'material', value: 22, desc: 'It glows faintly, even in your pocket.' },
};

export const sellPrice = (id) => Math.max(1, Math.floor((ITEMS[id]?.value ?? 0) * 0.4));
