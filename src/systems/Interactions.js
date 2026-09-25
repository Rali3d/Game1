// Things the player can press E on. Each entry:
//   { id, position: {x,y,z}, radius, label: () => string|null, onUse: () => void, prop?, onRemove? }
// `prop` is removed from the world with the interaction; onRemove handles partial removal instead.
// A null label hides the prompt (the object is currently not interactable).
export class Interactions {
  constructor(world) {
    this.world = world;
    this.items = [];
  }

  add(def) {
    this.items.push(def);
    return def;
  }

  remove(id) {
    const i = this.items.findIndex((it) => it.id === id);
    if (i < 0) return;
    const [it] = this.items.splice(i, 1);
    if (it.prop) this.world.remove(it.prop);
    it.onRemove?.();
  }

  has(id) {
    return this.items.some((it) => it.id === id);
  }

  nearest(pos) {
    let best = null, bestD = Infinity;
    for (const it of this.items) {
      const d = Math.hypot(pos.x - it.position.x, pos.z - it.position.z);
      if (d < it.radius && d < bestD && Math.abs(pos.y - it.position.y) < 3 && it.label()) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }
}
