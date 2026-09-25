// Dialogue trees are plain objects: node -> { text, onEnter?, options }.
// text/options may be functions so they can react to game state. An option with next: null ends the conversation.
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const bye = { text: 'Goodbye.', next: null };

export function wandererTree(g) {
  const q = g.quests;
  const hub = () => [
    { text: "I've dealt with the slimes.", next: 'slimes_done', if: () => q.isReady('slimes') },
    { text: 'I brought the pelts.', next: 'pelts_done', if: () => q.isReady('pelts') },
    { text: 'The stones... I remember now.', next: 'reveal', if: () => g.flags.chapter1 && !g.flags.toldOswin },
    { text: 'Who are you?', next: 'who', if: () => !g.flags.knowsName },
    { text: 'Where am I?', next: 'where', if: () => !g.flags.askedWhere },
    { text: "I can't remember anything. Not even my name.", next: 'amnesia', if: () => !g.flags.askedAmnesia },
    { text: 'Is there anything I can do for you?', next: 'slimes_offer', if: () => !q.status('slimes') },
    { text: 'Need anything else?', next: 'pelts_offer', if: () => q.isDone('slimes') && !q.status('pelts') },
    { text: 'Could you brew something from these moonpetals? (3)', next: 'brew', if: () => g.inventory.count('herb') >= 3 },
    { text: 'Is there anywhere else nearby?', next: 'village' },
    { text: 'Where should I go now?', next: 'advice' },
    { text: 'Goodbye.', next: null },
  ];

  return {
    greet: {
      text: () => {
        if (!g.flags.metOswin) {
          return "Easy, easy. You're awake. I wasn't sure you'd ever get up. I saw you come down last night: a streak of white light, straight out of the sky and into that field.";
        }
        if (g.flags.chapter1) return `${g.playerName}. The stones have gone quiet again. Sit a while, if you like.`;
        return pick([
          'Back again. The meadow treating you kindly?',
          "Fire's warm. Sit, if you've a mind to.",
          'Still in one piece, I see. Good.',
        ]);
      },
      onEnter: () => {
        g.flags.metOswin = true;
        g.bump('talk:wanderer');
      },
      options: hub,
    },
    hub: { text: 'Anything else?', options: hub },

    who: {
      text: "Oswin. I walk the old roads and sleep wherever the fire's warm. Nobody important, which in these parts is the safest thing to be.",
      onEnter: () => (g.flags.knowsName = true),
      options: hub,
    },
    where: {
      text: 'The Hollow Meadow. Nobody farms it anymore, not since the stones on the north hill went dark. Last night they hummed for the first time in living memory. Then you fell.',
      onEnter: () => (g.flags.askedWhere = true),
      options: hub,
    },
    amnesia: {
      text: "Hm. That's the way of it, sometimes, with things that come through the stones. But listen: when you fell, little blue lights scattered across the meadow like sparks off a forge. Three of them. If I were missing something, that's where I'd start looking.",
      onEnter: () => (g.flags.askedAmnesia = true),
      options: [
        { text: 'Did you see anyone else?', next: 'anyone' },
        { text: "I'll look for them.", next: 'hub' },
      ],
    },
    village: {
      text: "Millbrook. Follow the dirt path south from where you woke; you'll smell the bread before you see the roofs. Tam at the Fallen Star will give you a bed, and Brenna at the smithy can put something better than rust in your hand.",
      options: hub,
    },
    anyone: {
      text: "Only the slimes, and they don't talk much. There are wolves in the pinewoods past the meadow's edge, too. Keep to the open grass until you've a blade in your hand.",
      options: hub,
    },

    slimes_offer: {
      text: "The slimes have been thick since the stones woke. Harmless one at a time, but they keep creeping toward my fire. Thin them out, five should do it, and I'll make it worth your while.",
      options: [
        { text: 'Consider it done.', next: 'accept', do: () => g.quests.start('slimes') },
        { text: 'Maybe later.', next: 'hub' },
      ],
    },
    accept: { text: 'Good. Mind the big ones. They bounce.', options: hub },
    slimes_done: {
      text: "Five fewer slimes? You've a knack for this. Here: two draughts, brewed with moonpetal. Don't drink them all at once.",
      onEnter: () => g.quests.complete('slimes'),
      options: hub,
    },

    pelts_offer: {
      text: "The wolves in the pinewoods have grown bold. Bring me three good pelts and I'll stitch you a proper cloak. That rag you're wearing won't keep out a draft.",
      options: [
        { text: "I'll bring them.", next: 'accept_pelts', do: () => g.quests.start('pelts') },
        { text: 'Not yet.', next: 'hub' },
      ],
    },
    accept_pelts: { text: 'Go carefully. They hunt in pairs, and they see better at night than you do.', options: hub },
    pelts_done: {
      text: "Fine pelts. Give me a moment... there. It's not pretty, but it'll turn a claw.",
      onEnter: () => g.quests.complete('pelts'),
      options: hub,
    },

    brew: {
      text: 'Three moonpetals, a splash of water, a little patience... There. One Healing Draught.',
      onEnter: () => {
        g.inventory.remove('herb', 3);
        g.giveItem('potion', 1);
      },
      options: hub,
    },

    advice: {
      text: () => {
        if (!q.status('echoes') && !q.isDone('echoes')) return 'Look around the spot where you woke. Things that fall tend to scatter.';
        if (q.isActive('echoes') && g.counter('shard') < 3) {
          return 'Those blue lights. One came down north of here, by the big lone oak. Another by the pond to the southeast. The last went west, toward the trees. Follow the beams of light.';
        }
        if (q.isActive('stones')) return "The north hill. The stones. Whatever you left behind, it's waiting up there.";
        if (g.quests.isActive('grey1')) return 'That man in grey... Tam at the Fallen Star in Millbrook sees everyone who passes through. Start with her.';
        if (g.quests.isActive('grey2')) return "Old coins? Thornbury, southeast along the road from Millbrook. There's a curio dealer there who collects oddities.";
        if (g.quests.isActive('grey3')) return 'Greywatch is the garrison past the stones, to the northwest. Captain Hale runs it. Hard man, fair man.';
        if (g.quests.isActive('grey4')) return 'The Sunken Vault lies north of Greywatch. Take a lantern. Take two.';
        if (g.flags.chapter2) return "You've grown, since that morning in the grass. Whatever's coming, I think you'll be ready.";
        if (g.flags.chapter1) return "The world's wide, and you've only seen a meadow of it. Four towns in this valley, and caves under the hills. Go and look.";
        return 'Rest by my fire whenever you need it. Nothing out there will follow you in.';
      },
      options: hub,
    },

    reveal: {
      text: 'So. You remember.',
      options: () => [{ text: `My name is ${g.hero.name}.`, next: 'reveal2' }],
    },
    reveal2: {
      text: () => `${g.hero.name}. A good name for someone who fell out of the sky. Whatever's looking for you won't find you tonight. Sit. Rest. Tomorrow, the road.`,
      onEnter: () => (g.flags.toldOswin = true),
      options: hub,
    },
  };
}

export function brennaTree(g) {
  const hub = () => [
    { text: 'What other stranger?', next: 'grey', if: () => !g.flags.heardGrey },
    { text: 'That sword on your rack...', next: 'sword', if: () => g.interactions.has('rack_sword') },
    { text: 'Show me what you have for sale.', next: null, do: () => g.openShop('brenna') },
    { text: 'Where else could I find a weapon?', next: 'weapons' },
    bye,
  ];
  return {
    greet: {
      text: () => (!g.flags.metBrenna
        ? "Another stranger in Millbrook? That's two this week. The other one didn't buy anything either. Brenna. I make things sharp."
        : pick(["Back again? Mind the anvil, it bites.", "Iron doesn't beat itself. What is it?", "Still got all your fingers? Good."])),
      onEnter: () => (g.flags.metBrenna = true),
      options: hub,
    },
    hub: { text: 'Anything else?', options: hub },
    grey: {
      text: "Tall fellow. Grey coat, grey eyes, not a speck of mud on his boots. Asked if anything had fallen out of the sky lately. I told him the only thing that falls around here is the price of iron.",
      onEnter: () => (g.flags.heardGrey = true),
      options: hub,
    },
    sword: {
      text: "Good iron, that. I made it for a man who paid up front and never came back for it. Twelve years it's hung there. Funny thing... he had a look about him a bit like yours. Take it. It's waited long enough.",
      onEnter: () => (g.flags.brennaOffered = true),
      options: hub,
    },
    weapons: {
      text: "There's an old woodcutter's axe stuck in a stump just off the north path. Hits like a mule, swings like one too. And there's a hunter's spear out west, at the edge of the pinewoods. The hunter never came back for it. Wolves. A spear's got reach, though.",
      options: hub,
    },
  };
}

export function tamTree(g) {
  const q = g.quests;
  const hub = () => [
    { text: "I've brought the moonpetals.", next: 'petals_done', if: () => q.isReady('petals') },
    { text: 'Tell me about the man in grey.', next: 'grey', if: () => q.isActive('grey1') || (g.flags.heardGrey && !g.flags.tamGrey) },
    { text: "What's on the menu?", next: null, do: () => g.openShop('tam') },
    { text: 'Could I rest here?', next: 'rest' },
    { text: 'What do you know about the stones on the hill?', next: 'stones' },
    { text: 'Do you need help with anything?', next: 'petals_offer', if: () => !q.status('petals') },
    bye,
  ];
  return {
    greet: {
      text: () => (!g.flags.metTam
        ? "Welcome to Millbrook, traveller. I'm Tam. I keep the inn, the well, and most of the gossip. You'll be the one who fell, then. Whole village saw the light."
        : pick(['Back at the Fallen Star! What can I do for you?', "Stew's on. It's always on.", 'You look tired. Everyone who comes through here looks tired.'])),
      onEnter: () => (g.flags.metTam = true),
      options: hub,
    },
    hub: { text: 'Anything else, love?', options: hub },
    rest: {
      text: "A bed's yours whenever you want it. Nobody pays at the Fallen Star, least of all someone the sky dropped on us.",
      options: [
        { text: 'Rest for a while. (Heal and save)', next: null, do: () => g.rest('millbrook') },
        { text: 'Maybe later.', next: 'hub' },
      ],
    },
    stones: {
      text: "Half the village sat up all night listening to them hum. My grandmother used to say the circle was a door. 'Doors open both ways,' she'd say. That was the part that worried her.",
      options: hub,
    },
    petals_offer: {
      text: "Moonpetals. The pale purple flowers out in the meadow. They make a stew that'll cure anything short of death, and I'm fresh out. Bring me five and I'll make it worth the walk.",
      options: [
        { text: "I'll find some.", next: 'hub', do: () => q.start('petals') },
        { text: 'Not right now.', next: 'hub' },
      ],
    },
    petals_done: {
      text: "Oh, these are lovely. Here, two draughts from the cellar, and there'll be a hot bowl waiting whenever you pass through.",
      onEnter: () => q.complete('petals'),
      options: hub,
    },
    grey: {
      text: () => (q.isActive('grey1')
        ? "Stayed one night. Paid in coin nobody's seen minted in a hundred years. Left before dawn, walking north toward the stones. The dogs wouldn't go near him. Dogs know things. Here, take one of his coins. I don't want it in my till. If anyone can tell you where it's from, it's Marisol, the curio dealer in Thornbury."
        : "Stayed one night. Paid in coin nobody's seen minted in a hundred years. Left before dawn, walking north toward the stones. The dogs wouldn't go near him. Dogs know things."),
      onEnter: () => {
        g.flags.tamGrey = true;
        if (q.isActive('grey1')) {
          if (!g.inventory.has('old_coin')) g.giveItem('old_coin');
          g.bump('clue:tam');
        }
      },
      options: hub,
    },
  };
}

export function pipTree(g) {
  const done = () => [bye];
  return {
    greet: {
      text: () => (!g.flags.metPip
        ? "Are you the one who fell out of the sky? Oswin says you did. Did it hurt? I'm Pip."
        : pick([
          "Did you fight any wolves yet? I'd fight a wolf.",
          "Brenna says I'm not allowed to touch the swords. You're allowed, though.",
          "Tam's stew is the best. Don't tell my mum.",
          'I can hold my breath for a whole minute. Watch. ...Okay, not a whole minute.',
        ])),
      onEnter: () => (g.flags.metPip = true),
      options: () => (g.flags.pipAnswered ? done() : [
        { text: 'A little.', next: 'hurt' },
        { text: "I don't remember.", next: 'forget' },
      ]),
    },
    hurt: { text: "I KNEW it. I'm telling everyone.", onEnter: () => (g.flags.pipAnswered = true), options: done },
    forget: {
      text: "That's okay. I don't remember being a baby either, and Mum says I definitely was one.",
      onEnter: () => (g.flags.pipAnswered = true),
      options: done,
    },
  };
}
