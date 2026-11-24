// Pedestrians, Officer Gary (parking enforcement), the Other Hill horrors, the coal train.
import * as THREE from 'three';
import { makeHumanoid, addHeld, makeInvoice } from './actors.js';
import * as C from './content.js';

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export function createAI(game) {
  const { world, scene, audio, ui } = game;
  const player = game.player;
  const ai = { radioLevel: 0 };
  const S = () => game.S;
  const tmp = new THREE.Vector3();

  // ------------------------------------------------------------- pedestrians
  const LOOKS = [
    { skin: 0xe0b090, shirt: 0xc8a020, pants: 0x3a3a5a, hair: 0x6a4a2a, hairStyle: 'long', bag: 0x2a2a2a },
    { skin: 0x7a5030, shirt: 0x2a2a2a, pants: 0x5a5a5a, hairStyle: 'cap', hatColor: 0x8a2a2a },
    { skin: 0xf0d0b8, shirt: 0x6a8aa0, pants: 0xc8b890, hair: 0xd8c080, hairStyle: 'bob' },
    { skin: 0x5a3a20, shirt: 0xe0e0e0, pants: 0x2a2a3a, hair: 0x101010, hairStyle: 'bun' },
    { skin: 0xd8a888, shirt: 0x3a5a3a, pants: 0x3a3028, hair: 0x9a9a9a, hairStyle: 'short', beard: 0x9a9a9a },
    { skin: 0xe8c0a0, shirt: 0xa04a7a, pants: 0x1a1a1a, hair: 0xa02a2a, hairStyle: 'mohawk' },
    { skin: 0x9a6a48, shirt: 0xd88a3a, pants: 0x2a3a5a, hairStyle: 'beanie', hatColor: 0x2a6a6a },
    { skin: 0xf0d8c8, shirt: 0x1a1a1a, pants: 0x1a1a1a, hair: 0x2a1a10, hairStyle: 'long', glasses: true },
    { skin: 0xc89070, shirt: 0x8a8a6a, pants: 0x4a3a2a, hairStyle: 'short', hair: 0x2a1a10 },
  ];
  const peds = [];
  LOOKS.forEach((look, i) => {
    const b = world.blocks[(i * 5 + 1) % world.blocks.length];
    const a = makeHumanoid(look);
    if (i % 3 === 0) addHeld(a, 'phone');
    scene.add(a.root);
    const corners = [
      [b.x0 + 1.0, b.z0 + 1.0],
      [b.x1 - 1.0, b.z0 + 1.0],
      [b.x1 - 1.0, b.z1 - 1.0],
      [b.x0 + 1.0, b.z1 - 1.0],
    ];
    const c = i % 4;
    const p = { actor: a, corners, target: (c + 1) % 4, dir: 1, pos: new THREE.Vector3(corners[c][0], 0.15, corners[c][1]), speed: 1.1 + Math.random() * 0.5, stuck: 0, lastPos: new THREE.Vector3(), line: C.PEDS[i % C.PEDS.length], pause: 0 };
    p.pos.lerp(new THREE.Vector3(corners[p.target][0], 0.15, corners[p.target][1]), Math.random());
    peds.push(p);
  });

  // ------------------------------------------------------------- Officer Gary
  const off = {
    actor: makeHumanoid({ skin: 0xc8a888, shirt: 0x2a3a5a, vest: 0xd8e020, pants: 0x1a1a2a, hairStyle: 'cap', hatColor: 0x1a2a4a, height: 1.08, beard: 0x5a4a3a }),
    pos: new THREE.Vector3(30, 0.15, -37),
    state: 'off',
    corners: null,
    target: 0,
    reason: null,
    writeT: 0,
    cooldownUntil: 0,
    lastHour: -1,
    hitCD: 0,
  };
  addHeld(off.actor, 'ticketbook');
  scene.add(off.actor.root);
  off.actor.root.visible = false;

  function blockNear(x, z) {
    let best = world.blocks[0];
    let bd = 1e9;
    for (const b of world.blocks) {
      const d = Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }
  function officerDuty() {
    const s = S();
    const h = game.hour();
    return h >= 8 && h < 18 && game.wday() < 6 && !s.car.booted;
  }
  function setPatrol() {
    const b = blockNear(game.car.position.x, game.car.position.z);
    off.corners = [
      [b.x0 + 1.0, b.z0 + 1.0],
      [b.x1 - 1.0, b.z0 + 1.0],
      [b.x1 - 1.0, b.z1 - 1.0],
      [b.x0 + 1.0, b.z1 - 1.0],
    ];
    off.target = Math.floor(Math.random() * 4);
  }
  ai.officerReset = (pardon) => {
    off.state = officerDuty() ? 'patrol' : 'off';
    off.reason = null;
    if (pardon) off.cooldownUntil = S().t + 120;
    setPatrol();
  };

  // ------------------------------------------------------------- horrors
  const enemies = [];
  let spawnT = 0;
  let rentHeadNight = -1;
  function makeEnemy(type) {
    let actor = null;
    let obj;
    if (type === 'wraith') {
      actor = makeHumanoid({ skin: 0xb8b4a8, shirt: 0x4a4a4a, vest: 0xd8e030, pants: 0x1a1a1a, faceless: true, height: 1.38, build: 0.82, hairStyle: 'cap', hatColor: 0x101010, enemy: true });
      addHeld(actor, 'ticketbook');
    } else if (type === 'ghoul') {
      actor = makeHumanoid({ skin: 0x9a9a8a, shirt: 0xf0b0c0, pants: 0xc8c0a0, faceless: true, build: 1.3, hairStyle: 'short', hair: 0x5a4a3a, glasses: true, enemy: true });
      addHeld(actor, 'mimosa');
      actor.parts.torso.rotation.x = 0.45;
    } else if (type === 'renthead') {
      actor = makeHumanoid({ skin: 0x7a6a5a, shirt: 0x3a2a20, pants: 0x2a2018, signHead: true, faceless: true, hairStyle: 'none', height: 1.45, build: 1.45, enemy: true });
      addHeld(actor, 'key');
    }
    if (actor) obj = actor.root;
    let inv = null;
    if (type === 'invoice') {
      inv = makeInvoice();
      obj = inv.root;
    }
    const stats = { wraith: [3, 2.3], invoice: [1, 3.5], ghoul: [4, 1.5], renthead: [12, 1.9] }[type];
    scene.add(obj);
    return { type, actor, inv, obj, pos: new THREE.Vector3(), hp: stats[0], speed: stats[1], cd: 1, dead: 0, flick: 0, yaw: 0 };
  }
  function spawn(type, dist) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = dist ?? 20 + Math.random() * 10;
      const x = player.pos.x + Math.sin(a) * d;
      const z = player.pos.z + Math.cos(a) * d;
      const b = world.bounds;
      if (x < b.x0 + 2 || x > b.x1 - 2 || z < b.z0 + 2 || z > b.z1 - 2) continue;
      if (world.blocked(x, z, 0.5)) continue;
      const e = makeEnemy(type);
      e.pos.set(x, world.groundY(x, z), z);
      enemies.push(e);
      return e;
    }
    return null;
  }
  function removeEnemy(e) {
    scene.remove(e.obj);
    const i = enemies.indexOf(e);
    if (i >= 0) enemies.splice(i, 1);
  }
  ai.clearHostiles = () => {
    for (const e of [...enemies]) removeEnemy(e);
  };

  ai.hitArc = (pos, fwd, range) => {
    let any = false;
    for (const e of enemies) {
      if (e.dead) continue;
      tmp.copy(e.pos).sub(pos).setY(0);
      const d = tmp.length();
      if (d > range + (e.type === 'renthead' ? 0.6 : 0)) continue;
      tmp.normalize();
      if (tmp.dot(fwd) < 0.3 && d > 0.7) continue;
      e.hp--;
      e.flick = 0.18;
      e.pos.addScaledVector(tmp, e.type === 'renthead' ? 0.5 : 1.4);
      any = true;
      if (e.hp <= 0) {
        e.dead = 0.6;
        game.reward(e.type);
      }
    }
    if (off.actor.root.visible && off.hitCD <= 0) {
      tmp.copy(off.pos).sub(pos).setY(0);
      const d = tmp.length();
      if (d < range && tmp.normalize().dot(fwd) > 0.3) {
        off.hitCD = 30;
        any = true;
        game.issueTicket('Assault on a public servant with a U-lock (reduced to a parking violation; Gary respects the hustle)', 100);
      }
    }
    for (const p of peds) {
      if (!p.actor.root.visible) continue;
      tmp.copy(p.pos).sub(pos).setY(0);
      const d = tmp.length();
      if (d < range && tmp.normalize().dot(fwd) > 0.3) {
        any = true;
        p.pause = 2;
        p.pos.addScaledVector(tmp, 0.8);
        ui.toast(rnd(['NEIGHBOR: "Ow?! This is a historic district!"', 'NEIGHBOR: "Did you just— with a bike lock?"', 'NEIGHBOR: "I\'m telling the neighborhood Facebook group."']), 'bad');
        game.fx({ sanity: -2, clout: -2 }, true);
      }
    }
    if (any) audio.sfx.hit();
  };

  ai.nearbyTalker = (pos) => {
    let best = null;
    let bd = 1.9;
    if (off.actor.root.visible) {
      const d = Math.hypot(off.pos.x - pos.x, off.pos.z - pos.z);
      if (d < 2.4) {
        best = { pos: off.pos, label: 'Talk to Officer Gary (parking)', act: () => game.talkOfficer(off.state === 'toCar' || off.state === 'writing') };
        bd = d;
      }
    }
    for (const p of peds) {
      if (!p.actor.root.visible) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bd) {
        bd = d;
        best = {
          pos: p.pos,
          label: 'Talk to neighbor',
          act: async () => {
            p.pause = 4;
            p.actor.root.rotation.y = Math.atan2(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
            await game.talkPed(p.line);
            p.line = rnd(C.PEDS);
          },
        };
      }
    }
    return best;
  };

  // ------------------------------------------------------------- train
  const train = world.train;
  let nextTrain = 9 * 60 + 40;

  // ------------------------------------------------------------- simulate time jumps
  let lastT = null;
  function simulateJump(from, to) {
    let tickets = 0;
    const cap = to - from > 240 ? 2 : 1;
    for (let t = Math.ceil(from / 60) * 60; t < to && tickets < cap; t += 60) {
      const h = (t % 1440) / 60;
      const d = Math.floor(t / 1440) + 1;
      if (!(h >= 8 && h < 18 && (d - 1) % 7 < 6) || S().car.booted || t < off.cooldownUntil) continue;
      const v = game.carViolation(t);
      if (v && Math.random() < 0.2) {
        game.issueTicket(v[0], v[1]);
        tickets++;
        off.cooldownUntil = t + 120;
      } else if (Math.random() < 0.025) {
        const r = rnd(C.TICKET_REASONS);
        game.issueTicket(r[0], r[1]);
        tickets++;
        off.cooldownUntil = t + 120;
      }
    }
  }

  // ------------------------------------------------------------- update
  function walkTo(ent, tx, tz, speed, dt, r = 0.3) {
    const dx = tx - ent.pos.x;
    const dz = tz - ent.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const step = Math.min(d, speed * dt);
    ent.pos.x += (dx / d) * step;
    ent.pos.z += (dz / d) * step;
    world.collide(ent.pos, r);
    ent.yaw = Math.atan2(dx, dz);
    return d;
  }

  ai.update = (dt, blocked, otherLevel) => {
    const s = S();
    if (!s) return;
    const out = s.loc === 'out';
    const h = game.hour();
    let radio = 0;

    if (lastT === null) lastT = s.t;
    if (s.t - lastT > 8) simulateJump(lastT, s.t);
    lastT = s.t;

    // ---- pedestrians
    const pedsOn = out && h >= 7 && h < 22 && otherLevel < 0.3;
    for (const p of peds) {
      p.actor.root.visible = pedsOn;
      if (!pedsOn || blocked) continue;
      if (p.pause > 0) {
        p.pause -= dt;
        p.actor.update(dt, 0);
        continue;
      }
      const [tx, tz] = p.corners[p.target];
      p.lastPos.copy(p.pos);
      const d = walkTo(p, tx, tz, p.speed, dt);
      if (d < 0.6) p.target = (p.target + p.dir + 4) % 4;
      const moved = p.lastPos.distanceTo(p.pos);
      if (moved < p.speed * dt * 0.3) p.stuck += dt;
      else p.stuck = Math.max(0, p.stuck - dt);
      if (p.stuck > 1.2) {
        p.dir *= -1;
        p.target = (p.target + p.dir + 4) % 4;
        p.stuck = 0;
      }
      if (Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < 0.9) p.pause = 0.6;
      p.pos.y = world.groundY(p.pos.x, p.pos.z);
      p.actor.root.position.copy(p.pos);
      p.actor.root.rotation.y = p.yaw ?? 0;
      p.actor.update(dt, p.speed);
    }

    // ---- Officer Gary
    const duty = officerDuty();
    if (!duty) {
      off.state = 'off';
    } else if (off.state === 'off') {
      setPatrol();
      const c = off.corners[off.target];
      off.pos.set(c[0], 0.15, c[1]);
      off.state = 'patrol';
    }
    off.hitCD -= dt;
    if (off.state !== 'off' && !blocked) {
      const hourNow = Math.floor(s.t / 60);
      if (off.state === 'patrol' && hourNow !== off.lastHour) {
        off.lastHour = hourNow;
        if (s.t >= off.cooldownUntil) {
          const v = game.carViolation();
          if (v) {
            off.state = 'toCar';
            off.reason = v;
            off.flippant = false;
          } else if (Math.random() < 0.05) {
            off.state = 'toCar';
            off.reason = rnd(C.TICKET_REASONS);
            off.flippant = true;
          }
          if (off.state === 'toCar' && out && Math.hypot(game.car.position.x - player.pos.x, game.car.position.z - player.pos.z) < 60) ui.toast('Your radio crackles. Someone is walking toward your Subaru...', 'bad');
        }
      }
      if (off.state === 'patrol') {
        const [tx, tz] = off.corners[off.target];
        if (walkTo(off, tx, tz, 1.3, dt) < 0.6) off.target = (off.target + 1) % 4;
      } else if (off.state === 'toCar') {
        if (!off.flippant && !game.carViolation()) ai.officerReset();
        else {
          const cp = game.car.position;
          const side = cp.x < 0 || world.curbSpots[s.car.spot].side === 'L' ? 1 : -1;
          const tx = cp.x + side * 1.7;
          if (walkTo(off, tx, cp.z, 2.0, dt) < 0.8) {
            off.state = 'writing';
            off.writeT = 3.5;
          }
        }
      } else if (off.state === 'writing') {
        off.writeT -= dt;
        off.yaw = Math.atan2(game.car.position.x - off.pos.x, game.car.position.z - off.pos.z);
        if (off.writeT <= 0) {
          game.issueTicket(off.reason[0], off.reason[1]);
          off.cooldownUntil = s.t + 150;
          ai.officerReset();
        }
      }
    }
    const offVis = out && off.state !== 'off' && otherLevel < 0.5;
    off.actor.root.visible = offVis;
    if (offVis) {
      off.pos.y = world.groundY(off.pos.x, off.pos.z);
      off.actor.root.position.copy(off.pos);
      off.actor.root.rotation.y = off.yaw ?? 0;
      off.actor.update(blocked ? 0 : dt, off.state === 'writing' || blocked ? 0 : off.state === 'toCar' ? 2 : 1.3);
      if (off.state === 'writing') off.actor.parts.armR.rotation.x = -1.2 + Math.sin(performance.now() / 90) * 0.2;
      if (off.state === 'toCar' || off.state === 'writing') {
        const d = Math.hypot(off.pos.x - player.pos.x, off.pos.z - player.pos.z);
        radio = Math.max(radio, 0.6 * Math.max(0, 1 - d / 35));
      }
    }

    // ---- the Other Hill
    if (out && otherLevel > 0.6 && !blocked) {
      spawnT -= dt;
      const target = 3 + (s.clout < 30 ? 2 : 0) + (s.sanity < 25 ? 2 : 0);
      const alive = enemies.filter((e) => !e.dead).length;
      if (spawnT <= 0 && alive < target) {
        spawnT = 2.5 + Math.random() * 2;
        const r = Math.random();
        spawn(r < 0.38 ? 'wraith' : r < 0.72 ? 'invoice' : 'ghoul');
      }
      const d = game.day();
      const rentEve = (d === 7 || d === 14) && h < 5 && !s.rentPaid[d];
      if ((rentEve || (s.notice && h < 5)) && rentHeadNight !== d && !enemies.some((e) => e.type === 'renthead')) {
        if (spawn('renthead', 26)) {
          rentHeadNight = d;
          ui.toast('Something enormous is dragging a key down the street.', 'bad');
          audio.sfx.clank();
        }
      }
      if (Math.random() < dt * 0.08) audio.sfx.clank();
    }
    if ((!out || otherLevel < 0.25) && enemies.length) {
      for (const e of enemies) if (!e.dead) e.dead = 0.6;
    }
    for (const e of [...enemies]) {
      if (e.dead) {
        e.dead -= dt;
        e.obj.scale.setScalar(Math.max(0.01, e.dead / 0.6));
        e.obj.position.y -= dt * 1.5;
        if (e.dead <= 0) removeEnemy(e);
        continue;
      }
      const dx = player.pos.x - e.pos.x;
      const dz = player.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 60) {
        removeEnemy(e);
        continue;
      }
      radio = Math.max(radio, Math.max(0, 1 - dist / 30) * (e.type === 'renthead' ? 1.2 : 1));
      if (!blocked) {
        e.cd -= dt;
        if (dist > 1.0) {
          const sp = e.speed * dt;
          e.pos.x += (dx / dist) * sp;
          e.pos.z += (dz / dist) * sp;
          if (e.type !== 'invoice') world.collide(e.pos, e.type === 'renthead' ? 0.6 : 0.35);
        }
        e.yaw = Math.atan2(dx, dz);
        if (dist < (e.type === 'renthead' ? 1.6 : 1.2) && e.cd <= 0) {
          e.cd = e.type === 'renthead' ? 1.6 : 1.3;
          if (e.actor) e.actor.attackT = 0.35;
          game.hurt(e.type, e.pos);
        }
      }
      e.pos.y = e.type === 'invoice' ? 0 : world.groundY(e.pos.x, e.pos.z) + (e.type === 'wraith' ? 0.25 + Math.sin(performance.now() / 300 + e.pos.x) * 0.1 : 0);
      e.obj.position.copy(e.pos);
      e.obj.rotation.y = e.yaw;
      e.flick -= dt;
      e.obj.visible = !(e.flick > 0 && Math.floor(e.flick * 30) % 2 === 0);
      if (e.actor) e.actor.update(blocked ? 0 : dt, blocked ? 0 : e.speed * (e.type === 'wraith' ? 0.4 : 1));
      if (e.inv) e.inv.update(dt);
    }

    // ---- train
    if (!train.active && s.t >= nextTrain) {
      train.active = true;
      train.x = -420;
      train.honked = false;
      if (out && player.pos.z > 20) audio.sfx.horn();
    }
    if (train.active) {
      train.x += dt * 13;
      train.group.position.x = train.x;
      train.group.visible = out;
      if (!train.honked && train.x > player.pos.x - 60 && out && player.pos.z > 30) {
        train.honked = true;
        audio.sfx.horn();
      }
      if (train.x > 760) {
        train.active = false;
        train.group.visible = false;
        nextTrain = s.t + 150 + Math.random() * 200;
      }
    }

    ai.radioLevel += (Math.min(1, radio) - ai.radioLevel) * Math.min(1, dt * 4);
    audio.setStatic(blocked && !out ? 0 : ai.radioLevel);
  };

  return ai;
}
