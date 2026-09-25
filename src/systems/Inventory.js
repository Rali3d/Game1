import { events } from '../engine/EventBus.js';

export class Inventory {
  constructor() {
    this.items = {}; // id -> count
  }

  add(id, n = 1) {
    this.items[id] = (this.items[id] || 0) + n;
    events.emit('inventory:changed');
  }

  remove(id, n = 1) {
    if (!this.items[id]) return false;
    this.items[id] -= n;
    if (this.items[id] <= 0) delete this.items[id];
    events.emit('inventory:changed');
    return true;
  }

  count(id) {
    return this.items[id] || 0;
  }

  has(id) {
    return this.count(id) > 0;
  }

  entries() {
    return Object.entries(this.items);
  }

  load(items) {
    this.items = { ...items };
    events.emit('inventory:changed');
  }
}
