/* ============================================================
   Gambit — App-Logik (Vanilla JS, localStorage, kein Build)
   ============================================================ */
(function () {
  'use strict';
  const { STRATEGIES, DEFAULT_STRATEGY, order, recommend } = window.Gambit;
  const STORE_KEY = 'gambit.people.v1';
  const THEME_KEY = 'gambit.theme';

  /* ---------- Icons (SF-Symbols-Anmutung) ---------- */
  const S = (d, o = {}) =>
    `<svg width="${o.s || 22}" height="${o.s || 22}" viewBox="0 0 24 24" fill="${o.fill || 'none'}"
      stroke="${o.fill ? 'none' : 'currentColor'}" stroke-width="${o.w || 2.2}"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    back:    (s = 20) => S('<path d="M14.5 4.5 7 12l7.5 7.5"/>', { s, w: 2.4 }),
    chevron: (s = 15) => S('<path d="M9 5.5 15.5 12 9 18.5"/>', { s, w: 2.2 }),
    dots:    (s = 20) => S('<circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/>', { s, fill: 'currentColor' }),
    check:   (s = 19) => S('<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>', { s, w: 2.6 }),
    plus:    (s = 20) => S('<path d="M12 5v14M5 12h14"/>', { s, w: 2.4 }),
    minus:   (s = 20) => S('<path d="M6 12h12"/>', { s, w: 2.6 }),
    trash:   (s = 19) => S('<path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5"/>', { s, w: 1.9 }),
    info:    (s = 20) => S('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>', { s, w: 1.9 }),
    sliders: (s = 20) => S('<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>', { s, w: 1.9 }),
    archive: (s = 20) => S('<path d="M3.5 7.5h17v12a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-12Z"/><path d="M2.5 3.5h19v4h-19zM9.5 12h5"/>', { s, w: 1.9 }),
  };

  /* ---------- Erscheinungsbild ---------- */
  const THEMES = { system: 'System', light: 'Hell', dark: 'Dunkel' };
  function getTheme() { return localStorage.getItem(THEME_KEY) || 'system'; }
  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    localStorage.setItem(THEME_KEY, mode);
    requestAnimationFrame(() => {
      const meta = document.getElementById('themeColorMeta');
      if (meta) meta.content = getComputedStyle(document.body).backgroundColor;
    });
  }
  applyTheme(getTheme());

  /* ---------- State ---------- */
  let people = load();
  let currentId = null;

  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(people)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function byId(id) { return people.find((p) => p.id === id); }

  /* ---------- Helfer ---------- */
  const AVATAR_COLORS = ['#0a84ff','#5e5ce6','#bf5af2','#ff375f','#ff9f0a','#30b0c7','#32ade6','#ac8e68','#66d4cf','#ff6482'];
  function avatarColor(name) {
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function initials(name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  }
  function fmtDate(ts) {
    const d = new Date(ts), today = new Date(), y = new Date(Date.now() - 864e5);
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, today)) return 'Heute';
    if (same(d, y)) return 'Gestern';
    const opts = d.getFullYear() === today.getFullYear()
      ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' };
    return d.toLocaleDateString('de-DE', opts);
  }
  function esc(s) { return (s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function firstName(name) { return name.trim().split(/\s+/)[0] || name; }
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  /* ---------- Spielverlauf-Raster ---------- */
  function buildMatchGrid(p) {
    const opp = p.rounds.map((r) => r.opp);
    if (!opp.length) {
      return `<div class="card"><div class="mg-empty">Noch keine Runden. Halte oben die erste Interaktion fest.</div></div>`;
    }
    const my = window.Gambit.replayMyMoves(p.strategy, opp);
    const cols = opp.map((m, i) => {
      const r = p.rounds[i];
      const noted = (r.topic || r.details) ? '<span class="mg-note"></span>' : '';
      const last = i === opp.length - 1 ? ' last' : '';
      return `<div class="mg-col tap${last}" data-round="${r.id}">
          <div class="mg-num">${i + 1}</div>
          <div class="mg-cell"><span class="mdot me ${my[i] === 'C' ? 'c' : 'd'}"></span></div>
          <div class="mg-cell"><span class="mdot ${m === 'C' ? 'c' : 'd'}"></span>${noted}</div>
        </div>`;
    }).join('');
    return `
      <div class="mgrid">
        <div class="mg-labels">
          <div class="mg-spacer"></div>
          <div class="mg-lbl me">Ich</div>
          <div class="mg-lbl" style="color:${avatarColor(p.name)}">${esc(firstName(p.name))}</div>
        </div>
        <div class="mg-scroll" id="matchScroll"><div class="mg-track">${cols}</div></div>
      </div>
      <div class="legend">
        <span><i class="c"></i>kooperiert</span>
        <span><i class="d"></i>nicht kooperiert</span>
      </div>
      <div class="note">Tippe eine Spalte, um Datum, Thema und Details zu bearbeiten.</div>`;
  }

  /* ---------- Liste ---------- */
  const peopleList = document.getElementById('peopleList');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('search');
  const searchWrap = document.getElementById('searchWrap');

  function renderList() {
    const q = searchInput.value.trim().toLowerCase();
    searchWrap.classList.toggle('filled', q.length > 0);
    const filtered = people
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.context || '').toLowerCase().includes(q))
      .sort((a, b) => (b.rounds.at(-1)?.date || b.created) - (a.rounds.at(-1)?.date || a.created));

    peopleList.innerHTML = '';
    const noneAtAll = people.length === 0;
    emptyState.classList.toggle('hidden', !noneAtAll);
    peopleList.classList.toggle('hidden', noneAtAll || filtered.length === 0);
    if (noneAtAll) return;

    if (filtered.length === 0) {
      peopleList.classList.remove('hidden');
      peopleList.innerHTML = `<li class="tl-empty">Keine Treffer für „${esc(searchInput.value.trim())}"</li>`;
      return;
    }

    for (const p of filtered) {
      const opp = p.rounds.map((r) => r.opp);
      const rec = recommend(p.strategy, opp);
      const spark = opp.length
        ? opp.slice(-7).map((m) => `<i class="${m === 'C' ? 'c' : 'd'}"></i>`).join('')
        : '<i class="none"></i>';
      const row = el(`
        <li class="person-row" data-id="${p.id}">
          <div class="avatar" style="background:${avatarColor(p.name)}">${esc(initials(p.name))}</div>
          <div class="p-main">
            <div class="p-name">${esc(p.name)}</div>
            ${p.context ? `<div class="p-sub">${esc(p.context)}</div>` : ''}
            <div class="spark">${spark}</div>
          </div>
          <div class="p-trail">
            <span class="rec-tag ${rec.move === 'C' ? 'c' : 'd'}">${rec.move === 'C' ? 'Kooperieren' : 'Nicht kooperieren'}</span>
            <span class="chev">${ICON.chevron()}</span>
          </div>
        </li>`);
      row.addEventListener('click', () => openDetail(p.id));
      peopleList.appendChild(row);
    }
  }
  searchInput.addEventListener('input', renderList);
  document.getElementById('searchClear').addEventListener('click', () => {
    searchInput.value = ''; renderList(); searchInput.focus();
  });

  /* Große Überschrift beim Scrollen einklappen */
  const nav = document.getElementById('nav');
  const largeTitle = document.getElementById('largeTitle');
  new IntersectionObserver(
    ([e]) => nav.classList.toggle('stuck', !e.isIntersecting),
    { rootMargin: '-64px 0px 0px 0px', threshold: 0 }
  ).observe(largeTitle);

  /* ---------- Detailansicht ---------- */
  const detailView = document.getElementById('detailView');

  function openDetail(id) {
    currentId = id;
    renderDetail();
    detailView.classList.remove('hidden');
    detailView.setAttribute('aria-hidden', 'false');
    detailView.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    history.pushState({ detail: id }, '');
  }
  function closeDetail() {
    detailView.classList.add('hidden');
    detailView.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentId = null;
  }

  function renderDetail() {
    const p = byId(currentId);
    if (!p) return closeDetail();
    const opp = p.rounds.map((r) => r.opp);
    const rec = recommend(p.strategy, opp);
    const coops = opp.filter((m) => m === 'C').length;
    const rate = opp.length ? Math.round((coops / opp.length) * 100) + '%' : '—';
    const streak = currentStreak(opp);

    const timeline = p.rounds.length
      ? [...p.rounds].reverse().map((r) => `
          <button class="row inset-sep" data-round="${r.id}">
            <span class="row-dot ${r.opp === 'C' ? 'c' : 'd'}"><i></i></span>
            <span class="row-main">
              <span class="row-title">${r.opp === 'C' ? 'Kooperiert' : 'Nicht kooperiert'}</span>
              <span class="row-sub">${fmtDate(r.date)}${r.topic ? ' · ' + esc(r.topic) : ''}${r.details ? '<br>' + esc(r.details) : ''}</span>
            </span>
            <span class="chev">${ICON.chevron()}</span>
          </button>`).join('')
      : '<div class="tl-empty">Noch keine Interaktion festgehalten.</div>';

    detailView.innerHTML = `
      <div class="detail-nav">
        <button class="nav-back glass" id="backBtn" aria-label="Zurück">${ICON.back()}</button>
        <button class="nav-back glass" id="moreBtn" aria-label="Menü">${ICON.dots()}</button>
      </div>

      <div class="wrap">
        <div class="hero">
          <div class="avatar" style="background:${avatarColor(p.name)}">${esc(initials(p.name))}</div>
          <h2>${esc(p.name)}</h2>
          ${p.context ? `<div class="p-sub">${esc(p.context)}</div>` : ''}
        </div>

        <div class="section">
          <div class="rec-card ${rec.move === 'C' ? 'c' : 'd'}">
            <div class="rec-eyebrow">Dein nächster Zug</div>
            <div class="rec-headline">
              <span class="rec-glyph">${rec.move === 'C' ? ICON.check(17) : ICON.minus(17)}</span>
              <strong>${rec.move === 'C' ? 'Kooperieren' : 'Nicht kooperieren'}</strong>
            </div>
            <div class="rec-reason">${esc(rec.reason)}</div>
            <div class="rec-strategy">${esc(rec.strategy.name)}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-hd">Interaktion festhalten</div>
          <div class="log-row">
            <button class="log-btn c" data-log="C">
              <span class="lg-glyph">${ICON.check(19)}</span>
              War nett<small>kooperiert</small>
            </button>
            <button class="log-btn d" data-log="D">
              <span class="lg-glyph">${ICON.minus(19)}</span>
              War nicht nett<small>nicht kooperiert</small>
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-hd">Spielverlauf</div>
          ${buildMatchGrid(p)}
        </div>

        <div class="section">
          <div class="stats">
            <div class="stat"><b>${opp.length}</b><span>Interaktionen</span></div>
            <div class="stat"><b>${rate}</b><span>Kooperation</span></div>
            <div class="stat"><b>${streak.move ? `${streak.count}<i class="${streak.move === 'C' ? 'c' : 'd'}"></i>` : '—'}</b><span>Serie</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-hd">Strategie</div>
          <div class="rows">
            <button class="row" id="stratRow">
              <span class="row-main">
                <span class="row-title">${esc(STRATEGIES[p.strategy].name)}</span>
                <span class="row-sub">${esc(STRATEGIES[p.strategy].tagline)}</span>
              </span>
              <span class="chev">${ICON.chevron()}</span>
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-hd">Verlauf</div>
          <div class="rows">${timeline}</div>
        </div>
      </div>`;

    detailView.querySelector('#backBtn').addEventListener('click', () => history.back());
    detailView.querySelector('#moreBtn').addEventListener('click', () => openPersonMenu(p));
    detailView.querySelector('#stratRow').addEventListener('click', () => openStrategyPicker(p));
    detailView.querySelectorAll('[data-log]').forEach((b) =>
      b.addEventListener('click', () => logInteraction(p.id, b.dataset.log)));
    detailView.querySelectorAll('[data-round]').forEach((c) =>
      c.addEventListener('click', () => openRoundSheet(p.id, c.dataset.round)));

    requestAnimationFrame(() => {
      const sc = detailView.querySelector('#matchScroll');
      if (sc) sc.scrollLeft = sc.scrollWidth;
    });
  }

  function currentStreak(opp) {
    if (!opp.length) return { count: 0, move: null };
    const last = opp.at(-1); let n = 0;
    for (let i = opp.length - 1; i >= 0 && opp[i] === last; i--) n++;
    return { count: n, move: last };
  }

  /* ---------- Aktionen ---------- */
  function logInteraction(id, move) {
    const p = byId(id); if (!p) return;
    const round = { id: uid(), opp: move, date: Date.now(), topic: '', details: '' };
    p.rounds.push(round);
    save(); renderDetail();
    openRoundSheet(id, round.id, true);
  }
  function deleteRound(id, roundId) {
    const p = byId(id); if (!p) return;
    p.rounds = p.rounds.filter((r) => r.id !== roundId);
    save(); renderDetail();
  }

  /* ---------- Sheets ---------- */
  const modalRoot = document.getElementById('modalRoot');
  let dismissHandler = null;
  // onDismiss wird nur beim Schließen durch den Nutzer aufgerufen (Hintergrund,
  // Escape, [data-close]) – nicht, wenn ein Sheet ein anderes öffnet.
  function openSheet(inner, onDismiss) {
    const overlay = el(`<div class="scrim"><div class="sheet"><div class="grabber"></div>${inner}</div></div>`);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) dismissSheet(); });
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', dismissSheet));
    modalRoot.innerHTML = '';
    modalRoot.appendChild(overlay);
    dismissHandler = onDismiss || null;
    return overlay;
  }
  function closeSheet() { dismissHandler = null; modalRoot.innerHTML = ''; }
  function dismissSheet() {
    const handler = dismissHandler;
    dismissHandler = null;
    modalRoot.innerHTML = '';
    if (handler) handler();
  }

  /* Person anlegen / bearbeiten. `draft` bewahrt Eingaben beim Abstecher
     in die Strategie-Auswahl. */
  function openPersonSheet(existing, draft) {
    const isEdit = !!existing;
    const state = draft || {
      name: isEdit ? existing.name : '',
      context: isEdit ? (existing.context || '') : '',
      strategy: isEdit ? existing.strategy : DEFAULT_STRATEGY,
    };
    openSheet(`
      <h3>${isEdit ? 'Person bearbeiten' : 'Neue Person'}</h3>
      <p class="sub">${isEdit ? 'Name, Kontext und Strategie anpassen.' : 'Mit wem willst du deine Züge im Blick behalten?'}</p>
      <div class="field">
        <label>Name</label>
        <input id="pName" type="text" placeholder="z. B. Tom Müller" value="${esc(state.name)}" enterkeyhint="done" />
      </div>
      <div class="field">
        <label>Kontext <span class="opt">optional</span></label>
        <input id="pContext" type="text" placeholder="z. B. Nachbar · Parkplatz" value="${esc(state.context)}" />
      </div>
      <div class="field">
        <label>Strategie</label>
        <div class="rows">
          <button class="row" id="pStratRow">
            <span class="row-main"><span class="row-title" id="pStratName">${esc(STRATEGIES[state.strategy].name)}</span>\n            <span class="row-sub">${esc(STRATEGIES[state.strategy].tagline)}</span></span>
            <span class="chev">${ICON.chevron()}</span>
          </button>
        </div>
      </div>
      <div class="actions">
        <button class="btn ghost" data-close>Abbrechen</button>
        <button class="btn primary" id="savePerson">${isEdit ? 'Sichern' : 'Anlegen'}</button>
      </div>`);
    const nameInput = document.getElementById('pName');
    setTimeout(() => nameInput.focus(), 80);
    // Aktuelle Eingaben einsammeln, damit sie den Abstecher überleben.
    const readDraft = () => ({
      name: nameInput.value,
      context: document.getElementById('pContext').value,
      strategy: state.strategy,
    });
    document.getElementById('pStratRow').addEventListener('click', () => {
      const current = readDraft();
      pickStrategy(
        state.strategy,
        (sid) => openPersonSheet(existing, { ...current, strategy: sid }),
        () => openPersonSheet(existing, current)
      );
    });
    document.getElementById('savePerson').addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.classList.add('invalid'); nameInput.focus(); return; }
      const context = document.getElementById('pContext').value.trim();
      const strategy = state.strategy;
      if (isEdit) {
        existing.name = name; existing.context = context; existing.strategy = strategy;
        save(); closeSheet(); renderDetail(); renderList();
      } else {
        const p = { id: uid(), name, context, strategy, created: Date.now(), rounds: [] };
        people.push(p); save(); closeSheet(); renderList(); openDetail(p.id);
      }
    });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('savePerson').click(); });
    nameInput.addEventListener('input', () => nameInput.classList.remove('invalid'));
  }

  /* Strategie-Auswahl (Radioliste mit Häkchen) */
  function pickStrategy(current, onPick, onDismiss) {
    const rows = order.map((sid) => {
      const s = STRATEGIES[sid];
      return `<button class="row" data-sid="${sid}">
          <span class="row-main">
            <span class="row-title">${esc(s.name)}</span>
            <span class="row-sub">${esc(s.blurb)}</span>
          </span>
          <span class="row-check" style="${sid === current ? '' : 'visibility:hidden'}">${ICON.check(19)}</span>
        </button>`;
    }).join('');
    openSheet(`
      <h3>Strategie wählen</h3>
      <p class="sub">Empfohlen für den Alltag: Großzügiges Tit for Tat – es verzeiht einen einzelnen Ausrutscher.</p>
      <div class="rows">${rows}</div>
      <div class="actions"><button class="btn ghost wide" data-close>Fertig</button></div>`, onDismiss);
    document.querySelectorAll('[data-sid]').forEach((b) =>
      b.addEventListener('click', () => onPick(b.dataset.sid)));
  }
  function openStrategyPicker(p) {
    pickStrategy(p.strategy, (sid) => {
      p.strategy = sid; save(); closeSheet(); renderDetail(); renderList();
    });
  }

  /* Runden-Editor */
  function distinctTopics() {
    const set = new Set();
    for (const pp of people) for (const r of pp.rounds) if (r.topic && r.topic.trim()) set.add(r.topic.trim());
    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  }
  function toDateInput(ts) {
    const d = new Date(ts), z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  function fromDateInput(v) { const t = Date.parse(`${v}T12:00`); return Number.isNaN(t) ? null : t; }

  function openRoundSheet(personId, roundId, isNew = false) {
    const p = byId(personId); const round = p?.rounds.find((r) => r.id === roundId);
    if (!round) return;
    let move = round.opp;
    const suggestions = distinctTopics().map((t) => `<option value="${esc(t)}"></option>`).join('');
    openSheet(`
      <h3>${isNew ? 'Interaktion ergänzen' : 'Interaktion bearbeiten'}</h3>
      <p class="sub">Alles optional – jederzeit über den Verlauf änderbar.</p>
      <div class="field">
        <label>Verhalten</label>
        <div class="seg" id="reSeg">
          <button type="button" class="${move === 'C' ? 'on' : ''}" data-move="C"><i class="c"></i>War nett</button>
          <button type="button" class="${move === 'D' ? 'on' : ''}" data-move="D"><i class="d"></i>Nicht nett</button>
        </div>
      </div>
      <div class="field">
        <label>Datum</label>
        <input id="reDate" type="date" value="${toDateInput(round.date)}" />
      </div>
      <div class="field">
        <label>Thema <span class="opt">frei eingeben oder wählen</span></label>
        <input id="reTopic" list="topicSuggestions" placeholder="z. B. Projekt-Deadline" value="${esc(round.topic || '')}" autocomplete="off" />
        <datalist id="topicSuggestions">${suggestions}</datalist>
      </div>
      <div class="field">
        <label>Details <span class="opt">optional</span></label>
        <textarea id="reDetails" placeholder="Notizen zu dieser Interaktion…">${esc(round.details || '')}</textarea>
      </div>
      <div class="actions">
        <button class="btn ghost" data-close>${isNew ? 'Überspringen' : 'Abbrechen'}</button>
        <button class="btn primary" id="reSave">Sichern</button>
      </div>
      ${isNew ? '' : `<div class="actions"><button class="btn plain wide" id="reDel" style="color:var(--no-text)">Interaktion löschen</button></div>`}`);
    document.querySelectorAll('#reSeg button').forEach((b) =>
      b.addEventListener('click', () => {
        move = b.dataset.move;
        document.querySelectorAll('#reSeg button').forEach((x) => x.classList.toggle('on', x === b));
      }));
    document.getElementById('reSave').addEventListener('click', () => {
      round.opp = move;
      round.topic = document.getElementById('reTopic').value.trim();
      round.details = document.getElementById('reDetails').value.trim();
      round.date = fromDateInput(document.getElementById('reDate').value) || round.date;
      save(); closeSheet(); renderDetail(); renderList();
    });
    const del = document.getElementById('reDel');
    if (del) del.addEventListener('click', () => { closeSheet(); deleteRound(personId, roundId); renderList(); });
  }

  /* Personen-Menü (⋯ in der Detailansicht) */
  function openPersonMenu(p) {
    openSheet(`
      <h3>${esc(p.name)}</h3>
      <p class="sub">${p.rounds.length} ${p.rounds.length === 1 ? 'Interaktion' : 'Interaktionen'} festgehalten.</p>
      <div class="rows">
        <button class="row" id="mEdit"><span class="row-main"><span class="row-title">Bearbeiten</span></span><span class="chev">${ICON.chevron()}</span></button>
        <button class="row destructive" id="mDel"><span class="row-main"><span class="row-title">Person löschen</span></span></button>
      </div>
      <div class="actions"><button class="btn ghost wide" data-close>Abbrechen</button></div>`);
    document.getElementById('mEdit').addEventListener('click', () => openPersonSheet(p));
    document.getElementById('mDel').addEventListener('click', () => confirmDeletePerson(p.id));
  }

  function confirmDeletePerson(id) {
    const p = byId(id);
    openSheet(`
      <h3>„${esc(p.name)}" löschen?</h3>
      <p class="sub">Die Person und alle ${p.rounds.length} festgehaltenen Interaktionen werden entfernt. Das lässt sich nicht rückgängig machen.</p>
      <div class="actions">
        <button class="btn ghost" data-close>Abbrechen</button>
        <button class="btn danger" id="confirmDel">Löschen</button>
      </div>`);
    document.getElementById('confirmDel').addEventListener('click', () => {
      people = people.filter((x) => x.id !== id);
      save(); closeSheet(); history.back(); renderList();
    });
  }

  /* ---------- Hauptmenü ---------- */
  function openMainMenu() {
    const t = getTheme();
    openSheet(`
      <h3>Gambit</h3>
      <p class="sub">Einstellungen und Hintergrundwissen.</p>

      <div class="field">
        <label>Erscheinungsbild</label>
        <div class="seg" id="themeSeg">
          ${Object.entries(THEMES).map(([k, v]) => `<button type="button" data-theme-opt="${k}" class="${t === k ? 'on' : ''}">${v}</button>`).join('')}
        </div>
      </div>

      <div class="rows" style="margin-top:18px">
        <button class="row" id="mAbout">
          <span class="row-main"><span class="row-title">Über die Strategien</span>
          <span class="row-sub">Wie Tit for Tat und Vergebung funktionieren</span></span>
          <span class="chev">${ICON.chevron()}</span>
        </button>
        <button class="row" id="mData">
          <span class="row-main"><span class="row-title">Daten</span>
          <span class="row-sub">Sicherung erstellen oder einspielen</span></span>
          <span class="chev">${ICON.chevron()}</span>
        </button>
      </div>
      <div class="actions"><button class="btn ghost wide" data-close>Fertig</button></div>`);
    document.querySelectorAll('[data-theme-opt]').forEach((b) =>
      b.addEventListener('click', () => {
        applyTheme(b.dataset.themeOpt);
        document.querySelectorAll('[data-theme-opt]').forEach((x) => x.classList.toggle('on', x === b));
      }));
    document.getElementById('mAbout').addEventListener('click', openAbout);
    document.getElementById('mData').addEventListener('click', openDataSheet);
  }

  function openAbout() {
    const rows = order.map((sid) => {
      const s = STRATEGIES[sid];
      return `<div class="row" style="cursor:default">
        <span class="row-main"><span class="row-title">${esc(s.name)}</span>
        <span class="row-sub">${esc(s.blurb)}</span></span></div>`;
    }).join('');
    openSheet(`
      <h3>Über die Strategien</h3>
      <p class="sub">Jede Person kann eine eigene Strategie nutzen. Der Standard verzeiht einen einzelnen Ausrutscher, damit ein Missverständnis die Kooperation nicht dauerhaft zerstört.</p>
      <div class="rows">${rows}</div>
      <div class="actions"><button class="btn ghost wide" data-close>Fertig</button></div>`);
  }

  function openDataSheet() {
    const rounds = people.reduce((n, p) => n + p.rounds.length, 0);
    openSheet(`
      <h3>Daten</h3>
      <p class="sub">Alles liegt nur auf diesem Gerät: ${people.length} ${people.length === 1 ? 'Person' : 'Personen'}, ${rounds} ${rounds === 1 ? 'Interaktion' : 'Interaktionen'}.</p>
      <div class="rows">
        <button class="row" id="dExport"><span class="row-main"><span class="row-title">Sicherung exportieren</span>
          <span class="row-sub">Als JSON-Datei speichern</span></span><span class="chev">${ICON.chevron()}</span></button>
        <button class="row" id="dImport"><span class="row-main"><span class="row-title">Sicherung importieren</span>
          <span class="row-sub">Ersetzt die aktuellen Daten</span></span><span class="chev">${ICON.chevron()}</span></button>
      </div>
      <div class="actions"><button class="btn ghost wide" data-close>Fertig</button></div>`);
    document.getElementById('dExport').addEventListener('click', exportData);
    document.getElementById('dImport').addEventListener('click', importData);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'gambit', v: 1, people }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gambit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href); closeSheet();
  }
  function importData() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.addEventListener('change', () => {
      const file = inp.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const imported = Array.isArray(data) ? data : data.people;
          if (!Array.isArray(imported)) throw new Error('Ungültig');
          people = imported.map((p) => ({
            id: p.id || uid(), name: p.name || 'Unbenannt', context: p.context || '',
            strategy: STRATEGIES[p.strategy] ? p.strategy : DEFAULT_STRATEGY,
            created: p.created || Date.now(),
            rounds: (p.rounds || []).map((r) => ({
              id: r.id || uid(), opp: r.opp === 'D' ? 'D' : 'C',
              date: r.date || Date.now(), topic: r.topic || '', details: r.details || '',
            })),
          }));
          save(); closeSheet(); renderList();
        } catch { alert('Die Datei konnte nicht gelesen werden.'); }
      };
      reader.readAsText(file);
    });
    inp.click();
  }

  /* ---------- Events ---------- */
  document.getElementById('fab').addEventListener('click', () => openPersonSheet(null));
  document.getElementById('menuBtn').addEventListener('click', openMainMenu);
  document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => openPersonSheet(null)));
  window.addEventListener('popstate', () => { if (!detailView.classList.contains('hidden')) closeDetail(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modalRoot.innerHTML) dismissSheet();
    else if (!detailView.classList.contains('hidden')) history.back();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system');
  });

  // Zoom unterbinden: Pinch-Gesten abfangen (iOS ignoriert user-scalable in Safari).
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) =>
    document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));

  /* ---------- Init ---------- */
  renderList();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
