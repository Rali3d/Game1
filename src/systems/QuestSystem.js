import { QUESTS } from '../data/quests.js';
import { clamp } from '../engine/math.js';
import { events } from '../engine/EventBus.js';

// Tracks quest status (active -> ready -> done) by comparing counters against objective targets.
export class QuestSystem {
  constructor(game) {
    this.g = game;
    this.state = {}; // id -> { status, baseline }
  }

  status(id) {
    return this.state[id]?.status ?? null;
  }
  isActive(id) {
    return this.status(id) === 'active';
  }
  isReady(id) {
    return this.status(id) === 'ready';
  }
  isDone(id) {
    return this.status(id) === 'done';
  }

  start(id) {
    if (this.state[id]) return;
    const q = QUESTS[id];
    const baseline = {};
    for (const o of q.objectives) if (o.fromStart) baseline[o.counter] = this.g.counter(o.counter);
    this.state[id] = { status: 'active', baseline };
    this.g.hud.toast(`<b>New quest:</b> ${q.title}`, 'quest');
    events.emit('quest:started', id);
    this.check();
  }

  progress(id, objective) {
    const base = this.state[id]?.baseline[objective.counter] ?? 0;
    return clamp(this.g.counter(objective.counter) - base, 0, objective.count);
  }

  // Re-evaluate every active quest. Cheap enough to call whenever a counter changes.
  check() {
    for (const [id, st] of Object.entries(this.state)) {
      if (st.status !== 'active') continue;
      const q = QUESTS[id];
      if (!q.objectives.every((o) => this.progress(id, o) >= o.count)) continue;
      if (q.turnIn) {
        st.status = 'ready';
        this.g.hud.toast(`<b>${q.title}</b>: return to ${q.turnInName}`, 'quest');
      } else {
        this.complete(id);
      }
    }
    this.g.hud.trackerDirty = true;
  }

  complete(id) {
    const st = this.state[id];
    if (!st || st.status === 'done') return;
    st.status = 'done';
    const q = QUESTS[id];
    const r = q.rewards || {};
    this.g.hud.toast(`<b>Quest complete:</b> ${q.title}`, 'quest-done');
    for (const [item, n] of Object.entries(r.take || {})) this.g.inventory.remove(item, n);
    if (r.xp) this.g.grantXp(r.xp);
    if (r.coins) this.g.giveCoins(r.coins);
    for (const [item, n] of Object.entries(r.items || {})) this.g.giveItem(item, n);
    events.emit('quest:completed', id);
    (q.next || []).forEach((n) => this.start(n));
    this.g.hud.trackerDirty = true;
  }

  readyFor(npc) {
    return Object.keys(this.state).filter((id) => this.state[id].status === 'ready' && QUESTS[id].turnIn === npc);
  }

  // Active and ready quests, shaped for the on-screen tracker and journal.
  list(filter = (st) => st.status !== 'done') {
    return Object.entries(this.state)
      .filter(([, st]) => filter(st))
      .map(([id, st]) => {
        const q = QUESTS[id];
        return {
          id, title: q.title, summary: q.summary, status: st.status, turnInName: q.turnInName,
          objectives: q.objectives.map((o) => ({ text: o.text, have: this.progress(id, o), need: o.count })),
        };
      });
  }

  serialize() {
    return JSON.parse(JSON.stringify(this.state));
  }

  load(state) {
    this.state = state || {};
    this.g.hud.trackerDirty = true;
  }
}
