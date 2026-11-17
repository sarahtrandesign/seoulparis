/* Seoul & Paris Garden: a Korean + French starter game for K-pop fans.
   Plant a seed = learn something new. Thirsty plant = a review is due (FSRS). Bloom = you know it. */
(function () {
  'use strict';
  var A = window.ART, $app = document.getElementById('app');
  var DATA = { ko: null, fr: null }, UI = null, META = null;
  var IDX = {};          // item id -> { item, seed, stage, lang }
  var SEEDS = {};        // seed id -> seed (with lang)
  var S = null;          // the save
  var V = { screen: 'boot' }; // what's on screen
  var C = { INK: '#375479', TXT: '#1F2F4D', SUB: '#3D4F73', PAPER: '#FFFDF6', SKY: '#BEE4FB', SKY3: '#E7F2FC', SKYMID: '#AECEF6', BLUE: '#5A88C4',
            PINK: '#FFB3D1', PINK2: '#FFC8E4', PINK3: '#FFE3EF', ROSE: '#EE8FAF', BUTTER: '#F9ECCC', BUTTER2: '#FBDC9B', MINT: '#C9F0B5', MINT2: '#E3FCC5',
            MINTTXT: '#2F4A2A', LILAC: '#E5DAF3', SOIL: '#EBD5A8' };
  var FLOWER_HEX = { pink: C.PINK, yellow: C.BUTTER2, sky: C.SKY, lilac: C.LILAC };
  var LATIN = "'Grandstander','BM Jua',system-ui,sans-serif", KO = "'BM Jua','Grandstander',system-ui,sans-serif";
  var DAY = 86400000;

  /* ------------------------------------------------------------------ save */
  function freshSave() {
    return { v: 1, created: Date.now(), lastVisit: Date.now(),
      profile: { ui: (navigator.language || 'en').slice(0, 2) === 'vi' ? 'vi' : 'en', faves: [], rom: true, sound: true, music: true, daily: 10, onboarded: false, seenInstall: false },
      cards: {}, planted: { ko: [], fr: [] }, inv: { flowers: { pink: 0, yellow: 0, sky: 0, lilac: 0 }, stickers: [] },
      stats: { visitors: 0, reviews: 0, metVisitors: {} }, logs: [], lastDaily: null };
  }
  function save() { S.lastVisit = Date.now(); Store.save(S); }

  /* ------------------------------------------------------------------ text */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function t(key, vars) {
    var s = (UI[S ? S.profile.ui : 'en'] || UI.en)[key] || UI.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function L(obj, base) { var vi = S && S.profile.ui === 'vi'; return obj[(base || '') + (vi ? 'vi' : 'en')] || obj[(base || '') + 'en']; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function hasBatchim(word) {
    for (var i = word.length - 1; i >= 0; i--) {
      var c = word.charCodeAt(i);
      if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 !== 0;
    }
    return false;
  }
  function favesList() {
    var ids = S.profile.faves && S.profile.faves.length ? S.profile.faves : META.groups.map(function (g) { return g.id; });
    return META.groups.filter(function (g) { return ids.indexOf(g.id) >= 0; });
  }
  function groupFor(id) { var f = favesList(); return f[hash(id) % f.length]; }
  function fill(s, lang, id, field) {
    if (!s || s.indexOf('{g') < 0) return s;
    var g = groupFor(id);
    return s.replace(/\{g(?::([^}]+))?\}/g, function (m, arg) {
      if (field === 'text' && lang === 'ko') {
        if (!arg) return g.ko;
        var p = arg.split('/');
        return g.ko + (hasBatchim(g.ko) ? p[0] : p[1]);
      }
      if (field === 'text' && lang === 'fr' && arg === 'de') return g.fr_vowel ? "d'" + g.name : 'de ' + g.name;
      return g.name;
    });
  }
  function T(item, field) { return fill(item[field], IDX[item.id] ? IDX[item.id].lang : 'ko', item.id, field); }
  function meaning(item) { return fill(L(item), IDX[item.id].lang, item.id, 'en'); }

  /* ------------------------------------------------------------------ audio */
  var voices = [];
  function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function voiceFor(lang) { var code = lang === 'ko' ? 'ko' : 'fr'; return voices.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(code) === 0; })[0]; }
  function hasVoice(lang) { return !!voiceFor(lang); }
  function speak(text, lang, slow, file) {
    if (file) { try { var fa = new Audio(file); if (window.Music) { Music.duck(true); fa.onended = fa.onerror = function () { Music.duck(false); }; } fa.play(); return; } catch (e) {} }
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text.replace(/[‿]/g, ' '));
      u.lang = lang === 'ko' ? 'ko-KR' : 'fr-FR';
      var v = voiceFor(lang); if (v) u.voice = v;
      u.rate = slow ? 0.6 : 0.9;
      if (window.Music) {
        Music.duck(true);
        var undo = function () { Music.duck(false); };
        u.onend = undo; u.onerror = undo; setTimeout(undo, 7000);
      }
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function sayItem(item, slow) { var info = IDX[item.id]; speak(T(item, 'text'), info.lang, slow, item.audio); }

  /* ------------------------------------------------------------------ drawing helpers (crayon look) */
  function layers(r, fill, bw, ink, shadow, dash) {
    var rr = typeof r === 'number' ? r + 'px' : r, s = '';
    if (shadow) s += '<span aria-hidden="true" class="lay" style="border-radius:' + rr + ';background:' + shadow + ';transform:translate(5px,5px);z-index:-2"></span>';
    s += '<span aria-hidden="true" class="lay" style="border-radius:' + rr + ';background:' + fill + ';border:' + bw + 'px ' + (dash ? 'dashed' : 'solid') + ' ' + ink + '"></span>';
    return s;
  }
  function box(inner, o) {
    o = o || {};
    var tag = o.tag || 'div', attrs = o.attrs || '';
    if ((tag === 'button' || tag === 'a') && !o.nopress) attrs += ' data-press';
    var cls = 'bx' + (tag === 'button' ? ' bt' : '') + (o.cls ? ' ' + o.cls : '');
    return '<' + tag + ' class="' + cls + '" ' + attrs + ' style="' + (o.style || '') + '">' +
      layers(o.r == null ? 18 : o.r, o.fill || C.PAPER, o.bw == null ? 2.5 : o.bw, o.ink || C.INK, o.shadow, o.dash) + inner + '</' + tag + '>';
  }
  function btn(label, act, o) {
    o = o || {};
    var fill = o.fill || C.PINK;
    var style = 'display:flex;align-items:center;justify-content:center;gap:10px;min-height:' + (o.small ? 48 : 56) + 'px;padding:0 18px;font:800 ' + (o.small ? 16.5 : 19) + 'px/1 ' + LATIN + ';color:' + C.TXT + ';' + (o.style || '');
    var attrs = (act ? 'data-act="' + esc(act) + '"' : '') + ' type="button"' + (o.attrs ? ' ' + o.attrs : '') + (o.enter === false ? '' : ' data-enter');
    return box(label, { tag: 'button', attrs: attrs, r: 16, fill: fill, shadow: fill === C.PINK ? C.INK : null, style: style });
  }
  function win(title, inner, o) {
    o = o || {};
    var bar = '<div class="bar"><span aria-hidden="true" class="lay" style="border-radius:16px 16px 4px 4px;background:' + C.INK + ';border:0"></span><span>' + esc(title) + '</span>' + A.dots + '</div>';
    return box(bar + '<div style="padding:' + (o.pad || '16px') + '">' + inner + '</div>', { attrs: 'data-enter ' + (o.attrs || ''), shadow: o.shadow || C.SKY, style: 'display:block;' + (o.style || '') });
  }
  function chip(text, fill, ink, style) {
    return box(text, { tag: 'span', r: 18, fill: fill || C.SKY3, bw: 2, ink: ink || C.BLUE, style: 'display:inline-flex;align-items:center;gap:6px;padding:7px 13px;font:800 13.5px/1.15 ' + LATIN + ';color:' + C.TXT + ';white-space:nowrap;' + (style || '') });
  }
  function ico(name, size, color, sw) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 22) + '" height="' + (size || 22) + '" fill="none" stroke="' + (color || C.TXT) + '" stroke-width="' + (sw || 2.2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><g filter="url(#crayon)">' + A.icons[name] + '</g></svg>';
  }
  function iconBtn(name, act, label) {
    return box(ico(name), { tag: 'button', attrs: 'type="button" data-act="' + act + '" aria-label="' + esc(label) + '"', r: 14, style: 'width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0' });
  }
  function note(text, o) {
    o = o || {};
    return box(ico(o.icon || 'cloudok', 20, o.color || C.MINTTXT) + '<span>' + text + '</span>',
      { attrs: 'data-enter', r: 14, fill: o.fill || C.MINT2, bw: 2, ink: o.ink || '#B9E6A0', style: 'display:flex;gap:10px;align-items:flex-start;padding:11px 14px;font:600 13.5px/1.42 ' + LATIN + ';color:' + (o.color || C.MINTTXT) });
  }
  function koText(s, size) { return '<span lang="ko" style="font-family:' + KO + ';font-weight:400' + (size ? ';font-size:' + size + 'px' : '') + '">' + esc(s) + '</span>'; }
  function targetText(item, size) {
    var info = IDX[item.id], txt = T(item, 'text');
    return info.lang === 'ko' ? koText(txt, size) : '<span lang="fr" style="font-weight:800' + (size ? ';font-size:' + size + 'px' : '') + '">' + esc(txt) + '</span>';
  }
  function romLine(item) {
    var info = IDX[item.id];
    if (info.lang !== 'ko' || !S.profile.rom || !item.rom) return '';
    return '<div class="sub">' + esc(fill(item.rom, 'ko', item.id, 'rom')) + '</div>';
  }
  function plantColor(id) { return ['pink', 'yellow', 'sky', 'lilac'][hash(id + 'c') % 4]; }
  function plantSvg(id, stage, thirsty, w) {
    var key = Math.max(0, stage) + '_' + plantColor(id) + '_' + (thirsty ? 1 : 0);
    return A.plants[key].replace('<svg ', '<svg width="' + (w || 56) + '" height="' + Math.round((w || 56) * 80 / 62) + '" ');
  }
  function sized(svg, w) { return svg.replace(/width="[\d.]+" height="[\d.]+"/, 'width="' + w + '" height="' + Math.round(w * (svg.match(/height="([\d.]+)"/)[1] / svg.match(/width="([\d.]+)"/)[1])) + '"'); }
  function flower(color, w) { return sized(A.flowers[color], w || 30); }

  /* ------------------------------------------------------------------ model */
  function now() { return Date.now(); }
  function card(id) { return S.cards[id]; }
  function isThirsty(id) { var c = card(id); return !!c && c.due <= now(); }
  function langItems(lang) { return Object.keys(IDX).filter(function (id) { return IDX[id].lang === lang; }); }
  function plantedItems(lang) { return langItems(lang).filter(function (id) { return !!card(id); }); }
  function dueItems(lang) {
    var ids = lang === 'both' ? Object.keys(S.cards) : plantedItems(lang);
    return ids.filter(function (id) { return isThirsty(id) && IDX[id]; }).sort(function (a, b) { return card(a).due - card(b).due; });
  }
  function bloomCount(lang) { return plantedItems(lang).filter(function (id) { return SRS.stage(card(id)) === 4; }).length; }
  function stageSeeds(lang, stageId) { return DATA[lang].seeds.filter(function (s) { return s.stage === stageId; }); }
  function isPlanted(seedId) { var s = SEEDS[seedId]; return S.planted[s.lang].indexOf(seedId) >= 0; }
  function stageOpen(lang, i) {
    if (i === 0) return true;
    var prev = DATA[lang].stages[i - 1];
    return stageSeeds(lang, prev.id).every(function (s) { return isPlanted(s.id); });
  }
  function nextSeed(lang) {
    var all = DATA[lang].seeds;
    for (var i = 0; i < all.length; i++) if (!isPlanted(all[i].id)) return all[i];
    return null;
  }
  function currentStageIndex(lang) {
    var st = DATA[lang].stages, i = 0;
    for (var k = 0; k < st.length; k++) if (stageOpen(lang, k)) i = k;
    return i;
  }
  function visitorDue() {
    var ids = Object.keys(S.cards).filter(function (id) { var it = IDX[id]; return it && (it.item.kind === 'dialogue' || it.item.kind === 'order') && isThirsty(id); });
    return ids[0] || null;
  }
  function logReview(id, g, ms) {
    S.logs.push([id, now(), g, Math.min(60000, Math.max(0, ms | 0))]);
    if (S.logs.length > 20000) S.logs = S.logs.slice(-15000);
  }
  function rate(id, ok, ms) {
    var g = ok ? 3 : 1;
    var before = card(id);
    var c = SRS.review(before, g, now());
    c.bloomed = before ? before.bloomed : false;
    S.cards[id] = c;
    S.stats.reviews++;
    logReview(id, g, ms);
    var bloomedNow = SRS.stage(c) === 4 && !c.bloomed;
    if (bloomedNow) {
      c.bloomed = true;
      S.inv.flowers[IDX[id].lang === 'ko' ? 'pink' : 'yellow'] += 2;
    }
    checkStickers();
    save();
    return bloomedNow;
  }
  function checkStickers() {
    var planted = S.planted.ko.length + S.planted.fr.length;
    var bloomed = Object.keys(S.cards).filter(function (id) { return S.cards[id].bloomed; }).length;
    META.stickers.forEach(function (st) {
      if (S.inv.stickers.indexOf(st.id) >= 0) return;
      var r = st.rule.split(':'), ok = false;
      if (r[0] === 'planted') ok = planted >= +r[1];
      if (r[0] === 'bloomed') ok = bloomed >= +r[1];
      if (r[0] === 'visitors') ok = S.stats.visitors >= +r[1];
      if (r[0] === 'reviews') ok = S.stats.reviews >= +r[1];
      if (r[0] === 'both') ok = S.planted.ko.length > 0 && S.planted.fr.length > 0;
      if (r[0] === 'stage') ok = stageSeeds('ko', r[1]).every(function (s) { return isPlanted(s.id); });
      if (ok) { S.inv.stickers.push(st.id); V.newSticker = st.id; }
    });
  }

  /* ------------------------------------------------------------------ exercises */
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function siblings(id, kind) {
    var info = IDX[id];
    var same = langItems(info.lang).filter(function (o) { return o !== id && IDX[o].item.kind === kind; });
    var near = same.filter(function (o) { return IDX[o].stage === info.stage; });
    return shuffle(near).concat(shuffle(same.filter(function (o) { return near.indexOf(o) < 0; })));
  }
  function tokens(text, lang) {
    return text.replace(/[.!?,]/g, ' ').split(/\s+/).filter(function (x) { return x && x !== '…'; });
  }
  function makeExercise(id) {
    var info = IDX[id], it = info.item, c = card(id), reps = c ? c.reps : 0, ex = { id: id, t0: now() };
    if (it.kind === 'sound') {
      ex.type = 'listen';
      var opts = [it.text].concat(it.conf || []).slice(0, 3);
      ex.options = shuffle(opts).map(function (o) { return { label: o, ok: o === it.text }; });
    } else if (it.kind === 'word' || (it.kind === 'sentence' && reps < 1)) {
      var mode = it.kind === 'sentence' ? 'meaning' : (reps < 2 ? 'meaning' : (reps % 2 ? 'reverse' : 'listenword'));
      ex.type = mode;
      var others = siblings(id, it.kind).slice(0, 2);
      if (mode === 'meaning') ex.options = shuffle([id].concat(others)).map(function (o) { return { label: meaning(IDX[o].item), ok: o === id }; });
      else ex.options = shuffle([id].concat(others)).map(function (o) { return { label: T(IDX[o].item, 'text'), ok: o === id, ko: info.lang === 'ko' }; });
    } else if (it.kind === 'sentence') {
      ex.type = 'build';
      var target = tokens(T(it, 'text'), info.lang);
      var extra = it.extra ? it.extra.slice() : [];
      siblings(id, 'sentence').slice(0, 3).forEach(function (o) {
        tokens(T(IDX[o].item, 'text'), info.lang).forEach(function (w) { if (extra.length < 2 && target.indexOf(w) < 0 && extra.indexOf(w) < 0) extra.push(w); });
      });
      ex.answer = target;
      ex.pool = shuffle(target.concat(extra)).map(function (w, i) { return { w: w, i: i }; });
      ex.placed = [];
    } else if (it.kind === 'dialogue') {
      ex.type = 'reply';
      ex.options = shuffle(it.replies.map(function (r) { return { label: fill(r.text, info.lang, id, 'text'), sub: fill(L(r), info.lang, id, 'en'), ok: r.ok, why: L(r, 'why_') }; }));
    } else if (it.kind === 'order') {
      ex.type = 'order';
      ex.options = shuffle(it.options.map(function (o) { return { color: o.color, count: o.count, ok: o.color === it.want.color && o.count === it.want.count }; }));
    }
    return ex;
  }

  /* ------------------------------------------------------------------ navigation */
  function go(screen, extra) {
    V = Object.assign({ screen: screen }, extra || {});
    render(true);
    var sc = $app.querySelector('.scroll'); if (sc) sc.scrollTop = 0;
  }
  function startSession(mode, lang, ids) {
    var max = Math.round(S.profile.daily * 4);
    var queue = (ids || dueItems(lang)).slice(0, max);
    if (!queue.length) { go('done', { empty: true, lang: lang }); return; }
    go('session', { mode: mode, lang: lang, queue: queue, idx: 0, ex: makeExercise(queue[0]), done: 0, retried: {}, blooms: [] });
    autoSay();
  }
  function autoSay() {
    if (!S.profile.sound || V.screen !== 'session' || !V.ex) return;
    var it = IDX[V.ex.id].item;
    var exNow = V.ex;
    if (V.ex.type === 'listen' || V.ex.type === 'listenword' || V.ex.type === 'reply' || V.ex.type === 'order') setTimeout(function () { if (V.ex === exNow) sayItem(it); }, 350);
  }

  /* ------------------------------------------------------------------ screens */
  function tabbar(active) {
    var items = [['desktop', 'home', ico('desk')], ['korean', 'garden:ko', '<span style="font:400 21px/22px ' + KO + '">가</span>'],
                 ['french', 'garden:fr', '<span style="font:800 22px/22px ' + LATIN + '">é</span>'], ['basket', 'basket', ico('basket')], ['growth', 'growth', ico('bars')]];
    var out = items.map(function (x) {
      var on = x[0] === active, inner = x[2] + '<span>' + t(x[0]) + '</span>';
      var st = 'flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;margin:7px 0;color:' + C.TXT + ';font:800 12.5px/1 ' + LATIN;
      return on ? box(inner, { tag: 'button', attrs: 'type="button" data-act="' + x[1] + '" aria-current="page"', r: 12, bw: 2.2, style: st })
                : '<button type="button" class="bt" data-press data-act="' + x[1] + '" style="' + st + '">' + inner + '</button>';
    }).join('');
    return '<nav class="tabbar" aria-label="Main"><span aria-hidden="true" class="lay" style="inset:0 -4px -4px;background:' + C.SKYMID + ';border:0;border-top:2.5px solid ' + C.INK + '"></span>' + out + '</nav>';
  }
  function dotsSteps(i) {
    var s = ''; for (var k = 0; k < 4; k++) s += k === i ? '<span class="stepdot on"></span>' : '<span class="stepdot"></span>';
    return '<div class="steps" aria-hidden="true">' + s + '</div>';
  }
  function page(inner, o) {
    o = o || {};
    return '<div class="screen' + (o.tabs ? ' with-tabs' : '') + '"><div class="scroll"><div class="col' + (o.center ? ' center' : '') + '">' + inner + '</div></div>' + (o.tabs ? tabbar(o.tabs) : '') + (o.overlay || '') + '</div>';
  }

  function scrLang() {
    var opt = function (code, label) {
      var on = S.profile.ui === code;
      return box('<span>' + label + '</span>' + (on ? '<span class="check">' + ico('check', 17, '#fff', 3) + '</span>' : '<span class="ring"></span>'),
        { tag: 'button', attrs: 'type="button" data-act="ui:' + code + '" aria-pressed="' + on + '"', r: 16, fill: on ? C.SKY3 : '#fff', bw: on ? 2.5 : 2, ink: on ? C.INK : C.SKYMID,
          style: 'display:flex;align-items:center;justify-content:space-between;min-height:60px;padding:0 18px;font:800 19px/1 ' + LATIN + ';color:' + C.TXT });
    };
    return page(win('welcome.exe', '<div class="stack center-text">' +
      '<div class="mascots">' + A.mochi + A.croissy + '</div>' +
      '<h1>' + t('choose_lang') + '</h1><p class="p">' + t('choose_lang_sub') + '</p>' +
      '<div class="stack" style="width:100%;gap:10px">' + opt('en', 'English') + opt('vi', 'Tiếng Việt') + '</div>' +
      '<p class="small">' + t('change_later') + '</p>' + btn(t('next'), 'go:faves', { style: 'width:100%' }) + dotsSteps(0) + '</div>', { pad: '20px 18px 22px' }), { center: true });
  }
  function scrFaves() {
    var chips = META.groups.map(function (g) {
      var on = S.profile.faves.indexOf(g.id) >= 0;
      return box((on ? ico('check', 16, C.TXT, 3) : '') + esc(g.name), { tag: 'button', attrs: 'type="button" data-act="fave:' + g.id + '" aria-pressed="' + on + '"', r: 24, fill: on ? C.PINK2 : '#fff', bw: on ? 2.5 : 2, ink: on ? C.INK : C.SKYMID,
        style: 'display:flex;align-items:center;gap:7px;min-height:48px;padding:0 16px;font:800 16.5px/1 ' + LATIN + ';color:' + C.TXT });
    }).join('') + box(t('surprise'), { tag: 'button', attrs: 'type="button" data-act="fave-surprise"', r: 24, fill: C.SKY3, bw: 2, ink: C.BLUE, dash: true, style: 'display:flex;align-items:center;min-height:48px;padding:0 16px;font:800 16.5px/1 ' + LATIN + ';color:' + C.TXT });
    var fromSettings = V.from === 'settings';
    return page(win('faves.exe', '<div class="stack">' +
      '<h1>' + t('pick_faves') + '</h1><p class="p">' + t('pick_faves_sub') + '</p>' +
      '<div class="wrap">' + chips + '</div>' + note(t('fan_note')) +
      (fromSettings ? btn(t('close'), 'settings') : '<div class="row">' + btn(t('back'), 'go:lang', { fill: C.PAPER, style: 'padding:0 22px' }) + btn(t('next'), 'go:tour', { style: 'flex:1' }) + '</div>' + dotsSteps(1)) +
      '</div>', { pad: '20px 16px 22px' }), { center: true });
  }
  function scrTour() {
    var row = function (art, title, text) {
      return box('<span class="rowart">' + art + '</span><span class="stack" style="gap:2px"><b class="h3">' + title + '</b><span class="small">' + text + '</span></span>',
        { r: 16, fill: '#fff', bw: 2, ink: C.SKYMID, style: 'display:flex;gap:12px;align-items:center;padding:10px 14px 10px 8px' });
    };
    return page(win('garden_guide.exe', '<div class="stack">' + '<h1>' + t('how_grows') + '</h1>' +
      row(A.packet.replace('{G}', '가'), t('plant_seed'), t('plant_seed_sub')) +
      row(plantSvg('tour1', 2, true, 56), t('water_thirsty'), t('water_thirsty_sub')) +
      row(plantSvg('tour2', 4, false, 56), t('bloom'), t('bloom_sub')) +
      note(t('never_wilt'), { fill: C.PINK3, ink: C.ROSE, color: '#6B2A47', icon: 'seed' }) +
      '<div class="row">' + btn(t('back'), 'go:faves', { fill: C.PAPER, style: 'padding:0 22px' }) + btn(t('next'), 'tour-next', { style: 'flex:1' }) + '</div>' + dotsSteps(2) +
      '</div>', { pad: '18px 16px 20px' }), { center: true });
  }
  function scrInstall() {
    var st = function (n, art, text, fill) {
      return box(box(art, { tag: 'span', r: 12, fill: fill, bw: 2.2, style: 'width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0' }) +
        '<span style="font:700 16px/1.3 ' + LATIN + '"><span class="eyebrow">STEP ' + n + '</span><br>' + text + '</span>',
        { tag: 'li', r: 16, fill: '#fff', bw: 2, ink: C.SKYMID, style: 'display:flex;align-items:center;gap:14px;padding:11px 14px' });
    };
    var android = !!deferredInstall;
    return page(win('install.exe', '<div class="stack">' +
      '<h1>' + t('add_home') + '</h1><p class="p">' + t('add_home_sub') + '</p>' +
      (android ? btn(ico('plus') + t('add_home'), 'install', {}) :
        '<ol class="stack" style="list-style:none;margin:0;padding:0;gap:10px">' + st(1, ico('share'), t('step1'), C.SKY3) + st(2, ico('plus'), t('step2'), C.PINK2) + st(3, plantSvg('inst', 1, false, 34), t('step3'), C.MINT2) + '</ol>') +
      note(t('safari_note')) + btn(t('open_garden'), 'finish-onboard') +
      '<button type="button" class="link" data-act="finish-onboard">' + t('maybe_later') + '</button>' + dotsSteps(3) +
      '</div>', { pad: '18px 16px 18px' }), { center: true });
  }

  function scrHome() {
    var dueK = dueItems('ko').length, dueF = dueItems('fr').length, due = dueK + dueF;
    var mins = Math.max(1, Math.min(S.profile.daily, Math.ceil(Math.min(due, S.profile.daily * 4) / 4)));
    var icon = function (lang, tile, shadow, art, sticker, title, sub) {
      return '<button type="button" class="bt deskicon" data-press data-enter data-act="garden:' + lang + '">' +
        box(art + '<span class="sticker">' + sticker + '</span>', { tag: 'span', r: 32, fill: tile, bw: 2.6, shadow: shadow, style: 'width:128px;height:128px;display:flex;align-items:flex-end;justify-content:center' }) +
        '<span class="desktitle">' + title + '</span><span class="small" style="font-weight:700">' + sub + '</span></button>';
    };
    var koSt = box('가', { tag: 'span', r: 22, fill: C.PINK2, bw: 2.2, style: 'display:flex;width:44px;height:44px;align-items:center;justify-content:center;font:400 26px/1 ' + KO });
    var frSt = box('é', { tag: 'span', r: 22, fill: C.BUTTER2, bw: 2.2, style: 'display:flex;width:44px;height:44px;align-items:center;justify-content:center;font:800 28px/1 ' + LATIN });
    var koArt = '<span class="pair">' + plantSvg('h1', Math.max(1, Math.min(4, 1 + bloomCount('ko'))), false, 48) + plantSvg('h2', plantedItems('ko').length ? 3 : 0, false, 40) + '</span>';
    var frArt = '<span class="pair">' + plantSvg('h3', plantedItems('fr').length ? 3 : 0, false, 40) + plantSvg('h4', Math.max(1, Math.min(4, 1 + bloomCount('fr'))), false, 48) + '</span>';
    var sub = function (lang) { return plantedItems(lang).length + ' ' + t('plants') + ' · ' + dueItems(lang).length + ' ' + t('thirsty'); };
    var water = win('watering.exe', '<div class="stack" style="gap:12px"><div class="row" style="align-items:center;gap:12px">' + A.can +
      '<div><div class="h2">' + (due ? t('n_thirsty', { n: due }) : t('none_thirsty')) + '</div><div class="small" style="font-weight:700">' + t('about_min', { n: mins }) + '</div></div></div>' +
      (due ? btn(ico('drop', 22) + t('water_them'), 'water:both') : btn(ico('seed', 22) + t('plant_seeds'), 'garden:' + (plantedItems('ko').length <= plantedItems('fr').length ? 'ko' : 'fr'))) +
      '<div class="small center-text">' + t('skip_day') + '</div></div>', { pad: '14px 16px 16px' });
    var vid = visitorDue();
    var visitor = vid ? box(A.bunnySmall + '<span style="flex:1;font:700 15px/1.3 ' + LATIN + '">' + t('visitor_wait', { name: 'Yuna' }) + '</span>' + ico('next'),
      { tag: 'button', attrs: 'type="button" data-act="visitor:' + vid + '" data-enter', r: 16, bw: 2.2, style: 'display:flex;align-items:center;gap:10px;padding:6px 14px 6px 8px;width:100%;text-align:left;color:' + C.TXT }) : '';
    var top = '<div class="row" style="justify-content:space-between;align-items:center" data-enter>' +
      chip(ico('cloudok', 16, C.MINTTXT, 2.4) + t('saved'), C.MINT2, '#B9E6A0', 'color:' + C.MINTTXT + ';font-size:13px') + iconBtn('gear', 'settings', t('settings')) + '</div>';
    var icons = '<div class="row" style="gap:14px">' + icon('ko', C.PINK3, C.SKY, koArt, koSt, '<span style="font-family:' + KO.replace(/'/g, '&#39;') + '">한국어 정원</span>', sub('ko')) +
      icon('fr', C.BUTTER, C.MINT, frArt, frSt, 'Jardin', sub('fr')) + '</div>';
    return page(top + icons + water + visitor, { tabs: 'desktop' });
  }

  function scrGarden() {
    var lang = V.lang, d = DATA[lang], stIdx = V.plot != null ? V.plot : currentStageIndex(lang), stage = d.stages[stIdx];
    var seeds = stageSeeds(lang, stage.id), open = stageOpen(lang, stIdx);
    var cells = '';
    seeds.forEach(function (sd) {
      if (!isPlanted(sd.id)) return;
      sd.items.forEach(function (it) {
        var c = card(it.id), th = isThirsty(it.id), stg = SRS.stage(c);
        var label = it.label || T(it, 'text');
        cells += '<button type="button" class="plant bt" data-act="plantinfo:' + it.id + '" aria-label="' + esc(T(it, 'text') + (th ? ', ' + t('thirsty') : '')) + '">' +
          '<span data-pop data-wiggle style="display:block">' + plantSvg(it.id, stg, th, 54) + '</span>' +
          box(lang === 'ko' ? koText(label, 15) : '<span style="font-weight:800;font-size:13.5px">' + esc(label) + '</span>', { tag: 'span', r: 10, fill: th ? C.SKY3 : C.PAPER, bw: 1.8, style: 'display:inline-block;max-width:100%;padding:2px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }) + '</button>';
      });
    });
    var ns = nextSeed(lang);
    if (open && ns && ns.stage === stage.id) {
      cells += box(ico('plus', 26, C.TXT, 2.6) + '<span style="font:800 13px/1.1 ' + LATIN + '">' + t('plant_seed') + '</span>',
        { tag: 'button', attrs: 'type="button" data-act="seeds"', r: 16, fill: C.SOIL, bw: 2, dash: true, style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:104px;color:' + C.TXT });
    }
    var plots = d.stages.map(function (s, i) {
      var on = i === stIdx, ok = stageOpen(lang, i);
      return box(String(i + 1), { tag: 'button', attrs: 'type="button" data-act="plot:' + i + '" aria-label="' + esc(L(s, 'title_')) + '" aria-pressed="' + on + '"' + (ok ? '' : ' disabled'), r: 14, fill: on ? C.PINK2 : ok ? '#fff' : '#F1EADB', bw: on ? 2.5 : 2, ink: on ? C.INK : C.SKYMID,
        style: 'width:44px;height:44px;display:flex;align-items:center;justify-content:center;font:800 16px/1 ' + LATIN + ';color:' + (ok ? C.TXT : '#8A8F9C') + ';flex-shrink:0' });
    }).join('');
    var stagePlanted = seeds.filter(function (s) { return isPlanted(s.id); });
    var ids = []; stagePlanted.forEach(function (s) { s.items.forEach(function (it) { ids.push(it.id); }); });
    var dueHere = dueItems(lang).length;
    var title = lang === 'ko' ? '<span style="font:400 28px/1.05 ' + KO + ';white-space:nowrap">한국어 정원</span>' : '<span style="font:800 28px/1.05 ' + LATIN + '">Jardin</span>';
    var empty = !cells ? '<p class="p center-text" style="padding:24px 8px">' + (open ? t('plant_seed_sub') : t('next_plot')) + '</p>' : '';
    var scene = '<div class="fence">' + A.fence + '</div>' + (visitorDue() && IDX[visitorDue()].lang === lang ? '<button type="button" class="bt gatebunny" data-press data-act="visitor:' + visitorDue() + '" aria-label="' + t('visitor') + '">' + A.bunnySmall + '</button>' : '') +
      '<div class="plotgrid">' + cells + '</div>' + empty;
    var legend = '<div class="legend small"><span>' + ico('drop', 16, C.BLUE) + ids.filter(isThirsty).length + ' ' + t('thirsty') + '</span><span>' + flower('pink', 16) + ids.filter(function (id) { return SRS.stage(card(id)) === 4; }).length + ' ' + t('in_bloom') + '</span></div>';
    var head = '<div class="row" style="align-items:center;gap:8px" data-enter>' + (lang === 'ko' ? A.mochiSmall : A.croissySmall) + '<div class="stack" style="gap:0">' + title + '<span class="small" style="font-weight:700">' + t(lang === 'ko' ? 'ko_garden' : 'fr_garden') + '</span></div></div>' +
      '<div class="plots" data-enter>' + plots + '</div>' + '<div class="small" style="font-weight:800" data-enter>' + esc(t('plot', { n: stIdx + 1, title: L(stage, 'title_') })) + ' · ' + stage.cefr + '</div>';
    var actions = '<div class="row" style="gap:10px">' + (dueHere ? btn(ico('drop', 22) + t('water_n', { n: dueHere }), 'water:' + lang, { style: 'flex:1' }) : '') +
      (ns ? btn(ico('seed', 22) + t('plant_seeds'), 'seeds', { fill: C.PAPER, style: 'flex:1' }) : '') + '</div>';
    var overlay = '<div class="scrim" data-scrim></div><div class="sheet" data-sheet role="dialog" aria-modal="true" aria-label="' + esc(t('seed_packets')) + '" aria-hidden="true">' +
      box('<button type="button" class="grab" data-sheet-handle aria-label="' + esc(t('close')) + '"><span></span></button><div class="sheetbody" data-sheetbody></div>', { r: '26px 26px 0 0', style: 'display:block;padding-bottom:calc(10px + env(safe-area-inset-bottom))' }) + '</div>';
    return page(head + win(lang === 'ko' ? 'korean_garden.exe' : 'jardin.exe', scene + legend, { pad: '20px 12px 14px', attrs: 'data-rubber' }) + actions, { tabs: lang === 'ko' ? 'korean' : 'french', overlay: overlay });
  }
  function seedsSheet(lang) {
    var list = DATA[lang].seeds.filter(function (s) { return !isPlanted(s.id); }).slice(0, 3);
    var first = list[0];
    var rows = list.map(function (sd, i) {
      var can = i === 0 && stageOpen(lang, DATA[lang].stages.findIndex(function (x) { return x.id === sd.stage; }));
      return box(A.packet.replace('{G}', esc(sd.glyph)).replace('data-lang', 'lang="' + lang + '"') +
        '<span class="stack" style="flex:1;gap:2px;text-align:left"><span style="font:' + (lang === 'ko' ? '400 20px/1.15 ' + KO : '800 18px/1.15 ' + LATIN) + '">' + esc(sd.title) + '</span><span class="small">' + esc(L(sd, 'sub_')) + '</span></span>' +
        (can ? '<span style="font:800 15px/1 ' + LATIN + '">' + t('plant') + '</span>' : ico('lock', 18, C.SUB)),
        { tag: 'button', attrs: 'type="button"' + (can ? ' data-act="learn:' + sd.id + '"' : ' disabled'), r: 16, fill: can ? '#fff' : '#F7F2E6', bw: 2, ink: C.SKYMID, style: 'display:flex;align-items:center;gap:12px;padding:8px 14px 8px 8px;width:100%;color:' + C.TXT + (can ? '' : ';opacity:.7') });
    }).join('');
    return '<div class="stack" style="gap:12px;padding:0 18px 12px"><div><div class="h2">' + t('seed_packets') + '</div><div class="small">' + (first ? t('seed_packets_sub') : t('all_planted')) + '</div></div>' + rows + '</div>';
  }
  function plantSheet(id) {
    var info = IDX[id], it = info.item, c = card(id);
    var days = c ? Math.max(0, Math.round((c.due - now()) / DAY)) : 0;
    var when = !c ? '' : c.due <= now() ? t('today') : days <= 1 ? t('tomorrow') : t('in_days', { n: days });
    return '<div class="stack" style="gap:10px;padding:0 18px 12px">' +
      '<div class="row" style="gap:12px;align-items:center">' + plantSvg(id, SRS.stage(c), isThirsty(id), 60) + '<div class="stack" style="gap:2px">' +
      '<div style="font-size:24px;line-height:1.25">' + targetText(it, 24) + '</div>' + romLine(it) + '<div class="p">' + esc(meaning(it)) + '</div></div></div>' +
      '<div class="row" style="gap:10px">' + btn(ico('speak', 22) + t('listen'), 'say:' + id, { fill: C.PAPER, small: true, enter: false, style: 'flex:1' }) +
      (isThirsty(id) ? btn(ico('drop', 22) + t('water_n', { n: 1 }), 'water1:' + id, { small: true, enter: false, style: 'flex:1' }) : '') + '</div>' +
      (when ? '<div class="small" style="font-weight:700">' + t('item_next', { when: when }) + '</div>' : '') + '</div>';
  }

  function scrLearn() {
    var sd = SEEDS[V.seedId], lang = sd.lang;
    var ex = (sd.examples || []).map(function (e) {
      return box('<span style="font-size:20px">' + (lang === 'ko' ? koText(e.text, 20) : '<b>' + esc(e.text) + '</b>') + '</span>' +
        (lang === 'ko' && S.profile.rom && e.rom ? '<span class="small">' + esc(e.rom) + '</span>' : '') + '<span class="small" style="font-weight:700">' + esc(L(e)) + '</span>',
        { r: 14, fill: C.SKY3, bw: 2, ink: C.BLUE, style: 'flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:10px 8px;gap:2px' });
    }).join('');
    var inner = '<div class="stack" style="gap:12px"><div class="row" style="gap:12px;align-items:center">' + A.packet.replace('{G}', esc(sd.glyph)) +
      '<div><div style="font:' + (lang === 'ko' ? '400 30px/1.15 ' + KO : '800 26px/1.15 ' + LATIN) + '">' + esc(sd.title) + '</div><div class="p" style="font-weight:700">' + esc(L(sd, 'sub_')) + '</div></div></div>' +
      '<p class="p" style="color:' + C.TXT + '">' + esc(L(sd, 'explain_')) + '</p>' + (ex ? '<div class="row" style="gap:10px">' + ex + '</div>' : '') +
      '<div class="small center-text">' + t('fan_note') + '</div></div>';
    return page('<div class="row" style="gap:12px;align-items:center" data-enter>' + iconBtn('back', 'garden:' + lang, t('back')) + chip(t('learn_card'), C.PINK3, C.ROSE) + '</div>' +
      win('seed_packet.exe', inner) + btn(ico('seed', 22) + t('plant_this'), 'plant:' + sd.id), { center: true });
  }

  /* The session screen handles planting (intro + check), watering and visitors. */
  function drops() {
    var n = V.queue.length, cells = '';
    var show = Math.min(n, 10);
    for (var i = 0; i < show; i++) {
      var f = i < V.idx ? C.SKY : i === V.idx ? (V.ex && V.ex.result === false ? C.BUTTER2 : C.PINK) : '#fff', ink = i <= V.idx ? C.INK : C.SKYMID;
      cells += '<svg viewBox="0 0 20 24" width="20" height="24" aria-hidden="true"><path filter="url(#crayon)" d="M10 2C7 7 3 10 3 15a7 7 0 0014 0c0-5-4-8-7-13z" fill="' + f + '" stroke="' + ink + '" stroke-width="2"/></svg>';
    }
    return '<div class="drops" role="img" aria-label="' + (V.idx + 1) + ' / ' + n + '">' + cells + (n > 10 ? '<span class="small" style="font-weight:800">' + (V.idx + 1) + '/' + n + '</span>' : '') + '</div>';
  }
  function scrSession() {
    var ex = V.ex, info = IDX[ex.id], it = info.item, lang = info.lang, done = ex.result != null;
    var head = '<div class="row" style="gap:12px;align-items:center" data-enter>' + iconBtn('back', 'endsession', t('back')) + drops() + '</div>';
    var voice = !hasVoice(lang) && ('speechSynthesis' in window) && voices.length ? note(t('voice_missing', { lang: lang === 'ko' ? t('korean') : t('french') }), { fill: C.BUTTER, ink: '#E0C27A', color: '#4A3E1C', icon: 'speak' }) : '';
    var body = '', wname = V.mode === 'visitor' ? 'garden_gate.exe' : V.mode === 'plant' ? 'seed_packet.exe' : 'watering.exe';
    var speakBtn = function (big) {
      return box(ico('speak', big ? 40 : 24), { tag: 'button', attrs: 'type="button" data-act="say:' + ex.id + '" aria-label="' + esc(t('listen')) + '"', r: big ? 42 : 26, fill: C.PINK, bw: 2.8, shadow: C.INK, style: 'width:' + (big ? 84 : 52) + 'px;height:' + (big ? 84 : 52) + 'px;display:flex;align-items:center;justify-content:center' }) +
        box(t('slow'), { tag: 'button', attrs: 'type="button" data-act="sayslow:' + ex.id + '"', r: 22, fill: '#fff', bw: 2, ink: C.SKYMID, style: 'min-height:44px;padding:0 16px;font:800 15px/1 ' + LATIN + ';color:' + C.TXT });
    };
    var optBtn = function (o, i, inner, style) {
      var state = !done ? '' : o.ok ? 'right' : (ex.chosen === i ? 'wrong' : 'dim');
      var fill = state === 'right' ? C.MINT : state === 'wrong' ? C.SKY3 : '#fff';
      return box((state === 'right' ? '<span class="badge" data-pop-now>' + ico('check', 16, '#fff', 3) + '</span>' : '') + inner,
        { tag: 'button', attrs: 'type="button"' + (done ? ' disabled' : ' data-act="ans:' + i + '"'), r: 16, fill: fill, bw: state === 'dim' ? 2 : 2.5, ink: state === 'dim' ? C.SKYMID : C.INK, shadow: done ? null : C.INK, dash: state === 'wrong',
          style: 'color:' + C.TXT + ';' + style });
    };
    var scene = function () {
      var th = !done ? true : false;
      return '<div class="scene">' + (lang === 'ko' ? A.mochiSmall : A.croissySmall) + '<span class="can">' + (done && ex.result ? A.canPour : A.can) + '</span><span class="stack" style="align-items:center;gap:0"><span data-wiggle id="cur-plant">' + plantSvg(ex.id, Math.max(1, SRS.stage(card(ex.id))), th, 60) + '</span></span></div>';
    };
    if (ex.type === 'listen' || ex.type === 'listenword') {
      body = scene() + '<h1 class="center-text" style="font-size:23px">' + t('which_sound') + '</h1><div class="row" style="gap:10px;align-items:center;justify-content:center">' + speakBtn(true) + '</div>' +
        '<div class="grid3">' + ex.options.map(function (o, i) {
          return optBtn(o, i, '<span style="font-size:' + (o.label.length > 3 ? 22 : 44) + 'px;line-height:1.1">' + (lang === 'ko' ? koText(o.label) : '<b>' + esc(o.label) + '</b>') + '</span>', 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:104px;padding:6px');
        }).join('') + '</div>';
    } else if (ex.type === 'meaning') {
      body = scene() + '<div class="center-text stack" style="gap:4px;align-items:center"><div style="font-size:' + (it.kind === 'sentence' ? 25 : 34) + 'px;line-height:1.3">' + targetText(it) + '</div>' + romLine(it) + '</div>' +
        '<div class="row" style="justify-content:center;gap:10px">' + speakBtn(false) + '</div><h2 class="h3 center-text">' + t('what_means') + '</h2>' +
        '<div class="stack" style="gap:10px">' + ex.options.map(function (o, i) { return optBtn(o, i, '<span style="font:700 16.5px/1.3 ' + LATIN + '">' + esc(o.label) + '</span>', 'display:flex;align-items:center;min-height:56px;padding:8px 16px;text-align:left;width:100%'); }).join('') + '</div>';
    } else if (ex.type === 'reverse') {
      body = scene() + '<h1 class="center-text" style="font-size:24px">' + esc(meaning(it)) + '</h1><h2 class="h3 center-text">' + t('pick_word') + '</h2>' +
        '<div class="stack" style="gap:10px">' + ex.options.map(function (o, i) { return optBtn(o, i, '<span style="font-size:22px">' + (lang === 'ko' ? koText(o.label) : '<b>' + esc(o.label) + '</b>') + '</span>', 'display:flex;align-items:center;justify-content:center;min-height:60px;padding:8px 16px;width:100%'); }).join('') + '</div>';
    } else if (ex.type === 'build') {
      var tile = function (w, act, placed, idx) {
        return box(flower(['pink', 'yellow', 'sky', 'lilac'][hash(w) % 4], 22) + '<span>' + (lang === 'ko' ? koText(w, 19) : esc(w)) + '</span>',
          { tag: 'button', attrs: 'type="button"' + (done ? ' disabled' : ' data-act="' + act + ':' + idx + '"') + (placed ? '' : ' data-tile="' + idx + '"'), nopress: !placed, r: 14, fill: placed ? C.BUTTER : '#fff', bw: placed ? 2.4 : 2, ink: placed ? C.INK : C.SKYMID, shadow: placed ? C.INK : null,
            style: 'display:flex;flex-direction:column;align-items:center;gap:2px;min-width:56px;padding:6px 10px 8px;font:800 17px/1 ' + LATIN + ';color:' + C.TXT });
      };
      var placed = ex.placed.map(function (p, k) { return tile(ex.pool[p].w, 'untile', true, k); }).join('');
      var pool = ex.pool.map(function (p, k) { return ex.placed.indexOf(k) >= 0 ? '' : tile(p.w, 'tile', false, k); }).join('');
      body = '<div class="row" style="gap:10px;align-items:center">' + (V.mode === 'visitor' ? A.bunnySmall : (lang === 'ko' ? A.mochiSmall : A.croissySmall)) + '<div class="stack" style="gap:2px"><span class="small" style="font-weight:800">' + t('build') + '</span><span class="h3">“' + esc(meaning(it)) + '”</span></div></div>' +
        '<div class="vasezone" data-vase><div class="placed">' + (placed || '<span class="small" style="padding:18px 0">…</span>') + '</div>' + A.vase + '</div>' +
        '<span class="small">' + t('build_hint') + '</span><div class="wrap" style="gap:8px">' + pool + '</div>' +
        (done ? '' : btn(t('check'), 'checkbuild', { enter: false, attrs: ex.placed.length ? '' : 'disabled', style: ex.placed.length ? '' : 'opacity:.55' }));
    } else if (ex.type === 'reply') {
      body = '<div class="fence">' + A.fence + '</div><div class="row" style="gap:8px;align-items:flex-start"><span class="stack" style="align-items:center;flex-shrink:0">' + A.bunny + '<span class="small" style="font-weight:800">Yuna</span></span>' +
        box('<span style="font-size:21px;line-height:1.35">' + targetText(it) + '</span>' + romLine(it) + '<span class="small">' + esc(meaning(it)) + '</span><span class="row" style="gap:8px;margin-top:4px">' + speakBtn(false) + '</span>',
          { r: '4px 18px 18px 18px', fill: '#fff', style: 'display:flex;flex-direction:column;gap:4px;padding:12px 14px;flex:1' }) + '</div>' +
        '<h2 class="h3">' + t('reply') + '</h2><div class="stack" style="gap:10px">' + ex.options.map(function (o, i) {
          return optBtn(o, i, '<span style="font-size:19px;line-height:1.3">' + (lang === 'ko' ? koText(o.label) : '<b>' + esc(o.label) + '</b>') + '</span><span class="small">' + esc(o.sub) + '</span>', 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:60px;padding:10px 16px;width:100%;text-align:left');
        }).join('') + '</div>';
    } else if (ex.type === 'order') {
      body = '<div class="fence">' + A.fence + '</div><div class="row" style="gap:8px;align-items:flex-start"><span class="stack" style="align-items:center;flex-shrink:0">' + A.bunny + '<span class="small" style="font-weight:800">Yuna</span></span>' +
        box('<span style="font-size:21px;line-height:1.35">' + targetText(it) + '</span>' + romLine(it) + '<span class="small">' + esc(meaning(it)) + '</span><span class="row" style="gap:8px;margin-top:4px">' + speakBtn(false) + '</span>',
          { r: '4px 18px 18px 18px', fill: '#fff', style: 'display:flex;flex-direction:column;gap:4px;padding:12px 14px;flex:1' }) + '</div>' +
        '<h2 class="h3">' + t('your_basket') + '</h2><div class="grid3">' + ex.options.map(function (o, i) {
          var heads = ''; for (var k = 0; k < o.count; k++) heads += flower(o.color, 26);
          return optBtn(o, i, '<span class="wrap" style="justify-content:center;gap:0;max-width:84px">' + heads + '</span><span class="small" style="font-weight:800">× ' + o.count + '</span>', 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:110px;padding:8px 4px');
        }).join('') + '</div>';
    }
    var fb = '';
    if (done) {
      var right = ex.type === 'build' ? ex.answer.join(' ') : null;
      var correct = ex.options ? ex.options.filter(function (o) { return o.ok; })[0] : null;
      var answerText = right || (correct ? (correct.label || '') : '');
      if (ex.type === 'order') answerText = '× ' + it.want.count;
      var why = ex.chosen != null && ex.options && ex.options[ex.chosen] && ex.options[ex.chosen].why ? ex.options[ex.chosen].why : '';
      fb = ex.result
        ? box('<span class="h2">' + t('right') + '</span>' + (V.mode === 'visitor' ? '<span class="p">' + t('here_you_are') + '</span>' : (it.kind === 'sentence' || it.kind === 'word') ? '<span class="p">' + targetText(it) + ' · ' + esc(meaning(it)) + '</span>' : ''),
              { attrs: 'data-pop-now', r: 16, fill: C.MINT2, bw: 2, ink: '#B9E6A0', style: 'display:flex;flex-direction:column;gap:4px;padding:12px 16px' })
        : box('<span class="h2">' + esc(t('close_it_was', { a: answerText })) + '</span>' + (why ? '<span class="p" style="color:#4A3E1C">' + esc(why) + '</span>' : '') + '<span class="p" style="color:#4A3E1C">' + t('plant_got_water') + '</span>',
              { attrs: 'data-pop-now', r: 16, fill: C.BUTTER, bw: 2, ink: '#E0C27A', style: 'display:flex;flex-direction:column;gap:6px;padding:12px 16px' });
      fb += '<div class="row" style="gap:10px">' + btn(ico('speak', 22) + t('hear_again'), 'say:' + ex.id, { fill: C.PAPER, enter: false, style: 'padding:0 16px;font-size:16px' }) + btn(t('next_plant'), 'nextex', { enter: false, style: 'flex:1' }) + '</div>';
    } else if (ex.type !== 'build' && V.mode === 'water') {
      fb = '<button type="button" class="link" data-act="skipex">' + t('later') + '</button>';
    }
    return page(head + voice + win(wname, '<div class="stack" style="gap:14px">' + body + '</div>', { pad: '14px 16px 16px', shadow: V.mode === 'visitor' ? C.PINK2 : C.SKY }) + fb, {});
  }
  function scrIntro() {
    // Planting: meet each item before its quick check.
    var it = IDX[V.queue[V.idx]].item, lang = IDX[it.id].lang;
    var inner = '<div class="stack center-text" style="gap:10px;align-items:center">' + '<span data-pop>' + plantSvg(it.id, 1, false, 70) + '</span>' +
      '<div style="font-size:' + (it.kind === 'sentence' || it.kind === 'dialogue' || it.kind === 'order' ? 26 : 40) + 'px;line-height:1.3">' + targetText(it) + '</div>' + romLine(it) +
      '<div class="h3">' + esc(meaning(it)) + '</div>' +
      '<div class="row" style="gap:10px;justify-content:center">' + box(ico('speak', 24), { tag: 'button', attrs: 'type="button" data-act="say:' + it.id + '" aria-label="' + esc(t('listen')) + '"', r: 26, fill: C.PINK, bw: 2.8, shadow: C.INK, style: 'width:56px;height:56px;display:flex;align-items:center;justify-content:center' }) +
      box(t('slow'), { tag: 'button', attrs: 'type="button" data-act="sayslow:' + it.id + '"', r: 22, fill: '#fff', bw: 2, ink: C.SKYMID, style: 'min-height:44px;padding:0 16px;font:800 15px/1 ' + LATIN + ';color:' + C.TXT }) + '</div>' +
      '<p class="small">' + t('say_it') + '</p></div>';
    return page('<div class="row" style="gap:12px;align-items:center" data-enter>' + iconBtn('back', 'endsession', t('back')) + drops() + '</div>' + win('seed_packet.exe', inner) + btn(t('next'), 'introdone'), { center: true });
  }
  function scrHarvest() {
    var it = IDX[V.itemId].item;
    var inner = '<div class="stack center-text" style="gap:12px;align-items:center"><div class="row" style="align-items:flex-end;gap:2px">' + A.mochiOpen +
      '<span class="stack" style="align-items:center;gap:0"><span data-pop data-wiggle>' + plantSvg(it.id, 4, false, 92) + '</span></span>' + A.croissyOpen + '</div>' +
      '<h1>' + t('bloomed') + '</h1><div style="font-size:24px">' + targetText(it) + '</div><p class="p">' + t('bloomed_sub') + '</p>' +
      box('<span class="row" style="gap:0">' + flower(IDX[it.id].lang === 'ko' ? 'pink' : 'yellow', 26) + flower(IDX[it.id].lang === 'ko' ? 'pink' : 'yellow', 26) + '</span><span style="font:700 15px/1.3 ' + LATIN + '">' + t('flowers_for_basket', { n: 2 }) + '</span>',
        { attrs: 'data-enter', r: 14, fill: '#fff', bw: 2, ink: C.SKYMID, style: 'display:flex;align-items:center;gap:10px;padding:8px 14px;width:100%;box-sizing:border-box' }) +
      btn(t('keep_watering'), 'harvestdone') + '</div>';
    return page(win('harvest.exe', inner, { shadow: C.PINK2 }), { center: true });
  }
  function scrDone() {
    var inner = '<div class="stack center-text" style="gap:12px;align-items:center"><div class="mascots">' + A.mochiOpen + A.croissyOpen + '</div>' +
      '<h1>' + (V.empty ? t('none_thirsty') : t('done_watering')) + '</h1><p class="p">' + (V.empty ? t('nothing_due') : t('done_watering_sub', { n: V.count || 0 })) + '</p>' +
      (V.sticker ? box(A.sticker + '<span style="font:800 15px/1.3 ' + LATIN + '">' + esc(L(META.stickers.filter(function (s) { return s.id === V.sticker; })[0] || { en: '' })) + '</span>', { attrs: 'data-pop-now', r: 14, fill: C.PINK3, bw: 2, ink: C.ROSE, style: 'display:flex;align-items:center;gap:10px;padding:8px 14px' }) : '') +
      (V.empty ? btn(ico('drop', 22) + t('water_early'), 'waterearly:' + (V.lang || 'both'), { fill: C.PAPER }) : '') +
      btn(t('back_to_garden'), V.lang && V.lang !== 'both' ? 'garden:' + V.lang : 'home') + '</div>';
    return page(win('watering.exe', inner, { shadow: C.MINT }), { center: true });
  }
  function scrBasket() {
    var fl = ['pink', 'yellow', 'sky', 'lilac'].map(function (c) {
      return box(flower(c, 40) + '<span style="font:800 16px/1 ' + LATIN + '">× ' + S.inv.flowers[c] + '</span>', { r: 14, fill: '#fff', bw: 2, ink: C.SKYMID, style: 'display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px' });
    }).join('');
    var st = META.stickers.map(function (s) {
      var got = S.inv.stickers.indexOf(s.id) >= 0;
      return box((got ? A.sticker : '<span style="opacity:.35">' + A.sticker + '</span>') + '<span style="font:800 12.5px/1.2 ' + LATIN + ';text-align:center' + (got ? '' : ';color:#7C8394') + '">' + esc(L(s)) + '</span>',
        { r: 14, fill: got ? C.PINK3 : '#fff', bw: 2, ink: got ? C.ROSE : C.SKYMID, dash: !got, style: 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px' });
    }).join('');
    return page('<h1 data-enter>' + t('basket_title') + '</h1>' + win('basket.exe', '<div class="stack"><h2 class="h3">' + t('flowers') + '</h2><div class="grid4">' + fl + '</div>' +
      '<h2 class="h3">' + t('stickers') + '</h2><div class="grid4">' + st + '</div>' + (S.inv.stickers.length ? '' : '<p class="small">' + t('no_stickers') + '</p>') + '</div>'), { tabs: 'basket' });
  }
  function weekMinutes(offsetWeeks) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var dow = (d.getDay() + 6) % 7; var start = d.getTime() - dow * DAY - offsetWeeks * 7 * DAY;
    var mins = [0, 0, 0, 0, 0, 0, 0];
    S.logs.forEach(function (l) { var i = Math.floor((l[1] - start) / DAY); if (i >= 0 && i < 7) mins[i] += l[3] / 60000; });
    return mins.map(function (m) { return Math.round(m * 10) / 10; });
  }
  function scrGrowth() {
    var a = weekMinutes(0), b = weekMinutes(1), max = Math.max(5, Math.max.apply(null, a.concat(b)));
    var bar = function (v, f, ink) { return v ? box('', { tag: 'span', attrs: 'data-pop', r: '6px 6px 0 0', fill: f, bw: 2, ink: ink, style: 'display:block;width:15px;height:' + Math.max(6, Math.round(v / max * 120)) + 'px' }) : '<span style="display:block;width:15px"></span>'; };
    var cols = a.map(function (v, i) { return '<div class="barcol">' + bar(v, C.PINK, C.INK) + bar(b[i], C.SKY, C.BLUE) + '</div>'; }).join('');
    var days = (S.profile.ui === 'vi' ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map(function (x) { return '<span>' + x + '</span>'; }).join('');
    var sum = function (x) { return x.reduce(function (p, c) { return p + c; }, 0); };
    var aria = t('this_week') + ': ' + a.join(', ') + '. ' + t('last_week') + ': ' + b.join(', ') + '.';
    var stat = function (lang, title, fill) {
      return box('<span class="row" style="justify-content:space-between;align-items:flex-start"><span style="font:' + (lang === 'ko' ? '400 17px/1.2 ' + KO : '800 17px/1.2 ' + LATIN) + '">' + title + '</span>' + plantSvg(lang + 'st', 4, false, 30) + '</span>' +
        '<span style="font:800 30px/1 ' + LATIN + '">' + plantedItems(lang).length + '</span><span class="small" style="font-weight:700">' + t('plants') + ' · ' + bloomCount(lang) + ' ' + t('in_bloom') + '</span>',
        { r: 14, fill: fill, bw: 2.5, style: 'flex:1;display:flex;flex-direction:column;gap:2px;padding:10px 12px' });
    };
    var inner = '<div class="stack" style="gap:12px"><div><h1 style="font-size:25px">' + t('growth_title') + '</h1><p class="small" style="font-weight:700;margin:3px 0 0">' + t('growth_sub') + '</p></div>' +
      '<div class="row small" style="gap:16px;font-weight:800;color:' + C.TXT + '"><span class="key"><i style="background:' + C.PINK + ';border-color:' + C.INK + '"></i>' + t('this_week') + '</span><span class="key"><i style="background:' + C.SKY + ';border-color:' + C.BLUE + '"></i>' + t('last_week') + '</span></div>' +
      '<div role="img" aria-label="' + esc(aria) + '"><div class="chart">' + cols + '</div><div class="days">' + days + '</div></div>' +
      box(esc(t('growth_compare', { a: Math.round(sum(a)), b: Math.round(sum(b)) })), { r: 14, fill: C.PINK3, bw: 2, ink: C.ROSE, style: 'padding:11px 14px;font:800 16px/1.35 ' + LATIN }) +
      '<div class="row" style="gap:10px">' + stat('ko', '한국어 정원', C.PINK3) + stat('fr', 'Jardin', C.BUTTER) + '</div></div>';
    return page(win('growth.exe', inner, { attrs: 'data-rubber' }) + note(t('private')), { tabs: 'growth', center: true });
  }
  function scrSettings() {
    var seg = function (key, opts, val) {
      var n = opts.length, i0 = Math.max(0, opts.findIndex(function (o) { return o[0] === val; }));
      return box('<span class="segind" aria-hidden="true" style="width:' + (100 / n) + '%;transform:translateX(' + (i0 * 100) + '%)"><span></span></span>' + opts.map(function (o, i) {
        return '<button type="button" class="segbtn" data-press data-act="set:' + key + ':' + o[0] + '" aria-pressed="' + (i === i0) + '" style="color:' + (i === i0 ? '#fff' : C.TXT) + '">' + o[1] + '</button>';
      }).join(''), { r: 14, fill: '#fff', style: 'display:flex;overflow:hidden' });
    };
    var sw = function (key, label, sub) {
      var on = key === 'lite' ? isLite() : !!S.profile[key];
      return '<div class="setrow"><span><span class="h3" style="display:block">' + label + '</span>' + (sub ? '<span class="small" style="display:block;margin-top:2px">' + sub + '</span>' : '') + '</span>' +
        '<button type="button" role="switch" class="switch" aria-checked="' + on + '" aria-label="' + esc(label) + '" data-act="toggle:' + key + '"><span class="track" style="background:' + (on ? C.INK : C.SKYMID) + '"><span class="knob" style="transform:translateX(' + (on ? 0 : -22) + 'px)"></span></span></button></div>';
    };
    var inner = '<div class="stack" style="gap:0">' +
      '<div class="setrow col"><span class="h3">' + t('menu_language') + '</span>' + seg('ui', [['en', 'English'], ['vi', 'Tiếng Việt']], S.profile.ui) + '</div>' +
      sw('music', t('music')) + sw('sound', t('sound'), t('sound_sub')) + sw('rom', t('romanization'), t('romanization_sub')) + sw('lite', t('lite'), t('lite_sub')) +
      '<div class="setrow col"><span class="h3">' + t('daily') + '</span>' + seg('daily', [[5, t('min5')], [10, t('min10')], [15, t('min15')]], S.profile.daily) + '</div>' +
      '<button type="button" class="setrow linkrow" data-act="editfaves"><span><span class="h3" style="display:block">' + t('my_faves') + '</span><span class="small">' + esc(favesList().map(function (g) { return g.name; }).join(', ')) + '</span></span>' + ico('next') + '</button></div>';
    var backup = box('<span class="h2">' + t('backup') + '</span><span class="p" style="color:' + C.MINTTXT + '">' + t('backup_sub') + '</span>' +
      '<span class="row" style="gap:10px">' + btn(t('export'), 'export', { small: true, enter: false, style: 'flex:1;font-size:16px;padding:0 8px' }) + btn(t('import'), 'import', { fill: C.PAPER, small: true, enter: false, style: 'flex:1;font-size:16px' }) + '</span>' +
      (V.msg ? '<span class="p" style="font-weight:800;color:' + C.MINTTXT + '">' + esc(V.msg) + '</span>' : '') +
      '<input type="file" accept="application/json,.json" id="importfile" hidden>',
      { attrs: 'data-enter', r: 16, fill: C.MINT2, style: 'display:flex;flex-direction:column;gap:8px;padding:14px 16px' });
    return page('<div class="row" style="gap:12px;align-items:center" data-enter>' + iconBtn('back', 'home', t('back')) + '<h1 style="font-size:28px">' + t('settings') + '</h1></div>' +
      win('settings.exe', inner, { pad: '2px 16px 8px' }) + backup +
      '<button type="button" class="link" data-act="reset" style="color:#8A3B57">' + (V.confirmReset ? t('reset_confirm') : t('reset')) + '</button>' +
      '<p class="small center-text">' + t('fan_note') + '</p>', {});
  }
  function scrWelcome() {
    var due = dueItems('both').length;
    var card2 = function (act, art, t1, t2, cta, fill) {
      return box('<span class="row" style="gap:12px;align-items:center">' + art + '<span><span class="h3" style="display:block">' + t1 + '</span><span class="small" style="font-weight:700">' + t2 + '</span></span></span><span style="font:800 16px/1 ' + LATIN + '">' + cta + '</span>',
        { tag: 'button', attrs: 'type="button" data-act="' + act + '" data-enter', r: 16, fill: fill, shadow: C.INK, style: 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 14px 8px 8px;min-height:68px;width:100%;text-align:left;color:' + C.TXT });
    };
    var vid = visitorDue();
    var inner = '<div class="stack center-text" style="gap:12px;align-items:center"><div class="mascots">' + A.mochi + A.croissy + '</div>' +
      '<div><h1>' + t('welcome_back') + '</h1><p class="p" style="margin-top:6px">' + t('welcome_back_sub') + '</p></div>' +
      '<div class="stack" style="gap:10px;width:100%">' + (due ? card2('water:both', A.canSmall, t('water_them'), t('n_thirsty', { n: due }), t('start'), C.PINK2) : '') +
      (vid ? card2('visitor:' + vid, A.bunnySmall, t('visitor'), t('visitor_wait', { name: 'Yuna' }), '→', C.SKY3) : '') + '</div>' +
      note(t('saved')) + '<button type="button" class="link" data-act="home">' + t('desktop') + '</button></div>';
    return page(win('welcome_back.exe', inner), { center: true });
  }

  /* ------------------------------------------------------------------ render + actions */
  var sheetApi = null;
  function render(enter) {
    var fn = { lang: scrLang, faves: scrFaves, tour: scrTour, install: scrInstall, home: scrHome, garden: scrGarden, learn: scrLearn,
               session: scrSession, intro: scrIntro, harvest: scrHarvest, done: scrDone, basket: scrBasket, growth: scrGrowth, settings: scrSettings, welcome: scrWelcome }[V.screen];
    if (!fn) return;
    document.documentElement.lang = S.profile.ui;
    var sc = $app.querySelector('.scroll'), keep = !enter && sc ? sc.scrollTop : 0;
    $app.innerHTML = fn();
    var sc2 = $app.querySelector('.scroll'); if (sc2 && keep) sc2.scrollTop = keep;
    Motion.wire($app, { enter: !!enter });
    sheetApi = null;
    var sh = $app.querySelector('[data-sheet]');
    if (sh) sheetApi = Motion.sheet(sh, $app.querySelector('[data-scrim]'));
    $app.querySelectorAll('[data-tile]').forEach(function (el) {
      Motion.draggable(el, function (d) {
        if (!d.moved) return;
        el.__suppress = true;
        var zone = $app.querySelector('[data-vase]');
        if (!zone) return;
        var r = zone.getBoundingClientRect();
        if (d.x >= r.left && d.x <= r.right && d.y >= r.top - 20 && d.y <= r.bottom) act('tile:' + el.getAttribute('data-tile'));
      });
    });
    if (V.focus) { var f = $app.querySelector(V.focus); if (f) f.focus(); V.focus = null; }
  }

  function act(a, el) {
    var p = a.split(':'), cmd = p[0], arg = p[1], arg2 = p[2];
    switch (cmd) {
      case 'go': go(arg); break;
      case 'ui': S.profile.ui = arg; save(); render(false); break;
      case 'fave':
        var i = S.profile.faves.indexOf(arg);
        if (i >= 0) S.profile.faves.splice(i, 1); else S.profile.faves.push(arg);
        save(); render(false); break;
      case 'fave-surprise':
        S.profile.faves = shuffle(META.groups.map(function (g) { return g.id; })).slice(0, 3); save(); render(false); break;
      case 'tour-next': if (isStandalone()) act('finish-onboard'); else go('install'); break;
      case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } break;
      case 'finish-onboard': S.profile.onboarded = true; save(); Store.persist(); go('home'); break;
      case 'home': go('home'); break;
      case 'settings': go('settings'); break;
      case 'basket': go('basket'); break;
      case 'growth': go('growth'); break;
      case 'garden': go('garden', { lang: arg }); break;
      case 'plot': V.plot = +arg; render(false); break;
      case 'seeds': if (sheetApi) { $app.querySelector('[data-sheetbody]').innerHTML = seedsSheet(V.lang); Motion.wire($app.querySelector('[data-sheetbody]'), {}); sheetApi.open(0); } break;
      case 'plantinfo': if (sheetApi) { $app.querySelector('[data-sheetbody]').innerHTML = plantSheet(arg); Motion.wire($app.querySelector('[data-sheetbody]'), {}); sheetApi.open(0); } break;
      case 'learn': go('learn', { seedId: arg }); break;
      case 'plant':
        var sd = SEEDS[arg];
        var ids = sd.items.map(function (it) { return it.id; });
        V = { screen: 'intro', mode: 'plant', seedId: arg, lang: sd.lang, queue: ids, idx: 0, done: 0, retried: {}, blooms: [], t0: now() };
        render(true); setTimeout(function () { if (S.profile.sound && V.screen === 'intro') sayItem(IDX[ids[0]].item); }, 400); break;
      case 'introdone':
        V.introMs = now() - (V.t0 || now());
        V.screen = 'session'; V.ex = makeExercise(V.queue[V.idx]); V.ex.t0 = now(); render(true); autoSay(); break;
      case 'water': startSession('water', arg); break;
      case 'waterearly':
        var ids2 = (arg === 'both' ? Object.keys(S.cards) : plantedItems(arg)).filter(function (id) { return IDX[id]; }).sort(function (a, b) { return S.cards[a].due - S.cards[b].due; });
        startSession('water', arg, ids2); break;
      case 'water1': startSession('water', IDX[arg].lang, [arg]); break;
      case 'visitor': go('session', { mode: 'visitor', lang: IDX[arg].lang, queue: [arg], idx: 0, ex: makeExercise(arg), done: 0, retried: {}, blooms: [] }); autoSay(); break;
      case 'say': sayItem(IDX[arg].item, false); break;
      case 'sayslow': sayItem(IDX[arg].item, true); break;
      case 'ans': answer(+arg); break;
      case 'tile': if (V.ex.placed.indexOf(+arg) < 0) { V.ex.placed.push(+arg); render(false); } break;
      case 'untile': V.ex.placed.splice(+arg, 1); render(false); break;
      case 'checkbuild':
        var got = V.ex.placed.map(function (k) { return V.ex.pool[k].w; }).join(' ');
        finish(got === V.ex.answer.join(' ')); break;
      case 'skipex': advance(); break;
      case 'nextex': advance(); break;
      case 'harvestdone': V = V.resume; render(true); autoSay(); break;
      case 'endsession': endSession(); break;
      case 'set':
        var btns0 = Array.prototype.slice.call($app.querySelectorAll('[data-act^="set:' + arg + ':"]'));
        var prevI = btns0.findIndex(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
        if (arg === 'daily') S.profile.daily = +arg2; else S.profile[arg] = arg2;
        save(); render(false);
        var btns1 = Array.prototype.slice.call($app.querySelectorAll('[data-act^="set:' + arg + ':"]'));
        var newI = btns1.findIndex(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
        if (btns1.length && prevI >= 0 && arg !== 'ui') {
          var cont = btns1[0].parentNode, ind = cont.querySelector('.segind'), w = cont.clientWidth / btns1.length;
          ind.style.left = '0';
          Motion.slide(ind, prevI * w, newI * w);
        }
        break;
      case 'toggle':
        var was = arg === 'lite' ? isLite() : !!S.profile[arg];
        S.profile[arg] = !was; save(); render(false);
        if (arg === 'music' && window.Music) Music.set(S.profile.music);
        if (arg === 'lite') applyLite();
        var knob = $app.querySelector('[data-act="toggle:' + arg + '"] .knob');
        if (knob) Motion.slide(knob, was ? 0 : -22, was ? -22 : 0);
        break;
      case 'editfaves': go('faves', { from: 'settings' }); break;
      case 'export': exportSave(); break;
      case 'import': var fi = $app.querySelector('#importfile'); if (fi) { fi.onchange = importSave; fi.click(); } break;
      case 'reset':
        if (!V.confirmReset) { V.confirmReset = true; render(false); return; }
        S = freshSave(); save(); go('lang'); break;
    }
  }
  function answer(i) {
    var ex = V.ex;
    if (ex.result != null) return;
    ex.chosen = i;
    finish(!!ex.options[i].ok);
  }
  function finish(ok) {
    var ex = V.ex, ms = now() - (ex.t0 || now()) + (V.screen === 'session' && V.mode === 'plant' ? (V.introMs || 0) : 0);
    ex.result = ok;
    var id = ex.id, info = IDX[id];
    var bloomed = rate(id, ok, ms);
    if (V.mode === 'visitor' && ok) { S.stats.visitors++; S.inv.flowers.lilac += 1; checkStickers(); save(); }
    if (!ok && V.mode !== 'visitor' && !V.retried[id]) { V.retried[id] = true; V.queue.push(id); }
    if (bloomed) V.blooms.push(id);
    V.done++;
    render(false);
    var plantEl = $app.querySelector('#cur-plant');
    if (plantEl) Motion.nudge(plantEl);
    if (!ok) { var w = $app.querySelector('.win'); }
  }
  function advance() {
    if (V.blooms && V.blooms.length) {
      var id = V.blooms.shift(), resume = V;
      resume.idx++;
      if (resume.idx >= resume.queue.length) { V = { screen: 'harvest', itemId: id, resume: doneState(resume) }; render(true); return; }
      prepareNext(resume);
      V = { screen: 'harvest', itemId: id, resume: resume }; render(true); return;
    }
    V.idx++;
    if (V.idx >= V.queue.length) { V = doneState(V); render(true); return; }
    prepareNext(V);
    render(true); autoSay();
  }
  function prepareNext(st) {
    if (st.mode === 'plant') { st.screen = 'intro'; st.t0 = now(); var sid = st.queue[st.idx]; if (S.profile.sound) setTimeout(function () { if (V.screen === 'intro' && IDX[sid]) sayItem(IDX[sid].item); }, 400); }
    else { st.screen = 'session'; st.ex = makeExercise(st.queue[st.idx]); }
  }
  function doneState(st) {
    if (st.mode === 'plant') {
      if (S.planted[st.lang].indexOf(st.seedId) < 0) S.planted[st.lang].push(st.seedId);
      checkStickers(); save();
      return { screen: 'garden', lang: st.lang };
    }
    if (st.mode === 'visitor') return { screen: 'garden', lang: st.lang };
    var today = new Date().toDateString();
    if (S.lastDaily !== today && st.done >= 5) { S.lastDaily = today; S.inv.flowers.sky += 1; }
    var sticker = V.newSticker; V.newSticker = null;
    save();
    return { screen: 'done', count: st.done, lang: st.lang, sticker: sticker };
  }
  function endSession() {
    if (V.mode === 'plant') { go('garden', { lang: V.lang }); return; }
    if (V.done) { V = doneState(V); render(true); return; }
    go(V.lang && V.lang !== 'both' ? 'garden' : 'home', { lang: V.lang });
  }

  function exportSave() {
    Store.flush();
    var blob = new Blob([JSON.stringify({ app: 'seoul-paris-garden', exported: new Date().toISOString(), save: S }, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'garden-save-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function importSave(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result), s = d.save || d;
        if (!s || !s.profile || !s.cards || !s.planted) throw new Error('bad');
        S = Object.assign(freshSave(), s);
        if (S.profile.music === undefined) S.profile.music = true;
        if (window.Music) Music.set(S.profile.music);
        applyLite();
        save(); Store.flush();
        V.msg = t('import_ok');
      } catch (x) { V.msg = t('import_bad'); }
      render(false);
    };
    r.readAsText(f);
  }

  $app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.__suppress) { el.__suppress = false; return; }
    e.preventDefault();
    act(el.getAttribute('data-act'), el);
  });

  /* ------------------------------------------------------------------ install + boot */
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (V.screen === 'install') render(false); });
  function isStandalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }

  function indexData() {
    ['ko', 'fr'].forEach(function (lang) {
      DATA[lang].seeds.forEach(function (sd) {
        sd.lang = lang; SEEDS[sd.id] = sd;
        sd.items.forEach(function (it) { IDX[it.id] = { item: it, seed: sd.id, stage: sd.stage, lang: lang }; });
      });
    });
  }
  function getJSON(u) {
    // On a web host the JSON file is the source. When the page is opened from disk (file://),
    // fetch() is blocked, so fall back to the same data bundled in js/data.js.
    var key = u.replace('data/', '').replace('.json', '');
    return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); })
      .catch(function (err) {
        if (window.GARDEN_DATA && window.GARDEN_DATA[key]) return window.GARDEN_DATA[key];
        throw err;
      });
  }

  /* ---------------------------------------------------------- smooth mode
     The hand-drawn wobble is made by SVG filters, which phones draw slowly. "Smooth mode" turns them
     off (clean lines instead). It is on by default on touch screens; the player can choose either way
     in Settings, and that saved choice always wins. */
  var TOUCH = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  function isLite() { return S && S.profile.lite !== undefined ? !!S.profile.lite : TOUCH; }
  function applyLite() { document.documentElement.classList.toggle('lite', isLite()); }

  function boot() {
    var bg = document.getElementById('bg');
    bg.innerHTML = A.defs + A.background;
    Promise.all([getJSON('data/ko.json'), getJSON('data/fr.json'), getJSON('data/ui.json'), getJSON('data/meta.json'), Store.load()]).then(function (r) {
      DATA.ko = r[0]; DATA.fr = r[1]; UI = r[2]; META = r[3];
      indexData();
      S = r[4] ? Object.assign(freshSave(), r[4]) : freshSave();
      if (S.profile.music === undefined) S.profile.music = true;   // gardens saved before music existed
      if (window.Music) Music.set(S.profile.music);
      applyLite();
      // Drop cards whose items were removed from the database in an update.
      Object.keys(S.cards).forEach(function (id) { if (!IDX[id]) delete S.cards[id]; });
      var away = now() - (S.lastVisit || now());
      if (!S.profile.onboarded) go('lang');
      else if (away > 2 * DAY) go('welcome');
      else go('home');
      save();
    }).catch(function (err) {
      $app.innerHTML = '<div class="screen"><div class="col center"><p class="p" style="padding:40px 24px">Could not load the garden data. Please reload.<br><small>' + esc(err && err.message) + '</small></p></div></div>';
    });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
    }
  }
  var rz = null;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (S && V.screen !== 'boot') render(false); }, 200); });
  window.__garden = { act: act, state: function () { return { V: V, S: S }; } };
  boot();
})();
