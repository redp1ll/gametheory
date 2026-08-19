/*
 * Gambit — Spieltheoretische Strategie-Engine
 * ------------------------------------------------------------
 * Moves:  'C' = kooperieren (nett)   'D' = defektieren (nicht kooperieren)
 *
 * Eine Interaktion ("Runde") speichert den Zug des GEGENÜBERS (opp) und
 * optional den eigenen Zug (mine). Ist mine leer, wird der eigene Zug per
 * Replay aus der Strategie abgeleitet: In Runde n habe ich gespielt, was die
 * Strategie aus den Runden 1..n-1 empfohlen hat.
 *
 * Ein abweichend erfasster eigener Zug wirkt sich auf alle folgenden Runden
 * aus, weil Strategien wie Contrite und Pavlov den eigenen letzten Zug lesen:
 * Contrite unterscheidet damit, ob eine Nichtkooperation des anderen eine
 * berechtigte Antwort auf mein eigenes Verhalten war oder ein grundloser
 * Angriff. Ohne diese Angabe fiele die Empfehlung nach einer Abweichung
 * falsch aus.
 */

(function (global) {
  'use strict';

  // Ansehen („standing"): Wer gegenüber einem fairen Gegenüber nicht
  // kooperiert, verliert sein Ansehen und stellt es durch Kooperation wieder
  // her. Eine Nichtkooperation gegen jemanden in schlechtem Ansehen ist eine
  // berechtigte Reaktion und kostet kein Ansehen. Damit erkennt Contrite auch
  // Reaktionen, die erst eine Runde später kommen.
  function standing(oppMoves, myMoves) {
    let ich = true, anderer = true;
    for (let i = 0; i < oppMoves.length; i++) {
      const ichWarGut = ich, andererWarGut = anderer;
      if (myMoves[i] === 'D') { if (andererWarGut) ich = false; } else ich = true;
      if (oppMoves[i] === 'D') { if (ichWarGut) anderer = false; } else anderer = true;
    }
    return { ich, anderer };
  }

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
        if (ctx.oppMoves.length === 0) return 'C';
        // Nur gegen jemanden in schlechtem Ansehen wird nicht kooperiert.
        return standing(ctx.oppMoves, ctx.myMoves).anderer ? 'C' : 'D';
      },
      reason(ctx) {
        const o = ctx.oppMoves;
        if (o.length === 0) return 'Neuer Kontakt – beginne freundlich mit Kooperation.';
        const st = standing(o, ctx.myMoves);
        if (!st.anderer) return 'Er hat grundlos nicht kooperiert, obwohl du fair warst – zieh dich diesmal zurück.';
        if (o[o.length - 1] === 'D') return 'Seine Nichtkooperation war eine berechtigte Reaktion auf dein eigenes Verhalten – mach es wieder gut und kooperiere.';
        if (!st.ich) return 'Du bist zuletzt selbst abgewichen – stell das mit Kooperation wieder her.';
        return 'Der andere hat kooperiert – koopiere zurück.';
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

  // Meine Züge rekonstruieren. ownMoves[i] überschreibt die Ableitung, wenn
  // für diese Runde ein eigener Zug erfasst wurde.
  function replayMyMoves(strategyId, oppMoves, ownMoves) {
    const strat = STRATEGIES[strategyId] || STRATEGIES[DEFAULT_STRATEGY];
    const eigen = ownMoves || [];
    const my = [];
    for (let i = 0; i < oppMoves.length; i++) {
      const ctx = { oppMoves: oppMoves.slice(0, i), myMoves: my.slice(0, i) };
      my.push(eigen[i] === 'C' || eigen[i] === 'D' ? eigen[i] : strat.decide(ctx));
    }
    return my;
  }

  // Empfehlung für den NÄCHSTEN Zug + Begründung.
  function recommend(strategyId, oppMoves, ownMoves) {
    const strat = STRATEGIES[strategyId] || STRATEGIES[DEFAULT_STRATEGY];
    const myMoves = replayMyMoves(strategyId, oppMoves, ownMoves);
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
