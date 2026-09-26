import { townTree } from './talk.js';

// The five towns beyond the Vale: their people, shops and side stories.
//   Frosthold (north): miners, a forge, and a dragon on the peak to the east.
//   Amberly (east): orchards, cider, and a thief on the road.
//   Stillwater (southeast): a lake that keeps things, and a chapel that lost its bell.
//   Fenwick (south): marsh folk, a witch who brews, and slimes in the warren.
//   Oldgate (west): the last town before the old kingdom's ruins, where bandits rule the roads.

// ---------------------------------------------------------------- quests
export const FRONTIER_QUESTS = {
  // Frosthold
  deep_seam: {
    title: 'Knocking in the Deep',
    summary: "Brask, the Frosthold mine foreman, says imps have taken the Frostdeep Mine east of town. The miners won't go back until they're gone.",
    turnIn: 'brask', turnInName: 'Brask in Frosthold',
    objectives: [{ text: 'Drive the imps out of the Frostdeep Mine', counter: 'kill:imp', count: 6, fromStart: true }],
    rewards: { xp: 260, coins: 120, items: { double_axe: 1 } },
  },
  forge_ore: {
    title: 'Ore for the Forge',
    summary: "Dagny can't forge without iron, and the mine's been shut for weeks. Imps hoard the stuff; so do the mine's old chests.",
    turnIn: 'dagny', turnInName: 'Dagny in Frosthold',
    objectives: [{ text: 'Bring Dagny iron ore', counter: 'item:iron_ore', count: 5 }],
    rewards: { xp: 180, take: { iron_ore: 5 }, items: { scale_mail: 1 } },
  },
  emberwing: {
    title: 'The Old Flame',
    summary: 'A red dragon roosts on Emberfall Peak, east of Frosthold, and burns the caravans on the high road. Ysolde at the Cold Hearth has buried three drivers this year.',
    turnIn: 'ysolde', turnInName: 'Ysolde in Frosthold',
    objectives: [{ text: 'Slay Emberwing on Emberfall Peak', counter: 'defeat:dragon', count: 1 }],
    rewards: { xp: 900, coins: 600 },
  },
  dragonforge: {
    title: 'Dragonscale',
    summary: 'Dagny swears she can forge armour from dragon scales. She just needs two of them.',
    turnIn: 'dagny', turnInName: 'Dagny in Frosthold',
    objectives: [{ text: 'Bring Dagny dragon scales', counter: 'item:dragon_scale', count: 2 }],
    rewards: { xp: 300, take: { dragon_scale: 2 }, items: { dragon_mail: 1 } },
  },
  // Amberly
  orchard_thief: {
    title: 'The Cider Thieves',
    summary: "Someone has been stealing cider from the Golden Press, a barrel at a time. Marta found cart tracks leading southwest, towards the old Shrine of the Fox.",
    turnIn: 'marta', turnInName: 'Marta in Amberly',
    objectives: [
      { text: 'Find the Shrine of the Fox (southwest of Amberly)', counter: 'visit:fox_shrine', count: 1, fromStart: true },
      { text: 'Deal with the thieves', counter: 'kill:bandit', count: 3, fromStart: true },
    ],
    rewards: { xp: 240, coins: 150, items: { cider: 5 } },
  },
  winter_wool: {
    title: 'Wool for Winter',
    summary: 'Pell needs wool for the winter weaving. The sheep in the Vale are fat and woolly, and not especially attached to it.',
    turnIn: 'pell', turnInName: 'Pell in Amberly',
    objectives: [{ text: 'Bring Pell wool', counter: 'item:wool', count: 6 }],
    rewards: { xp: 120, coins: 110, take: { wool: 6 }, items: { greater_potion: 1 } },
  },
  // Stillwater
  lake_bell: {
    title: 'What the Lake Keeps',
    summary: "Stillwater's chapel bell was stolen years ago. On still nights, Brother Aldo hears it ringing under the water. There's a flooded cave south of the lake: the Drowned Grotto.",
    turnIn: 'aldo', turnInName: 'Brother Aldo in Stillwater',
    objectives: [{ text: 'Find the chapel bell in the Drowned Grotto', counter: 'item:chapel_bell', count: 1 }],
    rewards: { xp: 280, coins: 120, take: { chapel_bell: 1 }, items: { greater_potion: 3 } },
  },
  crypt_lady: {
    title: 'The Lady of the Crypt',
    summary: "Whoever took the bell answered to someone in Blackroot Crypt, deep in the dark forest southwest of the Vale. Brother Aldo calls her Morwen, and won't say her name twice.",
    turnIn: 'aldo', turnInName: 'Brother Aldo in Stillwater',
    objectives: [{ text: 'Defeat Morwen in Blackroot Crypt', counter: 'clear:crypt', count: 1 }],
    rewards: { xp: 600, coins: 300 },
  },
  // Fenwick
  wicks_brew: {
    title: "Old Wick's Brew",
    summary: 'Old Wick can brew greater draughts, if someone brings her slime gel and moonpetals. She did not say what the gel is for.',
    turnIn: 'wick', turnInName: 'Old Wick in Fenwick',
    objectives: [
      { text: 'Slime gel', counter: 'item:slime_gel', count: 6 },
      { text: 'Moonpetals', counter: 'item:herb', count: 3 },
    ],
    rewards: { xp: 140, take: { slime_gel: 6, herb: 3 }, items: { greater_potion: 3 } },
  },
  warren: {
    title: 'Something in the Warren',
    summary: "Gorm at the Sodden Boot says the Bog Warren, west of Fenwick, is boiling over with slimes. They've started coming up the drains.",
    turnIn: 'gorm', turnInName: 'Gorm in Fenwick',
    objectives: [
      { text: 'Enter the Bog Warren', counter: 'visit:bog_warren', count: 1, fromStart: true },
      { text: 'Thin out the slimes', counter: 'kill:slime', count: 8, fromStart: true },
    ],
    rewards: { xp: 260, coins: 90, items: { fen_cloak: 1 } },
  },
  // Oldgate
  crow_tokens: {
    title: 'Tokens of the Crow',
    summary: "Rook's bandits carry a tin crow token. Warden Ilsa of Oldgate pays for every five brought to her.",
    turnIn: 'ilsa', turnInName: 'Warden Ilsa in Oldgate',
    objectives: [{ text: "Collect bandits' tokens", counter: 'item:bandit_badge', count: 5 }],
    rewards: { xp: 220, coins: 200, take: { bandit_badge: 5 } },
  },
  rook: {
    title: 'The Bandit King',
    summary: 'Rook, the bandit king, hides in the Sunder Catacombs, west of Oldgate in the ruins of the old kingdom. Bring back his ledger.',
    turnIn: 'ilsa', turnInName: 'Warden Ilsa in Oldgate',
    objectives: [{ text: 'Defeat Rook in the Sunder Catacombs', counter: 'clear:catacombs', count: 1 }],
    rewards: { xp: 650, coins: 400, items: { greatsword: 1 } },
  },
  barrow_king: {
    title: 'The Barrow King',
    summary: 'Something woke under the Barrow Downs, northeast of Oldgate. The dead are walking out of the old kings\' tombs. Ilsa wants their king put back to sleep.',
    turnIn: 'ilsa', turnInName: 'Warden Ilsa in Oldgate',
    objectives: [{ text: 'Defeat the Barrow King', counter: 'clear:barrow', count: 1 }],
    rewards: { xp: 800, coins: 450 },
  },
};

// ---------------------------------------------------------------- shops
export const FRONTIER_SHOPS = {
  ysolde: { name: 'The Cold Hearth', stock: ['bread', 'stew', 'cooked_meat', 'potion', 'mana_potion'], buys: ['consumable', 'material'] },
  dagny: { name: 'Frosthold Forge', stock: ['knight_sword', 'double_axe', 'war_spear', 'chainmail', 'scale_mail'], buys: ['weapon', 'armor', 'material'] },
  marta: { name: 'The Golden Press', stock: ['cider', 'bread', 'stew', 'potion'], buys: ['consumable', 'material'] },
  pell: { name: 'Orchard Goods', stock: ['bread', 'cider', 'lantern', 'tent', 'potion', 'leather_armor'], buys: 'all' },
  finn: { name: 'The Heron', stock: ['smoked_fish', 'stew', 'potion', 'mana_potion'], buys: ['consumable', 'material'] },
  nella: { name: "Nella's Wharf", stock: ['smoked_fish', 'bread', 'lantern', 'tent', 'potion'], buys: 'all' },
  gorm: { name: 'The Sodden Boot', stock: ['stew', 'bread', 'cooked_meat', 'potion'], buys: ['consumable', 'material'] },
  wick: { name: "Old Wick's Remedies", stock: ['potion', 'greater_potion', 'mana_potion', 'scythe'], buys: ['consumable', 'material'] },
  hobb: { name: 'The Last Lamp', stock: ['bread', 'stew', 'potion', 'cider'], buys: ['consumable', 'material'] },
  quill: { name: 'Relics & Rarities', stock: ['dagger', 'greatsword', 'tome_embers', 'mana_potion', 'greater_potion'], buys: 'all' },
};

// ---------------------------------------------------------------- people
const look = (o) => ({ look: o });

export const FRONTIER_NPCS = {
  // ---- Frosthold ----
  ysolde: {
    tree: (g) => townTree(g, 'ysolde', {
      intro: "Shut the door, you're letting the mountain in. Welcome to the Cold Hearth. I'm Ysolde. The fire's the only warm thing in Frosthold, including me.",
      again: ['Door. Shut it.', 'Back from the snow? Sit by the fire.', "Still alive. Good. I'm tired of digging."],
      lines: [
        'The miners drink here when there is work, and drink more when there is not. There has not been work for a month.',
        "On a clear night you can see Emberfall Peak glowing to the east. That's her. Emberwing. Burns the high road and sleeps on the ashes.",
        "Came up from Greywatch, did you? Then you walked past the Frost Gate. Old kingdom ruin. Don't linger there after dark.",
      ],
      shop: true, inn: 'frosthold',
      quests: [{
        id: 'emberwing', ask: 'You look like you have a problem that needs a sword.',
        offer: "There's a dragon on Emberfall Peak, east of here, past the Old Watch. Emberwing. She's burned three wagons this year and I buried every driver. Nobody sane goes up there. You don't strike me as sane. Kill her and the town will empty its purses for you.",
        reminder: "Emberfall Peak, east. Follow the high road and climb. You'll smell it before you see it.",
        done: "You... actually did it. The whole valley will hear of this by morning. Here: every coin the town could spare, and a free bed for as long as you live.",
      }],
    }),
    shop: 'ysolde', questChain: [['emberwing']],
    opts: look({ gender: 'female', skin: 0xe8d0c0, shirt: 0x5a6a7a, hair: 0xd8d8d8, hairStyle: 'buns' }),
    name: (g) => (g.flags.met_ysolde ? 'Ysolde' : 'the innkeeper'),
  },
  dagny: {
    tree: (g) => townTree(g, 'dagny', {
      intro: "Dagny. I make the best steel north of the Vale, when I've got iron to make it from. Which I haven't. So mostly I sell what's left.",
      again: ['Need an edge?', "Mind the anvil, it's older than both of us.", 'If it can be hit, I can make something to hit it with.'],
      lines: [
        "Brenna down in Millbrook? We apprenticed together. She's better at swords. Don't tell her I said that.",
        "Dragon scales, if anyone ever got hold of some, would make armour you could swim through fire in. Not that anyone has.",
      ],
      shop: true,
      quests: [
        {
          id: 'forge_ore', ask: 'Anything I can do to get the forge going?',
          offer: "Iron ore. Five good lumps. The imps in the Frostdeep Mine have been hoarding it; they like the shine. Bring me ore and I'll forge you something better than what I've got on the rack.",
          reminder: 'Five lumps of iron ore. The imps in the mine carry it, and the old chests down there have some.',
          done: 'That is proper ore. Give me an hour... there. Scale mail, forged the Frosthold way. It\'ll turn a sword and it won\'t rust.',
        },
        {
          id: 'dragonforge', ask: "About those dragon scales you mentioned...", after: 'emberwing',
          offer: "You killed Emberwing and you're asking ME about scales? Bring me two and I'll make you armour that'll be sung about.",
          reminder: 'Two dragon scales. Then stand back from the forge.',
          done: "Dragonscale. It's still warm. Try it on. See? It moves like cloth. Nothing will cut you now, or not easily.",
        },
      ],
    }),
    shop: 'dagny', questChain: [['forge_ore'], ['dragonforge', 'emberwing']],
    opts: { ...look({ gender: 'female', skin: 0xc98f6a, shirt: 0x4a3a33, hair: 0x2a1a10, hairStyle: 'buzzed' }), idle: 'foldArms' },
    name: (g) => (g.flags.met_dagny ? 'Dagny' : 'the smith'),
  },
  brask: {
    tree: (g) => townTree(g, 'brask', {
      intro: "Brask. Foreman, for all the good it does me with no mine to be foreman of. You look handy. Are you handy?",
      again: ['Any word from the deep?', 'Sit, if you want. Everyone else is.', 'The seam is still there. Waiting.'],
      lines: [
        "We dug too deep, the old-timers say. I say the imps were down there before us and we woke them up knocking.",
        'Frosthold iron built the old kingdom\'s swords. The ruins out west are full of them. Rusted, mostly.',
      ],
      quests: [{
        id: 'deep_seam', ask: "What's wrong with the mine?",
        offer: "Imps. Red-eyed little devils, dozens of them, all through the Frostdeep Mine, east of town. They came up out of the deep seam a month back and nobody's been down since. Clear them out, and I'll give you the best axe in Frosthold.",
        reminder: 'The Frostdeep Mine, east of town along the high road. Take a lantern. Take two.',
        done: "Quiet down there? Truly? You've given this town its bread back. Here, the Frostbiter. My father's axe. He'd have wanted it swung at something.",
      }],
    }),
    questChain: [['deep_seam']],
    opts: look({ skin: 0xd9a883, shirt: 0x5a4a3a, hair: 0x4a3a2a, hairStyle: 'bald', beard: true }),
    name: (g) => (g.flags.met_brask ? 'Brask' : 'the foreman'),
  },

  // ---- Amberly ----
  marta: {
    tree: (g) => townTree(g, 'marta', {
      intro: "Welcome to the Golden Press! Cider, pie, and a seat by the window. Marta. I own the place, and the orchard, and most of the gossip.",
      again: ['Cider?', 'Back for more? Wise.', "Sit! You look like someone who's walked a long way."],
      lines: [
        'The maples turn gold in the autumn and stay that way. Nobody knows why. We just sell more cider.',
        "There's a hollow in the hills east of here. Puglins. Horrible little things. They steal pies.",
        "A woman in white bought a barrel of our best last spring and paid in coins nobody could spend. Stamped with a tower.",
      ],
      shop: true, inn: 'amberly',
      quests: [{
        id: 'orchard_thief', ask: 'You look worried.',
        offer: "Someone's stealing my cider. A barrel a night, off the back of the press. The cart tracks run southwest towards the old Shrine of the Fox. Bandits, I'd wager. Get my cider back, or at least make them regret it.",
        reminder: 'The Shrine of the Fox, southwest along the old track. Mind yourself; there were at least three of them.',
        done: "They won't be back? Bless you. Here, five bottles of the good stuff, and the coin I'd have lost by winter.",
      }],
    }),
    shop: 'marta', questChain: [['orchard_thief']],
    opts: look({ gender: 'female', skin: 0xe0b18c, shirt: 0xb86a3a, hair: 0xb8703a, hairStyle: 'buns' }),
    name: (g) => (g.flags.met_marta ? 'Marta' : 'the innkeeper'),
  },
  pell: {
    tree: (g) => townTree(g, 'pell', {
      intro: "Orchard Goods! Rope, bread, cider, tents, and apples, obviously. Pell. I'll buy anything you've got, at a fair price. Fair to me.",
      again: ['Buying or selling?', 'Apples are two a copper.', 'Back again! My favourite customer. Today.'],
      lines: [
        "The Vale farmers let their sheep wander. If some of that wool were to find its way here, I wouldn't ask how.",
        "Bandits on the south road. They wear tin crows. Oldgate's warden pays for those, I hear.",
      ],
      shop: true,
      quests: [{
        id: 'winter_wool', ask: 'Need anything?',
        offer: "Wool! Winter's coming and the weavers are short. Six fleeces. The sheep in the Vale pastures, north of Millbrook, have plenty. How you get it off them is your business.",
        reminder: 'Six lots of wool. Sheep. Big, fluffy, dim. You can\'t miss them.',
        done: "Lovely fleece. The weavers will be thrilled. Here's your coin, and a draught of Wick's best for your trouble.",
      }],
    }),
    shop: 'pell', questChain: [['winter_wool']],
    opts: look({ skin: 0xb88a6a, shirt: 0x6b8a3a, hair: 0x3a2a1a, hairStyle: 'parted' }),
    name: (g) => (g.flags.met_pell ? 'Pell' : 'the shopkeeper'),
  },

  // ---- Stillwater ----
  finn: {
    tree: (g) => townTree(g, 'finn', {
      intro: "The Heron, finest fish on the lake. Only fish on the lake, really. Finn. You want a bed, a bowl, or a boat? We haven't got a boat.",
      again: ['Fish?', 'Fresh today. Mostly.', 'Sit down, dry off.'],
      lines: [
        "Stillmere's deeper than it looks. My grandad said there's a drowned village on the bottom. My grandad said a lot of things.",
        "Blackroot Forest, southwest past the Vale. Don't. Just don't.",
      ],
      shop: true, inn: 'stillwater',
    }),
    shop: 'finn',
    opts: look({ skin: 0xd9a883, shirt: 0x3f5a6b, hair: 0xb8703a, hairStyle: 'long', beard: true }),
    name: (g) => (g.flags.met_finn ? 'Finn' : 'the innkeeper'),
  },
  nella: {
    tree: (g) => townTree(g, 'nella', {
      intro: "Nella's Wharf. Nets, fish, rope, and whatever washes up. You'd be amazed what washes up.",
      again: ['Need rope?', "Something washed up this morning. Won't say what.", 'Mind the nets.'],
      lines: [
        "Brother Aldo's been odd since the bell went missing. Says he hears it under the water. Maybe he does.",
        'Salted fish keeps for weeks. Better than bread on a long walk.',
      ],
      shop: true,
    }),
    shop: 'nella',
    opts: look({ gender: 'female', skin: 0x8a5a3a, shirt: 0x5a7a8a, hair: 0x1a1410, hairStyle: 'long' }),
    name: (g) => (g.flags.met_nella ? 'Nella' : 'the fishwife'),
  },
  aldo: {
    tree: (g) => townTree(g, 'aldo', {
      intro: 'Peace on you, traveller. Brother Aldo. This chapel has stood here three hundred years. It used to have a bell.',
      again: ['Peace on you.', 'Sit a while. The quiet does you good.', 'Do you hear it? No. Of course not.'],
      lines: [
        'The old kingdom built this chapel. They built the Tower of Glass too, before the kingdom fell. Or so the books say.',
        'Morwen was a sister of this order, once. Before the crypt. We do not speak of her.',
      ],
      extra: () => [{ text: 'Could you heal my wounds?', next: null, do: () => g.chapelHeal() }],
      quests: [
        {
          id: 'lake_bell', ask: 'What happened to the bell?',
          offer: "Stolen, twelve years ago, by men in black. Taken into the Drowned Grotto south of the lake, and never seen again. But I hear it. On still nights, under the water. Bring it home, and I'll pray for you every morning for the rest of my life. And give you something more useful, too.",
          reminder: 'The Drowned Grotto, south of Stillmere. The bell is small; a hand bell, silver. It will be at the heart of the cave.',
          done: "Oh. Oh, listen to it. Thank you. Here, draughts from the chapel stores. And... the men who took it wore a sigil. I've seen it since, in Blackroot Crypt.",
        },
        {
          id: 'crypt_lady', ask: 'Tell me about the crypt.', after: 'lake_bell',
          offer: "Morwen. She was one of us. Then a woman in white came from the Tower of Glass and taught her things no one should know. Now she sits in Blackroot Crypt, southwest of the Vale, raising the dead for her masters. End it. Please.",
          reminder: 'Blackroot Crypt lies deep in the dark forest, southwest of the Vale. Take light. Take courage.',
          done: "It's over, then. The Tower's sigil, on the back of hers... they're gathering, aren't they. The same ones who want you. Go carefully, friend.",
        },
      ],
    }),
    questChain: [['lake_bell'], ['crypt_lady', 'lake_bell']],
    opts: look({ skin: 0xe0b18c, shirt: 0xe6e0d2, hair: 0x8a8a8a, hairStyle: 'bald', beard: true }),
    name: (g) => (g.flags.met_aldo ? 'Brother Aldo' : 'the chapel brother'),
  },

  // ---- Fenwick ----
  gorm: {
    tree: (g) => townTree(g, 'gorm', {
      intro: "Wipe your boots. Actually don't, everyone's boots are wet here. The Sodden Boot. Gorm. What'll it be?",
      again: ['Wet out?', 'It is always wet out.', 'Stew. Bog-standard. Get it? Nobody gets it.'],
      lines: [
        'The Mirefen swallows carts, horses, and the occasional tax collector. We don\'t miss the tax collector.',
        "Old Wick knows more about potions than any priest. She's also probably a witch. Nice woman.",
      ],
      shop: true, inn: 'fenwick',
      quests: [{
        id: 'warren', ask: 'Anything troubling Fenwick?',
        offer: "Slimes. The Bog Warren's full of them, west of town, and they're coming up the drains. Found one in the ale cellar. It had drunk a barrel. Go in there and thin them out, and I'll give you the best marsh cloak in the Mirefen.",
        reminder: 'The Bog Warren, west of Fenwick. You want at least eight of the things gone.',
        done: "The drains are quiet! You're a hero of Fenwick, which is a small and damp honour. Here, a Fenwalker cloak. Waxed. You'll never be dry again, but you'll be less wet.",
      }],
    }),
    shop: 'gorm', questChain: [['warren']],
    opts: look({ skin: 0xc98f6a, shirt: 0x5a5a3a, hair: 0x3a2a1a, hairStyle: 'buzzed', beard: true }),
    name: (g) => (g.flags.met_gorm ? 'Gorm' : 'the innkeeper'),
  },
  wick: {
    tree: (g) => townTree(g, 'wick', {
      intro: "Well now. A sky-fallen one, in my little shop. Don't look so surprised, dear; the frogs talk. Old Wick. Remedies, tonics, and the occasional curse, removed or applied.",
      again: ['The frogs said you\'d come back.', 'Mind the cauldron.', 'Buying, dear?'],
      lines: [
        "Slime gel is wonderful stuff. It binds a draught like nothing else. Don't ask me what else it binds.",
        "The stones in the Vale are older than the kingdom. Older than the Tower. They are a door, dear. Everyone forgets that.",
      ],
      shop: true,
      quests: [{
        id: 'wicks_brew', ask: 'Can you teach me anything?',
        offer: "Teach? No. Brew? Yes. Six lumps of slime gel and three moonpetals, and I'll make you greater draughts, the kind that put your insides back where they belong.",
        reminder: 'Six slime gel, three moonpetals. The slimes are everywhere; the petals grow in the Vale meadow.',
        done: "Lovely, lovely. A pinch of this, a stir of that... there. Three greater draughts. Drink them only when you're dying, dear. They taste like it.",
      }],
    }),
    shop: 'wick', questChain: [['wicks_brew']],
    opts: look({ gender: 'female', skin: 0xb8a890, shirt: 0x3a4a2a, hair: 0xc8c8c8, hairStyle: 'long' }),
    name: (g) => (g.flags.met_wick ? 'Old Wick' : 'the herbalist'),
  },

  // ---- Oldgate ----
  ilsa: {
    tree: (g) => townTree(g, 'ilsa', {
      intro: "Warden Ilsa. I keep what law there is between here and the ruins. Not much, some days. You're the one from the stones. Good. I could use someone who doesn't know better.",
      again: ['Report.', 'Still breathing? Good.', "The roads aren't getting any safer on their own."],
      lines: [
        "The old kingdom fell four hundred years ago. It left us its ruins, its dead, and its gold. The bandits want the gold. The dead want everything else.",
        'Rook has thirty blades, maybe more. He answers to somebody. I want to know who.',
      ],
      quests: [
        {
          id: 'crow_tokens', ask: 'Is there work?',
          offer: "Rook's bandits carry tin crow tokens. Proof of membership. Bring me five and I'll pay you for each one, and I'll know how many fewer bandits are on my roads.",
          reminder: 'Five crow tokens. Bandits carry them. You know how to get them.',
          done: 'Five crows. Good work. Here\'s the bounty. Now, if you want the real prize...',
        },
        {
          id: 'rook', ask: 'Tell me about Rook.', after: 'crow_tokens',
          offer: "Rook hides in the Sunder Catacombs, west of here in the ruins. He keeps a ledger: every job, every payer. Kill him and bring it to me. I want to know who pays a bandit king to watch the roads.",
          reminder: 'The Sunder Catacombs, west of Oldgate. Bring me Rook\'s ledger.',
          done: "Let me see that. ...Payments from the Tower of Glass. 'Watch the roads for one who fell from the sky. Do not harm. Report.' A woman in white signed for it. Someone's been watching you since the day you woke, friend. Take this greatsword. You'll need it.",
        },
        {
          id: 'barrow_king', ask: 'Anything else stirring out there?', after: 'rook',
          offer: "The Barrow Downs, northeast of here. The old kings are buried there, and they've stopped staying buried. Something is calling them up. Find the Barrow King and put him down for good.",
          reminder: 'The Barrow of the Old Kings, on the downs northeast of Oldgate. Find the king.',
          done: "His crown... the same tower mark, scratched inside the rim. Whatever the Tower of Glass is doing, it's waking the dead to do it. Here. You've earned this, and a great deal more.",
        },
      ],
    }),
    questChain: [['crow_tokens'], ['rook', 'crow_tokens'], ['barrow_king', 'rook']],
    opts: { ...look({ gender: 'female', outfit: 'ranger', skin: 0xd9a883, shirt: 0x5a3a2a, hair: 0x6a2a1a, hairStyle: 'buns' }), idle: 'foldArms' },
    name: (g) => (g.flags.met_ilsa ? 'Warden Ilsa' : 'the warden'),
  },
  hobb: {
    tree: (g) => townTree(g, 'hobb', {
      intro: "The Last Lamp. Last inn before the ruins, last warm bed for fifty miles, last chance to reconsider. Hobb. Sit.",
      again: ['Reconsidered?', 'Sit.', 'Soup?'],
      lines: [
        "Treasure hunters come through every week, heading for the ruins. About half come back through.",
        "The Sunder Keep ruin, east of here, is where Rook's lot rob travellers. Walk around it.",
      ],
      shop: true, inn: 'oldgate',
    }),
    shop: 'hobb',
    opts: look({ skin: 0xe0b18c, shirt: 0x6b4a3a, hair: 0x8a8a8a, hairStyle: 'bald', beard: true }),
    name: (g) => (g.flags.met_hobb ? 'Hobb' : 'the innkeeper'),
  },
  quill: {
    tree: (g) => townTree(g, 'quill', {
      intro: "Relics and Rarities! Everything here is genuine old kingdom work. Most of it. Some of it. Quill. Buying, selling, or appraising?",
      again: ['Buying?', "Found anything shiny in the ruins? I'll take it.", 'Genuine antiques!'],
      lines: [
        "The old kingdom's greatswords are the finest ever made. I re-edge them myself. Mostly I re-edge them myself.",
        "The Barrow Downs have burial gold. Also burial occupants. That's the catch.",
      ],
      shop: true,
    }),
    shop: 'quill',
    opts: look({ skin: 0xf0c49e, shirt: 0x4a2f6b, hair: 0x3a2a1a, hairStyle: 'parted' }),
    name: (g) => (g.flags.met_quill ? 'Quill' : 'the dealer'),
  },
};

// Townsfolk in the frontier towns: [name, gender, lines].
export const FRONTIER_RESIDENTS = {
  orla: ['Orla', 'female', ["My husband's a miner. Was. Is. Until the imps are gone, he's a man who sits by the fire and complains.", 'Snow by next week. There\'s always snow by next week.']],
  teodor: ['Teodor', 'male', ["I saw the dragon once. Wings like sails, and a roar that shook the snow off the roofs. I didn't sleep for a month.", 'Frost Tarn, west of town, freezes solid in winter. Good skating.']],
  hobart: ['Hobart', 'male', ["Best apples in the land, Amberly. Don't let anyone from Thornbury tell you otherwise.", "Puglins got into my barn again. Ate a whole wheel of cheese. And the barn cat."]],
  rosalind: ['Rosalind', 'female', ["The Fox Shrine used to be a place for weddings. Then the bandits moved in. Now it's a place for robberies.", "Marta's cider could raise the dead. Not literally. I hope."]],
  petra: ['Petra', 'female', ["My brother fishes the far shore. He says there are lights under the water some nights.", 'The herons know when rain\'s coming. Watch them.']],
  ewan: ['Ewan', 'male', ["They say the lake has no bottom. I've dropped a rope two hundred feet. Still no bottom.", 'Aldo rings a hand bell every morning, pretending. It\'s sad, really.']],
  mags: ['Mags', 'female', ["Don't walk the fen at night. The will-o'-wisps lead you into the pools. Also the bats.", 'Wick cured my gout with a frog and a song. I don\'t ask.']],
  jory: ['Jory', 'male', ["The Drowned Arches, north of here: an old kingdom bridge, half sunk. Slimes love it.", "Everything in Fenwick is damp. The bread. The beds. My soul."]],
  edda: ['Edda', 'female', ["The Warden's a hard woman, but fair. The bandits are neither.", "My da found a gold cup in the Barrow Downs. Something followed him home. We moved."]],
  corwen: ['Corwen', 'male', ["I was a treasure hunter. Then I went into the Catacombs. Now I'm a baker.", 'Sunder Keep used to guard the old road. Now it guards Rook\'s loot.']],
};
