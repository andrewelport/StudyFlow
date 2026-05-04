// ── SUPABASE INIT ──
const SUPABASE_URL = 'https://cysywoaquuuteyxcxumz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5c3l3b2FxdXV1dGV5eGN4dW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzUyMjUsImV4cCI6MjA5MjQ1MTIyNX0.fnZbaYT2782XQpn6Bku5VkK-Xxmc9BwoA9e3bwjIibM';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
    authSetMsg('✅ נשלח אימייל אימות לכתובת ' + email + ' — אשר ואז חזור לכאן להתחבר', false);
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
  authSetMsg('✅ נשלח מייל לאיפוס סיסמה ל-' + email, false);
}

async function signOut() {
  await db.auth.signOut();
  location.reload();
}

db.auth.onAuthStateChange((event, session) => {
  if (session) {
    currentUser = session.user;
    document.getElementById('auth-overlay').style.display = 'none';
  } else {
    currentUser = null;
    document.getElementById('auth-overlay').style.display = '';
  }
});


let S={apiKey:'',userName:'',institution:'',wakeTime:'08:00',sleepTime:'22:00',anchors:[],profile:{},tasks:[],exams:[],courses:[],weekOffset:0,pendingPlan:[],points:0,streak:0,lastStudyDate:'',theme:'light',weeklyReview:{lastReviewDate:null,history:[]},hobbies:[]};
let selectedOpt=null, missedTaskId=null;
let currentChatMode = 'general';
let recalcHistory = [];
let currentTutorTask = null;
let tutorHistory = [];
let isGridView = false;
let _wr = null;
let _wrForceRebuild = false;
let schedViewDay = null;
let _swipeController = null;
let selectedMonthDay = null;
let schedViewMode = 'timeline';
let pendingRecalcActions = null;
let psychHistory = [];
let assistantHistory = [];
let _emergencyPlan = null;
let hobbyHistory = [];
let _hobbyOnboarding = false;
let countdownInterval = null;
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();

const PROFILE_QS=[
  {id:'focus_time', icon:'⏰', q:'באיזו שעה אתה הכי ממוקד?', opts:['🌅 בוקר 06–10','☀️ צהריים 10–14','🌤 אחה"צ 14–18','🌙 ערב 18–23']},
  {id:'focus_span', icon:'🧠', q:'כמה זמן אתה מצליח להתרכז ברצף?', opts:['⚡ עד 25 דקות','🎯 30–45 דקות','💪 60–75 דקות','🏆 90+ דקות']},
  {id:'style',      icon:'📖', q:'מה שיטת הלמידה שמתאימה לך?', opts:['📝 קריאה וסיכום','🔧 פתרון תרגילים','🎧 האזנה / וידאו','👥 הסבר לאחרים']},
  {id:'exam_fear',  icon:'💡', q:'מה הכי מאתגר אותך לפני מבחן?', opts:['⏰ לא לסיים ללמוד','🤔 לא להבין לעומק','😰 לשכוח בלחץ','❓ שאלות מפתיעות']},
];
let profileAnswers={};

// ── UTILS ──
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function ld(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtDate(s){ if(!s)return''; const[,m,d]=s.split('-'); const months=['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ']; return `${parseInt(d)} ${months[parseInt(m)-1]}`; }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); }
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }
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
  '2026-12-25':[{name:'חג המולד',type:'christian'}],
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
  const taskSummary = tasks.map(t => `"${t.name || 'משימה'}" — ${t.date} ${t.time||''}`).join('<br>');
  const taskJSON = JSON.stringify(tasks.map(t => ({id:t.id||uid(),name:t.name||'משימה',date:t.date,time:t.time||'09:00'})));
  const msg = `📅 <b>שים לב:</b> התאריך <b>${fmtDate(date)}</b> הוא <b>${holiday}</b>.<br><br>משימות בתאריך זה:<br>${taskSummary}<br><br>מה לעשות?<br>א. השאר כמתוכנן — חג לא מפריע לי<br>ב. בטל משימות אלו<br>ג. דחה את כולן ליום שאחרי (${fmtDate(nextDayStr)})`;
  chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">${msg}</div></div>`;
  recalcHistory = [{role:'system',content:`אתה מנהל לו"ז. הסטודנט שיבץ ${tasks.length} משימות ב${holiday} (${date}).
משימות: ${taskJSON}. היום שאחרי: ${nextDayStr}.
חוקים: (1) הצג 3 אפשרויות. (2) דחייה → actions.update עם תאריכים חדשים. (3) ביטול → actions.delete. (4) פורמט: {"reply":"...","actions":{"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}],"delete":["ID"]}}`}];
}

// ── SUPABASE CLOUD SYNC ──
// Requires: CREATE TABLE user_data (user_id text primary key, data jsonb, updated_at timestamptz default now());
// + RLS policy: for all using (auth.uid()::text = user_id);

async function syncToCloud() {
  if (!currentUser) return;
  try {
    await db.from('user_data').upsert(
      { user_id: currentUser.id, data: S, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch(e) { console.warn('Cloud sync failed:', e.message); }
}

async function loadFromCloud() {
  if (!currentUser) return false;
  try {
    const { data, error } = await db.from('user_data').select('data').eq('user_id', currentUser.id).single();
    if (error || !data?.data) return false;
    S = { ...S, ...data.data };
    return true;
  } catch(e) { return false; }
}

let _syncTimer = null;

// ── DATA MAINTENANCE ──

function _validateStreak() {
  const yesterday = ld(new Date(Date.now() - 86400000));
  if (S.lastStudyDate && S.lastStudyDate < yesterday && S.streak > 0) {
    S.streak = 0;
    // Don't touch lastStudyDate — user hasn't studied today yet
    save();
  }
}

function _pruneOldData() {
  const today = ld(new Date());
  if (localStorage.getItem('sf_last_prune') === today) return;
  localStorage.setItem('sf_last_prune', today);

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
}

// ── INIT & ONBOARDING ──
window.onload = async () => {
  const hasSession = await checkAuth();

  if (!currentUser) {
    // Not logged in — show auth screen, clear any stale local data
    return;
  }

  // Use user-specific key so each account has its own local cache
  const userKey = 'sf_v11_' + currentUser.id;

  const saved = localStorage.getItem(userKey);
  if (saved) { try { S = { ...S, ...JSON.parse(saved) }; } catch(e) {} }

  // Always try to load from cloud (cloud is the source of truth)
  const cloudLoaded = await loadFromCloud();
  if (cloudLoaded) {
    localStorage.setItem(userKey, JSON.stringify(S));
  }

  _validateStreak();
  _pruneOldData();

  document.body.setAttribute('data-theme', S.theme || 'light');
  if (S.userName) { initApp(); return; }
  // Show onboarding
  document.getElementById('setup-screen').style.display = '';
};

const save = () => {
  if (currentUser) {
    const userKey = 'sf_v11_' + currentUser.id;
    localStorage.setItem(userKey, JSON.stringify(S));
  }
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(syncToCloud, 2500);
};

function renderAll() {
  renderTodayTasks();
  if (document.getElementById('page-schedule')?.classList.contains('active')) renderSchedule();
  if (document.getElementById('page-exams')?.classList.contains('active')) renderExams();
  if (document.getElementById('page-anchors')?.classList.contains('active')) renderAnchorsList();
  if (document.getElementById('page-progress')?.classList.contains('active')) renderProgress();
  if (document.getElementById('page-calendar')?.classList.contains('active')) renderMonthCalendar();
  if (document.getElementById('page-hobby')?.classList.contains('active')) renderHobbyPage();
  if (document.getElementById('page-planner')?.classList.contains('active')) renderPlannerPage();
  if (document.getElementById('page-weekly-review')?.classList.contains('active')) renderWeeklyReview();
  if (!document.getElementById('time-chart-modal')?.classList.contains('hidden')) renderTimeChart();
  renderWRSidebarCard();
  updateHeaderStats();
}

function updateHeaderStats() {
  const today = ld(new Date());
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekExams = S.exams.filter(e => e.date >= ld(weekStart) && e.date <= ld(weekEnd)).length;
  if (document.getElementById('sc-exams')) document.getElementById('sc-exams').textContent = weekExams;
  renderTreeMini();
  renderNextTaskCountdown();
  // urgent exam banner
  const sorted = [...S.exams].sort((a,b)=>a.date.localeCompare(b.date));
  const urgent = sorted.find(e => { const dl = Math.ceil((new Date(e.date)-new Date())/86400000); return dl >= 0 && dl <= 7; });
  if (urgent) {
    const daysLeft = Math.max(0, Math.ceil((new Date(urgent.date)-new Date())/86400000));
    document.getElementById('urgent-exam-banner').classList.remove('hidden');
    document.getElementById('urgent-exam-text').textContent = `מבחן ב-${urgent.course} בעוד ${daysLeft} ימים!`;
    document.getElementById('urgent-exam-sub').textContent = `תאריך: ${urgent.date}`;
  } else {
    document.getElementById('urgent-exam-banner').classList.add('hidden');
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
    if (diff <= 0) { clearInterval(countdownInterval); countdownInterval = null; renderAll(); return; }
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
          <div class="ntw-task-name">${next.name}</div>
          <div class="ntw-course">${next.course || 'ללא קורס'}</div>
        </div>
        <div class="ntw-timer">
          <div class="ntw-digits${isUrgent?' urgent':''}">${timeStr}</div>
          <div class="ntw-timer-label">${isUrgent ? '⚡ עכשיו' : 'עד המשימה'}</div>
        </div>
      </div>`;
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

function toggleTheme() {
  S.theme = S.theme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', S.theme);
  const lbl = document.getElementById('theme-btn-label');
  if (lbl) lbl.textContent = S.theme === 'dark' ? '☀️ מצב יום' : '🌙 מצב לילה';
  save();
}

function confirmReset() {
  if (confirm('האם למחוק את כל הנתונים? לא ניתן לשחזר.')) {
    if (currentUser) {
      localStorage.removeItem('sf_v11_' + currentUser.id);
      db.from('user_data').delete().eq('user_id', currentUser.id).then(() => location.reload());
    } else {
      localStorage.removeItem('sf_v11_groq');
      location.reload();
    }
  }
}

// keep backward-compat alias
function resetSettings() { confirmReset(); }

// ── SIDEBAR TOGGLE ──
function _setBodyLock(locked) {
  if (locked) {
    const y = window.scrollY;
    document.body.dataset.scrollY = y;
    // Set top inline FIRST — before the class adds position:fixed — so iOS Safari
    // never paints a frame with position:fixed but top:0 (which causes the flash).
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

// ── SETTINGS MODAL ──
function toggleAccordion(id) {
  const clicked = document.getElementById(id);
  const isOpen = clicked.classList.contains('open');
  document.querySelectorAll('#settings-modal .acc-section').forEach(s => s.classList.remove('open'));
  if (!isOpen) clicked.classList.add('open');
}

function openSettings() {
  document.getElementById('settings-name').value = S.userName || '';
  document.getElementById('settings-inst').value = S.institution || '';
  const wakeEl = document.getElementById('settings-wake');
  const sleepEl = document.getElementById('settings-sleep');
  if (wakeEl) wakeEl.value = S.wakeTime || '08:00';
  if (sleepEl) sleepEl.value = S.sleepTime || '22:00';
  const keyEl = document.getElementById('settings-api-key');
  if (keyEl) keyEl.value = S.apiKey || '';
  const keyStatus = document.getElementById('api-key-status');
  if (keyStatus) {
    keyStatus.textContent = S.apiKey ? `✅ מפתח שמור: ${S.apiKey.slice(0,7)}...` : '⚠️ לא הוגדר — AI לא יעבוד';
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
      banner.textContent = '⚠️ נדרש מפתח API כדי שה-AI יפעל — הכנס למטה';
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
}

function saveSettings() {
  const name = document.getElementById('settings-name').value.trim();
  const inst = document.getElementById('settings-inst').value.trim();
  const wake = document.getElementById('settings-wake').value;
  const sleep = document.getElementById('settings-sleep').value;
  const apiKeyEl = document.getElementById('settings-api-key');
  // Strip ALL whitespace (spaces, newlines, tabs) — common paste issue
  const apiKey = apiKeyEl ? apiKeyEl.value.replace(/\s+/g, '') : '';
  if (name) S.userName = name;
  if (inst) S.institution = inst;
  S.wakeTime = wake;
  S.sleepTime = sleep;
  S.apiKey = apiKey;
  save();
  closeModal('settings-modal');
  const sbName = document.getElementById('sb-name');
  if (sbName) sbName.textContent = S.userName || '—';
  const sbAvatar = document.getElementById('sb-avatar');
  if (sbAvatar) sbAvatar.textContent = (S.userName || '?')[0].toUpperCase();
  toast(apiKey ? `✅ הגדרות נשמרו · API Key: ${apiKey.slice(0,7)}...` : '✅ הגדרות נשמרו');
}

function obNext(step){
  if(step===1){
    S.userName=document.getElementById('inp-name').value.trim();
    if(!S.userName){toast('נא למלא את שמך');return;}
    S.institution=document.getElementById('inp-inst').value.trim();
    S.wakeTime=document.getElementById('inp-wake').value;
    S.sleepTime=document.getElementById('inp-sleep').value;
    const inpKey = (document.getElementById('inp-apikey')?.value || '').replace(/\s+/g,'');
    if (inpKey && !inpKey.startsWith('gsk_placeholder')) S.apiKey = inpKey;
  }
  if(step===2){
    // Warn if any anchor row has no days selected (it will be silently skipped)
    const incompleteRows = Array.from(document.querySelectorAll('.anchor-builder-row')).filter(row => {
      const hasName = (row.querySelector('input[type="text"]')?.value || '').trim();
      const hasDays = row.querySelectorAll('.ob-day-btn.active').length > 0;
      return hasName && !hasDays;
    });
    if (incompleteRows.length) { toast('⚠️ בחר לפחות יום אחד לכל עוגן'); return; }
    S.anchors = collectAnchors();
    save(); // Save anchors immediately so they don't get lost
    renderProfileQs();
  }
  if(step===3){
    S.profile = { focus_time:'בוקר (6-10)', focus_span:'60-75 דקות', style:'לבד', exam_fear:'לא לסיים ללמוד', ...profileAnswers };
    document.getElementById('ob-summary').innerHTML=`שם: <b>${S.userName}</b><br>מוסד: ${S.institution||'לא צוין'}<br>עוגנים: ${S.anchors.length} | שעות למידה: ${S.wakeTime}–${S.sleepTime}`;
  }
  document.getElementById('ob-step-'+step).classList.remove('active');
  document.getElementById('ob-step-'+(step+1)).classList.add('active');
  document.querySelectorAll('.ob-dot').forEach((d,i)=>d.classList.toggle('done',i<step));
}
function addAnchorRow(){
  const rowId='anch-'+uid();
  const dayShort=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  const row=document.createElement('div'); row.className='anchor-builder-row'; row.id=rowId;
  row.innerHTML=`
    <div class="ab-header">
      <div style="display:flex;gap:0.45rem;align-items:center;flex:1">
        <input type="text" placeholder="שם הפעילות *" class="ab-name-inp" required />
        <input type="color" value="#4f6ef7" class="ab-color-inp" title="בחר צבע" />
      </div>
      <button class="ab-del-btn" onclick="document.getElementById('${rowId}').remove()" title="הסר">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="ab-section">
      <label class="ab-label">ימים בשבוע <span class="ab-required">*</span></label>
      <div class="ab-days">${[0,1,2,3,4,5,6].map(d=>`<button type="button" class="ob-day-btn" data-day="${d}" onclick="toggleObDay(this,'${rowId}')">${dayShort[d]}</button>`).join('')}</div>
    </div>
    <div class="ab-section">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
        <div>
          <label class="ab-label">שעת התחלה <span class="ab-required">*</span></label>
          <input type="time" value="09:00" class="ob-def-start ab-time-inp" onchange="updateObPerDayRows('${rowId}')" />
        </div>
        <div>
          <label class="ab-label">שעת סיום <span class="ab-required">*</span></label>
          <input type="time" value="16:00" class="ob-def-end ab-time-inp" onchange="updateObPerDayRows('${rowId}')" />
        </div>
      </div>
    </div>
    <div class="ab-travel-section">
      <div class="ab-travel-icon">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      </div>
      <div style="flex:1">
        <div class="ab-travel-label">זמן נסיעה <span class="ab-required">*</span> <span class="ab-travel-hint">(ה-AI חוסם זמן זה לפני ואחרי)</span></div>
        <div class="ab-travel-row">
          <input type="number" value="0" min="0" max="180" class="ob-travel-inp ab-travel-num" placeholder="0" />
          <span class="ab-travel-unit">דקות (0 אם ללא נסיעה)</span>
        </div>
      </div>
    </div>
    <div class="ab-section" style="margin-top:0.1rem">
      <label class="ab-label">בתוקף עד</label>
      <div style="display:flex;align-items:center;gap:0.6rem">
        <input type="date" class="ob-anchor-end ab-time-inp" style="flex:1;opacity:0.35" disabled />
        <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.78rem;font-weight:700;color:var(--text);white-space:nowrap;cursor:pointer">
          <input type="checkbox" class="ob-anchor-forever" checked onchange="const d=this.closest('.ab-section').querySelector('input[type=date]');d.disabled=this.checked;d.style.opacity=this.checked?'0.35':'1'" />
          תמיד
        </label>
      </div>
    </div>
    <div class="ob-per-day-wrap"></div>`;
  document.getElementById('anchor-builder').appendChild(row);
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
    lbl.style.cssText = 'font-size:0.7rem;color:var(--muted);font-weight:700;margin-bottom:0.35rem;margin-top:0.1rem';
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
      if (start >= end) return;
      const foreverCb = row.querySelector('.ob-anchor-forever');
      const endDate = (!foreverCb || foreverCb.checked) ? null : (row.querySelector('.ob-anchor-end')?.value || null);
      results.push({ id: uid(), name, day: d, start, end, travelMin, color, endDate });
    });
  });
  return results;
}
function renderProfileQs(){
  document.getElementById('profile-q-wrap').innerHTML = PROFILE_QS.map((q, idx) => `
    <div class="pq-card">
      <div class="pq-card-top">
        <span class="pq-card-icon">${q.icon}</span>
        <span class="pq-card-num">${idx+1} / ${PROFILE_QS.length}</span>
      </div>
      <div class="pq-card-q">${q.q}</div>
      <div class="pq-opts" id="opts-${q.id}">
        ${q.opts.map(opt => `<div class="pq-opt" onclick="selectProfileOpt(this,'${q.id}')">${opt}</div>`).join('')}
        <div class="pq-opt pq-other" onclick="selectProfileOpt(this,'${q.id}',true)" style="grid-column:1/-1">✏️ אחר — הכנס בעצמך</div>
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
function finishOnboarding(){ save(); initApp(); }

function initApp(){
  document.getElementById('setup-screen').style.display='none';
  document.getElementById('app-screen').style.display='block';
  // Avatar: use name initials, fallback to email initial, fallback to '?'
  const displayName = S.userName || '';
  const emailInitial = currentUser?.email ? currentUser.email[0].toUpperCase() : '?';
  const avatarInitial = displayName
    ? displayName.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
    : emailInitial;
  document.getElementById('sb-name').textContent = displayName || currentUser?.email || 'משתמש';
  document.getElementById('sb-avatar').textContent = avatarInitial;
  const now=new Date(); const days=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']; const months=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  document.getElementById('today-greeting').textContent=`שלום, ${displayName||emailInitial} 👋`;
  document.getElementById('today-sub').textContent=`יום ${days[now.getDay()]}, ${now.getDate()} ב${months[now.getMonth()]} ${now.getFullYear()}`;

  // Auto-open sidebar on desktop (wide screens)
  if (window.innerWidth >= 769) {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('hamburger-btn').classList.add('open');
    // On desktop push content to the right of the sidebar
    document.querySelector('.main-content').style.marginRight = '265px';
  }

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
  document.getElementById('page-'+name).classList.add('active');
  if(btn)btn.classList.add('active');
  window.scrollTo({top:0,behavior:'instant'});
  if(name==='schedule')renderSchedule();
  if(name==='exams')renderExams();
  if(name==='anchors')renderAnchorsList();
  if(name==='progress') renderProgress();
  if(name==='planner') renderPlannerPage();
  if(name==='calendar') renderMonthCalendar();
  if(name==='hobby') renderHobbyPage();
  if(name==='weekly-review') renderWeeklyReview();
  updateBottomNav(name);
  closeSidebar();
}

function updateBottomNav(name) {
  const map = {today:'bn-today',planner:'bn-planner',schedule:'bn-schedule',exams:'bn-exams',progress:'bn-progress',hobby:'bn-hobby','weekly-review':'bn-weekly-review'};
  document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
  if(map[name]) document.getElementById(map[name])?.classList.add('active');
}

// Developer API key — users don't need to enter their own key
const _DEV_API_KEY = 'gsk_placeholder_replace_with_your_groq_key';

async function _callGroqDirect({ messages, temperature, json, maxTokens }) {
  const key = S.apiKey || _DEV_API_KEY;
  if (!key || key.startsWith('gsk_placeholder')) throw new Error('נדרש מפתח Groq API — הכנס אותו בהגדרות ⚙️');
  const body = { model: 'llama-3.3-70b-versatile', messages, temperature, max_tokens: maxTokens };
  if (json) body.response_format = { type: 'json_object' };
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  if (res.status === 401) throw new Error('Groq API Key לא תקין — בדוק בהגדרות ⚙️');
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
      if (res.status === 429) throw new Error('חריגת מגבלת AI — נסה שוב בעוד דקה');
      if (res.status === 401) throw new Error('מפתח API לא תקין — עדכן בהגדרות ⚙️');
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
      if (e.message && (e.message.includes('חריגת') || e.message.includes('GROQ_API_KEY') || e.message.includes('לא תקין'))) throw e;
    }
    return await _callGroqDirect({ messages, temperature, json, maxTokens });
  });
}

async function gemini(prompt) {
  return callAI({ messages: [{ role: 'user', content: prompt }] });
}

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
          ${m.done ? '✓' : ''}
        </div>
      </div>`).join('');
  }

  // daily reward claim
  const rewardEl = el('quest-reward');
  window.claimDailyReward = function() {
    if (localStorage.getItem(rewardKey)) { toast('כבר קיבלת את פרס היום 😄'); return; }
    localStorage.setItem(rewardKey, '1');
    addPoints(100); renderProgress(); toast('🏆 כל הכבוד! +100 XP!');
  };
  if (rewardEl) {
    if (todayTasks.length > 0 && todayDone >= todayTasks.length && !alreadyClaimed)
      rewardEl.innerHTML = `<button style="font-size:0.75rem;font-weight:800;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:0.25rem 0.7rem;cursor:pointer;font-family:var(--sans)" onclick="claimDailyReward()">+100 XP פרס יומי!</button>`;
    else if (alreadyClaimed)
      rewardEl.textContent = '✓ פרס נאסף';
    else
      rewardEl.textContent = '';
  }

  // ── Achievements ──
  const bWrap = el('sq-badges-wrap');
  if (bWrap) {
    const earned = ACHIEVEMENTS.filter(a => a.check(S));
    if (el('sq-badge-count')) el('sq-badge-count').textContent = `${earned.length} / ${ACHIEVEMENTS.length}`;
    bWrap.innerHTML = ACHIEVEMENTS.map(a => {
      const isEarned = a.check(S);
      return `<div class="sq-badge${isEarned ? ' earned' : ''}">
        <span class="sq-badge-icon">${a.icon}</span>
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

function addPoints(n){ S.points = (S.points || 0) + n; updateStreak(); save(); renderTreeMini(); }
function updateStreak() {
  const today = ld(new Date());
  const yesterday = ld(new Date(Date.now() - 86400000));
  if (S.lastStudyDate === today) return;
  // Continue streak if studied yesterday, otherwise start fresh at 1
  S.streak = (S.lastStudyDate === yesterday) ? (S.streak || 0) + 1 : 1;
  S.lastStudyDate = today;
}
function renderTreeMini(){ if(document.getElementById('sc-streak')) document.getElementById('sc-streak').textContent = (S.streak || 0); }

// ── POMODORO ──
let pomoInterval=null, pomoSeconds=90*60, pomoRunning=false, pomoMode='work'; const POMO_WORK=90*60, POMO_BREAK=20*60;
function renderPomoTaskSelect() { const select = document.getElementById('pomo-task-select'); if(!select) return; const today = ld(new Date()); const pendingTasks = S.tasks.filter(t => t.date === today && !t.done && !t.missed); select.innerHTML = '<option value="">-- בחר משימה (רשות) --</option>' + pendingTasks.map(t => `<option value="${t.id}">${t.time} | ${t.name}</option>`).join(''); }
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
  const raw = sessionStorage.getItem('pomo-session');
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (!s.running) return;
    const elapsed = Math.floor((Date.now() - s.startWall) / 1000);
    const remaining = s.secondsAtSave - elapsed;
    if (remaining <= 0) {
      sessionStorage.removeItem('pomo-session');
      toast('⏰ פגישת הפוקוס הסתיימה בזמן שהמסך היה נעול');
      return;
    }
    pomoMode = s.mode;
    pomoSeconds = remaining;
    pomoRunning = false;
    const displayEl = document.getElementById('pomo-display');
    const m = String(Math.floor(remaining/60)).padStart(2,'0'), sec = String(remaining%60).padStart(2,'0');
    if (displayEl) displayEl.textContent = `${m}:${sec}`;
    // Restore task selection
    if (s.taskId) {
      const sel = document.getElementById('pomo-task-select');
      if (sel) sel.value = s.taskId;
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
  const taskName = pt ? pt.name : (pomoMode === 'break' ? '☕ הפסקה' : 'מפגש ריכוז');
  const totalSecs = pomoMode === 'work' ? POMO_WORK : POMO_BREAK;
  const elapsed = totalSecs - pomoSeconds;

  // Save session for screen-lock recovery
  _pomoSaveSession();

  // Open Focus Lock overlay
  focusLockOpen(taskName, totalSecs, elapsed, pomoMode === 'work' ? 'work' : 'break');
  FL.xpEarned = 0;

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

        if (pt) {
          const found = S.tasks.find(x => String(x.id) === String(taskId));
          if (found) { found.done = true; found.missed = false; save(); renderAll(); }
        }

        // Transition to break in Focus Lock
        pomoMode = 'break';
        pomoSeconds = POMO_BREAK;
        _pomoSaveSession();
        focusLockOpen('☕ הפסקה מגיעה לך!', POMO_BREAK, 0, 'break');
        toast('🍅 פוקוס הושלם! +20 נקודות 🎉 קח הפסקה');
        renderPomoTaskSelect();
      } else {
        pomoMode = 'work';
        pomoSeconds = POMO_WORK;
        focusLockClose();
        toast('⚡ ההפסקה נגמרה! חזרה לריכוז');
      }
      document.getElementById('pomo-start-btn').classList.remove('hidden');
      document.getElementById('pomo-pause-btn').classList.add('hidden');
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
  pomoSeconds=POMO_WORK;
  const displayEl = document.getElementById('pomo-display');
  if (displayEl) displayEl.textContent='90:00';
  const progEl = document.getElementById('pomo-prog');
  if (progEl) progEl.style.width='0%';
}

// ── THE SMART WAZE ALGORITHM (Dynamic Free Windows) ──
function getAvailableSlots(startDateStr, endDateStr, currentPriority){
  const dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  let available = ""; let totalMinutes = 0; let anchorDetails = "";
  const fmtM = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  let startD = startDateStr ? new Date(startDateStr) : new Date();
  let endD = new Date(endDateStr);
  let daysLeft = Math.ceil((endD - startD) / 86400000);
  let maxDays = Math.min(daysLeft, 14);
  const wake = parseInt((S.wakeTime||"08:00").split(':')[0])*60 + parseInt((S.wakeTime||"08:00").split(':')[1]);
  const sleep = parseInt((S.sleepTime||"22:00").split(':')[0])*60 + parseInt((S.sleepTime||"22:00").split(':')[1]);
  for(let i=0; i<=maxDays; i++){
    let d = new Date(startD); d.setDate(startD.getDate()+i);
    let dateStr = ld(d); let dayIdx = d.getDay();
    let dayAnchors = (S.anchors||[]).filter(a => parseInt(a.day)===dayIdx && !(a.endDate && dateStr>a.endDate));
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
  const dayAnchors = (S.anchors||[]).filter(a => parseInt(a.day)===dayIdx && !(a.endDate && dateStr>a.endDate));
  const tStart = parseInt(timeStr.split(':')[0])*60 + parseInt(timeStr.split(':')[1]);
  const tEnd = tStart + (durationMins||60);
  const wake = parseInt((S.wakeTime||"08:00").split(':')[0])*60 + parseInt((S.wakeTime||"08:00").split(':')[1]);
  const sleep = parseInt((S.sleepTime||"22:00").split(':')[0])*60 + parseInt((S.sleepTime||"22:00").split(':')[1]);
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
  if(!course || !date){ toast('נא למלא שם קורס ותאריך יעד'); return; }
  if(course.length > 80){ toast('⚠️ שם הקורס ארוך מדי'); return; }
  if(new Date(date) < new Date()) { toast('⚠️ תאריך המבחן כבר עבר!'); return; }
  if(new Date(startDate) > new Date(date)) { toast('תאריך התחלה לא יכול להיות אחרי המבחן'); return; }
  if(hoursRaw > 40) { toast('⚠️ הוגבל ל-40 שעות/שבוע — ערך סביר יותר'); }

  const slotsData = getAvailableSlots(startDate, date, priority);
  const availableHours = (slotsData.totalMinutes / 60);
  const totalDaysEst = Math.max(1, Math.ceil((new Date(date + 'T12:00:00') - new Date(startDate + 'T12:00:00')) / 86400000));
  const weeksEst = Math.max(1, Math.ceil(totalDaysEst / 7));
  const hours = Math.min(hoursPerWeek * weeksEst, 200);

  if (!slotsData.text || slotsData.text.trim() === 'אין זמנים פנויים') {
    toast('⚠️ אין זמן פנוי בכלל! פנה ליועץ לו"ז AI לפינוי מקום.');
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

  const btn = document.getElementById('gen-btn'); btn.disabled = true; btn.textContent = '🧠 מחשב מסלול חכם...';

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
  const blockedNote = blockedRanges.length ? `\n⛔ טווחים חסומים לקורסים אחרים (אל תשבץ בהם!): ${blockedRanges.join('; ')}` : '';

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
• סדר גיוון חובה (חזור על המחזור): קריאת חומר → תרגול → שאלות ממבחן ישן → חזרה מרווחת → סיכום
• שמות דוגמה: "קריאת חומר ב-${course}", "תרגול ${course}", "שאלות ממבחנים — ${course}", "חזרה מרווחת — ${course}", "סיכום נושאים — ${course}"
• עדיפות: "בינוני"

═══ שלב 2 — קראנץ' אינטנסיבי (${crunchStartStr} עד ${examMinus1}, ${crunchDays} ימים לפני המבחן) ═══
• צור בדיוק ${crunchTasks} משימות
• ניתן עד 3 ביום, שים לב: מחר אחרי ${examMinus1} זה המבחן — אל תחרוג!
• שמות בלבד: "שליפה אקטיבית — ${course}", "מבחן תרגול — ${course}", "חזרה אינטנסיבית — ${course}"
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

JSON בלבד: {"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"${course}","name":"...","duration":"X דק'","priority":"גבוה|בינוני"}]}`;
  
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
    S.pendingPlan = validTasks.map(t => ({...t, id:uid(), done:false, missed:false}));
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
  btn.disabled = false; btn.textContent = '✨ צור תוכנית מגוונת';
}

function renderPlanTable(tasks, wrapId){
  const wrap = document.getElementById(wrapId || 'plan-table-wrap');
  if(!tasks.length){ wrap.innerHTML='<div class="empty-state">אין זמנים פנויים</div>'; return; }
  const crunchKW = ['שליפה','אינטנסיב','מבחן תרגול','קראנץ'];
  const stats = { buildup: tasks.filter(t=>t.priority!=='גבוה').length, crunch: tasks.filter(t=>t.priority==='גבוה').length };
  const summaryHtml = `<div style="display:flex;gap:0.6rem;margin-bottom:1rem;flex-wrap:wrap">
    <div style="background:var(--accent-light);border:1px solid var(--border2);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--accent)">📚 בנייה: ${stats.buildup}</div>
    <div style="background:var(--red-light);border:1px solid rgba(247,96,96,0.25);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--red)">🔥 קראנץ׳: ${stats.crunch}</div>
    <div style="background:var(--green-light);border:1px solid rgba(22,201,141,0.25);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--green)">⏱️ ${(tasks.length*1.5).toFixed(0)} שעות סה״כ</div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--muted)">📅 ${tasks.length} משימות</div>
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
            ${t.course?`<span style="font-size:0.63rem;font-weight:800;padding:0.1rem 0.45rem;border-radius:99px;background:${cColor}22;color:${cColor}">${t.course}</span>`:''}
            <span style="font-size:0.63rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:6px;background:${isCrunch?'var(--red-light)':'var(--accent-light)'};color:${isCrunch?'var(--red)':'var(--accent)'}">${isCrunch?'🔥 קראנץ׳':'📚 בנייה'}</span>
            <span style="font-size:0.6rem;color:var(--muted);font-family:var(--mono)">${fmtDate(t.date)}</span>
          </div>
          <div style="font-size:0.87rem;font-weight:700;color:var(--text)">${t.name}</div>
        </div>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:1rem">
      <div style="font-size:0.72rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;padding-bottom:0.3rem;border-bottom:1px solid var(--border)">📅 שבוע ${wkLabel} · ${wTasks.length} משימות</div>
      ${cards}
    </div>`;
  }).join('');
  wrap.innerHTML = summaryHtml + weekHtml;
}
function addPlanToSchedule() {
  if (!S.pendingPlan.length) { toast('⚠️ אין תוכנית לאישור — צור תוכנית תחילה'); return; }
  // Calculate what will be replaced
  let replacedTasks = [];
  S.pendingPlan.forEach(newT => {
    S.tasks.filter(old => old.date === newT.date && old.time === newT.time && !old.done && old.course !== newT.course)
      .forEach(t => replacedTasks.push(t));
  });
  const otherCourseReplacements = replacedTasks.filter(t => t.course !== S.pendingPlan[0]?.course);
  const planCount = S.pendingPlan.length;
  S.pendingPlan.forEach(newT => {
    S.tasks = S.tasks.filter(old => !(old.date === newT.date && old.time === newT.time && !old.done));
    S.tasks.push(newT);
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
    if (confirm(`📅 ${holidayTasks.length} משימות נוספו לימי חג: ${hNames}.\nלפתוח יועץ לוח זמנים להזזה?`)) {
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
  toast(`🗑️ נמחקו ${futureTasks.length} משימות עתידיות מ"${course}"`);
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
    <input type="text" class="plsh-name" placeholder="שם הקורס *" />
    <input type="date" class="plsh-exam" />
    <input type="number" class="plsh-hrs" value="6" min="1" max="40" />
    <button onclick="document.getElementById('${id}').remove()" class="btn-sm red" title="הסר">✕</button>
  `;
  wrap.appendChild(div);
  div.querySelector('.plsh-name').focus();
}

function plShAddHobby() {
  const inp = document.getElementById('pl-sh-hobby-inp');
  const name = inp.value.trim();
  if (!name) return;
  if (!S.hobbies) S.hobbies = [];
  if (S.hobbies.find(h => h.name === name)) { toast('תחביב זה כבר קיים'); return; }
  S.hobbies.push({ id: uid(), name, timesPerWeek: 2, minPerSession: 60 });
  inp.value = '';
  _plShRenderHobbies();
}

function _plShRenderHobbies() {
  const wrap = document.getElementById('pl-sh-hobby-chips');
  if (!wrap) return;
  wrap.innerHTML = (S.hobbies || []).map(h =>
    `<span class="pl-sh-hobby-chip">${h.name}<span onclick="S.hobbies=S.hobbies.filter(x=>x.id!=='${h.id}');_plShRenderHobbies()" class="pl-sh-chip-x">×</span></span>`
  ).join('');
}

function plShSelectGoal(el) {
  document.querySelectorAll('.pl-sh-goal-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel');
  _plShGoal = el.dataset.val;
}

function plShBuildFirstWeek() {
  const rows = document.querySelectorAll('#pl-sh-course-rows .pl-sh-course-row');
  if (!rows.length) { toast('הוסף לפחות קורס אחד'); return; }
  const newCourses = [];
  let valid = true;
  rows.forEach(row => {
    const name = row.querySelector('.plsh-name')?.value.trim();
    const examDate = row.querySelector('.plsh-exam')?.value;
    const hours = parseInt(row.querySelector('.plsh-hrs')?.value) || 6;
    if (!name) { toast('הכנס שם לכל קורס'); valid = false; return; }
    if (!examDate) { toast(`הכנס תאריך מבחן לקורס "${name}"`); valid = false; return; }
    if (new Date(examDate) < new Date()) { toast(`תאריך מבחן של "${name}" כבר עבר`); valid = false; return; }
    newCourses.push({ id: uid(), name, examDate, hoursPerWeek: hours });
  });
  if (!valid) return;
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
  // Build _wr state for first-week generation — skip Q&A, use defaults
  _wr = {
    qs: [], qi: 0,
    answers: {
      courses: Object.fromEntries(coursesNames.map(n => [n, { u: 'ok', cov: 'little', mat: 'lots' }])),
      hobbies: {},
      load: 'ok',
      goal: _plShGoal,
      priority: null
    },
    coursesLastWeek: coursesNames,
    activeHobbies: S.hobbies || [],
    pendingPlan: null
  };
  // Navigate to weekly review page and generate
  showPage('weekly-review', null);
  updateBottomNav('weekly-review');
  document.getElementById('wr-msgs').innerHTML = '';
  document.getElementById('wr-choices').innerHTML = '';
  document.getElementById('wr-choices').classList.add('hidden');
  document.getElementById('wr-result').classList.add('hidden');
  _wrProg(0);
  _wrMsg(`🎉 מצוין ${S.userName}! בונה לוז לשבוע הראשון שלך...\nקורסים: ${coursesNames.join(', ')}`);
  setTimeout(() => _wrGenerate(), 800);
}

function openAddCourseModal() {
  const modal = document.getElementById('course-add-modal');
  if (!modal) return;
  document.getElementById('cam-name').value = '';
  document.getElementById('cam-exam-date').value = '';
  document.getElementById('cam-hours').value = '6';
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('cam-name').focus(), 100);
}

function addPlannerCourse() {
  const name = document.getElementById('cam-name').value.trim();
  const examDate = document.getElementById('cam-exam-date').value;
  const hours = parseInt(document.getElementById('cam-hours').value) || 6;
  if (!name) { toast('הכנס שם קורס'); return; }
  if (!examDate) { toast('הכנס תאריך מבחן'); return; }
  if (new Date(examDate) < new Date()) { toast('⚠️ תאריך מבחן לא יכול להיות בעבר'); return; }
  if (!S.courses) S.courses = [];
  if (S.courses.find(c => c.name === name)) { toast('קורס זה כבר קיים'); return; }
  S.courses.push({ id: uid(), name, examDate, hoursPerWeek: hours });
  if (!S.exams.find(e => e.course === name && e.date === examDate)) {
    S.exams.push({ id: uid(), course: name, date: examDate, type: 'מבחן', conf: 3, readyPct: 0, createdDate: ld(new Date()) });
  }
  save(); closeModal('course-add-modal'); renderPlannerPage();
  toast(`✅ ${name} נוסף!`);
}

function deletePlannerCourse(id) {
  const course = (S.courses || []).find(c => c.id === id);
  if (!course) return;
  if (!confirm(`למחוק את הקורס "${course.name}"? גם המשימות והמבחנים העתידיים ימחקו.`)) return;
  S.courses = S.courses.filter(c => c.id !== id);
  const today = ld(new Date());
  S.tasks = S.tasks.filter(t => !(t.course === course.name && !t.done && t.date >= today));
  S.exams = S.exams.filter(e => e.course !== course.name);
  save(); renderAll(); renderPlannerPage();
}

function renderCourseCards() {
  const wrap = document.getElementById('pl-course-cards-wrap');
  if (!wrap) return;
  const today = ld(new Date());
  const courses = S.courses || [];
  if (!courses.length) {
    wrap.innerHTML = `<div class="pl-empty-hint">עוד לא הוספת קורסים — לחץ "+ הוסף" להתחלה</div>`;
    return;
  }
  wrap.innerHTML = courses.map(c => {
    const examDate = c.examDate;
    const daysLeft = examDate ? Math.ceil((new Date(examDate) - new Date()) / 86400000) : null;
    const tasksDone = S.tasks.filter(t => t.course === c.name && t.done).length;
    const tasksPending = S.tasks.filter(t => t.course === c.name && !t.done && t.date >= today).length;
    const total = tasksDone + tasksPending;
    const pct = total > 0 ? Math.round((tasksDone / total) * 100) : 0;
    const urgency = daysLeft !== null && daysLeft <= 7 ? 'urgent' : daysLeft !== null && daysLeft <= 14 ? 'soon' : '';
    const color = getCourseColor(c.name);
    const daysLabel = daysLeft === null ? '' : daysLeft <= 0 ? 'היום!' : daysLeft === 1 ? 'מחר' : `בעוד ${daysLeft} ימים`;
    const urgEmoji = urgency === 'urgent' ? '🔴' : urgency === 'soon' ? '🟡' : '📅';
    return `<div class="pl-course-card ${urgency}">
      <div class="pl-cc-strip" style="background:${color}"></div>
      <div class="pl-cc-content">
        <div class="pl-cc-main-row">
          <div class="pl-cc-name">${c.name}</div>
          <button class="pl-cc-del" onclick="deletePlannerCourse('${c.id}')" title="מחק קורס">✕</button>
        </div>
        <div class="pl-cc-meta">
          ${daysLabel ? `<span class="pl-cc-exam-chip ${urgency}">${urgEmoji} ${daysLabel}</span>` : ''}
          <span class="pl-cc-hours">${c.hoursPerWeek} ש'/שבוע</span>
          ${tasksPending > 0 ? `<span class="pl-cc-pending">${tasksPending} ממתינות</span>` : total > 0 ? `<span class="pl-cc-hours">${pct}% הושלם</span>` : ''}
        </div>
        ${total > 0 ? `<div class="pl-cc-prog"><div class="pl-cc-prog-fill" style="width:${pct}%;background:${color}"></div></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderHobbyCardsInPlanner() {
  const wrap = document.getElementById('pl-hobby-cards-wrap');
  const emptyHint = document.getElementById('pl-hobbies-empty-hint');
  if (!wrap) return;
  const hobbies = S.hobbies || [];
  if (!hobbies.length) {
    wrap.innerHTML = '';
    emptyHint?.classList.remove('hidden');
    return;
  }
  emptyHint?.classList.add('hidden');
  const today = ld(new Date());
  wrap.innerHTML = hobbies.map((h, idx) => {
    const done = S.tasks.filter(t => t.course === h.name && t.done).length;
    const upcoming = S.tasks.filter(t => t.course === h.name && !t.done && !t.missed && t.date >= today).length;
    const color = getCourseColor(h.name);
    const safeName = h.name.replace(/'/g,"\\'");
    return `<div class="pl-hobby-card">
      <div class="pl-hc-strip" style="background:${color}"></div>
      <div class="pl-hc-content">
        <div class="pl-hc-main-row">
          <div class="pl-hc-name">${h.name}</div>
          <button class="pl-hc-coach-btn" onclick="_hobbyActiveIdx=${idx};showPage('hobby',null)">🤖 מאמן</button>
        </div>
        <div class="pl-hc-meta">
          <span class="pl-hc-freq">${h.timesPerWeek}×/שבוע</span>
          ${done > 0 ? `<span class="pl-hc-done">${done} בוצעו</span>` : ''}
          ${upcoming > 0 ? `<span class="pl-hc-freq">${upcoming} קרובות</span>` : ''}
          <button class="pl-hc-del" onclick="if(confirm('למחוק ${safeName}?')){_deleteHobbyTasks('${safeName}');S.hobbies=S.hobbies.filter(x=>x.id!=='${h.id}');save();renderAll()}" title="מחק תחביב">✕</button>
        </div>
        ${h.goal ? `<div class="pl-hc-goal-tag">${h.goal}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openAdvancedPlanForCourse(name, examDate, hoursPerWeek) {
  const details = document.querySelector('#page-planner details');
  if (details) details.open = true;
  const nameEl = document.getElementById('pl-course');
  const dateEl = document.getElementById('pl-date');
  const hoursEl = document.getElementById('pl-hours');
  if (nameEl) nameEl.value = name;
  if (dateEl) dateEl.value = examDate;
  if (hoursEl) hoursEl.value = hoursPerWeek;
  details?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── EMERGENCY EXAM MODE ──
function openEmergencyMode() {
  const modal = document.getElementById('emergency-modal');
  if (!modal) return;
  const upcoming = S.exams.filter(e => e.date >= ld(new Date())).sort((a,b)=>a.date.localeCompare(b.date));
  const sel = document.getElementById('em-exam-sel');
  const genBtn = document.getElementById('em-gen-btn');
  if (sel) {
    sel.innerHTML = upcoming.length
      ? upcoming.map(e=>`<option value="${e.id}">${e.course} — ${fmtDate(e.date)} (עוד ${Math.ceil((new Date(e.date)-new Date())/86400000)} ימים)</option>`).join('')
      : '<option value="">אין מבחנים מתוכננים — הוסף מבחן תחילה</option>';
  }
  if (genBtn) { genBtn.disabled = !upcoming.length; genBtn.style.opacity = upcoming.length ? '' : '0.5'; }
  document.getElementById('em-start').value = ld(new Date());
  document.getElementById('em-result-wrap')?.classList.add('hidden');
  modal.classList.remove('hidden');
}

async function generateEmergencySchedule() {
  const examId = document.getElementById('em-exam-sel').value;
  const clearOthers = document.getElementById('em-clear-others').checked;
  const exam = S.exams.find(e => e.id === examId);
  if (!exam) { toast('בחר מבחן תחילה'); return; }
  const startDate = document.getElementById('em-start').value || ld(new Date());
  const examDate = exam.date;
  const daysLeft = Math.ceil((new Date(examDate+' 12:00')-new Date())/86400000);
  if (daysLeft <= 0) { toast('⚠️ המבחן כבר עבר'); return; }
  const examMinus1 = ld(new Date(new Date(examDate+' 12:00').getTime()-86400000));

  if (clearOthers) {
    const removed = S.tasks.filter(t => !t.done && !t.missed && t.date >= startDate && t.date <= examDate && t.course !== exam.course).length;
    S.tasks = S.tasks.filter(t => t.done || t.missed || t.date < startDate || t.date > examDate || t.course === exam.course);
    if (removed) toast(`🗑️ פונו ${removed} משימות מקורסים אחרים`);
  }

  const slots = getAvailableSlots(startDate, examDate, 5);
  const btn = document.getElementById('em-gen-btn');
  btn.disabled = true; btn.textContent = '⚡ יוצר מצב חירום...';

  const prompt = `מצב חירום לפני מבחן! המשימה שלך: מלא כל חלון זמן פנוי עם לימוד אינטנסיבי לקורס זה.
קורס: "${exam.course}" | מבחן ב: ${examDate} | ימים נותרים: ${daysLeft}
טווח לתכנון: ${startDate} עד ${examMinus1}
זמנים פנויים: ${slots.text || 'אין זמנים פנויים'}

הנחיות מחמירות:
- השתמש בכל זמן פנוי ברשימה. כל משימה = 90 דקות.
- שמות משימות (גוון ביניהם): "שינון אקטיבי — ${exam.course}", "פתרון מבחנים ישנים — ${exam.course}", "חזרה מרווחת — ${exam.course}", "שליפה מהזיכרון — ${exam.course}", "סיכום נושאים — ${exam.course}"
- כל המשימות: priority: "גבוה"
- שעות חוקיות בלבד: "08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"
- תאריכים: ${startDate} עד ${examMinus1} בלבד (לא כולל יום המבחן ${examDate})

JSON בלבד: {"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"${exam.course}","name":"...","duration":"90 דק'","priority":"גבוה"}]}`;

  try {
    const raw = await callAI({ messages:[{role:'user',content:prompt}], temperature:0.2, json:true });
    const parsed = extractJSON(raw);
    const today = ld(new Date());
    const valid = (parsed.tasks||[]).filter(t => {
      if (!t.date || !t.time) return false;
      const validTimes = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
      return validTimes.includes(t.time) && t.date >= today && t.date < examDate;
    }).map(t => ({...t, id:uid(), done:false, missed:false, priority:'גבוה'}));

    if (!valid.length) { toast('ה-AI לא מצא זמנים פנויים לחירום — ייתכן שהלו"ז מלא'); btn.disabled=false; btn.textContent='⚡ צור לוז חירום'; return; }

    // Deduplicate by slot
    const seen = new Set();
    const deduped = valid.filter(t => { const k=`${t.date}|${t.time}`; if(seen.has(k)) return false; seen.add(k); return true; });

    document.getElementById('em-result-count').textContent = `${deduped.length} משימות`;
    document.getElementById('em-result-wrap').classList.remove('hidden');
    document.getElementById('em-preview-list').innerHTML = deduped.slice(0,5).map(t=>`<div style="font-size:0.78rem;color:var(--muted)">${t.date} ${t.time} · ${t.name}</div>`).join('') + (deduped.length>5?`<div style="font-size:0.73rem;color:var(--muted)">...ועוד ${deduped.length-5}</div>`:'');
    _emergencyPlan = deduped;
  } catch(e) {
    toast(`שגיאה: ${e.message}`);
  }
  btn.disabled=false; btn.textContent='⚡ צור לוז חירום';
}

function confirmEmergencySchedule() {
  const plan = _emergencyPlan;
  if (!plan?.length) { toast('אין תוכנית לאישור'); return; }
  plan.forEach(t => {
    S.tasks = S.tasks.filter(old => !(old.date===t.date && old.time===t.time && !old.done));
    S.tasks.push(t);
  });
  _emergencyPlan = null;
  save(); renderAll();
  document.getElementById('emergency-modal').classList.add('hidden');
  toast(`✅ ${plan.length} משימות חירום נוספו ללו"ז!`);
  showPage('schedule', document.querySelectorAll('.nav-item')[2]);
}

// ── TIME ALLOCATION CHART ──
function openTimeChart() {
  const modal = document.getElementById('time-chart-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderTimeChart();
}

function renderTimeChart() {
  const todayD = new Date();
  const today = ld(todayD);
  // Full current week: Sunday → Saturday
  const weekStartD = new Date(todayD);
  weekStartD.setDate(todayD.getDate() - todayD.getDay()); // back to Sunday
  const weekStart = ld(weekStartD);
  const weekEndD = new Date(todayD);
  weekEndD.setDate(todayD.getDate() + (6 - todayD.getDay())); // forward to Saturday
  const weekEnd = ld(weekEndD);

  // Weekly available hours (wake to sleep × 7 days) — always based on user settings
  const [wkH,wkM] = (S.wakeTime||'08:00').split(':').map(Number);
  const [slH,slM] = (S.sleepTime||'22:00').split(':').map(Number);
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
  S.tasks.filter(t => t.date >= weekStart && t.date <= weekEnd).forEach(t => {
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
    document.getElementById('tc-chart-wrap').innerHTML = '<div style="text-align:center;color:var(--muted);padding:2rem;font-size:0.85rem">אין נתונים לשבוע זה — הוסף עוגנים ומשימות</div>';
    document.getElementById('tc-total-label').textContent = `${weeklyAvailH.toFixed(0)} שע' זמינות השבוע`;
    return;
  }

  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const rows = items.map(it => {
    const pct = Math.min(100, Math.round((it.hours / weeklyAvailH) * 100));
    const display = `${it.hours.toFixed(1)} שע'`;
    const typeLabel = it.type === 'anchor' ? '⚓' : it.type === 'free' ? '🕓' : '📚';
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
  document.getElementById('tc-total-label').textContent = `${busyH.toFixed(1)} / ${weeklyAvailH.toFixed(0)} שע' השבוע (${Math.round(busyH/weeklyAvailH*100)}% תפוסה)`;
  document.getElementById('tc-chart-wrap').innerHTML = rows;
}

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
      <button onclick="removeSemesterCourse('${id}')" style="background:var(--red-light);color:var(--red);border:none;border-radius:8px;padding:0.35rem 0.6rem;cursor:pointer;font-family:var(--sans);font-weight:700;flex-shrink:0">✕</button>
    </div>
    <div class="sem-card-grid">
      <div><label class="field-label">תאריך מבחן *</label><input type="date" class="sem-exam-date" /></div>
      <div><label class="field-label">מתחיל ללמוד</label><input type="date" class="sem-start-date" /></div>
      <div><label class="field-label">שעות/שבוע</label><input type="number" class="sem-hours" value="8" min="1" max="40" /></div>
      <div>
        <label class="field-label">עדיפות: <span class="sem-pri-lbl">3⭐</span></label>
        <input type="range" class="sem-priority" min="1" max="5" value="3" oninput="this.closest('.semester-course-card').querySelector('.sem-pri-lbl').textContent=this.value+'⭐'; updateSemCapacity()" />
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
    toast('⚠️ אין זמן פנוי לאורך הסמסטר!'); return;
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
  btn.disabled = true; btn.textContent = '🧠 בונה תוכנית סמסטר...';

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
6. גיוון שמות: קריאת חומר / תרגול / שאלות ממבחן / חזרה מרווחת / סיכום / [קראנץ׳: שליפה אקטיבית / מבחן תרגול / חזרה אינטנסיבית]
7. priority: "בינוני" לשלב בנייה, "גבוה" לשלב קראנץ׳

JSON בלבד — עד 150 משימות:
{"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"שם הקורס","name":"שם מגוון","duration":"90 דק'","priority":"גבוה|בינוני"}]}`;

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
      const anchorConflict = (S.anchors||[]).some(a => {
        if (parseInt(a.day)!==taskDay) return false;
        const ast=parseInt((a.start||'00:00').split(':')[0])*60+parseInt((a.start||'00:00').split(':')[1])-(a.travelMin||0);
        const aen=parseInt((a.end||'00:00').split(':')[0])*60+parseInt((a.end||'00:00').split(':')[1])+(a.travelMin||0);
        return tst<aen&&(tst+90)>ast;
      });
      if (anchorConflict) return;
      slotMap[`${t.date}__${t.time}`] = {...t, id:uid(), done:false, missed:false};
    });

    const validTasks = Object.values(slotMap);
    if (!validTasks.length) throw new Error('לא נוצרו משימות תקינות — נסה שוב');

    S.pendingPlan = validTasks;
    renderSemesterPlanTable(validTasks, courses);
    document.getElementById('semester-result-box').classList.remove('hidden');
    document.getElementById('semester-result-sub').textContent = `${validTasks.length} משימות · ${courses.length} קורסים · ${Math.round(validTasks.length*1.5)} שעות`;
    document.getElementById('semester-result-box').scrollIntoView({behavior:'smooth',block:'start'});

    if (conflicts.length) {
      const conflictMsg = conflicts.map(c=>`"${c.course}": צריך ~${c.needed}ש׳ אבל יש ~${c.allocated}ש׳`).join('\n');
      setTimeout(() => {
        if (confirm(`⚠️ ייתכן שחסרות שעות לקורסים:\n${conflictMsg}\n\nלפתוח יועץ AI לדיון ואיזון מחדש?`)) {
          openRecalc('schedule');
          const chat = document.getElementById('recalc-chat');
          chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">שים לב — יש אי-התאמה בין דרישות הקורסים לשעות הפנויות:<br><b>${conflictMsg.replace(/\n/g,'<br>')}</b><br><br>מה לדלל? אפשר להפחית שעות בקורס מסוים, להוסיף זמן ללמידה בלו"ז, או לעדכן עדיפויות. מה עדיף לך?</div></div>`;
          chat.scrollTop = chat.scrollHeight;
        }
      }, 400);
    } else {
      toast(`✅ תוכנית סמסטר מלאה! ${validTasks.length} משימות נוצרו 🎓`);
    }
  } catch(e) {
    toast(`שגיאה: ${e.message}`); console.error(e);
  }
  btn.disabled = false; btn.textContent = '🚀 צור תוכנית סמסטר מלאה';
}

function renderSemesterPlanTable(tasks, courses) {
  const colorMap = {};
  (courses||[]).forEach(c => { colorMap[c.course] = c.color || getCourseColor(c.course); });
  // Override getCourseColor for known semester courses
  const origGet = window._semesterColorOverride = colorMap;

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
          <div style="font-size:0.84rem;font-weight:700;color:var(--text)">${t.name}</div>
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
    const displaced = S.tasks.filter(old => old.date===newT.date && old.time===newT.time && !old.done && old.course!==newT.course);
    replacedCount += displaced.length;
    S.tasks = S.tasks.filter(old => !(old.date===newT.date && old.time===newT.time && !old.done));
    S.tasks.push(newT);
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
  toast(`🎓 ${planCount} משימות נוספו ללו"ז${replacedCount?` (הוחלפו ${replacedCount} ישנות)`:''}`);
  if (holidayTasks.length) {
    const hNames = [...new Set(holidayTasks.map(t=>`${fmtDate(t.date)} (${getHoliday(t.date)})`))].join(', ');
    if (confirm(`📅 ${holidayTasks.length} משימות בימי חג: ${hNames}.\nלפתוח יועץ להזזה?`)) {
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
      if (t._exam) { html += `<div class="tl-slot" style="background:var(--purple-light);border-color:rgba(124,58,237,0.15)"><div class="tl-bar" style="background:var(--purple)"></div><div class="tl-time"><div class="tl-time-h" style="font-size:1rem"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path></svg></div></div><div class="tl-body"><div class="tl-meta"><span class="tl-course-tag" style="background:var(--purple-light);color:var(--purple)">מבחן</span></div><div class="tl-title" style="color:var(--purple);font-weight:900">${t.course}</div></div></div>`; return; }
      if (t._isAnchor) { const c = t.color||'#94a3b8'; const [th,tm] = (t.time||'00:00').split(':'); html += `<div class="tl-slot anchor-slot"><div class="tl-bar" style="background:${c}"></div><div class="tl-time"><div class="tl-time-h">${th}</div><div class="tl-time-m">${tm}</div></div><div class="tl-body"><div class="tl-meta"><span class="tl-course-tag" style="background:${c}25;color:${c}">עוגן</span></div><div class="tl-title">${t.name}</div></div></div>`; return; }
      const cColor = getCourseColor(t.course); const sc = t.done?'done':t.missed?'missed':'';
      const [th,tm] = (t.time||'00:00').split(':');
      const statusHtml = t.done?`<span class="tl-status" style="background:var(--green-light);color:var(--green)">הושלם</span>`:t.missed?`<span class="tl-status" style="background:var(--red-light);color:var(--red)">פוספס</span>`:`<span class="tl-status" style="background:var(--yellow-light);color:var(--yellow)">ממתין</span>`;
      const actionHtml = `<button class="tl-btn tl-btn-menu" onclick="openTaskActionSheet('${t.id}')" title="אפשרויות"><span class="tl-btn-menu-text">אפשרויות</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>`;
      html += `<div class="tl-slot ${sc}"><div class="tl-bar" style="background:${cColor}"></div><div class="tl-time"><div class="tl-time-h">${th}</div><div class="tl-time-m">${tm}</div></div><div class="tl-body"><div class="tl-meta">${t.course?`<span class="tl-course-tag" style="background:${cColor}20;color:${cColor}">${t.course}</span>`:''}<span class="tl-dur">${t.duration||''}</span>${statusHtml}</div><div class="tl-title${t.done?' tl-done':''}">${t.name}</div>${t.notes?`<div class="tl-notes">${t.notes}</div>`:''}</div><div class="tl-actions">${actionHtml}</div></div>`;
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

const TL_HOUR_PX = 64, TL_PX_MIN = 64 / 60, TL_START_H = 7, TL_END_H = 23;

function renderDayTimeline(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const months = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];
  const isToday = dateStr === ld(new Date());

  const events = [];
  (S.anchors||[]).filter(a => parseInt(a.day) === d.getDay()).forEach(a => {
    const [sh,sm] = a.start.split(':').map(Number); const [eh,em] = a.end.split(':').map(Number);
    events.push({ _type:'anchor', name:a.name, color:a.color||'#94a3b8', startMins:sh*60+sm, durMins:(eh*60+em)-(sh*60+sm), time:a.start, _end:a.end });
  });
  S.exams.filter(ex => ex.date === dateStr).forEach(ex => {
    events.push({ _type:'exam', name:ex.course, color:'var(--purple)', startMins:8*60, durMins:30, time:'08:00' });
  });
  S.tasks.filter(t => t.date === dateStr).forEach(t => {
    const [th,tm] = (t.time||'08:00').split(':').map(Number);
    const dur = parseInt((t.duration||'90').match(/\d+/)?.[0]||90);
    events.push({ _type:'task', id:t.id, name:t.name, course:t.course, priority:t.priority, color:getCourseColor(t.course), startMins:th*60+tm, durMins:dur, time:t.time, done:t.done, missed:t.missed, notes:t.notes });
  });
  events.sort((a,b) => a.startMins - b.startMins);

  const cols = [];
  events.forEach(ev => {
    const evEnd = ev.startMins + Math.max(ev.durMins, 30);
    let placed = false;
    for (let c = 0; c < cols.length; c++) { if (cols[c] <= ev.startMins) { ev._col = c; cols[c] = evEnd; placed = true; break; } }
    if (!placed) { ev._col = cols.length; cols.push(evEnd); }
  });
  const totalCols = cols.length || 1;
  events.forEach(ev => { ev._totalCols = totalCols; });

  const totalH = (TL_END_H - TL_START_H) * TL_HOUR_PX;
  const holList = getHolidayList(dateStr);
  const holBadge = holList.length ? `<span class="tl-day-exam-badge" style="background:transparent;color:${HOLIDAY_COLORS[holList[0].type]||'#888'}">${holList[0].name}</span>` : '';
  const examBadge = S.exams.filter(ex => ex.date === dateStr).map(ex => `<span class="tl-day-exam-badge">מבחן: ${ex.course}</span>`).join('');
  const taskCount = S.tasks.filter(t => t.date === dateStr).length;
  const countBadge = taskCount ? `<span class="tl-day-count-badge">${taskCount} משימות</span>` : '';

  const headerHtml = `<div class="tl-day-header"><div><div class="tl-day-title">יום ${dayNames[d.getDay()]}${isToday?` — <span style="color:var(--accent)">היום</span>`:''}</div><div class="tl-day-meta">${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}</div></div><div class="tl-day-badges">${countBadge}${examBadge}${holBadge}</div></div>`;

  let labelsHtml = '', gridHtml = '';
  for (let h = TL_START_H; h <= TL_END_H; h++) {
    const top = (h - TL_START_H) * TL_HOUR_PX;
    labelsHtml += `<div class="tl-hour-label" style="top:${top}px">${String(h).padStart(2,'0')}</div>`;
    gridHtml += `<div class="tl-grid-line" style="top:${top}px"></div>`;
    if (h < TL_END_H) gridHtml += `<div class="tl-grid-half" style="top:${top+TL_HOUR_PX/2}px"></div>`;
  }

  let nowHtml = '';
  if (isToday) {
    const nowD = new Date(); const nowMins = nowD.getHours()*60 + nowD.getMinutes();
    const nowTop = (nowMins - TL_START_H*60) * TL_PX_MIN;
    if (nowTop >= 0 && nowTop <= totalH) nowHtml = `<div class="tl-now-line" style="top:${nowTop}px"><div class="tl-now-dot"></div></div>`;
  }

  let eventsHtml = '';
  const GUTTER = 3;
  events.forEach((ev, idx) => {
    const top = Math.max(0, (ev.startMins - TL_START_H*60) * TL_PX_MIN);
    const height = Math.max(28, ev.durMins * TL_PX_MIN - 2);
    const colW = 100 / ev._totalCols;
    const rightPct = ev._col * colW;
    const bgStyle = ev.color.startsWith('var') ? `background:var(--purple-light)` : `background:${ev.color}18`;
    const animDelay = `animation-delay: ${idx * 0.08}s;`;

    if (ev._type === 'anchor') {
      eventsHtml += `<div class="tl-ev anchor-ev" style="top:${top}px;height:${height}px;right:${rightPct}%;width:calc(${colW}% - ${GUTTER}px);${bgStyle};border-color:${ev.color};${animDelay}"><div class="tl-ev-bar" style="background:${ev.color}"></div><div class="tl-ev-body"><div class="tl-ev-name" style="color:${ev.color}"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" style="margin-left:4px;vertical-align:middle"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>${ev.name}</div><div class="tl-ev-time">${ev.time} – ${ev._end}</div></div></div>`;
      return;
    }
    if (ev._type === 'exam') {
      eventsHtml += `<div class="tl-ev anchor-ev" style="top:${top}px;height:${height}px;right:${rightPct}%;width:calc(${colW}% - ${GUTTER}px);background:var(--purple-light);border-color:var(--purple);${animDelay}"><div class="tl-ev-bar" style="background:var(--purple)"></div><div class="tl-ev-body"><div class="tl-ev-name" style="color:var(--purple);font-weight:900"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" style="margin-left:4px;vertical-align:middle"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"></path></svg>${ev.name}</div><div class="tl-ev-course" style="color:var(--purple)">מבחן</div></div></div>`;
      return;
    }
    const statusClass = ev.done?'ev-done':ev.missed?'ev-missed':'';
    const checkIcon = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
    const priorityDot = (ev.priority === 'גבוה') ? `<span style="width:6px;height:6px;border-radius:50%;background:var(--red);display:inline-block;margin-left:3px;vertical-align:middle;flex-shrink:0"></span>` : '';
    const statusBadge = ev.done
      ? `<span style="font-size:0.58rem;font-weight:900;color:var(--green);background:var(--green-light);padding:0.06rem 0.35rem;border-radius:99px;display:inline-block">בוצע</span>`
      : ev.missed
        ? `<span style="font-size:0.58rem;font-weight:900;color:var(--red);background:var(--red-light);padding:0.06rem 0.35rem;border-radius:99px;display:inline-block">פוספס</span>`
        : '';
    const notesLine = ev.notes && height > 60
      ? `<div style="font-size:0.65rem;color:var(--muted);margin-top:0.15rem;overflow:hidden;max-height:2em;line-height:1.3;white-space:nowrap;text-overflow:ellipsis">${ev.notes}</div>`
      : '';
    const timeLine = height > 45
      ? `<div style="display:flex;align-items:center;gap:0.3rem;margin-top:0.15rem;flex-wrap:wrap">
          ${ev.course?`<span style="font-size:0.63rem;font-weight:800;color:${ev.color}">${ev.course}</span>`:''}
          <span style="font-size:0.6rem;color:var(--muted);font-family:var(--mono)">${ev.time}${ev.durMins?` · ${ev.durMins}ד'`:''}</span>
          ${statusBadge}
        </div>`
      : statusBadge;
    eventsHtml += `<div class="tl-ev ${statusClass}" style="top:${top}px;height:${height}px;right:${rightPct}%;width:calc(${colW}% - ${GUTTER}px);background:${ev.color}18;border-color:${ev.color};${animDelay}" onclick="openTaskQuickActions('${ev.id}')"><div class="tl-ev-bar" style="background:${ev.color}"></div><div class="tl-ev-body"><div class="tl-ev-name ${ev.done?'tl-ev-done-text':''}">${priorityDot}${ev.name}</div>${timeLine}${notesLine}</div>${!ev.done&&!ev.missed?`<button class="tl-ev-check" onclick="event.stopPropagation();quickMarkDone('${ev.id}')">${checkIcon}</button>`:''}</div>`;
  });

  const uid_tl = `tl-${dateStr}`;
  const content = document.getElementById('tl-day-content');
  content.innerHTML = headerHtml + `<div class="timeline-outer" id="${uid_tl}"><div class="timeline-labels" style="height:${totalH}px">${labelsHtml}</div><div class="timeline-events-area" style="height:${totalH}px">${gridHtml}${nowHtml}${eventsHtml}</div></div>`;

  const outerEl = document.getElementById(uid_tl);
  if (outerEl) {
    let scrollTarget = 0;
    if (isToday) { const nowD = new Date(); scrollTarget = Math.max(0, ((nowD.getHours()*60+nowD.getMinutes()) - TL_START_H*60) * TL_PX_MIN - 80); }
    else if (events.length) { scrollTarget = Math.max(0, (events[0].startMins - TL_START_H*60) * TL_PX_MIN - 40); }
    setTimeout(() => { outerEl.scrollTop = scrollTarget; }, 50);
  }
}

function quickMarkDone(taskId) {
  const t = S.tasks.find(x => String(x.id) === String(taskId));
  if (!t || t.done) return;
  t.done = true; t.missed = false; addPoints(10); save(); renderAll();
  toast('✅ משימה הושלמה!');
}

function openTaskQuickActions(taskId) {
  openTaskActionSheet(taskId);
}

function closeTaskActionSheetOld() {
  // kept for reference to not break line numbers
}

function _initDaySwipe() {
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
    try { addPoints(10); save(); renderAll(); } catch(e) { console.error('rating renderAll:', e); try { save(); } catch(_) {} }
    toast(savedRating ? `${savedRating}/5 כוכבים — תודה!` : 'משימה הושלמה!');
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
function missTask(id){ missedTaskId=id; const t=S.tasks.find(t=>String(t.id)===String(id)); document.getElementById('missed-task-name').textContent=`משימה: "${t?.name||''}"`; document.getElementById('missed-modal').classList.remove('hidden'); }
function confirmMissed(){ if(!missedTaskId)return; const t=S.tasks.find(t=>String(t.id)===String(missedTaskId)); if(t){t.missed=true;t.done=false;t.missedReason=selectedOpt||'לא צוין';} save(); closeModal('missed-modal'); renderAll(); }

function _checkWeeklyReviewBanner() {
  const banner = document.getElementById('wr-banner');
  if (!banner) return;
  const hasCourses = (S.courses || []).length > 0;
  if (hasCourses && _needsWeeklyReview()) {
    const msg = document.getElementById('wr-banner-msg');
    if (msg) msg.textContent = _isFirstWeek() ? '🎉 בנה את הלוז הראשון שלך!' : (new Date().getDay() === 6 ? 'שבת שלום! זמן לסכם את השבוע' : 'זמן לתכנן את השבוע — 3 דקות');
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function renderTodayTasks(){
  _checkWeeklyReviewBanner();
  const today = ld(new Date()); const dayIdx = new Date().getDay();
  let tt = S.tasks.filter(t => t.date === today);
  document.getElementById('sc-tasks').textContent = tt.length;
  document.getElementById('sc-done').textContent = tt.filter(t=>t.done).length;
  document.getElementById('sc-missed').textContent = tt.filter(t=>t.missed).length;
  renderNextTaskCountdown();
  let items = tt.map(t=>({...t, _isTask:true}));
  const dayAnchors = (S.anchors||[]).filter(a=>parseInt(a.day)===dayIdx);
  dayAnchors.forEach(a=>{ items.push({_isAnchor:true, id:a.id, time:a.start, _end:a.end, name:a.name, color:a.color||'#94a3b8', travelMin:a.travelMin||0}); });
  items.sort((a,b)=>(a.time||'00:00').localeCompare(b.time||'00:00'));
  const wrap = document.getElementById('today-tasks-wrap');
  if(!items.length){ wrap.innerHTML = '<div class="empty-state">היום פנוי לגמרי! הוסף משימות מהמתכנן.</div>'; renderPomoTaskSelect(); return; }

  const priColor={גבוה:'var(--red)',בינוני:'var(--yellow)',שוטף:'var(--green)'};
  const priBg={גבוה:'var(--red-light)',בינוני:'var(--yellow-light)',שוטף:'var(--green-light)'};
  const priIcon={גבוה:'🔴',בינוני:'🟡',שוטף:'🟢'};

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
      <div class="tl-body">
        <div class="tl-meta">
          ${t.course?`<span class="tl-course-tag" style="background:${cColor}22;color:${cColor}">${t.course}</span>`:''}
          ${t.priority?`<span class="tl-pri" style="background:${priBg[t.priority]||'var(--yellow-light)'};color:${priColor[t.priority]||'var(--yellow)'}">${t.priority}</span>`:''}
          <span class="tl-dur">${t.duration||''}</span>
          ${statusHtml}
        </div>
        <div class="tl-title">${t.name}</div>
        ${t.notes?`<div class="tl-notes">📝 ${t.notes}</div>`:''}
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
  const today = ld(new Date());
  const flagKey = 'burnout-alerted-' + today;
  if (sessionStorage.getItem(flagKey)) return;
  const threeDaysAgo = ld(new Date(Date.now() - 3 * 86400000));
  const recentMissed = S.tasks.filter(t => t.missed && t.date >= threeDaysAgo && t.date < today).length;
  if (recentMissed >= 3) {
    sessionStorage.setItem(flagKey, '1');
    setTimeout(() => {
      toast('שמתי לב לכמה משימות שפוספסו — איך אתה מרגיש? 🧠');
      openPsychologist();
    }, 1200);
  }
}

function renderAnchorsList(){
  const wrap = document.getElementById('anchors-list-wrap');
  if(!Array.isArray(S.anchors) || !S.anchors.length){ wrap.innerHTML = '<div class="empty-state">אין עוגנים מוגדרים</div>'; return; }
  const dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  wrap.innerHTML = S.anchors.map(a => {
    const travelNote = a.travelMin > 0 ? ` · נסיעה ${a.travelMin} דק'` : '';
    const recNote = a.endDate ? ` · עד ${fmtDate(a.endDate)}` : ' · קבוע';
    return `<div class="anchor-card">
      <div class="anchor-card-strip" style="background:${a.color||'#4f6ef7'}"></div>
      <div class="anchor-card-body">
        <div class="anchor-name-d">${a.name}</div>
        <div class="anchor-time-d">יום ${dn[a.day||0]} · ${a.start||'00:00'} – ${a.end||'00:00'}${travelNote}${recNote}</div>
      </div>
      <div class="anchor-card-actions">
        <button class="btn-sm" onclick="editAnchor('${a.id}')" title="ערוך"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
        <button class="btn-sm red" onclick="removeAnchor('${a.id}')" title="מחק"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      </div>
    </div>`;
  }).join('');
}

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
    const daysLeft = Math.max(0, Math.ceil((new Date(ex.date) - new Date()) / 86400000));
    rows += `<div class="mc2-detail-row" style="border-right-color:var(--purple);background:var(--purple-light)">
      <div class="mc2-detail-time-col"><span style="font-family:var(--mono);font-size:0.7rem;color:var(--purple);font-weight:900">מבחן</span></div>
      <div class="mc2-detail-content">
        <div class="mc2-detail-name" style="color:var(--purple);font-weight:900">${ex.course}</div>
        ${daysLeft === 0 ? `<div class="mc2-detail-sub" style="color:var(--purple)">היום!</div>` : daysLeft <= 3 ? `<div class="mc2-detail-sub" style="color:var(--red)">בעוד ${daysLeft} ימים</div>` : ''}
      </div>
    </div>`;
  });

  anchors.forEach(a => {
    const c = a.color || '#94a3b8';
    const durMins = (() => { try { const [sh,sm]=(a.start||'0:0').split(':').map(Number); const [eh,em]=(a.end||'0:0').split(':').map(Number); return (eh*60+em)-(sh*60+sm); } catch(e){return 0;}})();
    const durStr = durMins > 0 ? ` · ${durMins >= 60 ? Math.floor(durMins/60)+'ש'+' '+(durMins%60?durMins%60+'ד':'') : durMins+'ד'}` : '';
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

function showAddAnchorModal(){
  document.getElementById('anchor-modal').dataset.editId = '';
  document.getElementById('anchor-modal-title').textContent = '⚓ הוסף עוגן קבוע';
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
  const dr = document.getElementById('anc-day-rows');
  if (dr) dr.innerHTML = '';
  document.querySelectorAll('#anc-days-selector input[type="checkbox"]').forEach(cb => cb.checked = false);
  // Reset the "forever" checkbox to checked and disable end-date
  const foreverCb = document.getElementById('anc-forever');
  if (foreverCb) foreverCb.checked = true;
  const endDateEl = document.getElementById('anc-end-date');
  if (endDateEl) { endDateEl.value = ''; endDateEl.disabled = true; endDateEl.style.opacity = '0.35'; }
  document.getElementById('anchor-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('anc-name').focus(), 100);
}

function editAnchor(id) {
  const a = (S.anchors||[]).find(x => String(x.id) === String(id));
  if (!a) return;
  document.getElementById('anchor-modal').dataset.editId = id;
  document.getElementById('anchor-modal-title').textContent = '✏️ עריכת עוגן';
  document.getElementById('anc-name').value = a.name || '';
  document.getElementById('anc-color').value = a.color || '#4f6ef7';
  document.getElementById('anc-travel').value = a.travelMin || 0;
  document.getElementById('anc-day').value = String(a.day || 0);
  document.getElementById('anc-start').value = a.start || '09:00';
  document.getElementById('anc-end').value = a.end || '16:00';
  // Hide recurring section in edit mode (editing individual anchors only)
  document.getElementById('anc-recurring').checked = false;
  document.getElementById('anc-recurring-wrap').classList.add('hidden');
  document.getElementById('anc-single-day-wrap').classList.remove('hidden');
  document.getElementById('anc-days-selector').classList.add('hidden');
  document.getElementById('anc-per-day-times').classList.add('hidden');
  const dr = document.getElementById('anc-day-rows');
  if (dr) dr.innerHTML = '';
  document.getElementById('anchor-modal').classList.remove('hidden');
}

// ── MISSING FUNCTIONS (previously undefined) ──
function openManualTaskModal(id) {
  const modal = document.getElementById('task-edit-modal');
  document.getElementById('task-modal-title').textContent = id ? 'עריכת משימה' : 'הוספת משימה ידנית';
  const t = id ? S.tasks.find(x => String(x.id) === String(id)) : null;
  document.getElementById('edit-t-name').value = t?.name || '';
  document.getElementById('edit-t-course').value = t?.course || '';
  document.getElementById('edit-t-date').value = t?.date || ld(new Date());
  document.getElementById('edit-t-time').value = t?.time || '09:00';
  document.getElementById('edit-t-dur').value = t?.duration ? parseInt(t.duration) : 90;
  document.getElementById('edit-t-notes').value = t?.notes || '';
  modal.dataset.editId = id || '';
  modal.classList.remove('hidden');
}

function saveManualTask() {
  const id = document.getElementById('task-edit-modal').dataset.editId;
  const name = document.getElementById('edit-t-name').value.trim();
  const course = document.getElementById('edit-t-course').value.trim();
  const date = document.getElementById('edit-t-date').value;
  const time = document.getElementById('edit-t-time').value;
  const durRaw = parseInt(document.getElementById('edit-t-dur').value) || 90;
  const dur = Math.max(5, Math.min(480, isNaN(durRaw) ? 90 : durRaw));
  const notes = document.getElementById('edit-t-notes').value.trim();
  if (!name || !date || !time) { toast('נא למלא שם, תאריך ושעה'); return; }
  // Validate date is not in the past (allow today)
  if (date < ld(new Date())) { toast('⚠️ לא ניתן לתזמן משימה בעבר'); return; }
  // Holiday check
  const holiday = getHoliday(date);
  if (holiday && !confirm(`⚠️ ${fmtDate(date)} הוא ${holiday}.\nלתזמן משימה בחג?`)) {
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
    const ast = parseInt((a.start||'00:00').split(':')[0])*60 + parseInt((a.start||'00:00').split(':')[1]) - (a.travelMin||0);
    const aen = parseInt((a.end||'00:00').split(':')[0])*60 + parseInt((a.end||'00:00').split(':')[1]) + (a.travelMin||0);
    return taskMins < aen && (taskMins + dur) > ast;
  });
  if (collidingAnchor && !confirm(`⚠️ שעה זו מתנגשת עם עוגן "${collidingAnchor.name}" (${collidingAnchor.start}–${collidingAnchor.end}).\n\nלהמשיך בכל זאת?`)) return;
  if (id) {
    const t = S.tasks.find(x => String(x.id) === String(id));
    if (t) Object.assign(t, { name, course, date, time, duration: `${dur} דק'`, notes });
  } else {
    S.tasks.push({ id: uid(), name, course, date, time, duration: `${dur} דק'`, priority: 'בינוני', done: false, missed: false, notes });
  }
  save(); closeModal('task-edit-modal'); renderAll(); toast('✅ נשמר!');
}

function toggleScheduleView() {
  const modes = ['timeline', 'list', 'grid'];
  const labels = { timeline: 'רשימה', list: 'לוח שבועי', grid: 'יומן יום' };
  schedViewMode = modes[(modes.indexOf(schedViewMode) + 1) % modes.length];
  isGridView = schedViewMode === 'grid';
  document.getElementById('btn-toggle-view').textContent = labels[schedViewMode];
  renderSchedule();
}

function renderCalendarView() {
  const now = new Date();
  const todayStr = ld(now);
  const sow = new Date(now); sow.setDate(now.getDate() - now.getDay() + S.weekOffset * 7);
  const days = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  const daysFull = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const hours = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
  // Slot end times for current-time calculation
  const slotMins = [8*60, 9*60+50, 11*60+40, 14*60, 15*60+50, 17*60+40, 19*60+30, 21*60+20];
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
    if (isGridView && document.getElementById('page-schedule').classList.contains('active')) {
      renderCalendarView();
    } else {
      clearInterval(window._calTimeInterval);
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
        S.anchors.push({ id: uid(), name: ev.SUMMARY, day: dayNum, start: startTime, end: endTime, color: getCourseColor(ev.SUMMARY), travel: 0, recurring: true, days: [dayNum] });
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
  toast(`✅ יובאו ${importedAnchors} שיעורים קבועים ו-${importedTasks} אירועים!`);
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
      row.style.cssText = 'display:grid;grid-template-columns:65px 1fr 1fr;gap:0.5rem;align-items:center;margin-bottom:0.35rem';
      row.innerHTML = `<span style="font-size:0.82rem;font-weight:700;color:var(--text)">${dayNames[d]}</span><input type="time" id="anc-day-start-${d}" value="${baseStart}" style="font-size:0.8rem;padding:0.35rem" /><input type="time" id="anc-day-end-${d}" value="${baseEnd}" style="font-size:0.8rem;padding:0.35rem" />`;
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
  const dn = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const isRecurring = document.getElementById('anc-recurring')?.checked;
  if(!Array.isArray(S.anchors)) S.anchors=[];

  // ── EDIT MODE ──
  if (editId) {
    const idx = S.anchors.findIndex(a => String(a.id) === String(editId));
    if (idx === -1) { toast('⚠️ העוגן לא נמצא'); return; }
    const day = parseInt(document.getElementById('anc-day').value || 0);
    if (start >= end) { toast('⚠️ שעת ההתחלה חייבת להיות לפני שעת הסיום'); return; }
    const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number);
    if ((eh*60+em)-(sh*60+sm) > 16*60) { toast('⚠️ משמרת לא יכולה להיות יותר מ-16 שעות'); return; }
    const updatedAnchor = { ...S.anchors[idx], name, day, start, end, travelMin, color, endDate };
    const ast2 = sh*60+sm - travelMin; const aen2 = eh*60+em + travelMin;
    let collidedTasks = [];
    S.tasks = S.tasks.filter(t => {
      if (new Date(t.date).getDay() === day && !t.done && !t.missed) {
        const tst = parseInt((t.time||'00:00').split(':')[0])*60 + parseInt((t.time||'00:00').split(':')[1]);
        const ten = tst + parseInt(t.duration||90);
        if (tst < aen2 && ten > ast2) { collidedTasks.push(t); return false; }
      }
      return true;
    });
    S.anchors[idx] = updatedAnchor;
    document.getElementById('anchor-modal').dataset.editId = '';
    save(); closeModal('anchor-modal'); renderAll();
    if (collidedTasks.length > 0) { toast(`⚠️ העדכון דרס ${collidedTasks.length} משימות`); openRecalcForCollision(updatedAnchor, collidedTasks); }
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
      if (ds >= de){ toast(`⚠️ יום ${dn[d]}: שעת ההתחלה לפני הסיום`); return; }
      const [sh,sm]=ds.split(':').map(Number); const [eh,em]=de.split(':').map(Number);
      if((eh*60+em)-(sh*60+sm) > 16*60){ toast(`⚠️ יום ${dn[d]}: משמרת מעל 16 שעות`); return; }
      newAnchors.push({ id:uid(), name, day:d, start:ds, end:de, travelMin, color, endDate });
    }
    S.anchors.push(...newAnchors);
    let allCollided = [];
    newAnchors.forEach(anchor => {
      const ast2 = parseInt(anchor.start.split(':')[0])*60+parseInt(anchor.start.split(':')[1])-travelMin;
      const aen2 = parseInt(anchor.end.split(':')[0])*60+parseInt(anchor.end.split(':')[1])+travelMin;
      S.tasks = S.tasks.filter(t => {
        if (new Date(t.date).getDay() === anchor.day && !t.done && !t.missed) {
          const tst = parseInt((t.time||'00:00').split(':')[0])*60+parseInt((t.time||'00:00').split(':')[1]);
          const ten = tst + parseInt(t.duration||90);
          if (tst < aen2 && ten > ast2){ allCollided.push(t); return false; }
        }
        return true;
      });
    });
    document.getElementById('anc-recurring').checked = false;
    document.getElementById('anc-single-day-wrap').classList.remove('hidden');
    document.getElementById('anc-days-selector').classList.add('hidden');
    document.getElementById('anc-per-day-times').classList.add('hidden');
    document.getElementById('anc-day-rows').innerHTML = '';
    save(); closeModal('anchor-modal'); renderAll();
    if (allCollided.length > 0){ toast(`⚠️ עוגנים חדשים דרסו ${allCollided.length} משימות!`); openRecalcForCollision(newAnchors[0], allCollided); }
    else { toast(`✓ ${newAnchors.length} עוגנים קבועים נוספו!`); }
  } else {
    const day = parseInt(document.getElementById('anc-day').value||0);
    if(start >= end){ toast('⚠️ שעת ההתחלה חייבת להיות לפני שעת הסיום'); return; }
    const [sh,sm]=start.split(':').map(Number); const [eh,em]=end.split(':').map(Number);
    if((eh*60+em)-(sh*60+sm)>16*60){ toast('⚠️ משמרת לא יכולה להיות יותר מ-16 שעות'); return; }
    const newAnchor = { id:uid(), name, day, start, end, travelMin, color };
    S.anchors.push(newAnchor);
    const ast2 = parseInt(start.split(':')[0])*60+parseInt(start.split(':')[1])-travelMin;
    const aen2 = parseInt(end.split(':')[0])*60+parseInt(end.split(':')[1])+travelMin;
    let collidedTasks = [];
    S.tasks = S.tasks.filter(t => {
      if (new Date(t.date).getDay() === day && !t.done && !t.missed) {
        const tst = parseInt((t.time||'00:00').split(':')[0])*60+parseInt((t.time||'00:00').split(':')[1]);
        const ten = tst + parseInt(t.duration||90);
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
  if (daysLeft > 21) { toast(`⚠️ מצב קראנץ׳ מופעל כשנשארו עד 21 ימים (כרגע ${daysLeft} ימים)`); return; }

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
    if (confirm(`⚠️ אין זמן פנוי ב-${crunchDays} ימים לפני המבחן.\nלפתוח יועץ לו"ז להוספת זמן?`)) openRecalc('schedule');
    return;
  }

  const crunchNames = [`שליפה אקטיבית — ${ex.course}`, `מבחן תרגול — ${ex.course}`, `חזרה אינטנסיבית — ${ex.course}`, `תרגול שאלות — ${ex.course}`];
  const validTimes = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
  const newTasks = []; let nameIdx = 0;
  const lines = slotsData.text.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/); if (!dateMatch) continue;
    const dateStr = dateMatch[1];
    const slotTimes = validTimes.filter(t => line.includes(t));
    let addedThisDay = 0;
    for (const time of slotTimes) {
      if (addedThisDay >= 2) break;
      const clash = S.tasks.find(t => t.date === dateStr && t.time === time && !t.done && t.course !== ex.course);
      if (clash) continue;
      newTasks.push({ id: uid(), name: crunchNames[nameIdx % crunchNames.length], course: ex.course, date: dateStr, time, duration: "90 דק'", priority: 'גבוה', done: false, missed: false, isCrunch: true });
      nameIdx++; addedThisDay++;
    }
  }
  if (!newTasks.length) { toast('⚠️ לא נמצאו חריצים פנויים בחלון הקראנץ׳'); return; }
  if (!confirm(`🔥 נוצרו ${newTasks.length} משימות קראנץ׳ (${crunchDays} ימים לפני מבחן "${ex.course}").\nלהוסיף ללו"ז?`)) return;
  // Remove old crunch tasks for this course in the same window to avoid duplicates
  S.tasks = S.tasks.filter(t => !(t.isCrunch && t.course === ex.course && t.date >= effectiveStart && t.date <= examMinus1Str));
  S.tasks.push(...newTasks);
  save(); renderAll(); toast(`🔥 ${newTasks.length} משימות קראנץ׳ נוספו ללו"ז!`);
}

function addExam(){
    const course = document.getElementById('ex-course').value.trim();
    const date = document.getElementById('ex-date').value;
    const type = document.getElementById('ex-type')?.value || 'מבחן';
    if(!course || !date){ toast('נא למלא שם קורס ותאריך'); return; }
    if(course.length > 80){ toast('⚠️ שם הקורס ארוך מדי (מקסימום 80 תווים)'); return; }
    if(new Date(date) < new Date(ld(new Date()))){ toast('⚠️ תאריך לא יכול להיות בעבר'); return; }
    const yearsFromNow = new Date(); yearsFromNow.setFullYear(yearsFromNow.getFullYear() + 3);
    if(new Date(date) > yearsFromNow){ toast('⚠️ תאריך נראה לא הגיוני'); return; }
    if(S.exams.find(e => e.course === course && e.date === date)){ toast('⚠️ יעד זה כבר קיים!'); return; }
    S.exams.push({id:uid(), course, date, type, conf:3, createdDate: ld(new Date()), readyPct:0});
    save(); renderExams(); toast(`✅ ${type} נוסף!`);
    document.getElementById('ex-course').value = '';
    document.getElementById('ex-date').value = '';
    if(document.getElementById('ex-type')) document.getElementById('ex-type').value = 'מבחן';
}

let selectedExamId = null;
function renderExams(){
  const wrap = document.getElementById('exams-list-wrap');
  if(!S.exams.length){ wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">אין מבחנים עדיין</div><div class="empty-sub">הוסף מבחן כדי להתחיל לעקוב אחרי ההתקדמות</div></div>'; return; }
  if (selectedExamId) { renderExamDashboard(selectedExamId); return; }
  const sorted = [...S.exams].sort((a,b)=>a.date.localeCompare(b.date));
  wrap.innerHTML = sorted.map(ex => {
    const daysLeft = Math.max(0, Math.ceil((new Date(ex.date)-new Date())/86400000));
    const isUrgent = daysLeft <= 7;
    const isVeryUrgent = daysLeft <= 3;
    const urgentStyle = isVeryUrgent ? 'border-color:var(--red);background:var(--red-light);' : isUrgent ? 'border-color:var(--yellow);background:var(--yellow-light);' : '';
    const daysColor = isVeryUrgent ? 'var(--red)' : isUrgent ? 'var(--yellow)' : 'var(--accent)';
    const typeEmoji = {'מבחן':'📝','בוחן':'📋','עבודה':'📄','הגשה':'📤'}[ex.type||'מבחן'] || '📝';
    const typeColor = {'מבחן':'var(--accent)','בוחן':'var(--purple)','עבודה':'var(--green)','הגשה':'var(--yellow)'}[ex.type||'מבחן'] || 'var(--accent)';
    return `<div class="exam-row-card" style="cursor:pointer;${urgentStyle}" onclick="selectedExamId='${ex.id}'; renderExams();">
      <div class="exam-info">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem">
          <span style="font-size:0.72rem;font-weight:800;background:${typeColor}20;color:${typeColor};padding:2px 8px;border-radius:99px;border:1px solid ${typeColor}40">${typeEmoji} ${ex.type||'מבחן'}</span>
          ${isVeryUrgent?'<span style="font-size:0.72rem;font-weight:800;background:var(--red-light);color:var(--red);padding:2px 8px;border-radius:99px">🚨 דחוף</span>':''}
        </div>
        <div class="exam-name" style="font-size:1.1rem">${ex.course}</div>
        <div class="exam-meta" style="font-weight:700;color:${daysColor}">עוד ${daysLeft} ימים — ${fmtDate(ex.date)}</div>
      </div>
      <button class="btn-sm" style="background:var(--surface2);color:var(--text);pointer-events:none;">פרטים ➔</button>
    </div>`;
  }).join('');
}

function renderExamDashboard(id) {
  const wrap = document.getElementById('exams-list-wrap'); const ex = S.exams.find(e => e.id === id);
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
              <button class="btn-sm" style="background:var(--yellow-light);color:var(--yellow);border:1px solid var(--yellow);font-weight:800;" onclick="scheduleExamCrunch('${ex.id}')">🔥 קראנץ׳</button>
              <button class="btn-sm red" onclick="if(confirm('למחוק את המבחן לצמיתות?')) { removeExam('${ex.id}'); selectedExamId=null; renderExams(); }">🗑 מחק</button>
            </div>
        </div>
        <div style="margin-bottom:2rem;"><div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;"><span style="font-weight:800; font-size:0.9rem;">⏳ ציר זמן (הזמן שעבר)</span><span style="font-weight:800; font-family:var(--mono); color:var(--yellow);">${timePct}%</span></div><div class="tree-bar-wrap" style="margin:0; height:16px; background:var(--border);"><div class="tree-bar-fill" style="width:${timePct}%; background:var(--yellow);"></div></div></div>
        <div style="margin-bottom:2rem;"><div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;"><span style="font-weight:800; font-size:0.9rem;">📈 מדד התקדמות משימות</span><span style="font-weight:800; font-family:var(--mono); color:var(--green);">${perfPct}% (${doneTasks}/${totalTasks})</span></div><div class="tree-bar-wrap" style="margin:0; height:16px; background:var(--border);"><div class="tree-bar-fill" style="width:${perfPct}%; background:var(--green);"></div></div></div>
        <div style="text-align:center; padding-top:1.5rem; border-top:1px dashed var(--border2);"><div style="font-size:0.9rem; color:var(--text); margin-bottom:0.8rem; font-weight:700;">זמן הערכת מצב: שלח את הנתונים ל-AI כדי לגבש אסטרטגיה מחדש להמשך.</div><button class="btn-primary" style="padding:0.75rem 1.5rem; font-size:0.95rem; border-radius:50px; background:linear-gradient(135deg, var(--purple), var(--accent));" onclick="recalcExamFocus('${ex.course}', ${perfPct}, ${timePct}, ${daysLeft})">🤖 נתח מצב מבחן עם ה-AI</button></div>
    </div>`;
}
function recalcExamFocus(course, perfPct, timePct, daysLeft) {
  openRecalc('exam');
  const courseTasks = S.tasks.filter(t => t.course === course);
  const lowRated = courseTasks.filter(t => t.rating && parseInt(t.rating) <= 3).map(t=>`${t.name}: ${t.rating}⭐ — "${t.feedback||''}"`).join(', ');
  const chat = document.getElementById('recalc-chat');
  const todayForSlots = ld(new Date());
  const examEntry = S.exams.find(e => e.course === course);
  const freeSlots = getAvailableSlots(todayForSlots, examEntry?.date || todayForSlots, 5);
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const anchorSummary = (S.anchors||[]).map(a=>`יום ${dayNames[parseInt(a.day)]}: ${a.start}–${a.end}`).join(', ') || 'אין';
  const msg = `הערכת מצב למבחן ב-"${course}": נשארו ${daysLeft} ימים. עברו ${timePct}% מהזמן אבל השלמתי רק ${perfPct}% מהמשימות. ${lowRated ? `משימות שהלכו קשה: ${lowRated}.` : ''} מה האסטרטגיה המומלצת להדביק את הפער?`;
  recalcHistory[0] = {role:'system', content: `אתה יועץ אקדמי מומחה לקורס "${course}".
נתונים: ימים נותרו=${daysLeft}, זמן שעבר=${timePct}%, השלמת משימות=${perfPct}%.
כל משימות הקורס: ${JSON.stringify(courseTasks)}.
משימות עם דירוג נמוך: ${lowRated||'אין'}.
זמנים פנויים לשיבוץ: ${freeSlots.text||'אין'}.
עוגנים קיימים (אסור לחפוף): ${anchorSummary}.
חוקים:
(1) נתח את הפער — האם הקצב מספיק?
(2) הצע שיטות למידה ספציפיות: חזרה מרווחת, שליפה אקטיבית, שילוב נושאים.
(3) כשאתה ממליץ להוסיף משימות — תאר אותן בבירור ב-reply, ואז כלול אותן ב-actions.add. הסטודנט יראה הצעה ויחליט אם לאשר.
(4) השתמש אך ורק בזמנים הפנויים — אל תחפוף עם עוגנים קיימים ואל תקבע בעבר.
(5) שעות תקינות בלבד: 08:00,09:00,10:00,11:00,12:00,13:00,14:00,15:00,16:00,17:00,18:00,19:00,20:00.`};
  chat.innerHTML = `<div class="chat-msg user"><div class="chat-bubble">${msg}</div></div>`;
  document.getElementById('recalc-input').value = msg;
  sendRecalc();
}
function removeExam(id){ S.exams = S.exams.filter(e => String(e.id)!==String(id)); save(); renderExams(); }

// ── DYNAMIC CHAT & AI ──
function checkPastDueTasks() {
    const todayStr = ld(new Date()); let missedTasks = [];
    S.tasks.forEach(t => { if (t.date < todayStr && !t.done && !t.missed) { t.missed = true; t.missedReason = 'לא בוצע (עבר)'; missedTasks.push(t); } });
    if (missedTasks.length > 0) {
        save();
        openRecalc('morning');
        const chat = document.getElementById('recalc-chat');
        const taskDetails = missedTasks.map(t=>`"${t.name}" (${t.course||'ללא קורס'}, ${t.date})`).join(', ');
        const taskJSON = JSON.stringify(missedTasks.map(t=>({id:t.id,name:t.name,course:t.course,date:t.date,time:t.time})));
        const slotsData = getAvailableSlots(todayStr, todayStr, 3);
        const msg = `בוקר טוב ☀️<br>ראיתי ${missedTasks.length > 1 ? `שנשארו ${missedTasks.length} משימות לא גמורות` : 'שנשארה משימה לא גמורה'}: <b>${taskDetails}</b>.<br><br>לא משאירים פצועים בשטח 💪 <b>מה לעשות? לשבץ מחדש היום, לדחות לסוף שבוע, או לוותר?</b>`;
        chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">${msg}</div></div>`;
        recalcHistory = [{role: 'system', content: `יש ${missedTasks.length} משימות שפוספסו: ${taskJSON}.
זמנים פנויים היום: ${slotsData.text||'אין'}.
חוקים: (1) הצע 2-3 אפשרויות קונקרטיות לשיבוץ מחדש. (2) כשהמשתמש בוחר — החזר JSON עם actions.update (id+date+time חדשים). (3) שעות תקינות: 08:00,09:00,10:00,11:00,12:00,13:00,14:00,15:00,16:00,17:00,18:00,19:00,20:00. (4) פורמט: {"reply":"...","actions":{"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}]}}`}];
    }
}

function openRecalcForCollision(anchor, tasks) {
    openRecalc('collision');
    const chat = document.getElementById('recalc-chat');
    const today = ld(new Date());
    // Build a summary of displaced tasks
    const taskSummary = tasks.map(t => `"${t.name}" (${t.course||'ללא קורס'}) — ${t.date} ${t.time}`).join('<br>');
    const taskJSON = JSON.stringify(tasks.map(t=>({id:t.id,name:t.name,course:t.course,date:t.date,time:t.time,duration:t.duration})));
    // Find available free slots for rescheduling context
    const slotsData = getAvailableSlots(today, tasks.reduce((latest,t)=>t.date>latest?t.date:latest, today), 3);
    const totalDuration = tasks.reduce((sum,t)=>sum+parseInt(t.duration||90),0);
    const msg = `⚠️ <b>ניגוד לו"ז!</b><br>העוגן <b>"${anchor.name}"</b> (יום ${['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][anchor.day]}, ${anchor.start}–${anchor.end}) דרס את המשימות הבאות (${tasks.length} בסך הכל, ~${Math.round(totalDuration/60*10)/10} שעות):<br><br>${taskSummary}<br><br>הוצאתי אותן מהלו"ז. <b>מה לעשות איתן?</b>`;
    chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">${msg}</div></div>`;
    recalcHistory = [{
      role: 'system',
      content: `אתה מנהל לו"ז שעוזר לסטודנט לאחר שעוגן חדש דרס ${tasks.length} משימות (${Math.round(totalDuration/60*10)/10} שעות).
עוגן חדש: "${anchor.name}" — יום ${anchor.day}, ${anchor.start}–${anchor.end}.
משימות שנדרסו: ${taskJSON}.
זמנים פנויים: ${slotsData.text || 'אין זמנים פנויים זמינים'}.
היום: ${today}.

חוקים: (1) הצג לסטודנט 2-3 אפשרויות קונקרטיות: לדחוס לסוף שבוע, לפרוס על הימים הקרובים, לדלג על חלק. (2) כשהסטודנט בוחר — החזר JSON עם actions.add לשיבוץ מחדש. (3) השתמש רק בשעות: 08:00,09:00,10:00,11:00,12:00,13:00,14:00,15:00,16:00,17:00,18:00,19:00,20:00. (4) אל תשבץ בזמן עוגנים אחרים. (5) פורמט: {"reply":"...","actions":{"add":[...]}}`
    }];
}

function openCapacityNegotiation(course, requested, available, examDate, slotsText, perWeek, weeks) {
    openRecalc('capacity');
    const deficit = (requested - available).toFixed(1);
    const chat = document.getElementById('recalc-chat');
    const otherCourses = [...new Set(S.tasks.filter(t => t.course !== course && !t.done && t.date >= ld(new Date())).map(t => t.course))];
    const otherCourseSummary = otherCourses.length > 0
      ? otherCourses.map(c => { const cnt = S.tasks.filter(t=>t.course===c&&!t.done&&t.date>=ld(new Date())).length; return `${c} (${cnt} משימות)`; }).join(', ')
      : 'אין קורסים אחרים';
    const weekBreakdown = perWeek && weeks ? `<br><small style="opacity:0.8">(${perWeek} שעות/שבוע × ${weeks} שבועות = ${requested.toFixed(0)} שעות)</small>` : '';
    const availPerWeek = perWeek && weeks ? ` (${(available/weeks).toFixed(1)} שעות/שבוע)` : '';
    const msg = `⚠️ <b>בעיית קיבולת!</b><br><br>
ביקשת <b>${requested.toFixed(0)} שעות</b> ל-"${course}"${weekBreakdown}, אבל יש רק <b>${available.toFixed(1)} שעות פנויות</b>${availPerWeek} עד המבחן ב-${examDate} (מחסור: <b>${deficit} שעות</b>).<br><br>
<b>קורסים אחרים בלו"ז:</b> ${otherCourseSummary}.<br><br>
<b>איך תרצה לפתור את זה?</b><br>
א. צור תוכנית עם ${available.toFixed(1)} שעות בלבד${availPerWeek}<br>
ב. פנה שעות מקורס אחר (ספר לי מאיזה)<br>
ג. הסר משימות לא קריטיות ואז נחזור לתכנן`;
    chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">${msg}</div></div>`;
    const perWeekCtx = perWeek && weeks ? ` (${perWeek} שעות/שבוע × ${weeks} שבועות)` : '';
    recalcHistory = [{
      role: 'system',
      content: `אתה מנהל קיבולת לו"ז. הסטודנט ביקש ${requested.toFixed(0)} שעות${perWeekCtx} ל-"${course}" אבל יש רק ${available.toFixed(1)} שעות פנויות (מחסור: ${deficit} שעות).
קורסים אחרים בלו"ז: ${otherCourseSummary}.
מבחן: ${examDate}.
זמנים פנויים: ${slotsText}.
חוקים: (1) בקש את הסטודנט לבחור אחת מ-3 האפשרויות שהצעת. (2) אם הוא בוחר לפנות שעות מקורס אחר — החזר JSON עם actions.delete של המשימות שמתפנות. (3) אם הוא מסכים לתוכנית קטנה יותר — אמור לו לחזור למתכנן ולהזין ${(available/Math.max(1,weeks||1)).toFixed(1)} שעות/שבוע. (4) היה ישיר, ממוקד, לא יותר מ-3 אפשרויות. (5) פורמט: {"reply":"...","actions":{"delete":["ID"]}}`
    }];
}

function openRecalc(mode = 'schedule') {
    recalcHistory = [];
    document.getElementById('recalc-overlay').classList.remove('hidden');
    document.getElementById('recalc-chat').innerHTML = '';
    currentChatMode = mode;
    const header = document.getElementById('chat-dynamic-header');
    const title = document.getElementById('chat-header-title');
    const sub = document.getElementById('chat-header-sub');
    const btn = document.getElementById('btn-recalc-send');
    const chat = document.getElementById('recalc-chat');

    if (mode === 'weekly') {
        header.style.background = 'linear-gradient(135deg, #8b5cf6, #c084fc)';
        title.textContent = '📊 מנתח התקדמות שבועי';
        sub.textContent = 'ניתוח הרגלים, השלמה וסטטיסטיקות שבועיות.';
        btn.style.background = 'linear-gradient(135deg, #8b5cf6, #c084fc)';
        const allTasks = S.tasks.filter(t => t.done || t.missed);
        const doneTasks = allTasks.filter(t => t.done).length;
        const missedTasks = allTasks.filter(t => t.missed).length;
        const badTasks = S.tasks.filter(t => t.rating && parseInt(t.rating) <= 3 && t.done);
        const badSummary = badTasks.map(t => `${t.name} (${t.course}): ${t.rating}⭐ — "${t.feedback||'אין פידבק'}"`).join('\n');
        const weekSysPrompt = `אתה מנתח התקדמות שבועי. תפקידך לנתח נתוני השבוע ולהציע שיפורים קונקרטיים.
סטטיסטיקות: ${doneTasks} משימות הושלמו, ${missedTasks} פוספסו, רצף: ${S.streak} ימים.
משימות עם דירוג נמוך (1-3⭐): ${badSummary||'אין'}.
כל המשימות: ${JSON.stringify(S.tasks.slice(-30))}.
חוקים: (1) זהה דפוסים — אותה שעה ביום? אותו קורס? (2) הצע 2-3 שינויים ספציפיים לשבוע הבא. (3) החזר JSON: {"reply":"...","actions":{"add":[...],"update":[...]}}. (4) השב בעברית בלבד.`;
        let msg = badTasks.length > 0 ? `ראיתי שהשבוע היו ${badTasks.length} משימות שדורגו נמוך. בוא נבין למה ונתקן לשבוע הבא 🔍` : doneTasks > 0 ? `שבוע מצוין! השלמת ${doneTasks} משימות 🚀 על מה רוצה לשים דגש שבוע הבא?` : `היי! ספר לי איך היה השבוע — מה הלך טוב ומה היה קשה?`;
        chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">${msg}</div></div>`;
        recalcHistory = [{role: 'system', content: weekSysPrompt}];
    } else if (mode === 'exam') {
        header.style.background = 'linear-gradient(135deg, #16c98d, #38ef7d)';
        title.textContent = '🎯 מעקב התקדמות לקורס';
        sub.textContent = 'ניתוח פערים ואסטרטגיית למידה לקראת המבחן.';
        btn.style.background = 'linear-gradient(135deg, #16c98d, #38ef7d)';
        recalcHistory = [{role: 'system', content: `אתה יועץ אקדמי מומחה לקורסים. תפקידך לנתח את הפער בין הזמן שעבר לבין ההתקדמות בפועל, ולהציע אסטרטגיה ספציפית.
חוקים: (1) נתח את הפער בין timePct לבין perfPct. (2) המלץ על שיטות למידה ספציפיות: חזרה מרווחת, שליפה אקטיבית, שילוב נושאים. (3) אם צריך לסדר מחדש — החזר JSON עם actions.update/add בשעות תקינות בלבד: 08:00,09:00,10:00,11:00,12:00,13:00,14:00,15:00,16:00,17:00,18:00,19:00,20:00. (4) היה ישיר — אמור אם הקצב מספיק או לא. (5) החזר JSON: {"reply":"...","actions":{...}}`}];
    } else if (mode === 'morning' || mode === 'collision') {
        header.style.background = 'linear-gradient(135deg, #f5a623, #ff7b7b)';
        title.textContent = '⚡ מנהל לוח זמנים';
        sub.textContent = 'פתרון התנגשויות וסידור מחדש של משימות.';
        btn.style.background = 'linear-gradient(135deg, #f5a623, #ff7b7b)';
        if (!recalcHistory.length) {
            recalcHistory = [{role: 'system', content: `אתה מנהל לוח זמנים מדויק. תפקידך לפתור התנגשויות ולסדר משימות שנפלו.
חוקים: (1) השתמש רק בשעות: 08:00,09:00,10:00,11:00,12:00,13:00,14:00,15:00,16:00,17:00,18:00,19:00,20:00. (2) אל תקבע בעבר. (3) החזר JSON: {"reply":"...","actions":{"add":[...],"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}]}}. (4) הסבר מה שינית ולמה.`}];
        }
    } else if (mode === 'capacity') {
        header.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
        title.textContent = '⚠️ אין מספיק שעות — תעדוף';
        sub.textContent = 'נחליט ביחד איך לחלק את הזמן הפנוי.';
        btn.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
        // recalcHistory and chat are set by openCapacityNegotiation() before calling openRecalc()
        // so we only set them here if openRecalc was called directly
        if (!recalcHistory.length) {
            recalcHistory = [{role:'system', content:`אתה מנהל קיבולת לו"ז. עזור לסטודנט לתעדף את זמן הלמידה שלו. פורמט: {"reply":"...","actions":{"delete":["ID"]}}`}];
            chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">יש לך בעיית קיבולת. ספר לי כמה שעות ביקשת ועבור איזה קורס, ואעזור לך לתעדף.</div></div>`;
        }
    } else if (mode === 'holiday') {
        header.style.background = 'linear-gradient(135deg,#10b981,#3b82f6)';
        title.textContent = '📅 התנגשות עם חג';
        sub.textContent = 'ה-AI יציע דחייה, ביטול, או המשך כמתוכנן.';
        btn.style.background = 'linear-gradient(135deg,#10b981,#3b82f6)';
        if (!recalcHistory.length) {
          recalcHistory = [{role:'system',content:`אתה מנהל לו"ז. עזור לסטודנט להחליט מה לעשות עם משימות שנקבעו בחגים. פורמט: {"reply":"...","actions":{"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}],"delete":["ID"]}}`}];
        }
    } else { // schedule — Global Intelligent Manager
        header.style.background = 'linear-gradient(135deg,var(--red),#ff7b7b)';
        title.textContent = '⚡ מנהל לוח זמנים AI — ראייה גלובלית';
        sub.textContent = 'תמונה מלאה של הלו"ז — סידור, הזזה, שגרות חדשות.';
        btn.style.background = 'linear-gradient(135deg,var(--red),#ff7b7b)';
        const todayStr = ld(new Date());
        const thirtyDays = ld(new Date(Date.now()+30*86400000));
        const freeSlots30 = getAvailableSlots(todayStr, thirtyDays, 3);
        const anchorSummary = (S.anchors||[]).map(a => {
          const dn2=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
          return `${a.name}: יום ${dn2[a.day]}, ${a.start}–${a.end}${a.travelMin>0?` (+${a.travelMin}דק׳ נסיעה)`:''}`;
        }).join('; ') || 'אין';
        const pendingTasks = S.tasks.filter(t=>!t.done&&!t.missed&&t.date>=todayStr);
        const capacityPct = freeSlots30.totalMinutes > 0
          ? Math.round((pendingTasks.length*90 / freeSlots30.totalMinutes)*100)
          : 0;
        const dn2=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
        const anchorLines = (S.anchors||[]).map(a=>`  • ${a.name}: יום ${dn2[a.day]}, ${a.start}–${a.end}${a.travelMin>0?` (נסיעה ${a.travelMin} דק')`:''}${a.endDate?` (בתוקף עד ${a.endDate})`:''}${!(a.endDate&&todayStr>a.endDate)?'':' [פג תוקף]'}`).join('\n') || '  אין';
        const taskLines = pendingTasks.slice(0,30).map(t=>`  • [${t.id}] ${t.date} ${t.time||''} | ${t.course||'ללא קורס'} | ${t.name}`).join('\n') || '  אין';
        const examLines = S.exams.filter(e=>e.date>=todayStr).map(e=>`  • ${e.course}: ${e.date} (עוד ${Math.ceil((new Date(e.date)-new Date())/86400000)} ימים)`).join('\n') || '  אין';
        chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">היי! יש לי תמונה גלובלית של הלו"ז שלך — <b>${pendingTasks.length} משימות קרובות</b>, ${S.anchors.length} עוגנים, תפוסה: <b>~${Math.min(capacityPct,100)}%</b>.<br>שאל אותי על הלו"ז, בקש שינויים, הוספות, או שאל "מתי יש לי X?"</div></div>`;
        recalcHistory = [{role:'system', content:`אתה מנהל לו"ז AI חכם לסטודנט ${S.userName||''} עם ראייה גלובלית מלאה.

📋 עוגנים קבועים (אסור לחפוף):
${anchorLines}

📅 משימות פתוחות (${pendingTasks.length}):
${taskLines}

📝 מבחנים:
${examLines}

⏰ היום: ${todayStr} | קימה: ${S.wakeTime} | שינה: ${S.sleepTime} | תפוסה: ~${Math.min(capacityPct,100)}%
🗓️ זמנים פנויים (30 ימים): ${freeSlots30.text||'אין'}

חוקי ברזל:
(1) שעות תקינות בלבד: 08:00, 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00, 20:00
(2) אל תקבע לפני ${S.wakeTime} ואחרי ${S.sleepTime}. אל תקבע בעבר (לפני ${todayStr}).
(3) לשאלת מידע (ללא שינוי): {"reply":"...","actions":{}}
(4) לשינוי לו"ז: {"reply":"הסבר מה שינית","actions":{"add":[...],"delete":["ID"],"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}]}}
(5) אם שאלה רגשית/נפשית → reply: "לתמיכה נפשית, פתח את בוט הפסיכולוג 🧠 דרך התפריט" ו-actions: {}
(6) לפני הוספת שגרה חוזרת — בדוק קונפליקטים תחילה, הצע פשרה אם הלו"ז מלא
(7) כשמוסיפים משימות חדשות — השתמש ב-ID אקראי חדש, לא בקיים`}];
    }
}
function closeRecalc() { document.getElementById('recalc-overlay').classList.add('hidden'); renderAll(); }
function applyPendingRecalcActions(cid) {
    if (!pendingRecalcActions || !pendingRecalcActions.length) { toast('אין פעולות ממתינות'); return; }
    const conflicts = pendingRecalcActions.filter(t => {
        if (!t.date || !t.time) return false;
        const taskDay = new Date(t.date + 'T12:00:00').getDay();
        const tst = parseInt((t.time||'00:00').split(':')[0])*60 + parseInt((t.time||'00:00').split(':')[1]);
        const anchorConflict = (S.anchors||[]).some(a => {
            if (parseInt(a.day) !== taskDay) return false;
            const ast = parseInt((a.start||'00:00').split(':')[0])*60 + parseInt((a.start||'00:00').split(':')[1]) - (a.travelMin||0);
            const aen = parseInt((a.end||'00:00').split(':')[0])*60 + parseInt((a.end||'00:00').split(':')[1]) + (a.travelMin||0);
            return tst < aen && (tst + 90) > ast;
        });
        const taskConflict = S.tasks.some(old => old.date === t.date && old.time === t.time && !old.done && !old.missed);
        return anchorConflict || taskConflict;
    });
    if (conflicts.length > 0 && !confirm(`⚠️ ${conflicts.length} משימות מתנגשות עם לו"ז קיים. להוסיף בכל זאת?`)) return;
    pendingRecalcActions.forEach(t => { S.tasks.push({...t, id: uid(), done: false, missed: false}); });
    const count = pendingRecalcActions.length;
    pendingRecalcActions = null;
    if (cid) document.getElementById(cid)?.remove();
    save(); renderAll();
    toast(`✅ ${count} משימות נוספו ללו"ז!`);
}

// ── PSYCHOLOGIST BOT ──
function openPsychologist() {
    const overlay = document.getElementById('psych-overlay');
    overlay.classList.remove('hidden');
    const chat = document.getElementById('psych-chat');
    if (chat.innerHTML === '') {
        psychHistory = [];
        const missedCount = S.tasks.filter(t=>t.missed).length;
        const upcomingExam = [...S.exams].sort((a,b)=>a.date.localeCompare(b.date))[0];
        const daysToExam = upcomingExam ? Math.ceil((new Date(upcomingExam.date)-new Date())/86400000) : null;
        let opener = `שלום ${S.userName}! 😊 אני כאן כדי לדבר על הצד הרגשי של הלימודים.`;
        if (daysToExam !== null && daysToExam <= 14) opener += ` רואה שיש לך מבחן ב${upcomingExam.course} בעוד ${daysToExam} ימים — איך אתה מרגיש לגבי זה?`;
        else if (missedCount > 3) opener += ` רואה שיש כמה משימות שפוספסו לאחרונה. לפעמים זה קורה — מה קרה?`;
        else opener += ` מה עובר עליך עכשיו בלימודים?`;
        chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">${opener}</div></div>`;
        psychHistory = [{role: 'system', content: `אתה מאמן פסיכולוגי תומך לסטודנטים, מתמחה ב-CBT ומניעת שחיקה.
פרופיל סטודנט: ${S.userName}. העדפות: ${JSON.stringify(S.profile)}.
חוקי ברזל: (1) לעולם אל תיתן עצות לו"ז — זה כלי נפרד. (2) התמקד בלבד ב: חרדת מבחנים, דחיינות, תסמונת המתחזה, שחיקה, מוטיבציה. (3) השתמש בשאלות סוקרטיות — שאל לפני שאתה ממליץ. (4) אזכר טכניקות מבוססות מחקר: טכניקת 5-4-3-2-1, ריפריימינג קוגניטיבי, שיטת פומודורו, self-compassion. (5) השב בעברית חמה ותומכת, עד 120 מילה לתגובה. (6) אל תחזיר JSON לעולם.`}];
    }
}

async function sendPsych() {
    const inp = document.getElementById('psych-input'); const msg = inp.value.trim(); if(!msg) return; inp.value = '';
    const chat = document.getElementById('psych-chat');
    chat.innerHTML += `<div class="chat-msg user"><div class="chat-bubble">${msg}</div></div><div class="chat-msg ai" id="psych-loading"><div class="chat-bubble"><span class="ai-thinking">חושב...</span></div></div>`;
    chat.scrollTop = chat.scrollHeight;
    psychHistory.push({role:'user', content:msg});
    if(psychHistory.length > 20) psychHistory = [psychHistory[0], ...psychHistory.slice(-18)];
    try {
        const ans = await callAI({ messages: psychHistory, temperature: 0.75 });
        psychHistory.push({role:'assistant', content:ans});
        document.getElementById('psych-loading')?.remove();
        chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${ans.replace(/\n/g,'<br>')}</div></div>`;
        chat.scrollTop = chat.scrollHeight;
    } catch(e) {
        document.getElementById('psych-loading')?.remove();
        chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble" style="color:var(--red)">שגיאה: ${e.message}</div></div>`;
    }
}

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
  const timesPerWeek = parseInt(document.getElementById('hp-setup-freq').value);
  const dur = parseInt(document.getElementById('hp-setup-dur').value);
  if (!name) { toast('הכנס שם לתחביב/מטרה'); return; }
  if (!goal) { toast('הכנס מטרה ברורה'); return; }
  if (!S.hobbies) S.hobbies = [];
  S.hobbies.push({ id: uid(), name, goal, timesPerWeek, sessionDuration: dur,
    createdDate: ld(new Date()), lastCheckIn: null, history: [] });
  _hobbyActiveIdx = S.hobbies.length - 1;
  save();
  renderHobbyPage();
  setTimeout(() => _hpStartCoach(_hobbyActiveIdx), 300);
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
  if (el('hp-next-date')) {
    el('hp-next-date').textContent = upcoming[0]
      ? upcoming[0].date + (upcoming[0].time ? ' · ' + upcoming[0].time : '')
      : 'לא מתוכנן';
  }

  _hpRenderTrack(hobby, done);

  // Upcoming list
  const upList = el('hp-upcoming-list');
  if (upList) {
    upList.innerHTML = upcoming.length === 0
      ? `<div style="font-size:0.82rem;color:var(--muted);text-align:center;padding:0.5rem 0">לחץ "מצא לי זמן" כדי לתזמן אימונים</div>`
      : upcoming.slice(0,5).map(t => {
          const days = Math.ceil((new Date(t.date) - new Date()) / 86400000);
          const badge = days === 0 ? 'היום!' : days === 1 ? 'מחר' : `עוד ${days}י`;
          return `<div class="hp-session-row">
            <div class="hp-session-dot" style="background:${getCourseColor(hobby.name)}"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.84rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</div>
              <div style="font-size:0.7rem;color:var(--muted)">${t.date}${t.time?' · '+t.time:''} · ${t.duration||hobby.sessionDuration+' דק\''}</div>
            </div>
            <span style="font-size:0.72rem;font-weight:800;color:var(--accent);white-space:nowrap">${badge}</span>
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

    if (!hobby.history || hobby.history.length === 0) {
      _hpStartCoach(idx);
    } else {
      const daysSince = hobby.lastCheckIn
        ? Math.floor((Date.now() - new Date(hobby.lastCheckIn).getTime()) / 86400000) : 999;
      if (daysSince >= 6) {
        const doneWeek = S.tasks.filter(t => {
          const dAgo = Math.floor((Date.now() - new Date(t.date+'T12:00:00').getTime()) / 86400000);
          return t.course === hobby.name && t.done && dAgo <= 7;
        }).length;
        const ci = `שבוע עבר — עשית ${doneWeek} מתוך ${hobby.timesPerWeek} אימונים. איך הרגשת? מה הלך טוב ומה היה קשה?`;
        chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${ci}</div></div>`;
        hobby.history.push({ role: 'assistant', content: ci });
        hobby.lastCheckIn = ld(new Date());
        save();
      }
    }
    chat.scrollTop = chat.scrollHeight;
  }
}

function _hpRenderTrack(hobby, done) {
  const wrap = document.getElementById('hp-track');
  if (!wrap) return;
  const spw = hobby.timesPerWeek || 3;
  const ms = [
    { icon:'🌱', label:'התחלה',      req:0 },
    { icon:'⚡', label:'שבוע ראשון', req:spw },
    { icon:'🔥', label:'חודש ראשון', req:Math.round(spw*4) },
    { icon:'💪', label:'עוצמה',      req:Math.round(spw*8) },
    { icon:'⭐', label:'מתקדם',      req:Math.round(spw*12) },
    { icon:'🏆', label:hobby.goal||'המטרה', req:Math.round(spw*16) },
  ];
  const total = ms[ms.length-1].req || 1;
  const pct = Math.min(100, (done / total) * 100);
  const currentMs = [...ms].reverse().find(m => done >= m.req) || ms[0];

  wrap.innerHTML = `
    <div style="margin-bottom:0.5rem;font-size:0.8rem;font-weight:700;color:var(--accent)">
      ${currentMs.icon} ${currentMs.label} · ${done}/${total} אימונים · ${pct.toFixed(0)}%
    </div>
    <div class="hp-track-outer">
      <div class="hp-track-line">
        <div class="hp-track-fill" style="width:${pct.toFixed(1)}%"></div>
      </div>
      <div class="hp-track-dots">
        ${ms.map((m,i) => {
          const mPct = total > 0 ? (m.req/total)*100 : (i/(ms.length-1))*100;
          const reached = done >= m.req;
          const isCur = reached && (i===ms.length-1 || done < ms[i+1].req);
          return `<div class="hp-ms${reached?' reached':''}${isCur?' current':''}" style="left:${mPct.toFixed(1)}%">
            <div class="hp-ms-bubble">${m.icon}</div>
            <div class="hp-ms-txt">${m.label}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

async function _hpStartCoach(idx) {
  const hobby = (S.hobbies || [])[idx];
  const chat = document.getElementById('hp-chat');
  if (!chat || !hobby) return;
  hobby.history = hobby.history || [];

  const sys = `אתה מאמן אישי נלהב לתחביבים ומטרות אישיות. שמך "מאמן".
סטודנט: ${S.userName}. מטרה: "${hobby.name}" — ${hobby.goal}.
תדירות: ${hobby.timesPerWeek} פעמים בשבוע. כל אימון: ${hobby.sessionDuration} דקות.
פרופיל: ${JSON.stringify(S.profile||{})}.
חוקים: (1) שאל שאלה אחת על רמת ניסיון ואז בנה תוכנית ספציפית (2) בצ'ק-אין שבועי — נתח, שבח, עדכן תוכנית (3) כשמציע אימונים — החזר JSON בסוף: {"tasks":[{"name":"...","duration":30},...]} (4) עברית חמה, עד 120 מילה.`;
  const opener = `היי ${S.userName}! מעולה שהחלטת לעבוד על "${hobby.name}" 💪\nלפני שנבנה תוכנית — מה הרמה שלך כרגע? מתחיל לגמרי, יש קצת ניסיון, או כבר מתרגל?`;

  hobby.history.push({ role:'system', content:sys });
  hobby.history.push({ role:'assistant', content:opener });
  hobby.lastCheckIn = ld(new Date());
  save();
  chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${opener.replace(/\n/g,'<br>')}</div></div>`;
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
  chat.innerHTML += `<div class="chat-msg user"><div class="chat-bubble">${msg}</div></div><div class="chat-msg ai" id="hp-loading"><div class="chat-bubble"><span class="ai-thinking">המאמן חושב...</span></div></div>`;
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

    chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${display.replace(/\n/g,'<br>')}</div></div>`;

    if (pendingTasks) {
      hobby._pendingTasks = pendingTasks;
      save();
      chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble hp-task-suggest">
        <div style="font-weight:700;color:var(--accent);margin-bottom:0.4rem">המאמן מציע ${pendingTasks.length} אימונים:</div>
        ${pendingTasks.map(t=>`<div style="font-size:0.82rem">• ${t.name} (${t.duration||hobby.sessionDuration} דק')</div>`).join('')}
        <button class="hp-add-btn" onclick="hpConfirmAddTasks()">📅 הוסף ללו"ז שלי</button>
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
  hobby._pendingTasks.forEach((t, i) => {
    const d = new Date(today);
    const offset = Math.round((i + 0.5) * remainingDays / n);
    d.setDate(today.getDate() + Math.min(offset, remainingDays));
    if (d.getDay() === 6) d.setDate(d.getDate() - 1); // skip Saturday
    S.tasks.push({ id:uid(), name:t.name, course:hobby.name, date:ld(d), time:times[i%times.length],
      duration:`${t.duration||hobby.sessionDuration} דק'`, priority:'בינוני', done:false, missed:false });
  });
  const added = n; hobby._pendingTasks = null;
  save(); renderAll(); _hpRenderHobby(_hobbyActiveIdx);
  toast(`✅ נוספו ${added} אימוני "${hobby.name}" ללו"ז!`);
}

async function findHobbySlots() {
  const hobby = (S.hobbies || [])[_hobbyActiveIdx];
  if (!hobby) return;
  const btn = document.getElementById('hp-find-btn');
  if (btn) { btn.disabled=true; btn.textContent='מחפש...'; }

  // Limit to current week (today → Saturday)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  const slotsData = getAvailableSlots(ld(new Date()), ld(endDate), '3');
  const done = S.tasks.filter(t=>t.course===hobby.name&&t.done).length;

  const prompt = `תזמן אימוני "${hobby.name}" (מטרה: ${hobby.goal}) לשבוע הנוכחי בלבד.
${hobby.timesPerWeek} פעמים בשבוע, כל אימון ${hobby.sessionDuration} דק'. אימונים שהושלמו: ${done}.
זמנים פנויים השבוע:
${slotsData.text}
בחר עד ${hobby.timesPerWeek} חריצים מהרשימה (עדיף אחה"צ/ערב, לא שישי/שבת בלילה). אל תצא מהתאריכים שניתנו!
החזר JSON בלבד: {"tasks":[{"name":"אימון ${hobby.name}","date":"YYYY-MM-DD","time":"HH:MM","duration":${hobby.sessionDuration}}]}`;

  try {
    const ans = await callAI({ messages:[{role:'user',content:prompt}], temperature:0.2, json:true });
    const parsed = JSON.parse(ans.match(/\{[\s\S]*\}/)[0]);
    if (!parsed.tasks?.length) throw new Error('empty');
    parsed.tasks.forEach(t => {
      S.tasks.push({ id:uid(), name:t.name||`אימון ${hobby.name}`, course:hobby.name,
        date:t.date, time:t.time, duration:`${t.duration||hobby.sessionDuration} דק'`,
        priority:'בינוני', done:false, missed:false });
    });
    save(); renderAll(); _hpRenderHobby(_hobbyActiveIdx);
    toast(`✅ נוספו ${parsed.tasks.length} אימונים בזמנים הפנויים!`);
  } catch(e) {
    toast('לא מצאתי זמנים מתאימים — נסה שוב או הוסף ידנית');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='📅 מצא לי זמן בלוז'; }
  }
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

// ══════════════════════════════════════════
// WEEKLY REVIEW — סיכום שבועי
// ══════════════════════════════════════════

function _weekStart(offset) {
  const d = new Date(); d.setHours(12,0,0,0);
  d.setDate(d.getDate() - d.getDay() + (offset||0)*7);
  return ld(d);
}

function _needsWeeklyReview() {
  if (!(S.courses || []).length) return false; // No courses set up — send to planner first
  const wr = S.weeklyReview || {};
  return !wr.lastReviewDate || wr.lastReviewDate < _weekStart(0);
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
    if (statusEl) statusEl.textContent = `הלוז מכסה עד ${range.end}`;
    if (subEl) subEl.textContent = 'לחץ לבניה מחדש';
    if (btnEl) { btnEl.textContent = '🔄 בנה מחדש'; btnEl.onclick = (e) => { e.stopPropagation(); _wrForceRebuild = true; showPage('weekly-review', null); updateBottomNav('weekly-review'); closeSidebar(); }; }
    if (badgeEl) badgeEl.textContent = '✓';
    card.classList.add('wrs-done');
  }
}

function _wrGetTargetRange() {
  const now = new Date();
  const today = ld(now);
  const dow = now.getDay();
  if (dow === 6) {
    const nextSun = new Date(now); nextSun.setDate(now.getDate() + 1);
    const nextSat = new Date(now); nextSat.setDate(now.getDate() + 7);
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
  if (!_wrForceRebuild && !_needsWeeklyReview()) {
    const range = _wrGetTargetRange();
    const nd = document.getElementById('wr-range-end');
    if (nd) nd.textContent = range.end;
    doneEl.classList.remove('hidden');
    activeEl.classList.add('hidden');
    renderWRSidebarCard();
    return;
  }
  _wrForceRebuild = false;
  doneEl.classList.add('hidden');
  activeEl.classList.remove('hidden');
  _wrInit();
}

async function _wrGenerate() {
  _wrMsg('⏳ מייצר תוכנית מותאמת אישית...');
  _wrProg((_wr.qs.length||1) + 1);

  const today = ld(new Date());
  const range = _wrGetTargetRange();
  const slots = getAvailableSlots(range.start, range.end, '3');

  const exams = (S.exams||[]).filter(e=>e.date>=today)
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6)
    .map(e=>({ c:e.course, d:e.date, days:Math.ceil((new Date(e.date)-new Date())/86400000) }));

  const { rules, taskDuration, tMin, tMax } = _buildSchedulingRules(S.profile, _wr.answers);
  const courseAdj = _buildCourseAdjustments(_wr.answers);
  const courseConfig = (S.courses||[]).map(c=>`${c.name}: ${c.hoursPerWeek}ש'/שבוע`).join(', ') || _wr.coursesLastWeek.join(', ') || 'לא הוגדרו';
  const hobbyLines = Object.entries(_wr.answers.hobbies).map(([h,v])=>`${h}: ${v==='none'?'דלג השבוע':v==='partial'?'פגישה אחת':'שמור תדירות'}`).join(', ') || 'אין';
  const priorityNote = _wr.answers.priority && _wr.answers.priority !== 'balanced'
    ? `קדם ביותר שעות ושעות פיק: ${_wr.answers.priority}` : 'איזון שווה בין כל הקורסים';

  const urgentExam = exams.find(e => e.days <= 5);
  const urgentNote = urgentExam
    ? `🚨 מבחן דחוף: ${urgentExam.c} בעוד ${urgentExam.days} ימים — הקצה 60% מהזמן הפנוי ללמידה שלו בלבד!`
    : '';

  const matInfo = Object.entries(_wr.answers.courses||{}).map(([c,a]) => {
    if (a.mat === 'lots')   return `${c}: נשאר הרבה חומר — יש לתת יותר זמן`;
    if (a.mat === 'some')   return `${c}: נשאר חלק — קצב רגיל`;
    if (a.mat === 'little') return `${c}: כמעט סיים — חזרות בלבד`;
    return null;
  }).filter(Boolean).join('\n') || 'אין מידע';

  const prompt = `אתה מתכנן לו"ז שבועי אישי. תפקידך ליצור לו"ז שמותאם בדיוק לסטודנט הזה — לא תבנית גנרית.

━━━ פרופיל סטודנט ━━━
שם: ${S.userName} | שעות פעילות: ${S.wakeTime}–${S.sleepTime}
קורסים: ${courseConfig}
תחביבים: ${hobbyLines}
עדיפות שבוע זה: ${priorityNote}
${urgentNote}

━━━ כללים מבוססי פרופיל ותשובות הסטודנט ━━━
${rules.map((r,i)=>`${i+1}. ${r}`).join('\n')}

━━━ התאמות לפי ביצועי שבוע שעבר ━━━
${courseAdj}

━━━ כמה חומר נשאר בכל קורס ━━━
${matInfo}

━━━ מבחנים קרובים ━━━
${exams.map(e=>`${e.c}: ${e.days} ימים (${e.d})`).join(' | ')||'אין'}
מבחן בפחות מ-5 ימים → 60% מהזמן לקורס הזה

━━━ עוגנים חסומים (כולל זמני נסיעה — אסור בהחלט לשבץ כאן!) ━━━
${slots.anchorDetails || 'אין עוגנים'}

━━━ חלונות זמן פנויים (${range.label}: ${range.start}–${range.end}) ━━━
שים לב: הזמנים הפנויים כבר מחושבים אחרי הוצאת עוגנים ונסיעות!
${slots.text||'אין זמנים פנויים'}

━━━ הנחיות ביצוע ━━━
• שבץ משימות רק בתוך חלונות הזמן הפנויים למעלה — לא מחוצה להם!
• משך כל משימה: ${Math.max(20,taskDuration-15)}–${taskDuration+20} דק' (לא חייב אחיד — התאם לקורס)
• השאר לפחות 10 דק' הפסקה בין משימות
• ${tMin}–${tMax} משימות ביום מקסימום
• גוון שמות (לא "לימוד — X" שוב ושוב)
• לא יותר מ-2 משימות לאותו קורס ביום
• פזר על כל הימים

החזר JSON בלבד:
{"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"שם","name":"שם משימה","duration":"X דק'","priority":"גבוה|בינוני|נמוך"},...]}
`;

  try {
    const ans = await callAI({ messages:[{role:'user',content:prompt}], temperature:0.3, json:true });
    const parsed = JSON.parse(ans.match(/\{[\s\S]*\}/)[0]);
    if (!parsed.tasks?.length) throw new Error('ריק');
    const validTasks = parsed.tasks.filter(t => {
      if (!t.date || !t.time) return false;
      if (t.date < range.start || t.date > range.end) return false;
      const dur = parseInt((t.duration||String(taskDuration)).match(/\d+/)?.[0]||taskDuration);
      return isTimeInFreeWindow(t.date, t.time, dur);
    });
    if (!validTasks.length) throw new Error('כל המשימות חופפות עם עוגנים — נסה שוב');
    const removed = parsed.tasks.length - validTasks.length;
    if (removed > 0) _wrMsg(`⚠️ ${removed} משימות הוסרו כי חפפו עם עוגנים`);
    _wr.pendingPlan = validTasks;
    _wrShowPreview(validTasks);
  } catch(e) {
    _wrMsg(`שגיאה: ${e.message}. <button class="wr-btn-inline" onclick="_wrGenerate()">נסה שוב</button>`);
  }
}

function _wrInit() {
  const today = ld(new Date());
  const hobbyNames = new Set((S.hobbies||[]).map(h=>h.name));
  const firstWeek = _isFirstWeek();

  // Source of truth: only courses defined in the AI planner (S.courses)
  const coursesLastWeek = [...new Set(
    (S.courses || []).map(c => c.name).filter(n => n && !hobbyNames.has(n))
  )];
  const activeHobbies = S.hobbies || [];

  // Build question queue
  const qs = [];
  if (!firstWeek) {
    // Only ask "last week" questions for returning users
    coursesLastWeek.forEach(c => {
      qs.push({ type:'course_u', c });
      qs.push({ type:'course_cov', c });
      qs.push({ type:'course_mat', c });
    });
    activeHobbies.forEach(h => qs.push({ type:'hobby', h }));
    qs.push({ type:'load' });
  }
  qs.push({ type:'goal' });
  if (coursesLastWeek.length + activeHobbies.length > 1)
    qs.push({ type:'priority', items:[...coursesLastWeek, ...activeHobbies.map(h=>h.name)] });

  _wr = { qs, qi: 0, answers: { courses:{}, hobbies:{}, load:null, goal:null, priority:null },
    coursesLastWeek, activeHobbies, pendingPlan: null };

  document.getElementById('wr-msgs').innerHTML = '';
  document.getElementById('wr-choices').innerHTML = '';
  document.getElementById('wr-choices').classList.add('hidden');
  document.getElementById('wr-result').classList.add('hidden');
  _wrProg(0);

  const range = _wrGetTargetRange();
  if (firstWeek) {
    _wrMsg(`שלום ${S.userName}! 🎉\nברוך הבא — נבנה יחד את לוז השבוע הראשון שלך (${range.start} – ${range.end}).\nכמה שאלות קצרות ומתחילים!`);
  } else {
    const lastWS = _weekStart(-1); const thisWS = _weekStart(0);
    const doneCount = S.tasks.filter(t => t.date >= lastWS && t.date < thisWS && t.done).length;
    const totalCount = S.tasks.filter(t => t.date >= lastWS && t.date < thisWS).length;
    _wrMsg(totalCount > 0
      ? `שלום ${S.userName}! 🌅\nהשבוע שעבר: ${doneCount}/${totalCount} משימות הושלמו.\nנבנה תוכנית ל${range.label} (${range.start} – ${range.end}).`
      : `שלום ${S.userName}! 🌅\nזמן לתכנן את ${range.label} (${range.start} – ${range.end}).`
    );
  }
  setTimeout(() => _wrNext(), 700);
}

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

function _wrChoices(opts, multi = false) {
  const wrap = document.getElementById('wr-choices');
  if (!wrap) return;
  wrap.classList.remove('hidden');
  if (multi) {
    wrap.innerHTML = opts.map(o =>
      `<button class="wr-btn wr-btn-multi" data-v="${o.v}" onclick="_wrToggleMulti(this)">${o.l}</button>`
    ).join('') +
      `<button class="wr-btn wr-btn-confirm" onclick="_wrConfirmMulti()" style="margin-top:0.4rem;background:var(--accent);color:white;font-weight:800">✓ אשר בחירה</button>`;
  } else {
    wrap.innerHTML = opts.map(o =>
      `<button class="wr-btn" onclick="_wrAnswer('${o.v}','${o.l.replace(/'/g,"")}')">${o.l}</button>`
    ).join('');
  }
}

function _wrToggleMulti(btn) {
  btn.classList.toggle('sel');
}

function _wrConfirmMulti() {
  const wrap = document.getElementById('wr-choices');
  const selected = [...wrap.querySelectorAll('.wr-btn-multi.sel')].map(b => b.dataset.v);
  if (!selected.length) { toast('בחר לפחות פריט אחד'); return; }
  const label = selected.join(', ');
  wrap.querySelectorAll('button').forEach(b=>b.disabled=true);
  _wrMsg(label, true);
  wrap.classList.add('hidden');
  const q = _wr.qs[_wr.qi];
  if (q.type === 'priority') _wr.answers.priority = selected.join(', ');
  _wr.qi++;
  _wrProg(_wr.qi + 1);
  setTimeout(() => _wrNext(), 350);
}

function _wrAnswer(v, l) {
  document.getElementById('wr-choices').querySelectorAll('button').forEach(b=>b.disabled=true);
  _wrMsg(l, true);
  document.getElementById('wr-choices').classList.add('hidden');

  const q = _wr.qs[_wr.qi];
  if (q.type === 'course_u')   { if(!_wr.answers.courses[q.c])_wr.answers.courses[q.c]={}; _wr.answers.courses[q.c].u=v; }
  if (q.type === 'course_cov') { if(!_wr.answers.courses[q.c])_wr.answers.courses[q.c]={}; _wr.answers.courses[q.c].cov=v; }
  if (q.type === 'course_mat') { if(!_wr.answers.courses[q.c])_wr.answers.courses[q.c]={}; _wr.answers.courses[q.c].mat=v; }
  if (q.type === 'hobby')      { _wr.answers.hobbies[q.h.name]=v; }
  if (q.type === 'load')       { _wr.answers.load=v; }
  if (q.type === 'goal')       { _wr.answers.goal=v; }
  if (q.type === 'priority')   { _wr.answers.priority=v; }

  _wr.qi++;
  _wrProg(_wr.qi + 1);
  setTimeout(() => _wrNext(), 350);
}

function _wrNext() {
  if (_wr.qi >= _wr.qs.length) { _wrGenerate(); return; }
  const q = _wr.qs[_wr.qi];

  if (q.type === 'course_u') {
    _wrMsg(`📚 <b>${q.c}</b> — איך היה החומר השבוע?`);
    _wrChoices([{v:'good',l:'✅ הבנתי טוב'},{v:'ok',l:'😐 בסדר'},{v:'hard',l:'❌ קשה לי'}]);
  } else if (q.type === 'course_cov') {
    _wrMsg(`כמה מהחומר של <b>${q.c}</b> הספקת לכסות שבוע שעבר?`);
    _wrChoices([{v:'all',l:'📗 הכל'},{v:'some',l:'📙 כחצי'},{v:'little',l:'📕 מעט'}]);
  } else if (q.type === 'course_mat') {
    _wrMsg(`🗂 כמה חומר עוד <b>נשאר</b> לך ב-<b>${q.c}</b> עד המבחן?`);
    _wrChoices([{v:'lots',l:'📚 הרבה — עוד לא כיסיתי הרבה'},{v:'some',l:'📗 בינוני — נשאר חלק'},{v:'little',l:'✅ מעט — כמעט סיימתי'}]);
  } else if (q.type === 'hobby') {
    const planned = q.h.timesPerWeek||3;
    _wrMsg(`🎯 <b>${q.h.name}</b> — הגעת ל-${planned} פגישות השבוע?`);
    _wrChoices([{v:'all',l:`✅ כולן (${planned})`},{v:'partial',l:'😐 חלקן'},{v:'none',l:'❌ לא הצלחתי'}]);
  } else if (q.type === 'load') {
    _wrMsg('⚖️ איך היה העומס השבוע שעבר?\n(זה ישפיע על התאמת הזמן לכל קורס)');
    _wrChoices([{v:'heavy',l:'😤 כבד מדי'},{v:'ok',l:'😊 מאוזן'},{v:'light',l:'😴 קל'}]);
  } else if (q.type === 'goal') {
    const span = S.profile?.focus_span || '';
    const canDouble = span.includes('25') || span.includes('40') || span.includes('30') || span.includes('45');
    const doubleNote = canDouble ? '\nבמצב מקסימום: 2 בלוקים + 10 דק\' מנוחה ביניהם' : '';
    _wrMsg(`💪 כמה אתה רוצה ללמוד השבוע הקרוב?${doubleNote}`);
    _wrChoices([
      {v:'min', l:'🎯 מינימום — רק מה שחייב'},
      {v:'ok',  l:'📚 בינוני — קצב רגוע'},
      {v:'max', l:'🔥 מקסימום — ניצול מלא'}
    ]);
  } else if (q.type === 'priority') {
    _wrMsg('🎯 מה הכי חשוב לשבוע הקרוב? (אפשר לבחור כמה)');
    _wrChoices([...q.items.slice(0,5).map(n=>({v:n,l:n})),{v:'balanced',l:'⚖️ איזון שווה'}], true);
  }
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
  rules.push(`📊 כמות ביום: ${tMin}–${tMax} משימות לימוד (לא יותר מ-${tMax}!)`);
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
      rules.push('🌤 פיק: 14:00–16:00 → קורסים קשים | בוקר → חזרות וחומר קל');
    } else if (p.focus_time.match(/ערב|17|18|19|20/)) {
      peakSlots = ['18:00','19:00']; offPeakSlots = ['08:00','09:00','14:00'];
      rules.push('🌙 פיק: 18:00–19:00 → קורסים קשים | בוקר → חומר קל בלבד');
    }
  }

  // ── 4. LEARNING STYLE → task types ──
  let taskTypes = ['לימוד — [קורס]','חזרה — [קורס]'];
  if (p.style) {
    if (p.style.match(/תרגיל|פתרון|🔧/)) {
      taskTypes = ['פתרון תרגילים — [קורס]','תרגול שאלות — [קורס]','חזרה על תרגילים — [קורס]'];
      rules.push('📝 שמות: "פתרון תרגילים / תרגול שאלות / חזרה על תרגילים"');
    } else if (p.style.match(/קריאה|סיכום|📝/)) {
      taskTypes = ['קריאה וסיכום — [קורס]','עיון בחומר — [קורס]','סיכום פרק — [קורס]'];
      rules.push('📖 שמות: "קריאה וסיכום / עיון בחומר / סיכום פרק"');
    } else if (p.style.match(/האזנה|וידאו|🎧/)) {
      taskTypes = ['צפייה בהרצאה — [קורס]','האזנה וסיכום — [קורס]','סיכום הרצאה — [קורס]'];
      rules.push('🎧 שמות: "צפייה בהרצאה / האזנה וסיכום / סיכום הרצאה"');
    } else if (p.style.match(/הסבר|👥/)) {
      taskTypes = ['הסבר לעצמי — [קורס]','שאלות עצמיות — [קורס]','הרצאה עצמית — [קורס]'];
      rules.push('👥 שמות: "הסבר לעצמי / שאלות עצמיות / הרצאה עצמית"');
    }
  }

  // ── 5. EXAM FEAR → extra task types ──
  if (p.exam_fear) {
    if (p.exam_fear.match(/לשכוח|לחץ|😰/)) {
      taskTypes.push('חזרה מרווחת — [קורס]');
      rules.push('🔁 חשש שכחה: כל 2 משימות רגילות → הוסף "חזרה מרווחת — [קורס]"');
    } else if (p.exam_fear.match(/לסיים|⏰/)) {
      rules.push('📋 חשש לא לסיים: כסה חומר ליניארית (פרק 1→2→3), לא לדלג לחזרות לפני שסיימת החומר');
    } else if (p.exam_fear.match(/מפתיע|שאלות|❓/)) {
      taskTypes.push('פתרון מבחנים ישנים — [קורס]');
      rules.push('❓ חשש שאלות מפתיעות: כל 3 משימות → "פתרון מבחנים ישנים — [קורס]"');
    } else if (p.exam_fear.match(/להבין|🤔/)) {
      taskTypes.push('הסבר בקול — [קורס]');
      rules.push('🧠 חשש הבנה: לקורסים קשים הוסף "הסבר בקול — [קורס]" פעם בשבוע');
    }
  }

  return { rules, taskDuration, tMin, tMax, peakSlots, offPeakSlots, taskTypes };
}

function _buildCourseAdjustments(answers) {
  return Object.entries(answers.courses || {}).map(([c, a]) => {
    const u = a.u; const cov = a.cov; const mat = a.mat;
    let line = '';
    if      (u === 'hard'  && cov === 'little') line = `🚨 ${c}: 3-4 משימות השבוע, שים בשעות פיק, התחל מבסיסים`;
    else if (u === 'hard'  && cov === 'some')   line = `⚠️ ${c}: +40% משימות, חזרה על מה שלא ברור, שעות פיק`;
    else if (u === 'hard'  && cov === 'all')    line = `🔁 ${c}: חומר מכוסה אבל קשה — חזרות ותרגול בלבד`;
    else if (u === 'ok'    && cov === 'little') line = `📚 ${c}: כסה פרקים חסרים תחילה, +20% משימות`;
    else if (u === 'ok'    && cov === 'some')   line = `📊 ${c}: קצב רגיל`;
    else if (u === 'ok'    && cov === 'all')    line = `✅ ${c}: מכוסה — חזרות תחזוקה בלבד, -10% משימות`;
    else if (u === 'good'  && cov === 'little') line = `📖 ${c}: מרגיש טוב אך לא כיסה — כסה חומר חדש, לא חזרות`;
    else if (u === 'good'  && cov === 'some')   line = `👍 ${c}: מסתדר — -20% משימות`;
    else if (u === 'good'  && cov === 'all')    line = `🏆 ${c}: שולט — 1-2 משימות תחזוקה בלבד`;
    if (!line) return null;
    if (mat === 'lots')   line += ' | חומר שנשאר: הרבה → לחץ על כיסוי חומר חדש';
    else if (mat === 'little') line += ' | חומר שנשאר: מעט → עבור לחזרות ותרגול';
    return `• ${line}`;
  }).filter(Boolean).join('\n') || '• תכנון סטנדרטי';
}

function _wrShowPreview(tasks) {
  const prev = document.getElementById('wr-preview');
  if (!prev) return;
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const byDate = {};
  tasks.forEach(t => { if(!byDate[t.date]) byDate[t.date]=[]; byDate[t.date].push(t); });
  prev.innerHTML = Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,ts]) => {
    const dow = days[new Date(date+'T12:00').getDay()];
    return `<div class="wr-day-group">
      <div class="wr-day-label">${dow} · ${date}</div>
      ${ts.map(t=>`<div class="wr-task-row">
        <span class="wr-task-time">${t.time}</span>
        <span class="wr-task-name">${t.name}</span>
        <span class="wr-task-course">${t.course}</span>
        <span class="wr-task-dur">${t.duration}</span>
      </div>`).join('')}
    </div>`;
  }).join('');
  document.getElementById('wr-result').classList.remove('hidden');
  document.getElementById('wr-result').scrollIntoView({behavior:'smooth'});
}

function confirmWeeklyPlan() {
  try {
  if (!_wr?.pendingPlan?.length) { toast('לא נמצאה תוכנית לאישור'); return; }
  const range = _wrGetTargetRange();
  const today = ld(new Date());
  // Remove undone tasks only within the target range
  S.tasks = S.tasks.filter(t => !(t.date >= range.start && t.date <= range.end && !t.done && !t.missed));
  // Add new plan
  _wr.pendingPlan.forEach(t => S.tasks.push({...t, id:uid(), done:false, missed:false}));
  // Record review
  if (!S.weeklyReview) S.weeklyReview = { lastReviewDate:null, history:[] };
  S.weeklyReview.lastReviewDate = today;
  S.weeklyReview.history = [...(S.weeklyReview.history||[]).slice(-10),
    { date:today, answers:_wr.answers, added:_wr.pendingPlan.length }];
  save(); renderAll();
  toast(`✅ ${range.label} תוכנן! ${_wr.pendingPlan.length} משימות נוספו ללו"ז`);
  renderWeeklyReview();
  } catch(e) { toast('שגיאה: ' + e.message); console.error('confirmWeeklyPlan error:', e); }
}

async function sendRecalc() {
  const inp = document.getElementById('recalc-input'); const msg = inp.value.trim(); if(!msg) return; inp.value = '';
  const chat = document.getElementById('recalc-chat');
  chat.innerHTML += `<div class="chat-msg user"><div class="chat-bubble">${msg}</div></div><div class="chat-msg ai" id="recalc-loading"><div class="chat-bubble"><span class="ai-thinking">מחשב אופטימיזציה...</span></div></div>`;
  chat.scrollTop = chat.scrollHeight;

  recalcHistory.push({role: 'user', content: msg});
  if(recalcHistory.length > 15) recalcHistory = [recalcHistory[0], ...recalcHistory.slice(-14)];

  const todayStr = ld(new Date());
  const examsTxt = S.exams.map(e => `${e.course}: ${e.date}`).join(', ');
  
  const ruleReminder = `היום: ${todayStr}. מבחנים: ${examsTxt||'אין'}. אתה עונה ב-JSON בלבד! פורמט: {"reply":"הטקסט שלך","actions":{"add":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"שם","name":"יצירתי","duration":"60 דק'","priority":"בינוני"}],"delete":["ID"],"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}]}}`;

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
    chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${(parsed.reply||'').replace(/\n/g,'<br>')}</div></div>`;
    if(parsed.actions && Array.isArray(parsed.actions.add) && parsed.actions.add.length > 0) {
        pendingRecalcActions = parsed.actions.add;
        const addList = parsed.actions.add.map(t => `• <b>${t.name||'משימה'}</b> — ${t.date||''} ${t.time||''}`).join('<br>');
        const cid = 'rc-' + Date.now();
        chat.innerHTML += `<div class="chat-msg ai" id="${cid}"><div class="chat-bubble" style="background:linear-gradient(135deg,var(--green-light),var(--accent-light));border:2px solid var(--green);padding:1rem 1.1rem;border-radius:14px">
            📅 <b>הצעה להוספה ללו"ז:</b><br><br>${addList}<br><br>
            <div style="display:flex;gap:0.5rem;margin-top:0.75rem;justify-content:flex-end;flex-wrap:wrap">
                <button onclick="document.getElementById('${cid}').remove();pendingRecalcActions=null;toast('הצעה נדחתה ❌')" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:0.4rem 0.9rem;border-radius:8px;font-weight:700;cursor:pointer;font-family:var(--sans);font-size:0.82rem">✗ בטל</button>
                <button onclick="applyPendingRecalcActions('${cid}')" style="background:var(--green);color:white;border:none;padding:0.4rem 0.9rem;border-radius:8px;font-weight:700;cursor:pointer;font-family:var(--sans);font-size:0.82rem">✓ הוסף ללו"ז</button>
            </div>
        </div></div>`;
    } else if(updated) {
        toast('🚨 הלו"ז תוקן וסודר על ידי ה-AI!');
    }
    chat.scrollTop = chat.scrollHeight;
  } catch(e) {
    document.getElementById('recalc-loading')?.remove();
    const errMsg = e.message?.includes('API Key') ? `⚠️ ${e.message}`
      : e.message?.includes('429') ? '⚠️ חריגת מגבלת API — נסה שוב בעוד דקה'
      : e.message?.includes('401') ? '⚠️ מפתח API לא תקין — עדכן בהגדרות'
      : 'שגיאת תקשורת — נסה לנסח מחדש';
    chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble" style="color:var(--red)">${errMsg}</div></div>`;
    console.error(e);
  }
}

// ── OMNIBOX (MAGIC INPUT + VOICE) ──
function startVoiceMagic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast('הדפדפן לא תומך בזיהוי קולי 😔'); return; }
    const recognition = new SpeechRecognition(); recognition.lang = 'he-IL'; recognition.interimResults = false; 
    const btn = document.getElementById('btn-voice-magic'); const inp = document.getElementById('magic-input'); const originalPlaceholder = inp.placeholder;
    recognition.onstart = function() { btn.style.animation = 'blink 1s infinite'; inp.placeholder = '🎙️ מקשיב...'; toast('מקשיב...'); };
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

📅 היום: ${todayStr} (${dn2[today.getDay()]}) | מחר: ${ld(tomorrow)}
📋 משימות היום (${todayTasks.length}): ${JSON.stringify(todayTasks.map(t=>({time:t.time,name:t.name,course:t.course,done:t.done,missed:t.missed})))}
📚 משימות 7 ימים קדימה (${upcomingTasks.length}): ${JSON.stringify(upcomingTasks.map(t=>({date:t.date,time:t.time,name:t.name,course:t.course})))}
📝 מבחנים: ${JSON.stringify(sortedExams.map(e=>({course:e.course,date:e.date,daysLeft:Math.max(0,Math.ceil((new Date(e.date)-today)/86400000))})))||'אין'}
⚓ עוגנים: ${anchorsSummary}
📊 סטטוס: ${S.streak||0} ימי רצף 🔥 | ${S.points||0} נקודות | ${totalDone}/${totalTasks} משימות הושלמו | ${missedCount} פוספסו
👤 פרופיל: ${JSON.stringify(S.profile)||'{}'}

יכולות Oracle:
• עונה על כל שאלה על הלו"ז — "מה יש לי מחר?", "מתי המבחן הבא?"
• מנתח התקדמות — "איך אני עומד בחשבון?", "מה פספסתי השבוע?"
• מסביר את האפליקציה — "איך מוסיפים עוגן?", "מה זה מצב קראנץ׳?"
• מייעץ על שיטות למידה — "כיצד אני יכול לשפר את הציון?", "מה Spaced Repetition?"
• מוסיף פריטים בפקודה טבעית

מדריך האפליקציה (ענה על שאלות):
• ✨ מתכנן AI: כנס לטאב "מתכנן AI חכם" → הזן קורס, תאריך מבחן, שעות/שבוע → "צור תוכנית"
• ⚓ עוגנים: כנס ל"עוגנים קבועים" → "הוסף עוגן" → שם, יום, שעות, זמן נסיעה
• 📝 מבחנים: כנס ל"מעקב מבחנים" → הוסף קורס + תאריך → לחץ על המבחן לדשבורד
• 🔥 קראנץ׳: בדשבורד המבחן → כפתור "קראנץ׳" → מוסיף 3-4 ימי תרגול אינטנסיבי
• ⏱️ Pomodoro: בדף הבית → בחר משימה → "התחל" — 90 דקות ריכוז
• 🧠 מורה AI: ליד כל משימה ← לחץ "תרגל" לשיעור סוקרטי
• 🧠 תמיכה נפשית: בסרגל הצד — שיחה עם מאמן פסיכולוגי
• 🗓️ לו"ז שבועי: בטאב "לו"ז שבועי" → כפתור "תצוגת לוח" לגרף
• יועץ לו"ז AI: בכל דף → כפתור "יועץ AI" לסידור מחדש

חוקי תגובה (JSON בלבד):
- שאלות/ייעוץ/הסבר: {"type":"chat","reply":"HTML עשיר בעברית (2-4 משפטים)"}
- הוסף עוגן: {"type":"anchor","name":"...","day":N,"start":"HH:MM","end":"HH:MM","travelMin":0} (day: 0=ראשון...6=שבת)
- הוסף מבחן: {"type":"exam","course":"...","date":"YYYY-MM-DD"}
- הוסף משימה: {"type":"task","name":"...","course":"...","date":"YYYY-MM-DD","time":"HH:MM"} (time מתוך: 08:00,09:00,10:00,11:00,12:00,13:00,14:00,15:00,16:00,17:00,18:00,19:00,20:00)
- המר "מחר"/"מחרתיים"/"ביום X" לתאריכים מדויקים
- "מ-2 עד 4" = 14:00 עד 16:00`;

  // Trim history to last 12 turns + system
  if (assistantHistory.length > 24) assistantHistory = assistantHistory.slice(-24);

  // Show typing indicator
  appendAssistantMsg('ai', '<span class="ai-thinking">חושב...</span>');
  const loadingEl = document.getElementById('assistant-chat-history')?.lastElementChild;

  try {
    const messages = [{role:'system', content: systemPrompt}, ...assistantHistory, {role:'user', content: val}];
    const _content4 = await callAI({ messages, temperature: 0.3, json: true });
    const parsed = extractJSON(_content4);
    loadingEl?.remove();

    assistantHistory.push({role:'user', content: val});

    if (parsed.type === 'chat') {
      appendAssistantMsg('ai', parsed.reply || '...');
      assistantHistory.push({role:'assistant', content: parsed.reply || ''});

    } else if (parsed.type === 'anchor') {
      const dayNum = parsed.day !== undefined ? parseInt(parsed.day) : new Date().getDay();
      const newAnchor = { id:uid(), name: parsed.name||'עוגן', day: dayNum, start: parsed.start||'09:00', end: parsed.end||'10:00', travelMin: parseInt(parsed.travelMin)||0, color: '#f5a623' };
      if(!Array.isArray(S.anchors)) S.anchors=[];
      S.anchors.push(newAnchor);
      const ast = parseInt((newAnchor.start).split(':')[0])*60 + parseInt((newAnchor.start).split(':')[1]);
      const aen = parseInt((newAnchor.end).split(':')[0])*60 + parseInt((newAnchor.end).split(':')[1]);
      let collidedTasks = [];
      S.tasks = S.tasks.filter(t => { if (new Date(t.date).getDay()===dayNum&&!t.done&&!t.missed){const tst=parseInt((t.time||'00:00').split(':')[0])*60+parseInt((t.time||'00:00').split(':')[1]);const ten=tst+90;if(tst<aen&&ten>ast){collidedTasks.push(t);return false;}} return true; });
      save(); renderAll();
      const confirmMsg = `✅ עוגן "<b>${newAnchor.name}</b>" נוסף ביום ${dn2[dayNum]}, ${newAnchor.start}–${newAnchor.end}.${collidedTasks.length ? ` ⚠️ ${collidedTasks.length} משימות הוזזו.` : ''}`;
      appendAssistantMsg('ai', confirmMsg);
      assistantHistory.push({role:'assistant', content: confirmMsg});
      if (collidedTasks.length) openRecalcForCollision(newAnchor, collidedTasks);

    } else if (parsed.type === 'exam') {
      if (!S.exams.find(e => e.course === parsed.course && e.date === parsed.date)) {
        S.exams.push({id:uid(), course: parsed.course, date: parsed.date, type:'מבחן', conf:3, readyPct:0, createdDate: ld(new Date())});
        save(); renderAll();
        const confirmMsg = `✅ מבחן ב-<b>${parsed.course}</b> נוסף ל-${parsed.date}.`;
        appendAssistantMsg('ai', confirmMsg);
        assistantHistory.push({role:'assistant', content: confirmMsg});
      } else {
        const msg = `⚠️ מבחן ב-<b>${parsed.course}</b> כבר קיים!`;
        appendAssistantMsg('ai', msg);
        assistantHistory.push({role:'assistant', content: msg});
      }
    } else if (parsed.type === 'task') {
      const validTimes = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
      const taskTime = validTimes.includes(parsed.time) ? parsed.time : '09:00';
      const newTask = {id:uid(), name:parsed.name||'משימה', course:parsed.course||'', date:parsed.date||todayStr, time:taskTime, duration:"90 דק'", priority:'בינוני', done:false, missed:false};
      S.tasks.push(newTask); save(); renderAll();
      const confirmMsg = `✅ משימה "<b>${newTask.name}</b>" נוספה ל-${newTask.date} בשעה ${taskTime}.`;
      appendAssistantMsg('ai', confirmMsg);
      assistantHistory.push({role:'assistant', content: confirmMsg});
    } else {
      const fallback = parsed.reply || JSON.stringify(parsed);
      appendAssistantMsg('ai', fallback);
      assistantHistory.push({role:'assistant', content: fallback});
    }
  } catch(e) {
    loadingEl?.remove();
    appendAssistantMsg('ai', `<span style="color:var(--red)">שגיאה: ${e.message}</span>`);
  }
  btn.disabled = false; btn.textContent = 'שאל ▶';
}

// ── AI TUTOR (SOCRATIC LEARNING) ──
function startTutor(id) {
    const t = S.tasks.find(x => String(x.id) === String(id)); if(!t) return; currentTutorTask = t;
    document.getElementById('tutor-title').textContent = `🧠 ${t.name}`; document.getElementById('tutor-subtitle').textContent = `קורס: ${t.course} | זמן מוקצב: ${t.duration}`;
    document.getElementById('tutor-doc-text').value = '';
    document.getElementById('tutor-chat').innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">אהלן! פתחנו שולחן נקי כדי להתרכז ב-"<b>${t.name}</b>".<br><br>הדבק חומר בצד ימין, או פשוט תגיד לי מאיפה מתחילים. (אני לא מגלה תשובות, אנחנו פותרים ביחד!)</div></div>`;
    tutorHistory = []; document.getElementById('tutor-overlay').classList.remove('hidden');
}
function closeTutor() { document.getElementById('tutor-overlay').classList.add('hidden'); currentTutorTask = null; }
async function sendTutor() {
    const inp = document.getElementById('tutor-input'); const msg = inp.value.trim(); if(!msg) return; inp.value = '';
    const chat = document.getElementById('tutor-chat'); const docText = document.getElementById('tutor-doc-text').value.trim();
    chat.innerHTML += `<div class="chat-msg user"><div class="chat-bubble">${msg}</div></div><div class="chat-msg ai" id="tutor-loading"><div class="chat-bubble"><span class="ai-thinking">קורא...</span></div></div>`;
    chat.scrollTop = chat.scrollHeight;
    tutorHistory.push({role: 'user', content: msg}); if(tutorHistory.length > 15) tutorHistory = tutorHistory.slice(-15);
    const sysPrompt = `אתה מורה פרטי סוקרטי. קורס: "${currentTutorTask?.course||''}". נושא: "${currentTutorTask?.name}". חומר רקע: """${docText}""".
חוקי ברזל: (1) לעולם אל תיתן תשובה סופית — שאל שאלות מנחות. (2) כוון לבנות הבנה עצמאית, לא לשנן. (3) לאחר כל תגובה, סיים עם: 💡 לפי שיטת החזרה המרווחת — חזור על נושא זה בעוד 24 שעות, 3 ימים ו-7 ימים לזכירה מרבית. (4) דבר ישיר ותכלסי בעברית.`;
    try {
        const ans = await callAI({ messages: [{role:'system', content:sysPrompt}, ...tutorHistory], temperature: 0.6 });
        tutorHistory.push({role: 'assistant', content: ans});
        document.getElementById('tutor-loading').remove(); chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${ans.replace(/\n/g,'<br>')}</div></div>`; chat.scrollTop = chat.scrollHeight;
    } catch(e) { document.getElementById('tutor-loading')?.remove(); chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble" style="color:var(--red)">שגיאה</div></div>`; }
}

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
  document.getElementById('fl-task-name').textContent = taskName || (mode === 'break' ? '☕ זמן הפסקה' : 'מפגש ריכוז');
  document.getElementById('fl-mode-badge').textContent = mode === 'break' ? '☕ הפסקה' : '🔥 מצב פוקוס';
  document.getElementById('fl-timer-label').textContent = mode === 'break' ? 'דקות הפסקה' : 'דקות ריכוז';
  document.getElementById('fl-breathing-icon').textContent = mode === 'break' ? '☕' : '🧘';

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

  // Prevent back/swipe navigation
  history.pushState({ focusLock: true }, '');
  window.addEventListener('popstate', _flPopState, { once: true });
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
  else if (ops === '-') { FL.challengeAnswer = FL.challengeA - FL.challengeB; }
  else { FL.challengeA = Math.floor(Math.random() * 12) + 2; FL.challengeB = Math.floor(Math.random() * 12) + 2; FL.challengeAnswer = FL.challengeA * FL.challengeB; }
  document.getElementById('fl-challenge-q').textContent = `${FL.challengeA} ${ops} ${FL.challengeB} = ?`;
  document.getElementById('fl-challenge-ans').value = '';
  document.getElementById('fl-challenge-err').classList.add('hidden');
  document.getElementById('fl-challenge').classList.add('visible');
  setTimeout(() => document.getElementById('fl-challenge-ans')?.focus(), 100);
}

function focusLockHideChallenge() {
  document.getElementById('fl-challenge').classList.remove('visible');
}

function focusLockCheckAnswer() {
  const ans = parseInt(document.getElementById('fl-challenge-ans').value);
  if (ans === FL.challengeAnswer) {
    focusLockHideChallenge();
    focusLockClose();
    // Stop pomo if running
    pomoPause();
    toast('יצאת ממצב פוקוס — חזור בקרוב! 💪');
  } else {
    const err = document.getElementById('fl-challenge-err');
    err.classList.remove('hidden');
    err.textContent = '❌ לא נכון — נסה שוב! הרמז: ' + (ans > FL.challengeAnswer ? 'פחות' : 'יותר');
    document.getElementById('fl-challenge-ans').value = '';
    document.getElementById('fl-challenge-ans').focus();
    // Shake animation
    const card = document.querySelector('.fl-challenge-card');
    card.style.animation = 'none';
    setTimeout(() => { card.style.animation = ''; }, 10);
  }
}

function openFocusMode() {
  pomoStart();
}

let isMonthViewOpen = false;
function toggleCalendarViewModal() {
  const weekly = document.getElementById('schedule-weekly-view');
  const monthly = document.getElementById('schedule-monthly-view');
  const weekLabelEl = document.getElementById('week-label');
  
  isMonthViewOpen = !isMonthViewOpen;
  if (isMonthViewOpen) {
    weekly.classList.remove('zoom-active');
    weekly.classList.add('zoom-out-down');
    monthly.classList.remove('zoom-out-up');
    monthly.classList.add('zoom-active');
    
    // Set initial month based on currently viewed week
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + S.weekOffset * 7);
    calMonth = d.getMonth();
    calYear = d.getFullYear();
    if(weekLabelEl) weekLabelEl.textContent = 'חזרה ללו"ז שבועי';
    renderMonthCalendar();
  } else {
    monthly.classList.remove('zoom-active');
    monthly.classList.add('zoom-out-up');
    weekly.classList.remove('zoom-out-down');
    weekly.classList.add('zoom-active');
    renderSchedule();
  }
}

// Action Sheet Logic
function openTaskActionSheet(taskId) {
  const t = S.tasks.find(x => String(x.id) === String(taskId));
  if (!t) return;
  document.getElementById('task-action-title').textContent = t.name;
  
  let opts = '';
  if (!t.done && !t.missed) {
    opts += `<button class="action-btn green-btn" onclick="doneTask('${t.id}');closeTaskActionSheet()"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> סיום משימה</button>`;
    opts += `<button class="action-btn" onclick="startTutor('${t.id}');closeTaskActionSheet()"><svg viewBox="0 0 24 24"><path d="M9 12h.01M15 12h.01M12 2a8 8 0 0 0-8 8c0 1.5.5 3 1.4 4.2L4 22l4-1.5c1.2.7 2.6 1.1 4 1.1a8 8 0 0 0 8-8c0-4.4-3.6-8-8-8z"></path></svg> צ'אט AI בנושא</button>`;
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