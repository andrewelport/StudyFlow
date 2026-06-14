// ── MONTHLY CALENDAR ──
function changeCalMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderMonthCalendar();
}

function renderMonthCalendar() {
  const wrap = document.getElementById('month-cal-wrap');
  if (!wrap) return;
  const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const dayShort = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  const today = ld(new Date());
  if (!selectedMonthDay) selectedMonthDay = today;
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const firstDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const labelEl = document.getElementById('cal-month-label');
  if (labelEl) labelEl.textContent = `${monthNames[calMonth]} ${calYear}`;
  let gridHtml = '';
  dayShort.forEach(d => { gridHtml += `<div class="mc2-header">${d}</div>`; });
  for (let i = 0; i < firstDayOfWeek; i++) gridHtml += `<div class="mc2-cell mc2-empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${calYear}-${mm}-${dd}`;
    const isToday = dateStr === today;
    const isPast = dateStr < today;
    const isSelected = dateStr === selectedMonthDay;
    const dayTasks = S.tasks.filter(t => t.date === dateStr);
    const dayExams = S.exams.filter(ex => ex.date === dateStr);
    const dayAnchors = (S.anchors||[]).filter(a => parseInt(a.day) === (new Date(dateStr + 'T12:00:00')).getDay());
    const dotItems = [
      ...dayExams.map(() => ({ c: 'var(--purple)', shape: 'diamond' })),
      ...dayAnchors.map(a => ({ c: a.color || '#94a3b8', shape: 'bar' })),
      ...dayTasks.filter(t=>!t.done&&!t.missed).map(t => ({ c: getCourseColor(t.course), shape: 'dot' })),
      ...dayTasks.filter(t=>t.done).map(() => ({ c: 'var(--green)', shape: 'dot' })),
    ].slice(0, 4);
    const dotsHtml = dotItems.map(({c, shape}) =>
      shape === 'diamond'
        ? `<div class="mc2-dot" style="background:${c};border-radius:2px;transform:rotate(45deg);width:5px;height:5px"></div>`
        : shape === 'bar'
          ? `<div class="mc2-dot" style="background:${c};border-radius:3px;width:8px;height:4px"></div>`
          : `<div class="mc2-dot" style="background:${c}"></div>`
    ).join('');
    let cellCls = 'mc2-cell';
    if (isToday) cellCls += ' mc2-today';
    else if (isPast) cellCls += ' mc2-past';
    if (isSelected) cellCls += ' mc2-selected';
    gridHtml += `<div class="${cellCls}" data-date="${dateStr}" onclick="selectMonthDay('${dateStr}')"><div class="mc2-num">${d}</div><div class="mc2-dots">${dotsHtml}</div></div>`;
  }
  // Build legend from actual courses in this month
  const monthCourses = [...new Set(S.tasks.filter(t => t.date.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`)).map(t=>t.course).filter(Boolean))].slice(0,3);
  const legendItems = [
    `<div class="mc2-legend-item"><div class="mc2-dot" style="background:#94a3b8;border-radius:3px;width:10px;height:5px;flex-shrink:0"></div><span>עוגן קבוע</span></div>`,
    `<div class="mc2-legend-item"><div style="width:7px;height:7px;border-radius:2px;transform:rotate(45deg);background:var(--purple);flex-shrink:0"></div><span>מבחן</span></div>`,
    ...monthCourses.map(c=>`<div class="mc2-legend-item"><div class="mc2-dot" style="background:${getCourseColor(c)};flex-shrink:0"></div><span>${c}</span></div>`),
    monthCourses.length === 0 ? `<div class="mc2-legend-item"><div class="mc2-dot" style="background:var(--accent);flex-shrink:0"></div><span>משימה</span></div>` : '',
  ].filter(Boolean).join('');
  wrap.innerHTML = `<div class="mc2-grid">${gridHtml}</div><div class="mc2-legend">${legendItems}</div><div id="mc2-detail-panel" class="mc2-detail-panel"></div>`;
  renderMonthDayDetail(selectedMonthDay);
}

function selectMonthDay(dateStr) {
  selectedMonthDay = dateStr;
  document.querySelectorAll('.mc2-cell[data-date]').forEach(el => {
    el.classList.toggle('mc2-selected', el.dataset.date === dateStr);
  });
  renderMonthDayDetail(dateStr);
}

function renderMonthDayDetail(dateStr) {
  const panel = document.getElementById('mc2-detail-panel');
  if (!panel || !dateStr) return;
  const d = new Date(dateStr + 'T12:00:00');
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const tasks = S.tasks.filter(t => t.date === dateStr).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const exams = S.exams.filter(ex => ex.date === dateStr);
  const anchors = (S.anchors||[]).filter(a => parseInt(a.day) === d.getDay()).sort((a,b) => (a.start||'').localeCompare(b.start||''));
  const holidays = getHolidayList ? getHolidayList(dateStr) : [];
  const isToday = dateStr === ld(new Date());
  const todayBadge = isToday ? `<span style="background:var(--accent);color:white;font-size:0.62rem;font-weight:800;padding:0.12rem 0.5rem;border-radius:99px;margin-right:0.4rem">היום</span>` : '';
  const title = `<div class="mc2-detail-title">${todayBadge}יום ${dayNames[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}</div>`;

  if (!tasks.length && !exams.length && !anchors.length && !holidays.length) {
    panel.innerHTML = title + `<div class="mc2-detail-empty">אין אירועים ביום זה</div>`;
    panel.classList.add('mc2-detail-visible');
    return;
  }
  let rows = '';

  holidays.forEach(h => {
    const c = (HOLIDAY_COLORS && HOLIDAY_COLORS[h.type]) || '#888';
    rows += `<div class="mc2-detail-row" style="border-right-color:${c}">
      <div class="mc2-detail-time-col"><span class="mc2-ev-dot" style="background:${c}"></span></div>
      <div class="mc2-detail-content"><div class="mc2-detail-name" style="color:${c};font-weight:800">${h.name}</div></div>
    </div>`;
  });

  exams.forEach(ex => {
    const daysLeft = Math.max(0, daysUntil(ex.date));
    rows += `<div class="mc2-detail-row" style="border-right-color:var(--purple);background:var(--purple-light)">
      <div class="mc2-detail-time-col"><span style="font-family:var(--mono);font-size:0.7rem;color:var(--purple);font-weight:900">מבחן</span></div>
      <div class="mc2-detail-content">
        <div class="mc2-detail-name" style="color:var(--purple);font-weight:900">${ex.course}</div>
        ${daysLeft === 0 ? `<div class="mc2-detail-sub" style="color:var(--purple)">היום!</div>` : daysLeft === 1 ? `<div class="mc2-detail-sub" style="color:var(--red)">מחר</div>` : daysLeft <= 3 ? `<div class="mc2-detail-sub" style="color:var(--red)">בעוד ${daysLeft} ימים</div>` : ''}
      </div>
    </div>`;
  });

  anchors.forEach(a => {
    const c = a.color || '#94a3b8';
    const durMins = (() => { try { const [sh,sm]=(a.start||'0:0').split(':').map(Number); const [eh,em]=(a.end||'0:0').split(':').map(Number); return (eh*60+em)-(sh*60+sm); } catch(e){return 0;}})();
    const durStr = durMins > 0 ? ` · ${durMins >= 60 ? Math.floor(durMins/60)+'ש'+' '+(durMins%60?durMins%60+'דק':'') : durMins+'דק'}` : '';
    rows += `<div class="mc2-detail-row" style="border-right-color:${c}">
      <div class="mc2-detail-time-col">
        <span style="font-family:var(--mono);font-size:0.72rem;font-weight:800;color:${c}">${a.start}</span>
        <span style="font-size:0.62rem;color:var(--muted)">${a.end}</span>
      </div>
      <div class="mc2-detail-content">
        <div class="mc2-detail-name" style="color:${c};font-weight:800">${a.name}</div>
        <div class="mc2-detail-sub">עוגן קבוע${durStr}</div>
      </div>
    </div>`;
  });

  tasks.forEach(t => {
    const c = getCourseColor(t.course);
    const isDone = t.done, isMissed = t.missed;
    const statusBg = isDone ? 'var(--green-light)' : isMissed ? 'var(--red-light)' : 'transparent';
    const statusBdr = isDone ? 'var(--green)' : isMissed ? 'var(--red)' : c;
    const statusLabel = isDone
      ? `<span style="color:var(--green);font-size:0.65rem;font-weight:900;background:var(--green-light);padding:0.08rem 0.4rem;border-radius:99px">בוצע</span>`
      : isMissed
        ? `<span style="color:var(--red);font-size:0.65rem;font-weight:900;background:var(--red-light);padding:0.08rem 0.4rem;border-radius:99px">פוספס</span>`
        : '';
    const priorityDot = t.priority === 'גבוה' ? `<span style="width:7px;height:7px;border-radius:50%;background:var(--red);display:inline-block;margin-left:4px;vertical-align:middle"></span>` : '';
    const notesHtml = t.notes ? `<div class="mc2-detail-notes">${t.notes.length > 60 ? t.notes.slice(0,60)+'…' : t.notes}</div>` : '';
    rows += `<div class="mc2-detail-row" style="border-right-color:${statusBdr};background:${statusBg};cursor:pointer" onclick="selectScheduleDay('${dateStr}');showPage('schedule',document.querySelectorAll('.nav-item')[2])">
      <div class="mc2-detail-time-col">
        <span style="font-family:var(--mono);font-size:0.72rem;font-weight:800;color:${c}">${t.time||''}</span>
        <span style="font-size:0.6rem;color:var(--muted)">${t.duration||''}</span>
      </div>
      <div class="mc2-detail-content">
        <div class="mc2-detail-name" style="${isDone?'text-decoration:line-through;opacity:0.6':''}">
          ${priorityDot}${t.name}
        </div>
        <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.2rem;flex-wrap:wrap">
          ${t.course ? `<span style="font-size:0.63rem;font-weight:800;color:${c}">${t.course}</span>` : ''}
          ${statusLabel}
        </div>
        ${notesHtml}
      </div>
    </div>`;
  });

  panel.innerHTML = title + `<div class="mc2-detail-rows">${rows}</div>`;
  panel.classList.add('mc2-detail-visible');
}

function setAnchorType(type) {
  const isOneTime = type === 'onetime';
  document.getElementById('anc-type-weekly-btn')?.classList.toggle('active', !isOneTime);
  document.getElementById('anc-type-onetime-btn')?.classList.toggle('active', isOneTime);
  document.getElementById('anc-onetime-wrap')?.classList.toggle('hidden', !isOneTime);
  document.getElementById('anc-recurring-wrap')?.classList.toggle('hidden', isOneTime);
  document.getElementById('anc-single-day-wrap')?.classList.toggle('hidden', isOneTime);
  document.getElementById('anc-days-selector')?.classList.add('hidden');
  document.getElementById('anc-per-day-times')?.classList.add('hidden');
  document.querySelector('.anc-times-cards')?.classList.remove('hidden');
  const recurring = document.getElementById('anc-recurring');
  if (recurring) recurring.checked = false;
  document.getElementById('anchor-modal').dataset.ancType = type;
}

function toggleAncAdvanced(btn) {
  const sec = document.getElementById('anc-advanced-section');
  if (!sec) return;
  const open = !sec.classList.contains('hidden');
  sec.classList.toggle('hidden', open);
  const arrow = btn.querySelector('.anc-adv-arrow');
  if (arrow) arrow.textContent = open ? '▼' : '▲';
}

function openReminders() {
  if (!S.reminders) S.reminders = [];
  renderReminders();
  document.getElementById('reminders-modal')?.classList.remove('hidden');
  _setBodyLock(true);
}

function addReminder() {
  const text = document.getElementById('rem-text')?.value.trim();
  const date = document.getElementById('rem-date')?.value;
  const time = document.getElementById('rem-time')?.value || '';
  if (!text || !date) { toast('נא למלא טקסט ותאריך'); return; }
  if (text.length > 200) { toast('טקסט ארוך מדי (מקסימום 200 תווים)'); return; }
  if (date < ld(new Date())) { toast('לא ניתן להוסיף תזכורת לתאריך שעבר'); return; }
  if (!S.reminders) S.reminders = [];
  S.reminders.push({ id: Date.now(), text, date, time });
  save();
  const _remText = document.getElementById('rem-text'); if (_remText) _remText.value = '';
  const _remDate = document.getElementById('rem-date'); if (_remDate) _remDate.value = '';
  const _remTime = document.getElementById('rem-time'); if (_remTime) _remTime.value = '';
  renderReminders();
}

function removeReminder(id) {
  S.reminders = (S.reminders||[]).filter(r => r.id !== id);
  save();
  renderReminders();
}

function renderReminders() {
  const list = document.getElementById('rem-list');
  if (!list) return;
  const items = (S.reminders||[]).sort((a,b) => a.date.localeCompare(b.date));
  if (!items.length) {
    list.innerHTML = '<div class="rem-empty">אין תזכורות עדיין</div>';
    return;
  }
  list.innerHTML = items.map(r => {
    const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    const d = new Date(r.date + 'T12:00:00');
    const dayLabel = `${dayNames[d.getDay()]} ${d.getDate()}.${d.getMonth()+1}`;
    return `<div class="rem-item">
      <div class="rem-item-icon">🔔</div>
      <div class="rem-item-body">
        <div class="rem-item-text">${escapeHtml(r.text)}</div>
        <div class="rem-item-meta">${dayLabel}${r.time ? ` · ${r.time}` : ''}</div>
      </div>
      <button class="rem-item-del" onclick="removeReminder(${r.id})">✕</button>
    </div>`;
  }).join('');
}

function showAddAnchorModal(){
  const _ancModal = document.getElementById('anchor-modal');
  if (!_ancModal) return;
  _ancModal.dataset.editId = '';
  const _ancTitle = document.getElementById('anchor-modal-title');
  if (_ancTitle) _ancTitle.textContent = ' הוסף עוגן קבוע';
  document.getElementById('anc-name').value = '';
  document.getElementById('anc-color').value = '#4f6ef7';
  document.getElementById('anc-travel').value = 0;
  document.getElementById('anc-day').value = 0;
  document.getElementById('anc-start').value = '09:00';
  document.getElementById('anc-end').value = '16:00';
  document.getElementById('anc-recurring').checked = false;
  document.getElementById('anc-recurring-wrap').classList.remove('hidden');
  document.getElementById('anc-single-day-wrap').classList.remove('hidden');
  document.getElementById('anc-days-selector').classList.add('hidden');
  document.getElementById('anc-per-day-times').classList.add('hidden');
  document.querySelector('.anc-times-cards')?.classList.remove('hidden');
  const dr = document.getElementById('anc-day-rows');
  if (dr) dr.innerHTML = '';
  document.querySelectorAll('#anc-days-selector input[type="checkbox"]').forEach(cb => cb.checked = false);
  // Reset the "forever" checkbox to checked and disable end-date
  const foreverCb = document.getElementById('anc-forever');
  if (foreverCb) foreverCb.checked = true;
  const endDateEl = document.getElementById('anc-end-date');
  if (endDateEl) { endDateEl.value = ''; endDateEl.disabled = true; endDateEl.style.opacity = '0.35'; }
  document.getElementById('anc-notes').value = '';
  setAnchorType('weekly');
  const todayInput = document.getElementById('anc-onetime-date');
  if (todayInput) todayInput.value = ld(new Date());
  document.getElementById('anchor-modal').classList.remove('hidden');
  _setBodyLock(true);
  setTimeout(() => document.getElementById('anc-name').focus(), 100);
}

function editAnchor(id) {
  const a = (S.anchors||[]).find(x => String(x.id) === String(id));
  if (!a) return;
  document.getElementById('anchor-modal').dataset.editId = id;
  document.getElementById('anchor-modal-title').textContent = '️ עריכת עוגן';
  document.getElementById('anc-name').value = a.name || '';
  document.getElementById('anc-color').value = a.color || '#4f6ef7';
  document.getElementById('anc-travel').value = a.travelMin || 0;
  document.getElementById('anc-day').value = String(a.day || 0);
  document.getElementById('anc-start').value = a.start || '09:00';
  document.getElementById('anc-end').value = a.end || '16:00';
  // Hide recurring section in edit mode (editing individual anchors only)
  document.getElementById('anc-recurring').checked = false;
  document.getElementById('anc-per-day-times').classList.add('hidden');
  document.querySelector('.anc-times-cards')?.classList.remove('hidden');
  const dr = document.getElementById('anc-day-rows');
  if (dr) dr.innerHTML = '';
  document.getElementById('anc-notes').value = a.notes || '';
  if (a.oneTimeDate) {
    setAnchorType('onetime');
    const oi = document.getElementById('anc-onetime-date');
    if (oi) oi.value = a.oneTimeDate;
  } else {
    setAnchorType('weekly');
    document.getElementById('anc-single-day-wrap').classList.remove('hidden');
    document.getElementById('anc-days-selector').classList.add('hidden');
  }
  document.getElementById('anchor-modal').classList.remove('hidden');
  _setBodyLock(true);
}

// ── MISSING FUNCTIONS (previously undefined) ──
function openManualTaskModal(id) {
  const modal = document.getElementById('task-edit-modal');
  document.getElementById('task-modal-title').textContent = id ? 'עריכת משימה' : 'הוספת משימה ידנית';
  const t = id ? S.tasks.find(x => String(x.id) === String(id)) : null;
  document.getElementById('edit-t-name').value = t?.name || '';
  document.getElementById('edit-t-course').value = t?.course || '';
  document.getElementById('edit-t-date').value = t?.date || ld(new Date());
  const nowH = new Date(); const nowTime = String(nowH.getHours()).padStart(2,'0') + ':' + String(nowH.getMinutes()).padStart(2,'0');
  document.getElementById('edit-t-time').value = t?.time || nowTime;
  document.getElementById('edit-t-dur').value = t?.duration ? parseInt(t.duration) : _profileDuration();
  document.getElementById('edit-t-notes').value = t?.notes || '';
  modal.dataset.editId = id || '';
  modal.classList.remove('hidden');
  _setBodyLock(true);
}

function saveManualTask() {
  const _teModal = document.getElementById('task-edit-modal');
  if (!_teModal) return;
  const id = _teModal.dataset.editId;
  const name = document.getElementById('edit-t-name').value.trim();
  const course = document.getElementById('edit-t-course').value.trim();
  const date = document.getElementById('edit-t-date').value;
  const time = document.getElementById('edit-t-time').value;
  const durRaw = parseInt(document.getElementById('edit-t-dur').value) || 90;
  const dur = Math.max(5, Math.min(480, isNaN(durRaw) ? 90 : durRaw));
  const notes = document.getElementById('edit-t-notes').value.trim();
  if (!name || !date || !time) { toast('נא למלא שם, תאריך ושעה'); return; }
  // Validate date is not in the past (allow today)
  if (date < ld(new Date())) { toast('️ לא ניתן לתזמן משימה בעבר'); return; }
  // Holiday check
  const holiday = getHoliday(date);
  if (holiday && !confirm(`️ ${fmtDate(date)} הוא ${holiday}.\nלתזמן משימה בחג?`)) {
    if (id) {
      // Editing existing task — open holiday chat so AI can suggest moving it
      closeModal('task-edit-modal');
      const existingTask = S.tasks.find(x => String(x.id) === String(id));
      openHolidayChat(date, holiday, existingTask ? [existingTask] : []);
    }
    // For new unsaved tasks — just cancel silently (task not in S.tasks yet)
    return;
  }
  // Anchor collision check
  const taskDay = new Date(date + 'T12:00:00').getDay();
  const taskMins = parseInt(time.split(':')[0])*60 + parseInt(time.split(':')[1]);
  const collidingAnchor = (S.anchors||[]).find(a => {
    if (parseInt(a.day) !== taskDay) return false;
    if (a.oneTimeDate && a.oneTimeDate !== date) return false;
    if (a.endDate && date > a.endDate) return false;
    const ast = parseInt((a.start||'00:00').split(':')[0])*60 + parseInt((a.start||'00:00').split(':')[1]) - (a.travelMin||0);
    const aen = parseInt((a.end||'00:00').split(':')[0])*60 + parseInt((a.end||'00:00').split(':')[1]) + (a.travelMin||0);
    return taskMins < aen && (taskMins + dur) > ast;
  });
  if (collidingAnchor && !confirm(`️ שעה זו מתנגשת עם עוגן "${collidingAnchor.name}" (${collidingAnchor.start}–${collidingAnchor.end}).\n\nלהמשיך בכל זאת?`)) return;
  if (id) {
    const t = S.tasks.find(x => String(x.id) === String(id));
    if (t) Object.assign(t, { name, course, date, time, duration: `${dur} דק'`, notes, missed: false, done: false, missedReason: '' });
  } else {
    S.tasks.push({ id: uid(), name, course, date, time, duration: `${dur} דק'`, priority: 'בינוני', done: false, missed: false, notes });
  }
  save(); closeModal('task-edit-modal'); renderAll(); toast(' נשמר!');
}

function toggleScheduleView() {
  const modes = ['timeline', 'list', 'grid'];
  const labels = { timeline: 'רשימה', list: 'לוח שבועי', grid: 'יומן יום' };
  schedViewMode = modes[(modes.indexOf(schedViewMode) + 1) % modes.length];
  isGridView = schedViewMode === 'grid';
  document.getElementById('btn-toggle-view')?.textContent && (document.getElementById('btn-toggle-view').textContent = labels[schedViewMode]);
  renderSchedule();
}

function renderCalendarView() {
  const now = new Date();
  const todayStr = ld(now);
  const sow = new Date(now); sow.setDate(now.getDate() - now.getDay() + S.weekOffset * 7);
  const days = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  const daysFull = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const hours = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
  // Slot boundaries for the "now" line — one entry per hour row + a trailing 21:00 cap
  const slotMins = hours.map(h => timeToMins(h)).concat(21*60);
  const wrap = document.getElementById('calendar-view-wrap');
  const nowMins = now.getHours()*60 + now.getMinutes();

  // Sticky corner cell
  let headers = `<div class="cal-hour" style="position:sticky;top:56px;z-index:21;background:var(--surface2);border-bottom:2px solid var(--border2);justify-content:center;padding-top:0"></div>`;

  // Day headers — today gets blue circle date badge
  headers += Array.from({length:7}, (_,i) => {
    const d = new Date(sow); d.setDate(sow.getDate() + i);
    const isToday = ld(d) === todayStr;
    const numHtml = isToday
      ? `<div style="width:30px;height:30px;border-radius:50%;background:var(--accent);color:white;display:inline-flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:900;margin-bottom:4px;box-shadow:0 2px 10px rgba(79,110,247,0.35)">${d.getDate()}</div>`
      : `<div style="font-size:0.9rem;font-weight:700;color:var(--muted);margin-bottom:4px">${d.getDate()}</div>`;
    return `<div class="cal-cell cal-header${isToday?' today-col':''}">${numHtml}<div style="font-size:0.7rem;letter-spacing:0.5px">${daysFull[i]}</div></div>`;
  }).join('');

  // Hour rows
  let rows = hours.map((hour, rowIdx) => {
    const slotStart = slotMins[rowIdx];
    const slotEnd = slotMins[rowIdx + 1];
    const isAlt = rowIdx % 2 === 1;
    // Is current time within this slot?
    const inSlot = nowMins >= slotStart && nowMins < slotEnd;
    const timePct = inSlot ? Math.round(((nowMins - slotStart) / (slotEnd - slotStart)) * 100) : -1;

    const [hh] = hour.split(':').map(Number);
    const cols = Array.from({length:7}, (_,i) => {
      const d = new Date(sow); d.setDate(sow.getDate() + i);
      const dateStr = ld(d);
      const isToday = dateStr === todayStr;
      const dayAnchors = (S.anchors||[]).filter(a => {
        const [as] = (a.start||'00:00').split(':').map(Number);
        const [ae] = (a.end||'00:00').split(':').map(Number);
        return parseInt(a.day) === d.getDay() && as <= hh && ae > hh;
      });
      const dayTasks = S.tasks.filter(t => t.date === dateStr && t.time === hour);
      const isEmpty = !dayAnchors.length && !dayTasks.length;
      let cell = `<div class="cal-cell${isToday?' today-col':''}${isAlt?' row-alt':''}" data-slot="${hour}"${isToday?' data-today="true"':''}>`;
      // Current time indicator line
      if (isToday && timePct >= 0) {
        const timeLabel = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        cell += `<div class="live-time-line" style="top:${timePct}%"><span class="live-time-label">${timeLabel}</span></div>`;
      }
      dayAnchors.forEach(a => {
        const c = a.color || 'var(--accent)';
        cell += `<div class="cal-task-item" style="border-color:${c};background:${c}1a;color:${c}"><div class="cal-task-name"><svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none" style="margin-left:2px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> ${a.name}</div></div>`;
      });
      dayTasks.forEach(t => {
        const c = getCourseColor(t.course);
        let bg = `${c}1e`, border = c, color = c, nameStyle = '';
        if (t.done) { bg = `${c}0e`; nameStyle = 'text-decoration:line-through;opacity:0.65'; }
        if (t.missed) { bg = 'var(--red-light)'; border = 'var(--red)'; color = 'var(--red)'; }
        const icon = t.done ? '<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none" style="margin-left:2px"><polyline points="20 6 9 17 4 12"></polyline></svg>' : t.missed ? '<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none" style="margin-left:2px"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' : '';
        cell += `<div class="cal-task-item" style="border-color:${border};background:${bg};color:${color}" onclick="openManualTaskModal('${t.id}')">
          <div class="cal-task-name" style="${nameStyle}">${icon}${t.name}</div>
          ${t.course ? `<div class="cal-task-course">${t.course}</div>` : ''}
        </div>`;
      });
      if (isEmpty) cell += `<div class="cal-empty-hint">+ הוסף</div>`;
      cell += `</div>`;
      return cell;
    }).join('');

    // Hour label — show hour prominently
    const [hStr, mStr] = hour.split(':');
    return `<div class="cal-cell cal-hour${isAlt?' row-alt':''}"><span style="font-size:0.78rem;color:var(--text);font-weight:900">${hStr}</span><span style="font-size:0.6rem">${mStr}</span></div>${cols}`;
  }).join('');

  wrap.innerHTML = `<div style="overflow-x:auto;border-radius:18px;"><div class="calendar-grid">${headers}${rows}</div></div>`;

  // Refresh time line every minute
  if (window._calTimeInterval) clearInterval(window._calTimeInterval);
  window._calTimeInterval = setInterval(() => {
    const _pg = document.getElementById('page-schedule');
    if (isGridView && _pg && _pg.classList.contains('active')) {
      renderCalendarView();
    } else {
      clearInterval(window._calTimeInterval); window._calTimeInterval = null;
    }
  }, 60000);
}

// ── ICS CALENDAR IMPORT ──
function openCalendarImport() {
  document.getElementById('ics-file-input').click();
}

function handleICSFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => importFromICS(ev.target.result);
  reader.readAsText(file, 'UTF-8');
}

function parseICS(text) {
  // Unfold continuation lines (RFC 5545 §3.1)
  text = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const events = [];
  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const props = {};
    block.split('\n').forEach(line => {
      const col = line.indexOf(':');
      if (col < 0) return;
      const key = line.substring(0, col).split(';')[0].trim().toUpperCase();
      const val = line.substring(col + 1).trim()
        .replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
      props[key] = val;
    });
    if (props.SUMMARY) events.push(props);
  }
  return events;
}

function parseDT(dtStr) {
  if (!dtStr) return null;
  dtStr = dtStr.replace('Z', '').replace(/[^0-9T]/g, '').trim();
  const hasTz = dtStr.includes('T');
  return {
    year: parseInt(dtStr.substring(0, 4)),
    month: parseInt(dtStr.substring(4, 6)),
    day: parseInt(dtStr.substring(6, 8)),
    hour: hasTz ? parseInt(dtStr.substring(9, 11)) : 0,
    min:  hasTz ? parseInt(dtStr.substring(11, 13)) : 0,
  };
}

function importFromICS(text) {
  const events = parseICS(text);
  const dayMap = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };
  let importedAnchors = 0, importedTasks = 0;
  S.anchors = S.anchors || [];

  events.forEach(ev => {
    const dt = parseDT(ev.DTSTART);
    const dtEnd = parseDT(ev.DTEND) || dt;
    if (!dt || !ev.SUMMARY) return;

    const fmt2 = n => String(n).padStart(2, '0');
    const startTime = `${fmt2(dt.hour)}:${fmt2(dt.min)}`;
    const endTime = `${fmt2(dtEnd.hour)}:${fmt2(dtEnd.min)}`;

    const isRecurring = ev.RRULE && ev.RRULE.toUpperCase().includes('WEEKLY');

    if (isRecurring) {
      // Recurring weekly event → anchor
      let days = [];
      const bydayMatch = ev.RRULE.match(/BYDAY=([^;]+)/i);
      if (bydayMatch) {
        days = bydayMatch[1].split(',').map(d => dayMap[d.trim().toUpperCase()] ?? -1).filter(d => d >= 0);
      }
      if (!days.length) {
        const startDate = new Date(dt.year, dt.month - 1, dt.day);
        days = [startDate.getDay()];
      }
      days.forEach(dayNum => {
        const dup = S.anchors.find(a => a.name === ev.SUMMARY && parseInt(a.day) === dayNum && a.start === startTime);
        if (dup) return;
        S.anchors.push({ id: uid(), name: ev.SUMMARY, day: dayNum, start: startTime, end: endTime, color: getCourseColor(ev.SUMMARY), travelMin: 0, recurring: true, days: [dayNum] });
        importedAnchors++;
      });
    } else {
      // One-time event → task
      const isoDate = `${dt.year}-${fmt2(dt.month)}-${fmt2(dt.day)}`;
      if (new Date(isoDate) < new Date(ld(new Date()))) return; // skip past
      if (S.tasks.find(t => t.name === ev.SUMMARY && t.date === isoDate)) return; // skip dup
      const durMins = (dtEnd.hour * 60 + dtEnd.min) - (dt.hour * 60 + dt.min);
      S.tasks.push({ id: uid(), name: ev.SUMMARY, course: ev.SUMMARY, date: isoDate, time: startTime, duration: `${durMins > 0 ? durMins : 60} דק'`, priority: 'בינוני', done: false, missed: false });
      importedTasks++;
    }
  });

  save();
  renderAll();
  document.getElementById('ics-file-input').value = '';
  toast(` יובאו ${importedAnchors} שיעורים קבועים ו-${importedTasks} אירועים!`);
}

async function aiBriefing() {
  const today = ld(new Date());
  const todayTasks = S.tasks.filter(t => t.date === today);
  const upcomingExams = [...S.exams].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
  const missedCount = S.tasks.filter(t => t.missed && !t.done).length;
  const donePct = todayTasks.length ? Math.round(todayTasks.filter(t=>t.done).length/todayTasks.length*100) : 0;
  const prompt = `אתה עוזר לימודי תומך. שם הסטודנט: ${S.userName}. פרופיל: ${JSON.stringify(S.profile)}.
תן תדריך יומי קצר (3-4 משפטים בעברית, HTML מותר, ללא JSON) על:
- משימות היום (${todayTasks.length} סה"כ, ${donePct}% הושלמו): ${JSON.stringify(todayTasks.map(t=>({name:t.name,done:t.done})))}
- מבחנים קרובים: ${JSON.stringify(upcomingExams.map(e=>({course:e.course,date:e.date})))}
- משימות שפוספסו: ${missedCount}
היה ממוקד, ישיר ומעודד. אזכר את שם הסטודנט.`;
  const box = document.getElementById('briefing-resp');
  box.classList.remove('hidden'); box.classList.add('show');
  box.innerHTML = '<span class="ai-thinking">מכין תדריך אישי...</span>';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try { box.innerHTML = await gemini(prompt); } catch(e) { box.innerHTML = `<span style="color:var(--red)">שגיאה: ${e.message}</span>`; }
}



// ── RECURRING ANCHOR HELPERS ──
function toggleRecurring() {
  const el = document.getElementById('anc-recurring');
  if (!el) return;
  const checked = el.checked;
  document.getElementById('anc-single-day-wrap')?.classList.toggle('hidden', checked);
  document.getElementById('anc-days-selector')?.classList.toggle('hidden', !checked);
  if (!checked) {
    document.getElementById('anc-per-day-times')?.classList.add('hidden');
    document.querySelector('.anc-times-cards')?.classList.remove('hidden');
    const dr = document.getElementById('anc-day-rows');
    if (dr) dr.innerHTML = '';
    document.querySelectorAll('#anc-days-selector input[type="checkbox"]').forEach(cb => cb.checked = false);
  } else { updateDayTimeRows(); }
}
function updateDayTimeRows() {
  const container = document.getElementById('anc-day-rows');
  const perDayWrap = document.getElementById('anc-per-day-times');
  if (!container || !perDayWrap) return;
  const checkedDays = Array.from(document.querySelectorAll('#anc-days-selector input:checked')).map(cb => parseInt(cb.value));
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  if (!checkedDays.length) { perDayWrap.classList.add('hidden'); container.innerHTML=''; return; }
  const baseStart = document.getElementById('anc-start')?.value || '09:00';
  const baseEnd = document.getElementById('anc-end')?.value || '16:00';
  perDayWrap.classList.remove('hidden');
  const existingDays = new Set(Array.from(container.querySelectorAll('[data-day]')).map(el => parseInt(el.dataset.day)));
  checkedDays.forEach(d => {
    if (!existingDays.has(d)) {
      const row = document.createElement('div');
      row.dataset.day = d;
      row.className = 'anc-per-day-row';
      row.innerHTML = `<span class="anc-per-day-lbl">${dayNames[d]}</span><input type="time" id="anc-day-start-${d}" value="${baseStart}" class="anc-per-day-inp" /><input type="time" id="anc-day-end-${d}" value="${baseEnd}" class="anc-per-day-inp" />`;
      container.appendChild(row);
    }
  });
  Array.from(container.querySelectorAll('[data-day]')).forEach(el => {
    if (!checkedDays.includes(parseInt(el.dataset.day))) el.remove();
  });
}

// הוספת עוגן - אם יש התנגשות מקפיץ צ'אט
function saveAnchorManual(){
  const editId = document.getElementById('anchor-modal').dataset.editId || '';
  const name = document.getElementById('anc-name').value.trim();
  if(!name){ toast('חובה להזין שם עוגן'); return; }
  if(name.length > 60){ toast('⚠️ שם העוגן ארוך מדי'); return; }
  const start = document.getElementById('anc-start').value||'09:00';
  const end = document.getElementById('anc-end').value||'16:00';
  const travelMin = Math.max(0, Math.min(180, parseInt(document.getElementById('anc-travel').value)||0));
  const color = document.getElementById('anc-color').value||'#4f6ef7';
  const ancForever = document.getElementById('anc-forever')?.checked !== false;
  const ancEndDate = document.getElementById('anc-end-date')?.value || null;
  const endDate = ancForever ? null : ancEndDate;
  const notes = (document.getElementById('anc-notes')?.value || '').trim();
  const ancType = document.getElementById('anchor-modal').dataset.ancType || 'weekly';
  const isOneTime = ancType === 'onetime';
  const oneTimeDate = isOneTime ? (document.getElementById('anc-onetime-date')?.value || '') : '';
  if (isOneTime && !oneTimeDate) { toast('⚠️ חובה לבחור תאריך לאירוע חד פעמי'); return; }
  const dn = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const isRecurring = !isOneTime && (document.getElementById('anc-recurring')?.checked || false);
  if(!Array.isArray(S.anchors)) S.anchors=[];

  // ── EDIT MODE ──
  if (editId) {
    const idx = S.anchors.findIndex(a => String(a.id) === String(editId));
    if (idx === -1) { toast('⚠️ העוגן לא נמצא'); return; }
    const day = parseInt(document.getElementById('anc-day').value || 0);
    if (start === end) { toast('⚠️ שעת ההתחלה חייבת להיות שונה משעת הסיום'); return; }
    const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number);
    if ((eh*60+em)-(sh*60+sm) > 16*60) { toast('⚠️ משמרת לא יכולה להיות יותר מ-16 שעות'); return; }
    { const wm = (S.wakeTime||'07:00').split(':').map(Number); const slm = (S.sleepTime||'23:00').split(':').map(Number); const wakeMin = wm[0]*60+wm[1]; const sleepMin = slm[0]*60+slm[1]; if (sh*60+sm < wakeMin || eh*60+em > sleepMin) toast('💡 שים לב: העוגן מחוץ לשעות הערות שלך'); }
    const updatedAnchor = { ...S.anchors[idx], name, day, start, end, travelMin, color, endDate, notes };
    if (isOneTime) { updatedAnchor.oneTimeDate = oneTimeDate; updatedAnchor.day = new Date(oneTimeDate+'T12:00:00').getDay(); }
    else { delete updatedAnchor.oneTimeDate; }
    const ast2 = sh*60+sm - travelMin; const aen2 = eh*60+em + travelMin;
    let collidedTasks = [];
    S.tasks = S.tasks.filter(t => {
      if (new Date(t.date + 'T12:00:00').getDay() === day && !t.done && !t.missed) {
        const tst = parseInt((t.time||'00:00').split(':')[0])*60 + parseInt((t.time||'00:00').split(':')[1]);
        const ten = tst + parseInt(String(t.duration||90).match(/\d+/)?.[0]||90);
        if (tst < aen2 && ten > ast2) { collidedTasks.push(t); return false; }
      }
      return true;
    });
    S.anchors[idx] = updatedAnchor;
    document.getElementById('anchor-modal').dataset.editId = '';
    save(); closeModal('anchor-modal'); renderAll();
    if (collidedTasks.length > 0) { toast(`️ העדכון דרס ${collidedTasks.length} משימות`); openRecalcForCollision(updatedAnchor, collidedTasks); }
    else { toast('✅ עוגן עודכן בהצלחה!'); }
    return;
  }

  if (isRecurring) {
    const checkedDays = Array.from(document.querySelectorAll('#anc-days-selector input:checked')).map(cb => parseInt(cb.value));
    if (!checkedDays.length){ toast('⚠️ בחר לפחות יום אחד לחזרה'); return; }
    const newAnchors = [];
    for (const d of checkedDays) {
      const ds = document.getElementById(`anc-day-start-${d}`)?.value || start;
      const de = document.getElementById(`anc-day-end-${d}`)?.value || end;
      if (ds >= de){ toast(`️ יום ${dn[d]}: שעת ההתחלה לפני הסיום`); return; }
      const [sh,sm]=ds.split(':').map(Number); const [eh,em]=de.split(':').map(Number);
      if((eh*60+em)-(sh*60+sm) > 16*60){ toast(`️ יום ${dn[d]}: משמרת מעל 16 שעות`); return; }
      newAnchors.push({ id:uid(), name, day:d, start:ds, end:de, travelMin, color, endDate, notes });
    }
    S.anchors.push(...newAnchors);
    let allCollided = [];
    newAnchors.forEach(anchor => {
      const ast2 = parseInt(anchor.start.split(':')[0])*60+parseInt(anchor.start.split(':')[1])-travelMin;
      const aen2 = parseInt(anchor.end.split(':')[0])*60+parseInt(anchor.end.split(':')[1])+travelMin;
      S.tasks = S.tasks.filter(t => {
        if (new Date(t.date + 'T12:00').getDay() === anchor.day && !t.done && !t.missed) {
          const tst = parseInt((t.time||'00:00').split(':')[0])*60+parseInt((t.time||'00:00').split(':')[1]);
          const ten = tst + parseInt(String(t.duration||90).match(/\d+/)?.[0]||90);
          if (tst < aen2 && ten > ast2){ allCollided.push(t); return false; }
        }
        return true;
      });
    });
    document.getElementById('anc-recurring').checked = false;
    document.getElementById('anc-single-day-wrap').classList.remove('hidden');
    document.getElementById('anc-days-selector').classList.add('hidden');
    document.getElementById('anc-per-day-times').classList.add('hidden');
    document.querySelector('.anc-times-cards')?.classList.remove('hidden');
    document.getElementById('anc-day-rows').innerHTML = '';
    save(); closeModal('anchor-modal'); renderAll();
    if (allCollided.length > 0){ toast(`️ עוגנים חדשים דרסו ${allCollided.length} משימות!`); openRecalcForCollision(newAnchors[0], allCollided); }
    else { toast(` ${newAnchors.length} עוגנים קבועים נוספו!`); }
  } else {
    const day = parseInt(document.getElementById('anc-day').value||0);
    if(start === end){ toast('⚠️ שעת ההתחלה חייבת להיות שונה משעת הסיום'); return; }
    const [sh,sm]=start.split(':').map(Number); const [eh,em]=end.split(':').map(Number);
    if((eh*60+em)-(sh*60+sm)>16*60){ toast('⚠️ משמרת לא יכולה להיות יותר מ-16 שעות'); return; }
    let newAnchor;
    if (isOneTime) {
      const otDay = new Date(oneTimeDate+'T12:00:00').getDay();
      newAnchor = { id:uid(), name, day:otDay, start, end, travelMin, color, notes, oneTimeDate };
    } else {
      newAnchor = { id:uid(), name, day, start, end, travelMin, color, endDate, notes };
    }
    S.anchors.push(newAnchor);
    const ast2 = parseInt(start.split(':')[0])*60+parseInt(start.split(':')[1])-travelMin;
    const aen2 = parseInt(end.split(':')[0])*60+parseInt(end.split(':')[1])+travelMin;
    let collidedTasks = [];
    S.tasks = S.tasks.filter(t => {
      if (new Date(t.date + 'T12:00').getDay() === day && !t.done && !t.missed) {
        const tst = parseInt((t.time||'00:00').split(':')[0])*60+parseInt((t.time||'00:00').split(':')[1]);
        const ten = tst + parseInt(String(t.duration||90).match(/\d+/)?.[0]||90);
        if (tst < aen2 && ten > ast2){ collidedTasks.push(t); return false; }
      }
      return true;
    });
    save(); closeModal('anchor-modal'); renderAll();
    if (collidedTasks.length > 0){ toast('⚠️ העוגן החדש דורס משימות קיימות!'); openRecalcForCollision(newAnchor, collidedTasks); }
    else { toast('✓ עוגן קבוע נוסף!'); }
  }
}
function removeAnchor(id){ S.anchors = S.anchors.filter(a => String(a.id) !== String(id)); save(); renderAll(); toast('עוגן הוסר בהצלחה'); }

// ── PRE-EXAM CRUNCH MODE ──
function scheduleExamCrunch(examId) {
  const ex = S.exams.find(e => String(e.id) === String(examId));
  if (!ex) return;
  const today = new Date(); const todayStr = ld(today);
  const examDate = new Date(ex.date + 'T12:00:00');
  const daysLeft = Math.ceil((examDate - today) / 86400000);
  if (daysLeft <= 0) { toast('⚠️ תאריך המבחן כבר עבר'); return; }
  if (daysLeft > 21) { toast(`️ מצב קראנץ׳ מופעל כשנשארו עד 21 ימים (כרגע ${daysLeft} ימים)`); return; }

  // Calculate crunch window — consider gap to previous exam
  const sortedExams = [...S.exams].sort((a,b) => a.date.localeCompare(b.date));
  const exIdx = sortedExams.findIndex(e => e.id === ex.id);
  const prevExam = exIdx > 0 ? sortedExams[exIdx - 1] : null;
  let crunchDays = Math.min(4, Math.max(2, Math.round(daysLeft * 0.4)));
  if (prevExam) {
    const prevD = new Date(prevExam.date + 'T12:00:00');
    const gap = Math.ceil((examDate - prevD) / 86400000);
    if (gap > 0 && gap < 10) crunchDays = Math.max(1, Math.floor(gap / 2));
  }
  crunchDays = Math.min(crunchDays, Math.max(1, daysLeft - 1));

  const crunchStartD = new Date(examDate); crunchStartD.setDate(crunchStartD.getDate() - crunchDays);
  const effectiveStart = ld(crunchStartD) < todayStr ? todayStr : ld(crunchStartD);
  const examMinus1D = new Date(examDate); examMinus1D.setDate(examMinus1D.getDate() - 1);
  const examMinus1Str = ld(examMinus1D);
  if (effectiveStart > examMinus1Str) { toast('⚠️ אין מספיק ימים לפני המבחן לקראנץ׳'); return; }

  const slotsData = getAvailableSlots(effectiveStart, ex.date, 5);
  if (!slotsData.text || slotsData.text.trim() === 'אין זמנים פנויים') {
    if (confirm(`️ אין זמן פנוי ב-${crunchDays} ימים לפני המבחן.\nלפתוח יועץ לו"ז להוספת זמן?`)) openRecalc('schedule');
    return;
  }

  // Find real free slots in the crunch window (validated against anchors + tasks),
  // instead of substring-matching whole-hour labels against windowed free-text.
  const rawSlots = (typeof _findSlotsInRange === 'function')
    ? _findSlotsInRange(effectiveStart, examMinus1Str, crunchDays * 2)
    : [];
  const newTasks = [];
  const perDayCount = {};
  for (const slot of rawSlots) {
    if ((perDayCount[slot.date] || 0) >= 2) continue; // cap 2/day
    const clash = S.tasks.find(t => t.date === slot.date && t.time === slot.time && !t.done && t.course !== ex.course);
    if (clash) continue;
    newTasks.push({ id: uid(), name: ex.course, course: ex.course, date: slot.date, time: slot.time, duration: "90 דק'", priority: 'גבוה', done: false, missed: false, isCrunch: true });
    perDayCount[slot.date] = (perDayCount[slot.date] || 0) + 1;
  }
  if (!newTasks.length) { toast('️ לא נמצאו חריצים פנויים בחלון הקראנץ׳'); return; }
  if (!confirm(` נוצרו ${newTasks.length} משימות קראנץ׳ (${crunchDays} ימים לפני מבחן "${ex.course}").\nלהוסיף ללו"ז?`)) return;
  // Remove old crunch tasks for this course in the same window to avoid duplicates
  S.tasks = S.tasks.filter(t => !(t.isCrunch && t.course === ex.course && t.date >= effectiveStart && t.date <= examMinus1Str));
  S.tasks.push(...newTasks);
  save(); renderAll(); toast(` ${newTasks.length} משימות קראנץ׳ נוספו ללו"ז!`);
}

function addExam(){
    const course = document.getElementById('ex-course').value.trim();
    const date = document.getElementById('ex-date').value;
    const type = document.getElementById('ex-type')?.value || 'מבחן';
    if(!course || !date){ toast('נא למלא שם קורס ותאריך'); return; }
    if(course.length > 80){ toast('️ שם הקורס ארוך מדי (מקסימום 80 תווים)'); return; }
    if(new Date(date) < new Date(ld(new Date()))){ toast('️ תאריך לא יכול להיות בעבר'); return; }
    const yearsFromNow = new Date(); yearsFromNow.setFullYear(yearsFromNow.getFullYear() + 3);
    if(new Date(date) > yearsFromNow){ toast('️ תאריך נראה לא הגיוני'); return; }
    if(S.exams.find(e => e.course === course && e.date === date)){ toast('️ יעד זה כבר קיים!'); return; }
    S.exams.push({id:uid(), course, date, type, conf:3, createdDate: ld(new Date()), readyPct:0});
    save(); renderExams(); toast(` ${type} נוסף!`);
    document.getElementById('ex-course').value = '';
    document.getElementById('ex-date').value = '';
    if(document.getElementById('ex-type')) document.getElementById('ex-type').value = 'מבחן';
}

let selectedExamId = null;

function renderExams(){
  if (!Array.isArray(S.exams)) S.exams = [];
  const wrap = document.getElementById('exams-list-wrap');
  if(!wrap) return;
  if(!S.exams.length){ wrap.innerHTML ='<div class="empty-state" style="background:var(--surface2);border-radius:24px;padding:3rem 2rem;"><div class="empty-title" style="font-size:1.4rem;font-weight:900;">אין מבחנים כרגע</div><div class="empty-sub" style="font-weight:700;">הוסף מבחן כדי להתחיל מעקב</div></div>'; return; }
  if (selectedExamId) { renderExamDashboard(selectedExamId); return; }
  
  const sorted = [...S.exams].sort((a,b)=>a.date.localeCompare(b.date));
  wrap.innerHTML = sorted.map(ex => {
    const daysLeft = Math.max(0, Math.ceil((new Date(ex.date+'T12:00:00')-new Date())/86400000));
    const isUrgent = daysLeft <= 7;
    const isVeryUrgent = daysLeft <= 3;
    
    // AA Design Variables
    const typeColor = {'מבחן':'var(--accent)','בוחן':'var(--purple)','עבודה':'var(--green)','הגשה':'var(--yellow)'}[ex.type||'מבחן'] || 'var(--accent)';
    const typeBg = typeColor.replace('var(--', 'var(--').replace(')', '-light)');
    const cardBg = isVeryUrgent ? 'linear-gradient(135deg, var(--red-light), var(--surface))' : 'var(--surface)';
    const border = isVeryUrgent ? '2px solid rgba(239,68,68,0.3)' : isUrgent ? '2px solid rgba(245,158,11,0.3)' : '1px solid rgba(0,0,0,0.03)';
    const daysColor = isVeryUrgent ? 'var(--red)' : isUrgent ? 'var(--yellow)' : 'var(--text)';
    
    return `
    <div onclick="selectedExamId='${ex.id}'; renderExams();" style="background:${cardBg};border-radius:20px;padding:1.5rem;margin-bottom:1rem;box-shadow:0 12px 24px rgba(0,0,0,0.06);border:${border};display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:transform 0.3s, box-shadow 0.3s;animation:slideUpFadeIn 0.3s ease-out;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
          <span style="font-size:0.75rem;font-weight:900;background:${typeColor};color:white;padding:4px 12px;border-radius:12px;box-shadow:0 4px 12px ${typeColor.replace('var(--', 'rgba(var(--').replace(')', ',0.3)')}">${ex.type||'מבחן'}</span>
          ${isVeryUrgent?'<span style="font-size:0.75rem;font-weight:900;background:var(--red);color:white;padding:4px 12px;border-radius:12px;box-shadow:0 4px 12px rgba(239,68,68,0.3);">דחוף!</span>':''}
          <span style="font-size:0.85rem;font-weight:800;color:${daysColor};">${isVeryUrgent ? 'ממש קרוב!' : isUrgent ? 'מתקרב!' : 'יש זמן להתכונן'}</span>
        </div>
        <div style="font-size:1.4rem;font-weight:900;color:var(--text);margin-bottom:0.25rem;">${ex.course}</div>
        <div style="font-size:0.95rem;font-weight:800;color:var(--muted);">בעוד ${daysLeft} ימים — ${formatPrettyDate(ex.date)}</div>
      </div>
      <div style="background:var(--surface2);width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;color:var(--text);box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
      </div>
    </div>`;
  }).join('');
}

function renderExamDashboard(id) {
  const wrap = document.getElementById('exams-list-wrap'); const ex = S.exams.find(e => e.id === id);
  if(!wrap) return;
  if(!ex) { selectedExamId = null; renderExams(); return; }
  const created = new Date(ex.createdDate || ex.date); const examD = new Date(ex.date); const now = new Date();
  const totalDays = Math.max(1, Math.ceil((examD - created)/86400000)); const daysPassed = Math.max(0, Math.ceil((now - created)/86400000)); const daysLeft = Math.max(0, Math.ceil((examD - now)/86400000));
  let timePct = Math.min(100, Math.round((daysPassed / totalDays) * 100)); if(isNaN(timePct) || timePct < 0) timePct = 0;
  const courseTasks = S.tasks.filter(t => t.course === ex.course && !t.missed); const doneTasks = courseTasks.filter(t => t.done).length; const totalTasks = courseTasks.length;
  const perfPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  wrap.innerHTML = `
    <button class="btn-sm" style="margin-bottom:1rem; background:var(--surface2); color:var(--text);" onclick="selectedExamId=null; renderExams();">⬅ חזור לרשימת המבחנים</button>
    <div class="section-box" style="border:2px solid var(--accent); background:linear-gradient(180deg, var(--surface) 0%, var(--surface2) 100%);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem;">
            <div>
                <div style="font-size:1.6rem; font-weight:900; color:var(--accent);">${ex.course}</div>
                <div style="font-size:0.95rem; color:var(--muted); font-weight:600;">${ex.type} | מועד: ${ex.date} (${daysLeft} ימים נותרו)</div>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center;">
              <button class="btn-sm" style="background:var(--red-light);color:var(--red);border:1px solid var(--red);font-weight:800;" onclick="scheduleExamCrunch('${ex.id}')"> מצב חירום</button>
              <button class="btn-sm red" onclick="if(confirm('למחוק את המבחן לצמיתות?')) { removeExam('${ex.id}'); selectedExamId=null; renderExams(); }"> מחק</button>
            </div>
        </div>
        <div style="margin-bottom:2rem;"><div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;"><span style="font-weight:800; font-size:0.9rem;">⏳ ציר זמן (הזמן שעבר)</span><span style="font-weight:800; font-family:var(--mono); color:var(--yellow);">${timePct}%</span></div><div class="tree-bar-wrap" style="margin:0; height:16px; background:var(--border);"><div class="tree-bar-fill" style="width:${timePct}%; background:var(--yellow);"></div></div></div>
        <div style="margin-bottom:2rem;"><div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;"><span style="font-weight:800; font-size:0.9rem;"> מדד התקדמות משימות</span><span style="font-weight:800; font-family:var(--mono); color:var(--green);">${perfPct}% (${doneTasks}/${totalTasks})</span></div><div class="tree-bar-wrap" style="margin:0; height:16px; background:var(--border);"><div class="tree-bar-fill" style="width:${perfPct}%; background:var(--green);"></div></div></div>

    </div>`;
}
function recalcExamFocus(course, perfPct, timePct, daysLeft) {
  // AI exam advisor — not available in free version; use scheduleExamCrunch instead
  toast('ייעוץ AI אינו זמין בגרסה החינמית. השתמש במצב חירום להוספת משימות.');
}
function removeExam(id){ S.exams = S.exams.filter(e => String(e.id)!==String(id)); save(); renderExams(); }
