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
  document.getElementById('tab-signin').style.background = isSignup ? 'transparent' : '#4f6ef7';
  document.getElementById('tab-signin').style.color = isSignup ? '#64748b' : 'white';
  document.getElementById('tab-signup').style.background = isSignup ? '#4f6ef7' : 'transparent';
  document.getElementById('tab-signup').style.color = isSignup ? 'white' : '#64748b';
  document.getElementById('confirm-pass-wrap').style.display = isSignup ? 'block' : 'none';
  document.getElementById('forgot-btn').style.display = isSignup ? 'none' : 'block';
  document.getElementById('auth-pass').autocomplete = isSignup ? 'new-password' : 'current-password';
  document.getElementById('auth-submit-btn').textContent = isSignup ? 'יצירת חשבון' : 'כניסה';
  document.getElementById('auth-msg').textContent = '';
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
  el.style.color = isError ? '#f43f5e' : '#16c98d';
}

function authSetLoading(loading) {
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = loading;
  btn.textContent = loading ? '...' : (_authMode === 'signup' ? 'יצירת חשבון' : 'כניסה');
  btn.style.opacity = loading ? '0.7' : '1';
}

// ── AUTH ACTIONS ──
async function checkAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    document.getElementById('auth-overlay').style.display = 'none';
    return true;
  }
  document.getElementById('auth-overlay').style.display = 'flex';
  return false;
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
    document.getElementById("auth-overlay").style.display = "none";
  } else {
    currentUser = null;
    document.getElementById("auth-overlay").style.display = "flex";
  }
});

﻿// ── SUPABASE INIT ──
const SUPABASE_URL = 'https://cysywoaquuuteyxcxumz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5c3l3b2FxdXV1dGV5eGN4dW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzUyMjUsImV4cCI6MjA5MjQ1MTIyNX0.fnZbaYT2782XQpn6Bku5VkK-Xxmc9BwoA9e3bwjIibM';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;

// ── AUTH ──
async function checkAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    document.getElementById('auth-overlay').style.display = 'none';
    return true;
  }
  document.getElementById('auth-overlay').style.display = 'flex';
  return false;
}

async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) alert('שגיאה: ' + error.message);
}

async function signInWithEmail() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  if (!email || !pass) { alert('נא למלא אימייל וסיסמה'); return; }
  const btn = document.getElementById('auth-email-btn');
  btn.disabled = true; btn.textContent = '...מתחבר';
  let { error } = await db.auth.signInWithPassword({ email, password: pass });
  if (error && error.message.includes('Invalid login')) {
    const { error: signUpErr } = await db.auth.signUp({ email, password: pass });
    error = signUpErr;
    if (!signUpErr) {
      document.getElementById('auth-msg').textContent = 'נשלח אימייל אימות — בדוק את תיבת הדואר';
      btn.disabled = false; btn.textContent = 'כניסה / הרשמה';
      return;
    }
  }
  if (error) {
    document.getElementById('auth-msg').textContent = 'שגיאה: ' + error.message;
    btn.disabled = false; btn.textContent = 'כניסה / הרשמה';
    return;
  }
  const { data: { session } } = await db.auth.getSession();
  if (session) { currentUser = session.user; document.getElementById('auth-overlay').style.display = 'none'; }
}

async function signOut() {
  await db.auth.signOut();
  location.reload();
}

db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    currentUser = session.user;
    document.getElementById('auth-overlay').style.display = 'none';
  }
});

let S={apiKey:'',userName:'',institution:'',wakeTime:'08:00',sleepTime:'22:00',anchors:[],profile:{},tasks:[],exams:[],weekOffset:0,pendingPlan:[],points:0,streak:0,lastStudyDate:'',theme:'light'};
let selectedOpt=null, missedTaskId=null;
let currentChatMode = 'general';
let recalcHistory = [];
let currentTutorTask = null;
let tutorHistory = [];
let isGridView = false;
let pendingRecalcActions = null;
let psychHistory = [];
let assistantHistory = [];
let countdownInterval = null;

const PROFILE_QS=[
  {id:'focus_time',q:'באיזו שעה אתה הכי ממוקד?',opts:['🌅 בוקר (6-10)','☀️ צהריים (10-14)','🌇 אחה"צ (14-18)','🌙 ערב (18-23)']},
  {id:'focus_span',q:'כמה זמן אתה מצליח להתרכז ברצף?',opts:['⚡ 15-25 דקות','🎯 30-45 דקות','💪 60-75 דקות','🦾 90+ דקות']},
  {id:'style',q:'מה עוזר לך יותר ללמוד?',opts:['📦 בלוקים ארוכים','🎵 משימות קצרות ומהירות','🔁 חזרה לפני חדש','📖 קריאה ואחר כך תרגול']},
  {id:'exam_fear',q:'מה מפחיד אותך יותר לפני מבחן?',opts:['⏰ לא לסיים ללמוד','🧠 לא להבין לעומק','😬 לשכוח ברגע האמת','📊 טעויות בתרגילים']},
  {id:'env',q:'איפה סביבת הלמידה האידיאלית שלך?',opts:['🤫 ספרייה / שקט מוחלט','🎧 בחדר עם מוזיקה','☕ קפה / רעש לבן','🗣️ למידה עם חברים']},
  {id:'breaks',q:'מה מרענן אותך בהפסקות?',opts:['📱 טלפון ורשתות','🚶‍♂️ תזוזה / מתיחות','☕ קפה / נשנוש','🧘 מנוחה לעיניים']}
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

// ── ISRAELI HOLIDAYS ──
const HOLIDAYS_IL = {
  '2025-09-22':'ראש השנה','2025-09-23':'ראש השנה (ב׳)',
  '2025-10-01':'יום כיפור',
  '2025-10-06':'סוכות','2025-10-07':'סוכות (ב׳)',
  '2025-10-13':'הושענא רבה','2025-10-14':'שמיני עצרת','2025-10-15':'שמחת תורה',
  '2025-12-25':'חנוכה (א׳)','2025-12-26':'חנוכה (ב׳)','2025-12-27':'חנוכה (ג׳)',
  '2025-12-28':'חנוכה (ד׳)','2025-12-29':'חנוכה (ה׳)','2025-12-30':'חנוכה (ו׳)',
  '2025-12-31':'חנוכה (ז׳)','2026-01-01':'חנוכה (ח׳)',
  '2026-03-12':'פורים (תל אביב)','2026-03-13':'פורים',
  '2026-04-01':'ערב פסח','2026-04-02':'פסח (א׳)','2026-04-03':'פסח (ב׳)',
  '2026-04-08':'פסח (ז׳)','2026-04-09':'פסח (ח׳)',
  '2026-04-16':'יום הזיכרון','2026-04-17':'יום העצמאות',
  '2026-04-29':"ל''ג בעומר",
  '2026-05-21':'ערב שבועות','2026-05-22':'שבועות (א׳)','2026-05-23':'שבועות (ב׳)',
};
function getHoliday(dateStr){ return HOLIDAYS_IL[dateStr] || null; }

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

// ── INIT & ONBOARDING ──
window.onload=async ()=>{
  await checkAuth();
  
  const saved=localStorage.getItem('sf_v11_groq');
  if(saved){try{S={...S,...JSON.parse(saved)};}catch(e){}}
  document.body.setAttribute('data-theme', S.theme || 'light');
  if(S.apiKey&&S.userName){initApp();return;}
  if(S.apiKey)document.getElementById('inp-key').value=S.apiKey;
  if(S.userName)document.getElementById('inp-name').value=S.userName;
};
const save=()=>localStorage.setItem('sf_v11_groq',JSON.stringify(S));

function renderAll() {
  renderTodayTasks();
  if (document.getElementById('page-schedule').classList.contains('active')) renderSchedule();
  if (document.getElementById('page-exams').classList.contains('active')) renderExams();
  if (document.getElementById('page-anchors').classList.contains('active')) renderAnchorsList();
  if (document.getElementById('page-progress').classList.contains('active')) renderProgress();
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

function toggleTheme() { S.theme = S.theme === 'dark' ? 'light' : 'dark'; document.body.setAttribute('data-theme', S.theme); save(); }
function resetSettings(){ if(confirm('לאפס נתונים?')){localStorage.removeItem('sf_v11_groq');location.reload();} }

function obNext(step){
  if(step===1){
    S.apiKey=document.getElementById('inp-key').value.trim();
    S.userName=document.getElementById('inp-name').value.trim();
    if(!S.apiKey||!S.userName){toast('נא למלא API Key ושם');return;}
    S.institution=document.getElementById('inp-inst').value.trim();
    S.wakeTime=document.getElementById('inp-wake').value;
    S.sleepTime=document.getElementById('inp-sleep').value;
  }
  if(step===2){ S.anchors=collectAnchors(); renderProfileQs(); }
  if(step===3){
    S.profile = { focus_time:'בוקר (6-10)', focus_span:'60-75 דקות', style:'לבד', exam_fear:'לא לסיים ללמוד', env:'ספרייה / שקט מוחלט', breaks:'תזוזה / מתיחות', ...profileAnswers };
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
    <div style="display:flex;gap:0.45rem;align-items:center;margin-bottom:0.6rem">
      <input type="text" placeholder="שם (הרצאה, עבודה, אימון...)" style="flex:1;font-size:0.84rem;padding:0.5rem 0.65rem" />
      <input type="color" value="#4f6ef7" style="width:38px;height:38px;padding:0.2rem;cursor:pointer;border-radius:8px;flex-shrink:0" title="צבע" />
      <input type="number" value="0" min="0" max="180" style="width:60px;font-size:0.78rem;padding:0.45rem" title="זמן נסיעה (דק')" placeholder="נסיעה" />
      <button class="btn-del-row" onclick="document.getElementById('${rowId}').remove()">✕</button>
    </div>
    <div style="margin-bottom:0.55rem">
      <div style="font-size:0.7rem;color:var(--muted);font-weight:700;margin-bottom:0.35rem">ימים בשבוע</div>
      <div style="display:flex;gap:0.3rem;flex-wrap:wrap">${[0,1,2,3,4,5,6].map(d=>`<button type="button" class="ob-day-btn" data-day="${d}" onclick="toggleObDay(this,'${rowId}')">${dayShort[d]}</button>`).join('')}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.35rem">
      <div><label style="font-size:0.7rem;color:var(--muted);font-weight:700;display:block;margin-bottom:0.25rem">שעת התחלה</label><input type="time" value="09:00" class="ob-def-start" style="font-size:0.82rem;padding:0.45rem" onchange="updateObPerDayRows('${rowId}')" /></div>
      <div><label style="font-size:0.7rem;color:var(--muted);font-weight:700;display:block;margin-bottom:0.25rem">שעת סיום</label><input type="time" value="16:00" class="ob-def-end" style="font-size:0.82rem;padding:0.45rem" onchange="updateObPerDayRows('${rowId}')" /></div>
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
    lbl.textContent = '⚙️ כוון שעות לכל יום בנפרד (אופציונלי)';
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
    const travelMin = Math.max(0, Math.min(180, parseInt(row.querySelector('input[type="number"]')?.value || 0)));
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
      results.push({ id: uid(), name, day: d, start, end, travelMin, color });
    });
  });
  return results;
}
function renderProfileQs(){
  document.getElementById('profile-q-wrap').innerHTML=PROFILE_QS.map(q=>`<div style="margin-bottom:1.1rem"><div class="ob-q" style="font-size:0.95rem">${q.q}</div><div class="ob-opts">${q.opts.map(opt=>`<div class="ob-opt" onclick="selectProfileOpt(this,'${q.id}')">${opt}</div>`).join('')}</div></div>`).join('');
}
function selectProfileOpt(el,qId){ el.closest('.ob-opts').querySelectorAll('.ob-opt').forEach(o=>o.classList.remove('sel')); el.classList.add('sel'); profileAnswers[qId]=el.textContent.trim(); }
function finishOnboarding(){ save(); initApp(); }

function initApp(){
  document.getElementById('setup-screen').style.display='none'; document.getElementById('app-screen').style.display='block';
  document.getElementById('sb-name').textContent=S.userName; document.getElementById('sb-avatar').textContent=S.userName[0].toUpperCase();
  const now=new Date(); const days=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']; const months=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  document.getElementById('today-greeting').textContent=`שלום, ${S.userName} 👋`;
  document.getElementById('today-sub').textContent=`יום ${days[now.getDay()]}, ${now.getDate()} ב${months[now.getMonth()]} ${now.getFullYear()}`;
  
  checkPastDueTasks();
  renderAll();
}

function showPage(name,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  if(btn)btn.classList.add('active');
  if(name==='schedule')renderSchedule();
  if(name==='exams')renderExams();
  if(name==='anchors')renderAnchorsList();
  if(name==='progress') renderProgress();
}

async function gemini(prompt){
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${S.apiKey}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{role: 'user', content: prompt}], temperature: 0.7 })
  });
  if (res.status === 401) throw new Error('API Key לא תקין — בדוק ב-console.groq.com/keys');
  if (res.status === 429) throw new Error('חריגת מגבלת API — נסה שוב בעוד דקה');
  if (!res.ok) throw new Error(`שגיאת שרת (${res.status}) — נסה שוב`);
  const d = await res.json();
  return d.choices[0].message.content;
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

function renderProgress(){
  const pts = S.points || 0; const streak = S.streak || 0;
  const lvl = XP_LEVELS.find(l => pts >= l.min && pts < l.max) || XP_LEVELS[XP_LEVELS.length-1];
  const lvlPct = Math.min(100, ((pts - lvl.min) / Math.max(1, lvl.max - lvl.min)) * 100);
  const circumference = 2 * Math.PI * 58;
  const dashVal = (lvlPct / 100) * circumference;
  if(document.getElementById('tree-pts')) document.getElementById('tree-pts').textContent = pts.toLocaleString();
  if(document.getElementById('tree-next')) document.getElementById('tree-next').textContent = `${lvl.emoji} ${lvl.name} — ${Math.round(lvlPct)}% לשלב הבא`;
  if(document.getElementById('xp-level-emoji')) document.getElementById('xp-level-emoji').textContent = lvl.emoji;
  const ringEl = document.getElementById('xp-ring-fill');
  if(ringEl) ringEl.style.setProperty('--dash', dashVal.toFixed(1));
  if(document.getElementById('streak-badge')) document.getElementById('streak-badge').textContent = streak;
  const done = S.tasks.filter(t => t.done).length; const total = S.tasks.length;
  if(document.getElementById('stat-total-done')) document.getElementById('stat-total-done').textContent = done;
  if(document.getElementById('stat-total')) document.getElementById('stat-total').textContent = total;
  if(document.getElementById('stat-pct')) document.getElementById('stat-pct').textContent = total ? Math.round(done/total*100)+'%' : '0%';
  const cpEl = document.getElementById('course-progress-bars');
  if (cpEl) {
    const courses = [...new Set(S.tasks.filter(t=>t.course).map(t=>t.course))];
    if (courses.length) {
      const colors = ['#4f6ef7','#16c98d','#f5a623','#f76060','#a78bfa','#38ef7d','#ec4899'];
      cpEl.innerHTML = `<div style="font-size:0.72rem;font-weight:700;color:rgba(255,255,255,0.6);margin-bottom:0.65rem;letter-spacing:0.5px;text-transform:uppercase">התקדמות לפי קורס</div>` + courses.map((c,i) => {
        const ct = S.tasks.filter(t=>t.course===c); const cd = ct.filter(t=>t.done).length;
        const pct = ct.length ? Math.round(cd/ct.length*100) : 0;
        const col = colors[i % colors.length];
        return `<div class="xp-course-row"><div class="xp-course-name" title="${c}">${c}</div><div class="xp-course-bar-bg"><div class="xp-course-bar-fill" style="width:${pct}%;background:${col}"></div></div><div class="xp-course-pct">${pct}%</div></div>`;
      }).join('');
    } else {
      cpEl.innerHTML = `<div style="font-size:0.8rem;color:rgba(255,255,255,0.45);text-align:center;padding:0.75rem">לא נמצאו קורסים עם משימות עדיין</div>`;
    }
  }
  const starsEl = document.getElementById('xp-stars');
  if (starsEl && !starsEl.children.length) {
    starsEl.innerHTML = Array.from({length:40}, () => {
      const x = (Math.random()*100).toFixed(1), y = (Math.random()*100).toFixed(1);
      const size = (Math.random()*2.5+0.5).toFixed(1);
      const dur = (Math.random()*4+2).toFixed(1);
      const delay = (-(Math.random()*6)).toFixed(1);
      return `<div class="xp-star" style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;--dur:${dur}s;--delay:${delay}s"></div>`;
    }).join('');
  }
  
  // ── יעד יומי חכם ──
  const todayStr2 = ld(new Date());
  const todayTasks2 = S.tasks.filter(t => t.date === todayStr2);
  const todayDone2 = todayTasks2.filter(t => t.done).length;
  const todayTotal2 = todayTasks2.length;
  const todayPct2 = todayTotal2 > 0 ? Math.round(todayDone2 / todayTotal2 * 100) : 0;
  const nearestExam2 = [...S.exams].sort((a,b)=>a.date.localeCompare(b.date)).find(e => new Date(e.date) > new Date());
  const streakMsg = S.streak >= 14 ? `🔥 ${S.streak} ימי רצף — אתה מכונה אדם!` : S.streak >= 7 ? `🏃 ${S.streak} ימי רצף — המשך כך!` : S.streak >= 3 ? `✨ ${S.streak} ימים ברצף — אתה בדרך!` : S.streak === 1 ? `🌱 יום ראשון ברצף — ההתחלה היא הקשה ביותר!` : `💤 הפסקת רצף — בוא נתחיל מחדש!`;
  const questEl = document.getElementById('quest-text'); const rewardEl = document.getElementById('quest-reward');
  if (questEl) {
    if (todayTotal2 > 0) {
      questEl.innerHTML = `<div style="font-weight:900;margin-bottom:0.4rem">${streakMsg}</div>
        <div style="opacity:0.9">השלמת ${todayDone2} מתוך ${todayTotal2} משימות היום</div>
        <div style="margin-top:0.6rem;background:rgba(255,255,255,0.25);border-radius:99px;height:10px;overflow:hidden;">
          <div style="width:${todayPct2}%;height:100%;background:white;border-radius:99px;transition:width 0.6s ease;"></div>
        </div>
        <div style="font-size:0.75rem;opacity:0.85;margin-top:0.3rem">${todayPct2}% הושלמו${nearestExam2 ? ` · מבחן: ${nearestExam2.course} בעוד ${Math.max(0,Math.ceil((new Date(nearestExam2.date)-new Date())/86400000))} ימים` : ''}</div>`;
    } else {
      questEl.innerHTML = `<div style="font-weight:900;margin-bottom:0.4rem">${streakMsg}</div>
        <div style="opacity:0.9">${nearestExam2 ? `המבחן הקרוב: <b>${nearestExam2.course}</b> — עוד ${Math.max(0,Math.ceil((new Date(nearestExam2.date)-new Date())/86400000))} ימים. בוא נתכנן!` : 'אין משימות להיום. הוסף מהמתכנן וצבור נקודות!'}</div>`;
    }
  }
  const rewardKey = `sf_dr_${todayStr2}`;
  const alreadyClaimed = localStorage.getItem(rewardKey);
  window.claimDailyReward = function() {
    if (localStorage.getItem(rewardKey)) { toast('כבר קיבלת את פרס היום 😄'); return; }
    localStorage.setItem(rewardKey, '1');
    addPoints(100); renderProgress(); toast('🏆 כל הכבוד! +100 נקודות לעץ שלך!');
  };
  if (rewardEl) {
    if (todayTotal2 > 0 && todayDone2 >= todayTotal2 && !alreadyClaimed) {
      rewardEl.innerHTML = `<div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:0.6rem 0.9rem;display:inline-flex;align-items:center;gap:0.5rem;"><span style="font-weight:800">🏆 השלמת את כל משימות היום!</span> <button style="background:white;color:#11998e;border:none;border-radius:8px;padding:0.35rem 0.8rem;font-weight:800;cursor:pointer;font-family:var(--sans);font-size:0.82rem;" onclick="claimDailyReward()">קבל +100 נק'</button></div>`;
    } else if (todayTotal2 > 0 && !alreadyClaimed) {
      rewardEl.innerHTML = `<span style="opacity:0.85;font-size:0.82rem">עוד ${todayTotal2-todayDone2} משימות לפרס היומי (+100 נק')</span>`;
    } else if (alreadyClaimed) {
      rewardEl.innerHTML = `<span style="opacity:0.85;font-size:0.82rem">✓ פרס היומי נאסף — כל הכבוד!</span>`;
    } else {
      rewardEl.innerHTML = `<button style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);border-radius:8px;padding:0.35rem 0.9rem;font-weight:700;cursor:pointer;font-family:var(--sans);font-size:0.82rem;" onclick="showPage('planner',document.querySelectorAll('.nav-item')[1])">✨ צור תוכנית לימודים</button>`;
    }
  }
}

function addPoints(n){ S.points = (S.points || 0) + n; updateStreak(); save(); renderTreeMini(); }
function updateStreak(){ const today = ld(new Date()); const yesterday = ld(new Date(Date.now() - 86400000)); if(S.lastStudyDate === today) return; if(S.lastStudyDate === yesterday){ S.streak = (S.streak||0) + 1; } else { S.streak = 1; } S.lastStudyDate = today; }
function renderTreeMini(){ if(document.getElementById('sc-streak')) document.getElementById('sc-streak').textContent = (S.streak || 0) + '🔥'; }

// ── POMODORO ──
let pomoInterval=null, pomoSeconds=90*60, pomoRunning=false, pomoMode='work'; const POMO_WORK=90*60, POMO_BREAK=20*60;
function renderPomoTaskSelect() { const select = document.getElementById('pomo-task-select'); if(!select) return; const today = ld(new Date()); const pendingTasks = S.tasks.filter(t => t.date === today && !t.done && !t.missed); select.innerHTML = '<option value="">-- בחר משימה (רשות) --</option>' + pendingTasks.map(t => `<option value="${t.id}">${t.time} | ${t.name}</option>`).join(''); }
function pomoStart(){ if(pomoRunning)return; pomoRunning=true; document.getElementById('pomo-start-btn').classList.add('hidden'); document.getElementById('pomo-pause-btn').classList.remove('hidden'); pomoInterval=setInterval(()=>{ pomoSeconds--; if(pomoSeconds<=0){ clearInterval(pomoInterval); pomoRunning=false; if(pomoMode==='work'){ const taskId = document.getElementById('pomo-task-select').value; if(taskId) { const pt = S.tasks.find(x => String(x.id) === String(taskId)); if(pt){ pt.done=true; pt.missed=false; addPoints(10); save(); renderAll(); } else { addPoints(10); save(); } toast('🍅 פגישת פוקוס הושלמה! משימה סומנה כבוצעת ✓'); renderPomoTaskSelect(); } else { toast('🎉 הזמן נגמר! קח הפסקה'); } pomoMode='break'; pomoSeconds=POMO_BREAK; } else { pomoMode='work'; pomoSeconds=POMO_WORK; toast('⚡ ההפסקה נגמרה! חזרה לריכוז'); } document.getElementById('pomo-start-btn').classList.remove('hidden'); document.getElementById('pomo-pause-btn').classList.add('hidden'); } const total = pomoMode==='work'?POMO_WORK:POMO_BREAK; const pct = ((total-pomoSeconds)/total*100).toFixed(1); const m = String(Math.floor(pomoSeconds/60)).padStart(2,'0'); const s = String(pomoSeconds%60).padStart(2,'0'); document.getElementById('pomo-display').textContent=`${m}:${s}`; document.getElementById('pomo-prog').style.width=pct+'%'; },1000); }
function pomoPause(){clearInterval(pomoInterval);pomoRunning=false;document.getElementById('pomo-start-btn').classList.remove('hidden');document.getElementById('pomo-pause-btn').classList.add('hidden');}
function pomoReset(){pomoPause();pomoMode='work';pomoSeconds=POMO_WORK;document.getElementById('pomo-display').textContent='90:00';document.getElementById('pomo-prog').style.width='0%';}

// ── THE SMART WAZE ALGORITHM ──
function getAvailableSlots(startDateStr, examDateStr, currentPriority){
  const dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']; let available = ""; let totalMinutes = 0; 
  let startD = startDateStr ? new Date(startDateStr) : new Date(); let examD = new Date(examDateStr); let daysLeft = Math.ceil((examD - startD) / 86400000); let maxDays = Math.min(daysLeft, 30); 
  for(let i=0; i<=maxDays; i++) {
    let d = new Date(startD); d.setDate(startD.getDate() + i); let dateStr = ld(d); let dayIdx = d.getDay();
    let dayAnchors = (S.anchors||[]).filter(a => parseInt(a.day) === dayIdx); let dayTasks = (S.tasks||[]).filter(t => t.date === dateStr && !t.done); 
    let dailySlots = []; let blocks = ["08:00","09:50","11:40","14:00","15:50","17:40","19:30"];
    let wake = parseInt((S.wakeTime||"08:00").split(':')[0])*60 + parseInt((S.wakeTime||"08:00").split(':')[1]); let sleep = parseInt((S.sleepTime||"22:00").split(':')[0])*60 + parseInt((S.sleepTime||"22:00").split(':')[1]);
    blocks.forEach(time => {
      let [h, m] = time.split(':').map(Number); let slotStart = h * 60 + m; let slotEnd = slotStart + 90; 
      if (slotStart < wake + 30 || slotEnd > sleep) return; 
      let now = new Date(); if (dateStr === ld(now)) { let currentMins = now.getHours() * 60 + now.getMinutes(); if (slotStart <= currentMins) return; }
      let isAnchorBlocked = false; let taskPriorityInSlot = 0; 
      dayAnchors.forEach(a => { let ast = parseInt((a.start||"00:00").split(':')[0])*60 + parseInt((a.start||"00:00").split(':')[1]) - (a.travelMin||0); let aen = parseInt((a.end||"00:00").split(':')[0])*60 + parseInt((a.end||"00:00").split(':')[1]) + (a.travelMin||0); if (slotStart < aen && slotEnd > ast) isAnchorBlocked = true; });
      if(isAnchorBlocked) return;
      dayTasks.forEach(t => { let tst = parseInt((t.time||"00:00").split(':')[0])*60 + parseInt((t.time||"00:00").split(':')[1]); let ten = tst + 90; if (slotStart < ten && slotEnd > tst) { if(t.priority === 'גבוה') taskPriorityInSlot = 5; else if(t.priority === 'בינוני') taskPriorityInSlot = 3; else taskPriorityInSlot = 1; } });
      if(taskPriorityInSlot === 0) { dailySlots.push(time); totalMinutes += 90; } else if (parseInt(currentPriority) > taskPriorityInSlot) { dailySlots.push(`${time} (פנוי לדריסה)`); totalMinutes += 90; }
    });
    if(dailySlots.length > 0) available += `- בתאריך ${dateStr} (יום ${dn[dayIdx]}): ${dailySlots.join(', ')}\n`;
  }
  return { text: available || "אין זמנים פנויים", totalMinutes };
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

  const prompt = `אתה מתכנן לו"ז לימוד חכם לפי שיטת Spaced Learning.
קורס: "${course}" | מבחן: ${date} | טווח: ${startDate} → ${examMinus1} | ${totalDays} ימים | צור ${totalTasks} משימות בסך הכל

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
1. "time" — מתוך אחד מהאלה בלבד: "08:00","09:50","11:40","14:00","15:50","17:40","19:30"
2. "date" — בטווח ${startDate}–${examMinus1} בלבד (לא כולל יום המבחן ${date})
3. אל תכניס יותר מ-2 משימות עם אותו שם ביום
4. השתמש רק בתאריכים שמופיעים ברשימת הזמנים הפנויים${blockedNote}

זמנים פנויים:
${slotsData.text}

JSON בלבד: {"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"${course}","name":"...","duration":"90 דק'","priority":"גבוה|בינוני"}]}`;
  
  try{
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${S.apiKey}` }, body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{role: 'user', content: prompt}], temperature: 0.2, response_format: { type: "json_object" } }) });
    const data = await res.json(); 
    let parsed = extractJSON(data.choices[0].message.content);
    let validTasks = (parsed.tasks||[]).filter(t => {
      if (!t.date || !t.time) return false;
      const isTimeValid = ["08:00","09:50","11:40","14:00","15:50","17:40","19:30"].includes(t.time);
      const isDateValid = new Date(t.date) <= new Date(date) && new Date(t.date) >= new Date(ld(new Date()));
      const noTaskCollision = !S.tasks.find(old => old.date === t.date && old.time === t.time && !old.done && !old.missed && old.course !== course);
      const taskDay = new Date(t.date + 'T12:00:00').getDay();
      const tst = parseInt(t.time.split(':')[0])*60 + parseInt(t.time.split(':')[1]);
      const noAnchorCollision = !(S.anchors||[]).some(a => {
        if (parseInt(a.day) !== taskDay) return false;
        const ast = parseInt((a.start||'00:00').split(':')[0])*60 + parseInt((a.start||'00:00').split(':')[1]) - (a.travelMin||0);
        const aen = parseInt((a.end||'00:00').split(':')[0])*60 + parseInt((a.end||'00:00').split(':')[1]) + (a.travelMin||0);
        return tst < aen && (tst + 90) > ast;
      });
      return isTimeValid && isDateValid && noTaskCollision && noAnchorCollision;
    });
    S.pendingPlan = validTasks.map(t => ({...t, id:uid(), done:false, missed:false}));
    if(S.pendingPlan.length === 0) { throw new Error('ה-AI לא מצא זמנים חוקיים.'); }
    renderPlanTable(S.pendingPlan); document.getElementById('plan-result-box').classList.remove('hidden');
    if(!S.exams.find(e => e.course === course && e.date === date)){ S.exams.push({id:uid(), course, date, type:'מבחן', conf:parseInt(priority), readyPct:0, createdDate: ld(new Date())}); save(); }
  } catch(e){ toast('שגיאה בתכנון המסלול.'); console.error(e); }
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
  if (!S.pendingPlan.length) return;
  // Calculate what will be replaced for transparency
  let replacedTasks = [];
  S.pendingPlan.forEach(newT => {
    S.tasks.filter(old => old.date === newT.date && old.time === newT.time && !old.done && old.course !== newT.course)
      .forEach(t => replacedTasks.push(t));
  });
  // Ask for confirmation if displacing tasks from other courses
  const otherCourseReplacements = replacedTasks.filter(t => t.course !== S.pendingPlan[0]?.course);
  if (otherCourseReplacements.length > 0) {
    const names = otherCourseReplacements.slice(0,3).map(t=>`"${t.name}"`).join(', ');
    const more = otherCourseReplacements.length > 3 ? ` ועוד ${otherCourseReplacements.length-3}` : '';
    if (!confirm(`⚠️ הוספת התוכנית תחליף ${otherCourseReplacements.length} משימות מקורסים אחרים: ${names}${more}.\n\nלהמשיך?`)) return;
  }
  const planCount = S.pendingPlan.length;
  S.pendingPlan.forEach(newT => {
    S.tasks = S.tasks.filter(old => !(old.date === newT.date && old.time === newT.time && !old.done));
    S.tasks.push(newT);
  });
  // Holiday check AFTER adding — so AI can update/delete the now-saved tasks
  const holidayTasks = S.pendingPlan.filter(t => getHoliday(t.date));
  const hadHoliday = holidayTasks.length > 0;
  S.pendingPlan = []; save(); renderAll();
  document.getElementById('plan-result-box').classList.add('hidden');
  const msg = otherCourseReplacements.length > 0
    ? `✓ ${planCount} משימות נוספו (הוחלפו ${otherCourseReplacements.length} משימות מקורסים אחרים) 📅`
    : `✓ ${planCount} משימות נוספו ללו"ז המלא! 🚀`;
  toast(msg);
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

function changeWeek(dir){ S.weekOffset += dir; renderSchedule(); if(isGridView) renderCalendarView(); }

// ══════════════════════════════════════════════
// SEMESTER PLANNER
// ══════════════════════════════════════════════
const COURSE_PALETTE = ['#4f6ef7','#16c98d','#f5a623','#8b5cf6','#f76060','#06b6d4','#f97316','#10b981'];
let semCourseCount = 0;

function setPlannerMode(mode) {
  document.getElementById('planner-single-section').classList.toggle('hidden', mode !== 'single');
  document.getElementById('planner-semester-section').classList.toggle('hidden', mode !== 'semester');
  document.getElementById('mode-btn-single').classList.toggle('active', mode === 'single');
  document.getElementById('mode-btn-semester').classList.toggle('active', mode === 'semester');
  document.getElementById('planner-sub').textContent = mode === 'single'
    ? 'ה-AI חותך מתמטית את העבודה והמשימות הקיימות, ומשבץ תוכנית אופטימלית לקורס.'
    : 'תכנון סמסטר שלם — הזן את כל הקורסים ו-AI יבנה לוח זמנים אופטימלי תוך שמירה על עוגנים, חגים וחלונות קראנץ׳.';
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
  const holidayList = Object.entries(HOLIDAYS_IL).filter(([d])=>d>=today&&d<=lastExam).map(([d,n])=>`${d}: ${n}`).join(', ') || 'אין';
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
1. "time" — מתוך בלבד: "08:00","09:50","11:40","14:00","15:50","17:40","19:30"
2. "date" — רק תאריכים שמופיעים בזמנים פנויים, לא בחגים
3. בחלון קראנץ׳ — רק הקורס הרלוונטי, עד 3 ביום
4. מחוץ לקראנץ׳ — חלק לפי יחס: (שעות × עדיפות) לכל קורס
5. עד 2-3 משימות ביום בסך הכל, עד 5 בשבוע לכל קורס
6. גיוון שמות: קריאת חומר / תרגול / שאלות ממבחן / חזרה מרווחת / סיכום / [קראנץ׳: שליפה אקטיבית / מבחן תרגול / חזרה אינטנסיבית]
7. priority: "בינוני" לשלב בנייה, "גבוה" לשלב קראנץ׳

JSON בלבד — עד 150 משימות:
{"tasks":[{"date":"YYYY-MM-DD","time":"HH:MM","course":"שם הקורס","name":"שם מגוון","duration":"90 דק'","priority":"גבוה|בינוני"}]}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':`Bearer ${S.apiKey}`},
      body: JSON.stringify({model:'llama-3.3-70b-versatile', messages:[{role:'user',content:prompt}], temperature:0.2, response_format:{type:'json_object'}, max_tokens:8000})
    });
    if (res.status===401) throw new Error('API Key לא תקין');
    if (res.status===429) throw new Error('חריגת מגבלת API');
    if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
    const data = await res.json();
    const parsed = extractJSON(data.choices[0].message.content);

    const validTimes = ["08:00","09:50","11:40","14:00","15:50","17:40","19:30"];
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
            <span style="font-size:0.6rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:99px;background:${isCrunch?'var(--red-light)':'var(--accent-light)'};color:${isCrunch?'var(--red)':'var(--accent)'}">${isCrunch?'🔥':'📚'}</span>
            <span style="font-size:0.6rem;color:var(--muted);font-family:var(--mono)">${fmtDate(t.date)}</span>
            ${hol?`<span style="font-size:0.58rem;color:var(--yellow);font-weight:700">⚠️ ${hol}</span>`:''}
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
        ${crunchCount?`<span style="font-size:0.72rem;background:var(--red-light);color:var(--red);padding:0.2rem 0.6rem;border-radius:99px;font-weight:700">🔥 ${crunchCount} קראנץ׳</span>`:''}
      </div>
      <div style="padding:0.75rem;">${cards}</div>
    </div>`;
  }).join('');

  const totalHours = (tasks.length * 1.5).toFixed(0);
  const summaryHtml = `<div style="display:flex;gap:0.55rem;margin-bottom:1.25rem;flex-wrap:wrap;">
    <div style="background:var(--green-light);border:1px solid rgba(22,201,141,0.3);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--green)">✅ ${tasks.length} משימות</div>
    <div style="background:var(--accent-light);border:1px solid var(--border2);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--accent)">⏱️ ~${totalHours}ש׳</div>
    <div style="background:var(--purple-light);border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--purple)">📚 ${Object.keys(byCourse).length} קורסים</div>
    <div style="background:var(--red-light);border:1px solid rgba(247,96,96,0.25);border-radius:10px;padding:0.45rem 0.85rem;font-size:0.78rem;font-weight:700;color:var(--red)">🔥 ${tasks.filter(t=>t.priority==='גבוה'||crunchKW.some(k=>t.name.includes(k))).length} קראנץ׳</div>
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
function renderSchedule(){
  const now = new Date(); const sow = new Date(now); sow.setDate(now.getDate() - now.getDay() + S.weekOffset*7); const eow = new Date(sow); eow.setDate(sow.getDate() + 6);
  const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']; const months = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];
  const s = ld(sow), e = ld(eow); document.getElementById('week-label').textContent = `${sow.getDate()} ${months[sow.getMonth()]} — ${eow.getDate()} ${months[eow.getMonth()]}`;
  const wt = S.tasks.filter(t => t.date >= s && t.date <= e); const we = S.exams.filter(ex => ex.date >= s && ex.date <= e);
  const pc = {גבוה:'high', בינוני:'med', שוטף:'low'}; const byDate = {};
  for(let i=0; i<7; i++) { const d = new Date(sow); d.setDate(sow.getDate() + i); byDate[ld(d)] = []; }
  wt.forEach(t => { byDate[t.date].push(t); }); we.forEach(ex => { byDate[ex.date].unshift({...ex, _exam:true}); });
  Object.keys(byDate).forEach(date => {
    let d = new Date(date + 'T12:00:00'); let dayIdx = d.getDay();
    let dayAnchors = (S.anchors||[]).filter(a => parseInt(a.day) === dayIdx);
    dayAnchors.forEach(a => { byDate[date].push({_isAnchor:true, time:a.start, duration:`${a.start}-${a.end}`, name:`🔒 ${a.name}`}); });
    byDate[date].sort((a,b) => (a.time||'00:00').localeCompare(b.time||'00:00'));
  });

  let html = ''; let hasAny = false;
  Object.keys(byDate).sort().forEach(date => {
    if(byDate[date].length === 0) return; hasAny = true; const d = new Date(date + 'T12:00:00'); const isToday = ld(new Date()) === date;
    html += `<div style="margin-bottom:2rem"><div style="font-size:0.92rem;font-weight:800;color:${isToday?'var(--accent)':'var(--text)'};margin-bottom:0.6rem">${isToday?'<span style="background:var(--accent);color:white;border-radius:6px;padding:0.1rem 0.5rem;font-size:0.68rem">היום</span>':''} יום ${dayNames[d.getDay()]}, ${d.getDate()} ב${months[d.getMonth()]}</div><div style="overflow-x:auto"><table><thead><tr><th>שעה</th><th>קורס/תחום</th><th>משימה</th><th>משך</th><th>עדיפות</th><th>סטטוס</th><th>פעולות</th></tr></thead><tbody>${byDate[date].map(t => {
          if(t._exam) return `<tr style="background:var(--purple-light)"><td><b style="color:var(--purple)">מבחן!</b></td><td colspan="2"><b>${t.course}</b></td><td>—</td><td><span class="badge exam">מבחן</span></td><td><span class="badge exam">🎯</span></td><td></td></tr>`;
          if(t._isAnchor) return `<tr style="background:var(--surface2);opacity:0.85"><td><span style="font-family:var(--mono);font-size:0.78rem;font-weight:bold">${t.time}</span></td><td colspan="2" style="font-weight:700;color:var(--muted)">${t.name}</td><td><span style="font-family:var(--mono);font-size:0.75rem">${t.duration}</span></td><td>-</td><td><span class="badge" style="background:var(--surface3);color:var(--muted)">עוגן</span></td><td></td></tr>`;
          const sc = t.done ? 'done' : t.missed ? 'missed' : 'pending'; const sl = t.done ? '✓ בוצע' : t.missed ? '✗ לא בוצע' : '⏳ ממתין'; let cColor = getCourseColor(t.course); const isNear = (t.date === ld(new Date())); 
          return `<tr class="${isNear ? 'learning-ready' : ''}" style="background:${cColor}12; ${t.done?'opacity:0.65':''}"><td><span style="font-family:var(--mono);font-size:0.75rem">${t.time||'—'}</span></td><td style="white-space:nowrap;"><span class="course-tag" style="background-color:${cColor};">${t.course||''}</span></td><td style="max-width:240px;font-weight:600">${t.name}</td><td><span style="font-family:var(--mono);font-size:0.72rem;color:var(--muted)">${t.duration||''}</span></td><td><span class="badge ${pc[t.priority]||'med'}">${t.priority||'—'}</span></td><td><span class="badge ${sc}">${sl}</span></td><td style="white-space:nowrap;display:flex;gap:0.25rem;padding:0.8rem 0.9rem;">${t.done ? `<button class="toggle-btn mark-undone" onclick="undoTask('${t.id}')">↩ בטל</button>` : t.missed ? `<button class="toggle-btn mark-done" onclick="doneTask('${t.id}')">✓ בוצע</button>` : `<button class="toggle-btn mark-done" onclick="doneTask('${t.id}')">✓</button><button class="toggle-btn mark-undone" onclick="missTask('${t.id}')">✗</button>`} <button class="mark-del" style="background:var(--surface2)" onclick="openManualTaskModal('${t.id}')">✏️</button> <button class="mark-del" onclick="deleteTask('${t.id}')">🗑</button></td></tr>`;
        }).join('')}</tbody></table></div></div>`;
  });
  if(!hasAny) html = '<div class="empty-state">אין משימות או עוגנים בשבוע זה</div>';
  document.getElementById('schedule-wrap').innerHTML = html;
}

let currentRatingTaskId = null; let tempTaskRating = null;
function doneTask(id){ const t = S.tasks.find(x => String(x.id) === String(id)); if(!t) return; if(t.done) { t.done = false; save(); renderAll(); return; } currentRatingTaskId = id; document.getElementById('rating-task-name').textContent = t.name; document.getElementById('rating-bad-wrap').classList.add('hidden'); document.getElementById('rating-skip-btn').classList.remove('hidden'); document.getElementById('rating-modal').classList.remove('hidden'); }
function submitTaskRating(stars) { tempTaskRating = stars; if(stars <= 3) { document.getElementById('rating-bad-wrap').classList.remove('hidden'); document.getElementById('rating-skip-btn').classList.add('hidden'); } else { finishTaskRating(); } }
function finishTaskRating(skip = false) { const t = S.tasks.find(x => String(x.id) === String(currentRatingTaskId)); if(t) { t.done = true; t.missed = false; if(!skip) { t.rating = tempTaskRating; t.feedback = document.getElementById('rating-feedback').value || ''; } addPoints(10); save(); renderAll(); } document.getElementById('rating-feedback').value = ''; closeModal('rating-modal'); }
function undoTask(id){ const t=S.tasks.find(t=>String(t.id)===String(id)); if(t){t.done=false;t.missed=false;save();renderAll();} }
function deleteTask(id){ S.tasks=S.tasks.filter(t=>String(t.id)!==String(id)); save(); renderAll(); }
function missTask(id){ missedTaskId=id; const t=S.tasks.find(t=>String(t.id)===String(id)); document.getElementById('missed-task-name').textContent=`משימה: "${t?.name||''}"`; document.getElementById('missed-modal').classList.remove('hidden'); }
function confirmMissed(){ if(!missedTaskId)return; const t=S.tasks.find(t=>String(t.id)===String(missedTaskId)); if(t){t.missed=true;t.done=false;t.missedReason=selectedOpt||'לא צוין';} save(); closeModal('missed-modal'); renderAll(); }

function renderTodayTasks(){
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

  wrap.innerHTML = `<div class="today-timeline">${items.map(t => {
    const [th, tm] = (t.time||'00:00').split(':');

    if (t._isAnchor) {
      return `<div class="tl-slot anchor-slot">
        <div class="tl-bar" style="background:${t.color}"></div>
        <div class="tl-time"><div class="tl-time-h">${th}</div><div class="tl-time-m">${tm}</div></div>
        <div class="tl-body">
          <div class="tl-meta"><span style="font-size:0.8rem">🔒</span><span style="font-size:0.8rem;font-weight:800;color:var(--muted)">${t.name}</span></div>
          <div class="tl-notes">${t.time} – ${t._end}${t.travelMin>0?` · נסיעה ${t.travelMin} דק'`:''} · עוגן קבוע — חסום ל-AI</div>
        </div>
      </div>`;
    }

    const sc = t.done ? 'done' : t.missed ? 'missed' : '';
    const cColor = getCourseColor(t.course);
    const statusHtml = t.done
      ? `<span class="tl-status" style="background:var(--green-light);color:var(--green)">✓ בוצע</span>`
      : t.missed
      ? `<span class="tl-status" style="background:var(--red-light);color:var(--red)">✗ פוספס</span>`
      : `<span class="tl-status" style="background:var(--accent-light);color:var(--accent)">⏳ ממתין</span>`;
    const actionHtml = t.done
      ? `<button class="tl-btn tl-btn-undo" onclick="undoTask('${t.id}')">↩ בטל</button>`
      : t.missed
      ? `<span style="font-size:0.67rem;color:var(--muted);max-width:72px;word-break:break-word;display:block;text-align:center">${t.missedReason||'פוספס'}</span>`
      : `<button class="tl-btn tl-btn-done" onclick="doneTask('${t.id}')">✓ סיים</button><button class="tl-btn tl-btn-miss" onclick="missTask('${t.id}')">✗</button>`;

    return `<div class="tl-slot ${sc}">
      <div class="tl-bar" style="background:${cColor}"></div>
      <div class="tl-time"><div class="tl-time-h">${th}</div><div class="tl-time-m">${tm}</div></div>
      <div class="tl-body">
        <div class="tl-meta">
          ${t.course?`<span class="tl-course-tag" style="background:${cColor}22;color:${cColor}">${t.course}</span>`:''}
          ${t.priority?`<span class="tl-pri" style="background:${priBg[t.priority]||'var(--yellow-light)'};color:${priColor[t.priority]||'var(--yellow)'}">${priIcon[t.priority]||''} ${t.priority}</span>`:''}
          <span class="tl-dur">${t.duration||''}</span>
          ${statusHtml}
        </div>
        <div class="tl-title">${t.name}</div>
        ${t.notes?`<div class="tl-notes">📝 ${t.notes}</div>`:''}
      </div>
      <div class="tl-actions">
        ${actionHtml}
        ${!t.done&&!t.missed?`<button class="tl-btn tl-btn-study" onclick="startTutor('${t.id}')" title="תרגול סוקרטי">🧠</button>`:''}
        <button class="tl-btn tl-btn-edit" onclick="openManualTaskModal('${t.id}')" title="ערוך">✏️</button>
        <button class="tl-btn tl-btn-del" onclick="deleteTask('${t.id}')" title="מחק">🗑</button>
      </div>
    </div>`;
  }).join('')}</div>`;

  renderPomoTaskSelect();
}

function renderAnchorsList(){ const wrap = document.getElementById('anchors-list-wrap'); if(!Array.isArray(S.anchors) || !S.anchors.length){ wrap.innerHTML = '<div class="empty-state">אין עוגנים מוגדרים</div>'; return; } const dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']; wrap.innerHTML = S.anchors.map(a => `<div class="anchor-card"><div class="anchor-dot" style="background:${a.color||'#4f6ef7'}"></div><div style="flex:1"><div class="anchor-name-d">${a.name}</div><div class="anchor-time-d">יום ${dn[a.day||0]} · ${a.start||'00:00'} – ${a.end||'00:00'} ${a.travelMin > 0 ? `(נסיעה: ${a.travelMin} דק')` : ''}</div></div><button class="btn-sm" onclick="editAnchor('${a.id}')" title="ערוך עוגן" style="margin-left:0.35rem">✏️</button><button class="btn-sm red" onclick="removeAnchor('${a.id}')">🗑️</button></div>`).join(''); }
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
  document.getElementById('anchor-modal').classList.remove('hidden');
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
  document.getElementById('edit-t-time').value = t?.time || '09:50';
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
  isGridView = !isGridView;
  document.getElementById('schedule-wrap').classList.toggle('hidden', isGridView);
  document.getElementById('calendar-view-wrap').classList.toggle('hidden', !isGridView);
  document.getElementById('btn-toggle-view').textContent = isGridView ? '📋 תצוגת רשימה' : '📅 תצוגת יומן (Grid)';
  if (isGridView) renderCalendarView();
}

function renderCalendarView() {
  const now = new Date();
  const sow = new Date(now); sow.setDate(now.getDate() - now.getDay() + S.weekOffset * 7);
  const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const hours = ['08:00','09:50','11:40','14:00','15:50','17:40','19:30'];
  const wrap = document.getElementById('calendar-view-wrap');
  let headers = `<div class="cal-cell cal-header"></div>` + Array.from({length:7}, (_,i) => {
    const d = new Date(sow); d.setDate(sow.getDate() + i);
    const isToday = ld(d) === ld(now);
    return `<div class="cal-cell cal-header" style="${isToday?'color:var(--accent);font-weight:900;':''}">${days[i]}<br><small>${d.getDate()}/${d.getMonth()+1}</small></div>`;
  }).join('');
  let rows = hours.map(hour => {
    const cols = Array.from({length:7}, (_,i) => {
      const d = new Date(sow); d.setDate(sow.getDate() + i); const dateStr = ld(d);
      const [hh] = hour.split(':').map(Number);
      const dayAnchors = (S.anchors||[]).filter(a => {
        const [as] = (a.start||'00:00').split(':').map(Number);
        const [ae] = (a.end||'00:00').split(':').map(Number);
        return parseInt(a.day) === d.getDay() && as <= hh && ae > hh;
      });
      const dayTasks = S.tasks.filter(t => t.date === dateStr && t.time === hour);
      let cell = `<div class="cal-cell">`;
      dayAnchors.forEach(a => { cell += `<div class="cal-task-item" style="border-color:${a.color||'var(--accent)'};background:${a.color||'var(--accent)'}22;color:${a.color||'var(--accent)'}">⚓ ${a.name}</div>`; });
      dayTasks.forEach(t => { const c = getCourseColor(t.course); cell += `<div class="cal-task-item" style="border-color:${c};background:${c}22;color:${c};${t.done?'opacity:0.5;text-decoration:line-through':''}" onclick="openManualTaskModal('${t.id}')">${t.name}</div>`; });
      cell += `</div>`; return cell;
    }).join('');
    return `<div class="cal-cell cal-hour">${hour}</div>${cols}`;
  }).join('');
  wrap.innerHTML = `<div style="overflow-x:auto"><div class="calendar-grid">${headers}${rows}</div></div>`;
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
    const updatedAnchor = { ...S.anchors[idx], name, day, start, end, travelMin, color };
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
      newAnchors.push({ id:uid(), name, day:d, start:ds, end:de, travelMin, color });
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
  const validTimes = ["08:00","09:50","11:40","14:00","15:50","17:40","19:30"];
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
    const course = document.getElementById('ex-course').value.trim(); const date = document.getElementById('ex-date').value;
    if(!course || !date){ toast('נא למלא שם קורס ותאריך'); return; }
    if(course.length > 80){ toast('⚠️ שם הקורס ארוך מדי (מקסימום 80 תווים)'); return; }
    if(new Date(date) < new Date(ld(new Date()))){ toast('⚠️ תאריך מבחן לא יכול להיות בעבר'); return; }
    const yearsFromNow = new Date(); yearsFromNow.setFullYear(yearsFromNow.getFullYear() + 3);
    if(new Date(date) > yearsFromNow){ toast('⚠️ תאריך המבחן נראה לא הגיוני'); return; }
    if(S.exams.find(e => e.course === course && e.date === date)){ toast('⚠️ מבחן זה כבר קיים!'); return; }
    S.exams.push({id:uid(), course, date, type:'מבחן', conf:3, createdDate: ld(new Date()), readyPct:0});
    save(); renderExams(); toast('✅ מבחן נוסף!');
    document.getElementById('ex-course').value = ''; document.getElementById('ex-date').value = '';
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
    return `<div class="exam-row-card" style="cursor:pointer;${urgentStyle}" onclick="selectedExamId='${ex.id}'; renderExams();">
      <div class="exam-info">
        <div class="exam-name" style="font-size:1.1rem">${isVeryUrgent?'🚨 ':''}${ex.course}</div>
        <div class="exam-meta" style="font-weight:700;color:${daysColor}">עוד ${daysLeft} ימים — ${ex.date}</div>
      </div>
      <button class="btn-sm" style="background:var(--surface2);color:var(--text);pointer-events:none;">צפה בהתקדמות ➔</button>
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
(5) שעות תקינות בלבד: 08:00,09:50,11:40,14:00,15:50,17:40,19:30.`};
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
חוקים: (1) הצע 2-3 אפשרויות קונקרטיות לשיבוץ מחדש. (2) כשהמשתמש בוחר — החזר JSON עם actions.update (id+date+time חדשים). (3) שעות תקינות: 08:00,09:50,11:40,14:00,15:50,17:40,19:30. (4) פורמט: {"reply":"...","actions":{"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}]}}`}];
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

חוקים: (1) הצג לסטודנט 2-3 אפשרויות קונקרטיות: לדחוס לסוף שבוע, לפרוס על הימים הקרובים, לדלג על חלק. (2) כשהסטודנט בוחר — החזר JSON עם actions.add לשיבוץ מחדש. (3) השתמש רק בשעות: 08:00,09:50,11:40,14:00,15:50,17:40,19:30. (4) אל תשבץ בזמן עוגנים אחרים. (5) פורמט: {"reply":"...","actions":{"add":[...]}}`
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
חוקים: (1) נתח את הפער בין timePct לבין perfPct. (2) המלץ על שיטות למידה ספציפיות: חזרה מרווחת, שליפה אקטיבית, שילוב נושאים. (3) אם צריך לסדר מחדש — החזר JSON עם actions.update/add בשעות תקינות בלבד: 08:00,09:50,11:40,14:00,15:50,17:40,19:30. (4) היה ישיר — אמור אם הקצב מספיק או לא. (5) החזר JSON: {"reply":"...","actions":{...}}`}];
    } else if (mode === 'morning' || mode === 'collision') {
        header.style.background = 'linear-gradient(135deg, #f5a623, #ff7b7b)';
        title.textContent = '⚡ מנהל לוח זמנים';
        sub.textContent = 'פתרון התנגשויות וסידור מחדש של משימות.';
        btn.style.background = 'linear-gradient(135deg, #f5a623, #ff7b7b)';
        if (!recalcHistory.length) {
            recalcHistory = [{role: 'system', content: `אתה מנהל לוח זמנים מדויק. תפקידך לפתור התנגשויות ולסדר משימות שנפלו.
חוקים: (1) השתמש רק בשעות: 08:00,09:50,11:40,14:00,15:50,17:40,19:30. (2) אל תקבע בעבר. (3) החזר JSON: {"reply":"...","actions":{"add":[...],"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}]}}. (4) הסבר מה שינית ולמה.`}];
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
        chat.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">היי! יש לי תמונה גלובלית מלאה של הלו"ז שלך — <b>${pendingTasks.length} משימות קרובות</b>, ${S.anchors.length} עוגנים קבועים, תפוסת לו"ז: <b>~${Math.min(capacityPct,100)}%</b>.<br>מה נרצה לשנות, להוסיף, או להזיז?</div></div>`;
        recalcHistory = [{role:'system', content:`אתה מנהל לוח זמנים חכם ברמת Enterprise עם "ראייה גלובלית" מלאה.

לו"ז נוכחי (משימות פתוחות): ${JSON.stringify(pendingTasks)}.
עוגנים קבועים (לעולם לא לחפוף): ${anchorSummary}.
מבחנים: ${S.exams.map(e=>`${e.course}: ${e.date}`).join(', ')||'אין'}.
זמנים פנויים (30 ימים): ${freeSlots30.text||'אין'}.
היום: ${todayStr}. קימה: ${S.wakeTime}. שינה: ${S.sleepTime}.
תפוסת לו"ז נוכחית: ~${Math.min(capacityPct,100)}%.

חוקי ה-AI הגלובלי:
(1) שעות תקינות בלבד: 08:00,09:50,11:40,14:00,15:50,17:40,19:30.
(2) אל תקבע לפני ${S.wakeTime} ואחרי ${S.sleepTime}. אל תקבע בעבר.
(3) לפני הוספת שגרה חוזרת (ספורט/שפה/כושר/חברים) — סרוק קונפליקטים תחילה ודווח.
(4) אם הלו"ז מלא, אל תדרוס — הצע פשרה: "השמט X כדי לפנות מקום", "צמצם ל-Y פעמים/שבוע", "דחה Z לשבוע הבא".
(5) כשמוסיפים שגרה חוזרת, בדוק קיבולת ואז הצע תוכנית מאוזנת ומציאותית.
(6) תמיד החזר JSON: {"reply":"הסבר מה שינית ולמה","actions":{"add":[...],"delete":["ID"],"update":[{"id":"ID","date":"YYYY-MM-DD","time":"HH:MM"}]}}.`}];
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
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${S.apiKey}`},
            body: JSON.stringify({model:'llama-3.3-70b-versatile', messages:psychHistory, temperature:0.75})
        });
        if(res.status===401) throw new Error('API Key לא תקין');
        if(!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
        const data = await res.json(); const ans = data.choices[0].message.content;
        psychHistory.push({role:'assistant', content:ans});
        document.getElementById('psych-loading')?.remove();
        chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${ans.replace(/\n/g,'<br>')}</div></div>`;
        chat.scrollTop = chat.scrollHeight;
    } catch(e) {
        document.getElementById('psych-loading')?.remove();
        chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble" style="color:var(--red)">שגיאה: ${e.message}</div></div>`;
    }
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
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${S.apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [...recalcHistory, {role:'system', content: ruleReminder}], temperature: 0.3, response_format: { type: "json_object" } })
    });
    if(res.status === 401) throw new Error('API Key לא תקין');
    if(res.status === 429) throw new Error('חריגת מגבלת API — נסה שוב בעוד דקה');
    if(!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
    const data = await res.json();

    const parsed = extractJSON(data.choices[0].message.content);
    recalcHistory.push({role: 'assistant', content: parsed.reply || ''});

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
    chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble" style="color:var(--red)">שגיאת תקשורת: ה-AI לא ענה בפורמט תקין. נסה שוב.</div></div>`;
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
- הוסף משימה: {"type":"task","name":"...","course":"...","date":"YYYY-MM-DD","time":"HH:MM"} (time מתוך: 08:00,09:50,11:40,14:00,15:50,17:40,19:30)
- המר "מחר"/"מחרתיים"/"ביום X" לתאריכים מדויקים
- "מ-2 עד 4" = 14:00 עד 16:00`;

  // Trim history to last 12 turns + system
  if (assistantHistory.length > 24) assistantHistory = assistantHistory.slice(-24);

  // Show typing indicator
  appendAssistantMsg('ai', '<span class="ai-thinking">חושב...</span>');
  const loadingEl = document.getElementById('assistant-chat-history')?.lastElementChild;

  try {
    const messages = [{role:'system', content: systemPrompt}, ...assistantHistory, {role:'user', content: val}];
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${S.apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.3, response_format: { type: "json_object" } })
    });
    if (res.status === 401) throw new Error('API Key לא תקין');
    if (res.status === 429) throw new Error('חריגת מגבלת API — נסה שוב בעוד דקה');
    if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
    const data = await res.json();
    const parsed = extractJSON(data.choices[0].message.content);
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
      const validTimes = ["08:00","09:50","11:40","14:00","15:50","17:40","19:30"];
      const taskTime = validTimes.includes(parsed.time) ? parsed.time : '09:50';
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
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${S.apiKey}` }, body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{role: 'system', content: sysPrompt}, ...tutorHistory], temperature: 0.6 }) });
        const data = await res.json(); const ans = data.choices[0].message.content; tutorHistory.push({role: 'assistant', content: ans});
        document.getElementById('tutor-loading').remove(); chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble">${ans.replace(/\n/g,'<br>')}</div></div>`; chat.scrollTop = chat.scrollHeight;
    } catch(e) { document.getElementById('tutor-loading')?.remove(); chat.innerHTML += `<div class="chat-msg ai"><div class="chat-bubble" style="color:var(--red)">שגיאה</div></div>`; }
}
