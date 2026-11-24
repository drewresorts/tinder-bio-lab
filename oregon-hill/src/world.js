// Builds Oregon Hill (satirical geography) plus the interiors.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ps1Material, TEX, scaledBox, colorGeo, rng } from './ps1.js';
import { makeCar, makeDog } from './actors.js';

const KEEP = ['position', 'normal', 'uv', 'color'];

class Batch {
  constructor() {
    this.groups = new Map();
  }
  add(geo, mat, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.clearGroups();
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    if (!g.attributes.color) colorGeo(g, 0xffffff);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const tx = matrix ? matrix.elements[12] : 0;
    const tz = matrix ? matrix.elements[14] : 0;
    const key = mat.uuid + '|' + Math.floor(tx / 64) + ',' + Math.floor(tz / 64);
    let e = this.groups.get(key);
    if (!e) {
      e = { mat, arr: [] };
      this.groups.set(key, e);
    }
    e.arr.push(g);
  }
  build(parent) {
    for (const { mat, arr } of this.groups.values()) {
      const merged = mergeGeometries(arr, false);
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, mat);
      m.matrixAutoUpdate = false;
      parent.add(m);
    }
    this.groups.clear();
  }
}

const M = (x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
  return m;
};

function groundPlane(w, d, s) {
  const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.ceil(w / 8)), Math.max(1, Math.ceil(d / 8)));
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / s, (uv.getY(i) * d) / s);
  return g;
}

function colored(geo, hex) {
  return colorGeo(geo, hex);
}

export const NS = [
  { x: -70, name: 'S Linden St', w: 8 },
  { x: -30, name: 'S Cherry St', w: 8 },
  { x: 10, name: 'S Pine St', w: 8 },
  { x: 50, name: 'S Laurel St', w: 8 },
  { x: 90, name: 'S Belvidere St', w: 12 },
];
export const EW = [
  { z: -80, name: 'W Cary St', w: 10 },
  { z: -40, name: 'Albemarle St', w: 8 },
  { z: 0, name: 'Spring St', w: 8 },
  { z: 40, name: 'Holly St', w: 8 },
];

const STYLES = [
  { wall: '#8a3b2a', trim: '#e8e0cc' },
  { wall: '#7a4a3a', trim: '#f0f0e8', shutter: '#2a3a2a' },
  { wall: '#5a6a7a', trim: '#e8e0cc', kind: 'siding' },
  { wall: '#c8b88a', trim: '#5a3a2a', kind: 'siding' },
  { wall: '#8a9a6a', trim: '#f0e8d0', kind: 'siding', shutter: '#5a2a2a' },
  { wall: '#a85a4a', trim: '#f0e8d8', shutter: '#1a1a1a' },
  { wall: '#6a3a5a', trim: '#e0d8c8' },
  { wall: '#d8d0c0', trim: '#3a4a5a', kind: 'siding' },
];

export function buildWorld(scene) {
  const R = rng(1337);
  const batch = new Batch();
  const world = {
    colliders: [],
    slabs: [],
    lamps: [],
    anchors: {},
    interiors: {},
    curbSpots: [],
    blocks: [],
    memoSpots: {},
    map: { roads: [], blocks: [], parks: [], labels: [] },
    dynamic: [],
    bounds: { x0: -134, x1: 134, z0: -114, z1: 77 },
  };

  const MAT = {
    asphalt: ps1Material({ map: TEX.asphalt(), vertexColors: true }),
    pavers: ps1Material({ map: TEX.pavers(), vertexColors: true }),
    grass: ps1Material({ map: TEX.grass(), vertexColors: true }),
    darkGrass: ps1Material({ map: TEX.grass('#3a5228'), vertexColors: true }),
    dirt: ps1Material({ map: TEX.dirt(), vertexColors: true }),
    roof: ps1Material({ map: TEX.roof(), vertexColors: true }),
    concrete: ps1Material({ map: TEX.concrete(), vertexColors: true }),
    stone: ps1Material({ map: TEX.stone(), vertexColors: true }),
    plain: ps1Material({ vertexColors: true }),
    unlit: ps1Material({ vertexColors: true, unlit: true }),
    leaves: ps1Material({ map: TEX.leaves(), vertexColors: true }),
    canopy: ps1Material({ map: TEX.grass('#3d5a26'), vertexColors: true }),
    fence: ps1Material({ map: TEX.fence(), double: true }),
    chain: ps1Material({ map: TEX.chainlink(), double: true }),
    water: ps1Material({ map: TEX.water(), scroll: new THREE.Vector2(0.015, 0.04) }),
    facades: STYLES.map((s) => ps1Material({ map: TEX.facade(s), windows: true, vertexColors: true })),
    comm: [
      ps1Material({ map: TEX.commercial('#3a3a44', '#c8b080'), windows: true, vertexColors: true }),
      ps1Material({ map: TEX.commercial('#5a2a22', '#e0d0b0'), windows: true, vertexColors: true }),
      ps1Material({ map: TEX.commercial('#2a3a3a', '#d0d0c0'), windows: true, vertexColors: true }),
    ],
    tower: [ps1Material({ map: TEX.tower('#9a968c'), windows: true, vertexColors: true }), ps1Material({ map: TEX.tower('#7a7068'), windows: true, vertexColors: true })],
    doors: ['#5a2a1a', '#1a3a2a', '#2a2a5a', '#8a1a1a', '#1a1a1a'].map((c) => ps1Material({ map: TEX.door(c) })),
    rock: ps1Material({ map: TEX.stone('#6a645a'), vertexColors: true }),
  };
  world.MAT = MAT;

  const addCol = (x0, x1, z0, z1, h = 10) => world.colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), h });
  world.addCol = addCol;

  // --- Base asphalt ground for the whole hill --------------------------------
  batch.add(groundPlane(270, 196, 6), MAT.asphalt, M(0, 0, -18));
  world.map.roads.push({ x0: -74, x1: 135, z0: -115, z1: 78 });

  // --- Lane markings -------------------------------------------------------
  const yellow = colored(new THREE.BoxGeometry(0.15, 0.02, 3), 0xd8b030);
  for (let z = -112; z < 44; z += 5) {
    batch.add(yellow, MAT.unlit, M(89.85, 0.02, z));
    batch.add(yellow, MAT.unlit, M(90.15, 0.02, z));
  }
  const white = colored(new THREE.BoxGeometry(0.6, 0.02, 3.2), 0xd8d8d0);
  for (const s of NS)
    for (const e of EW) {
      if (R() < 0.5) continue;
      for (let i = -3; i <= 3; i++) batch.add(white, MAT.unlit, M(s.x + i * 1.1, 0.02, e.z + e.w / 2 + 1.9));
    }

  // --- Helpers ---------------------------------------------------------------
  const slab = (x0, x1, z0, z1, mat, y = 0.15, s = 2) => {
    const w = x1 - x0;
    const d = z1 - z0;
    batch.add(scaledBox(w, y, d, s), mat, M((x0 + x1) / 2, y / 2, (z0 + z1) / 2));
    world.slabs.push({ x0, x1, z0, z1, y });
  };

  const reserved = []; // points where props shouldn't go
  const isReserved = (x, z, r = 3) => reserved.some((p) => Math.hypot(p.x - x, p.z - z) < r);

  function signMesh(text, opts, w, h) {
    const mat = ps1Material({ map: TEX.sign(text, opts), unlit: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    scene.add(m);
    return m;
  }

  // facing: W => front faces -x, E => +x, N => -z, S => +z
  const FACE_ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
  const FACE_VEC = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };

  function building(o) {
    // o: front (coord of front line), along (center along the street), w, d, h, facing, mat, base
    const { front, along, w, d, h, facing } = o;
    const base = o.base ?? 0.15;
    const [fx, fz] = FACE_VEC[facing];
    let cx, cz, sx, sz;
    if (facing === 'W' || facing === 'E') {
      sx = d;
      sz = w;
      cx = front - (fx * d) / 2;
      cz = along;
    } else {
      sx = w;
      sz = d;
      cz = front - (fz * d) / 2;
      cx = along;
    }
    batch.add(scaledBox(sx, h, sz, 3), o.mat, M(cx, base + h / 2, cz));
    // roof cap + cornice
    batch.add(colored(scaledBox(sx + 0.3, 0.35, sz + 0.3, 2), o.roofColor ?? 0xffffff), MAT.roof, M(cx, base + h + 0.17, cz));
    const trimHex = o.trim ?? 0xe8e0cc;
    const corn = facing === 'W' || facing === 'E' ? new THREE.BoxGeometry(0.4, 0.5, w + 0.3) : new THREE.BoxGeometry(w + 0.3, 0.5, 0.4);
    colored(corn, trimHex);
    const ew = facing === 'W' || facing === 'E';
    batch.add(corn, MAT.plain, M(ew ? front + fx * 0.15 : along, base + h - 0.1, ew ? along : front + fz * 0.15));
    addCol(cx - sx / 2, cx + sx / 2, cz - sz / 2, cz + sz / 2, base + h);
    const rot = FACE_ROT[facing];
    const doorOff = o.doorOff ?? 0;
    // door position on the front face
    const along2 = along + doorOff;
    const dx = facing === 'W' || facing === 'E' ? front + fx * 0.03 : along2;
    const dz = facing === 'W' || facing === 'E' ? along2 : front + fz * 0.03;
    const stoopH = o.stoop === false ? 0 : 0.3;
    if (o.door !== false) {
      const dg = new THREE.PlaneGeometry(1.2, 2.3);
      batch.add(dg, o.doorMat ?? MAT.doors[Math.floor(R() * MAT.doors.length)], M(dx + fx * 0.02, base + stoopH + 1.15, dz + fz * 0.02, rot));
      if (stoopH > 0) {
        const st = facing === 'W' || facing === 'E' ? new THREE.BoxGeometry(1.0, stoopH, 1.8) : new THREE.BoxGeometry(1.8, stoopH, 1.0);
        batch.add(st, MAT.concrete, M(dx + fx * 0.5, base + stoopH / 2, dz + fz * 0.5));
      }
    }
    return { cx, cz, sx, sz, door: new THREE.Vector3(dx + fx * 1.4, 0, dz + fz * 1.4), rot, fx, fz };
  }

  function porch(b, w, facing, trimHex) {
    const { fx, fz } = b;
    const depth = 1.2;
    const front = facing === 'W' || facing === 'E' ? b.cx + (fx * b.sx) / 2 : b.cz + (fz * b.sz) / 2;
    const along = facing === 'W' || facing === 'E' ? b.cz : b.cx;
    const pcx = facing === 'W' || facing === 'E' ? front + (fx * depth) / 2 : along;
    const pcz = facing === 'W' || facing === 'E' ? along : front + (fz * depth) / 2;
    const ps = facing === 'W' || facing === 'E' ? [depth, w - 0.4] : [w - 0.4, depth];
    batch.add(colored(scaledBox(ps[0], 0.55, ps[1], 2), 0xb0a090), MAT.concrete, M(pcx, 0.15 + 0.27, pcz));
    batch.add(colored(new THREE.BoxGeometry(ps[0] + 0.2, 0.18, ps[1] + 0.2), trimHex), MAT.plain, M(pcx, 3.2, pcz));
    for (const s of [-1, 1]) {
      const ox = facing === 'W' || facing === 'E' ? fx * (depth - 0.2) / 2 : (s * (w - 0.8)) / 2;
      const oz = facing === 'W' || facing === 'E' ? (s * (w - 0.8)) / 2 : fz * (depth - 0.2) / 2;
      batch.add(colored(new THREE.BoxGeometry(0.18, 2.5, 0.18), trimHex), MAT.plain, M(pcx + ox, 1.95, pcz + oz));
    }
    addCol(pcx - ps[0] / 2, pcx + ps[0] / 2, pcz - ps[1] / 2, pcz + ps[1] / 2, 0.7);
  }

  function tree(x, z, s = 1, dark = false) {
    const h = 3.4 * s;
    batch.add(colored(new THREE.CylinderGeometry(0.18 * s, 0.26 * s, h, 5), 0x4a3424), MAT.plain, M(x, 0.15 + h / 2, z));
    const c = new THREE.IcosahedronGeometry(2.1 * s, 0);
    const tint = dark ? 0x7a8a7a : [0xffffff, 0xd8e0c0, 0xc0d0a0, 0xe8d8a8][Math.floor(R() * 4)];
    colored(c, tint);
    batch.add(c, MAT.canopy, M(x, 0.15 + h + 1.2 * s, z, R() * 6, 1, 0.85, 1));
    const c2 = new THREE.IcosahedronGeometry(1.4 * s, 0);
    colored(c2, tint);
    batch.add(c2, MAT.canopy, M(x + 0.8 * s, 0.15 + h + 2.2 * s, z - 0.5 * s, R() * 6));
    addCol(x - 0.3, x + 0.3, z - 0.3, z + 0.3, h);
  }
  world.tree = tree;

  function lamp(x, z, armDir = [0, 0]) {
    batch.add(colored(new THREE.BoxGeometry(0.16, 5, 0.16), 0x1e2a22), MAT.plain, M(x, 2.65, z));
    batch.add(colored(new THREE.BoxGeometry(0.1 + Math.abs(armDir[0]) * 0.8, 0.1, 0.1 + Math.abs(armDir[1]) * 0.8), 0x1e2a22), MAT.plain, M(x + armDir[0] * 0.4, 5.1, z + armDir[1] * 0.4));
    batch.add(colored(new THREE.BoxGeometry(0.4, 0.25, 0.4), 0xffe0a0), MAT.unlit, M(x + armDir[0] * 0.8, 4.95, z + armDir[1] * 0.8));
    world.lamps.push(new THREE.Vector3(x + armDir[0] * 0.8, 4.2, z + armDir[1] * 0.8));
    addCol(x - 0.12, x + 0.12, z - 0.12, z + 0.12, 5);
  }

  const signPostTex = TEX.sign('', { bg: '#f0f0f0', fg: '#b01010', w: 64, h: 64, font: 'bold 11px monospace', lines: ['2 HR', 'PARKING', '8AM-6PM', 'EXC.ZONE 1', 'MAYBE'], border: '#b01010' });
  const signPostMat = ps1Material({ map: signPostTex, double: true });
  function parkingSign(x, z, rot) {
    batch.add(colored(new THREE.BoxGeometry(0.07, 2.4, 0.07), 0x808080), MAT.plain, M(x, 1.35, z));
    batch.add(new THREE.PlaneGeometry(0.6, 0.6), signPostMat, M(x, 2.4, z, rot));
  }

  function hydrant(x, z) {
    batch.add(colored(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 6), 0xb02018), MAT.plain, M(x, 0.5, z));
    batch.add(colored(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 6), 0xb02018), MAT.plain, M(x, 0.95, z));
    addCol(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 1);
  }
  function trashcan(x, z) {
    batch.add(colored(new THREE.CylinderGeometry(0.35, 0.3, 1.0, 7), 0x2a4a2a), MAT.plain, M(x, 0.65, z));
    addCol(x - 0.35, x + 0.35, z - 0.35, z + 0.35, 1);
  }

  // --- Oregon Hill residential blocks --------------------------------------
  const specials = []; // {blockId, side, z0, z1, type}
  // home: block between Pine/Laurel and Albemarle/Spring, west side facing Pine
  specials.push({ col: 2, row: 1, side: 'W', a0: -24, a1: -15, type: 'home' });
  specials.push({ col: 1, row: 1, side: 'E', a0: -31, a1: -25, type: 'basement' });
  specials.push({ col: 0, row: 2, side: 'E', a0: 14, a1: 23, type: 'holyghost' });

  const cars = [];

  for (let c = 0; c < NS.length - 1; c++) {
    for (let r = 0; r < EW.length - 1; r++) {
      const x0 = NS[c].x + NS[c].w / 2;
      const x1 = NS[c + 1].x - NS[c + 1].w / 2;
      const z0 = EW[r].z + EW[r].w / 2;
      const z1 = EW[r + 1].z - EW[r + 1].w / 2;
      slab(x0, x1, z0, z1, MAT.pavers);
      world.blocks.push({ x0, x1, z0, z1 });
      world.map.blocks.push({ x0, x1, z0, z1, kind: 'res' });
      const SW = 2.5;
      const D = 10;
      // back yards
      batch.add(groundPlane(x1 - x0 - 2 * SW - 2 * D, z1 - z0 - 2 * SW, 3), MAT.grass, M((x0 + x1) / 2, 0.16, (z0 + z1) / 2));
      // alley fence
      for (const side of ['W', 'E']) {
        const front = side === 'W' ? x0 + SW : x1 - SW;
        const facing = side;
        const sp = specials.filter((s) => s.col === c && s.row === r && s.side === side);
        let a = z0 + SW;
        const aEnd = z1 - SW;
        while (a < aEnd - 2.9) {
          const spec = sp.find((s) => a >= s.a0 - 0.01 && a < s.a1);
          const nextSpec = sp.find((s) => s.a0 > a);
          if (spec) {
            const w = spec.a1 - spec.a0;
            const along = spec.a0 + w / 2;
            makeSpecial(spec.type, front, along, w, D, facing);
            a = spec.a1;
            continue;
          }
          let w = R() < 0.5 ? 6 : 9;
          if (nextSpec && a + w > nextSpec.a0) w = nextSpec.a0 - a;
          if (a + w > aEnd) w = aEnd - a;
          if (w < 3) {
            a += w;
            continue;
          }
          if (R() < 0.12 && w >= 6) {
            // side yard with a tree
            tree(side === 'W' ? front + 3 : front - 3, a + w / 2, 0.9);
            a += w;
            continue;
          }
          const h = R() < 0.6 ? 6 : 9;
          const si = Math.floor(R() * STYLES.length);
          const trimHex = new THREE.Color(STYLES[si].trim).getHex();
          const b = building({ front, along: a + w / 2, w, d: D, h, facing, mat: MAT.facades[si], trim: trimHex, doorOff: (R() - 0.5) * (w - 2.5) });
          if (R() < 0.45 && w >= 6) porch(b, w, facing, trimHex);
          a += w;
        }
      }
      // sidewalk furniture along all four edges
      const inset = 0.5;
      for (let z = z0 + 6; z < z1 - 4; z += 14) {
        for (const [x, dir] of [
          [x0 + inset, -1],
          [x1 - inset, 1],
        ]) {
          if (!isReserved(x, z)) lamp(x, z, [dir, 0]);
          const tz = z + 7;
          if (tz < z1 - 3 && !isReserved(x, tz) && R() < 0.75) tree(x, tz, 0.85 + R() * 0.3);
        }
      }
      for (let x = x0 + 8; x < x1 - 6; x += 16) {
        for (const [z, dir] of [
          [z0 + inset, -1],
          [z1 - inset, 1],
        ]) {
          if (!isReserved(x, z) && R() < 0.6) lamp(x, z, [0, dir]);
        }
      }
      if (R() < 0.7) hydrant(x0 + 0.7, z0 + 3.5);
      if (R() < 0.5) trashcan(x1 - 0.8, z1 - 5);
      parkingSign(x0 + 0.4, (z0 + z1) / 2 + 3, -Math.PI / 2);
      parkingSign(x1 - 0.4, (z0 + z1) / 2 - 3, Math.PI / 2);

      // curb spots along both NS streets bordering this block
      for (const [cx, side] of [
        [x0 - 1.3, 'L'],
        [x1 + 1.3, 'R'],
      ]) {
        for (let z = z0 + 4; z < z1 - 3; z += 6.5) world.curbSpots.push({ x: cx, z, rot: 0, side });
      }
    }
  }

  // --- North commercial strip along W Cary St --------------------------------
  const stripFront = -88;
  slab(-74, 135, -115, -85, MAT.pavers);
  world.map.blocks.push({ x0: -74, x1: 135, z0: -115, z1: -85, kind: 'com' });
  const stripSpecials = [
    { a0: -22, a1: -10, type: 'bar' },
    { a0: 18, a1: 30, type: 'coffee' },
    { a0: 55, a1: 64, type: 'moth' },
    { a0: 98, a1: 110, type: 'mart' },
  ];
  {
    let a = -73;
    while (a < 133) {
      // skip road gaps for NS streets? the strip is continuous across them visually as a campus edge
      const sp = stripSpecials.find((s) => a >= s.a0 - 0.01 && a < s.a1);
      const next = stripSpecials.find((s) => s.a0 > a);
      if (sp) {
        makeSpecial(sp.type, stripFront, sp.a0 + (sp.a1 - sp.a0) / 2, sp.a1 - sp.a0, 12, 'S');
        a = sp.a1;
        continue;
      }
      let w = [6, 9, 12][Math.floor(R() * 3)];
      if (next && a + w > next.a0) w = next.a0 - a;
      if (a + w > 133) w = 133 - a;
      if (w < 3) {
        a += w;
        continue;
      }
      const tall = R() < 0.35;
      const h = tall ? 15 + Math.floor(R() * 3) * 3 : 6 + Math.floor(R() * 2) * 3;
      const mat = tall ? MAT.tower[Math.floor(R() * 2)] : MAT.comm[Math.floor(R() * 3)];
      building({ front: stripFront, along: a + w / 2, w, d: 12, h, facing: 'S', mat, trim: 0x9a9080, door: !tall, stoop: false });
      a += w;
    }
    // tall campus towers behind
    for (let x = -70; x < 130; x += 22) {
      const h = 21 + Math.floor(R() * 4) * 3;
      building({ front: -101, along: x + 8, w: 15, d: 12, h, facing: 'S', mat: MAT.tower[Math.floor(R() * 2)], door: false, trim: 0x8a8a80 });
    }
    for (let x = -66; x < 130; x += 16) if (!isReserved(x, -86)) lamp(x, -85.6, [0, 1]);
    const vcu = signMesh('VCU-ish SCHOOL OF THE ARTS ANNEX', { bg: '#1a1a1a', fg: '#f0c020', w: 256, h: 32, font: 'bold 14px monospace' }, 10, 1.25);
    vcu.position.set(75, 8, stripFront + 0.06);
  }

  // --- East of Belvidere ---------------------------------------------------
  {
    const front = 99;
    const segs = [
      [-75, -44],
      [-36, -4],
      [4, 36],
    ];
    const eastSpecials = [
      { a0: -66, a1: -54, type: 'gallery' },
      { a0: 10, a1: 19, type: 'sal' },
    ];
    for (const [z0, z1] of segs) {
      slab(96, 135, z0, z1, MAT.pavers);
      world.map.blocks.push({ x0: 96, x1: 135, z0, z1, kind: 'com' });
      let a = z0 + 1;
      while (a < z1 - 3) {
        const sp = eastSpecials.find((s) => a >= s.a0 - 0.01 && a < s.a1);
        const next = eastSpecials.find((s) => s.a0 > a);
        if (sp) {
          makeSpecial(sp.type, front, sp.a0 + (sp.a1 - sp.a0) / 2, sp.a1 - sp.a0, 12, 'W');
          a = sp.a1;
          continue;
        }
        let w = [6, 9][Math.floor(R() * 2)];
        if (next && a + w > next.a0) w = next.a0 - a;
        if (a + w > z1 - 1) w = z1 - 1 - a;
        if (w < 3) {
          a += w;
          continue;
        }
        const h = 6 + Math.floor(R() * 3) * 3;
        building({ front, along: a + w / 2, w, d: 12, h, facing: 'W', mat: MAT.comm[Math.floor(R() * 3)], stoop: false, trim: 0x9a9080 });
        a += w;
      }
      for (let z = z0 + 5; z < z1 - 3; z += 14) if (!isReserved(96.6, z)) lamp(96.6, z, [-1, 0]);
    }
  }

  // --- Bus stop on Belvidere -------------------------------------------------
  {
    const x = 82.6;
    const z = -50;
    batch.add(colored(new THREE.BoxGeometry(1.4, 0.1, 3.2), 0x3a4a5a), MAT.plain, M(x, 2.6, z));
    batch.add(colored(new THREE.BoxGeometry(0.08, 2.5, 0.08), 0x3a4a5a), MAT.plain, M(x - 0.6, 1.4, z - 1.5));
    batch.add(colored(new THREE.BoxGeometry(0.08, 2.5, 0.08), 0x3a4a5a), MAT.plain, M(x - 0.6, 1.4, z + 1.5));
    batch.add(colored(new THREE.BoxGeometry(0.1, 2.0, 3.0), 0x8aa0b0), MAT.plain, M(x - 0.65, 1.25, z));
    batch.add(colored(new THREE.BoxGeometry(0.5, 0.1, 2.4), 0x6a5a4a), MAT.plain, M(x - 0.3, 0.6, z));
    addCol(x - 0.75, x - 0.55, z - 1.6, z + 1.6, 3);
    const s = signMesh('GRTC', { bg: '#1a3a7a', fg: '#ffffff', w: 64, h: 32 }, 0.8, 0.4);
    s.position.set(x + 0.7, 2.3, z - 1.7);
    s.rotation.y = Math.PI / 2;
    batch.add(colored(new THREE.BoxGeometry(0.06, 2.4, 0.06), 0x808080), MAT.plain, M(x + 0.7, 1.2, z - 1.7));
    world.anchors.bus = { pos: new THREE.Vector3(x + 0.6, 0, z), r: 2.4 };
    reserved.push({ x, z });
    world.memoSpots.bus = new THREE.Vector3(x - 0.3, 0.8, z + 1);
  }

  // --- Overlook park + the James ------------------------------------------
  {
    const z0 = 44;
    const z1 = 78;
    slab(-74, 135, z0, z1, MAT.grass, 0.15, 3);
    world.map.parks.push({ x0: -74, x1: 135, z0, z1, kind: 'park' });
    batch.add(scaledBox(209, 0.05, 3, 2), MAT.pavers, M(30.5, 0.17, z0 + 1.5));
    for (let x = -66; x < 130; x += 16) lamp(x, z0 + 0.4, [0, -1]);
    for (let i = 0; i < 26; i++) {
      const x = -68 + R() * 196;
      const z = z0 + 6 + R() * 22;
      if (Math.abs(x - 20) < 8 && z > 66) continue;
      tree(x, z, 0.9 + R() * 0.5);
    }
    // railing + collider
    for (let x = -134; x < 135; x += 4) {
      batch.add(new THREE.PlaneGeometry(4, 1.1), MAT.fence, M(x + 2, 0.7, 77.2));
    }
    addCol(-140, 140, 77.3, 79, 3);
    // benches
    for (const bx of [10, 20, 34, -20, 70]) {
      batch.add(colored(new THREE.BoxGeometry(2, 0.12, 0.6), 0x6a4a2a), MAT.plain, M(bx, 0.6, 74.5));
      batch.add(colored(new THREE.BoxGeometry(2, 0.5, 0.1), 0x6a4a2a), MAT.plain, M(bx, 0.95, 74.8));
      batch.add(colored(new THREE.BoxGeometry(0.1, 0.45, 0.5), 0x2a2a2a), MAT.plain, M(bx - 0.9, 0.38, 74.5));
      batch.add(colored(new THREE.BoxGeometry(0.1, 0.45, 0.5), 0x2a2a2a), MAT.plain, M(bx + 0.9, 0.38, 74.5));
      addCol(bx - 1, bx + 1, 74.2, 74.9, 1);
    }
    const ov = signMesh('OREGON HILL OVERLOOK', { bg: '#3a2a1a', fg: '#e8d8b0', w: 128, h: 32, font: 'bold 11px monospace', border: '#e8d8b0' }, 3, 0.75);
    ov.position.set(20, 1.4, 70);
    batch.add(colored(new THREE.BoxGeometry(0.1, 1.2, 0.1), 0x3a2a1a), MAT.plain, M(18.8, 0.7, 70.05));
    batch.add(colored(new THREE.BoxGeometry(0.1, 1.2, 0.1), 0x3a2a1a), MAT.plain, M(21.2, 0.7, 70.05));
    world.anchors.overlook = { pos: new THREE.Vector3(20, 0, 75.5), r: 3 };
    world.memoSpots.overlook = new THREE.Vector3(34, 0.8, 74.4);
    world.memoSpots.river = new THREE.Vector3(70, 0.8, 76.3);

    // cliff, tracks, river
    const cliff = new THREE.PlaneGeometry(270, 14, 34, 2);
    cliff.rotateX(-Math.PI / 2 + Math.atan2(9, 10));
    const uv = cliff.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 40, uv.getY(i) * 3);
    batch.add(cliff, MAT.rock, M(0, -4.5, 83.5));
    batch.add(scaledBox(270, 0.4, 8, 2), MAT.dirt, M(0, -9.2, 92));
    for (const rz of [91, 92.5]) batch.add(colored(new THREE.BoxGeometry(270, 0.15, 0.12), 0x5a4a40), MAT.plain, M(0, -8.9, rz));
    for (let x = -134; x < 135; x += 1.2) batch.add(colored(new THREE.BoxGeometry(0.25, 0.1, 2.4), 0x3a2a1a), MAT.plain, M(x, -9.0, 91.75));
    const water = new THREE.Mesh(groundPlane(600, 200, 8), MAT.water);
    water.position.set(0, -10.5, 196);
    scene.add(water);
    // rocks in the river
    for (let i = 0; i < 40; i++) {
      const r = new THREE.IcosahedronGeometry(0.8 + R() * 1.8, 0);
      batch.add(colored(r, 0x9a948a), MAT.rock, M(-130 + R() * 260, -10.3, 100 + R() * 60, R() * 6, 1, 0.5, 1));
    }
    // far bank skyline (Manchester)
    for (let x = -200; x < 200; x += 14) {
      const h = 6 + R() * 30;
      batch.add(colored(scaledBox(10, h, 10, 3), 0x8a8a90), MAT.tower[0], M(x, -10 + h / 2, 300 + R() * 20));
    }
    world.map.parks.push({ x0: -135, x1: 135, z0: 78, z1: 120, kind: 'river' });
  }

  // --- Hollywood Cemetery ---------------------------------------------------
  {
    const x0 = -135;
    const x1 = -74;
    const z0 = -115;
    const z1 = 78;
    slab(x0, x1, z0, z1, MAT.darkGrass, 0.15, 3);
    world.map.parks.push({ x0, x1, z0, z1, kind: 'cemetery' });
    // iron fence with gate gap
    for (let z = z0; z < z1; z += 4) {
      if (z + 4 > -23 && z < -17) continue;
      batch.add(new THREE.PlaneGeometry(4, 1.8), MAT.fence, M(x1 - 0.3, 1.05, z + 2, Math.PI / 2));
    }
    addCol(x1 - 0.5, x1 - 0.1, z0, -22, 2);
    addCol(x1 - 0.5, x1 - 0.1, -18, z1, 2);
    for (const gz of [-22.4, -17.6]) {
      batch.add(colored(scaledBox(0.8, 3, 0.8, 1), 0x9a9488), MAT.stone, M(x1 - 0.3, 1.65, gz));
      batch.add(colored(new THREE.BoxGeometry(1, 0.3, 1), 0x9a9488), MAT.stone, M(x1 - 0.3, 3.3, gz));
    }
    const hs = signMesh('HOLLYWOOD CEMETERY', { bg: '#1a1a1a', fg: '#d8d0c0', w: 128, h: 24, font: 'bold 11px monospace' }, 4.2, 0.8);
    hs.position.set(x1 + 0.1, 3.9, -20);
    hs.rotation.y = Math.PI / 2;
    // paths
    batch.add(groundPlane(46, 3, 3), MAT.dirt, M(-97, 0.16, -20));
    batch.add(groundPlane(3, 150, 3), MAT.dirt, M(-118, 0.16, -25));
    batch.add(groundPlane(40, 3, 3), MAT.dirt, M(-100, 0.16, 30));
    batch.add(groundPlane(40, 3, 3), MAT.dirt, M(-100, 0.16, -70));
    const onPath = (x, z) =>
      (Math.abs(z + 20) < 2.5 && x > -121) || Math.abs(x + 118) < 2.5 || (Math.abs(z - 30) < 2.5 && x > -121) || (Math.abs(z + 70) < 2.5 && x > -121);
    // gravestones
    const stoneGeo = scaledBox(0.7, 1.0, 0.18, 1);
    const roundTop = new THREE.CylinderGeometry(0.35, 0.35, 0.18, 6, 1, false, 0, Math.PI);
    roundTop.rotateX(Math.PI / 2);
    roundTop.rotateZ(Math.PI / 2);
    for (let x = x0 + 4; x < x1 - 3; x += 3.2) {
      for (let z = z0 + 4; z < z1 - 4; z += 3.6) {
        const jx = x + (R() - 0.5) * 1.2;
        const jz = z + (R() - 0.5) * 1.2;
        if (onPath(jx, jz) || R() < 0.25) continue;
        if (Math.hypot(jx + 108, jz - 40) < 5) continue; // dog clearing
        const k = R();
        const ry = (R() - 0.5) * 0.3;
        const tint = [0xd0ccc0, 0xb0aca0, 0x908c84][Math.floor(R() * 3)];
        if (k < 0.65) {
          const sy = 0.8 + R() * 0.6;
          batch.add(colored(stoneGeo.clone(), tint), MAT.stone, M(jx, 0.15 + sy / 2, jz, ry + Math.PI / 2, 1, sy, 1));
          if (R() < 0.5) batch.add(colored(roundTop.clone(), tint), MAT.stone, M(jx, 0.15 + sy, jz, ry + Math.PI / 2));
          addCol(jx - 0.15, jx + 0.15, jz - 0.4, jz + 0.4, 1.2);
        } else if (k < 0.85) {
          // cross
          batch.add(colored(new THREE.BoxGeometry(0.18, 1.5, 0.18), tint), MAT.stone, M(jx, 0.9, jz));
          batch.add(colored(new THREE.BoxGeometry(0.18, 0.18, 0.8), tint), MAT.stone, M(jx, 1.3, jz));
          addCol(jx - 0.15, jx + 0.15, jz - 0.15, jz + 0.15, 1.5);
        } else {
          // obelisk
          const h = 2.5 + R() * 2.5;
          batch.add(colored(scaledBox(0.9, 0.5, 0.9, 1), tint), MAT.stone, M(jx, 0.4, jz));
          const ob = new THREE.CylinderGeometry(0.12, 0.35, h, 4);
          batch.add(colored(ob, tint), MAT.stone, M(jx, 0.65 + h / 2, jz, Math.PI / 4));
          addCol(jx - 0.45, jx + 0.45, jz - 0.45, jz + 0.45, h);
        }
      }
    }
    // mausoleums
    for (const [mx, mz] of [
      [-100, -45],
      [-128, 10],
      [-95, 55],
      [-126, -95],
    ]) {
      batch.add(colored(scaledBox(5, 3.5, 6, 2), 0xa8a498), MAT.stone, M(mx, 1.9, mz));
      const roof = new THREE.CylinderGeometry(0.01, 3.4, 1.6, 4, 1);
      roof.rotateY(Math.PI / 4);
      batch.add(colored(roof, 0x8a867c), MAT.stone, M(mx, 4.4, mz, 0, 1, 1, 1.2));
      batch.add(new THREE.PlaneGeometry(1.4, 2.4), MAT.doors[4], M(mx + 2.52, 1.35, mz, Math.PI / 2));
      addCol(mx - 2.5, mx + 2.5, mz - 3, mz + 3, 4);
    }
    for (let i = 0; i < 30; i++) {
      const x = x0 + 4 + R() * (x1 - x0 - 8);
      const z = z0 + 4 + R() * (z1 - z0 - 8);
      if (onPath(x, z)) continue;
      tree(x, z, 1.1 + R() * 0.6, true);
    }
    // the iron dog
    const dog = makeDog();
    dog.position.set(-108, 0.15, 40);
    dog.rotation.y = Math.PI / 2;
    scene.add(dog);
    addCol(-108.5, -107.5, 39.4, 40.6, 1.5);
    world.anchors.dog = { pos: new THREE.Vector3(-106.6, 0, 40), r: 2.2 };
    world.anchors.cemetery = { pos: new THREE.Vector3(-78, 0, -20), r: 3 };
    world.memoSpots.cemetery = new THREE.Vector3(-118, 0.8, -66);
  }

  // --- Special buildings -------------------------------------------------------
  function makeSpecial(type, front, along, w, d, facing) {
    const brick = MAT.facades[0];
    const putSign = (b, text, opts, sw, sh, y) => {
      const s = signMesh(text, opts, sw, sh);
      const fp = facing === 'W' || facing === 'E' ? b.cx + (b.fx * b.sx) / 2 : b.cz + (b.fz * b.sz) / 2;
      if (facing === 'W' || facing === 'E') s.position.set(fp + b.fx * 0.08, y, along);
      else s.position.set(along, y, fp + b.fz * 0.08);
      s.rotation.y = b.rot;
      return s;
    };
    const awning = (b, color) => {
      const fp = facing === 'W' || facing === 'E' ? b.cx + (b.fx * b.sx) / 2 : b.cz + (b.fz * b.sz) / 2;
      const g = facing === 'W' || facing === 'E' ? new THREE.BoxGeometry(1.2, 0.15, w - 1) : new THREE.BoxGeometry(w - 1, 0.15, 1.2);
      colored(g, color);
      if (facing === 'W' || facing === 'E') batch.add(g, MAT.plain, M(fp + b.fx * 0.6, 3.25, along));
      else batch.add(g, MAT.plain, M(along, 3.25, fp + b.fz * 0.6));
    };
    let b;
    const anchor = (name, extra = {}) => {
      world.anchors[name] = { pos: b.door.clone(), rot: b.rot, ...extra };
      reserved.push({ x: b.door.x, z: b.door.z });
    };
    switch (type) {
      case 'home':
        b = building({ front, along, w, d, h: 9, facing, mat: MAT.facades[5], trim: 0xf0e8d8, doorMat: MAT.doors[3] });
        anchor('home');
        putSign(b, '1209 S PINE', { bg: '#1a1a1a', fg: '#e0d8c0', w: 64, h: 16, font: 'bold 10px monospace' }, 0.8, 0.2, 2.9);
        world.memoSpots.lease = b.door.clone().add(new THREE.Vector3(b.fx * -0.6 + 0, 0.8, 1.4));
        break;
      case 'basement':
        b = building({ front, along, w, d, h: 6, facing, mat: MAT.facades[6], trim: 0xe0d8c8, doorMat: MAT.doors[4], stoop: false });
        anchor('basement');
        putSign(b, 'THE BASEMENT ↓', { bg: '#0a0a0a', fg: '#e02060', w: 128, h: 24, font: 'bold 13px monospace' }, 2.4, 0.45, 2.9);
        world.memoSpots.basement = b.door.clone().add(new THREE.Vector3(0, 0.8, 1.6));
        break;
      case 'holyghost':
        b = building({ front, along, w, d, h: 6, facing, mat: MAT.comm[1], trim: 0xe0d0b0, stoop: false });
        anchor('juniper');
        putSign(b, 'HOLY GHOST TATTOO', { bg: '#2a0a0a', fg: '#f0d080', w: 128, h: 24, font: 'bold 11px monospace' }, 3.6, 0.7, 3.6);
        awning(b, 0x5a1a1a);
        break;
      case 'bar':
        b = building({ front, along, w, d, h: 9, facing, mat: MAT.comm[1], trim: 0xe0d0b0, stoop: false });
        anchor('bar');
        putSign(b, 'THE LOWERED EXPECTATIONS', { bg: '#0a0a1a', fg: '#40e0ff', w: 256, h: 32, font: 'bold 16px monospace' }, 7, 0.9, 3.7);
        awning(b, 0x1a1a3a);
        break;
      case 'coffee':
        b = building({ front, along, w, d, h: 6, facing, mat: MAT.comm[2], trim: 0xd0d0c0, stoop: false });
        anchor('coffee');
        putSign(b, 'GRIND THEORY COFFEE', { bg: '#e8e0d0', fg: '#2a4a3a', w: 256, h: 32, font: 'bold 18px monospace' }, 7, 0.9, 3.7);
        awning(b, 0x2a5a3a);
        world.memoSpots.belvidere = new THREE.Vector3(along + 8, 0.8, front + 1.2);
        break;
      case 'moth':
        b = building({ front, along, w, d, h: 9, facing, mat: MAT.comm[0], trim: 0xc8b080, stoop: false });
        anchor('moth');
        putSign(b, 'MOTH & MORTAL', { bg: '#1a1020', fg: '#c0a0e0', w: 128, h: 24, font: 'bold 13px monospace' }, 4.6, 0.85, 3.7);
        awning(b, 0x2a1a3a);
        break;
      case 'mart':
        b = building({ front, along, w, d, h: 5, facing, mat: MAT.comm[2], trim: 0xd0d0c0, stoop: false });
        anchor('mart');
        putSign(b, 'SPEEDEE MART 24HR', { bg: '#d02020', fg: '#ffffff', w: 128, h: 24, font: 'bold 12px monospace' }, 6, 1, 3.7);
        awning(b, 0xd02020);
        break;
      case 'gallery':
        b = building({ front, along, w, d, h: 9, facing, mat: MAT.comm[2], trim: 0xffffff, stoop: false, doorMat: MAT.doors[4] });
        anchor('gallery');
        putSign(b, 'GALLERY FIVEFOLD', { bg: '#f8f8f8', fg: '#101010', w: 128, h: 24, font: '11px monospace' }, 4, 0.75, 3.7);
        world.memoSpots.gallery = b.door.clone().add(new THREE.Vector3(0, 0.8, 2.2));
        break;
      case 'sal':
        b = building({ front, along, w, d, h: 6, facing, mat: MAT.comm[0], trim: 0xc8b080, stoop: false });
        anchor('sal');
        putSign(b, "SAL'S INK EMPORIUM", { bg: '#102010', fg: '#f04040', w: 128, h: 24, font: 'bold 11px monospace' }, 4.2, 0.8, 3.7);
        awning(b, 0x1a3a1a);
        break;
    }
    return b;
  }

  // memo spots that aren't tied to a building
  world.memoSpots.alley = new THREE.Vector3(30, 0.8, -20);
  world.memoSpots.meter = new THREE.Vector3(48.5, 0.8, -60);
  world.memoSpots.dale = new THREE.Vector3(-34.5, 0.8, -10);
  world.memoSpots.fridge = null; // placed in home interior

  // --- Decorative parked cars & curb spots -----------------------------------
  {
    const colors = [0x8a2a2a, 0x2a3a6a, 0xd0d0d0, 0x1a1a1a, 0x6a6a5a, 0x3a5a3a, 0xc0a040, 0x5a3a5a];
    const free = [];
    for (const s of world.curbSpots) {
      // keep the home-front spot free for the player
      if (Math.abs(s.x - 12.7) < 0.5 && Math.abs(s.z + 19) < 4) {
        free.push(s);
        continue;
      }
      if (R() < 0.45) {
        const car = makeCar(colors[Math.floor(R() * colors.length)], { wagon: R() < 0.3 });
        car.position.set(s.x, 0, s.z);
        car.rotation.y = s.side === 'L' ? Math.PI : 0;
        scene.add(car);
        addCol(s.x - 1, s.x + 1, s.z - 2.2, s.z + 2.2, 1.6);
      } else free.push(s);
    }
    world.curbSpots = free;
    world.homeSpot = free.findIndex((s) => Math.abs(s.x - 12.7) < 0.5 && Math.abs(s.z + 19) < 4);
    if (world.homeSpot < 0) {
      world.curbSpots.push({ x: 12.7, z: -19, rot: 0, side: 'L' });
      world.homeSpot = world.curbSpots.length - 1;
    }
  }

  // --- Train on the tracks -----------------------------------------------------
  {
    const train = new THREE.Group();
    const cols = [0x2a2a2a, 0x3a2a22, 0x4a3a2a];
    for (let i = 0; i < 24; i++) {
      const car = new THREE.Mesh(colored(scaledBox(13, 3.2, 3, 3), i === 0 ? 0x1a3a7a : cols[i % 3]), i === 0 ? MAT.plain : MAT.concrete);
      car.position.set(-i * 13.6, 1.8, 0);
      train.add(car);
      if (i > 0) {
        const coal = new THREE.Mesh(colored(new THREE.BoxGeometry(12.6, 0.3, 2.6), 0x101010), MAT.plain);
        coal.position.set(-i * 13.6, 3.45, 0);
        train.add(coal);
      }
    }
    train.position.set(-400, -9, 91.75);
    train.visible = false;
    scene.add(train);
    world.train = { group: train, active: false, x: -400 };
  }

  // --- Boundaries -----------------------------------------------------------
  const b = world.bounds;
  addCol(b.x0 - 5, b.x0, -200, 200, 50);
  addCol(b.x1, b.x1 + 5, -200, 200, 50);
  addCol(-200, 200, b.z0 - 5, b.z0, 50);

  // --- Map labels -----------------------------------------------------------
  for (const s of NS) world.map.labels.push({ x: s.x, z: 30, text: s.name.replace('S ', ''), rot: true });
  for (const e of EW) world.map.labels.push({ x: 70, z: e.z, text: e.name });
  world.map.labels.push({ x: -105, z: -30, text: 'HOLLYWOOD CEM.' });
  world.map.labels.push({ x: 20, z: 62, text: 'OVERLOOK' });
  world.map.labels.push({ x: 20, z: 100, text: 'JAMES RIVER' });

  // --- Interiors ---------------------------------------------------------------
  buildInteriors(world, scene, batch, MAT, addCol);

  batch.build(scene);
  return world;
}

// ---------------------------------------------------------------------------
// Interiors live far away from the hill and are reached through doors.
// ---------------------------------------------------------------------------
function buildInteriors(world, scene, batch, MAT, addCol) {
  const room = (key, ox, w, d, h, floorMat, wallMat, opts = {}) => {
    const o = new THREE.Vector3(ox, 0, 0);
    batch.add(scaledBox(w, 0.2, d, 2), floorMat, M(ox, -0.1, 0));
    batch.add(scaledBox(w, 0.2, d, 3), opts.ceilMat ?? MAT.concrete, M(ox, h + 0.1, 0));
    const T = 0.3;
    batch.add(scaledBox(w + T * 2, h, T, 2.5), wallMat, M(ox, h / 2, -d / 2 - T / 2));
    batch.add(scaledBox(w + T * 2, h, T, 2.5), wallMat, M(ox, h / 2, d / 2 + T / 2));
    batch.add(scaledBox(T, h, d, 2.5), wallMat, M(ox - w / 2 - T / 2, h / 2, 0));
    batch.add(scaledBox(T, h, d, 2.5), wallMat, M(ox + w / 2 + T / 2, h / 2, 0));
    addCol(ox - w / 2 - 1, ox + w / 2 + 1, -d / 2 - 1, -d / 2, h);
    addCol(ox - w / 2 - 1, ox + w / 2 + 1, d / 2, d / 2 + 1, h);
    addCol(ox - w / 2 - 1, ox - w / 2, -d / 2, d / 2, h);
    addCol(ox + w / 2, ox + w / 2 + 1, -d / 2, d / 2, h);
    // exit door on south wall
    const exitX = ox + (opts.exitX ?? -w / 2 + 1.6);
    batch.add(new THREE.PlaneGeometry(1.2, 2.3), MAT.doors[0], M(exitX, 1.15, d / 2 - 0.01, Math.PI));
    // ceiling bulb
    batch.add(colored(new THREE.BoxGeometry(0.25, 0.25, 0.25), 0xfff0c0), MAT.unlit, M(ox, h - 0.2, 0));
    const I = {
      key,
      origin: o,
      w,
      d,
      h,
      spawn: new THREE.Vector3(exitX, 0, d / 2 - 1.2),
      exit: new THREE.Vector3(exitX, 0, d / 2 - 0.4),
      cam: new THREE.Vector3(ox + (opts.camX ?? w / 2 - 0.5), h - 0.35, d / 2 - 0.5),
      fog: opts.fog ?? { color: 0x101014, near: 6, far: 26 },
      ambient: opts.ambient ?? 0.75,
      spots: {},
    };
    world.interiors[key] = I;
    return I;
  };
  const box = (w, h, d, color, x, y, z, mat = MAT.plain, col = true, ry = 0) => {
    batch.add(colored(new THREE.BoxGeometry(w, h, d), color), mat, M(x, y, z, ry));
    if (col) {
      const cw = ry ? d : w;
      const cd = ry ? w : d;
      addCol(x - cw / 2, x + cw / 2, z - cd / 2, z + cd / 2, y + h / 2);
    }
  };
  const wallSign = (text, opts, w, h, x, y, z, ry = 0, unlit = true) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ps1Material({ map: TEX.sign(text, opts), unlit }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  };

  // ---- HOME ----
  {
    const ox = 1000;
    const I = room('home', ox, 12, 9, 3.2, ps1Material({ map: TEX.wood('#6a4a30'), vertexColors: true }), ps1Material({ map: TEX.wallpaper(), vertexColors: true }), { exitX: -4, ambient: 0.7 });
    I.exitTo = 'home';
    // couch on the west wall facing east
    box(1.0, 0.45, 2.6, 0x3a5a3a, ox - 5.3, 0.25, -0.5);
    box(0.3, 0.9, 2.6, 0x3a5a3a, ox - 5.75, 0.5, -0.5);
    box(1.0, 0.65, 0.3, 0x3a5a3a, ox - 5.3, 0.35, -1.95);
    box(1.0, 0.65, 0.3, 0x3a5a3a, ox - 5.3, 0.35, 0.95);
    I.spots.sage = new THREE.Vector3(ox - 5.2, 0.05, -0.2);
    // tv
    box(1.4, 0.6, 0.6, 0x4a3a2a, ox - 2.4, 0.3, -0.5, MAT.plain, true, Math.PI / 2);
    box(0.7, 0.7, 0.9, 0x2a2a2a, ox - 2.4, 0.95, -0.5, MAT.plain, false);
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.55), ps1Material({ map: TEX.tvStatic(0), unlit: true }));
    tvScreen.position.set(ox - 2.76, 0.97, -0.5);
    tvScreen.rotation.y = -Math.PI / 2;
    scene.add(tvScreen);
    world.tvScreen = tvScreen;
    world.tvFrames = [0, 1, 2, 3].map((i) => TEX.tvStatic(i));
    I.spots.tv = new THREE.Vector3(ox - 2.4, 0, -0.5);
    // rug
    batch.add(colored(new THREE.BoxGeometry(3, 0.02, 2.4), 0x7a2a2a), ps1Material({ map: TEX.carpet('#7a3a2a'), vertexColors: true }), M(ox - 3.8, 0.01, -0.5));
    // desk + CRT at north wall
    box(2.0, 0.08, 0.9, 0x6a5040, ox + 2.6, 0.78, -3.9);
    box(0.08, 0.76, 0.8, 0x4a3a2a, ox + 1.65, 0.38, -3.9, MAT.plain, false);
    box(0.08, 0.76, 0.8, 0x4a3a2a, ox + 3.55, 0.38, -3.9, MAT.plain, false);
    addCol(ox + 1.6, ox + 3.6, -4.5, -3.4, 1);
    box(0.7, 0.6, 0.6, 0xd8d0b8, ox + 2.6, 1.12, -4.0, MAT.plain, false);
    const crt = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), ps1Material({ map: TEX.sign('', { bg: '#2040a0', fg: '#fff', w: 32, h: 24, lines: ['> _'], font: '8px monospace' }), unlit: true }));
    crt.position.set(ox + 2.6, 1.14, -3.69);
    scene.add(crt);
    box(0.5, 0.5, 0.5, 0x2a2a2a, ox + 2.6, 0.45, -3.1, MAT.plain, false);
    I.spots.desk = new THREE.Vector3(ox + 2.6, 0, -2.9);
    // bed
    box(2.0, 0.45, 3.0, 0xd8d0c0, ox + 4.8, 0.25, 2.6);
    box(2.02, 0.1, 2.0, 0x2a3a6a, ox + 4.8, 0.52, 3.05, MAT.plain, false);
    box(1.4, 0.15, 0.5, 0xf0f0f0, ox + 4.8, 0.55, 1.4, MAT.plain, false);
    I.spots.bed = new THREE.Vector3(ox + 3.4, 0, 2.6);
    // fridge
    box(0.9, 1.9, 0.8, 0xe8e8e0, ox - 5.4, 0.95, -4.0);
    I.spots.fridge = new THREE.Vector3(ox - 5.2, 0, -3.1);
    world.memoSpots.fridge = new THREE.Vector3(ox - 4.4, 1.2, -3.55);
    // mirror
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), ps1Material({ color: 0x9aa8b0, unlit: true }));
    mirror.position.set(ox - 1.0, 1.5, -4.49);
    scene.add(mirror);
    I.spots.mirror = new THREE.Vector3(ox - 1.0, 0, -3.6);
    // mold
    const mold = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), ps1Material({ map: TEX.mold() }));
    mold.position.set(ox + 5.98, 2.2, -1.5);
    mold.rotation.y = -Math.PI / 2;
    scene.add(mold);
    world.mold = mold;
    I.spots.mold = new THREE.Vector3(ox + 5.2, 0, -1.5);
    wallSign('', { bg: '#101010', fg: '#e02060', w: 64, h: 96, font: 'bold 10px monospace', lines: ['HOLLYWOOD', 'CEMETERY', 'DANCE', 'PARTY', '★ $5 ★'] }, 0.9, 1.35, ox - 2.4, 1.8, -4.49, 0, false);
    wallSign('', { bg: '#d8c8a0', fg: '#3a2a1a', w: 96, h: 64, font: 'bold 10px monospace', lines: ['LIVE', 'LAUGH', 'LEASE'] }, 1.2, 0.8, ox + 0.8, 1.9, -4.49, 0, false);
  }

  // ---- BAR ----
  {
    const ox = 1100;
    const I = room('bar', ox, 14, 10, 3.6, ps1Material({ map: TEX.wood('#3a2418'), vertexColors: true }), ps1Material({ map: TEX.brick('#4a2a22', '#2a1a16'), vertexColors: true }), { exitX: -5, ambient: 0.55, fog: { color: 0x0a0608, near: 5, far: 24 } });
    I.exitTo = 'bar';
    box(9, 1.1, 0.9, 0x4a2a1a, ox + 1, 0.55, -3.6);
    box(9.2, 0.08, 1.1, 0x2a1a10, ox + 1, 1.14, -3.6, MAT.plain, false);
    box(9, 2.2, 0.4, 0x2a1a10, ox + 1, 2.0, -4.8, MAT.plain, false);
    for (let i = 0; i < 12; i++) box(0.12, 0.3, 0.12, [0x3a7a3a, 0x7a3a1a, 0xc0c0a0, 0x5a1a1a][i % 4], ox - 3 + i * 0.7, 1.95, -4.55, MAT.unlit, false);
    for (let i = 0; i < 6; i++) box(0.45, 0.7, 0.45, 0x8a1a1a, ox - 2.5 + i * 1.4, 0.35, -2.7, MAT.plain, false);
    I.spots.wren = new THREE.Vector3(ox + 1, 0, -4.4);
    wallSign('BEER', { bg: '#0a0a0a', fg: '#ff3040', w: 64, h: 24, font: 'bold 18px monospace' }, 1.6, 0.6, ox + 4, 2.9, -4.58);
    wallSign('ICE COLD COPE', { bg: '#0a0a0a', fg: '#40e0ff', w: 128, h: 24, font: 'bold 13px monospace' }, 2.8, 0.55, ox - 6.95, 2.4, 0, Math.PI / 2);
    // booth with Tanner & Bex
    box(2.2, 0.08, 1.2, 0x5a3a2a, ox + 4.5, 0.8, 2.6);
    box(0.2, 0.8, 0.2, 0x2a1a10, ox + 4.5, 0.4, 2.6, MAT.plain, false);
    box(2.4, 0.45, 0.7, 0x6a1a1a, ox + 4.5, 0.25, 1.5);
    box(2.4, 0.45, 0.7, 0x6a1a1a, ox + 4.5, 0.25, 3.7);
    I.spots.tanner = new THREE.Vector3(ox + 4.0, 0.05, 1.55);
    I.spots.bex = new THREE.Vector3(ox + 5.0, 0.05, 3.65);
    I.spots.booth = new THREE.Vector3(ox + 3.0, 0, 2.6);
    // pool table
    box(2.4, 0.8, 1.4, 0x1a5a2a, ox - 3, 0.4, 1.5);
    // jukebox
    box(1.0, 1.6, 0.6, 0xc06020, ox + 6.6, 0.8, -1.0, MAT.unlit);
    I.spots.jukebox = new THREE.Vector3(ox + 5.8, 0, -1.0);
    I.spots.trivia = new THREE.Vector3(ox - 3, 0, -0.2);
  }

  // ---- COFFEE ----
  {
    const ox = 1200;
    const I = room('coffee', ox, 12, 9, 3.4, ps1Material({ map: TEX.tile('#d8d4c8', '#3a5a4a'), vertexColors: true }), ps1Material({ map: TEX.concrete('#c8c0b0'), vertexColors: true }), { exitX: -4, ambient: 0.85, fog: { color: 0x1a1814, near: 8, far: 28 } });
    I.exitTo = 'coffee';
    box(6, 1.1, 0.8, 0x2a4a3a, ox + 1.5, 0.55, -3.4);
    box(0.5, 0.6, 0.5, 0xb0b0b0, ox + 3.5, 1.4, -3.5, MAT.plain, false);
    I.spots.jules = new THREE.Vector3(ox + 1.5, 0, -4.1);
    wallSign('', { bg: '#a87a4a', fg: '#1a1a1a', w: 96, h: 64, font: 'bold 9px monospace', lines: ['GIG BOARD', '"exposure', 'available"', '▪ ▪ ▪ ▪'] }, 1.8, 1.2, ox - 5.98, 1.7, -1.5, Math.PI / 2, false);
    I.spots.gigs = new THREE.Vector3(ox - 5.2, 0, -1.5);
    wallSign('', { bg: '#202020', fg: '#f0e020', w: 96, h: 64, font: 'bold 9px monospace', lines: ['RVA', 'HAPPENINGS', '→ this wk ←'] }, 1.8, 1.2, ox + 5.98, 1.7, 0.5, -Math.PI / 2, false);
    I.spots.events = new THREE.Vector3(ox + 5.2, 0, 0.5);
    for (const [tx, tz] of [
      [ox - 2, 1.5],
      [ox + 2, 2.2],
    ]) {
      box(1.0, 0.06, 1.0, 0x6a5040, tx, 0.78, tz);
      box(0.1, 0.75, 0.1, 0x2a2a2a, tx, 0.38, tz, MAT.plain, false);
      box(0.4, 0.03, 0.3, 0x909090, tx, 0.83, tz, MAT.plain, false);
    }
    I.spots.freelancer1 = new THREE.Vector3(ox - 2, 0.05, 2.3);
    I.spots.freelancer2 = new THREE.Vector3(ox + 2, 0.05, 3.0);
    box(0.5, 0.6, 0.5, 0x8a5a3a, ox - 5.3, 0.3, 3.6);
    box(0.9, 1.0, 0.9, 0x2a6a2a, ox - 5.3, 1.1, 3.6, MAT.canopy, false);
  }

  // ---- MART ----
  {
    const ox = 1300;
    const I = room('mart', ox, 10, 8, 3.0, ps1Material({ map: TEX.tile('#c8c8c0', '#a8a8a0'), vertexColors: true }), ps1Material({ map: TEX.concrete('#d8d8d0'), vertexColors: true }), { exitX: -3, ambient: 1.0, fog: { color: 0x181818, near: 8, far: 28 } });
    I.exitTo = 'mart';
    box(2.4, 1.0, 0.8, 0x8a8a8a, ox - 2.6, 0.5, 1.0);
    I.spots.donny = new THREE.Vector3(ox - 2.6, 0, 0.2);
    I.spots.counter = new THREE.Vector3(ox - 2.6, 0, 1.9);
    // hot dog roller
    box(0.7, 0.2, 0.4, 0xb0b0b0, ox - 1.8, 1.1, 1.0, MAT.plain, false);
    for (let i = 0; i < 4; i++) box(0.6, 0.05, 0.05, 0xb05030, ox - 1.8, 1.24, 0.88 + i * 0.08, MAT.plain, false);
    for (let s = 0; s < 2; s++) {
      const sx = ox + 0.5 + s * 2.2;
      box(0.8, 1.6, 4.0, 0x6a6a7a, sx, 0.8, -0.8);
      for (let i = 0; i < 10; i++) box(0.82, 0.25, 0.3, [0xd03020, 0x2050c0, 0xe0c020, 0x30a040][i % 4], sx, 0.6 + (i % 3) * 0.45, -2.5 + Math.floor(i / 3) * 1.1, MAT.plain, false);
    }
    box(0.9, 2.2, 4, 0x8ab0d0, ox + 4.5, 1.1, -0.5, MAT.unlit);
    I.spots.cooler = new THREE.Vector3(ox + 3.7, 0, -0.5);
    box(0.6, 1.4, 0.5, 0xe0c020, ox - 4.5, 0.7, -3.4, MAT.unlit);
    I.spots.lotto = new THREE.Vector3(ox - 4.5, 0, -2.6);
  }

  // ---- TATTOO SHOPS ----
  const tattoo = (key, ox, wallHex, exitTo) => {
    const I = room(key, ox, 10, 8, 3.2, ps1Material({ map: TEX.wood('#4a3a2a'), vertexColors: true }), ps1Material({ map: TEX.concrete(wallHex), vertexColors: true }), { exitX: -3, ambient: 0.8, fog: { color: 0x100c0c, near: 6, far: 24 } });
    I.exitTo = exitTo;
    // flash wall
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), ps1Material({ map: TEX.flash(ox + i * 7) }));
      f.position.set(ox - 2.4 + i * 1.3, 1.8, -3.98);
      scene.add(f);
    }
    I.spots.flash = new THREE.Vector3(ox - 0.5, 0, -3.0);
    // chair
    box(0.8, 0.6, 2.0, 0x1a1a1a, ox + 2.5, 0.45, 0.5);
    box(0.8, 0.9, 0.3, 0x1a1a1a, ox + 2.5, 0.9, -0.4, MAT.plain, false);
    box(0.5, 0.9, 0.5, 0x8a8a8a, ox + 3.6, 0.45, -0.5);
    I.spots.artist = new THREE.Vector3(ox + 3.4, 0, 0.6);
    I.spots.talk = new THREE.Vector3(ox + 1.6, 0, 1.2);
    box(2.2, 1.0, 0.7, 0x3a2a2a, ox - 3.3, 0.5, 1.2);
    box(0.5, 0.5, 0.5, 0x8a5a3a, ox + 4.4, 0.25, 3.3);
    box(0.8, 0.9, 0.8, 0x2a6a2a, ox + 4.4, 0.95, 3.3, MAT.canopy, false);
    box(0.3, 0.3, 0.3, 0xe0e0d0, ox - 3.8, 1.15, 1.2, MAT.plain, false);
    return I;
  };
  tattoo('moth', 1400, '#3a3040', 'moth');
  tattoo('sal', 1500, '#3a4a3a', 'sal');
  tattoo('juniper', 1600, '#4a3a30', 'juniper');
}
