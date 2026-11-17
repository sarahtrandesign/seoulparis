/* FSRS-4.5 scheduler (Free Spaced Repetition Scheduler), default weights.
   Each learned item is a "card": { s: stability (days), d: difficulty 1-10, due: ms, last: ms,
   reps, lapses, state: 'review' | 'relearn' }. Ratings: 1 again, 2 hard, 3 good, 4 easy.
   Requested retention is 0.9, so a card's interval equals its stability. */
(function () {
  var W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461,
           2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  var DECAY = -0.5, FACTOR = 19 / 81, RETENTION = 0.9, DAY = 86400000, RELEARN_MS = 10 * 60000;

  function clampD(d) { return Math.min(10, Math.max(1, d)); }
  function initD(g) { return clampD(W[4] - (g - 3) * W[5]); }
  function retrievability(elapsedDays, s) { return Math.pow(1 + FACTOR * elapsedDays / s, DECAY); }
  function intervalDays(s) {
    var i = s / FACTOR * (Math.pow(RETENTION, 1 / DECAY) - 1);
    return Math.min(3650, Math.max(1, Math.round(i)));
  }

  function review(card, g, now) {
    now = now || Date.now();
    var c = card ? Object.assign({}, card) : null;
    if (!c) {
      c = { s: W[g - 1], d: initD(g), reps: 1, lapses: g === 1 ? 1 : 0, last: now };
    } else {
      var elapsed = Math.max(0, (now - c.last) / DAY);
      var r = retrievability(elapsed, c.s);
      var d0 = c.d;
      if (g === 1) {
        c.s = Math.min(c.s, W[11] * Math.pow(d0, -W[12]) * (Math.pow(c.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
        c.lapses = (c.lapses || 0) + 1;
      } else if (elapsed < 0.5) {
        // Same-day repeat (a relearn step): nudge stability without a full review.
        c.s = c.s * (g === 2 ? 1 : g === 3 ? 1.2 : 1.5);
      } else {
        c.s = c.s * (Math.exp(W[8]) * (11 - d0) * Math.pow(c.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) *
                     (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1) + 1);
      }
      var dNext = d0 - W[6] * (g - 3);
      c.d = clampD(W[7] * initD(4) + (1 - W[7]) * dNext);
      c.reps = (c.reps || 0) + 1;
      c.last = now;
    }
    c.s = Math.max(0.1, c.s);
    if (g === 1) { c.state = 'relearn'; c.due = now + RELEARN_MS; }
    else { c.state = 'review'; c.due = now + intervalDays(c.s) * DAY; }
    return c;
  }

  /* Garden growth stage from stability: 1 sprout, 2 leafy, 3 bud, 4 bloom. */
  function stage(card) {
    if (!card) return 0;
    if (card.s < 2) return 1;
    if (card.s < 7) return 2;
    if (card.s < 21) return 3;
    return 4;
  }

  window.SRS = { review: review, stage: stage, retrievability: retrievability, intervalDays: intervalDays, DAY: DAY, W: W };
})();
