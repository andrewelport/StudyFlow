/* ============================================================================
   StudyFlow Premium — AI Weekly Planner  (additive IIFE module)
   Self-contained. Reuses app globals: isPremium, save, toast, ld, uid,
   getAvailableSlots, isTimeInFreeWindow, _buildPerformanceInsights,
   _wrGetTargetRange, confirmWeeklyPlan, callAI, extractJSON, escapeHtml,
   timeToMins, renderWeeklyReview. Namespaced _aiwp* / window.AIWP, ids #aiwp-*.
   Premium surfaces use NO emojis — line-art SVG only.
   ========================================================================== */
(function () {
  'use strict';

  // ---- tiny helpers (fall back gracefully if app globals absent) ----------
  const _esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? '')) : String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const _ld = (d) => (window.ld ? window.ld(d) : new Date(d).toISOString().slice(0, 10));
  const _toast = (m) => (window.toast ? window.toast(m) : null);
  // `save` is `const save` in app_v58.js — NOT on window, but reachable via shared script scope
  function _save() { try { save(); } catch (e) { if (window.save) window.save(); } }
  const _t2m = (t) => { const p = String(t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
  const _m2t = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  // ---- line-art SVG icon set (consistent, no emoji) ------------------------
  const ICON = {
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13a3 3 0 1 0 3 3"/><path d="M12 13l4-4"/><path d="M4 19a9 9 0 1 1 16 0"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 4 3 3 0 0 0 5 1V4.5A2.5 2.5 0 0 0 9 4z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 4 3 3 0 0 1-5 1"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    avatar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M9.5 11a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };

  // ---- hero illustrations per step (viewBox 160x120, accent line-art) ------
  function _illus(kind) {
    const A = 'var(--accent)', P = 'var(--purple)', L = 'var(--accent-light)';
    const wrap = (inner) => `<svg class="aiwp-illus" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
    switch (kind) {
      case 'capacity':
        return wrap(`<rect x="30" y="74" width="100" height="10" rx="5" fill="${L}"/><path d="M35 79a45 30 0 0 1 90 0" stroke="${A}" stroke-width="2" stroke-linecap="round"/><line x1="80" y1="79" x2="104" y2="50" stroke="${P}" stroke-width="2.5" stroke-linecap="round"/><circle cx="80" cy="79" r="5" fill="${A}"/>`);
      case 'exceptions':
        return wrap(`<rect x="34" y="30" width="92" height="68" rx="8" stroke="${A}" stroke-width="2"/><line x1="34" y1="46" x2="126" y2="46" stroke="${A}" stroke-width="2"/><line x1="57" y1="46" x2="57" y2="98" stroke="${L}" stroke-width="2"/><line x1="80" y1="46" x2="80" y2="98" stroke="${L}" stroke-width="2"/><line x1="103" y1="46" x2="103" y2="98" stroke="${L}" stroke-width="2"/><rect x="59" y="60" width="19" height="34" rx="3" fill="${L}"/><line x1="62" y1="66" x2="75" y2="88" stroke="${P}" stroke-width="2.5" stroke-linecap="round"/><line x1="75" y1="66" x2="62" y2="88" stroke="${P}" stroke-width="2.5" stroke-linecap="round"/>`);
      case 'priority':
        return wrap(`<circle cx="80" cy="62" r="34" stroke="${A}" stroke-width="2"/><circle cx="80" cy="62" r="20" stroke="${A}" stroke-width="2"/><circle cx="80" cy="62" r="6" fill="${P}"/><line x1="80" y1="62" x2="120" y2="30" stroke="${P}" stroke-width="2.5" stroke-linecap="round"/><path d="M112 26l9 1-3 9z" fill="${P}"/>`);
      case 'thinking':
        return wrap(`<path d="M62 30a18 18 0 0 0-6 35 12 12 0 0 0 8 16 10 10 0 0 0 16 3V32a4 4 0 0 0-4-4z" stroke="${A}" stroke-width="2"/><path d="M98 30a18 18 0 0 1 6 35 12 12 0 0 1-8 16 10 10 0 0 1-16 3" stroke="${A}" stroke-width="2"/><circle cx="68" cy="55" r="3" fill="${P}"/><circle cx="92" cy="50" r="3" fill="${P}"/><circle cx="80" cy="72" r="3" fill="${P}"/>`);
      default:
        return wrap(`<rect x="34" y="34" width="92" height="60" rx="10" stroke="${A}" stroke-width="2"/><line x1="48" y1="56" x2="112" y2="56" stroke="${L}" stroke-width="3" stroke-linecap="round"/><line x1="48" y1="72" x2="92" y2="72" stroke="${L}" stroke-width="3" stroke-linecap="round"/>`);
    }
  }

  // ========================================================================
  //  STATE
  // ========================================================================
  let _flow = null; // { week, answers:{capacity, blockedDays, focusCourses}, chat:[], freeText, context, plan }

  function _data() { return (typeof S !== 'undefined') ? S : (window.S || {}); }
  function _planner() { const s = _data(); if (!s.aiPlanner) s.aiPlanner = { memo: '', prefs: {}, history: [], memoUpdatedDate: null }; return s.aiPlanner; }

  // ========================================================================
  //  ENTRY CARD  (rendered into #page-weekly-review when premium)
  // ========================================================================
  function maybeRenderEntry() {
    const page = document.getElementById('page-weekly-review');
    if (!page) return false;
    let root = document.getElementById('aiwp-root');

    if (!window.isPremium || !window.isPremium()) {
      // free user — restore native flow AND show a locked premium teaser on top
      if (root) root.remove();
      const a = document.getElementById('wr-active');
      if (a) a.style.display = ''; // wr-done visibility controlled by native code
      _renderTeaser(page);
      return false; // native free flow renders below the teaser
    }

    // premium — take over the page, remove the teaser
    _removeTeaser();
    const dn = document.getElementById('wr-done'); const av = document.getElementById('wr-active');
    if (dn) dn.classList.add('hidden');
    if (av) av.style.display = 'none';
    if (!root) { root = document.createElement('div'); root.id = 'aiwp-root'; page.appendChild(root); }
    root.innerHTML = _entryHTML();
    return true;
  }

  // FREE users see the FULL premium feature card (locked). They can open & browse the
  // questionnaire to experience it; the value moment (building the schedule) opens the paywall.
  function _renderTeaser(page) {
    let t = document.getElementById('aiwp-teaser');
    if (!t) {
      t = document.createElement('div');
      t.id = 'aiwp-teaser';
      const header = page.querySelector('.page-header');
      if (header && header.nextSibling) page.insertBefore(t, header.nextSibling);
      else page.insertBefore(t, page.firstChild);
    }
    t.innerHTML = _entryHTML({ locked: true });
  }
  function _removeTeaser() { const t = document.getElementById('aiwp-teaser'); if (t) t.remove(); }

  function _entryHTML(opts) {
    const locked = !!(opts && opts.locked);
    const range = (window._wrGetTargetRange ? window._wrGetTargetRange() : { label: 'השבוע', end: '' });
    const pl = _planner();
    const lastPlan = (pl.history || []).slice(-1)[0];
    const memoLine = (!locked && pl.memo)
      ? `<div class="aiwp-memo"><span class="aiwp-memo-ic">${ICON.brain}</span><span>${_esc(pl.memo)}</span></div>`
      : '';
    const badge = locked
      ? `<div class="aiwp-badge aiwp-badge-locked">${ICON.lock}<span>פרימיום · נעול</span></div>`
      : `<div class="aiwp-badge">${ICON.spark}<span>תכנון AI · פרימיום</span></div>`;
    const cta = locked
      ? `<button class="aiwp-cta" onclick="AIWP.openPaywall()">${ICON.spark}<span>שדרג לפרימיום</span></button>
         <div class="aiwp-entry-foot">בניית לוז עם AI פתוחה למנויי פרימיום</div>`
      : `<button class="aiwp-cta" onclick="AIWP.startFlow()">${ICON.spark}<span>בנה לי לוז חכם</span></button>
         ${lastPlan ? `<div class="aiwp-entry-foot">תוכנן לאחרונה: ${_esc(lastPlan.date || '')} · ${(lastPlan.added || 0)} משימות</div>` : ''}`;
    const link = locked
      ? `<button class="aiwp-link" onclick="AIWP.openPaywall()">מה כולל פרימיום?</button>`
      : `<button class="aiwp-link" onclick="AIWP.openSettings()">הגדרות פרימיום</button>`;
    return `
      <div class="aiwp-entry${locked ? ' aiwp-entry-locked' : ''}">
        ${badge}
        <div class="aiwp-entry-illus">${_illus('default')}</div>
        <div class="aiwp-entry-title">תכנון השבוע עם בינה מלאכותית</div>
        <div class="aiwp-entry-sub">סוכן ה-AI לומד את ההרגלים שלך ובונה לוז אופטימלי ל${_esc(range.label)} — תוך התחשבות במבחנים, עוגנים, חלונות פנויים והביצועים שלך.</div>
        ${memoLine}
        ${cta}
        ${link}
      </div>`;
  }

  // ========================================================================
  //  FLOW OVERLAY  (questionnaire / chat / preview)
  // ========================================================================
  function _ensureOverlay() {
    let o = document.getElementById('aiwp-flow');
    if (!o) {
      o = document.createElement('div');
      o.id = 'aiwp-flow';
      o.className = 'modal-overlay aiwp-overlay hidden';
      o.innerHTML = `<div class="aiwp-sheet"><button class="aiwp-close" onclick="AIWP.closeFlow()" aria-label="סגור">&times;</button><div id="aiwp-body"></div></div>`;
      document.body.appendChild(o);
    }
    return o;
  }
  function _openOverlay() { const o = _ensureOverlay(); o.classList.remove('hidden'); if (window._setBodyLock) window._setBodyLock(true); }
  function closeFlow() { const o = document.getElementById('aiwp-flow'); if (o) o.classList.add('hidden'); if (window._setBodyLock) window._setBodyLock(false); }
  function _body() { return document.getElementById('aiwp-body'); }

  function startFlow() {
    const s = _data();
    if (!(s.courses || []).length) { _toast('כדי לבנות לוז צריך קודם להגדיר קורסים'); if (window.showPage) window.showPage('planner', null); return; }
    const range = window._wrGetTargetRange();
    _flow = { week: (range.label === 'שבוע הבא' ? 'next' : 'this'), answers: { capacity: null, blockedDays: [], focusCourses: [] }, chat: [], freeText: '', context: null, plan: null, step: 0 };
    _openOverlay();
    _renderStep();
  }

  // --- step framework -------------------------------------------------------
  const STEPS = ['week', 'capacity', 'exceptions', 'priority', 'extra'];

  function _renderStep() {
    const i = _flow.step;
    const key = STEPS[i];
    const total = STEPS.length;
    const prog = Math.round((i / (total - 1)) * 100);
    let inner = '';
    if (key === 'week') inner = _stepWeek();
    else if (key === 'capacity') inner = _stepCapacity();
    else if (key === 'exceptions') inner = _stepExceptions();
    else if (key === 'priority') inner = _stepPriority();
    else if (key === 'extra') inner = _stepExtra();

    _body().innerHTML = `
      <div class="aiwp-prog"><div class="aiwp-prog-bar" style="width:${prog}%"></div></div>
      <div class="aiwp-step">${inner}</div>`;
  }

  function _nav(backVisible, nextLabel, nextFn, nextEnabled) {
    return `<div class="aiwp-nav">
      ${backVisible ? `<button class="aiwp-nav-back" onclick="AIWP.prev()">${ICON.arrow}<span>חזרה</span></button>` : '<span></span>'}
      <button class="aiwp-nav-next${nextEnabled === false ? ' aiwp-disabled' : ''}" id="aiwp-next" onclick="${nextFn}">${_esc(nextLabel)}</button>
    </div>`;
  }

  // STEP: week confirm chip --------------------------------------------------
  function _stepWeek() {
    const range = window._wrGetTargetRange();
    return `
      <div class="aiwp-illus-wrap">${_illus('default')}</div>
      <div class="aiwp-q">${ICON.calendar}<span>לאיזה שבוע נתכנן?</span></div>
      <div class="aiwp-q-sub">${_esc(range.label)} · עד ${_esc(range.end)}</div>
      <div class="aiwp-chips">
        <button class="aiwp-chip ${_flow.week === 'this' ? 'sel' : ''}" onclick="AIWP.setWeek('this')">השבוע הנוכחי</button>
        <button class="aiwp-chip ${_flow.week === 'next' ? 'sel' : ''}" onclick="AIWP.setWeek('next')">השבוע הבא</button>
      </div>
      ${_nav(false, 'המשך', 'AIWP.next()', true)}`;
  }
  function setWeek(w) { _flow.week = w; _applyWeekToGlobal(); _renderStep(); }
  // _wrPlanNextWeek is a top-level `let` in app_v58.js — shared script scope, assign directly
  function _applyWeekToGlobal() { try { _wrPlanNextWeek = (_flow.week === 'next'); } catch (e) { window._wrPlanNextWeek = (_flow.week === 'next'); } }

  // STEP: Q1 capacity --------------------------------------------------------
  function _stepCapacity() {
    const opts = [
      { v: 'recovery', l: 'שבוע התאוששות', d: 'עומס קל, מנוחה ואיזון' },
      { v: 'normal', l: 'שבוע רגיל', d: 'קצב לימוד מאוזן' },
      { v: 'push', l: 'דחיפה חזקה', d: 'להעלות הילוך, יותר שעות' },
      { v: 'exam', l: 'שבוע מבחנים', d: 'מיקוד מלא בהכנה למבחן' }
    ];
    const cur = _flow.answers.capacity;
    return `
      <div class="aiwp-illus-wrap">${_illus('capacity')}</div>
      <div class="aiwp-q">${ICON.gauge}<span>מה העצימות שלך השבוע?</span></div>
      <div class="aiwp-q-sub">זה היחיד שה-AI לא יכול להסיק לבד — קובע את עומס הלימוד.</div>
      <div class="aiwp-opts">
        ${opts.map(o => `<button class="aiwp-opt ${cur === o.v ? 'sel' : ''}" onclick="AIWP.setCapacity('${o.v}')"><span class="aiwp-opt-l">${_esc(o.l)}</span><span class="aiwp-opt-d">${_esc(o.d)}</span></button>`).join('')}
      </div>
      ${_nav(true, 'המשך', 'AIWP.next()', !!cur)}`;
  }
  function setCapacity(v) { _flow.answers.capacity = v; _renderStep(); }

  // STEP: Q2 exceptions (blocked days) --------------------------------------
  function _stepExceptions() {
    const range = window._wrGetTargetRange();
    const days = _daysInRange(range.start, range.end);
    const blocked = _flow.answers.blockedDays;
    return `
      <div class="aiwp-illus-wrap">${_illus('exceptions')}</div>
      <div class="aiwp-q">${ICON.calendar}<span>יש חריגים מהשבוע הרגיל?</span></div>
      <div class="aiwp-q-sub">סמן ימים שבהם אתה לא זמין ללימוד (מעבר לעוגנים הקבועים). אפשר לדלג.</div>
      <div class="aiwp-daygrid">
        ${days.map(d => `<button class="aiwp-day ${blocked.includes(d.date) ? 'sel' : ''}" onclick="AIWP.toggleDay('${d.date}')"><span class="aiwp-day-n">${DOW[d.dow]}</span><span class="aiwp-day-d">${d.label}</span></button>`).join('')}
      </div>
      <button class="aiwp-clear ${blocked.length === 0 ? 'sel' : ''}" onclick="AIWP.clearDays()">${ICON.check}<span>הכל כרגיל</span></button>
      ${_nav(true, 'המשך', 'AIWP.next()', true)}`;
  }
  function toggleDay(date) { const b = _flow.answers.blockedDays; const i = b.indexOf(date); if (i >= 0) b.splice(i, 1); else b.push(date); _renderStep(); }
  function clearDays() { _flow.answers.blockedDays = []; _renderStep(); }

  // STEP: Q3 priority focus (optional) --------------------------------------
  function _stepPriority() {
    const courses = (_data().courses || []).map(c => c.name).filter(Boolean);
    if (!courses.length) { _flow.step++; return _stepExtra(); }
    const sel = _flow.answers.focusCourses;
    return `
      <div class="aiwp-illus-wrap">${_illus('priority')}</div>
      <div class="aiwp-q">${ICON.target}<span>מיקוד מיוחד השבוע?</span></div>
      <div class="aiwp-q-sub">כברירת מחדל ה-AI מתעדף לפי קרבת מבחנים. בחר קורסים רק אם תרצה להדגיש ידנית.</div>
      <button class="aiwp-clear ${sel.length === 0 ? 'sel' : ''}" onclick="AIWP.clearFocus()">${ICON.spark}<span>שה-AI יחליט לפי המבחנים</span></button>
      <div class="aiwp-opts aiwp-multi">
        ${courses.map(c => `<button class="aiwp-opt aiwp-opt-row ${sel.includes(c) ? 'sel' : ''}" onclick="AIWP.toggleFocus('${_esc(c).replace(/'/g, "\\'")}')"><span class="aiwp-opt-l">${_esc(c)}</span><span class="aiwp-opt-chk">${ICON.check}</span></button>`).join('')}
      </div>
      ${_nav(true, 'המשך', 'AIWP.next()', true)}`;
  }
  function toggleFocus(c) { const s = _flow.answers.focusCourses; const i = s.indexOf(c); if (i >= 0) s.splice(i, 1); else s.push(c); _renderStep(); }
  function clearFocus() { _flow.answers.focusCourses = []; _renderStep(); }

  // STEP: free-text + chat ---------------------------------------------------
  function _stepExtra() {
    return `
      <div class="aiwp-illus-wrap">${_illus('chat')}</div>
      <div class="aiwp-q">${ICON.chat}<span>משהו נוסף שכדאי שאדע?</span></div>
      <div class="aiwp-q-sub">לחץ, אילוצים, מטרות אישיות — ספר לי במילים שלך, או פתח שיחה להרחבה.</div>
      <textarea id="aiwp-freetext" class="aiwp-textarea" rows="3" placeholder="לדוגמה: יש לי הצגה ביום שלישי וקשה לי להתרכז אחרי 21:00...">${_esc(_flow.freeText)}</textarea>
      <button class="aiwp-chat-open" onclick="AIWP.openChat()">${ICON.chat}<span>פתח שיחה עם הסוכן</span></button>
      ${_flow.chat.length ? `<div class="aiwp-chat-note">${ICON.check} נשמרו ${_flow.chat.filter(m => m.role === 'user').length} הודעות מהשיחה</div>` : ''}
      ${_nav(true, 'בנה לי לוז', 'AIWP.generate()', true)}`;
  }

  function next() {
    if (STEPS[_flow.step] === 'extra') return generate();
    _saveFreeText();
    if (_flow.step < STEPS.length - 1) { _flow.step++; _renderStep(); }
  }
  function prev() { _saveFreeText(); if (_flow.step > 0) { _flow.step--; _renderStep(); } }
  function _saveFreeText() { const ta = document.getElementById('aiwp-freetext'); if (ta) _flow.freeText = ta.value; }

  // ========================================================================
  //  CHAT (Interviewer)
  // ========================================================================
  function openChat() {
    _saveFreeText();
    _body().innerHTML = `
      <div class="aiwp-chat-head">${ICON.avatar}<div><div class="aiwp-chat-title">שיחה עם סוכן התכנון</div><div class="aiwp-chat-hint">ספר על השבוע שלך — אענה ואלמד מה חשוב לך</div></div></div>
      <div id="aiwp-chat-feed" class="aiwp-chat-feed"></div>
      <div class="aiwp-chat-input-row">
        <input id="aiwp-chat-input" class="aiwp-chat-input" placeholder="כתוב הודעה..." onkeydown="if(event.key==='Enter')AIWP.sendChat()"/>
        <button class="aiwp-chat-send" onclick="AIWP.sendChat()">${ICON.arrow}</button>
      </div>
      <button class="aiwp-nav-next aiwp-chat-done" onclick="AIWP.backFromChat()">סיימתי — חזרה</button>`;
    _renderChatFeed();
    if (!_flow.chat.length) {
      _flow.chat.push({ role: 'assistant', content: 'היי! ספר לי מה מעסיק אותך לגבי השבוע הקרוב — לחצים, אילוצים, או מטרה שתרצה שאתמקד בה.' });
      _renderChatFeed();
    }
  }
  function backFromChat() { _renderStep(); }
  function _renderChatFeed() {
    const feed = document.getElementById('aiwp-chat-feed'); if (!feed) return;
    feed.innerHTML = _flow.chat.map(m => m.role === 'user'
      ? `<div class="aiwp-bub user">${_esc(m.content).replace(/\n/g, '<br>')}</div>`
      : `<div class="aiwp-bub ai">${_esc(m.content).replace(/\n/g, '<br>')}</div>`).join('');
    feed.scrollTop = feed.scrollHeight;
  }
  async function sendChat() {
    const inp = document.getElementById('aiwp-chat-input'); if (!inp) return;
    const msg = inp.value.trim(); if (!msg) return; inp.value = '';
    _flow.chat.push({ role: 'user', content: msg });
    _renderChatFeed();
    const feed = document.getElementById('aiwp-chat-feed');
    feed.insertAdjacentHTML('beforeend', `<div class="aiwp-bub ai" id="aiwp-chat-load"><span class="aiwp-shimmer">חושב...</span></div>`);
    feed.scrollTop = feed.scrollHeight;
    try {
      const sys = { role: 'system', content: 'אתה סוכן תכנון לימודים אמפתי ומקצועי. נהל שיחה קצרה בעברית כדי להבין את מצב המשתמש לשבוע הקרוב: לחץ, אילוצים חד-פעמיים, מטרות, מצב רגשי. שאל שאלת המשך אחת רלוונטית אם צריך, אחרת אשר בקצרה. ענה במשפט או שניים בלבד. אל תבנה לוז עכשיו.' };
      const reply = await window.callAI({ messages: [sys, ..._flow.chat], temperature: 0.6, maxTokens: 300 });
      document.getElementById('aiwp-chat-load')?.remove();
      _flow.chat.push({ role: 'assistant', content: (reply || '').trim() || 'הבנתי, תודה. תוכל להוסיף עוד או לחזור ולבנות את הלוז.' });
      _renderChatFeed();
    } catch (e) {
      document.getElementById('aiwp-chat-load')?.remove();
      _flow.chat.push({ role: 'assistant', content: 'מצטער, יש בעיה בחיבור כרגע. אפשר להמשיך ולבנות את הלוז.' });
      _renderChatFeed();
    }
  }

  // ========================================================================
  //  CONTEXT BUILDER  (Profiler inputs + all S data)
  // ========================================================================
  function _buildContext() {
    const s = _data();
    const range = window._wrGetTargetRange();
    const today = _ld(new Date());
    const courses = (s.courses || []).map(c => c.name).filter(Boolean);
    const insights = (window._buildPerformanceInsights ? window._buildPerformanceInsights(courses) : {});
    const slots = (window.getAvailableSlots ? window.getAvailableSlots(range.start, range.end, 3) : { text: '', totalMinutes: 0, anchorDetails: '' });

    const exams = (s.exams || []).map(e => {
      const days = Math.round((new Date(e.date) - new Date(today)) / 86400000);
      return { course: e.course, date: e.date, type: e.type, conf: e.conf, readyPct: e.readyPct || 0, daysUntil: days };
    }).filter(e => e.daysUntil >= -1).sort((a, b) => a.daysUntil - b.daysUntil);

    const anchors = (s.anchors || []).map(a => ({ day: DOW[+a.day], start: a.start, end: a.end, travelMin: a.travelMin || 0, name: a.name, endDate: a.endDate || null, oneTimeDate: a.oneTimeDate || null }));
    const hobbies = (s.hobbies || []).map(h => ({ name: h.name, timesPerWeek: h.timesPerWeek, sessionDuration: h.sessionDuration, goal: h.goal }));
    const pl = _planner();

    return {
      today,
      targetWeek: { start: range.start, end: range.end, label: range.label, days: _daysInRange(range.start, range.end).map(d => ({ date: d.date, dow: DOW[d.dow] })) },
      profile: { focus_time: s.profile?.focus_time || null, focus_span: s.profile?.focus_span || null, style: s.profile?.style || null, exam_fear: s.profile?.exam_fear || null },
      wake: s.wakeTime || '08:00', sleep: s.sleepTime || '22:00',
      courses, exams, anchors, hobbies,
      freeSlots: slots.text, freeMinutesTotal: slots.totalMinutes,
      insights, streak: s.streak || 0, points: s.points || 0,
      learnedMemo: pl.memo || '', learnedPrefs: pl.prefs || {},
      answers: _flow.answers,
      blockedDays: _flow.answers.blockedDays,
      userNote: _flow.freeText || '',
      chatTranscript: _flow.chat.filter(m => m.role === 'user').map(m => m.content).join(' | ')
    };
  }

  // ========================================================================
  //  GENERATE  (Planner agent) + VALIDATE (Validator) + PREVIEW
  // ========================================================================
  // Multi-agent pipeline: Analyst (strategy) → Planner (placement) → Critic
  // (optimization) → deterministic Validator. Each agent is a separate Gemini
  // call with a focused role; every AI stage degrades gracefully on failure.
  async function generate() {
    if (!window.isPremium || !window.isPremium()) { openPaywall(); return; }
    _saveFreeText();
    _applyWeekToGlobal();
    _flow.context = _buildContext();
    _body().innerHTML = `
      <div class="aiwp-illus-wrap">${_illus('thinking')}</div>
      <div class="aiwp-gen-title"><span class="aiwp-shimmer">סוכני ה-AI בונים את הלוז שלך...</span></div>
      <div class="aiwp-gen-steps" id="aiwp-gen-steps">
        <div class="aiwp-gen-step" data-k="analyst">${ICON.gauge}<span>אנליסט — מנתח צרכים, מבחנים וביצועים</span></div>
        <div class="aiwp-gen-step" data-k="planner">${ICON.layers}<span>מתכנן — משבץ סשנים בחלונות האופטימליים</span></div>
        <div class="aiwp-gen-step" data-k="critic">${ICON.target}<span>מייעל — חזרה מרווחת, איזון ומיקוד</span></div>
        <div class="aiwp-gen-step" data-k="validate">${ICON.check}<span>מאמת התנגשויות ומגבלות</span></div>
      </div>`;
    const _mark = (k, cls) => { const el = document.querySelector('#aiwp-gen-steps [data-k="' + k + '"]'); if (el) el.classList.add(cls); };

    try {
      // Agent 1 — Analyst / Strategist (graceful: planner can run without it)
      _mark('analyst', 'on');
      let strategy = null;
      try { strategy = await _callAnalyst(_flow.context); } catch (e) { strategy = null; }
      _mark('analyst', 'done');

      // Agent 2 — Planner / Scheduler (honours the strategy)
      _mark('planner', 'on');
      const draftRaw = await _callPlanner(_flow.context, strategy);
      let plan = _parsePlan(draftRaw);
      _mark('planner', 'done');

      // Agent 3 — Critic / Optimizer (graceful: keep the draft if it fails)
      _mark('critic', 'on');
      try {
        const critRaw = await _callCritic(_flow.context, strategy, plan);
        const refined = _parsePlan(critRaw);
        if (refined && refined.length) plan = refined;
      } catch (e) { /* keep planner draft */ }
      _mark('critic', 'done');

      // Deterministic hard-constraint validation (free windows, overlaps, blocked days)
      _mark('validate', 'on');
      const tasks = _validate(plan);
      _mark('validate', 'done');
      if (!tasks.length) {
         const reason = (!plan || !plan.length) ? 'ה-AI לא הצליח להרכיב לוז, כנראה עקב מחסור בזמן פנוי או שגיאת הבנה.' : 'הלוז נדחה עקב התנגשויות (וודא ששעות השינה והעוגנים אינם חופפים שעות למידה).';
         _genError(reason + ' נסה שוב או שנה את התשובות.');
         return;
      }
      _flow.plan = tasks;
      _flow.strategy = strategy;
      _renderPreview(tasks);
    } catch (e) {
      console.error('AIWP generate error:', e);
      _genError('אירעה שגיאה ביצירת הלוז: ' + (e.message || 'לא ידוע') + '. ודא שמפתח Gemini מוגדר בהגדרות.');
    }
  }

  function _genError(msg) {
    _body().innerHTML = `
      <div class="aiwp-illus-wrap">${_illus('default')}</div>
      <div class="aiwp-q-sub" style="text-align:center;margin-top:1rem">${_esc(msg)}</div>
      <div class="aiwp-nav"><button class="aiwp-nav-back" onclick="AIWP.toStep('extra')">${ICON.arrow}<span>חזרה</span></button><button class="aiwp-nav-next" onclick="AIWP.generate()">נסה שוב</button></div>`;
  }
  function toStep(key) { _flow.step = STEPS.indexOf(key); _renderStep(); }

  // AGENT 1 — Analyst / Strategist: decides allocation + priorities, no scheduling yet.
  async function _callAnalyst(ctx) {
    const sys = `אתה אסטרטג למידה ברמה עולמית. נתח את נתוני הסטודנט והשבוע וקבע אסטרטגיית למידה — בלי לשבץ זמנים עדיין.
שקלל: קרבת מבחנים (daysUntil) ורמת מוכנות (readyPct), ביצועי עבר (insights), העומס שנבחר (answers.capacity), מטרות ואילוצים אישיים (userNote, chatTranscript), מיקוד ידני (focusCourses), ותחביבים.

עקרון מפתח — לוד בר-קיימא: קבע תקציב עומס ריאלי, לא רשימת משאלות. מדע הלמידה (תרגול מכוון, עומס קוגניטיבי) קובע שתקרת לימוד ממוקד היא ~2–4 שעות ביום בלבד — לא אחוז מכל הזמן הפנוי. תרגם capacity לתקרה: recovery≈2ש'/יום, normal≈3ש'/יום, push≈3.5ש'/יום, exam≈4ש'/יום. אל תעבור את התקרה — עומס-יתר פוגע בלמידה ובהתמדה.
הקצאה פרופורציונלית: קורס עם מבחן קרוב/מוכנות נמוכה/קושי גבוה מקבל יותר סשנים; קורס קל/בלי מבחן מקבל מעט. אל תחלק שווה בשווה. שמור יום אחד קליל/מנוחה.

החזר אך ורק JSON: {"weeklyBudgetHours":מספר,"dailyCeilingHours":מספר,"perCourse":[{"course":"שם מהרשימה","sessions":מספר_סשנים_לשבוע,"priority":"גבוה|בינוני|נמוך","reason":"קצר"}],"approach":"משפט על הגישה","spacingPlan":"איך לפזר חזרה מרווחת ושילוב נושאים","balance":"הנחיית מנוחה","warnings":"סיכון אם יש"}.
השתמש רק בקורסים מתוך courses. אל תוסיף טקסט מחוץ ל-JSON.`;
    const user = `נתוני המשתמש והשבוע (JSON):\n${JSON.stringify(ctx)}`;
    const raw = await window.callAI({ messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.5, json: true, maxTokens: 1500 });
    try { return (window.extractJSON ? window.extractJSON(raw) : JSON.parse(raw)); } catch (e) { return null; }
  }

  // AGENT 2 — Planner / Scheduler: places concrete sessions, honouring the strategy.
  async function _callPlanner(ctx, strategy) {
    const sys = `אתה מתכנן לימודים מומחה ברמה עולמית. תפקידך לבנות לוז שבועי אופטימלי לסטודנט, על בסיס נתונים אמיתיים, לפי עקרונות מבוססי-מחקר:
- חזרה מרווחת (spaced repetition) ושילוב נושאים (interleaving) — אל תרכז קורס אחד ברצף ימים אלא אם יש מבחן קרוב.
- התאמה לשעון הביולוגי: שבץ נושאים תובעניים בשעות השיא של המשתמש (profile.focus_time + שעות שבהן הוא באמת משלים סשנים לפי insights).
- תכנון לאחור מתאריך המבחן: ככל שמבחן קרוב יותר (daysUntil קטן), הקצה לו יותר זמן; ב-X% הימים האחרונים לפני מבחן — חלון דחק שבו אותו קורס בעדיפות.
- אורך סשן לפי profile.focus_span; שלב הפסקות של 15 דק' בין סשנים ארוכים.
- כבד מגבלות: שעות ערות/שינה (wake/sleep), עוגנים+נסיעה (anchors), חלונות פנויים בלבד (freeSlots). אל תשבץ דבר מחוץ ל-freeSlots.
- הימנע מ-problemSlots (שעות שבהן המשתמש נוטה לפספס לפי insights).
- כבד עומס: capacity קובע כמה מסך הזמן הפנוי להקצות ללימוד (recovery≈40%, normal≈62%, push≈80%, exam≈90% עם מיקוד במבחן הקרוב). השאר זמן למנוחה.
- כבד blockedDays (אל תשבץ בהם), focusCourses (הדגש אותם), ותחביבים (hobbies) לפי timesPerWeek.
- learnedMemo ו-learnedPrefs מתארים את ההרגלים שלמדת על המשתמש — כבד אותם.
${strategy ? '- קיבלת אסטרטגיה מהאנליסט: שבץ לכל קורס בערך את strategy.perCourse[].sessions והעדיפות שנקבעו. אל תעבור את תקציב העומס — לכל היותר strategy.dailyCeilingHours ביום ו-strategy.weeklyBudgetHours בשבוע. עומס ריאלי ובר-קיימא חשוב מ"למלא" את כל הזמן הפנוי.' : '- שמור על לוד בר-קיימא: לכל היותר ~2–4 שעות לימוד ממוקד ביום; אל תמלא את כל הזמן הפנוי. שמור יום קליל למנוחה.'}
החזר אך ורק JSON תקין בפורמט: {"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"שם הקורס","duration":"60 דק'","priority":"גבוה|בינוני|נמוך"}],"rationale":"משפט קצר על ההיגיון"}. אל תוסיף טקסט מחוץ ל-JSON. השתמש רק בקורסים מתוך הרשימה. תאריכים אך ורק בטווח targetWeek.`;
    const stratLine = strategy ? `\n\nאסטרטגיית האנליסט (JSON):\n${JSON.stringify(strategy)}` : '';
    const user = `נתוני המשתמש והשבוע (JSON):\n${JSON.stringify(ctx)}${stratLine}\n\nבנה את הלוז עכשיו.`;
    return await window.callAI({ messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.4, json: true, maxTokens: 4096 });
  }

  // AGENT 3 — Critic / Optimizer: refines the draft against strategy + best practice.
  async function _callCritic(ctx, strategy, draft) {
    const sys = `אתה מבקר-איכות של לוחות זמנים ללמידה. בהינתן ההקשר, האסטרטגיה והטיוטה — דרג את הלוז מול הרובריקה הבאה (0–10 כל קריטריון) ותקן כל כשל לפני ההחזרה:
1. לוד בר-קיימא — לא עובר ~2–4ש'/יום ולא ממלא את כל הזמן הפנוי; יש מנוחה.
2. הקצאה פרופורציונלית — קורס עם מבחן קרוב/מוכנות נמוכה מקבל יותר; לא חלוקה שווה.
3. חזרה מרווחת ושילוב — אותו קורס לא ברצף ימים (אלא לקראת מבחן); נושאים משולבים.
4. טייפר למבחן — עוצמה עולה ככל שמתקרב המבחן; אין לימוד לקורס אחרי המבחן שלו.
5. שעות שיא — חומר תובעני ב-profile.focus_time.
6. מגבלות קשות — שיבוץ רק בחלונות הפנויים (freeSlots), מחוץ ל-blockedDays, בטווח targetWeek, לא חופף עוגנים.
החזר אך ורק JSON זהה בפורמט לטיוטה: {"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"שם","duration":"60 דק'","priority":"גבוה|בינוני|נמוך"}],"rationale":"משפט אחד למשתמש שמסביר למה הלוז אופטימלי עבורו"}. אל תוסיף טקסט מחוץ ל-JSON.`;
    const user = `הקשר (JSON):\n${JSON.stringify(ctx)}\n\nאסטרטגיה (JSON):\n${JSON.stringify(strategy || {})}\n\nטיוטת לוז (JSON):\n${JSON.stringify(draft)}\n\nשפר והחזר את הלוז המשופר.`;
    return await window.callAI({ messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.3, json: true, maxTokens: 4096 });
  }

  function _parsePlan(raw) {
    let obj;
    try { obj = (window.extractJSON ? window.extractJSON(raw) : JSON.parse(raw)); }
    catch (e) { obj = null; }
    const arr = obj && Array.isArray(obj.tasks) ? obj.tasks : (Array.isArray(obj) ? obj : []);
    _flow.rationale = (obj && obj.rationale) || '';
    return arr.map(t => ({
      date: t.date,
      time: (t.time || '').slice(0, 5),
      course: t.course || t.name || 'לימוד',
      name: t.course || t.name || 'לימוד',
      duration: /דק/.test(String(t.duration)) ? t.duration : `${parseInt(String(t.duration).match(/\d+/)?.[0] || 60)} דק'`,
      priority: t.priority || 'בינוני'
    })).filter(t => t.date && t.time);
  }

  // Validator — drop tasks that violate free-window/anchor/sleep rules
  function _validate(tasks) {
    const range = window._wrGetTargetRange();
    const valid = [];
    const seen = []; // {date, s, e} to prevent self-overlap among new tasks
    tasks.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    for (const t of tasks) {
      if (t.date < range.start || t.date > range.end) continue;
      if (_flow.answers.blockedDays.includes(t.date)) continue;
      const dur = parseInt(String(t.duration).match(/\d+/)?.[0] || 60);
      if (window.isTimeInFreeWindow && !window.isTimeInFreeWindow(t.date, t.time, dur)) continue;
      const s = _t2m(t.time), e = s + dur;
      const clash = seen.some(x => x.date === t.date && s < x.e && e > x.s);
      if (clash) continue;
      seen.push({ date: t.date, s, e });
      valid.push(t);
    }
    return valid;
  }

  function _renderPreview(tasks) {
    const range = window._wrGetTargetRange();
    const byDay = {};
    tasks.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });
    const dayKeys = Object.keys(byDay).sort();
    const totalMin = tasks.reduce((s, t) => s + parseInt(String(t.duration).match(/\d+/)?.[0] || 60), 0);
    const hrs = (totalMin / 60).toFixed(1);

    const daysHTML = dayKeys.map(dk => {
      const dow = new Date(dk + 'T12:00').getDay();
      const rows = byDay[dk].sort((a, b) => a.time.localeCompare(b.time)).map(t =>
        `<div class="aiwp-pv-task"><span class="aiwp-pv-time">${_esc(t.time)}</span><span class="aiwp-pv-course">${_esc(t.course)}</span><span class="aiwp-pv-dur">${_esc(t.duration)}</span></div>`).join('');
      return `<div class="aiwp-pv-day"><div class="aiwp-pv-day-h">${DOW[dow]} · ${_esc(dk.slice(5))}</div>${rows}</div>`;
    }).join('');

    _body().innerHTML = `
      <div class="aiwp-pv-head">
        <div class="aiwp-badge">${ICON.check}<span>הלוז מוכן</span></div>
        <div class="aiwp-pv-title">${tasks.length} סשנים · ${hrs} שעות לימוד</div>
        ${(_flow.strategy && _flow.strategy.approach) ? `<div class="aiwp-pv-rationale">${ICON.gauge}<span><b>אסטרטגיה:</b> ${_esc(_flow.strategy.approach)}</span></div>` : ''}
        ${_flow.rationale ? `<div class="aiwp-pv-rationale">${ICON.brain}<span>${_esc(_flow.rationale)}</span></div>` : ''}
      </div>
      <div class="aiwp-pv-list">${daysHTML || '<div class="aiwp-q-sub">לא נוצרו סשנים בטווח הפנוי.</div>'}</div>
      <div class="aiwp-nav">
        <button class="aiwp-nav-back" onclick="AIWP.generate()">${ICON.arrow}<span>בנה מחדש</span></button>
        <button class="aiwp-nav-next" onclick="AIWP.confirm()">${ICON.check} אשר והוסף ללו"ז</button>
      </div>`;
  }

  // commit via existing confirmWeeklyPlan -----------------------------------
  function confirm() {
    if (!window.isPremium || !window.isPremium()) { openPaywall(); return; }
    if (!_flow.plan || !_flow.plan.length) { _toast('אין לוז לאישור'); return; }
    _applyWeekToGlobal();
    // _wr is a top-level `let` in app_v58.js (shared script scope) — confirmWeeklyPlan reads it directly
    const wrObj = {
      pendingPlan: _flow.plan.slice(),
      answers: { mode: 'ai', capacity: _flow.answers.capacity, focus: _flow.answers.focusCourses, blocked: _flow.answers.blockedDays }
    };
    try { _wr = wrObj; } catch (e) { window._wr = wrObj; }
    try {
      window.confirmWeeklyPlan();
      _learn();
      closeFlow();
      if (window.renderWeeklyReview) window.renderWeeklyReview();
    } catch (e) { _toast('שגיאה באישור: ' + e.message); console.error(e); }
  }

  // ========================================================================
  //  LEARNING  (deterministic prefs + record; memo refresh async)
  // ========================================================================
  function _learn() {
    const s = _data();
    const pl = _planner();
    pl.history = [...(pl.history || []).slice(-11), { date: _ld(new Date()), added: _flow.plan.length, capacity: _flow.answers.capacity }];
    pl.prefs = _computePrefs();
    _save();
    _maybeRefreshMemo(); // async, non-blocking
  }

  function _computePrefs() {
    const s = _data();
    const tasks = (s.tasks || []).filter(t => t.done || t.missed);
    const hourBuckets = {}; // hour -> {done, total}
    let durDone = [], adher = { done: 0, total: 0 };
    tasks.forEach(t => {
      const h = parseInt((t.time || '0:0').split(':')[0]);
      hourBuckets[h] = hourBuckets[h] || { done: 0, total: 0 };
      hourBuckets[h].total++; adher.total++;
      if (t.done) { hourBuckets[h].done++; adher.done++; durDone.push(parseInt(String(t.duration).match(/\d+/)?.[0] || 60)); }
    });
    const bestHours = Object.entries(hourBuckets)
      .filter(([, v]) => v.total >= 2)
      .sort((a, b) => (b[1].done / b[1].total) - (a[1].done / a[1].total))
      .slice(0, 3).map(([h]) => `${String(h).padStart(2, '0')}:00`);
    const reliableSession = durDone.length ? Math.round(durDone.reduce((a, b) => a + b, 0) / durDone.length) : null;
    const completionRate = adher.total ? Math.round((adher.done / adher.total) * 100) : null;
    return { bestHours, reliableSession, completionRate, sampleSize: adher.total, updated: _ld(new Date()) };
  }

  // refresh AI memo only when ≥7 days passed and there's new outcome data
  async function _maybeRefreshMemo() {
    const pl = _planner();
    const last = pl.memoUpdatedDate ? new Date(pl.memoUpdatedDate) : null;
    const daysSince = last ? Math.floor((new Date() - last) / 86400000) : 999;
    if (daysSince < 7) return;
    const s = _data();
    const recent = (s.tasks || []).filter(t => t.done || t.missed);
    if (recent.length < 5) return;
    try {
      const summary = recent.slice(-40).map(t => `${t.date} ${t.time} ${t.course} ${t.done ? 'בוצע' : 'פוספס'}${t.rating ? ' דירוג' + t.rating : ''}`).join('; ');
      const sys = { role: 'system', content: 'אתה מנתח דפוסי למידה. על סמך היסטוריית הביצועים, נסח תזכיר תמציתי (עד 60 מילים, בעברית) על ההרגלים של המשתמש: באילו שעות הוא מצליח, אילו קורסים בעייתיים, מתי הוא מפספס. כתוב כהנחיות לתכנון עתידי. רק התזכיר, בלי הקדמות.' };
      const usr = { role: 'user', content: `תזכיר קודם: ${pl.memo || 'אין'}\nביצועים אחרונים: ${summary}` };
      const memo = await window.callAI({ messages: [sys, usr], temperature: 0.4, maxTokens: 200 });
      if (memo && memo.trim()) { pl.memo = memo.trim().slice(0, 500); pl.memoUpdatedDate = _ld(new Date()); _save(); }
    } catch (e) { /* silent — learning is best-effort */ }
  }

  // ========================================================================
  //  PAYWALL  +  SETTINGS section
  // ========================================================================
  function openPaywall() {
    let o = document.getElementById('aiwp-paywall');
    if (!o) {
      o = document.createElement('div');
      o.id = 'aiwp-paywall';
      o.className = 'modal-overlay aiwp-overlay hidden';
      document.body.appendChild(o);
    }
    o.innerHTML = _paywallHTML();
    o.classList.remove('hidden');
    if (window._setBodyLock) window._setBodyLock(true);
  }
  function closePaywall() { const o = document.getElementById('aiwp-paywall'); if (o) o.classList.add('hidden'); if (window._setBodyLock) window._setBodyLock(false); }

  function _paywallHTML() {
    const feats = [
      { ic: ICON.spark, t: 'תכנון שבועי עם AI', d: 'סוכן חכם בונה לך לוז אופטימלי בלחיצה אחת' },
      { ic: ICON.gauge, t: 'שאלון חכם וקצר', d: 'רק מה שצריך — השאר מוסק אוטומטית מהנתונים' },
      { ic: ICON.chat, t: 'שיחת התאמה אישית', d: 'ספר לסוכן על השבוע שלך והוא יתאים את הלוז' },
      { ic: ICON.brain, t: 'לומד אותך לאורך זמן', d: 'הלוז משתפר משבוע לשבוע לפי הביצועים שלך' }
    ];
    return `<div class="aiwp-sheet aiwp-paywall-sheet">
      <button class="aiwp-close" onclick="AIWP.closePaywall()">&times;</button>
      <div class="aiwp-pw-hero">${_illus('priority')}</div>
      <div class="aiwp-badge aiwp-badge-lg">${ICON.spark}<span>StudyFlow פרימיום</span></div>
      <div class="aiwp-pw-title">תן ל-AI לתכנן לך את השבוע</div>
      <div class="aiwp-pw-sub">לוז מקצועי, מותאם אישית, שמבוסס על כל הנתונים שלך ומשתפר עם הזמן.</div>
      <div class="aiwp-pw-feats">
        ${feats.map(f => `<div class="aiwp-pw-feat"><span class="aiwp-pw-feat-ic">${f.ic}</span><div><div class="aiwp-pw-feat-t">${f.t}</div><div class="aiwp-pw-feat-d">${f.d}</div></div></div>`).join('')}
      </div>
      <button class="aiwp-cta aiwp-cta-lg" onclick="AIWP.upgrade()">${ICON.spark}<span>שדרג עכשיו</span></button>
      <div class="aiwp-pw-note">גרסת הדגמה — ללא חיוב בשלב זה</div>
    </div>`;
  }

  function upgrade() {
    const s = _data();
    s.tier = 'premium';
    _save();
    closePaywall();
    _toast('ברוך הבא לפרימיום! תכנון ה-AI פעיל');
    _injectSettings();
    if (window.renderWeeklyReview) window.renderWeeklyReview();
  }
  function downgrade() {
    const s = _data(); s.tier = 'free'; _save();
    _toast('חזרת לגרסה החינמית');
    _injectSettings();
    if (window.renderWeeklyReview) window.renderWeeklyReview();
  }

  function openSettings() {
    if (window.openSettings) { try { window.openSettings(); } catch (e) {} }
    const m = document.getElementById('settings-modal'); if (m) m.classList.remove('hidden');
    _injectSettings();
  }

  // inject a Premium section into the settings modal
  function _injectSettings() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const host = modal.querySelector('.modal-body') || modal.querySelector('.settings-body') || modal;
    let sec = document.getElementById('aiwp-settings-sec');
    if (!sec) {
      sec = document.createElement('div');
      sec.id = 'aiwp-settings-sec';
      // place near top of settings content
      const first = host.querySelector('.settings-sec-label');
      if (first && first.parentNode) first.parentNode.insertBefore(sec, first);
      else host.insertBefore(sec, host.firstChild);
    }
    const premium = window.isPremium && window.isPremium();
    sec.innerHTML = `
      <div class="settings-sec-label">פרימיום</div>
      <div class="settings-card aiwp-set-card">
        <div class="aiwp-set-row">
          <div class="aiwp-set-badge ${premium ? 'on' : ''}">${ICON.spark}</div>
          <div class="aiwp-set-txt">
            <div class="aiwp-set-tier">${premium ? 'מנוי פרימיום פעיל' : 'גרסה חינמית'}</div>
            <div class="aiwp-set-desc">${premium ? 'תכנון שבועי עם AI מופעל' : 'שדרג לתכנון שבועי חכם עם AI'}</div>
          </div>
        </div>
        ${premium
        ? `<button class="aiwp-set-btn ghost" onclick="AIWP.downgrade()">ניהול מנוי · ביטול</button>`
        : `<button class="aiwp-set-btn" onclick="AIWP.openPaywall()">שדרג עכשיו</button>`}
      </div>`;
  }
  function devToggle(on) { if (on) { _data().tier = 'premium'; } else { _data().tier = 'free'; } _save(); _injectSettings(); if (window.renderWeeklyReview) window.renderWeeklyReview(); }

  // ========================================================================
  //  UTIL
  // ========================================================================
  function _daysInRange(start, end) {
    const out = []; const s = new Date(start + 'T12:00'); const e = new Date(end + 'T12:00');
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      out.push({ date: _ld(d), dow: d.getDay(), label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return out;
  }

  // hook settings injection whenever settings opens (observer fallback)
  function _wireSettings() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    try {
      const obs = new MutationObserver(() => {
        if (!modal.classList.contains('hidden')) _injectSettings();
      });
      obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  }

  function init() {
    _wireSettings();
    _injectSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);

  // ---- public API ----------------------------------------------------------
  window.AIWP = {
    maybeRenderEntry, startFlow, closeFlow,
    next, prev, setWeek, setCapacity, toggleDay, clearDays, toggleFocus, clearFocus,
    openChat, sendChat, backFromChat, generate, confirm, toStep,
    openPaywall, closePaywall, upgrade, downgrade, openSettings, devToggle
  };
})();
