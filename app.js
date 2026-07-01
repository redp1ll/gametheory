/* ============================================================
   Gambit — App-Logik (Vanilla JS, localStorage, kein Build)
   ============================================================ */
(function () {
  'use strict';
  const { STRATEGIES, DEFAULT_STRATEGY, order, recommend } = window.Gambit;
  const STORE_KEY = 'gambit.people.v1';

  /* ---------- State & Persistenz ---------- */
  let people = load();
  let currentId = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(people));
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function byId(id) { return people.find((p) => p.id === id); }

  /* ---------- Helfer ---------- */
  const AVATAR_COLORS = ['#4f46e5','#0891b2','#16a34a','#d97706','#db2777','#7c3aed','#dc2626','#0d9488','#4338ca','#ca8a04'];
  function avatarColor(name) {
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function initials(name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    const today = new Date(); const y = new Date(Date.now() - 864e5);
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, today)) return 'Heute';
    if (same(d, y)) return 'Gestern';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function esc(s) { return (s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function firstName(name) { return name.trim().split(/\s+/)[0] || name; }
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  // Zweizeiliges Spielverlauf-Raster (à la "Evolution of Trust"):
  // obere Reihe = meine (per Strategie rekonstruierten) Züge, untere = die der Person.
  function buildMatchGrid(p) {
    const opp = p.rounds.map((r) => r.opp);
    if (!opp.length) {
      return '<div class="match-empty">Noch keine Runden gespielt – dokumentiere oben die erste Interaktion.</div>';
    }
    const my = window.Gambit.replayMyMoves(p.strategy, opp);
    // Meine (abgeleiteten) Züge: nicht tippbar, da rechnerisch bestimmt.
    const myCell = (m) => `<div class="mcell"><span class="mdot ${m === 'C' ? 'c' : 'd'}" title="${m === 'C' ? 'kooperiert' : 'nicht kooperiert'}"></span></div>`;
    // Züge der Person: tippbar, um Datum/Thema/Details zu erfassen.
    const oppCell = (m, r) => {
      const noted = (r.topic || r.details) ? ' noted' : '';
      return `<div class="mcell tappable${noted}" data-round="${r.id}" title="Tippen zum Bearbeiten"><span class="mdot ${m === 'C' ? 'c' : 'd'}"></span></div>`;
    };
    const nums = opp.map((_, i) => `<div class="mcell mnum">${i + 1}</div>`).join('');
    return `
      <div class="match-scroll" id="matchScroll">
        <div class="match-grid">
          <div class="mrow mrow-num"><div class="mlabel"></div><div class="mcells">${nums}</div></div>
          <div class="mrow"><div class="mlabel">Ich</div><div class="mcells">${my.map(myCell).join('')}</div></div>
          <div class="mrow"><div class="mlabel" style="color:${avatarColor(p.name)}">${esc(firstName(p.name))}</div><div class="mcells">${opp.map((m, i) => oppCell(m, p.rounds[i])).join('')}</div></div>
        </div>
      </div>
      <div class="match-legend"><span class="gdot sm c"></span> kooperiert · <span class="gdot sm d"></span> nicht kooperiert · Runde 1 links, neueste rechts →<br><span style="opacity:.8">Tippe einen Kreis in der Reihe „${esc(firstName(p.name))}", um Datum, Thema &amp; Details zu erfassen. Reihe „Ich" = von der Strategie geratene Züge.</span></div>`;
  }

  /* ---------- Rendering: Liste ---------- */
  const listView = document.getElementById('listView');
  const peopleList = document.getElementById('peopleList');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('search');

  function renderList() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = people
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.context || '').toLowerCase().includes(q))
      .sort((a, b) => (b.rounds.at(-1)?.date || b.created) - (a.rounds.at(-1)?.date || a.created));

    peopleList.innerHTML = '';
    if (people.length === 0) { emptyState.classList.remove('hidden'); peopleList.classList.add('hidden'); return; }
    emptyState.classList.add('hidden'); peopleList.classList.remove('hidden');

    for (const p of filtered) {
      const opp = p.rounds.map((r) => r.opp);
      const rec = recommend(p.strategy, opp);
      const recentDots = opp.slice(-8).map((m) => `<span class="dot ${m === 'C' ? 'c' : 'd'}"></span>`).join('') || '<span class="dot"></span>';
      const card = el(`
        <li class="person-card" data-id="${p.id}">
          <div class="avatar" style="background:${avatarColor(p.name)}">${esc(initials(p.name))}</div>
          <div class="p-main">
            <div class="p-name">${esc(p.name)}</div>
            ${p.context ? `<div class="p-context">${esc(p.context)}</div>` : ''}
            <div class="dots">${recentDots}</div>
          </div>
          <div class="rec-pill ${rec.move === 'C' ? 'c' : 'd'}">
            <span class="rp-label">Dein nächster Zug</span>
            <span class="rp-move">${rec.move === 'C' ? 'Kooperieren' : 'Nicht kooperieren'}</span>
          </div>
        </li>`);
      card.addEventListener('click', () => openDetail(p.id));
      peopleList.appendChild(card);
    }
  }
  searchInput.addEventListener('input', renderList);

  /* ---------- Rendering: Detail ---------- */
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
    const rate = opp.length ? Math.round((coops / opp.length) * 100) : '—';
    const streak = currentStreak(opp);

    const stratOptions = order.map((sid) => {
      const s = STRATEGIES[sid];
      return `<option value="${sid}" ${sid === p.strategy ? 'selected' : ''}>${s.name}</option>`;
    }).join('');

    const timeline = p.rounds.length
      ? [...p.rounds].reverse().map((r) => `
          <li class="tl-item tappable" data-round="${r.id}">
            <div class="tl-badge ${r.opp === 'C' ? 'c' : 'd'}"><span class="gdot md ${r.opp === 'C' ? 'c' : 'd'}"></span></div>
            <div class="tl-body">
              <div class="tl-title ${r.opp === 'C' ? 'c' : 'd'}">${r.opp === 'C' ? 'War nett · kooperiert' : 'War nicht nett · nicht kooperiert'}</div>
              ${r.topic ? `<div class="tl-topic">${esc(r.topic)}</div>` : ''}
              ${r.details ? `<div class="tl-details">${esc(r.details)}</div>` : ''}
              <div class="tl-meta">${fmtDate(r.date)}</div>
            </div>
            <button class="tl-del" data-del="${r.id}" title="Löschen">✕</button>
          </li>`).join('')
      : '<div class="tl-empty">Noch keine Interaktion dokumentiert.</div>';

    detailView.innerHTML = `
      <div class="detail-bar">
        <button class="back-btn" id="backBtn">‹ Zurück</button>
        <button class="icon-btn" id="editBtn" title="Bearbeiten">✎</button>
      </div>
      <div class="detail-inner">
        <div class="detail-hero">
          <div class="avatar" style="background:${avatarColor(p.name)}">${esc(initials(p.name))}</div>
          <div>
            <h2>${esc(p.name)}</h2>
            ${p.context ? `<div class="p-context">${esc(p.context)}</div>` : ''}
          </div>
        </div>

        <div class="rec-panel ${rec.move === 'C' ? 'c' : 'd'}">
          <div class="rec-eyebrow">Empfehlung · ${esc(rec.strategy.name)}</div>
          <div class="rec-move">
            <span class="gdot lg ${rec.move === 'C' ? 'c' : 'd'}"></span>
            <span class="rm-text">${rec.move === 'C' ? 'Kooperieren' : 'Nicht kooperieren'}</span>
          </div>
          <div class="rec-reason">${esc(rec.reason)}</div>
        </div>

        <div class="section-title">Letzte Interaktion dokumentieren</div>
        <div class="log-row">
          <button class="log-btn c" data-log="C"><span class="gdot lg c"></span> War nett<br>(kooperiert)</button>
          <button class="log-btn d" data-log="D"><span class="gdot lg d"></span> War nicht nett<br>(nicht kooperiert)</button>
        </div>
        <div class="log-hint">Danach kannst du Datum, Thema &amp; Details ergänzen.</div>

        <div class="section-title">Spielverlauf</div>
        ${buildMatchGrid(p)}

        <div class="stats">
          <div class="stat"><div class="s-val">${opp.length}</div><div class="s-lbl">Interaktionen</div></div>
          <div class="stat"><div class="s-val">${rate === '—' ? '—' : rate + '%'}</div><div class="s-lbl">Koop.-Quote</div></div>
          <div class="stat"><div class="s-val">${streak.move ? `${streak.count}× <span class="gdot sm ${streak.move === 'C' ? 'c' : 'd'}"></span>` : '—'}</div><div class="s-lbl">Aktuelle Serie</div></div>
        </div>

        <div class="section-title">Strategie</div>
        <div class="strat-select-wrap">
          <select class="strat-select" id="stratSelect">${stratOptions}</select>
        </div>
        <div class="strat-blurb">${esc(STRATEGIES[p.strategy].blurb)}</div>

        <div class="section-title">Einzelheiten & Themen</div>
        <ul class="timeline">${timeline}</ul>

        <div class="danger-zone">
          <button class="btn-text-danger" id="deletePersonBtn">Person löschen</button>
        </div>
      </div>`;

    detailView.querySelector('#backBtn').addEventListener('click', () => history.back());
    detailView.querySelector('#editBtn').addEventListener('click', () => openPersonModal(p));
    detailView.querySelectorAll('[data-log]').forEach((b) =>
      b.addEventListener('click', () => logInteraction(p.id, b.dataset.log)));
    detailView.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', (e) => { e.stopPropagation(); deleteRound(p.id, b.dataset.del); }));
    // Antippbare Kreise & Verlaufseinträge öffnen den Runden-Editor.
    detailView.querySelectorAll('.tappable[data-round]').forEach((c) =>
      c.addEventListener('click', () => openRoundEditor(p.id, c.dataset.round)));
    detailView.querySelector('#stratSelect').addEventListener('change', (e) => {
      p.strategy = e.target.value; save(); renderDetail();
    });
    detailView.querySelector('#deletePersonBtn').addEventListener('click', () => confirmDeletePerson(p.id));

    // Spielverlauf zur neuesten Runde (rechts) scrollen (nach Layout/Sichtbarkeit).
    requestAnimationFrame(() => {
      const scroll = detailView.querySelector('#matchScroll');
      if (scroll) scroll.scrollLeft = scroll.scrollWidth;
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
    const p = byId(id);
    if (!p) return;
    const round = { id: uid(), opp: move, date: Date.now(), topic: '', details: '' };
    p.rounds.push(round);
    save();
    renderDetail();
    // Direkt Datum/Thema/Details ergänzen (optional).
    openRoundEditor(id, round.id, true);
  }

  function deleteRound(id, roundId) {
    const p = byId(id);
    if (!p) return;
    p.rounds = p.rounds.filter((r) => r.id !== roundId);
    save(); renderDetail();
  }

  function confirmDeletePerson(id) {
    const p = byId(id);
    openModal(`
      <h3>Person löschen?</h3>
      <p class="modal-sub">„${esc(p.name)}" und alle ${p.rounds.length} dokumentierten Interaktionen werden entfernt. Das kann nicht rückgängig gemacht werden.</p>
      <div class="modal-actions">
        <button class="btn ghost" data-close>Abbrechen</button>
        <button class="btn primary" style="background:var(--red)" id="confirmDel">Löschen</button>
      </div>`);
    document.getElementById('confirmDel').addEventListener('click', () => {
      people = people.filter((x) => x.id !== id);
      save(); closeModal(); history.back(); renderList();
    });
  }

  /* ---------- Modals ---------- */
  const modalRoot = document.getElementById('modalRoot');
  function openModal(inner) {
    const overlay = el(`<div class="modal-overlay"><div class="modal">${inner}</div></div>`);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    modalRoot.appendChild(overlay);
    return overlay;
  }
  function closeModal() { modalRoot.innerHTML = ''; }

  function openPersonModal(existing) {
    const isEdit = !!existing;
    const stratOptions = order.map((sid) => {
      const s = STRATEGIES[sid];
      const sel = (isEdit ? existing.strategy : DEFAULT_STRATEGY) === sid ? 'selected' : '';
      return `<option value="${sid}" ${sel}>${s.name}</option>`;
    }).join('');
    openModal(`
      <h3>${isEdit ? 'Person bearbeiten' : 'Neue Person'}</h3>
      <p class="modal-sub">${isEdit ? 'Ändere Name, Kontext oder Strategie.' : 'Mit wem willst du deine Züge im Blick behalten?'}</p>
      <div class="field">
        <label>Name</label>
        <input id="pName" type="text" placeholder="z. B. Tom Müller" value="${isEdit ? esc(existing.name) : ''}" />
      </div>
      <div class="field">
        <label>Kontext <span style="font-weight:400;color:var(--text-faint)">(optional)</span></label>
        <input id="pContext" type="text" placeholder="z. B. Nachbar · Streit um Parkplatz" value="${isEdit ? esc(existing.context || '') : ''}" />
      </div>
      <div class="field">
        <label>Strategie</label>
        <select id="pStrat">${stratOptions}</select>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" data-close>Abbrechen</button>
        <button class="btn primary" id="savePerson">${isEdit ? 'Speichern' : 'Anlegen'}</button>
      </div>`);
    const nameInput = document.getElementById('pName');
    setTimeout(() => nameInput.focus(), 50);
    document.getElementById('savePerson').addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); nameInput.style.borderColor = 'var(--red)'; return; }
      const context = document.getElementById('pContext').value.trim();
      const strategy = document.getElementById('pStrat').value;
      if (isEdit) {
        existing.name = name; existing.context = context; existing.strategy = strategy;
        save(); closeModal(); renderDetail(); renderList();
      } else {
        const p = { id: uid(), name, context, strategy, created: Date.now(), rounds: [] };
        people.push(p); save(); closeModal(); renderList(); openDetail(p.id);
      }
    });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('savePerson').click(); });
  }

  // Alle bisher verwendeten Themen (über alle Personen) als Vorschläge sammeln.
  function distinctTopics() {
    const set = new Set();
    for (const pp of people) for (const r of pp.rounds) if (r.topic && r.topic.trim()) set.add(r.topic.trim());
    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  }
  // Timestamp <-> <input type="date"> (nur Datum, ohne Uhrzeit)
  function toDateInput(ts) {
    const d = new Date(ts); const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function fromDateInput(v) { const t = Date.parse(`${v}T12:00`); return Number.isNaN(t) ? null : t; }

  // Runden-Editor: Verhalten, Datum, Thema (Freitext + Vorschläge), Details.
  function openRoundEditor(personId, roundId, isNew = false) {
    const p = byId(personId); const round = p?.rounds.find((r) => r.id === roundId);
    if (!round) return;
    let move = round.opp;
    const suggestions = distinctTopics().map((t) => `<option value="${esc(t)}"></option>`).join('');
    openModal(`
      <h3>${isNew ? 'Interaktion ergänzen' : 'Interaktion bearbeiten'}</h3>
      <p class="modal-sub">Alles optional – jederzeit über den Kreis änderbar.</p>
      <div class="field">
        <label>Verhalten</label>
        <div class="seg" id="reSeg">
          <button type="button" class="seg-btn c ${move === 'C' ? 'active' : ''}" data-move="C"><span class="gdot sm c"></span> War nett</button>
          <button type="button" class="seg-btn d ${move === 'D' ? 'active' : ''}" data-move="D"><span class="gdot sm d"></span> Nicht nett</button>
        </div>
      </div>
      <div class="field">
        <label>Datum</label>
        <input id="reDate" type="date" value="${toDateInput(round.date)}" />
      </div>
      <div class="field">
        <label>Thema <span style="font-weight:400;color:var(--text-faint)">(frei eingeben oder wählen)</span></label>
        <input id="reTopic" list="topicSuggestions" placeholder="z. B. Projekt-Deadline, Rückzahlung…" value="${esc(round.topic || '')}" autocomplete="off" />
        <datalist id="topicSuggestions">${suggestions}</datalist>
      </div>
      <div class="field">
        <label>Details <span style="font-weight:400;color:var(--text-faint)">(optional)</span></label>
        <textarea id="reDetails" placeholder="Notizen zu dieser Interaktion…">${esc(round.details || '')}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" data-close>${isNew ? 'Überspringen' : 'Abbrechen'}</button>
        <button class="btn primary" id="reSave">Speichern</button>
      </div>`);
    document.querySelectorAll('#reSeg .seg-btn').forEach((b) =>
      b.addEventListener('click', () => {
        move = b.dataset.move;
        document.querySelectorAll('#reSeg .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      }));
    const topicInput = document.getElementById('reTopic');
    setTimeout(() => topicInput.focus(), 50);
    document.getElementById('reSave').addEventListener('click', () => {
      round.opp = move;
      round.topic = topicInput.value.trim();
      round.details = document.getElementById('reDetails').value.trim();
      round.date = fromDateInput(document.getElementById('reDate').value) || round.date;
      save(); closeModal(); renderDetail();
    });
  }

  function openMenuModal() {
    openModal(`
      <h3>Menü</h3>
      <ul class="menu-list">
        <li id="mExport">Daten exportieren (JSON)</li>
        <li id="mImport">Daten importieren (JSON)</li>
        <li id="mAbout">Über die Strategien</li>
      </ul>
      <div class="modal-actions"><button class="btn ghost" data-close style="flex:1">Schließen</button></div>`);
    document.getElementById('mExport').addEventListener('click', exportData);
    document.getElementById('mImport').addEventListener('click', importData);
    document.getElementById('mAbout').addEventListener('click', openAbout);
  }

  function openAbout() {
    const rows = order.map((sid) => {
      const s = STRATEGIES[sid];
      return `<div style="margin-bottom:14px"><strong>${esc(s.name)}</strong><br><span style="font-size:13px;color:var(--text-soft)">${esc(s.blurb)}</span></div>`;
    }).join('');
    openModal(`
      <h3>Über die Strategien</h3>
      <p class="modal-sub">Jede Person kann eine eigene Strategie nutzen. Empfohlen für den Alltag: Großzügiges Tit for Tat.</p>
      <div style="max-height:52vh;overflow:auto">${rows}</div>
      <div class="modal-actions"><button class="btn ghost" data-close style="flex:1">Schließen</button></div>`);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'gambit', v: 1, people }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gambit-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href); closeModal();
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
            rounds: (p.rounds || []).map((r) => ({ id: r.id || uid(), opp: r.opp === 'D' ? 'D' : 'C', date: r.date || Date.now(), topic: r.topic || '', details: r.details || '' })),
          }));
          save(); closeModal(); renderList();
        } catch { alert('Datei konnte nicht gelesen werden.'); }
      };
      reader.readAsText(file);
    });
    inp.click();
  }

  /* ---------- Events ---------- */
  document.getElementById('fab').addEventListener('click', () => openPersonModal(null));
  document.getElementById('menuBtn').addEventListener('click', openMenuModal);
  document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => openPersonModal(null)));
  window.addEventListener('popstate', () => { if (!detailView.classList.contains('hidden')) closeDetail(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (modalRoot.innerHTML) closeModal(); else if (!detailView.classList.contains('hidden')) history.back(); }
  });

  /* ---------- Init ---------- */
  renderList();

  // Offline-Fähigkeit / Installierbarkeit (nur wenn über http/https ausgeliefert).
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
