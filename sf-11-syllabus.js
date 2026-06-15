/* ============================================================================
   StudyFlow Premium — Syllabus Milestones + "where you should be" tracker
   Additive IIFE. Premium-only (gated by isPremium); free users see a locked card.
   Data model:  course.milestones = [{ id, date:'YYYY-MM-DD', topic, type:'topic'|'exam' }]
                course.track      = 'syllabus' | 'manual'   (how the milestones were set)
   The last milestone is the EXAM — reaching it flips the course into "exam revision".
   ========================================================================== */
(function () {
  'use strict';

  const _esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? '')) : String(s ?? ''));
  const _S = () => (typeof S !== 'undefined' ? S : (window.S || {}));
  const isP = () => !!(window.isPremium && window.isPremium());
  const _today = () => (window.ld ? window.ld(new Date()) : new Date().toISOString().slice(0, 10));
  const _uid = () => (window.uid ? window.uid() : 'm' + Math.random().toString(36).slice(2, 9));
  const _save = () => { try { save(); } catch (e) { if (window.save) window.save(); } };
  const _toast = (m) => (window.toast ? window.toast(m) : null);
  const MON = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  const _fmt = (d) => { if (!d || !d.includes('-')) return d || ''; const [, m, day] = d.split('-'); return `${parseInt(day)} ${MON[parseInt(m) - 1] || ''}`; };
  const _daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);

  function _courses() { const s = _S(); return Array.isArray(s.courses) ? s.courses : []; }
  function _ordered(course) {
    return (Array.isArray(course.milestones) ? course.milestones.slice() : [])
      .filter(m => m && m.date).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Where the student SHOULD be today, by milestone dates. Exam = last milestone.
  function sfMilestoneStatus(course) {
    const ms = _ordered(course);
    if (!ms.length) return null;
    const today = _today();
    let current = null, next = null;
    for (const m of ms) { if (m.date <= today) current = m; else { next = m; break; } }
    const exam = ms.find(m => m.type === 'exam') || ms[ms.length - 1];
    const dToExam = exam ? _daysBetween(today, exam.date) : Infinity;
    const examMode = (current && exam && current.id === exam.id) || (dToExam >= 0 && dToExam <= 7);
    let expected, sub;
    if (examMode) { expected = 'חזרה למבחן'; sub = exam ? `המבחן ב-${_fmt(exam.date)}${dToExam >= 0 ? ` · בעוד ${dToExam} ימים` : ''}` : ''; }
    else if (current) { expected = current.topic; sub = next ? `הבא: ${_esc(next.topic)} · ${_fmt(next.date)}` : ''; }
    else if (next) { expected = `מתחילים ${_fmt(next.date)}`; sub = next.topic; }
    else { expected = null; sub = ''; }
    const idx = current ? ms.indexOf(current) + 1 : 0;
    return { current, next, exam, expected, sub, examMode, idx, total: ms.length, dToExam };
  }
  window.sfMilestoneStatus = sfMilestoneStatus;

  // ── "Where you should be" card, injected into the weekly-review page ────────
  function sfRenderSyllabusCard() {
    const page = document.getElementById('page-weekly-review');
    if (!page) return;
    let card = document.getElementById('syl-card');
    if (card) card.remove();
    card = document.createElement('div');
    card.id = 'syl-card';

    if (!isP()) {
      card.innerHTML =
        `<div class="syl-wrap syl-locked">
           <div class="aiwp-badge aiwp-badge-locked">${_lock()}<span>פרימיום · נעול</span></div>
           <div class="syl-title">מסלול הסילבוס שלך</div>
           <div class="syl-sub">ראה כל שבוע איפה אתה אמור להיות לפי הסילבוס, ומתי להתחיל לחזור למבחן.</div>
           <button class="aiwp-cta" onclick="AIWP&&AIWP.openPaywall&&AIWP.openPaywall()">${_spark()}<span>שדרג לפרימיום</span></button>
         </div>`;
      _mount(page, card); return;
    }

    const rows = _courses().map(c => {
      const st = sfMilestoneStatus(c);
      if (!st) {
        return `<div class="syl-row syl-empty">
            <div class="syl-row-main"><div class="syl-course">${_esc(c.name)}</div><div class="syl-where syl-muted">לא הוגדרו אבני דרך</div></div>
            <button class="syl-edit" onclick="sfOpenMilestoneEditor('${c.id}')">הגדר</button></div>`;
      }
      const dot = st.examMode ? '#F4504B' : 'var(--a-brand)';
      return `<div class="syl-row">
          <span class="syl-dot" style="background:${dot}"></span>
          <div class="syl-row-main">
            <div class="syl-course">${_esc(c.name)}</div>
            <div class="syl-where">${st.examMode ? '🎯 ' : ''}אמור להיות ב: <b>${_esc(st.expected || '—')}</b></div>
            ${st.sub ? `<div class="syl-where syl-muted">${_esc(st.sub)}</div>` : ''}
          </div>
          <div class="syl-prog">${st.idx}/${st.total}</div>
          <button class="syl-edit" onclick="sfOpenMilestoneEditor('${c.id}')">ערוך</button>
        </div>`;
    }).join('');

    card.innerHTML =
      `<div class="syl-wrap">
         <div class="syl-head"><div class="syl-title">מסלול הסילבוס · השבוע</div><span class="aiwp-badge"><span>${_spark()}</span><span>פרימיום</span></span></div>
         ${rows || '<div class="syl-sub">הוסף קורסים כדי לעקוב אחרי הסילבוס.</div>'}
       </div>`;
    _mount(page, card);
  }
  window.sfRenderSyllabusCard = sfRenderSyllabusCard;

  function _mount(page, card) {
    const header = page.querySelector('.page-header');
    if (header && header.parentNode) header.parentNode.insertBefore(card, header.nextSibling);
    else page.insertBefore(card, page.firstChild);
  }

  // ── Milestone editor (manual + "from syllabus") ─────────────────────────────
  function sfOpenMilestoneEditor(courseId) {
    if (!isP()) { if (window.AIWP && AIWP.openPaywall) AIWP.openPaywall(); return; }
    const course = _courses().find(c => String(c.id) === String(courseId));
    if (!course) return;
    if (!Array.isArray(course.milestones)) course.milestones = [];
    let ov = document.getElementById('syl-editor');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'syl-editor'; ov.className = 'modal-overlay';
    ov.onclick = (e) => { if (e.target === ov) sfCloseMilestoneEditor(); };
    ov.innerHTML =
      `<div class="syl-sheet" data-cid="${course.id}">
         <div class="syl-sheet-handle"></div>
         <div class="syl-sheet-hd">
           <div class="syl-sheet-title">אבני דרך · ${_esc(course.name)}</div>
           <button class="anc-sheet-close" onclick="sfCloseMilestoneEditor()" aria-label="סגור">✕</button>
         </div>
         <div class="syl-mode">
           <button class="syl-mode-btn ${course.track !== 'manual' ? 'on' : ''}" onclick="sfSetTrack('syllabus')">לפי הסילבוס</button>
           <button class="syl-mode-btn ${course.track === 'manual' ? 'on' : ''}" onclick="sfSetTrack('manual')">אני מגדיר</button>
         </div>
         <div class="syl-hint" id="syl-hint">${course.track === 'manual' ? 'הוסף אבני דרך משלך: תאריך + מה לומדים. האחרונה = המבחן.' : 'הזן את אבני הדרך מהסילבוס (תאריך + נושא). האחרונה = המבחן.'}</div>
         <div id="syl-rows"></div>
         <button class="syl-add" onclick="sfAddMilestoneRow()">+ הוסף אבן דרך</button>
         <button class="aiwp-cta syl-save" onclick="sfSaveMilestones()">${_check()}<span>שמור מסלול</span></button>
       </div>`;
    document.body.appendChild(ov);
    const rowsWrap = ov.querySelector('#syl-rows');
    const ms = _ordered(course);
    if (ms.length) ms.forEach(m => _addRow(rowsWrap, m));
    else { _addRow(rowsWrap, { date: '', topic: '', type: 'topic' }); _addRow(rowsWrap, { date: '', topic: '', type: 'exam' }); }
    if (window._setBodyLock) window._setBodyLock(true);
  }
  window.sfOpenMilestoneEditor = sfOpenMilestoneEditor;

  function _addRow(wrap, m) {
    const row = document.createElement('div');
    row.className = 'syl-mrow' + (m.type === 'exam' ? ' syl-mrow-exam' : '');
    row.innerHTML =
      `<input type="date" class="syl-i-date" value="${m.date || ''}" />
       <input type="text" class="syl-i-topic" placeholder="${m.type === 'exam' ? 'מבחן' : 'נושא (פרק, יחידה...)'}" value="${_esc(m.topic || (m.type === 'exam' ? 'מבחן' : ''))}" />
       <button class="syl-i-exam ${m.type === 'exam' ? 'on' : ''}" title="סמן כמבחן" onclick="sfToggleExamRow(this)">🎯</button>
       <button class="syl-i-del" title="מחק" onclick="this.closest('.syl-mrow').remove()">✕</button>`;
    wrap.appendChild(row);
  }
  window.sfAddMilestoneRow = function () { const w = document.getElementById('syl-rows'); if (w) _addRow(w, { date: '', topic: '', type: 'topic' }); };
  window.sfToggleExamRow = function (btn) {
    document.querySelectorAll('#syl-rows .syl-i-exam.on').forEach(b => { if (b !== btn) { b.classList.remove('on'); b.closest('.syl-mrow').classList.remove('syl-mrow-exam'); } });
    btn.classList.toggle('on');
    btn.closest('.syl-mrow').classList.toggle('syl-mrow-exam', btn.classList.contains('on'));
  };
  window.sfSetTrack = function (mode) {
    const sheet = document.querySelector('#syl-editor .syl-sheet'); if (!sheet) return;
    const c = _courses().find(x => String(x.id) === String(sheet.dataset.cid)); if (c) c.track = mode;
    sheet.querySelectorAll('.syl-mode-btn').forEach((b, i) => b.classList.toggle('on', (mode === 'manual') === (i === 1)));
    const hint = document.getElementById('syl-hint');
    if (hint) hint.textContent = mode === 'manual' ? 'הוסף אבני דרך משלך: תאריך + מה לומדים. האחרונה = המבחן.' : 'הזן את אבני הדרך מהסילבוס (תאריך + נושא). האחרונה = המבחן.';
  };
  window.sfCloseMilestoneEditor = function () { const ov = document.getElementById('syl-editor'); if (ov) ov.remove(); if (window._setBodyLock) window._setBodyLock(false); };

  window.sfSaveMilestones = function () {
    const sheet = document.querySelector('#syl-editor .syl-sheet'); if (!sheet) return;
    const course = _courses().find(c => String(c.id) === String(sheet.dataset.cid)); if (!course) return;
    const out = [];
    document.querySelectorAll('#syl-rows .syl-mrow').forEach(r => {
      const date = r.querySelector('.syl-i-date').value;
      const topic = r.querySelector('.syl-i-topic').value.trim();
      const isExam = r.querySelector('.syl-i-exam').classList.contains('on');
      if (date && (topic || isExam)) out.push({ id: _uid(), date, topic: topic || 'מבחן', type: isExam ? 'exam' : 'topic' });
    });
    out.sort((a, b) => a.date.localeCompare(b.date));
    course.milestones = out;
    if (!course.track) course.track = 'syllabus';
    // If the user marked an exam milestone, mirror it into the exams list so the
    // scheduler's exam-taper logic also picks it up (single source of truth-ish).
    const exam = out.find(m => m.type === 'exam');
    if (exam) {
      const s = _S(); if (!Array.isArray(s.exams)) s.exams = [];
      const existing = s.exams.find(e => e.course === course.name);
      if (existing) existing.date = exam.date;
      else s.exams.push({ id: _uid(), course: course.name, date: exam.date, type: 'מבחן', conf: 3, readyPct: 0, createdDate: _today() });
    }
    _save();
    sfCloseMilestoneEditor();
    _toast('המסלול נשמר ✓');
    if (window.renderWeeklyReview) try { window.renderWeeklyReview(); } catch (e) {}
    sfRenderSyllabusCard();
  };

  // ── tiny inline icons ───────────────────────────────────────────────────────
  function _spark() { return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>'; }
  function _lock() { return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'; }
  function _check() { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'; }

  // ── Non-invasively render the card whenever the weekly review repaints ──────
  function _hook() {
    if (typeof window.renderWeeklyReview === 'function' && !window.renderWeeklyReview._sylWrapped) {
      const orig = window.renderWeeklyReview;
      window.renderWeeklyReview = function () { const r = orig.apply(this, arguments); try { sfRenderSyllabusCard(); } catch (e) {} return r; };
      window.renderWeeklyReview._sylWrapped = true;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_hook, 0));
  else setTimeout(_hook, 0);
})();
