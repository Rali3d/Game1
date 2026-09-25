// Dialogue trees are plain objects: node -> { text, onEnter?, options }.
// text/options may be functions so they can react to game state. An option with next: null ends the conversation.
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
        if (g.flags.chapter1) return "The world's wide, and you've only seen a meadow of it. But that's a story for another day.";
        return 'Rest by my fire whenever you need it. Nothing out there will follow you in.';
      },
      options: hub,
    },

    reveal: {
      text: 'So. You remember.',
      options: [{ text: 'My name is Aren.', next: 'reveal2' }],
    },
    reveal2: {
      text: "Aren. A good name for someone who fell out of the sky. Whatever's looking for you won't find you tonight. Sit. Rest. Tomorrow, the road.",
      onEnter: () => (g.flags.toldOswin = true),
      options: hub,
    },
  };
}
