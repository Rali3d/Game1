// Towns are data: where they are, and what stands around each town square.
// Buildings sit on a ring around the centre, placed by angle (deg, where 0 = east and -90 = north) and radius R,
// always facing the centre. `entrance` is the angle the road comes in from and is kept clear.
//
// Enterable building kinds (each gets an interior): house, inn, shop, chapel, tower, hall, windmill.
// Open structures: smithy, sawmill. `npc` puts a named character inside; `resident` a townsperson with small talk.
export const TOWNS = [
  {
    id: 'millbrook', name: 'Millbrook', subtitle: 'A quiet village at the edge of the meadow',
    x: -8, z: 72, r: 28, entrance: -90,
    walls: [0xe8dcc0, 0xd9c7a0, 0xe3d2b8, 0xcdbb98], roofs: [0x8a3b2a, 0x5d4a3a, 0x6b6f47, 0x7a3030],
    buildings: [
      { kind: 'house', deg: -5, R: 17, w: 6, d: 5, h: 3.0, resident: 'gil' },
      { kind: 'house', deg: 35, R: 16.5, w: 5, d: 4.6, h: 2.8, resident: 'nan' },
      { kind: 'inn', deg: 90, R: 18.5, w: 9.5, d: 6.5, h: 4.4, sign: 'The Fallen Star', npc: 'tam' },
      { kind: 'house', deg: 137, R: 17, w: 5.5, d: 5, h: 3.0, resident: 'hester' },
      { kind: 'house', deg: 177, R: 17.5, w: 6.5, d: 5, h: 3.2 },
      { kind: 'smithy', deg: -40, R: 15, sign: 'Smithy' },
      { kind: 'windmill', deg: 215, R: 25 },
    ],
    well: true, stalls: [{ x: -7, z: 4, ry: Math.PI / 2 + 0.3 }],
    lamps: [-65, -115, 20, 160, 65, 115],
    fences: [[-17, -8, 8, 0.5], [16, 8, 7, -0.6], [-12, 19, 6, 1.1]],
    hay: [[-14, 10], [-15.5, 11.5], [12, -2]],
  },
  {
    id: 'ashford', name: 'Ashford', subtitle: 'Woodcutters, a chapel, and the smell of sawdust',
    x: 118, z: -22, r: 26, entrance: 180,
    walls: [0x8a6a48, 0x9a7a55, 0x7d6040], roofs: [0x4d5a3a, 0x5d4a3a, 0x3f4a33],
    buildings: [
      { kind: 'shop', deg: -85, R: 15, w: 7, d: 5.5, h: 3.2, sign: "Odo's Provisions", npc: 'odo' },
      { kind: 'chapel', deg: 0, R: 17, w: 5.5, d: 8.5, h: 4.4, npc: 'maren' },
      { kind: 'house', deg: -135, R: 16, w: 5.5, d: 4.8, h: 2.9, resident: 'ansel' },
      { kind: 'house', deg: 60, R: 16, w: 6, d: 5, h: 3.0, resident: 'lise' },
      { kind: 'house', deg: 115, R: 16.5, w: 5, d: 4.5, h: 2.8 },
      { kind: 'sawmill', deg: -35, R: 17 },
    ],
    well: true, lamps: [-60, 30, 90, 140, -120],
    fences: [[-6, 18, 8, 0.2], [18, -12, 7, 1.2]],
    logs: [[8, -6], [-10, 8]],
  },
  {
    id: 'greywatch', name: 'Greywatch', subtitle: 'The garrison that watches the northern hills', style: 'brick', roofTint: 0x9aa0a8,
    x: -95, z: -105, r: 26, entrance: -12,
    walls: [0x9a968c, 0x8c887e, 0xa8a398], roofs: [0x4a5058, 0x3f454c, 0x555a60],
    buildings: [
      { kind: 'tower', deg: 168, R: 13, w: 5, d: 5, h: 9, npc: 'hale' },
      { kind: 'shop', deg: -75, R: 15, w: 7, d: 5.5, h: 3.2, sign: 'Greywatch Armory', npc: 'sera' },
      { kind: 'hall', deg: 75, R: 15, w: 9, d: 6, h: 3.4, sign: 'Barracks', resident: 'soldier' },
      { kind: 'house', deg: 125, R: 16, w: 5, d: 4.6, h: 2.8, resident: 'widow' },
      { kind: 'house', deg: -128, R: 16, w: 5.5, d: 4.8, h: 2.9 },
    ],
    well: true, palisade: 23, gates: [-81, 172], lamps: [-40, 30, 120, -150, 210],
    dummies: [[6, 8], [8.5, 9.5], [4, 10.5]],
  },
  {
    id: 'thornbury', name: 'Thornbury', subtitle: 'A market town, and a curio shop full of secrets',
    x: 85, z: 115, r: 27, entrance: 205,
    walls: [0xc98f70, 0xd8b890, 0xc7a27c], roofs: [0x3f5a6b, 0x6b3f3a, 0x46586b],
    buildings: [
      { kind: 'inn', deg: 25, R: 18, w: 9, d: 6.5, h: 4.3, sign: 'The Thorn & Thistle', npc: 'bram' },
      { kind: 'shop', deg: -40, R: 16, w: 6.5, d: 5.5, h: 3.4, sign: "Marisol's Curios", npc: 'marisol' },
      { kind: 'house', deg: 80, R: 16, w: 5.5, d: 5, h: 3.0, resident: 'tobin' },
      { kind: 'house', deg: 130, R: 16.5, w: 6, d: 5, h: 3.1 },
      { kind: 'house', deg: -95, R: 16, w: 5, d: 4.6, h: 2.9, resident: 'wilma' },
    ],
    fountain: true, lamps: [-70, 0, 55, 105, 160, -135],
    stalls: [{ x: -6, z: -5, ry: 0.9 }, { x: 6, z: 6, ry: -2.3 }],
    hay: [[12, -8]],
  },

  // ---- Beyond the Vale ----
  {
    id: 'frosthold', name: 'Frosthold', subtitle: 'A mining town under the northern peaks', style: 'brick', region: 'frost', roofTint: 0x8a9aae,
    x: 20, z: -440, r: 28, entrance: 112,
    walls: [0xb8b4aa, 0xa8a49a, 0xc4c0b6], roofs: [0x3f454c, 0x4a4f55, 0x5a5048],
    buildings: [
      { kind: 'inn', deg: 60, R: 18, w: 9, d: 6.5, h: 4.4, sign: 'The Cold Hearth', npc: 'ysolde' },
      { kind: 'shop', deg: -40, R: 16, w: 7, d: 5.5, h: 3.2, sign: 'Frosthold Forge', npc: 'dagny' },
      { kind: 'hall', deg: -100, R: 16, w: 9, d: 6, h: 3.4, sign: "Miners' Hall", npc: 'brask' },
      { kind: 'house', deg: 145, R: 16.5, w: 5.5, d: 5, h: 3.0, resident: 'orla' },
      { kind: 'house', deg: -150, R: 16, w: 5, d: 4.6, h: 2.8, resident: 'teodor' },
    ],
    well: true, lamps: [-70, 0, 90, 130, -130, 200],
    logs: [[9, 6]],
  },
  {
    id: 'amberly', name: 'Amberly', subtitle: 'Orchards, cider, and a great deal of gossip', region: 'amber', plasterTint: 0xfff0d0,
    x: 430, z: -30, r: 27, entrance: 187,
    walls: [0xe6d2a8, 0xd8c090, 0xe8dcc0], roofs: [0x9a4a2a, 0x8a5a2a, 0x7a3a2a],
    buildings: [
      { kind: 'inn', deg: 130, R: 18, w: 9.5, d: 6.5, h: 4.4, sign: 'The Golden Press', npc: 'marta' },
      { kind: 'shop', deg: -10, R: 16, w: 7, d: 5.5, h: 3.2, sign: 'Orchard Goods', npc: 'pell' },
      { kind: 'windmill', deg: -45, R: 24 },
      { kind: 'house', deg: -150, R: 16.5, w: 6, d: 5, h: 3.0, resident: 'hobart' },
      { kind: 'house', deg: 40, R: 16, w: 5.5, d: 4.8, h: 2.9, resident: 'rosalind' },
    ],
    well: true, stalls: [{ x: 6, z: -6, ry: -0.8 }, { x: -7, z: 3, ry: 1.9 }],
    lamps: [-70, 0, 60, 110, 160, -130],
    hay: [[-12, -10], [13, 9]],
  },
  {
    id: 'stillwater', name: 'Stillwater', subtitle: 'Fishing boats, herons, and the long grey lake', region: 'lake', roofTint: 0x7a9ac0, plasterTint: 0xe8f0f4,
    x: 270, z: 260, r: 26, entrance: 207,
    walls: [0xd8d8d0, 0xc8ccc4, 0xe0dcd0], roofs: [0x3f5a6b, 0x46586b, 0x5a6a6b],
    buildings: [
      { kind: 'inn', deg: 160, R: 18, w: 9, d: 6.5, h: 4.3, sign: 'The Heron', npc: 'finn' },
      { kind: 'shop', deg: 60, R: 16, w: 6.5, d: 5.5, h: 3.2, sign: "Nella's Wharf", npc: 'nella' },
      { kind: 'chapel', deg: -150, R: 17, w: 5.5, d: 8.5, h: 4.4, npc: 'aldo' },
      { kind: 'house', deg: 22, R: 16, w: 5.5, d: 5, h: 3.0, resident: 'petra' },
      { kind: 'house', deg: -70, R: 16, w: 5, d: 4.6, h: 2.9, resident: 'ewan' },
    ],
    fountain: true, lamps: [-100, -30, 40, 90, 130, 240],
    fences: [[14, 12, 8, -0.8]],
  },
  {
    id: 'fenwick', name: 'Fenwick', subtitle: 'A damp village on the edge of the Mirefen', region: 'fen', roofTint: 0x8a9a6a, plasterTint: 0xc8bca0,
    x: -20, z: 430, r: 24, entrance: -81,
    walls: [0x8a7a5a, 0x7a6a4a, 0x9a8a6a], roofs: [0x5a5a3a, 0x4a4a30, 0x6b5a3a],
    buildings: [
      { kind: 'inn', deg: 60, R: 16.5, w: 8.5, d: 6, h: 4.2, sign: 'The Sodden Boot', npc: 'gorm' },
      { kind: 'shop', deg: 130, R: 15, w: 6, d: 5, h: 3.2, sign: "Old Wick's Remedies", npc: 'wick' },
      { kind: 'house', deg: -140, R: 15, w: 5, d: 4.6, h: 2.8, resident: 'mags' },
      { kind: 'house', deg: -40, R: 15.5, w: 5.5, d: 4.8, h: 2.9, resident: 'jory' },
    ],
    lamps: [-110, 0, 95, 160, -170],
    fences: [[-10, 12, 7, 0.4]],
  },
  {
    id: 'oldgate', name: 'Oldgate', subtitle: 'The last town before the ruins of the old kingdom', style: 'brick', region: 'sunder', roofTint: 0xb08a6a,
    x: -440, z: -20, r: 28, entrance: -11,
    walls: [0xa89a80, 0x9a8c72, 0xb4a68a], roofs: [0x5a3a2a, 0x4a3a30, 0x6b4a3a],
    buildings: [
      { kind: 'tower', deg: 170, R: 13, w: 5, d: 5, h: 9, npc: 'ilsa' },
      { kind: 'inn', deg: 115, R: 18, w: 9, d: 6.5, h: 4.3, sign: 'The Last Lamp', npc: 'hobb' },
      { kind: 'shop', deg: -125, R: 16, w: 7, d: 5.5, h: 3.4, sign: 'Relics & Rarities', npc: 'quill' },
      { kind: 'house', deg: 25, R: 16, w: 5.5, d: 5, h: 3.0, resident: 'edda' },
      { kind: 'house', deg: -43, R: 16.5, w: 5, d: 4.6, h: 2.9, resident: 'corwen' },
    ],
    well: true, palisade: 25, gates: [-75, 69], lamps: [-100, 0, 50, 140, -150, 210],
    dummies: [[-6, 9], [-8.5, 10]],
  },
];

export const townById = (id) => TOWNS.find((t) => t.id === id);

// Cave mouths set into the hills. `dir` is the way the mouth faces (towards the valley).
export const CAVES = [
  { id: 'hollow', name: 'The Hollow Deep', x: 100, z: -118, seed: 11, size: 38, enemies: { bat: 4, imp: 2, skeleton: 3 }, chests: 4 },
  { id: 'grotto', name: 'Whispering Grotto', x: -152, z: 30, seed: 23, size: 34, enemies: { bat: 5, imp: 3, skeleton: 1 }, chests: 3 },
  { id: 'vault', name: 'The Sunken Vault', x: -70, z: -158, seed: 37, size: 42, enemies: { skeleton: 5, imp: 2, bat: 2 }, chests: 3, locked: 'vault_key', boss: true },
  { id: 'frostmine', name: 'The Frostdeep Mine', x: 130, z: -470, seed: 41, size: 44, level: 4, enemies: { imp: 4, skeleton: 3, bat: 3 }, chests: 4 },
  { id: 'amber_hollow', name: 'Amber Hollow', x: 505, z: 130, seed: 43, size: 36, level: 2, enemies: { puglin: 4, bat: 3 }, chests: 3 },
  { id: 'bog_warren', name: 'The Bog Warren', x: -150, z: 500, seed: 47, size: 38, level: 3, enemies: { slime: 5, imp: 3 }, chests: 3 },
  { id: 'howling_den', name: 'The Howling Den', x: -250, z: -190, seed: 53, size: 34, level: 3, enemies: { wolf: 6, bat: 2 }, chests: 3 },
  { id: 'drowned_grotto', name: 'The Drowned Grotto', x: 200, z: 470, seed: 59, size: 38, level: 3, enemies: { slime: 3, skeleton: 3, bat: 3 }, chests: 3 },
];

// Dungeons: built from the modular dungeon kit, room by room. The deepest room holds a guardian.
export const DUNGEONS = [
  { id: 'barrow', name: 'Barrow of the Old Kings', x: -330, z: -330, seed: 61, rooms: 9, level: 4,
    enemies: { skeleton: 7, bat: 2 }, boss: 'barrow_king', chests: 4, prize: 'sword_golden' },
  { id: 'crypt', name: 'Blackroot Crypt', x: -320, z: 320, seed: 67, rooms: 8, level: 3,
    enemies: { skeleton: 5, imp: 3 }, boss: 'crypt_lord', chests: 3, prize: 'claymore' },
  { id: 'catacombs', name: 'Sunder Catacombs', x: -490, z: 190, seed: 71, rooms: 10, level: 4,
    enemies: { skeleton: 5, bandit: 3, imp: 2 }, boss: 'bandit_king', chests: 4, prize: 'war_hammer' },
];
export const dungeonById = (id) => DUNGEONS.find((d) => d.id === id);
