import { wandererTree, brennaTree, tamTree, pipTree } from './dialogue.js';
import { bye, barkTree, keeperTree } from './talk.js';
import { FRONTIER_NPCS, FRONTIER_RESIDENTS } from './frontier.js';

// Everyone you can talk to. `name(g)` is what prompts and the dialogue box call them; `shop` opens a store.
// Where they stand: `outdoor` places them in the world; otherwise they're inside the building whose
// town data names them (npc: 'id' / resident: 'id').
export const NPCS = {
  oswin: {
    tree: wandererTree, questGiver: 'wanderer',
    opts: { look: { outfit: 'ranger', hood: true, skin: 0xd9a883, shirt: 0x7a8a6a, hair: 0xcfcfcf, beard: true }, staff: true },
    name: (g) => (g.flags.knowsName ? 'Oswin' : 'the stranger'),
    outdoor: 'camp',
  },
  brenna: {
    tree: brennaTree, shop: 'brenna',
    opts: { look: { gender: 'female', skin: 0xc98f6a, shirt: 0x7a4a33, hair: 0x9a3b1c, hairStyle: 'ponytail' }, idle: 'foldArms' },
    name: (g) => (g.flags.metBrenna ? 'Brenna' : 'the blacksmith'),
    outdoor: 'smithy',
  },
  tam: {
    tree: tamTree, questGiver: 'tam', shop: 'tam',
    opts: { look: { gender: 'female', skin: 0xe0b18c, shirt: 0x7a3f4a, pants: 0x3f3a33, hair: 0xd0d0d0, hairStyle: 'long' }, apron: 0xe6dcc6 },
    name: (g) => (g.flags.metTam ? 'Tam' : 'the innkeeper'),
  },
  pip: {
    tree: pipTree,
    opts: { look: { skin: 0xf0c49e, shirt: 0x3f79b5, pants: 0x6b5a45, hair: 0xd9b36a, hairStyle: 'curly' }, scale: 0.62, wander: 7 },
    name: (g) => (g.flags.metPip ? 'Pip' : 'the child'),
    outdoor: { town: 'millbrook', x: 0, z: -5 },
  },
  odo: {
    tree: (g) => keeperTree(g, 'odo', {
      intro: "Welcome to Odo's! Rope, bread, lanterns, tents, and advice, and only the advice is free.",
      again: ['Back for more? I like a regular.', "If Odo doesn't have it, you don't need it.", 'Mind the barrels, they bite.'],
      lines: [
        "There's a cave up in the hills north of here. The Hollow Deep. Bats as big as your head, and worse further in. Take a lantern.",
        "A tent's a fine thing out on the road. Pitch it, sleep, pack it up. Beats sleeping in a ditch.",
        'Sister Maren at the chapel will patch you up for nothing. Don\'t tell her I sent you; she\'ll try to convert me again.',
      ],
    }),
    shop: 'odo',
    opts: { look: { skin: 0xb88a6a, shirt: 0x5a6b3a, pants: 0x4a3b2c, hair: 0x3a2a1a, beard: true }, apron: 0x8a7a5a },
    name: (g) => (g.flags.met_odo ? 'Odo' : 'the shopkeeper'),
  },
  maren: {
    tree: marenTree,
    opts: { look: { gender: 'female', skin: 0x8a5a3a, shirt: 0xe6e0d2, pants: 0xe6e0d2, hair: 0x1a1410, hairStyle: 'long' } },
    name: (g) => (g.flags.met_maren ? 'Sister Maren' : 'the chapel sister'),
  },
  hale: {
    tree: haleTree, questGiver: 'hale',
    opts: { look: { outfit: 'ranger', skin: 0xd9a883, shirt: 0x9a3f42, hair: 0x6a6a6a, hairStyle: 'buzzed', beard: true }, idle: 'foldArms' },
    name: (g) => (g.flags.met_hale ? 'Captain Hale' : 'the captain'),
  },
  sera: {
    tree: (g) => keeperTree(g, 'sera', {
      intro: "Greywatch Armory. Garrison issue, but I'll sell to anyone who can pay and doesn't look like trouble. You look a little like trouble.",
      again: ['Need something that stops blades?', 'Chainmail. Trust me.', 'Back in one piece. Good. My armour works.'],
      lines: [
        'Two of our lads followed a man in grey up to the Sunken Vault. Captain won\'t talk about it.',
        "Skeletons don't feel pain, but they do fall apart if you hit them hard enough. An axe helps.",
      ],
    }),
    shop: 'sera',
    opts: { look: { gender: 'female', outfit: 'ranger', skin: 0xe0b18c, shirt: 0x8a8f96, hair: 0x2b1d14, hairStyle: 'buns' } },
    name: (g) => (g.flags.met_sera ? 'Sera' : 'the armorer'),
  },
  bram: {
    tree: bramTree, shop: 'bram',
    opts: { look: { skin: 0xc98f6a, shirt: 0x6b3f3a, pants: 0x3f3a33, hair: 0x8a5a2a, hairStyle: 'curly', beard: true }, apron: 0xe6dcc6 },
    name: (g) => (g.flags.met_bram ? 'Bram' : 'the tavern keeper'),
  },
  marisol: {
    tree: marisolTree, shop: 'marisol',
    opts: { look: { gender: 'female', skin: 0xd9b08c, shirt: 0x4a2f6b, pants: 0x2f2a3a, hair: 0x6a2a4a, hairStyle: 'long' } },
    name: (g) => (g.flags.met_marisol ? 'Marisol' : 'the curio dealer'),
  },
  guard: {
    tree: (g) => barkTree(g, 'guard', [
      "Captain Hale's in the tower, if you've business.",
      'Quiet night last night. Too quiet. The Vault\'s been humming.',
      "Move along, citizen. Or don't. I'm not your mother.",
    ]),
    opts: { look: { outfit: 'ranger', skin: 0xd9a883, shirt: 0x9a3f42, hair: 0x3a2a1a, hairStyle: 'buzzed' } },
    name: () => 'the gate guard',
    outdoor: { town: 'greywatch', x: 20, z: -9 },
  },
  minstrel: {
    tree: (g) => barkTree(g, 'minstrel', [
      '♪ Oh the stones on the hill, they were silent and still, till a star tumbled down in the night... ♪ Working title.',
      "Buy me a stew and I'll write you a verse. Something heroic. Rhymes with 'amnesia'... give me time.",
      "Thornbury's the best town in the valley. I say that in every town.",
    ]),
    opts: { look: { outfit: 'ranger', skin: 0xf0c49e, shirt: 0x5aa07a, hair: 0xd9b36a, hairStyle: 'long' }, wander: 6 },
    name: () => 'the minstrel',
    outdoor: { town: 'thornbury', x: 3, z: 4 },
  },
  ...FRONTIER_NPCS,
};

// Townsfolk who live in the houses: a name, a look and a few things to say.
const RESIDENTS = {
  gil: ['Gil', 'male', ["Barley's coming in well this year. Slimes keep eating the turnips, though.", "You're the sky-fallen one? Huh. Thought you'd be taller."]],
  nan: ['Old Nan', 'female', ["Eighty-one winters and I've never seen those stones light up. Then you arrive. Hmph.", 'Sit, sit. Mind the cat. There is no cat. Mind it anyway.']],
  hester: ['Hester', 'female', ["If you see Pip, tell him supper's ready. He never comes when I call.", 'Pip talks about you constantly now. "The sky person". Thank you for that.']],
  ansel: ['Ansel', 'male', ["Lost my good axe in a stump up by the Millbrook road. Stuck fast. If you pull it free, it's yours.", 'Pines are thick east of here. So are the wolves.']],
  lise: ['Lise', 'female', ['I weave the cloth for half the valley. The grey coat that stranger wore? Not from any loom around here.', 'Odo overcharges. Everyone knows. We all still go.']],
  soldier: ['Off-duty soldier', 'male', ["Do you know what's down in that Vault? Neither do I. Nobody who goes in comes out to tell us.", 'Sera sells chainmail. Buy chainmail.']],
  widow: ['Widow Rhosyn', 'female', ['My Hal went up to the Vault with the others. The captain says he\'ll be back. The captain says a lot of things.', 'Keep your lantern lit up there. Please.']],
  tobin: ['Tobin', 'male', ['The pond by the meadow used to have fish. Now it has slimes. I blame the stones.', "Marisol buys bat wings. Don't ask what for. I asked. I regret it."]],
  wilma: ['Aunt Wilma', 'female', ["There's a cave west of the woods, the Whispering Grotto. My brother swears it whispers his name. He's an idiot, but still.", 'Bram waters his ale. Bram knows I know.']],
  ...FRONTIER_RESIDENTS,
};
const RESIDENT_LOOKS = [
  { skin: 0xe0b18c, shirt: 0x6b5a45, hair: 0x3a2a1a, hairStyle: 'short' },
  { skin: 0xb88a6a, shirt: 0x5a6b7a, hair: 0x1a1410, hairStyle: 'curly' },
  { skin: 0xd9a883, shirt: 0x7a5a3a, hair: 0x8a5a2a, hairStyle: 'long' },
  { skin: 0x8a5a3a, shirt: 0x6b3f4a, hair: 0x2b1d14, hairStyle: 'ponytail' },
];

export function residentDef(id) {
  const [label, gender, lines] = RESIDENTS[id];
  const look = RESIDENT_LOOKS[id.length % RESIDENT_LOOKS.length];
  return {
    tree: (g) => barkTree(g, id, lines),
    opts: { look: { ...look, gender, pants: 0x4a3b2c, hair: id === 'nan' ? 0xd8d8d8 : look.hair }, wander: 1.4 },
    name: () => label,
  };
}

// ---------------------------------------------------------------- tree helpers
// ---------------------------------------------------------------- characters with more to say
function marenTree(g) {
  const hub = () => [
    { text: 'Could you bless me? (Restore health and mana)', next: 'bless' },
    { text: 'What is this place?', next: 'place' },
    bye,
  ];
  return {
    greet: {
      text: () => (g.flags.met_maren ? 'Welcome back, child of the sky.' : "Peace to you, traveller. I'm Sister Maren. The chapel door is never locked, and my help is never sold."),
      onEnter: () => (g.flags.met_maren = true),
      options: hub,
    },
    hub: { text: 'Is there anything else?', options: hub },
    bless: {
      text: 'Hold still... There. Go gently.',
      onEnter: () => {
        const s = g.player.stats;
        s.hp = s.maxHp;
        s.mana = s.maxMana;
        g.hud.toast('Sister Maren\'s blessing restores you.', 'quest');
      },
      options: hub,
    },
    place: {
      text: 'The chapel of the Quiet Light. We keep a candle burning for everyone the stones ever took. There were more of them than you\'d think.',
      options: hub,
    },
  };
}

function bramTree(g) {
  return keeperTree(g, 'bram', {
    intro: "The Thorn & Thistle! Best ale in Thornbury, and I'll fight anyone who says otherwise. Except Wilma. Bram, at your service.",
    again: ['Pull up a stool!', 'Another bowl?', "You're back! Tell your friends. Tell your enemies, they pay too."],
    lines: [
      "There's a grotto past the western woods. Folk say it whispers. I say it's the wind, and I say that from here, where it's warm.",
      'Marisol next door buys anything strange. She paid a man in grey for some old coins last month. Paid well, too.',
    ],
  }, () => [{ text: 'Could I rent a bed? (Heal and save)', next: null, do: () => g.rest('thornbury') }]);
}

function marisolTree(g) {
  const q = g.quests;
  return keeperTree(g, 'marisol', {
    intro: "Curios, tonics, books that bite. Marisol. Touch nothing with your left hand. You'll know why if you do.",
    again: ['Ah, the one who fell. Buying or selling?', 'Mind the jars.', 'Back again. Things find their way to me. So do people.'],
    lines: [
      'Ember Tonics restore the fire inside you. You do have fire inside you, don\'t you? I can smell it.',
      'The Tome of Embers will make your flames hotter. It will also make your eyebrows a memory.',
    ],
  }, () => [
    { text: 'What can you tell me about this coin?', next: 'coin', if: () => q.isActive('grey2') && g.inventory.has('old_coin') },
  ], {
    coin: {
      text: "Well now. A tower mint... that isn't from any kingdom on this side. See the black glass in the stamp? The Tower of Glass. The old stories say it stands where the world is thin. A man in a grey coat sold me three of these last month, and bought my only map of the Sunken Vault, north of Greywatch. I wouldn't follow him, dear. But you will, won't you.",
      onEnter: () => g.bump('clue:marisol'),
      options: [{ text: 'Thank you.', next: 'hub' }],
    },
  });
}

function haleTree(g) {
  const q = g.quests;
  const hub = () => [
    { text: 'A man in grey came through here.', next: 'grey', if: () => q.isActive('grey3') },
    { text: "I've dealt with the restless dead.", next: 'bones_done', if: () => q.isReady('bones') },
    { text: 'Need anything done?', next: 'bones_offer', if: () => !q.status('bones') },
    { text: 'What does Greywatch watch?', next: 'watch' },
    bye,
  ];
  return {
    greet: {
      text: () => (g.flags.met_hale ? 'Traveller.' : "Captain Hale, Greywatch garrison. You'll be the one from the stones. Word travels. What do you want?"),
      onEnter: () => (g.flags.met_hale = true),
      options: hub,
    },
    hub: { text: 'Anything else?', options: hub },
    watch: {
      text: "The north hills, and what's under them. The Sunken Vault was sealed before my grandfather's time. Lately it hums at night, like your stones did.",
      options: hub,
    },
    grey: {
      text: "Grey coat, a writ signed by nobody I've ever heard of. He wanted the Vault key. I refused. Two of my men followed him north anyway, and they haven't come back. You want to go in after him? Then take the key. And bring my men home if you can.",
      onEnter: () => {
        g.bump('talk:hale');
        if (!g.inventory.has('vault_key')) g.giveItem('vault_key');
      },
      options: hub,
    },
    bones_offer: {
      text: 'The dead are walking in the caves: the Hollow Deep, the Grotto, the Vault. Put five of them back down and the garrison will pay.',
      options: [
        { text: "I'll do it.", next: 'hub', do: () => q.start('bones') },
        { text: 'Not now.', next: 'hub' },
      ],
    },
    bones_done: { text: 'Good work. Here, garrison pay. Spend it on something that stops blades.', onEnter: () => q.complete('bones'), options: hub },
  };
}

// The Man in Grey, after the fight in the Sunken Vault.
export function corvinTree(g) {
  const name = g.hero.name;
  const asked = new Set();
  const hub = () => [
    { text: 'Who are you?', next: 'who', if: () => !asked.has('who') },
    { text: 'Why were you hunting me?', next: 'why', if: () => !asked.has('why') },
    { text: 'What were the shards?', next: 'shards', if: () => !asked.has('shards') },
    { text: 'The letter warned me about you.', next: 'letter', if: () => !asked.has('letter') },
    { text: 'What happens now?', next: 'now' },
  ];
  const node = (id, text) => ({ text, onEnter: () => asked.add(id), options: hub });
  return {
    greet: {
      text: `Enough. Enough! ...You always did hit harder than you trained, ${name}.`,
      options: hub,
    },
    who: node('who', "Corvin. Warden of the Crossing. Your teacher, once, not that you'd remember. Rain on a training yard. A sword too heavy for your arms. 'You'll learn,' I told you. You did."),
    why: node('why', 'Not hunting. Following. You went through the stones carrying the shards, and I had to be sure nothing followed you through. Something did. It was waiting down here.'),
    shards: node('shards', "Pieces of a seal. The ones who hold the Tower of Glass wanted them. You carried them across so they couldn't be used, and the crossing burned them into you. That's why you forgot. That's why they'll want you now."),
    letter: node('letter', 'Did it? Then whoever wrote it wanted you alone and afraid out here, with no one to trust. Ask yourself who gains from that.'),
    now: {
      text: 'Now I go back and hold the door as long as I can. You grow stronger. When the stones burn white again, they will be coming. Keep the coat. It remembers the way home, even when you don\'t.',
      options: [{ text: '(Let him go.)', next: null }],
    },
  };
}
