
// --- XSS Escape ---
window.escapeHtml = function(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Calendar-day distance to a YYYY-MM-DD date (today=0, tomorrow=1).
// Single source of truth — banners/counters must agree on "בעוד X ימים".
function daysUntil(dateStr) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  // midnight-to-midnight; round() absorbs DST hour shifts
  return Math.round((new Date(dateStr + 'T00:00') - t0) / 86400000);
}

// ── LOCAL-ONLY MODE (StudyFlow Free) ─────────────────────────────────────────
// No Supabase in the free version — all data lives in localStorage.
const LS_KEY = 'sf_free_v1';

function animateCount(el, target) {
  if (!el) return;
  target = Number(target) || 0;
  // rAF never fires in hidden/background tabs — counters would freeze at 0
  if (document.visibilityState === 'hidden') { el.textContent = target; return; }
  var start = 0, duration = 600, startTime = null;
  function step(ts) {
    if (!startTime) startTime = ts;
    var p = Math.min((ts - startTime) / duration, 1);
    var ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function _todayGreeting(name) {
  var h = new Date().getHours();
  if (h < 12) return 'בוקר טוב, ' + name;
  if (h < 17) return 'צהריים טובים, ' + name;
  if (h < 21) return 'ערב טוב, ' + name;
  return 'לילה טוב, ' + name;
}
// Stub db so any residual db.* call silently does nothing.
const db = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    signInWithOAuth: async () => ({}),
    signUp: async () => ({}),
    signInWithPassword: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({}),
    signOut: async () => {},
    onAuthStateChange: () => {},
  },
  from: () => ({
    upsert: async () => {},
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: true }) }) }),
    delete: () => ({ eq: () => ({}) }),
  }),
};
let currentUser = null;
let _authMode = 'signin';

// ── AUTH UI HELPERS ──
function authSwitchTab(mode) {
  _authMode = mode;
  const isSignup = mode === 'signup';
  document.getElementById('tab-signin').classList.toggle('active', !isSignup);
  document.getElementById('tab-signup').classList.toggle('active', isSignup);
  document.getElementById('confirm-pass-wrap').style.display = isSignup ? 'block' : 'none';
  document.getElementById('forgot-btn').style.display = isSignup ? 'none' : '';
  document.getElementById('auth-pass').autocomplete = isSignup ? 'new-password' : 'current-password';
  document.getElementById('auth-submit-btn').textContent = isSignup ? 'יצירת חשבון' : 'כניסה';
  const msg = document.getElementById('auth-msg');
  msg.textContent = '';
  msg.className = '';
}

function authTogglePass(inputId, eyeId) {
  const inp = document.getElementById(inputId);
  const eye = document.getElementById(eyeId);
  const showing = inp.type === 'text';
  inp.type = showing ? 'password' : 'text';
  eye.innerHTML = showing
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
}

function authSetMsg(msg, isError) {
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.className = isError ? 'auth-error' : 'auth-success';
}

function authSetLoading(loading) {
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = loading;
  btn.textContent = loading ? '...' : (_authMode === 'signup' ? 'יצירת חשבון' : 'כניסה');
  btn.style.opacity = loading ? '0.7' : '1';
}

// ── AUTH ACTIONS ──
// DEAD SCAFFOLDING: app runs in local-only mode; db.auth.getSession() is a mocked
// stub that always returns null, so the cached-session recovery branch is unreachable.
// Never called on the boot path — kept only for the window export. Do not wire before boot.
async function checkAuth() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      currentUser = session.user;
      document.getElementById('auth-overlay').style.display = 'none';
      return true;
    }
    document.getElementById('auth-overlay').style.display = '';
    return false;
  } catch (e) {
    // Network failure — check for cached session in localStorage
    const cached = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (cached) {
      try {
        const tok = JSON.parse(localStorage.getItem(cached));
        if (tok?.user) {
          currentUser = tok.user;
          document.getElementById('auth-overlay').style.display = 'none';
          return true;
        }
      } catch (_) {}
    }
    document.getElementById('auth-overlay').style.display = '';
    authSetMsg('אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב.', true);
    return false;
  }
}

async function signInWithGoogle() {
  authSetMsg('מעביר לגוגל...', false);
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) authSetMsg('שגיאה: ' + error.message, true);
}

async function authSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  if (!email || !pass) { authSetMsg('נא למלא אימייל וסיסמה', true); return; }
  if (pass.length < 6) { authSetMsg('הסיסמה חייבת להכיל לפחות 6 תווים', true); return; }

  if (_authMode === 'signup') {
    const pass2 = document.getElementById('auth-pass2').value;
    if (pass !== pass2) { authSetMsg('הסיסמאות אינן תואמות', true); return; }
    authSetLoading(true);
    const { error } = await db.auth.signUp({ email, password: pass });
    authSetLoading(false);
    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        authSetMsg('כתובת זו כבר רשומה — עבור ל"כניסה"', true);
      } else {
        authSetMsg('שגיאה: ' + error.message, true);
      }
      return;
    }
    authSetMsg(' נשלח אימייל אימות לכתובת ' + email + ' — אשר ואז חזור לכאן להתחבר', false);
    return;
  }

  // Sign In
  authSetLoading(true);
  const { error } = await db.auth.signInWithPassword({ email, password: pass });
  authSetLoading(false);
  if (error) {
    if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
      authSetMsg('אימייל או סיסמה שגויים', true);
    } else if (error.message.includes('Email not confirmed')) {
      authSetMsg('יש לאשר את האימייל לפני הכניסה — בדוק את תיבת הדואר', true);
    } else {
      authSetMsg('שגיאה: ' + error.message, true);
    }
    return;
  }
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    document.getElementById('auth-overlay').style.display = 'none';
  }
}

async function authForgotPassword() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { authSetMsg('הכנס אימייל ולחץ "שכחתי סיסמה"', true); return; }
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
  if (error) { authSetMsg('שגיאה: ' + error.message, true); return; }
  authSetMsg(' נשלח מייל לאיפוס סיסמה ל-' + email, false);
}

async function signOut() {
  if (confirm('לצאת מהאפליקציה?')) location.reload();
}

// Auth state listener removed — local-only mode


let S={apiKey:'',userName:'',institution:'',wakeTime:'08:00',sleepTime:'22:00',anchors:[],profile:{},tasks:[],exams:[],courses:[],weekOffset:0,pendingPlan:[],points:0,streak:0,lastStudyDate:'',theme:'light',weeklyReview:{lastReviewDate:null,history:[]},hobbies:[],deletedCollisions:[],reminders:[],tier:'free',aiPlanner:{memo:'',prefs:{},history:[],memoUpdatedDate:null}};
function isPremium(){ return (S.tier||'free')==='premium'; }
let selectedOpt=null, missedTaskId=null;
let currentChatMode = 'general';
let recalcHistory = [];
let currentTutorTask = null;
let tutorHistory = [];
let isGridView = false;
let _wr = null;
let _wrForceRebuild = false;
let _wrPlanNextWeek = false;
let schedViewDay = null;
let _swipeController = null;
let selectedMonthDay = null;
let schedViewMode = 'timeline';
let pendingRecalcActions = null;
let psychHistory = [];
let _rcPendingTasks = [];
let _rcCapacityCtx = null;
let assistantHistory = [];
let hobbyHistory = [];
let _hobbyOnboarding = false;
let countdownInterval = null;
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();

// ── SINGLE SOURCE OF TRUTH: page id → renderer (shared by showPage + renderAll) ──
// Add a page here ONCE; both navigation AND live-sync repaint pick it up. This is
// what stops renderAll() and showPage() from drifting (which silently broke
// live-sync repaint on the timetable + schedule pages). Arrows call lazily, so
// referencing renderers defined in later sf-*.js files is fine.
const PAGE_RENDERERS = {
  'page-schedule':      () => renderSchedule(),
  'page-exams':         () => renderExams(),
  'page-anchors':       () => renderAnchorsList(),
  'page-progress':      () => renderProgress(),
  'page-hobby':         () => renderHobbyPage(),
  'page-planner':       () => renderPlannerPage(),
  'page-weekly-review': () => renderWeeklyReview(),
  'page-timetable':     () => renderTimetable(),
  'page-homework':      () => renderHomework(),
  // page-today has no dedicated renderer — its content is the always-on global
  // chrome (renderTodayTasks/renderHomework) that renderAll() paints every time.
};

// Visible overlays that DISPLAY live data (no in-progress user input) and so must
// re-paint on a sync. Each entry: [ isVisible(), render() ]. Form/editor modals are
// deliberately excluded — re-rendering them would clobber what the user is typing.
const SYNC_OVERLAYS = [
  // Monthly calendar is a modal inside page-schedule (gated by display, not a page).
  [() => { const el = document.getElementById('schedule-monthly-view'); return el && el.style.display !== 'none'; },
   () => renderMonthCalendar()],
  [() => !document.getElementById('time-chart-modal')?.classList.contains('hidden'),
   () => renderTimeChart()],
  [() => !document.getElementById('reminders-modal')?.classList.contains('hidden'),
   () => renderReminders()],
];

const PROFILE_QS=[
  {id:'focus_time', icon:'⏰', q:'באיזו שעה אתה הכי ממוקד?', opts:[' בוקר 06–10','️ צהריים 10–14',' אחה"צ 14–18',' ערב 18–23']},
  {id:'focus_span', icon:'<div class="hp-lvl-dot c1"></div>', q:'כמה זמן אתה מצליח להתרכז ברצף?', opts:[' עד 25 דקות',' 30–45 דקות',' 60–75 דקות',' 90+ דקות']},
  {id:'style',      icon:'<div class="hp-lvl-dot c1"></div>', q:'מה שיטת הלמידה שמתאימה לך?', opts:[' קריאה וסיכום',' פתרון תרגילים',' האזנה / וידאו',' הסבר לאחרים']},
  {id:'exam_fear',  icon:'<div class="hp-lvl-dot c1"></div>', q:'מה הכי מאתגר אותך לפני מבחן?', opts:['לא לסיים ללמוד',' לא להבין לעומק',' לשכוח בלחץ',' שאלות מפתיעות']},
];
let profileAnswers={};

// ── UTILS ──
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function ld(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
// YYYY-MM-DD anchored to Asia/Jerusalem regardless of machine timezone (for streak math)
function ldJ(d){ try { return (d||new Date()).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); } catch(e){ return ld(d||new Date()); } }
function fmtDate(s){ if(!s||typeof s!=='string'||!s.includes('-'))return s||''; const[,m,d]=s.split('-'); const months=['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ']; const day=parseInt(d); const mon=months[parseInt(m)-1]; return (isNaN(day)||!mon)?s:`${day} ${mon}`; }
function toast(msg){ const t=document.getElementById('toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); }

// Undo toast: a message with a "בטל" action that stays ~7s. Used so deletions
// (e.g. a mis-tapped course/anchor on the timetable) are always recoverable.
let _sfUndoTimer = null;
function sfShowUndoToast(message, undoFn) {
  const prev = document.getElementById('sf-undo-toast'); if (prev) prev.remove();
  if (_sfUndoTimer) { clearTimeout(_sfUndoTimer); _sfUndoTimer = null; }
  const el = document.createElement('div');
  el.id = 'sf-undo-toast'; el.className = 'sf-undo-toast';
  const span = document.createElement('span'); span.className = 'sf-undo-msg'; span.textContent = message;
  const btn = document.createElement('button'); btn.className = 'sf-undo-btn'; btn.type = 'button'; btn.textContent = 'בטל';
  const dismiss = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 280); if (_sfUndoTimer) { clearTimeout(_sfUndoTimer); _sfUndoTimer = null; } };
  btn.addEventListener('click', () => { try { undoFn(); } catch (e) {} dismiss(); });
  el.appendChild(span); el.appendChild(btn);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  _sfUndoTimer = setTimeout(dismiss, 7000);
}
window.sfShowUndoToast = sfShowUndoToast;
function closeModal(id){
  document.getElementById(id).classList.add('hidden');
  // Release body scroll lock if no modal/sidebar is still open
  const anyModal = document.querySelectorAll('.modal-overlay:not(.hidden)').length > 0;
  const sidebarOpen = document.getElementById('sidebar')?.classList.contains('open');
  if (!anyModal && !sidebarOpen) _setBodyLock(false);
}
function selOpt(el){ document.querySelectorAll('.modal-opt').forEach(o => o.classList.remove('sel')); el.classList.add('sel'); selectedOpt = el.textContent.trim(); }

// חולץ JSON חסין קריסות (Fixes JS execution stops)
function extractJSON(str) {
    try {
        const match = str.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return JSON.parse(str);
    } catch (e) {
        console.error("JSON Parse Error:", str);
        throw new Error("ה-AI החזיר נתונים לא תקינים.");
    }
}

const palette = ['#4f6ef7', '#16c98d', '#f5a623', '#f76060', '#8b5cf6', '#ff7043', '#00b8d4'];
const courseColorMap = {};
function getCourseColor(course) {
  if (!course) return 'var(--accent)';
  if (!courseColorMap[course]) courseColorMap[course] = palette[Object.keys(courseColorMap).length % palette.length];
  return courseColorMap[course];
}

// ── MULTI-FAITH HOLIDAYS ──
const HOLIDAY_COLORS = { jewish:'#2563eb', national:'#d97706', muslim:'#0891b2', christian:'#dc2626' };

// Each date maps to an array of { name, type }
const HOLIDAYS = {
  // National Israeli
  '2025-01-27':[{name:'יום הזיכרון הבינלאומי לשואה',type:'national'}],
  '2025-04-28':[{name:'יום הזיכרון לשואה ולגבורה',type:'national'}],
  '2025-05-12':[{name:'יום הזיכרון לחללי מערכות ישראל',type:'national'}],
  '2025-05-13':[{name:'יום העצמאות',type:'national'}],
  '2026-04-16':[{name:'יום הזיכרון לחללי מערכות ישראל',type:'national'}],
  '2026-04-17':[{name:'יום העצמאות',type:'national'}],
  // Jewish
  '2025-06-02':[{name:'ערב שבועות',type:'jewish'}],
  '2025-06-03':[{name:'שבועות',type:'jewish'}],
  '2025-08-12':[{name:'תשעה באב',type:'jewish'}],
  '2025-09-22':[{name:'ראש השנה',type:'jewish'}],
  '2025-09-23':[{name:"ראש השנה (ב׳)",type:'jewish'}],
  '2025-10-01':[{name:'יום כיפור',type:'jewish'}],
  '2025-10-06':[{name:'סוכות',type:'jewish'}],
  '2025-10-07':[{name:"סוכות (ב׳)",type:'jewish'}],
  '2025-10-13':[{name:'הושענא רבה',type:'jewish'}],
  '2025-10-14':[{name:'שמיני עצרת',type:'jewish'}],
  '2025-10-15':[{name:'שמחת תורה',type:'jewish'}],
  '2025-12-25':[{name:"חנוכה (א׳)",type:'jewish'},{name:'חג המולד',type:'christian'}],
  '2025-12-26':[{name:"חנוכה (ב׳)",type:'jewish'}],
  '2025-12-27':[{name:"חנוכה (ג׳)",type:'jewish'}],
  '2025-12-28':[{name:"חנוכה (ד׳)",type:'jewish'}],
  '2025-12-29':[{name:"חנוכה (ה׳)",type:'jewish'}],
  '2025-12-30':[{name:"חנוכה (ו׳)",type:'jewish'}],
  '2025-12-31':[{name:"חנוכה (ז׳)",type:'jewish'}],
  '2026-01-01':[{name:"חנוכה (ח׳)",type:'jewish'}],
  '2026-03-12':[{name:'פורים (תל אביב)',type:'jewish'}],
  '2026-03-13':[{name:'פורים',type:'jewish'}],
  '2026-04-01':[{name:'ערב פסח',type:'jewish'}],
  '2026-04-02':[{name:"פסח (א׳)",type:'jewish'}],
  '2026-04-03':[{name:"פסח (ב׳)",type:'jewish'},{name:'שישי הטוב',type:'christian'}],
  '2026-04-05':[{name:'פסחא (Easter)',type:'christian'}],
  '2026-04-08':[{name:"פסח (ז׳)",type:'jewish'}],
  '2026-04-09':[{name:"פסח (ח׳)",type:'jewish'}],
  "2026-04-29":[{name:"ל''ג בעומר",type:'jewish'}],
  '2026-05-21':[{name:'ערב שבועות',type:'jewish'}],
  '2026-05-22':[{name:"שבועות (א׳)",type:'jewish'}],
  '2026-05-23':[{name:"שבועות (ב׳)",type:'jewish'}],
  // Christian
  '2025-01-07':[{name:'חג המולד (אורתודוקסי)',type:'christian'}],
  '2025-04-18':[{name:'שישי הטוב',type:'christian'}],
  '2025-04-20':[{name:'פסחא (Easter)',type:'christian'}],
  '2026-01-07':[{name:'חג המולד (אורתודוקסי)',type:'christian'}],
  // Muslim
  '2025-03-01':[{name:'ראמדאן (תחילה)',type:'muslim'}],
  '2025-03-30':[{name:'עיד אל-פיטר',type:'muslim'}],
  '2025-03-31':[{name:"עיד אל-פיטר (ב׳)",type:'muslim'}],
  '2025-06-06':[{name:'עיד אל-אדחא',type:'muslim'}],
  '2025-06-07':[{name:"עיד אל-אדחא (ב׳)",type:'muslim'}],
  '2025-06-27':[{name:'ראס אל-סנה (שנה חדשה אסלאמית)',type:'muslim'}],
  '2025-09-04':[{name:'מולד אל-נביא',type:'muslim'}],
  '2026-02-18':[{name:'ראמדאן (תחילה)',type:'muslim'}],
  '2026-03-19':[{name:'עיד אל-פיטר',type:'muslim'}],
  '2026-03-20':[{name:"עיד אל-פיטר (ב׳)",type:'muslim'}],
  '2026-05-27':[{name:'עיד אל-אדחא',type:'muslim'}],
  '2026-05-28':[{name:"עיד אל-אדחא (ב׳)",type:'muslim'}],
  // Missing - Yom HaShoah 5786
  '2026-04-14':[{name:'יום הזיכרון לשואה ולגבורה',type:'national'}],
  // Islamic 2026
  '2026-06-16':[{name:'ראס אל-סנה (שנה חדשה אסלאמית)',type:'muslim'}],
  // Jewish 2026 - Tisha B'Av
  '2026-07-23':[{name:'תשעה באב',type:'jewish'}],
  // Islamic 2026
  '2026-08-25':[{name:'מולד אל-נביא',type:'muslim'}],
  // Jewish 2026 - High Holidays
  '2026-09-11':[{name:'ראש השנה',type:'jewish'}],
  '2026-09-12':[{name:"ראש השנה (ב׳)",type:'jewish'}],
  '2026-09-20':[{name:'יום כיפור',type:'jewish'}],
  '2026-09-25':[{name:'סוכות',type:'jewish'}],
  '2026-09-26':[{name:"סוכות (ב׳)",type:'jewish'}],
  '2026-10-01':[{name:'הושענא רבה',type:'jewish'}],
  '2026-10-02':[{name:'שמיני עצרת',type:'jewish'}],
  '2026-10-03':[{name:'שמחת תורה',type:'jewish'}],
  // Jewish 2026 - Hanukkah 5787
  '2026-12-14':[{name:"חנוכה (א׳)",type:'jewish'}],
  '2026-12-15':[{name:"חנוכה (ב׳)",type:'jewish'}],
  '2026-12-16':[{name:"חנוכה (ג׳)",type:'jewish'}],
  '2026-12-17':[{name:"חנוכה (ד׳)",type:'jewish'}],
  '2026-12-18':[{name:"חנוכה (ה׳)",type:'jewish'}],
  '2026-12-19':[{name:"חנוכה (ו׳)",type:'jewish'}],
  '2026-12-20':[{name:"חנוכה (ז׳)",type:'jewish'}],
  '2026-12-21':[{name:"חנוכה (ח׳)",type:'jewish'}],
  '2026-12-25':[{name:'חג המולדק',type:'christian'}],
  // Christian 2027
  '2027-01-07':[{name:'חג המולד (אורתודוקסי)',type:'christian'}],
  // Islamic 2027 - Ramadan
  '2027-02-08':[{name:'ראמדאן (תחילה)',type:'muslim'}],
  // Islamic 2027 - Eid Al-Fitr
  '2027-03-09':[{name:'עיד אל-פיטר',type:'muslim'}],
  '2027-03-10':[{name:"עיד אל-פיטר (ב׳)",type:'muslim'}],
  // Jewish 2027 - Purim 5787 (Hebrew leap year, Adar II)
  '2027-03-21':[{name:'פורים',type:'jewish'}],
  '2027-03-22':[{name:'שושן פורים',type:'jewish'}],
  // Christian 2027
  '2027-03-26':[{name:'שישי הטוב',type:'christian'}],
  '2027-03-28':[{name:'פסחא (Easter)',type:'christian'}],
  // Jewish 2027 - Pesach 5787
  '2027-04-18':[{name:'ערב פסח',type:'jewish'}],
  '2027-04-19':[{name:"פסח (א׳)",type:'jewish'}],
  '2027-04-20':[{name:"פסח (ב׳)",type:'jewish'}],
  '2027-04-25':[{name:"פסח (ז׳)",type:'jewish'}],
  '2027-04-26':[{name:"פסח (ח׳)",type:'jewish'}],
  // National 2027 (Yom HaShoah 5787 moved Thu — 27 Nisan falls Shabbat)
  '2027-04-29':[{name:'יום הזיכרון לשואה ולגבורה',type:'national'}],
  '2027-05-09':[{name:'יום הזיכרון לחללי מערכות ישראל',type:'national'}],
  '2027-05-10':[{name:'יום העצמאות',type:'national'}],
  // Islamic 2027 - Eid Al-Adha
  '2027-05-16':[{name:'עיד אל-אדחא',type:'muslim'}],
  '2027-05-17':[{name:"עיד אל-אדחא (ב׳)",type:'muslim'}],
  // Jewish 2027
  '2027-05-23':[{name:"ל''ג בעומר",type:'jewish'}],
  '2027-06-08':[{name:'ערב שבועות',type:'jewish'}],
  '2027-06-09':[{name:"שבועות (א׳)",type:'jewish'}],
  '2027-06-10':[{name:"שבועות (ב׳)",type:'jewish'}],
};

function getHoliday(dateStr){ const list=HOLIDAYS[dateStr]; return list&&list.length?list[0].name:null; }
function getHolidayList(dateStr){ return HOLIDAYS[dateStr]||[]; }

function openHolidayChat(date, holiday, tasks) {
  if (!date || !holiday) return;
  tasks = (tasks || []).filter(Boolean);
  openRecalc('holiday');
  const chat = document.getElementById('recalc-chat');
  const nextDay = new Date(date + 'T12:00:00'); nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = ld(nextDay);
  const taskSummary = tasks.map(t => `"${t.name || 'משימה'}" — ${formatPrettyDate(t.date)} ${t.time||''}`).join('<br>');
  const taskJSON = JSON.stringify(tasks.map(t => ({id:t.id||uid(),name:t.name||'משימה',date:t.date,time:t.time||'09:00'})));
  const msg = ` <b>שים לב:</b> התאריך <b>${fmtDate(date)}</b> הוא <b>${holiday}</b>.<br><br>משימות בתאריך זה:<br>${taskSummary}<br><br>מה לעשות?<br>א. השאר כמתוכנן — חג לא מפריע לי<br>ב. בטל משימות אלו<br>ג. דחה את כולן ליום שאחרי (${fmtDate(nextDayStr)})`;
  chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">${msg}</div></div>`;
  recalcHistory = [{role:'system',content:`אתה מנהל לו"ז. הסטודנט שיבץ ${tasks.length} משימות ב${holiday} (${date}).
משימות: ${taskJSON}. היום שאחרי: ${nextDayStr}.
חוקים: (1) הצג 3 אפשרויות. (2) דחייה → actions.update עם תאריכים חדשים. (3) ביטול → actions.delete. (4) פורמט: {"reply":"...","actions":{"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}],"delete":["ID"]}}`}];
}

// ── SUPABASE CLOUD SYNC ──
// Requires: CREATE TABLE user_data (user_id text primary key, data jsonb, updated_at timestamptz default now());
// + RLS policy: for all using (auth.uid()::text = user_id);

async function syncToCloud() { /* superseded by the magic-link sync below */ }
async function loadFromCloud() { return false; }

// ── CROSS-DEVICE SYNC (magic-link account → MongoDB on the VPS) ──────────────
const _SYNC_API = '/api/';
let _syncPushTimer = null;
function _syncSession() { return localStorage.getItem('sf_sync_session') || ''; }
function _syncEmail()   { return localStorage.getItem('sf_sync_email')   || ''; }
function isSynced()     { return !!_syncSession(); }

async function sfSyncSendLink(email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('כתובת אימייל לא תקינה'); return; }
  const btn = document.getElementById('sync-send-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'שולח...'; }
  try {
    const r = await fetch(_SYNC_API + 'auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (r.ok) toast('שלחנו קישור כניסה למייל ✉️ (בדקו גם בספאם)');
    else toast('שגיאה בשליחה — נסו שוב');
  } catch { toast('אין חיבור לאינטרנט'); }
  if (btn) { btn.disabled = false; btn.textContent = 'שלח קישור כניסה'; }
}

async function sfSyncVerify(token) {
  try {
    const r = await fetch(_SYNC_API + 'auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.session) { toast(j.error || 'הקישור פג תוקף — בקשו חדש'); return; }
    localStorage.setItem('sf_sync_session', j.session);
    localStorage.setItem('sf_sync_email', j.email || '');
    localStorage.setItem('sf_sync_updatedAt', String(j.updatedAt || 0));
    if (j.data && typeof j.data === 'object' && (j.data.userName || (j.data.tasks && j.data.tasks.length) || (j.data.courses && j.data.courses.length))) {
      // Cloud already has data → this device adopts it WITHOUT pushing back
      // (a re-push of just-pulled data could clobber a change another device
      // made in the meantime — that's exactly what lost a hobby once).
      Object.assign(S, j.data);
      if (typeof _normalizeCourses === 'function') _normalizeCourses();
      localStorage.setItem(LS_KEY, JSON.stringify(S));
      const setup = document.getElementById('setup-screen');
      if (S.userName && setup && setup.style.display !== 'none') { setup.style.display = 'none'; if (typeof initApp === 'function') initApp(); }
      else if (typeof renderAll === 'function') renderAll();
      toast('התחברת! הנתונים שלך סונכרנו ✓');
    } else {
      // New / empty account → seed it with this device's data.
      sfSyncPush(true);
      toast('התחברת! החשבון נוצר וסונכרן ✓');
    }
    sfSyncConnectStream();
    if (typeof _sfRenderSyncUI === 'function') _sfRenderSyncUI();
  } catch { toast('שגיאה בכניסה — נסו שוב'); }
}

function sfSyncPush(immediate) {
  const sess = _syncSession();
  if (!sess) return;
  clearTimeout(_syncPushTimer);
  const doPush = () => {
    fetch(_SYNC_API + 'sync/save', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sess }, body: JSON.stringify({ data: S }) })
      .then(async (r) => {
        if (r.status === 401) { localStorage.removeItem('sf_sync_session'); localStorage.removeItem('sf_sync_email'); sfSyncDisconnectStream(); if (typeof _sfRenderSyncUI === 'function') _sfRenderSyncUI(); return; }
        const j = await r.json().catch(() => ({}));
        if (j && j.updatedAt) localStorage.setItem('sf_sync_updatedAt', String(j.updatedAt));
      })
      .catch(() => {});
  };
  if (immediate) doPush(); else _syncPushTimer = setTimeout(doPush, 700);
}

// Reset stale module-level VIEW state before painting freshly-synced data, so a
// render can't run against a selection/cache that points at a now-deleted record.
// View-position state (schedViewDay / selectedMonthDay / calMonth / calYear) is
// intentionally left alone — the renderers self-heal it, and resetting would yank
// the user's view on every background sync.
function sfSyncInvalidateViewCache() {
  try { if (_ttSelectedId && !(S.anchors||[]).some(a => String(a.id) === String(_ttSelectedId))) _ttSelectedId = null; } catch (e) {}
  try { if (missedTaskId && !(S.tasks||[]).some(t => String(t.id) === String(missedTaskId))) missedTaskId = null; } catch (e) {}
  try { _wrForceRebuild = true; } catch (e) {}   // force Weekly Review to rebuild from fresh S.tasks
  // courseColorMap is `const` → mutate in place. Re-seed from live courses so a
  // course renamed/re-added on another device stays colour-consistent.
  try {
    Object.keys(courseColorMap).forEach(k => delete courseColorMap[k]);
    (S.tasks||[]).forEach(t => { if (t.course) getCourseColor(t.course); });
  } catch (e) {}
}

// Pull the latest from the cloud — adopts changes another device made (PC↔phone).
let _lastPullTs = 0;
async function sfSyncPull(force) {
  const sess = _syncSession();
  if (!sess) return;
  const now = Date.now();
  if (!force && now - _lastPullTs < 8000) return;   // throttle background pulls
  _lastPullTs = now;
  try {
    const r = await fetch(_SYNC_API + 'sync/load', { headers: { 'Authorization': 'Bearer ' + sess } });
    if (r.status === 401) { localStorage.removeItem('sf_sync_session'); localStorage.removeItem('sf_sync_email'); return; }
    const j = await r.json().catch(() => ({}));
    if (!j.ok || !j.data) return;
    const localTs = parseInt(localStorage.getItem('sf_sync_updatedAt') || '0', 10);
    if ((j.updatedAt || 0) > localTs) {   // cloud has newer changes from another device
      Object.assign(S, j.data);
      if (typeof _normalizeCourses === 'function') _normalizeCourses();
      localStorage.setItem(LS_KEY, JSON.stringify(S));   // direct write — don't trigger a re-push
      localStorage.setItem('sf_sync_updatedAt', String(j.updatedAt || 0));
      if (typeof sfSyncInvalidateViewCache === 'function') sfSyncInvalidateViewCache();
      const setup = document.getElementById('setup-screen');
      if (S.userName && setup && setup.style.display !== 'none') { setup.style.display = 'none'; if (typeof initApp === 'function') initApp(); }
      else if (typeof renderAll === 'function') renderAll();
    }
  } catch {}
}
// Refresh + reconnect the live stream whenever the app/tab becomes visible again.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isSynced()) { sfSyncPull(true); sfSyncConnectStream(); } });

// ── Live stream (SSE): the server pings us the instant another device saves ──
let _sse = null;
function sfSyncConnectStream() {
  if (!isSynced()) return;
  if (_sse && _sse.readyState !== 2) return;   // already open / connecting
  sfSyncDisconnectStream();
  try {
    _sse = new EventSource(_SYNC_API + 'sync/stream?session=' + encodeURIComponent(_syncSession()));
    _sse.onmessage = (e) => { try { const d = JSON.parse(e.data); if (d && d.type === 'changed') sfSyncPull(true); } catch {} };
    // A dropped stream (network blip, mobile sleep) otherwise leaves the device deaf
    // to server events. Reconnect after a short delay while still synced + visible.
    _sse.onerror = () => { sfSyncDisconnectStream(); setTimeout(() => { if (isSynced() && document.visibilityState === 'visible') sfSyncConnectStream(); }, 3000); };
  } catch {}
}
function sfSyncDisconnectStream() { if (_sse) { try { _sse.close(); } catch {} _sse = null; } }

function sfSyncLogout() {
  sfSyncDisconnectStream();
  localStorage.removeItem('sf_sync_session');
  localStorage.removeItem('sf_sync_email');
  localStorage.removeItem('sf_sync_updatedAt');
  toast('התנתקת מהסנכרון (הנתונים נשארים במכשיר)');
  if (typeof _sfRenderSyncUI === 'function') _sfRenderSyncUI();
}

function sfSyncHandleMagic() {
  try {
    const u = new URL(window.location.href);
    const tok = u.searchParams.get('magic');
    if (!tok) return;
    u.searchParams.delete('magic');
    window.history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
    sfSyncVerify(tok);
  } catch {}
}

function _sfRenderSyncUI() {
  const box = document.getElementById('sync-account-box');
  if (!box) return;
  if (isSynced()) {
    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
        '<div style="width:40px;height:40px;border-radius:12px;background:#ecfdf5;color:#10b981;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex:0 0 40px">✓</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:800;color:var(--text);font-size:0.92rem">מסונכרן בענן</div>' +
          '<div style="font-weight:600;color:var(--muted);font-size:0.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:right">' + escapeHtml(_syncEmail()) + '</div>' +
        '</div>' +
      '</div>' +
      '<button onclick="sfSyncLogout()" style="width:100%;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:0.6rem;font-weight:700;cursor:pointer;font-family:var(--sans)">התנתק</button>';
  } else {
    box.innerHTML =
      '<div style="font-weight:700;color:var(--muted);font-size:0.85rem;line-height:1.55;margin-bottom:10px">היכנסו עם המייל כדי לשמור גיבוי בענן ולפתוח את אותו החשבון בכל מכשיר. נשלח לכם קישור כניסה — בלי סיסמה.</div>' +
      '<input type="email" id="sync-email-input" placeholder="האימייל שלך" style="width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.8rem;font-family:var(--sans);font-size:0.9rem;background:var(--surface);color:var(--text);direction:ltr;text-align:right;margin-bottom:8px">' +
      '<button id="sync-send-btn" onclick="sfSyncSendLink(document.getElementById(\'sync-email-input\').value)" style="width:100%;background:var(--accent);color:#fff;border:none;border-radius:10px;padding:0.65rem;font-weight:800;cursor:pointer;font-family:var(--sans)">שלח קישור כניסה</button>';
  }
}

// ── DATA MAINTENANCE ──

function _validateStreak() {
  const yesterday = ldJ(new Date(Date.now() - 86400000));
  if (S.lastStudyDate && S.lastStudyDate < yesterday && S.streak > 0) {
    S.streak = 0;
    // Don't touch lastStudyDate — user hasn't studied today yet
    save();
  }
}

function _pruneOldData() {
  const today = ld(new Date());
  if (localStorage.getItem('sf_last_prune') === today) return;

  const d60 = ld(new Date(Date.now() - 60 * 86400000));
  const d30 = ld(new Date(Date.now() - 30 * 86400000));

  // Accumulate done count before pruning so badge thresholds survive
  const pruningDone = S.tasks.filter(t => t.done && t.date < d60).length;
  if (pruningDone > 0) S.doneTaskCount = (S.doneTaskCount || 0) + pruningDone;

  const before = S.tasks.length;
  S.tasks = S.tasks.filter(t => {
    if (!t.done && !t.missed) return true;    // future/pending: always keep
    if (t.done)   return t.date >= d60;        // done: keep 60 days
    if (t.missed) return t.date >= d30;        // missed: keep 30 days
    return true;
  });

  if (S.tasks.length < before) save();
  localStorage.setItem('sf_last_prune', today);
}

// Legacy migration: early versions stored S.courses as plain strings, but every
// consumer now expects objects ({id,name,examDate,hoursPerWeek}). Without this,
// such users see "undefined" course cards and can't delete them. Upgrade in place.
// Writes localStorage directly (no sync push) so it's safe to run after a cloud pull.
function _normalizeCourses() {
  let changed = false;
  if (Array.isArray(S.courses)) {
    S.courses = S.courses.map(c => {
      if (typeof c === 'string') {
        changed = true;
        const id = (typeof uid === 'function') ? uid() : 'c' + Math.random().toString(36).slice(2, 9);
        return { id, name: c, examDate: '', hoursPerWeek: 6 };
      }
      return c;
    });
  }
  // Clean the confusing legacy "תרגול מרצה" label on imported anchors → "תרגול"
  // (friends' feedback #6). Only touches the type suffix, never the course base.
  if (Array.isArray(S.anchors)) {
    S.anchors.forEach(a => {
      if (a && typeof a.name === 'string' && a.name.includes('תרגול מרצה')) {
        a.name = a.name.replace(/תרגול מרצה/g, 'תרגול');
        changed = true;
      }
    });
  }
  if (changed) { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }
  return changed;
}
