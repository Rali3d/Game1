// What each merchant sells (unlimited stock) and which item types they'll buy from you.
// Tools and tomes are one-of-a-kind: they disappear from the list once you own or have read them.
import { FRONTIER_SHOPS } from './frontier.js';

export const SHOPS = {
  brenna: {
    name: "Brenna's Smithy",
    stock: ['iron_sword', 'steel_sword', 'battle_axe', 'war_spear', 'leather_armor'],
    buys: ['weapon', 'armor', 'material'],
  },
  tam: {
    name: 'The Fallen Star',
    stock: ['bread', 'stew', 'potion', 'lantern'],
    buys: ['consumable', 'material'],
  },
  odo: {
    name: "Odo's Provisions",
    stock: ['lantern', 'tent', 'bread', 'stew', 'potion', 'leather_armor', 'woodcutters_axe'],
    buys: 'all',
  },
  sera: {
    name: 'Greywatch Armory',
    stock: ['leather_armor', 'chainmail', 'war_spear', 'steel_sword', 'hunters_spear'],
    buys: ['weapon', 'armor'],
  },
  marisol: {
    name: "Marisol's Curios",
    stock: ['mana_potion', 'potion', 'tome_embers', 'ember_staff'],
    buys: 'all',
  },
  bram: {
    name: 'The Thorn & Thistle',
    stock: ['bread', 'stew', 'potion', 'mana_potion', 'tent'],
    buys: ['consumable', 'material'],
  },
  ...FRONTIER_SHOPS,
};
