// ── DYNAMIC CHAT & AI ──
function checkPastDueTasks() {
    const todayStr = ld(new Date()); let missedTasks = [];
    S.tasks.forEach(t => { if (t.date < todayStr && !t.done && !t.missed) { t.missed = true; t.missedReason = 'לא בוצע (עבר)'; missedTasks.push(t); } });
    if (missedTasks.length > 0) {
        _rcPendingTasks = missedTasks;
        save();
        openRecalc('morning');
        const taskList = missedTasks.map(t =>
          `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.03); padding:0.8rem 1rem; border-radius:12px; margin-bottom:0.4rem; border:1px solid rgba(0,0,0,0.02);">
            <span style="font-weight:800; color:var(--text); font-size:1rem;">${t.course||t.name}</span>
            <span style="background:var(--red-light); color:var(--red); font-weight:800; font-size:0.8rem; padding:0.25rem 0.6rem; border-radius:8px; display:inline-flex; align-items:center; gap:0.2rem;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${formatPrettyDate(t.date)}</span>
          </div>`
        ).join('');
        document.getElementById('recalc-chat').innerHTML = `
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:1.2rem; margin-bottom:1rem; box-shadow:0 8px 24px rgba(0,0,0,0.04);">
            <div style="font-size:1.1rem; font-weight:900; color:var(--text); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">
              <span style="background:var(--red-light); color:var(--red); padding:0.4rem; border-radius:10px; display:flex; align-items:center; justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
              <span>נשארו ${missedTasks.length} משימ${missedTasks.length===1?'ה':'ות'} שלא גמורות מהימים האחרונים</span>
            </div>
            <div>${taskList}</div>
          </div>
          <div style="font-size:1.15rem; font-weight:900; color:var(--text); text-align:center; margin-bottom:1rem; margin-top:0.5rem;">מה תרצה לעשות עם המשימות?</div>`;
        document.getElementById('recalc-actions-zone').innerHTML = `
          <button class="rcm-choice-btn rcm-choice-green" onclick="_rcDoRescheduleMissed('spread')">
            <div class="rcm-choice-icon">📆</div>
            <div class="rcm-choice-text"><div class="rcm-choice-title">פזר על השבוע</div><div class="rcm-choice-sub">המשימות יתפזרו על השבוע הקרוב</div></div>
          </button>
          <button class="rcm-choice-btn rcm-choice-muted" onclick="_rcDoMarkMissed()">
            <div class="rcm-choice-icon">📌</div>
            <div class="rcm-choice-text"><div class="rcm-choice-title">השאר כפוספסות</div><div class="rcm-choice-sub">נשמר בהיסטוריה ולא יופיע בלוז</div></div>
          </button>`;
    }
}

// ── RECALC DIRECT-ACTION HELPERS ──

// Returns date string of the end of the current work week (Friday)
function _endOfWeek() {
  const d = new Date();
  const daysToFri = (5 - d.getDay() + 7) % 7; // 0 if today is Friday
  const fri = new Date(d);
  fri.setDate(d.getDate() + daysToFri);
  return ld(fri);
}

// Finds up to maxCount free slots between fromDateStr and limitDateStr (inclusive)
// Largest task duration in a batch (≥90) — so found slots are wide enough for
// every task in the batch and longer tasks can't overlap the next slot.
function _maxDurOf(arr){ return Math.max(90, ...((arr||[]).map(t => parseInt(String(t.duration||90).match(/\d+/)?.[0] || 90)).filter(n => n > 0))); }
function _findSlotsInRange(fromDateStr, limitDateStr, maxCount, ignoreSlots = [], slotWidth = 90) {
  const validTimes = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
  const wakeH  = parseInt((S.wakeTime||'07:00').split(':')[0]);
  const sleepH = parseInt((S.sleepTime||'23:00').split(':')[0]);
  const results = [];
  const usedKeys = new Set();
  let d = new Date(fromDateStr + 'T12:00:00');
  while (results.length < maxCount) {
    const dateStr = ld(d);
    if (dateStr > limitDateStr) break;
    const dow = d.getDay();
    d.setDate(d.getDate() + 1);
    if (dow === 6) continue;
    
    const isToday = dateStr === ld(new Date());
    const currentMins = new Date().getHours() * 60 + new Date().getMinutes();
    
    for (const slot of validTimes) {
      if (results.length >= maxCount) break;
      const h = parseInt(slot.split(':')[0]);
      if (h < wakeH || h >= sleepH) continue;
      
      const sm = h * 60;
      if (isToday && sm <= currentMins) continue;
      const key = `${dateStr}|${slot}`;
      if (usedKeys.has(key) || ignoreSlots.includes(key)) continue;
      
      const anchorBusy = (S.anchors||[]).some(a => {
        if (a.oneTimeDate) { if (a.oneTimeDate !== dateStr) return false; }
        else { if (parseInt(a.day) !== dow) return false; if (a.endDate && dateStr > a.endDate) return false; }
        const as2 = parseInt((a.start||'00:00').split(':')[0])*60 + parseInt((a.start||'00:00').split(':')[1]||0) - (a.travelMin||0);
        const ae2 = parseInt((a.end  ||'00:00').split(':')[0])*60 + parseInt((a.end  ||'00:00').split(':')[1]||0) + (a.travelMin||0);
        return sm < ae2 && (sm + slotWidth) > as2;
      });
      if (anchorBusy) continue;
      const taskBusy = S.tasks.some(t => {
        if (t.date !== dateStr || t.done || t.missed) return false;
        const tst = parseInt((t.time||'00:00').split(':')[0])*60 + parseInt((t.time||'00:00').split(':')[1]);
        const ten = tst + parseInt(t.duration||90);
        return sm < ten && (sm + slotWidth) > tst;
      });
      if (taskBusy) continue;
      
      const selfBusy = results.some(r => {
        if (r.date !== dateStr) return false;
        const rst = parseInt(r.time.split(':')[0])*60 + parseInt(r.time.split(':')[1]);
        const ren = rst + slotWidth;
        return sm < ren && (sm + slotWidth) > rst;
      });
      if (selfBusy) continue;
      
      results.push({ date: dateStr, time: slot });
      usedKeys.add(key);
    }
  }
  return results;
}

// Finds next free slot from fromDateStr (up to 28 days ahead, no week limit)
function _findNextFreeSlot(fromDateStr) {
  const slots = _findSlotsInRange(fromDateStr, ld(new Date(Date.now() + 28*86400000)), 1);
  return slots[0] || null;
}

function _rcShowTextInput() { /* no-op in free version — no AI text input */ }

function _rcShowResult(html, type = 'success', showAlternativeBtn = false) {
  const zone = document.getElementById('recalc-actions-zone');
  let iconHtml = '';
  if (type === 'deleted') {
    iconHtml = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  } else {
    iconHtml = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  }
  
  const altBtn = showAlternativeBtn ? `<button class="btn-sm" style="width:100%; margin-bottom:0.5rem; background:var(--surface2); color:var(--text); border:1px solid var(--border); border-radius:12px; padding:0.8rem; font-weight:800; cursor:pointer;" onclick="_rcDoSpreadAlternative()">חפש זמנים אחרים</button>` : '';
  zone.innerHTML = `<div class="rcm-result ${type}"><span class="rcm-result-icon">${iconHtml}</span><span style="flex:1">${html}</span></div>
    ${altBtn}
    <button class="rcm-close-action" onclick="window._rcConfirmAndClose()" style="background:var(--accent); color:var(--surface); font-weight:800;">אישור והמשך</button>`;
}

window._rcConfirmAndClose = function() {
  try {
    const checkboxes = Array.from(document.querySelectorAll('.rcm-task-cb'));
    if (checkboxes.length > 0) {
      const uncheckedIds = checkboxes.filter(cb => !cb.checked).map(cb => cb.value);
      if (uncheckedIds.length > 0) {
        // Remove the tasks that the user left unchecked
        S.tasks = S.tasks.filter(t => !uncheckedIds.includes(t.id));
        save(); renderAll();
        toast(`נמחקו ${uncheckedIds.length} משימות שלא סומנו.`);
      }
    }
  } finally {
    closeRecalc();
  }
};

function _rcShowNoRoom() {
  const zone = document.getElementById('recalc-actions-zone');
  zone.innerHTML = `<div class="rcm-result deleted"><span class="rcm-result-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span><span>אין מקום פנוי בשבוע הנוכחי — אפשר רק למחוק</span></div>
    <button class="rcm-choice-btn rcm-choice-red" onclick="_rcDoIgnore()" style="margin-top:0.4rem">
      <div class="rcm-choice-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></div>
      <div class="rcm-choice-text"><div class="rcm-choice-title">מחק אותן</div><div class="rcm-choice-sub">הסר את המשימות לצמיתות</div></div>
    </button>
    <button class="rcm-close-action" onclick="closeRecalc()">ביטול</button>`;
}

function _rcDoMoveNextDay() {
  const endWeek = _endOfWeek();
  const tomorrow = ld(new Date(Date.now() + 86400000));
  if (tomorrow > endWeek) { _rcShowNoRoom(); return; }
  const slots = _findSlotsInRange(tomorrow, endWeek, _rcPendingTasks.length, [], _maxDurOf(_rcPendingTasks));
  if (!slots.length) { _rcShowNoRoom(); return; }
  const results = [];
  _rcPendingTasks.forEach((t, i) => {
    const slot = slots[i];
    if (!slot) return;
    S.tasks.push({...t, id: uid(), date: slot.date, time: slot.time, done: false, missed: false});
    results.push(`• <b>${t.course||t.name}</b> → ${slot.date} ${slot.time}`);
  });
  save(); renderAll();
  _rcShowResult(`<div style="font-size:0.82rem;text-align:right;font-weight:400">${results.join('<br>')}</div>`);
}

function _rcDoSpreadWeek(isAlternative = false) {
  if (!isAlternative) {
    window._rcIgnoredSlots = new Set();
  }
  
  let minDate = ld(new Date());
  if (_rcPendingTasks && _rcPendingTasks.length > 0) {
    if (_rcPendingTasks[0].date > minDate) {
      minDate = _rcPendingTasks[0].date;
    }
  }
  if (isAlternative) {
    // Advance by +1 day so alternative search lands on a truly different date
    const d0 = new Date(minDate + 'T12:00:00');
    d0.setDate(d0.getDate() + 1);
    minDate = ld(d0);
  }
  const today = minDate;
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  const endWeek = ld(d);
  
  const ignoreArr = Array.from(window._rcIgnoredSlots || []);
  const slots = _findSlotsInRange(today, endWeek, _rcPendingTasks.length, ignoreArr, _maxDurOf(_rcPendingTasks));
  
  if (!slots.length) {
    if (ignoreArr.length > 0) {
      // Restore the rejected tasks back to the schedule since we couldn't find alternatives
      _rcPendingTasks.forEach(t => S.tasks.push(t));
      save(); renderAll();
      alert("לא נמצאו זמנים פנויים נוספים בשבוע זה. אנא השאר מסומנות את האפשרויות שאתה רוצה, או הסר סימון כדי למחוק אותן ולחץ על 'אישור והמשך'.");
    } else {
      _rcShowNoRoom();
    }
    return;
  }
  const results = [];
  const skipped = [];
  const addedIds = [];
  _rcPendingTasks.forEach((t, i) => {
    const slot = slots[i];
    if (!slot) { 
      skipped.push(t.course||t.name);
      if (!S.deletedCollisions) S.deletedCollisions = [];
      S.deletedCollisions.push({ name: t.name, course: t.course||t.name, date: t.date, deletedAt: new Date().toISOString() });
      return; 
    }
    const newId = uid();
    addedIds.push(newId);
    S.tasks.push({...t, id: newId, date: slot.date, time: slot.time, done: false, missed: false});
    results.push(`
      <label style="background:var(--surface); border:1px solid var(--border); padding:0.6rem 0.8rem; border-radius:12px; margin-bottom:0.4rem; display:flex; gap:0.6rem; align-items:flex-start; cursor:pointer; transition:0.2s ease;">
        <input type="checkbox" class="rcm-task-cb" value="${newId}" checked style="margin-top:0.3rem; accent-color:var(--accent); width:18px; height:18px; cursor:pointer;">
        <div style="flex:1; display:flex; flex-direction:column; gap:0.4rem;">
          <div style="font-weight:800; color:var(--text); font-size:0.95rem;">${t.course||t.name}</div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="background:var(--accent-light); color:var(--accent); font-weight:800; font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:8px;">${formatPrettyDate(slot.date)}</span>
            <span style="font-family:var(--mono); font-weight:900; font-size:0.8rem; color:var(--text); background:var(--surface2); padding:0.2rem 0.5rem; border-radius:6px;">${slot.time}</span>
          </div>
        </div>
      </label>
    `);
  });
  save(); renderAll();
  
  // Add newly used slots to the global ignored set so next time we won't use them
  if (!window._rcIgnoredSlots) window._rcIgnoredSlots = new Set();
  slots.forEach(s => window._rcIgnoredSlots.add(s.date + '|' + s.time));
  
  window._rcLastSpreadState = { addedIds };
  
  const skipNote = skipped.length ? `<div style="color:var(--red); font-size:0.85rem; font-weight:700; margin-top:0.5rem;">לא נמצא מקום ל: ${skipped.join(', ')}</div>` : '';
  
  _rcShowResult(`
    <div style="font-weight:900; margin-bottom:0.8rem; font-size:1.05rem; color:var(--text);">פוזרו ${results.length} משימות:</div>
    <div>${results.join('')}</div>
    ${skipNote}
  `, 'success', true);
}

window._rcDoSpreadAlternative = function() {
  try {
    const checkboxes = Array.from(document.querySelectorAll('.rcm-task-cb'));
    if (!checkboxes.length) return;
    
    const uncheckedIds = checkboxes.filter(cb => !cb.checked).map(cb => cb.value);
    
    if (uncheckedIds.length === 0) {
      alert("אנא הורד את הסימון (V) מהמשימות שתרצה למצוא עבורן שעות אחרות.");
      return;
    }
    
    // Identify rejected tasks
    const rejectedTasks = S.tasks.filter(t => uncheckedIds.includes(t.id));
    
    // Remove rejected tasks from S.tasks
    S.tasks = S.tasks.filter(t => !uncheckedIds.includes(t.id));
    
    // The rejected tasks become the new pending tasks
    _rcPendingTasks = rejectedTasks.map(t => {
      // Revert date/time so they don't break logic, although _rcDoSpreadWeek overwrites them
      return { ...t, date: t.date, time: t.time };
    });
    
    _rcDoSpreadWeek(true);
  } catch(e) {
    alert("שגיאה בחיפוש זמנים אחרים: " + e.message);
  }
};

function _rcDoIgnore() {
  if (!S.deletedCollisions) S.deletedCollisions = [];
  const now = new Date().toISOString();
  _rcPendingTasks.forEach(t => {
    S.deletedCollisions.push({ name: t.name, course: t.course||t.name, date: t.date, deletedAt: now });
  });
  save(); renderAll();
  _rcShowResult(`🗑️ ${_rcPendingTasks.length} משימות הוסרו מהלו"ז.`, 'deleted');
}

// Morning mode — tasks exist in S.tasks as missed, we reschedule them
function _rcDoRescheduleMissed(mode) {
  const today = ld(new Date());
  const endWeek = _endOfWeek();
  const searchFrom = mode === 'tomorrow' ? ld(new Date(Date.now()+86400000)) : today;
  const slots = _findSlotsInRange(searchFrom, endWeek, _rcPendingTasks.length, [], _maxDurOf(_rcPendingTasks));
  if (!slots.length) { _rcShowNoRoom(); return; }
  const results = [];
  _rcPendingTasks.forEach((t, i) => {
    const slot = slots[i];
    if (!slot) return;
    t.date = slot.date; t.time = slot.time; t.missed = false; delete t.missedReason;
    results.push(`• <b>${t.course||t.name}</b> → ${slot.date} ${slot.time}`);
  });
  _rcPendingTasks = [];
  save(); renderAll();
  _rcShowResult(`📅 ${results.length} משימות שובצו מחדש:<br><br><div style="font-size:0.82rem;text-align:right;font-weight:400">${results.join('<br>')}</div>`);
}

function _rcDoMarkMissed() {
  const count = _rcPendingTasks.length;
  _rcPendingTasks = [];
  _rcShowResult(`📌 ${count} משימות נשארות כפוספסות.`, 'deleted');
}

function _rcProceedWithAvailable() {
  const ctx = _rcCapacityCtx;
  if (!ctx) { closeRecalc(); return; }
  const perWeek = +(ctx.available / Math.max(1, ctx.weeks)).toFixed(1);
  const el = document.getElementById('pl-hours');
  if (el) el.value = perWeek;
  closeRecalc();
  setTimeout(() => generatePlan(), 150);
}

function _rcFreeFromCourse(course) {
  const removed = S.tasks.filter(t => t.course === course && !t.done).length;
  S.tasks = S.tasks.filter(t => !(t.course === course && !t.done));
  save(); renderAll(); closeRecalc();
  toast(` הוסרו ${removed} משימות מ-"${course}"`);
  setTimeout(() => generatePlan(), 200);
}

function openRecalcForCollision(anchor, tasks) {
  _rcPendingTasks = tasks;
  openRecalc('collision');
  const totalMins = tasks.reduce((sum,t)=>sum+parseInt(t.duration||90),0);
  const taskList = tasks.map(t =>
    `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.03); padding:0.8rem 1rem; border-radius:12px; margin-bottom:0.4rem; border:1px solid rgba(0,0,0,0.02);">
      <span style="font-weight:800; color:var(--text); font-size:1rem;">${t.course||t.name}</span>
      <span style="display:inline-flex; align-items:center; gap:0.4rem;">
        <span style="background:var(--accent-light); color:var(--accent); font-weight:800; font-size:0.8rem; padding:0.2rem 0.6rem; border-radius:8px;">${formatPrettyDate(t.date)}</span>
        <span style="font-family:var(--mono); font-weight:900; font-size:0.85rem; color:var(--text); background:white; padding:0.2rem 0.6rem; border-radius:8px; border:1px solid var(--border);">${t.time||''}</span>
      </span>
    </div>`
  ).join('');
  document.getElementById('recalc-chat').innerHTML = `
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:1.2rem; margin-bottom:1rem; box-shadow:0 8px 24px rgba(0,0,0,0.04);">
      <div style="font-size:1.1rem; font-weight:900; color:var(--text); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; line-height:1.3;">
        <span style="background:var(--orange-light); color:var(--orange); padding:0.4rem; border-radius:10px; display:flex; align-items:center; justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
        <span>העוגן <strong style="color:var(--brand)">"${anchor.name}"</strong> נדרס עם ${tasks.length} משימ${tasks.length===1?'ה':'ות'}</span>
      </div>
      <div>${taskList}</div>
      <div style="margin-top:1rem; color:var(--muted); font-size:0.85rem; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
        <span>סה"כ זמן שנדרס</span>
        <span style="background:var(--surface2); padding:0.2rem 0.6rem; border-radius:6px;">~${Math.round(totalMins/60*10)/10} שעות</span>
      </div>
    </div>
    <div style="font-size:1.15rem; font-weight:900; color:var(--text); text-align:center; margin-bottom:1rem; margin-top:0.5rem;">מה לעשות עם המשימות שנדרסו?</div>`;

  // Check what's actually available over the next 7 days from the collision date
  let minDate = ld(new Date());
  if (tasks.length > 0 && tasks[0].date > minDate) {
    minDate = tasks[0].date;
  }
  const today = minDate;
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() + 6); // 7 day window
  const endWeek = ld(d);

  const tomorrow = ld(new Date(Date.now() + 86400000));
  const weekSlots = _findSlotsInRange(today, endWeek, tasks.length, [], _maxDurOf(tasks));
  const canSpread = weekSlots.length > 0;

  const spreadBtn = canSpread ? `
    <button class="rcm-choice-btn rcm-choice-green" onclick="_rcDoSpreadWeek()">
      <div class="rcm-choice-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
      <div class="rcm-choice-text"><div class="rcm-choice-title">פזר בשבוע שלאחר המשימה</div><div class="rcm-choice-sub" dir="rtl">בין ה-<span dir="ltr">${formatPrettyDate(today)}</span> ל-<span dir="ltr">${formatPrettyDate(endWeek)}</span> — ${weekSlots.length} חלונות פנויים</div></div>
    </button>` : '';

  const noRoomNote = !canSpread
    ? `<div class="rcm-result deleted" style="margin-bottom:0.4rem"><span class="rcm-result-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span><span>הלוז מלא בשבוע הקרוב — אפשר רק למחוק</span></div>` : '';

  document.getElementById('recalc-actions-zone').innerHTML = `
    ${noRoomNote}
    ${spreadBtn}
    <button class="rcm-choice-btn rcm-choice-red" onclick="_rcDoIgnore()">
      <div class="rcm-choice-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></div>
      <div class="rcm-choice-text"><div class="rcm-choice-title">מחק אותן</div><div class="rcm-choice-sub">הסר את המשימות לצמיתות (ייכלל בסיכום שבועי)</div></div>
    </button>`;
}

function openCapacityNegotiation(course, requested, available, examDate, slotsText, perWeek, weeks) {
    _rcCapacityCtx = { course, requested, available, examDate, perWeek, weeks };
    openRecalc('capacity');
    const deficit = (requested - available).toFixed(1);
    const chat = document.getElementById('recalc-chat');
    const availPerWeek = perWeek && weeks ? ` (${(available/weeks).toFixed(1)} שעות/שבוע)` : '';
    const weekBreakdown = perWeek && weeks ? `<small> (${perWeek} שעות/שבוע × ${weeks} שבועות)</small>` : '';
    chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">️ <b>אין מספיק מקום!</b><br><br>ביקשת <b>${requested.toFixed(0)} שעות</b> ל-"${course}"${weekBreakdown},<br>אבל יש רק <b>${available.toFixed(1)} שעות פנויות</b>${availPerWeek} עד ${examDate}.<br><b>מחסור: ${deficit} שעות.</b><br><br>בחר אפשרות:</div></div>`;
    const otherCourses = [...new Set(S.tasks.filter(t => t.course !== course && !t.done && t.date >= ld(new Date())).map(t => t.course))];
    window._rcOtherCourses = otherCourses;
    const otherBtns = otherCourses.map((c, i) => {
      const cnt = S.tasks.filter(t=>t.course===c&&!t.done&&t.date>=ld(new Date())).length;
      return `<button class="rc-action-btn rc-orange" onclick="_rcFreeFromCourse(window._rcOtherCourses[${i}])"> פנה שעות מ-"${c}" (${cnt} משימות)</button>`;
    }).join('');
    const zone = document.getElementById('recalc-actions-zone');
    zone.innerHTML = `
      <button class="rc-action-btn rc-blue" onclick="_rcProceedWithAvailable()"> תכנן עם ${available.toFixed(1)} שעות פנויות${availPerWeek}</button>
      ${otherBtns}
      <button class="rc-action-btn rc-muted" onclick="closeRecalc()">ביטול</button>`;
}

function openRecalc(mode = 'collision') {
    document.getElementById('recalc-overlay').classList.remove('hidden');
    document.getElementById('recalc-chat').innerHTML = '';
    document.getElementById('recalc-actions-zone').innerHTML = '';
    currentChatMode = mode;
    const title = document.getElementById('chat-header-title');
    const sub = document.getElementById('chat-header-sub');
    const icon = document.getElementById('rcm-icon');
    if (mode === 'collision') {
        if (title) title.textContent = 'התנגשות בלו"ז';
        if (sub) sub.textContent = 'משימות שנדרסו על ידי עוגן';
        if (icon) icon.textContent = '⚠️';
        return;
    }
    if (mode === 'morning') {
        if (title) title.textContent = 'משימות לא גמורות';
        if (sub) sub.textContent = 'מה לעשות עם המשימות מהימים האחרונים?';
        if (icon) icon.textContent = '📋';
        return;
    }
    if (mode === 'capacity') {
        if (title) title.textContent = 'אין מספיק שעות';
        if (sub) sub.textContent = 'בחר איך לחלק את הזמן הפנוי';
        if (icon) icon.textContent = '📊';
        return;
    }
    // Legacy modes (weekly/exam/schedule/holiday) — close silently, no AI in free version
    document.getElementById('recalc-overlay').classList.add('hidden');
}
function closeRecalc() { document.getElementById('recalc-overlay').classList.add('hidden'); renderAll(); }
function _isRecalcConflict(t) {
    if (!t.date || !t.time) return false;
    const taskDay = new Date(t.date + 'T12:00:00').getDay();
    const tst = parseInt((t.time||'00:00').split(':')[0])*60 + parseInt((t.time||'00:00').split(':')[1]);
    const dur = parseInt(String(t.duration||'').match(/\d+/)?.[0] || 60);
    const anchorConflict = (S.anchors||[]).some(a => {
        if (parseInt(a.day) !== taskDay) return false;
        if (a.endDate && t.date > a.endDate) return false;
        if (a.oneTimeDate && a.oneTimeDate !== t.date) return false;
        const ast = parseInt((a.start||'00:00').split(':')[0])*60 + parseInt((a.start||'00:00').split(':')[1]) - (a.travelMin||0);
        const aen = parseInt((a.end||'00:00').split(':')[0])*60 + parseInt((a.end||'00:00').split(':')[1]) + (a.travelMin||0);
        return tst < aen && (tst + dur) > ast;
    });
    return anchorConflict || S.tasks.some(old => old.date === t.date && old.time === t.time && !old.done && !old.missed);
}

function _doApplyRecalcActions(cid, skipConflicts) {
    if (!pendingRecalcActions?.length) return;
    const tasks = skipConflicts
        ? pendingRecalcActions.filter(t => !_isRecalcConflict(t))
        : pendingRecalcActions;
    tasks.forEach(t => { S.tasks.push({...t, id: uid(), name: t.course || t.name, done: false, missed: false}); });
    const count = tasks.length;
    pendingRecalcActions = null;
    if (cid) document.getElementById(cid)?.remove();
    save(); renderAll();
    toast(` ${count} משימות נוספו ללו"ז!`);
}

function applyPendingRecalcActions(cid) {
    if (!pendingRecalcActions?.length) { toast('אין פעולות ממתינות'); return; }
    const conflicts = pendingRecalcActions.filter(_isRecalcConflict);
    if (!conflicts.length) { _doApplyRecalcActions(cid, false); return; }
    // Show resolution buttons in-app — no browser confirm()
    const el = document.getElementById(cid);
    const nonCount = pendingRecalcActions.length - conflicts.length;
    const conflictList = conflicts.map(t => `• <b>${t.course||t.name}</b> — ${formatPrettyDate(t.date)} ${t.time}`).join('<br>');
    const resolveHtml = `
        <div style="font-size:0.85rem">️ <b>${conflicts.length} משימות מתנגשות עם לו"ז קיים:</b>
          <div style="font-size:0.78rem;margin:0.35rem 0 0.75rem;color:var(--muted)">${conflictList}</div>
        </div>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;justify-content:flex-end">
          <button onclick="document.getElementById('${cid}').remove();pendingRecalcActions=null;toast(' בוטל')"
            style="background:var(--surface2);color:var(--muted);border:1px solid var(--border);padding:0.45rem 0.9rem;border-radius:8px;font-weight:700;cursor:pointer;font-family:var(--sans);font-size:0.82rem"> בטל</button>
          ${nonCount>0?`<button onclick="_doApplyRecalcActions('${cid}',true)"
            style="background:var(--accent-light);color:var(--accent);border:1.5px solid var(--accent);padding:0.45rem 0.9rem;border-radius:8px;font-weight:700;cursor:pointer;font-family:var(--sans);font-size:0.82rem">הוסף ${nonCount} ללא מתנגשות</button>`:''}
          <button onclick="_doApplyRecalcActions('${cid}',false)"
            style="background:var(--green);color:white;border:none;padding:0.45rem 0.9rem;border-radius:8px;font-weight:700;cursor:pointer;font-family:var(--sans);font-size:0.82rem">הוסף הכל (דרוס ${conflicts.length})</button>
        </div>`;
    if (el) el.querySelector('.chat-bubble').innerHTML = resolveHtml;
    else _doApplyRecalcActions(cid, false);
}


// ── PSYCHOLOGIST BOT REMOVED (Free version - no AI) ──
function openPsychologist() { /* removed */ }
function sendPsych() { /* removed */ }


// ══════════════════════════════════════════
// HOBBY / PERSONAL GOALS — FULL PAGE
// ══════════════════════════════════════════

let _hobbyActiveIdx = 0;

function openHobbyPlanner() { showPage('hobby', null); }

function renderHobbyPage() {
  if (!S.hobbies) S.hobbies = [];
  const hobbies = S.hobbies;
  const elEmpty = document.getElementById('hp-empty');
  const elSetup = document.getElementById('hp-setup');
  const elMain  = document.getElementById('hp-main');
  if (!elEmpty) return;

  if (hobbies.length === 0) {
    elEmpty.classList.remove('hidden');
    elSetup.classList.add('hidden');
    elMain.classList.add('hidden');
    return;
  }
  elEmpty.classList.add('hidden');
  elSetup.classList.add('hidden');
  elMain.classList.remove('hidden');
  if (_hobbyActiveIdx >= hobbies.length) _hobbyActiveIdx = 0;
  _hpRenderTabs();
  _hpRenderHobby(_hobbyActiveIdx);
}

function _hpShowSetup() {
  document.getElementById('hp-empty').classList.add('hidden');
  document.getElementById('hp-setup').classList.remove('hidden');
  document.getElementById('hp-main').classList.add('hidden');
  document.getElementById('hp-setup-name').value = '';
  document.getElementById('hp-setup-goal').value = '';
}

function _hpShowEmpty() {
  if ((S.hobbies || []).length === 0) {
    document.getElementById('hp-empty').classList.remove('hidden');
    document.getElementById('hp-setup').classList.add('hidden');
  } else {
    renderHobbyPage();
  }
}

function hpCreateHobby() {
  const name = document.getElementById('hp-setup-name').value.trim();
  const goal = document.getElementById('hp-setup-goal').value.trim();
  const timesPerWeek = Math.max(1, parseInt(document.getElementById('hp-setup-freq').value) || 2);
  const dur = Math.min(180, Math.max(15, parseInt(document.getElementById('hp-setup-dur').value) || 30));
  const level = document.getElementById('hp-setup-level')?.value || 'מתחיל';
  const motivation = document.getElementById('hp-setup-motivation')?.value.trim() || '';
  if (!name) { toast('הכנס שם לתחביב/מטרה'); return; }
  if (!goal) { toast('הכנס מטרה ברורה'); return; }
  if (!S.hobbies) S.hobbies = [];
  S.hobbies.push({ id: uid(), name, goal, timesPerWeek, sessionDuration: dur,
    level, motivation, createdDate: ld(new Date()), lastCheckIn: null, history: [] });
  _hobbyActiveIdx = S.hobbies.length - 1;
  save();
  renderHobbyPage();
}

function _hpRenderTabs() {
  const wrap = document.getElementById('hp-tabs');
  if (!wrap) return;
  wrap.innerHTML = (S.hobbies || []).map((h, i) =>
    `<button class="hp-tab${i===_hobbyActiveIdx?' active':''}" onclick="_hpSelectTab(${i})">${h.name}</button>`
  ).join('') + `<button class="hp-tab hp-tab-new" onclick="_hpShowSetup()">+ חדשה</button>`;
}

function _hpSelectTab(idx) {
  _hobbyActiveIdx = idx;
  _hpRenderTabs();
  _hpRenderHobby(idx);
}

function _hpRenderHobby(idx) {
  const hobby = (S.hobbies || [])[idx];
  if (!hobby) return;
  const done = S.tasks.filter(t => t.course === hobby.name && t.done).length;
  const upcoming = S.tasks
    .filter(t => t.course === hobby.name && !t.done && !t.missed && t.date >= ld(new Date()))
    .sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''));

  // Hero stats
  const el = id => document.getElementById(id);
  if (el('hp-hero-name')) el('hp-hero-name').textContent = hobby.name;
  if (el('hp-hero-goal')) el('hp-hero-goal').textContent = hobby.goal;
  if (el('hp-sessions-count')) el('hp-sessions-count').textContent = done;
  if (el('hp-freq-count')) el('hp-freq-count').textContent = hobby.timesPerWeek + ' פעמים/שבוע';
  const _hpLabel = _hobbyLabel(hobby.name);
  if (el('hp-label-sessions')) el('hp-label-sessions').textContent = _hpLabel;
  if (el('hp-label-button'))   el('hp-label-button').textContent   = _hpLabel;
  if (el('hp-next-date')) {
    if (upcoming[0]) {
      const dParts = upcoming[0].date.split('-');
      const dStr = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}` : upcoming[0].date;
      el('hp-next-date').innerHTML = `<div style="font-size:1.25rem; line-height:1;">${dStr}</div>` + 
        (upcoming[0].time ? `<div style="font-size:0.75rem; margin-top:4px; font-weight:700; opacity:0.85; letter-spacing:0.5px;">${upcoming[0].time}</div>` : '');
    } else {
      el('hp-next-date').innerHTML = '<div style="font-size:1.25rem; line-height:1;">—</div>';
    }
  }

  _hpRenderTrack(hobby, done);
  _hpRenderInsight(hobby, done);

  // Upcoming list
  const upList = el('hp-upcoming-list');
  if (upList) {
    upList.innerHTML = upcoming.length === 0
      ? `<div style="font-size:0.82rem;color:var(--muted);text-align:center;padding:0.5rem 0">לחץ "מצא לי זמן" כדי לתזמן אימונים</div>`
      : upcoming.slice(0,5).map(t => {
          const days = Math.ceil((new Date(t.date) - new Date()) / 86400000);
          const badge = days === 0 ? 'היום!' : days === 1 ? 'מחר' : `בעוד ${days} ימים`;
          return `<div class="hp-session-row">
            <div class="hp-session-dot" style="background:${getCourseColor(hobby.name)}"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.95rem;font-weight:900;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</div>
              <div style="font-size:0.8rem;color:var(--muted);font-weight:700">${formatPrettyDate(t.date)}${t.time?' · '+t.time:''} · ${t.duration||hobby.sessionDuration+' דק\''}</div>
            </div>
            <span style="font-size:0.85rem;font-weight:900;color:var(--accent);background:var(--accent-light);padding:4px 8px;border-radius:8px;white-space:nowrap">${badge}</span>
          </div>`;
        }).join('');
  }

  // Chat — only re-render if switching hobbies
  const chat = el('hp-chat');
  if (chat && chat.dataset.hobbyId !== hobby.id) {
    chat.dataset.hobbyId = hobby.id;
    chat.innerHTML = (hobby.history || []).filter(m => m.role !== 'system').map(m =>
      `<div class="chat-msg ${m.role==='user'?'user':'ai'}"><div class="chat-bubble">${m.content.replace(/\n/g,'<br>')}</div></div>`
    ).join('');

    chat.scrollTop = chat.scrollHeight;
  }
}

function _hobbyEmoji(name) {
  if (!name) return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>';
  const n = name.toLowerCase();
  // Running
  if (/ריצה|ג'וגינג|מרוץ/.test(n)) return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.53 10.53L12 7l-4.5 4.5"></path><path d="M7 16l4.5-4.5"></path><path d="M12 7l1.5-2.5"></path><circle cx="14" cy="4" r="2"></circle><path d="M16 14l3.5-3.5"></path><path d="M12 21v-5l-4-4"></path></svg>';
  // Swimming
  if (/שחייה|בריכה/.test(n)) return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"></path><path d="M12 4A4 4 0 0 0 8 8"></path><circle cx="16" cy="6" r="2"></circle></svg>';
  // Yoga
  if (/יוגה|מדיטציה|מיינדפולנס/.test(n)) return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14c2 0 4-1.5 4-3.5S14 7 12 7s-4 1.5-4 3.5S10 14 12 14z"></path><path d="M12 14v7"></path><path d="M9 21h6"></path><circle cx="12" cy="4" r="2"></circle><path d="M15 11l3 3"></path><path d="M9 11l-3 3"></path></svg>';
  // Sports
  if (/כדורגל|כדורסל|כדורעף|טניס|ספורט/.test(n)) return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 0 20"></path><path d="M2 12h20"></path></svg>';
  // Music
  if (/גיטרה|בס|מוזיקה|פסנתר|כינור|תוף/.test(n)) return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
  // Art
  if (/ציור|אמנות|יצירה|קרמיקה/.test(n)) return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.08 0 2-.92 2-2 0-.52-.22-1-.58-1.41a1 1 0 0 1 .17-1.42A2 2 0 0 1 15 17h1.5A5.5 5.5 0 0 0 22 11.5C22 6.25 17.5 2 12 2z"></path><circle cx="6.5" cy="10.5" r="1.5"></circle><circle cx="10.5" cy="5.5" r="1.5"></circle><circle cx="15.5" cy="7.5" r="1.5"></circle></svg>';
  // Language
  if (/ספרדית|צרפתית|אנגלית|שפה|ערבית/.test(n)) return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  // Default
  return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';
}

// Category-aware noun for hobby UI strings (e.g., "0 ___" stat label, "find time for ___" CTA).
// Mirrors the regex classification approach used in _hobbyEmoji.
function _hobbyLabel(name) {
  if (!name) return 'מפגשים';
  const n = name.toLowerCase();
  if (/קריאה|ספרים|ספר/.test(n)) return 'מפגשי קריאה';
  if (/בישול|אפייה|מתכון/.test(n)) return 'מפגשי בישול';
  if (/גיימינג|משחקים|משחק|gaming|game/.test(n)) return 'סשנים';
  if (/גיטרה|בס|מוזיקה|פסנתר|כינור|תוף/.test(n)) return 'שיעורי תרגול';
  if (/ציור|אמנות|יצירה|קרמיקה/.test(n)) return 'מפגשי יצירה';
  if (/ריצה|ג'וגינג|מרוץ|שחייה|בריכה|יוגה|מדיטציה|מיינדפולנס|כדורגל|כדורסל|כדורעף|טניס|ספורט/.test(n)) return 'אימונים';
  return 'מפגשים';
}

function _hpRenderInsight(hobby, done) {
  const wrap = document.getElementById('hp-motivation-card');
  if (!wrap) return;

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = typeof ld==='function'?ld(weekStart):weekStart.toISOString().split('T')[0];
  const doneThisWeek = (S.tasks || []).filter(t => t.course === hobby.name && t.done && t.date >= weekStartStr).length;
  const target = hobby.timesPerWeek || 2;
  const weekPct = Math.min(100, Math.round((doneThisWeek / target) * 100));
  const barColor = weekPct >= 100 ? 'var(--green)' : weekPct >= 50 ? 'var(--accent)' : 'var(--yellow)';

  // Modern UI for insight
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.25rem">
      <div style="display:flex;align-items:center;gap:1rem;">
        <div style="width:4.5rem;height:4.5rem;border-radius:18px;background:linear-gradient(135deg, var(--surface), var(--accent-light));color:var(--accent);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 24px rgba(79,110,247,0.15);border:1px solid rgba(255,255,255,0.5);">
          ${_hobbyEmoji(hobby.name)}
        </div>
        <div style="flex:1;">
          <div style="font-size:0.85rem;color:var(--muted);font-weight:800;letter-spacing:0.02em;margin-bottom:0.15rem">מטרת העל שלך</div>
          <div style="font-size:1.15rem;font-weight:900;color:var(--text);line-height:1.2">${hobby.goal || 'פיתוח מיומנות אישית'}</div>
        </div>
      </div>
      
      <div style="background:var(--surface2);border-radius:16px;padding:1rem;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:0.75rem;color:var(--muted);font-weight:800">יעד שבועי</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--text)">${target} <span style="font-size:0.8rem;color:var(--muted)">אימונים</span></div>
        </div>
        <div style="width:1px;height:30px;background:var(--border)"></div>
        <div>
          <div style="font-size:0.75rem;color:var(--muted);font-weight:800">בוצע השבוע</div>
          <div style="font-size:1.1rem;font-weight:900;color:${weekPct>=100?'var(--green)':'var(--accent)'}">${doneThisWeek} <span style="font-size:0.8rem;color:var(--muted)">אימונים</span></div>
        </div>
        <div style="width:1px;height:30px;background:var(--border)"></div>
        <div>
          <div style="font-size:0.75rem;color:var(--muted);font-weight:800">השלמה</div>
          <div style="font-size:1.1rem;font-weight:900;color:${weekPct>=100?'var(--green)':'var(--accent)'}">${weekPct}%</div>
        </div>
      </div>
      
      <div style="background:var(--surface2);border-radius:12px;height:12px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,0.05)">
        <div style="background:linear-gradient(90deg, var(--accent), ${barColor});width:${weekPct}%;height:100%;border-radius:12px;transition:width 0.8s cubic-bezier(0.34,1.56,0.64,1)"></div>
      </div>
      <div style="font-size:0.85rem;color:var(--muted);font-weight:800;text-align:center;">
        ${weekPct >= 100 ? 'השגת את היעד השבועי! כל הכבוד! 🔥' : weekPct > 0 ? 'אתה בדרך הנכונה! המשך כך. 💪' : 'עוד לא התחלת השבוע. זה הזמן! 🚀'}
      </div>
    </div>
  `;
}

function _hpRenderTrack(hobby, done) {
  const wrap = document.getElementById('hp-track');
  if (!wrap) return;
  const spw = hobby.timesPerWeek || 3;
  const ms = [
    { emoji:'🌱', label:'התחלה',       req:0,                    color:'#94a3b8' },
    { emoji:'⚡', label:'שבוע ראשון',  req:spw,                  color:'#6366f1' },
    { emoji:'🔥', label:'חודש ראשון',  req:Math.round(spw*4),    color:'#f59e0b' },
    { emoji:'💪', label:'עוצמה',       req:Math.round(spw*8),    color:'#ef4444' },
    { emoji:'🏆', label:'מתקדם',       req:Math.round(spw*12),   color:'#8b5cf6' },
    { emoji:'🎯', label: hobby.goal ? hobby.goal.slice(0,14) : 'המטרה', req:Math.round(spw*16), color:'#10b981' },
  ];
  const curIdx = [...ms].map((m,i)=>i).reverse().find(i => done >= ms[i].req) ?? 0;
  const cur = ms[curIdx];
  const next = ms[curIdx + 1];
  const segDone = next ? done - cur.req : done;
  const segTotal = next ? next.req - cur.req : cur.req || 1;
  const segPct = Math.min(100, next ? (segDone / segTotal) * 100 : 100);
  const overallPct = Math.min(100, done / (ms[ms.length-1].req || 1) * 100);

  wrap.innerHTML = `
    <div class="hpt-header">
      <div class="hpt-level-badge" style="background:${cur.color}20;color:${cur.color};border-color:${cur.color}40">
        <span class="hpt-emoji">${cur.emoji}</span>
        <span>${cur.label}</span>
      </div>
      <div class="hpt-count">${done} פעילויות</div>
    </div>
    <div class="hpt-bar-wrap">
      <div class="hpt-bar-bg">
        <div class="hpt-bar-fill" style="width:${overallPct.toFixed(1)}%;background:${cur.color}"></div>
      </div>
      <span class="hpt-pct">${overallPct.toFixed(0)}%</span>
    </div>
    ${next ? `<div class="hpt-next">
      <span>הצעד הבא: <b>${next.emoji} ${next.label}</b></span>
      <span class="hpt-next-count">${Math.max(0, next.req - done)} פעילויות נותרו</span>
    </div>` : `<div class="hpt-done-msg">הגעת למטרה! כל הכבוד</div>`}
    <div class="hpt-steps">
      ${ms.map((m,i) => {
        const reached = done >= m.req;
        const isCur = i === curIdx;
        return `<div class="hpt-step${reached?' hpt-reached':''}${isCur?' hpt-cur':''}">
          <div class="hpt-step-dot" style="${reached||isCur?`background:${m.color};border-color:${m.color}`:''}">
            ${reached || isCur ? m.emoji : ''}
          </div>
          <div class="hpt-step-lbl">${m.label}</div>
        </div>`;
      }).join('')}
    </div>`;
}

async function _hpStartCoach(idx) {
  const hobby = (S.hobbies || [])[idx];
  const chat = document.getElementById('hp-chat');
  if (!chat || !hobby) return;
  hobby.history = hobby.history || [];

  const levelNote = hobby.level ? ` הרמה הנוכחית שלהם: ${hobby.level}.` : '';
  const motivNote = hobby.motivation ? ` מוטיבציה: "${hobby.motivation}".` : '';
  const sys = `אתה מאמן אישי נלהב לתחביבים ומטרות אישיות. שמך "מאמן".
סטודנט: ${S.userName}. מטרה: "${hobby.name}" — ${hobby.goal}.${levelNote}${motivNote}
תדירות: ${hobby.timesPerWeek} פעמים בשבוע. כל אימון: ${hobby.sessionDuration} דקות.
חוקים: (1) בנה תוכנית ספציפית לפי רמה ומוטיבציה (2) בצ'ק-אין שבועי — נתח, שבח, עדכן (3) כשמציע אימונים — החזר JSON: {"tasks":[{"name":"...","duration":30},...]} (4) עברית חמה, עד 120 מילה.`;
  const levelGreet = hobby.level === 'מתחיל' ? 'מוכן להתחיל מהבסיס ולבנות אט-אט' :
    hobby.level === 'מתקדם' ? 'כבר יש לך בסיס — נגביר את עצימות האימונים' :
    'יש לך קצת ניסיון — נמשיך ונפתח מהנקודה שלך';
  const motGreet = hobby.motivation ? ` אני שמח שאתה פועל בגלל: "${hobby.motivation}" — זה יעזור להישאר ממוקד!` : '';
  const opener = `היי ${S.userName}!  מעולה שהחלטת לעבוד על "${hobby.name}".\n${levelGreet}.${motGreet}\nבוא נבנה תוכנית ממוקדת — מה האתגר הכי גדול שאתה צופה?`;

  hobby.history.push({ role:'system', content:sys });
  hobby.history.push({ role:'assistant', content:opener });
  hobby.lastCheckIn = ld(new Date());
  save();
  chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${escapeHtml(opener).replace(/\n/g,'<br>')}</div></div>`;
  chat.scrollTop = chat.scrollHeight;
}

async function sendHobbyPageMessage() {
  const inp = document.getElementById('hp-input');
  const msg = inp?.value?.trim();
  if (!msg) return;
  inp.value = '';
  const hobby = (S.hobbies || [])[_hobbyActiveIdx];
  if (!hobby) return;

  const chat = document.getElementById('hp-chat');
  chat.innerHTML += `<div class="chat-msg user"><div class="chat-bubble">${escapeHtml(msg)}</div></div><div class="chat-msg ai" id="hp-loading"><div class="chat-bubble"><span class="ai-thinking">המאמן חושב...</span></div></div>`;
  chat.scrollTop = chat.scrollHeight;

  hobby.history = hobby.history || [];
  hobby.history.push({ role:'user', content:msg });
  if (hobby.history.length > 24) hobby.history = [hobby.history[0], ...hobby.history.slice(-22)];

  try {
    const ans = await callAI({ messages: hobby.history, temperature: 0.72 });
    hobby.history.push({ role:'assistant', content:ans });
    hobby.lastCheckIn = ld(new Date());
    save();
    document.getElementById('hp-loading')?.remove();

    let display = ans;
    let pendingTasks = null;
    try {
      const m = ans.match(/\{[\s\S]*?"tasks"\s*:\s*\[[\s\S]*?\]\s*\}/);
      if (m) { const p = JSON.parse(m[0]); if (p.tasks?.length) { pendingTasks = p.tasks; display = ans.replace(m[0],'').trim(); } }
    } catch(_) {}

    chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${escapeHtml(display).replace(/\n/g,'<br>')}</div></div>`;

    if (pendingTasks) {
      hobby._pendingTasks = pendingTasks;
      save();
      chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble hp-task-suggest">
        <div style="font-weight:700;color:var(--accent);margin-bottom:0.4rem">המאמן מציע ${pendingTasks.length} אימונים:</div>
        ${pendingTasks.map(t=>`<div style="font-size:0.82rem">• ${t.name} (${t.duration||hobby.sessionDuration} דק')</div>`).join('')}
        <button class="hp-add-btn" onclick="hpConfirmAddTasks()" style="background:var(--accent);color:white;border:none;box-shadow:0 4px 14px rgba(79,110,247,0.3);width:100%;border-radius:12px;padding:0.8rem;font-weight:900;margin-top:0.5rem">הוסף אימונים אלו ללו"ז שלי</button>
      </div></div>`;
    }
    chat.scrollTop = chat.scrollHeight;
    _hpRenderHobby(_hobbyActiveIdx);
  } catch(e) {
    document.getElementById('hp-loading')?.remove();
    chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble" style="color:var(--red)">שגיאה: ${e.message}</div></div>`;
  }
}

function hpConfirmAddTasks() {
  const hobby = (S.hobbies || [])[_hobbyActiveIdx];
  if (!hobby?._pendingTasks) return;
  const today = new Date(); const n = hobby._pendingTasks.length;
  const times = ['09:00','14:00','17:00','19:00','21:00'];
  // Limit to current week (today → Saturday)
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + (6 - today.getDay()));
  const remainingDays = Math.max(1, Math.ceil((weekEnd - today) / 86400000));
  const _placed = [];
  let added = 0;
  hobby._pendingTasks.forEach((t, i) => {
    const d = new Date(today);
    const offset = Math.round((i + 0.5) * remainingDays / n);
    d.setDate(today.getDate() + Math.min(offset, remainingDays));
    if (d.getDay() === 6) d.setDate(d.getDate() - 1); // skip Saturday
    const dateStr = ld(d);
    const durMins = parseInt(String(t.duration||hobby.sessionDuration||45).match(/\d+/)?.[0] || 45);
    // Route through findBestFreeSlot so hobbies avoid anchors + existing tasks (collision-safe)
    let timeStr = times[i%times.length];
    if (typeof findBestFreeSlot === 'function') {
      const slot = findBestFreeSlot(dateStr, [...S.tasks, ..._placed], durMins + 10, { min: 9*60, max: timeToMins(S.sleepTime||'22:00') });
      if (slot === null) return; // no free window that day — skip rather than overlap
      timeStr = minsToTime(slot);
    }
    const newTask = { id:uid(), name:hobby.name, course:hobby.name, date:dateStr, time:timeStr,
      duration:`${t.duration||hobby.sessionDuration} דק'`, priority:'בינוני', done:false, missed:false };
    S.tasks.push(newTask); _placed.push(newTask); added++;
  });
  hobby._pendingTasks = null;
  save(); renderAll(); _hpRenderHobby(_hobbyActiveIdx);
  toast(added ? ` נוספו ${added} פעילויות "${hobby.name}" ללו"ז!` : 'לא נמצאו זמנים פנויים לאימונים השבוע');
}

async function findHobbySlots() {
  const hobby = (S.hobbies || [])[_hobbyActiveIdx];
  if (!hobby) return;
  const btn = document.getElementById('hp-find-slots-btn');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ai-thinking">מחפש...</span>'; }

  try {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      days.push(typeof ld==='function'?ld(d):d.toISOString().split('T')[0]);
    }
    const existingTasks = [...(S.tasks || [])];
    const duration = hobby.sessionDuration || 45;
    const blockNeed = duration + 15;
    const _sleepMax = (typeof timeToMins==='function' && S.sleepTime) ? timeToMins(S.sleepTime) : 22 * 60;
    const prefRange = { min: 14 * 60, max: _sleepMax > 14 * 60 ? _sleepMax : 22 * 60 };
    const newTasks = [];
    let sessionsLeft = hobby.timesPerWeek || 2;

    for (const date of days) {
      if (sessionsLeft <= 0) break;
      const slot = typeof findBestFreeSlot==='function' ? findBestFreeSlot(date, [...existingTasks, ...newTasks], blockNeed, prefRange) : null;
      if (slot !== null) {
        newTasks.push({
          id: typeof uid==='function'?uid():Math.random().toString(), 
          name: hobby.name, course: hobby.name,
          date, time: typeof minsToTime==='function'?minsToTime(slot):'15:00', duration: `${duration} דק'`,
          priority: 'בינוני', done: false, missed: false
        });
        sessionsLeft--;
      }
    }

    if (!newTasks.length) {
      if(typeof toast==='function')toast('לא מצאתי זמנים פנויים השבוע — נסה להוסיף ידנית');
      return;
    }

    // Show approval modal
    const overlay = document.createElement('div');
    overlay.id = 'hobby-approve-slots-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
    
    const selectedSlots = new Array(newTasks.length).fill(true);

    const renderTasksHtml = () => newTasks.map((t, idx) => {
      const isSelected = selectedSlots[idx];
      const bg = isSelected ? 'var(--brand)' : 'var(--surface2)';
      const color = isSelected ? '#fff' : 'var(--text)';
      const accent = isSelected ? 'rgba(255,255,255,0.9)' : 'var(--accent)';
      const checkIcon = isSelected 
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' 
        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>';
      
      return `<div class="hp-slot-toggle" data-idx="${idx}" style="background:${bg}; color:${color}; padding:0.9rem; border-radius:14px; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all 0.15s ease; user-select:none;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          ${checkIcon}
          <div style="font-size:1.05rem; font-weight:800;">${typeof formatPrettyDate==='function'?formatPrettyDate(t.date):t.date}</div>
        </div>
        <div style="color:${accent}; font-weight:700;">${t.time} (${t.duration})</div>
      </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--surface);width:90%;max-width:440px;border-radius:24px;padding:1.5rem;box-shadow:0 24px 48px rgba(0,0,0,0.2);display:flex;flex-direction:column;gap:1.2rem;animation:slideUpFadeIn 0.3s cubic-bezier(0.34,1.56,0.64,1); max-height:85vh; overflow-y:auto; overscroll-behavior-y:contain;';
    
    const updateModalHtml = () => {
      const count = selectedSlots.filter(Boolean).length;
      modal.innerHTML = `
        <div style="text-align:center;">
          <div style="width:3.5rem;height:3.5rem;margin:0 auto 1rem;border-radius:16px;background:linear-gradient(135deg, var(--brand), var(--purple));color:white;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 16px rgba(79,110,247,0.3);">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </div>
          <h2 style="font-size:1.4rem;font-weight:900;color:var(--text);margin-bottom:0.25rem;">מצאתי ${newTasks.length} חלונות זמן!</h2>
          <p style="color:var(--muted);font-size:0.95rem;">סמן אילו אימונים תרצה להוסיף ללו"ז:</p>
        </div>
        <div id="hp-slots-container">${renderTasksHtml()}</div>
        <div style="display:flex;gap:0.75rem;margin-top:0.5rem">
          <button class="btn-primary" id="hp-approve-btn" style="flex:1.5;background:var(--brand);border:none;border-radius:14px;padding:1rem;font-size:1.1rem;font-weight:900;box-shadow:0 8px 16px rgba(92,110,245,0.25); color:white; ${count===0?'opacity:0.5; pointer-events:none;':''}">הוסף ${count} ללו"ז</button>
          <button class="btn-cancel" id="hp-cancel-btn" style="flex:1;border-radius:14px;padding:1rem;font-size:1.1rem;font-weight:900;background:var(--surface2);color:var(--text);border:none;">בטל</button>
        </div>
      `;

      modal.querySelectorAll('.hp-slot-toggle').forEach(el => {
        el.onclick = () => {
          const idx = parseInt(el.dataset.idx);
          selectedSlots[idx] = !selectedSlots[idx];
          updateModalHtml();
        };
      });

      modal.querySelector('#hp-cancel-btn').onclick = () => {
        document.getElementById('hobby-approve-slots-overlay').remove();
      };

      const btn = modal.querySelector('#hp-approve-btn');
      if (btn) {
        btn.onclick = () => {
          const chosen = newTasks.filter((_, i) => selectedSlots[i]);
          chosen.forEach(t => S.tasks.push(t));
          if(typeof save==='function')save(); 
          if(typeof renderAll==='function')renderAll(); 
          if(typeof _hpRenderHobby==='function')_hpRenderHobby(_hobbyActiveIdx);
          document.getElementById('hobby-approve-slots-overlay').remove();
          if(typeof toast==='function')toast(`✅ נוספו ${chosen.length} פעילויות "${hobby.name}" ללו"ז!`);
        };
      }
    };

    updateModalHtml();
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  } catch (e) {
    if(typeof toast==='function')toast('שגיאה: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
  }
}

function hpOpenReport() {
  const hobby = (S.hobbies||[])[_hobbyActiveIdx];
  if (!hobby) return;
  const titleEl = document.getElementById('hrm-title');
  if (titleEl) titleEl.textContent = 'דיווח שבועי — ' + hobby.name;
  // reset pills to defaults
  const planned = hobby.timesPerWeek || 3;
  const sessionsContainer = document.getElementById('hrm-sessions-pills');
  if (sessionsContainer) {
    sessionsContainer.querySelectorAll('.hqm-pill').forEach(b => {
      b.classList.toggle('hqm-pill-active', parseInt(b.dataset.val) === Math.min(planned, 5));
    });
  }
  ['hrm-feel-pills','hrm-goal-pills'].forEach(id => {
    const c = document.getElementById(id);
    if (!c) return;
    c.querySelectorAll('.hqm-pill').forEach((b,i) => b.classList.toggle('hqm-pill-active', i===0));
  });
  const note = document.getElementById('hrm-note');
  if (note) note.value = '';
  document.getElementById('hobby-report-modal')?.classList.remove('hidden');
  _setBodyLock(true);
}

function hpReportSave() {
  const hobby = (S.hobbies||[])[_hobbyActiveIdx];
  if (!hobby) return;
  const sessActive = document.querySelector('#hrm-sessions-pills .hqm-pill-active');
  const feelActive = document.querySelector('#hrm-feel-pills .hqm-pill-active');
  const goalActive = document.querySelector('#hrm-goal-pills .hqm-pill-active');
  const note = (document.getElementById('hrm-note')?.value || '').trim();
  const sessions = parseInt(sessActive?.dataset.val) || 0;
  const feel = feelActive?.dataset.val || 'ok';
  const metGoal = goalActive?.dataset.val || 'partial';
  if (!hobby.weeklyReports) hobby.weeklyReports = [];
  hobby.weeklyReports.push({ date: ld(new Date()), sessions, feel, metGoal, note });
  hobby.lastCheckIn = ld(new Date());
  save();
  closeModal('hobby-report-modal');
  toast(`הדיווח נשמר!`);
}

function hpDeleteHobby() {
  const hobby = (S.hobbies||[])[_hobbyActiveIdx];
  if (!hobby||!confirm(`מחוק "${hobby.name}" ואת כל האימונים העתידיים?`)) return;
  _deleteHobbyTasks(hobby.name);
  S.hobbies.splice(_hobbyActiveIdx,1);
  _hobbyActiveIdx = 0;
  save(); renderAll(); renderHobbyPage();
}

function _deleteHobbyTasks(hobbyName) {
  const today = ld(new Date());
  // Remove all future undone tasks for this hobby (strict equality + trim)
  S.tasks = S.tasks.filter(t => !(t.course === hobbyName && !t.done && t.date >= today));
}
