import { QUESTS } from './quests.js';

// Building blocks for dialogue trees.
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const bye = { text: 'Goodbye.', next: null };

// Someone with a line or two of small talk.
export function barkTree(g, id, lines) {
  return {
    greet: { text: () => pick(lines), onEnter: () => (g.flags[`met_${id}`] = true), options: [bye] },
  };
}

// A shopkeeper: greeting, their wares, some local news, and goodbye. `extra` adds options before goodbye.
export function keeperTree(g, id, { intro, again, lines }, extra = () => [], nodes = {}) {
  const hub = () => [
    ...extra(),
    { text: 'Show me your wares.', next: null, do: () => g.openShop(id) },
    { text: 'Heard any news?', next: 'news' },
    bye,
  ];
  return {
    greet: {
      text: () => (g.flags[`met_${id}`] ? pick(again) : intro),
      onEnter: () => (g.flags[`met_${id}`] = true),
      options: hub,
    },
    hub: { text: 'Anything else?', options: hub },
    news: { text: () => pick(lines), options: hub },
    ...nodes,
  };
}

// Quests someone hands out, in order. Each entry: { id, ask, offer, reminder, done, after?, if? }.
// `after` is a quest that must be finished first; `if` any other condition. Returns the options to offer
// and the dialogue nodes they lead to, for mixing into a tree.
export function questDialogue(g, chain) {
  const q = g.quests;
  const available = (c) => !q.status(c.id) && (!c.after || q.isDone(c.after)) && (c.if?.() ?? true);
  const options = () => chain.flatMap((c) => {
    if (q.isReady(c.id)) return [{ text: `(${QUESTS[c.id].title}) It's done.`, next: `${c.id}_done` }];
    if (q.isActive(c.id)) return [{ text: `About "${QUESTS[c.id].title}"...`, next: `${c.id}_remind` }];
    if (available(c)) return [{ text: c.ask, next: `${c.id}_offer` }];
    return [];
  });
  const nodes = {};
  for (const c of chain) {
    nodes[`${c.id}_offer`] = {
      text: c.offer,
      options: [
        { text: c.accept ?? "I'll do it.", next: 'hub', do: () => q.start(c.id) },
        { text: 'Not now.', next: 'hub' },
      ],
    };
    nodes[`${c.id}_remind`] = { text: c.reminder, options: () => [{ text: 'Right.', next: 'hub' }] };
    nodes[`${c.id}_done`] = { text: c.done, onEnter: () => q.complete(c.id), options: () => [{ text: 'Glad to help.', next: 'hub' }] };
  }
  // Something new to offer or collect: shown as a "!" over their head.
  const news = () => chain.some((c) => q.isReady(c.id) || available(c));
  return { options, nodes, news };
}

// The general shape of most townsfolk with business: an intro, their quests, their shop, a bed if it's an
// inn, some news, and goodbye.
export function townTree(g, id, { intro, again, lines, quests = [], shop = false, inn = null, extra = () => [] }) {
  const qd = questDialogue(g, quests);
  const hub = () => [
    ...qd.options(),
    ...extra(),
    ...(shop ? [{ text: 'Show me your wares.', next: null, do: () => g.openShop(id) }] : []),
    ...(inn ? [{ text: 'Could I rent a bed? (Heal and save)', next: null, do: () => g.rest(inn) }] : []),
    { text: 'Heard any news?', next: 'news' },
    bye,
  ];
  return {
    greet: {
      text: () => (g.flags[`met_${id}`] ? pick(again) : intro),
      onEnter: () => (g.flags[`met_${id}`] = true),
      options: hub,
    },
    hub: { text: 'Anything else?', options: hub },
    news: { text: () => pick(lines), options: hub },
    ...qd.nodes,
  };
}
