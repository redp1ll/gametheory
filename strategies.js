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
        'Spiegelt das Verhalten des anderen, verzeiht aber einen einmaligen Ausrutscher. Erst zwei Fehltritte in Folge beenden die Kooperation. Robust gegen Missverständnisse.',
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
        if (o.length === 0) return 'Neuer Kontakt. Beginne freundlich.';
        if (move === 'D') return 'Zwei Mal in Folge nicht kooperiert. Kein Ausrutscher mehr, zieh dich zurück.';
        if (o[o.length - 1] === 'D') return 'Einmaliger Ausrutscher. Verzeih ihn und kooperiere weiter.';
        return 'Zuletzt lief es gut. Halte den Kurs.';
      },
    },

    tft: {
      id: 'tft',
      name: 'Tit for Tat',
      tagline: 'Streng, spiegelt den letzten Zug',
      blurb:
        'Der Klassiker von Axelrod. Macht genau das, was der andere zuletzt getan hat. Fair und klar, aber unversöhnlich bei einem einzelnen Fehler.',
      decide(ctx) {
        const o = ctx.oppMoves;
        if (o.length === 0) return 'C';
        return o[o.length - 1];
      },
      reason(ctx, move) {
        const o = ctx.oppMoves;
        if (o.length === 0) return 'Neuer Kontakt. Beginne freundlich.';
        return move === 'C'
          ? 'Der andere hat kooperiert. Spiegle das.'
          : 'Der andere hat nicht kooperiert. Spiegle das.';
      },
    },

    contrite_tft: {
      id: 'contrite_tft',
      name: 'Contrite Tit for Tat',
      tagline: 'Empfohlen, erkennt wer angefangen hat',
      blurb:
        'Wie Tit for Tat, aber mit Unterschied: Hat der andere dich zu Recht bestraft, verzeihst du. War der Angriff grundlos, reagierst du. Verhindert Rache-Schleifen.',
      decide(ctx) {
        if (ctx.oppMoves.length === 0) return 'C';
        // Nur gegen jemanden in schlechtem Ansehen wird nicht kooperiert.
        return standing(ctx.oppMoves, ctx.myMoves).anderer ? 'C' : 'D';
      },
      reason(ctx) {
        const o = ctx.oppMoves;
        if (o.length === 0) return 'Neuer Kontakt. Beginne freundlich.';
        const st = standing(o, ctx.myMoves);
        if (!st.anderer) return 'Er hat grundlos nicht kooperiert, obwohl du fair warst. Zieh dich zurück.';
        if (o[o.length - 1] === 'D') return 'Seine Nichtkooperation war eine berechtigte Reaktion. Mach es wieder gut.';
        if (!st.ich) return 'Du bist zuletzt abgewichen. Stell es mit Kooperation wieder her.';
        return 'Der andere hat kooperiert. Kooperiere zurück.';
      },
    },

    pavlov: {
      id: 'pavlov',
      name: 'Pavlov (Win-Stay, Lose-Shift)',
      tagline: 'Behält bei, was funktioniert',
      blurb:
        'Behält den eigenen Zug bei, wenn er sich gelohnt hat, und wechselt sonst. Sehr erfolgreich, nutzt Nachgiebige aber aus.',
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
        if (o.length === 0) return 'Neuer Kontakt. Beginne freundlich.';
        const lastOpp = o[o.length - 1];
        const myPrev = m.length ? m[m.length - 1] : 'C';
        if (myPrev === lastOpp) return 'Die letzte Runde lief gut. Behalte deinen Zug bei.';
        return 'Die letzte Runde lief nicht gut. Wechsle den Zug.';
      },
    },

    grim: {
      id: 'grim',
      name: 'Grim Trigger',
      tagline: 'Ein Verrat beendet alles',
      blurb:
        'Kooperiert, solange der andere kooperiert. Ein einziger Vertrauensbruch beendet das für immer. Maximale Abschreckung, null Vergebung.',
      decide(ctx) {
        return ctx.oppMoves.includes('D') ? 'D' : 'C';
      },
      reason(ctx, move) {
        if (ctx.oppMoves.length === 0) return 'Neuer Kontakt. Beginne freundlich.';
        return move === 'D'
          ? 'Es gab einen Vertrauensbruch. Das Vertrauen ist dauerhaft aufgekündigt.'
          : 'Bisher lückenlos kooperativ. Halte das Vertrauen aufrecht.';
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
