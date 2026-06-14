// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ══════════════════════════════════════════
// FOCUS LOCK MODE — Premium Distraction Blocker
// ══════════════════════════════════════════
const FL = {
  active: false,
  challengeA: 0, challengeB: 0, challengeAnswer: 0,
  sessionsDone: 0,
  xpEarned: 0,
  breathPhase: 0,
  breathTimer: null,
  wakeLock: null,
  CIRCUMFERENCE: 678.6, // 2π × 108
};

function focusLockOpen(taskName, totalSecs, elapsedSecs, mode) {
  const overlay = document.getElementById('focus-lock-overlay');
  if (!overlay) return;
  FL.active = true;
  overlay.classList.remove('hidden', 'break-mode');
  if (mode === 'break') overlay.classList.add('break-mode');

  // Set task name
  document.getElementById('fl-task-name').textContent = taskName || (mode === 'break' ? ' זמן הפסקה' : 'מפגש ריכוז');
  document.getElementById('fl-mode-badge').textContent = mode === 'break' ? ' הפסקה' : ' מצב פוקוס';
  document.getElementById('fl-timer-label').textContent = mode === 'break' ? 'דקות הפסקה' : 'דקות ריכוז';
  document.getElementById('fl-breathing-icon').textContent = mode === 'break' ? '' : '';

  // Update stats
  document.getElementById('fl-sessions-done').textContent = FL.sessionsDone;
  document.getElementById('fl-xp-earned').textContent = '+' + FL.xpEarned;

  // Update ring
  focusLockUpdateRing(totalSecs, elapsedSecs);

  // Request Wake Lock (keep screen on)
  if ('wakeLock' in navigator && !FL.wakeLock) {
    navigator.wakeLock.request('screen').then(wl => { FL.wakeLock = wl; }).catch(() => {});
  }

  // Start breathing guide
  focusLockBreathStart();

  // Prevent back/swipe navigation. Keep the guard armed for EVERY back-press
  // (not {once:true}, which self-disabled after one press) — removed on close.
  history.pushState({ focusLock: true }, '');
  window.removeEventListener('popstate', _flPopState);
  window.addEventListener('popstate', _flPopState);
}

function _flPopState(e) {
  if (FL.active) {
    history.pushState({ focusLock: true }, '');
    focusLockShowChallenge();
  }
}

function focusLockUpdateRing(totalSecs, elapsedSecs) {
  const pct = totalSecs > 0 ? Math.min(1, elapsedSecs / totalSecs) : 0;
  const offset = FL.CIRCUMFERENCE * (1 - pct);
  const ring = document.getElementById('fl-ring-fill');
  if (ring) ring.style.strokeDashoffset = offset.toFixed(1);

  // Update focus percent
  document.getElementById('fl-focus-pct').textContent = Math.round(pct * 100) + '%';
}

function focusLockUpdateTimer(timeStr, totalSecs, elapsedSecs) {
  const el = document.getElementById('fl-digits');
  if (el) el.textContent = timeStr;
  focusLockUpdateRing(totalSecs, elapsedSecs);
  document.getElementById('fl-xp-earned').textContent = '+' + FL.xpEarned;
}

function focusLockBreathStart() {
  if (FL.breathTimer) clearInterval(FL.breathTimer);
  const phases = ['שאף...', 'עצור...', 'נשוף...', 'עצור...'];
  let i = 0;
  const update = () => {
    const el = document.getElementById('fl-breath-text');
    if (el) el.textContent = phases[i % phases.length];
    i++;
  };
  update();
  FL.breathTimer = setInterval(update, 4000);
}

function focusLockClose() {
  FL.active = false;
  window.removeEventListener('popstate', _flPopState);
  const overlay = document.getElementById('focus-lock-overlay');
  if (overlay) overlay.classList.add('hidden');
  if (FL.breathTimer) { clearInterval(FL.breathTimer); FL.breathTimer = null; }
  if (FL.wakeLock) { FL.wakeLock.release(); FL.wakeLock = null; }
}

function focusLockShowChallenge() {
  // Generate random math challenge (gets harder over time)
  const difficulty = Math.min(FL.sessionsDone + 1, 4);
  const max = [0, 20, 50, 100, 200][difficulty];
  FL.challengeA = Math.floor(Math.random() * max) + 1;
  FL.challengeB = Math.floor(Math.random() * max) + 1;
  const ops = ['+', '-', '×'][Math.min(difficulty - 1, 2)];
  if (ops === '+') FL.challengeAnswer = FL.challengeA + FL.challengeB;
  else if (ops === '-') { if (FL.challengeB > FL.challengeA) { const _t = FL.challengeA; FL.challengeA = FL.challengeB; FL.challengeB = _t; } FL.challengeAnswer = FL.challengeA - FL.challengeB; }
  else { FL.challengeA = Math.floor(Math.random() * 12) + 2; FL.challengeB = Math.floor(Math.random() * 12) + 2; FL.challengeAnswer = FL.challengeA * FL.challengeB; }
  const _flQ = document.getElementById('fl-challenge-q'); if (_flQ) _flQ.textContent = `${FL.challengeA} ${ops} ${FL.challengeB} = ?`;
  const _flAns = document.getElementById('fl-challenge-ans'); if (_flAns) _flAns.value = '';
  document.getElementById('fl-challenge-err')?.classList.add('hidden');
  document.getElementById('fl-challenge')?.classList.add('visible');
  setTimeout(() => document.getElementById('fl-challenge-ans')?.focus(), 100);
}

function focusLockHideChallenge() {
  document.getElementById('fl-challenge')?.classList.remove('visible');
}

function focusLockCheckAnswer() {
  const ansEl = document.getElementById('fl-challenge-ans');
  const ans = parseInt(ansEl ? ansEl.value : '');
  if (!isNaN(ans) && ans === FL.challengeAnswer) {
    focusLockHideChallenge();
    focusLockClose();
    // Stop pomo if running
    pomoPause();
    toast('יצאת ממצב פוקוס — חזור בקרוב! ');
  } else {
    const err = document.getElementById('fl-challenge-err');
    if (err) {
      err.classList.remove('hidden');
      err.textContent = isNaN(ans)
        ? ' הזן מספר כדי להמשיך'
        : ' לא נכון — נסה שוב! הרמז: ' + (ans > FL.challengeAnswer ? 'פחות' : 'יותר');
    }
    if (ansEl) { ansEl.value = ''; ansEl.focus(); }
    // Shake animation
    const card = document.querySelector('.fl-challenge-card');
    if (card) { card.style.animation = 'none'; setTimeout(() => { card.style.animation = ''; }, 10); }
  }
}

function selectPomoDuration(mins, btn) {
  _pomoCustomMins = mins;
  document.querySelectorAll('.pomo-dur-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const startBtn = document.getElementById('btn-focus-start-main');
  if (startBtn) startBtn.textContent = `התחל סשן ${mins} דקות `;
}

function openFocusMode() {
  POMO_WORK = _pomoCustomMins * 60;
  pomoSeconds = POMO_WORK;
  pomoMode = 'work';
  pomoStart();
}



// Action Sheet Logic
function openTaskActionSheet(taskId) {
  

  const t = S.tasks.find(x => String(x.id) === String(taskId));
  if (!t) return;
  document.getElementById('task-action-title').textContent = t.name;
  
  let opts = '';
  if (!t.done && !t.missed) {
    opts += `<button class="action-btn green-btn" onclick="doneTask('${t.id}');closeTaskActionSheet()"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> סיום משימה</button>`;
    
    opts += `<button class="action-btn" onclick="openManualTaskModal('${t.id}');closeTaskActionSheet()"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> עריכת משימה</button>`;
    opts += `<button class="action-btn red-btn" onclick="missTask('${t.id}');closeTaskActionSheet()"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> סימון כפוספס</button>`;
  } else if (t.done) {
    opts += `<button class="action-btn" onclick="undoTask('${t.id}')"><svg viewBox="0 0 24 24"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg> ביטול סימון והחזרה לפתוחה</button>`;
  } else if (t.missed) {
    opts += `<button class="action-btn green-btn" onclick="doneTask('${t.id}');closeTaskActionSheet()"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> שינוי לסיום</button>`;
  }
  
  opts += `<button class="action-btn red-btn" onclick="deleteTask('${t.id}');closeTaskActionSheet()"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> מחיקה לצמיתות</button>`;
  
  document.getElementById('task-action-options').innerHTML = opts;
  document.getElementById('task-action-backdrop').classList.add('open');
  document.getElementById('task-sheet-panel').classList.add('open');
}

function closeTaskActionSheet() {
  

  const bd = document.getElementById('task-action-backdrop');
  if (bd) { bd.style.pointerEvents = 'none'; bd.classList.remove('open'); }
  const panel = document.getElementById('task-sheet-panel');
  if (panel) panel.classList.remove('open');
}

// ── TASK EDIT BOTTOM SHEET ──
let _tesTaskId = null, _tesAISuggestion = null;

function openTaskEditSheet(id) {
  

  const t = S.tasks.find(x => String(x.id) === String(id));
  if (!t) return;
  _tesTaskId = id; _tesAISuggestion = null;

  document.getElementById('tes-task-title').textContent = t.name || 'עריכת משימה';
  document.getElementById('tes-name').value   = t.name || '';
  document.getElementById('tes-course').value = t.course || '';
  document.getElementById('tes-date').value   = t.date || ld(new Date());
  document.getElementById('tes-time').value   = t.time || '09:00';
  document.getElementById('tes-dur').value    = parseInt((t.duration||'90').match(/\d+/)?.[0]||90);

  const qrow = document.getElementById('tes-quick-row');
  if (qrow) qrow.style.display = (t.done || t.missed) ? 'none' : '';
  const aiRes = document.getElementById('tes-ai-result');
  if (aiRes) { aiRes.innerHTML = ''; aiRes.classList.remove('show'); }

  const _p = document.getElementById('tes-panel');
  // Clear any leftover inline transform / animation-fill so .open (translateY(0)) wins
  if (_p) { _p.style.animation = ''; _p.style.transform = ''; }
  document.getElementById('tes-backdrop').classList.add('open');
  if (_p) _p.classList.add('open');
}

function closeTaskEditSheet() {
  const bd = document.getElementById('tes-backdrop');
  const panel = document.getElementById('tes-panel');
  if (bd) bd.classList.remove('open');
  if (panel) {
    panel.classList.remove('open');
    // Bulletproof: kill any entrance-animation fill that could pin the sheet
    // open, and clear drag leftovers, so the CSS translateY(100%) slide-down wins.
    panel.style.animation = 'none';
    panel.style.transform = 'translateY(100%)';
  }
  _tesTaskId = null; _tesAISuggestion = null;
}

function tesDoneTask()   { if (!_tesTaskId) return; doneTask(_tesTaskId); closeTaskEditSheet(); }
function tesMissTask()   { if (!_tesTaskId) return; missTask(_tesTaskId); closeTaskEditSheet(); }
function tesDeleteTask() {
  if (!_tesTaskId) return;
  const t = S.tasks.find(x => String(x.id) === String(_tesTaskId));
  if (!t || !confirm(`למחוק את "${t.name}"?`)) return;
  deleteTask(_tesTaskId); closeTaskEditSheet();
}

async function tesAISuggestTime() {
  if (!_tesTaskId) return;
  const t = S.tasks.find(x => String(x.id) === String(_tesTaskId));
  if (!t) return;
  const btn = document.getElementById('tes-ai-btn');
  const res = document.getElementById('tes-ai-result');
  if (btn) { btn.textContent = '⏳ מחשב...'; btn.disabled = true; }
  try {
    const today = ld(new Date());
    const freeSlots = getAvailableSlots(today, ld(new Date(Date.now()+7*86400000)), 90);
    const dn = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    const anchors = (S.anchors||[]).map(a=>`${a.name}: יום ${dn[a.day||0]}, ${a.start}–${a.end}`).join('; ')||'אין';
    const raw = await callAI({ messages: [{ role:'user', content:
      `אתה מתכנן לו"ז. הצע זמן אחד טוב יותר למשימה:
שם: "${t.name}" | קורס: ${t.course||'ללא'} | משך: ${t.duration||'90 דק'}
זמן נוכחי: ${formatPrettyDate(t.date)} ${t.time} | שיא ריכוז: ${S.profile?.focus_time||'בוקר'}
עוגנים: ${anchors}
זמנים פנויים (7 ימים): ${freeSlots.text||'אין'}
החזר JSON בלבד: {"date":"YYYY-MM-DD","time":"HH:MM","reason":"משפט אחד בעברית"}`
    }], temperature: 0.3, json: true });
    const parsed = extractJSON(raw);
    if (parsed?.date && parsed?.time) {
      _tesAISuggestion = { date: parsed.date, time: parsed.time };
      if (res) {
        res.innerHTML = ` <b>הצעה:</b> ${fmtDate(parsed.date)} · ${parsed.time}<br>
<span style="color:var(--muted);font-size:0.79rem">${parsed.reason||''}</span><br>
<button onclick="tesApplyAISuggestion()" style="margin-top:0.45rem;background:var(--green);color:white;border:none;padding:0.35rem 0.9rem;border-radius:8px;font-family:var(--sans);font-weight:700;cursor:pointer;font-size:0.81rem"> אשר זמן</button>`;
        res.classList.add('show');
      }
    } else {
      if (res) { res.textContent = 'לא נמצא זמן פנוי מתאים בשבוע הקרוב.'; res.classList.add('show'); }
    }
  } catch(e) {
    if (res) { res.textContent = `שגיאה: ${e.message}`; res.classList.add('show'); }
  } finally {
    if (btn) { btn.textContent = '🤖 AI — הצע זמן טוב יותר'; btn.disabled = false; }
  }
}

function tesApplyAISuggestion() {
  if (!_tesAISuggestion) return;
  document.getElementById('tes-date').value = _tesAISuggestion.date;
  document.getElementById('tes-time').value = _tesAISuggestion.time;
  const res = document.getElementById('tes-ai-result');
  if (res) res.classList.remove('show');
  _tesAISuggestion = null;
  toast('✓ עדכון הוחל — לחץ "שמור" לאישור');
}

function saveTaskEditSheet() {
  if (!_tesTaskId) return;
  const t = S.tasks.find(x => String(x.id) === String(_tesTaskId));
  if (!t) { closeTaskEditSheet(); return; }
  const name   = document.getElementById('tes-name').value.trim();
  const course = document.getElementById('tes-course').value.trim();
  const date   = document.getElementById('tes-date').value;
  const time   = document.getElementById('tes-time').value;
  const dur    = Math.min(480, Math.max(15, parseInt(document.getElementById('tes-dur').value)||90));
  if (!name) { toast('שם המשימה הוא שדה חובה'); return; }
  if (name.length > 80) { toast('שם ארוך מדי (מקסימום 80 תווים)'); return; }
  if (!date || !time) { toast('תאריך ושעה הם שדות חובה'); return; }
  Object.assign(t, { name, course, date, time, duration: `${dur} דק'`, missed: false, done: false, missedReason: '' });
  save(); renderAll(); closeTaskEditSheet(); toast(' נשמר!');
}

// ── QUICK REPLY CHIPS IN RECALC CHAT ──
function _appendQuickReplies(chat, chips) {
  const row = document.createElement('div');
  row.className = 'quick-reply-row';
  chips.forEach(({ label, cls, text }) => {
    const btn = document.createElement('button');
    btn.className = `quick-chip${cls ? ' '+cls : ''}`;
    btn.textContent = label;
    btn.onclick = () => {
      row.remove();
      const inp = document.getElementById('recalc-input');
      if (inp) inp.value = text;
      sendRecalc();
    };
    row.appendChild(btn);
  });
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}



;

// Hook into collectAnchors (used in onboarding) to remove only conflicting tasks
const origCollectAnchors = window.collectAnchors;
window.collectAnchors = function() {
  const result = origCollectAnchors ? origCollectAnchors() : [];
  const today = ld(new Date());
  const anchors = S.anchors || [];
  let conflictsFound = false;
  S.tasks = (S.tasks || []).filter(t => {
    if (t.done || t.missed || t.date < today) return true;
    const taskDay = new Date(t.date + 'T12:00:00').getDay();
    const tst = parseInt((t.time||'00:00').split(':')[0])*60 + parseInt((t.time||'00:00').split(':')[1]);
    const dur = parseInt(String(t.duration||'').match(/\d+/)?.[0] || 60);
    const ten = tst + dur;
    const blocked = anchors.some(a => {
      if (parseInt(a.day) !== taskDay) return false;
      if (a.endDate && t.date > a.endDate) return false;
      if (a.oneTimeDate && a.oneTimeDate !== t.date) return false;
      const ast = parseInt((a.start||'00:00').split(':')[0])*60 + parseInt((a.start||'00:00').split(':')[1]) - (a.travelMin||0);
      const aen = parseInt((a.end||'00:00').split(':')[0])*60 + parseInt((a.end||'00:00').split(':')[1]) + (a.travelMin||0);
      return tst < aen && ten > ast;
    });
    if (blocked) { conflictsFound = true; return false; }
    return true;
  });
  if (conflictsFound) toast('כמה משימות הוסרו בגלל התנגשות עם העוגנים החדשים');
  return result;
};



function repeatLastSchedule() {
  if (!S.weeklyReview || !S.weeklyReview.history || S.weeklyReview.history.length === 0) {
    toast('️ אין היסטוריה של שבוע שעבר לשחזר ממנה');
    return;
  }
  const lastAnswers = S.weeklyReview.history[S.weeklyReview.history.length - 1].answers;
  if (!lastAnswers) {
    toast('️ לא נמצאו תשובות מהשבוע שעבר');
    return;
  }
  window._wrAnswers = lastAnswers;
  window.confirmWeeklyPlan(); // This will regenerate the schedule with deterministic engine using last week's parameters
  toast(' הלו"ז שוחזר והוגדר מחדש בהצלחה');
}

function saveFavoriteSchedule() {
  if (!S.weeklyReview || !S.weeklyReview.history || S.weeklyReview.history.length === 0) {
    toast('⚠️ אין לו"ז קודם לשמור');
    return;
  }
  const lastAnswers = S.weeklyReview.history[S.weeklyReview.history.length - 1].answers;
  if (!lastAnswers) {
    toast('️ לא ניתן לשמור לו"ז שטרם נבנה');
    return;
  }
  window.customPrompt('תן שם ללו"ז המועדף (למשל: "תקופת עומס" או "שבוע קל"):', 'לו"ז מועדף 1', function(name) {
    if (!name) return;
    if (!S.favoriteSchedules) S.favoriteSchedules = [];
    S.favoriteSchedules.push({ name, answers: lastAnswers, dateSaved: new Date().toISOString() });
    save();
    toast('⭐ הלו"ז נשמר כמועדף!');
  });
}

function loadFavoriteSchedule() {
  if (!S.favoriteSchedules || S.favoriteSchedules.length === 0) {
    toast('️ אין לך עדיין לו"ז מועדף שמור');
    return;
  }

  let options = S.favoriteSchedules.map((f, i) => `[${i}] ${f.name}`).join('\n');
  window.customPrompt(`בחר את מספר הלו"ז המועדף לטעינה:\n${options}`, '', function(choice) {
    if (choice === null) return;
    const idx = parseInt(choice);
    if (isNaN(idx) || idx < 0 || idx >= S.favoriteSchedules.length) {
      toast('️ בחירה לא תקינה');
      return;
    }
    const fav = S.favoriteSchedules[idx];
    window._wrAnswers = fav.answers;
    window.confirmWeeklyPlan();
    toast(` הלו"ז "${fav.name}" נטען בהצלחה`);
  });
}

async function planPreviousWeek() {
  const doneEl = document.getElementById('wr-done');
  const activeEl = document.getElementById('wr-active');
  if (doneEl) doneEl.classList.add('hidden');
  if (activeEl) activeEl.classList.remove('hidden');
  document.getElementById('wr-msgs').innerHTML = '';
  document.getElementById('wr-choices').classList.add('hidden');
  document.getElementById('wr-result').classList.add('hidden');

  const now = new Date();
  const prevSun = new Date(now); prevSun.setDate(now.getDate() - now.getDay() - 7);
  const prevSat = new Date(prevSun); prevSat.setDate(prevSun.getDate() + 6);
  _wrMsg(` יוצר לוז לשבוע הקודם (${ld(prevSun)} – ${ld(prevSat)})...`);

  try {
    const selectedHobbies = (S.hobbies || []).map(h => h.name);
    const homework = (S.homework || []).filter(h => !h.done);
    const { tasks } = generateWeeklySchedule({ load: 'balanced', courseDifficulty: {}, selectedHobbies, homework });
    if (!tasks || !tasks.length) {
      _wrMsg('❌ לא נמצאו זמנים זמינים.');
      return;
    }
    // Shift all generated dates back by 7 days
    const shifted = tasks.map(t => {
      const d = new Date(t.date + 'T12:00'); d.setDate(d.getDate() - 7);
      return { ...t, id: uid(), date: ld(d) };
    });
    if (!_wr) _wr = { answers: {}, qs: [], qi: 0 };
    _wr.pendingPlan = shifted;
    _wrShowPreview(shifted);
    _wrMsg(` נוצרו ${shifted.length} משימות לשבוע הקודם — בדוק ואשר.`);
  } catch (e) {
    _wrMsg('שגיאה: ' + e.message);
  }
}


// ── HOMEWORK LOGIC ──

function renderHomework() {
  const sel = document.getElementById('hw-course-select');
  if (sel) {
    const courses = [...new Set([
      ...(S.courses || []).map(c => c.name),
      ...(S.tasks || []).map(t => t.course).filter(Boolean)
    ])].filter(Boolean);
    sel.innerHTML = '<option value="">-- בחר קורס --</option>' + courses.map(c => `<option value="${c}">${c}</option>`).join('');
    const noCourseMsg = document.getElementById('hw-no-course-msg');
    if (noCourseMsg) noCourseMsg.style.display = courses.length === 0 ? '' : 'none';
  }

  const list = document.getElementById('hw-list');
  if (list) {
    const hws = (S.homework || []).filter(h => !h.done).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    var emptyEl = document.getElementById('hw-empty-state');
    if (emptyEl) emptyEl.style.display = hws.length === 0 ? '' : 'none';
    if (hws.length === 0) {
      list.innerHTML = '';
    } else {
      list.innerHTML = hws.map(h => {
        const d = new Date(h.date + 'T12:00:00');
        const diff = h.date ? Math.ceil((d - new Date()) / 86400000) : null;
        const isLate = diff !== null && diff < 0;
        const color = isLate ? 'var(--red)' : (diff !== null && diff <= 3) ? 'var(--yellow)' : 'var(--accent)';
        const bgColor = isLate ? 'var(--red-light)' : (diff !== null && diff <= 3) ? 'var(--yellow-light)' : 'var(--accent-light)';
        const daysLabel = diff === null ? 'ללא תאריך הגשה' : isLate ? 'עבר תאריך ההגשה!' : diff === 0 ? 'היום!' : `בעוד ${diff} ימים`;
        const dateStr = h.date ? ` (${formatPrettyDate(h.date)})` : '';

        return `
        <div style="background:var(--surface);border-radius:20px;padding:1.25rem;margin-bottom:1rem;box-shadow:0 12px 24px rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.03);display:flex;align-items:center;justify-content:space-between;transition:transform 0.3s;animation:slideUpFadeIn 0.3s ease-out;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.4rem;">
              <span style="font-size:0.75rem;font-weight:900;background:var(--surface2);color:var(--text);padding:4px 10px;border-radius:12px;">${h.course || 'ללא קורס'}</span>
              <span style="font-size:0.75rem;font-weight:900;background:${bgColor};color:${color};padding:4px 10px;border-radius:12px;">${daysLabel}${dateStr}</span>
            </div>
            <div style="font-size:1.15rem;font-weight:900;color:var(--text);margin-bottom:0.25rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.name}</div>
            <div style="font-size:0.85rem;font-weight:700;color:var(--muted);">זמן מוערך: ${h.duration} דק'</div>
          </div>
          <div style="display:flex;gap:0.5rem;margin-right:1rem;">
            <button onclick="markHomeworkDone('${h.id}')" title="סמן כבוצע" style="width:44px;height:44px;border-radius:14px;border:none;background:var(--green);color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 16px rgba(22,201,141,0.25);transition:transform 0.2s;">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button onclick="deleteHomework('${h.id}')" title="מחק מטלה" style="width:44px;height:44px;border-radius:14px;border:none;background:var(--surface2);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.2s;">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>`;
      }).join('');
    }
  }
}

function addHomework() {
  const course = document.getElementById('hw-course-select').value;
  const name = document.getElementById('hw-name').value.trim();
  const date = document.getElementById('hw-date').value;
  const duration = Math.min(480, Math.max(5, parseInt(document.getElementById('hw-duration').value) || 90));

  if (!course || !name || !date) { toast('️ אנא מלא קורס, תיאור ותאריך הגשה'); return; }
  if (name.length > 80) { toast('תיאור ארוך מדי (מקסימום 80 תווים)'); return; }
  
  if (!S.homework) S.homework = [];
  S.homework.push({ id: uid(), course, name, date, duration, done: false });
  
  document.getElementById('hw-name').value = '';
  document.getElementById('hw-date').value = '';
  
  save(); renderAll();
  toast(' המטלה נוספה. היא תלקח בחשבון בסיכום השבועי הבא!');
}

function markHomeworkDone(id) {
  const h = S.homework.find(x => x.id === id);
  if(h) { 
    h.done = true; 
    const xp = Math.max(10, Math.floor((parseInt(h.duration)||60) / 5));
    addPoints(xp); save(); renderAll(); 
    toast(` כל הכבוד! המטלה הושלמה! (+${xp} XP)`); 
  }
}
function deleteHomework(id) {
  if(!confirm('למחוק מטלה זו?')) return;
  S.homework = S.homework.filter(x => x.id !== id);
  save(); renderAll(); toast(' המטלה נמחקה');
}




let isMonthViewOpen = false;

function toggleCalendarViewModal() {
  const weekly = document.getElementById('schedule-weekly-view');
  const monthly = document.getElementById('schedule-monthly-view');
  const weekLabelEl = document.getElementById('week-label');
  if (!weekly || !monthly) return;

  isMonthViewOpen = !isMonthViewOpen;

  if (isMonthViewOpen) {
    weekly.style.display = 'none';
    monthly.style.display = 'block';
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (S.weekOffset||0) * 7);
    calMonth = d.getMonth();
    calYear = d.getFullYear();
    if (weekLabelEl) weekLabelEl.textContent = 'חזרה ללו"ז שבועי';
    renderMonthCalendar();
  } else {
    monthly.style.display = 'none';
    weekly.style.display = 'block';
    if (weekLabelEl) weekLabelEl.textContent = '';
    renderSchedule();
  }
}

// ── Window self-registration ──────────────────────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studyflow-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('הנתונים יוצאו בהצלחה ✓');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('invalid');
      if (!parsed.userName && !parsed.tasks && !parsed.courses) throw new Error('not a StudyFlow backup');
      const safe = {};
      const arrFields = ['tasks','anchors','courses','exams','hobbies','reminders','homework','favoriteSchedules','deletedCollisions'];
      const strFields = ['userName','institution','wakeTime','sleepTime','theme','userType'];
      const numFields = ['points','streak','doneTaskCount'];
      const objFields = ['profile','weeklyReview','settings'];
      arrFields.forEach(k => { if (Array.isArray(parsed[k])) safe[k] = parsed[k]; });
      strFields.forEach(k => { if (typeof parsed[k] === 'string') safe[k] = parsed[k]; });
      numFields.forEach(k => { if (typeof parsed[k] === 'number') safe[k] = parsed[k]; });
      objFields.forEach(k => { if (parsed[k] && typeof parsed[k] === 'object' && !Array.isArray(parsed[k])) safe[k] = parsed[k]; });
      Object.assign(S, safe);
      save();
      toast('הנתונים יובאו בהצלחה — טוען מחדש...');
      setTimeout(() => location.reload(), 1200);
    } catch {
      toast('קובץ לא תקין — בדוק שזה קובץ גיבוי של StudyFlow');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ES module functions are not in global scope. Assign all public functions to
// window so that HTML onclick="" handlers can find them.
window._sfDb = db;

// Bridge _wrPlanNextWeek / _wrForceRebuild so that onclick="" assignments
// (which run in window scope) update the module-level variables read by app code.
Object.defineProperty(window, '_wrPlanNextWeek', {
  get() { return _wrPlanNextWeek; },
  set(v) { _wrPlanNextWeek = v; },
  configurable: true,
});
Object.defineProperty(window, '_wrForceRebuild', {
  get() { return _wrForceRebuild; },
  set(v) { _wrForceRebuild = v; },
  configurable: true,
});

Object.assign(window, {
  // ── Utilities ──
  S, uid, ld, fmtDate, toast, closeModal, selOpt, extractJSON, getCourseColor, save,
  // ── Auth ──
  authSwitchTab, authTogglePass, authForgotPassword, signInWithGoogle, authSubmit, signOut,
  checkAuth,
  // ── App init / onboarding ──
  initApp, obNext, addAnchorRow, _abCheckEmpty, toggleObDay, updateObPerDayRows,
  renderProfileQs, selectProfileOpt, finishOnboarding,
  // ── Navigation ──
  toggleSidebar, closeSidebar, openSettings, saveSettings, toggleAccordion,
  showPage, updateBottomNav,
  // ── AI / assistant ──
  clearAssistantHistory, appendAssistantMsg,
  // ── Gamification / progress ──
  addPoints, updateStreak, renderProgress, renderTreeMini, updateHeaderStats, renderNextTaskCountdown,
  // ── Schedule ──
  changeWeek, renderSchedule, selectScheduleDay, renderDayTimeline, toggleScheduleView,
  changeCalMonth, renderMonthCalendar, selectMonthDay, toggleCalendarViewModal,
  openManualTaskModal, saveManualTask, openTimeChart, renderTimeChart, zoomTimeline,
  _getUrgencyClass, _detectFocusBlocks,
  // ── Today / tasks ──
  renderTodayTasks, quickMarkDone, openTaskQuickActions,
  openTaskActionSheet, closeTaskActionSheet,
  doneTask, undoTask, deleteTask, missTask, confirmMissed,
  previewStars, selectStar, submitTaskRating, finishTaskRating,
  openTaskEditSheet, closeTaskEditSheet, tesDoneTask, tesMissTask, tesDeleteTask,
  saveTaskEditSheet,
  // ── Anchors ──
  renderAnchorsList, showAddAnchorModal, editAnchor, saveAnchorManual,
  removeAnchor, toggleRecurring, updateDayTimeRows,
  openCalendarImport, handleICSFile, importFromICS,
  setAnchorType, toggleAncAdvanced,
  // ── Reminders ──
  openReminders, addReminder, removeReminder, renderReminders,
  // ── Exams ──
  addExam, renderExams, renderExamDashboard, scheduleExamCrunch, removeExam,
  // ── Homework ──
  renderHomework, addHomework, markHomeworkDone, deleteHomework,
  // ── Hobby ──
  renderHobbyPage, hpCreateHobby, hpConfirmAddTasks, hpDeleteHobby, findHobbySlots, hpOpenReport, hpReportSave,
  _hpSelectTab, _hpShowSetup, _hpShowEmpty, sendHobbyPageMessage, openHobbyPlanner,
  // ── Weekly review ──
  renderWeeklyReview, confirmWeeklyPlan, repeatLastSchedule, planPreviousWeek,
  saveFavoriteSchedule, loadFavoriteSchedule,
  _wrAnswer, _wrAdjustAnswer, _wrNext, _wrDislikeFlow, _wrInit,
  renderWRSidebarCard,
  // ── Planner ──
  generatePlan, renderPlanTable, addPlanToSchedule, setPlannerMode,
  addSemesterCourse, removeSemesterCourse, generateSemesterPlan, addSemesterPlanToSchedule, updateSemCapacity,
  deleteCourseFromSchedule, renderCourseManager, renderPlannerPage,
  plShAddCourseRow, plShAddHobby, plShSelectGoal, plShBuildFirstWeek, plShAddHwRow, plShHobbyQuickSave, hqmPick,
  addPlannerCourse, deletePlannerCourse, openAddCourseModal,
  openCapacityNegotiation, openRecalcForCollision,
  // ── Pomodoro ──
  pomoStart, pomoPause, pomoReset, renderPomoTaskSelect, openFocusMode, selectPomoDuration,
  togglePomoTaskDrop, selectPomoTask,
  // ── Focus lock ──
  focusLockOpen, focusLockClose, focusLockCheckAnswer, focusLockShowChallenge, focusLockHideChallenge,
  // ── Recalc ──
  openRecalc, closeRecalc, sendRecalc, applyPendingRecalcActions, _rcShowTextInput,
  _rcDoMoveNextDay, _rcDoSpreadWeek, _rcDoIgnore, _rcDoRescheduleMissed, _rcDoMarkMissed,
  _rcFreeFromCourse, _rcProceedWithAvailable,
  // ── Tutor ──
  // ── Settings ──
  toggleTheme, confirmReset, resetSettings,
  // ── Backup ──
  exportData, importData,
});



/* --- ESCAPE KEY closes the task-edit sheet (desktop safety net) --- */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const tes = document.getElementById('tes-panel');
  if (tes && tes.classList.contains('open')) { closeTaskEditSheet(); return; }
  const tas = document.getElementById('task-sheet-panel');
  if (tas && tas.classList.contains('open') && typeof closeTaskActionSheet === 'function') closeTaskActionSheet();
});

/* --- DRAG TO DISMISS LOGIC --- */
document.addEventListener('DOMContentLoaded', () => {
  const sheets = [
    { panelId: 'task-sheet-panel', closeFn: closeTaskActionSheet },
    { panelId: 'tes-panel', closeFn: closeTaskEditSheet },
    { panelId: 'time-chart-modal-box', closeFn: () => closeModal('time-chart-modal') }
  ];

  sheets.forEach(({panelId, closeFn}) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    panel.addEventListener('touchstart', (e) => {
      // Don't interfere if they are scrolling inside an input or select
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
      panel.style.transition = 'none'; // Remove transition for 1:1 finger tracking
    }, { passive: true });

    panel.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      // Only drag downwards
      if (deltaY > 0) {
        panel.style.transform = `translateY(calc(env(safe-area-inset-bottom, 0px) + ${deltaY}px))`;
        e.preventDefault(); // Prevent background scrolling
      }
    }, { passive: false });

    panel.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = currentY - startY;
      
      panel.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1)';
      
      if (deltaY > 100) {
        // Dragged far enough to dismiss
        closeFn();
        setTimeout(() => { panel.style.transform = ''; }, 300);
      } else {
        // Snap back
        panel.style.transform = '';
      }
    });
  });
});





// --- PWA Safe Custom Prompt ---
window.customPrompt = function(msg, defaultVal, callback) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '100000';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.display = 'flex';
  overlay.style.background = 'rgba(0,0,0,0.5)';
  
  const box = document.createElement('div');
  box.className = 'modal-box';
  box.style.margin = 'auto';
  box.style.textAlign = 'center';
  box.style.width = '80%';
  box.style.maxWidth = '300px';
  box.style.background = 'var(--surface)';
  box.style.padding = '1.5rem';
  box.style.borderRadius = '20px';
  box.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
  
  const title = document.createElement('div');
  title.textContent = msg;
  title.style.marginBottom = '15px';
  title.style.whiteSpace = 'pre-wrap';
  title.style.fontWeight = 'bold';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tem-input';
  input.value = defaultVal || '';
  input.style.marginBottom = '15px';
  input.style.width = '100%';
  input.style.padding = '10px';
  input.style.borderRadius = '10px';
  input.style.border = '1px solid var(--border)';
  
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '10px';
  btnRow.style.marginTop = '10px';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.style.flex = '1';
  cancelBtn.style.padding = '10px';
  cancelBtn.style.background = 'var(--surface2)';
  cancelBtn.style.color = 'var(--text)';
  cancelBtn.style.borderRadius = '10px';
  cancelBtn.style.border = 'none';
  cancelBtn.textContent = 'ביטול';
  cancelBtn.onclick = () => { document.body.removeChild(overlay); callback(null); };
  
  const okBtn = document.createElement('button');
  okBtn.style.flex = '1';
  okBtn.style.padding = '10px';
  okBtn.style.background = 'var(--accent)';
  okBtn.style.color = 'white';
  okBtn.style.borderRadius = '10px';
  okBtn.style.border = 'none';
  okBtn.style.fontWeight = 'bold';
  okBtn.textContent = 'אישור';
  okBtn.onclick = () => { document.body.removeChild(overlay); callback(input.value); };
  
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(okBtn);
  
  box.appendChild(title);
  box.appendChild(input);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  input.focus();
};
