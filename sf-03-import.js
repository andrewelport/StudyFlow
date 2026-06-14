// ── SCHEDULE UPLOAD: multimodal extraction ──────────────────────────────────
// Used by the home-screen schedule upload feature. Bypasses callAI to send
// responseSchema/files/thinkingConfig directly to the proxy (callAI's wrapper
// only forwards the legacy 4 fields).
//
// fileContent: for image/PDF → base64 string; for CSV → raw CSV text.
// mimeType:    binary MIME for image/PDF, "text/csv" (or similar) for CSV.
async function _extractScheduleFromFile(fileContent, mimeType) {
  const TIMEOUT_MS = 30000;
  const isCsv = /^(text\/csv|application\/csv|text\/plain)/i.test(mimeType || '');

  const systemPrompt = 'אתה מקבל מערכת שעות שבועית של סטודנט באוניברסיטה. חלץ ממנה את כל המפגשים השבועיים, כולל סוג המפגש (הרצאה או תרגול) ושם המרצה אם זמין. החזר JSON בלבד.';
  const baseUserPrompt = `חלץ את כל המפגשים במערכת השעות. עבור כל מפגש החזר:
- course_name: שם בסיס נקי של הקורס בלבד. הסר סוגריים כמו "(תרגול)" או "(תר')" והסר שם מרצה. דוגמה: מהמחרוזת "חדו"א 2 (תרגול)- אכרם סאלח" החזר course_name="חדו"א 2".
- session_type: "tutorial" אם בכותרת מופיע "תרגול" / "תר'" / "(תרגול)" / "(תר')", אחרת "lecture". כל מפגש שלא מסומן במפורש כתרגול הוא הרצאה.
- teacher: שם המרצה אם כתוב במפורש (בדרך כלל אחרי קו מפריד "-" או אחרי הסוגריים). מחרוזת ריקה אם לא נמצא בבירור.
- day_of_week: יום בשבוע (sunday/monday/tuesday/wednesday/thursday/friday/saturday).
- start_time: שעת התחלה בפורמט HH:MM.
- end_time: שעת סיום בפורמט HH:MM.
אם השדות לא ברורים — דלג ואל תנחש.`;
  const userPrompt = isCsv
    ? `${baseUserPrompt}\n\nתוכן ה-CSV:\n${fileContent}`
    : baseUserPrompt;

  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    responseSchema: {
      type: 'object',
      properties: {
        schedule: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              course_name:  { type: 'string' },
              day_of_week:  { type: 'string', enum: ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] },
              start_time:   { type: 'string', description: 'HH:MM' },
              end_time:     { type: 'string', description: 'HH:MM' },
              session_type: { type: 'string', enum: ['lecture', 'tutorial'] },
              teacher:      { type: 'string', description: 'שם המרצה אם נמצא בכותרת — אחרת מחרוזת ריקה' },
            },
            required: ['course_name', 'day_of_week', 'start_time', 'end_time', 'session_type'],
          },
        },
      },
      required: ['schedule'],
    },
    thinkingConfig: { thinkingBudget: 0 },
  };
  if (!isCsv) {
    body.files = [{ mime_type: mimeType, data: fileContent }];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('החילוץ נמשך זמן רב מדי. נסה תמונה אחרת או קובץ אחר.');
    }
    throw new Error(`שגיאת רשת: ${e.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let errMsg = `שגיאת שרת (${res.status})`;
    try {
      const d = await res.json();
      if (d?.error) errMsg = typeof d.error === 'string' ? d.error : (d.error.message || errMsg);
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('ה-AI לא החזיר תוכן.');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_) {
    // responseSchema should guarantee valid JSON; this is belt-and-suspenders
    try { parsed = extractJSON(content); } catch (__) {
      throw new Error('לא הצלחנו לפענח את התוצאה.');
    }
  }

  const schedule = parsed?.schedule;
  if (!Array.isArray(schedule)) throw new Error('המבנה שהוחזר לא תקין.');
  return schedule;
}

// ── MOODLE ICS IMPORT: deadline extraction ──────────────────────────────────
// Same direct-fetch + responseSchema + thinkingBudget:0 pattern as
// _extractScheduleFromFile. ICS is always plain text, so no inline_data
// branch — the raw file content is embedded in the user prompt.
async function _extractTasksFromICS(icsText) {
  const TIMEOUT_MS = 30000;
  // YYYY-MM-DD in Asia/Jerusalem regardless of user machine timezone
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

  const systemPrompt = 'אתה מקבל קובץ ICS (יומן iCalendar) של סטודנט מ-Moodle. חלץ ממנו רק אירועי מועד הגשה של מטלות. החזר JSON בלבד.';
  const userPrompt = `חלץ מהקובץ רק אירועים שמתארים מועדי הגשה של מטלות. עבור כל אירוע:
- title: כותרת המטלה כפי שמופיעה ב-SUMMARY (נקה סיומות כמו "יש להגיש את ", השאר רק את שם המטלה)
- course: שם הקורס מהשדה CATEGORIES — החלק שלפני הרווח-מקף-רווח הראשון
- due_date: תאריך ההגשה בפורמט YYYY-MM-DD בשעון ישראל
- due_time: שעת ההגשה בפורמט HH:MM בשעון ישראל
- description: תיאור מקוצר עד 100 תווים — נקה מ-DESCRIPTION את הסדרות \\, ו-\\n והשאר טקסט קריא

חוקים:
1. כלול רק אירועים שתאריך ההגשה שלהם הוא ${today} ואילך — דלג על אירועים שכבר עברו.
2. דלג על אירועים שכותרתם בנוסח "נפתח ב..." — אלו הודעות פתיחה, לא הגשות.
3. כלול רק אירועים בנוסח "יש להגיש" או "תאריך הגשה".
4. הזמנים בקובץ הם UTC (סיומת Z). המר לשעון ישראל: UTC+3 לחודשים מאי-אוקטובר (IDT), UTC+2 לחודשים נובמבר-אפריל (IST). שים לב לחציית חצות בהמרה.
5. אם השדות לא ברורים — דלג ואל תנחש.

תוכן ה-ICS:
${icsText}`;

  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 8000,
    responseSchema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title:       { type: 'string' },
              course:      { type: 'string' },
              due_date:    { type: 'string', description: 'YYYY-MM-DD local Israel time' },
              due_time:    { type: 'string', description: 'HH:MM local Israel time' },
              description: { type: 'string', description: 'shortened, max 100 chars' },
            },
            required: ['title', 'course', 'due_date', 'due_time'],
          },
        },
      },
      required: ['tasks'],
    },
    thinkingConfig: { thinkingBudget: 0 },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('החילוץ נמשך זמן רב מדי. נסה קובץ אחר.');
    }
    throw new Error(`שגיאת רשת: ${e.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let errMsg = `שגיאת שרת (${res.status})`;
    try {
      const d = await res.json();
      if (d?.error) errMsg = typeof d.error === 'string' ? d.error : (d.error.message || errMsg);
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('ה-AI לא החזיר תוכן.');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_) {
    try { parsed = extractJSON(content); } catch (__) {
      throw new Error('לא הצלחנו לפענח את התוצאה.');
    }
  }

  const tasks = parsed?.tasks;
  if (!Array.isArray(tasks)) throw new Error('המבנה שהוחזר לא תקין.');
  return tasks;
}

// ── SCHEDULE UPLOAD: UI wiring ──────────────────────────────────────────────

let _scheduleUploadPending = null;  // parsed schedule[] between extract and approve

const _SU_DAY_HE = { sunday:'ראשון', monday:'שני', tuesday:'שלישי', wednesday:'רביעי', thursday:'חמישי', friday:'שישי', saturday:'שבת' };
const _SU_DAY_NUM = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };

function openScheduleUploadModal() {
  document.getElementById('schedule-upload-modal').classList.remove('hidden');
  _setBodyLock(true);
  _scheduleUploadPending = null;
  document.getElementById('schedule-upload-input-area').classList.remove('hidden');
  document.getElementById('schedule-upload-loading').classList.add('hidden');
  document.getElementById('schedule-upload-preview').classList.add('hidden');
  document.getElementById('schedule-upload-error').classList.add('hidden');
  document.getElementById('schedule-upload-buttons').classList.add('hidden');
  document.getElementById('schedule-upload-exams')?.classList.add('hidden');
  // Approve button can be hidden by _suDeleteRow when last row goes — restore it on each open
  const approveBtn = document.querySelector('#schedule-upload-buttons button:first-child');
  if (approveBtn) approveBtn.style.display = '';
  const fileInp = document.getElementById('schedule-upload-file');
  if (fileInp) fileInp.value = '';
}

function closeScheduleUploadModal() {
  document.getElementById('schedule-upload-modal').classList.add('hidden');
  _setBodyLock(false);
  _scheduleUploadPending = null;
}

function _suShowError(msg) {
  const el = document.getElementById('schedule-upload-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('schedule-upload-input-area').classList.remove('hidden');
  document.getElementById('schedule-upload-loading').classList.add('hidden');
}

function _suFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result || '';
      const comma = String(result).indexOf(',');
      resolve(comma >= 0 ? String(result).slice(comma + 1) : String(result));
    };
    r.onerror = () => reject(new Error('שגיאה בקריאת הקובץ.'));
    r.readAsDataURL(file);
  });
}

async function handleScheduleUploadFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  document.getElementById('schedule-upload-input-area').classList.add('hidden');
  document.getElementById('schedule-upload-loading').classList.remove('hidden');
  document.getElementById('schedule-upload-error').classList.add('hidden');
  document.getElementById('schedule-upload-preview').classList.add('hidden');
  document.getElementById('schedule-upload-buttons').classList.add('hidden');

  try {
    const isCsv = /\.csv$/i.test(file.name) || /^(text\/csv|application\/csv|text\/plain)/i.test(file.type);
    let content, mimeType;
    if (isCsv) {
      content = await file.text();
      mimeType = 'text/csv';
    } else {
      content = await _suFileToBase64(file);
      mimeType = file.type || 'application/octet-stream';
    }
    const schedule = await _extractScheduleFromFile(content, mimeType);
    if (!schedule.length) {
      _suShowError('לא נמצאו שיעורים בקובץ. נסה תמונה ברורה יותר.');
      return;
    }
    _scheduleUploadPending = schedule;
    _suSortSchedule(_scheduleUploadPending);   // sort ONCE, before first render
    _suRenderPreview(_scheduleUploadPending);
  } catch (e) {
    _suShowError(e.message || 'שגיאה בחילוץ');
  }
}

function _suSortSchedule(arr) {
  arr.sort((a, b) => {
    const da = _SU_DAY_NUM[a.day_of_week] ?? 99;
    const db = _SU_DAY_NUM[b.day_of_week] ?? 99;
    if (da !== db) return da - db;
    return String(a.start_time || '').localeCompare(String(b.start_time || ''));
  });
}

// ── WEEKLY-GRID PREVIEW EDITOR (drag day/time, tap a course name to rename) ──
const _SUG_HOUR_PX = 56;   // px per hour row
const _SUG_SNAP = 5;       // snap a dragged start time to 5 minutes
const _SUG_DAYS = [
  { key: 'sunday',    he: 'ראשון'  },
  { key: 'monday',    he: 'שני'    },
  { key: 'tuesday',   he: 'שלישי'  },
  { key: 'wednesday', he: 'רביעי'  },
  { key: 'thursday',  he: 'חמישי'  },
  { key: 'friday',    he: 'שישי'   },
  { key: 'saturday',  he: 'שבת'    },
];
let _sugDrag = null, _sugJustDragged = false;

function _suMinsToTime(m) {
  m = Math.max(0, Math.min(1439, Math.round(m)));
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

function _suRenderPreview(schedule) {
  document.getElementById('schedule-upload-loading').classList.add('hidden');
  document.getElementById('schedule-upload-preview').classList.remove('hidden');
  document.getElementById('schedule-upload-buttons').classList.remove('hidden');
  document.getElementById('schedule-upload-count').textContent = schedule.length;
  const host = document.getElementById('schedule-upload-grid');
  if (!host) return;
  const approveBtn = document.querySelector('#schedule-upload-buttons button:first-child');
  if (approveBtn) approveBtn.style.display = schedule.length ? '' : 'none';
  if (!schedule.length) {
    host.innerHTML = '<div style="padding:2.2rem 1rem; text-align:center; color:var(--muted); font-weight:700">לא נשארו שיעורים. הוסיפו שיעור או בטלו וצלמו שוב.</div>';
    return;
  }

  // Day columns to show: Sun–Fri always, plus Saturday only if it has a lesson.
  let maxDay = 5;
  schedule.forEach(it => { const n = _SU_DAY_NUM[it.day_of_week]; if (n != null && n > maxDay) maxDay = n; });
  const days = _SUG_DAYS.slice(0, maxDay + 1);

  // Responsive sizing — tighter columns, smaller text, bigger touch targets on phones.
  const isNarrow = (window.innerWidth || 1024) <= 600;
  const TAW    = isNarrow ? 40 : 46;          // time-axis width
  const COLMIN = isNarrow ? 56 : 82;          // min day-column width
  const DAYFS  = isNarrow ? '0.74rem' : '0.82rem';
  const NAMEFS = isNarrow ? '0.62rem' : '0.67rem';
  const TIMEFS = isNarrow ? '0.5rem' : '0.58rem';
  const DELSZ  = isNarrow ? 30 : 24;          // delete-button touch target (enlarged — friends' feedback #1)
  const _card = document.querySelector('#schedule-upload-modal > .rcm-card');
  if (_card) { _card.style.padding = isNarrow ? '14px' : '24px'; _card.style.width = isNarrow ? '97%' : '94%'; }

  // Vertical range: from no later than 08:00, extended to midnight (24:00).
  let minS = 8 * 60;
  schedule.forEach(it => { const s = timeToMins(it.start_time); if (!isNaN(s)) minS = Math.min(minS, s); });
  const gridStart = Math.floor(minS / 60) * 60;
  const gridEnd = 24 * 60;
  const numHours = (gridEnd - gridStart) / 60;
  // Auto-fit row height to the grid's visible area so the whole day shows with no
  // needless scroll when there's room; short screens fall back to scrolling.
  let hostTop = host.getBoundingClientRect().top;
  if (!(hostTop > 40 && hostTop < (window.innerHeight || 800))) hostTop = (window.innerHeight || 800) * 0.32;
  const avail = Math.max(260, (window.innerHeight || 800) - hostTop - 84);
  const HOURPX = Math.max(isNarrow ? 34 : 38, Math.min(60, Math.floor((avail - 44) / numHours)));
  host.style.maxHeight = avail + 'px';
  const ppm = HOURPX / 60;
  const bodyH = (gridEnd - gridStart) * ppm;

  // Header (RTL): time spacer on the right, day names leftward.
  let head = `<div class="sug-head" style="display:flex; direction:rtl; position:sticky; top:0; z-index:6; background:var(--surface); border-bottom:1px solid var(--border)"><div style="width:${TAW}px; flex:0 0 ${TAW}px"></div>`;
  days.forEach(d => {
    head += `<div style="flex:1; min-width:${COLMIN}px; text-align:center; padding:9px 2px; font-weight:900; color:var(--text); font-size:${DAYFS}; border-right:1px solid var(--border)">${d.he}</div>`;
  });
  head += `</div>`;

  // Time axis.
  let timeAxis = `<div style="width:${TAW}px; flex:0 0 ${TAW}px; position:relative; height:${bodyH}px; background:var(--surface)">`;
  for (let m = gridStart; m < gridEnd; m += 60) {
    timeAxis += `<div style="position:absolute; top:${(m - gridStart) * ppm}px; right:0; left:0; height:${HOURPX}px; padding:2px 5px 0 0; font-size:0.62rem; font-weight:800; color:var(--muted); text-align:right; box-sizing:border-box">${_suMinsToTime(m)}</div>`;
  }
  timeAxis += `</div>`;

  const gridBg = `background-image:repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HOURPX}px)`;

  // Day columns with their lesson blocks (overlaps split into side-by-side lanes).
  let cols = '';
  days.forEach(d => {
    const items = [];
    schedule.forEach((it, idx) => {
      if (it.day_of_week !== d.key) return;
      const s = timeToMins(it.start_time), e = timeToMins(it.end_time);
      if (isNaN(s) || isNaN(e)) return;
      items.push({ idx, start: s, end: Math.max(e, s + _SUG_SNAP) });
    });
    items.sort((a, b) => a.start - b.start || a.end - b.end);
    const laneEnd = [];
    items.forEach(it => { let l = 0; while (l < laneEnd.length && laneEnd[l] > it.start) l++; laneEnd[l] = it.end; it.lane = l; });
    const lanes = Math.max(1, laneEnd.length);

    let blocks = '';
    items.forEach(it => {
      const item = schedule[it.idx];
      const color = getCourseColor(String(item.course_name || ''));
      const isHex = color.charAt(0) === '#';
      const bg = isHex ? color + '22' : 'var(--accent-light)';
      const bd = isHex ? color : 'var(--accent)';
      const gripTint = isHex ? color + '33' : 'rgba(79,110,247,0.2)';
      const top = (it.start - gridStart) * ppm;
      const h = Math.max(24, (it.end - it.start) * ppm - 3);
      const w = 100 / lanes, left = it.lane * w;
      blocks += `<div class="sug-block" data-idx="${it.idx}" onpointerdown="_sugPointerDown(event, ${it.idx})" style="position:absolute; top:${top}px; height:${h}px; left:calc(${left}% + 2px); width:calc(${w}% - 4px); background:${bg}; border:1px solid ${bd}; border-right:3px solid ${bd}; border-radius:9px; padding:3px ${isNarrow ? 4 : 5}px; box-sizing:border-box; overflow:hidden; cursor:grab; touch-action:none; box-shadow:0 2px 6px rgba(0,0,0,0.09)">
        <button class="sug-del" onpointerdown="event.stopPropagation()" onclick="_sugDelete(${it.idx})" title="מחק" aria-label="מחק" style="position:absolute; top:2px; left:2px; width:${DELSZ}px; height:${DELSZ}px; border:none; background:rgba(0,0,0,0.08); color:var(--muted); border-radius:6px; cursor:pointer; font-size:${isNarrow ? '0.82rem' : '0.68rem'}; line-height:1; padding:0; display:flex; align-items:center; justify-content:center">✕</button>
        <div class="sug-name" style="font-weight:800; font-size:${NAMEFS}; color:var(--text); line-height:1.15; max-height:2.4em; overflow:hidden; padding-left:${DELSZ + 4}px">${escapeHtml(String(item.course_name || '(ללא שם)'))}</div>
        <div class="sug-time" style="font-size:${TIMEFS}; font-weight:800; color:${bd}; margin-top:1px; direction:ltr; text-align:right; white-space:nowrap; overflow:hidden">${escapeHtml(String(item.start_time || ''))}–${escapeHtml(String(item.end_time || ''))}</div>
        <div class="sug-resize" onpointerdown="event.stopPropagation(); _sugResizeDown(event, ${it.idx})" title="גרור לשינוי משך השיעור" style="position:absolute; left:0; right:0; bottom:0; height:16px; cursor:ns-resize; touch-action:none; display:flex; align-items:flex-end; justify-content:center; padding-bottom:2px; background:linear-gradient(to top, ${gripTint}, transparent); border-radius:0 0 8px 8px"><div style="width:38px; height:5px; border-radius:5px; background:${bd}; opacity:0.95; box-shadow:0 1px 3px rgba(0,0,0,0.25)"></div></div>
      </div>`;
    });
    cols += `<div class="sug-daycol" data-day="${d.key}" data-gridstart="${gridStart}" data-hourpx="${HOURPX}" onclick="_sugAddAt(event, '${d.key}')" style="flex:1; min-width:${COLMIN}px; position:relative; height:${bodyH}px; border-right:1px solid var(--border); cursor:copy; ${gridBg}">${blocks}</div>`;
  });

  host.innerHTML = head + `<div class="sug-body" style="display:flex; direction:rtl">${timeAxis}${cols}</div>`;
}

function _sugPointerDown(e, idx) {
  if (e.target.closest('.sug-del') || e.target.closest('input') || e.target.closest('.sug-resize')) return;
  const block = e.currentTarget;
  const r = block.getBoundingClientRect();
  _sugDrag = { idx, block, startX: e.clientX, startY: e.clientY, grabDy: e.clientY - r.top, grabDx: e.clientX - r.left, moved: false, onName: !!e.target.closest('.sug-name') };
  window.addEventListener('pointermove', _sugPointerMove, { passive: false });
  window.addEventListener('pointerup', _sugPointerUp);
}
function _sugPointerMove(e) {
  if (!_sugDrag) return;
  const dx = e.clientX - _sugDrag.startX, dy = e.clientY - _sugDrag.startY;
  if (!_sugDrag.moved && Math.hypot(dx, dy) > 8) {
    _sugDrag.moved = true;
    const b = _sugDrag.block;
    b.style.opacity = '0.92'; b.style.zIndex = '60'; b.style.cursor = 'grabbing';
    b.style.boxShadow = '0 8px 22px rgba(0,0,0,0.25)';
  }
  if (_sugDrag.moved) { e.preventDefault(); _sugDrag.block.style.transform = `translate(${dx}px, ${dy}px)`; }
}
function _sugPointerUp(e) {
  window.removeEventListener('pointermove', _sugPointerMove);
  window.removeEventListener('pointerup', _sugPointerUp);
  const d = _sugDrag; _sugDrag = null;
  if (!d) return;
  if (!d.moved) { if (d.onName) _sugRenameStart(d.idx); return; }
  _sugJustDragged = true; setTimeout(() => { _sugJustDragged = false; }, 60);
  const item = _scheduleUploadPending?.[d.idx];
  if (!item) { _suRenderPreview(_scheduleUploadPending); return; }
  const blockTopY = e.clientY - d.grabDy;
  const blockMidX = e.clientX - d.grabDx + d.block.offsetWidth / 2;
  const cols = Array.from(document.querySelectorAll('.sug-daycol'));
  let target = null, best = Infinity;
  cols.forEach(c => { const cr = c.getBoundingClientRect(); const dist = Math.abs((cr.left + cr.width / 2) - blockMidX); if (dist < best) { best = dist; target = c; } });
  if (target) {
    const cr = target.getBoundingClientRect();
    const ppm = (parseFloat(target.getAttribute('data-hourpx')) || _SUG_HOUR_PX) / 60;
    const gridStart = parseInt(target.getAttribute('data-gridstart'));
    const dur = Math.max(_SUG_SNAP, (timeToMins(item.end_time) - timeToMins(item.start_time)) || 60);
    let newStart = gridStart + (blockTopY - cr.top) / ppm;
    newStart = Math.round(newStart / _SUG_SNAP) * _SUG_SNAP;
    newStart = Math.max(gridStart, Math.min(newStart, gridStart + (cr.height / ppm) - dur));
    item.day_of_week = target.getAttribute('data-day');
    item.start_time = _suMinsToTime(newStart);
    item.end_time   = _suMinsToTime(newStart + dur);
  }
  _suRenderPreview(_scheduleUploadPending);
}

// ── Resize: drag the bottom grip to change a lesson's end time (its length) ──
let _sugResize = null;
function _sugResizeDown(e, idx) {
  const block = document.querySelector(`.sug-block[data-idx="${idx}"]`);
  const item = _scheduleUploadPending?.[idx];
  if (!block || !item) return;
  const col = block.closest('.sug-daycol');
  const ppm = (col ? parseFloat(col.getAttribute('data-hourpx')) : _SUG_HOUR_PX) / 60;
  const gridStart = col ? parseInt(col.getAttribute('data-gridstart')) : 8 * 60;
  const gridEnd = col ? gridStart + col.offsetHeight / ppm : 22 * 60;
  _sugResize = {
    idx, item, block, ppm, gridStart, gridEnd,
    startY: e.clientY,
    origStart: timeToMins(item.start_time),
    origEnd: timeToMins(item.end_time),
    timeEl: block.querySelector('.sug-time'),
    curEnd: null,
  };
  block.style.zIndex = '70';
  block.style.boxShadow = '0 8px 22px rgba(0,0,0,0.22)';
  window.addEventListener('pointermove', _sugResizeMove, { passive: false });
  window.addEventListener('pointerup', _sugResizeUp);
}
function _sugResizeMove(e) {
  if (!_sugResize) return;
  e.preventDefault();
  const R = _sugResize;
  let newEnd = R.origEnd + (e.clientY - R.startY) / R.ppm;
  newEnd = Math.round(newEnd / _SUG_SNAP) * _SUG_SNAP;
  newEnd = Math.max(R.origStart + _SUG_SNAP, Math.min(newEnd, R.gridEnd));
  R.curEnd = newEnd;
  R.block.style.height = Math.max(24, (newEnd - R.origStart) * R.ppm - 3) + 'px';
  if (R.timeEl) R.timeEl.textContent = _suMinsToTime(R.origStart) + '–' + _suMinsToTime(newEnd);
}
function _sugResizeUp() {
  window.removeEventListener('pointermove', _sugResizeMove);
  window.removeEventListener('pointerup', _sugResizeUp);
  const R = _sugResize; _sugResize = null;
  if (!R) return;
  if (R.curEnd != null && R.item) R.item.end_time = _suMinsToTime(R.curEnd);
  _suRenderPreview(_scheduleUploadPending);
}

function _sugRenameStart(idx) {
  const block = document.querySelector(`.sug-block[data-idx="${idx}"]`);
  if (!block) return;
  const nameEl = block.querySelector('.sug-name');
  if (!nameEl) return;
  // Expand the block into a comfortable editing popover so a narrow (lane-split)
  // or short block grows big enough to read/type the full name — it lifts above
  // its neighbours and may extend past the cell while editing.
  block.style.zIndex = '90';
  block.style.overflow = 'visible';
  block.style.minWidth = '190px';
  block.style.minHeight = '74px';
  block.style.cursor = 'default';
  block.style.boxShadow = '0 10px 30px rgba(0,0,0,0.32)';
  const cur = String(_scheduleUploadPending?.[idx]?.course_name || '');
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = cur;
  inp.style.cssText = 'width:100%; box-sizing:border-box; border:1px solid var(--accent); border-radius:7px; padding:4px 7px; font-family:var(--sans); font-size:0.82rem; font-weight:800; background:#fff; color:#111; direction:rtl; box-shadow:0 1px 4px rgba(0,0,0,0.08)';
  nameEl.replaceWith(inp);
  inp.focus(); inp.select();
  let done = false;
  const commit = () => { if (done) return; done = true; if (_scheduleUploadPending?.[idx]) _scheduleUploadPending[idx].course_name = inp.value.trim(); _suRenderPreview(_scheduleUploadPending); };
  inp.addEventListener('blur', commit);
  inp.addEventListener('pointerdown', ev => ev.stopPropagation());
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); }
    else if (ev.key === 'Escape') { done = true; _suRenderPreview(_scheduleUploadPending); }
  });
}

function _sugDelete(idx) {
  if (!Array.isArray(_scheduleUploadPending)) return;
  _scheduleUploadPending.splice(idx, 1);
  document.getElementById('schedule-upload-count').textContent = String(_scheduleUploadPending.length);
  _suRenderPreview(_scheduleUploadPending);
}

function _sugAddLesson() {
  if (!Array.isArray(_scheduleUploadPending)) _scheduleUploadPending = [];
  _scheduleUploadPending.push({ day_of_week: 'sunday', course_name: 'שיעור חדש', start_time: '08:00', end_time: '09:00' });
  _suRenderPreview(_scheduleUploadPending);
}
// Tap an empty spot in a day column to drop a new 1-hour lesson there.
function _sugAddAt(e, dayKey) {
  if (_sugJustDragged || e.target.closest('.sug-block')) return;
  const col = e.currentTarget;
  const cr = col.getBoundingClientRect();
  const ppm = (parseFloat(col.getAttribute('data-hourpx')) || _SUG_HOUR_PX) / 60;
  const gridStart = parseInt(col.getAttribute('data-gridstart'));
  let startM = gridStart + (e.clientY - cr.top) / ppm;
  startM = Math.round(startM / 30) * 30;
  startM = Math.max(gridStart, Math.min(startM, 24 * 60 - 60));
  if (!Array.isArray(_scheduleUploadPending)) _scheduleUploadPending = [];
  const newIdx = _scheduleUploadPending.length;
  _scheduleUploadPending.push({ day_of_week: dayKey, course_name: 'שיעור חדש', start_time: _suMinsToTime(startM), end_time: _suMinsToTime(startM + 60) });
  _suRenderPreview(_scheduleUploadPending);
  setTimeout(() => _sugRenameStart(newIdx), 30);
}

// ── מערכת שעות page: read-only weekly grid built from the recurring anchors ──
function renderTimetable() {
  const host = document.getElementById('timetable-grid');
  if (!host) return;
  const emptyEl = document.getElementById('timetable-empty');
  const items = (S.anchors || [])
    .filter(a => a && a.day != null && !a.oneTimeDate &&
                 /^\d{1,2}:\d{2}$/.test(String(a.start || '')) && /^\d{1,2}:\d{2}$/.test(String(a.end || '')))
    .map(a => ({ id: a.id, day: parseInt(a.day), name: a.name || 'עוגן', start: timeToMins(a.start), end: timeToMins(a.end),
                 color: a.color || getCourseColor(a.name || '') }))
    .filter(it => it.id != null && !isNaN(it.day) && !isNaN(it.start) && !isNaN(it.end) && it.end > it.start);

  if (!items.length) { host.innerHTML = ''; host.style.display = 'none'; if (emptyEl) emptyEl.style.display = ''; return; }
  host.style.display = ''; if (emptyEl) emptyEl.style.display = 'none';

  const isNarrow = (window.innerWidth || 1024) <= 600;
  const TAW = isNarrow ? 40 : 46, COLMIN = isNarrow ? 56 : 92;
  const DAYFS = isNarrow ? '0.74rem' : '0.84rem', NAMEFS = isNarrow ? '0.62rem' : '0.72rem', TIMEFS = isNarrow ? '0.5rem' : '0.6rem';
  const DELSZ = isNarrow ? 22 : 18;

  let maxDay = 5;
  items.forEach(it => { if (it.day > maxDay) maxDay = it.day; });
  const days = _SUG_DAYS.slice(0, maxDay + 1);

  // Full day to midnight, starting no later than 08:00.
  let minS = 8 * 60;
  items.forEach(it => { minS = Math.min(minS, it.start); });
  const gridStart = Math.floor(minS / 60) * 60;
  const gridEnd = 24 * 60;
  const numHours = (gridEnd - gridStart) / 60;
  // Auto-fit the row height to the visible area so the whole day shows without
  // needless scroll when there's room; only short screens fall back to scrolling.
  let hostTop = host.getBoundingClientRect().top;
  if (!(hostTop > 40 && hostTop < (window.innerHeight || 800))) hostTop = (window.innerHeight || 800) * 0.30;
  const avail = Math.max(300, (window.innerHeight || 800) - hostTop - 16);
  // Subtract the sticky day-header row so header + rows together fit (no scroll).
  const HOURPX = Math.max(isNarrow ? 30 : 34, Math.min(66, Math.floor((avail - 46) / numHours)));
  host.style.maxHeight = avail + 'px';
  const ppm = HOURPX / 60;
  const bodyH = (gridEnd - gridStart) * ppm;

  let head = `<div style="display:flex; direction:rtl; position:sticky; top:0; z-index:6; background:var(--surface); border-bottom:1px solid var(--border)"><div style="width:${TAW}px; flex:0 0 ${TAW}px"></div>`;
  days.forEach(d => { head += `<div style="flex:1; min-width:${COLMIN}px; text-align:center; padding:10px 2px; font-weight:900; color:var(--text); font-size:${DAYFS}; border-right:1px solid var(--border)">${d.he}</div>`; });
  head += `</div>`;

  let timeAxis = `<div style="width:${TAW}px; flex:0 0 ${TAW}px; position:relative; height:${bodyH}px; background:var(--surface)">`;
  for (let m = gridStart; m < gridEnd; m += 60) timeAxis += `<div style="position:absolute; top:${(m - gridStart) * ppm}px; right:0; left:0; height:${HOURPX}px; padding:2px 5px 0 0; font-size:0.62rem; font-weight:800; color:var(--muted); text-align:right; box-sizing:border-box">${_suMinsToTime(m)}</div>`;
  timeAxis += `</div>`;

  const gridBg = `background-image:repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HOURPX}px)`;

  let cols = '';
  days.forEach((d, di) => {
    const list = items.filter(it => it.day === di).sort((a, b) => a.start - b.start || a.end - b.end);
    const laneEnd = [];
    list.forEach(it => { let l = 0; while (l < laneEnd.length && laneEnd[l] > it.start) l++; laneEnd[l] = it.end; it.lane = l; });
    const lanes = Math.max(1, laneEnd.length);
    let blocks = '';
    list.forEach(it => {
      const isHex = String(it.color).charAt(0) === '#';
      const bg = isHex ? it.color + '22' : 'var(--accent-light)';
      const bd = isHex ? it.color : 'var(--accent)';
      const gripTint = isHex ? it.color + '33' : 'rgba(79,110,247,0.2)';
      const top = (it.start - gridStart) * ppm, h = Math.max(24, (it.end - it.start) * ppm - 3);
      const w = 100 / lanes, left = it.lane * w;
      const sel = String(it.id) === String(_ttSelectedId);
      blocks += `<div class="tt-block" data-id="${it.id}" onpointerdown="_ttPointerDown(event, '${it.id}')" style="position:absolute; top:${top}px; height:${h}px; left:calc(${left}% + 2px); width:calc(${w}% - 4px); background:${bg}; border:1px solid ${bd}; border-right:3px solid ${bd}; border-radius:9px; padding:4px ${isNarrow ? 4 : 6}px; box-sizing:border-box; overflow:hidden; cursor:grab; touch-action:none; ${sel ? 'box-shadow:0 0 0 2px var(--accent), 0 6px 16px rgba(0,0,0,0.2); z-index:5' : 'box-shadow:0 2px 6px rgba(0,0,0,0.08)'}">
        <button class="tt-del" onpointerdown="event.stopPropagation()" onclick="_ttDelete('${it.id}')" title="מחק" aria-label="מחק" style="position:absolute; top:2px; left:2px; width:${DELSZ}px; height:${DELSZ}px; border:none; background:rgba(0,0,0,0.08); color:var(--muted); border-radius:6px; cursor:pointer; font-size:${isNarrow ? '0.82rem' : '0.7rem'}; line-height:1; padding:0; display:flex; align-items:center; justify-content:center">✕</button>
        <div class="tt-name" style="font-weight:800; font-size:${NAMEFS}; color:var(--text); line-height:1.18; max-height:3.2em; overflow:hidden; padding-left:${DELSZ + 4}px">${escapeHtml(String(it.name || ''))}</div>
        <div class="tt-time" style="font-size:${TIMEFS}; font-weight:800; color:${bd}; margin-top:2px; direction:ltr; text-align:right; white-space:nowrap; overflow:hidden">${_suMinsToTime(it.start)}–${_suMinsToTime(it.end)}</div>
        <div class="tt-resize" onpointerdown="event.stopPropagation(); _ttResizeDown(event, '${it.id}')" title="גרור לשינוי משך" style="position:absolute; left:0; right:0; bottom:0; height:14px; cursor:ns-resize; touch-action:none; display:flex; align-items:flex-end; justify-content:center; padding-bottom:2px; background:linear-gradient(to top, ${gripTint}, transparent); border-radius:0 0 8px 8px"><div style="width:34px; height:4px; border-radius:4px; background:${bd}; opacity:0.9"></div></div>
      </div>`;
    });
    cols += `<div class="tt-daycol" data-day="${di}" data-gridstart="${gridStart}" data-hourpx="${HOURPX}" onclick="_ttAddAt(event, ${di})" style="flex:1; min-width:${COLMIN}px; position:relative; height:${bodyH}px; border-right:1px solid var(--border); cursor:copy; ${gridBg}">${blocks}</div>`;
  });

  host.innerHTML = head + `<div style="display:flex; direction:rtl">${timeAxis}${cols}</div>`;
}

// ── מערכת שעות editing — drag/rename/resize/delete directly on the anchors ──
let _ttDrag = null, _ttResize = null, _ttSelectedId = null, _ttClip = null, _ttJustDragged = false;
function _ttFindAnchor(id) { return (S.anchors || []).find(a => String(a.id) === String(id)); }
// Save + refresh: renderAll() rebuilds the Today list / header / other views so an
// anchor edited on the timetable shows everywhere immediately (no manual refresh).
function _ttSaveRender() { if (typeof save === 'function') save(); if (typeof renderAll === 'function') renderAll(); renderTimetable(); }
// Anchor names look like "קורס - הרצאה"; the base (before " - ") is the course.
function _ttBaseName(n) { return String(n || '').split(' - ')[0].trim(); }
// Renaming a class on the timetable propagates the base name to the matching
// course, exams, tasks, and sibling anchors so the whole app stays consistent.
function _ttCascadeRename(oldName, newName, skipId) {
  const oldBase = _ttBaseName(oldName), newBase = _ttBaseName(newName);
  if (!oldBase || oldBase === newBase) return;
  (S.courses || []).forEach(c => { if (c.name === oldBase) c.name = newBase; });
  (S.exams || []).forEach(e => { if (e.course === oldBase) e.course = newBase; });
  (S.tasks || []).forEach(t => { if (t.course === oldBase) t.course = newBase; });
  (S.anchors || []).forEach(an => { if (String(an.id) !== String(skipId) && _ttBaseName(an.name) === oldBase) an.name = String(an.name).replace(oldBase, newBase); });
}

function _ttPointerDown(e, id) {
  if (e.target.closest('.tt-del') || e.target.closest('input') || e.target.closest('.tt-resize')) return;
  const block = e.currentTarget;
  const r = block.getBoundingClientRect();
  _ttDrag = { id, block, startX: e.clientX, startY: e.clientY, grabDy: e.clientY - r.top, grabDx: e.clientX - r.left, moved: false, onName: !!e.target.closest('.tt-name') };
  window.addEventListener('pointermove', _ttPointerMove, { passive: false });
  window.addEventListener('pointerup', _ttPointerUp);
}
function _ttPointerMove(e) {
  if (!_ttDrag) return;
  const dx = e.clientX - _ttDrag.startX, dy = e.clientY - _ttDrag.startY;
  if (!_ttDrag.moved && Math.hypot(dx, dy) > 8) { _ttDrag.moved = true; const b = _ttDrag.block; b.style.opacity = '0.92'; b.style.zIndex = '60'; b.style.cursor = 'grabbing'; b.style.boxShadow = '0 8px 22px rgba(0,0,0,0.25)'; }
  if (_ttDrag.moved) { e.preventDefault(); _ttDrag.block.style.transform = `translate(${dx}px, ${dy}px)`; }
}
function _ttPointerUp(e) {
  window.removeEventListener('pointermove', _ttPointerMove);
  window.removeEventListener('pointerup', _ttPointerUp);
  const d = _ttDrag; _ttDrag = null;
  if (!d) return;
  if (!d.moved) { if (d.onName) _ttRename(d.id); else { _ttSelectedId = d.id; renderTimetable(); } return; }
  _ttJustDragged = true; setTimeout(() => { _ttJustDragged = false; }, 60);
  const a = _ttFindAnchor(d.id);
  if (!a) { renderTimetable(); return; }
  const blockTopY = e.clientY - d.grabDy;
  const blockMidX = e.clientX - d.grabDx + d.block.offsetWidth / 2;
  const cols = Array.from(document.querySelectorAll('.tt-daycol'));
  let target = null, best = Infinity;
  cols.forEach(c => { const cr = c.getBoundingClientRect(); const dist = Math.abs((cr.left + cr.width / 2) - blockMidX); if (dist < best) { best = dist; target = c; } });
  if (target) {
    const cr = target.getBoundingClientRect();
    const ppm = (parseFloat(target.getAttribute('data-hourpx')) || 56) / 60;
    const gridStart = parseInt(target.getAttribute('data-gridstart'));
    const dur = Math.max(_SUG_SNAP, (timeToMins(a.end) - timeToMins(a.start)) || 60);
    let newStart = gridStart + (blockTopY - cr.top) / ppm;
    newStart = Math.round(newStart / _SUG_SNAP) * _SUG_SNAP;
    newStart = Math.max(gridStart, Math.min(newStart, 24 * 60 - dur));
    a.day = parseInt(target.getAttribute('data-day'));
    a.start = _suMinsToTime(newStart);
    a.end = _suMinsToTime(newStart + dur);
  }
  _ttSaveRender();
}
function _ttResizeDown(e, id) {
  const block = document.querySelector(`.tt-block[data-id="${id}"]`);
  const a = _ttFindAnchor(id);
  if (!block || !a) return;
  const col = block.closest('.tt-daycol');
  const ppm = (col ? parseFloat(col.getAttribute('data-hourpx')) : 56) / 60;
  _ttResize = { a, block, ppm, startY: e.clientY, origStart: timeToMins(a.start), origEnd: timeToMins(a.end), timeEl: block.querySelector('.tt-time'), curEnd: null };
  block.style.zIndex = '70';
  window.addEventListener('pointermove', _ttResizeMove, { passive: false });
  window.addEventListener('pointerup', _ttResizeUp);
}
function _ttResizeMove(e) {
  if (!_ttResize) return;
  e.preventDefault();
  const R = _ttResize;
  let newEnd = R.origEnd + (e.clientY - R.startY) / R.ppm;
  newEnd = Math.round(newEnd / _SUG_SNAP) * _SUG_SNAP;
  newEnd = Math.max(R.origStart + _SUG_SNAP, Math.min(newEnd, 24 * 60));
  R.curEnd = newEnd;
  R.block.style.height = Math.max(24, (newEnd - R.origStart) * R.ppm - 3) + 'px';
  if (R.timeEl) R.timeEl.textContent = _suMinsToTime(R.origStart) + '–' + _suMinsToTime(newEnd);
}
function _ttResizeUp() {
  window.removeEventListener('pointermove', _ttResizeMove);
  window.removeEventListener('pointerup', _ttResizeUp);
  const R = _ttResize; _ttResize = null;
  if (!R) return;
  if (R.curEnd != null && R.a) R.a.end = _suMinsToTime(R.curEnd);
  _ttSaveRender();
}
function _ttRename(id) {
  const block = document.querySelector(`.tt-block[data-id="${id}"]`);
  const a = _ttFindAnchor(id);
  if (!block || !a) return;
  const nameEl = block.querySelector('.tt-name');
  if (!nameEl) return;
  block.style.zIndex = '90'; block.style.overflow = 'visible'; block.style.minWidth = '190px'; block.style.minHeight = '74px'; block.style.boxShadow = '0 10px 30px rgba(0,0,0,0.32)';
  const cur = String(a.name || '');
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = cur;
  inp.style.cssText = 'width:100%; box-sizing:border-box; border:1px solid var(--accent); border-radius:7px; padding:4px 7px; font-family:var(--sans); font-size:0.82rem; font-weight:800; background:#fff; color:#111; direction:rtl';
  nameEl.replaceWith(inp);
  inp.focus(); inp.select();
  let done = false;
  const commit = () => { if (done) return; done = true; const v = inp.value.trim(); if (v && v !== cur) { _ttCascadeRename(cur, v, a.id); a.name = v; } _ttSaveRender(); };
  inp.addEventListener('blur', commit);
  inp.addEventListener('pointerdown', ev => ev.stopPropagation());
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } else if (ev.key === 'Escape') { done = true; renderTimetable(); } });
}
function _ttDelete(id) {
  const a = _ttFindAnchor(id);
  if (!a) return;
  if (!confirm(`למחוק את "${a.name || 'השיעור'}" מהמערכת?`)) return;
  const snapshot = { ...a };                 // keep a copy so the delete is reversible
  S.anchors = (S.anchors || []).filter(x => String(x.id) !== String(id));
  if (String(_ttSelectedId) === String(id)) _ttSelectedId = null;
  _ttSaveRender();
  if (typeof sfShowUndoToast === 'function') {
    sfShowUndoToast(`"${_ttBaseName(a.name) || 'השיעור'}" נמחק`, () => {
      if (!Array.isArray(S.anchors)) S.anchors = [];
      if (!S.anchors.some(x => String(x.id) === String(snapshot.id))) S.anchors.push(snapshot);
      _ttSaveRender();
    });
  }
}
// Tap an empty spot in a day column to drop a new 1-hour class there.
function _ttAddAt(e, dayNum) {
  if (_ttJustDragged || e.target.closest('.tt-block')) return;
  const col = e.currentTarget;
  const cr = col.getBoundingClientRect();
  const ppm = (parseFloat(col.getAttribute('data-hourpx')) || 56) / 60;
  const gridStart = parseInt(col.getAttribute('data-gridstart'));
  let startM = gridStart + (e.clientY - cr.top) / ppm;
  startM = Math.round(startM / 30) * 30;
  startM = Math.max(gridStart, Math.min(startM, 24 * 60 - 60));
  const id = (typeof uid === 'function') ? uid() : ('tt' + dayNum + '_' + startM);
  if (!Array.isArray(S.anchors)) S.anchors = [];
  S.anchors.push({ id, name: 'שיעור חדש', day: dayNum, start: _suMinsToTime(startM), end: _suMinsToTime(startM + 60), travelMin: 0, color: getCourseColor('שיעור חדש') });
  _ttSelectedId = id;
  _ttSaveRender();
  setTimeout(() => _ttRename(id), 30);
}
// Copy / cut / paste a class (Ctrl+C / Ctrl+X / Ctrl+V) — duplicate it elsewhere.
function _ttCopy(mode) {
  const a = _ttFindAnchor(_ttSelectedId);
  if (!a) return;
  _ttClip = { mode, data: { name: a.name, day: a.day, start: a.start, end: a.end, color: a.color, travelMin: a.travelMin || 0 } };
  if (mode === 'cut') { S.anchors = (S.anchors || []).filter(x => String(x.id) !== String(_ttSelectedId)); _ttSelectedId = null; _ttSaveRender(); }
  if (typeof toast === 'function') toast(mode === 'cut' ? 'נגזר — Ctrl+V להדבקה' : 'הועתק — Ctrl+V להדבקה');
}
function _ttPaste() {
  if (!_ttClip) return;
  const d = _ttClip.data;
  const id = (typeof uid === 'function') ? uid() : ('ttp' + ((S.anchors || []).length));
  if (!Array.isArray(S.anchors)) S.anchors = [];
  S.anchors.push({ id, name: d.name, day: d.day, start: d.start, end: d.end, travelMin: d.travelMin || 0, color: d.color });
  _ttSelectedId = id;
  if (_ttClip.mode === 'cut') _ttClip = null;   // a cut pastes once
  _ttSaveRender();
  if (typeof toast === 'function') toast('הודבק — גרור למיקום הרצוי');
}
document.addEventListener('keydown', function (e) {
  const page = document.getElementById('page-timetable');
  if (!page || !page.classList.contains('active')) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = (e.key || '').toLowerCase();
  if (k === 'c' && _ttSelectedId) { e.preventDefault(); _ttCopy('copy'); }
  else if (k === 'x' && _ttSelectedId) { e.preventDefault(); _ttCopy('cut'); }
  else if (k === 'v' && _ttClip) { e.preventDefault(); _ttPaste(); }
});

// ── ICS UPLOAD: UI wiring ───────────────────────────────────────────────────

let _icsUploadPending = null;  // parsed tasks[] between extract and approve

function openIcsUploadModal() {
  document.getElementById('ics-upload-modal').classList.remove('hidden');
  _setBodyLock(true);
  _icsUploadPending = null;
  document.getElementById('ics-upload-input-area').classList.remove('hidden');
  document.getElementById('ics-upload-loading').classList.add('hidden');
  document.getElementById('ics-upload-preview').classList.add('hidden');
  document.getElementById('ics-upload-error').classList.add('hidden');
  document.getElementById('ics-upload-buttons').classList.add('hidden');
  const approveBtn = document.querySelector('#ics-upload-buttons button:first-child');
  if (approveBtn) approveBtn.style.display = '';
  const fileInp = document.getElementById('ics-upload-file');
  if (fileInp) fileInp.value = '';
}

function closeIcsUploadModal() {
  document.getElementById('ics-upload-modal').classList.add('hidden');
  _setBodyLock(false);
  _icsUploadPending = null;
}

function _icsShowError(msg) {
  const el = document.getElementById('ics-upload-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('ics-upload-input-area').classList.remove('hidden');
  document.getElementById('ics-upload-loading').classList.add('hidden');
}

async function handleIcsUploadFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  document.getElementById('ics-upload-input-area').classList.add('hidden');
  document.getElementById('ics-upload-loading').classList.remove('hidden');
  document.getElementById('ics-upload-error').classList.add('hidden');
  document.getElementById('ics-upload-preview').classList.add('hidden');
  document.getElementById('ics-upload-buttons').classList.add('hidden');

  try {
    const icsText = await file.text();
    const tasks = await _extractTasksFromICS(icsText);
    if (!tasks.length) {
      _icsShowError('לא נמצאו מטלות עתידיות בקובץ.');
      return;
    }
    _icsUploadPending = tasks;
    _icsSortTasks(_icsUploadPending);   // sort ONCE: due_date asc, then due_time
    _icsRenderPreview(_icsUploadPending);
  } catch (e) {
    _icsShowError(e.message || 'שגיאה בחילוץ');
  }
}

function _icsSortTasks(arr) {
  arr.sort((a, b) => {
    const dCmp = String(a.due_date || '').localeCompare(String(b.due_date || ''));
    if (dCmp !== 0) return dCmp;
    return String(a.due_time || '').localeCompare(String(b.due_time || ''));
  });
}

function _icsRenderPreview(tasks) {
  document.getElementById('ics-upload-loading').classList.add('hidden');
  document.getElementById('ics-upload-preview').classList.remove('hidden');
  document.getElementById('ics-upload-buttons').classList.remove('hidden');
  document.getElementById('ics-upload-count').textContent = tasks.length;
  const tbody = document.getElementById('ics-upload-preview-tbody');
  tbody.innerHTML = tasks.map((item, idx) => `
    <tr style="border-top:1px solid var(--border)">
      <td style="padding:0.55rem 0.6rem; color:var(--text); font-weight:600">${escapeHtml(String(item.title || ''))}</td>
      <td style="padding:0.55rem 0.6rem; color:var(--muted); font-size:0.82rem">${escapeHtml(String(item.course || ''))}</td>
      <td style="padding:0.55rem 0.6rem; font-family:var(--mono); color:var(--text); font-size:0.82rem">${escapeHtml(String(item.due_date || ''))}</td>
      <td style="padding:0.55rem 0.6rem; font-family:var(--mono); color:var(--muted); font-size:0.82rem">${escapeHtml(String(item.due_time || ''))}</td>
      <td style="padding:0.45rem 0.3rem; width:34px">
        <button onclick="_icsDeleteRow(${idx})" title="מחק שורה" aria-label="מחק שורה" style="background:transparent; border:none; color:var(--muted); cursor:pointer; padding:0.3rem 0.4rem; font-size:1rem; border-radius:6px; opacity:0.65" onmouseover="this.style.opacity='1'; this.style.color='var(--red)'" onmouseout="this.style.opacity='0.65'; this.style.color='var(--muted)'">✕</button>
      </td>
    </tr>
  `).join('');
}

function _icsDeleteRow(idx) {
  if (!Array.isArray(_icsUploadPending)) return;
  _icsUploadPending.splice(idx, 1);
  if (_icsUploadPending.length === 0) {
    const tbody = document.getElementById('ics-upload-preview-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="padding:1.2rem; text-align:center; color:var(--muted); font-weight:700">לא נשארו מטלות. בטל ונסה קובץ אחר.</td></tr>';
    document.getElementById('ics-upload-count').textContent = '0';
    const approveBtn = document.querySelector('#ics-upload-buttons button:first-child');
    if (approveBtn) approveBtn.style.display = 'none';
    return;
  }
  _icsRenderPreview(_icsUploadPending);
}

function confirmIcsUpload() {
  if (!Array.isArray(_icsUploadPending) || !_icsUploadPending.length) return;
  if (!Array.isArray(S.tasks)) S.tasks = [];

  let added = 0;
  for (const item of _icsUploadPending) {
    const title  = String(item.title  || '').trim();
    const course = String(item.course || '').trim();
    const date   = item.due_date;
    const time   = item.due_time;
    if (!title) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!/^\d{2}:\d{2}$/.test(time)) continue;
    // Dedup: skip if a task with same name+date already exists
    if (S.tasks.find(t => t.name === title && t.date === date)) continue;
    // Mirror the Oracle assistant task shape at app_v58.js:6630
    // (no time whitelist — Moodle deadlines are point-in-time, often 23:55)
    const newTask = {
      id: uid(),
      name: title,
      course,
      date,
      time,
      duration: "60 דק'",
      priority: 'בינוני',
      done: false,
      missed: false,
    };
    const desc = String(item.description || '').slice(0, 100).trim();
    if (desc) newTask.notes = desc;
    S.tasks.push(newTask);
    added++;
  }

  // Batch — save() and renderAll() once after the loop, not per item
  save();
  renderAll();

  closeIcsUploadModal();
  toast(added > 0 ? `${added} משימות נוצרו` : 'לא נוספו משימות (כפילויות)');
}

function confirmScheduleUpload() {
  if (!Array.isArray(_scheduleUploadPending) || !_scheduleUploadPending.length) return;
  if (!Array.isArray(S.anchors)) S.anchors = [];
  if (!Array.isArray(S.courses)) S.courses = [];

  let added = 0;
  const uniqueCourseNames = new Set();
  for (const item of _scheduleUploadPending) {
    const day = _SU_DAY_NUM[item.day_of_week];
    if (day === undefined) continue;
    if (!/^\d{2}:\d{2}$/.test(item.start_time) || !/^\d{2}:\d{2}$/.test(item.end_time)) continue;
    const baseName = String(item.course_name || '').trim();
    const typeLabel = item.session_type === 'tutorial' ? 'תרגול' : 'הרצאה';
    const teacher = String(item.teacher || '').trim();
    let anchorName;
    if (!baseName) {
      anchorName = 'עוגן';
    } else if (teacher) {
      anchorName = `${baseName} - ${typeLabel} (${teacher})`;
    } else {
      anchorName = `${baseName} - ${typeLabel}`;
    }
    S.anchors.push({
      id: uid(),
      name: anchorName,
      day,
      start: item.start_time,
      end: item.end_time,
      travelMin: 0,
      color: getCourseColor(baseName),
    });
    added++;
    if (baseName) uniqueCourseNames.add(baseName);
  }

  // Register any new courses (skip ones already in S.courses by exact name match).
  // Empty examDate by design — user adds it later via the exam tracker.
  let addedCourses = 0;
  for (const name of uniqueCourseNames) {
    if (!S.courses.find(c => c.name === name)) {
      S.courses.push({ id: uid(), name, examDate: '', hoursPerWeek: 6 });
      addedCourses++;
    }
  }

  // Batch — call save() and renderAll() once after the loop, not per item
  save();
  renderAll();
  if (typeof renderTimetable === 'function') renderTimetable();

  // Offer to set exam dates for the courses we just created (optional / skippable).
  const examCourses = Array.from(uniqueCourseNames);
  if (examCourses.length) {
    _suShowExamStep(examCourses);
  } else {
    closeScheduleUploadModal();
    toast(` נוצרו ${added} עוגנים`);
  }
}

// ── Optional exam step after a schedule upload ──────────────────────────────
let _suExamCourses = [];
function _suShowExamStep(courseNames) {
  _suExamCourses = courseNames;
  document.getElementById('schedule-upload-input-area')?.classList.add('hidden');
  document.getElementById('schedule-upload-preview')?.classList.add('hidden');
  document.getElementById('schedule-upload-buttons')?.classList.add('hidden');
  const list = document.getElementById('schedule-upload-exams-list');
  if (list) {
    list.innerHTML = courseNames.map((name, i) => `
      <div style="padding:0.7rem 0.2rem; border-top:1px solid var(--border)">
        <label for="su-exam-date-${i}" style="display:block; font-weight:800; color:var(--text); font-size:0.92rem; direction:rtl; margin-bottom:0.4rem">${escapeHtml(name)}</label>
        <input type="date" id="su-exam-date-${i}" style="box-sizing:border-box; border:1px solid var(--border); border-radius:9px; padding:0.55rem 0.6rem; font-family:var(--sans); font-size:0.9rem; background:var(--surface); color:var(--text); cursor:pointer">
      </div>`).join('');
  }
  document.getElementById('schedule-upload-exams')?.classList.remove('hidden');
}
function _suSaveExams() {
  if (!Array.isArray(S.exams)) S.exams = [];
  let added = 0;
  _suExamCourses.forEach((name, i) => {
    const v = document.getElementById('su-exam-date-' + i)?.value;
    if (!v) return;
    const c = (S.courses || []).find(x => x.name === name);
    if (c) c.examDate = v;
    if (!S.exams.find(e => e.course === name && e.date === v)) {
      S.exams.push({ id: uid(), course: name, date: v, type: 'מבחן', conf: 3, createdDate: ld(new Date()), readyPct: 0 });
      added++;
    }
  });
  save();
  _suFinishUpload(added);
}
function _suSkipExams() { _suFinishUpload(0); }
function _suFinishUpload(examsAdded) {
  if (typeof renderAll === 'function') renderAll();
  if (typeof renderTimetable === 'function') renderTimetable();
  closeScheduleUploadModal();
  toast(examsAdded > 0 ? ` ${examsAdded} מבחנים נוספו ללוז` : ' מערכת השעות נוצרה');
}
