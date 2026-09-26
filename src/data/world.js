// The lay of the land beyond the valley: regions, lakes, roads and places of interest.
// Coordinates are metres; -z is north. The Vale (the starting valley) fills the middle, ringed by low hills
// with passes where the roads cross. Eight regions surround it, one per compass point.
//
// Regions are picked by compass bearing from the centre (0 = north, 90 = east). Each sets the shape of the
// land, its colours, what grows there, what hunts there, and how dangerous it is (`level`).
export const VALE_RADIUS = 200;

export const REGIONS = {
  vale: {
    name: 'The Vale', level: 1,
    grass: [0x4f8a34, 0x7aa84a], dry: 0xa39f5a, tuft: [0.58, 0.8, 0.33],
  },
  frost: {
    name: 'The Frostreach', bearing: 0, level: 4, hills: 30, lift: 10, snowLine: 16,
    grass: [0x62806a, 0x86987f], dry: 0x9aa39a, tuft: [0.62, 0.72, 0.55],
    trees: [['nature/Pine_', 5, 0.8, 0.6], ['nature/DeadTree_', 5, 0.1, 0.55]], treeDensity: 0.3,
    enemies: { wolf: 3, imp: 2 }, night: { skeleton: 2 },
  },
  crags: {
    name: 'The Ember Crags', bearing: 45, level: 5, hills: 36, lift: 8, rocky: true, snowLine: 70, // warm rock: no snow
    grass: [0x707a50, 0x8a8a5a], dry: 0x8a6a50, tuft: [0.6, 0.66, 0.36],
    trees: [['nature/Pine_', 5, 0.5, 0.55], ['nature/TwistedTree_', 5, 0.3, 0.45], ['nature/DeadTree_', 5, 0.2, 0.5]], treeDensity: 0.1,
    enemies: { puglin: 3, imp: 2, wolf: 1 }, night: { bat: 2 },
  },
  amber: {
    name: 'Amberwood', bearing: 90, level: 2, hills: 14, lift: 2,
    grass: [0x7a943a, 0xa89a45], dry: 0xb87a3a, tuft: [0.72, 0.72, 0.3],
    trees: [['nature2/MapleTree_', 5, 0.6, 0.9], ['nature2/BirchTree_', 5, 0.3, 0.9], ['nature/CommonTree_', 5, 0.1, 0.8]], treeDensity: 0.45,
    enemies: { puglin: 2, wolf: 2, bandit: 1 }, night: { bandit: 1 },
  },
  lake: {
    name: 'Stillmere', bearing: 135, level: 2, hills: 9, lift: 0,
    grass: [0x5a9a44, 0x7ab050], dry: 0x9aa860, tuft: [0.5, 0.82, 0.36],
    trees: [['nature2/BirchTree_', 5, 0.5, 0.85], ['nature/CommonTree_', 5, 0.5, 0.8]], treeDensity: 0.18,
    enemies: { slime: 3, bandit: 1, wolf: 1 }, night: { bat: 1 },
  },
  fen: {
    name: 'The Mirefen', bearing: 180, level: 3, hills: 3, lift: -0.4,
    grass: [0x4f5a30, 0x5f6236], dry: 0x4a3f28, tuft: [0.5, 0.6, 0.3],
    trees: [['nature/DeadTree_', 5, 0.5, 0.6], ['nature/TwistedTree_', 5, 0.5, 0.5]], treeDensity: 0.12,
    enemies: { slime: 3, imp: 2 }, night: { bat: 3 },
  },
  blackroot: {
    name: 'Blackroot Forest', bearing: 225, level: 3, hills: 12, lift: 1,
    grass: [0x3f5a2e, 0x4a6a34], dry: 0x5a4a2e, tuft: [0.38, 0.55, 0.26],
    trees: [['nature/Pine_', 5, 0.55, 1.0], ['nature/TwistedTree_', 5, 0.25, 0.55], ['nature/DeadTree_', 5, 0.2, 0.6]], treeDensity: 0.6,
    enemies: { wolf: 2, bandit: 2, skeleton: 1 }, night: { skeleton: 2 },
  },
  sunder: {
    name: 'The Sunder Plains', bearing: 270, level: 3, hills: 7, lift: 1,
    grass: [0xa3a060, 0xc2b27a], dry: 0xc9a86a, tuft: [0.82, 0.78, 0.45],
    trees: [['nature/CommonTree_', 5, 0.6, 0.7], ['nature/DeadTree_', 5, 0.4, 0.55]], treeDensity: 0.03,
    enemies: { bandit: 3, puglin: 1, skeleton: 1 }, night: { skeleton: 2 },
  },
  barrow: {
    name: 'The Barrow Downs', bearing: 315, level: 4, hills: 18, lift: 4,
    grass: [0x6a7a4a, 0x7a6a74], dry: 0x8a6a8a, tuft: [0.6, 0.62, 0.45],
    trees: [['nature/Pine_', 5, 0.5, 0.7], ['nature/DeadTree_', 5, 0.5, 0.55]], treeDensity: 0.05,
    enemies: { skeleton: 3, wolf: 2 }, night: { skeleton: 2, bat: 1 },
  },
};

// Water. `level` is the surface height; the ground inside is carved into a basin below it.
export const LAKES = [
  { id: 'pond', x: 60, z: 40, r: 15, level: -1.0 },
  { id: 'stillmere', x: 360, z: 350, r: 60, level: -1.5, name: 'Stillmere' },
  { id: 'fen1', x: 60, z: 360, r: 14, level: -1.2 },
  { id: 'fen2', x: -70, z: 380, r: 11, level: -1.2 },
  { id: 'fen3', x: 110, z: 450, r: 16, level: -1.2 },
  { id: 'fen4', x: -110, z: 440, r: 9, level: -1.2 },
  { id: 'fen5', x: 30, z: 520, r: 12, level: -1.2 },
  { id: 'fen6', x: -40, z: 310, r: 8, level: -1.2 },
  { id: 'tarn', x: -60, z: -470, r: 18, level: 8, name: 'Frost Tarn' },
];

// Roads as polylines. The first six are the Vale's original paths.
export const ROADS = [
  [[0, 4], [-3, 28], [-6, 50], [-8, 72]], // meadow -> Millbrook
  [[0, 4], [5, -4], [14, -14], [24, -26]], // meadow -> Oswin's camp
  [[24, -26], [55, -30], [90, -24], [118, -22]], // camp -> Ashford
  [[-8, 72], [22, 92], [55, 108], [85, 115]], // Millbrook -> Thornbury
  [[0, 4], [-2, -40], [-5, -85], [-6, -118]], // meadow -> the standing stones
  [[-6, -124], [-40, -122], [-70, -112], [-95, -105]], // stones -> Greywatch

  [[-95, -105], [-85, -170], [-60, -240], [-30, -320], [0, -390], [20, -440]], // Greywatch -> Frosthold
  [[-95, -105], [-170, -95], [-250, -70], [-340, -40], [-440, -20]], // Greywatch -> Oldgate
  [[118, -22], [190, -34], [270, -22], [350, -40], [430, -30]], // Ashford -> Amberly
  [[85, 115], [150, 170], [210, 230], [270, 260]], // Thornbury -> Stillwater
  [[-8, 72], [-12, 150], [-24, 230], [-14, 310], [-12, 380], [-20, 430]], // Millbrook -> Fenwick
  [[430, -30], [445, 60], [420, 170], [360, 235], [270, 260]], // Amberly -> Stillwater
  [[270, 260], [230, 350], [150, 400], [60, 425], [-20, 430]], // Stillwater -> Fenwick
  [[-20, 430], [-110, 410], [-200, 360], [-300, 250], [-380, 140], [-440, -20]], // Fenwick -> Oldgate
  [[20, -440], [120, -420], [230, -370], [330, -250], [410, -130], [430, -30]], // Frosthold -> Amberly
  [[-440, -20], [-400, -170], [-330, -290], [-200, -390], [-80, -430], [20, -440]], // Oldgate -> Frosthold
  [[330, -250], [360, -300], [372, -338]], // up to Emberfall Peak
];

// Named places outside the towns. kind: 'ruin' (walls and statues with a chest and guards),
// 'peak' (the dragon's plateau).
export const SITES = [
  { id: 'sunder_keep', kind: 'ruin', name: 'Sunder Keep', x: -360, z: -110, seed: 3, size: 14, guards: { bandit: 3 }, statue: null },
  { id: 'stag_chapel', kind: 'ruin', name: 'Chapel of the Stag', x: -210, z: 240, seed: 5, size: 11, guards: { skeleton: 3 }, statue: 'Statue_Stag' },
  { id: 'old_watch', kind: 'ruin', name: 'The Old Watch', x: 225, z: -265, seed: 7, size: 10, guards: { puglin: 3 }, statue: null },
  { id: 'fox_shrine', kind: 'ruin', name: 'Shrine of the Fox', x: 265, z: 120, seed: 9, size: 9, guards: { bandit: 2 }, statue: 'Statue_Fox' },
  { id: 'drowned_arches', kind: 'ruin', name: 'The Drowned Arches', x: 160, z: 330, seed: 13, size: 12, guards: { slime: 3 }, statue: null },
  { id: 'frost_gate', kind: 'ruin', name: 'The Frost Gate', x: -170, z: -390, seed: 17, size: 12, guards: { skeleton: 3 }, statue: 'Statue_Stag' },
  { id: 'barrow_ring', kind: 'ruin', name: 'The Barrow Ring', x: -420, z: -290, seed: 19, size: 13, guards: { skeleton: 4 }, statue: null },
  { id: 'emberfall', kind: 'peak', name: 'Emberfall Peak', x: 372, z: -345, r: 26, height: 46 },
];
