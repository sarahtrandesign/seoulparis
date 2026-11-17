/* Background music: one looping track (audio/bgm.mp3) played through Web Audio.
   Web Audio gives a gapless loop and a working volume control on iPhones.
   It starts on the first tap (browsers block sound before that), pauses when the tab is hidden,
   and lowers itself while a word is being read aloud. If the file cannot load (for example when
   index.html is opened straight from disk), the game simply stays quiet. */
(function () {
  var ctx = null, gain = null, buf = null, src = null, loading = null;
  var want = false, ducked = false, LEVEL = 0.30, DUCK = 0.35;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}   // iPhone: play even with the ringer switch on silent
      ctx = new AC();
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  function load() {
    if (buf) return Promise.resolve(buf);
    if (loading) return loading;
    loading = fetch('audio/bgm.mp3').then(function (r) { if (!r.ok) throw new Error('bgm'); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (ok, no) { ctx.decodeAudioData(ab, ok, no); }); })
      .then(function (b) { buf = b; return b; })
      .catch(function () { loading = null; return null; });
    return loading;
  }
  function level() { return want ? (ducked ? LEVEL * DUCK : LEVEL) : 0; }
  function apply() { if (ctx && gain) gain.gain.setTargetAtTime(level(), ctx.currentTime, 0.35); }
  function startSource() {
    if (src || !buf) return;
    src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.connect(gain); src.start(0);
  }
  function resume() { try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {} }

  var Music = {
    set: function (on) {
      want = !!on;
      if (!want) { apply(); return; }
      if (!ensure()) return;
      resume();
      load().then(function () { if (want) { startSource(); apply(); resume(); } });
    },
    duck: function (on) { ducked = !!on; apply(); }
  };

  // First tap (or key press) unlocks audio.
  function unlock() { if (want) { Music.set(true); } if (ctx && ctx.state === 'running') { ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (ev) { window.removeEventListener(ev, unlock, true); }); } }
  // Phones only count the moment a finger lifts (touchend / pointerup / click) as permission to play sound.
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (ev) { window.addEventListener(ev, unlock, true); });

  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) { try { ctx.suspend(); } catch (e) {} }
    else if (want) { resume(); }
  });

  window.Music = Music;
})();
