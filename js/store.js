/* Saves the garden on this device. IndexedDB first, localStorage as a fallback, memory if both fail.
   Everything lives under one key so export/import is a single JSON file. */
(function () {
  var DB_NAME = 'garden', STORE = 'kv', KEY = 'save', LS_KEY = 'garden-save-v1';
  var dbp = null;

  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      try {
        if (!window.indexedDB) return resolve(null);
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbp;
  }

  function load() {
    return openDB().then(function (db) {
      if (!db) return fromLS();
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, 'readonly');
          var rq = tx.objectStore(STORE).get(KEY);
          rq.onsuccess = function () { resolve(rq.result || fromLS()); };
          rq.onerror = function () { resolve(fromLS()); };
        } catch (e) { resolve(fromLS()); }
      });
    });
  }

  function fromLS() {
    try { var raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  var timer = null, pending = null;
  function save(data) {
    pending = data;
    clearTimeout(timer);
    timer = setTimeout(flush, 250);
  }
  function flush() {
    if (!pending) return Promise.resolve();
    var data = JSON.parse(JSON.stringify(pending));
    pending = null;
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {}
    return openDB().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(data, KEY);
          tx.oncomplete = resolve; tx.onerror = resolve;
        } catch (e) { resolve(); }
      });
    });
  }

  function persist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  }

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });

  window.Store = { load: load, save: save, flush: flush, persist: persist };
})();
