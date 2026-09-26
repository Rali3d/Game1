// The outdoor world's colliders in a spatial grid, so a collision check only looks at what's nearby
// instead of every tree in the land. Circles are { x, z, r }; boxes are { x, z, hw, hd, rot }.
// Colliders marked `dynamic` (NPCs, animals) move every frame, so they're kept in a short separate list.
export class ColliderSet {
  constructor(cell = 16) {
    this.cell = cell;
    this.cells = new Map();
    this.dynamic = [];
    this.stamp = 0;
  }

  key(i, j) {
    return i * 100003 + j;
  }

  reach(c) {
    return c.hw !== undefined ? Math.hypot(c.hw, c.hd) : c.r;
  }

  push(...list) {
    for (const c of list) {
      if (c.dynamic) {
        this.dynamic.push(c);
        continue;
      }
      const r = this.reach(c), s = this.cell;
      c._cells = [];
      for (let i = Math.floor((c.x - r) / s); i <= Math.floor((c.x + r) / s); i++) {
        for (let j = Math.floor((c.z - r) / s); j <= Math.floor((c.z + r) / s); j++) {
          const k = this.key(i, j);
          if (!this.cells.has(k)) this.cells.set(k, []);
          this.cells.get(k).push(c);
          c._cells.push(k);
        }
      }
    }
    return this.dynamic.length;
  }

  remove(c) {
    if (c.dynamic) {
      const i = this.dynamic.indexOf(c);
      if (i >= 0) this.dynamic.splice(i, 1);
      return;
    }
    for (const k of c._cells ?? []) {
      const list = this.cells.get(k);
      const i = list?.indexOf(c) ?? -1;
      if (i >= 0) list.splice(i, 1);
    }
  }

  // Calls fn(collider) once for every collider that might touch a circle of radius r at (x, z).
  near(x, z, r, fn) {
    const s = this.cell, stamp = ++this.stamp;
    for (let i = Math.floor((x - r) / s); i <= Math.floor((x + r) / s); i++) {
      for (let j = Math.floor((z - r) / s); j <= Math.floor((z + r) / s); j++) {
        const list = this.cells.get(this.key(i, j));
        if (!list) continue;
        for (const c of list) {
          if (c._seen === stamp) continue;
          c._seen = stamp;
          fn(c);
        }
      }
    }
    for (const c of this.dynamic) fn(c);
  }
}
