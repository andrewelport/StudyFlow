// ══════════════════════════════════════════
// WEEKLY REVIEW — סיכום שבועי
// ══════════════════════════════════════════

function _wrProg(done) {
  const total = (_wr?.qs?.length || 1) + 1;
  const pct = Math.min(100, (done / total) * 100);
  const bar = document.getElementById('wr-prog-bar');
  if (bar) bar.style.width = pct.toFixed(0) + '%';
}

function _wrMsg(text, isUser) {
  const el = document.getElementById('wr-msgs');
  if (!el) return;
  const div = document.createElement('div');
  div.className = isUser ? 'wr-msg wr-msg-user' : 'wr-msg wr-msg-ai';
  div.innerHTML = text.replace(/\n/g,'<br>');
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function _wrChoices(opts) {
  const wrap = document.getElementById('wr-choices');
  if (!wrap) return;
  wrap.classList.remove('hidden');
  wrap.innerHTML = opts.map(o => {
    if (o.action === 'planner') {
      return `<button class="wr-btn" onclick="showPage('planner',null);updateBottomNav('planner')">${o.l}</button>`;
    }
    return `<button class="wr-btn" onclick="_wrAnswer('${o.v}','${o.l.replace(/'/g,'').replace(/"/g,'')}')">${o.l}</button>`;
  }).join('');
}

function _weekStart(offset) {
  const d = new Date(); d.setHours(12,0,0,0);
  d.setDate(d.getDate() - d.getDay() + (offset||0)*7);
  return ld(d);
}

function _needsWeeklyReview() {
  if (!(S.courses || []).length) return false; // No courses set up — send to planner first
  const wr = S.weeklyReview || {};
  if (!wr.lastReviewDate) return true;
  const diffDays = Math.floor((new Date() - new Date(wr.lastReviewDate + 'T12:00')) / (1000 * 60 * 60 * 24));
  return diffDays >= 5;
}



window.openHobbyProgressModal = function(name) {
  const h = S.hobbies.find(x => x.name === name);
  if (!h) return;
  window._hpProgVal = 0; // reset so a fresh modal never submits a stale prior value
  const overlay = document.createElement('div');
  overlay.id = 'hobby-progress-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
  
  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--surface);width:90%;max-width:440px;border-radius:24px;padding:2rem;box-shadow:0 24px 48px rgba(0,0,0,0.2);display:flex;flex-direction:column;gap:1.5rem;animation:slideUpFadeIn 0.3s cubic-bezier(0.34,1.56,0.64,1);max-height:90vh;overflow-y:auto;';
  
  modal.innerHTML = `
    <div style="text-align:center;">
      <div style="width:4.5rem;height:4.5rem;margin:0 auto 1rem;border-radius:20px;background:linear-gradient(135deg, var(--accent), var(--purple));color:white;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 16px rgba(79,110,247,0.3);">
        ${_hobbyEmoji(name)}
      </div>
      <h2 style="font-size:1.6rem;font-weight:900;color:var(--text);margin-bottom:0.25rem;">איך הלך ב${name}?</h2>
      <p style="color:var(--muted);font-size:0.95rem;">שתף אותנו בהתקדמות שלך כדי שנוכל להתאים את המסלול!</p>
    </div>
    
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      <label class="field-label" style="font-weight:800;color:var(--text);font-size:1rem;">1. כמה פעמים התאמנת / תרגלת השבוע?</label>
      <div style="display:flex;gap:0.5rem;justify-content:space-between;">
        ${[0,1,2,3,4,5].map(n => `<button class="hp-prog-btn" onclick="document.querySelectorAll('.hp-prog-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');window._hpProgVal=${n}" style="flex:1;padding:0.85rem 0;border-radius:14px;border:2px solid var(--border);background:transparent;font-weight:800;font-size:1.1rem;cursor:pointer;transition:all 0.2s;">${n}</button>`).join('')}
      </div>
    </div>
    
    <div style="display:flex;flex-direction:column;gap:0.5rem;">
      <label class="field-label" style="font-weight:800;color:var(--text);font-size:1rem;">2. עד כמה היית מרוצה מהביצועים שלך?</label>
      <div style="display:flex;gap:0.5rem;">
        <button class="hp-prog-feel-btn" onclick="document.querySelectorAll('.hp-prog-feel-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');" style="flex:1;padding:0.75rem;border-radius:14px;border:2px solid var(--border);background:transparent;font-weight:800;font-size:0.9rem;cursor:pointer;transition:all 0.2s;">מעולה</button>
        <button class="hp-prog-feel-btn selected" onclick="document.querySelectorAll('.hp-prog-feel-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');" style="flex:1;padding:0.75rem;border-radius:14px;border:2px solid var(--border);background:transparent;font-weight:800;font-size:0.9rem;cursor:pointer;transition:all 0.2s;">סבבה</button>
        <button class="hp-prog-feel-btn" onclick="document.querySelectorAll('.hp-prog-feel-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');" style="flex:1;padding:0.75rem;border-radius:14px;border:2px solid var(--border);background:transparent;font-weight:800;font-size:0.9rem;cursor:pointer;transition:all 0.2s;">היה קשה</button>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:0.5rem;">
      <label class="field-label" style="font-weight:800;color:var(--text);font-size:1rem;">3. מה עזר לך או עיכב אותך השבוע?</label>
      <textarea id="hp-prog-note" placeholder="למשל: עייפות, מוטיבציה גבוהה, חוסר זמן..." style="padding:1rem;border-radius:16px;border:2px solid var(--border);background:var(--bg);font-family:inherit;font-size:0.95rem;font-weight:600;min-height:80px;resize:vertical;"></textarea>
    </div>
    
    <div style="display:flex;flex-direction:column;gap:0.75rem;margin-top:0.5rem;">
      <button class="btn-primary" onclick="submitHobbyProgress('${name}')" style="width:100%;border-radius:16px;padding:1.1rem;font-size:1.15rem;font-weight:900;background:var(--accent);box-shadow:0 8px 24px rgba(79,110,247,0.3);border:none;color:white;">שמור והמשך</button>
      <button class="btn-cancel" onclick="document.getElementById('hobby-progress-overlay').remove()" style="width:100%;font-weight:800;color:var(--muted);background:transparent;border:none;padding:0.75rem;">ביטול</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
};

window.submitHobbyProgress = function(name) {
  const val = window._hpProgVal || 0;
  if (!S.tasks) S.tasks = [];
  const today = typeof ld==='function'?ld(new Date()):new Date().toISOString().split('T')[0];
  const note = document.getElementById('hp-prog-note')?.value || '';
  
  // Add completed pseudo-tasks to simulate progress
  for(let i=0; i<val; i++) {
    S.tasks.push({
      id: typeof uid==='function'?uid():Math.random().toString(),
      name: name, course: name, date: today, time: '12:00', duration: '45 דק',
      done: true, missed: false, notes: note, priority: 'בינוני'
    });
  }
  
  if(typeof save==='function')save();
  document.getElementById('hobby-progress-overlay')?.remove();
  if(typeof toast==='function')toast('ההתקדמות שלך עודכנה! המסלול חושב מחדש.');
  if(typeof renderHobbyPage==='function')renderHobbyPage();
};



function formatPrettyDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${d.getDate()} ב${months[d.getMonth()]} ${d.getFullYear()}`;
}

function _isFirstWeek() {
  return !(S.weeklyReview || {}).lastReviewDate;
}

function renderWRSidebarCard() {
  const card = document.getElementById('wr-sidebar-card');
  const statusEl = document.getElementById('wrs-status');
  const subEl = document.getElementById('wrs-sub');
  const btnEl = document.getElementById('wrs-btn');
  const badgeEl = document.getElementById('wrs-badge');
  if (!card) return;

  const hasCourses = (S.courses || []).length > 0;

  if (!hasCourses) {
    // No courses — direct to planner
    card.onclick = () => { showPage('planner', null); updateBottomNav('planner'); closeSidebar(); };
    if (btnEl) { btnEl.textContent = '▶ הגדר קורסים'; btnEl.onclick = (e) => { e.stopPropagation(); showPage('planner', null); updateBottomNav('planner'); closeSidebar(); }; }
    if (statusEl) statusEl.textContent = 'הגדר קורסים תחילה';
    if (subEl) subEl.textContent = 'כדי לבנות לוז יש להוסיף קורסים במתכנן';
    if (badgeEl) badgeEl.textContent = '';
    card.classList.remove('wrs-done');
    return;
  }

  card.onclick = () => { showPage('weekly-review', null); updateBottomNav('weekly-review'); closeSidebar(); };

  if (_isFirstWeek()) {
    // First time — no lastReviewDate yet
    if (statusEl) statusEl.textContent = 'בנה לוז לשבוע הראשון';
    if (subEl) subEl.textContent = 'לחץ לתכנון השבוע שלך';
    if (btnEl) { btnEl.textContent = '▶ בנה לוז ראשון'; btnEl.onclick = (e) => { e.stopPropagation(); showPage('weekly-review', null); updateBottomNav('weekly-review'); closeSidebar(); }; }
    if (badgeEl) badgeEl.textContent = 'חדש';
    card.classList.remove('wrs-done');
  } else if (_needsWeeklyReview()) {
    // Needs review this week
    if (statusEl) statusEl.textContent = 'זמן לסיכום שבועי';
    if (subEl) subEl.textContent = '3 דקות שמשנות את השבוע הבא';
    if (btnEl) { btnEl.textContent = '▶ בנה לוז עכשיו'; btnEl.onclick = (e) => { e.stopPropagation(); showPage('weekly-review', null); updateBottomNav('weekly-review'); closeSidebar(); }; }
    if (badgeEl) badgeEl.textContent = '!';
    card.classList.remove('wrs-done');
  } else {
    // Done this week
    const range = _wrGetTargetRange();
    if (statusEl) statusEl.textContent = '';
    if (subEl) subEl.textContent = 'לחץ לאפשרויות ועריכה';
    if (btnEl) { btnEl.textContent = '⚙️ פתח אפשרויות'; btnEl.onclick = (e) => { e.stopPropagation(); _wrForceRebuild = false; showPage('weekly-review', null); updateBottomNav('weekly-review'); closeSidebar(); }; }
    if (badgeEl) badgeEl.textContent = '✓';
    card.classList.add('wrs-done');
  }
}

function _wrGetTargetRange() {
  const now = new Date();
  const today = ld(now);
  const dow = now.getDay(); // 0=Sun, 6=Sat

  if (_wrPlanNextWeek || dow === 6) {
    // Next week: from next Sunday to next Saturday
    const daysToNextSun = dow === 0 ? 7 : (7 - dow);
    const nextSun = new Date(now); nextSun.setDate(now.getDate() + daysToNextSun);
    const nextSat = new Date(nextSun); nextSat.setDate(nextSun.getDate() + 6);
    return { start: ld(nextSun), end: ld(nextSat), label: 'שבוע הבא' };
  } else {
    const thisSat = new Date(now); thisSat.setDate(now.getDate() + (6 - dow));
    return { start: today, end: ld(thisSat), label: dow === 0 ? 'שבוע זה' : 'שארית השבוע' };
  }
}

function renderWeeklyReview() {
  const doneEl = document.getElementById('wr-done');
  const activeEl = document.getElementById('wr-active');
  if (!doneEl || !activeEl) return;

  const hasCourses = (S.courses || []).length > 0;

  // No courses yet — redirect to planner with a message
  if (!hasCourses) {
    doneEl.classList.add('hidden');
    activeEl.classList.remove('hidden');
    document.getElementById('wr-msgs').innerHTML = '';
    document.getElementById('wr-choices').innerHTML = '';
    document.getElementById('wr-choices').classList.add('hidden');
    document.getElementById('wr-result').classList.add('hidden');
    _wrProg(0);
    _wrMsg('👋 ברוך הבא לסיכום השבועי!\n\nכדי לבנות לוז, קודם צריך להגדיר קורסים במתכנן.');
    setTimeout(() => {
      _wrChoices([{v:'go', l:'▶ קח אותי למתכנן', action:'planner'}]);
    }, 600);
    return;
  }

  if (!_wrForceRebuild && !_needsWeeklyReview()) {
    const range = _wrGetTargetRange();
    const nd = document.getElementById('wr-range-end');
    if (nd) nd.textContent = range.end;
    doneEl.classList.remove('hidden');
    activeEl.classList.add('hidden');
    renderWRSidebarCard();
    return;
  }
  if (_wrForceRebuild) {
    _wrForceRebuild = false;
    doneEl.classList.add('hidden');
    activeEl.classList.remove('hidden');
    _wrInit();
    return;
  }
  
  doneEl.classList.add('hidden');
  activeEl.classList.remove('hidden');
  _wrInit();
}

async function _wrGenerate() {
  if (!(S.courses || []).length) {
    _wrMsg('⚠️ אין קורסים — <button class="wr-btn-inline" onclick="showPage(\'exams\',null)">הוסף קורס</button> כדי לייצר לו"ז');
    return;
  }
  _wrMsg('⏳ מחשב לו"ז מותאם אישית (ללא צורך באינטרנט)...');
  _wrProg((_wr.qs.length||1) + 1);

  const _hobbyBackup = {};
  try {
    const load = _wr.answers.load || 'ok';
    const courseDifficulty = {};
    Object.keys(_wr.answers.courses || {}).forEach(c => {
      const feel = _wr.answers.courses[c].feel;
      courseDifficulty[c] = feel === 'hard' ? 5 : feel === 'easy' ? 1 : 3;
    });
    // Temporarily adjust hobby timesPerWeek based on weekly check-in feedback
    const hobbyCheckins = _wr.answers.hobbies || {};
    (S.hobbies || []).forEach(h => {
      const ci = hobbyCheckins[h.id];
      if (!ci) return;
      const planned = h.timesPerWeek || 3;
      const feel = ci.feel;
      const done = ci.sessions;
      let adj = planned;
      if (feel === 'hard') adj = Math.max(1, planned - 1);
      else if (feel === 'great' && done >= planned) adj = Math.min(planned + 1, 7);
      else if (done < planned - 1) adj = Math.max(1, planned - 1);
      if (adj !== planned) { _hobbyBackup[h.id] = planned; h.timesPerWeek = adj; }
    });
    const selectedHobbies = (S.hobbies || []).map(h => h.name);
    
    // Pass pending homework
    const homework = (S.homework || []).filter(h => !h.done);

    const loadMap = { min: 'light', ok: 'balanced', max: 'heavy' };

    const range = _wrGetTargetRange();
    const { tasks, stats } = generateWeeklySchedule({
    load: loadMap[load] || 'balanced',
    courseDifficulty,
    selectedHobbies,
    homework,
    startDate: range.start,
    endDate: range.end
  });

    // Restore original timesPerWeek values after generation
    (S.hobbies || []).forEach(h => { if (_hobbyBackup[h.id] !== undefined) h.timesPerWeek = _hobbyBackup[h.id]; });

    if (!tasks || !tasks.length) {
      if (stats && stats.reason === 'no_time') throw new Error('אין מספיק זמן פנוי השבוע. נסה להוריד עוגנים.');
      throw new Error('שגיאה ביצירת הלו"ז. נסה לשנות שעות לימוד.');
    }

    _wr.pendingPlan = tasks;
    _wrShowPreview(_wr.pendingPlan);
  } catch(e) {
    (S.hobbies || []).forEach(h => { if (_hobbyBackup[h.id] !== undefined) h.timesPerWeek = _hobbyBackup[h.id]; });
    _wrMsg('שגיאה: ' + e.message + ' <button class="wr-btn-inline" onclick="_wrGenerate()">נסה שוב</button>');
  }
}


function _wrInit() {
  const hobbyNames = new Set((S.hobbies||[]).map(h=>h.name));
  const firstWeek = _isFirstWeek();

  const coursesLastWeek = [...new Set(
    (S.courses || []).map(c => c.name).filter(n => n && !hobbyNames.has(n))
  )];
  const activeHobbies = S.hobbies || [];

  const qs = [];
  // Always ask which week to plan (unless first week where only current makes sense)
  if (!firstWeek) {
    qs.push({ type: '_week_choice' });
    coursesLastWeek.forEach(c => qs.push({ type:'course_feel', c }));
    // Hobby check-ins for hobbies not checked in for 6+ days
    activeHobbies.forEach(h => {
      const daysSince = h.lastCheckIn
        ? Math.floor((Date.now() - new Date(h.lastCheckIn).getTime()) / 86400000) : 999;
      if (daysSince >= 6) qs.push({ type: 'hobby_checkin', hobby: h });
    });
    qs.push({ type: 'homework_check' });
  }
  qs.push({ type:'goal' });

  _wrPlanNextWeek = false; // reset
  _wr = { qs, qi: 0, answers: { courses:{}, load:null }, coursesLastWeek, activeHobbies, pendingPlan: null };

  const wrMsgsEl = document.getElementById('wr-msgs');
  wrMsgsEl.innerHTML = '';
  wrMsgsEl.classList.remove('hidden');
  document.getElementById('wr-choices').innerHTML = '';
  document.getElementById('wr-choices').classList.add('hidden');
  document.getElementById('wr-result').classList.add('hidden');
  _wrProg(0);

  // Summarize deleted collisions from the past 7 days
  const weekAgo = new Date(Date.now() - 7*86400000).toISOString();
  const recentDeleted = (S.deletedCollisions||[]).filter(d => d.deletedAt >= weekAgo);
  if (recentDeleted.length > 0) {
    const byCourse = {};
    recentDeleted.forEach(d => { byCourse[d.course] = (byCourse[d.course]||0) + 1; });
    const summary = Object.entries(byCourse).map(([c,n]) => `${c} (${n})`).join(', ');
    _wr.deletedCollisionSummary = `⚠️ השבוע נמחקו ${recentDeleted.length} משימות בגלל התנגשות עם עוגנים: ${summary}`;
    // Clear old entries after noting them
    S.deletedCollisions = (S.deletedCollisions||[]).filter(d => d.deletedAt < weekAgo);
    save();
  }

  if (firstWeek) {
    const range = _wrGetTargetRange();
    _wrMsg(`שלום ${S.userName}! \nברוך הבא — נבנה יחד את לוז השבוע הראשון שלך (${range.start} – ${range.end}).`);
  } else {
    const deletedNote = _wr.deletedCollisionSummary ? `\n\n${_wr.deletedCollisionSummary}` : '';
    _wrMsg(`שלום ${S.userName}!${deletedNote}`);
  }
  setTimeout(() => _wrNext(), 700);
}

function _wrNext() {
  if (_wr.qi >= _wr.qs.length) { _wrGenerate(); return; }
  const q = _wr.qs[_wr.qi];

  if (q.type === '_week_choice') {
    _wrMsg(`זמן לתכנן — לאיזה שבוע נרצה לבנות לו"ז?`);
    const nowDow = new Date().getDay();
    const nextSun = new Date(); nextSun.setDate(nextSun.getDate() + (nowDow === 0 ? 7 : 7 - nowDow));
    const nextSat = new Date(nextSun); nextSat.setDate(nextSun.getDate() + 6);
    const thisSat = new Date(); thisSat.setDate(thisSat.getDate() + (6 - nowDow));
    const fmt = d => String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0');
    const thisRange = `עד ה-${fmt(thisSat)}`;
    const nextRange = `${fmt(nextSun)} - ${fmt(nextSat)}`;
    _wrChoices([
      { v: 'current', l: `📅 שבוע נוכחי (${thisRange})` },
      { v: 'next', l: `📅 שבוע הבא (${nextRange})` },
    ]);
  } else if (q.type === 'course_feel') {
    const weekAgo2 = new Date(Date.now() - 7*86400000).toISOString();
    const courseDeleted = (S.deletedCollisions||[]).filter(d => d.course === q.c && d.deletedAt >= weekAgo2).length;
    const deletedNote = courseDeleted > 0 ? `\n⚠️ השבוע נמחקו ${courseDeleted} משימות מ-${q.c} בגלל התנגשות עם עוגנים` : '';
    _wrMsg(` <b>${q.c}</b> — איך הרגשת השבוע בקורס?${deletedNote}`);
    _wrChoices([
      {v:'easy', l:'😎 קל - הכל מובן (פחות שעות)'},
      {v:'ok', l:'😐 רגיל - קצב סבבה'},
      {v:'hard', l:'😤 קשה - צריך להשקיע יותר שעות'}
    ]);
  } else if (q.type === 'homework_check') {
    const hwCount = (S.homework||[]).filter(h => !h.done).length;
    _wrMsg(` המערכת מזהה <b>${hwCount} מטלות פתוחות</b> שיושבצו השבוע לפי תאריך הגשה.\nהאם יש מטלות נוספות ששכחת להכניס למערכת?`);
    _wrChoices([
      {v:'no', l:'✅ לא, הכל מעודכן. המשך!'},
      {v:'yes', l:'✏️ רגע, אני אעדכן בעמוד המטלות', hwaction: true}
    ]);
  } else if (q.type === 'hobby_checkin') {
    const h = q.hobby;
    const planned = h.timesPerWeek || 3;
    _wrMsg(` <b>${h.name}</b> — כמה פעמים התאמנת השבוע? (תכננת ${planned})`);
    const opts = [];
    for (let i = 0; i <= Math.max(planned + 1, 5); i++) {
      opts.push({ v: String(i), l: i === 0 ? '0 — לא הצלחתי השבוע' : i === planned ? `${i} ✓ כמו שתכננתי` : String(i) });
    }
    _wrChoices(opts);
  } else if (q.type === 'hobby_checkin_feel') {
    _wrMsg(` <b>${q.hobby.name}</b> — איך הרגשת עם זה השבוע?`);
    _wrChoices([
      {v:'great', l:'💪 מעולה — אני בכושר'},
      {v:'ok',    l:'😐 בסדר — ממוצע'},
      {v:'hard',  l:'😓 קשה — צריך להפחית קצת'}
    ]);
  } else if (q.type === 'goal') {
    _wrMsg(` מה עומס הלמידה הכללי שתרצה בשבוע הקרוב?`);
    _wrChoices([
      {v:'min', l:'🎯 מינימום — רק מה שחייב'},
      {v:'ok',  l:'📚 בינוני — קצב רגוע ומאוזן'},
      {v:'max', l:'🔥 מקסימום — ניצול מלא'}
    ]);
  }
}

function _wrAnswer(v, l) {
  const q = _wr.qs[_wr.qi];
  document.getElementById('wr-choices').querySelectorAll('button').forEach(b=>b.disabled=true);
  _wrMsg(l, true);
  document.getElementById('wr-choices').classList.add('hidden');

  // Dislike adjustment flow
  if (q.type === '_adjust' || q.type === '_adjust_time' || q.type === '_adjust_course') {
    _wrAdjustAnswer(v);
    return;
  }

  // Week choice
  if (q.type === '_week_choice') {
    _wrPlanNextWeek = (v === 'next');
    const range = _wrGetTargetRange();
    _wrMsg(` נתכנן עבור ${range.label}: ${range.start} – ${range.end}`);
    _wr.qi++;
    setTimeout(() => _wrNext(), 500);
    return;
  }

  if (q.type === 'homework_check' && v === 'yes') {
    setTimeout(() => {
      _wrForceRebuild = true;
      showPage('homework', null); updateBottomNav('homework');
    }, 1000);
    return;
  }

  if (q.type === 'course_feel') {
    if(!_wr.answers.courses[q.c]) _wr.answers.courses[q.c] = {};
    _wr.answers.courses[q.c].feel = v;
  } else if (q.type === 'hobby_checkin') {
    if (!_wr.answers.hobbies) _wr.answers.hobbies = {};
    _wr.answers.hobbies[q.hobby.id] = { sessions: parseInt(v, 10), hobby: q.hobby };
    // Insert feel follow-up question right after this one
    _wr.qs.splice(_wr.qi + 1, 0, { type: 'hobby_checkin_feel', hobby: q.hobby });
  } else if (q.type === 'hobby_checkin_feel') {
    if (!_wr.answers.hobbies) _wr.answers.hobbies = {};
    if (!_wr.answers.hobbies[q.hobby.id]) _wr.answers.hobbies[q.hobby.id] = { sessions: 0, hobby: q.hobby };
    _wr.answers.hobbies[q.hobby.id].feel = v;
    // Update hobby state immediately
    const hobby = (S.hobbies || []).find(h => h.id === q.hobby.id);
    if (hobby) {
      hobby.lastCheckIn = ld(new Date());
      const report = { date: ld(new Date()), sessions: _wr.answers.hobbies[q.hobby.id].sessions, feel: v };
      if (!hobby.weeklyReports) hobby.weeklyReports = [];
      hobby.weeklyReports.push(report);
      save();
    }
  } else if (q.type === 'goal') {
    _wr.answers.load = v;
  }

  _wr.qi++;
  _wrProg((_wr.qi / _wr.qs.length) * 100);
  setTimeout(() => _wrNext(), 500);
}

function _buildPerformanceInsights(courses) {

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = ld(cutoff);
  const insights = {};
  courses.forEach(c => {
    const ct = (S.tasks||[]).filter(t => t.course === c && t.date >= cutoffStr);
    const total = ct.length;
    const missed = ct.filter(t => t.missed).length;
    const rated = ct.filter(t => t.rating != null && !t.missed);
    const avgRating = rated.length ? rated.reduce((s,t)=>s+(t.rating||3),0)/rated.length : null;
    const missRate = total ? missed / total : 0;
    const slotMisses = {};
    ct.filter(t=>t.missed && t.time).forEach(t=>{ slotMisses[t.time]=(slotMisses[t.time]||0)+1; });
    const problemSlots = Object.entries(slotMisses).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([s])=>s);
    insights[c] = { total, missed, missRate, avgRating, problemSlots };
  });
  return insights;
}

function _calcStudyAllocation(freeMinutes, answers, exams, insights, sessionMins) {
  const goal = answers.goal || 'ok';
  const load = answers.load || 'ok';
  let loadPct = goal === 'min' ? 0.40 : goal === 'ok' ? 0.62 : 0.83;
  if (load === 'heavy') loadPct = Math.max(0.30, loadPct - 0.10);
  if (load === 'light') loadPct = Math.min(0.90, loadPct + 0.08);
  const studyMinutes = Math.round(freeMinutes * loadPct);
  const restMinutes = freeMinutes - studyMinutes;
  const sm = sessionMins || 60;

  const allCourses = [...new Set([
    ...Object.keys(answers.courses || {}),
    ...(S.courses||[]).map(c=>c.name)
  ])].filter(Boolean);
  if (!allCourses.length) return { studyMinutes, loadPct, restMinutes, allocations: {} };

  const weights = {};
  allCourses.forEach(c => {
    let w = 1.0;
    const exam = exams.find(e => e.c === c);
    if (exam) {
      if      (exam.days <= 5)  w *= 3.0;
      else if (exam.days <= 14) w *= 2.0;
      else if (exam.days <= 30) w *= 1.5;
    }
    const ins = insights[c];
    if (ins) {
      if (ins.avgRating !== null && ins.avgRating < 2.5) w *= 1.4;
      if (ins.missRate > 0.4) w *= 1.3;
      if (ins.avgRating !== null && ins.avgRating > 4.0 && ins.missRate < 0.1) w *= 0.7;
    }
    const ca = answers.courses?.[c];
    if (ca) {
      if      (ca.u === 'hard' && ca.cov === 'little') w *= 1.5;
      else if (ca.u === 'hard')                         w *= 1.25;
      else if (ca.u === 'good' && ca.cov === 'all')     w *= 0.6;
      if      (ca.mat === 'lots')   w *= 1.2;
      else if (ca.mat === 'little') w *= 0.8;
    }
    if (answers.priority && answers.priority !== 'balanced' && answers.priority === c) w *= 1.4;
    weights[c] = Math.max(0.1, w);
  });

  const urgentExam = exams.find(e => e.days <= 5);
  const allocations = {};

  if (urgentExam) {
    const uc = urgentExam.c;
    const urgentMins = Math.round(studyMinutes * 0.60);
    const remaining = studyMinutes - urgentMins;
    const others = allCourses.filter(c => c !== uc);
    const otherW = others.reduce((s,c)=>s+(weights[c]||1),0)||1;
    others.forEach(c => {
      const mins = Math.round((weights[c]/otherW)*remaining);
      allocations[c] = { minutes: mins, sessions: Math.max(1, Math.round(mins/sm)) };
    });
    allocations[uc] = { minutes: urgentMins, sessions: Math.max(1, Math.round(urgentMins/sm)) };
  } else {
    const totalW = Object.values(weights).reduce((s,w)=>s+w,0)||1;
    allCourses.forEach(c => {
      const mins = Math.round((weights[c]/totalW)*studyMinutes);
      allocations[c] = { minutes: mins, sessions: Math.max(1, Math.round(mins/sm)) };
    });
  }

  return { studyMinutes, loadPct, restMinutes, allocations };
}

function _buildSchedulingRules(profile, answers) {
  const p = profile || {};
  const load = answers.load;
  const goal = answers.goal;
  const rules = [];

  // ── 1. SESSION LENGTH ──
  let sessionMins = 60;
  if (p.focus_span) {
    if      (p.focus_span.includes('25'))                                      sessionMins = 25;
    else if (p.focus_span.match(/30|40|45/))                                   sessionMins = 40;
    else if (p.focus_span.match(/60|75/))                                      sessionMins = 65;
    else if (p.focus_span.includes('90'))                                      sessionMins = 90;
  }
  // Double-block only for short spans + non-min goal (2×block + 10min break fits in one 90-min slot)
  const canDouble = sessionMins <= 45;
  let taskDuration = sessionMins;
  if (canDouble && goal === 'max') taskDuration = sessionMins * 2 + 10;
  else if (canDouble && goal === 'ok') taskDuration = sessionMins * 2 + 10;
  const durationDesc = (canDouble && goal !== 'min')
    ? `${taskDuration} דק' (2×${sessionMins} + 10 מנוחה)` : `${taskDuration} דק'`;
  rules.push(`⏱ משך כל משימה: ${durationDesc}`);

  // ── 2. TASKS PER DAY — concrete numbers ──
  let tMin = 1, tMax = 2;
  if      (goal === 'max' && load !== 'heavy') { tMin = 2; tMax = 3; }
  else if (goal === 'ok'  && load !== 'heavy') { tMin = 1; tMax = 2; }
  else if (goal === 'min' || load === 'heavy') { tMin = 0; tMax = 1; }
  if (load === 'light' && goal !== 'min') tMax = Math.min(tMax + 1, 4);
  rules.push(` כמות ביום: ${tMin}–${tMax} משימות לימוד (לא יותר מ-${tMax}!)`);
  if (load === 'heavy') rules.push('⚡ שבוע כבד: הפסקה של חלון אחד לפחות בין משימות באותו יום');
  else if (load === 'light') rules.push('😴 שבוע קל: המשתמש מסוגל ליותר — ניתן להוסיף');

  // ── 3. PEAK SLOTS ──
  let peakSlots = ['10:00','11:00'];
  let offPeakSlots = ['14:00','15:00'];
  if (p.focus_time) {
    if (p.focus_time.match(/בוקר|06|07|08/)) {
      peakSlots = ['08:00','09:00','10:00']; offPeakSlots = ['14:00','15:00','16:00'];
      rules.push('🌅 פיק: 08:00–10:00 → קורסים קשים/עדיפים | 14:00+ → חזרות וחומר קל');
    } else if (p.focus_time.match(/צהריים|10|11|12/)) {
      peakSlots = ['11:00','12:00','13:00']; offPeakSlots = ['08:00','17:00','18:00'];
      rules.push('☀️ פיק: 11:00–13:00 → קורסים קשים | בוקר ו-17:00+ → חזרות');
    } else if (p.focus_time.match(/אחה"צ|14|15|16/)) {
      peakSlots = ['14:00','15:00','16:00']; offPeakSlots = ['08:00','09:00','19:00'];
      rules.push(' פיק: 14:00–16:00 → קורסים קשים | בוקר → חזרות וחומר קל');
    } else if (p.focus_time.match(/ערב|17|18|19|20/)) {
      peakSlots = ['18:00','19:00']; offPeakSlots = ['08:00','09:00','14:00'];
      rules.push(' פיק: 18:00–19:00 → קורסים קשים | בוקר → חומר קל בלבדק');
    }
  }

  // ── 4. LEARNING STYLE → task types ──
  let taskTypes = ['לימוד — [קורס]','חזרה — [קורס]'];
  if (p.style) {
    if (p.style.match(/תרגיל|פתרון|/)) {
      taskTypes = ['פתרון תרגילים — [קורס]','תרגול שאלות — [קורס]','חזרה על תרגילים — [קורס]'];
      rules.push(' שמות: "פתרון תרגילים / תרגול שאלות / חזרה על תרגילים"');
    } else if (p.style.match(/קריאה|סיכום|/)) {
      taskTypes = ['קריאה וסיכום — [קורס]','עיון בחומר — [קורס]','סיכום פרק — [קורס]'];
      rules.push(' שמות: "קריאה וסיכום / עיון בחומר / סיכום פרק"');
    } else if (p.style.match(/האזנה|וידאו|/)) {
      taskTypes = ['צפייה בהרצאה — [קורס]','האזנה וסיכום — [קורס]','סיכום הרצאה — [קורס]'];
      rules.push(' שמות: "צפייה בהרצאה / האזנה וסיכום / סיכום הרצאה"');
    } else if (p.style.match(/הסבר|/)) {
      taskTypes = ['הסבר לעצמי — [קורס]','שאלות עצמיות — [קורס]','הרצאה עצמית — [קורס]'];
      rules.push(' שמות: "הסבר לעצמי / שאלות עצמיות / הרצאה עצמית"');
    }
  }

  // ── 5. EXAM FEAR → extra task types ──
  if (p.exam_fear) {
    if (p.exam_fear.match(/לשכוח|לחץ|/)) {
      taskTypes.push('חזרה מרווחת — [קורס]');
      rules.push(' חשש שכחה: כל 2 משימות רגילות → הוסף "חזרה מרווחת — [קורס]"');
    } else if (p.exam_fear.match(/לסיים|⏰/)) {
      rules.push(' חשש לא לסיים: כסה חומר ליניארית (פרק 1→2→3), לא לדלג לחזרות לפני שסיימת החומר');
    } else if (p.exam_fear.match(/מפתיע|שאלות|/)) {
      taskTypes.push('פתרון מבחנים ישנים — [קורס]');
      rules.push(' חשש שאלות מפתיעות: כל 3 משימות → "פתרון מבחנים ישנים — [קורס]"');
    } else if (p.exam_fear.match(/להבין|/)) {
      taskTypes.push('הסבר בקול — [קורס]');
      rules.push(' חשש הבנה: לקורסים קשים הוסף "הסבר בקול — [קורס]" פעם בשבוע');
    }
  }

  return { rules, taskDuration, tMin, tMax, peakSlots, offPeakSlots, taskTypes, sessionMins };
}

function _buildCourseAdjustments(answers) {
  return Object.entries(answers.courses || {}).map(([c, a]) => {
    const u = a.u; const cov = a.cov; const mat = a.mat;
    let line = '';
    if      (u === 'hard'  && cov === 'little') line = ` ${c}: 3-4 משימות השבוע, שים בשעות פיק, התחל מבסיסים`;
    else if (u === 'hard'  && cov === 'some')   line = `️ ${c}: +40% משימות, חזרה על מה שלא ברור, שעות פיק`;
    else if (u === 'hard'  && cov === 'all')    line = ` ${c}: חומר מכוסה אבל קשה — חזרות ותרגול בלבד`;
    else if (u === 'ok'    && cov === 'little') line = ` ${c}: כסה פרקים חסרים תחילה, +20% משימות`;
    else if (u === 'ok'    && cov === 'some')   line = ` ${c}: קצב רגיל`;
    else if (u === 'ok'    && cov === 'all')    line = ` ${c}: מכוסה — חזרות תחזוקה בלבד, -10% משימות`;
    else if (u === 'good'  && cov === 'little') line = ` ${c}: מרגיש טוב אך לא כיסה — כסה חומר חדש, לא חזרות`;
    else if (u === 'good'  && cov === 'some')   line = ` ${c}: מסתדר — -20% משימות`;
    else if (u === 'good'  && cov === 'all')    line = ` ${c}: שולט — 1-2 משימות תחזוקה בלבד`;
    if (!line) return null;
    if (mat === 'lots')   line += ' | חומר שנשאר: הרבה → לחץ על כיסוי חומר חדש';
    else if (mat === 'little') line += ' | חומר שנשאר: מעט → עבור לחזרות ותרגול';
    return `• ${line}`;
  }).filter(Boolean).join('\n') || '• תכנון סטנדרטי';
}

function _wrShowPreview(tasks) {
  const prev = document.getElementById('wr-preview');
  if (!prev) return;
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const byDate = {};
  tasks.forEach(t => { if(!byDate[t.date]) byDate[t.date]=[]; byDate[t.date].push(t); });

  // Inject anchor blocks into the same day buckets
  const range = _wrGetTargetRange();
  const rangeStart = new Date(range.start + 'T00:00');
  const rangeEnd   = new Date(range.end   + 'T23:59');
  (S.anchors || []).forEach(a => {
    const cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      if (cur.getDay() === a.day) {
        const dateStr = ld(cur);
        if (!byDate[dateStr]) byDate[dateStr] = [];
        byDate[dateStr].push({ date: dateStr, time: a.start, end: a.end, name: a.name, course: '', duration: '', _anchor: true, color: a.color || 'var(--accent)' });
      }
      cur.setDate(cur.getDate() + 1);
    }
  });

  prev.innerHTML = Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,ts]) => {
    const dow = dayNames[new Date(date+'T12:00').getDay()];
    const sorted = ts.slice().sort((a,b) => (a.time||'').localeCompare(b.time||''));
    return `<div class="wr-day-group">
      <div class="wr-day-label">${dow} · ${date}</div>
      ${sorted.map(t => {
        if (t._anchor) {
          return `<div class="wr-task-row wr-anchor-row">
            <span class="wr-task-time">${t.time} - ${t.end}</span>
            <span class="wr-anchor-dot" style="background:${t.color}"></span>
            <span class="wr-task-name" style="flex:1;text-align:right;color:var(--muted)">${t.name}</span>
           </div>`;
        }
        const dur = parseInt(String(t.duration||'').match(/\d+/)?.[0] || 60);
        const endStr = minsToTime(timeToMins(t.time) + dur);
        return `<div class="wr-task-row">
            <span class="wr-task-time">${t.time} - ${endStr}</span>
            <span class="wr-task-name" style="flex:1;text-align:right;margin-right:1rem">${t.course}${t.name !== t.course ? ` - ${t.name}` : ''}</span>
           </div>`;
      }).join('')}
    </div>`;
  }).join('');

  const actionsEl = document.getElementById('wr-result-actions');
  if (actionsEl) actionsEl.innerHTML = `
    <button class="wr-confirm-btn" onclick="confirmWeeklyPlan()"> אשר ובנה את השבוע</button>
    <button class="btn-sm" style="background:var(--yellow-light);color:var(--yellow);border:1px solid var(--yellow);" onclick="_wrDislikeFlow()"> לא אהבתי — שנה את הלוז</button>
    <button class="btn-sm" onclick="_wrInit()">← שאלות מחדש</button>
  `;

  document.getElementById('wr-msgs').classList.add('hidden');
  document.getElementById('wr-result').classList.remove('hidden');
  document.getElementById('wr-result').scrollIntoView({behavior:'smooth'});
}

function _wrDislikeFlow() {
  document.getElementById('wr-result').classList.add('hidden');
  _wrMsg(' בסדר! בוא נשפר את הלוז. מה לא אהבת?');
  setTimeout(() => {
    _wrChoices([
      { v: 'too_heavy', l: ' יש יותר מדי משימות ביום' },
      { v: 'bad_time', l: '⏰ השעות לא מתאימות לי' },
      { v: 'want_course', l: ' רוצה להתמקד בקורס מסוים' },
      { v: 'more_hobbies', l: ' רוצה יותר זמן לתחביבים' },
      { v: 'too_light', l: ' רוצה יותר שעות לימוד' },
    ]);
    _wr.qs.push({ type: '_adjust' });
    _wr.qi = _wr.qs.length - 1;
  }, 400);
}

function _wrAdjustAnswer(v) {
  document.getElementById('wr-choices').querySelectorAll('button').forEach(b => b.disabled = true);
  document.getElementById('wr-choices').classList.add('hidden');

  if (v === 'too_heavy') {
    _wr.answers.load = 'min';
    _wrMsg(' הבנתי! יוצר לוז קל יותר עם פחות משימות ביום...');
  } else if (v === 'bad_time') {
    _wrMsg('⏰ מתי עדיף לך ללמוד?');
    setTimeout(() => {
      _wrChoices([
        { v: 'adj_morning', l: ' בוקר (08:00–11:00)' },
        { v: 'adj_noon', l: '️ צהריים (11:00–14:00)' },
        { v: 'adj_afternoon', l: ' אחה"צ (14:00–18:00)' },
        { v: 'adj_evening', l: '🌙 ערב (18:00+)' },
      ]);
      _wr.qs.push({ type: '_adjust_time' });
      _wr.qi = _wr.qs.length - 1;
    }, 400);
    return;
  } else if (v === 'want_course') {
    const courseNames = (S.courses || []).map(c => c.name);
    if (!courseNames.length) {
      _wrMsg('אין קורסים מוגדרים. הוסף קורסים במתכנן תחילה.');
      setTimeout(() => _wrGenerate(), 800);
      return;
    }
    _wrMsg('📚 איזה קורס חשוב לך במיוחד השבוע?');
    // Store course names for lookup by index to avoid special-char issues in onclick attrs
    _wr._adjustCourses = courseNames;
    setTimeout(() => {
      _wrChoices(courseNames.map((c, i) => ({ v: 'focus_idx_' + i, l: c })));
      _wr.qs.push({ type: '_adjust_course' });
      _wr.qi = _wr.qs.length - 1;
    }, 400);
    return;
  } else if (v === 'more_hobbies') {
    _wr.answers._hobbyBoost = true;
    _wrMsg('🏃 מגביר את זמן התחביבים בלוז...');
  } else if (v === 'too_light') {
    _wr.answers.load = 'max';
    _wrMsg('📈 מוסיף יותר שעות לימוד...');
  } else if (v.startsWith('adj_')) {
    const timeMap = { adj_morning: 'בוקר', adj_noon: 'צהריים', adj_afternoon: 'אחה"צ', adj_evening: 'ערב' };
    if (!S.profile) S.profile = {};
    S.profile.focus_time = timeMap[v] || S.profile.focus_time;
    _wrMsg(` קיבלתי! אתזמן משימות ב${timeMap[v]}.`);
  } else if (v.startsWith('focus_idx_')) {
    const idx = parseInt(v.replace('focus_idx_', ''));
    const course = (_wr._adjustCourses || [])[idx];
    if (course) {
      if (!_wr.answers.courses) _wr.answers.courses = {};
      if (!_wr.answers.courses[course]) _wr.answers.courses[course] = {};
      _wr.answers.courses[course].feel = 'hard';
      _wrMsg(` מתמקד ב-${course} ומוסיף לו יותר שעות...`);
    }
  }

  setTimeout(() => _wrGenerate(), 900);
}

function confirmWeeklyPlan() {
  try {
  if (!_wr?.pendingPlan?.length) { toast('לא נמצאה תוכנית לאישור'); return; }
  const range = _wrGetTargetRange();
  const today = ld(new Date());
  // Anchor-overlap safety predicate (true => task collides with an anchor)
  const _collidesAnchor = (t) => {
    const tStart = timeToMins(t.time);
    const tDur = parseInt(String(t.duration || '60').match(/\d+/)?.[0] || 60);
    const tEnd = tStart + tDur;
    const dayIdx = new Date(t.date + 'T12:00').getDay();
    return (S.anchors || []).some(a => {
      if (parseInt(a.day) !== dayIdx) return false;
      if (a.endDate && t.date > a.endDate) return false;
      if (a.oneTimeDate && a.oneTimeDate !== t.date) return false;
      const aStart = timeToMins(a.start) - (a.travelMin || 0);
      const aEnd = timeToMins(a.end) + (a.travelMin || 0);
      return tStart < aEnd && tEnd > aStart;
    });
  };
  // Build new tasks in a temp array and run the safety filter on THEM only
  const newTasks = _wr.pendingPlan
    .map(t => ({...t, id:uid(), name: t.course || t.name, done:false, missed:false}))
    .filter(t => !_collidesAnchor(t));
  // Abort/restore: if every new task was filtered out, don't wipe the existing week
  if (!newTasks.length) {
    toast('כל המשימות החדשות מתנגשות בעוגנים — התוכנית לא שונתה');
    return;
  }
  const addedCount = newTasks.length;
  // Now safe to remove undone in-range tasks and commit the new ones
  S.tasks = S.tasks.filter(t => !(t.date >= range.start && t.date <= range.end && !t.done));
  newTasks.forEach(t => S.tasks.push(t));
  _wr.pendingPlan = [];
  // Record review
  if (!S.weeklyReview) S.weeklyReview = { lastReviewDate:null, history:[] };
  S.weeklyReview.lastReviewDate = today;
  S.weeklyReview.history = [...(S.weeklyReview.history||[]).slice(-10),
    { date:today, answers:_wr.answers, added:addedCount }];
  save(); renderAll();
  toast(` ${range.label} תוכנן! ${addedCount} משימות נוספו ללו"ז`);
  renderWeeklyReview();
  } catch(e) { toast('שגיאה: ' + e.message); console.error('confirmWeeklyPlan error:', e); }
}

async function sendRecalc() {
  const inp = document.getElementById('recalc-input'); if (!inp) return; const msg = inp.value.trim(); if(!msg) return; inp.value = '';
  const chat = document.getElementById('recalc-chat');
  chat.innerHTML += `<div class="chat-msg user"><div class="chat-bubble">${escapeHtml(msg)}</div></div><div class="chat-msg ai" id="recalc-loading"><div class="chat-bubble"><span class="ai-thinking">מחשב אופטימיזציה...</span></div></div>`;
  chat.scrollTop = chat.scrollHeight;

  recalcHistory.push({role: 'user', content: msg});
  if(recalcHistory.length > 15) recalcHistory = [recalcHistory[0], ...recalcHistory.slice(-14)];

  const todayStr = ld(new Date());
  const examsTxt = S.exams.map(e => `${e.course}: ${e.date}`).join(', ');
  
  const ruleReminder = `היום: ${todayStr}. מבחנים: ${examsTxt||'אין'}. אתה עונה ב-JSON בלבד! פורמט: {"reply":"הטקסט שלך","actions":{"add":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"שם","name":"שם הקורס","duration":"60 דק'","priority":"בינוני"}],"delete":["ID"],"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}]}}`;

  try {
    const _content3 = await callAI({ messages: [...recalcHistory, {role:'system', content:ruleReminder}], temperature: 0.3, json: true });
    let parsed;
    try {
      parsed = extractJSON(_content3);
    } catch(_) {
      // AI returned plain text instead of JSON — treat as a reply
      parsed = { reply: _content3 };
    }
    recalcHistory.push({role: 'assistant', content: parsed.reply || _content3 || ''});

    let updated = false;
    if(parsed.actions) {
        if(Array.isArray(parsed.actions.delete)) { S.tasks = S.tasks.filter(t => !parsed.actions.delete.includes(String(t.id))); updated = true; }
        if(Array.isArray(parsed.actions.update)) { parsed.actions.update.forEach(u => { const t = S.tasks.find(x => String(x.id) === String(u.id)); if(t) { if(u.date) t.date = u.date; if(u.time) t.time = u.time; updated = true; } }); }
    }
    if(updated){ save(); renderAll(); }
    document.getElementById('recalc-loading')?.remove();
    chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${escapeHtml(parsed.reply||'').replace(/\n/g,'<br>')}</div></div>`;
    if(parsed.actions && Array.isArray(parsed.actions.add) && parsed.actions.add.length > 0) {
        parsed.actions.add = parsed.actions.add.map(t => ({...t, name: t.course || t.name}));
        pendingRecalcActions = parsed.actions.add;
        const addList = parsed.actions.add.map(t => `• <b>${escapeHtml(t.course||t.name||'משימה')}</b> — ${escapeHtml(t.date||'')} ${escapeHtml(t.time||'')}`).join('<br>');
        const cid = 'rc-' + Date.now();
        chat.innerHTML += `<div class="chat-msg ai" id="${cid}"><div class="chat-bubble" style="background:linear-gradient(135deg,var(--green-light),var(--accent-light));border:2px solid var(--green);padding:1rem 1.1rem;border-radius:14px">
             <b>הצעה להוספה ללו"ז:</b><br><br>${addList}<br><br>
            <div style="display:flex;gap:0.5rem;margin-top:0.75rem;justify-content:flex-end;flex-wrap:wrap">
                <button onclick="document.getElementById('${cid}').remove();pendingRecalcActions=null;toast('הצעה נדחתה ')" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:0.4rem 0.9rem;border-radius:8px;font-weight:700;cursor:pointer;font-family:var(--sans);font-size:0.82rem"> בטל</button>
                <button onclick="applyPendingRecalcActions('${cid}')" style="background:var(--green);color:white;border:none;padding:0.4rem 0.9rem;border-radius:8px;font-weight:700;cursor:pointer;font-family:var(--sans);font-size:0.82rem"> הוסף ללו"ז</button>
            </div>
        </div></div>`;
    } else if(updated) {
        toast(' הלו"ז תוקן וסודר על ידי ה-AI!');
        _appendQuickReplies(chat, [
          { label: 'הצג מה שונה', text: 'מה בדיוק שינית עכשיו?' },
          { label: 'בטל שינויים', text: 'בטל את השינויים האחרונים והחזר כמו שהיה', cls: 'red' },
          { label: 'תודה ', text: 'תודה, סגור', cls: 'muted' }
        ]);
    } else {
        // No changes — offer contextual quick replies
        const replyLower = (parsed.reply||'').toLowerCase();
        const chips = [
          { label: 'הזז ליום הבא', text: 'הזז את המשימות המתנגשות ליום הבא' },
          { label: 'אחרי העוגן', text: 'קבע אותן מיד אחרי סיום העוגן' },
          { label: 'מחק אותן', text: 'מחק את המשימות שנפגעו', cls: 'red' },
          { label: 'השאר כמו שזה', text: 'השאר הכל כמו שזה, תודה', cls: 'muted' }
        ];
        _appendQuickReplies(chat, chips);
    }
    chat.scrollTop = chat.scrollHeight;
  } catch(e) {
    document.getElementById('recalc-loading')?.remove();
    const errMsg = e.message?.includes('API Key') ? `️ ${e.message}`
      : e.message?.includes('429') ? '️ חריגת מגבלת API — נסה שוב בעוד דקה'
      : e.message?.includes('401') ? '️ מפתח API לא תקין — עדכן בהגדרות'
      : 'שגיאת תקשורת — נסה לנסח מחדש';
    chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble" style="color:var(--red)">${errMsg}</div></div>`;
    console.error(e);
  }
}

// ── OMNIBOX (MAGIC INPUT + VOICE) ──


function startVoiceMagic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast('הדפדפן לא תומך בזיהוי קולי '); return; }
    const recognition = new SpeechRecognition(); recognition.lang = 'he-IL'; recognition.interimResults = false; 
    const btn = document.getElementById('btn-voice-magic'); const inp = document.getElementById('magic-input'); const originalPlaceholder = inp.placeholder;
    recognition.onstart = function() { btn.style.animation = 'blink 1s infinite'; inp.placeholder = '️ מקשיב...'; toast('מקשיב...'); };
    recognition.onresult = function(event) { inp.value = event.results[0][0].transcript; inp.placeholder = originalPlaceholder; btn.style.animation = 'none'; handleMagicInput(); };
    recognition.onerror = function() { toast('שגיאה בזיהוי הקולי'); inp.placeholder = originalPlaceholder; btn.style.animation = 'none'; };
    recognition.onend = function() { btn.style.animation = 'none'; inp.placeholder = originalPlaceholder; };
    recognition.start();
}

function clearAssistantHistory() {
  assistantHistory = [];
  const ch = document.getElementById('assistant-chat-history');
  if (ch) ch.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;text-align:center;padding:0.5rem 0;">שיחה חדשה התחילה</div>';
}

function appendAssistantMsg(role, html) {
  const ch = document.getElementById('assistant-chat-history');
  if (!ch) return;
  // Remove placeholder on first real message
  const placeholder = ch.querySelector('div[style*="text-align:center"]');
  if (placeholder) placeholder.remove();
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;justify-content:${isUser?'flex-end':'flex-start'};`;
  div.innerHTML = `<div style="max-width:85%;padding:0.55rem 0.85rem;border-radius:${isUser?'14px 14px 4px 14px':'14px 14px 14px 4px'};background:${isUser?'var(--accent)':'var(--surface2)'};color:${isUser?'white':'var(--text)'};font-size:0.84rem;line-height:1.55;border:1px solid ${isUser?'transparent':'var(--border)'}">${html}</div>`;
  ch.appendChild(div);
  ch.scrollTop = ch.scrollHeight;
}

async function handleMagicInput() {
  const inp = document.getElementById('magic-input'); const val = inp.value.trim(); if(!val) return;
  const btn = document.getElementById('magic-btn'); btn.disabled = true; btn.textContent = '⏳';
  appendAssistantMsg('user', val); inp.value = '';

  // Build full app context
  const today = new Date(); const todayStr = ld(today);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const in7 = new Date(today); in7.setDate(today.getDate()+7);
  const todayTasks = S.tasks.filter(t => t.date === todayStr);
  const upcomingTasks = S.tasks.filter(t => t.date > todayStr && t.date <= ld(in7) && !t.done && !t.missed);
  const sortedExams = [...S.exams].sort((a,b)=>a.date.localeCompare(b.date));
  const missedCount = S.tasks.filter(t=>t.missed&&!t.done).length;
  const totalDone = S.tasks.filter(t=>t.done).length;
  const totalTasks = S.tasks.length;
  const dn2 = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const anchorsSummary = (S.anchors||[]).map(a=>`${a.name} (יום ${dn2[a.day||0]}, ${a.start}-${a.end})`).join('; ') || 'אין';

  const systemPrompt = `אתה Oracle — העוזר האישי הכולל של StudyFlow לסטודנט בשם ${S.userName}.
יש לך גישה מלאה לכל נתוני האפליקציה:

 היום: ${todayStr} (${dn2[today.getDay()]}) | מחר: ${ld(tomorrow)}
 משימות היום (${todayTasks.length}): ${JSON.stringify(todayTasks.map(t=>({time:t.time,name:t.name,course:t.course,done:t.done,missed:t.missed})))}
 משימות 7 ימים קדימה (${upcomingTasks.length}): ${JSON.stringify(upcomingTasks.map(t=>({date:t.date,time:t.time,name:t.name,course:t.course})))}
 מבחנים: ${JSON.stringify(sortedExams.map(e=>({course:e.course,date:e.date,daysLeft:Math.max(0,Math.ceil((new Date(e.date+'T12:00')-today)/86400000))})))||'אין'}
 עוגנים: ${anchorsSummary}
 סטטוס: ${S.streak||0} ימי רצף  | ${S.points||0} נקודות | ${totalDone}/${totalTasks} משימות הושלמו | ${missedCount} פוספסו
 פרופיל: ${JSON.stringify(S.profile)||'{}'}

יכולות Oracle:
• עונה על כל שאלה על הלו"ז — "מה יש לי מחר?", "מתי המבחן הבא?"
• מנתח התקדמות — "איך אני עומד בחשבון?", "מה פספסתי השבוע?"
• מסביר את האפליקציה — "איך מוסיפים עוגן?", "מה זה מצב קראנץ׳?"
• מייעץ על שיטות למידה — "כיצד אני יכול לשפר את הציון?", "מה Spaced Repetition?"
• מוסיף פריטים בפקודה טבעית

מדריך האפליקציה (ענה על שאלות):
•  מתכנן AI: כנס לטאב "מתכנן AI חכם" → הזן קורס, תאריך מבחן, שעות/שבוע → "צור תוכנית"
•  עוגנים: כנס ל"עוגנים קבועים" → "הוסף עוגן" → שם, יום, שעות, זמן נסיעה
•  מבחנים: כנס ל"מעקב מבחנים" → הוסף קורס + תאריך → לחץ על המבחן לדשבורד
•  קראנץ׳: בדשבורד המבחן → כפתור "קראנץ׳" → מוסיף 3-4 ימי תרגול אינטנסיבי
• ⏱️ Pomodoro: בדף הבית → בחר משימה → "התחל" — 90 דקות ריכוז
•  מורה AI: ליד כל משימה ← לחץ "תרגל" לשיעור סוקרטי
•  תמיכה נפשית: בסרגל הצד — שיחה עם מאמן פסיכולוגי
• ️ לו"ז שבועי: בטאב "לו"ז שבועי" → כפתור "תצוגת לוח" לגרף
• יועץ לו"ז AI: בכל דף → כפתור "יועץ AI" לסידור מחדש

חוקי תגובה (JSON בלבד):
- שאלות/ייעוץ/הסבר: {"type":"chat","reply":"HTML עשיר בעברית (2-4 משפטים)"}
- הוסף עוגן: {"type":"anchor","name":"...","day":N,"start":"HH:MM","end":"HH:MM","travelMin":0} (day: 0=ראשון...6=שבת)
- הוסף מבחן: {"type":"exam","course":"...","date":"YYYY-MM-DD"}
- הוסף משימה: {"type":"task","name":"...","course":"...","date":"YYYY-MM-DD","time":"HH:MM"} (time מתוך: 08:00,09:00,10:00,11:00,12:00,13:00,14:00,15:00,16:00,17:00,18:00,19:00,20:00)
- המר "מחר"/"מחרתיים"/"ביום X" לתאריכים מדויקים
- "מ-2 עד 4" = 14:00 עד 16:00`;

  // Push the user turn BEFORE the await so UI and history stay in sync even on error
  assistantHistory.push({role:'user', content: val});
  // Trim history to last 12 turns + system (keep pairs intact by trimming an even count)
  if (assistantHistory.length > 24) assistantHistory = assistantHistory.slice(-24);

  // Show typing indicator
  appendAssistantMsg('ai', '<span class="ai-thinking">חושב...</span>');
  const loadingEl = document.getElementById('assistant-chat-history')?.lastElementChild;

  try {
    const messages = [{role:'system', content: systemPrompt}, ...assistantHistory];
    const _content4 = await callAI({ messages, temperature: 0.3, json: true });
    const parsed = extractJSON(_content4);
    loadingEl?.remove();

    if (parsed.type === 'chat') {
      appendAssistantMsg('ai', escapeHtml(parsed.reply || '...').replace(/\n/g,'<br>'));
      assistantHistory.push({role:'assistant', content: parsed.reply || ''});

    } else if (parsed.type === 'anchor') {
      const dayNum = parsed.day !== undefined ? parseInt(parsed.day) : new Date().getDay();
      const newAnchor = { id:uid(), name: parsed.name||'עוגן', day: dayNum, start: parsed.start||'09:00', end: parsed.end||'10:00', travelMin: parseInt(parsed.travelMin)||0, color: '#f5a623' };
      if(!Array.isArray(S.anchors)) S.anchors=[];
      S.anchors.push(newAnchor);
      const ast = parseInt((newAnchor.start).split(':')[0])*60 + parseInt((newAnchor.start).split(':')[1]);
      const aen = parseInt((newAnchor.end).split(':')[0])*60 + parseInt((newAnchor.end).split(':')[1]);
      let collidedTasks = [];
      S.tasks = S.tasks.filter(t => { if (new Date(t.date+'T12:00').getDay()===dayNum&&!t.done&&!t.missed){const tst=parseInt((t.time||'00:00').split(':')[0])*60+parseInt((t.time||'00:00').split(':')[1]);const tdur=parseInt(String(t.duration||'90').match(/\d+/)?.[0]||90);const ten=tst+tdur;if(tst<aen&&ten>ast){collidedTasks.push(t);return false;}} return true; });
      save(); renderAll();
      const confirmMsg = ` עוגן "<b>${escapeHtml(newAnchor.name)}</b>" נוסף ביום ${dn2[dayNum]}, ${newAnchor.start}–${newAnchor.end}.${collidedTasks.length ? ` ️ ${collidedTasks.length} משימות הוזזו.` : ''}`;
      appendAssistantMsg('ai', confirmMsg);
      assistantHistory.push({role:'assistant', content: confirmMsg});
      if (collidedTasks.length) openRecalcForCollision(newAnchor, collidedTasks);

    } else if (parsed.type === 'exam') {
      if (!S.exams.find(e => e.course === parsed.course && e.date === parsed.date)) {
        S.exams.push({id:uid(), course: parsed.course, date: parsed.date, type:'מבחן', conf:3, readyPct:0, createdDate: ld(new Date())});
        save(); renderAll();
        const confirmMsg = ` מבחן ב-<b>${escapeHtml(parsed.course)}</b> נוסף ל-${escapeHtml(parsed.date)}.`;
        appendAssistantMsg('ai', confirmMsg);
        assistantHistory.push({role:'assistant', content: confirmMsg});
      } else {
        const msg = `️ מבחן ב-<b>${escapeHtml(parsed.course)}</b> כבר קיים!`;
        appendAssistantMsg('ai', msg);
        assistantHistory.push({role:'assistant', content: msg});
      }
    } else if (parsed.type === 'task') {
      const validTimes = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
      const taskTime = validTimes.includes(parsed.time) ? parsed.time : '09:00';
      const newTask = {id:uid(), name:parsed.name||'משימה', course:parsed.course||'', date:parsed.date||todayStr, time:taskTime, duration:"90 דק'", priority:'בינוני', done:false, missed:false};
      S.tasks.push(newTask); save(); renderAll();
      const confirmMsg = ` משימה "<b>${escapeHtml(newTask.name)}</b>" נוספה ל-${newTask.date} בשעה ${taskTime}.`;
      appendAssistantMsg('ai', confirmMsg);
      assistantHistory.push({role:'assistant', content: confirmMsg});
    } else {
      const fallback = parsed.reply || JSON.stringify(parsed);
      appendAssistantMsg('ai', escapeHtml(fallback).replace(/\n/g,'<br>'));
      assistantHistory.push({role:'assistant', content: fallback});
    }
  } catch(e) {
    loadingEl?.remove();
    appendAssistantMsg('ai', `<span style="color:var(--red)">שגיאה: ${escapeHtml(e.message)}</span>`);
  }
  btn.disabled = false; btn.textContent = 'שאל ▶';
}

// ── AI TUTOR (SOCRATIC LEARNING) ──
function startTutor(id) {
    const t = S.tasks.find(x => String(x.id) === String(id)); if(!t) return; currentTutorTask = t;
    document.getElementById('tutor-title').textContent = ` ${t.name}`; document.getElementById('tutor-subtitle').textContent = `קורס: ${t.course} | זמן מוקצב: ${t.duration}`;
    document.getElementById('tutor-doc-text').value = '';
    document.getElementById('tutor-chat').innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">אהלן! פתחנו שולחן נקי כדי להתרכז ב-"<b>${escapeHtml(t.name)}</b>".<br><br>הדבק חומר בצד ימין, או פשוט תגיד לי מאיפה מתחילים. (אני לא מגלה תשובות, אנחנו פותרים ביחד!)</div></div>`;
    tutorHistory = []; document.getElementById('tutor-overlay').classList.remove('hidden');
}
function closeTutor() { document.getElementById('tutor-overlay').classList.add('hidden'); currentTutorTask = null; }
async function sendTutor() {
    const inp = document.getElementById('tutor-input'); if(!inp) return; const msg = inp.value.trim(); if(!msg) return; inp.value = '';
    const chat = document.getElementById('tutor-chat'); if(!chat) return; const docText = document.getElementById('tutor-doc-text')?.value.trim() || '';
    chat.innerHTML += `<div class="chat-msg user"><div class="chat-bubble">${escapeHtml(msg)}</div></div><div class="chat-msg ai" id="tutor-loading"><div class="chat-bubble"><span class="ai-thinking">קורא...</span></div></div>`;
    chat.scrollTop = chat.scrollHeight;
    tutorHistory.push({role: 'user', content: msg}); if(tutorHistory.length > 15) tutorHistory = tutorHistory.slice(-15);
    const sysPrompt = `אתה מורה פרטי סוקרטי. קורס: "${currentTutorTask?.course||''}". נושא: "${currentTutorTask?.name}". חומר רקע: """${docText}""".
חוקי ברזל: (1) לעולם אל תיתן תשובה סופית — שאל שאלות מנחות. (2) כוון לבנות הבנה עצמאית, לא לשנן. (3) לאחר כל תגובה, סיים עם:  לפי שיטת החזרה המרווחת — חזור על נושא זה בעוד 24 שעות, 3 ימים ו-7 ימים לזכירה מרבית. (4) דבר ישיר ותכלסי בעברית.`;
    try {
        const ans = await callAI({ messages: [{role:'system', content:sysPrompt}, ...tutorHistory], temperature: 0.6 });
        tutorHistory.push({role: 'assistant', content: ans});
        document.getElementById('tutor-loading')?.remove(); chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${escapeHtml(ans).replace(/\n/g,'<br>')}</div></div>`; chat.scrollTop = chat.scrollHeight;
    } catch(e) { document.getElementById('tutor-loading')?.remove(); chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble" style="color:var(--red)">שגיאה</div></div>`; }
}
