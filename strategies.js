/*
 * Gambit — Spieltheoretische Strategie-Engine
 * ------------------------------------------------------------
 * Moves:  'C' = kooperieren (nett)   'D' = defektieren (nicht kooperieren)
 *
 * Eine Interaktion ("Runde") speichert nur den Zug des GEGENÜBERS (opp).
 * Meinen eigenen Zug pro Runde leiten wir per Replay aus der Strategie ab:
 * In Runde n habe ich das gespielt, was die Strategie aus den Runden 1..n-1
 * empfohlen hat. So sind Strategien wie Pavlov / Contrite (die meinen eigenen
 * letzten Zug brauchen) vollständig und konsistent rekonstruierbar.
 */

(function (global) {
  'use strict';

  // Jede Strategie: decide(ctx) -> 'C' | 'D'
  // ctx = { oppMoves: [...], myMoves: [...] }  (beide gleich lang, Historie VOR dieser Runde)
  const STRATEGIES = {
    generous_tft: {
      id: 'generous_tft',
      name: 'Großzügiges Tit for Tat',
      tagline: 'Verzeiht einen einzelnen Ausrutscher',
      blurb:
        'Startet freundlich, spiegelt das Verhalten des anderen – verzeiht aber einen einmaligen Ausrutscher. Erst bei ZWEI Fehltritten hintereinander wird nicht mehr kooperiert. Robust gegen Missverständnisse.',
      decide(ctx) {
        const o = ctx.oppMoves;
        if (o.length === 0) return 'C';
        // Nur bei zwei Defektionen in Folge zurückziehen (Tit for Two Tats).
        if (o.length >= 2 && o[o.length - 1] === 'D' && o[o.length - 2] === 'D') return 'D';
        if (o.length === 1 && o[0] === 'D') return 'C'; // einzelner Ausrutscher -> verzeihen
        return o[o.length - 1] === 'D' ? 'C' : 'C';
      },
      reason(ctx, move) {
        const o = ctx.oppMoves;
        if (o.length === 0) return 'Neuer Kontakt – beginne freundlich mit Kooperation.';
        if (move === 'D') return 'Zwei Mal in Folge nicht kooperiert – das ist kein Ausrutscher mehr. Zieh dich diesmal zurück.';
        if (o[o.length - 1] === 'D') return 'Einmaliger Ausrutscher – verzeih ihn und koopiere weiter, um die Beziehung nicht zu zerstören.';
        return 'Zuletzt war die Zusammenarbeit gut – halte den Kurs und kooperiere.';
      },
    },

    tft: {
      id: 'tft',
      name: 'Tit for Tat',
      tagline: 'Streng · spiegelt jeden letzten Zug',
      blurb:
        'Der Klassiker (Axelrod). Fängt freundlich an und macht danach exakt das, was der andere zuletzt getan hat. Fair und klar – aber unversöhnlich bei einem einzelnen Fehler.',
      decide(ctx) {
        const o = ctx.oppMoves;
        if (o.length === 0) return 'C';
        return o[o.length - 1];
      },
      reason(ctx, move) {
        const o = ctx.oppMoves;
        if (o.length === 0) return 'Neuer Kontakt – beginne freundlich mit Kooperation.';
        return move === 'C'
          ? 'Der andere hat zuletzt kooperiert – spiegle das und kooperiere ebenfalls.'
          : 'Der andere hat zuletzt nicht kooperiert – spiegle das und kooperiere diesmal nicht.';
      },
    },

    contrite_tft: {
      id: 'contrite_tft',
      name: 'Contrite Tit for Tat',
      tagline: 'Empfohlen · erkennt „wer hat angefangen"',
      blurb:
        'Wie Tit for Tat, aber es unterscheidet: Hat der andere dich zu RECHT bestraft (weil du selbst zuletzt nicht kooperiert hast), verzeihst du. Hat er dich GRUNDLOS angegriffen, reagierst du. Verhindert Rache-Schleifen.',
      decide(ctx) {
        const o = ctx.oppMoves, m = ctx.myMoves;
        if (o.length === 0) return 'C';
        const lastOpp = o[o.length - 1];
        if (lastOpp === 'C') return 'C';
        // Gegner hat defektiert: war es eine gerechtfertigte Reaktion auf meinen Fehler?
        const myPrev = m.length ? m[m.length - 1] : 'C';
        if (myPrev === 'D') return 'C'; // gerechtfertigte Strafe -> ich mache es wieder gut
        return 'D'; // grundloser Angriff -> Vergeltung
      },
      reason(ctx, move) {
        const o = ctx.oppMoves, m = ctx.myMoves;
        if (o.length === 0) return 'Neuer Kontakt – beginne freundlich mit Kooperation.';
        const lastOpp = o[o.length - 1];
        if (lastOpp === 'C') return 'Der andere hat kooperiert – koopiere zurück.';
        const myPrev = m.length ? m[m.length - 1] : 'C';
        if (myPrev === 'D') return 'Er hat nicht kooperiert – aber das war eine Reaktion auf DEINEN letzten Zug. Mach es wieder gut und kooperiere.';
        return 'Er hat grundlos nicht kooperiert (obwohl du zuletzt fair warst) – zieh dich diesmal zurück.';
      },
    },

    pavlov: {
      id: 'pavlov',
      name: 'Pavlov (Win-Stay, Lose-Shift)',
      tagline: 'Durchsetzungsstark · „was funktioniert, behalte ich bei"',
      blurb:
        'Behält den letzten eigenen Zug bei, wenn er sich gelohnt hat, und wechselt, wenn nicht. Sehr erfolgreich und lernt, Nachgiebige auszunutzen – aber weniger „fair" als Tit for Tat.',
      decide(ctx) {
        const o = ctx.oppMoves, m = ctx.myMoves;
        if (o.length === 0) return 'C';
        const lastOpp = o[o.length - 1];
        const myPrev = m.length ? m[m.length - 1] : 'C';
        // Win-Stay, Lose-Shift: gleiche Züge = "Erfolg" -> beibehalten, sonst wechseln.
        return myPrev === lastOpp ? myPrev : (myPrev === 'C' ? 'D' : 'C');
      },
      reason(ctx, move) {
        const o = ctx.oppMoves, m = ctx.myMoves;
        if (o.length === 0) return 'Neuer Kontakt – beginne freundlich mit Kooperation.';
        const lastOpp = o[o.length - 1];
        const myPrev = m.length ? m[m.length - 1] : 'C';
        if (myPrev === lastOpp) return 'Die letzte Runde lief für dich passend – behalte deinen bewährten Zug bei.';
        return 'Die letzte Runde lief nicht gut – wechsle deine Strategie.';
      },
    },

    grim: {
      id: 'grim',
      name: 'Grim Trigger',
      tagline: 'Kompromisslos · ein Verrat = für immer Schluss',
      blurb:
        'Kooperiert, solange der andere kooperiert. Ein einziger Vertrauensbruch – und danach nie wieder Kooperation. Maximale Abschreckung, null Vergebung. Für Situationen, in denen Vertrauen absolut ist.',
      decide(ctx) {
        return ctx.oppMoves.includes('D') ? 'D' : 'C';
      },
      reason(ctx, move) {
        if (ctx.oppMoves.length === 0) return 'Neuer Kontakt – beginne freundlich mit Kooperation.';
        return move === 'D'
          ? 'Es gab (mindestens) einen Vertrauensbruch – nach dieser Strategie ist das Vertrauen dauerhaft aufgekündigt.'
          : 'Bisher lückenlos kooperativ – halte das Vertrauen aufrecht.';
      },
    },
  };

  const DEFAULT_STRATEGY = 'contrite_tft';

  // Meine Züge per Replay rekonstruieren (myMove[n] = Empfehlung aus 0..n-1).
  function replayMyMoves(strategyId, oppMoves) {
    const strat = STRATEGIES[strategyId] || STRATEGIES[DEFAULT_STRATEGY];
    const my = [];
    for (let i = 0; i < oppMoves.length; i++) {
      const ctx = { oppMoves: oppMoves.slice(0, i), myMoves: my.slice(0, i) };
      my.push(strat.decide(ctx));
    }
    return my;
  }

  // Empfehlung für den NÄCHSTEN Zug + Begründung.
  function recommend(strategyId, oppMoves) {
    const strat = STRATEGIES[strategyId] || STRATEGIES[DEFAULT_STRATEGY];
    const myMoves = replayMyMoves(strategyId, oppMoves);
    const ctx = { oppMoves: oppMoves.slice(), myMoves };
    const move = strat.decide(ctx);
    const reason = strat.reason(ctx, move);
    return { move, reason, strategy: strat };
  }

  global.Gambit = {
    STRATEGIES,
    DEFAULT_STRATEGY,
    order: ['contrite_tft', 'generous_tft', 'tft', 'pavlov', 'grim'],
    recommend,
    replayMyMoves,
  };
})(window);
