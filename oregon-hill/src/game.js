// Core gameplay: state, clock, stats, interactions, dialogue trees, endings.
import * as THREE from 'three';
import { SHARED } from './ps1.js';
import { makeHumanoid, addHeld, makeCar } from './actors.js';
import { NS, EW } from './world.js';
import * as C from './content.js';
import { escapeHtml } from './ui.js';
import { createAI } from './ai.js';

const TIME_SCALE = 2; // game minutes per real second
const RENT_DAYS = [7, 14];
const SAVE_KEY = 'oregonhill_save_v1';
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const LOC_NAMES = { home: 'Home (1209 S Pine)', bar: 'The Lowered Expectations', coffee: 'Grind Theory Coffee', mart: 'Speedee Mart', moth: 'Moth & Mortal Tattoo', sal: "Sal's Ink Emporium", juniper: 'Holy Ghost Tattoo' };
const HOURS = { coffee: [7, 19], bar: [16, 26], mart: [0, 24], moth: [12, 20], sal: [11, 21], juniper: [13, 22], home: [0, 24] };

export function createGame(ctx) {
  const { scene, world, ui, audio, pipeline } = ctx;
  let S = null;
  let busy = false;
  let ended = false;
  let otherLevel = 0;
  let otherOn = false;
  let lastFogWarn = 0;
  const game = { world, ui, audio, scene };

  // ---------------------------------------------------------------- player
  const player = {
    actor: makeHumanoid({ skin: 0xe0b090, shirt: 0x8a2a2a, sleeve: 0x8a2a2a, pants: 0x2a3448, hair: 0x2a1a10, hairStyle: 'beanie', hatColor: 0xc0a040, bag: 0xd8cca8 }),
    pos: new THREE.Vector3(),
    yaw: 0,
    speed: 0,
    attackCD: 0,
    hurtT: 0,
    stepT: 0,
  };
  addHeld(player.actor, 'ulock');
  scene.add(player.actor.root);
  game.player = player;

  // ---------------------------------------------------------------- the Subaru
  const car = makeCar(0x5a7a5a, { wagon: true, rack: true, oneHubcap: true });
  scene.add(car);
  const carCol = { x0: 0, x1: 0, z0: 0, z1: 0, h: 1.6 };
  world.dynCols.push(carCol);
  const bootMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xe0c020 }));
  bootMesh.visible = false;
  car.add(bootMesh);
  bootMesh.position.set(-1.05, 0.35, 1.3);
  function placeCar() {
    const s = world.curbSpots[S.car.spot];
    car.position.set(s.x, 0, s.z);
    car.rotation.y = s.side === 'L' ? Math.PI : 0;
    Object.assign(carCol, { x0: s.x - 1, x1: s.x + 1, z0: s.z - 2.2, z1: s.z + 2.2 });
    bootMesh.visible = !!S.car.booted;
  }
  game.car = car;

  // ---------------------------------------------------------------- NPCs
  const npcs = {};
  function npc(id, look, loc, pos, yaw, sitting = false, held = null) {
    const a = makeHumanoid(look);
    a.root.position.copy(pos);
    a.root.rotation.y = yaw;
    a.sitting = sitting;
    if (held) addHeld(a, held);
    a.update(0, 0);
    scene.add(a.root);
    npcs[id] = { actor: a, loc, pos: pos.clone() };
    return a;
  }
  const IN = world.interiors;
  npc('sage', { skin: 0xd8b8a0, shirt: 0x6a4a8a, pants: 0x3a3a3a, hair: 0x3ab08a, hairStyle: 'mohawk' }, 'home', IN.home.spots.sage, Math.PI / 2, true);
  npc('wren', { skin: 0xb88868, shirt: 0x1a1a1a, pants: 0x1a1a1a, hair: 0x101010, hairStyle: 'bun' }, 'bar', IN.bar.spots.wren, 0);
  npc('tanner', { skin: 0xe8c0a0, shirt: 0x8a3a2a, pants: 0x3a4a6a, hairStyle: 'cap', hatColor: 0x2a4a2a, beard: 0x6a4a2a }, 'bar', IN.bar.spots.tanner, 0, true, 'beer');
  npc('bex', { skin: 0xf0d0b8, shirt: 0x101010, pants: 0x4a5a8a, hair: 0xf0e0a0, hairStyle: 'bob' }, 'bar', IN.bar.spots.bex, Math.PI, true, 'beer');
  npc('jules', { skin: 0x8a5a3a, shirt: 0x2a5a3a, pants: 0x2a2a2a, hair: 0x101010, hairStyle: 'short', glasses: true }, 'coffee', IN.coffee.spots.jules, 0);
  npc('fl1', { skin: 0xe0b090, shirt: 0xc0b090, pants: 0x3a3a3a, hair: 0x8a5a2a, hairStyle: 'long' }, 'coffee', IN.coffee.spots.freelancer1, Math.PI, true);
  npc('fl2', { skin: 0x6a4a30, shirt: 0x3a6a8a, pants: 0x2a2a2a, hairStyle: 'beanie', hatColor: 0x2a2a2a }, 'coffee', IN.coffee.spots.freelancer2, Math.PI, true);
  npc('donny', { skin: 0xd0a080, shirt: 0xd02020, pants: 0x2a2a3a, hair: 0x4a3a2a, hairStyle: 'short', beard: 0x4a3a2a, build: 1.2 }, 'mart', IN.mart.spots.donny, 0);
  npc('moth', { skin: 0xe8d8d0, shirt: 0x101010, pants: 0x101010, hair: 0x101010, hairStyle: 'long' }, 'moth', IN.moth.spots.artist, -Math.PI / 2);
  npc('sal', { skin: 0xd0a080, shirt: 0xe8e8e8, pants: 0x2a3a5a, hairStyle: 'none', beard: 0x8a8a8a, build: 1.35 }, 'sal', IN.sal.spots.artist, -Math.PI / 2);
  npc('juniper', { skin: 0xf0d0b8, shirt: 0x5a6a8a, pants: 0x5a6a8a, hair: 0xc04a1a, hairStyle: 'bun' }, 'juniper', IN.juniper.spots.artist, -Math.PI / 2);
  const daleSpot = world.anchors.home.pos.clone().add(new THREE.Vector3(0, 0.15, 2.2));
  npc('dale', { skin: 0xe8b090, shirt: 0x1a2a5a, pants: 0xb8a880, hairStyle: 'none', glasses: true, lanyard: true, build: 1.15 }, 'out', daleSpot, -Math.PI / 2, false, 'phone');
  for (const t of ['tanner', 'bex', 'fl1', 'fl2']) npcs[t].actor.parts.armR.rotation.x = -0.6;

  // ---------------------------------------------------------------- memos
  const memoMeshes = {};
  const memoMat = new THREE.MeshBasicMaterial({ color: 0xfff8e0 });
  for (const m of C.MEMOS) {
    const p = world.memoSpots[m.id];
    if (!p) continue;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.45), memoMat);
    mesh.position.copy(p);
    scene.add(mesh);
    memoMeshes[m.id] = mesh;
  }

  // ---------------------------------------------------------------- state
  function newState() {
    return {
      t: 9 * 60,
      money: 480,
      energy: 85,
      sanity: 70,
      clout: 30,
      drunk: 0,
      hangover: false,
      rent: 875,
      nextRent: 875,
      rentPaid: {},
      notice: 0,
      lateFee: 0,
      tickets: [],
      ticketId: 1,
      permitUntil: 3,
      portalDownUntil: 0,
      car: { spot: world.homeSpot, parkedAt: 9 * 60, booted: false },
      gigs: [],
      invoices: [],
      board: [],
      boardDay: 0,
      gigId: 1,
      workedToday: 0,
      ink: [],
      inkDay: 0,
      artistRep: {},
      memos: [],
      fridge: 2,
      friendship: 50,
      honesty: 0,
      friendsGoneDay: 0,
      sage: { mood: 'lucid', owes: 32, pokes: 0, talkedDay: 0, lent: 0 },
      daleTalkedDay: 0,
      events: {},
      eventDay: 0,
      dogNights: [],
      flags: {},
      chatDay: {},
      flash: true,
      stats: { gigs: 0, earned: 0, tickets: 0, ticketsPaid: 0, drinks: 0, events: 0, kills: 0, chats: 0 },
      loc: 'out',
      pos: [world.anchors.home.pos.x, 0, world.anchors.home.pos.z],
      yaw: world.anchors.home.rot,
    };
  }

  // ---------------------------------------------------------------- clock helpers
  const day = () => Math.floor(S.t / 1440) + 1;
  const mins = () => S.t % 1440;
  const hour = () => mins() / 60;
  const wday = (d = day()) => (d - 1) % 7;
  const fmtTime = (t = S.t) => {
    const m = t % 1440;
    let h = Math.floor(m / 60);
    const mm = Math.floor(m % 60);
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(mm).padStart(2, '0')} ${ap}`;
  };
  const fmtHour = (h) => {
    const hh = h % 24;
    return `${hh % 12 || 12}${hh >= 12 ? 'PM' : 'AM'}`;
  };
  Object.assign(game, { day, hour, wday, fmtTime });

  const energyCap = () => (S.hangover ? 75 : 100);

  function fx(ch, silent = false) {
    const parts = [];
    let good = 0;
    for (const k of ['money', 'energy', 'sanity', 'clout']) {
      const v = ch[k];
      if (!v) continue;
      if (k === 'money') S.money = Math.round((S.money + v) * 100) / 100;
      else if (k === 'energy') S.energy = clamp(S.energy + v, 0, v > 0 ? Math.max(energyCap(), S.energy) : 100);
      else S[k] = clamp(S[k] + v, 0, 100);
      good += k === 'money' ? Math.sign(v) * 2 : Math.sign(v);
      parts.push(k === 'money' ? `${v > 0 ? '+' : '-'}$${Math.abs(v)}` : `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`);
    }
    if (ch.drunk) {
      S.drunk = Math.max(0, S.drunk + ch.drunk);
      if (ch.drunk > 0) S.stats.drinks += ch.drunk;
    }
    if (!silent && parts.length) ui.toast(parts.join('  ·  '), good > 0 ? 'good' : good < 0 ? 'bad' : '');
    if (ch.money > 0) audio.sfx.cash();
    checkVitals();
  }
  game.fx = fx;

  let passingOut = false;
  function checkVitals() {
    if (ended || !S) return;
    if (S.sanity <= 0) endGame('insane');
    else if (S.energy <= 0 && !passingOut) passOut();
  }

  // ---------------------------------------------------------------- time
  function advance(m) {
    const d0 = day();
    S.t += m;
    const d1 = day();
    for (let d = d0 + 1; d <= d1 && !ended; d++) midnight(d);
  }
  game.advance = advance;

  function midnight(d) {
    // clout decays: you have to keep showing up
    const decay = S.eventDay >= d - 1 ? 5 : 9;
    S.clout = clamp(S.clout - decay, 0, 100);
    // late fees
    for (const tk of S.tickets) if (!tk.paid && d - tk.day > 3 && tk.late < 5) {
      tk.amount += 10;
      tk.late++;
    }
    // invoices
    for (const inv of S.invoices) {
      if (inv.settled || inv.due > d) continue;
      if (inv.ghost) {
        if (!inv.ghostNoted) {
          inv.ghostNoted = true;
          ui.toast(`${inv.client} has gone silent. Their Instagram is still posting though.`, 'bad');
        }
        continue;
      }
      inv.settled = true;
      S.money += inv.amount;
      S.stats.earned += inv.amount;
      ui.toast(`Payment received from ${inv.client}: +$${inv.amount}`, 'good');
      audio.sfx.cash();
    }
    // missed deadlines
    for (const g of S.gigs) {
      if (g.failed || g.complete || g.deadline >= d) continue;
      g.failed = true;
      S.clout = clamp(S.clout - 8, 0, 100);
      ui.toast(`Missed deadline: ${g.client} hired a 19-year-old on Fiverr. CLOUT -8`, 'bad');
    }
    S.gigs = S.gigs.filter((g) => !g.failed && !g.complete);
    // rent
    for (const rd of RENT_DAYS) {
      if (d === rd + 1 && !S.rentPaid[rd]) {
        S.notice = d + 4;
        S.lateFee = 75;
        ui.toast(`RENT UNPAID. Dale taped a 5-day pay-or-quit notice to your door. +$75 late fee. Deadline: Day ${S.notice}.`, 'bad');
        audio.sfx.bad();
      }
    }
    if (S.notice && d > S.notice && !rentCurrent()) {
      endGame('evicted');
      return;
    }
    if (d > S.permitUntil && d === S.permitUntil + 1) ui.toast('Your Zone 1 parking permit expired. Renew it: TAB → TICKETS (if the city portal works).', 'bad');
    if (S.tickets.filter((t) => !t.paid).reduce((a, t) => a + t.amount, 0) > 300 && !S.car.booted) {
      S.car.booted = true;
      placeCar();
      ui.toast('Your Subaru has been BOOTED for unpaid tickets. Pay them on your phone.', 'bad');
    }
    // roommate + misc
    rollSage(d);
    S.workedToday = 0;
    if (d >= 15) {
      endGame('final');
      return;
    }
  }

  function rentCurrent() {
    return RENT_DAYS.filter((rd) => rd < day()).every((rd) => S.rentPaid[rd]);
  }
  function nextRentDay() {
    return RENT_DAYS.find((rd) => !S.rentPaid[rd]);
  }
  function rentOwed() {
    return S.rent + (S.notice ? S.lateFee : 0);
  }

  function rollSage(d) {
    const pool = ['khole', 'khole', 'lucid', 'lucid', 'borrow', 'utilities', 'absent'];
    if (S.sage.pokes < 2) pool.push('stickpoke', 'stickpoke');
    let m = rnd(pool);
    if (m === 'utilities' && S.sage.owes <= 0) m = 'khole';
    S.sage.mood = m;
    if (S.sage.lent > 0 && Math.random() < 0.35) {
      S.money += S.sage.lent;
      ui.toast(`Sage paid you back $${S.sage.lent}, plus a crystal "for your aura." Huh!`, 'good');
      S.sage.lent = 0;
    }
  }

  // ---------------------------------------------------------------- locations & travel
  async function enter(key) {
    const [o, c] = HOURS[key];
    const h = hour();
    const hh = h < 6 && c > 24 ? h + 24 : h;
    if (!(hh >= o && hh < c)) {
      const msg = {
        coffee: 'Closed. A sign reads: "Open 7-7. Go home. Hydrate. Invoice someone."',
        bar: 'Closed until 4PM. Through the window you can see Wren stacking chairs and judging you.',
        moth: 'Closed. Hours 12-8. A cat stares at you through the glass.',
        sal: 'Closed. "OPEN 11-9. GONE FISHIN\' OTHERWISE. — SAL"',
        juniper: 'Closed. Hours 1-10PM. A tarot card is taped to the door: The Hermit.',
      }[key];
      await ui.say('', msg);
      return;
    }
    await ui.fade(true);
    audio.sfx.door();
    S.loc = key;
    const I = world.interiors[key];
    player.pos.copy(I.spawn);
    player.yaw = Math.PI;
    ai.clearHostiles();
    if (key === 'home') npcs.sage.actor.root.visible = S.sage.mood !== 'absent';
    if (key === 'bar') {
      const gone = S.friendsGoneDay === day();
      npcs.tanner.actor.root.visible = !gone;
      npcs.bex.actor.root.visible = !gone;
    }
    await ui.fade(false);
    ui.toast(LOC_NAMES[key]);
  }
  async function leave() {
    const I = world.interiors[S.loc];
    await ui.fade(true);
    audio.sfx.door();
    const a = world.anchors[I.exitTo];
    S.loc = 'out';
    player.pos.copy(a.pos);
    player.yaw = a.rot;
    await ui.fade(false);
  }
  game.inside = () => S.loc !== 'out';

  // ---------------------------------------------------------------- interactables
  const acts = [];
  const add = (loc, pos, r, label, act, cond) => acts.push({ loc, pos, r, label, act, cond });

  // doors
  for (const k of ['home', 'bar', 'coffee', 'mart', 'moth', 'sal', 'juniper']) {
    add('out', world.anchors[k].pos, 2.2, () => (k === 'home' ? 'Go inside' : `Enter ${LOC_NAMES[k]}`), () => enter(k));
    const I = world.interiors[k];
    add(k, I.exit, 1.6, () => 'Leave', () => leave());
  }
  // home
  const HS = IN.home.spots;
  add('home', HS.sage, 1.9, () => (S.sage.mood === 'absent' ? 'Read Sage\'s note' : 'Talk to Sage'), talkSage);
  add('home', HS.desk, 1.6, () => 'Work on a gig (desk)', () => workGig(false));
  add('home', HS.bed, 1.8, () => 'Sleep', sleep);
  add('home', HS.fridge, 1.5, () => `Fridge (${S.fridge} beers)`, openFridge);
  add('home', HS.mirror, 1.3, () => 'Look in the mirror', () => ui.say('', C.MIRROR(S)));
  add('home', HS.mold, 1.6, () => 'Inspect the mold', inspectMold);
  add('home', HS.tv, 1.5, () => 'Watch TV', watchTV);
  // outside home: Dale
  add('out', daleSpot, 2.0, () => 'Talk to Dale (landlord)', talkDale, () => daleHere());
  // car
  add('out', car.position, 3.0, () => 'Check on your Subaru', carMenu);
  // bar
  const BS = IN.bar.spots;
  add('bar', BS.wren, 2.2, () => 'Talk to Wren (bartender)', talkWren);
  add('bar', BS.booth, 1.8, () => 'Join Tanner & Bex', talkFriends, () => S.friendsGoneDay !== day());
  add('bar', BS.jukebox, 1.5, () => 'Jukebox ($1)', jukebox);
  add('bar', BS.trivia, 2.0, () => eventLabel('bar'), () => attendEvent(eventNow('bar')), () => !!eventNow('bar'));
  // coffee
  const CS = IN.coffee.spots;
  add('coffee', CS.jules, 2.2, () => 'Talk to Jules (barista)', talkJules);
  add('coffee', CS.gigs, 1.6, () => 'Gig board', gigBoard);
  add('coffee', CS.events, 1.6, () => 'RVA Happenings board', eventsBoard);
  add('coffee', CS.freelancer1, 1.4, () => 'Talk to freelancer', () => talkFreelancer(0));
  add('coffee', CS.freelancer2, 1.4, () => 'Talk to freelancer', () => talkFreelancer(1));
  // mart
  const MS = IN.mart.spots;
  add('mart', MS.counter, 1.8, () => 'Talk to Donny', martShop);
  add('mart', MS.cooler, 1.6, () => 'Browse the cooler', martShop);
  add('mart', MS.lotto, 1.4, () => 'Scratch-off machine ($2)', () => buyMart(C.MART.find((x) => x.id === 'scratch')));
  // tattoo shops
  for (const k of ['moth', 'sal', 'juniper']) {
    add(k, IN[k].spots.talk, 1.9, () => `Talk to ${C.ARTISTS[k].name}`, () => tattooVisit(k));
    add(k, IN[k].spots.flash, 1.6, () => 'Look at the flash', () => ui.say('', `Flash sheets cover the wall. ${C.ARTISTS[k].flash.map((f) => f.name).join(', ')}. Prices are "starting at."`));
  }
  // outdoor specials
  add('out', world.anchors.basement.pos, 2.2, () => eventLabel('basement') || 'The Basement (door)', () => venueDoor('basement'));
  add('out', world.anchors.gallery.pos, 2.2, () => eventLabel('gallery') || 'Gallery Fivefold (door)', () => venueDoor('gallery'));
  add('out', world.anchors.cemetery.pos, 3.0, () => eventLabel('cemetery') || 'Cemetery gate', () => venueDoor('cemetery'), () => !!eventNow('cemetery') || hour() < 21);
  add('out', world.anchors.overlook.pos, 3.0, () => eventLabel('overlook') || 'Sit and look at the river', () => venueDoor('overlook'));
  add('out', world.anchors.bus.pos, 2.4, () => 'GRTC bus stop', busStop);
  add('out', world.anchors.dog.pos, 2.2, () => 'The iron dog', petDog);
  // memos
  for (const m of C.MEMOS) {
    const p = world.memoSpots[m.id];
    if (!p) continue;
    const loc = p.x > 900 ? 'home' : 'out';
    add(loc, new THREE.Vector3(p.x, 0, p.z), 1.6, () => `Read: ${m.title}`, () => readMemo(m), () => !S.memos.includes(m.id));
  }

  // ---------------------------------------------------------------- AI
  const ai = createAI(game);
  game.ai = ai;

  // ---------------------------------------------------------------- tickets / parking
  function issueTicket(reason, amount) {
    const tk = { id: S.ticketId++, reason, amount, day: day(), paid: false, late: 0 };
    S.tickets.push(tk);
    S.stats.tickets++;
    audio.sfx.ticket();
    ui.toast(`PARKING TICKET $${amount}: "${reason}"`, 'bad');
    fx({ sanity: -3 }, true);
    if (S.tickets.filter((t) => !t.paid).reduce((a, t) => a + t.amount, 0) > 300 && !S.car.booted) {
      S.car.booted = true;
      placeCar();
      ui.toast('Your Subaru has been BOOTED. Pay your tickets on your phone.', 'bad');
    }
  }
  game.issueTicket = issueTicket;

  game.carViolation = (t) => {
    if (!S) return null;
    if (t === undefined) t = S.t;
    const h = (t % 1440) / 60;
    const d = Math.floor(t / 1440) + 1;
    const wd = (d - 1) % 7;
    const spot = world.curbSpots[S.car.spot];
    const sweepDay = Math.floor(Math.abs(spot.x * 7 + spot.z * 3)) % 6;
    if (wd === sweepDay && h >= 9 && h < 12 && t - S.car.parkedAt > 30) return ['Street sweeping (no sweeper has been seen in years)', 60];
    if (wd < 6 && h >= 8 && h < 18 && d > S.permitUntil && t - S.car.parkedAt > 120) return rnd([C.TICKET_REASONS[2], C.TICKET_REASONS[3], C.TICKET_REASONS[6]]);
    return null;
  };

  async function carMenu() {
    const parked = Math.floor((S.t - S.car.parkedAt) / 60);
    const permit = day() > S.permitUntil ? 'EXPIRED' : `valid thru Day ${S.permitUntil}`;
    const v = game.carViolation();
    const status = `Your 1998 Subaru Outback. One hubcap. Smells like a wet dog you've never owned.\nParked ${parked}h ago. Zone 1 permit: ${permit}.${S.car.booted ? '\nThere is a large yellow BOOT on the wheel.' : ''}${v ? '\nYou have a bad feeling about this spot.' : ''}`;
    const unpaid = S.tickets.filter((t) => !t.paid).reduce((a, t) => a + t.amount, 0);
    const c = await ui.choose('THE SUBARU', status, [
      { label: 'Move the car (circle the block, ~20 min)', disabled: S.car.booted },
      { label: `Pay off the boot ($${unpaid} in tickets + $75 boot fee)`, disabled: !S.car.booted || S.money < unpaid + 75 },
      { label: 'Sit in the car and scream (free)' },
      { label: 'Leave it' },
    ]);
    if (c === 0) {
      await ui.fade(true);
      advance(20);
      const free = world.curbSpots.map((s, i) => i).filter((i) => i !== S.car.spot);
      const near = free.filter((i) => Math.hypot(world.curbSpots[i].x - 12, world.curbSpots[i].z + 19) < 45);
      S.car.spot = Math.random() < 0.55 && near.length ? rnd(near) : rnd(free);
      S.car.parkedAt = S.t;
      placeCar();
      ai.officerReset();
      await ui.fade(false);
      const s = world.curbSpots[S.car.spot];
      const dist = Math.round(Math.hypot(s.x - player.pos.x, s.z - player.pos.z) / 13);
      fx({ energy: -3 });
      await ui.say('', dist <= 1 ? 'You circle the block twice and find a spot RIGHT where you were. A miracle. A Richmond miracle.' : `You circle for twenty minutes and find a spot about ${dist} blocks away. You walk back. Your step count is incredible.`);
      player.pos.set(s.x + (s.side === 'L' ? 2.2 : -2.2), 0, s.z + 1);
    } else if (c === 1) {
      for (const t of S.tickets) if (!t.paid) {
        t.paid = true;
        S.stats.ticketsPaid++;
      }
      fx({ money: -(unpaid + 75) });
      S.car.booted = false;
      placeCar();
      await ui.say('', 'A man in a city truck removes the boot without making eye contact. He says "see you soon" and means it.');
    } else if (c === 2) {
      advance(10);
      fx({ sanity: 5 });
      await ui.say('', 'You sit in the Subaru and scream into the steering wheel. A passing dog walker nods in solidarity. Oregon Hill understands.');
    }
  }

  // ---------------------------------------------------------------- Sage
  async function talkSage() {
    const m = S.sage.mood;
    if (m === 'absent') return ui.say('', C.SAGE.absent[0]);
    if (S.sage.talkedDay === day()) {
      return ui.say('SAGE', rnd(['Sage gives you a thumbs up from the couch. You give one back. Communication.', '"You good? I\'m good. We\'re good." Sage nods at the ceiling.', '"Hey, did you know the radiator has a heartbeat? Just me? Cool."']));
    }
    S.sage.talkedDay = day();
    if (m === 'khole') {
      await ui.say('', C.SAGE.khole[0]);
      const c = await ui.choose('SAGE', rnd(C.SAGE.khole.slice(1)), ['Sit with them for a while', 'Put a blanket on them', 'Leave them be']);
      if (c === 0) {
        advance(30);
        if (Math.random() < 0.6) {
          fx({ sanity: 5 });
          await ui.say('', 'You sit on the floor next to the couch. The TV hisses. Sage pats your head like a dog. It\'s weirdly the nicest moment of your week.');
        } else {
          fx({ sanity: -3 });
          await ui.say('', 'Sage starts explaining that the two of you are "the same consciousness experiencing rent." You leave thirty minutes later, unsettled.');
        }
      } else if (c === 1) {
        fx({ sanity: 2 });
        await ui.say('SAGE', '"...thank you, mom." They do not open their eyes.');
      }
    } else if (m === 'lucid') {
      await ui.say('', C.SAGE.lucid[0]);
      const c = await ui.choose('SAGE', '"Hey. What\'s up?"', ['Ask for advice', S.sage.owes > 0 ? `Ask for their half of utilities ($${S.sage.owes})` : { label: 'Utilities are settled', disabled: true }, 'Hang out for a bit', 'Never mind']);
      if (c === 0) {
        fx({ sanity: 6 });
        await ui.say('SAGE', rnd(C.SAGE.lucid.slice(1)));
      } else if (c === 1) {
        if (Math.random() < 0.7) {
          fx({ money: S.sage.owes });
          S.sage.owes = 0;
          await ui.say('SAGE', '"Oh shit, yeah, totally." Sage Venmos you instantly, with the memo "⚡🏠💀". Respect.');
        } else await ui.say('SAGE', '"Can I get you Friday? I get paid Friday. Not by a job. By a guy."');
      } else if (c === 2) {
        advance(45);
        fx({ sanity: 9, energy: -4 });
        await ui.say('', 'You and Sage watch a documentary about octopuses and eat cereal for dinner. Sage cries at the ending. So do you.');
      }
    } else if (m === 'borrow') {
      await ui.say('', C.SAGE.borrow[0]);
      const c = await ui.choose('SAGE', C.SAGE.borrow[1], [{ label: 'Lend them $40', disabled: S.money < 40 }, 'Say no']);
      if (c === 0) {
        fx({ money: -40, sanity: 2 });
        S.sage.lent += 40;
        await ui.say('SAGE', '"You\'re literally an angel. A broke angel. I\'ll pay you back, for real this time. For real for real."');
      } else await ui.say('SAGE', '"Totally fair. Respect. I\'ll just eat the oranges I practice tattoos on."');
    } else if (m === 'utilities') {
      await ui.say('', C.SAGE.utilities[0]);
      const c = await ui.choose('SAGE', '"Oh hey roomie! Everything okay? You have your Serious Face on."', [`Ask for their half ($${S.sage.owes})`, 'Let it go for now']);
      if (c === 0) {
        if (Math.random() < 0.5) {
          fx({ money: S.sage.owes });
          S.sage.owes = 0;
          await ui.say('SAGE', '"Ugh, you\'re right. Here." They hand you a damp envelope of cash and two Chuck E. Cheese tokens.');
        } else {
          const d = await ui.choose('SAGE', '"Can I pay you in emotional support? I\'m really good at it. I\'ve been told."', ['Accept emotional support', 'Insist on money']);
          if (d === 0) {
            fx({ sanity: 4 });
            await ui.say('SAGE', 'Sage gives you an extremely good hug and tells you your work is "so you." It helps more than $32 would. Almost.');
          } else if (Math.random() < 0.5) {
            fx({ money: Math.floor(S.sage.owes / 2), sanity: -2 });
            S.sage.owes = Math.ceil(S.sage.owes / 2);
            await ui.say('SAGE', '"Okay okay. Here\'s half of my half." That\'s a quarter, you think. You take it.');
          } else {
            fx({ sanity: -3 });
            await ui.say('SAGE', 'Sage turns their pockets inside out. A guitar pick and some lint fall out. "That\'s all I\'ve got, man. That\'s literally all I have."');
          }
        }
      }
    } else if (m === 'stickpoke') {
      await ui.say('', C.SAGE.stickpoke[0]);
      const c = await ui.choose('SAGE', C.SAGE.stickpoke[1], ['Accept the free stick-and-poke', 'Politely decline']);
      if (c === 0) {
        await ui.fade(true);
        advance(60);
        const name = rnd(C.SAGE_POKES.filter((p) => !S.ink.find((i) => i.name === p)));
        addInk({ name, artist: 'Sage (living room)', color: 0x2a2a3a, price: 0 });
        S.sage.pokes++;
        await ui.fade(false);
        fx({ sanity: 4, clout: 3 });
        await ui.say('', `Sage gives you "${name}". It took an hour and two playlists. It's terrible. You love it. It's the most Richmond thing you own.`);
      } else await ui.say('SAGE', '"Respect your body\'s boundaries. My orange didn\'t have that option."');
    }
  }

  // ---------------------------------------------------------------- home things
  async function sleep() {
    const h = hour();
    if (!(h >= 20 || h < 6 || S.energy < 35)) {
      await ui.say('', 'It\'s too early to sleep. You\'re a creative, not a cat. (Come back after 8PM, or when you\'re exhausted.)');
      return;
    }
    const c = await ui.choose('', 'Go to bed?', ['Sleep', 'Not yet']);
    if (c !== 0) return;
    await ui.fade(true);
    const wake = S.drunk >= 2 ? 10 : 8;
    const now = mins();
    let target = wake * 60;
    let delta = target - now;
    if (delta <= 60) delta += 1440;
    const hrs = delta / 60;
    const wasDrunk = S.drunk;
    advance(delta);
    if (ended) return;
    S.hangover = wasDrunk >= 2;
    S.drunk = 0;
    S.energy = clamp(30 + hrs * 8, 0, energyCap());
    S.sanity = clamp(S.sanity + 4, 0, 100);
    S.loc = 'home';
    player.pos.copy(IN.home.spots.bed).add(new THREE.Vector3(-0.6, 0, 0));
    save(true);
    await ui.fade(false);
    const d = day();
    let msg = `DAY ${d} · ${C.WEEKDAYS[wday()]}.  You slept ${Math.round(hrs)} hours.`;
    if (S.hangover) msg += '\nYou wake up HUNGOVER. Your head is a DIY venue. (Max energy reduced. Gatorade helps.)';
    if (RENT_DAYS.includes(d) && !S.rentPaid[d]) msg += `\nRENT IS DUE TODAY: $${S.rent}. Dale will be by.`;
    if (S.notice && !rentCurrent()) msg += `\nPay-or-quit notice: pay $${rentOwed()} by end of Day ${S.notice}.`;
    const ev = C.EVENTS.filter((e) => e.days.includes(wday()));
    if (ev.length) msg += '\nToday in RVA: ' + ev.map((e) => `${e.name} (${fmtHour(e.hours[0])})`).join('; ');
    await ui.say('MORNING', msg);
  }

  async function openFridge() {
    const opts = [{ label: 'Drink a beer', disabled: S.fridge <= 0 }, 'Eat something (cold pizza of unknown origin)', 'Close the fridge'];
    const c = await ui.choose('', S.fridge > 0 ? `${S.fridge} beers, a single oat milk (Sage's, empty), and a pizza box from a different presidency.` : 'No beer. A single oat milk (Sage\'s, empty). A pizza box. The light flickers.', opts);
    if (c === 0) {
      S.fridge--;
      audio.sfx.gulp();
      fx({ sanity: 4, drunk: 1 });
    } else if (c === 1) {
      fx({ energy: 10, sanity: -1 });
      await ui.say('', 'It tastes like a decision.');
    }
  }

  async function inspectMold() {
    const lines = ['The mold has grown. It looks like Florida now.', 'The mold has a face today. It looks disappointed in you.', 'You swear the mold spelled "RENT." It was probably nothing.', 'You take a picture of the mold for your "documentation" folder. It has 61 photos.'];
    fx({ sanity: -1 }, true);
    await ui.say('', rnd(lines));
  }
  async function watchTV() {
    advance(30);
    fx({ sanity: 3, energy: 2 });
    await ui.say('', rnd(['The TV only gets static. You watch it for 30 minutes. It\'s honestly better than most streaming.', 'You watch static. For a moment you see a figure in a hi-vis vest. Then it\'s gone.', 'Static. Soothing, beige static. Sage, from the couch: "it\'s about us."']));
  }

  // ---------------------------------------------------------------- Dale
  function daleHere() {
    if (!S || S.loc !== 'out') return false;
    const d = day();
    const h = hour();
    const visit = [3, 6, 7, 10, 13, 14].includes(d) || (S.notice && !rentCurrent());
    return visit && h >= 10 && h < 18 && S.daleTalkedDay !== d;
  }
  game.daleHere = daleHere;
  async function talkDale() {
    const d = day();
    await ui.say('DALE', rnd(C.DALE.greet));
    if (d === 3 && !S.flags.raise) {
      S.flags.raise = true;
      S.nextRent = S.rent + 50;
      await ui.say('DALE', C.DALE.raise);
      fx({ sanity: -6 });
    }
    const rd = nextRentDay();
    const dueSoon = rd && d >= rd - 1;
    const opts = [];
    if (dueSoon || (S.notice && !rentCurrent())) opts.push({ label: `Pay rent ($${rentOwed()})`, disabled: S.money < rentOwed(), value: 'pay' });
    opts.push({ label: 'Request a repair', value: 'repair' }, { label: 'Ask about the rent', value: 'ask' }, { label: 'Smile and back away slowly', value: 'bye' });
    const c = await ui.choose('DALE', dueSoon ? C.DALE.rentAsk : '"Anything I can help with? Within reason. Within MY reason."', opts.map((o, i) => ({ ...o, value: o.value })));
    if (c === 'pay') await payRent(false);
    else if (c === 'repair') {
      fx({ sanity: -3 });
      await ui.say('DALE', rnd(C.DALE.repair));
    } else if (c === 'ask') await ui.say('DALE', rd ? `"$${S.rent}, due Day ${rd}. That's ${C.WEEKDAYS[wday(rd)]}. It's always rent day somewhere!"` : '"You\'re all paid up! I hate it. Kidding. I hate it."');
    S.daleTalkedDay = d;
  }

  async function payRent(portal) {
    const rd = nextRentDay();
    const owed = rentOwed() + (portal ? 12.5 : 0);
    if (S.money < owed) {
      await ui.say('', `You need $${owed}. You have $${S.money}. The math is not mathing.`);
      return;
    }
    fx({ money: -owed });
    if (rd) S.rentPaid[rd] = true;
    // also clear any older missed rent
    for (const r of RENT_DAYS) if (r < day()) S.rentPaid[r] = true;
    S.notice = 0;
    S.lateFee = 0;
    S.rent = S.nextRent;
    await ui.say(portal ? 'TENANT PORTAL' : 'DALE', portal ? `Payment received. A $12.50 "convenience fee" was applied for the convenience of Hilltop Property Solutions LLC.` : C.DALE.paid);
  }

  // ---------------------------------------------------------------- gigs
  function genBoard() {
    S.boardDay = day();
    const n = S.clout < 15 ? 1 : S.clout < 45 ? 2 : 3;
    const taken = new Set(S.gigs.map((g) => g.title));
    const pool = shuffle(C.GIGS.filter((g) => !taken.has(g.title)));
    const mult = 0.8 + S.clout / 140;
    S.board = pool.slice(0, n).map((g) => ({ ...g, pay: Math.round((g.pay * mult) / 10) * 10, deadline: day() + g.sessions + 1 + Math.floor(Math.random() * 2) }));
  }
  function addGig(g) {
    S.gigs.push({ id: S.gigId++, client: g.client, title: g.title, brief: g.brief, pay: g.pay, sessions: g.sessions, done: 0, deadline: g.deadline, evil: !!g.evil, cloutBonus: g.clout || 0, revised: false });
  }
  async function gigBoard() {
    if (S.boardDay !== day()) genBoard();
    if (!S.board.length) {
      await ui.say('GIG BOARD', S.clout < 15 ? 'The board is empty except for a flyer that says "NOBODY HIRES SOMEONE THEY HAVEN\'T SEEN AT A SHOW." (Raise your CLOUT by getting out there.)' : 'You\'ve taken everything on the board today. Check back tomorrow.');
      return;
    }
    const opts = S.board.map((g) => ({ label: `${g.client}: ${g.title}`, hint: `$${g.pay} · ${g.sessions} sessions · due Day ${g.deadline}` }));
    opts.push('Walk away');
    const c = await ui.choose('GIG BOARD', S.clout < 15 ? 'Slim pickings. Get out more.' : 'Pinned between a lost cat flyer and a "roommate wanted (must love snakes)" ad:', opts);
    if (c >= S.board.length) return;
    const g = S.board[c];
    if (S.gigs.length >= 3) {
      await ui.say('', 'You already have 3 active gigs. Your therapist (a podcast) says to set boundaries.');
      return;
    }
    const d = await ui.choose(g.client, `${g.title}\n${g.brief}\n\nPay: $${g.pay} · Work: ${g.sessions} session(s) at a desk · Deadline: Day ${g.deadline}`, ['Take the gig', 'Pass']);
    if (d === 0) {
      addGig(g);
      S.board.splice(c, 1);
      if (g.evil) fx({ sanity: -4 });
      ui.toast(`Gig accepted: ${g.client}`, 'good');
    }
  }

  async function workGig(publicSpot) {
    if (!S.gigs.length) {
      await ui.say('', publicSpot ? 'You open your laptop with nothing to work on. You update your portfolio\'s favicon instead. Very productive.' : 'You have no gigs. You open Figma and stare at a blank artboard. The artboard stares back. (Find work at the Grind Theory gig board.)');
      return;
    }
    if (S.energy < 15) {
      await ui.say('', 'You\'re too drained to work. You watch a 40-minute video essay about a cartoon you\'ve never seen instead.');
      return;
    }
    if (S.drunk >= 4) {
      await ui.say('', 'You try to work drunk. You accidentally email the client a meme. You close the laptop before it gets worse.');
      return;
    }
    const opts = S.gigs.map((g) => ({ label: `${g.client}`, hint: `${g.done}/${g.sessions} · due Day ${g.deadline}` }));
    opts.push('Never mind');
    const c = await ui.choose('WORK', 'Which project? (One session = 2 hours.)', opts);
    if (c >= S.gigs.length) return;
    const g = S.gigs[c];
    await ui.fade(true);
    advance(120);
    S.workedToday++;
    const flow = S.sanity > 60 && Math.random() < 0.25;
    g.done += flow ? 2 : 1;
    await ui.fade(false);
    fx({ energy: S.hangover ? -20 : -14, sanity: publicSpot ? -2 : -4, clout: publicSpot ? 2 : 0 });
    if (flow) ui.toast('FLOW STATE. Lo-fi beats hit just right. Double progress!', 'good');
    if (g.done >= g.sessions) {
      if (!g.revised && Math.random() < 0.45) {
        g.revised = true;
        g.sessions += 1 + (Math.random() < 0.3 ? 1 : 0);
        fx({ sanity: -6 });
        await ui.say(g.client.toUpperCase(), `"${rnd(C.FEEDBACK)}"\n\n(Revisions requested. More sessions added.)`);
        return;
      }
      g.complete = true;
      S.gigs = S.gigs.filter((x) => x !== g);
      const net = 1 + Math.floor(Math.random() * 3);
      const ghostChance = clamp(0.3 - S.clout / 400, 0.06, 0.3);
      S.invoices.push({ client: g.client, amount: g.pay, due: day() + net, ghost: Math.random() < ghostChance, settled: false, chased: 0 });
      S.stats.gigs++;
      fx({ clout: 3 + g.cloutBonus, sanity: g.evil ? -10 : 5 });
      let msg = `Delivered "${g.title}" to ${g.client}. Invoice sent: $${g.pay}, Net-${net}.`;
      if (g.evil) msg += '\n\nYou feel a little gross. Somewhere, Sage says "oh no, buddy" without knowing why.';
      await ui.say('DELIVERED', msg);
    } else {
      await ui.say('WORK', rnd(['You push pixels around for two hours. Some of them are in better places now.', 'Two hours of work, one hour of which was choosing a font. Progress!', 'You get a solid chunk done. You reward yourself by checking your email. Mistake.', 'You work. The radiator clanks in 4/4 time. It\'s kind of a vibe.']) + `\n(${g.client}: ${g.done}/${g.sessions})`);
    }
  }

  async function chaseInvoice(i) {
    const inv = S.invoices[i];
    if (!inv || inv.settled || inv.chased === day()) return;
    inv.chased = day();
    ui.closePhone();
    if (inv.ghost && Math.random() < 0.5) {
      inv.ghost = false;
      inv.due = day() + 1;
      fx({ sanity: -3 });
      await ui.say(inv.client.toUpperCase(), '"OMG so sorry, this went to spam!! Sending tomorrow ✨"\n(It did not go to spam.)');
    } else if (inv.ghost) {
      fx({ sanity: -5 });
      await ui.say('', `You send a "just circling back!" email to ${inv.client}. "Read 2:14 PM." Nothing else.`);
    } else {
      fx({ sanity: -2 });
      await ui.say(inv.client.toUpperCase(), `"Totally! It's in our system, should hit by Day ${inv.due}!" Your soul leaves your body slightly.`);
    }
  }

  // ---------------------------------------------------------------- bar
  async function talkWren() {
    const c = await ui.choose('WREN', rnd(C.BAR.wren), [
      { label: 'A drink', hint: '$7', disabled: S.money < 7 },
      { label: 'A water', hint: 'free, judged' },
      { label: 'A shot for the road', hint: '$5', disabled: S.money < 5 },
      'Nothing',
    ]);
    if (c === 0) {
      audio.sfx.gulp();
      fx({ money: -7, sanity: 5, energy: -2, drunk: 1 });
      await ui.say('WREN', rnd(['Wren slides it over without a word. Communication.', '"On your tab? You don\'t have a tab. Now you do."']));
    } else if (c === 1) {
      fx({ drunk: -1, energy: 3 });
      await ui.say('WREN', '"A water. Okay. Narc." She gives it to you in a pint glass so nobody knows. That\'s love.');
    } else if (c === 2) {
      audio.sfx.gulp();
      fx({ money: -5, sanity: 3, drunk: 1 });
    }
    checkBlackout();
  }

  async function talkFriends() {
    await ui.say('TANNER & BEX', rnd(C.BAR.tannerBex));
    while (!ended) {
      const c = await ui.choose('TANNER & BEX', `Friendship (unacknowledged): ${Math.round(S.friendship)}    BAC: ${'▮'.repeat(Math.min(S.drunk, 6))}`, [
        { label: 'Another round', hint: '$8', disabled: S.money < 8 },
        'Talk about something real',
        'So... do we maybe drink too much?',
        'Head out',
      ]);
      if (c === 0) {
        audio.sfx.gulp();
        S.friendship = clamp(S.friendship + 5, 0, 100);
        advance(30);
        fx({ money: -8, sanity: 6, clout: 2, energy: -4, drunk: 1 });
        await ui.say('', rnd(C.BAR.round));
        if (checkBlackout()) return;
      } else if (c === 1) {
        S.friendship = clamp(S.friendship + 1, 0, 100);
        await ui.say('', rnd(C.BAR.feelings));
      } else if (c === 2) {
        S.honesty++;
        S.friendship = clamp(S.friendship - 12, 0, 100);
        fx({ sanity: -4 });
        await ui.say('', rnd(C.BAR.honest));
        if (S.honesty % 2 === 0) {
          S.friendsGoneDay = day();
          npcs.tanner.actor.root.visible = false;
          npcs.bex.actor.root.visible = false;
          await ui.say('', 'Tanner suddenly remembers he has to feed a cat he doesn\'t own. Bex goes with him "to help." The booth is empty. The silence is deafening. You were right, though.');
          return;
        }
      } else return;
    }
  }

  function checkBlackout() {
    if (S.drunk < 6) return false;
    blackout();
    return true;
  }
  async function blackout() {
    await ui.fade(true);
    const now = mins();
    let delta = 9 * 60 - now;
    if (delta <= 0) delta += 1440;
    advance(delta);
    if (ended) return;
    S.drunk = 0;
    S.hangover = true;
    S.energy = clamp(45, 0, energyCap());
    S.loc = 'home';
    player.pos.copy(IN.home.spots.bed).add(new THREE.Vector3(-0.6, 0, 0));
    fx({ money: -40, sanity: -6 }, true);
    await ui.fade(false);
    await ui.say('BLACKOUT', rnd(C.BAR.blackout) + `\n\nDAY ${day()} · ${C.WEEKDAYS[wday()]}. HUNGOVER.`);
  }

  async function jukebox() {
    if (S.money < 1) return ui.say('', 'You don\'t have a dollar. The jukebox knows.');
    fx({ money: -1, sanity: 2 });
    await ui.say('', rnd(['You play "the song." Everyone groans. Then everyone sings. Worth it.', 'You play a 14-minute post-rock track. Wren stares at you for all 14 minutes.', 'You play something by a local band. The bassist is at the bar. He pretends not to notice. He noticed.']));
  }

  // ---------------------------------------------------------------- coffee shop
  async function talkJules() {
    const c = await ui.choose('JULES', rnd(C.COFFEE_LINES), [
      { label: 'Oat latte', hint: '$7 · big energy, small clout', disabled: S.money < 7 },
      { label: 'Drip coffee', hint: '$3', disabled: S.money < 3 },
      { label: 'Work here on a gig (laptop by the window)', hint: '$3 coffee', disabled: S.money < 3 || !S.gigs.length },
      'Nothing',
    ]);
    if (c === 0) fx({ money: -7, energy: 25, clout: 1 });
    else if (c === 1) fx({ money: -3, energy: 12 });
    else if (c === 2) {
      fx({ money: -3, energy: 8 }, true);
      await workGig(true);
    }
  }
  async function talkFreelancer(i) {
    const k = 'fl' + i;
    if (S.chatDay[k] !== day()) {
      S.chatDay[k] = day();
      fx({ clout: 1 });
    }
    await ui.say('FREELANCER', C.FREELANCERS[(i * 2 + day()) % C.FREELANCERS.length]);
  }
  async function eventsBoard() {
    const lines = C.EVENTS.map((e) => `${e.days.map((d) => C.WEEKDAYS[d]).join('/')} ${fmtHour(e.hours[0])}-${fmtHour(e.hours[1])}: ${e.name}`);
    await ui.say('RVA HAPPENINGS', lines.join('\n') + '\n\nGRTC bus (Belvidere & Albemarle): day trips around town.\nShow up. Be seen. The fog takes the forgotten.');
  }

  // ---------------------------------------------------------------- mart
  async function martShop() {
    while (true) {
      const opts = C.MART.map((it) => ({ label: it.name, hint: `$${it.price}`, disabled: S.money < it.price }));
      opts.push('Leave');
      const c = await ui.choose('SPEEDEE MART', rnd(C.MART_LINES), opts);
      if (c >= C.MART.length) return;
      await buyMart(C.MART[c]);
    }
  }
  async function buyMart(it) {
    if (S.money < it.price) return ui.say('DONNY', '"You\'re short. I\'m not running a charity. I\'m running a Speedee Mart."');
    fx({ money: -it.price }, true);
    if (it.scratch) {
      if (Math.random() < 0.13) {
        const win = rnd([20, 20, 40, 50, 100, 150]);
        fx({ money: win, sanity: 5 });
        await ui.say('DONNY', `You won $${win}! Donny looks at you with something like respect. "Don't spend it all on scratch-offs." You will.`);
      } else await ui.say('', rnd(['Not a winner. Like you. — Sorry, that was Donny, not the ticket.', 'You scratch off three lemons and a skull. Nothing.', 'LOSER, says the ticket, in a cheerful font.']));
      return;
    }
    if (it.fridge) {
      S.fridge += it.fridge;
      return ui.toast(`+6 beers in the fridge (${S.fridge})`);
    }
    if (it.cure) S.hangover = false;
    if (it.drunk) audio.sfx.gulp();
    fx({ energy: it.energy || 0, sanity: it.sanity || 0, drunk: it.drunk || 0 });
    if (it.text) ui.toast(it.text);
  }

  // ---------------------------------------------------------------- tattoos
  function addInk(t) {
    S.ink.push({ ...t, day: day() });
    player.actor.addTattoo(t.color);
  }
  async function tattooVisit(k) {
    const A = C.ARTISTS[k];
    if (S.drunk >= 3) return ui.say(A.name.toUpperCase(), '"Come back sober. It\'s a liability thing. And a blood thing. Mostly a blood thing."');
    const c = await ui.choose(A.name.toUpperCase(), rnd(['"Hey. What are we doing today?"', '"Walk-in? I\'ve got a slot. Talk to me."', '"Welcome in. Don\'t touch the plants."']), ['Get tattooed (chat first)', 'Just browsing', 'Leave']);
    if (c !== 0) {
      if (c === 1) await ui.say(A.name.toUpperCase(), '"Cool. Browse. Take your time. I\'ll be here. Judging. Lovingly."');
      return;
    }
    if (S.inkDay === day()) return ui.say(A.name.toUpperCase(), '"You got tattooed TODAY? Go home. Let it heal. Also, rest your wallet."');
    let rapport = S.artistRep[k] || 0;
    if (S.clout >= 60) {
      rapport += 1;
      await ui.say('', `${A.name} squints at you. "Wait, I've seen you at The Basement. You're cool." (+1 rapport)`);
    }
    const prompts = shuffle([...A.prompts]).slice(0, 3);
    for (const p of prompts) {
      const lines = shuffle([
        { label: rnd(A.good).replace(/^"|"$/g, ''), v: 1 },
        { label: rnd(A.neutral).replace(/^"|"$/g, ''), v: 0 },
        { label: rnd(A.bad).replace(/^"|"$/g, ''), v: -1 },
      ]);
      const pick = await ui.choose(A.name.toUpperCase(), p, lines.map((l) => `"${l.label}"`));
      const v = lines[pick].v;
      rapport += v;
      ui.toast(v > 0 ? `${A.name} smiles. (+rapport)` : v < 0 ? `${A.name} goes very quiet. (-rapport)` : `${A.name} nods politely.`, v > 0 ? 'good' : v < 0 ? 'bad' : '');
    }
    const mult = rapport >= 0 ? 1 - Math.min(rapport, 4) * 0.12 : 1 + Math.min(-rapport, 3) * 0.15;
    const reaction = rapport >= 3 ? `"Okay, I like you. Friend price."` : rapport >= 1 ? '"You\'re alright. I\'ll knock a little off."' : rapport === 0 ? '"Standard rates, then."' : '"...Prices went up. Just now. For you."';
    const flashOpts = A.flash.map((f) => {
      const owned = S.ink.find((x) => x.name === f.name);
      const price = Math.round(f.price * mult);
      return { label: f.name, hint: owned ? 'already have it' : `$${price}`, disabled: !!owned || S.money < price, price };
    });
    flashOpts.push({ label: 'Actually, never mind' });
    const fpick = await ui.choose(A.name.toUpperCase(), reaction + '\nPick something off the wall:', flashOpts);
    if (fpick >= A.flash.length) return;
    const f = A.flash[fpick];
    const price = flashOpts[fpick].price;
    await ui.fade(true);
    advance(90 + Math.floor(Math.random() * 60));
    await ui.fade(false);
    fx({ money: -price, sanity: 10, clout: 6, energy: -8 });
    addInk({ name: f.name, artist: A.name, color: f.color, price });
    S.inkDay = day();
    const tip = Math.round(price * 0.2);
    const t = await ui.choose(A.name.toUpperCase(), `"${f.name}." It looks incredible. Your arm stings in a cool way.\n"Take care of it. Unscented lotion. Don't go in the river for two weeks."`, [{ label: `Tip 20% ($${tip})`, disabled: S.money < tip }, 'No tip (they WILL remember)']);
    if (t === 0) {
      fx({ money: -tip, clout: 2 });
      S.artistRep[k] = Math.min(2, (S.artistRep[k] || 0) + 1);
    } else {
      S.artistRep[k] = (S.artistRep[k] || 0) - 1;
      await ui.say(A.name.toUpperCase(), '"...cool." They will remember.');
    }
  }

  // ---------------------------------------------------------------- events & venues
  function eventNow(where) {
    const h = hour();
    const wd = wday();
    for (const e of C.EVENTS) {
      if (e.where !== where) continue;
      // late-night events can spill past midnight (hour 24 = midnight)
      const ok = (e.days.includes(wd) && h >= e.hours[0] && h < e.hours[1]) || (e.hours[1] > 24 && e.days.includes((wd + 6) % 7) && h + 24 < e.hours[1]);
      if (ok && !S.events[e.id + ':' + day()]) return e;
    }
    return null;
  }
  function eventLabel(where) {
    const e = eventNow(where);
    return e ? `Attend: ${e.name}` : null;
  }
  async function attendEvent(e) {
    if (!e) return;
    if (S.money < (e.cost || 0)) return ui.say('', `Cover is $${e.cost}. You have $${S.money}. You stand outside and listen through the wall like a ghost.`);
    const c = await ui.choose('', `${e.name}${e.cost ? ` ($${e.cost} cover)` : ''}. Go?`, ['Go', 'Not tonight']);
    if (c !== 0) return;
    await ui.fade(true);
    advance(150);
    S.events[e.id + ':' + day()] = true;
    S.eventDay = day();
    S.stats.events++;
    await ui.fade(false);
    fx({ money: -(e.cost || 0), clout: e.clout, sanity: e.sanity, energy: e.energy, drunk: e.drunk || 0 });
    await ui.say(e.name.toUpperCase(), e.text);
    if (e.referral && S.gigs.length < 3 && Math.random() < 0.6) await referral();
  }
  async function referral() {
    const pool = C.GIGS.filter((g) => !S.gigs.find((x) => x.title === g.title));
    const g = rnd(pool);
    const pay = Math.round((g.pay * (1.1 + S.clout / 150)) / 10) * 10;
    const c = await ui.choose(g.client, `Someone you met tonight slides into your DMs:\n"${g.title}" — ${g.brief}\nPay: $${pay}. Deadline: Day ${day() + g.sessions + 2}.`, ['Take it (networking works!)', 'Leave them on read']);
    if (c === 0) {
      addGig({ ...g, pay, deadline: day() + g.sessions + 2 });
      ui.toast(`Referral gig: ${g.client}`, 'good');
    }
  }
  async function venueDoor(where) {
    const e = eventNow(where);
    if (e) return attendEvent(e);
    if (where === 'basement') return ui.say('', 'It\'s a basement door with a hand-drawn sign. Nobody answers. Faintly, you hear someone tuning a bass. Shows: TUE open mic, THU & SAT nights.');
    if (where === 'gallery') return ui.say('', 'Gallery Fivefold. Closed. A sign reads "By appointment." There is no phone number. Fridays 6-10PM are open to the public.');
    if (where === 'cemetery') {
      fx({ sanity: 2 }, true);
      return ui.say('', 'Hollywood Cemetery. The gate is open. The old trees creak. Wednesday evenings there\'s a twilight walk. (Don\'t stay past dark. Or do. It\'s your sanity.)');
    }
    if (where === 'overlook') {
      advance(20);
      fx({ sanity: S.memos.includes('overlook') ? 3 : 2 });
      return ui.say('', rnd(['You sit and watch the James roll by. A coal train groans along the tracks. For a moment, rent is a rumor.', 'The river is high and brown and doesn\'t care about your invoices. Weirdly, that helps.', 'A heron lands on a rock. You make eye contact. It knows about the Subaru.']));
    }
  }
  async function busStop() {
    const h = hour();
    if (h < 6 || h >= 23) return ui.say('', 'The schedule says the next bus is "soon." It has said that since 1993. (Buses run 6AM-11PM.)');
    const opts = C.BUS_TRIPS.map((b) => {
      const doneToday = S.events['bus:' + b.id + ':' + day()];
      const bad = (b.sunday && wday() !== 6) || doneToday;
      return { label: b.name, hint: doneToday ? 'done today' : b.sunday && wday() !== 6 ? 'Sundays only' : `$${b.cost} · ${b.hours}h`, disabled: bad || S.money < b.cost };
    });
    opts.push('Don\'t get on');
    const c = await ui.choose('GRTC (STILL FREE)', 'Where to? The bus is free. The destinations are not.', opts);
    if (c >= C.BUS_TRIPS.length) return;
    const b = C.BUS_TRIPS[c];
    await ui.fade(true);
    advance(b.hours * 60);
    S.events['bus:' + b.id + ':' + day()] = true;
    if (b.clout > 0) {
      S.eventDay = day();
      S.stats.events++;
    }
    await ui.fade(false);
    fx({ money: -b.cost, clout: b.clout, sanity: b.sanity, energy: b.energy, drunk: b.drunk || 0 });
    await ui.say(b.name.toUpperCase(), b.text);
    if (b.referral && S.gigs.length < 3 && Math.random() < 0.5) await referral();
    checkBlackout();
  }

  async function petDog() {
    const h = hour();
    const night = h < 5;
    if (!night) {
      fx({ sanity: 1 }, true);
      return ui.say('', 'A cast-iron dog stands guard over a small grave. Locals say it was put here to watch over a little girl. Its nose is shiny from a century of pats. You pat it too.');
    }
    const d = day();
    if (S.dogNights.includes(d)) return ui.say('', 'The iron dog is very still. Come back another night.');
    S.dogNights.push(d);
    audio.sfx.clank();
    if (S.dogNights.length >= 3) return endGame('dog');
    fx({ sanity: -4 });
    await ui.say('', S.dogNights.length === 1 ? 'You pet the iron dog in the dead of night. Its metal is warm. Something, somewhere, notices.' : 'You pet the iron dog again. You hear breathing that isn\'t yours. Once more, on another night...');
  }

  async function readMemo(m) {
    if (!S.memos.includes(m.id)) {
      S.memos.push(m.id);
      if (memoMeshes[m.id]) memoMeshes[m.id].visible = false;
      fx({ sanity: 1 }, true);
      ui.toast(`Memo found (${S.memos.length}/${C.MEMOS.length}). Read it any time on your phone.`);
    }
    await ui.memo(m.title.toUpperCase(), m.text);
  }

  // ---------------------------------------------------------------- pass out / death
  async function passOut() {
    if (passingOut || ended) return;
    passingOut = true;
    busy = true;
    await ui.fade(true);
    const now = mins();
    let delta = 10 * 60 - now;
    if (delta <= 0) delta += 1440;
    advance(delta);
    if (!ended) {
      S.energy = 50;
      S.drunk = 0;
      S.loc = 'home';
      player.pos.copy(IN.home.spots.bed).add(new THREE.Vector3(-0.6, 0, 0));
      fx({ sanity: -10, money: -20 }, true);
      await ui.fade(false);
      await ui.say('', `You collapsed on a stranger's porch on Laurel St. They let you sleep there, but took a twenty as a "porch fee." You stumble home.\n\nDAY ${day()} · ${C.WEEKDAYS[wday()]}. SANITY -10, -$20.`);
    }
    passingOut = false;
    busy = false;
  }

  function endGame(kind) {
    if (ended) return;
    let key = kind;
    if (kind === 'final') {
      if (S.money >= 2500) key = 'landlord';
      else if (S.clout >= 55 && S.ink.length >= 3) key = 'legend';
      else if (S.clout < 25) key = 'asheville';
      else key = 'renewed';
    }
    ended = true;
    S.over = true;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    const E = C.ENDINGS[key];
    const st = S.stats;
    const stats = `Days survived: ${Math.min(day(), 14)} · Money: $${Math.round(S.money)} · Ink: ${S.ink.length}\nGigs delivered: ${st.gigs} · Tickets: ${st.tickets} (${st.ticketsPaid} paid) · Drinks: ${st.drinks}\nEvents attended: ${st.events} · Horrors fended off: ${st.kills} · Memos: ${S.memos.length}/${C.MEMOS.length}`;
    setTimeout(async () => {
      ui.closePhone && ui.phoneOpen && ui.closePhone();
      audio.sfx.siren();
      await ui.ending(E.title, E.text, stats);
      try {
        location.reload();
      } catch (e) {}
    }, 600);
  }
  game.endGame = endGame;

  // ---------------------------------------------------------------- combat & hurting
  game.hurt = (kind, srcPos) => {
    if (ended || player.hurtT > 0) return;
    player.hurtT = 0.8;
    audio.sfx.hurt();
    pipeline.post.uHurt.value = 1;
    if (kind === 'wraith') {
      fx({ sanity: -4 }, true);
      if (Math.random() < 0.3) issueTicket('Loitering in a nightmare', 35);
    } else if (kind === 'invoice') fx({ sanity: -5 }, true);
    else if (kind === 'ghoul') fx({ sanity: -3, energy: -6 }, true);
    else if (kind === 'renthead') fx({ sanity: -9 }, true);
    if (srcPos) {
      const d = player.pos.clone().sub(srcPos).setY(0).normalize().multiplyScalar(1.2);
      player.pos.add(d);
    }
  };
  game.reward = (kind) => {
    S.stats.kills++;
    if (kind === 'wraith') {
      fx({ money: 5 }, true);
      ui.toast('The wraith dissolves. It drops $5 in quarters.', 'good');
    } else if (kind === 'invoice') {
      fx({ sanity: 2 }, true);
      ui.toast('You shred the invoice. Catharsis. SANITY +2', 'good');
    } else if (kind === 'ghoul') {
      fx({ energy: 4 }, true);
      ui.toast('The brunch ghoul drops a half-finished mimosa. ENERGY +4', 'good');
    } else if (kind === 'renthead') {
      fx({ sanity: 12, clout: 10 }, true);
      ui.toast('You defeated the concept of rent. Temporarily. SANITY +12, CLOUT +10', 'good');
    }
  };
  function attack() {
    if (player.attackCD > 0 || S.loc !== 'out' && S.loc !== 'home') return;
    player.attackCD = 0.55;
    player.actor.attackT = 0.35;
    audio.sfx.swing();
    const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    setTimeout(() => ai.hitArc(player.pos, fwd, 2.0), 120);
  }
  game.attack = attack;

  // ---------------------------------------------------------------- interaction dispatch
  let nearest = null;
  function findNearest() {
    nearest = null;
    if (busy || ended) return;
    let best = 1e9;
    for (const a of acts) {
      if (a.loc !== S.loc) continue;
      if (a.cond && !a.cond()) continue;
      const d = Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z);
      if (d < a.r && d < best) {
        const label = a.label();
        if (!label) continue;
        best = d;
        nearest = { label, act: a.act };
      }
    }
    if (S.loc === 'out') {
      const p = ai.nearbyTalker(player.pos);
      if (p) {
        const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
        if (d < best) nearest = { label: p.label, act: p.act };
      }
    }
  }
  game.interact = async () => {
    if (busy || !nearest || ended) return;
    busy = true;
    try {
      await nearest.act();
    } catch (e) {
      console.error(e);
    }
    busy = false;
  };
  game.talkPed = async (line) => {
    if (S.chatDay.ped !== day()) {
      S.chatDay.ped = day();
      fx({ clout: 1 }, true);
    }
    S.stats.chats++;
    await ui.say('NEIGHBOR', line);
  };
  game.talkOfficer = async (heading) => {
    if (!heading) return ui.say('OFFICER GARY', rnd(C.OFFICER_LINES));
    const c = await ui.choose('OFFICER GARY', '"Step aside, citizen. That Subaru is in violation, and I am its consequence."', [
      'I\'m literally right here! I\'m moving it!',
      { label: 'Offer him a La Croix', hint: '$2', disabled: S.money < 2 },
      'Ask about his day',
      'Let fate happen',
    ]);
    if (c === 0) {
      if (Math.random() < 0.5) {
        ai.officerReset(true);
        await ui.say('OFFICER GARY', '"...Fine. FINE. But I\'ve chalked you. The chalk remembers."');
      } else await ui.say('OFFICER GARY', '"Too late. The ticket has already been conceived."');
    } else if (c === 1) {
      fx({ money: -2 }, true);
      if (Math.random() < 0.7) {
        ai.officerReset(true);
        await ui.say('OFFICER GARY', '"...Pamplemousse." He cracks it open. A single tear. "Move along."');
      } else await ui.say('OFFICER GARY', '"Is this a bribe? This is a bribe. This is a delicious bribe. You\'re still getting a ticket."');
    } else if (c === 2) {
      if (Math.random() < 0.35) {
        ai.officerReset(true);
        await ui.say('OFFICER GARY', '"My day? Nobody\'s asked me that since 2004." He talks for twenty minutes about his ferret. He forgets about the ticket.');
        advance(20);
      } else await ui.say('OFFICER GARY', rnd(C.OFFICER_LINES));
    }
  };

  // ---------------------------------------------------------------- env / atmosphere
  const tmp = new THREE.Color();
  const FOG = {
    day: new THREE.Color(0.66, 0.64, 0.58),
    dusk: new THREE.Color(0.58, 0.42, 0.36),
    night: new THREE.Color(0.05, 0.06, 0.09),
    other: new THREE.Color(0.13, 0.045, 0.035),
  };
  function updateEnv(dt) {
    const h = hour();
    const dayness = sstep(5.5, 7.5, h) * (1 - sstep(18.5, 20.5, h));
    const dusk = Math.max(0, 1 - Math.abs(h - 19.3) / 1.4) + Math.max(0, 1 - Math.abs(h - 6.5) / 1.0) * 0.6;
    const wantOther = (h < 5 || S.sanity < 25) && !ended;
    if (wantOther !== otherOn) {
      otherOn = wantOther;
      if (otherOn && S.loc === 'out') {
        audio.sfx.siren();
        ui.toast(S.sanity < 25 ? 'Your grip on reality loosens. The sirens begin.' : 'The sirens. Oregon Hill is changing.', 'bad');
      }
    }
    const inside = S.loc !== 'out';
    otherLevel += ((otherOn ? 1 : 0) - otherLevel) * Math.min(1, dt * 0.35);
    const ol = inside ? otherLevel * 0.35 : otherLevel;
    SHARED.uOther.value = ol;
    if (inside) {
      const I = world.interiors[S.loc];
      tmp.set(I.fog.color);
      SHARED.uFogColor.value.copy(tmp).lerp(FOG.other, ol);
      SHARED.uFogNear.value = I.fog.near;
      SHARED.uFogFar.value = I.fog.far;
      SHARED.uAmbient.value.setScalar(I.ambient * (1 - ol * 0.3));
      SHARED.uSunColor.value.setScalar(0.25);
      SHARED.uNight.value = 0;
      SHARED.uFlashOn.value = 0;
    } else {
      const fc = SHARED.uFogColor.value;
      fc.copy(FOG.night).lerp(FOG.day, dayness);
      fc.lerp(FOG.dusk, clamp(dusk, 0, 1) * 0.7);
      fc.lerp(FOG.other, ol);
      const cloutFar = 18 + (S.clout / 100) * 62;
      let far = cloutFar * (0.7 + 0.3 * dayness);
      far = far * (1 - ol) + 24 * ol;
      SHARED.uFogFar.value = far;
      SHARED.uFogNear.value = far * (0.12 + 0.18 * ol);
      SHARED.uSunColor.value.setRGB(0.95, 0.88, 0.72).multiplyScalar(dayness * 0.8).lerp(new THREE.Color(0.9, 0.5, 0.35), clamp(dusk, 0, 1) * 0.4);
      SHARED.uAmbient.value.setRGB(0.36 + dayness * 0.12, 0.38 + dayness * 0.1, 0.46 + dayness * 0.06).multiplyScalar(0.55 + 0.45 * dayness).lerp(new THREE.Color(0.5, 0.26, 0.2), ol * 0.85);
      SHARED.uNight.value = 1 - dayness;
      const fl = S.flash && (1 - dayness > 0.35 || ol > 0.3) ? 1 : 0;
      SHARED.uFlashOn.value += (fl - SHARED.uFlashOn.value) * Math.min(1, dt * 6);
      if (S.clout < 20 && performance.now() - lastFogWarn > 90000) {
        lastFogWarn = performance.now();
        ui.toast('The fog is thick today. You haven\'t been out in a while. (Low CLOUT)', 'bad');
      }
    }
    // flashlight from player's chest
    SHARED.uFlashPos.value.set(player.pos.x, player.pos.y + 1.3, player.pos.z);
    SHARED.uFlashDir.value.set(Math.sin(player.yaw), -0.28, Math.cos(player.yaw)).normalize();
    // nearest lamps
    if (!inside) {
      const lamps = world.lamps;
      const near = [];
      for (const l of lamps) {
        const d = (l.x - player.pos.x) ** 2 + (l.z - player.pos.z) ** 2;
        if (d < 1600) near.push([d, l]);
      }
      near.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < 8; i++) {
        const v = SHARED.uLamps.value[i];
        if (near[i] && ol < 0.6) v.copy(near[i][1]);
        else v.set(0, -999, 0);
      }
    } else for (const v of SHARED.uLamps.value) v.set(0, -999, 0);
    // drunk wobble + hurt flash
    pipeline.post.uDrunk.value += (Math.min(S.drunk / 4, 1.3) - pipeline.post.uDrunk.value) * Math.min(1, dt * 2);
    pipeline.post.uHurt.value = Math.max(0, pipeline.post.uHurt.value - dt * 2.5);
    audio.setMood(ol, inside);
    // TV static
    if (world.tvScreen) world.tvScreen.material.uniforms.map.value = world.tvFrames[Math.floor(SHARED.uTime.value * 12) % 4];
    // dale visibility
    npcs.dale.actor.root.visible = daleHere();
    // memos bob
    for (const id in memoMeshes) {
      const m = memoMeshes[id];
      m.rotation.y += dt * 1.5;
      m.position.y = world.memoSpots[id].y + Math.sin(SHARED.uTime.value * 2 + m.position.x) * 0.08;
    }
  }

  // ---------------------------------------------------------------- per-frame
  const move = new THREE.Vector3();
  game.update = (dt, input) => {
    if (!S) return;
    const blocked = ui.blocking || busy || ended;
    if (!blocked) {
      // real-time clock
      const prevOther = otherOn;
      advance(dt * TIME_SCALE);
      // passive drains
      const drain = dt * TIME_SCALE;
      S.energy = clamp(S.energy - drain / 12 - (input.run && player.speed > 0.5 ? drain / 5 : 0), 0, 100);
      if (S.drunk > 0) {
        S.flags.soberT = (S.flags.soberT || 0) + drain;
        if (S.flags.soberT > 80) {
          S.flags.soberT = 0;
          S.drunk--;
        }
      }
      if (otherOn && S.loc === 'out') S.sanity = clamp(S.sanity - drain / 8, 0, 100);
      checkVitals();
      void prevOther;
    }

    // ---- player movement
    move.set(0, 0, 0);
    if (!blocked) {
      move.set(input.mx, 0, input.mz);
      if (S.drunk >= 2) {
        const t = SHARED.uTime.value;
        move.x += Math.sin(t * 1.3) * 0.25 * Math.min(S.drunk / 4, 1.2);
        move.z += Math.cos(t * 1.1) * 0.25 * Math.min(S.drunk / 4, 1.2);
      }
    }
    const len = Math.min(1, move.length());
    let speed = 0;
    if (len > 0.08) {
      move.normalize();
      const tired = S.energy < 15 ? 0.7 : 1;
      speed = (input.run && S.energy > 5 ? 6.2 : 3.4) * len * tired;
      player.pos.x += move.x * speed * dt;
      player.pos.z += move.z * speed * dt;
      const target = Math.atan2(move.x, move.z);
      let d = target - player.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.yaw += d * Math.min(1, dt * 12);
      player.stepT += dt * speed;
      if (player.stepT > 1.4) {
        player.stepT = 0;
        audio.sfx.step();
      }
    }
    world.collide(player.pos, 0.35);
    const gy = S.loc === 'out' ? world.groundY(player.pos.x, player.pos.z) : 0;
    player.pos.y += (gy - player.pos.y) * Math.min(1, dt * 15);
    player.speed = speed;
    player.actor.root.position.copy(player.pos);
    player.actor.root.rotation.y = player.yaw;
    player.actor.update(dt, speed);
    player.attackCD -= dt;
    player.hurtT -= dt;

    if (!blocked && input.consumeInteract()) game.interact();
    if (!blocked && input.consumeAttack()) attack();
    if (input.consumeFlash()) {
      S.flash = !S.flash;
      audio.sfx.blip();
      ui.toast(S.flash ? 'Flashlight on.' : 'Flashlight off.');
    }

    updateEnv(dt);
    ai.update(dt, blocked, otherLevel);
    for (const id of ['tanner', 'bex', 'fl1', 'fl2']) {
      const a = npcs[id].actor;
      a.parts.head.rotation.y = Math.sin(SHARED.uTime.value * 0.7 + id.length) * 0.3;
    }

    findNearest();
    ui.setPrompt(!blocked && nearest ? nearest.label : '');
    hud();
  };

  // ---------------------------------------------------------------- HUD
  function locName() {
    if (S.loc !== 'out') return LOC_NAMES[S.loc];
    const { x, z } = player.pos;
    if (x < -74) return 'Hollywood Cemetery';
    if (z > 44) return 'Oregon Hill Overlook';
    if (z < -85) return 'W Cary St (VCU-ish)';
    let best = null;
    let bd = 1e9;
    for (const s of NS) {
      const d = Math.abs(x - s.x);
      if (d < bd) {
        bd = d;
        best = s.name;
      }
    }
    for (const e of EW) {
      const d = Math.abs(z - e.z);
      if (d < bd) {
        bd = d;
        best = e.name;
      }
    }
    return best;
  }
  function nextHint() {
    const h = hour();
    const wd = wday();
    for (const e of C.EVENTS) {
      if (S.events[e.id + ':' + day()]) continue;
      if (e.days.includes(wd) && h < e.hours[1]) return `${h >= e.hours[0] ? 'NOW' : 'TODAY ' + fmtHour(e.hours[0])}: ${e.name}`;
    }
    if (!S.gigs.length && S.money < 1000) return 'Need money? Gig board @ Grind Theory (W Cary St)';
    if (S.gigs.length) {
      const g = [...S.gigs].sort((a, b) => a.deadline - b.deadline)[0];
      return `${g.client}: ${g.done}/${g.sessions} · due Day ${g.deadline}`;
    }
    return 'Get out there. RVA rewards the visible.';
  }
  function hud() {
    const d = day();
    const rd = nextRentDay();
    const unpaid = S.tickets.filter((t) => !t.paid);
    const owed = unpaid.reduce((a, t) => a + t.amount, 0);
    const st = [];
    if (S.ink.length) st.push(`INK ${S.ink.length}`);
    if (S.drunk) st.push('BAC ' + '▮'.repeat(Math.min(S.drunk, 6)));
    if (S.hangover) st.push('HUNGOVER');
    if (d > S.permitUntil) st.push('PERMIT EXP.');
    if (S.car.booted) st.push('BOOTED');
    if (otherOn && S.loc === 'out') st.push('▲ OTHER HILL');
    let rentTxt = '';
    let rentUrgent = false;
    if (S.notice && !rentCurrent()) {
      rentTxt = `PAY OR QUIT: $${rentOwed()} by Day ${S.notice}`;
      rentUrgent = true;
    } else if (rd) {
      const left = rd - d;
      rentTxt = `RENT $${S.rent} · ${left <= 0 ? 'DUE TODAY' : `due ${C.WEEKDAYS[wday(rd)]} (${left}d)`}`;
      rentUrgent = left <= 1 && S.money < S.rent;
    } else rentTxt = 'RENT PAID (for now)';
    ui.updateHUD({
      day: `DAY ${d} · ${C.WEEKDAYS[wday()]}`,
      time: fmtTime(),
      loc: locName(),
      money: `$${Math.floor(S.money)}`,
      moneyNeg: S.money < 0,
      rent: rentTxt,
      rentUrgent,
      tickets: unpaid.length ? `TICKETS ${unpaid.length} · $${owed}` : '',
      ticketsUrgent: owed > 200,
      energy: S.energy,
      sanity: S.sanity,
      clout: S.clout,
      status: st.join(' · '),
      hint: nextHint(),
      radio: ai.radioLevel,
    });
  }

  // ---------------------------------------------------------------- phone
  game.openPhone = () => {
    if (ended || busy || ui.blocking) return;
    ui.openPhone(() => ({ tabs: ['STATUS', 'GIGS', 'TICKETS', 'INK', 'MEMOS', 'MAP', 'SYSTEM'], render: renderTab }));
  };
  const btn = (label, fn, disabled = false) => {
    const b = document.createElement('button');
    b.className = 'act';
    b.textContent = label;
    b.disabled = disabled;
    b.onclick = fn;
    return b;
  };
  const row = (l, r) => `<div class="row"><span>${l}</span><span class="r">${r}</span></div>`;
  function renderTab(tab, body) {
    const d = day();
    if (tab === 'STATUS') {
      const rd = nextRentDay();
      body.innerHTML =
        `<h3>YOU</h3>` +
        row('Money', `$${Math.floor(S.money)}`) +
        row('Energy / Sanity / Clout', `${Math.round(S.energy)} / ${Math.round(S.sanity)} / ${Math.round(S.clout)}`) +
        row('Friendship with Tanner & Bex (unspoken)', Math.round(S.friendship)) +
        row('Roommate Sage', { khole: 'on the couch, elsewhere', lucid: 'lucid, making tea', borrow: 'circling the fridge', utilities: 'avoiding the Dominion bill', stickpoke: 'sterilizing a needle', absent: 'out' }[S.sage.mood]) +
        `<h3>HOUSING</h3>` +
        row('Rent', rd ? `$${S.rent} due Day ${rd} (${C.WEEKDAYS[wday(rd)]})` : 'paid through the end of the lease') +
        (S.notice && !rentCurrent() ? row('PAY-OR-QUIT NOTICE', `$${rentOwed()} by end of Day ${S.notice}`) : '') +
        (S.nextRent !== S.rent ? row('Next rent', `$${S.nextRent} ("market adjustment")`) : '') +
        `<div id="rentbtn" style="margin:6px 0"></div>` +
        `<h3>TODAY IN RVA</h3>` +
        (C.EVENTS.filter((e) => e.days.includes(wday())).map((e) => row(e.name, `${fmtHour(e.hours[0])}-${fmtHour(e.hours[1])}`)).join('') || '<div class="muted">Nothing scheduled. Try the GRTC bus on Belvidere.</div>') +
        `<h3>SURVIVE</h3><div class="muted">Make it to the end of Day 14. Pay rent on Days 7 and 14. Keep SANITY above zero. Low CLOUT makes the fog close in. Between midnight and 5AM, Oregon Hill becomes something else — stay home or swing that U-lock.</div>`;
      const rb = body.querySelector('#rentbtn');
      if (rd || (S.notice && !rentCurrent())) rb.appendChild(btn(`Pay rent via Tenant Portal ($${rentOwed()} + $12.50 fee)`, async () => {
        ui.closePhone();
        busy = true;
        await payRent(true);
        busy = false;
      }, S.money < rentOwed() + 12.5));
    } else if (tab === 'GIGS') {
      body.innerHTML = '<h3>ACTIVE GIGS</h3>' + (S.gigs.map((g) => `<div class="row"><span>${escapeHtml(g.client)}<br><span class="muted">${escapeHtml(g.title)}</span></span><span class="r">$${g.pay}<br><span class="prog"><i style="width:${(g.done / g.sessions) * 100}%"></i></span> ${g.done}/${g.sessions} · Day ${g.deadline}</span></div>`).join('') || '<div class="muted">No gigs. Check the board at Grind Theory, or meet people at shows.</div>') + '<h3>INVOICES</h3>';
      const inv = S.invoices.filter((i) => !i.settled);
      if (!inv.length) body.insertAdjacentHTML('beforeend', '<div class="muted">No outstanding invoices.</div>');
      S.invoices.forEach((i, idx) => {
        if (i.settled) return;
        const r = document.createElement('div');
        r.className = 'row';
        r.innerHTML = `<span>${escapeHtml(i.client)} — $${i.amount}<br><span class="muted">${i.ghostNoted ? 'ghosted you' : `expected Day ${i.due}`}</span></span>`;
        const s = document.createElement('span');
        s.className = 'r';
        s.appendChild(btn(i.chased === d ? 'chased today' : 'Chase ("just circling back!")', () => chaseInvoice(idx), i.chased === d));
        r.appendChild(s);
        body.appendChild(r);
      });
      body.insertAdjacentHTML('beforeend', `<div class="muted" style="margin-top:8px">Total earned: $${S.stats.earned}. Work on gigs at your desk at home, or at Grind Theory.</div>`);
    } else if (tab === 'TICKETS') {
      const unpaid = S.tickets.filter((t) => !t.paid);
      body.innerHTML = `<h3>CITY OF RICHMOND PARKING PORTAL</h3><div class="muted">Zone 1 permit: ${d > S.permitUntil ? 'EXPIRED' : 'valid through Day ' + S.permitUntil}.${S.car.booted ? ' Your car is BOOTED — clear it at the car.' : ''}</div>`;
      const pr = document.createElement('div');
      pr.style.margin = '6px 0';
      pr.appendChild(btn('Renew Zone 1 permit for 4 days ($30)', async () => {
        if (S.t < S.portalDownUntil || Math.random() < 0.3) {
          S.portalDownUntil = S.t + 60;
          ui.toast('The city portal is down. It\'s always down. Try again in an hour.', 'bad');
          audio.sfx.bad();
        } else {
          fx({ money: -30 });
          S.permitUntil = Math.max(S.permitUntil, d) + 4;
          ui.toast(`Permit renewed through Day ${S.permitUntil}.`, 'good');
        }
        ui.refreshPhone();
      }, S.money < 30));
      body.appendChild(pr);
      if (unpaid.length > 1) body.appendChild(btn(`Pay all ($${unpaid.reduce((a, t) => a + t.amount, 0)})`, () => {
        const tot = unpaid.reduce((a, t) => a + t.amount, 0);
        if (S.money < tot) return;
        for (const t of unpaid) {
          t.paid = true;
          S.stats.ticketsPaid++;
        }
        fx({ money: -tot });
        ui.refreshPhone();
      }, S.money < unpaid.reduce((a, t) => a + t.amount, 0)));
      if (!S.tickets.length) body.insertAdjacentHTML('beforeend', '<div class="muted">No tickets. Yet.</div>');
      for (const t of [...S.tickets].reverse()) {
        const r = document.createElement('div');
        r.className = 'row';
        r.innerHTML = `<span>#${t.id} · Day ${t.day}<br><span class="muted">${escapeHtml(t.reason)}</span></span>`;
        const s = document.createElement('span');
        s.className = 'r';
        if (t.paid) s.textContent = 'PAID';
        else
          s.appendChild(btn(`Pay $${t.amount}${t.late ? ' (late)' : ''}`, () => {
            if (S.money < t.amount) return;
            t.paid = true;
            S.stats.ticketsPaid++;
            fx({ money: -t.amount });
            ui.refreshPhone();
          }, S.money < t.amount));
        r.appendChild(s);
        body.appendChild(r);
      }
    } else if (tab === 'INK') {
      body.innerHTML = '<h3>YOUR TATTOOS</h3>' + (S.ink.map((t) => row(escapeHtml(t.name), `${escapeHtml(t.artist)} · Day ${t.day} · $${t.price}`)).join('') || '<div class="muted">Bare arms. In Richmond? Visit Moth & Mortal (Cary St), Sal\'s Ink (Belvidere), or Holy Ghost (Cherry St). Chat well and the price drops.</div>');
    } else if (tab === 'MEMOS') {
      body.innerHTML = `<h3>MEMOS ${S.memos.length}/${C.MEMOS.length}</h3>`;
      for (const id of S.memos) {
        const m = C.MEMOS.find((x) => x.id === id);
        const r = document.createElement('div');
        r.className = 'row';
        r.innerHTML = `<span>${escapeHtml(m.title)}</span>`;
        const s = document.createElement('span');
        s.className = 'r';
        s.appendChild(btn('Read', async () => {
          ui.closePhone();
          busy = true;
          await ui.memo(m.title.toUpperCase(), m.text);
          busy = false;
        }));
        r.appendChild(s);
        body.appendChild(r);
      }
      if (!S.memos.length) body.insertAdjacentHTML('beforeend', '<div class="muted">Glowing scraps of paper are scattered around the hill. Find them.</div>');
    } else if (tab === 'MAP') {
      const c = document.createElement('canvas');
      c.id = 'mapc';
      drawMap(c);
      body.appendChild(c);
      body.insertAdjacentHTML('beforeend', '<div class="muted" style="text-align:center;margin-top:4px">▲ you · ■ Subaru · ★ event today · ● places</div>');
    } else if (tab === 'SYSTEM') {
      body.innerHTML = '<h3>CONTROLS</h3>' + C.CONTROLS_HELP.map(([k, v]) => row(k, v)).join('') + '<h3>GAME</h3>';
      const w = document.createElement('div');
      w.style.display = 'flex';
      w.style.gap = '8px';
      w.style.flexWrap = 'wrap';
      w.appendChild(btn('Save game', () => {
        save();
        ui.refreshPhone();
      }));
      w.appendChild(btn(audio.muted ? 'Unmute audio' : 'Mute audio', () => {
        audio.toggleMute();
        ui.refreshPhone();
      }));
      w.appendChild(btn(`Vertex wobble: ${SHARED.uJitter.value >= 1.5 ? 'EXTRA' : SHARED.uJitter.value >= 1 ? 'ON' : 'OFF'}`, () => {
        const v = SHARED.uJitter.value;
        SHARED.uJitter.value = v >= 1.5 ? 0.01 : v >= 1 ? 2 : 1;
        ui.refreshPhone();
      }));
      w.appendChild(btn(`Scanlines: ${pipeline.post.uScan.value ? 'ON' : 'OFF'}`, () => {
        pipeline.post.uScan.value = pipeline.post.uScan.value ? 0 : 1;
        ui.refreshPhone();
      }));
      body.appendChild(w);
      body.insertAdjacentHTML('beforeend', '<div class="muted" style="margin-top:10px">The game autosaves every time you sleep. Oregon Hill is a satire. Any resemblance to real landlords is, sadly, inevitable.</div>');
    }
  }

  function drawMap(c) {
    const W = 600;
    const sc = W / 270;
    const H = Math.round(235 * sc);
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const X = (x) => (x + 135) * sc;
    const Z = (z) => (z + 115) * sc;
    g.fillStyle = '#2a2a2e';
    g.fillRect(0, 0, W, H);
    const rect = (r, col) => {
      g.fillStyle = col;
      g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
    };
    for (const p of world.map.parks) rect(p, { park: '#3a5a2a', cemetery: '#2a3a22', river: '#2a3a4a' }[p.kind]);
    for (const b of world.map.blocks) rect(b, b.kind === 'res' ? '#6a3a2e' : '#4a4a52');
    g.font = '11px monospace';
    g.fillStyle = '#c8c0a8';
    for (const l of world.map.labels) {
      g.save();
      g.translate(X(l.x), Z(l.z));
      if (l.rot) g.rotate(-Math.PI / 2);
      g.textAlign = 'center';
      g.fillText(l.text, 0, 4);
      g.restore();
    }
    const today = new Set(C.EVENTS.filter((e) => e.days.includes(wday())).map((e) => e.where));
    const pois = [
      ['home', 'HOME', '#f0c860'],
      ['coffee', 'GRIND THEORY', '#8ad0a0'],
      ['bar', 'BAR', '#60c0f0'],
      ['mart', 'MART', '#f06060'],
      ['moth', 'MOTH&MORTAL', '#c0a0f0'],
      ['sal', "SAL'S", '#c0a0f0'],
      ['juniper', 'HOLY GHOST', '#c0a0f0'],
      ['basement', 'BASEMENT', '#f04080'],
      ['gallery', 'FIVEFOLD', '#f0f0f0'],
      ['bus', 'BUS', '#6080f0'],
      ['overlook', 'OVERLOOK', '#a0e080'],
      ['cemetery', 'GATE', '#a0a090'],
    ];
    g.font = 'bold 11px monospace';
    for (const [k, label, col] of pois) {
      const a = world.anchors[k];
      if (!a) continue;
      const x = X(a.pos.x);
      const y = Z(a.pos.z);
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
      if (today.has(k)) {
        g.fillStyle = '#ffe040';
        g.fillText('★', x - 4, y - 7);
      }
      g.fillStyle = col;
      g.textAlign = 'left';
      g.fillText(label, x + 6, y + 4);
    }
    // car
    g.fillStyle = '#80e080';
    g.fillRect(X(car.position.x) - 4, Z(car.position.z) - 4, 8, 8);
    // player
    const p = S.loc === 'out' ? player.pos : world.anchors[world.interiors[S.loc].exitTo].pos;
    const yaw = S.loc === 'out' ? player.yaw : 0;
    g.save();
    g.translate(X(p.x), Z(p.z));
    g.rotate(-yaw + Math.PI);
    g.fillStyle = '#ffff60';
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(6, 6);
    g.lineTo(-6, 6);
    g.closePath();
    g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------- save / load / start
  function save(silent) {
    if (!S || ended) return;
    S.pos = [player.pos.x, player.pos.y, player.pos.z];
    S.yaw = player.yaw;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
      if (!silent) ui.toast('Game saved.', 'good');
    } catch (e) {
      if (!silent) ui.toast('Could not save (storage blocked).', 'bad');
    }
  }
  game.save = save;
  game.hasSave = () => {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return false;
    }
  };
  function applyState() {
    player.pos.set(S.pos[0], S.pos[1], S.pos[2]);
    player.yaw = S.yaw;
    for (const t of S.ink) player.actor.addTattoo(t.color);
    for (const id of S.memos) if (memoMeshes[id]) memoMeshes[id].visible = false;
    placeCar();
    npcs.sage.actor.root.visible = S.sage.mood !== 'absent';
  }
  game.newGame = () => {
    S = newState();
    rollSage(1);
    S.sage.mood = 'lucid';
    applyState();
    game.S = S;
  };
  game.load = () => {
    try {
      S = JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch (e) {
      S = null;
    }
    if (!S) return game.newGame();
    const base = newState();
    S = { ...base, ...S, stats: { ...base.stats, ...S.stats }, sage: { ...base.sage, ...S.sage }, car: { ...base.car, ...S.car } };
    applyState();
    game.S = S;
  };
  // A frozen preview state for the title screen
  game.preview = () => {
    S = newState();
    S.t = 19 * 60 + 20;
    S.clout = 45;
    applyState();
    game.S = S;
  };
  game.previewEnv = (dt) => {
    if (!S) return;
    updateEnv(dt);
    ai.update(dt, true, otherLevel);
  };
  game.camInfo = () => (S.loc === 'out' ? null : world.interiors[S.loc]);
  return game;
}
