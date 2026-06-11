// ── THE SMART WAZE ALGORITHM (Dynamic Free Windows) ──
function getAvailableSlots(startDateStr, endDateStr, currentPriority){
  const dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  let available = ""; let totalMinutes = 0; let anchorDetails = "";
  const fmtM = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  let startD = startDateStr ? new Date(startDateStr) : new Date();
  let endD = new Date(endDateStr);
  let daysLeft = Math.ceil((endD - startD) / 86400000);
  let maxDays = Math.min(daysLeft, 14);
  const wake = parseInt((S.wakeTime||"07:00").split(':')[0])*60 + parseInt((S.wakeTime||"07:00").split(':')[1]);
  const sleep = parseInt((S.sleepTime||"23:00").split(':')[0])*60 + parseInt((S.sleepTime||"23:00").split(':')[1]);
  for(let i=0; i<=maxDays; i++){
    let d = new Date(startD); d.setDate(startD.getDate()+i);
    let dateStr = ld(d); let dayIdx = d.getDay();
    let dayAnchors = (S.anchors||[]).filter(a => parseInt(a.day)===dayIdx && !(a.endDate && dateStr>a.endDate) && (!a.oneTimeDate || a.oneTimeDate===dateStr));
    let dayTasks = (S.tasks||[]).filter(t => t.date===dateStr && !t.done && !t.missed);
    let nowMins = 0;
    if(dateStr === ld(new Date())){ const now=new Date(); nowMins = now.getHours()*60+now.getMinutes(); }
    // Build blocked ranges: sleep, anchors+travel, existing tasks
    let blocked = [{ s:0, e:Math.max(wake, nowMins) }, { s:sleep, e:24*60 }];
    dayAnchors.forEach(a => {
      const travel = a.travelMin||0;
      const as2 = parseInt((a.start||'00:00').split(':')[0])*60+parseInt((a.start||'00:00').split(':')[1]);
      const ae2 = parseInt((a.end||'00:00').split(':')[0])*60+parseInt((a.end||'00:00').split(':')[1]);
      blocked.push({ s: as2-travel, e: ae2+travel });
    });
    dayTasks.forEach(t => {
      const ts2 = parseInt((t.time||'00:00').split(':')[0])*60+parseInt((t.time||'00:00').split(':')[1]);
      const dur2 = parseInt((t.duration||'60').match(/\d+/)?.[0]||60);
      blocked.push({ s:ts2, e:ts2+dur2 });
    });
    blocked.sort((a,b)=>a.s-b.s);
    // Merge overlapping blocks
    let merged = [];
    blocked.forEach(b => {
      if(merged.length && b.s <= merged[merged.length-1].e) merged[merged.length-1].e = Math.max(merged[merged.length-1].e, b.e);
      else merged.push({s:b.s, e:b.e});
    });
    // Find free windows (min 20 min)
    let windows = []; let prev = 0;
    merged.forEach(b => {
      if(b.s > prev){ const fs=Math.max(prev,wake); const fe=b.s; if(fe-fs>=20){ windows.push({s:fs,e:fe,m:fe-fs}); totalMinutes+=fe-fs; } }
      prev = Math.max(prev, b.e);
    });
    if(prev < sleep){ const fs=Math.max(prev,wake); if(sleep-fs>=20){ windows.push({s:fs,e:sleep,m:sleep-fs}); totalMinutes+=sleep-fs; } }
    // Anchor details for AI context
    if(dayAnchors.length){
      anchorDetails += `  ${dn[dayIdx]} (${dateStr}): `;
      anchorDetails += dayAnchors.map(a => {
        const tr = a.travelMin||0;
        return `"${a.name}" ${a.start}–${a.end}${tr>0?` (+${tr}דק' נסיעה, חסום ${fmtM(parseInt(a.start.split(':')[0])*60+parseInt(a.start.split(':')[1])-tr)}–${fmtM(parseInt(a.end.split(':')[0])*60+parseInt(a.end.split(':')[1])+tr)})`:''}`;
      }).join(', ') + '\n';
    }
    if(windows.length){
      available += `- ${dateStr} (${dn[dayIdx]}): `;
      available += windows.map(w => `${fmtM(w.s)}–${fmtM(w.e)} (${w.m} דק' פנויות)`).join(', ') + '\n';
    }
  }
  return { text: available||"אין זמנים פנויים", totalMinutes, anchorDetails };
}

// Validate a task fits in a free window (no anchor/travel collision)
function isTimeInFreeWindow(dateStr, timeStr, durationMins) {
  const dayIdx = new Date(dateStr + 'T12:00:00').getDay();
  const dayAnchors = (S.anchors||[]).filter(a => parseInt(a.day)===dayIdx && !(a.endDate && dateStr>a.endDate) && (!a.oneTimeDate || a.oneTimeDate===dateStr));
  const tStart = parseInt(timeStr.split(':')[0])*60 + parseInt(timeStr.split(':')[1]);
  const tEnd = tStart + (durationMins||60);
  const wake = parseInt((S.wakeTime||"07:00").split(':')[0])*60 + parseInt((S.wakeTime||"07:00").split(':')[1]);
  const sleep = parseInt((S.sleepTime||"23:00").split(':')[0])*60 + parseInt((S.sleepTime||"23:00").split(':')[1]);
  if (tStart < wake || tEnd > sleep) return false;
  for (const a of dayAnchors) {
    const travel = a.travelMin||0;
    const as2 = parseInt((a.start||'00:00').split(':')[0])*60+parseInt((a.start||'00:00').split(':')[1]) - travel;
    const ae2 = parseInt((a.end||'00:00').split(':')[0])*60+parseInt((a.end||'00:00').split(':')[1]) + travel;
    if (tStart < ae2 && tEnd > as2) return false;
  }
  // Check existing tasks
  const dayTasks = (S.tasks||[]).filter(t => t.date===dateStr && !t.done && !t.missed);
  for (const t of dayTasks) {
    const ts2 = parseInt((t.time||'00:00').split(':')[0])*60+parseInt((t.time||'00:00').split(':')[1]);
    const dur2 = parseInt((t.duration||'60').match(/\d+/)?.[0]||60);
    if (tStart < ts2+dur2 && tEnd > ts2) return false;
  }
  return true;
}

async function generatePlan(){
  const course = document.getElementById('pl-course').value.trim(); const date = document.getElementById('pl-date').value; const startDate = document.getElementById('pl-start-date').value || ld(new Date()); const hoursRaw = parseFloat(document.getElementById('pl-hours').value.trim()); const hoursPerWeek = isNaN(hoursRaw) || hoursRaw <= 0 ? 10 : Math.min(hoursRaw, 40); const priority = document.getElementById('pl-conf').value;
  if(!course || !date){ toast('נא למלא שם קורס ותאריך יעדק'); return; }
  if(course.length > 80){ toast('️ שם הקורס ארוך מדי'); return; }
  if(new Date(date) < new Date()) { toast('️ תאריך המבחן כבר עבר!'); return; }
  if(new Date(startDate) > new Date(date)) { toast('תאריך התחלה לא יכול להיות אחרי המבחן'); return; }
  if(hoursRaw > 40) { toast('️ הוגבל ל-40 שעות/שבוע — ערך סביר יותר'); }

  const slotsData = getAvailableSlots(startDate, date, priority);
  const availableHours = (slotsData.totalMinutes / 60);
  const totalDaysEst = Math.max(1, Math.ceil((new Date(date + 'T12:00:00') - new Date(startDate + 'T12:00:00')) / 86400000));
  const weeksEst = Math.max(1, Math.ceil(totalDaysEst / 7));
  const hours = Math.min(hoursPerWeek * weeksEst, 200);

  if (!slotsData.text || slotsData.text.trim() === 'אין זמנים פנויים') {
    toast('️ אין זמן פנוי בכלל! פנה ליועץ לו"ז AI לפינוי מקום.');
    openRecalc('schedule'); return;
  }

  // Warn if course already has pending tasks (duplicate plan guard)
  const existingCourseTasks = S.tasks.filter(t => t.course === course && !t.done && t.date >= ld(new Date()));
  if (existingCourseTasks.length >= 3 && !confirm(`כבר קיימות ${existingCourseTasks.length} משימות קיימות בקורס "${course}". ליצור תוכנית נוספת?`)) return;

  // Capacity overflow → AI negotiation instead of silent confirm
  if (hours > availableHours) {
    openCapacityNegotiation(course, hours, availableHours, date, slotsData.text, hoursPerWeek, weeksEst);
    return;
  }

  const btn = document.getElementById('gen-btn'); if (btn) { btn.disabled = true; btn.textContent = ' מחשב מסלול חכם...'; }

  // ── Smart Spacing Algorithm ──
  const totalDays = Math.max(1, Math.ceil((new Date(date + 'T12:00:00') - new Date(startDate + 'T12:00:00')) / 86400000));
  const crunchDays = Math.min(4, Math.max(1, Math.round(totalDays * 0.2)));
  const crunchStartD = new Date(date + 'T12:00:00'); crunchStartD.setDate(crunchStartD.getDate() - crunchDays);
  const crunchStartStr = ld(crunchStartD);
  const buildupEndD = new Date(crunchStartD); buildupEndD.setDate(crunchStartD.getDate() - 1);
  const buildupEndStr = ld(buildupEndD);
  const examMinus1D = new Date(date + 'T12:00:00'); examMinus1D.setDate(examMinus1D.getDate() - 1);
  const examMinus1 = ld(examMinus1D);
  const actualHours = Math.min(hours, availableHours);
  const totalTasks = Math.max(2, Math.ceil(actualHours / 1.5));
  const crunchTasks = Math.max(1, Math.ceil(totalTasks * 0.35));
  const buildupTasks = totalTasks - crunchTasks;
  const weeksInBuildup = Math.max(1, Math.ceil(Math.max(1,(buildupEndD - new Date(startDate + 'T12:00:00')) / 86400000) / 7));
  const maxPerWeek = Math.max(2, Math.ceil(buildupTasks / weeksInBuildup) + 1);

  // Compute crunch windows of OTHER exams — avoid scheduling in those days
  const otherExams = S.exams.filter(e => e.course !== course && e.date > startDate && e.date <= date);
  const blockedRanges = otherExams.map(oe => {
    const oeD = new Date(oe.date + 'T12:00:00');
    const oeGap = Math.ceil((oeD - new Date()) / 86400000);
    const oeCrunch = Math.min(3, Math.max(1, Math.round(oeGap * 0.3)));
    const oeCrunchStart = new Date(oeD); oeCrunchStart.setDate(oeCrunchStart.getDate() - oeCrunch);
    return `${ld(oeCrunchStart)} עד ${oe.date} (קראנץ׳ מבחן ${oe.course})`;
  });
  const blockedNote = blockedRanges.length ? `\n טווחים חסומים לקורסים אחרים (אל תשבץ בהם!): ${blockedRanges.join('; ')}` : '';

  // Profile-aware duration
  const focusSpan = S.profile?.focus_span || '';
  let sessionMin = 60;
  if (focusSpan.includes('25')) sessionMin = 25;
  else if (focusSpan.match(/30|40|45/)) sessionMin = 40;
  else if (focusSpan.match(/60|75/)) sessionMin = 65;
  else if (focusSpan.includes('90')) sessionMin = 90;

  const prompt = `אתה מתכנן לו"ז לימוד חכם לפי שיטת Spaced Learning.
קורס: "${course}" | מבחן: ${date} | טווח: ${startDate} → ${examMinus1} | ${totalDays} ימים | צור ${totalTasks} משימות בסך הכל

═══ פרופיל סטודנט ═══
• יכולת ריכוז: ${focusSpan || 'לא צוין'} → משך משימה מומלץ: ${sessionMin} דק'
• שעות פעילות: ${S.wakeTime}–${S.sleepTime}

═══ עוגנים קבועים (חסום לחלוטין — כולל זמני נסיעה!) ═══
${slotsData.anchorDetails || '  אין עוגנים'}

═══ שלב 1 — בנייה הדרגתית (${startDate} עד ${buildupEndStr}) ═══
• צור בדיוק ${buildupTasks} משימות
• פיזור: עד 2 משימות ביום, עד ${maxPerWeek} בשבוע — אל תצבור!
• שם כל משימה חייב להיות בדיוק: "${course}" — ללא תוספות, ללא מקף, ללא תיאור
• עדיפות: "בינוני"

═══ שלב 2 — קראנץ' אינטנסיבי (${crunchStartStr} עד ${examMinus1}, ${crunchDays} ימים לפני המבחן) ═══
• צור בדיוק ${crunchTasks} משימות
• ניתן עד 3 ביום, שים לב: מחר אחרי ${examMinus1} זה המבחן — אל תחרוג!
• שם כל משימה חייב להיות בדיוק: "${course}"
• עדיפות: "גבוה"

חוקי ברזל (שבירתם = פסילה):
1. "time" — שעת התחלה בפורמט HH:MM. חייבת להיות בתוך חלון פנוי (ראה למטה). הקפד שהמשימה לא תחפוף עם עוגן או זמן נסיעה!
2. "date" — בטווח ${startDate}–${examMinus1} בלבד (לא כולל יום המבחן ${date})
3. "duration" — קבע לפי יכולת הריכוז: ~${sessionMin} דק'. אפשר לגוון (${Math.max(20,sessionMin-10)}–${sessionMin+20} דק')
4. אל תכניס יותר מ-2 משימות עם אותו שם ביום
5. השתמש רק בתאריכים וחלונות זמן שמופיעים ברשימת הזמנים הפנויים. אל תציב משימה שחורגת מגבול חלון!
6. השאר לפחות 10 דק' הפסקה בין משימות${blockedNote}

חלונות זמן פנויים (רק בהם מותר לשבץ!):
${slotsData.text}

JSON בלבד: {"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"${course}","name":"${course}","duration":"X דק'","priority":"גבוה|בינוני"}]}`;
  
  try{
    const _content1 = await callAI({ messages: [{role:'user', content:prompt}], temperature: 0.2, json: true });
    let parsed = extractJSON(_content1);
    let validTasks = (parsed.tasks||[]).filter(t => {
      if (!t.date || !t.time) return false;
      const dur = parseInt((t.duration||String(sessionMin)).match(/\d+/)?.[0]||sessionMin);
      const isInWindow = isTimeInFreeWindow(t.date, t.time, dur);
      const isDateValid = new Date(t.date) < new Date(date) && new Date(t.date) >= new Date(ld(new Date()));
      const noTaskCollision = !S.tasks.find(old => old.date === t.date && old.time === t.time && !old.done && !old.missed && old.course !== course);
      return isInWindow && isDateValid && noTaskCollision;
    });
    S.pendingPlan = validTasks.map(t => ({...t, id:uid(), name: t.course || t.name, done:false, missed:false}));
    if(S.pendingPlan.length === 0) { throw new Error('ה-AI לא מצא זמנים חוקיים.'); }
    if(!S.exams.find(e => e.course === course && e.date === date)){ S.exams.push({id:uid(), course, date, type:'מבחן', conf:parseInt(priority), readyPct:0, createdDate: ld(new Date())}); }
    save();
    renderPlanTable(S.pendingPlan); document.getElementById('plan-result-box').classList.remove('hidden');
  } catch(e) {
    const msg = e.message?.includes('JSON') ? 'שגיאה בעיבוד תשובת ה-AI — נסה שוב'
      : e.message?.includes('API Key') ? e.message
      : e.message?.includes('מגבלת API') ? e.message
      : e.message?.includes('חוקיים') ? 'ה-AI לא מצא זמנים פנויים — נסה להוסיף שעות למידה בהגדרות'
      : e.message || 'שגיאה בתכנון — נסה שוב';
    toast(msg);
    console.error(e);
  }
  if (btn) { btn.disabled = false; btn.textContent = ' צור תוכנית מגוונת'; }
}

function renderPlanTable(tasks, wrapId){
  const wrap = document.getElementById(wrapId || 'plan-table-wrap');
  if(!tasks.length){ wrap.innerHTML='<div class="empty-state">אין זמנים פנויים</div>'; return; }
  const crunchKW = ['שליפה','אינטנסיב','מבחן תרגול','קראנץ'];
  const stats = { buildup: tasks.filter(t=>t.priority!=='גבוה').length, crunch: tasks.filter(t=>t.priority==='גבוה').length };
  const summaryHtml = `<div style="display:flex;gap:0.6rem;margin-bottom:1rem;flex-wrap:wrap">
    <div style="background:var(--accent-light);border:1px solid var(--border2);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--accent)"> בנייה: ${stats.buildup}</div>
    <div style="background:var(--red-light);border:1px solid rgba(247,96,96,0.25);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--red)"> קראנץ׳: ${stats.crunch}</div>
    <div style="background:var(--green-light);border:1px solid rgba(22,201,141,0.25);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--green)">⏱️ ${(tasks.length*1.5).toFixed(0)} שעות סה״כ</div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--muted)"> ${tasks.length} משימות</div>
  </div>`;
  // Group by week
  const byWeek = {};
  tasks.forEach(t => {
    const d = new Date(t.date + 'T12:00:00'); const sow = new Date(d); sow.setDate(d.getDate() - d.getDay());
    const wk = ld(sow); if (!byWeek[wk]) byWeek[wk] = [];
    byWeek[wk].push(t);
  });
  const weekHtml = Object.entries(byWeek).sort(([a],[b])=>a.localeCompare(b)).map(([wk, wTasks]) => {
    const sowD = new Date(wk + 'T12:00:00'); const eowD = new Date(sowD); eowD.setDate(sowD.getDate()+6);
    const months=['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];
    const wkLabel = `${sowD.getDate()} ${months[sowD.getMonth()]} — ${eowD.getDate()} ${months[eowD.getMonth()]}`;
    const cards = wTasks.map(t => {
      const isCrunch = t.priority==='גבוה'||crunchKW.some(k=>t.name.includes(k));
      const cColor = getCourseColor(t.course);
      const [th, tm] = (t.time||'00:00').split(':');
      return `<div style="display:flex;align-items:stretch;border-radius:11px;overflow:hidden;border:1px solid ${isCrunch?'rgba(247,96,96,0.3)':'var(--border)'};background:${isCrunch?'var(--red-light)':'var(--surface)'};margin-bottom:0.4rem;">
        <div style="width:4px;background:${cColor};flex-shrink:0;"></div>
        <div style="width:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0.5rem 0;background:var(--surface2);border-left:1px solid var(--border);flex-shrink:0;">
          <span style="font-family:var(--mono);font-size:0.8rem;font-weight:800;line-height:1">${th}</span>
          <span style="font-family:var(--mono);font-size:0.6rem;color:var(--muted)">${tm}</span>
        </div>
        <div style="flex:1;padding:0.5rem 0.8rem;display:flex;flex-direction:column;justify-content:center;">
          <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.15rem;">
            <span style="font-size:0.63rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:6px;background:${isCrunch?'var(--red-light)':'var(--accent-light)'};color:${isCrunch?'var(--red)':'var(--accent)'}">${isCrunch?' קראנץ׳':' בנייה'}</span>
            <span style="font-size:0.6rem;color:var(--muted);font-family:var(--mono)">${fmtDate(t.date)}</span>
          </div>
          <div style="font-size:0.9rem;font-weight:800;color:var(--text);margin-bottom:0.1rem">${t.course||t.name}</div>
          <div style="font-size:0.73rem;color:var(--muted);font-weight:500">${t.name}</div>
        </div>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:1rem">
      <div style="font-size:0.72rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;padding-bottom:0.3rem;border-bottom:1px solid var(--border)"> שבוע ${wkLabel} · ${wTasks.length} משימות</div>
      ${cards}
    </div>`;
  }).join('');
  wrap.innerHTML = summaryHtml + weekHtml;
}
function addPlanToSchedule() {
  if (!S.pendingPlan.length) { toast('️ אין תוכנית לאישור — צור תוכנית תחילה'); return; }
  // Calculate what will be replaced — use the EXACT deletion predicate below
  let replacedTasks = [];
  S.pendingPlan.forEach(newT => {
    S.tasks.filter(old => old.date === newT.date && old.time === newT.time && !old.done)
      .forEach(t => replacedTasks.push(t));
  });
  const otherCourseReplacements = replacedTasks.filter(t => t.course !== S.pendingPlan[0]?.course);
  const planCount = S.pendingPlan.length;
  S.pendingPlan.forEach(newT => {
    S.tasks = S.tasks.filter(old => !(old.date === newT.date && old.time === newT.time && !old.done));
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
  // Holiday check AFTER adding
  const holidayTasks = S.pendingPlan.filter(t => getHoliday(t.date));
  const hadHoliday = holidayTasks.length > 0;
  // Clear & persist first, then give feedback
  S.pendingPlan = [];
  save();
  document.getElementById('plan-result-box').classList.add('hidden');
  const msg = otherCourseReplacements.length > 0
    ? `נוספו ${planCount} משימות (הוחלפו ${otherCourseReplacements.length} משימות מקורסים אחרים)`
    : `נוספו ${planCount} משימות ללו"ז!`;
  toast(msg);
  try { renderAll(); } catch(e) { console.error('renderAll error in addPlanToSchedule:', e); }
  // Post-add holiday notification — tasks are now in S.tasks so AI can reschedule them
  if (hadHoliday) {
    const hNames = [...new Set(holidayTasks.map(t => `${fmtDate(t.date)} (${getHoliday(t.date)})`))].join(', ');
    if (confirm(` ${holidayTasks.length} משימות נוספו לימי חג: ${hNames}.\nלפתוח יועץ לוח זמנים להזזה?`)) {
      openHolidayChat(holidayTasks[0].date, getHoliday(holidayTasks[0].date), holidayTasks);
      return;
    }
  }
  // Navigate to the week containing the first planned task
  if (S.tasks.length) {
    const firstPlanned = [...S.tasks].filter(t => !t.done && !t.missed && t.date >= ld(new Date()))
      .sort((a,b) => a.date.localeCompare(b.date))[0];
    if (firstPlanned) {
      const taskDate = new Date(firstPlanned.date + 'T12:00:00');
      const now = new Date(); now.setHours(0,0,0,0);
      const startOfCurrentWeek = new Date(now); startOfCurrentWeek.setDate(now.getDate() - now.getDay());
      const startOfTaskWeek = new Date(taskDate); startOfTaskWeek.setDate(taskDate.getDate() - taskDate.getDay());
      S.weekOffset = Math.round((startOfTaskWeek - startOfCurrentWeek) / (7 * 86400000));
    }
  }
  showPage('schedule', document.querySelectorAll('.nav-item')[2]);
}

function changeWeek(dir){ S.weekOffset += dir; schedViewDay = null; renderSchedule(); }

function deleteCourseFromSchedule(course) {
  if (!course) { toast('בחר קורס למחיקה'); return; }
  const today = ld(new Date());
  const futureTasks = S.tasks.filter(t => t.course === course && !t.done && t.date >= today);
  if (!futureTasks.length) { toast(`אין משימות עתידיות לקורס "${course}"`); return; }
  S.tasks = S.tasks.filter(t => !(t.course === course && !t.done && t.date >= today));
  S.pendingPlan = S.pendingPlan.filter(t => t.course !== course);
  save(); renderAll();
  document.getElementById('plan-result-box')?.classList.add('hidden');
  toast(`️ נמחקו ${futureTasks.length} משימות עתידיות מ"${course}"`);
}

function renderCourseManager() {
  const today = ld(new Date());
  const courses = [...new Set(S.tasks.filter(t => t.course && !t.done && t.date >= today).map(t => t.course))];
  const wrap = document.getElementById('course-manager-list');
  if (!wrap) return;
  if (!courses.length) { wrap.innerHTML = '<div style="font-size:0.82rem;color:var(--muted);text-align:center;padding:0.5rem">אין קורסים פעילים בלו"ז</div>'; return; }
  wrap.innerHTML = courses.map(c => {
    const count = S.tasks.filter(t => t.course === c && !t.done && t.date >= today).length;
    const col = getCourseColor(c);
    return `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.65rem;border-radius:10px;background:var(--surface2);margin-bottom:0.4rem">
      <div style="width:10px;height:10px;border-radius:50%;background:${col};flex-shrink:0"></div>
      <span style="flex:1;font-size:0.85rem;font-weight:700">${c}</span>
      <span style="font-size:0.72rem;color:var(--muted)">${count} משימות</span>
      <button onclick="deleteCourseFromSchedule('${c.replace(/'/g,"\\'")}');renderCourseManager()" style="background:var(--red-light);color:var(--red);border:none;border-radius:7px;padding:0.28rem 0.55rem;font-size:0.73rem;font-weight:700;cursor:pointer">מחק</button>
    </div>`;
  }).join('');
}

// ── PLANNER PAGE MANAGEMENT ──

let _plShGoal = 'ok';

function renderPlannerPage() {
  if (!S.courses) S.courses = [];
  const hasCourses = S.courses.length > 0;
  const isFirstTime = !hasCourses;
  const startHere = document.getElementById('pl-start-here');
  const coursesEl = document.getElementById('pl-courses-section');
  const hobbiesEl = document.getElementById('pl-hobbies-section');
  const actionsEl = document.getElementById('pl-actions-row');
  if (startHere) startHere.classList.toggle('hidden', !isFirstTime);
  if (coursesEl) coursesEl.style.display = isFirstTime ? 'none' : '';
  if (hobbiesEl) hobbiesEl.style.display = isFirstTime ? 'none' : '';
  if (actionsEl) actionsEl.style.display = isFirstTime ? 'none' : '';
  if (isFirstTime) {
    const rows = document.getElementById('pl-sh-course-rows');
    if (rows && !rows.children.length) plShAddCourseRow();
    _plShRenderHobbies();
  } else {
    renderCourseCards();
    renderHobbyCardsInPlanner();
  }
  renderCourseManager();
}

function plShAddCourseRow() {
  const wrap = document.getElementById('pl-sh-course-rows');
  if (!wrap) return;
  const id = 'plsh-' + uid();
  const div = document.createElement('div');
  div.className = 'pl-sh-course-row';
  div.id = id;
  div.innerHTML = `
    <div class="plsh-name-wrap">
      <label class="plsh-label">שם הקורס</label>
      <input type="text" class="plsh-name" placeholder="למשל: חשבון, פסיכולוגיה..." />
    </div>
    <div class="plsh-exam-wrap">
      <label class="plsh-label">תאריך מבחן</label>
      <input type="date" class="plsh-exam" />
    </div>
    <button onclick="document.getElementById('${id}').remove()" class="plsh-remove" title="הסר">✕</button>
  `;
  wrap.appendChild(div);
  div.querySelector('.plsh-name').focus();
}

function plShAddHobby() {
  const inp = document.getElementById('pl-sh-hobby-inp');
  const name = (inp?.value || '').trim();
  const nameEl = document.getElementById('hqm-name');
  if (nameEl) nameEl.value = name;
  if (inp) inp.value = '';
  const _hqmGoal = document.getElementById('hqm-goal'); if (_hqmGoal) _hqmGoal.value = '';
  const _hqmModal = document.getElementById('hobby-quick-modal'); if (_hqmModal) _hqmModal.classList.remove('hidden');
  _setBodyLock(true);
  setTimeout(() => { const _f = document.getElementById('hqm-name') || document.getElementById('hqm-goal'); _f?.focus(); }, 100);
}

function hqmPick(btn, group) {
  // group can be a raw container ID or a shorthand (hqm-${group}-pills)
  const container = document.getElementById(group + '-pills') || document.getElementById('hqm-' + group + '-pills');
  if (!container) return;
  container.querySelectorAll('.hqm-pill').forEach(b => b.classList.remove('hqm-pill-active'));
  btn.classList.add('hqm-pill-active');
}
function plShHobbyQuickSave() {
  const name = (document.getElementById('hqm-name')?.value || '').trim();
  const goal = (document.getElementById('hqm-goal')?.value || '').trim();
  if (!name) { toast('נא למלא שם תחביב'); return; }
  if (!S.hobbies) S.hobbies = [];
  if (S.hobbies.find(h => h.name === name)) { toast('תחביב זה כבר קיים'); closeModal('hobby-quick-modal'); return; }
  const freqActive = document.querySelector('#hqm-freq-pills .hqm-pill-active');
  const durActive  = document.querySelector('#hqm-dur-pills .hqm-pill-active');
  const timesPerWeek   = parseInt(freqActive?.dataset.val) || 2;
  const sessionDuration = parseInt(durActive?.dataset.val) || 30;
  S.hobbies.push({ id: uid(), name, goal, timesPerWeek, sessionDuration, level: 'מתחיל', motivation: '', history: [], sessions: [], createdDate: ld(new Date()) });
  save();
  closeModal('hobby-quick-modal');
  _plShRenderHobbies();
  toast(` ${name} נוסף!`);
}

function _plShRenderHobbies() {
  const wrap = document.getElementById('pl-sh-hobby-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  (S.hobbies || []).forEach(h => {
    const chip = document.createElement('span');
    chip.className = 'pl-sh-hobby-chip';
    chip.textContent = h.name;
    const x = document.createElement('span');
    x.className = 'pl-sh-chip-x';
    x.textContent = '×';
    x.addEventListener('click', () => { S.hobbies = S.hobbies.filter(hb => hb.id !== h.id); _plShRenderHobbies(); });
    chip.appendChild(x);
    wrap.appendChild(chip);
  });
}

function plShSelectGoal(el) {
  document.querySelectorAll('.pl-sh-goal-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel');
  _plShGoal = el.dataset.val;
}

function plShAddHwRow() {
  const wrap = document.getElementById('pl-sh-hw-rows');
  if (!wrap) return;
  const courseNames = Array.from(document.querySelectorAll('#pl-sh-course-rows .plsh-name'))
    .map(i => i.value.trim()).filter(Boolean);
  const courseOpts = courseNames.length
    ? courseNames.map(n => `<option value="${n}">${n}</option>`).join('')
    : `<option value="">ללא קורס</option>`;
  const id = 'hw-' + uid();
  const div = document.createElement('div');
  div.className = 'pl-sh-hw-row';
  div.id = id;
  div.innerHTML = `
    <input type="text" class="plsh-hw-name" placeholder="שם המטלה..." maxlength="80" />
    <select class="plsh-hw-course">${courseOpts}</select>
    <select class="plsh-hw-dur">
      <option value="30">30 דק'</option>
      <option value="45">45 דק'</option>
      <option value="60" selected>שעה</option>
      <option value="90">שעה וחצי</option>
      <option value="120">שעתיים</option>
    </select>
    <button class="ab-del-btn" onclick="document.getElementById('${id}').remove()" title="הסר">
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
    </button>`;
  wrap.appendChild(div);
}

function plShBuildFirstWeek() {
  const rows = document.querySelectorAll('#pl-sh-course-rows .pl-sh-course-row');
  if (!rows.length) { toast('הוסף לפחות קורס אחד'); return; }
  const newCourses = [];
  let valid = true;
  rows.forEach(row => {
    const name = row.querySelector('.plsh-name')?.value.trim();
    const examDate = row.querySelector('.plsh-exam')?.value;
    if (!name) { toast('הכנס שם לכל קורס'); valid = false; return; }
    if (!examDate) { toast(`הכנס תאריך מבחן לקורס "${name}"`); valid = false; return; }
    if (new Date(examDate) < new Date()) { toast(`תאריך מבחן של "${name}" כבר עבר`); valid = false; return; }
    newCourses.push({ id: uid(), name, examDate, hoursPerWeek: 6 });
  });
  if (!valid) return;

  // Collect homework rows
  const hwItems = [];
  document.querySelectorAll('#pl-sh-hw-rows .pl-sh-hw-row').forEach(row => {
    const name   = row.querySelector('.plsh-hw-name')?.value.trim();
    const course = row.querySelector('.plsh-hw-course')?.value || '';
    const dur    = parseInt(row.querySelector('.plsh-hw-dur')?.value) || 60;
    if (name) hwItems.push({ id: uid(), name, duration: dur, deadline: ld(new Date(Date.now() + 6*86400000)), course, done: false, createdDate: ld(new Date()) });
  });
  if (!S.homework) S.homework = [];
  hwItems.forEach(hw => S.homework.push(hw));

  if (!S.courses) S.courses = [];
  newCourses.forEach(c => {
    if (!S.courses.find(x => x.name === c.name)) {
      S.courses.push(c);
      if (!S.exams.find(e => e.course === c.name)) {
        S.exams.push({ id: uid(), course: c.name, date: c.examDate, type: 'מבחן', conf: 3, readyPct: 0, createdDate: ld(new Date()) });
      }
    }
  });
  save();
  const coursesNames = newCourses.map(c => c.name);
  
  // Navigate to weekly review page to start the Q&A process properly
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-weekly-review')?.classList.add('active');
  updateBottomNav('weekly-review');
  _wrForceRebuild = true;
  renderWeeklyReview();
}

function openAddCourseModal() {
  const modal = document.getElementById('course-add-modal');
  if (!modal) return;
  document.getElementById('cam-name').value = '';
  document.getElementById('cam-exam-date').value = '';
  modal.classList.remove('hidden');
  _setBodyLock(true);
  setTimeout(() => document.getElementById('cam-name').focus(), 100);
}

function addPlannerCourse() {
  const name = document.getElementById('cam-name').value.trim();
  const examDate = document.getElementById('cam-exam-date').value;
  if (!name) { toast('הכנס שם קורס'); return; }
  if (name.length > 80) { toast('שם קורס ארוך מדי (מקסימום 80 תווים)'); return; }
  if (!examDate) { toast('הכנס תאריך מבחן'); return; }
  if (new Date(examDate + 'T12:00') < new Date()) { toast('️ תאריך מבחן לא יכול להיות בעבר'); return; }
  if (!S.courses) S.courses = [];
  if (S.courses.find(c => c.name === name)) { toast('קורס זה כבר קיים'); return; }
  S.courses.push({ id: uid(), name, examDate, hoursPerWeek: 6 });
  if (!S.exams.find(e => e.course === name && e.date === examDate)) {
    S.exams.push({ id: uid(), course: name, date: examDate, type: 'מבחן', conf: 3, readyPct: 0, createdDate: ld(new Date()) });
  }
  save(); closeModal('course-add-modal'); renderPlannerPage();
  toast(` ${name} נוסף!`);
}

function deletePlannerCourse(id) {
  const course = (S.courses || []).find(c => c.id === id);
  if (!course) return;
  if (!confirm(`למחוק את הקורס "${course.name}"? גם המשימות והמבחנים העתידיים ימחקו.`)) return;
  S.courses = S.courses.filter(c => c.id !== id);
  S.tasks = S.tasks.filter(t => t.course !== course.name);
  S.exams = S.exams.filter(e => e.course !== course.name);
  if (S.homework) S.homework = S.homework.filter(h => h.course !== course.name);
  save(); renderAll(); renderPlannerPage();
}

function renderCourseCards() {
  const wrap = document.getElementById('pl-course-cards-wrap');
  if (!wrap) return;
  wrap.innerHTML = (S.courses || []).map(c => {
    const d = S.tasks.filter(t=>t.course===c.name&&t.done).length;
    const p = S.tasks.filter(t=>t.course===c.name&&!t.done&&!t.missed).length;
    const h = (S.homework||[]).filter(x=>x.course===c.name&&!x.done).length;
    const e = (S.exams||[]).filter(x=>x.course===c.name&&new Date(x.date)>=new Date()).length;
    const total = d + p || 1;
    const pct = Math.round((d / total) * 100);
    const color = getCourseColor(c.name);
    return `
      <div style="background:var(--surface);border-radius:24px;padding:1.5rem;margin-bottom:1rem;box-shadow:0 12px 32px rgba(0,0,0,0.06);border:1px solid rgba(79,110,247,0.10);position:relative;overflow:hidden;transition:transform 0.3s, box-shadow 0.3s;animation:slideUpFadeIn 0.3s ease-out;">
        <div style="position:absolute;top:0;right:0;bottom:0;width:6px;background:${color};border-radius:0 24px 24px 0;"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;">
          <div style="font-size:1.4rem;font-weight:900;color:var(--text);letter-spacing:-0.02em;">${c.name}</div>
          <button style="background:transparent;border:none;color:var(--muted);cursor:pointer;padding:4px;border-radius:8px;transition:all 0.2s;" onclick="deletePlannerCourse('${c.id}')" title="מחק קורס">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem;">
          <span style="background:${color}20;color:${color};font-size:0.78rem;font-weight:800;padding:4px 10px;border-radius:10px;">${c.hoursPerWeek || 0} ש'/שבוע</span>
          <span style="background:var(--purple-light);color:var(--purple);font-size:0.78rem;font-weight:800;padding:4px 10px;border-radius:10px;">${p} ממתינות</span>
          <span style="background:var(--green-light);color:var(--green);font-size:0.78rem;font-weight:800;padding:4px 10px;border-radius:10px;">${d} בוצעו</span>
          ${h>0?`<span style="background:var(--yellow-light);color:var(--yellow);font-size:0.78rem;font-weight:800;padding:4px 10px;border-radius:10px;">${h} מטלות</span>`:''}
          ${e>0?`<span style="background:var(--red-light);color:var(--red);font-size:0.78rem;font-weight:800;padding:4px 10px;border-radius:10px;">${e} מבחנים</span>`:''}
        </div>
        <div style="height:8px;background:var(--surface2);border-radius:8px;overflow:hidden;">
          <div style="height:100%;background:${color};width:${pct}%;border-radius:8px;transition:width 1s cubic-bezier(0.34,1.56,0.64,1);"></div>
        </div>
        <div style="font-size:0.72rem;font-weight:700;color:var(--muted);margin-top:0.4rem;text-align:left;">${pct}% הושלם</div>
      </div>`;
  }).join('');
}


function renderHobbyCardsInPlanner() {
  const wrap = document.getElementById('pl-hobby-cards-wrap');
  if (!wrap) return;
  const emptyHint = document.getElementById('pl-hobbies-empty-hint');
  if (!(S.hobbies || []).length) {
    wrap.innerHTML = '';
    if (emptyHint) emptyHint.classList.remove('hidden');
    return;
  }
  if (emptyHint) emptyHint.classList.add('hidden');
  wrap.innerHTML = (S.hobbies || []).map((h, hidx) => {
    const d = S.tasks.filter(t=>t.course===h.name&&t.done).length;
    const p = S.tasks.filter(t=>t.course===h.name&&!t.done&&!t.missed).length;
    return `
      <div style="background:var(--surface);border-radius:24px;padding:1.25rem;margin-bottom:0.75rem;box-shadow:0 8px 24px rgba(0,0,0,0.05);border:1px solid rgba(34,197,94,0.15);position:relative;overflow:hidden;animation:slideUpFadeIn 0.3s ease-out;">
        <div style="position:absolute;top:0;right:0;bottom:0;width:6px;background:var(--green);border-radius:0 24px 24px 0;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:0.85rem;">
            <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg, var(--green), #0ea5e9);color:white;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(34,197,94,0.25);flex-shrink:0;">
              ${_hobbyEmoji(h.name)}
            </div>
            <div>
              <div style="font-size:1.2rem;font-weight:900;color:var(--text);letter-spacing:-0.02em;margin-bottom:0.25rem;">${h.name}</div>
              <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <span style="background:var(--accent-light);color:var(--accent);font-size:0.72rem;font-weight:900;padding:3px 8px;border-radius:8px;">${h.timesPerWeek || 2}×/שבוע</span>
                <span style="background:var(--surface2);color:var(--muted);font-size:0.72rem;font-weight:800;padding:3px 8px;border-radius:8px;">${d} בוצעו</span>
                ${p>0?`<span style="background:var(--purple-light);color:var(--purple);font-size:0.72rem;font-weight:800;padding:3px 8px;border-radius:8px;">${p} קרובות</span>`:''}
              </div>
            </div>
          </div>
          <button onclick="_hobbyActiveIdx=${hidx}; showPage('hobby',null)" style="background:var(--accent);color:white;font-weight:900;padding:0.5rem 1rem;border-radius:12px;box-shadow:0 6px 14px rgba(79,110,247,0.25);border:none;cursor:pointer;font-size:0.85rem;">אמן</button>
        </div>
      </div>`;
  }).join('');
}


function openTimeChart() {
  renderTimeChart();
  document.getElementById('time-chart-modal').classList.remove('hidden');
  _setBodyLock(true);
}

function renderTimeChart() {
  const todayD = new Date();
  const today = ld(todayD);
  // Use the currently viewed schedule week (respects S.weekOffset navigation)
  const weekStartD = new Date(todayD);
  weekStartD.setDate(todayD.getDate() - todayD.getDay() + (S.weekOffset || 0) * 7);
  const weekStart = ld(weekStartD);
  const weekEndD = new Date(weekStartD);
  weekEndD.setDate(weekStartD.getDate() + 6);
  const weekEnd = ld(weekEndD);

  // Weekly available hours (wake to sleep × 7 days) — always based on user settings
  const [wkH,wkM] = (S.wakeTime||'07:00').split(':').map(Number);
  const [slH,slM] = (S.sleepTime||'23:00').split(':').map(Number);
  const dailyAvailH = ((slH*60+slM) - (wkH*60+wkM)) / 60;
  const weeklyAvailH = dailyAvailH * 7;

  // Anchor hours per week (sum all recurring anchors)
  const anchorMap = {};
  (S.anchors||[]).forEach(a => {
    if (a.endDate && today > a.endDate) return;
    const [sh,sm] = (a.start||'00:00').split(':').map(Number);
    const [eh,em] = (a.end||'00:00').split(':').map(Number);
    const h = ((eh*60+em) - (sh*60+sm) + (a.travelMin||0)*2) / 60;
    anchorMap[a.name] = (anchorMap[a.name]||0) + h;
  });

  // Task hours per course — full current week (all tasks, including done, = allocated time)
  const courseMap = {};
  (S.tasks||[]).filter(t => t.date >= weekStart && t.date <= weekEnd).forEach(t => {
    const k = t.course || 'ללא קורס';
    const durMins = parseInt((t.duration||'90').match(/\d+/)?.[0]||90);
    courseMap[k] = (courseMap[k]||0) + (durMins / 60);
  });

  const anchorTotalH = Object.values(anchorMap).reduce((s,h)=>s+h, 0);
  const taskTotalH = Object.values(courseMap).reduce((s,h)=>s+h, 0);
  const freeH = Math.max(0, weeklyAvailH - anchorTotalH - taskTotalH);

  const items = [
    ...Object.entries(anchorMap).map(([name,h]) => ({ name, hours:h, type:'anchor', color:(S.anchors.find(a=>a.name===name)?.color||'#94a3b8') })),
    ...Object.entries(courseMap).map(([name,h]) => ({ name, hours:h, type:'course', color:getCourseColor(name) })),
    ...(freeH > 0 ? [{ name: 'זמן פנוי', hours: freeH, type: 'free', color: '#cbd5e1' }] : [])
  ].sort((a,b)=>b.hours-a.hours);

  if (!items.filter(i=>i.type!=='free').length) {
    const wrap = document.getElementById('tc-chart-wrap');
    if (wrap) wrap.innerHTML = '<div style="text-align:center;color:var(--muted);padding:2rem;font-size:0.85rem">אין נתונים לשבוע זה — הוסף עוגנים ומשימות</div>';
    const totalLabel = document.getElementById('tc-total-label');
    if (totalLabel) totalLabel.textContent = `${weeklyAvailH.toFixed(0)} שע' זמינות השבוע`;
    return;
  }

  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const rows = items.map(it => {
    const pct = Math.min(100, Math.round((it.hours / weeklyAvailH) * 100));
    const display = `${it.hours.toFixed(1)} שע'`;
    const typeLabel = it.type === 'anchor' ? '' : it.type === 'free' ? '' : '';
    return `<div class="tc-row">
      <div class="tc-row-label">
        <span class="tc-row-type">${typeLabel}</span>
        <span class="tc-row-name">${esc(it.name)}</span>
        <span class="tc-row-val">${display} · ${pct}%</span>
      </div>
      <div class="tc-bar-wrap">
        <div class="tc-bar" style="width:${Math.max(2,pct)}%;background:${esc(it.color)}"></div>
      </div>
    </div>`;
  }).join('');

  const busyH = anchorTotalH + taskTotalH;
  const totalLabelEl = document.getElementById('tc-total-label');
  if (totalLabelEl) totalLabelEl.textContent = `${busyH.toFixed(1)} / ${weeklyAvailH.toFixed(0)} שע' השבוע (${Math.round(busyH/weeklyAvailH*100)}% תפוסה)`;
  const wrapEl = document.getElementById('tc-chart-wrap');
  if (wrapEl) wrapEl.innerHTML = rows;
}
