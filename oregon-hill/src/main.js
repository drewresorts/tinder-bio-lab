// Oregon Hill — bootstrap, input, camera, main loop.
import * as THREE from 'three';
import { makePipeline, SHARED } from './ps1.js';
import { buildWorld } from './world.js';
import { initPhysics } from './physics.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { INTRO } from './content.js';

const audio = createAudio();
const ui = createUI(audio);
window.addEventListener('error', (e) => ui.error('Something broke in Oregon Hill:\n\n' + (e.error?.stack || e.message)));
window.addEventListener('unhandledrejection', (e) => console.error(e.reason));

const canvas = document.getElementById('view');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  ui.error('Oregon Hill needs WebGL, and this browser said no.\n\n' + e.message);
  throw e;
}
renderer.setPixelRatio(1);
const pipeline = makePipeline(renderer);
const scene = new THREE.Scene();
scene.background = SHARED.uFogColor.value;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 240);

const world = buildWorld(scene);
window.__ohcam = camera;
initPhysics(world);
const game = createGame({ scene, world, ui, audio, pipeline });
window.__oh = { game, world, SHARED };

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  pipeline.resize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 78 : 60;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ input
const keys = new Set();
let wantInteract = false;
let wantAttack = false;
let wantFlash = false;
let camYaw = 0;
let camPitch = 0.34;
let playing = false;
const touch = { x: 0, y: 0, run: false };

addEventListener('keydown', (e) => {
  if (e.key === 'Tab') e.preventDefault();
  if (ui.screen) return;
  if (ui.handleKey(e)) {
    e.preventDefault();
    return;
  }
  if (!playing) return;
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'e') wantInteract = true;
  if (k === ' ' || k === 'f') {
    wantAttack = true;
    e.preventDefault();
  }
  if (k === 'c') wantFlash = true;
  if (k === 'tab' || k === 'p') game.openPhone();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

// mouse drag to orbit
let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.006;
  camPitch = Math.max(0.08, Math.min(1.1, camPitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX;
  lastY = e.clientY;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// touch controls
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) {
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  let sid = null;
  let cx = 0;
  let cy = 0;
  stick.addEventListener('pointerdown', (e) => {
    sid = e.pointerId;
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    stick.setPointerCapture(sid);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid) return;
    let dx = (e.clientX - cx) / 50;
    let dy = (e.clientY - cy) / 50;
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    touch.x = dx;
    touch.y = dy;
    knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
  });
  const end = (e) => {
    if (e.pointerId !== sid) return;
    sid = null;
    touch.x = touch.y = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  // right-side drag to look
  let lid = null;
  let lx = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.clientX < innerWidth * 0.4) return;
    lid = e.pointerId;
    lx = e.clientX;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lid) return;
    camYaw -= (e.clientX - lx) * 0.008;
    lx = e.clientX;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerId === lid) lid = null;
  });
  for (const b of document.querySelectorAll('#tbtns button')) {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const k = b.dataset.k;
      if (ui.dialogOpen) {
        ui.handleKey({ key: 'Enter' });
        return;
      }
      if (k === 'e') wantInteract = true;
      if (k === 'attack') wantAttack = true;
      if (k === 'light') wantFlash = true;
      if (k === 'phone') (ui.phoneOpen ? ui.closePhone() : game.openPhone());
      if (k === 'run') {
        touch.run = !touch.run;
        b.classList.toggle('on', touch.run);
      }
    });
  }
}

const input = {
  mx: 0,
  mz: 0,
  run: false,
  consumeInteract() {
    const v = wantInteract;
    wantInteract = false;
    return v;
  },
  consumeAttack() {
    const v = wantAttack;
    wantAttack = false;
    return v;
  },
  consumeFlash() {
    const v = wantFlash;
    wantFlash = false;
    return v;
  },
};

// ------------------------------------------------------------------ camera
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(20, 6, -10);
const desired = new THREE.Vector3();
const lookAt = new THREE.Vector3();
let wasInside = false;

function updateCamera(dt) {
  const p = game.player.pos;
  const I = game.camInfo();
  camTarget.set(p.x, p.y + 1.35, p.z);
  if (I) {
    // fixed, high-corner camera inside rooms
    desired.copy(I.cam);
    camPos.copy(desired);
    lookAt.lerp(camTarget, wasInside ? Math.min(1, dt * 6) : 1);
    camera.position.copy(camPos);
    camera.lookAt(lookAt);
    wasInside = true;
    return;
  }
  if (wasInside) {
    camYaw = game.player.yaw + Math.PI;
    camPos.set(p.x - Math.sin(game.player.yaw) * 5, p.y + 3, p.z - Math.cos(game.player.yaw) * 5);
    lookAt.copy(camTarget);
  }
  wasInside = false;
  const dist = 5.6;
  const fx = -Math.sin(camYaw);
  const fz = -Math.cos(camYaw);
  const cp = Math.cos(camPitch);
  desired.set(camTarget.x - fx * dist * cp, camTarget.y + Math.sin(camPitch) * dist, camTarget.z - fz * dist * cp);
  // pull in if blocked by a building
  let t = 1;
  for (let s = 0.15; s <= 1.0; s += 0.08) {
    const x = camTarget.x + (desired.x - camTarget.x) * s;
    const y = camTarget.y + (desired.y - camTarget.y) * s;
    const z = camTarget.z + (desired.z - camTarget.z) * s;
    if (world.cameraHit(x, y, z)) {
      t = Math.max(0.12, s - 0.1);
      break;
    }
  }
  desired.lerpVectors(camTarget, desired, t);
  if (t < 1) {
    // boxed in: rise up and look down over the player instead of crushing in
    const lift = (1 - t) * 3.2;
    if (!world.cameraHit(desired.x, desired.y + lift, desired.z)) desired.y += lift;
  }
  camPos.lerp(desired, Math.min(1, dt * 10));
  lookAt.lerp(camTarget, Math.min(1, dt * 14));
  camera.position.copy(camPos);
  camera.lookAt(lookAt);
}

function readMove() {
  let ix = 0;
  let iz = 0;
  if (keys.has('w')) iz += 1;
  if (keys.has('s')) iz -= 1;
  if (keys.has('a')) ix -= 1;
  if (keys.has('d')) ix += 1;
  if (touch.x || touch.y) {
    ix += touch.x;
    iz -= touch.y;
  }
  if (keys.has('arrowleft')) camYaw += 0.04;
  if (keys.has('arrowright')) camYaw -= 0.04;
  if (keys.has('arrowup')) iz += 1;
  if (keys.has('arrowdown')) iz -= 1;
  const I = game.camInfo();
  let fx, fz;
  if (I) {
    fx = I.origin.x - I.cam.x;
    fz = I.origin.z - I.cam.z;
    const l = Math.hypot(fx, fz);
    fx /= l;
    fz /= l;
  } else {
    fx = -Math.sin(camYaw);
    fz = -Math.cos(camYaw);
  }
  // right vector = forward rotated -90deg about Y
  const rx = -fz;
  const rz = fx;
  input.mx = fx * iz + rx * ix;
  input.mz = fz * iz + rz * ix;
  input.run = keys.has('shift') || touch.run;
}

// ------------------------------------------------------------------ loop
let last = performance.now();
let titleT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  SHARED.uTime.value += dt;
  if (playing) {
    readMove();
    game.update(dt, input);
    updateCamera(dt);
  } else {
    // slow orbit on the title screen
    titleT += dt * 0.05;
    game.previewEnv(dt);
    const cx = 10;
    const cz = -20;
    camera.position.set(cx + Math.sin(titleT) * 18, 5 + Math.sin(titleT * 0.7) * 1.5, cz + Math.cos(titleT) * 18);
    camera.lookAt(cx, 2.5, cz);
  }
  const ov = window.__oh.camOverride;
  if (ov) {
    camera.position.set(...ov.pos);
    camera.lookAt(...ov.look);
  }
  pipeline.render(scene, camera);
  requestAnimationFrame(frame);
}

async function start() {
  game.preview();
  requestAnimationFrame(frame);
  const items = [{ label: 'NEW GAME', value: 'new' }];
  if (game.hasSave()) items.unshift({ label: 'CONTINUE', value: 'load' });
  const choice = await ui.titleMenu(items);
  if (choice === 'load') game.load();
  else {
    await ui.intro([...INTRO]);
    game.newGame();
  }
  camYaw = game.player.yaw + Math.PI;
  camPos.set(game.player.pos.x + 4, 4, game.player.pos.z);
  lookAt.copy(game.player.pos);
  ui.showHUD(true);
  if (isTouch) document.getElementById('touch').classList.remove('hidden');
  playing = true;
  if (choice !== 'load') {
    ui.toast('Tip: press TAB (or ☎) for your phone — status, gigs, tickets, map.');
    setTimeout(() => ui.toast('Your Subaru is parked right outside. Mind the meter.'), 2500);
  } else ui.toast('Welcome back to Oregon Hill.');
}
start();
