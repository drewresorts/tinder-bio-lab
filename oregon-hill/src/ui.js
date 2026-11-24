// DOM UI: HUD, dialogue with choices, toasts, phone, fades, screens.
const $ = (id) => document.getElementById(id);

export function createUI(audio) {
  const dlg = $('dialog');
  const dName = $('dlg-name');
  const dText = $('dlg-text');
  const dChoices = $('dlg-choices');
  const dNext = $('dlg-next');
  let active = null; // {type, resolve, full, shown, typing, options, sel}
  let phoneOpen = false;
  let phoneRender = null;

  const ui = {
    get blocking() {
      return !!active || phoneOpen || ui.screen;
    },
    get dialogOpen() {
      return !!active;
    },
    get phoneOpen() {
      return phoneOpen;
    },
    screen: false,
  };

  // ---- dialogue -----------------------------------------------------------
  function open(name, text, memo) {
    dlg.classList.remove('hidden');
    dlg.classList.toggle('memo', !!memo);
    dName.textContent = name || '';
    dText.textContent = '';
    dChoices.innerHTML = '';
    dNext.classList.add('hidden');
  }
  function close() {
    dlg.classList.add('hidden');
    active = null;
  }

  let typeTimer = null;
  function typeOut(text, done) {
    clearInterval(typeTimer);
    let i = 0;
    active.typing = true;
    active.full = text;
    typeTimer = setInterval(() => {
      i += 2;
      dText.textContent = text.slice(0, i);
      if (i % 6 === 0) audio.sfx.blip();
      if (i >= text.length) finishType(done);
    }, 22);
    active.finish = () => finishType(done);
  }
  function finishType(done) {
    clearInterval(typeTimer);
    if (!active) return;
    dText.textContent = active.full;
    active.typing = false;
    done && done();
  }

  ui.say = (name, text, opts = {}) =>
    new Promise((resolve) => {
      open(name, text, opts.memo);
      active = { type: 'say', resolve };
      typeOut(text, () => dNext.classList.remove('hidden'));
    });

  ui.memo = (title, text) => {
    audio.sfx.paper();
    return ui.say(title, text, { memo: true });
  };

  // options: array of strings or {label, value, disabled, hint}
  ui.choose = (name, text, options) =>
    new Promise((resolve) => {
      open(name, text);
      const opts = options.map((o, i) => (typeof o === 'string' ? { label: o, value: i } : { value: i, ...o }));
      active = { type: 'choose', resolve, options: opts, sel: opts.findIndex((o) => !o.disabled) };
      typeOut(text || '', () => renderChoices());
    });

  function renderChoices() {
    if (!active || active.type !== 'choose') return;
    dChoices.innerHTML = '';
    active.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.innerHTML = `${i + 1}. ${escapeHtml(o.label)}${o.hint ? ` <span class="hint">${escapeHtml(o.hint)}</span>` : ''}`;
      b.disabled = !!o.disabled;
      if (i === active.sel) b.classList.add('sel');
      b.onclick = (e) => {
        e.stopPropagation();
        if (!o.disabled) pick(i);
      };
      b.onmouseenter = () => {
        if (!o.disabled && active) {
          active.sel = i;
          [...dChoices.children].forEach((c, j) => c.classList.toggle('sel', j === i));
        }
      };
      dChoices.appendChild(b);
    });
  }
  function pick(i) {
    const a = active;
    const o = a.options[i];
    audio.sfx.select();
    close();
    a.resolve(o.value);
  }
  function confirm() {
    if (!active) return;
    if (active.typing) {
      active.finish();
      return;
    }
    if (active.type === 'say') {
      const a = active;
      audio.sfx.blip();
      close();
      a.resolve();
    } else if (active.type === 'choose' && active.sel >= 0) pick(active.sel);
  }
  dlg.addEventListener('click', () => {
    if (active && (active.type === 'say' || active.typing)) confirm();
  });

  // ---- input routing --------------------------------------------------------
  ui.handleKey = (e) => {
    const k = e.key;
    if (active) {
      if (['Enter', ' ', 'e', 'E'].includes(k)) {
        confirm();
        return true;
      }
      if (active.type === 'choose' && !active.typing) {
        const n = parseInt(k, 10);
        if (n >= 1 && n <= active.options.length && !active.options[n - 1].disabled) {
          pick(n - 1);
          return true;
        }
        if (k === 'ArrowDown' || k === 's' || k === 'ArrowUp' || k === 'w') {
          const dir = k === 'ArrowDown' || k === 's' ? 1 : -1;
          let s = active.sel;
          for (let t = 0; t < active.options.length; t++) {
            s = (s + dir + active.options.length) % active.options.length;
            if (!active.options[s].disabled) break;
          }
          active.sel = s;
          audio.sfx.blip();
          renderChoices();
          return true;
        }
      }
      return true;
    }
    if (phoneOpen) {
      if (k === 'Tab' || k === 'Escape' || k === 'p' || k === 'P') {
        ui.closePhone();
        return true;
      }
      return true;
    }
    return false;
  };

  // ---- toasts -----------------------------------------------------------
  const toasts = $('toasts');
  ui.toast = (text, kind = '') => {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = text;
    toasts.appendChild(t);
    while (toasts.children.length > 4) toasts.removeChild(toasts.firstChild);
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4700);
  };

  // ---- prompt ---------------------------------------------------------------
  const prompt = $('prompt');
  let lastPrompt = '';
  ui.setPrompt = (text) => {
    if (text === lastPrompt) return;
    lastPrompt = text;
    prompt.classList.toggle('hidden', !text);
    prompt.textContent = text ? `[E] ${text}` : '';
  };

  // ---- fade ---------------------------------------------------------------
  const fade = $('fade');
  ui.fade = (on) =>
    new Promise((r) => {
      fade.classList.toggle('on', on);
      setTimeout(r, 380);
    });

  // ---- HUD ----------------------------------------------------------------
  const H = {
    day: $('hud-day'),
    time: $('hud-time'),
    loc: $('hud-loc'),
    money: $('hud-money'),
    rent: $('hud-rent'),
    tickets: $('hud-tickets'),
    e: $('bar-energy'),
    s: $('bar-sanity'),
    c: $('bar-clout'),
    status: $('hud-status'),
    radio: $('hud-radio'),
    radioBars: $('radio-bars'),
    hint: $('hud-hint'),
  };
  const cache = {};
  const set = (el, key, val, prop = 'textContent') => {
    if (cache[key] === val) return;
    cache[key] = val;
    el[prop] = val;
  };
  ui.showHUD = (v) => $('hud').classList.toggle('hidden', !v);
  ui.updateHUD = (d) => {
    set(H.day, 'day', d.day);
    set(H.time, 'time', d.time);
    set(H.loc, 'loc', d.loc);
    set(H.money, 'money', d.money);
    H.money.classList.toggle('neg', d.moneyNeg);
    set(H.rent, 'rent', d.rent);
    H.rent.classList.toggle('urgent', d.rentUrgent);
    set(H.tickets, 'tickets', d.tickets);
    H.tickets.classList.toggle('urgent', d.ticketsUrgent);
    for (const [el, k, v] of [
      [H.e, 'e', d.energy],
      [H.s, 's', d.sanity],
      [H.c, 'c', d.clout],
    ]) {
      const w = Math.round(Math.max(0, Math.min(100, v))) + '%';
      if (cache[k] !== w) {
        cache[k] = w;
        el.style.width = w;
        el.classList.toggle('low', v < 20);
      }
    }
    set(H.status, 'status', d.status);
    set(H.hint, 'hint', d.hint);
    const bars = Math.round(d.radio * 5);
    const rb = '▮'.repeat(bars) + '·'.repeat(5 - bars);
    set(H.radioBars, 'radio', rb);
    H.radio.classList.toggle('on', bars > 0);
  };

  // ---- phone ----------------------------------------------------------------
  const phone = $('phone');
  const tabsEl = $('phone-tabs');
  const body = $('phone-body');
  let tab = 'STATUS';
  ui.openPhone = (renderer) => {
    phoneRender = renderer;
    phoneOpen = true;
    phone.classList.remove('hidden');
    audio.sfx.select();
    renderPhone();
  };
  ui.closePhone = () => {
    phoneOpen = false;
    phone.classList.add('hidden');
    audio.sfx.blip();
  };
  ui.refreshPhone = () => phoneOpen && renderPhone();
  function renderPhone() {
    const { tabs, render } = phoneRender();
    tabsEl.innerHTML = '';
    for (const t of tabs) {
      const b = document.createElement('button');
      b.textContent = t;
      b.className = t === tab ? 'on' : '';
      b.onclick = () => {
        tab = t;
        audio.sfx.blip();
        renderPhone();
      };
      tabsEl.appendChild(b);
    }
    if (!tabs.includes(tab)) tab = tabs[0];
    body.innerHTML = '';
    render(tab, body);
  }
  $('phone-close').onclick = () => ui.closePhone();

  // ---- screens ----------------------------------------------------------------
  ui.titleMenu = (items) =>
    new Promise((resolve) => {
      ui.screen = true;
      const t = $('title');
      t.classList.remove('hidden');
      const menu = $('title-menu');
      menu.innerHTML = '';
      let sel = 0;
      const btns = items.map((it, i) => {
        const b = document.createElement('button');
        b.textContent = it.label;
        b.onclick = () => done(i);
        b.onmouseenter = () => mark(i);
        menu.appendChild(b);
        return b;
      });
      const mark = (i) => {
        sel = i;
        btns.forEach((b, j) => b.classList.toggle('sel', j === i));
      };
      mark(0);
      const onKey = (e) => {
        if (e.key === 'ArrowDown' || e.key === 's') mark((sel + 1) % btns.length);
        else if (e.key === 'ArrowUp' || e.key === 'w') mark((sel - 1 + btns.length) % btns.length);
        else if (e.key === 'Enter' || e.key === ' ') done(sel);
        else return;
        e.preventDefault();
      };
      window.addEventListener('keydown', onKey);
      function done(i) {
        window.removeEventListener('keydown', onKey);
        audio.init();
        audio.sfx.select();
        t.classList.add('hidden');
        ui.screen = false;
        resolve(items[i].value);
      }
    });

  ui.intro = async (cards) => {
    ui.screen = true;
    const el = $('intro');
    const tx = $('intro-text');
    el.classList.remove('hidden');
    for (const c of cards) {
      tx.textContent = c;
      tx.style.animation = 'none';
      void tx.offsetWidth;
      tx.style.animation = '';
      await new Promise((r) => {
        const go = (e) => {
          if (e.type === 'keydown' && !['Enter', ' ', 'Escape', 'e'].includes(e.key)) return;
          window.removeEventListener('keydown', go);
          el.removeEventListener('pointerdown', go);
          audio.sfx.blip();
          if (e.key === 'Escape') cards.length = 0;
          r();
        };
        setTimeout(() => {
          window.addEventListener('keydown', go);
          el.addEventListener('pointerdown', go);
        }, 250);
      });
      if (!cards.length) break;
    }
    el.classList.add('hidden');
    ui.screen = false;
  };

  ui.ending = (title, text, stats) =>
    new Promise((resolve) => {
      ui.screen = true;
      $('end-title').textContent = title;
      $('end-text').textContent = text;
      $('end-stats').textContent = stats;
      $('ending').classList.remove('hidden');
      $('end-again').onclick = () => resolve();
      const onKey = (e) => {
        if (e.key === 'Enter') {
          window.removeEventListener('keydown', onKey);
          resolve();
        }
      };
      setTimeout(() => window.addEventListener('keydown', onKey), 800);
    });

  ui.error = (msg) => {
    const e = $('error');
    e.classList.remove('hidden');
    e.textContent = msg;
  };

  return ui;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
