// type: key | weapon | armor | consumable | material
export const ITEMS = {
  torn_letter: {
    name: 'Torn Letter', icon: '✉️', type: 'key',
    desc: 'A letter in handwriting you almost recognise. The bottom half is torn away.',
  },
  // Weapons: damage adds to attack, reach is the swing range, speed is seconds per swing.
  rusty_sword: {
    name: 'Rusty Sword', icon: '🗡️', type: 'weapon', model: 'sword', damage: 7, reach: 2.6, speed: 0.5,
    metal: 0xa39a8c, guard: 0x6d4a33,
    desc: 'Pitted with rust, but the edge still bites. It was waiting for you.',
  },
  iron_sword: {
    name: 'Iron Sword', icon: '⚔️', type: 'weapon', model: 'sword', damage: 13, reach: 2.7, speed: 0.46,
    metal: 0xd4d8dc, guard: 0xb08d3a, bladeLength: 1.0,
    desc: 'Good Millbrook iron, forged twelve years ago for a man who never came back for it.',
  },
  woodcutters_axe: {
    name: "Woodcutter's Axe", icon: '🪓', type: 'weapon', model: 'axe', damage: 17, reach: 2.4, speed: 0.66,
    metal: 0x7d7f82,
    desc: 'Heavy and slow, but it splits more than logs.',
  },
  hunters_spear: {
    name: "Hunter's Spear", icon: '🔱', type: 'weapon', model: 'spear', damage: 11, reach: 3.4, speed: 0.5,
    metal: 0xbfc3c7,
    desc: 'The longest reach of any weapon. Keep the wolves at arm\'s length, and then some.',
  },
  travelers_cloak: {
    name: "Traveler's Cloak", icon: '🧥', type: 'armor', defense: 4,
    desc: 'Stitched from wolf pelts by Oswin. Warm, and surprisingly tough.',
  },
  potion: {
    name: 'Healing Draught', icon: '🧪', type: 'consumable', heal: 50,
    desc: 'Restores 50 HP. Tastes of moss and honey.',
  },
  herb: {
    name: 'Moonpetal', icon: '🌸', type: 'consumable', heal: 12,
    desc: 'A pale flower that grows in the meadow. Restores 12 HP. Someone who knows herbs could brew three into a draught.',
  },
  slime_gel: {
    name: 'Slime Gel', icon: '🟢', type: 'material',
    desc: 'Wobbly. Faintly warm. Probably useless.',
  },
  wolf_pelt: {
    name: 'Wolf Pelt', icon: '🐺', type: 'material',
    desc: 'Thick grey fur. Oswin might want these.',
  },
};
