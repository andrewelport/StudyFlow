// ── XP LEVEL SYSTEM ──
const XP_LEVELS = [
  {min:0,     max:100,   emoji:'🌱', name:'מתחיל'},
  {min:100,   max:500,   emoji:'⭐', name:'סטודנט מתפתח'},
  {min:500,   max:1500,  emoji:'🌟', name:'לומד מתקדם'},
  {min:1500,  max:3000,  emoji:'💎', name:'אלוף הלמידה'},
  {min:3000,  max:6000,  emoji:'🚀', name:'מאסטר'},
  {min:6000,  max:10000, emoji:'👑', name:'אגדת הסטודנטים'},
  {min:10000, max:Infinity, emoji:'🏆', name:'גאון מוכרז'}
];

const ACHIEVEMENTS = [
  { id:'first_task',  icon:'🎯', name:'יריית פתיחה',   check: s => s.tasks.some(t=>t.done) },
  { id:'tasks10',     icon:'📦', name:'10 משימות',      check: s => (s.doneTaskCount||0) + s.tasks.filter(t=>t.done).length >= 10 },
  { id:'tasks50',     icon:'🚂', name:'50 משימות',      check: s => (s.doneTaskCount||0) + s.tasks.filter(t=>t.done).length >= 50 },
  { id:'tasks100',    icon:'🏅', name:'100 מוכן',        check: s => (s.doneTaskCount||0) + s.tasks.filter(t=>t.done).length >= 100 },
  { id:'streak3',     icon:'🔥', name:'3 ימי רצף',      check: s => (s.streak||0) >= 3 },
  { id:'streak7',     icon:'💥', name:'שבוע מלא',       check: s => (s.streak||0) >= 7 },
  { id:'streak30',    icon:'🌙', name:'חודש רצף',       check: s => (s.streak||0) >= 30 },
  { id:'xp500',       icon:'⭐', name:'500 XP',          check: s => (s.points||0) >= 500 },
  { id:'xp2000',      icon:'💎', name:'2000 XP',         check: s => (s.points||0) >= 2000 },
  { id:'exam_added',  icon:'📋', name:'יעד מוגדר',      check: s => s.exams && s.exams.length > 0 },
  { id:'perfect_day', icon:'✨', name:'יום מושלם',      check: s => { const m={}; s.tasks.forEach(t=>{if(!m[t.date])m[t.date]={n:0,d:0};m[t.date].n++;if(t.done)m[t.date].d++;}); return Object.values(m).some(d=>d.n>=3&&d.d===d.n); } },
  { id:'night_owl',   icon:'🦉', name:'ינשוף לילה',     check: s => s.tasks.some(t=>t.done&&t.time>='21:00') },
];

function renderProgress(){
  const pts = S.points || 0;
  const streak = S.streak || 0;
  const lvl = XP_LEVELS.find(l => pts >= l.min && pts < l.max) || XP_LEVELS[XP_LEVELS.length-1];
  const nextLvl = XP_LEVELS[XP_LEVELS.indexOf(lvl) + 1];
  const lvlPct = Math.min(100, ((pts - lvl.min) / Math.max(1, lvl.max - lvl.min)) * 100);
  const circumference = 351.9; // 2π * 56

  // ── XP Ring ──
  const ringEl = document.getElementById('sq-ring-fill');
  if (ringEl) ringEl.style.strokeDashoffset = (circumference * (1 - lvlPct / 100)).toFixed(2);
  const el = id => document.getElementById(id);
  if (el('tree-pts')) el('tree-pts').textContent = pts.toLocaleString();
  if (el('xp-level-emoji')) el('xp-level-emoji').textContent = lvl.emoji;
  if (el('tree-next')) el('tree-next').textContent = `${lvl.emoji} ${lvl.name}`;
  if (el('sq-xp-bar')) el('sq-xp-bar').style.width = lvlPct.toFixed(1) + '%';
  if (el('sq-xp-caption')) el('sq-xp-caption').textContent = nextLvl ? `${pts - lvl.min} / ${lvl.max - lvl.min} XP לרמה הבאה` : 'רמה מקסימלית!';
  if (el('streak-badge')) el('streak-badge').textContent = streak;
  if (el('sq-fire-icon')) el('sq-fire-icon').textContent = streak >= 7 ? '🔥' : streak >= 3 ? '✨' : '💤';

  // ── Stat pills ──
  const done = S.tasks.filter(t => t.done).length;
  const total = S.tasks.length;
  if (el('stat-total-done')) el('stat-total-done').textContent = done;
  if (el('stat-total')) el('stat-total').textContent = total;
  if (el('stat-pct')) el('stat-pct').textContent = total ? Math.round(done / total * 100) + '%' : '0%';
  if (el('sq-exams-stat')) el('sq-exams-stat').textContent = (S.exams || []).length;
  const today3 = ld(new Date());
  const ptsToday = S.tasks.filter(t => t.date === today3 && t.done).length * 10;
  if (el('sq-pts-today')) el('sq-pts-today').textContent = '+' + ptsToday;

  // ── Daily Missions ──
  const todayTasks = S.tasks.filter(t => t.date === today3);
  const todayDone = todayTasks.filter(t => t.done).length;
  const rewardKey = `sf_dr_${today3}`;
  const alreadyClaimed = !!localStorage.getItem(rewardKey);
  const missions = [
    { icon:'📚', bg:'#ede9fe', title:'השלם 3 משימות היום',
      sub: `${Math.min(todayDone,3)} / 3`, xp: 30,
      done: todayDone >= 3 },
    { icon:'🏆', bg:'#fef3c7', title:'השלם את כל המשימות היום',
      sub: todayTasks.length > 0 ? `${todayDone} / ${todayTasks.length}` : 'אין משימות',
      xp: 50, done: todayTasks.length > 0 && todayDone >= todayTasks.length },
    { icon:'🔥', bg:'#fee2e2', title:'שמור על רצף',
      sub: streak >= 1 && S.lastStudyDate === today3 ? 'בוצע להיום!' : `${streak} ימים`,
      xp: 20, done: streak >= 1 && S.lastStudyDate === today3 },
    { icon:'📊', bg:'#d1fae5', title:'בקר בדף ההתקדמות',
      sub: 'כבר כאן!', xp: 5, done: true },
    { icon:'🎯', bg:'#e0f2fe', title:'הוסף מבחן לתכנון',
      sub: (S.exams||[]).length > 0 ? `${(S.exams||[]).length} מבחנים` : 'טרם הוסף',
      xp: 15, done: (S.exams||[]).length > 0 },
  ];
  const mWrap = el('sq-missions-wrap');
  if (mWrap) {
    mWrap.innerHTML = missions.map(m => `
      <div class="sq-mission-row${m.done ? ' sq-mission-done' : ''}">
        <div class="sq-mission-icon" style="background:${m.bg}">${m.icon}</div>
        <div class="sq-mission-text">
          <div class="sq-mission-title">${m.title}</div>
          ${m.sub ? `<div class="sq-mission-sub">${m.sub}</div>` : ''}
        </div>
        <div class="sq-mission-xp">+${m.xp} XP</div>
        <div class="sq-mission-check${m.done ? ' done' : ''}">
          ${m.done ? '' : ''}
        </div>
      </div>`).join('');
  }

  // daily reward claim
  const rewardEl = el('quest-reward');
  window.claimDailyReward = function() {
    if (localStorage.getItem(rewardKey)) { toast('כבר קיבלת את פרס היום '); return; }
    localStorage.setItem(rewardKey, '1');
    addPoints(100); renderProgress(); toast(' כל הכבוד! +100 XP!');
  };
  if (rewardEl) {
    if (todayTasks.length > 0 && todayDone >= todayTasks.length && !alreadyClaimed)
      rewardEl.innerHTML = `<button style="font-size:0.75rem;font-weight:800;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:0.25rem 0.7rem;cursor:pointer;font-family:var(--sans)" onclick="claimDailyReward()">+100 XP פרס יומי!</button>`;
    else if (alreadyClaimed)
      rewardEl.textContent = ' פרס נאסף';
    else
      rewardEl.textContent = '';
  }

  // ── Achievements ──
  const bWrap = el('sq-badges-wrap');
  if (bWrap) {
    const earned = ACHIEVEMENTS.filter(a => a.check(S));
    if (el('sq-badge-count')) el('sq-badge-count').textContent = `${earned.length} / ${ACHIEVEMENTS.length}`;
    const HEX_COLORS = [
      ['#4f6ef7','#a78bfa'],['#06b6d4','#16c98d'],['#8b5cf6','#ec4899'],
      ['#f5a623','#f97316'],['#16c98d','#4f6ef7'],['#f97316','#fbbf24'],
      ['#06b6d4','#8b5cf6'],['#10b981','#06b6d4'],['#f76060','#f97316'],
      ['#a78bfa','#4f6ef7'],['#ec4899','#8b5cf6'],['#fbbf24','#f5a623']
    ];
    bWrap.innerHTML = ACHIEVEMENTS.map((a, i) => {
      const isEarned = a.check(S);
      const [c1, c2] = HEX_COLORS[i % HEX_COLORS.length];
      const hexStyle = isEarned ? `background:linear-gradient(145deg,${c1},${c2})` : '';
      const shadow = isEarned ? `filter:drop-shadow(0 4px 14px ${c1}55)` : '';
      return `<div class="sq-badge${isEarned ? ' earned' : ''}">
        <div class="sq-badge-hex" style="${hexStyle};${shadow}">
          <span class="sq-badge-hex-icon">${a.icon}</span>
        </div>
        <div class="sq-badge-name">${a.name}</div>
      </div>`;
    }).join('');
  }

  // ── Course progress bars ──
  const cpEl = el('course-progress-bars');
  if (cpEl) {
    const courses = [...new Set(S.tasks.filter(t => t.course).map(t => t.course))];
    if (courses.length) {
      const colors = ['#4f6ef7','#16c98d','#f5a623','#f76060','#a78bfa','#38ef7d','#ec4899'];
      cpEl.innerHTML = courses.map((c, i) => {
        const ct = S.tasks.filter(t => t.course === c);
        const cd = ct.filter(t => t.done).length;
        const pct = ct.length ? Math.round(cd / ct.length * 100) : 0;
        const col = colors[i % colors.length];
        return `<div style="margin-bottom:0.75rem">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.3rem">
            <span style="font-size:0.82rem;font-weight:700;color:var(--text)">${c}</span>
            <span style="font-size:0.72rem;font-weight:700;color:var(--muted)">${cd}/${ct.length} · ${pct}%</span>
          </div>
          <div style="height:8px;background:var(--border);border-radius:99px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${col};border-radius:99px;transition:width 0.8s ease"></div>
          </div>
        </div>`;
      }).join('');
    } else {
      cpEl.innerHTML = `<div style="font-size:0.82rem;color:var(--muted);text-align:center;padding:0.75rem">לא נמצאו קורסים עם משימות עדיין</div>`;
    }
  }
}

function addPoints(n){ S.points = (S.points || 0) + n; updateStreak(); save(); renderTreeMini(); try { renderProgress(); renderTodayTasks(); } catch(e){} }
function updateStreak() {
  const today = ldJ(new Date());
  const yesterday = ldJ(new Date(Date.now() - 86400000));
  if (S.lastStudyDate === today) return;
  // Continue streak if studied yesterday, otherwise start fresh at 1
  S.streak = (S.lastStudyDate === yesterday) ? (S.streak || 0) + 1 : 1;
  S.lastStudyDate = today;
}
function renderTreeMini(){ if(document.getElementById('sc-streak')) document.getElementById('sc-streak').textContent = (S.streak || 0); }

// ── POMODORO ──
function _profileDuration() {
  const span = S.profile && S.profile.focus_span || '';
  if (span.includes('25')) return 25;
  if (span.includes('30')) return 45; // "30–45" → 45' button
  if (span.includes('60')) return 60;
  return 90;
}
let pomoInterval=null, pomoRunning=false, pomoMode='work';
let _pomoCustomMins = 90;
let POMO_WORK=90*60, pomoSeconds=POMO_WORK; const POMO_BREAK=20*60;
function renderPomoTaskSelect() {
  const list = document.getElementById('pomo-cs-list');
  if (!list) return;
  const today = ld(new Date());
  const tasks = S.tasks.filter(t => t.date === today && !t.done && !t.missed);
  list.innerHTML = '';
  const noneRow = document.createElement('div');
  noneRow.className = 'pomo-cs-opt';
  noneRow.textContent = '— בחר משימה (רשות) —';
  noneRow.addEventListener('click', () => selectPomoTask('', '— בחר משימה (רשות) —'));
  list.appendChild(noneRow);
  tasks.forEach(t => {
    const row = document.createElement('div');
    row.className = 'pomo-cs-opt';
    row.textContent = (t.time ? t.time + ' | ' : '') + t.name;
    row.addEventListener('click', () => selectPomoTask(t.id, (t.time || '') + '  ' + t.name));
    list.appendChild(row);
  });
}

function togglePomoTaskDrop(e) {
  if (e) e.stopPropagation();
  const list = document.getElementById('pomo-cs-list');
  if (!list) return;
  const isOpen = list.classList.contains('open');
  if (isOpen) { list.classList.remove('open'); return; }
  renderPomoTaskSelect();
  list.classList.add('open');
  setTimeout(() => {
    document.addEventListener('click', function _close() {
      list.classList.remove('open');
      document.removeEventListener('click', _close);
    }, { once: true });
  }, 0);
}

function selectPomoTask(id, label) {
  const inp = document.getElementById('pomo-task-select');
  if (inp) inp.value = id;
  const lbl = document.getElementById('pomo-cs-label');
  if (lbl) lbl.textContent = label;
  document.getElementById('pomo-cs-list')?.classList.remove('open');
}
function _pomoSaveSession() {
  const taskSel = document.getElementById('pomo-task-select');
  sessionStorage.setItem('pomo-session', JSON.stringify({
    startWall: Date.now(),
    secondsAtSave: pomoSeconds,
    mode: pomoMode,
    taskId: taskSel ? taskSel.value : '',
    running: pomoRunning
  }));
}

function _pomoRestoreSession() {
  // Skip restore on page reload — only restore on tab visibility change (e.g., lock screen)
  const navType = performance.getEntriesByType?.('navigation')[0]?.type;
  if (navType === 'reload' || navType === 'navigate') {
    sessionStorage.removeItem('pomo-session');
    return;
  }
  const raw = sessionStorage.getItem('pomo-session');
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (!s.running || !s.startWall || typeof s.secondsAtSave !== 'number') return;
    const elapsed = Math.floor((Date.now() - s.startWall) / 1000);
    const remaining = s.secondsAtSave - elapsed;
    if (remaining <= 0) {
      sessionStorage.removeItem('pomo-session');
      return;
    }
    pomoMode = s.mode;
    pomoSeconds = remaining;
    pomoRunning = false;
    if (typeof pomoInterval !== 'undefined' && pomoInterval) clearInterval(pomoInterval);
    const displayEl = document.getElementById('pomo-display');
    const m = String(Math.floor(remaining/60)).padStart(2,'0'), sec = String(remaining%60).padStart(2,'0');
    if (displayEl) displayEl.textContent = `${m}:${sec}`;
    if (s.taskId) {
      const inp = document.getElementById('pomo-task-select');
      if (inp) inp.value = s.taskId;
      const task = S.tasks.find(t => String(t.id) === String(s.taskId));
      if (task) { const lbl = document.getElementById('pomo-cs-label'); if (lbl) lbl.textContent = (task.time ? task.time + ' | ' : '') + task.name; }
    }
    toast('הפוקוס שוחזר — לחץ ▶ להמשיך');
  } catch (_) {}
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') _pomoRestoreSession();
  else if (pomoRunning) _pomoSaveSession();
});

function pomoStart(){
  if(pomoRunning) return;
  pomoRunning = true;
  document.getElementById('pomo-start-btn')?.classList.add('hidden');
  document.getElementById('pomo-pause-btn')?.classList.remove('hidden');

  // Get task name for Focus Lock
  const taskSel = document.getElementById('pomo-task-select');
  const taskId = taskSel ? taskSel.value : null;
  const pt = taskId ? S.tasks.find(x => String(x.id) === String(taskId)) : null;
  const taskName = pt ? pt.name : (pomoMode === 'break' ? ' הפסקה' : 'מפגש ריכוז');
  const totalSecs = pomoMode === 'work' ? POMO_WORK : POMO_BREAK;
  const elapsed = totalSecs - pomoSeconds;

  // Save session for screen-lock recovery
  _pomoSaveSession();

  // Open Focus Lock overlay
  focusLockOpen(taskName, totalSecs, elapsed, pomoMode === 'work' ? 'work' : 'break');
  FL.xpEarned = 0;

  if (typeof pomoInterval !== 'undefined' && pomoInterval) clearInterval(pomoInterval);
  pomoInterval = setInterval(() => {
    pomoSeconds--;
    const total = pomoMode === 'work' ? POMO_WORK : POMO_BREAK;
    const elapsed2 = total - pomoSeconds;
    const m = String(Math.floor(pomoSeconds / 60)).padStart(2, '0');
    const s = String(pomoSeconds % 60).padStart(2, '0');
    const timeStr = `${m}:${s}`;

    // Update pomo display (background)
    const displayEl = document.getElementById('pomo-display');
    if (displayEl) displayEl.textContent = timeStr;
    const progEl = document.getElementById('pomo-prog');
    if (progEl) progEl.style.width = ((elapsed2 / total) * 100).toFixed(1) + '%';

    // Update Focus Lock overlay
    if (FL.active) {
      focusLockUpdateTimer(timeStr, total, elapsed2);
      FL.xpEarned = Math.floor(elapsed2 / 60); // 1 XP per minute
    }

    if (pomoSeconds <= 0) {
      clearInterval(pomoInterval);
      pomoRunning = false;
      sessionStorage.removeItem('pomo-session');

      if (pomoMode === 'work') {
        FL.sessionsDone++;
        addPoints(20);
        save();

        // Re-read the dropdown at completion (user may have changed it mid-session)
        const _sel = document.getElementById('pomo-task-select');
        const _curId = _sel ? _sel.value : taskId;
        const found = _curId ? S.tasks.find(x => String(x.id) === String(_curId)) : null;
        // Don't auto-complete — ask the user instead of silently marking done
        if (found && !found.done && confirm(`לסמן את "${found.name}" כהושלם?`)) {
          found.done = true; found.missed = false; save(); renderAll();
        }

        // Transition to break in Focus Lock
        pomoMode = 'break';
        pomoSeconds = POMO_BREAK;
        _pomoSaveSession();
        focusLockOpen(' הפסקה מגיעה לך!', POMO_BREAK, 0, 'break');
        toast(' פוקוס הושלם! +20 נקודות  קח הפסקה');
        renderPomoTaskSelect();
      } else {
        pomoMode = 'work';
        pomoSeconds = POMO_WORK;
        focusLockClose();
        toast(' ההפסקה נגמרה! חזרה לריכוז');
      }
      document.getElementById('pomo-start-btn')?.classList.remove('hidden');
      document.getElementById('pomo-pause-btn')?.classList.add('hidden');
    }
  }, 1000);
}
function pomoPause(){
  clearInterval(pomoInterval);
  pomoRunning = false;
  document.getElementById('pomo-start-btn')?.classList.remove('hidden');
  document.getElementById('pomo-pause-btn')?.classList.add('hidden');
}
function pomoReset(){
  pomoPause();
  focusLockClose();
  sessionStorage.removeItem('pomo-session');
  pomoMode='work';
  POMO_WORK = _pomoCustomMins * 60;
  pomoSeconds=POMO_WORK;
  const displayEl = document.getElementById('pomo-display');
  if (displayEl) displayEl.textContent=`${String(_pomoCustomMins).padStart(2,'0')}:00`;
  const progEl = document.getElementById('pomo-prog');
  if (progEl) progEl.style.width='0%';
}
