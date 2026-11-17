/* Light motion. No animation loop and nothing running between taps:
   - a screen change is one soft fade-and-rise (CSS),
   - buttons squish a little when pressed (CSS),
   - the sheet slides with a CSS transition, and follows the finger while it is dragged,
   - word tiles follow the finger directly and slide back with a CSS transition.
   Everything is switched off when the phone asks for reduced motion. */
(function () {
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function wire(root, opts) {
    opts = opts || {};
    if (reduce) return;
    if (opts.enter) {
      var target = root.querySelector('.scroll') || root.querySelector('.screen');
      if (target) target.classList.add('fx-in');
    }
    Array.prototype.forEach.call(root.querySelectorAll('[data-pop-now]'), function (el) { el.classList.add('fx-pop'); });
  }

  /* Bottom sheet. open()/close() switch a class; dragging the handle moves it with the finger. */
  function sheet(sheetEl, scrimEl, onClose) {
    var api = {
      open: function () {
        scrimEl.style.pointerEvents = 'auto'; sheetEl.removeAttribute('inert'); sheetEl.setAttribute('aria-hidden', 'false');
        sheetEl.style.transition = ''; sheetEl.style.transform = '';
        sheetEl.classList.add('open'); scrimEl.classList.add('open');
      },
      close: function () {
        scrimEl.style.pointerEvents = 'none'; sheetEl.setAttribute('inert', ''); sheetEl.setAttribute('aria-hidden', 'true');
        sheetEl.style.transition = ''; sheetEl.style.transform = '';
        sheetEl.classList.remove('open'); scrimEl.classList.remove('open');
        if (onClose) onClose();
      }
    };
    sheetEl.setAttribute('inert', '');
    scrimEl.addEventListener('click', function () { api.close(); });
    var grab = sheetEl.querySelector('[data-sheet-handle]');
    if (!grab) return api;
    var id = null, sy = 0, dy = 0, moved = false;
    grab.style.touchAction = 'none';
    grab.addEventListener('pointerdown', function (e) {
      id = e.pointerId; sy = e.clientY; dy = 0; moved = false;
      try { grab.setPointerCapture(id); } catch (x) {}
      sheetEl.style.transition = 'none';
    });
    grab.addEventListener('pointermove', function (e) {
      if (e.pointerId !== id) return;
      dy = Math.max(0, e.clientY - sy);
      if (dy > 4) moved = true;
      sheetEl.style.transform = 'translateY(' + dy + 'px)';
    });
    var end = function (e) {
      if (e.pointerId !== id) return;
      id = null;
      if (!moved || dy > sheetEl.offsetHeight * 0.3) api.close(); else api.open();
    };
    grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
    return api;
  }

  /* Drag a tile: it follows the finger, then slides back. onDrop() says where it was released. */
  function draggable(el, onDrop) {
    el.style.touchAction = 'none';
    var id = null, sx = 0, sy = 0, moved = false;
    el.addEventListener('pointerdown', function (e) {
      id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false;
      try { el.setPointerCapture(id); } catch (x) {}
      el.style.transition = 'none'; el.style.zIndex = '5';
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerId !== id) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.06)';
    });
    var end = function (e) {
      if (e.pointerId !== id) return;
      id = null;
      el.style.transition = reduce ? 'none' : 'transform .18s ease-out'; el.style.transform = '';
      setTimeout(function () { el.style.zIndex = ''; el.style.transition = ''; }, 260);
      if (onDrop) onDrop({ moved: moved, x: e.clientX, y: e.clientY });
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  /* Slide an element from one x offset to another (the Settings switches). */
  function slide(el, fromX, toX) {
    if (!el) return;
    if (reduce) { el.style.transform = 'translateX(' + toX + 'px)'; return; }
    el.style.transition = 'none'; el.style.transform = 'translateX(' + fromX + 'px)';
    void el.offsetWidth;
    el.style.transition = 'transform .2s ease-out'; el.style.transform = 'translateX(' + toX + 'px)';
  }

  /* A small shake of the plant after an answer. */
  function nudge(el) {
    if (!el || reduce) return;
    el.classList.remove('fx-nudge'); void el.offsetWidth; el.classList.add('fx-nudge');
    setTimeout(function () { el.classList.remove('fx-nudge'); }, 450);
  }

  window.Motion = { reduce: reduce, wire: wire, sheet: sheet, draggable: draggable, slide: slide, nudge: nudge };
})();
