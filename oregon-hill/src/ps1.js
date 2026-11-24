// PS1-style rendering: vertex snapping, affine texture warping, per-vertex
// lighting, low-res render target, 15-bit color with ordered dithering.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

export const LOW_H = 240;

export const SHARED = {
  uRes: { value: new THREE.Vector2(320, 240) },
  uJitter: { value: 1.0 },
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
  uSunColor: { value: new THREE.Color(0.85, 0.8, 0.7) },
  uAmbient: { value: new THREE.Color(0.4, 0.4, 0.45) },
  uFogColor: { value: new THREE.Color(0.6, 0.6, 0.6) },
  uFogNear: { value: 4 },
  uFogFar: { value: 50 },
  uFlashPos: { value: new THREE.Vector3() },
  uFlashDir: { value: new THREE.Vector3(0, 0, -1) },
  uFlashOn: { value: 0 },
  uNight: { value: 0 },
  uOther: { value: 0 },
  uLamps: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, -999, 0)) },
};

const VS = /* glsl */ `
uniform vec2 uRes;
uniform float uJitter;
uniform float uTime;
uniform vec2 uScroll;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
varying vec3 vAffine;
varying vec3 vLight;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vColor;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vNormalW = n;
  vec4 clip = projectionMatrix * viewMatrix * wp;
  // snap vertices to the low-res pixel grid (the famous PS1 wobble)
  vec2 grid = uRes * 0.5 / max(uJitter, 0.001);
  if (clip.w > 0.0) {
    clip.xy = floor(clip.xy / clip.w * grid + 0.5) / grid * clip.w;
  }
  gl_Position = clip;
  vec2 tuv = uv + uScroll * uTime;
  // affine (screen-linear) texture interpolation
  vAffine = vec3(tuv * clip.w, clip.w);
  float d = max(dot(n, uSunDir), 0.0);
  #ifdef DOUBLE
    d = abs(dot(n, uSunDir)) * 0.8 + 0.2;
  #endif
  vLight = uAmbient + uSunColor * d;
  #ifdef USE_COLOR
    vColor = color;
  #else
    vColor = vec3(1.0);
  #endif
}
`;

const FS = /* glsl */ `
uniform sampler2D map;
uniform vec3 tint;
uniform float uOpacity;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uFlashPos;
uniform vec3 uFlashDir;
uniform float uFlashOn;
uniform float uNight;
uniform float uOther;
uniform float uTime;
uniform vec3 uLamps[8];
varying vec3 vAffine;
varying vec3 vLight;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vColor;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec2 uv = vAffine.xy / vAffine.z;
  vec4 tex = vec4(1.0);
  #ifdef USE_MAP
    tex = texture2D(map, uv);
    if (tex.a < 0.5) discard;
  #endif
  vec3 base = tex.rgb * tint * vColor;
  vec3 col;
  #ifdef UNLIT
    col = base;
  #else
    vec3 light = vLight;
    // flashlight
    vec3 toP = vWorldPos - uFlashPos;
    float dist = max(length(toP), 0.001);
    vec3 dirP = toP / dist;
    float spot = smoothstep(0.80, 0.95, dot(dirP, uFlashDir)) * clamp(1.0 - dist / 24.0, 0.0, 1.0);
    float facing = max(dot(vNormalW, -dirP), 0.0) * 0.7 + 0.3;
    light += vec3(1.0, 0.95, 0.8) * spot * facing * 1.7 * uFlashOn;
    // street lamps
    vec3 lamp = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float l = length(uLamps[i] - vWorldPos);
      float a = max(0.0, 1.0 - l / 10.0);
      lamp += vec3(1.0, 0.72, 0.42) * a * a;
    }
    light += lamp * uNight * 1.3;
    col = base * light;
  #endif
  #ifdef WINDOWS
    float win = step(0.10, tex.b - max(tex.r, tex.g));
    vec3 cell = floor(vWorldPos / 3.0 + vNormalW * 0.1);
    float lit = step(0.5, hash(cell));
    vec3 wc = mix(vec3(1.0, 0.78, 0.42), vec3(0.6, 0.75, 1.0), step(0.85, hash(cell + 3.0)));
    col = mix(col, wc * (0.75 + 0.25 * hash(cell + 1.0)), win * lit * uNight);
  #endif
  #ifndef NO_OTHER
    if (uOther > 0.001) {
      float g = hash(floor(vWorldPos * 2.0));
      float streak = step(0.9, hash(vec3(floor(vWorldPos.x * 1.3), floor(vWorldPos.y * 0.25), floor(vWorldPos.z * 1.3))));
      vec3 rusty = col * vec3(0.8, 0.42, 0.3) * (0.65 + 0.5 * g);
      rusty = mix(rusty, vec3(0.18, 0.03, 0.02), streak * 0.6);
      col = mix(col, rusty, uOther);
    }
  #endif
  #ifndef NO_FOG
    float fd = length(vWorldPos - cameraPosition);
    float f = smoothstep(uFogNear, uFogFar, fd);
    col = mix(col, uFogColor, f);
  #endif
  gl_FragColor = vec4(col, uOpacity);
}
`;

export function ps1Material(o = {}) {
  const defines = {};
  if (o.map) defines.USE_MAP = '';
  if (o.unlit) defines.UNLIT = '';
  if (o.windows) defines.WINDOWS = '';
  if (o.double) defines.DOUBLE = '';
  if (o.noOther) defines.NO_OTHER = '';
  if (o.noFog) defines.NO_FOG = '';
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...SHARED,
      map: { value: o.map || null },
      tint: { value: new THREE.Color(o.color ?? 0xffffff) },
      uOpacity: { value: o.opacity ?? 1 },
      uScroll: { value: o.scroll || new THREE.Vector2(0, 0) },
    },
    vertexShader: VS,
    fragmentShader: FS,
    defines,
    vertexColors: !!o.vertexColors,
    transparent: !!o.transparent,
    depthWrite: o.depthWrite ?? true,
    side: o.double ? THREE.DoubleSide : THREE.FrontSide,
  });
  return m;
}

const POST_FS = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uLowRes;
uniform float uTime;
uniform float uOther;
uniform float uDrunk;
uniform float uFade;
uniform float uNoise;
uniform float uHurt;
uniform float uScan;
varying vec2 vUv;
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0;
  m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  for (int k = 0; k < 16; k++) { if (k == i) return m[k] / 16.0; }
  return 0.0;
}
void main() {
  vec2 uv = vUv;
  float w = uDrunk;
  uv.x += sin(uv.y * 9.0 + uTime * 1.8) * 0.007 * w;
  uv.y += cos(uv.x * 7.0 + uTime * 1.3) * 0.005 * w;
  vec3 c = texture2D(tDiffuse, uv).rgb;
  if (w > 0.01) {
    vec3 c2 = texture2D(tDiffuse, uv + vec2(0.012 * w * sin(uTime * 0.7), 0.004 * w)).rgb;
    c = mix(c, c2, 0.35 * min(w, 1.0));
  }
  vec2 px = floor(uv * uLowRes);
  float n = fract(sin(dot(px + floor(uTime * 24.0) * 7.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * (uNoise + uOther * 0.06);
  float vig = smoothstep(0.95, 0.25, length(vUv - 0.5));
  c *= mix(1.0, vig, 0.4 + uOther * 0.25);
  c = mix(c, vec3(0.55, 0.0, 0.0), uHurt * 0.45);
  float d = bayer(px) - 0.5;
  c += d / 28.0;
  c = floor(clamp(c, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
  // faint scanlines
  float sl = mod(gl_FragCoord.y, 3.0) < 1.0 ? 1.0 - 0.12 * uScan : 1.0;
  c *= sl;
  c *= 1.0 - uFade;
  gl_FragColor = vec4(c, 1.0);
}
`;

export function makePipeline(renderer) {
  const rt = new THREE.WebGLRenderTarget(320, 240, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  const post = {
    tDiffuse: { value: rt.texture },
    uLowRes: { value: new THREE.Vector2(320, 240) },
    uTime: SHARED.uTime,
    uOther: SHARED.uOther,
    uDrunk: { value: 0 },
    uFade: { value: 0 },
    uNoise: { value: 0.035 },
    uHurt: { value: 0 },
    uScan: { value: 1 },
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: post,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: POST_FS,
      depthTest: false,
      depthWrite: false,
    })
  );
  quad.frustumCulled = false;
  const pScene = new THREE.Scene();
  pScene.add(quad);
  const pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let lowH = LOW_H;

  function resize(w, h) {
    const lw = Math.max(160, Math.round((lowH * w) / h));
    rt.setSize(lw, lowH);
    SHARED.uRes.value.set(lw, lowH);
    post.uLowRes.value.set(lw, lowH);
    renderer.setSize(w, h, false);
  }
  function setLowH(h) {
    lowH = h;
  }
  function render(scene, camera) {
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(pScene, pCam);
  }
  return { rt, post, resize, render, setLowH };
}

// ---------------------------------------------------------------------------
// Procedural low-res textures
// ---------------------------------------------------------------------------

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const texCache = new Map();

export function canvasTex(key, w, h, draw) {
  if (key && texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (key) texCache.set(key, t);
  return t;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, Math.max(0, c.r + amt));
  c.g = Math.min(1, Math.max(0, c.g + amt));
  c.b = Math.min(1, Math.max(0, c.b + amt));
  return '#' + c.getHexString();
}

function noise(ctx, w, h, amt, r, alpha = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    const n = (r() - 0.5) * amt;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
    if (alpha !== 1) img.data[i + 3] *= alpha;
  }
  ctx.putImageData(img, 0, 0);
}

function drawBrick(ctx, w, h, base, mortar, r, rows = 8, cols = 4) {
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, w, h);
  const bh = h / rows;
  const bw = w / cols;
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? bw / 2 : 0;
    for (let x = -1; x <= cols; x++) {
      ctx.fillStyle = shade(base, (r() - 0.5) * 0.12);
      ctx.fillRect(Math.floor(x * bw + off) + 1, Math.floor(y * bh) + 1, Math.ceil(bw) - 2, Math.ceil(bh) - 1);
    }
  }
}

export const TEX = {
  brick(base = '#8a3b2a', mortar = '#6b5a50') {
    return canvasTex('brick' + base + mortar, 64, 64, (ctx, w, h) => {
      const r = rng(7);
      drawBrick(ctx, w, h, base, mortar, r, 12, 5);
      noise(ctx, w, h, 22, r);
    });
  },
  facade(style) {
    const { wall = '#8a3b2a', trim = '#e8e0cc', kind = 'brick', shutter = null } = style;
    return canvasTex('facade' + wall + trim + kind + shutter, 64, 64, (ctx, w, h) => {
      const r = rng(11);
      if (kind === 'brick') drawBrick(ctx, w, h, wall, shade(wall, -0.18), r, 14, 4);
      else {
        ctx.fillStyle = wall;
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 4) {
          ctx.fillStyle = shade(wall, -0.12);
          ctx.fillRect(0, y + 3, w, 1);
        }
      }
      // window (canvas y=0 is top; texture v=1 is top)
      ctx.fillStyle = trim;
      ctx.fillRect(19, 10, 26, 38);
      ctx.fillStyle = '#121c3a';
      ctx.fillRect(22, 13, 20, 32);
      ctx.fillStyle = trim;
      ctx.fillRect(22, 28, 20, 2);
      ctx.fillRect(31, 13, 2, 32);
      ctx.fillStyle = shade(trim, -0.2);
      ctx.fillRect(17, 48, 30, 3);
      if (shutter) {
        ctx.fillStyle = shutter;
        ctx.fillRect(12, 10, 6, 38);
        ctx.fillRect(46, 10, 6, 38);
        ctx.fillStyle = shade(shutter, -0.15);
        for (let y = 12; y < 48; y += 3) {
          ctx.fillRect(12, y, 6, 1);
          ctx.fillRect(46, y, 6, 1);
        }
      }
      noise(ctx, w, h, 16, r);
    });
  },
  commercial(wall = '#3a3a44', trim = '#c8b080') {
    return canvasTex('comm' + wall + trim, 64, 64, (ctx, w, h) => {
      const r = rng(5);
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = trim;
      ctx.fillRect(6, 6, 52, 46);
      ctx.fillStyle = '#16244a';
      ctx.fillRect(9, 9, 46, 40);
      ctx.fillStyle = trim;
      ctx.fillRect(31, 9, 2, 40);
      noise(ctx, w, h, 14, r);
    });
  },
  concrete(base = '#8a8a86') {
    return canvasTex('concrete' + base, 64, 64, (ctx, w, h) => {
      const r = rng(3);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = shade(base, -0.1);
      ctx.fillRect(0, 0, w, 1);
      ctx.fillRect(0, 0, 1, h);
      noise(ctx, w, h, 26, r);
    });
  },
  tower(base = '#9a968c') {
    return canvasTex('tower' + base, 64, 64, (ctx, w, h) => {
      const r = rng(9);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#18264a';
      for (let x = 0; x < 2; x++) ctx.fillRect(6 + x * 32, 14, 20, 30);
      noise(ctx, w, h, 18, r);
    });
  },
  asphalt() {
    return canvasTex('asphalt', 64, 64, (ctx, w, h) => {
      const r = rng(1);
      ctx.fillStyle = '#3c3c40';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 30, r);
      ctx.strokeStyle = '#2a2a2c';
      ctx.beginPath();
      ctx.moveTo(5, 40);
      ctx.lineTo(20, 34);
      ctx.lineTo(28, 44);
      ctx.lineTo(44, 38);
      ctx.stroke();
      ctx.fillStyle = '#2c2c30';
      ctx.fillRect(48, 10, 7, 5);
    });
  },
  pavers() {
    return canvasTex('pavers', 64, 64, (ctx, w, h) => {
      const r = rng(2);
      drawBrick(ctx, w, h, '#93473a', '#5e4c44', r, 16, 4);
      noise(ctx, w, h, 20, r);
    });
  },
  grass(base = '#4b6b2e') {
    return canvasTex('grass' + base, 64, 64, (ctx, w, h) => {
      const r = rng(4);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = shade(base, (r() - 0.5) * 0.25);
        ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 2);
      }
    });
  },
  dirt() {
    return canvasTex('dirt', 64, 64, (ctx, w, h) => {
      const r = rng(6);
      ctx.fillStyle = '#6e5a42';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 40, r);
    });
  },
  roof() {
    return canvasTex('roof', 32, 32, (ctx, w, h) => {
      const r = rng(8);
      ctx.fillStyle = '#2e2b2a';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 20, r);
    });
  },
  wood(base = '#7a5434') {
    return canvasTex('wood' + base, 64, 64, (ctx, w, h) => {
      const r = rng(12);
      for (let y = 0; y < h; y += 8) {
        ctx.fillStyle = shade(base, (r() - 0.5) * 0.15);
        ctx.fillRect(0, y, w, 8);
        ctx.fillStyle = shade(base, -0.2);
        ctx.fillRect(0, y + 7, w, 1);
        ctx.fillRect(Math.floor(r() * w), y, 1, 7);
      }
      noise(ctx, w, h, 14, r);
    });
  },
  wallpaper(base = '#a89a72', fg = '#7d6a48') {
    return canvasTex('wp' + base + fg, 32, 32, (ctx, w, h) => {
      const r = rng(13);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = fg;
      for (let y = 0; y < h; y += 8)
        for (let x = 0; x < w; x += 8) {
          const o = (y / 8) % 2 ? 4 : 0;
          ctx.fillRect(x + o + 2, y + 2, 2, 2);
          ctx.fillRect(x + o + 1, y + 3, 4, 1);
        }
      noise(ctx, w, h, 14, r);
    });
  },
  mold() {
    return canvasTex('mold', 32, 32, (ctx, w, h) => {
      const r = rng(14);
      for (let i = 0; i < 120; i++) {
        const x = 16 + (r() - 0.5) * 26 * r();
        const y = 16 + (r() - 0.5) * 26 * r();
        ctx.fillStyle = r() > 0.5 ? '#2a3a1a' : '#3e4a22';
        ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
      }
    });
  },
  tile(a = '#d8d4c8', b = '#2a2a2a') {
    return canvasTex('tile' + a + b, 16, 16, (ctx, w, h) => {
      const r = rng(15);
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) {
          ctx.fillStyle = (x + y) % 2 ? a : b;
          ctx.fillRect(x * 8, y * 8, 8, 8);
        }
      noise(ctx, w, h, 12, r);
    });
  },
  carpet(base = '#5a2a2a') {
    return canvasTex('carpet' + base, 32, 32, (ctx, w, h) => {
      const r = rng(16);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 30, r);
    });
  },
  water() {
    return canvasTex('water', 64, 64, (ctx, w, h) => {
      const r = rng(17);
      ctx.fillStyle = '#3a4a40';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = r() > 0.5 ? '#56685a' : '#2c3a32';
        ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 4 + Math.floor(r() * 8), 1);
      }
    });
  },
  leaves(base = '#3d5a26') {
    return canvasTex('leaves' + base, 32, 32, (ctx, w, h) => {
      const r = rng(18);
      for (let i = 0; i < 260; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * 15;
        ctx.fillStyle = shade(base, (r() - 0.5) * 0.3);
        ctx.fillRect(Math.floor(16 + Math.cos(a) * d), Math.floor(16 + Math.sin(a) * d), 2, 2);
      }
    });
  },
  fence() {
    return canvasTex('fence', 32, 32, (ctx, w, h) => {
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 2, w, 2);
      ctx.fillRect(0, 26, w, 2);
      for (let x = 1; x < w; x += 4) {
        ctx.fillRect(x, 0, 2, h);
        ctx.fillRect(x - 1, 0, 4, 2);
      }
    });
  },
  chainlink() {
    return canvasTex('chain', 16, 16, (ctx, w, h) => {
      ctx.fillStyle = '#8a8c88';
      for (let i = 0; i < 16; i++) {
        ctx.fillRect(i, i, 1, 1);
        ctx.fillRect(15 - i, i, 1, 1);
      }
    });
  },
  stone(base = '#8a8880') {
    return canvasTex('stone' + base, 32, 32, (ctx, w, h) => {
      const r = rng(19);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 34, r);
      ctx.fillStyle = '#3e4a2a';
      for (let i = 0; i < 20; i++) ctx.fillRect(Math.floor(r() * w), Math.floor(h - r() * 8), 2, 1);
    });
  },
  door(color = '#5a2a1a') {
    return canvasTex('door' + color, 32, 64, (ctx, w, h) => {
      const r = rng(20);
      ctx.fillStyle = '#e8e0cc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.fillRect(3, 3, w - 6, h - 3);
      ctx.fillStyle = shade(color, -0.12);
      ctx.fillRect(7, 8, 18, 20);
      ctx.fillRect(7, 34, 18, 24);
      ctx.fillStyle = '#d0b050';
      ctx.fillRect(23, 32, 3, 3);
      ctx.fillStyle = '#16244a';
      ctx.fillRect(9, 10, 14, 6);
      noise(ctx, w, h, 12, r);
    });
  },
  tvStatic(frame) {
    return canvasTex(null, 32, 24, (ctx, w, h) => {
      const r = rng(frame * 31 + 1);
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = r() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
  },
  flash(seed) {
    return canvasTex('flash' + seed, 64, 64, (ctx, w, h) => {
      const r = rng(seed);
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(0, 0, w, h);
      const cols = ['#1a1a1a', '#b02020', '#207040', '#e0a020', '#2040a0'];
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < 3; x++) {
          const cx = 10 + x * 21;
          const cy = 10 + y * 21;
          ctx.fillStyle = cols[Math.floor(r() * cols.length)];
          const k = Math.floor(r() * 4);
          if (k === 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.fill();
          } else if (k === 1) {
            ctx.beginPath();
            ctx.moveTo(cx, cy - 7);
            ctx.lineTo(cx + 7, cy + 6);
            ctx.lineTo(cx - 7, cy + 6);
            ctx.fill();
          } else if (k === 2) {
            ctx.fillRect(cx - 2, cy - 7, 4, 14);
            ctx.fillRect(cx - 6, cy - 3, 12, 4);
          } else {
            ctx.fillRect(cx - 6, cy - 2, 12, 4);
            ctx.fillRect(cx - 3, cy - 6, 6, 12);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(cx - 1, cy - 1, 2, 2);
          }
        }
    });
  },
  paper() {
    return canvasTex('paper', 16, 16, (ctx, w, h) => {
      ctx.fillStyle = '#f0ecdc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8a8478';
      for (let y = 3; y < h - 2; y += 3) ctx.fillRect(2, y, 8 + ((y * 7) % 5), 1);
      ctx.fillStyle = '#b02020';
      ctx.fillRect(9, 11, 5, 3);
    });
  },
  sign(text, { bg = '#1a1a1a', fg = '#f0e8d0', w = 128, h = 32, font = 'bold 18px monospace', border = null, lines = null } = {}) {
    return canvasTex('sign' + text + bg + fg + w + h + font, w, h, (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, w - 4, h - 4);
      }
      ctx.fillStyle = fg;
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const ls = lines || [text];
      const lh = h / (ls.length + 0.4);
      ls.forEach((l, i) => ctx.fillText(l, w / 2, lh * (i + 0.7)));
    });
  },
};

// box geometry with per-face uv scaled so a texture repeats every `s` units
// Large faces are subdivided (max ~8 units per segment) so vertex snapping +
// near-plane clipping can't warp giant triangles through other geometry.
export function scaledBox(w, h, d, s = 3, opts = {}) {
  const seg = opts.seg ?? 8;
  const sw = Math.max(1, Math.ceil(w / seg));
  const sh = Math.max(1, Math.ceil(h / seg));
  const sd = Math.max(1, Math.ceil(d / seg));
  const g = new THREE.BoxGeometry(w, h, d, sw, sh, sd);
  const uv = g.attributes.uv;
  // face order px, nx, py, ny, pz, nz
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (const grp of g.groups) {
    const [fu, fv] = dims[grp.materialIndex];
    const idx = g.index;
    const seen = new Set();
    for (let i = grp.start; i < grp.start + grp.count; i++) {
      const k = idx.getX(i);
      if (seen.has(k)) continue;
      seen.add(k);
      uv.setXY(k, (uv.getX(k) * fu) / s + (opts.uOff || 0), (uv.getY(k) * fv) / s + (opts.vOff || 0));
    }
  }
  return g;
}

export function colorGeo(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
