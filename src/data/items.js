// type: key | weapon | armor | consumable | material
export const ITEMS = {
  torn_letter: {
    name: 'Torn Letter', icon: '✉️', type: 'key',
    desc: 'A letter in handwriting you almost recognise. The bottom half is torn away.',
  },
  rusty_sword: {
    name: 'Rusty Sword', icon: '🗡️', type: 'weapon', damage: 7,
    desc: 'Pitted with rust, but the edge still bites. It was waiting for you.',
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
