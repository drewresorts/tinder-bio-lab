// Low-poly characters built from vertex-colored boxes.
import * as THREE from 'three';
import { ps1Material, colorGeo, TEX } from './ps1.js';

let charMat = null;
export function charMaterial() {
  if (!charMat) charMat = ps1Material({ vertexColors: true });
  return charMat;
}

let enemyMat = null;
export function enemyMaterial() {
  // pale and untouched by the rust tint, so horrors loom out of the fog
  if (!enemyMat) enemyMat = ps1Material({ vertexColors: true, noOther: true, color: 0xd8d0c8 });
  return enemyMat;
}

function boxM(w, h, d, color, x = 0, y = 0, z = 0, mat = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  colorGeo(g, color);
  const m = new THREE.Mesh(g, mat || charMaterial());
  return m;
}

function pivot(x, y, z) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  return p;
}

// o: { skin, shirt, pants, shoes, hair, hairStyle, height, build, faceless,
//      beard, glasses, vest, hat, hatColor, long }
export function makeHumanoid(o = {}) {
  const skin = o.skin ?? 0xd8a888;
  const shirt = o.shirt ?? 0x4a5a7a;
  const pants = o.pants ?? 0x2a2a3a;
  const shoes = o.shoes ?? 0x1a1a1a;
  const hair = o.hair ?? 0x3a2a1a;
  const H = o.height ?? 1;
  const B = o.build ?? 1;
  const MAT = o.enemy ? enemyMaterial() : charMaterial();
  const box = (w, h, d, c, x, y, z) => boxM(w, h, d, c, x, y, z, MAT);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.set(B, H, B);
  root.add(body);

  const hipY = 0.92;
  const legL = pivot(-0.12, hipY, 0);
  const legR = pivot(0.12, hipY, 0);
  legL.add(box(0.17, 0.82, 0.2, pants, 0, -0.41, 0));
  legR.add(box(0.17, 0.82, 0.2, pants, 0, -0.41, 0));
  legL.add(box(0.18, 0.1, 0.28, shoes, 0, -0.86, 0.04));
  legR.add(box(0.18, 0.1, 0.28, shoes, 0, -0.86, 0.04));
  body.add(legL, legR);

  const torso = pivot(0, hipY, 0);
  torso.add(box(0.46, 0.62, 0.26, shirt, 0, 0.31, 0));
  if (o.vest) {
    torso.add(box(0.48, 0.5, 0.28, o.vest, 0, 0.32, 0));
    torso.add(box(0.49, 0.05, 0.29, 0xd0d0d0, 0, 0.22, 0));
    torso.add(box(0.49, 0.05, 0.29, 0xd0d0d0, 0, 0.42, 0));
  }
  if (o.lanyard) torso.add(box(0.1, 0.14, 0.02, 0xf0f0f0, 0, 0.28, 0.14));
  if (o.bag) torso.add(box(0.06, 0.5, 0.3, o.bag, 0.24, 0.22, 0));
  body.add(torso);

  const head = pivot(0, 0.62, 0);
  torso.add(head);
  head.add(box(0.1, 0.08, 0.1, skin, 0, 0.04, 0)); // neck
  head.add(box(0.28, 0.3, 0.27, skin, 0, 0.22, 0));
  if (!o.faceless) {
    head.add(box(0.05, 0.04, 0.02, 0x101010, -0.07, 0.25, 0.14));
    head.add(box(0.05, 0.04, 0.02, 0x101010, 0.07, 0.25, 0.14));
    head.add(box(0.1, 0.02, 0.02, 0x7a3a30, 0, 0.14, 0.14));
  }
  if (o.glasses) head.add(box(0.26, 0.06, 0.03, 0x080808, 0, 0.25, 0.15));
  if (o.beard) head.add(box(0.29, 0.14, 0.12, o.beard, 0, 0.1, 0.1));
  const hs = o.hairStyle ?? 'short';
  if (hs === 'short') head.add(box(0.3, 0.1, 0.29, hair, 0, 0.39, -0.01));
  if (hs === 'long') {
    head.add(box(0.3, 0.1, 0.29, hair, 0, 0.39, -0.01));
    head.add(box(0.31, 0.36, 0.08, hair, 0, 0.2, -0.13));
  }
  if (hs === 'bob') {
    head.add(box(0.31, 0.1, 0.3, hair, 0, 0.39, -0.01));
    head.add(box(0.33, 0.2, 0.2, hair, 0, 0.27, -0.06));
  }
  if (hs === 'bun') {
    head.add(box(0.3, 0.08, 0.29, hair, 0, 0.38, -0.01));
    head.add(box(0.14, 0.12, 0.14, hair, 0, 0.46, -0.08));
  }
  if (hs === 'mohawk') head.add(box(0.08, 0.16, 0.3, hair, 0, 0.42, 0));
  if (hs === 'beanie') {
    head.add(box(0.31, 0.16, 0.3, o.hatColor ?? 0x8a2a2a, 0, 0.4, -0.01));
    head.add(box(0.12, 0.05, 0.12, o.hatColor ?? 0x8a2a2a, 0, 0.5, -0.01));
  }
  if (hs === 'cap') {
    head.add(box(0.31, 0.1, 0.3, o.hatColor ?? 0x2a4a2a, 0, 0.4, -0.01));
    head.add(box(0.28, 0.03, 0.14, o.hatColor ?? 0x2a4a2a, 0, 0.36, 0.2));
  }
  if (o.signHead) {
    // a triangular yard-sign helmet
    const cone = new THREE.ConeGeometry(0.42, 0.95, 3);
    colorGeo(cone, 0xb81e1e);
    const cm = new THREE.Mesh(cone, MAT);
    cm.position.y = 0.5;
    cm.rotation.y = Math.PI / 6;
    head.add(cm);
    const band = new THREE.ConeGeometry(0.43, 0.2, 3);
    colorGeo(band, 0xf0f0e0);
    const bm = new THREE.Mesh(band, MAT);
    bm.position.y = 0.32;
    bm.rotation.y = Math.PI / 6;
    head.add(bm);
  }

  const armL = pivot(-0.3, 0.58, 0);
  const armR = pivot(0.3, 0.58, 0);
  const sleeve = o.sleeve ?? shirt;
  armL.add(box(0.13, 0.28, 0.14, sleeve, 0, -0.14, 0));
  armR.add(box(0.13, 0.28, 0.14, sleeve, 0, -0.14, 0));
  armL.add(box(0.12, 0.32, 0.13, skin, 0, -0.43, 0));
  armR.add(box(0.12, 0.32, 0.13, skin, 0, -0.43, 0));
  torso.add(armL, armR);

  const actor = {
    root,
    body,
    parts: { legL, legR, armL, armR, torso, head },
    phase: Math.random() * 6,
    sitting: false,
    attackT: 0,
    tattoos: 0,
    update(dt, speed) {
      const p = this.parts;
      if (this.sitting) {
        p.legL.rotation.x = -Math.PI / 2;
        p.legR.rotation.x = -Math.PI / 2;
        p.armL.rotation.x = -0.3;
        p.armR.rotation.x = -0.3;
        return;
      }
      const s = Math.min(speed / 3.5, 1.6);
      this.phase += dt * (4 + speed * 1.6);
      const sw = Math.sin(this.phase) * 0.7 * s;
      p.legL.rotation.x = sw;
      p.legR.rotation.x = -sw;
      p.armL.rotation.x = -sw * 0.8;
      p.armR.rotation.x = sw * 0.8;
      p.torso.position.y = hipY + Math.abs(Math.cos(this.phase)) * 0.04 * s;
      if (s < 0.05) {
        const idle = Math.sin(this.phase * 0.5) * 0.03;
        p.armL.rotation.x = idle;
        p.armR.rotation.x = -idle;
      }
      if (this.attackT > 0) {
        this.attackT -= dt;
        const k = 1 - Math.max(this.attackT, 0) / 0.35;
        p.armR.rotation.x = -2.6 + k * 3.2;
        p.armR.rotation.z = -0.3;
      } else p.armR.rotation.z = 0;
    },
    addTattoo(color) {
      const i = this.tattoos++;
      const arm = i % 2 ? this.parts.armR : this.parts.armL;
      const y = -0.33 - Math.floor(i / 2) * 0.09;
      const m = box(0.125, 0.06, 0.135, color, 0, y, 0);
      arm.add(m);
    },
  };
  return actor;
}

const box = (w, h, d, c, x, y, z) => boxM(w, h, d, c, x, y, z);

// Props carried in hand
export function addHeld(actor, kind) {
  const hand = actor.parts.armR;
  let m;
  if (kind === 'ulock') {
    const g = new THREE.TorusGeometry(0.12, 0.025, 4, 8, Math.PI);
    colorGeo(g, 0xc0c0c8);
    m = new THREE.Mesh(g, charMaterial());
    m.position.set(0, -0.62, 0.1);
    m.rotation.x = Math.PI / 2;
    const bar = box(0.3, 0.05, 0.05, 0x202020, 0, -0.62, 0.1);
    hand.add(bar);
  } else if (kind === 'ticketbook') {
    m = box(0.16, 0.2, 0.05, 0xf0f0f0, 0, -0.62, 0.08);
  } else if (kind === 'mimosa') {
    m = box(0.07, 0.16, 0.07, 0xf0a030, 0, -0.62, 0.08);
  } else if (kind === 'key') {
    m = box(0.08, 1.1, 0.08, 0xb89a40, 0, -1.0, 0.1);
    hand.add(box(0.28, 0.28, 0.06, 0xb89a40, 0, -0.5, 0.1));
  } else if (kind === 'beer') {
    m = box(0.07, 0.14, 0.07, 0xc0c0d0, 0, -0.62, 0.08);
  } else if (kind === 'phone') {
    m = box(0.08, 0.14, 0.02, 0x101010, 0, -0.6, 0.1);
  }
  if (m) hand.add(m);
  return m;
}

// A floating "Invoice" monster: two hinged paper sheets
export function makeInvoice() {
  const root = new THREE.Group();
  const mat = ps1Material({ map: TEX.paper(), double: true, color: 0xffffff, noOther: true });
  const mk = () => {
    const g = new THREE.PlaneGeometry(0.6, 0.8);
    g.translate(0.3, 0, 0);
    return new THREE.Mesh(g, mat);
  };
  const a = mk();
  const b = mk();
  b.rotation.y = Math.PI;
  const hinge = new THREE.Group();
  hinge.add(a, b);
  hinge.position.y = 1.4;
  root.add(hinge);
  const stamp = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.18),
    ps1Material({ map: TEX.sign('PAST DUE', { bg: '#f0ecdc', fg: '#b01818', w: 64, h: 16, font: 'bold 11px monospace' }), double: true })
  );
  stamp.position.set(0.3, -0.15, 0.01);
  a.add(stamp);
  return {
    root,
    t: Math.random() * 6,
    update(dt) {
      this.t += dt;
      a.rotation.y = -0.6 - Math.sin(this.t * 7) * 0.5;
      b.rotation.y = Math.PI + 0.6 + Math.sin(this.t * 7) * 0.5;
      hinge.position.y = 1.3 + Math.sin(this.t * 3) * 0.2;
    },
    tintMat: mat,
  };
}

// Simple cars
export function makeCar(color = 0x8a2a2a, opts = {}) {
  const g = new THREE.Group();
  const mat = charMaterial();
  const add = (w, h, d, c, x, y, z) => {
    const m = box(w, h, d, c, x, y, z);
    g.add(m);
    return m;
  };
  const wagon = opts.wagon;
  add(1.8, 0.7, 4.2, color, 0, 0.65, 0);
  add(1.62, 0.6, wagon ? 3.0 : 2.2, shadeHex(color, -0.15), 0, 1.3, wagon ? -0.35 : -0.1);
  add(1.64, 0.42, wagon ? 2.9 : 2.1, 0x1a2436, 0, 1.32, wagon ? -0.35 : -0.1); // glass band
  add(1.82, 0.2, 0.1, 0xd0d0d0, 0, 0.55, 2.11); // bumper
  add(1.82, 0.2, 0.1, 0xd0d0d0, 0, 0.55, -2.11);
  add(0.3, 0.14, 0.05, 0xf0f0c0, -0.6, 0.78, 2.11);
  add(0.3, 0.14, 0.05, 0xf0f0c0, 0.6, 0.78, 2.11);
  add(0.3, 0.14, 0.05, 0xa01010, -0.6, 0.78, -2.11);
  add(0.3, 0.14, 0.05, 0xa01010, 0.6, 0.78, -2.11);
  if (opts.rack) {
    add(0.06, 0.06, 2.4, 0x202020, -0.7, 1.65, -0.35);
    add(0.06, 0.06, 2.4, 0x202020, 0.7, 1.65, -0.35);
  }
  for (const [x, z, i] of [
    [-0.9, 1.3, 0],
    [0.9, 1.3, 1],
    [-0.9, -1.3, 2],
    [0.9, -1.3, 3],
  ]) {
    const w = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 8);
    w.rotateZ(Math.PI / 2);
    w.translate(x, 0.34, z);
    colorGeo(w, 0x141414);
    g.add(new THREE.Mesh(w, mat));
    if (opts.oneHubcap ? i === 1 : true) {
      const hc = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 6);
      hc.rotateZ(Math.PI / 2);
      hc.translate(x + Math.sign(x) * 0.12, 0.34, z);
      colorGeo(hc, 0xb0b0b0);
      g.add(new THREE.Mesh(hc, mat));
    }
  }
  return g;
}

export function shadeHex(hex, amt) {
  const c = new THREE.Color(hex);
  c.r = Math.max(0, Math.min(1, c.r + amt));
  c.g = Math.max(0, Math.min(1, c.g + amt));
  c.b = Math.max(0, Math.min(1, c.b + amt));
  return c.getHex();
}

// The iron dog statue in the cemetery
export function makeDog(color = 0x1a1a1c) {
  const g = new THREE.Group();
  const add = (w, h, d, x, y, z) => g.add(box(w, h, d, color, x, y, z));
  add(0.9, 0.6, 1.2, 0, 0.5, 0); // pedestal
  g.children[0].geometry = colorGeo(g.children[0].geometry, 0x7a7870);
  add(0.3, 0.28, 0.6, 0, 1.0, 0);
  add(0.22, 0.24, 0.26, 0, 1.2, 0.32);
  add(0.12, 0.1, 0.14, 0, 1.15, 0.5);
  add(0.06, 0.1, 0.06, -0.08, 1.36, 0.3);
  add(0.06, 0.1, 0.06, 0.08, 1.36, 0.3);
  for (const [x, z] of [
    [-0.1, 0.2],
    [0.1, 0.2],
    [-0.1, -0.2],
    [0.1, -0.2],
  ])
    add(0.07, 0.22, 0.07, x, 0.85, z);
  add(0.05, 0.05, 0.25, 0, 1.08, -0.38);
  return g;
}
