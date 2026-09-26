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
    id: 'greywatch', name: 'Greywatch', subtitle: 'The garrison that watches the northern hills', style: 'brick',
    x: -95, z: -105, r: 26, entrance: -12,
    walls: [0x9a968c, 0x8c887e, 0xa8a398], roofs: [0x4a5058, 0x3f454c, 0x555a60],
    buildings: [
      { kind: 'tower', deg: 168, R: 13, w: 5, d: 5, h: 9, npc: 'hale' },
      { kind: 'shop', deg: -75, R: 15, w: 7, d: 5.5, h: 3.2, sign: 'Greywatch Armory', npc: 'sera' },
      { kind: 'hall', deg: 75, R: 15, w: 9, d: 6, h: 3.4, sign: 'Barracks', resident: 'soldier' },
      { kind: 'house', deg: 125, R: 16, w: 5, d: 4.6, h: 2.8, resident: 'widow' },
      { kind: 'house', deg: -128, R: 16, w: 5.5, d: 4.8, h: 2.9 },
    ],
    well: true, palisade: 23, lamps: [-40, 30, 120, -150, 210],
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
];

export const townById = (id) => TOWNS.find((t) => t.id === id);

// Cave mouths set into the hills. `dir` is the way the mouth faces (towards the valley).
export const CAVES = [
  { id: 'hollow', name: 'The Hollow Deep', x: 100, z: -118, seed: 11, size: 38, enemies: { bat: 4, imp: 2, skeleton: 3 }, chests: 4 },
  { id: 'grotto', name: 'Whispering Grotto', x: -152, z: 30, seed: 23, size: 34, enemies: { bat: 5, imp: 3, skeleton: 1 }, chests: 3 },
  { id: 'vault', name: 'The Sunken Vault', x: -70, z: -158, seed: 37, size: 42, enemies: { skeleton: 5, imp: 2, bat: 2 }, chests: 3, locked: 'vault_key', boss: true },
];
