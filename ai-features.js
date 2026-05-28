/* =====================================================================
   StudyFlow — AI Intelligence Layer (ai-features.js)
   ---------------------------------------------------------------------
   Additive module. Loads AFTER app_v58.js and reuses its globals:
     S, save, callAI, toast, uid, ld, fmtDate, showPage, escapeHtml, closeModal
   Ports the AI capabilities of the "StudyPilot" reference app to a
   client-side, Groq-backed PWA: an AI Coach with intent routing, plus
   pure-JS engines for mastery tracking, grade projection and
   multi-course prioritization, and a local context builder.
   All new globals are namespaced with sf / SF to avoid collisions.
   ===================================================================== */
(function () {
  'use strict';

  // ── small utilities ────────────────────────────────────────────────
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const todayStr = () => ld(new Date());
  function daysUntil(dateStr) {
    if (!dateStr) return Infinity;
    const d = new Date(dateStr + 'T00:00:00');
    const n = new Date(); n.setHours(0, 0, 0, 0);
    return Math.round((d - n) / 86400000);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function durMin(t) { // "90 דק'" -> 90
    if (typeof t === 'number') return t;
    const m = String(t || '').match(/\d+/); return m ? parseInt(m[0], 10) : 60;
  }

  // Robust JSON extraction from an LLM string (handles ```json fences / stray prose)
  function sfParseJSON(text) {
    if (text == null) return null;
    if (typeof text === 'object') return text;
    let s = String(text).trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    try { return JSON.parse(s); } catch (e) { /* fall through */ }
    const first = s.search(/[\[{]/);
    if (first >= 0) {
      const open = s[first], close = open === '{' ? '}' : ']';
      let depth = 0, inStr = false, escFlag = false;
      for (let i = first; i < s.length; i++) {
        const c = s[i];
        if (inStr) { if (escFlag) escFlag = false; else if (c === '\\') escFlag = true; else if (c === '"') inStr = false; }
        else { if (c === '"') inStr = true; else if (c === open) depth++; else if (c === close) { depth--; if (depth === 0) { try { return JSON.parse(s.slice(first, i + 1)); } catch (e2) { return null; } } } }
      }
    }
    return null;
  }

  // ── data-model migration (runs once S is loaded from localStorage) ──
  function sfMigrate() {
    if (typeof S !== 'object' || !S) return;
    if (!S.mastery || typeof S.mastery !== 'object') S.mastery = {};      // {course:{topic:{score,count,last,hist[]}}}
    if (!Array.isArray(S.coachHistory)) S.coachHistory = [];               // [{role,content,ts}]
    if (!('aiBrief' in S)) S.aiBrief = null;                               // last weekly strategic review
    if (!Array.isArray(S.aiCheckins)) S.aiCheckins = [];                   // recent proactive nudges
    if (!S.aiState || typeof S.aiState !== 'object') S.aiState = { lastDecay: '', lastBrief: '', lastBriefShown: '' };
    // courses may gain an optional grades:[] lazily — no need to seed
  }

  // =====================================================================
  // 1) PROMPT LIBRARY  (Hebrew-first; model replies in the user's language)
  // =====================================================================
  const SF = {};
  SF.lang = () => 'he';

  SF.P = {
    intent:
`אתה מנוע זיהוי-כוונה של מערכת StudyFlow ללימודים. נתח הודעת סטודנט אחת והחזר JSON תקין בלבד (ללא טקסט נוסף):
{"intent":"NEW_TASK|DEADLINE_CHANGE|GRADE_REPORT|SCHEDULE_CHANGE|TOPIC_STRUGGLE|STATUS_QUESTION|EXAM_READINESS|STUDY_PLAN|SCHEDULE_REQUEST|FEEDBACK|GENERAL_CHAT","confidence":0.0-1.0,"course":"שם קורס|null","topic":"נושא|null","date":"YYYY-MM-DD|null","emotion":"neutral|stressed|frustrated|happy|urgent","lang":"he|en|mixed"}
כללים: בחר כוונה ראשית אחת. חלץ שם קורס/נושא/תאריך אם הוזכרו. זהה את שפת ההודעה.`,

    coach:
`אתה המאמן האקדמי האישי של הסטודנט במערכת StudyFlow — לא טיוטור גנרי. ענה בעברית (אלא אם הסטודנט כתב באנגלית).
עקרונות:
- התבסס על ההקשר שסופק (קורסים, מבחנים, מטלות, שליטה בנושאים, לו"ז). הזכר קורסים ומבחנים בשם ובתאריך.
- כל עצה ספציפית למצב של הסטודנט הזה — לעולם לא כללית.
- חם אך ישיר: אם הוא מפגר אחרי, אמור זאת ותן מסלול התאוששות קונקרטי.
- הכר ברגש בקצרה ואז עבור לפעולה.
- תשובה קצרה וברורה: פסקאות קצרות ורשימות, לא JSON. אל תמציא נתונים שלא בהקשר.`,

    status:
`אתה יועץ אקדמי כן ובונה במערכת StudyFlow. הסטודנט שואל "איך אני עומד?". ענה בעברית בטקסט חופשי:
- פתח בנקודה חיובית אמיתית מההקשר.
- התבסס על מספרים אמיתיים (ימים למבחן, אחוז מוכנות, שליטה בנושאים).
- חבר כל דאגה למסלול פעולה.
- סיים בפעולה קונקרטית אחת להיום.
היה ריאלי: אם משהו לא מציאותי בזמן שנותר, אמור זאת בעדינות.`,

    plan:
`אתה מתכנן למידה במערכת StudyFlow. בנה תוכנית לסשן למידה והחזר JSON תקין בלבד:
{"title":"כותרת","total_minutes":int,"warmup":"חימום 2-3 דק'","sections":[{"title":"...","minutes":int,"activity":"פעולה ספציפית","resources":"דפים/תרגילים/חומר אם ידוע","tip":"טיפ קצר|null"}],"cooldown":"סיכום 2-3 דק'"}
כללים: סכום ה-minutes של החלקים = total_minutes פחות חימום/סיכום. החלף בין פסיבי (קריאה) לאקטיבי (תרגול). יותר תרגול לנושאים עם שליטה נמוכה. היה ספציפי.`,

    exam:
`אתה מעריך מוכנות למבחן במערכת StudyFlow. הערך בכנות והחזר JSON תקין בלבד:
{"overall_readiness_percent":0-100,"projected_score_range":{"low":int,"high":int},"topics":[{"topic":"...","readiness":"READY|NEEDS_REVIEW|NEEDS_STUDY|NOT_PREPARED","hours_needed":number,"approach":"טקטיקה ספציפית"}],"summary":"סקירה קצרה","skip":["נושאים לדלג עליהם אם אין זמן"],"day_before":"תוכנית ערב לפני — חזרה קלה, בלי דחיסה","exam_day_tips":"טיפים ליום המבחן"}
היה כן לגבי ציון צפוי. אם אין מספיק זמן — אמור במפורש על אילו נושאים לוותר ולמה.`,

    adjust:
`אתה משבץ-לו"ז חכם במערכת StudyFlow. הוצע זמן חדש למשימה שצריך להזיז, והחזר JSON תקין בלבד:
{"date":"YYYY-MM-DD","time":"HH:MM","reason":"למה החלון הזה מתאים"}
שקול: שעות הפוקוס של הסטודנט, חלונות פנויים, קרבה לדדליין, ואי-חפיפה עם עוגנים.`,

    syllabus:
`אתה מחלץ מידע מסילבוס/מסמך קורס במערכת StudyFlow. קרא את הטקסט והחזר JSON תקין בלבד:
{"course_name":"שם הקורס|null","topics":["נושא"...],"exams":[{"name":"מבחן/בוחן/הגשה","date":"YYYY-MM-DD|null","type":"מבחן|בוחן|עבודה|הגשה","weight":"אחוז|null","coverage":"נושאים|null"}],"assignments":[{"name":"...","due":"YYYY-MM-DD|null","topics":["..."]}],"grading":"מבנה ציון אם צויין|null"}
אם תאריך לא ברור — null. אל תמציא תאריכים.`,

    classify:
`סווג מסמך לימודי. החזר JSON בלבד: {"type":"SYLLABUS|HOMEWORK|EXAM|NOTES|OTHER","confidence":0.0-1.0,"topics":["..."]}`,

    checkin:
`אתה מאמן StudyFlow ששולח נדנוד קצר ואישי (משפט-שניים, בעברית, ידידותי כמו חבר ללימודים). היה ספציפי לקורס/מטלה. אל תחזור על אותה תבנית. החזר רק את הטקסט.`,

    brief:
`אתה מנתח את שבוע הלימודים של הסטודנט במערכת StudyFlow ומכין תדריך בוקר אישי וקצר (3-5 משפטים בעברית). התבסס על ההקשר: מה הכי דחוף היום, איזה מבחן מתקרב, ומה הצעד הראשון. טון מעודד וממוקד-פעולה. החזר רק את הטקסט.`,

    weekly:
`אתה מבצע סקירה שבועית אסטרטגית במערכת StudyFlow (כמו "התדריך השבועי"). נתח את ההקשר והחזר JSON תקין בלבד:
{"student_message":"סיכום אישי בעברית, 4-7 משפטים","risk":[{"course":"...","level":"green|yellow|red","concern":"...|null"}],"priorities":[{"rank":int,"task":"ספציפי","course":"...","urgency":"critical|high|medium|low","hours":number,"why":"..."}],"focus_this_week":["הנחיה ממוקדת"...],"feasible":true|false,"sacrifices":"מה לקצץ אם עמוס|null"}
היה ספציפי (לא "תלמד יותר"). דרג סיכון: ירוק=במסלול, צהוב=דורש תשומת לב, אדום=בסיכון.`,
  };

  // task -> sampling config
  const TCFG = {
    intent: { t: 0.2, max: 400, json: true },
    coach: { t: 0.7, max: 2048, json: false },
    status: { t: 0.4, max: 1500, json: false },
    plan: { t: 0.4, max: 2048, json: true },
    exam: { t: 0.3, max: 2048, json: true },
    adjust: { t: 0.3, max: 600, json: true },
    syllabus: { t: 0.2, max: 4096, json: true },
    classify: { t: 0.2, max: 400, json: true },
    checkin: { t: 0.6, max: 200, json: false },
    brief: { t: 0.4, max: 600, json: false },
    weekly: { t: 0.3, max: 4096, json: true },
  };

  // =====================================================================
  // 2) sfAI — unified call over the app's existing global callAI()
  // =====================================================================
  async function sfAI(task, opts) {
    opts = opts || {};
    const cfg = TCFG[task] || { t: 0.5, max: 2048, json: false };
    if (typeof callAI !== 'function') throw new Error('AI לא זמין');
    const sys = opts.system || SF.P[task] || '';
    const messages = [];
    if (sys) messages.push({ role: 'system', content: sys });
    if (Array.isArray(opts.history)) for (const m of opts.history) if (m && m.role && m.content) messages.push({ role: m.role, content: m.content });
    const userContent = opts.context ? (opts.context + '\n\n---\n\n' + (opts.user || '')) : (opts.user || '');
    messages.push({ role: 'user', content: userContent });
    const json = opts.json != null ? opts.json : cfg.json;
    const raw = await callAI({ messages, temperature: opts.temperature != null ? opts.temperature : cfg.t, json, maxTokens: opts.maxTokens || cfg.max });
    if (json) { const p = sfParseJSON(raw); if (p == null) throw new Error('תשובת ה-AI לא הייתה JSON תקין'); return p; }
    return raw;
  }

  // =====================================================================
  // 3) ENGINES (pure JS — work offline, no API key)
  // =====================================================================

  // --- 3a. Mastery tracking (evidence-based EMA with recency + decay) ---
  const SFMastery = {
    BASE: { exam: 0.28, quiz: 0.22, homework: 0.12, practice: 0.08, self: 0.06, session: 0.04 },
    HALF: { exam: 30, quiz: 30, homework: 14, practice: 10, self: 10, session: 10 },
    FLOOR: 0.05,
    _node(course, topic) {
      if (!S.mastery) S.mastery = {};
      if (!S.mastery[course]) S.mastery[course] = {};
      if (!S.mastery[course][topic]) S.mastery[course][topic] = { score: 0, count: 0, last: '', hist: [] };
      return S.mastery[course][topic];
    },
    // score: 0..1 evidence of mastery; type: key of BASE
    update(course, topic, score, type) {
      if (!course || !topic) return null;
      score = clamp(Number(score) || 0, 0, 1);
      type = this.BASE[type] != null ? type : 'self';
      const n = this._node(course, topic);
      if (n.hist.length === 0) {
        // first real evidence — adopt it directly so mastery reflects reality at once
        // (seeded "introduced" topics set count but no history, so they land here too)
        n.score = score;
      } else {
        const base = this.BASE[type];
        const days = n.last ? Math.max(0, daysUntil(n.last) * -1) : 0;
        const recency = Math.exp(-days / (this.HALF[type] || 14));
        const diff = Math.abs(score - n.score);
        const consistency = diff <= 0.2 ? 1.1 : diff <= 0.4 ? 1.0 : 0.85;
        const volume = 1 / (1 + 0.1 * n.count);
        const w = clamp(base * recency * consistency * volume, 0, 0.6);
        n.score = clamp(n.score * (1 - w) + score * w, 0, 1);
      }
      n.count += 1;
      n.last = todayStr();
      n.hist.push({ d: n.last, s: Math.round(score * 100), t: type });
      if (n.hist.length > 20) n.hist = n.hist.slice(-20);
      return n;
    },
    decayAll() {
      const today = todayStr();
      if (S.aiState.lastDecay === today) return;
      const last = S.aiState.lastDecay ? Math.min(30, Math.max(0, daysUntil(S.aiState.lastDecay) * -1)) : 1;
      const days = Math.max(1, last);
      for (const c in S.mastery) for (const t in S.mastery[c]) {
        const n = S.mastery[c][t];
        let rate = 0.005; if (n.count > 10) rate = 0.003; else if (n.count < 3) rate = 0.008;
        for (let i = 0; i < days; i++) n.score = Math.max(n.score - rate * n.score * (1 - this.FLOOR), this.FLOOR);
      }
      S.aiState.lastDecay = today;
    },
    status(n) {
      if (!n || n.count === 0) return 'not_encountered';
      if (n.score >= 0.91) return 'mastered';
      if (n.count >= 2 && n.score >= 0.51) return 'assessed';
      if (n.count >= 2) return 'studying';
      return 'introduced';
    },
    courseAvg(course) {
      const t = S.mastery && S.mastery[course]; if (!t) return null;
      const ks = Object.keys(t); if (!ks.length) return null;
      return ks.reduce((a, k) => a + t[k].score, 0) / ks.length;
    },
  };

  // --- 3b. Grade projector (pure math) -------------------------------
  const SFGrades = {
    // course.grades: [{name, score:0-100, weight:0-100}]
    project(course) {
      const grades = (course && Array.isArray(course.grades)) ? course.grades : [];
      const gradedW = grades.reduce((a, g) => a + (Number(g.weight) || 0), 0);
      const wAvg = gradedW > 0 ? grades.reduce((a, g) => a + (Number(g.score) || 0) * (Number(g.weight) || 0), 0) / gradedW : null;
      const remainW = Math.max(0, 100 - gradedW);
      const mAvg = SFMastery.courseAvg(course && course.name);
      const estRemain = mAvg != null ? mAvg * 100 : (wAvg != null ? wAvg : 70);
      const projected = wAvg != null ? (wAvg * gradedW + estRemain * remainW) / 100 : (remainW > 0 ? estRemain : null);
      return { gradedWeight: gradedW, currentAvg: wAvg, remainingWeight: remainW, projected: projected != null ? Math.round(projected) : null };
    },
    whatIf(course, target) { // target on a 0-100 scale (e.g. 85)
      const p = this.project(course);
      if (p.remainingWeight <= 0) return { needed: null, feasible: p.currentAvg != null && p.currentAvg >= target };
      const cur = p.currentAvg != null ? p.currentAvg : 0;
      const needed = (target * 100 - cur * p.gradedWeight) / p.remainingWeight;
      let feasibility = 'unlikely';
      if (needed <= cur + 5) feasibility = 'achievable'; else if (needed <= cur + 15) feasibility = 'challenging';
      return { needed: Math.round(needed), feasibility, feasible: needed <= 100 };
    },
  };

  // --- 3c. Multi-course prioritization engine (pure JS) --------------
  const SFPriority = {
    rank() {
      const tasks = (S.tasks || []).filter(t => !t.done && !t.missed);
      const exams = S.exams || [];
      const examByCourse = {};
      exams.forEach(e => { const d = daysUntil(e.date); if (!(e.course in examByCourse) || d < examByCourse[e.course].d) examByCourse[e.course] = { d, e }; });
      const ranked = tasks.map(t => {
        const due = daysUntil(t.date);
        // urgency: closer => higher
        const urgency = clamp(100 - Math.max(0, due) * 12, 5, 100);
        // impact: exam proximity + priority
        const ex = examByCourse[t.course];
        let impact = 40;
        if (ex) { if (ex.d <= 3) impact = 100; else if (ex.d <= 7) impact = 80; else if (ex.d <= 14) impact = 60; }
        if (t.priority === 'גבוה' || t.priority === 'קריטי') impact += 15; else if (t.priority === 'נמוך' || t.priority === 'תחביב') impact -= 15;
        impact = clamp(impact, 5, 100);
        // gap: lower mastery in course => bigger gap
        const mAvg = SFMastery.courseAvg(t.course);
        const gap = mAvg != null ? clamp((1 - mAvg) * 100, 5, 100) : 55;
        // student weight
        const sw = (t.priority === 'גבוה' || t.priority === 'קריטי') ? 80 : (t.priority === 'נמוך' || t.priority === 'תחביב') ? 25 : 50;
        const score = Math.round(urgency * 0.32 + impact * 0.30 + gap * 0.23 + sw * 0.15);
        let risk = 'green'; if (due <= 1 || (ex && ex.d <= 2)) risk = 'red'; else if (due <= 3 || (ex && ex.d <= 7)) risk = 'yellow';
        const flags = [];
        if (due < 0) flags.push('overdue'); else if (due === 0) flags.push('due_today'); else if (due === 1) flags.push('due_tomorrow');
        if (ex && ex.d <= 3) flags.push('exam_soon');
        return { task: t, score, risk, flags, components: { urgency, impact, gap, sw }, dueIn: due };
      }).sort((a, b) => b.score - a.score);
      const examWeek = exams.some(e => { const d = daysUntil(e.date); return d >= 0 && d <= 7; });
      return { ranked, mode: examWeek ? 'exam_week' : 'normal' };
    },
  };

  // --- 3d. Evidence intake: turn a completed+rated task into mastery data
  // Wired from app_v58.js finishTaskRating() via window.sfOnTaskRated.
  function sfOnTaskRated(task, stars) {
    if (!task || !stars || !task.course) return;
    const topic = String(task.name || '').trim();
    if (!topic) return;
    SFMastery.update(task.course, topic, clamp(stars / 5, 0, 1), task.isHomework ? 'homework' : 'practice');
    save();
  }

  // =====================================================================
  // 4) LOCAL CONTEXT BUILDER (compact Hebrew snapshot of S for the AI)
  // =====================================================================
  function sfContext(level) {
    level = level || 'standard';
    const L = [];
    const p = S.profile || {};
    L.push('### סטודנט');
    L.push(`שם: ${S.userName || 'לא ידוע'} | מוסד: ${S.institution || '—'} | תאריך: ${todayStr()}`);
    if (p.focus_time || p.focus_span || p.style || p.exam_fear)
      L.push(`פוקוס: ${p.focus_time || '—'} | משך ריכוז: ${p.focus_span || '—'} | סגנון: ${p.style || '—'} | חשש מרכזי: ${p.exam_fear || '—'}`);
    L.push(`שעות ערות: ${S.wakeTime || '08:00'}–${S.sleepTime || '22:00'} | רצף נוכחי: ${S.streak || 0} ימים`);

    const courses = S.courses || [];
    if (courses.length) {
      L.push('\n### קורסים');
      courses.forEach(c => {
        const mAvg = SFMastery.courseAvg(c.name);
        const proj = SFGrades.project(c);
        let line = `- ${c.name}`;
        if (mAvg != null) line += ` | שליטה ממוצעת: ${Math.round(mAvg * 100)}%`;
        if (proj.projected != null) line += ` | ציון צפוי: ~${proj.projected}`;
        const mt = S.mastery[c.name];
        if (mt) { const weak = Object.keys(mt).filter(t => mt[t].score < 0.5).slice(0, 3); if (weak.length) line += ` | נושאים חלשים: ${weak.join(', ')}`; }
        L.push(line);
      });
    }

    const exams = (S.exams || []).map(e => ({ e, d: daysUntil(e.date) })).filter(x => x.d >= -1).sort((a, b) => a.d - b.d).slice(0, 8);
    if (exams.length) {
      L.push('\n### מבחנים מתקרבים');
      exams.forEach(x => L.push(`- ${x.e.course} (${x.e.type || 'מבחן'}) בעוד ${x.d} ימים [${x.e.date}]${x.e.readyPct != null ? ` · מוכנות ${x.e.readyPct}%` : ''}`));
    }

    if (level !== 'minimal') {
      const today = todayStr();
      const todays = (S.tasks || []).filter(t => t.date === today && !t.done);
      if (todays.length) { L.push('\n### משימות היום'); todays.slice(0, 8).forEach(t => L.push(`- ${t.time || ''} ${t.name} (${t.course || ''}) ${durMin(t.duration)} דק'${t.done ? ' ✓' : ''}`)); }
      const pr = SFPriority.rank();
      if (pr.ranked.length) {
        L.push(`\n### עדיפויות (מצב: ${pr.mode === 'exam_week' ? 'שבוע מבחנים' : 'רגיל'})`);
        pr.ranked.slice(0, 5).forEach((r, i) => L.push(`${i + 1}. [${r.score}] ${r.task.name} · ${r.task.course || ''} · עד ${fmtDate(r.task.date)} (${r.risk})`));
      }
    }

    if (S.aiBrief && S.aiBrief.data && S.aiBrief.data.focus_this_week && level !== 'minimal') {
      L.push('\n### הנחיות התדריך השבועי');
      (S.aiBrief.data.focus_this_week || []).slice(0, 4).forEach(f => L.push(`- ${f}`));
    }
    return L.join('\n');
  }

  // =====================================================================
  // 5) UI helpers — modal + chooser (consistent with app styling)
  // =====================================================================
  function sfModal(title, bodyHtml, opts) {
    opts = opts || {};
    const ov = document.createElement('div');
    ov.className = 'modal-overlay sf-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);padding:16px;';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.cssText = 'background:var(--surface,#fff);color:var(--text,#111);width:100%;max-width:' + (opts.wide ? '640px' : '460px') + ';border-radius:22px;padding:1.25rem;box-shadow:0 24px 48px rgba(0,0,0,0.25);max-height:88vh;overflow-y:auto;direction:rtl;text-align:right;';
    box.innerHTML =
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.75rem">
         <div class="modal-title" style="font-weight:800;font-size:1.1rem">${esc(title)}</div>
         <button class="sf-x" aria-label="סגור" style="border:none;background:transparent;font-size:1.4rem;cursor:pointer;color:var(--muted,#888);line-height:1">×</button>
       </div>
       <div class="sf-body">${bodyHtml}</div>`;
    ov.appendChild(box);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    box.querySelector('.sf-x').addEventListener('click', close);
    document.body.appendChild(ov);
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); if (opts.onClose) opts.onClose(); }
    return { el: ov, body: box.querySelector('.sf-body'), close };
  }

  function sfChoose(title, options) {
    return new Promise((resolve) => {
      if (!options.length) { resolve(null); return; }
      const html = '<div style="display:flex;flex-direction:column;gap:.5rem">' +
        options.map((o, i) => `<button class="sf-choice btn-sm" data-i="${i}" style="text-align:right;padding:.7rem .9rem;border-radius:12px;border:1px solid var(--border,#e2e2e2);background:var(--surface2,#f6f6f8);cursor:pointer;font-weight:600">${esc(o.label)}</button>`).join('') +
        '</div>';
      const m = sfModal(title, html, { onClose: () => resolve(null) });
      m.body.querySelectorAll('.sf-choice').forEach(b => b.addEventListener('click', () => { const v = options[parseInt(b.dataset.i, 10)].value; m.close(); resolve(v); }));
    });
  }

  const SPIN = '<div class="sf-spin" style="display:flex;align-items:center;gap:.5rem;color:var(--muted,#888)"><span class="sf-dot" style="width:8px;height:8px;border-radius:50%;background:currentColor;animation:sfpulse 1s infinite"></span> חושב…</div>';

  function aiError(e) {
    const msg = (e && e.message) ? e.message : 'שגיאת AI';
    return `<div style="color:var(--red,#e5484d);font-weight:600">${esc(msg)}</div><div style="color:var(--muted,#888);font-size:.85rem;margin-top:.4rem">צריך מפתח Groq API — הוסף אותו בהגדרות, או ודא שהפרוקסי פרוס.</div>`;
  }

  // =====================================================================
  // 6) FEATURE: AI COACH (intent detection -> routed handlers)
  // =====================================================================
  function sfOpenCoach(btn) {
    if (typeof showPage === 'function') { try { showPage('coach', btn || null); } catch (e) { } }
    if (typeof updateBottomNav === 'function') { try { updateBottomNav('coach'); } catch (e) { } }
    sfRenderCoach();
  }

  function sfRenderCoach() {
    const feed = document.getElementById('sf-coach-feed');
    if (!feed) return;
    if (!S.coachHistory.length) {
      feed.innerHTML = `<div class="sf-coach-empty" style="color:var(--muted,#888);text-align:center;padding:2rem 1rem">
        <div style="font-size:2.2rem">🧠</div>
        <div style="font-weight:800;margin:.4rem 0;color:var(--text,#111)">המאמן החכם שלך</div>
        <div style="font-size:.9rem">שאל אותי כל דבר — "איך אני עומד?", "מה הכי דחוף?", "תכין לי תוכנית למבחן באנליזה".</div></div>`;
    } else {
      feed.innerHTML = S.coachHistory.map(m => sfBubble(m.role, m.content)).join('');
    }
    feed.scrollTop = feed.scrollHeight;
  }

  function sfBubble(role, text) {
    const me = role === 'user';
    return `<div style="display:flex;justify-content:${me ? 'flex-start' : 'flex-end'};margin:.35rem 0">
      <div style="max-width:85%;padding:.6rem .85rem;border-radius:16px;white-space:pre-wrap;line-height:1.5;font-size:.92rem;${me ? 'background:var(--accent,#5C6EF5);color:#fff;border-bottom-right-radius:6px' : 'background:var(--surface2,#f1f1f4);color:var(--text,#111);border-bottom-left-radius:6px'}">${esc(text)}</div></div>`;
  }

  async function sfCoachSend() {
    const input = document.getElementById('sf-coach-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    S.coachHistory.push({ role: 'user', content: text, ts: Date.now() });
    sfRenderCoach(); save();
    const feed = document.getElementById('sf-coach-feed');
    const thinking = document.createElement('div'); thinking.innerHTML = sfBubble('assistant', '…'); feed.appendChild(thinking); feed.scrollTop = feed.scrollHeight;
    try {
      // intent detection (best-effort; falls back to general chat)
      let intent = { intent: 'GENERAL_CHAT' };
      try { intent = await sfAI('intent', { context: 'קורסים: ' + (S.courses || []).map(c => c.name).join(', '), user: text }); } catch (e) { }
      let reply = await sfCoachRoute(intent, text);
      thinking.remove();
      S.coachHistory.push({ role: 'assistant', content: reply, ts: Date.now() });
      if (S.coachHistory.length > 40) S.coachHistory = S.coachHistory.slice(-40);
      save(); sfRenderCoach();
    } catch (e) {
      thinking.remove();
      S.coachHistory.push({ role: 'assistant', content: (e && e.message ? e.message : 'שגיאה') + ' — בדוק מפתח Groq בהגדרות.', ts: Date.now() });
      save(); sfRenderCoach();
    }
  }

  async function sfCoachRoute(intent, text) {
    const ctx = sfContext('standard');
    const hist = S.coachHistory.slice(-8).map(m => ({ role: m.role, content: m.content }));
    // Most intents are answered conversationally with full context; the model
    // already has mastery/priority/exam data, so general coaching covers them well.
    switch ((intent && intent.intent) || 'GENERAL_CHAT') {
      case 'STATUS_QUESTION':
        return await sfAI('status', { context: ctx, user: text });
      case 'EXAM_READINESS': {
        const exam = sfFindExam(intent.course);
        if (exam) return sfExamReadinessText(await sfExamReadinessData(exam), exam);
        return await sfAI('coach', { context: ctx, user: text, history: hist });
      }
      case 'STUDY_PLAN': {
        const plan = await sfAI('plan', { context: ctx, user: 'בנה תוכנית למידה עבור: ' + text });
        return sfPlanText(plan);
      }
      default:
        return await sfAI('coach', { context: ctx, user: text, history: hist });
    }
  }

  function sfFindExam(courseHint) {
    const exams = (S.exams || []).map(e => ({ e, d: daysUntil(e.date) })).filter(x => x.d >= -1).sort((a, b) => a.d - b.d);
    if (!exams.length) return null;
    if (courseHint) { const hit = exams.find(x => x.e.course && x.e.course.includes(courseHint)); if (hit) return hit.e; }
    return exams[0].e;
  }

  // =====================================================================
  // 7) FEATURE: Exam readiness
  // =====================================================================
  async function sfExamReadinessData(exam) {
    const course = (S.courses || []).find(c => c.name === exam.course) || { name: exam.course };
    const mt = S.mastery[exam.course] || {};
    const topics = Object.keys(mt).map(t => `${t}: ${Math.round(mt[t].score * 100)}%`).join(', ') || 'אין נתוני שליטה';
    const ctx = `מבחן: ${exam.course} (${exam.type || 'מבחן'}) בעוד ${daysUntil(exam.date)} ימים [${exam.date}].\nשליטה בנושאים: ${topics}.\nשעות פוקוס: ${(S.profile || {}).focus_time || '—'}.`;
    return await sfAI('exam', { context: sfContext('minimal') + '\n\n' + ctx, user: `הערך מוכנות למבחן ב${exam.course}.` });
  }
  function sfExamReadinessText(d, exam) {
    if (!d) return 'לא הצלחתי להעריך מוכנות.';
    let s = `מוכנות ל${exam.course}: ${d.overall_readiness_percent}% (ציון צפוי ${d.projected_score_range ? d.projected_score_range.low + '–' + d.projected_score_range.high : '—'}).\n${d.summary || ''}`;
    if (d.topics && d.topics.length) s += '\n\nנושאים:\n' + d.topics.map(t => `• ${t.topic} — ${t.readiness} (${t.hours_needed || 0} ש') — ${t.approach || ''}`).join('\n');
    if (d.skip && d.skip.length) s += '\n\nאם אין זמן, דלג על: ' + d.skip.join(', ');
    if (d.day_before) s += '\n\nערב לפני: ' + d.day_before;
    if (d.exam_day_tips) s += '\nיום המבחן: ' + d.exam_day_tips;
    return s;
  }
  async function sfExamReadiness(examId) {
    let exam = (S.exams || []).find(e => e.id === examId);
    if (!exam) {
      const exams = (S.exams || []).map(e => ({ e, d: daysUntil(e.date) })).filter(x => x.d >= -1).sort((a, b) => a.d - b.d);
      if (!exams.length) { toast('אין מבחנים מתקרבים'); return; }
      const pick = await sfChoose('בחר מבחן', exams.map(x => ({ label: `${x.e.course} · ${fmtDate(x.e.date)} (בעוד ${x.d} ימים)`, value: x.e.id })));
      if (!pick) return; exam = (S.exams || []).find(e => e.id === pick);
    }
    const m = sfModal('מוכנות למבחן — ' + exam.course, SPIN);
    try {
      const d = await sfExamReadinessData(exam);
      if (d && typeof d.overall_readiness_percent === 'number') { exam.readyPct = d.overall_readiness_percent; save(); }
      m.body.innerHTML = sfReadinessHtml(d, exam);
    } catch (e) { m.body.innerHTML = aiError(e); }
  }
  function sfReadinessHtml(d, exam) {
    if (!d) return 'אין נתונים.';
    const pct = clamp(d.overall_readiness_percent || 0, 0, 100);
    const col = pct >= 75 ? '#30a46c' : pct >= 50 ? '#f5a623' : '#e5484d';
    let h = `<div style="text-align:center;margin-bottom:.8rem"><div style="font-size:2.2rem;font-weight:900;color:${col}">${pct}%</div><div style="color:var(--muted,#888)">ציון צפוי ${d.projected_score_range ? d.projected_score_range.low + '–' + d.projected_score_range.high : '—'}</div></div>`;
    if (d.summary) h += `<p style="margin:.4rem 0">${esc(d.summary)}</p>`;
    if (d.topics && d.topics.length) {
      h += '<div style="margin-top:.6rem;display:flex;flex-direction:column;gap:.4rem">' + d.topics.map(t => {
        const rc = t.readiness === 'READY' ? '#30a46c' : t.readiness === 'NEEDS_REVIEW' ? '#f5a623' : '#e5484d';
        return `<div style="border-right:3px solid ${rc};background:var(--surface2,#f6f6f8);padding:.5rem .7rem;border-radius:10px"><b>${esc(t.topic)}</b> · <span style="color:${rc}">${esc(t.readiness)}</span> · ${esc(t.hours_needed || 0)} ש'<div style="font-size:.85rem;color:var(--muted,#888)">${esc(t.approach || '')}</div></div>`;
      }).join('') + '</div>';
    }
    if (d.skip && d.skip.length) h += `<p style="margin-top:.6rem"><b>לדלג אם אין זמן:</b> ${esc(d.skip.join(', '))}</p>`;
    if (d.day_before) h += `<p style="margin-top:.4rem"><b>ערב לפני:</b> ${esc(d.day_before)}</p>`;
    if (d.exam_day_tips) h += `<p style="margin-top:.4rem"><b>יום המבחן:</b> ${esc(d.exam_day_tips)}</p>`;
    return h;
  }

  // =====================================================================
  // 8) FEATURE: Status analysis / Study plan text helpers
  // =====================================================================
  async function sfStatus() {
    const m = sfModal('איך אני עומד?', SPIN, { wide: true });
    try { m.body.innerHTML = `<div style="white-space:pre-wrap;line-height:1.6">${esc(await sfAI('status', { context: sfContext('standard'), user: 'איך אני עומד בלימודים בסך הכל?' }))}</div>`; }
    catch (e) { m.body.innerHTML = aiError(e); }
  }
  function sfPlanText(p) {
    if (!p || !p.sections) return typeof p === 'string' ? p : 'לא הצלחתי לבנות תוכנית.';
    let s = `${p.title || 'תוכנית למידה'} (${p.total_minutes || ''} דק')\n`;
    if (p.warmup) s += `חימום: ${p.warmup}\n`;
    s += p.sections.map(sec => `• ${sec.minutes || ''} דק' — ${sec.title}: ${sec.activity}${sec.resources ? ' [' + sec.resources + ']' : ''}${sec.tip ? '\n   💡 ' + sec.tip : ''}`).join('\n');
    if (p.cooldown) s += `\nסיכום: ${p.cooldown}`;
    return s;
  }

  // =====================================================================
  // 9) FEATURE: Syllabus / document import (paste text -> extract -> apply)
  // =====================================================================
  function sfImportSyllabus() {
    const html = `<p style="color:var(--muted,#888);font-size:.88rem;margin-bottom:.5rem">הדבק טקסט מהסילבוס / מסמך הקורס (לוח זמנים, מבחנים, מטלות). ה-AI יחלץ קורס, מבחנים ומטלות שתוכל לאשר.</p>
      <textarea id="sf-syl-text" style="width:100%;min-height:160px;border:1px solid var(--border,#ddd);border-radius:12px;padding:.6rem;direction:rtl;font-family:inherit"></textarea>
      <div id="sf-syl-result" style="margin-top:.6rem"></div>
      <button id="sf-syl-go" class="btn-sm" style="margin-top:.6rem;width:100%;padding:.7rem;border:none;border-radius:12px;background:var(--accent,#5C6EF5);color:#fff;font-weight:700;cursor:pointer">חלץ מידע</button>`;
    const m = sfModal('ייבוא סילבוס', html, { wide: true });
    m.body.querySelector('#sf-syl-go').addEventListener('click', async () => {
      const txt = m.body.querySelector('#sf-syl-text').value.trim();
      if (txt.length < 20) { toast('הדבק טקסט ארוך יותר'); return; }
      const res = m.body.querySelector('#sf-syl-result'); res.innerHTML = SPIN;
      try {
        const d = await sfAI('syllabus', { user: txt.slice(0, 12000) });
        res.innerHTML = sfSyllabusPreview(d);
        const apply = res.querySelector('#sf-syl-apply');
        if (apply) apply.addEventListener('click', () => { sfApplySyllabus(d); m.close(); });
      } catch (e) { res.innerHTML = aiError(e); }
    });
  }
  function sfSyllabusPreview(d) {
    if (!d) return 'לא חולץ מידע.';
    let h = '<div style="background:var(--surface2,#f6f6f8);border-radius:12px;padding:.7rem">';
    h += `<div><b>קורס:</b> ${esc(d.course_name || '—')}</div>`;
    if (d.exams && d.exams.length) h += `<div style="margin-top:.4rem"><b>מבחנים (${d.exams.length}):</b><ul style="margin:.3rem 0;padding-inline-start:1.1rem">` + d.exams.map(e => `<li>${esc(e.name || e.type || 'מבחן')} — ${esc(e.date || 'ללא תאריך')}${e.weight ? ' (' + esc(e.weight) + ')' : ''}</li>`).join('') + '</ul></div>';
    if (d.assignments && d.assignments.length) h += `<div style="margin-top:.4rem"><b>מטלות (${d.assignments.length}):</b><ul style="margin:.3rem 0;padding-inline-start:1.1rem">` + d.assignments.map(a => `<li>${esc(a.name || 'מטלה')} — ${esc(a.due || 'ללא תאריך')}</li>`).join('') + '</ul></div>';
    if (d.topics && d.topics.length) h += `<div style="margin-top:.4rem"><b>נושאים:</b> ${esc(d.topics.slice(0, 12).join(', '))}</div>`;
    h += '</div><button id="sf-syl-apply" class="btn-sm" style="margin-top:.6rem;width:100%;padding:.7rem;border:none;border-radius:12px;background:#30a46c;color:#fff;font-weight:700;cursor:pointer">הוסף ל-StudyFlow</button>';
    return h;
  }
  function sfApplySyllabus(d) {
    let added = 0;
    const cname = d.course_name && d.course_name !== 'null' ? d.course_name : null;
    if (cname && !(S.courses || []).some(c => c.name === cname)) { S.courses = S.courses || []; S.courses.push({ id: uid(), name: cname, examDate: '', hoursPerWeek: 6 }); added++; }
    // seed mastery topics (introduced)
    if (cname && d.topics && d.topics.length) { d.topics.slice(0, 20).forEach(t => { if (t && t.length < 60) { const n = SFMastery._node(cname, t); if (n.count === 0) { n.count = 1; n.last = todayStr(); } } }); }
    (d.exams || []).forEach(e => {
      if (!e.date || e.date === 'null') return;
      const course = cname || e.coverage || 'קורס';
      if (!(S.exams || []).some(x => x.course === course && x.date === e.date)) {
        S.exams = S.exams || [];
        S.exams.push({ id: uid(), course, date: e.date, type: e.type || 'מבחן', conf: 2, readyPct: 0, createdDate: todayStr() });
        added++;
      }
    });
    (d.assignments || []).forEach(a => {
      if (!a.due || a.due === 'null') return;
      S.tasks = S.tasks || [];
      S.tasks.push({ id: uid(), name: a.name || 'מטלה', course: cname || 'כללי', date: a.due, time: '', duration: "90 דק'", priority: 'בינוני', done: false, missed: false, isHomework: true });
      added++;
    });
    save();
    toast(added ? `נוספו ${added} פריטים מהסילבוס` : 'לא נמצאו פריטים חדשים להוספה');
    try { if (typeof renderExams === 'function') renderExams(); if (typeof renderHomework === 'function') renderHomework(); } catch (e) { }
  }

  // =====================================================================
  // 10) FEATURE: Morning briefing + weekly strategic review
  // =====================================================================
  async function sfRenderBriefing() {
    const host = document.getElementById('sf-briefing');
    if (!host) return;
    const today = todayStr();
    const pr = SFPriority.rank();
    const topExam = (S.exams || []).map(e => ({ e, d: daysUntil(e.date) })).filter(x => x.d >= 0).sort((a, b) => a.d - b.d)[0];
    // cached AI brief text for today
    if (S.aiState.lastBrief === today && S.aiBrief && S.aiBrief.text) { host.innerHTML = sfBriefingCard(S.aiBrief.text, pr, topExam); return; }
    host.innerHTML = sfBriefingCard(null, pr, topExam); // show instant heuristic card first
    // try to enrich with AI (silent fail)
    try {
      if ((S.courses || []).length || (S.tasks || []).length) {
        const text = await sfAI('brief', { context: sfContext('standard'), user: 'כתוב לי תדריך בוקר קצר.' });
        S.aiBrief = Object.assign(S.aiBrief || {}, { text }); S.aiState.lastBrief = today; save();
        host.innerHTML = sfBriefingCard(text, pr, topExam);
      }
    } catch (e) { /* keep heuristic card */ }
  }
  function sfBriefingCard(aiText, pr, topExam) {
    const top = pr.ranked[0];
    let body = aiText ? esc(aiText) : (top ? `הכי דחוף היום: <b>${esc(top.task.name)}</b>${top.task.course ? ' · ' + esc(top.task.course) : ''}.` : 'אין משימות דחופות — זמן טוב להתקדם בנושא חלש.');
    const examLine = topExam ? `<div style="font-size:.82rem;color:var(--muted,#888);margin-top:.35rem">📅 ${esc(topExam.e.course)} בעוד ${topExam.d} ימים</div>` : '';
    return `<div style="background:linear-gradient(135deg,var(--accent,#5C6EF5),#7c5cff);color:#fff;border-radius:18px;padding:1rem 1.1rem;margin-bottom:1rem;box-shadow:0 8px 24px rgba(92,110,245,0.25)">
      <div style="display:flex;align-items:center;gap:.5rem;font-weight:800;margin-bottom:.3rem">🧠 תדריך הבוקר</div>
      <div style="line-height:1.5;font-size:.92rem">${body}</div>${examLine}
      <button onclick="sfOpenCoach()" style="margin-top:.7rem;background:rgba(255,255,255,0.2);border:none;color:#fff;padding:.45rem .9rem;border-radius:10px;font-weight:700;cursor:pointer">פתח מאמן ←</button>
    </div>`;
  }

  async function sfWeeklyReviewAI() {
    const m = sfModal('סקירה שבועית אסטרטגית', SPIN, { wide: true });
    try {
      const d = await sfAI('weekly', { context: sfContext('standard'), user: 'בצע סקירה שבועית אסטרטגית והכן תוכנית לשבוע הקרוב.' });
      S.aiBrief = Object.assign(S.aiBrief || {}, { data: d, ts: Date.now() }); S.aiState.lastBriefShown = todayStr(); save();
      m.body.innerHTML = sfWeeklyHtml(d);
    } catch (e) { m.body.innerHTML = aiError(e); }
  }
  function sfWeeklyHtml(d) {
    if (!d) return 'אין נתונים.';
    let h = d.student_message ? `<p style="line-height:1.6;margin-bottom:.7rem">${esc(d.student_message)}</p>` : '';
    if (d.risk && d.risk.length) { h += '<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.7rem">' + d.risk.map(r => { const c = r.level === 'red' ? '#e5484d' : r.level === 'yellow' ? '#f5a623' : '#30a46c'; return `<span style="background:${c}22;color:${c};border:1px solid ${c}55;padding:.25rem .6rem;border-radius:999px;font-size:.82rem;font-weight:700">${esc(r.course)}</span>`; }).join('') + '</div>'; }
    if (d.priorities && d.priorities.length) { h += '<b>עדיפויות השבוע:</b><ol style="margin:.4rem 0;padding-inline-start:1.2rem;line-height:1.6">' + d.priorities.map(p => `<li>${esc(p.task)} <span style="color:var(--muted,#888)">· ${esc(p.course || '')} · ${esc(p.hours || 0)} ש'</span></li>`).join('') + '</ol>'; }
    if (d.focus_this_week && d.focus_this_week.length) { h += '<b>מיקוד:</b><ul style="margin:.4rem 0;padding-inline-start:1.2rem;line-height:1.6">' + d.focus_this_week.map(f => `<li>${esc(f)}</li>`).join('') + '</ul>'; }
    if (d.sacrifices) h += `<p style="margin-top:.5rem;color:var(--muted,#888)"><b>אם עמוס:</b> ${esc(d.sacrifices)}</p>`;
    return h;
  }

  // =====================================================================
  // 11) UI INJECTION (nav item, coach page, FAB, today briefing host)
  // =====================================================================
  function sfInjectUI() {
    // 11a. Coach page (append next to existing .page containers)
    const anchorPage = document.getElementById('page-today');
    if (anchorPage && anchorPage.parentElement && !document.getElementById('page-coach')) {
      const page = document.createElement('div');
      page.className = 'page'; page.id = 'page-coach';
      page.innerHTML =
        `<div class="page-header"><div class="page-title">מאמן חכם</div><div class="page-sub">שאל · קבל עצה · בנה תוכנית</div></div>
         <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.6rem">
           <button class="sf-chip" onclick="sfStatus()">איך אני עומד?</button>
           <button class="sf-chip" onclick="sfExamReadiness()">מוכנות למבחן</button>
           <button class="sf-chip" onclick="sfImportSyllabus()">ייבא סילבוס</button>
           <button class="sf-chip" onclick="sfWeeklyReviewAI()">סקירה שבועית</button>
         </div>
         <div id="sf-coach-feed" style="background:var(--surface,#fff);border:1px solid var(--border,#eee);border-radius:16px;padding:.6rem;min-height:46vh;max-height:60vh;overflow-y:auto"></div>
         <div style="display:flex;gap:.5rem;margin-top:.6rem">
           <input id="sf-coach-input" placeholder="כתוב הודעה למאמן…" style="flex:1;border:1px solid var(--border,#ddd);border-radius:14px;padding:.7rem .9rem;direction:rtl;font-family:inherit;background:var(--surface,#fff);color:var(--text,#111)" />
           <button onclick="sfCoachSend()" style="border:none;border-radius:14px;background:var(--accent,#5C6EF5);color:#fff;font-weight:800;padding:0 1.1rem;cursor:pointer">שלח</button>
         </div>`;
      anchorPage.parentElement.appendChild(page);
      const inp = page.querySelector('#sf-coach-input');
      if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') sfCoachSend(); });
    }

    // 11b. Sidebar nav item — appended at the END (existing code uses fixed indices)
    const nav = document.querySelector('.nav-item') ? document.querySelector('.nav-item').parentElement : null;
    if (nav && !document.getElementById('sf-coach-nav')) {
      const btn = document.createElement('button');
      btn.className = 'nav-item'; btn.id = 'sf-coach-nav';
      btn.onclick = function () { sfOpenCoach(this); };
      btn.innerHTML = '<span class="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4-2.5 5.2C15.5 15 15 16 15 17H9c0-1-.5-2-1.5-2.8C6.2 13 5 11.4 5 9a7 7 0 0 1 7-7z"/><line x1="9" y1="21" x2="15" y2="21"/></svg></span> <span>מאמן AI</span>';
      nav.appendChild(btn);
    }

    // 11c. Floating action button (always-available coach)
    if (!document.getElementById('sf-fab')) {
      const fab = document.createElement('button');
      fab.id = 'sf-fab'; fab.title = 'מאמן חכם';
      fab.onclick = function () { sfOpenCoach(); };
      fab.innerHTML = '🧠';
      fab.style.cssText = 'position:fixed;bottom:84px;left:18px;width:56px;height:56px;border-radius:50%;border:none;background:linear-gradient(135deg,#5C6EF5,#7c5cff);color:#fff;font-size:1.5rem;box-shadow:0 8px 24px rgba(92,110,245,.4);cursor:pointer;z-index:900;display:flex;align-items:center;justify-content:center';
      document.body.appendChild(fab);
    }

    // 11d. Briefing host on the Today page (insert after the header)
    const todayPage = document.getElementById('page-today');
    if (todayPage && !document.getElementById('sf-briefing')) {
      const host = document.createElement('div'); host.id = 'sf-briefing';
      const header = todayPage.querySelector('.page-header');
      if (header && header.nextSibling) header.parentNode.insertBefore(host, header.nextSibling);
      else todayPage.insertBefore(host, todayPage.firstChild);
    }

    // 11e. styles for chips/animation
    if (!document.getElementById('sf-styles')) {
      const st = document.createElement('style'); st.id = 'sf-styles';
      st.textContent = '@keyframes sfpulse{0%,100%{opacity:.3}50%{opacity:1}} .sf-chip{border:1px solid var(--border,#e2e2e2);background:var(--surface2,#f4f4f7);color:var(--text,#111);border-radius:999px;padding:.45rem .9rem;font-weight:600;font-size:.85rem;cursor:pointer} .sf-chip:hover{background:var(--accent,#5C6EF5);color:#fff}';
      document.head.appendChild(st);
    }
  }

  // =====================================================================
  // 12) INIT
  // =====================================================================
  let sfReady = false;
  function sfInit() {
    if (typeof S !== 'object' || !S || !S.userName) return; // wait for the real app (skip onboarding screen)
    try {
      sfMigrate();
      SFMastery.decayAll();
      save();
      sfInjectUI();
      if (!sfReady) { sfReady = true; sfRenderBriefing(); } // briefing makes an AI call — run once per load
    } catch (e) { console.warn('[StudyFlow AI] init error', e); }
  }

  // Expose public API used by injected onclick handlers
  window.sfOpenCoach = sfOpenCoach;
  window.sfRenderCoach = sfRenderCoach;
  window.sfCoachSend = sfCoachSend;
  window.sfStatus = sfStatus;
  window.sfExamReadiness = sfExamReadiness;
  window.sfImportSyllabus = sfImportSyllabus;
  window.sfWeeklyReviewAI = sfWeeklyReviewAI;
  window.sfOnTaskRated = sfOnTaskRated;
  // Expose engines for advanced use / debugging / future UI
  window.SFMastery = SFMastery;
  window.SFGrades = SFGrades;
  window.SFPriority = SFPriority;
  window.sfContext = sfContext;
  window.sfAI = sfAI;
  window.sfParseJSON = sfParseJSON;

  // Hook the app's entry point: initApp() runs both on load (returning user)
  // and after onboarding completes. For function declarations the global name
  // and window property are the same binding, so calls to bare initApp() in
  // app_v58.js resolve to this wrapper.
  if (typeof window.initApp === 'function') {
    const _origInit = window.initApp;
    window.initApp = function () { const r = _origInit.apply(this, arguments); try { sfInit(); } catch (e) { } return r; };
  }
  // Fallback: app already initialized before this script ran.
  if (document.readyState === 'complete') sfInit();
  else window.addEventListener('load', sfInit);
})();
