// ── INIT & ONBOARDING ──
window.onload = () => {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) { try { Object.assign(S, JSON.parse(saved)); } catch(e) { localStorage.removeItem(LS_KEY); } }

  const _hadMagic = /[?&]magic=/.test(location.search);
  if (typeof sfSyncHandleMagic === 'function') sfSyncHandleMagic();   // ?magic=<token> → log in + sync
  // Normal return visit while synced → pull any changes + open the live stream
  if (!_hadMagic && typeof isSynced === 'function' && isSynced()) {
    if (typeof sfSyncPull === 'function') sfSyncPull(true);
    if (typeof sfSyncConnectStream === 'function') sfSyncConnectStream();
  }

  _validateStreak();
  _pruneOldData();
  if (typeof _normalizeCourses === 'function') _normalizeCourses();

  // For new users: follow the OS preference
  if (!S.theme) {
    S.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  [document.documentElement, document.body].forEach(function(el){el.setAttribute('data-theme', S.theme);});
  if (S.userName) { initApp(); return; }
  // Onboarding: follow OS preference too
  [document.documentElement, document.body].forEach(function(el){el.setAttribute('data-theme', S.theme);});
  document.getElementById('setup-screen').style.display = '';
  const bn = document.getElementById('bottom-nav'); if (bn) bn.style.display = 'none';
  const firstSlide = document.getElementById('ob2-s1');
  if (firstSlide) firstSlide.classList.add('ob2-active');
  _obUpdateProgress();
};

const save = () => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(S));
    if (typeof sfSyncPush === 'function') sfSyncPush();   // mirror to the cloud (debounced) when synced
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // Try to free space: force-prune old data, drop oldest done/missed, retry once
      try {
        localStorage.removeItem('sf_last_prune');
        if (typeof _pruneOldData === 'function') _pruneOldData();
        if (Array.isArray(S.tasks)) {
          const oldDone = S.tasks.filter(t => t.done || t.missed).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
          // Remove up to the oldest 50 done/missed tasks to reclaim space
          const drop = new Set(oldDone.slice(0, 50));
          if (drop.size) S.tasks = S.tasks.filter(t => !drop.has(t));
        }
        localStorage.setItem(LS_KEY, JSON.stringify(S));
        return;
      } catch(e2) {
        toast('אחסון מלא — מחק נתונים ישנים כדי לשמור');
      }
    }
  }
};

function renderAll() {
  // ── Global chrome: present on every screen, so always repaint ──
  if (typeof renderHomework === 'function')      renderHomework();
  if (typeof renderTodayTasks === 'function')    renderTodayTasks();
  if (typeof renderWRSidebarCard === 'function') renderWRSidebarCard();
  if (typeof updateHeaderStats === 'function')   updateHeaderStats();

  // ── Active page: dispatch through the SAME map showPage uses (no drift) ──
  if (typeof PAGE_RENDERERS === 'object') {
    for (const pageId in PAGE_RENDERERS) {
      const el = document.getElementById(pageId);
      if (el && el.classList.contains('active')) {
        try { PAGE_RENDERERS[pageId](); } catch (e) { console.warn('renderAll page', pageId, e); }
      }
    }
  }

  // ── Visible data overlays/modals: repaint so open displays don't go stale ──
  if (typeof SYNC_OVERLAYS !== 'undefined') {
    for (const [isOpen, render] of SYNC_OVERLAYS) {
      try { if (isOpen()) render(); } catch (e) { console.warn('renderAll overlay', e); }
    }
  }
}

function renderWeeklyProgress() {
  const wrap = document.getElementById('home-weekly-chart');
  if (!wrap) return;
  const now = new Date();
  const weeks = [];
  for (let w = 3; w >= 0; w--) {
    const sun = new Date(now);
    sun.setDate(now.getDate() - now.getDay() - w * 7);
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
    const start = ld(sun); const end = ld(sat);
    const weekTasks = (S.tasks || []).filter(t => t.date >= start && t.date <= end && !t.isHobby);
    const total = weekTasks.length;
    const done = weekTasks.filter(t => t.done).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    weeks.push({ label: w === 0 ? 'שבוע זה' : w === 1 ? 'שבוע שעבר' : `לפני ${w * 7}י'`, total, done, pct });
  }
  wrap.innerHTML = weeks.map(w => {
    const barH = Math.max(4, Math.round((w.pct / 100) * 56));
    const color = w.pct >= 80 ? 'var(--green)' : w.pct >= 50 ? 'var(--accent)' : w.pct > 0 ? 'var(--yellow)' : 'var(--border)';
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:0.2rem">
      <div style="font-size:0.72rem;font-weight:800;color:var(--text)">${w.pct}%</div>
      <div style="width:100%;background:var(--surface2);border-radius:6px 6px 3px 3px;height:56px;display:flex;flex-direction:column;justify-content:flex-end">
        <div style="background:${color};width:100%;height:${barH}px;border-radius:6px 6px 3px 3px;transition:height 0.5s ease"></div>
      </div>
      <div style="font-size:0.62rem;color:var(--muted);text-align:center">${w.label}</div>
      <div style="font-size:0.6rem;color:var(--muted)">${w.done}/${w.total}</div>
    </div>`;
  }).join('');
}

function updateHeaderStats() {
  if (!Array.isArray(S.exams)) S.exams = [];
  const today = ld(new Date());
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekExams = S.exams.filter(e => e.date >= ld(weekStart) && e.date <= ld(weekEnd)).length;
  if (document.getElementById('sc-exams')) animateCount(document.getElementById('sc-exams'), weekExams);
  renderTreeMini();
  renderNextTaskCountdown();
  // urgent exam banner
  const sorted = [...S.exams].sort((a,b)=>a.date.localeCompare(b.date));
  const urgent = sorted.find(e => { const dl = daysUntil(e.date); return dl >= 0 && dl <= 7; });
  const _ueBanner = document.getElementById('urgent-exam-banner');
  if (urgent) {
    const daysLeft = Math.max(0, daysUntil(urgent.date));
    if (_ueBanner) _ueBanner.classList.remove('hidden');
    const _ueText = document.getElementById('urgent-exam-text');
    const whenTxt = daysLeft === 0 ? 'היום' : daysLeft === 1 ? 'מחר' : `בעוד ${daysLeft} ימים`;
    if (_ueText) _ueText.textContent = `מבחן ב-${urgent.course} ${whenTxt}!`;
    const _ueSub = document.getElementById('urgent-exam-sub');
    if (_ueSub) _ueSub.textContent = `תאריך: ${urgent.date}`;
  } else {
    if (_ueBanner) _ueBanner.classList.add('hidden');
  }
}

function renderNextTaskCountdown() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  const widget = document.getElementById('next-task-widget');
  if (!widget) return;

  function tick() {
    const now = new Date(); const today = ld(now);
    const nowSecs = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
    const upcoming = S.tasks.filter(t => t.date === today && !t.done && !t.missed)
      .map(t => { const [hh,mm] = (t.time||'00:00').split(':').map(Number); return {...t, secs: hh*3600 + mm*60}; })
      .filter(t => t.secs > nowSecs).sort((a,b) => a.secs - b.secs);
    if (!upcoming.length) {
      widget.classList.add('hidden');
      clearInterval(countdownInterval); countdownInterval = null; return;
    }
    const next = upcoming[0];
    const diff = next.secs - nowSecs;
    if (diff <= 0) { clearInterval(countdownInterval); countdownInterval = null; renderNextTaskCountdown(); return; }
    const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60), s = diff%60;
    const timeStr = h > 0
      ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const isUrgent = diff < 600;
    widget.classList.remove('hidden');
    widget.innerHTML = `
      <div class="ntw-accent-bar${isUrgent?' urgent':''}"></div>
      <div class="ntw-body">
        <div class="ntw-info">
          <div class="ntw-label">משימה הבאה · ${next.time}</div>
          <div class="ntw-task-name">${escapeHtml(next.name)}</div>
          <div class="ntw-course">${escapeHtml(next.course || 'ללא קורס')}</div>
        </div>
        <div class="ntw-timer">
          <div class="ntw-digits${isUrgent?' urgent':''}">${timeStr}</div>
          <div class="ntw-timer-label">${isUrgent ? ' עכשיו' : 'עד המשימה'}</div>
        </div>
      </div>`;
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

function toggleTheme() {
  S.theme = S.theme === 'dark' ? 'light' : 'dark';
  [document.documentElement, document.body].forEach(function(el){el.setAttribute('data-theme', S.theme);});
  const lbl = document.getElementById('theme-btn-label');
  if (lbl) lbl.textContent = S.theme === 'dark' ? '☀️ מצב יום' : '🌙 מצב לילה';
  save();
}

function confirmReset() {
  if (confirm('האם למחוק את כל הנתונים? לא ניתן לשחזר.')) {
    localStorage.removeItem(LS_KEY);
    location.reload();
  }
}

// keep backward-compat alias
function resetSettings() { confirmReset(); }

// ── SIDEBAR TOGGLE ──
function _setBodyLock(locked) {
  if (window.innerWidth > 768) return; // desktop doesn't need iOS scroll lock
  if (locked) {
    const y = window.scrollY;
    document.body.dataset.scrollY = y;
    document.body.style.top = `-${y}px`;
    document.body.classList.add('scroll-locked');
  } else {
    const y = parseInt(document.body.dataset.scrollY || '0');
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, y);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('hamburger-btn');
  const mc = document.querySelector('.main-content');
  const open = sidebar.classList.toggle('open');
  if (window.innerWidth >= 769) {
    mc.style.marginRight = open ? '265px' : '0';
  } else {
    overlay.classList.toggle('visible', open);
    _setBodyLock(open);
  }
  if (btn) btn.classList.toggle('open', open);
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('hamburger-btn');
  const mc = document.querySelector('.main-content');
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  mc.style.marginRight = '0';
  if (btn) btn.classList.remove('open');
  if (window.innerWidth < 769) _setBodyLock(false);
}

// Tap/click anywhere outside the open sidebar (desktop or mobile) closes it.
document.addEventListener('click', function (e) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || !sidebar.classList.contains('open')) return;
  if (sidebar.contains(e.target)) return;                 // inside the sidebar
  const btn = document.getElementById('hamburger-btn');
  if (btn && btn.contains(e.target)) return;              // the toggle itself
  closeSidebar();
});

// ── SETTINGS MODAL ──
function toggleAccordion(id) {
  const clicked = document.getElementById(id);
  const isOpen = clicked.classList.contains('open');
  document.querySelectorAll('#settings-modal .acc-section').forEach(s => s.classList.remove('open'));
  if (!isOpen) clicked.classList.add('open');
}

function openSettings() {
  if (typeof _sfRenderSyncUI === 'function') _sfRenderSyncUI();
  document.getElementById('settings-name').value = S.userName || '';
  document.getElementById('settings-inst').value = S.institution || '';
  const heroAvatar = document.getElementById('settings-hero-avatar');
  const heroName = document.getElementById('settings-hero-name');
  if (heroAvatar) heroAvatar.textContent = (S.userName || '?').charAt(0).toUpperCase();
  if (heroName) heroName.textContent = S.userName || 'משתמש';
  const wakeEl = document.getElementById('settings-wake');
  const sleepEl = document.getElementById('settings-sleep');
  if (wakeEl) wakeEl.value = S.wakeTime || '07:00';
  if (sleepEl) sleepEl.value = S.sleepTime || '23:00';
  const keyEl = document.getElementById('settings-api-key');
  if (keyEl) keyEl.value = S.apiKey || '';
  const keyStatus = document.getElementById('api-key-status');
  if (keyStatus) {
    keyStatus.textContent = S.apiKey ? ` מפתח שמור: ${S.apiKey.slice(0,7)}...` : '️ לא הוגדר — AI לא יעבודק';
    keyStatus.style.color = S.apiKey ? 'var(--green)' : '#f59e0b';
  }
  const banner = document.getElementById('api-managed-banner');
  if (banner) {
    if (S.apiKey) {
      banner.style.display = 'none';
    } else {
      banner.style.display = '';
      banner.style.background = 'var(--orange-light, #fff7ed)';
      banner.style.border = '1px solid #f59e0b';
      banner.style.color = '#b45309';
      banner.textContent = '️ נדרש מפתח API כדי שהמערכת תפעל — הכנס למטה';
    }
  }
  const lbl = document.getElementById('theme-btn-label');
  if (lbl) lbl.textContent = S.theme === 'dark' ? '☀️ מצב יום' : '🌙 מצב לילה';
  // Open AI section if no key configured so user can find where to enter it
  document.querySelectorAll('#settings-modal .acc-section').forEach(s => s.classList.remove('open'));
  const firstAccId = (!S.apiKey) ? 'acc-ai' : 'acc-personal';
  const first = document.getElementById(firstAccId);
  if (first) first.classList.add('open');
  document.getElementById('settings-modal').classList.remove('hidden');
  _setBodyLock(true);
}

function saveSettings() {
  const name = document.getElementById('settings-name').value.trim();
  const inst = document.getElementById('settings-inst').value.trim();
  const wake = document.getElementById('settings-wake').value;
  const sleep = document.getElementById('settings-sleep').value;
  const apiKeyEl = document.getElementById('settings-api-key');
  // Strip ALL whitespace (spaces, newlines, tabs) — common paste issue
  const apiKey = apiKeyEl ? apiKeyEl.value.replace(/\s+/g, '') : '';
  if (name && name.length > 50) { toast('שם ארוך מדי (מקסימום 50 תווים)'); return; }
  if (inst && inst.length > 80) { toast('שם מוסד ארוך מדי (מקסימום 80 תווים)'); return; }
  if (name) S.userName = name;
  if (inst) S.institution = inst;
  if (timeToMins(wake) === timeToMins(sleep)) { toast('שעת השינה וההתעוררות לא יכולות להיות זהות'); return; }
  S.wakeTime = wake;
  S.sleepTime = sleep;
  S.apiKey = apiKey;
  save();
  closeModal('settings-modal');
  const sbName = document.getElementById('sb-name');
  if (sbName) sbName.textContent = S.userName || '—';
  const sbAvatar = document.getElementById('sb-avatar');
  if (sbAvatar) sbAvatar.textContent = (S.userName || '?')[0].toUpperCase();
  toast(apiKey ? ` הגדרות נשמרו · API Key: ${apiKey.slice(0,7)}...` : ' הגדרות נשמרו');
}

// ── OB2: Modern step-by-step onboarding ──
let _obStep = 1;
const _OB_TOTAL = 8;

function obStep(n) {
  // Validate before leaving current step
  if (_obStep === 1) {
    const name = (document.getElementById('inp-name')?.value || '').trim();
    if (!name) { toast('נא למלא את שמך'); return; }
    S.userName = name;
    S.institution = (document.getElementById('inp-inst')?.value || '').trim();
  }
  if (_obStep === 2) {
    const wake2 = document.getElementById('inp-wake')?.value || '08:00';
    const sleep2 = document.getElementById('inp-sleep')?.value || '22:00';
    if (timeToMins(wake2) === timeToMins(sleep2)) { toast('שעת השינה וההתעוררות לא יכולות להיות זהות'); return; }
    S.wakeTime = wake2;
    S.sleepTime = sleep2;
  }
  if (_obStep === 7) {
    // Finalize profile before summary step
    S.profile = {
      focus_time: 'בוקר 06–10', focus_span: '60–75 דקות',
      style: 'קריאה וסיכום', exam_fear: 'לא לסיים ללמוד',
      ...profileAnswers
    };
    _obBuildSummary();
  }

  const from = document.getElementById('ob2-s' + _obStep);
  const to   = document.getElementById('ob2-s' + n);
  if (!to) return;
  if (from) from.classList.remove('ob2-active');
  _obStep = n;
  to.classList.add('ob2-active');
  _obUpdateProgress();
  document.getElementById('setup-screen').scrollTop = 0;
  window.scrollTo(0, 0);
  if (n === 3) _abCheckEmpty();
}

function obBack() {
  if (_obStep <= 1) return;
  obStep(_obStep - 1);
}

function _obUpdateProgress() {
  const pct = (_obStep / _OB_TOTAL) * 100;
  const fill = document.getElementById('ob2-fill');
  const counter = document.getElementById('ob2-counter');
  const backBtn = document.getElementById('ob2-back');
  if (fill) fill.style.width = pct + '%';
  if (counter) counter.textContent = _obStep + ' מתוך ' + _OB_TOTAL;
  if (backBtn) backBtn.classList.toggle('hidden', _obStep === 1);
}

function obSelectChoice(el) {
  const qid = el.dataset.qid;
  el.closest('.ob2-choices').querySelectorAll('.ob2-choice').forEach(b => b.classList.remove('ob2-sel'));
  el.classList.add('ob2-sel');
  profileAnswers[qid] = el.dataset.val;
}

function _obBuildSummary() {
  const chips = document.getElementById('ob2-chips');
  if (!chips) return;
  const items = [
    { label: S.userName, cls: 'accent' },
    { label: S.wakeTime + '–' + S.sleepTime, cls: '' },
    S.anchors?.length ? { label: S.anchors.length + ' עוגנים', cls: 'green' } : null,
    profileAnswers.focus_time ? { label: profileAnswers.focus_time, cls: '' } : null,
    profileAnswers.focus_span ? { label: profileAnswers.focus_span, cls: '' } : null,
  ].filter(Boolean);
  chips.innerHTML = items.map(i => `<div class="ob2-chip ${i.cls}">${i.label}</div>`).join('');
}

// Legacy alias — kept for any residual calls
function obNext(step) { obStep(step + 1); }
function addAnchorRow(){
  const rowId='anch-'+uid();
  const dayShort=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  const colors=['#4f6ef7','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
  const defColor=colors[document.querySelectorAll('.anchor-builder-row').length % colors.length];
  // remove empty state if present
  const empty=document.getElementById('ab-empty-state');
  if(empty) empty.remove();
  const row=document.createElement('div'); row.className='anchor-builder-row'; row.id=rowId;
  row.innerHTML=`
    <div class="ab-card-top">
      <div class="ab-color-wrap" title="בחר צבע">
        <div class="ab-color-dot" id="${rowId}-dot" style="background:${defColor}" onclick="this.nextElementSibling.click()"></div>
        <input type="color" value="${defColor}" class="ab-color-inp" onchange="document.getElementById('${rowId}-dot').style.background=this.value" />
      </div>
      <input type="text" placeholder="שם המחויבות (שיעור, עבודה...)" class="ab-name-inp" maxlength="60" required />
      <button class="ab-del-btn" onclick="document.getElementById('${rowId}').remove();_abCheckEmpty()" title="הסר">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="ab-card-body">
      <label class="ab-label">ימים בשבוע <span class="ab-required">*</span></label>
      <div class="ab-days">${[0,1,2,3,4,5,6].map(d=>`<button type="button" class="ob-day-btn" data-day="${d}" onclick="toggleObDay(this,'${rowId}')">${dayShort[d]}</button>`).join('')}</div>
      <div class="ab-times-row">
        <div class="ab-time-card">
          <span class="ab-label" style="margin-bottom:0">התחלה</span>
          <input type="time" value="09:00" class="ob-def-start ab-time-inp" onchange="updateObPerDayRows('${rowId}')" />
        </div>
        <div class="ab-time-card">
          <span class="ab-label" style="margin-bottom:0">סיום</span>
          <input type="time" value="16:00" class="ob-def-end ab-time-inp" onchange="updateObPerDayRows('${rowId}')" />
        </div>
      </div>
      <div class="ab-travel-row-new">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        <span class="ab-travel-lbl">זמן נסיעה (דק')</span>
        <input type="number" value="0" min="0" max="180" class="ob-travel-inp ab-travel-num" placeholder="0" />
      </div>
      <div class="ab-forever-row">
        <input type="checkbox" class="ob-anchor-forever" checked onchange="const d=this.parentElement.querySelector('input[type=date]');d.disabled=this.checked;d.style.opacity=this.checked?'0.4':'1'" />
        <span>תמיד בתוקף</span>
        <input type="date" class="ob-anchor-end" style="opacity:0.4" disabled />
      </div>
      <div class="ob-per-day-wrap"></div>
    </div>`;
  document.getElementById('anchor-builder').appendChild(row);
}
function _abCheckEmpty(){
  const wrap=document.getElementById('anchor-builder');
  if(!wrap) return;
  if(!wrap.querySelector('.anchor-builder-row')){
    const e=document.createElement('div');e.id='ab-empty-state';e.className='anchor-builder-empty';
    e.innerHTML=`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>אין עדיין מחויבויות — לחץ הוסף</span>`;
    wrap.appendChild(e);
  }
}
function toggleObDay(btn, rowId) {
  btn.classList.toggle('active');
  updateObPerDayRows(rowId);
}
function updateObPerDayRows(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const activeDays = Array.from(row.querySelectorAll('.ob-day-btn.active')).map(b => parseInt(b.dataset.day));
  const perDayWrap = row.querySelector('.ob-per-day-wrap');
  if (!perDayWrap) return;
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const baseStart = row.querySelector('.ob-def-start')?.value || '09:00';
  const baseEnd = row.querySelector('.ob-def-end')?.value || '16:00';
  if (activeDays.length <= 1) { perDayWrap.innerHTML = ''; return; }
  if (!perDayWrap.querySelector('.ob-per-day-label')) {
    const lbl = document.createElement('div');
    lbl.className = 'ob-per-day-label';
    lbl.style.cssText = 'font-size:0.8rem;color:var(--muted);font-weight:700;font-weight:700;margin-bottom:0.35rem;margin-top:0.1rem';
    lbl.textContent = 'שעות שונות לכל יום (אופציונלי)';
    perDayWrap.prepend(lbl);
  }
  const existingDays = new Set(Array.from(perDayWrap.querySelectorAll('[data-day]')).map(el => parseInt(el.dataset.day)));
  activeDays.forEach(d => {
    if (!existingDays.has(d)) {
      const el = document.createElement('div');
      el.dataset.day = d;
      el.className = 'ob-per-day-row';
      el.innerHTML = `<span style="font-size:0.8rem;font-weight:700;color:var(--text)">${dayNames[d]}</span><input type="time" value="${baseStart}" style="font-size:0.78rem;padding:0.35rem" /><input type="time" value="${baseEnd}" style="font-size:0.78rem;padding:0.35rem" />`;
      perDayWrap.appendChild(el);
    }
  });
  Array.from(perDayWrap.querySelectorAll('[data-day]')).forEach(el => {
    if (!activeDays.includes(parseInt(el.dataset.day))) el.remove();
  });
}
function collectAnchors(){
  const results = [];
  document.querySelectorAll('.anchor-builder-row').forEach(row => {
    const name = (row.querySelector('input[type="text"]')?.value || '').trim();
    if (!name) return;
    if (name.length > 60) { toast('שם עוגן ארוך מדי (מקסימום 60 תווים)'); return; }
    const color = row.querySelector('input[type="color"]')?.value || '#4f6ef7';
    const travelMin = Math.max(0, Math.min(180, parseInt(row.querySelector('.ob-travel-inp')?.value || 0)));
    const activeDays = Array.from(row.querySelectorAll('.ob-day-btn.active')).map(b => parseInt(b.dataset.day));
    const defaultStart = row.querySelector('.ob-def-start')?.value || '09:00';
    const defaultEnd = row.querySelector('.ob-def-end')?.value || '16:00';
    if (!activeDays.length) return;
    activeDays.forEach(d => {
      const perDayEl = row.querySelector(`.ob-per-day-row[data-day="${d}"]`);
      let start = defaultStart; let end = defaultEnd;
      if (perDayEl) {
        const times = perDayEl.querySelectorAll('input[type="time"]');
        start = times[0]?.value || defaultStart;
        end = times[1]?.value || defaultEnd;
      }
      if (start === end) { if (typeof toast === 'function') toast(`⚠️ ${name}: שעת ההתחלה חייבת להיות שונה משעת הסיום`); return; }
      const foreverCb = row.querySelector('.ob-anchor-forever');
      const endDate = (!foreverCb || foreverCb.checked) ? null : (row.querySelector('.ob-anchor-end')?.value || null);
      results.push({ id: uid(), name, day: d, start, end, travelMin, color, endDate });
    });
  });
  return results;
}
function renderProfileQs(){
  const wrap = document.getElementById('profile-q-wrap');
  if (!wrap) return;
  wrap.innerHTML = PROFILE_QS.map((q, idx) => `
    <div class="pq-card">
      <div class="pq-card-top">
        <span class="pq-card-icon">${q.icon}</span>
        <span class="pq-card-num">${idx+1} / ${PROFILE_QS.length}</span>
      </div>
      <div class="pq-card-q">${q.q}</div>
      <div class="pq-opts" id="opts-${q.id}">
        ${q.opts.map(opt => `<div class="pq-opt" onclick="selectProfileOpt(this,'${q.id}')">${opt}</div>`).join('')}
        <div class="pq-opt pq-other" onclick="selectProfileOpt(this,'${q.id}',true)" style="grid-column:1/-1">️ אחר — הכנס בעצמך</div>
      </div>
      <input type="text" id="other-${q.id}" placeholder="כתוב כאן..." class="pq-other-inp" style="display:none" oninput="profileAnswers['${q.id}']=this.value.trim()">
    </div>
  `).join('');
}
function selectProfileOpt(el, qId, isOther) {
  el.closest('.pq-opts').querySelectorAll('.pq-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel');
  const otherInput = document.getElementById('other-' + qId);
  if (isOther) {
    otherInput.style.display = '';
    otherInput.focus();
    profileAnswers[qId] = otherInput.value.trim() || '';
  } else {
    otherInput.style.display = 'none';
    profileAnswers[qId] = el.textContent.trim();
  }
}
function finishOnboarding(){
  if (typeof collectAnchors === 'function') {
    const a = collectAnchors();
    if (Array.isArray(a) && a.length) S.anchors = (S.anchors || []).concat(a);
  }
  save();
  initApp();
  // Start feature tour for new users — delay to ensure DOM is ready
  setTimeout(function() {
    if (typeof sfStartTour === 'function') sfStartTour();
  }, 800);
}

function initApp(){
  document.getElementById('setup-screen').style.display='none';
  const bn = document.getElementById('bottom-nav'); if (bn) bn.style.display = '';
  document.getElementById('app-screen').style.display='block';
  const displayName = S.userName || 'סטודנט';
  const avatarInitial = displayName.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?';
  document.getElementById('sb-name').textContent = displayName;
  document.getElementById('sb-avatar').textContent = avatarInitial;
  const now=new Date(); const days=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']; const months=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  document.getElementById('today-greeting').textContent=_todayGreeting(displayName);
  document.getElementById('today-sub').textContent=`יום ${days[now.getDay()]}, ${now.getDate()} ב${months[now.getMonth()]} ${now.getFullYear()}`;

  // Auto-open sidebar on desktop (wide screens)
  if (window.innerWidth >= 769) {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('hamburger-btn').classList.add('open');
    // On desktop push content to the right of the sidebar
    document.querySelector('.main-content').style.marginRight = '265px';
  }

  // Initialize focus timer to match onboarding preference
  const profileBtn = Array.from(document.querySelectorAll('.pomo-dur-btn')).find(b => {
    const m = (b.getAttribute('onclick') || '').match(/\d+/);
    return m && parseInt(m[0]) === _profileDuration();
  });
  selectPomoDuration(_profileDuration(), profileBtn || null);

  checkPastDueTasks();
  renderAll();

  // Scroll-aware mobile header
  window.addEventListener('scroll', () => {
    const hdr = document.getElementById('mobile-header');
    if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 10);
  }, {passive: true});
}

function showPage(name,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  const pageEl = document.getElementById('page-'+name);
  if (!pageEl) { console.warn('showPage: page not found:', 'page-'+name); return; }
  pageEl.classList.add('active');
  pageEl.classList.add('page-fade');
  setTimeout(()=>pageEl.classList.remove('page-fade'), 200);
  if(btn)btn.classList.add('active');
  window.scrollTo({top:0,behavior:'instant'});
  if(name==='schedule'){
    isMonthViewOpen=false;
    const _wv=document.getElementById('schedule-weekly-view');
    const _mv=document.getElementById('schedule-monthly-view');
    if(_wv) _wv.style.display='block';
    if(_mv) _mv.style.display='none';
    renderSchedule();
  }
  // 'schedule' handled above (needs the weekly/monthly view-toggle reset). Every
  // other page renders through the SAME shared map that live-sync uses, so the two
  // can never drift again (this is what previously left timetable stale on sync).
  if (name !== 'schedule' && typeof PAGE_RENDERERS === 'object') {
    const r = PAGE_RENDERERS['page-' + name];
    if (typeof r === 'function') { try { r(); } catch (e) { console.warn('showPage render', name, e); } }
  }
  if(name !== 'schedule') {
    isMonthViewOpen = false;
    const _wv2=document.getElementById('schedule-weekly-view');
    const _mv2=document.getElementById('schedule-monthly-view');
    if(_wv2) _wv2.style.display='block';
    if(_mv2) _mv2.style.display='none';
    // Leaving the schedule page — stop the per-minute calendar "now line" refresh
    if (window._calTimeInterval) { clearInterval(window._calTimeInterval); window._calTimeInterval = null; }
  }
  updateBottomNav(name);
  closeSidebar();
}

function updateBottomNav(name) {
  const map = {today:'bn-today',planner:'bn-planner',schedule:'bn-schedule',exams:'bn-exams',progress:'bn-progress',hobby:'bn-hobby','weekly-review':'bn-weekly-review',homework:'bn-homework'};
  document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
  if(map[name]) document.getElementById(map[name])?.classList.add('active');
}


// Developer API key — proxy is the only working AI path after Gemini migration.
// Direct-call fallback is intentionally disabled (empty key → _callGroqDirect throws cleanly).
const _DEV_API_KEY = '';

async function _callGroqDirect({ messages, temperature, json, maxTokens }) {
  const key = S.apiKey || _DEV_API_KEY;
  if (!key || key.startsWith('gsk_placeholder')) throw new Error('נדרש מפתח Groq API — הכנס אותו בהגדרות ️');
  const body = { model: 'llama-3.3-70b-versatile', messages, temperature, max_tokens: maxTokens };
  if (json) body.response_format = { type: 'json_object' };
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  if (res.status === 401) throw new Error('Groq API Key לא תקין — בדוק בהגדרות ️');
  if (res.status === 429) throw new Error('חריגת מגבלת API — נסה שוב בעוד דקה');
  if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
  const d = await res.json();
  if (d.error) throw new Error(typeof d.error === 'string' ? d.error : (d.error.message || 'שגיאה ב-AI'));
  return d.choices[0].message.content;
}

async function _retryOn429(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const isRateLimit = e.message?.includes('חריגת');
      if (isRateLimit && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000)); // 2s, 4s
        continue;
      }
      throw e;
    }
  }
}

async function callAI({ messages, temperature = 0.7, json = false, maxTokens = 4096 }) {
  // Personal key set → skip proxy entirely (avoids 3-5s 404 wait on GitHub Pages)
  if (S.apiKey && !S.apiKey.startsWith('gsk_placeholder')) {
    return await _retryOn429(() => _callGroqDirect({ messages, temperature, json, maxTokens }));
  }
  return await _retryOn429(async () => {
    try {
      const res = await fetch('/api/groq-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, temperature, json, maxTokens })
      });
      if (res.status === 503) throw new Error('תכונות AI אינן זמינות בגרסה החינמית');
      if (res.status === 429) throw new Error('חריגת מגבלת AI — נסה שוב בעוד דקה');
      if (res.status === 401) throw new Error('מפתח API לא תקין — עדכן בהגדרות ️');
      if (res.status === 500) {
        const d = await res.json().catch(() => ({}));
        if (d.error && d.error.includes('GROQ_API_KEY')) throw new Error('GROQ_API_KEY לא מוגדר בשרת — הגדר אותו ב-Vercel Environment Variables');
      }
      if (res.ok) {
        const d = await res.json();
        if (d.error) throw new Error(typeof d.error === 'string' ? d.error : (d.error.message || 'שגיאה ב-AI'));
        return d.choices[0].message.content;
      }
      // 404 = proxy not deployed, fall through to direct
    } catch (e) {
      // Surface real proxy/availability errors instead of falling through to the
      // dead direct path (which misreports "enter a Groq key"). 503 = proxy down /
      // GEMINI_API_KEY unset; "אינן זמינות" is that 503 message.
      if (e.message && (e.message.includes('חריגת') || e.message.includes('GROQ_API_KEY') || e.message.includes('GEMINI_API_KEY') || e.message.includes('לא תקין') || e.message.includes('אינן זמינות'))) throw e;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('תכונות AI אינן זמינות — אין חיבור לאינטרנט');
    }
    return await _callGroqDirect({ messages, temperature, json, maxTokens });
  });
}

async function gemini(prompt) {
  return callAI({ messages: [{ role: 'user', content: prompt }] });
}
