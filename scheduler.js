// ── Algorithm Engine (0% AI, 100% Deterministic) ──────────────────────────

const LOAD_PCT = { light: 0.40, balanced: 0.62, heavy: 0.85 };

// Deterministic, collision-free task ids. Prefer the app's global uid() helper
// (defined in app_v58.js, loaded after this file); fall back to a per-generation
// incrementing counter so the engine never relies on Math.random() (which the
// header claims it doesn't and which can collide and corrupt task state).
let _schedIdSeq = 0;
function _genTaskId() {
  if (typeof uid === 'function') return uid();
  _schedIdSeq += 1;
  return 'sch-' + _schedIdSeq.toString(36);
}

function timeToMins(t) {
  if (!t || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minsToTime(m) {
  const h  = String(Math.floor(Math.max(0, m) / 60) % 24).padStart(2, '0');
  const mn = String(Math.max(0, m) % 60).padStart(2, '0');
  return `${h}:${mn}`;
}

function _mergeBlocked(blocked) {
  blocked.sort((a, b) => a.s - b.s);
  const merged = [];
  for (const b of blocked) {
    if (merged.length && b.s <= merged[merged.length - 1].e)
      merged[merged.length - 1].e = Math.max(merged[merged.length - 1].e, b.e);
    else merged.push({ s: b.s, e: b.e });
  }
  return merged;
}

function _buildBlocked(dateStr, alreadyPlaced = []) {
  const dayIdx = new Date(dateStr + 'T12:00').getDay();
  const wake   = timeToMins(S.wakeTime  || '07:00');
  const sleep  = timeToMins(S.sleepTime || '23:00');

  const blocked = [{ s: 0, e: wake }];
  if (sleep > wake) {
    blocked.push({ s: sleep, e: 24 * 60 });
  }

  (S.anchors || [])
    .filter(a => {
      if (parseInt(a.day) !== dayIdx) return false;
      if (a.endDate && dateStr > a.endDate) return false;
      if (a.oneTimeDate && a.oneTimeDate !== dateStr) return false;
      return true;
    })
    .forEach(a => {
      const s = timeToMins(a.start) - (a.travelMin || 0);
      const e = timeToMins(a.end)   + (a.travelMin || 0) + 20; // 20 min rest buffer
      blocked.push({ s: Math.max(0, s), e: Math.min(24 * 60, e) });
    });

  alreadyPlaced
    .filter(t => t.date === dateStr)
    .forEach(t => {
      const s   = timeToMins(t.time);
      const dur = parseInt(String(t.duration).match(/\d+/)?.[0] || 60);
      blocked.push({ s, e: s + dur + 15 }); // 15 min mandatory break
    });

  (S.tasks || [])
    .filter(t => t.date === dateStr && (t.done || t.missed))
    .forEach(t => {
      const s   = timeToMins(t.time);
      const dur = parseInt(String(t.duration).match(/\d+/)?.[0] || 60);
      blocked.push({ s, e: s + dur });
    });

  return _mergeBlocked(blocked);
}

// Determines the optimal start block based on user's focus_time preference
function getPreferredStartRange(focusTimePref) {
  if (!focusTimePref) return { min: 0, max: 24*60 };
  if (focusTimePref.includes('בוקר')) return { min: 6*60, max: 11*60 };
  if (focusTimePref.includes('צהריים')) return { min: 11*60, max: 15*60 };
  if (focusTimePref.includes('אחה"צ')) return { min: 14*60, max: 19*60 };
  if (focusTimePref.includes('ערב')) return { min: 18*60, max: 24*60 };
  return { min: 0, max: 24*60 };
}

function findBestFreeSlot(dateStr, alreadyPlaced, blockNeeded, preferredRange) {
  const merged = _buildBlocked(dateStr, alreadyPlaced);
  let wake   = timeToMins(S.wakeTime  || '07:00');
  const sleep  = timeToMins(S.sleepTime || '23:00');
  // Overnight (sleep <= wake, e.g. wake 14:00 / sleep 02:00) → treat the awake
  // window as running to end-of-day, else night-owls get an empty week.
  const effSleep = sleep > wake ? sleep : 24 * 60;

  // Ignore past hours if today
  const now = new Date();
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const todayStr = typeof ld === 'function' ? ld(now) : d.toISOString().split('T')[0];
  if (dateStr === todayStr) {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    wake = Math.max(wake, currentMins + 15);
  }

  let validSlots = [];
  
  let cursor = wake;
  for (const block of merged) {
    if (block.s > cursor && block.s - cursor >= blockNeeded) {
      validSlots.push({ s: cursor, e: block.s });
    }
    cursor = Math.max(cursor, block.e);
  }
  if (effSleep - cursor >= blockNeeded) {
    validSlots.push({ s: cursor, e: effSleep });
  }

  if (validSlots.length === 0) return null;

  // Try to find a slot within preferred hours
  if (preferredRange) {
    const ideal = validSlots.find(v => v.s >= preferredRange.min && v.s <= preferredRange.max && v.e - v.s >= blockNeeded);
    if (ideal) return ideal.s;
    const partial = validSlots.find(v => v.e > preferredRange.min && v.s < preferredRange.max);
    if (partial) {
      const pStart = Math.max(partial.s, preferredRange.min);
      if (partial.e - pStart >= blockNeeded) return pStart;
    }
  }

  // Strict boundary check (e.g. for exams)
  if (preferredRange && preferredRange.strictMax !== undefined) {
    const strictFallback = validSlots.find(v => v.e - v.s >= blockNeeded && v.s <= preferredRange.strictMax);
    return strictFallback ? strictFallback.s : null;
  }

  // Fallback: prefer a slot near the middle of the LARGEST free region instead of
  // always returning the earliest one. This stops sessions from stacking at the
  // very top of every morning and spreads them through each day's open time.
  // Deterministic: widest region wins, ties break on the earlier region.
  let best = null;
  for (const v of validSlots) {
    const span = v.e - v.s;
    if (span < blockNeeded) continue;
    if (!best || span > (best.e - best.s)) best = v;
  }
  if (!best) return validSlots[0].s;
  // Centre the block within the region, clamped so it still fits.
  const mid = Math.floor((best.s + best.e) / 2 - blockNeeded / 2);
  return Math.max(best.s, Math.min(mid, best.e - blockNeeded));
}

function getDayFreeMinutes(dateStr) {
  let wake   = timeToMins(S.wakeTime  || '07:00');
  const sleep  = timeToMins(S.sleepTime || '23:00');
  const effSleep = sleep > wake ? sleep : 24 * 60; // overnight → end-of-day

  // Ignore past hours if today
  const now = new Date();
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const todayStr = typeof ld === 'function' ? ld(now) : d.toISOString().split('T')[0];
  if (dateStr === todayStr) {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    wake = Math.max(wake, currentMins + 15);
  }

  const merged = _buildBlocked(dateStr);

  let free = 0, cursor = wake;
  for (const b of merged) {
    if (b.s > cursor) free += b.s - cursor;
    cursor = Math.max(cursor, b.e);
  }
  if (effSleep > cursor) free += effSleep - cursor;
  return Math.max(0, free);
}

function buildInterleavedQueue(sessionsMap) {
  const items = Object.entries(sessionsMap)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ name, rem: n }));

  const queue = [];
  while (items.some(i => i.rem > 0)) {
    let placed = false;
    for (const item of items) {
      if (item.rem > 0 && queue[queue.length - 1] !== item.name) {
        queue.push(item.name); item.rem--; placed = true; break;
      }
    }
    if (!placed) {
      const best = items.find(i => i.rem > 0);
      if (best) { queue.push(best.name); best.rem--; }
      else break;
    }
  }
  return queue;
}

// Main Algorithm
function generateWeeklySchedule(answers) {
  _schedIdSeq = 0; // reset per-generation id counter for deterministic fallback ids
  const profile = S.profile || {};
  const loadPct = LOAD_PCT[answers.load] || 0.62;
  const today   = typeof ld === 'function' ? ld(new Date()) : new Date().toISOString().split('T')[0];

  // Map Profile -> Block Duration
  let sessionMin = 60; // default
  if (profile.focus_span) {
    if (profile.focus_span.includes('25')) sessionMin = 30;
    else if (profile.focus_span.includes('45')) sessionMin = 45;
    else if (profile.focus_span.includes('60')) sessionMin = 60;
    else if (profile.focus_span.includes('90')) sessionMin = 90;
  }
  
  const breakMin = 15;
  const blockMin = sessionMin + breakMin;
  
  const prefRange = getPreferredStartRange(profile.focus_time);

  const startD = answers.startDate ? new Date(answers.startDate + 'T12:00') : new Date();
  const endD = answers.endDate ? new Date(answers.endDate + 'T12:00') : new Date(startD.getTime() + 6*86400000);
  const days = [];
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const ds = typeof ld === 'function' ? ld(d) : d.toISOString().split('T')[0];
    if (ds >= today) days.push(ds);
  }

  // Phase A: Free pool
  let totalFreeMin = 0;
  days.forEach(date => totalFreeMin += getDayFreeMinutes(date));

  if (totalFreeMin < blockMin) {
    return { tasks: [], stats: { totalFreeMin: 0, studyMin: 0, sessions: 0, reason: 'no_time' } };
  }

  // Phase B: Quota
  const studyMin = Math.round(totalFreeMin * loadPct);
  const totalSessions = Math.max(1, Math.floor(studyMin / blockMin));

  // Phase C: Weights
  const weights = {};
  const exams = (S.exams || []).filter(e => e.date >= today);

  (S.courses || []).forEach(c => {
    let w = answers.courseDifficulty?.[c.name] || 3;
    const exam = exams.find(e => e.course === c.name);
    if (exam) {
      const dLeft = Math.ceil((new Date(exam.date) - new Date()) / 86400000);
      if (dLeft <= 3)  w *= 2.5;
      else if (dLeft <= 7)  w *= 1.8;
      else if (dLeft <= 14) w *= 1.4;
    }
    if (profile.exam_fear && profile.exam_fear.includes('לסיים') && w > 3) w *= 1.2;
    weights[c.name] = Math.max(0.5, w);
  });

  // Hobby Quota
  const hobbySessions = {};
  (answers.selectedHobbies || []).forEach(hName => {
    const h = (S.hobbies || []).find(x => x.name === hName);
    hobbySessions[hName] = Math.min(h?.timesPerWeek || 2, 5);
  });
  const totalHobbyS = Object.values(hobbySessions).reduce((s, n) => s + n, 0);

  // Homework Quota
  // Data-integrity: drop homework that can never be placed — due before the first
  // schedulable day, or with a non-positive duration — BEFORE it reserves quota
  // (otherwise it silently steals course/hobby sessions and is never placed).
  const firstDay = days[0];
  const validHomework = (answers.homework || []).filter(hw =>
    Number(hw.duration) > 0 && (!firstDay || !(hw.date < firstDay))
  );
  let totalHwS = 0;
  validHomework.forEach(hw => {
    totalHwS += Math.max(1, Math.ceil(hw.duration / sessionMin));
  });

  const courseStudyS = Math.max(0, totalSessions - totalHobbyS - totalHwS);
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
  const sessionsMap = {};
  
  // Largest-remainder apportionment so rounding leftovers are handed to the
  // courses with the biggest fractional shares, instead of dumping the whole
  // remainder on the last course in key order (which could zero a high-weight,
  // near-exam course). Deterministic: ties break on original key order.
  const courseNames = Object.keys(weights);
  const _shares = courseNames.map((c, i) => {
    const exact = (weights[c] / totalWeight) * courseStudyS;
    const base = Math.floor(exact);
    return { c, i, base, frac: exact - base };
  });
  let _assigned = _shares.reduce((s, x) => s + x.base, 0);
  let _leftover = Math.max(0, courseStudyS - _assigned);
  _shares
    .slice()
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i))
    .forEach(x => { if (_leftover > 0) { x.base += 1; _leftover -= 1; } });
  _shares.forEach(x => { sessionsMap[x.c] = Math.max(0, x.base); });

  Object.assign(sessionsMap, hobbySessions);

  // Phase D: Placement
  const placed = [];
  const dailyCounts = {};
  const dailyItemCounts = {};
  days.forEach(d => { dailyCounts[d] = 0; dailyItemCounts[d] = {}; });

  // Track requested-vs-placed so we can surface a shortfall instead of silently
  // dropping sessions the per-day caps couldn't fit.
  let reqHomeworkS = 0, placedHomeworkS = 0;
  const unplacedHomework = []; // names of homework that couldn't be fully placed

  // Phase D.1: Homework Placement (highest priority)
  validHomework.forEach(hw => {
    // Track the last placed day PER-homework, so two assignments don't push each
    // other off their own preferred days (and risk missing a due date).
    let hwLastPlacedDay = -99;
    const reqS = Math.max(1, Math.ceil(hw.duration / sessionMin));
    reqHomeworkS += reqS;
    let hwPlaced = 0;
    for (let i = 0; i < reqS; i++) {
      for (const date of days) {
        if (date > hw.date) continue;
        const dayIdx = days.indexOf(date);
        // Avoid cramming all homework on same day if multiple sessions needed
        if (reqS > 1 && dayIdx === hwLastPlacedDay) continue; 
        const maxPerDay = answers.load === 'heavy' ? 6 : answers.load === 'light' ? 3 : 5;
        if (dailyCounts[date] >= maxPerDay) continue;
        const slot = findBestFreeSlot(date, placed, sessionMin + breakMin, prefRange);
        if (slot !== null) {
          placed.push({
            id: _genTaskId(),
            course: hw.course, name: hw.name, date,
            time: minsToTime(slot), duration: `${sessionMin} דק'`,
            priority: 'קריטי', done: false, missed: false, isHobby: false, isHomework: true
          });
          dailyCounts[date]++;
          hwLastPlacedDay = days.indexOf(date);
          hwPlaced++;
          break;
        }
      }
    }
    placedHomeworkS += hwPlaced;
    if (hwPlaced < reqS) unplacedHomework.push(hw.name || hw.course || 'מטלה');
  });

  // Phase D.2: Hobby Placement (second priority — hobbies are commitments, not optional)
  // Prefer afternoon/evening for hobbies (14:00–22:00)
  const hobbyPrefRange = { min: 14 * 60, max: 22 * 60 };
  const hobbyNames = new Set((answers.selectedHobbies || []).filter(h => hobbySessions[h] > 0));
  const hobbyDayLimit = answers.load === 'heavy' ? 6 : 4; // more relaxed limit for hobbies

  hobbyNames.forEach(hName => {
    const hobbyDef = (S.hobbies || []).find(h => h.name === hName);
    const hobbyDur = hobbyDef?.sessionDuration || 45;
    const hobbyBlock = hobbyDur + breakMin;
    let sessLeft = hobbySessions[hName] || 0;
    // Spread evenly: try to maintain at least 1 day gap between sessions
    let lastPlacedDay = -99;
    for (const date of days) {
      if (sessLeft <= 0) break;
      const dayIdx = days.indexOf(date);
      // Enforce minimum gap (e.g., not 2 days in a row)
      if (dayIdx - lastPlacedDay < 2) continue;
      if (dailyCounts[date] >= hobbyDayLimit) continue;
      if ((dailyItemCounts[date][hName] || 0) >= 1) continue;
      // Try preferred range first, then any time
      let slot = findBestFreeSlot(date, placed, hobbyBlock, hobbyPrefRange);
      if (slot === null) slot = findBestFreeSlot(date, placed, hobbyBlock, null);
      if (slot !== null) {
        placed.push({
          id: _genTaskId(),
          course: hName, name: _hobbyLabel(hName), date,
          time: minsToTime(slot), duration: `${hobbyDur} דק'`,
          priority: 'תחביב', done: false, missed: false, isHobby: true
        });
        dailyCounts[date]++;
        dailyItemCounts[date][hName] = (dailyItemCounts[date][hName] || 0) + 1;
        lastPlacedDay = dayIdx;
        sessLeft--;
      }
    }
    // Second pass: if still sessions left, try again without gap constraint
    if (sessLeft > 0) {
      for (const date of days) {
        if (sessLeft <= 0) break;
        if ((dailyItemCounts[date][hName] || 0) >= 1) continue;
        if (dailyCounts[date] >= hobbyDayLimit + 1) continue;
        let slot = findBestFreeSlot(date, placed, hobbyBlock, null);
        if (slot !== null) {
          placed.push({
            id: _genTaskId(),
            course: hName, name: _hobbyLabel(hName), date,
            time: minsToTime(slot), duration: `${hobbyDur} דק'`,
            priority: 'תחביב', done: false, missed: false, isHobby: true
          });
          dailyCounts[date]++;
          dailyItemCounts[date][hName] = (dailyItemCounts[date][hName] || 0) + 1;
          sessLeft--;
        }
      }
    }
  });

  // Phase D.3: Course sessions (interleaved, with time preference per difficulty)
  // Hard courses try to get placed at peak-time, easy courses at any time
  const hardPref = prefRange; // user's preferred focus time = hard course time
  const courseQueue = buildInterleavedQueue(
    Object.fromEntries(Object.entries(sessionsMap).filter(([k]) => !hobbyNames.has(k)))
  );

  for (const item of courseQueue) {
    const isHard = (weights[item] || 3) >= 4;
    const slotPref = isHard ? hardPref : null; // hard = peak time, easy = any time
    const blockNeed = sessionMin + breakMin;

    // Near-exam (≤3 days) courses get maxSameDay=2 even under non-heavy load.
    // Hoisted here so the fallback loop below can apply the same cap.
    const nextExam = exams.filter(e => e.course === item).sort((a, b) => a.date.localeCompare(b.date))[0];
    const daysToExam = nextExam ? Math.ceil((new Date(nextExam.date) - new Date()) / 86400000) : Infinity;
    const examIsNear = daysToExam <= 3;
    const maxSameDay = answers.load === 'heavy' ? 2 : (examIsNear ? 2 : 1);

    // Place onto the least-loaded eligible day first (anti front-loading), instead
    // of always walking the week in date order. Ties break chronologically so the
    // output stays deterministic. The "yesterday" lookup below still indexes the
    // original `days` array, so spaced-repetition logic is unaffected.
    let placedSession = false;
    const daysByLoad = days
      .map((d, i) => ({ d, i }))
      .sort((a, b) => (dailyCounts[a.d] - dailyCounts[b.d]) || (a.i - b.i))
      .map(x => x.d);
    for (const date of daysByLoad) {
      const maxPerDay = answers.load === 'heavy' ? 5 : answers.load === 'light' ? 2 : 4;
      if (dailyCounts[date] >= maxPerDay) continue;
      if ((dailyItemCounts[date][item] || 0) >= maxSameDay) continue;

      // Avoid same course on consecutive days (spaced repetition)
      const yesterday = days[days.indexOf(date) - 1];
      if (yesterday && (dailyItemCounts[yesterday]?.[item] || 0) >= 1 && answers.load !== 'heavy') continue;

      // Check if there is an exam for this course on this date
      const courseExam = exams.find(e => e.course === item && e.date === date);
      let examMin = null;
      if (courseExam && courseExam.time && courseExam.time !== '00:00') {
        const parts = String(courseExam.time).split(':');
        examMin = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
      }
      // No exam time set → examMin stays null → no "must finish before exam"
      // restriction, so the exam day still gets study. (Faking 08:00 here used to
      // wipe the most important study slot.)

      // If it's an exam day, only allow slots that finish BEFORE the exam starts
      let localPref = slotPref;
      if (examMin !== null) {
        if (examMin <= blockNeed) continue; // No time to study before the exam on this day
        if (localPref) {
          localPref = { min: localPref.min, max: Math.min(localPref.max, examMin - blockNeed), strictMax: examMin - blockNeed };
          if (localPref.min >= localPref.max) localPref = { min: 0, max: examMin - blockNeed, strictMax: examMin - blockNeed };
        } else {
          localPref = { min: 0, max: examMin - blockNeed, strictMax: examMin - blockNeed };
        }
      }

      let slot = findBestFreeSlot(date, placed, blockNeed, localPref);
      if (slot === null && localPref && examMin === null) slot = findBestFreeSlot(date, placed, blockNeed, null); // fallback (only if not restricted by exam)
      if (slot !== null) {
        let taskName = item;
        if (profile.style) {
          if (profile.style.includes('תרגילים')) taskName = 'תרגול ומטלות';
          else if (profile.style.includes('וידאו')) taskName = 'הרצאות מוקלטות';
          else if (profile.style.includes('קריאה')) taskName = 'סיכום וקריאה';
        }
        placed.push({
          id: _genTaskId(),
          course: item, name: taskName, date,
          time: minsToTime(slot), duration: `${sessionMin} דק'`,
          priority: isHard ? 'גבוה' : 'בינוני',
          done: false, missed: false, isHobby: false
        });
        dailyCounts[date]++;
        dailyItemCounts[date][item] = (dailyItemCounts[date][item] || 0) + 1;
        placedSession = true;
        break;
      }
    }

    if (!placedSession) {
      // Fallback: Drop spaced repetition and preference rules, just find any slot.
      // Still respect maxSameDay so packing converges with the primary path.
      for (const date of days) {
        const maxPerDay = answers.load === 'heavy' ? 5 : answers.load === 'light' ? 2 : 4;
        if (dailyCounts[date] >= maxPerDay) continue;
        if ((dailyItemCounts[date][item] || 0) >= maxSameDay) continue;

        // Respect the exam-time cutoff in the fallback too — never schedule study
        // that finishes AFTER the exam it's preparing for.
        const fbExam = exams.find(e => e.course === item && e.date === date);
        let fbPref = null;
        if (fbExam && fbExam.time && fbExam.time !== '00:00') {
          const pp = String(fbExam.time).split(':');
          const fbExamMin = (parseInt(pp[0]) || 0) * 60 + (parseInt(pp[1]) || 0);
          if (fbExamMin <= blockNeed) continue;
          fbPref = { min: 0, max: fbExamMin - blockNeed, strictMax: fbExamMin - blockNeed };
        }
        let slot2 = findBestFreeSlot(date, placed, blockNeed, fbPref);
        if (slot2 !== null) {
          let taskName = item;
          if (profile.style) {
            if (profile.style.includes('תרגילים')) taskName = 'תרגול ומטלות';
            else if (profile.style.includes('וידאו')) taskName = 'הרצאות מוקלטות';
            else if (profile.style.includes('קריאה')) taskName = 'סיכום וקריאה';
          }
          placed.push({
            id: _genTaskId(),
            course: item, name: taskName, date,
            time: minsToTime(slot2), duration: `${sessionMin} דק'`,
            priority: isHard ? 'גבוה' : 'בינוני',
            done: false, missed: false, isHobby: false
          });
          dailyCounts[date]++;
          dailyItemCounts[date][item] = (dailyItemCounts[date][item] || 0) + 1;
          break;
        }
      }
    }
  }

  // Apply hobby boost if requested (user clicked "more hobbies" in dislike flow)
  if (answers._hobbyBoost) {
    // Already placed hobbies above; no extra action needed (they're already prioritized)
  }

  // Safety pass: remove any placed task that overlaps with an anchor
  const finalPlaced = placed.filter(t => {
    const tStart = timeToMins(t.time);
    const tDur = parseInt(String(t.duration).match(/\d+/)?.[0] || 60);
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

  // Requested-vs-placed accounting. Course requests = one queue entry per session;
  // placed counts come from finalPlaced (after the anchor safety pass), so the
  // shortfall reflects what actually survived into the plan.
  const reqCourseS = courseQueue.length;
  const placedCourseS = finalPlaced.filter(t => !t.isHobby && !t.isHomework).length;
  const placedHwFinal = finalPlaced.filter(t => t.isHomework).length;
  const unplaced = {
    course: Math.max(0, reqCourseS - placedCourseS),
    homework: Math.max(0, reqHomeworkS - placedHwFinal),
    homeworkNames: unplacedHomework.slice()
  };
  if (unplaced.homework > 0) {
    try {
      console.warn('[scheduler] homework sessions could not be placed:',
        unplaced.homework, unplaced.homeworkNames);
    } catch (_) {}
  }

  return {
    tasks: finalPlaced,
    stats: {
      totalFreeMin,
      studyMin: finalPlaced.length * sessionMin,
      sessions: finalPlaced.length,
      requested: reqCourseS + reqHomeworkS,
      placed: finalPlaced.length,
      unplaced,
      reason: finalPlaced.length === 0 ? 'no_time' : 'ok'
    }
  };
}

