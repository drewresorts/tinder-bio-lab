/*!
 * tv-static-morph.js
 *
 * <tv-static-morph> — full-bleed RGB TV static whose particles fly together into
 * halftone renditions of transparent PNGs / logos, hold, then scatter back into
 * noise. Dependency-free, WebGL1, ~1 draw call per layer.
 *
 * Used by sections/tv-static-morph.liquid, but works on any page:
 *
 *   <tv-static-morph data-dot-spacing="5" style="height:80vh">
 *     <img data-tsm-source src="logo.png" alt="Brand logo" crossorigin="anonymous">
 *   </tv-static-morph>
 *   <script src="tv-static-morph.js" defer></script>
 *
 * Every option is a data-* attribute (camelCase key -> data-kebab-case) and can be
 * changed live. JS API: el.setImages([...]), el.goTo(i, hold), el.progress (manual).
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.customElements || customElements.get('tv-static-morph')) return;

  /* ------------------------------------------------------------------ options */

  var OPTIONS = {
    // Static
    cellSize: 2,            // CSS px per static "pixel"
    saturation: 100,        // 0 = black & white static, 100 = full RGB
    flickerFps: 30,         // how many times per second the noise re-rolls
    crt: true,              // scanlines, vignette, rolling band, line tearing
    background: '#000000',

    // Image / halftone
    imageScale: 70,         // % of the section the image may fill (desktop)
    imageScaleMobile: 85,   // % on screens < 750px wide
    dotSpacing: 5,          // CSS px between halftone dot centres
    dotSize: 95,            // % — 100 = full-tone dots just touch
    dotAngle: 45,           // halftone screen angle in degrees
    dotShape: 'round',      // round | square
    tone: 'alpha',          // alpha | luminance | darkness — what drives dot size

    // Colour of the formed image
    colorSource: 'static',  // static (dots stay RGB noise) | image (auto-lifted if too close to the background) | custom
    customColor: '#ffffff',
    grain: 20,              // % of static noise left in image/custom colours
    backgroundStatic: 15,   // % brightness the surrounding static keeps once formed

    // Motion
    playback: 'loop',       // loop | once | hover | scroll | manual
    holdStatic: 1.5,        // s of pure static before each image
    morphDuration: 2.4,     // s for static -> image (and back)
    holdImage: 4,           // s the formed image is held
    pattern: 'random',      // random | scan | sweep | radial — order particles arrive in
    stagger: 60,            // % of the morph spent staggering arrivals
    swirl: 30,              // % sideways arc on each particle's flight
    travel: 100,            // % of the screen a particle may travel from (100 = anywhere)
    pointer: true,          // cursor knocks the image back into static locally
    pointerRadius: 120,     // CSS px

    maxParticles: 0,        // 0 = auto (140k desktop / 45k touch)
    fallbackText: ''        // rendered as the image when no image sources exist
  };

  var REBUILD = {
    cellSize: 1, imageScale: 1, imageScaleMobile: 1, dotSpacing: 1, dotSize: 1, dotAngle: 1,
    tone: 1, pattern: 1, travel: 1, maxParticles: 1
  };

  var KEYS = Object.keys(OPTIONS);
  var toAttr = function (k) { return 'data-' + k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }); };
  var ATTR_TO_KEY = {};
  KEYS.forEach(function (k) { ATTR_TO_KEY[toAttr(k)] = k; });

  var STRIDE = 11; // floats per particle: start(2) target(2) data(4: diameter, delay, rnd, rnd) colour(3)

  function parseOption(key, raw) {
    var def = OPTIONS[key];
    if (raw == null || raw === '') return def;
    if (typeof def === 'number') { var n = parseFloat(raw); return isFinite(n) ? n : def; }
    if (typeof def === 'boolean') return !/^(false|0|off|no)$/i.test(String(raw).trim());
    return String(raw);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  var colorCtx = null, colorCache = {};
  function parseColor(str, fallback) {
    var key = String(str || '');
    if (colorCache[key]) return colorCache[key];
    var out = parseColorRaw(key, fallback);
    colorCache[key] = out;
    return out;
  }
  function parseColorRaw(str, fallback) {
    try {
      colorCtx = colorCtx || document.createElement('canvas').getContext('2d');
      colorCtx.fillStyle = '#000';
      colorCtx.fillStyle = String(str || '');
      var v = colorCtx.fillStyle;
      if (v.charAt(0) === '#') return [1, 3, 5].map(function (i) { return parseInt(v.slice(i, i + 2), 16) / 255; });
      var m = v.match(/[\d.]+/g);
      if (m && m.length >= 3) return [m[0] / 255, m[1] / 255, m[2] / 255];
    } catch (e) { /* ignore */ }
    return fallback || [0, 0, 0];
  }

  /* -------------------------------------------------------------------- styles */

  var CSS =
    'tv-static-morph{display:block;position:relative;overflow:hidden;isolation:isolate;background:#000;-webkit-tap-highlight-color:transparent}' +
    'tv-static-morph>.tsm-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    'tv-static-morph>.tsm-crt{position:absolute;inset:0;pointer-events:none;z-index:1;' +
      'background:repeating-linear-gradient(180deg,rgba(0,0,0,0) 0,rgba(0,0,0,0) 2px,rgba(0,0,0,.2) 2px,rgba(0,0,0,.2) 3px),' +
      'radial-gradient(130% 100% at 50% 50%,rgba(0,0,0,0) 60%,rgba(0,0,0,.45) 100%)}' +
    'tv-static-morph[data-crt="false"]>.tsm-crt{display:none}' +
    'tv-static-morph [data-tsm-source]{position:absolute!important;width:1px!important;height:1px!important;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}' +
    'tv-static-morph [data-tsm-source].tsm-fallback-img{inset:0;margin:auto;width:auto!important;height:auto!important;max-width:70%;max-height:70%;clip:auto;clip-path:none;object-fit:contain}';

  function injectStyles() {
    if (document.getElementById('tv-static-morph-css')) return;
    var st = document.createElement('style');
    st.id = 'tv-static-morph-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------- shaders */

  var FRAG_PRECISION =
    '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';

  // Shared by both programs so a particle sitting in its home cell is pixel-identical
  // to the background static underneath it (that's what makes the lift-off seamless).
  var GLSL_COMMON = [
    'vec3 hash33(vec3 p3) {',
    '  p3 = fract(p3 * vec3(.1031, .1030, .0973));',
    '  p3 += dot(p3, p3.yxz + 33.33);',
    '  return fract((p3.xxy + p3.yxx) * p3.zyx);',
    '}',
    'float hash13(vec3 p3) {',
    '  p3 = fract(p3 * .1031);',
    '  p3 += dot(p3, p3.zyx + 31.32);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'vec3 staticColor(vec2 cell, float stp, float sat) {',
    '  vec3 c = hash33(vec3(cell, stp));',
    '  float l = dot(c, vec3(0.299, 0.587, 0.114));',
    '  return mix(vec3(l), c, sat);',
    '}',
    // Occasional horizontal tearing of a band of rows, in cells.
    'float tearShift(float row, float stp) {',
    '  float band = floor(row / 5.0);',
    '  float on = step(0.993, hash13(vec3(band, stp, 11.0)));',
    '  return on * (hash13(vec3(band, stp, 5.0)) - 0.5) * 18.0;',
    '}',
    'float rollBand(float y, float t) {',
    '  return 0.86 + 0.14 * (0.5 + 0.5 * sin(y * 4.0 - t * 1.7));',
    '}'
  ].join('\n');

  var BG_VS = [
    'attribute vec2 aPos;',
    'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var BG_FS = FRAG_PRECISION + GLSL_COMMON + [
    '',
    'uniform vec2 uRes;',
    'uniform float uCell, uStep, uLevel, uSat, uPointerR, uCrt, uTime;',
    'uniform vec3 uBg, uPointer;',
    'void main() {',
    '  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '  float row = floor(p.y / uCell);',
    '  float sx = uCrt * tearShift(row, uStep);',
    '  vec2 cell = vec2(floor(p.x / uCell + sx), row);',
    '  vec3 c = staticColor(cell, uStep, uSat);',
    '  float level = uLevel;',
    '  if (uPointer.z > 0.0) {',
    '    float d = distance(p, uPointer.xy);',
    '    level = max(level, uPointer.z * (1.0 - smoothstep(uPointerR * 0.25, uPointerR, d)));',
    '  }',
    '  if (uCrt > 0.5) c *= rollBand(p.y / uRes.y, uTime);',
    '  gl_FragColor = vec4(mix(uBg, c, level), 1.0);',
    '}'
  ].join('\n');

  var PT_VS = 'precision highp float;\n' + GLSL_COMMON + [
    '',
    'attribute vec2 aStart;',
    'attribute vec2 aTarget;',
    'attribute vec4 aData;', // x diameter(px), y delay(0-1), z,w random
    'attribute vec3 aColor;',
    'uniform vec2 uRes;',
    'uniform float uCell, uStep, uSat, uProg, uStagger, uSwirl, uPointerR, uCrt, uRound, uColorMode, uGrain, uTime;',
    'uniform vec3 uPointer, uCustom, uBg;',
    'varying vec3 vColor;',
    'varying float vHalf, vRound, vSize;',
    'void main() {',
    '  float p = clamp((uProg - aData.y * uStagger) / max(1.0 - uStagger, 0.001), 0.0, 1.0);',
    '  float e = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) * 0.5;',
    '  float arc = sin(3.14159265 * e);',
    '  vec2 cell = floor(aStart / uCell);',
    '  vec3 jit = hash33(vec3(cell + 0.37, uStep + 101.0));',
    '  vec2 d = aTarget - aStart;',
    '  vec2 pos = mix(aStart, aTarget, e) + vec2(-d.y, d.x) * (arc * uSwirl * (aData.z * 2.0 - 1.0));',
    '  pos += (jit.xy - 0.5) * (uCell * 3.0 * arc);', // signal jitter while in flight
    '  float pf = 0.0;',
    '  if (uPointer.z > 0.0) {',
    '    vec2 dp = pos - uPointer.xy;',
    '    float dist = length(dp);',
    '    pf = uPointer.z * e * (1.0 - smoothstep(0.0, uPointerR, dist));',
    '    pos += (dist > 0.001 ? dp / dist : vec2(0.0)) * pf * uPointerR * (0.15 + 0.35 * aData.w);',
    '    pos += (jit.xy - 0.5) * uCell * 6.0 * pf;',
    '  }',
    '  pos.x -= uCrt * tearShift(floor(pos.y / uCell), uStep) * uCell;',
    '  vec3 sc = staticColor(cell, uStep, uSat);',
    '  vec3 br = sc / max(max(sc.r, sc.g), max(sc.b, 0.25));',
    '  vec3 base = uColorMode > 1.5 ? br : (uColorMode > 0.5 ? uCustom : aColor);',
    // Image colours too close to the background (e.g. a black logo on black) get lifted so they stay visible.
    '  if (uColorMode < 0.5) {',
    '    float lb = dot(uBg, vec3(0.299, 0.587, 0.114));',
    '    float lift = 1.0 - smoothstep(0.12, 0.3, abs(dot(base, vec3(0.299, 0.587, 0.114)) - lb));',
    '    base = mix(base, lb < 0.5 ? vec3(0.92) : vec3(0.08), lift * 0.85);',
    '  }',
    '  float g = uColorMode > 1.5 ? 0.0 : uGrain;',
    '  vec3 tgt = mix(base, br, g * 0.65) * (1.0 + g * (jit.z - 0.5) * 1.2);',
    '  vec3 col = mix(sc, tgt, smoothstep(0.5, 1.0, p));',
    '  float pk = clamp(pf * 1.6, 0.0, 1.0);',
    '  col = mix(col, sc, pk);',
    '  if (uCrt > 0.5) col *= rollBand(pos.y / uRes.y, uTime);',
    '  float h0 = uCell * 0.5;',
    '  float h = mix(h0, aData.x * 0.5, smoothstep(0.15, 1.0, e));',
    '  h = mix(h, h0, clamp(pf, 0.0, 1.0));',
    '  vRound = uRound * smoothstep(0.35, 1.0, e) * (1.0 - pk);',
    '  vHalf = max(h, 0.35);',
    '  vSize = 2.0 * vHalf + 2.0;',
    '  vColor = col;',
    '  gl_PointSize = vSize;',
    '  gl_Position = vec4(pos.x / uRes.x * 2.0 - 1.0, 1.0 - pos.y / uRes.y * 2.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var PT_FS = FRAG_PRECISION + [
    'varying vec3 vColor;',
    'varying float vHalf, vRound, vSize;',
    'void main() {',
    '  vec2 q = (gl_PointCoord - 0.5) * vSize;',
    '  float k = vRound * vHalf;',
    '  vec2 b = abs(q) - vec2(vHalf - k);',
    '  float d = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - k;',
    '  float a = clamp(0.5 - d, 0.0, 1.0);',
    '  if (a < 0.004) discard;',
    '  gl_FragColor = vec4(vColor * a, a);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[tv-static-morph] shader error:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function program(gl, vs, fs, uniforms, attributes) {
    var v = compile(gl, gl.VERTEX_SHADER, vs);
    var f = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('[tv-static-morph] link error:', gl.getProgramInfoLog(p));
      return null;
    }
    var out = { p: p, u: {}, a: {} };
    uniforms.forEach(function (n) { out.u[n] = gl.getUniformLocation(p, n); });
    attributes.forEach(function (n) { out.a[n] = gl.getAttribLocation(p, n); });
    return out;
  }

  /* ---------------------------------------------------------------- utilities */

  var FAILED = { failed: true };

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      if (typeof src !== 'string') return resolve(src); // canvas / ImageBitmap / loaded <img>
      var img = new Image();
      if (!/^(data|blob):/i.test(src)) img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Could not load ' + src)); };
      img.src = src;
    });
  }

  function dims(img) {
    return [
      img.naturalWidth || img.videoWidth || img.width || 0,
      img.naturalHeight || img.videoHeight || img.height || 0
    ];
  }

  /* ------------------------------------------------------------------ element */

  class TvStaticMorph extends HTMLElement {
    static get observedAttributes() { return Object.keys(ATTR_TO_KEY); }

    constructor() {
      super();
      this.o = Object.assign({}, OPTIONS);
      this.prog = 0;
      this._images = [];
      this._sourceEls = [];
      this._customSources = null;
      this._index = 0;
      this._queued = null;
      this._holding = false;
      this._phase = 'static';
      this._phaseT = 0;
      this._time = 0;
      this._count = 0;
      this._key = '';
      this._ver = 0;
      this._rebuildAt = 0;
      this._loadToken = 0;
      this._w = 0; this._h = 0; this._dpr = 1;
      this._pointer = [0, 0];
      this._pointerIn = false;
      this._pAmt = 0;
      this._hover = false;
      this._visible = true;
      this._dirty = true;
      this._raf = 0;
      this._last = 0;
      this._frame = this._frame.bind(this);
    }

    /* ---- lifecycle */

    connectedCallback() {
      var self = this;
      KEYS.forEach(function (k) { self.o[k] = parseOption(k, self.getAttribute(toAttr(k))); });
      injectStyles();

      this._canvas = document.createElement('canvas');
      this._canvas.className = 'tsm-canvas';
      this._canvas.setAttribute('aria-hidden', 'true');
      this._crt = document.createElement('div');
      this._crt.className = 'tsm-crt';
      this._crt.setAttribute('aria-hidden', 'true');
      this.insertBefore(this._crt, this.firstChild);
      this.insertBefore(this._canvas, this.firstChild);
      this.style.backgroundColor = this.o.background;

      this._reducedMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
      this._frozen = !!(this._reducedMQ && this._reducedMQ.matches);

      this._onLost = function (e) { e.preventDefault(); self._stop(); self._gl = null; };
      this._onRestored = function () { if (self._initGL()) { self._key = ''; self._dirty = true; self._start(); } };
      this._canvas.addEventListener('webglcontextlost', this._onLost);
      this._canvas.addEventListener('webglcontextrestored', this._onRestored);

      if (!this._initGL()) {
        this.classList.add('tsm--fallback');
        var first = this.querySelector('[data-tsm-source]');
        if (first) first.classList.add('tsm-fallback-img');
        return;
      }

      this._bindEvents();
      this._resize();
      if (this._customSources) {
        this.setImages(this._customSources);
      } else if (document.readyState === 'loading') {
        // Upgraded before our children were parsed: wait for them.
        var self2 = this;
        document.addEventListener('DOMContentLoaded', function () { if (self2._gl && !self2._customSources) self2._loadFromChildren(); }, { once: true });
      } else {
        this._loadFromChildren();
      }
      this._ready = true;
      this._start();
    }

    disconnectedCallback() {
      this._ready = false;
      this._stop();
      this._unbindEvents();
      if (this._canvas) {
        this._canvas.removeEventListener('webglcontextlost', this._onLost);
        this._canvas.removeEventListener('webglcontextrestored', this._onRestored);
      }
      if (this._gl) {
        var ext = this._gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
        this._gl = null;
      }
      if (this._canvas) this._canvas.remove();
      if (this._crt) this._crt.remove();
      this._canvas = this._crt = null;
    }

    attributeChangedCallback(name, oldV, newV) {
      var key = ATTR_TO_KEY[name];
      if (!key || !this._ready) return;
      this.o[key] = parseOption(key, newV);
      if (key === 'background') this.style.backgroundColor = this.o.background;
      if (REBUILD[key]) this._invalidate(60);
      if (key === 'fallbackText' && !this._customSources && !this._sourceEls.length) this._loadFromChildren();
      if (key === 'playback') { this._phase = this.prog > 0 ? 'image' : 'static'; this._phaseT = 0; }
      this._dirty = true;
    }

    /* ---- public API */

    /** Replace the image list. Accepts URLs, data/blob URLs, <img>, <canvas> or ImageBitmap. */
    setImages(list) {
      this._customSources = Array.prototype.slice.call(list || []);
      if (!this._gl) return;
      this._load(this._customSources);
    }

    /** Morph to image i (via static). hold=true keeps it on screen until goTo/release(). */
    goTo(i, hold) {
      var n = this._images.length;
      if (!n) return;
      i = ((i % n) + n) % n;
      this._holding = !!hold;
      var mode = this.o.playback;
      if (this._frozen || mode === 'manual' || mode === 'scroll') {
        this._index = i;
        this._key = '';
        this._dirty = true;
        return;
      }
      if (i === this._index && this.prog > 0) {
        this._queued = null;
        if (this._phase === 'dissolving') this._setPhase('forming');
        return;
      }
      this._queued = i;
      if (this._phase === 'forming' || this._phase === 'image') this._setPhase('dissolving');
    }

    release() { this._holding = false; }

    get progress() { return this.prog; }
    set progress(v) { this.prog = clamp(+v || 0, 0, 1); this._dirty = true; }

    get index() { return this._index; }
    get phase() { return this._phase; }
    get imageCount() { return this._images.length; }
    get particleCount() { return this._count; }

    /* ---- setup */

    _initGL() {
      var gl = this._canvas.getContext('webgl', {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: true, preserveDrawingBuffer: false
      });
      if (!gl) return false;
      var bg = program(gl, BG_VS, BG_FS,
        ['uRes', 'uCell', 'uStep', 'uLevel', 'uSat', 'uPointerR', 'uCrt', 'uTime', 'uBg', 'uPointer'], ['aPos']);
      var pt = program(gl, PT_VS, PT_FS,
        ['uRes', 'uCell', 'uStep', 'uSat', 'uProg', 'uStagger', 'uSwirl', 'uPointerR', 'uCrt', 'uRound',
          'uColorMode', 'uGrain', 'uTime', 'uPointer', 'uCustom', 'uBg'],
        ['aStart', 'aTarget', 'aData', 'aColor']);
      if (!bg || !pt) return false;
      this._gl = gl;
      this._bg = bg;
      this._pt = pt;
      this._triBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._triBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this._ptBuf = gl.createBuffer();
      var range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
      this._pointMax = range ? range[1] : 64;
      return true;
    }

    _bindEvents() {
      var self = this;
      this._ro = new ResizeObserver(function () { self._resize(); });
      this._ro.observe(this);
      this._io = new IntersectionObserver(function (entries) {
        self._visible = entries[entries.length - 1].isIntersecting;
        if (self._visible) self._start(); else self._stop();
      }, { rootMargin: '100px' });
      this._io.observe(this);

      this._onMove = function (e) {
        var r = self.getBoundingClientRect();
        self._pointer[0] = (e.clientX - r.left) * (self._w / Math.max(1, r.width));
        self._pointer[1] = (e.clientY - r.top) * (self._h / Math.max(1, r.height));
        self._pointerIn = true;
      };
      this._onEnter = function (e) { self._onMove(e); if (e.pointerType !== 'touch') self._hover = true; };
      this._onLeave = function (e) { self._pointerIn = false; if (e.pointerType !== 'touch') self._hover = false; };
      this._onDown = function (e) { self._onMove(e); if (e.pointerType === 'touch') self._hover = !self._hover; };
      this._onUp = function (e) { if (e.pointerType === 'touch') self._pointerIn = false; };
      this.addEventListener('pointermove', this._onMove, { passive: true });
      this.addEventListener('pointerenter', this._onEnter, { passive: true });
      this.addEventListener('pointerleave', this._onLeave, { passive: true });
      this.addEventListener('pointerdown', this._onDown, { passive: true });
      this.addEventListener('pointerup', this._onUp, { passive: true });
      this.addEventListener('pointercancel', this._onUp, { passive: true });

      // Shopify theme editor: selecting an image block previews that image.
      this._onBlockSelect = function (e) {
        var i = self._sourceEls.indexOf(e.target);
        if (i >= 0) self.goTo(i, true);
      };
      this._onBlockDeselect = function () { self.release(); };
      this.addEventListener('shopify:block:select', this._onBlockSelect);
      this.addEventListener('shopify:block:deselect', this._onBlockDeselect);

      this._onMotionPref = function () {
        self._frozen = self._reducedMQ.matches;
        self._dirty = true;
      };
      if (this._reducedMQ && this._reducedMQ.addEventListener) this._reducedMQ.addEventListener('change', this._onMotionPref);
    }

    _unbindEvents() {
      if (this._ro) this._ro.disconnect();
      if (this._io) this._io.disconnect();
      this._ro = this._io = null;
      if (!this._onMove) return;
      this.removeEventListener('pointermove', this._onMove);
      this.removeEventListener('pointerenter', this._onEnter);
      this.removeEventListener('pointerleave', this._onLeave);
      this.removeEventListener('pointerdown', this._onDown);
      this.removeEventListener('pointerup', this._onUp);
      this.removeEventListener('pointercancel', this._onUp);
      this.removeEventListener('shopify:block:select', this._onBlockSelect);
      this.removeEventListener('shopify:block:deselect', this._onBlockDeselect);
      if (this._reducedMQ && this._reducedMQ.removeEventListener) this._reducedMQ.removeEventListener('change', this._onMotionPref);
    }

    _resize() {
      if (!this._canvas) return;
      var r = this.getBoundingClientRect();
      var cssW = Math.max(1, r.width), cssH = Math.max(1, r.height);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var maxPx = 3840 * 2160;
      if (cssW * cssH * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (cssW * cssH));
      var w = Math.max(1, Math.round(cssW * dpr));
      var h = Math.max(1, Math.round(cssH * dpr));
      if (w === this._w && h === this._h) return;
      this._w = w; this._h = h; this._dpr = dpr;
      this._canvas.width = w;
      this._canvas.height = h;
      this._invalidate(150);
      this._dirty = true;
    }

    /* ---- image sources */

    _loadFromChildren() {
      this._sourceEls = Array.prototype.slice.call(this.querySelectorAll('[data-tsm-source]'));
      var list = this._sourceEls
        .map(function (img) { return img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src'); })
        .filter(Boolean);
      if (!list.length && this.o.fallbackText.trim()) {
        var self = this, token = ++this._loadToken;
        var go = function () { if (token === self._loadToken) self._load([self._textImage(self.o.fallbackText)]); };
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go); else go();
        return;
      }
      this._load(list);
    }

    _load(list) {
      var self = this, token = ++this._loadToken;
      this._images = list.map(function () { return null; });
      this._index = 0;
      this._queued = null;
      this._key = '';
      this._count = 0;
      this.prog = this.o.playback === 'manual' ? this.prog : 0;
      this._setPhase('static');
      list.forEach(function (src, i) {
        loadImage(src).then(function (img) {
          if (token !== self._loadToken) return;
          self._images[i] = img;
          self._dirty = true;
        }, function (err) {
          if (token !== self._loadToken) return;
          console.warn('[tv-static-morph]', err.message);
          self._images[i] = FAILED;
        });
      });
    }

    _textImage(text) {
      var cs = getComputedStyle(this);
      var family = (cs.getPropertyValue('--font-heading-family') || '').trim() || cs.fontFamily ||
        'Helvetica Neue, Helvetica, Arial, sans-serif';
      var lines = String(text).split(/\\n|\n/);
      var fs = 360, pad = 40, lh = fs * 1.02;
      var c = document.createElement('canvas');
      var ctx = c.getContext('2d');
      var font = '800 ' + fs + 'px ' + family;
      ctx.font = font;
      var w = 1;
      lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
      c.width = Math.ceil(w + pad * 2);
      c.height = Math.ceil(lines.length * lh + pad * 2);
      ctx.font = font;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach(function (l, i) { ctx.fillText(l, c.width / 2, pad + lh * (i + 0.5)); });
      return c;
    }

    _isLoaded(i) { var im = this._images[i]; return !!im && im !== FAILED; }

    _nextLoaded(from) {
      var n = this._images.length;
      for (var k = 0; k < n; k++) {
        var i = (from + k) % n;
        if (this._isLoaded(i)) return i;
      }
      return -1;
    }

    _hasLaterImage(i) {
      for (var k = i + 1; k < this._images.length; k++) if (this._isLoaded(k)) return true;
      return false;
    }

    /* ---- halftone target generation */

    _cellPx() { return Math.max(1, this.o.cellSize * this._dpr); }

    _maxParticles() {
      if (this.o.maxParticles > 0) return this.o.maxParticles;
      var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      return coarse ? 45000 : 140000;
    }

    _invalidate(delayMs) {
      this._ver++;
      this._rebuildAt = performance.now() + (delayMs || 0);
    }

    _ensureTargets(i) {
      if (!this._gl || !this._isLoaded(i)) return false;
      var key = i + '|' + this._w + '|' + this._h + '|' + this._ver;
      if (key === this._key) return true;
      // Debounce rebuilds while resizing: keep showing this image's previous targets.
      if (this._count && this._keyIndex === i && performance.now() < this._rebuildAt) return true;
      var data = this._buildTargets(this._images[i]);
      if (!data) { this._images[i] = FAILED; return false; }
      var gl = this._gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this._ptBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      this._count = data.length / STRIDE;
      this._key = key;
      this._keyIndex = i;
      this._dirty = true;
      return true;
    }

    _buildTargets(img) {
      var o = this.o, W = this._w, H = this._h, dpr = this._dpr;
      var d = dims(img), iw = d[0], ih = d[1];
      if (!iw || !ih || W < 2 || H < 2) return null;

      // Fit the image ("contain") inside the section.
      var scale = clamp(((W / dpr) < 750 ? o.imageScaleMobile : o.imageScale) / 100, 0.05, 1);
      var dw = W * scale, dh = dw * ih / iw;
      if (dh > H * scale) { dh = H * scale; dw = dh * iw / ih; }
      var ox = (W - dw) / 2, oy = (H - dh) / 2, cx = W / 2, cy = H / 2;

      var pitch = Math.max(2, o.dotSpacing * dpr);

      // Rasterise once at ~4 samples per halftone cell (capped) and read the pixels.
      var sPx = pitch / 4;
      var sw = Math.max(1, Math.round(dw / sPx)), sh = Math.max(1, Math.round(dh / sPx));
      var cap = 1400 / Math.max(sw, sh);
      if (cap < 1) { sw = Math.max(1, Math.round(sw * cap)); sh = Math.max(1, Math.round(sh * cap)); }
      var cv = document.createElement('canvas');
      cv.width = sw; cv.height = sh;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      var px;
      try {
        ctx.drawImage(img, 0, 0, sw, sh);
        px = ctx.getImageData(0, 0, sw, sh).data;
      } catch (err) {
        console.warn('[tv-static-morph] Could not read image pixels (is the image served with CORS headers?)', err);
        return null;
      }

      var kx = sw / dw, ky = sh / dh;
      var th = o.dotAngle * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
      var gain = Math.max(0.05, o.dotSize / 100);
      var tone = o.tone;
      var maxP = this._maxParticles();
      var maxDiam = Math.max(2, this._pointMax - 4);
      var T = [];

      for (var attempt = 0; attempt < 4; attempt++) {
        T.length = 0;
        var rx = Math.max(0.5, pitch * 0.5 * kx), ry = Math.max(0.5, pitch * 0.5 * ky);
        var n = Math.ceil((Math.hypot(dw, dh) * 0.5 + pitch) / pitch);
        for (var j = -n; j <= n; j++) {
          for (var i = -n; i <= n; i++) {
            var lx = i * pitch, ly = j * pitch;
            var x = cx + lx * cs - ly * sn, y = cy + lx * sn + ly * cs;
            if (x < ox || y < oy || x >= ox + dw || y >= oy + dh) continue;
            var u = (x - ox) * kx, v = (y - oy) * ky;
            var x0 = Math.max(0, Math.floor(u - rx)), x1 = Math.min(sw - 1, Math.floor(u + rx));
            var y0 = Math.max(0, Math.floor(v - ry)), y1 = Math.min(sh - 1, Math.floor(v + ry));
            var sa = 0, sr = 0, sg = 0, sb = 0, cnt = 0;
            for (var yy = y0; yy <= y1; yy++) {
              var row = yy * sw;
              for (var xx = x0; xx <= x1; xx++) {
                var idx = (row + xx) * 4, a = px[idx + 3];
                sa += a; sr += px[idx] * a; sg += px[idx + 1] * a; sb += px[idx + 2] * a; cnt++;
              }
            }
            if (!cnt || sa === 0) continue;
            var r = sr / sa / 255, g = sg / sa / 255, b = sb / sa / 255;
            var t = sa / (cnt * 255);
            if (tone === 'luminance' || tone === 'darkness') {
              var lum = 0.299 * r + 0.587 * g + 0.114 * b;
              t *= tone === 'luminance' ? lum : 1 - lum;
            }
            if (t < 0.035) continue;
            T.push(x, y, Math.min(maxDiam, pitch * Math.sqrt(t) * gain), r, g, b);
          }
        }
        var count = T.length / 6;
        if (count <= maxP) break;
        pitch *= Math.sqrt(count / maxP) * 1.03;
      }

      var count2 = Math.min(T.length / 6, maxP);
      var out = new Float32Array(count2 * STRIDE);
      var cell = this._cellPx();
      var cols = Math.max(1, Math.ceil(W / cell)), rows = Math.max(1, Math.ceil(H / cell));
      var travel = clamp(o.travel / 100, 0, 1);
      var reach = travel * Math.hypot(W, H);
      var maxR = Math.hypot(dw, dh) * 0.5 || 1;
      var pattern = o.pattern;

      for (var k = 0; k < count2; k++) {
        var tx = T[k * 6], ty = T[k * 6 + 1];
        var ci, ri;
        if (travel >= 0.999) {
          ci = (Math.random() * cols) | 0;
          ri = (Math.random() * rows) | 0;
        } else {
          var ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * reach;
          ci = Math.floor(clamp(tx + Math.cos(ang) * rr, 0, W - 1) / cell);
          ri = Math.floor(clamp(ty + Math.sin(ang) * rr, 0, H - 1) / cell);
        }
        var delay;
        if (pattern === 'scan') delay = ((ty - oy) / dh) * 0.8 + Math.random() * 0.2;
        else if (pattern === 'sweep') delay = ((tx - ox) / dw) * 0.8 + Math.random() * 0.2;
        else if (pattern === 'radial') delay = (Math.hypot(tx - cx, ty - cy) / maxR) * 0.8 + Math.random() * 0.2;
        else delay = Math.random();

        var p = k * STRIDE;
        out[p] = (ci + 0.5) * cell;
        out[p + 1] = (ri + 0.5) * cell;
        out[p + 2] = tx;
        out[p + 3] = ty;
        out[p + 4] = T[k * 6 + 2];
        out[p + 5] = clamp(delay, 0, 1);
        out[p + 6] = Math.random();
        out[p + 7] = Math.random();
        out[p + 8] = T[k * 6 + 3];
        out[p + 9] = T[k * 6 + 4];
        out[p + 10] = T[k * 6 + 5];
      }
      return out;
    }

    /* ---- timeline */

    _setPhase(p) {
      if (this._phase === p) return;
      this._phase = p;
      this._phaseT = 0;
      this.dispatchEvent(new CustomEvent('tsm:phase', { detail: { phase: p, index: this._index } }));
    }

    _update(dt) {
      var o = this.o;
      if (!this._frozen) this._time += dt;
      var speed = 1 / Math.max(0.1, o.morphDuration);
      var mode = this._frozen ? 'frozen' : o.playback;

      // Smooth pointer influence.
      var pGoal = (this._pointerIn && o.pointer && !this._frozen) ? 1 : 0;
      this._pAmt += (pGoal - this._pAmt) * (1 - Math.exp(-dt * 5));
      if (this._pAmt < 0.001) this._pAmt = 0;

      if (!this._images.length) { this.prog = 0; return; }

      if (mode === 'frozen' || mode === 'manual' || mode === 'scroll') {
        var idx = this._isLoaded(this._index) ? this._index : this._nextLoaded(0);
        if (idx < 0) return;
        this._index = idx;
        if (mode === 'frozen') { this.prog = this._ensureTargets(idx) ? 1 : 0; return; }
        if (mode === 'scroll') {
          var r = this.getBoundingClientRect(), vh = window.innerHeight || 1;
          var dist = Math.abs(r.top + r.height / 2 - vh / 2);
          var goal = this._holding ? 1 : smoothstep(0, 1, 1 - dist / (((vh + r.height) / 2) * 0.75));
          this.prog += (goal - this.prog) * (1 - Math.exp(-dt * 6));
        }
        this._ensureTargets(idx);
        return;
      }

      if (mode === 'hover') {
        var want = (this._hover || this._holding) && (this._queued == null || this._queued === this._index);
        if (this.prog <= 0) {
          var next = this._queued != null ? this._queued : this._nextLoaded(this._index);
          if (next < 0) return;
          this._index = next;
          this._queued = null;
        }
        if (want && !this._ensureTargets(this._index)) want = false;
        var before = this.prog;
        this.prog = clamp(this.prog + (want ? dt : -dt) * speed, 0, 1);
        if (before > 0 && this.prog === 0 && !this._holding && this._queued == null) {
          var nx = this._nextLoaded(this._index + 1);
          if (nx >= 0) this._index = nx; // the next hover shows the next image
        }
        this._setPhase(this.prog === 0 ? 'static' : this.prog === 1 ? 'image' : (want ? 'forming' : 'dissolving'));
        return;
      }

      // loop / once
      this._phaseT += dt;
      switch (this._phase) {
        case 'static': {
          var wait = this._queued != null ? 0.15 : o.holdStatic;
          if (this._phaseT < wait) break;
          var target = this._queued != null ? this._queued : this._nextLoaded(this._index);
          if (target < 0 || !this._isLoaded(target)) break;
          this._index = target;
          this._queued = null;
          if (this._ensureTargets(target)) this._setPhase('forming');
          break;
        }
        case 'forming':
          this._ensureTargets(this._index);
          this.prog = Math.min(1, this.prog + dt * speed);
          if (this.prog >= 1) this._setPhase('image');
          break;
        case 'image': {
          this._ensureTargets(this._index);
          var leave = (this._queued != null && this._queued !== this._index) ||
            (!this._holding && this._phaseT >= o.holdImage &&
              (o.playback === 'loop' || this._hasLaterImage(this._index)));
          if (leave) this._setPhase('dissolving');
          break;
        }
        case 'dissolving':
          this._ensureTargets(this._index);
          this.prog = Math.max(0, this.prog - dt * speed);
          if (this.prog <= 0) {
            if (this._queued == null) {
              var nxt = this._nextLoaded(this._index + 1);
              if (nxt >= 0) this._index = nxt;
            }
            this._setPhase('static');
          }
          break;
      }
    }

    /* ---- render loop */

    _start() {
      if (this._raf || !this._gl || !this._visible) return;
      this._last = 0;
      this._raf = requestAnimationFrame(this._frame);
    }

    _stop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    _frame(now) {
      this._raf = requestAnimationFrame(this._frame);
      var dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 1 / 60;
      this._last = now;
      var keyBefore = this._key, progBefore = this.prog;
      this._update(dt);
      if (this._frozen) {
        if (!this._dirty && keyBefore === this._key && progBefore === this.prog) return;
      }
      this._dirty = false;
      this._draw();
    }

    _draw() {
      var gl = this._gl;
      if (!gl || gl.isContextLost()) return;
      var o = this.o;
      var cell = this._cellPx();
      var stp = this._frozen ? 7 : Math.floor(this._time * clamp(o.flickerFps, 1, 120)) % 4096;
      var sat = clamp(o.saturation / 100, 0, 1);
      var crt = o.crt ? 1 : 0;
      var bgCol = parseColor(o.background, [0, 0, 0]);
      var pr = o.pointerRadius * this._dpr;
      var pz = o.pointer ? this._pAmt : 0;
      var level = 1 - (1 - clamp(o.backgroundStatic / 100, 0, 1)) * smoothstep(0, 0.7, this.prog);

      gl.viewport(0, 0, this._w, this._h);
      gl.disable(gl.BLEND);

      var bg = this._bg, u = bg.u;
      gl.useProgram(bg.p);
      gl.uniform2f(u.uRes, this._w, this._h);
      gl.uniform1f(u.uCell, cell);
      gl.uniform1f(u.uStep, stp);
      gl.uniform1f(u.uLevel, level);
      gl.uniform1f(u.uSat, sat);
      gl.uniform1f(u.uPointerR, pr);
      gl.uniform1f(u.uCrt, crt);
      gl.uniform1f(u.uTime, this._time);
      gl.uniform3f(u.uBg, bgCol[0], bgCol[1], bgCol[2]);
      gl.uniform3f(u.uPointer, this._pointer[0], this._pointer[1], pz);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._triBuf);
      gl.enableVertexAttribArray(bg.a.aPos);
      gl.vertexAttribPointer(bg.a.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(bg.a.aPos);

      if (!this._count || this.prog <= 0) return;

      var pt = this._pt, v = pt.u;
      var custom = parseColor(o.customColor, [1, 1, 1]);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pt.p);
      gl.uniform2f(v.uRes, this._w, this._h);
      gl.uniform1f(v.uCell, cell);
      gl.uniform1f(v.uStep, stp);
      gl.uniform1f(v.uSat, sat);
      gl.uniform1f(v.uProg, this.prog);
      gl.uniform1f(v.uStagger, clamp(o.stagger / 100, 0, 0.95));
      gl.uniform1f(v.uSwirl, clamp(o.swirl / 100, 0, 2));
      gl.uniform1f(v.uPointerR, pr);
      gl.uniform1f(v.uCrt, crt);
      gl.uniform1f(v.uRound, o.dotShape === 'square' ? 0 : 1);
      gl.uniform1f(v.uColorMode, o.colorSource === 'image' ? 0 : o.colorSource === 'custom' ? 1 : 2);
      gl.uniform1f(v.uGrain, clamp(o.grain / 100, 0, 1));
      gl.uniform1f(v.uTime, this._time);
      gl.uniform3f(v.uPointer, this._pointer[0], this._pointer[1], pz);
      gl.uniform3f(v.uCustom, custom[0], custom[1], custom[2]);
      gl.uniform3f(v.uBg, bgCol[0], bgCol[1], bgCol[2]);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._ptBuf);
      var B = 4 * STRIDE, a = pt.a;
      var attrs = [[a.aStart, 2, 0], [a.aTarget, 2, 8], [a.aData, 4, 16], [a.aColor, 3, 32]];
      attrs.forEach(function (at) {
        if (at[0] < 0) return;
        gl.enableVertexAttribArray(at[0]);
        gl.vertexAttribPointer(at[0], at[1], gl.FLOAT, false, B, at[2]);
      });
      gl.drawArrays(gl.POINTS, 0, this._count);
      attrs.forEach(function (at) { if (at[0] >= 0) gl.disableVertexAttribArray(at[0]); });
    }
  }

  customElements.define('tv-static-morph', TvStaticMorph);
})();
