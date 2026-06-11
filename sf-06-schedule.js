// ══════════════════════════════════════════════
// SEMESTER PLANNER
// ══════════════════════════════════════════════
const COURSE_PALETTE = ['#4f6ef7','#16c98d','#f5a623','#8b5cf6','#f76060','#06b6d4','#f97316','#10b981'];
let semCourseCount = 0;

function setPlannerMode(mode) {
  document.getElementById('planner-single-section')?.classList.toggle('hidden', mode !== 'single');
  document.getElementById('planner-semester-section')?.classList.toggle('hidden', mode !== 'semester');
  document.getElementById('mode-btn-single')?.classList.toggle('active', mode === 'single');
  document.getElementById('mode-btn-semester')?.classList.toggle('active', mode === 'semester');
  if (mode === 'semester' && !document.querySelector('.semester-course-card')) addSemesterCourse();
}

function addSemesterCourse() {
  const id = 'sem-' + uid();
  const color = COURSE_PALETTE[semCourseCount % COURSE_PALETTE.length];
  semCourseCount++;
  const card = document.createElement('div');
  card.className = 'semester-course-card'; card.id = id;
  card.innerHTML = `
    <div class="sem-card-header">
      <input type="color" class="sem-color" value="${color}" style="width:36px;height:36px;padding:0.2rem;border-radius:8px;cursor:pointer;border:1px solid var(--border);flex-shrink:0" />
      <input type="text" class="sem-name" placeholder="שם הקורס *" style="font-size:0.92rem;font-weight:700" />
      <button onclick="removeSemesterCourse('${id}')" style="background:var(--red-light);color:var(--red);border:none;border-radius:8px;padding:0.35rem 0.6rem;cursor:pointer;font-family:var(--sans);font-weight:700;flex-shrink:0"></button>
    </div>
    <div class="sem-card-grid">
      <div><label class="field-label">תאריך מבחן *</label><input type="date" class="sem-exam-date" /></div>
      <div><label class="field-label">מתחיל ללמוד</label><input type="date" class="sem-start-date" /></div>
      <div><label class="field-label">שעות/שבוע</label><input type="number" class="sem-hours" value="8" min="1" max="40" /></div>
      <div>
        <label class="field-label">עדיפות: <span class="sem-pri-lbl">3</span></label>
        <input type="range" class="sem-priority" min="1" max="5" value="3" oninput="this.closest('.semester-course-card').querySelector('.sem-pri-lbl').textContent=this.value+''; updateSemCapacity()" />
      </div>
    </div>`;
  document.getElementById('semester-courses-list').appendChild(card);
  card.querySelector('.sem-exam-date').addEventListener('change', updateSemCapacity);
  card.querySelector('.sem-hours').addEventListener('input', updateSemCapacity);
}

function removeSemesterCourse(id) {
  document.getElementById(id)?.remove();
  updateSemCapacity();
}

function collectSemesterCourses() {
  return Array.from(document.querySelectorAll('.semester-course-card')).map(card => ({
    course: card.querySelector('.sem-name')?.value.trim() || '',
    color: card.querySelector('.sem-color')?.value || '#4f6ef7',
    date: card.querySelector('.sem-exam-date')?.value || '',
    startDate: card.querySelector('.sem-start-date')?.value || ld(new Date()),
    hours: Math.max(1, parseFloat(card.querySelector('.sem-hours')?.value || 8)),
    priority: parseInt(card.querySelector('.sem-priority')?.value || 3)
  })).filter(c => c.course && c.date);
}

function updateSemCapacity() {
  const courses = collectSemesterCourses();
  const wrap = document.getElementById('semester-capacity-wrap');
  const rows = document.getElementById('semester-capacity-rows');
  if (!courses.length || !wrap || !rows) { wrap?.classList.add('hidden'); return; }
  const today = new Date();
  const totalWeight = courses.reduce((s,c) => s + c.hours * c.priority, 0);
  const lastDate = courses.reduce((m,c) => c.date > m ? c.date : m, '');
  if (!lastDate) { wrap.classList.add('hidden'); return; }
  const allSlots = getAvailableSlots(ld(today), lastDate, 1);
  const totalAvailH = allSlots.totalMinutes / 60;
  wrap.classList.remove('hidden');
  rows.innerHTML = courses.map(c => {
    const daysUntil = Math.max(1, Math.ceil((new Date(c.date) - today) / 86400000));
    const weeks = Math.max(1, Math.ceil(daysUntil / 7));
    const needed = Math.min(c.hours * weeks, 200);
    const share = totalWeight > 0 ? (c.hours * c.priority) / totalWeight : 1 / courses.length;
    const allocated = totalAvailH * share;
    const pct = Math.min(100, Math.round((allocated / Math.max(1, needed)) * 100));
    const barColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
    return `<div class="sem-cap-row">
      <div class="sem-cap-label" title="${c.course}">${c.course}</div>
      <div class="sem-cap-track"><div class="sem-cap-fill" style="width:${pct}%;background:${barColor}"></div></div>
      <div class="sem-cap-pct" style="color:${barColor}">${pct}%</div>
    </div>`;
  }).join('');
}

async function generateSemesterPlan() {
  const courses = collectSemesterCourses();
  if (!courses.length) { toast('הוסף לפחות קורס אחד עם שם ותאריך מבחן'); return; }
  for (const c of courses) {
    if (!c.course.trim()) { toast('חסר שם לאחד הקורסים'); return; }
    if (!c.date) { toast(`חסר תאריך מבחן לקורס "${c.course}"`); return; }
    if (new Date(c.date) <= new Date()) { toast(`תאריך המבחן של "${c.course}" כבר עבר`); return; }
    if (c.hours < 1 || c.hours > 40) { toast(`שעות/שבוע של "${c.course}" לא הגיוני`); return; }
  }

  const today = ld(new Date());
  const sortedCourses = [...courses].sort((a,b) => a.date.localeCompare(b.date));
  const lastExam = sortedCourses[sortedCourses.length - 1].date;

  // Crunch windows per course
  const crunchLines = sortedCourses.map((c, idx) => {
    const examD = new Date(c.date + 'T12:00:00');
    const prev = idx > 0 ? sortedCourses[idx-1] : null;
    let cd = Math.min(4, Math.max(2, 3));
    if (prev) { const gap = Math.ceil((examD - new Date(prev.date+'T12:00:00'))/86400000); if (gap < 10) cd = Math.max(1, Math.floor(gap/2)); }
    cd = Math.min(cd, Math.max(1, Math.ceil((examD - new Date())/86400000)-1));
    const csD = new Date(examD); csD.setDate(csD.getDate() - cd);
    const em1D = new Date(examD); em1D.setDate(em1D.getDate()-1);
    return `• "${c.course}": ${ld(csD)} עד ${ld(em1D)} (${cd} ימי קראנץ׳ — רק קורס זה!)`;
  }).join('\n');

  const allSlots = getAvailableSlots(today, lastExam, 1);
  if (!allSlots.text || allSlots.text.trim() === 'אין זמנים פנויים') {
    toast('️ אין זמן פנוי לאורך הסמסטר!'); return;
  }

  // Capacity check per course
  const totalWeight = courses.reduce((s,c) => s + c.hours * c.priority, 0);
  const totalAvailH = allSlots.totalMinutes / 60;
  const conflicts = [];
  sortedCourses.forEach(c => {
    const daysUntil = Math.max(1, Math.ceil((new Date(c.date)-new Date())/86400000));
    const needed = Math.min(c.hours * Math.ceil(daysUntil/7), 200);
    const allocated = totalAvailH * (c.hours*c.priority/Math.max(totalWeight,1));
    if (needed > allocated * 1.6) conflicts.push({ course: c.course, needed: needed.toFixed(0), allocated: allocated.toFixed(0) });
  });

  const dn = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const anchorSummary = (S.anchors||[]).map(a=>`${a.name} (יום ${dn[a.day||0]}, ${a.start}–${a.end})`).join(', ') || 'אין';
  const holidayList = Object.entries(HOLIDAYS).filter(([d])=>d>=today&&d<=lastExam).map(([d,v])=>`${d}: ${v.map(h=>h.name).join(' / ')}`).join(', ') || 'אין';
  const existingFuture = S.tasks.filter(t=>!t.done&&!t.missed&&t.date>=today).length;

  const btn = document.getElementById('semester-gen-btn');
  if (btn) { btn.disabled = true; btn.textContent = ' בונה תוכנית סמסטר...'; }

  const coursesSummary = sortedCourses.map(c =>
    `• "${c.course}": מבחן ${c.date} | מתחיל ${c.startDate||today} | ${c.hours}ש׳/שבוע | עדיפות ${c.priority}/5`
  ).join('\n');

  const prompt = `אתה מתכנן לו"ז סמסטר מומחה לפי Spaced Repetition ו-Active Recall.
סטודנט: ${S.userName} | היום: ${today}

קורסי הסמסטר:
${coursesSummary}

עוגנים קבועים (חסומים לחלוטין — לא לשבץ כאן):
${anchorSummary}

חגים ישראליים (אין לשבץ בהם!):
${holidayList||'אין'}

חלונות קראנץ׳ (בלעדיים — רק הקורס הספציפי):
${crunchLines}

משימות קיימות בלו"ז: ${existingFuture} (אל תכפול אותן)

זמנים פנויים לשיבוץ (בדיוק אלה בלבד):
${allSlots.text}

חוקי ברזל:
1. "time" — מתוך בלבד: "08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"
2. "date" — רק תאריכים שמופיעים בזמנים פנויים, לא בחגים
3. בחלון קראנץ׳ — רק הקורס הרלוונטי, עד 3 ביום
4. מחוץ לקראנץ׳ — חלק לפי יחס: (שעות × עדיפות) לכל קורס
5. עד 2-3 משימות ביום בסך הכל, עד 5 בשבוע לכל קורס
6. שם כל משימה חייב להיות בדיוק שם הקורס שלה — ללא תוספות
7. priority: "בינוני" לשלב בנייה, "גבוה" לשלב קראנץ׳

JSON בלבד — עד 150 משימות:
{"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"שם הקורס","name":"שם הקורס","duration":"90 דק'","priority":"גבוה|בינוני"}]}`;

  try {
    const _content2 = await callAI({ messages:[{role:'user',content:prompt}], temperature:0.2, json:true, maxTokens:8000 });
    const parsed = extractJSON(_content2);

    const validTimes = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
    const courseNames = new Set(courses.map(c=>c.course));
    const slotMap = {};
    (parsed.tasks||[]).forEach(t => {
      if (!t.date||!t.time||!t.course) return;
      if (!validTimes.includes(t.time)) return;
      if (new Date(t.date)<new Date()||new Date(t.date)>new Date(lastExam)) return;
      if (!courseNames.has(t.course)) return;
      if (getHoliday(t.date)) return;
      const taskDay = new Date(t.date+'T12:00:00').getDay();
      const tst = parseInt(t.time.split(':')[0])*60+parseInt(t.time.split(':')[1]);
      const tDur = parseInt(String(t.duration||'90').match(/\d+/)?.[0]||90);
      const anchorConflict = (S.anchors||[]).some(a => {
        if (parseInt(a.day)!==taskDay) return false;
        if (a.oneTimeDate && a.oneTimeDate!==t.date) return false;
        const ast=parseInt((a.start||'00:00').split(':')[0])*60+parseInt((a.start||'00:00').split(':')[1])-(a.travelMin||0);
        const aen=parseInt((a.end||'00:00').split(':')[0])*60+parseInt((a.end||'00:00').split(':')[1])+(a.travelMin||0);
        return tst<aen&&(tst+tDur)>ast;
      });
      if (anchorConflict) return;
      slotMap[`${t.date}__${t.time}__${t.course}`] = {...t, id:uid(), done:false, missed:false};
    });

    const validTasks = Object.values(slotMap);
    if (!validTasks.length) throw new Error('לא נוצרו משימות תקינות — נסה שוב');

    S.pendingPlan = validTasks.map(t => ({...t, name: t.course || t.name}));
    renderSemesterPlanTable(S.pendingPlan, courses);
    document.getElementById('semester-result-box').classList.remove('hidden');
    document.getElementById('semester-result-sub').textContent = `${validTasks.length} משימות · ${courses.length} קורסים · ${Math.round(validTasks.length*1.5)} שעות`;
    document.getElementById('semester-result-box').scrollIntoView({behavior:'smooth',block:'start'});

    if (conflicts.length) {
      const conflictMsg = conflicts.map(c=>`"${c.course}": צריך ~${c.needed}ש׳ אבל יש ~${c.allocated}ש׳`).join('\n');
      setTimeout(() => {
        if (confirm(`️ ייתכן שחסרות שעות לקורסים:\n${conflictMsg}\n\nלפתוח יועץ AI לדיון ואיזון מחדש?`)) {
          openRecalc('schedule');
          const chat = document.getElementById('recalc-chat');
          chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">שים לב — יש אי-התאמה בין דרישות הקורסים לשעות הפנויות:<br><b>${conflictMsg.replace(/\n/g,'<br>')}</b><br><br>מה לדלל? אפשר להפחית שעות בקורס מסוים, להוסיף זמן ללמידה בלו"ז, או לעדכן עדיפויות. מה עדיף לך?</div></div>`;
          chat.scrollTop = chat.scrollHeight;
        }
      }, 400);
    } else {
      toast(` תוכנית סמסטר מלאה! ${validTasks.length} משימות נוצרו `);
    }
  } catch(e) {
    toast(`שגיאה: ${e.message}`); console.error(e);
  }
  if (btn) { btn.disabled = false; btn.textContent = ' צור תוכנית סמסטר מלאה'; }
}

function renderSemesterPlanTable(tasks, courses) {
  const colorMap = {};
  (courses||[]).forEach(c => { colorMap[c.course] = c.color || getCourseColor(c.course); });

  // Group by course, then by week
  const byCourse = {};
  tasks.forEach(t => {
    if (!byCourse[t.course]) byCourse[t.course] = [];
    byCourse[t.course].push(t);
  });

  const crunchKW = ['שליפה','אינטנסיב','מבחן תרגול','קראנץ'];
  const months=['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];

  const courseHtml = Object.entries(byCourse).map(([courseName, cTasks]) => {
    const cColor = colorMap[courseName] || getCourseColor(courseName);
    const sorted = [...cTasks].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
    const crunchCount = cTasks.filter(t=>t.priority==='גבוה'||crunchKW.some(k=>t.name.includes(k))).length;

    const cards = sorted.map(t => {
      const isCrunch = t.priority==='גבוה'||crunchKW.some(k=>t.name.includes(k));
      const [th, tm] = (t.time||'00:00').split(':');
      const hol = getHoliday(t.date);
      return `<div style="display:flex;align-items:stretch;border-radius:10px;overflow:hidden;border:1px solid ${isCrunch?'rgba(247,96,96,0.3)':'var(--border)'};background:${isCrunch?'var(--red-light)':'var(--surface)'};margin-bottom:0.35rem;">
        <div style="width:4px;background:${cColor};flex-shrink:0;"></div>
        <div style="width:42px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0.45rem 0;background:var(--surface2);flex-shrink:0;">
          <span style="font-family:var(--mono);font-size:0.78rem;font-weight:800;line-height:1">${th}</span>
          <span style="font-family:var(--mono);font-size:0.58rem;color:var(--muted)">${tm}</span>
        </div>
        <div style="flex:1;padding:0.45rem 0.75rem;display:flex;flex-direction:column;justify-content:center;">
          <div style="display:flex;gap:0.3rem;align-items:center;margin-bottom:0.1rem;flex-wrap:wrap;">
            <span style="font-size:0.65rem;font-weight:800;padding:0.15rem 0.5rem;border-radius:99px;background:${isCrunch?'var(--red-light)':'var(--accent-light)'};color:${isCrunch?'var(--red)':'var(--accent)'}">${isCrunch?'קראנץ׳':'רגיל'}</span>
            <span style="font-size:0.6rem;color:var(--muted);font-family:var(--mono)">${fmtDate(t.date)}</span>
            ${hol?`<span style="font-size:0.58rem;color:var(--yellow);font-weight:700;border:1px solid var(--yellow);padding:0 4px;border-radius:4px;">חג: ${hol}</span>`:''}
          </div>
          <div style="font-size:0.95rem;font-weight:900;color:var(--text)">${t.name}</div>
        </div>
      </div>`;
    }).join('');

    return `<div style="margin-bottom:1.5rem;border:1px solid ${cColor}44;border-radius:16px;overflow:hidden;">
      <div style="background:${cColor}18;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.6rem;border-bottom:1px solid ${cColor}33;">
        <div style="width:12px;height:12px;border-radius:50%;background:${cColor};flex-shrink:0;"></div>
        <div style="font-size:0.95rem;font-weight:900;color:var(--text);flex:1">${courseName}</div>
        <span style="font-size:0.72rem;background:var(--accent-light);color:var(--accent);padding:0.2rem 0.6rem;border-radius:99px;font-weight:700">${cTasks.length} משימות</span>
        ${crunchCount?`<span style="font-size:0.72rem;background:var(--red-light);color:var(--red);padding:0.2rem 0.6rem;border-radius:99px;font-weight:700">קראנץ׳ ${crunchCount}</span>`:''}
      </div>
      <div style="padding:0.75rem;">${cards}</div>
    </div>`;
  }).join('');

  const totalHours = (tasks.length * 1.5).toFixed(0);
  const summaryHtml = `<div style="display:flex;gap:0.55rem;margin-bottom:1.25rem;flex-wrap:wrap;">
    <div style="background:var(--green-light);border:1px solid rgba(22,201,141,0.3);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--green)">משימות: ${tasks.length}</div>
    <div style="background:var(--accent-light);border:1px solid var(--border2);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--accent)">שעות: ~${totalHours}</div>
    <div style="background:var(--purple-light);border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--purple)">קורסים: ${Object.keys(byCourse).length}</div>
    <div style="background:var(--red-light);border:1px solid rgba(247,96,96,0.25);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--red)">קראנץ׳: ${tasks.filter(t=>t.priority==='גבוה'||crunchKW.some(k=>t.name.includes(k))).length}</div>
  </div>`;

  document.getElementById('semester-table-wrap').innerHTML = summaryHtml + courseHtml;
}

function addSemesterPlanToSchedule() {
  if (!S.pendingPlan.length) return;
  const planCount = S.pendingPlan.length;
  let replacedCount = 0;
  S.pendingPlan.forEach(newT => {
    const displaced = S.tasks.filter(old => old.date===newT.date && old.time===newT.time && !old.done);
    replacedCount += displaced.length;
    S.tasks = S.tasks.filter(old => !(old.date===newT.date && old.time===newT.time && !old.done));
    S.tasks.push(newT);
  });
  // Safety pass: remove any task overlapping an anchor (catches stale data / timezone edge cases)
  S.tasks = S.tasks.filter(t => {
    if (t.done || t.missed) return true;
    const tStart = timeToMins(t.time);
    const tDur = parseInt(String(t.duration || '60').match(/\d+/)?.[0] || 60);
    const tEnd = tStart + tDur;
    const dayIdx = new Date(t.date + 'T12:00').getDay();
    return !(S.anchors || []).some(a => {
      if (parseInt(a.day) !== dayIdx) return false;
      if (a.endDate && t.date > a.endDate) return false;
      if (a.oneTimeDate && a.oneTimeDate !== t.date) return false;
      const aStart = timeToMins(a.start) - (a.travelMin || 0);
      const aEnd = timeToMins(a.end) + (a.travelMin || 0);
      return tStart < aEnd && tEnd > aStart;
    });
  });
  // Add exams for any new courses
  const courses = collectSemesterCourses();
  courses.forEach(c => {
    if (c.date && !S.exams.find(e=>e.course===c.course&&e.date===c.date)) {
      S.exams.push({id:uid(), course:c.course, date:c.date, type:'מבחן', conf:c.priority||3, readyPct:0, createdDate:ld(new Date())});
    }
  });
  // Holiday check
  const holidayTasks = S.pendingPlan.filter(t=>getHoliday(t.date));
  S.pendingPlan = []; save(); renderAll();
  document.getElementById('semester-result-box').classList.add('hidden');
  toast(` ${planCount} משימות נוספו ללו"ז${replacedCount?` (הוחלפו ${replacedCount} ישנות)`:''}`);
  if (holidayTasks.length) {
    const hNames = [...new Set(holidayTasks.map(t=>`${fmtDate(t.date)} (${getHoliday(t.date)})`))].join(', ');
    if (confirm(` ${holidayTasks.length} משימות בימי חג: ${hNames}.\nלפתוח יועץ להזזה?`)) {
      openHolidayChat(holidayTasks[0].date, getHoliday(holidayTasks[0].date), holidayTasks); return;
    }
  }
  // Navigate to first task's week
  const firstTask = [...S.tasks].filter(t=>!t.done&&!t.missed&&t.date>=ld(new Date())).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if (firstTask) {
    const td = new Date(firstTask.date+'T12:00:00'); const now = new Date(); now.setHours(0,0,0,0);
    const soc = new Date(now); soc.setDate(now.getDate()-now.getDay());
    const sot = new Date(td); sot.setDate(td.getDate()-td.getDay());
    S.weekOffset = Math.round((sot-soc)/(7*86400000));
  }
  showPage('schedule', document.querySelectorAll('.nav-item')[2]);
}
function renderSchedule() {
  const now = new Date();
  const sow = new Date(now); sow.setDate(now.getDate() - now.getDay() + S.weekOffset * 7);
  const eow = new Date(sow); eow.setDate(sow.getDate() + 6);
  const monthNames = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];
  const weekLabelEl = document.getElementById('week-label');
  if (weekLabelEl) weekLabelEl.textContent = `${sow.getDate()} ${monthNames[sow.getMonth()]} — ${eow.getDate()} ${monthNames[eow.getMonth()]}`;

  schedViewMode = 'timeline'; // Force timeline view

  document.getElementById('schedule-wrap').classList.add('hidden');
  document.getElementById('day-timeline-view').classList.remove('hidden');
  _renderScheduleTimeline(sow, eow);
}

function _renderScheduleList(sow, eow, months) {
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const s = ld(sow), e = ld(eow);
  const byDate = {};
  for (let i = 0; i < 7; i++) { const d = new Date(sow); d.setDate(sow.getDate() + i); byDate[ld(d)] = []; }
  S.tasks.filter(t => t.date >= s && t.date <= e).forEach(t => { byDate[t.date]?.push(t); });
  S.exams.filter(ex => ex.date >= s && ex.date <= e).forEach(ex => { if (byDate[ex.date]) byDate[ex.date].unshift({ ...ex, _exam: true }); });
  Object.keys(byDate).forEach(date => {
    const d = new Date(date + 'T12:00:00');
    (S.anchors || []).filter(a => parseInt(a.day) === d.getDay()).forEach(a => {
      byDate[date].push({ _isAnchor: true, time: a.start, name: a.name, color: a.color || '#94a3b8', _end: a.end, travelMin: a.travelMin || 0 });
    });
    byDate[date].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  });
  let html = ''; let hasAny = false;
  Object.keys(byDate).sort().forEach(date => {
    if (!byDate[date].length) return;
    hasAny = true;
    const d = new Date(date + 'T12:00:00');
    const isToday = ld(new Date()) === date;
    const holList = getHolidayList(date);
    const holBadge = holList.length ? ` · <span class="sch-hol-badge" style="color:${HOLIDAY_COLORS[holList[0].type]||'#888'}">${holList[0].name}</span>` : '';
    html += `<div class="sch-day-group"><div class="sch-day-hdr ${isToday?'is-today':''}"><div class="sch-day-name">${isToday?'<span class="sch-today-pill">היום</span>':''}יום ${dayNames[d.getDay()]}</div><div class="sch-day-date">${d.getDate()} ${months[d.getMonth()]}${holBadge}</div></div><div class="sch-day-items">`;
    byDate[date].forEach(t => {
      if (t._exam) { html += `<div class="tl-slot" style="background:var(--purple-light);border-color:rgba(124,58,237,0.15)"><div class="tl-bar" style="background:var(--purple)"></div><div class="tl-time"><div class="tl-time-h" style="font-size:1rem"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path></svg></div></div><div class="tl-body"><div class="tl-meta"><span class="tl-course-tag" style="background:var(--purple-light);color:var(--purple)">מבחן</span></div><div class="tl-title" style="color:var(--purple);font-weight:900">${escapeHtml(t.course)}</div></div></div>`; return; }
      if (t._isAnchor) { const c = t.color||'#94a3b8'; const [th,tm] = (t.time||'00:00').split(':'); html += `<div class="tl-slot anchor-slot"><div class="tl-bar" style="background:${c}"></div><div class="tl-time"><div class="tl-time-h">${th}</div><div class="tl-time-m">${tm}</div></div><div class="tl-body"><div class="tl-meta"><span class="tl-course-tag" style="background:${c}25;color:${c}">עוגן</span></div><div class="tl-title">${escapeHtml(t.name)}</div></div></div>`; return; }
      const cColor = getCourseColor(t.course); const sc = t.done?'done':t.missed?'missed':'';
      const [th,tm] = (t.time||'00:00').split(':');
      const statusHtml = t.done?`<span class="tl-status" style="background:var(--green-light);color:var(--green)">הושלם</span>`:t.missed?`<span class="tl-status" style="background:var(--red-light);color:var(--red)">פוספס</span>`:`<span class="tl-status" style="background:var(--yellow-light);color:var(--yellow)">ממתין</span>`;
      const actionHtml = `<button class="tl-btn tl-btn-menu" onclick="openTaskActionSheet('${t.id}')" title="אפשרויות"><span class="tl-btn-menu-text">אפשרויות</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>`;
      html += `<div class="tl-slot ${sc}"><div class="tl-bar" style="background:${cColor}"></div><div class="tl-time"><div class="tl-time-h">${th}</div><div class="tl-time-m">${tm}</div></div><div class="tl-body"><div class="tl-meta">${t.course?`<span class="tl-course-tag" style="background:${cColor}20;color:${cColor}">${escapeHtml(t.course)}</span>`:''}<span class="tl-dur">${t.duration||''}</span>${statusHtml}</div><div class="tl-title${t.done?' tl-done':''}">${escapeHtml(t.name)}</div>${t.notes?`<div class="tl-notes">${escapeHtml(t.notes)}</div>`:''}</div><div class="tl-actions">${actionHtml}</div></div>`;
    });
    html += `</div></div>`;
  });
  if (!hasAny) html = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div class="empty-state-title">שבוע ריק</div><div class="empty-state-sub">פתח את מתכנן ה-AI ליצירת תוכנית לימודים</div></div>`;
  document.getElementById('schedule-wrap').innerHTML = html;
}

function _renderScheduleTimeline(sow, eow) {
  const todayStr = ld(new Date());
  const dayAbbr = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  const s = ld(sow), e = ld(eow);
  // Resolve default day FIRST so strip highlights it correctly
  if (!schedViewDay || schedViewDay < s || schedViewDay > e) {
    schedViewDay = (s <= todayStr && todayStr <= e) ? todayStr : s;
  }
  let stripHtml = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(sow); d.setDate(sow.getDate() + i);
    const ds = ld(d);
    const isToday = ds === todayStr;
    const hasTask = S.tasks.some(t => t.date === ds) || (S.anchors||[]).some(a => parseInt(a.day) === d.getDay());
    const hasExam = S.exams.some(ex => ex.date === ds);
    const dotClass = hasExam ? 'exam' : hasTask ? '' : 'empty';
    stripHtml += `<div class="date-slide-item ${isToday?'is-today':''} ${schedViewDay===ds?'active':''}" onclick="selectScheduleDay('${ds}')" data-day="${ds}"><div class="date-slide-day">${dayAbbr[d.getDay()]}</div><div class="date-slide-date">${d.getDate()}</div><div class="day-chip-dot ${dotClass}" style="margin-top:2px;"></div></div>`;
  }
  const slider = document.getElementById('date-slider');
  if (slider) slider.innerHTML = stripHtml;
  
  const wrap = document.getElementById('day-timeline-view');
  wrap.innerHTML = `<div id="tl-day-content"></div>`;
  renderDayTimeline(schedViewDay);
  _initDaySwipe();
}

function selectScheduleDay(ds) {
  schedViewDay = ds;
  document.querySelectorAll('.date-slide-item').forEach(el => el.classList.toggle('active', el.dataset.day === ds));
  renderDayTimeline(ds);
}

let TL_HOUR_PX = 64, TL_PX_MIN = 64 / 60;
const TL_START_H = 7, TL_END_H = 23;
let _nowLineTimer = null;

function renderDayTimeline(dateStr) {
  if (_nowLineTimer) { clearInterval(_nowLineTimer); _nowLineTimer = null; }

  const d = new Date(dateStr + 'T12:00:00');
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const months = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];
  const isToday = dateStr === ld(new Date());
  const isWeekend = d.getDay() === 6 || d.getDay() === 5;

  // ── Build event list ──────────────────────────────────────────────────────
  const events = [];
  (S.anchors||[]).filter(a => {
    if (a.oneTimeDate) return a.oneTimeDate === dateStr;
    return parseInt(a.day) === d.getDay() && !(a.endDate && dateStr > a.endDate);
  }).forEach(a => {
    const [sh,sm] = a.start.split(':').map(Number);
    const [eh,em] = a.end.split(':').map(Number);
    events.push({ _type:'anchor', name:a.name, color:a.color||'#94a3b8', startMins:sh*60+sm, durMins:(eh*60+em)-(sh*60+sm), time:a.start, _end:a.end, _notes:a.notes||'', _onetime:!!a.oneTimeDate });
  });
  S.exams.filter(ex => ex.date === dateStr).forEach(ex => {
    events.push({ _type:'exam', name:ex.course, color:'#8b5cf6', startMins:8*60, durMins:30, time:'08:00' });
  });
  S.tasks.filter(t => t.date === dateStr).forEach(t => {
    const [th,tm] = (t.time||'08:00').split(':').map(Number);
    const dur = parseInt((t.duration||'90').match(/\d+/)?.[0]||90);
    const isHobby = (S.hobbies||[]).some(h => h.name === t.course);
    events.push({ _type:'task', id:t.id, name:t.name, course:t.course, priority:t.priority, color:getCourseColor(t.course), startMins:th*60+tm, durMins:dur, time:t.time, done:t.done, missed:t.missed, notes:t.notes, isHobby });
  });
  // Reminders are rendered separately — keep them out of column layout
  const dayReminders = (S.reminders||[]).filter(r => r.date === dateStr);
  events.sort((a,b) => a.startMins - b.startMins);

  // ── Overlap columns (tasks/anchors only) ──────────────────────────────────
  const cols = [];
  events.forEach(ev => {
    const evEnd = ev.startMins + Math.max(ev.durMins, 30);
    let placed = false;
    for (let c = 0; c < cols.length; c++) {
      if (cols[c] <= ev.startMins) { ev._col = c; cols[c] = evEnd; placed = true; break; }
    }
    if (!placed) { ev._col = cols.length; cols.push(evEnd); }
  });
  const totalCols = cols.length || 1;
  events.forEach(ev => { ev._totalCols = totalCols; });

  // ── Detect focus blocks (2+ consecutive non-done tasks) ───────────────────
  const focusBlocks = _detectFocusBlocks(events);

  // ── Holiday banner ────────────────────────────────────────────────────────
  const holList = getHolidayList(dateStr);
  let holidayHtml = '';
  holList.forEach(h => {
    const hColor = HOLIDAY_COLORS[h.type] || '#888';
    holidayHtml += `<div class="tl-holiday-banner" style="background:${hColor}18;color:${hColor};border:1px solid ${hColor}35"> ${h.name}</div>`;
  });

  // ── Day header ────────────────────────────────────────────────────────────
  const examBadge = S.exams.filter(ex => ex.date === dateStr).map(ex => `<span class="tl-day-exam-badge"> ${ex.course}</span>`).join('');
  const taskCount = S.tasks.filter(t => t.date === dateStr && !t.done).length;
  const countBadge = taskCount ? `<span class="tl-day-count-badge">${taskCount} משימות</span>` : '';
  const headerHtml = `<div class="tl-day-header"><div><div class="tl-day-title">יום ${dayNames[d.getDay()]}${isToday?` — <span style="color:var(--accent)">היום</span>`:''}</div><div class="tl-day-meta">${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}</div></div><div class="tl-day-badges">${countBadge}${examBadge}</div></div>`;

  // ── Hour labels & grid ────────────────────────────────────────────────────
  const totalH = (TL_END_H - TL_START_H) * TL_HOUR_PX;
  let labelsHtml = '', gridHtml = '';
  for (let h = TL_START_H; h <= TL_END_H; h++) {
    const top = (h - TL_START_H) * TL_HOUR_PX;
    labelsHtml += `<div class="tl-hour-label" style="top:${top}px">${String(h).padStart(2,'0')}</div>`;
    gridHtml += `<div class="tl-grid-line" style="top:${top}px"></div>`;
  }

  // ── Now line ──────────────────────────────────────────────────────────────
  let nowHtml = '';
  if (isToday) {
    const nowD = new Date();
    const nowTop = (nowD.getHours()*60+nowD.getMinutes() - TL_START_H*60) * TL_PX_MIN;
    if (nowTop >= 0 && nowTop <= totalH)
      nowHtml = `<div class="tl-now-line" id="tl-now-line" style="top:${nowTop}px"><div class="tl-now-dot"></div></div>`;
  }

  // ── Task events HTML ──────────────────────────────────────────────────────
  let eventsHtml = '';
  const GUTTER = 3;
  events.forEach((ev, idx) => {
    const top = Math.max(0, (ev.startMins - TL_START_H*60) * TL_PX_MIN);
    const height = Math.max(28, ev.durMins * TL_PX_MIN - 2);
    const colW = 100 / ev._totalCols;
    const rightPct = ev._col * colW;
    const delay = "animation-delay:" + (idx * 0.055) + "s;";

    // Clean, Notion Calendar-style background (15% opacity)
    const bg = ev.color + '33';
    
    // Base inline style for all events
    const inlineStyle = "top:" + top + "px; height:" + height + "px; right:" + rightPct + "%; width:calc(" + colW + "% - 3px); background:" + bg + "; border-right: 4px solid " + ev.color + "; --ev:" + ev.color + "; " + delay;

    if (ev._type === 'anchor') {
      const ancNotesHtml = ev._notes && height > 52 ? '<div class="top5-ev-notes">' + ev._notes + '</div>' : '';
      const onetimePip = ev._onetime ? '<span class="top5-pip" style="background:' + ev.color + '30; color:' + ev.color + '">חד פעמי</span>' : '';
      eventsHtml += '<div class="top5-ev anchor-ev" style="' + inlineStyle + '"><div class="top5-ev-body"><div class="top5-ev-name">' + onetimePip + ev.name + '</div><div class="top5-ev-time">' + ev.time + ' – ' + ev._end + '</div>' + ancNotesHtml + '</div></div>';
      return;
    }
    if (ev._type === 'exam') {
      eventsHtml += '<div class="top5-ev exam-ev" style="' + inlineStyle.replace(ev.color, '#8b5cf6').replace(bg, 'rgba(139,92,246,0.22)') + '"><div class="top5-ev-body"><div class="top5-ev-name" style="color:#8b5cf6"> ' + ev.name + '</div><div class="top5-ev-time" style="color:#8b5cf6">מבחן קרוב!</div></div></div>';
      return;
    }
    
    // Task event
    const statusClass = ev.done ? 'ev-done' : ev.missed ? 'ev-missed' : '';
    const priorityDot = ev.priority === 'גבוה' ? '<span class="top5-priority-dot"></span>' : '';
    const timeLine = height > 40 ? '<div class="top5-ev-time">' + ev.time + (ev.durMins ? ' · ' + ev.durMins + ' דק\'' : '') + (ev.course && height > 56 ? ' · ' + ev.course : '') + '</div>' : '';
    const notesLine = ev.notes && height > 62 ? '<div class="top5-ev-notes">' + ev.notes + '</div>' : '';
    
    eventsHtml += '<div class="top5-ev ' + statusClass + '" data-task-id="' + ev.id + '" style="' + inlineStyle + '" onclick="openTaskQuickActions(\'' + ev.id + '\')"><div class="top5-ev-body"><div class="top5-ev-name">' + priorityDot + ev.name + '</div>' + timeLine + notesLine + '</div></div>';
  });

  // ── Reminder chips (rendered on top, do not affect column layout) ─────────
  let remindersHtml = '';
  dayReminders.forEach((r, ri) => {
    const [rh, rm2] = (r.time || '08:00').split(':').map(Number);
    const remTop = Math.max(0, (rh * 60 + rm2 - TL_START_H * 60) * TL_PX_MIN);
    const timeLabel = r.time ? r.time : '';
    remindersHtml += `<div class="tl-reminder-chip" style="top:${remTop}px;z-index:20;animation-delay:${ri*0.05}s" title="${r.text}"><span class="tl-reminder-bell">🔔</span><span class="tl-reminder-text">${r.text}${timeLabel ? ` · ${timeLabel}` : ''}</span></div>`;
  });

  // ── Focus block brackets ──────────────────────────────────────────────────
  let bracketsHtml = '';
  focusBlocks.forEach(block => {
    const first = block[0], last = block[block.length - 1];
    const bTop = Math.max(0, (first.startMins - TL_START_H*60) * TL_PX_MIN);
    const bBot = (last.startMins + last.durMins - TL_START_H*60) * TL_PX_MIN;
    const bH = Math.max(0, bBot - bTop - 2);
    if (bH < 20) return;
    const labelTop = bTop + bH / 2;
    bracketsHtml += '';
  });

  // ── Assemble DOM ──────────────────────────────────────────────────────────
  const uid_tl = `tl-${dateStr}`;
  const weekendClass = isWeekend ? 'is-weekend' : '';
  const content = document.getElementById('tl-day-content');
  content.innerHTML = headerHtml + holidayHtml + `<div class="timeline-outer" id="${uid_tl}"><div class="timeline-labels" style="height:${totalH}px">${labelsHtml}</div><div class="timeline-events-area ${weekendClass}" style="height:${totalH}px">${gridHtml}${nowHtml}${eventsHtml}${bracketsHtml}${remindersHtml}</div></div>`;

  // ── Scroll to now / first event ───────────────────────────────────────────
  const outerEl = document.getElementById(uid_tl);
  if (outerEl) {
    _initPinchZoom(outerEl);
    let scrollTarget = 0;
    if (isToday) {
      const nowD = new Date();
      scrollTarget = Math.max(0, ((nowD.getHours()*60+nowD.getMinutes()) - TL_START_H*60) * TL_PX_MIN - 100);
    } else if (events.length) {
      scrollTarget = Math.max(0, (events[0].startMins - TL_START_H*60) * TL_PX_MIN - 40);
    }
    setTimeout(() => {
      const rect = outerEl.getBoundingClientRect();
      const absTop = rect.top + window.scrollY;
      window.scrollTo({ top: Math.max(0, absTop + scrollTarget - 80) });
    }, 80);
  }

  // ── Real-time now-line updates ────────────────────────────────────────────
  if (isToday) {
    _nowLineTimer = setInterval(() => {
      const nl = document.getElementById('tl-now-line');
      if (!nl) { clearInterval(_nowLineTimer); return; }
      const nowD = new Date();
      const nowTop = (nowD.getHours()*60+nowD.getMinutes() - TL_START_H*60) * TL_PX_MIN;
      nl.style.top = nowTop + 'px';
    }, 60000);
  }

  // ── Drag-to-reschedule ────────────────────────────────────────────────────
  const eventsArea = content.querySelector('.timeline-events-area');
  if (eventsArea) _initDragReschedule(eventsArea, dateStr);
}

function zoomTimeline(delta) {
  TL_HOUR_PX = Math.min(160, Math.max(40, TL_HOUR_PX + delta));
  TL_PX_MIN = TL_HOUR_PX / 60;
  if (schedViewDay) renderDayTimeline(schedViewDay);
}

function _initPinchZoom(el) {
  let initDist = 0, initPx = TL_HOUR_PX;
  el.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      initDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      initPx = TL_HOUR_PX;
    }
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (e.touches.length !== 2) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const scale = d / initDist;
    TL_HOUR_PX = Math.min(160, Math.max(40, Math.round(initPx * scale)));
    TL_PX_MIN = TL_HOUR_PX / 60;
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (initDist > 0) { renderDayTimeline(schedViewDay); initDist = 0; }
  }, { passive: true });
}

// ── Timeline helpers ──────────────────────────────────────────────────────────

function _getUrgencyClass(task, taskDateStr) {
  if (!S.exams || !S.exams.length || !task.course) return '';
  const courseExams = S.exams.filter(ex => ex.course === task.course && ex.date >= taskDateStr);
  if (!courseExams.length) return '';
  const nearest = courseExams.reduce((a, b) => a.date < b.date ? a : b);
  const daysUntil = Math.ceil((new Date(nearest.date + 'T12:00') - new Date(taskDateStr + 'T12:00')) / 86400000);
  if (daysUntil <= 1) return 'ev-urgent-critical';
  if (daysUntil <= 3) return 'ev-urgent-high';
  if (daysUntil <= 7) return 'ev-urgent-med';
  return '';
}

function _detectFocusBlocks(events) {
  const active = events.filter(ev => ev._type === 'task' && !ev.done && !ev.missed);
  if (active.length < 2) return [];
  const sorted = [...active].sort((a, b) => a.startMins - b.startMins);
  const blocks = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = cur[cur.length - 1];
    if (sorted[i].startMins - (prev.startMins + prev.durMins) <= 15) {
      cur.push(sorted[i]);
    } else {
      if (cur.length >= 2) blocks.push([...cur]);
      cur = [sorted[i]];
    }
  }
  if (cur.length >= 2) blocks.push(cur);
  return blocks;
}

function _initDragReschedule(eventsArea, dateStr) {
  // Dragging disabled — unreliable on mobile touch
  // To re-enable: restore pointer event listeners here
}

function quickMarkDone(taskId) {
  const t = S.tasks.find(x => String(x.id) === String(taskId));
  if (!t || t.done) return;
  t.done = true; t.missed = false;
  const dur = parseInt(String(t.duration||'90').match(/\d+/)?.[0]||90);
  const xp = Math.max(5, Math.floor(dur / 5));
  addPoints(xp); save(); renderAll();
  toast(` משימה הושלמה! +${xp} XP`);
}

function openTaskQuickActions(taskId) {
  openTaskActionSheet(taskId);
}

function closeTaskActionSheetOld() {
  // kept for reference to not break line numbers
}

function _initDaySwipe() { return; // DISABLED BY USER

  const el = document.getElementById('day-timeline-view');
  if (!el) return;
  if (_swipeController) _swipeController.abort();
  _swipeController = new AbortController();
  const { signal } = _swipeController;
  let tx = 0, ty = 0;
  el.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true, signal });
  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const now = new Date(); now.setHours(12,0,0,0);
      const sow = new Date(now); sow.setDate(now.getDate() - now.getDay() + S.weekOffset * 7);
      const eow = new Date(sow); eow.setDate(sow.getDate() + 6);
      const s = ld(sow), eStr = ld(eow);
      // Validate schedViewDay is within the displayed week, otherwise start from first day
      const safeDay = (schedViewDay && schedViewDay >= s && schedViewDay <= eStr) ? schedViewDay : s;
      const cur = new Date(safeDay + 'T12:00:00');
      if (dx > 0) { cur.setDate(cur.getDate() - 1); if (ld(cur) < s) { S.weekOffset--; schedViewDay = null; renderSchedule(); return; } }
      else { cur.setDate(cur.getDate() + 1); if (ld(cur) > eStr) { S.weekOffset++; schedViewDay = null; renderSchedule(); return; } }
      selectScheduleDay(ld(cur));
    }
  }, { passive: true, signal });
}

let currentRatingTaskId = null; let tempTaskRating = null; let _ratingTimeout = null;

function doneTask(id) {
  const t = S.tasks.find(x => String(x.id) === String(id));
  if (!t) return;
  if (t.done) { t.done = false; save(); renderAll(); toast('↩ משימה הוחזרה לפתוחה'); return; }
  currentRatingTaskId = id;
  tempTaskRating = null;
  if (_ratingTimeout) { clearTimeout(_ratingTimeout); _ratingTimeout = null; }
  document.getElementById('rating-task-name').textContent = t.name;
  document.getElementById('rating-bad-wrap').classList.add('hidden');
  const skipBtn = document.getElementById('rating-skip-btn');
  skipBtn.textContent = 'דלג על הדירוג';
  skipBtn.onclick = () => finishTaskRating(true);
  skipBtn.classList.remove('hidden');
  document.getElementById('rating-feedback').value = '';
  document.querySelectorAll('.star-b').forEach(b => b.classList.remove('lit', 'preview'));
  document.getElementById('rating-modal').classList.remove('hidden');
  _setBodyLock(true);
}

function previewStars(n) {
  document.querySelectorAll('.star-b').forEach((b, i) => {
    b.classList.remove('lit', 'preview');
    if (i < (tempTaskRating || 0)) b.classList.add('lit');
    else if (i < n) b.classList.add('preview');
  });
}

function selectStar(n) {
  tempTaskRating = n;
  document.querySelectorAll('.star-b').forEach((b, i) => {
    b.classList.remove('preview');
    b.classList.toggle('lit', i < n);
    // Add pop animation
    if(i < n) {
      b.style.transform = 'scale(1.2)';
      setTimeout(()=> { b.style.transform = ''; }, 150);
    }
  });
  const skipBtn = document.getElementById('rating-skip-btn');
  if (n <= 3) {
    document.getElementById('rating-bad-wrap').classList.remove('hidden');
    skipBtn.classList.add('hidden');
    skipBtn.onclick = () => finishTaskRating(true);
    if (_ratingTimeout) { clearTimeout(_ratingTimeout); _ratingTimeout = null; }
  } else {
    document.getElementById('rating-bad-wrap').classList.add('hidden');
    skipBtn.textContent = 'אישור';
    skipBtn.onclick = () => finishTaskRating(); // save the rating, don't skip
    skipBtn.classList.remove('hidden');
    if (_ratingTimeout) clearTimeout(_ratingTimeout);
    _ratingTimeout = setTimeout(() => { _ratingTimeout = null; finishTaskRating(); }, 800);
  }
}

function submitTaskRating(stars) { selectStar(stars); }

function finishTaskRating(skip = false) {
  if (_ratingTimeout) { clearTimeout(_ratingTimeout); _ratingTimeout = null; }
  const t = S.tasks.find(x => String(x.id) === String(currentRatingTaskId));
  const savedRating = tempTaskRating;
  const savedFeedback = document.getElementById('rating-feedback')?.value?.trim() || '';
  // Close FIRST — ensures modal always closes even if rendering throws
  document.getElementById('rating-feedback').value = '';
  tempTaskRating = null;
  currentRatingTaskId = null;
  closeModal('rating-modal');
  if (t) {
    t.done = true; t.missed = false;
    if (savedRating) { t.rating = savedRating; t.feedback = savedFeedback; }
    const dur = parseInt(String(t.duration||'90').match(/\d+/)?.[0]||90);
    const xp = Math.max(5, Math.floor(dur / 5));
    try { addPoints(xp); save(); renderAll(); } catch(e) { console.error('rating renderAll:', e); try { save(); } catch(_) {} }
    toast(savedRating ? `${savedRating}/5 כוכבים — תודה! (+${xp} XP)` : `משימה הושלמה! (+${xp} XP)`);
  }
}
function undoTask(id){ 
  const t=S.tasks.find(t=>String(t.id)===String(id)); 
  if(t){
    t.done=false;
    t.missed=false;
    save();
    closeTaskActionSheet();
    setTimeout(() => {
      renderAll();
      toast('↩ משימה הוחזרה לפתוחה');
    }, 150);
  } 
}
function deleteTask(id){ S.tasks=S.tasks.filter(t=>String(t.id)!==String(id)); save(); renderAll(); toast('נמחקה'); }
function missTask(id){ missedTaskId=id; const t=S.tasks.find(t=>String(t.id)===String(id)); document.getElementById('missed-task-name').textContent=`משימה: "${t?.name||''}"`; document.getElementById('missed-modal').classList.remove('hidden'); _setBodyLock(true); }
function confirmMissed(){ if(!missedTaskId)return; const t=S.tasks.find(t=>String(t.id)===String(missedTaskId)); if(t){t.missed=true;t.done=false;t.missedReason=selectedOpt||'לא צוין';} save(); closeModal('missed-modal'); renderAll(); }

function _checkWeeklyReviewBanner() {
  const banner = document.getElementById('wr-banner');
  if (!banner) return;
  const hasCourses = (S.courses || []).length > 0;
  if (hasCourses && _needsWeeklyReview()) {
    const msg = document.getElementById('wr-banner-msg');
    if (msg) msg.textContent = _isFirstWeek() ? ' בנה את הלוז הראשון שלך!' : (new Date().getDay() === 6 ? 'שבת שלום! זמן לסכם את השבוע' : 'זמן לתכנן את השבוע — 3 דקות');
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// Emergency banner: surface a crunch-mode CTA on the Today page when an exam is
// within 7 days. Additive + idempotent (re-rendered each time, fully guarded).
function _renderExamCrunchBanner(){
  try {
    const page = document.getElementById('page-today');
    if (!page) return;
    const old = document.getElementById('exam-crunch-banner');
    if (old) old.remove();
    const t0 = new Date(); t0.setHours(0,0,0,0);
    const soon = (S.exams||[])
      .map(e => ({ e, days: Math.ceil((new Date(e.date+'T12:00') - t0) / 86400000) }))
      .filter(x => x.days >= 0 && x.days <= 7)
      .sort((a,b) => a.days - b.days);
    if (!soon.length) return;
    const x = soon[0];
    const when = x.days === 0 ? 'היום' : x.days === 1 ? 'מחר' : `בעוד ${x.days} ימים`;
    const b = document.createElement('div');
    b.id = 'exam-crunch-banner';
    b.style.cssText = 'padding:0 1rem;margin:0.4rem 0 0.2rem';
    b.innerHTML = `<button onclick="scheduleExamCrunch('${x.e.id}')" style="width:100%;display:flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.85rem 1rem;background:var(--red-light);color:var(--red);border:1px solid var(--red);border-radius:var(--r);font-family:var(--sans);font-size:0.92rem;font-weight:800;cursor:pointer">`
      + `<span style="font-size:1.1rem">⚡</span><span>מבחן ב${escapeHtml(x.e.course)} ${when} — בנה תוכנית לחץ אחרונה</span></button>`;
    page.insertBefore(b, page.firstChild);
  } catch (e) {}
}
function renderTodayTasks(){
  _checkWeeklyReviewBanner();
  _renderExamCrunchBanner();
  const today = ld(new Date()); const dayIdx = new Date().getDay();
  let tt = S.tasks.filter(t => t.date === today);
  animateCount(document.getElementById('sc-tasks'), tt.length);
  animateCount(document.getElementById('sc-done'), tt.filter(t=>t.done).length);
  animateCount(document.getElementById('sc-missed'), tt.filter(t=>t.missed).length);
  renderNextTaskCountdown();
  let items = tt.map(t=>({...t, _isTask:true}));
  const dayAnchors = (S.anchors||[]).filter(a=>parseInt(a.day)===dayIdx);
  dayAnchors.forEach(a=>{ items.push({_isAnchor:true, id:a.id, time:a.start, _end:a.end, name:a.name, color:a.color||'#94a3b8', travelMin:a.travelMin||0}); });
  items.sort((a,b)=>(a.time||'00:00').localeCompare(b.time||'00:00'));
  const wrap = document.getElementById('today-tasks-wrap');
  if (!wrap) return;
  if(!items.length){
    wrap.innerHTML = `
      <div style="padding:1rem 1.25rem 0">
        <button onclick="openScheduleUploadModal()" class="btn-primary" style="margin-top:0; padding:1.2rem 1rem; display:flex; flex-direction:column; align-items:center; gap:0.3rem">
          <div style="display:flex; align-items:center; gap:0.55rem; font-size:1.05rem"><span style="font-size:1.4rem">📷</span><span>צלם את מערכת השעות שלך</span></div>
          <div style="font-size:0.78rem; font-weight:600; opacity:0.92">תמונה, PDF או CSV — נחלץ הכל אוטומטית</div>
        </button>
        <button onclick="openIcsUploadModal()" style="margin-top:0.55rem; width:100%; padding:0.85rem 1rem; background:var(--surface2); color:var(--text); border:1px solid var(--border); border-radius:var(--r); font-family:var(--sans); font-size:0.92rem; font-weight:700; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:0.55rem">
          <span style="font-size:1.1rem">📅</span><span>ייבא משימות מ-Moodle</span>
        </button>
      </div>
      <div class="empty-state">היום פנוי לגמרי! הוסף משימות מהמתכנן.</div>
    `;
    renderPomoTaskSelect();
    return;
  }

  const priColor={גבוה:'var(--red)',בינוני:'var(--yellow)',שוטף:'var(--green)'};
  const priBg={גבוה:'var(--red-light)',בינוני:'var(--yellow-light)',שוטף:'var(--green-light)'};
  const priIcon={גבוה:'',בינוני:'',שוטף:''};

  wrap.innerHTML = `<div class="today-timeline">${items.map((t, idx) => {
    const [th, tm] = (t.time||'00:00').split(':');
    const animDelay = `animation-delay: ${idx * 0.08}s;`;

    if (t._isAnchor) {
      return `<div class="tl-slot anchor-slot" style="${animDelay}">
        <div class="tl-bar" style="background:${t.color}"></div>
        <div class="tl-time"><div class="tl-time-h">${th}</div><div class="tl-time-m">${tm}</div></div>
        <div class="tl-body">
          <div class="tl-meta"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" style="margin-left:4px;vertical-align:middle"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><span style="font-size:0.8rem;font-weight:800;color:var(--muted)">${t.name}</span></div>
          <div class="tl-notes">${t.time} – ${t._end}${t.travelMin>0?` · נסיעה ${t.travelMin} דק'`:''} · עוגן קבוע — חסום ל-AI</div>
        </div>
      </div>`;
    }

    const sc = t.done ? 'done' : t.missed ? 'missed' : '';
    const cColor = getCourseColor(t.course);
    const statusHtml = t.done
      ? `<span class="tl-status" style="background:var(--green-light);color:var(--green)">✓</span>`
      : t.missed
      ? `<span class="tl-status" style="background:var(--red-light);color:var(--red)">✗</span>`
      : `<span class="tl-status" style="background:var(--accent-light);color:var(--accent)">⏳</span>`;

    return `<div class="tl-slot ${sc}" style="${animDelay}">
      <div class="tl-bar" style="background:${cColor}"></div>
      <div class="tl-time"><div class="tl-time-h">${th}</div><div class="tl-time-m">${tm}</div></div>
      <div class="tl-body" onclick="openTaskEditSheet('${t.id}')">
        <div class="tl-meta">
          ${t.course?`<span class="tl-course-tag" style="background:${cColor}22;color:${cColor}">${escapeHtml(t.course)}</span>`:''}
          ${t.priority?`<span class="tl-pri" style="background:${priBg[t.priority]||'var(--yellow-light)'};color:${priColor[t.priority]||'var(--yellow)'}">${t.priority}</span>`:''}
          <span class="tl-dur">${t.duration||''}</span>
          ${statusHtml}
        </div>
        <div class="tl-title">${escapeHtml(t.name)}</div>
        ${t.notes?`<div class="tl-notes"> ${escapeHtml(t.notes)}</div>`:''}
      </div>
      <div class="tl-actions">
        ${!t.done && !t.missed ? `<button class="tl-btn tl-btn-done" onclick="doneTask('${t.id}')" title="סיים משימה"><svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>` : ''}
        <button class="tl-btn tl-btn-menu" onclick="openTaskActionSheet('${t.id}')" title="אפשרויות">
          <span class="tl-btn-menu-text">אפשרויות</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>
    </div>`;
  }).join('')}</div>`;

  renderPomoTaskSelect();
  _checkBurnout();
}

function _checkBurnout() {
  // Removed - no AI psychologist in free version
}

function renderAnchorsList(){
  const wrap = document.getElementById('anchors-list-wrap');
  if(!Array.isArray(S.anchors) || !S.anchors.length){ wrap.innerHTML = '<div class="empty-state" style="text-align:center;padding:2rem;color:var(--muted);font-size:0.9rem">⚓ אין עוגנים מוגדרים עדיין<br><small>הוסף שיעורים, אימונים וזמנים קבועים</small></div>'; return; }
  const dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  wrap.innerHTML = S.anchors.map(a => {
    const travelNote = a.travelMin > 0 ? ` · נסיעה ${a.travelMin} דק'` : '';
    const typeLabel = a.oneTimeDate
      ? `<span class="anchor-badge anchor-badge-onetime">📅 חד פעמי · ${fmtDate(a.oneTimeDate)}</span>`
      : `<span class="anchor-badge anchor-badge-weekly">🔁 שבועי</span>`;
    const dayOrDate = a.oneTimeDate ? fmtDate(a.oneTimeDate) : `יום ${dn[a.day||0]}`;
    const endNote = !a.oneTimeDate && a.endDate ? ` · עד ${fmtDate(a.endDate)}` : '';
    const notesHtml = a.notes ? `<div class="anchor-notes-d">${escapeHtml(a.notes)}</div>` : '';
    return `<div class="anchor-card">
      <div class="anchor-card-strip" style="background:${a.color||'#4f6ef7'}"></div>
      <div class="anchor-card-body">
        <div class="anchor-name-d">${escapeHtml(a.name)}</div>
        <div class="anchor-time-d">${dayOrDate} · ${a.start||'00:00'} – ${a.end||'00:00'}${travelNote}${endNote}</div>
        ${notesHtml}
      </div>
      <div class="anchor-card-actions">
        ${typeLabel}
        <button class="btn-sm" onclick="editAnchor('${a.id}')" title="ערוך"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
        <button class="btn-sm red" onclick="removeAnchor('${a.id}')" title="מחק"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      </div>
    </div>`;
  }).join('');
}
