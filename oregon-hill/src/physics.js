// Circle-vs-AABB collision on a spatial hash, plus raised ground slabs.
export function initPhysics(world) {
  const CELL = 16;
  const grid = new Map();
  const key = (cx, cz) => cx * 73856093 + cz * 19349663;
  world.colliders.forEach((c, i) => {
    c._s = 0;
    for (let cx = Math.floor(c.x0 / CELL); cx <= Math.floor(c.x1 / CELL); cx++)
      for (let cz = Math.floor(c.z0 / CELL); cz <= Math.floor(c.z1 / CELL); cz++) {
        const k = key(cx, cz);
        let a = grid.get(k);
        if (!a) grid.set(k, (a = []));
        a.push(c);
      }
  });
  world.dynCols = [];
  let stamp = 0;

  function resolve(pos, r, c) {
    const qx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const qz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - qx;
    const dz = pos.z - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      const push = r - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
    } else {
      const l = pos.x - c.x0;
      const rr = c.x1 - pos.x;
      const t = pos.z - c.z0;
      const b = c.z1 - pos.z;
      const m = Math.min(l, rr, t, b);
      if (m === l) pos.x = c.x0 - r;
      else if (m === rr) pos.x = c.x1 + r;
      else if (m === t) pos.z = c.z0 - r;
      else pos.z = c.z1 + r;
    }
    return true;
  }

  world.collide = (pos, r = 0.35) => {
    let hit = false;
    for (let it = 0; it < 2; it++) {
      stamp++;
      for (let cx = Math.floor((pos.x - r) / CELL); cx <= Math.floor((pos.x + r) / CELL); cx++)
        for (let cz = Math.floor((pos.z - r) / CELL); cz <= Math.floor((pos.z + r) / CELL); cz++) {
          const a = grid.get(key(cx, cz));
          if (!a) continue;
          for (const c of a) {
            if (c._s === stamp) continue;
            c._s = stamp;
            if (resolve(pos, r, c)) hit = true;
          }
        }
      for (const c of world.dynCols) if (c.on !== false && resolve(pos, r, c)) hit = true;
    }
    return hit;
  };

  world.blocked = (x, z, r = 0.4) => {
    const p = { x, z };
    return world.collide(p, r) || Math.abs(p.x - x) > 0.01 || Math.abs(p.z - z) > 0.01;
  };

  world.cameraHit = (x, y, z) => {
    const a = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (a) for (const c of a) if (x > c.x0 - 0.2 && x < c.x1 + 0.2 && z > c.z0 - 0.2 && z < c.z1 + 0.2 && y < c.h + 0.3) return true;
    return false;
  };

  world.groundY = (x, z) => {
    for (const s of world.slabs) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s.y;
    return 0;
  };
}
