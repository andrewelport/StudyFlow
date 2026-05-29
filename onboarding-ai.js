/* =====================================================================
   StudyFlow — AI-Automated Onboarding (onboarding-ai.js)
   ---------------------------------------------------------------------
   Additive module. Loads AFTER app_v58.js and reuses its globals:
     S, save, uid, ld, toast, callAI, initApp, finishOnboarding, escapeHtml
   Adds:
     • A Gemini multimodal REST client (text + images + PDFs)
     • A first-step "smart setup": upload syllabi / photos / PDFs and let
       the AI extract courses, exams, assignments, class schedule & prefs
     • An editable review screen that writes straight into the app's model
     • A persisted knowledge base (S.aiKnowledge / S.aiContext) surfaced to
       the schedule & study-plan generators via window.sfStudyContext()
   All new globals are namespaced sfob* / SFOB to avoid collisions.
   ===================================================================== */
(function () {
  'use strict';

  // Default models tried in order (first that the key can access wins).
  const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  // Leave room for a project-wide key (kept empty — users add their own in Settings).
  const GEMINI_DEV_KEY = '';
  const KEY_HELP_URL = 'https://aistudio.google.com/apikey';

  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const dayHe = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  function geminiKey() { return (S && S.geminiApiKey ? String(S.geminiApiKey).trim() : '') || GEMINI_DEV_KEY; }
  function hasGemini() { return !!geminiKey(); }

  // ── helpers ─────────────────────────────────────────────────────────
  function clampDay(d) { d = parseInt(d, 10); return isNaN(d) ? 0 : Math.max(0, Math.min(6, d)); }
  function validDate(s) {
    if (!s || s === 'null') return '';
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const mo = +m[2], da = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return '';
    return m[0];
  }
  function validTime(s) { return /^\d{1,2}:\d{2}$/.test(String(s || '')) ? String(s).padStart(5, '0') : ''; }

  function parseJSON(text) {
    if (text == null) return null;
    if (typeof text === 'object') return text;
    let s = String(text).trim();
    const f = s.match(/```(?:json)?\s*([\s\S]*?)```/i); if (f) s = f[1].trim();
    try { return JSON.parse(s); } catch (e) { /* fall through */ }
    const i = s.search(/[\[{]/);
    if (i >= 0) {
      const open = s[i], close = open === '{' ? '}' : ']'; let d = 0, q = false, b = false;
      for (let j = i; j < s.length; j++) {
        const c = s[j];
        if (q) { if (b) b = false; else if (c === '\\') b = true; else if (c === '"') q = false; }
        else { if (c === '"') q = true; else if (c === open) d++; else if (c === close) { d--; if (d === 0) { try { return JSON.parse(s.slice(i, j + 1)); } catch (e2) { return null; } } } }
      }
    }
    return null;
  }

  // ── Gemini REST client (multimodal) ─────────────────────────────────
  async function geminiGenerate(parts, opts) {
    opts = opts || {};
    const key = geminiKey();
    if (!key) throw new Error('חסר מפתח Gemini — הוסיפו אותו כדי להשתמש בהקמה החכמה');
    const models = opts.model ? [opts.model] : GEMINI_MODELS.slice();
    const body = {
      contents: [{ role: 'user', parts: Array.isArray(parts) ? parts : [{ text: String(parts) }] }],
      generationConfig: {
        temperature: opts.temperature != null ? opts.temperature : 0.2,
        maxOutputTokens: opts.maxTokens || 8192,
      },
    };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
    if (opts.json) body.generationConfig.responseMimeType = 'application/json';

    let lastErr = null;
    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        if (res.status === 400) { const d = await res.json().catch(() => ({})); throw new Error('בקשה שגויה ל-Gemini: ' + ((d.error && d.error.message) || '400')); }
        if (res.status === 401 || res.status === 403) throw new Error('מפתח Gemini לא תקין או חסר הרשאה');
        if (res.status === 429) throw new Error('חריגת מכסת Gemini — נסו שוב בעוד דקה');
        if (res.status === 404) { lastErr = new Error('מודל לא זמין: ' + model); continue; } // try next model
        if (!res.ok) { lastErr = new Error('שגיאת שרת Gemini (' + res.status + ')'); continue; }
        const d = await res.json();
        const cand = d.candidates && d.candidates[0];
        if (!cand) {
          const bf = d.promptFeedback && d.promptFeedback.blockReason;
          throw new Error(bf ? ('התוכן נחסם על ידי Gemini: ' + bf) : 'Gemini לא החזיר תשובה');
        }
        const txt = ((cand.content && cand.content.parts) || []).map(p => p.text || '').join('').trim();
        if (!txt) throw new Error('Gemini החזיר תשובה ריקה — נסו קובץ ברור יותר');
        return txt;
      } catch (e) {
        lastErr = e;
        if (/מפתח|נחסם|חריגת|שגויה/.test(e.message || '')) throw e; // hard errors: don't retry other models
      }
    }
    throw lastErr || new Error('שגיאת Gemini');
  }

  // ── file → Gemini part ──────────────────────────────────────────────
  function readDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('קריאת קובץ נכשלה')); r.readAsDataURL(file); }); }
  function readText(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('קריאת קובץ נכשלה')); r.readAsText(file); }); }

  const MAX_INLINE = 18 * 1024 * 1024; // ~18MB inline-data safety ceiling
  async function fileToPart(file) {
    const type = file.type || '';
    const name = (file.name || '').toLowerCase();
    const isImg = type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif|gif|bmp)$/.test(name);
    const isPdf = type === 'application/pdf' || /\.pdf$/.test(name);
    const isText = type.startsWith('text/') || /\.(txt|md|csv|rtf|json)$/.test(name);
    if (isImg || isPdf) {
      if (file.size > MAX_INLINE) throw new Error(`הקובץ "${file.name}" גדול מדי (מקסימום 18MB)`);
      const dataUrl = await readDataURL(file);
      const base64 = String(dataUrl).split(',')[1] || '';
      const mime = isPdf ? 'application/pdf' : (type || 'image/jpeg');
      return { inline_data: { mime_type: mime, data: base64 } };
    }
    if (isText) {
      const t = await readText(file);
      return { text: `\n--- קובץ: ${file.name} ---\n${String(t).slice(0, 24000)}` };
    }
    // Unknown (e.g. .docx) — try a text read; bail if it looks binary.
    try {
      const t = await readText(file);
      if (/[\x00-\x08\x0E-\x1F]/.test(String(t).slice(0, 300))) throw 0;
      return { text: `\n--- קובץ: ${file.name} ---\n${String(t).slice(0, 24000)}` };
    } catch (e) {
      throw new Error(`סוג קובץ לא נתמך: ${file.name}. נסו PDF, תמונה או טקסט (למשל ייצאו Word ל-PDF).`);
    }
  }

  // ── extraction ──────────────────────────────────────────────────────
  const EXTRACT_SYS =
`אתה מנוע חילוץ מידע אקדמי של אפליקציית StudyFlow. קיבלת חומרים של סטודנט (סילבוסים, מערכת שעות, צילומים, מסמכים). חלץ כל פרט רלוונטי והחזר JSON תקין בלבד בעברית, במבנה המדויק הבא:
{
 "student_name": null,
 "institution": null,
 "program": null,
 "semester": null,
 "courses": [{"name":"", "instructor":null, "credits":null, "topics":[], "grading":null, "notes":null}],
 "exams": [{"course":"", "title":null, "date":null, "type":"מבחן", "weight":null, "coverage":null}],
 "assignments": [{"course":"", "name":"", "due":null, "weight":null}],
 "class_schedule": [{"course":"", "day":0, "start":"08:00", "end":"10:00", "location":null, "kind":"הרצאה"}],
 "fixed_commitments": [{"name":"", "day":0, "start":"08:00", "end":"10:00"}],
 "preferences": {"focus_time":null, "wake":null, "sleep":null},
 "summary": "",
 "confidence": 0.0
}
כללי ברזל:
- "day": מספר יום בשבוע — ראשון=0, שני=1, שלישי=2, רביעי=3, חמישי=4, שישי=5, שבת=6.
- תאריכים בפורמט YYYY-MM-DD בלבד. אם השנה לא מצוינת, הסק לפי הסמסטר/ההקשר. אם תאריך לא ידוע — null. אל תמציא תאריכים.
- שעות בפורמט 24 שעות "HH:MM".
- "class_schedule": שיעורים שבועיים קבועים (הרצאות/תרגולים/מעבדות). "fixed_commitments": מחויבויות לא-אקדמיות אם הוזכרו (עבודה, אימון).
- אם מידע חסר — null או מערך ריק. אל תמציא ואל תשלים בניחוש.
- "summary": 2-4 משפטים בעברית שמסכמים מה נמצא (כמה קורסים, מבחנים קרובים, עומס כללי).
- "confidence": מידת הביטחון בחילוץ (0.0-1.0).
החזר JSON בלבד, ללא טקסט נוסף וללא הסברים.`;

  async function extractFromFiles(files, extraText) {
    const parts = [{ text: 'חלץ את כל המידע האקדמי מהחומרים הבאים והחזר JSON לפי הסכימה שהוגדרה.' }];
    for (const f of files) parts.push(await fileToPart(f));
    if (extraText && extraText.trim()) parts.push({ text: '\n--- הערות נוספות מהסטודנט ---\n' + extraText.trim() });
    const raw = await geminiGenerate(parts, { system: EXTRACT_SYS, json: true, temperature: 0.15, maxTokens: 8192 });
    const data = parseJSON(raw);
    if (!data || typeof data !== 'object') throw new Error('לא הצלחתי לפענח את החומרים. נסו שוב או הוסיפו קובץ ברור יותר.');
    return normalize(data);
  }

  function normalize(d) {
    d.courses = Array.isArray(d.courses) ? d.courses.filter(c => c && c.name) : [];
    d.exams = Array.isArray(d.exams) ? d.exams.filter(e => e && e.course) : [];
    d.assignments = Array.isArray(d.assignments) ? d.assignments.filter(a => a && a.name) : [];
    d.class_schedule = Array.isArray(d.class_schedule) ? d.class_schedule.filter(s => s && s.course && validTime(s.start) && validTime(s.end)) : [];
    d.fixed_commitments = Array.isArray(d.fixed_commitments) ? d.fixed_commitments.filter(s => s && s.name && validTime(s.start) && validTime(s.end)) : [];
    d.preferences = d.preferences && typeof d.preferences === 'object' ? d.preferences : {};
    return d;
  }

  // ── apply extracted data → app model ────────────────────────────────
  const COLORS = ['#1fb45c', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

  function applyExtracted(d, override) {
    override = override || {};
    if (override.name) S.userName = String(override.name).slice(0, 50);
    else if (d.student_name && d.student_name !== 'null') S.userName = String(d.student_name).slice(0, 50);
    if (override.institution != null) S.institution = String(override.institution).slice(0, 80);
    else if (d.institution && d.institution !== 'null') S.institution = String(d.institution).slice(0, 80);

    S.courses = S.courses || []; S.exams = S.exams || []; S.tasks = S.tasks || []; S.anchors = S.anchors || [];
    const colorOf = {}; let ci = 0;
    d.courses.forEach(c => {
      const name = String(c.name).slice(0, 80);
      if (!S.courses.some(x => x.name === name)) S.courses.push({ id: uid(), name, examDate: '', hoursPerWeek: 6 });
      colorOf[c.name] = COLORS[ci++ % COLORS.length];
    });
    d.exams.forEach(e => {
      const date = validDate(e.date);
      if (!S.exams.some(x => x.course === e.course && x.date === date)) {
        S.exams.push({ id: uid(), course: e.course, date: date || '', type: e.type || 'מבחן', conf: 3, readyPct: 0, createdDate: ld(new Date()) });
      }
      const co = S.courses.find(x => x.name === e.course); if (co && !co.examDate && date) co.examDate = date;
    });
    d.assignments.forEach(a => {
      const due = validDate(a.due); if (!due) return;
      S.tasks.push({ id: uid(), name: String(a.name).slice(0, 80), course: a.course || 'כללי', date: due, time: '', duration: "90 דק'", priority: 'בינוני', done: false, missed: false, isHomework: true });
    });
    d.class_schedule.forEach(s => {
      const nm = (String(s.course) + (s.kind ? ` (${s.kind})` : '')).slice(0, 60);
      S.anchors.push({ id: uid(), name: nm, day: clampDay(s.day), start: validTime(s.start), end: validTime(s.end), travelMin: 0, color: colorOf[s.course] || '#1fb45c', endDate: null });
    });
    d.fixed_commitments.forEach(s => {
      S.anchors.push({ id: uid(), name: String(s.name).slice(0, 60), day: clampDay(s.day), start: validTime(s.start), end: validTime(s.end), travelMin: 0, color: '#64748b', endDate: null });
    });

    const pr = d.preferences || {};
    if (validTime(pr.wake)) S.wakeTime = validTime(pr.wake);
    if (validTime(pr.sleep)) S.sleepTime = validTime(pr.sleep);
    S.profile = Object.assign({ focus_time: 'בוקר 06–10', focus_span: '60–75 דקות', style: 'קריאה וסיכום', exam_fear: 'לא לסיים ללמוד' }, S.profile || {});
    if (pr.focus_time) S.profile.focus_time = pr.focus_time;

    persistKnowledge(d);
    save();
  }

  // ── persisted knowledge base (bounded for localStorage) ─────────────
  function persistKnowledge(d) {
    S.aiKnowledge = {
      institution: d.institution || null, program: d.program || null, semester: d.semester || null,
      courses: d.courses.map(c => ({
        name: c.name, instructor: c.instructor || null,
        topics: Array.isArray(c.topics) ? c.topics.slice(0, 25) : [],
        grading: c.grading || null, notes: c.notes ? String(c.notes).slice(0, 300) : null,
      })).slice(0, 30),
      exams: d.exams.map(e => ({ course: e.course, date: validDate(e.date) || null, type: e.type || null, weight: e.weight || null, coverage: e.coverage ? String(e.coverage).slice(0, 200) : null })).slice(0, 40),
      generatedAt: ld(new Date()),
    };
    S.aiContext = String(d.summary || '').slice(0, 1200);
  }

  // Compact Hebrew context surfaced to the schedule & study-plan generators.
  function sfStudyContext() {
    const k = S && S.aiKnowledge;
    if (!k && !(S && S.aiContext)) return '';
    const L = [];
    if (k) {
      if (k.institution || k.program || k.semester) L.push(`מוסד: ${k.institution || '—'} · תוכנית: ${k.program || '—'} · סמסטר: ${k.semester || '—'}`);
      (k.courses || []).forEach(c => {
        let line = `- ${c.name}`;
        if (c.instructor) line += ` · מרצה: ${c.instructor}`;
        if (c.grading) line += ` · ציון: ${c.grading}`;
        if (c.topics && c.topics.length) line += ` · נושאים: ${c.topics.slice(0, 10).join(', ')}`;
        L.push(line);
        if (c.notes) L.push(`   • ${c.notes}`);
      });
      (k.exams || []).filter(e => e.coverage || e.weight).forEach(e => {
        L.push(`- מבחן ${e.course}${e.date ? ` (${e.date})` : ''}${e.weight ? ` · משקל ${e.weight}` : ''}${e.coverage ? ` · חומר: ${e.coverage}` : ''}`);
      });
    }
    if (S && S.aiContext) L.push('תקציר: ' + S.aiContext);
    return L.join('\n').slice(0, 2500);
  }
  window.sfStudyContext = sfStudyContext;

  // =====================================================================
  // UI — upload + extraction + review overlay
  // =====================================================================
  let sfobFiles = [];     // pending File[]
  let sfobData = null;    // last extracted+normalized data (mutable in review)

  function overlay() { return document.getElementById('sfob-ov'); }
  function closeOverlay() { const o = overlay(); if (o) o.remove(); sfobFiles = []; }

  function ensureStyles() {
    if (document.getElementById('sfob-styles')) return;
    const st = document.createElement('style'); st.id = 'sfob-styles';
    st.textContent = `
      @keyframes sfobSpin{to{transform:rotate(360deg)}}
      @keyframes sfobIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      #sfob-ov{position:fixed;inset:0;z-index:100050;background:rgba(15,23,42,.55);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl}
      .sfob-card{background:var(--surface,#fff);color:var(--text,#111);width:100%;max-width:560px;max-height:92vh;overflow-y:auto;border-radius:24px;padding:1.4rem;box-shadow:0 24px 60px rgba(0,0,0,.3);animation:sfobIn .25s ease}
      .sfob-h{font-weight:900;font-size:1.25rem;margin-bottom:.25rem}
      .sfob-sub{color:var(--muted,#888);font-size:.9rem;margin-bottom:1rem;line-height:1.5}
      .sfob-drop{border:2px dashed var(--border,#cbd5e1);border-radius:18px;padding:1.6rem 1rem;text-align:center;cursor:pointer;transition:all .18s;background:var(--surface2,#f6f7fb)}
      .sfob-drop:hover,.sfob-drop.drag{border-color:var(--accent,#1fb45c);background:var(--accent-light,#e7f7ee)}
      .sfob-file{display:flex;align-items:center;gap:.5rem;background:var(--surface2,#f4f4f7);border-radius:12px;padding:.5rem .7rem;margin-top:.5rem;font-size:.85rem}
      .sfob-file b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
      .sfob-x{border:none;background:transparent;color:var(--muted,#888);cursor:pointer;font-size:1.1rem;line-height:1;padding:0 .2rem}
      .sfob-btn{width:100%;border:none;border-radius:14px;background:linear-gradient(135deg,var(--accent,#1fb45c),#34d27e);color:#fff;font-weight:800;padding:.9rem;cursor:pointer;font-size:1rem;margin-top:1rem}
      .sfob-btn:disabled{opacity:.5;cursor:default}
      .sfob-ghost{width:100%;border:1px solid var(--border,#e2e8f0);background:transparent;color:var(--muted,#64748b);border-radius:14px;padding:.7rem;cursor:pointer;font-weight:700;margin-top:.5rem}
      .sfob-inp{width:100%;border:1px solid var(--border,#cbd5e1);border-radius:12px;padding:.65rem .8rem;font-family:inherit;background:var(--surface,#fff);color:var(--text,#111);direction:rtl}
      .sfob-spin{width:40px;height:40px;border:4px solid var(--border,#e2e8f0);border-top-color:var(--accent,#1fb45c);border-radius:50%;animation:sfobSpin .9s linear infinite;margin:1.4rem auto}
      .sfob-sec{font-weight:800;font-size:.82rem;color:var(--muted,#64748b);margin:1rem 0 .4rem}
      .sfob-row{display:flex;align-items:center;gap:.5rem;background:var(--surface2,#f6f7fb);border-radius:12px;padding:.55rem .7rem;margin-bottom:.35rem;font-size:.88rem}
      .sfob-row b{font-weight:700}
      .sfob-row .sfob-meta{color:var(--muted,#888);font-size:.8rem;margin-inline-start:auto}
      .sfob-chip{display:inline-flex;align-items:center;gap:.35rem;background:var(--accent-light,#e7f7ee);color:var(--accent,#1fb45c);border-radius:999px;padding:.3rem .7rem;font-size:.82rem;font-weight:700;margin:0 0 .35rem .35rem}
      .sfob-err{background:var(--red-light,#fff2f2);color:var(--red,#e5484d);border-radius:12px;padding:.7rem .9rem;font-size:.88rem;margin-top:.8rem;line-height:1.5}
    `;
    document.head.appendChild(st);
  }

  const FILE_SVG = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#1fb45c)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>';

  function openUpload() {
    ensureStyles();
    closeOverlay();
    const ov = document.createElement('div'); ov.id = 'sfob-ov';
    ov.addEventListener('click', (e) => { if (e.target === ov) closeOverlay(); });
    document.body.appendChild(ov);
    renderUpload();
  }

  function renderUpload(errMsg) {
    const ov = overlay(); if (!ov) return;
    const keyBlock = hasGemini() ? '' :
      `<div class="sfob-sec">מפתח Gemini API</div>
       <input id="sfob-key" class="sfob-inp" type="password" placeholder="הדביקו מפתח Gemini כדי להפעיל חילוץ אוטומטי" />
       <div style="font-size:.78rem;color:var(--muted,#888);margin-top:.35rem">מפתח חינמי: <a href="${KEY_HELP_URL}" target="_blank" rel="noopener" style="color:var(--accent,#1fb45c)">aistudio.google.com/apikey</a> · נשמר במכשיר בלבד</div>`;
    ov.innerHTML = `
      <div class="sfob-card">
        <div class="sfob-h">✨ הקמה חכמה ב-30 שניות</div>
        <div class="sfob-sub">העלו סילבוס, מערכת שעות או צילום מסך — וה-AI יקים לכם את הסמסטר: קורסים, מבחנים, מטלות ומערכת שעות. אפשר כמה קבצים יחד.</div>
        <div class="sfob-drop" id="sfob-drop">
          ${FILE_SVG}
          <div style="font-weight:800;margin-top:.5rem">גררו לכאן קבצים או לחצו לבחירה</div>
          <div style="font-size:.8rem;color:var(--muted,#888);margin-top:.2rem">PDF · תמונות · טקסט</div>
        </div>
        <input type="file" id="sfob-input" multiple accept="image/*,application/pdf,.pdf,.txt,.md,.csv,.doc,.docx" style="display:none" />
        <div id="sfob-list"></div>
        <div class="sfob-sec">הערות (לא חובה)</div>
        <textarea id="sfob-notes" class="sfob-inp" rows="2" placeholder="למשל: 'אני מתקשה בחדו״א, מעדיף ללמוד בבוקר'"></textarea>
        ${keyBlock}
        ${errMsg ? `<div class="sfob-err">${esc(errMsg)}</div>` : ''}
        <button class="sfob-btn" id="sfob-go">חלצו מידע ✨</button>
        <button class="sfob-ghost" onclick="sfobClose()">אעשה זאת ידנית →</button>
      </div>`;
    const input = ov.querySelector('#sfob-input');
    const drop = ov.querySelector('#sfob-drop');
    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
    ov.querySelector('#sfob-go').addEventListener('click', runExtract);
    renderFileList();
  }

  function addFiles(list) {
    for (const f of Array.from(list || [])) if (!sfobFiles.some(x => x.name === f.name && x.size === f.size)) sfobFiles.push(f);
    renderFileList();
  }
  window.sfobRemoveFile = function (i) { sfobFiles.splice(i, 1); renderFileList(); };

  function renderFileList() {
    const wrap = document.querySelector('#sfob-list'); if (!wrap) return;
    wrap.innerHTML = sfobFiles.map((f, i) =>
      `<div class="sfob-file"><span>📄</span><b>${esc(f.name)}</b><span style="color:var(--muted,#888);font-size:.78rem">${(f.size / 1024).toFixed(0)}KB</span><button class="sfob-x" onclick="sfobRemoveFile(${i})">×</button></div>`
    ).join('');
    const go = document.querySelector('#sfob-go'); if (go) go.disabled = sfobFiles.length === 0;
  }

  async function runExtract() {
    const ov = overlay(); if (!ov) return;
    const keyInp = ov.querySelector('#sfob-key');
    if (keyInp && keyInp.value.trim()) { S.geminiApiKey = keyInp.value.replace(/\s+/g, ''); save(); }
    if (!hasGemini()) { renderUpload('צריך מפתח Gemini כדי להפעיל חילוץ אוטומטי. הדביקו מפתח למעלה, או המשיכו ידנית.'); return; }
    if (!sfobFiles.length) { renderUpload('הוסיפו לפחות קובץ אחד.'); return; }
    const notes = (ov.querySelector('#sfob-notes') || {}).value || '';
    renderExtracting();
    try {
      sfobData = await extractFromFiles(sfobFiles, notes);
      renderReview();
    } catch (e) {
      renderUpload((e && e.message) ? e.message : 'החילוץ נכשל. נסו שוב.');
    }
  }

  function renderExtracting() {
    const ov = overlay(); if (!ov) return;
    const msgs = ['קורא את הקבצים…', 'מזהה קורסים ומבחנים…', 'מאתר מערכת שעות…', 'בונה לכם את הסמסטר…'];
    ov.innerHTML = `<div class="sfob-card" style="text-align:center">
      <div class="sfob-spin"></div>
      <div class="sfob-h" style="font-size:1.1rem">ה-AI עובד…</div>
      <div class="sfob-sub" id="sfob-prog">${msgs[0]}</div></div>`;
    let i = 0; const t = setInterval(() => { const p = ov.querySelector('#sfob-prog'); if (!p) { clearInterval(t); return; } i = (i + 1) % msgs.length; p.textContent = msgs[i]; }, 1600);
  }

  function renderReview() {
    const ov = overlay(); if (!ov || !sfobData) return;
    const d = sfobData;
    const courseRows = d.courses.map((c, i) =>
      `<div class="sfob-row"><b>${esc(c.name)}</b>${c.instructor ? `<span class="sfob-meta">${esc(c.instructor)}</span>` : ''}<button class="sfob-x" onclick="sfobDel('courses',${i})">×</button></div>`).join('') || '<div style="color:var(--muted,#888);font-size:.85rem">לא נמצאו</div>';
    const examRows = d.exams.map((e, i) =>
      `<div class="sfob-row"><b>${esc(e.course)}</b><span class="sfob-meta">${esc(validDate(e.date) || 'ללא תאריך')} · ${esc(e.type || 'מבחן')}</span><button class="sfob-x" onclick="sfobDel('exams',${i})">×</button></div>`).join('') || '<div style="color:var(--muted,#888);font-size:.85rem">לא נמצאו</div>';
    const schedRows = d.class_schedule.map((s, i) =>
      `<div class="sfob-row"><b>${esc(s.course)}</b><span class="sfob-meta">${dayHe[clampDay(s.day)]} ${esc(s.start)}–${esc(s.end)}</span><button class="sfob-x" onclick="sfobDel('class_schedule',${i})">×</button></div>`).join('') || '<div style="color:var(--muted,#888);font-size:.85rem">לא נמצאה</div>';
    const asgRows = d.assignments.filter(a => validDate(a.due)).map((a, i) =>
      `<div class="sfob-row"><b>${esc(a.name)}</b><span class="sfob-meta">${esc(a.course || '')} · ${esc(validDate(a.due))}</span></div>`).join('');

    ov.innerHTML = `
      <div class="sfob-card">
        <div class="sfob-h">🎯 הנה מה שמצאתי</div>
        <div class="sfob-sub">${esc(d.summary || 'בדקו ואשרו — אפשר להסיר פריטים, והכול ניתן לעריכה אחר כך באפליקציה.')}</div>
        <div class="sfob-sec">שם</div>
        <input id="sfob-name" class="sfob-inp" placeholder="השם שלך" maxlength="50" value="${esc((d.student_name && d.student_name !== 'null') ? d.student_name : (S.userName || ''))}" />
        <div class="sfob-sec">מוסד לימודים</div>
        <input id="sfob-inst" class="sfob-inp" placeholder="מוסד (לא חובה)" maxlength="80" value="${esc((d.institution && d.institution !== 'null') ? d.institution : (S.institution || ''))}" />
        <div class="sfob-sec">קורסים (${d.courses.length})</div>${courseRows}
        <div class="sfob-sec">מבחנים (${d.exams.length})</div>${examRows}
        <div class="sfob-sec">מערכת שעות (${d.class_schedule.length})</div>${schedRows}
        ${asgRows ? `<div class="sfob-sec">מטלות (${d.assignments.filter(a => validDate(a.due)).length})</div>${asgRows}` : ''}
        <button class="sfob-btn" id="sfob-finish">סיימו והיכנסו →</button>
        <button class="sfob-ghost" onclick="sfobBackToUpload()">↩ הוסיפו עוד קבצים</button>
      </div>`;
    ov.querySelector('#sfob-finish').addEventListener('click', finishFromReview);
  }

  window.sfobDel = function (key, i) { if (sfobData && sfobData[key]) { sfobData[key].splice(i, 1); renderReview(); } };
  window.sfobBackToUpload = function () { renderUpload(); };
  window.sfobClose = function () { closeOverlay(); };

  function finishFromReview() {
    const ov = overlay(); if (!ov || !sfobData) return;
    const name = (ov.querySelector('#sfob-name') || {}).value || '';
    const inst = (ov.querySelector('#sfob-inst') || {}).value || '';
    if (!name.trim()) { renderReviewError('נא להזין שם כדי להמשיך'); return; }
    applyExtracted(sfobData, { name: name.trim(), institution: inst.trim() });
    const n = (S.courses || []).length, m = (S.exams || []).length;
    closeOverlay();
    if (typeof finishOnboarding === 'function') finishOnboarding();
    else if (typeof initApp === 'function') { initApp(); }
    setTimeout(() => { if (typeof toast === 'function') toast(`הסמסטר הוקם! ${n} קורסים · ${m} מבחנים`); }, 600);
  }
  function renderReviewError(msg) {
    const card = document.querySelector('#sfob-ov .sfob-card'); if (!card) return;
    let e = card.querySelector('.sfob-err'); if (!e) { e = document.createElement('div'); e.className = 'sfob-err'; card.querySelector('#sfob-finish').before(e); }
    e.textContent = msg;
  }

  window.sfobOpenUpload = openUpload;

  // =====================================================================
  // Inject the "smart setup" entry into the first onboarding step
  // =====================================================================
  function buildEntryCard() {
    const card = document.createElement('div');
    card.className = 'sfob-entry-card';
    card.style.cssText = 'background:linear-gradient(135deg,var(--accent,#1fb45c),#34d27e);color:#fff;border-radius:18px;padding:1rem 1.1rem;margin:0 0 1rem;box-shadow:0 8px 22px rgba(31, 180, 92,.3)';
    card.innerHTML = `
      <div style="font-weight:900;font-size:1.05rem;display:flex;align-items:center;gap:.4rem">✨ הקמה אוטומטית עם AI</div>
      <div style="font-size:.86rem;opacity:.92;margin:.3rem 0 .7rem;line-height:1.5">העלו סילבוס או צילום מערכת שעות — וה-AI ימלא קורסים, מבחנים ולו"ז עבורכם.</div>
      <button onclick="sfobOpenUpload()" style="background:#fff;color:var(--accent,#1fb45c);border:none;border-radius:12px;padding:.6rem 1rem;font-weight:800;cursor:pointer;width:100%">העלו קבצים →</button>
      <div style="text-align:center;font-size:.78rem;opacity:.8;margin-top:.55rem">או המשיכו להגדרה ידנית</div>`;
    return card;
  }
  function injectEntry() {
    ensureStyles();
    // Surface the AI option on the very first screen (attribution) AND the name step.
    [['ob2-s0', null], ['ob2-s1', '.ob2-fields']].forEach(([slideId, beforeSel]) => {
      const slide = document.getElementById(slideId);
      if (!slide || slide.querySelector('.sfob-entry-card')) return;
      const card = buildEntryCard();
      const anchor = beforeSel ? slide.querySelector(beforeSel) : null;
      if (anchor) anchor.parentNode.insertBefore(card, anchor);
      else slide.insertBefore(card, slide.firstChild);
    });
  }

  function init() {
    try { injectEntry(); } catch (e) { console.warn('[StudyFlow AI onboarding] init', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // expose for debugging / reuse
  window.SFOB = { geminiGenerate, extractFromFiles, applyExtracted, sfStudyContext, openUpload };
})();
