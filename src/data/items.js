// type: key | weapon | armor | consumable | material | tool | tome
// value: price in coins at a shop (merchants buy things back for less). No value = can't be sold.
// Weapons: damage adds to attack, reach is the swing range, speed is seconds per swing, tint colours the model.
//   `mesh` uses a model from the medieval weapons pack, scaled to `length` metres.
// Armour: defense, plus visual 'body' (tints the tunic); cloaks have no visual, with a tint colour.
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
  dragon_heart: {
    name: "Emberwing's Heart", icon: '❤️‍🔥', type: 'key',
    desc: 'Still warm. Still, somehow, beating slowly.',
  },
  kings_crown: {
    name: "The Barrow King's Crown", icon: '👑', type: 'key',
    desc: 'Tarnished gold, and heavier than it looks. Warden Ilsa in Oldgate will want to see this.',
  },
  crypt_sigil: {
    name: 'Crypt Sigil', icon: '🔰', type: 'key',
    desc: "Morwen's seal. The mark of the Tower of Glass is scratched on the back.",
  },
  rooks_ledger: {
    name: "Rook's Ledger", icon: '📒', type: 'key',
    desc: 'Every job the bandit king ever took, and who paid for it. One page names a man in grey.',
  },
  chapel_bell: {
    name: 'Silver Hand Bell', icon: '🔔', type: 'key',
    desc: "Stillwater chapel's lost bell. It's been under water for twelve years and it still rings true.",
  },
  parcel: {
    name: 'Sealed Parcel', icon: '📦', type: 'key',
    desc: 'A delivery from one town to another. Please do not shake.',
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
    metal: 0xd4d8dc, guard: 0xb08d3a, bladeLength: 1.0, tint: 0xd8d8dc, desaturate: 0.85,
    desc: 'Good Millbrook iron, forged twelve years ago for a man who never came back for it.',
  },
  steel_sword: {
    name: 'Steel Longsword', icon: '⚔️', type: 'weapon', model: 'sword', damage: 19, reach: 2.9, speed: 0.46, value: 160,
    metal: 0xe8ecf0, guard: 0x3a3a44, bladeLength: 1.15, tint: 0xeef4ff, desaturate: 0.95,
    desc: "Brenna's best work. Balanced so well it feels lighter than it is.",
  },
  woodcutters_axe: {
    name: "Woodcutter's Axe", icon: '🪓', type: 'weapon', model: 'axe', damage: 17, reach: 2.4, speed: 0.66, value: 45,
    metal: 0x7d7f82, tint: 0xc4bcae, desaturate: 0.6,
    desc: 'Heavy and slow, but it splits more than logs.',
  },
  battle_axe: {
    name: 'Battle Axe', icon: '🪓', type: 'weapon', model: 'axe', damage: 25, reach: 2.5, speed: 0.7, value: 190,
    metal: 0xc4c8cc, tint: 0xe0e4ea, desaturate: 0.9,
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
  dagger: {
    name: "Rogue's Dagger", icon: '🗡️', type: 'weapon', model: 'sword', mesh: 'weapons/Dagger', length: 0.6, damage: 11, reach: 2.2, speed: 0.34, value: 45,
    desc: 'Short, quick, and quiet. A bandit favourite.',
  },
  knight_sword: {
    name: "Knight's Sword", icon: '⚔️', type: 'weapon', model: 'sword', mesh: 'weapons/Sword_2', length: 1.15, damage: 23, reach: 2.9, speed: 0.45, value: 260,
    desc: 'Forged in Frosthold for the old kingdom\'s knights. Cold to the touch, even in summer.',
  },
  greatsword: {
    name: 'Oldgate Greatsword', icon: '⚔️', type: 'weapon', model: 'sword', mesh: 'weapons/Sword_Big', length: 1.45, damage: 30, reach: 3.1, speed: 0.6, value: 340,
    desc: 'Two hands, one purpose. Pulled from the ruins of the old kingdom and re-edged in Oldgate.',
  },
  claymore: {
    name: 'Blackroot Claymore', icon: '⚔️', type: 'weapon', model: 'sword', mesh: 'weapons/Claymore', length: 1.55, damage: 33, reach: 3.2, speed: 0.62, value: 380,
    desc: 'A red-hilted greatsword from the crypt. It hums when it tastes blood. Let\'s not think about that.',
  },
  sword_golden: {
    name: 'Sunblade', icon: '🌟', type: 'weapon', model: 'sword', mesh: 'weapons/Sword_Golden', length: 1.25, damage: 38, reach: 3.0, speed: 0.44, value: 600,
    desc: 'The Barrow King\'s sword. Gold over steel, and it never dulls.',
  },
  double_axe: {
    name: 'Frostbiter', icon: '🪓', type: 'weapon', model: 'axe', mesh: 'weapons/Axe_Double', length: 1.3, damage: 29, reach: 2.6, speed: 0.72, value: 300,
    desc: 'A miner\'s double-bitted axe, balanced for war.',
  },
  war_hammer: {
    name: 'Warhammer', icon: '🔨', type: 'weapon', model: 'axe', mesh: 'weapons/Hammer_Double', length: 1.2, damage: 35, reach: 2.5, speed: 0.82, value: 360,
    desc: 'Rook\'s hammer. Slow as a wagon, hits like one.',
  },
  scythe: {
    name: "Reaper's Scythe", icon: '🌙', type: 'weapon', model: 'spear', mesh: 'weapons/Scythe', length: 1.8, damage: 27, reach: 3.6, speed: 0.6, value: 320,
    desc: 'Old Wick swears it was only ever used for barley.',
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
    name: "Traveler's Cloak", icon: '🧥', type: 'armor', defense: 4, value: 90,
    desc: 'Stitched from wolf pelts by Oswin. Warm, and surprisingly tough.',
  },
  chainmail: {
    name: 'Chainmail Shirt', icon: '🛡️', type: 'armor', defense: 7, visual: 'body', tint: 0x8a8f96, value: 200,
    desc: 'Heavy, noisy, and worth every ring.',
  },
  scale_mail: {
    name: 'Scale Mail', icon: '🛡️', type: 'armor', defense: 11, visual: 'body', tint: 0x6a7a6a, value: 420,
    desc: 'Overlapping steel scales from the Frosthold forge.',
  },
  fen_cloak: {
    name: 'Fenwalker Cloak', icon: '🧥', type: 'armor', defense: 8, value: 240,
    desc: 'Oiled and waxed against the marsh damp. Smells of bog. You get used to it.',
  },
  dragon_mail: {
    name: 'Dragonscale Mail', icon: '🐉', type: 'armor', defense: 18, visual: 'body', tint: 0x8a2a1a, value: 1200,
    desc: 'Forged by Dagny from Emberwing\'s scales. Warm, light, and nearly impossible to cut.',
  },
  grey_coat: {
    name: "Warden's Grey Coat", icon: '🧥', type: 'armor', defense: 10,
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
  greater_potion: {
    name: 'Greater Draught', icon: '⚗️', type: 'consumable', heal: 100, value: 70,
    desc: 'Restores 100 HP. Old Wick\'s recipe. Do not ask what is in it.',
  },
  raw_meat: {
    name: 'Raw Meat', icon: '🥩', type: 'consumable', heal: 6, value: 3,
    desc: 'Restores 6 HP, and possibly your regret. Cook it at a campfire first.',
  },
  cooked_meat: {
    name: 'Roast Meat', icon: '🍖', type: 'consumable', heal: 35, value: 12,
    desc: 'Restores 35 HP. Charred on the outside, perfect in the middle.',
  },
  cider: {
    name: 'Amberly Cider', icon: '🍺', type: 'consumable', heal: 20, value: 8,
    desc: 'Restores 20 HP. Sweet, sharp, and stronger than it tastes.',
  },
  smoked_fish: {
    name: 'Smoked Fish', icon: '🐟', type: 'consumable', heal: 28, value: 9,
    desc: 'Restores 28 HP. A Stillwater speciality.',
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
  wool: { name: 'Wool', icon: '🧶', type: 'material', value: 6, desc: 'Soft and warm. Weavers and tailors buy it.' },
  hide: { name: 'Hide', icon: '🟫', type: 'material', value: 9, desc: 'A rough hide. Leatherworkers pay well for good ones.' },
  bandit_badge: { name: "Bandit's Token", icon: '🎴', type: 'material', value: 8, desc: 'A crow stamped on tin. Rook\'s gang all carry one. Oldgate pays a bounty for them.' },
  dragon_scale: { name: 'Dragon Scale', icon: '🔶', type: 'material', value: 150, desc: 'Hot to the touch, days after it was shed. A smith could make something of these.' },
  iron_ore: { name: 'Iron Ore', icon: '🪨', type: 'material', value: 7, desc: 'Rusty-red rock from the Frostdeep Mine.' },
  cave_crystal: { name: 'Cave Crystal', icon: '💎', type: 'material', value: 22, desc: 'It glows faintly, even in your pocket.' },
};

export const sellPrice = (id) => Math.max(1, Math.floor((ITEMS[id]?.value ?? 0) * 0.4));
