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
            <div class="syl-where">אמור להיות ב: <b>${_esc(st.expected || '—')}</b></div>
            ${st.sub ? `<div class="syl-where syl-muted">${_esc(st.sub)}</div>` : ''}
            <div style="margin-top:8px"><button class="syl-edit" style="background:var(--a-grad); color:white; border:none; padding:5px 12px; font-weight:800; border-radius:8px; display:inline-flex; align-items:center; gap:4px" onclick="if(window.sfOpenTutor) sfOpenTutor('${c.id}')">${_spark()} מורה פרטי</button></div>
          </div>
          <div class="syl-prog-col" style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <div class="syl-prog">${st.idx}/${st.total}</div>
            <button class="syl-edit" onclick="sfOpenMilestoneEditor('${c.id}')">ערוך</button>
          </div>
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

  // ── Milestone editor — chat / AI based (no manual date fields) ──────────────
  let _mEdit = null;   // { courseId, milestones: [] }
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
         <div class="syl-intro">בנה את מסלול אבני הדרך — מקובץ הסילבוס, או בשיחה מודרכת קצרה.</div>
         <input type="file" id="syl-file" accept=".pdf,image/*,.txt" style="display:none" onchange="sfMilestoneFile(this)">
         <div class="syl-entry">
           <button class="syl-entry-btn" onclick="document.getElementById('syl-file').click()">${_clip()}<span>קובץ סילבוס</span></button>
           <button class="syl-entry-btn primary" onclick="sfStartWizard()">${_chat()}<span>בנה בשיחה</span></button>
         </div>
         <div id="syl-wiz"></div>
         <button class="syl-paste-toggle" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">או הזנה ידנית / הדבקת טקסט ←</button>
         <div class="syl-adv" style="display:none">
           <textarea id="syl-ai-input" class="syl-ai-input" rows="3" placeholder="הדבק סילבוס / קישור / נושאים (שורה לכל נושא)..."></textarea>
           <button id="syl-ai-btn" class="syl-ai-btn" onclick="sfAIMakeMilestones()">${_spark()}<span class="syl-ai-lbl">צור אבני דרך</span></button>
           <div class="syl-manual-add">
             <input type="text" id="syl-man-topic" class="syl-man-i" placeholder="נושא / פרק..." />
             <input type="date" id="syl-man-date" class="syl-man-i syl-man-d" />
             <button class="syl-man-add" onclick="sfAddManualMilestone()">+</button>
           </div>
         </div>
         <div id="syl-q" class="syl-q" style="display:none"></div>
         <div id="syl-list"></div>
         <button class="aiwp-cta syl-save" id="syl-save" style="display:none" onclick="sfSaveAIMilestones()">${_check()}<span>שמור מסלול</span></button>
       </div>`;
    document.body.appendChild(ov);
    _mEdit = { courseId: course.id, milestones: _ordered(course).slice() };
    _renderMilestoneList();
    if (window._setBodyLock) window._setBodyLock(true);
  }
  window.sfOpenMilestoneEditor = sfOpenMilestoneEditor;

  // Read-only review list of the AI-built milestones (topic + date, removable).
  function _renderMilestoneList() {
    const wrap = document.getElementById('syl-list'); const saveBtn = document.getElementById('syl-save');
    if (!wrap || !_mEdit) return;
    const ms = _mEdit.milestones || [];
    if (!ms.length) { wrap.innerHTML = ''; if (saveBtn) saveBtn.style.display = 'none'; return; }
    wrap.innerHTML = '<div class="syl-list-lbl">אבני הדרך שהוכנו · בדוק ושמור</div>' + ms.map((m, i) =>
      `<div class="syl-li${m.type === 'exam' ? ' syl-li-exam' : ''}">
         <span class="syl-li-ic">${m.type === 'exam' ? _target() : (i + 1)}</span>
         <div class="syl-li-main"><div class="syl-li-topic">${_esc(m.type === 'exam' ? 'מבחן' : m.topic)}</div><div class="syl-li-date">${_fmt(m.date)}</div></div>
         <button class="syl-li-del" title="הסר" onclick="sfRemoveMilestone(${i})">✕</button>
       </div>`).join('');
    if (saveBtn) saveBtn.style.display = '';
  }
  window.sfRemoveMilestone = function (i) { if (_mEdit && _mEdit.milestones) { _mEdit.milestones.splice(i, 1); _renderMilestoneList(); } };
  window.sfAddManualMilestone = function() {
    const t = document.getElementById('syl-man-topic'); const d = document.getElementById('syl-man-date');
    if (!t || !d || !t.value.trim() || !d.value) { _toast('הכנס נושא ותאריך'); return; }
    if (!_mEdit) return;
    _mEdit.milestones.push({ id: _uid(), date: d.value, topic: t.value.trim(), type: /מבחן|בחינה/i.test(t.value)?'exam':'topic' });
    _mEdit.milestones.sort((a,b)=>a.date.localeCompare(b.date));
    t.value = ''; d.value = '';
    _renderMilestoneList();
    _toast('נוסף בהצלחה ✓');
  };
  window.sfCloseMilestoneEditor = function () { const ov = document.getElementById('syl-editor'); if (ov) ov.remove(); if (window._setBodyLock) window._setBodyLock(false); };

  window.sfSaveAIMilestones = function () {
    if (!_mEdit) return;
    const course = _courses().find(c => String(c.id) === String(_mEdit.courseId)); if (!course) return;
    const out = (_mEdit.milestones || [])
      .filter(m => m && m.date)
      .map(m => ({ id: m.id || _uid(), date: m.date, topic: m.topic || 'מבחן', type: m.type === 'exam' ? 'exam' : 'topic' }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!out.length) { _toast('אין אבני דרך לשמירה'); return; }
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
    try { sfRenderSyllabusCard(); } catch (e) {}
    try { sfRenderMilestonePath(); } catch (e) {}
  };

  // ── AI milestone generation (from pasted syllabus / link / free text) ───────
  function _btnLoad(on) { const b = document.getElementById('syl-ai-btn'); if (!b) return; b.disabled = on; const l = b.querySelector('.syl-ai-lbl'); if (l) l.textContent = on ? 'מכין...' : 'צור אבני דרך'; }
  function _applyMilestones(ms, fromAI) {
    if (!_mEdit || !ms || !ms.length) return false;
    const q = document.getElementById('syl-q'); if (q) q.style.display = 'none';
    _mEdit.milestones = ms.map(m => ({ id: _uid(), date: m.date, topic: m.topic || 'מבחן', type: m.type === 'exam' ? 'exam' : 'topic' })).filter(m => m.date);
    _renderMilestoneList();
    _toast(fromAI ? `הוכנו ${_mEdit.milestones.length} אבני דרך ✓ — בדוק ושמור` : `נבנו ${_mEdit.milestones.length} אבני דרך — ערוך ושמור (ה-AI החכם רץ בגרסה החיה)`);
    return true;
  }
  // Offline / no-AI fallback: split the text into topics, spread ~weekly, last = exam.
  function _fallbackMilestones(text) {
    const fdate = (dd) => (window.ld ? window.ld(dd) : dd.toISOString().slice(0, 10));
    const examRe = /מבחן|בחינה|exam|מועד\s*א/i;
    let topics = String(text || '').split(/[\n,;•·]+|\s—\s/).map(s => s.replace(/^\s*(?:[-–*]|\d+[.)]|שבוע\s*\d+|פרק\s*\d+)\s*[:.\-–]?\s*/i, '').trim()).filter(t => t.length > 1).slice(0, 14);
    const hasExam = topics.some(t => examRe.test(t));
    if (!topics.length) topics = ['נושא ראשון', 'נושא שני', 'נושא שלישי'];
    const out = []; let d = new Date();
    topics.forEach(t => { out.push({ date: fdate(d), topic: t, type: examRe.test(t) ? 'exam' : 'topic' }); d = new Date(d.getTime() + 7 * 86400000); });
    if (!hasExam) out.push({ date: fdate(d), topic: 'מבחן', type: 'exam' });
    return out;
  }

  window.sfAIMakeMilestones = async function () {
    const inp = document.getElementById('syl-ai-input'); if (!inp) return;
    const text = inp.value.trim();
    if (!text) { _toast('הדבק סילבוס/קישור או כתוב את הנושאים'); return; }
    _btnLoad(true);
    if (!window.callAI) { _applyMilestones(_fallbackMilestones(text), false); _btnLoad(false); return; }
    try {
      const sheet = document.querySelector('#syl-editor .syl-sheet');
      const c = _courses().find(x => String(x.id) === String(sheet && sheet.dataset.cid));
      const today = _today();
      const sys = `אתה עוזר שמכין אבני-דרך ללימוד קורס. בהינתן סילבוס (טקסט/קישור) או בקשה חופשית של הסטודנט — החזר אבני דרך מתוארכות.
- כל אבן דרך: {"date":"YYYY-MM-DD","topic":"נושא קצר וברור","type":"topic"}. האחרונה היא המבחן: type:"exam".
- אם אין תאריכים מפורשים — פזר באופן סביר (בערך שבועי) החל מ-${today}.
- אם המידע לא מספיק כדי לבנות מסלול טוב, החזר במקום זאת: {"need":"שאלה קצרה אחת בעברית למשתמש"}.
החזר אך ורק JSON: {"milestones":[...]} או {"need":"..."}. בלי טקסט נוסף.`;
      const user = `קורס: ${c ? c.name : ''}\nהיום: ${today}\nקלט מהמשתמש:\n${text}`;
      const raw = await window.callAI({ messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.3, json: true, maxTokens: 1500 });
      const obj = window.extractJSON ? window.extractJSON(raw) : JSON.parse(raw);
      if (obj && obj.need) { const q = document.getElementById('syl-q'); if (q) { q.style.display = ''; q.textContent = obj.need; } return; }
      const ms = (obj && Array.isArray(obj.milestones)) ? obj.milestones : (Array.isArray(obj) ? obj : []);
      if (!ms.length) throw new Error('empty');
      _applyMilestones(ms, true);
    } catch (e) {
      _applyMilestones(_fallbackMilestones(text), false);   // offline / error → local build so the track is still usable
    } finally {
      _btnLoad(false);
    }
  };

  // Upload a syllabus FILE. Plain-text builds locally (works offline); PDF / image
  // use the multimodal proxy (live), and on failure fall back to the chat wizard.
  window.sfMilestoneFile = function (input) {
    const file = input && input.files && input.files[0]; if (!file) return;
    input.value = '';
    if (file.size > 8 * 1024 * 1024) { _toast('הקובץ גדול מדי (עד 8MB)'); return; }
    const name = (file.name || '').toLowerCase();
    const isText = /^text\//.test(file.type || '') || /\.(txt|md|csv|text)$/.test(name);
    _toast('קורא את הקובץ...'); _btnLoad(true);
    const reader = new FileReader();
    reader.onerror = () => { _toast('לא הצלחנו לקרוא את הקובץ'); _btnLoad(false); };

    // Plain text — extract milestones locally, no backend needed.
    if (isText) {
      reader.onload = () => {
        try {
          const text = String(reader.result || '').trim();
          if (text.length < 3) throw new Error('empty');
          _applyMilestones(_fallbackMilestones(text), false);
        } catch (e) { _toast('הקובץ ריק או לא קריא — נסה קובץ אחר או בנה בשיחה.'); }
        finally { _btnLoad(false); }
      };
      reader.readAsText(file);
      return;
    }

    // PDF / image — needs the multimodal AI. Read to base64, then extract (retryable).
    reader.onload = () => _extractMilestonesFromFile(String(reader.result).split(',')[1], file.type || 'application/pdf');
    reader.readAsDataURL(file);
  };

  async function _extractMilestonesFromFile(data, mime) {
    // No AI key → open the one-click connect prompt and retry this exact file after.
    if (window.hasAIKey && !window.hasAIKey()) {
      _btnLoad(false);
      if (window.showAIKeySetup) window.showAIKeySetup(() => _extractMilestonesFromFile(data, mime));
      else { _toast('הוסף מפתח Gemini בהגדרות כדי לחלץ מקובץ'); try { sfStartWizard(); } catch (_) {} }
      return;
    }
    _btnLoad(true);
    try {
      if (!window.callAI) throw new Error('no-ai');
      const today = _today();
      const c = _mEdit ? _courses().find(x => String(x.id) === String(_mEdit.courseId)) : null;
      const content = await window.callAI({
        messages: [
          { role: 'system', content: 'אתה מחלץ אבני-דרך ללימוד מתוך קובץ סילבוס (PDF/תמונה). החזר JSON בלבד: {"milestones":[{"date":"YYYY-MM-DD","topic":"","type":"topic|exam"}]}.' },
          { role: 'user', content: `קורס: ${c ? c.name : ''}. היום: ${today}. חלץ את אבני הדרך (נושא + תאריך). אם אין תאריך מפורש — פזר שבועי החל מהיום. האחרונה היא המבחן (type:"exam").` }
        ],
        json: true, maxTokens: 1800, temperature: 0.2,
        files: [{ mime_type: mime, data }]
      });
      const obj = window.extractJSON ? window.extractJSON(content) : JSON.parse(content);
      const ms = (obj && Array.isArray(obj.milestones)) ? obj.milestones : (Array.isArray(obj) ? obj : []);
      if (!ms.length) throw new Error('empty');
      _applyMilestones(ms, true);
    } catch (e) {
      const m = (e && e.message) || '';
      _toast(/Gemini|מפתח|זמין|מקומית/.test(m) ? m : 'לא הצלחתי לחלץ מהקובץ — בוא נבנה בשיחה, אני שואל ואתה עונה.');
      try { sfStartWizard(); } catch (_) {}
    } finally { _btnLoad(false); }
  }

  // ── Guided "build in a chat" wizard — a real Q&A conversation, button answers ─
  let _mWiz = null;
  const _WIZ = [
    { key: 'exam',  q: 'מתי המבחן או סיום הקורס?', opts: [{ l: 'בעוד שבועיים', v: '14' }, { l: 'בעוד חודש', v: '30' }, { l: 'בעוד חודשיים', v: '60' }, { l: 'תאריך מדויק', v: 'date' }] },
    { key: 'count', q: 'כמה נושאים מרכזיים יש בקורס, בערך?', opts: [{ l: '4', v: '4' }, { l: '6', v: '6' }, { l: '8', v: '8' }, { l: '10', v: '10' }] },
    { key: 'topics', q: 'רוצה לפרט את שמות הנושאים? זה הופך את המסלול למדויק — או שתדלג ואסדר לבד.', type: 'text' }
  ];
  const _WIZ_INTRO = 'היי! בוא נבנה יחד את מסלול אבני הדרך שלך. כמה שאלות קצרות וזה מוכן.';
  window.sfStartWizard = function () {
    const adv = document.querySelector('#syl-editor .syl-adv'); if (adv) adv.style.display = 'none';
    const tog = document.querySelector('#syl-editor .syl-paste-toggle'); if (tog) tog.style.display = '';
    _mWiz = { step: 0, answers: {}, labels: [], acks: [], dateMode: false };
    _wizRender();
  };
  function _wizBubble(role, text) { return `<div class="syl-wz-row ${role}"><div class="syl-wz-bub ${role}">${_esc(text)}</div></div>`; }
  function _wizAck(key, v, label) {
    if (key === 'exam') {
      const days = parseInt(v, 10);
      if (isNaN(days)) return 'מצוין, רשמתי את תאריך המבחן — נפרוס את כל החומר עד אז.';
      if (days <= 14) return 'טווח קצר — נשמור על קצב ממוקד. קדימה.';
      if (days <= 30) return 'חודש זה טווח טוב להתכונן בלי לחץ.';
      return 'יש לנו מרחב נוח לפרוס את החומר. מעולה.';
    }
    if (key === 'count') return `סבבה — נחלק את הדרך לבערך ${_esc(label)} אבני דרך.`;
    return '';
  }
  function _wizRender() {
    const box = document.getElementById('syl-wiz'); if (!box || !_mWiz) return;
    let html = '<div class="syl-wz-feed">' + _wizBubble('ai', _WIZ_INTRO);
    for (let i = 0; i < _mWiz.step; i++) {
      html += _wizBubble('ai', _WIZ[i].q) + _wizBubble('me', _mWiz.labels[i]);
      if (_mWiz.acks[i]) html += _wizBubble('ai', _mWiz.acks[i]);
    }
    if (_mWiz.step < _WIZ.length) {
      const w = _WIZ[_mWiz.step];
      html += _wizBubble('ai', w.q);
      if (w.type === 'text') {
        html += `<textarea id="syl-wz-text" class="syl-wz-text" rows="2" placeholder="נושא לכל שורה (אופציונלי)"></textarea>
                 <div class="syl-wz-opts"><button class="syl-wz-btn" onclick="sfWizText(true)">דלג, סדר לבד</button><button class="syl-wz-btn on" onclick="sfWizText(false)">סיום ובנייה</button></div>`;
      } else if (_mWiz.dateMode) {
        html += `<div class="syl-wz-date"><input type="date" id="syl-wz-d" class="syl-man-i"><button class="syl-wz-btn on" onclick="sfWizDate()">אישור</button></div>`;
      } else {
        html += '<div class="syl-wz-opts">' + w.opts.map(o => `<button class="syl-wz-btn" onclick="sfWizAnswer('${o.v}','${_esc(o.l)}')">${o.l}</button>`).join('') + '</div>';
      }
    }
    html += '</div>';
    box.innerHTML = html;
    const fd = box.querySelector('.syl-wz-feed'); if (fd) fd.scrollTop = fd.scrollHeight;
    const t = document.getElementById('syl-wz-text'); if (t) t.focus();
  }
  window.sfWizAnswer = function (v, label) {
    const w = _WIZ[_mWiz.step];
    if (w.key === 'exam' && v === 'date') { _mWiz.dateMode = true; _wizRender(); return; }
    _mWiz.answers[w.key] = v; _mWiz.labels[_mWiz.step] = label || v; _mWiz.acks[_mWiz.step] = _wizAck(w.key, v, label); _mWiz.dateMode = false;
    _mWiz.step++; _wizAdvance();
  };
  window.sfWizDate = function () {
    const d = document.getElementById('syl-wz-d'); if (!d || !d.value) { _toast('בחר תאריך'); return; }
    _mWiz.answers.examDate = d.value; _mWiz.labels[_mWiz.step] = _fmt(d.value); _mWiz.acks[_mWiz.step] = _wizAck('exam', 'date', _fmt(d.value)); _mWiz.dateMode = false;
    _mWiz.step++; _wizAdvance();
  };
  window.sfWizText = function (skip) {
    const t = document.getElementById('syl-wz-text');
    const val = (!skip && t) ? t.value.trim() : '';
    _mWiz.answers.topics = val;
    _mWiz.labels[_mWiz.step] = val ? `${val.split(/[\n,;]+/).filter(Boolean).length} נושאים` : 'שה-AI יסדר';
    _mWiz.step++; _wizAdvance();
  };
  function _wizAdvance() {
    if (_mWiz.step >= _WIZ.length) {
      const ms = _wizBuild();
      const box = document.getElementById('syl-wiz'); if (box) box.innerHTML = '';
      _mWiz = null;
      _applyMilestones(ms, false);
    } else _wizRender();
  }
  function _wizBuild() {
    const a = _mWiz.answers;
    const fdate = (dd) => (window.ld ? window.ld(dd) : dd.toISOString().slice(0, 10));
    const today = new Date();
    const examDate = a.examDate ? new Date(a.examDate + 'T12:00') : new Date(today.getTime() + (parseInt(a.exam) || 30) * 86400000);
    let topics = a.topics ? a.topics.split(/[\n,;]+/).map(s => s.replace(/^\s*(?:[-–*]|\d+[.)])\s*/, '').trim()).filter(t => t.length > 1) : [];
    const count = topics.length || (parseInt(a.count) || 6);
    if (!topics.length) topics = Array.from({ length: count }, (_, i) => `נושא ${i + 1}`);
    const prepEnd = new Date(examDate.getTime() - 3 * 86400000);
    const span = Math.max(1, (prepEnd - today) / 86400000);
    const stepD = span / topics.length;
    const out = topics.map((t, i) => ({ date: fdate(new Date(today.getTime() + Math.round(stepD * i) * 86400000)), topic: t, type: 'topic' }));
    out.push({ date: fdate(examDate), topic: 'מבחן', type: 'exam' });
    return out;
  }

  // ── MILESTONE PATH in the Progress page — planned vs actual + XP (the MAIN) ──
  const XP_PER = 30;
  function _awardXP(n) { const s = _S(); s.points = Math.max(0, (s.points || 0) + n); _save(); if (window.toast) toast((n > 0 ? '+' : '') + n + ' XP'); }

  window.sfReachMilestone = function (cid, mid) {
    if (!isP()) { if (window.AIWP && AIWP.openPaywall) AIWP.openPaywall(); return; }
    const c = _courses().find(x => String(x.id) === String(cid)); if (!c) return;
    const m = (c.milestones || []).find(x => String(x.id) === String(mid)); if (!m) return;
    m.done = !m.done;
    _awardXP(m.done ? XP_PER : -XP_PER);
    if (window.renderProgress) { try { window.renderProgress(); } catch (e) { sfRenderMilestonePath(); } }
    else sfRenderMilestonePath();
  };

  function sfRenderMilestonePath() {
    const page = document.getElementById('page-progress'); if (!page) return;
    let card = document.getElementById('mst-card'); if (card) card.remove();
    card = document.createElement('div'); card.id = 'mst-card';

    if (!isP()) {
      card.innerHTML =
        `<div class="mst-wrap syl-locked">
           <div class="aiwp-badge aiwp-badge-locked">${_lock()}<span>פרימיום · נעול</span></div>
           <div class="syl-title">מסלול הסילבוס</div>
           <div class="syl-sub">עקוב אחרי המסלול שלך מול הסילבוס, צבור XP על כל אבן דרך, וראה אם אתה במסלול.</div>
           <button class="aiwp-cta" onclick="AIWP&&AIWP.openPaywall&&AIWP.openPaywall()">${_spark()}<span>שדרג לפרימיום</span></button>
         </div>`;
      _mountTop(page, card); return;
    }

    const courses = _courses().filter(c => _ordered(c).length);
    if (!courses.length) {
      card.innerHTML = `<div class="mst-wrap"><div class="mst-top"><div class="syl-title">מסלול הסילבוס</div><span class="aiwp-badge"><span>${_spark()}</span><span>פרימיום</span></span></div><div class="syl-sub">הגדר אבני דרך לקורסים (במסך "סיכום שבועי" → ערוך) כדי לראות את המסלול שלך כאן.</div></div>`;
      _mountTop(page, card); return;
    }

    const blocks = courses.map(c => {
      const ms = _ordered(c);
      const st = sfMilestoneStatus(c);
      const shouldIdx = st ? st.idx : 0;                 // 1-based: where you should be by date
      const doneCount = ms.filter(m => m.done).length;
      const status = doneCount >= shouldIdx ? { t: doneCount > shouldIdx ? 'מקדים' : 'במסלול', cls: 'on' }
                                            : { t: `מאחור ב-${shouldIdx - doneCount}`, cls: 'behind' };
      const nodes = ms.map((m, i) => {
        const isExam = m.type === 'exam';
        const cls = m.done ? 'done' : (i === shouldIdx - 1 ? 'should' : 'future');
        const ic = m.done ? _check() : (isExam ? _target() : (i + 1));
        return `<button class="mst-node ${cls}${isExam ? ' exam' : ''}" onclick="sfReachMilestone('${c.id}','${m.id}')" title="${_esc(m.topic)}${m.date ? ' · ' + _fmt(m.date) : ''}">
                  <span class="mst-ic">${ic}</span>
                  <span class="mst-lbl">${_esc(isExam ? 'מבחן' : m.topic)}</span>
                </button>`;
      }).join('');
      return `<div class="mst-course">
          <div class="mst-hd"><div class="mst-name">${_esc(c.name)}</div><div class="mst-status ${status.cls}">${status.t}</div></div>
          <div class="mst-track">${nodes}</div>
          <div style="margin-top:14px; text-align:left;">
            <button class="aiwp-cta" style="padding:10px 16px; font-size:0.9rem; border-radius:12px; width:auto; display:inline-flex;" onclick="if(window.sfOpenTutor) sfOpenTutor('${c.id}')">${_spark()}<span>דבר עם המורה הפרטי</span></button>
          </div>
        </div>`;
    }).join('');

    const totalXP = courses.reduce((s, c) => s + _ordered(c).filter(m => m.done).length, 0) * XP_PER;
    card.innerHTML =
      `<div class="mst-wrap">
         <div class="mst-top"><div class="syl-title">מסלול הסילבוס</div><div class="mst-xp">${_spark()}<span>${totalXP} XP</span></div></div>
         <div class="mst-sub">לחץ על אבן דרך כשסיימת אותה — תזכה ב-${XP_PER} XP ותראה אם אתה במסלול.</div>
         ${blocks}
       </div>`;
    _mountTop(page, card);
  }
  window.sfRenderMilestonePath = sfRenderMilestonePath;

  function _mountTop(page, card) {
    const header = page.querySelector('.page-header');
    if (header && header.parentNode) header.parentNode.insertBefore(card, header.nextSibling);
    else page.insertBefore(card, page.firstChild);
  }

  // ── AI Tutor — full implementation lives in sf-12-tutor.js (dedicated page).
  //    The "מורה פרטי" buttons here call window.sfOpenTutor, which sf-12 defines.

  // ── tiny inline icons ───────────────────────────────────────────────────────
  function _target() { return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/></svg>'; }
  function _clip() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.05 12.2 20.2a5 5 0 0 1-7.1-7.05l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8"/></svg>'; }
  function _chat() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/></svg>'; }
  function _spark() { return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>'; }
  function _lock() { return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'; }
  function _check() { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'; }

  // ── Non-invasively inject our cards whenever those pages repaint ────────────
  function _hook() {
    if (typeof window.renderWeeklyReview === 'function' && !window.renderWeeklyReview._sylWrapped) {
      const orig = window.renderWeeklyReview;
      window.renderWeeklyReview = function () { const r = orig.apply(this, arguments); try { sfRenderSyllabusCard(); } catch (e) {} return r; };
      window.renderWeeklyReview._sylWrapped = true;
    }
    if (typeof window.renderProgress === 'function' && !window.renderProgress._sylWrapped) {
      const origP = window.renderProgress;
      window.renderProgress = function () { const r = origP.apply(this, arguments); try { sfRenderMilestonePath(); } catch (e) {} return r; };
      window.renderProgress._sylWrapped = true;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_hook, 0));
  else setTimeout(_hook, 0);
})();
