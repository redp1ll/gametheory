/* ============================================================
   Gambit — Anmeldung und Datenzugriff (Supabase)
   ------------------------------------------------------------
   Die Zugangsdaten hier sind bewusst oeffentlich: Der publizierbare
   Schluessel erlaubt fuer sich genommen keinen Datenzugriff. Wer welche
   Zeilen sehen darf, entscheidet die Datenbank ueber Row Level Security –
   jeder Nutzer sieht ausschliesslich die eigenen Eintraege.
   ============================================================ */
(function (global) {
  'use strict';

  const CONFIG = {
    url: 'https://jgesyifystdkjpbihgac.supabase.co',
    key: 'sb_publishable_I_z3bNwdEL10ara3VW0nGg_3qdh7xUH',
  };
  const CACHE_KEY = 'gambit.cache.v1';
  const LEGACY_KEY = 'gambit.people.v1';

  const client = global.supabase.createClient(CONFIG.url, CONFIG.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  /* ---------- Umrechnung Datenbank <-> App ---------- */
  // In der Datenbank steht ein reines Datum; in der App ein Zeitstempel
  // (12 Uhr mittags, damit Zeitzonen das Datum nie verschieben).
  function dateToMs(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  }
  function msToDate(ms) {
    const d = new Date(ms), z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  function toApp(person, rounds) {
    return {
      id: person.id,
      name: person.name,
      context: person.context || '',
      strategy: person.strategy,
      created: new Date(person.created_at).getTime(),
      rounds: (rounds || []).map((r) => ({
        id: r.id, opp: r.opp, date: dateToMs(r.occurred_on), seq: r.created_at,
        topic: r.topic || '', details: r.details || '',
      })),
    };
  }
  // Runden chronologisch: nach Datum, bei gleichem Datum nach Erfassung.
  const byTime = (a, b) =>
    (a.occurred_on < b.occurred_on ? -1 : a.occurred_on > b.occurred_on ? 1 : 0) ||
    (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);

  /* ---------- Zustand ---------- */
  const state = { user: null, people: [], ready: false };

  function cache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state.people)); } catch { /* Speicher voll */ }
  }
  function readCache() {
    try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  }

  /* ---------- Anmeldung ---------- */
  async function currentUser() {
    const { data } = await client.auth.getSession();
    state.user = data.session?.user || null;
    return state.user;
  }
  function onAuthChange(fn) {
    client.auth.onAuthStateChange((_event, session) => {
      state.user = session?.user || null;
      fn(state.user);
    });
  }
  function redirectTo() {
    return location.origin + location.pathname;
  }
  // Anmeldung per E-Mail: Es geht eine Nachricht mit Link UND Code raus.
  // Der Link ist bequem am Rechner; der Code funktioniert auch dann, wenn
  // die App auf dem Startbildschirm liegt und der Link in einem anderen
  // Browser aufgehen wuerde.
  async function requestEmailCode(email) {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
    });
    if (error) throw error;
  }
  async function verifyEmailCode(email, token) {
    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
    state.user = data.user;
    return data.user;
  }
  async function signOut() {
    await client.auth.signOut();
    state.people = [];
    try { localStorage.removeItem(CACHE_KEY); } catch { /* egal */ }
  }

  /* ---------- Laden ---------- */
  async function loadAll() {
    const [pRes, rRes] = await Promise.all([
      client.from('people').select('*').order('created_at', { ascending: true }),
      client.from('rounds').select('*'),
    ]);
    if (pRes.error) throw pRes.error;
    if (rRes.error) throw rRes.error;

    const byPerson = new Map();
    for (const r of rRes.data) {
      if (!byPerson.has(r.person_id)) byPerson.set(r.person_id, []);
      byPerson.get(r.person_id).push(r);
    }
    state.people = pRes.data.map((p) => toApp(p, (byPerson.get(p.id) || []).sort(byTime)));
    state.ready = true;
    cache();
    return state.people;
  }

  /* ---------- Schreiben ---------- */
  async function addPerson({ name, context, strategy }) {
    const { data, error } = await client.from('people')
      .insert({ user_id: state.user.id, name, context, strategy })
      .select().single();
    if (error) throw error;
    const person = toApp(data, []);
    state.people.push(person);
    cache();
    return person;
  }
  async function updatePerson(id, patch) {
    const { error } = await client.from('people')
      .update({ name: patch.name, context: patch.context, strategy: patch.strategy })
      .eq('id', id);
    if (error) throw error;
    Object.assign(state.people.find((p) => p.id === id) || {}, patch);
    cache();
  }
  async function deletePerson(id) {
    const { error } = await client.from('people').delete().eq('id', id);
    if (error) throw error;
    state.people = state.people.filter((p) => p.id !== id);
    cache();
  }
  async function addRound(personId, { opp, date, topic, details }) {
    const { data, error } = await client.from('rounds')
      .insert({
        user_id: state.user.id, person_id: personId, opp,
        occurred_on: msToDate(date || Date.now()), topic: topic || '', details: details || '',
      })
      .select().single();
    if (error) throw error;
    const person = state.people.find((p) => p.id === personId);
    const round = {
      id: data.id, opp: data.opp, date: dateToMs(data.occurred_on), seq: data.created_at,
      topic: data.topic, details: data.details,
    };
    if (person) { person.rounds.push(round); sortRounds(person); }
    cache();
    return round;
  }
  async function updateRound(personId, roundId, patch) {
    const { error } = await client.from('rounds')
      .update({
        opp: patch.opp, occurred_on: msToDate(patch.date),
        topic: patch.topic || '', details: patch.details || '',
      })
      .eq('id', roundId);
    if (error) throw error;
    const person = state.people.find((p) => p.id === personId);
    const round = person?.rounds.find((r) => r.id === roundId);
    if (round) { Object.assign(round, patch); sortRounds(person); }
    cache();
  }
  async function deleteRound(personId, roundId) {
    const { error } = await client.from('rounds').delete().eq('id', roundId);
    if (error) throw error;
    const person = state.people.find((p) => p.id === personId);
    if (person) person.rounds = person.rounds.filter((r) => r.id !== roundId);
    cache();
  }
  // Chronologisch: nach Tag, bei gleichem Tag nach Erfassungszeitpunkt.
  function sortRounds(person) {
    person.rounds.sort((a, b) =>
      (a.date - b.date) || (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
  }

  /* ---------- Uebernahme aelterer Geraetedaten ---------- */
  function legacyData() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) && list.length ? list : null;
    } catch { return null; }
  }
  async function importLegacy(list) {
    for (const p of list) {
      const person = await addPerson({
        name: p.name || 'Unbenannt',
        context: p.context || '',
        strategy: p.strategy || 'generous_tft',
      });
      for (const r of (p.rounds || [])) {
        await addRound(person.id, {
          opp: r.opp === 'D' ? 'D' : 'C',
          date: r.date || Date.now(),
          topic: r.topic || '', details: r.details || '',
        });
      }
    }
    localStorage.setItem(LEGACY_KEY + '.imported', String(Date.now()));
    localStorage.removeItem(LEGACY_KEY);
  }
  function discardLegacy() { localStorage.removeItem(LEGACY_KEY); }

  /* ---------- Sicherung ---------- */
  async function importBackup(list) {
    // Ersetzt den kompletten Bestand.
    for (const p of [...state.people]) await deletePerson(p.id);
    await importLegacy(list);
  }

  global.GambitStore = {
    client, state,
    currentUser, onAuthChange, requestEmailCode, verifyEmailCode, signOut,
    loadAll,
    addPerson, updatePerson, deletePerson,
    addRound, updateRound, deleteRound,
    legacyData, importLegacy, discardLegacy, importBackup,
    readCache,
    get people() { return state.people; },
    set people(v) { state.people = v; },
  };
})(window);
