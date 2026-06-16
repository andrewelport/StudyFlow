/* ============================================================================
   StudyFlow Premium — Dedicated AI Tutor Page (Re-designed)
   ========================================================================== */
(function() {
  'use strict';

  const _esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? '')) : String(s ?? ''));
  const _S = () => (typeof S !== 'undefined' ? S : (window.S || {}));
  const isP = () => !!(window.isPremium && window.isPremium());
  const _today = () => (window.ld ? window.ld(new Date()) : new Date().toISOString().slice(0, 10));
  const _uid = () => (window.uid ? window.uid() : 't' + Math.random().toString(36).slice(2, 9));
  const _save = () => { try { save(); } catch (e) { if (window.save) window.save(); } };
  const _toast = (m) => (window.toast ? window.toast(m) : null);
  function _courses() { const s = _S(); return Array.isArray(s.courses) ? s.courses : []; }
  
  function _formatChat(txt) {
    return _esc(txt).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  }

  // Icons
  const _iconSpark = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>';
  const _iconBack = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  const _iconSend = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
  const _iconCheck = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const _iconTarget = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/></svg>';
  const _iconClip = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

  // Navigation Entry Point
  window.sfNavTutorPage = function(btn) {
    if (!isP()) { 
      if (window.AIWP && AIWP.openPaywall) AIWP.openPaywall(); 
      return; 
    }
    if (window.closeSidebar) window.closeSidebar();
    if (window.showPage) window.showPage('tutor', btn);
    sfRenderTutorCourses();
  };

  // 1. Render Courses List
  window.sfRenderTutorCourses = function() {
    const wrap = document.getElementById('tutor-page-content');
    if (!wrap) return;
    
    const courses = _courses();
    
    const hero = `
      <div style="background: linear-gradient(135deg, var(--a-brand), #8b5cf6); padding: 40px 24px; border-bottom-left-radius: 30px; border-bottom-right-radius: 30px; color: white; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(139, 92, 246, 0.2); position:relative; overflow:hidden;">
        <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:white; opacity:0.1; border-radius:50%; filter:blur(20px);"></div>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
          <div style="background:rgba(255,255,255,0.2); padding:10px; border-radius:14px; backdrop-filter:blur(10px);">
             ${_iconSpark}
          </div>
          <div style="font-size: 1.8rem; font-weight: 900; letter-spacing: -0.02em;">המורה הפרטי</div>
        </div>
        <div style="font-size: 0.95rem; opacity: 0.9; line-height: 1.5; font-weight:500;">
          מורה ה-AI האישי שלך מחכה.<br>בחר קורס כדי להתחיל לתרגל וללמוד בצורה חכמה.
        </div>
      </div>
    `;

    if (!courses.length) {
      wrap.innerHTML = hero + `<div style="text-align:center; padding:40px 20px; color:var(--muted);">לא הוגדרו קורסים במערכת.<br>הוסף קורסים כדי להתחיל.</div>`;
      return;
    }

    const html = courses.map(c => {
      const msCount = Array.isArray(c.milestones) ? c.milestones.length : 0;
      return `
        <div onclick="sfTutorCourse('${c.id}')" style="background:var(--surface); border:1.5px solid var(--border); border-radius:20px; padding:20px; margin-bottom:14px; display:flex; align-items:center; gap:16px; cursor:pointer; box-shadow:0 4px 20px rgba(0,0,0,0.03); transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
          <div style="background:var(--surface2); color:var(--a-brand); width:50px; height:50px; border-radius:16px; display:flex; align-items:center; justify-content:center; box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <div style="flex:1;">
            <div style="font-size:1.15rem; font-weight:800; color:var(--text); letter-spacing:-0.01em;">${_esc(c.name)}</div>
            <div style="font-size:0.85rem; color:var(--muted); margin-top:4px; font-weight:500;">${msCount} נושאים מוגדרים</div>
          </div>
          <div style="background:var(--surface2); width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--text);">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </div>
        </div>
      `;
    }).join('');

    wrap.innerHTML = hero + `
      <div style="padding:0 16px 40px; max-width: 860px; margin: 0 auto;">
        <div style="font-size:1.1rem; font-weight:800; margin-bottom:16px; color:var(--text);">הקורסים שלי</div>
        ${html}
      </div>
    `;
  };

  // 2. Render Topics/Milestones List for a Course
  window.sfTutorCourse = function(courseId) {
    const wrap = document.getElementById('tutor-page-content');
    if (!wrap) return;
    const course = _courses().find(c => String(c.id) === String(courseId));
    if (!course) return;

    let ms = Array.isArray(course.milestones) ? course.milestones.slice() : [];
    ms.sort((a,b) => (a.date||'').localeCompare(b.date||''));

    const header = `
      <div style="padding: 24px 16px 16px; background:var(--surface); border-bottom:1px solid var(--border); margin-bottom:20px; position:sticky; top:0; z-index:10;">
        <div style="display:flex; align-items:center; gap:16px; max-width: 860px; margin: 0 auto;">
          <button onclick="sfRenderTutorCourses()" style="background:var(--surface2); border:1px solid var(--border); width:42px; height:42px; border-radius:14px; display:flex; align-items:center; justify-content:center; color:var(--text); cursor:pointer;">
            ${_iconBack}
          </button>
          <div>
            <div style="font-size:1.25rem; font-weight:900; color:var(--text); letter-spacing:-0.02em;">${_esc(course.name)}</div>
            <div style="font-size:0.85rem; color:var(--a-brand); font-weight:600;">בחר נושא לתרגול אישי</div>
          </div>
        </div>
      </div>
    `;

    let html = '';
    if (ms.length === 0) {
      html = `<div style="text-align:center; padding:30px; color:var(--muted); font-size:0.95rem; background:var(--surface2); border-radius:20px; margin:0 auto 20px; max-width: 860px;">לא הוגדרו אבני דרך לקורס זה.<br>הוסף נושאים כדי לתרגל מול ה-AI.</div>`;
    } else {
      html = ms.map((m, i) => {
        const isExam = m.type === 'exam';
        const isDone = !!m.done;
        return `
          <div onclick="sfTutorChat('${course.id}', '${m.id}')" style="background:var(--surface); border:1.5px solid var(--border); border-radius:18px; padding:16px; margin:0 auto 12px; max-width:860px; display:flex; align-items:center; gap:16px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,0.02); transition:transform 0.1s;">
            <div style="width:44px; height:44px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:${isDone ? 'var(--green-light)' : (isExam ? 'rgba(244,80,75,0.1)' : 'var(--surface2)')}; color:${isDone ? 'var(--green)' : (isExam ? '#f4504b' : 'var(--text)')}; font-weight:800; font-size:1.1rem;">
              ${isDone ? _iconCheck : (isExam ? _iconTarget : (i+1))}
            </div>
            <div style="flex:1;">
              <div style="font-size:1.05rem; font-weight:800; color:var(--text);">${_esc(isExam ? 'מבחן מסכם' : m.topic)}</div>
              ${m.date ? `<div style="font-size:0.8rem; color:var(--muted); margin-top:4px; font-weight:500;">${m.date}</div>` : ''}
            </div>
            <div style="color:var(--a-brand); opacity:0.8;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </div>
          </div>
        `;
      }).join('');
    }

    const freeHtml = `
      <div style="margin:30px auto 40px; max-width:860px; padding: 0 16px;">
        <button onclick="sfTutorFreeChat('${course.id}')" style="width:100%; padding:20px; border-radius:20px; border:none; background:linear-gradient(135deg, var(--a-brand), #8b5cf6); color:white; font-size:1.15rem; font-weight:900; display:flex; align-items:center; justify-content:center; gap:12px; cursor:pointer; box-shadow:0 8px 24px rgba(139, 92, 246, 0.35);">
          ${_iconSpark} חזרה כללית ומרתון
        </button>
      </div>
    `;

    wrap.innerHTML = header + `<div style="padding: 0 16px;">` + html + `</div>` + freeHtml;
  };

  // 3. FULL-SCREEN CHAT UI OVERLAY
  let _currentChatCtx = null;
  
  function _openChatUI(title, subtitle, historyRef, onSendFn, onBackFn) {
    let overlay = document.getElementById('tutor-chat-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tutor-chat-overlay';
      document.body.appendChild(overlay);
    }
    
    // Position fixed perfectly fills the viewport regardless of body scroll
    overlay.style.cssText = `
      position: fixed; top: 0; bottom: 0; left: 0; right: 0;
      background: var(--bg); z-index: 10000;
      display: flex; flex-direction: column;
      animation: sfFadeIn 0.25s ease-out;
    `;
    
    // Add keyframes if missing
    if (!document.getElementById('sfFadeInStyle')) {
       const st = document.createElement('style');
       st.id = 'sfFadeInStyle';
       st.innerHTML = `@keyframes sfFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`;
       document.head.appendChild(st);
    }

    overlay.innerHTML = `
      <!-- Header -->
      <div style="padding:16px 24px; background:var(--surface); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:center; position:relative; box-shadow:0 2px 10px rgba(0,0,0,0.02); flex-shrink:0;">
        <button id="tutor-chat-close" style="position:absolute; right:16px; background:transparent; border:none; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--text); cursor:pointer;">
          ${_iconBack}
        </button>
        <div style="text-align:center;">
          <div style="font-size:1.15rem; font-weight:800; color:var(--text);">${_esc(title)}</div>
          <div style="font-size:0.85rem; color:var(--muted); font-weight:500;">${_esc(subtitle)}</div>
        </div>
      </div>
      
      <!-- Scrollable Chat Area -->
      <div id="tutor-chat-box" style="flex:1; overflow-y:auto; padding:30px 16px; display:flex; flex-direction:column; scroll-behavior: smooth;">
      </div>
      
      <!-- Input Area -->
      <div style="padding:16px; background:var(--bg); border-top:1px solid var(--border); flex-shrink:0;">
        <div style="max-width:800px; margin:0 auto; background:var(--surface); border:1.5px solid var(--border); border-radius:28px; padding:6px 16px; display:flex; align-items:flex-end; gap:8px; box-shadow:0 4px 16px rgba(0,0,0,0.03); transition:border-color 0.2s;">
          
          <button id="tutor-chat-attach" style="background:transparent; border:none; color:var(--muted); width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; margin-bottom: 2px;">
            ${_iconClip}
          </button>
          <input type="file" id="tutor-file-inp" style="display:none;" accept=".txt,.csv,.json,.html,.md,.js,.py,.pdf,.png,.jpg,.jpeg">

          <textarea id="tutor-chat-input" style="flex:1; border:none; background:transparent; color:var(--text); padding:12px 4px; font-family:inherit; font-size:1.05rem; resize:none; outline:none; max-height:160px; line-height:1.5;" rows="1" placeholder="הקלד הודעה למורה..."></textarea>
          
          <button id="tutor-chat-send" style="background:linear-gradient(135deg, var(--a-brand), #8b5cf6); color:white; border:none; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; margin-bottom: 3px; box-shadow:0 4px 12px rgba(139, 92, 246, 0.25);">
            ${_iconSend}
          </button>
        </div>
        <div style="text-align:center; font-size:0.75rem; color:var(--muted); margin-top:8px; font-weight:500;">AI Tutor עשוי להציג מידע לא מדויק.</div>
      </div>
    `;

    document.getElementById('tutor-chat-close').onclick = () => {
      overlay.remove(); // Destroy overlay on close
      if (onBackFn) onBackFn();
    };
    
    const inp = document.getElementById('tutor-chat-input');
    const send = document.getElementById('tutor-chat-send');
    const attachBtn = document.getElementById('tutor-chat-attach');
    const fileInp = document.getElementById('tutor-file-inp');
    
    attachBtn.onclick = () => fileInp.click();
    
    fileInp.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const type = file.type || file.name;
      
      const isText = type.includes('text') || type.includes('json') || type.endsWith('.md') || type.endsWith('.csv') || type.endsWith('.js') || type.endsWith('.py');
      
      if (!isText && (type.includes('pdf') || type.includes('image'))) {
        _toast('מסמכי PDF ותמונות ייתמכו בעתיד. בינתיים, העתק והדבק את הטקסט ישירות.');
        fileInp.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        inp.value += `\n\n[תוכן הקובץ: ${file.name}]\n` + text + `\n[סוף הקובץ]\n`;
        inp.style.height = 'auto';
        inp.style.height = (inp.scrollHeight < 160 ? inp.scrollHeight : 160) + 'px';
        _toast('הקובץ צורף בהצלחה!');
      };
      reader.onerror = () => _toast('שגיאה בקריאת הקובץ.');
      reader.readAsText(file);
      fileInp.value = '';
    };

    inp.addEventListener('input', function() {
       this.style.height = 'auto';
       this.style.height = (this.scrollHeight < 160 ? this.scrollHeight : 160) + 'px';
    });
    
    const doSend = () => {
       const text = inp.value.trim();
       if (!text) return;
       inp.value = ''; inp.style.height = 'auto';
       onSendFn(text);
    };
    
    send.onclick = doSend;
    inp.addEventListener('keydown', function(e) {
       if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });

    _renderChatMessages(historyRef);
  }

  function _renderChatMessages(historyRef, isLoading = false) {
    const box = document.getElementById('tutor-chat-box');
    if (!box) return;
    
    let html = '<div style="max-width:800px; margin:0 auto; width:100%; display:flex; flex-direction:column; gap:24px;">';
    
    historyRef.forEach(m => {
       if (m.role === 'system') return;
       const isUser = m.role === 'user';
       if (isUser) {
         html += `
           <div style="display:flex; justify-content:flex-end;">
             <div style="max-width:85%; padding:14px 20px; border-radius:24px; font-size:1.05rem; line-height:1.6; background:var(--surface); color:var(--text); border:1.5px solid var(--border); box-shadow:0 2px 10px rgba(0,0,0,0.02); border-bottom-right-radius:6px; font-weight:500;">
               ${_formatChat(m.content)}
             </div>
           </div>
         `;
       } else {
         html += `
           <div style="display:flex; justify-content:flex-start; gap:16px; padding:0 8px;">
             <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, var(--a-brand), #8b5cf6); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(139, 92, 246, 0.3);">
               ${_iconSpark}
             </div>
             <div style="flex:1; font-size:1.05rem; line-height:1.7; color:var(--text); padding-top:4px;">
               ${_formatChat(m.content)}
             </div>
           </div>
         `;
       }
    });
    
    if (isLoading) {
       html += `
         <div style="display:flex; justify-content:flex-start; gap:16px; padding:0 8px;">
             <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, var(--a-brand), #8b5cf6); color:white; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
               ${_iconSpark}
             </div>
             <div style="flex:1; padding-top:8px;">
               <span class="aiwp-shimmer" style="font-weight:600; color:var(--a-brand);">המורה חושב...</span>
             </div>
         </div>
       `;
    }
    
    html += '</div>';
    box.innerHTML = html;
    setTimeout(() => { box.scrollTop = box.scrollHeight; }, 10);
  }

  async function _handleSendAI(text, historyRef, ctx) {
    historyRef.push({ role: 'user', content: text });
    _save();
    _renderChatMessages(historyRef, true);
    
    if (!window.callAI) { _toast('מערכת ה-AI לא מחוברת'); _renderChatMessages(historyRef, false); return; }
    
    try {
      const reply = await window.callAI({ messages: historyRef, temperature: 0.65, maxTokens: 1500 });
      if (reply) {
         historyRef.push({ role: 'assistant', content: reply });
         _save();
      }
    } catch (e) {
      _toast('שגיאה בחיבור למורה, נסה שוב.');
    } finally {
      if (_currentChatCtx && _currentChatCtx.courseId === ctx.courseId) {
        _renderChatMessages(historyRef, false);
      }
    }
  }

  // 4. Milestone Specific Chat
  window.sfTutorChat = function(courseId, milestoneId) {
    const course = _courses().find(c => String(c.id) === String(courseId));
    if (!course) return;
    const ms = (course.milestones || []).find(m => String(m.id) === String(milestoneId));
    if (!ms) return;

    if (!Array.isArray(ms.tutorHistory)) {
      const isExam = ms.type === 'exam';
      const sysPrompt = `אתה מורה פרטי אישי (AI Tutor) מבריק וסבלני לסטודנט בקורס "${course.name}".
השיחה הזו מוקדשת אך ורק לנושא: "${isExam ? 'הכנה למבחן מסכם' : ms.topic}".
ההנחיות שלך למורה אפקטיבי:
1. היה חם, מעודד וסבלני. פנה אל התלמיד בגובה העיניים והענק תחושת ביטחון.
2. במקום לתת תשובות סופיות, השתמש בשיטה הסוקראטית - שאל שאלות מנחות שיעזרו לתלמיד להגיע לתשובה בעצמו.
3. הבא דוגמאות יומיומיות שמפשטות את החומר.
4. ${isExam ? 'מכיוון שזהו המבחן, הצע שאלות תרגול מהירות ומאתגרות, ממש כמו סימולציה. תן פידבק מפורט על כל טעות.' : 'הישאר ממוקד בנושא זה בלבד.'}
5. אם התלמיד מצרף קובץ למשימה (המופיע בתוך סוגריים מרובעים [תוכן הקובץ: ...]), התייחס לטקסט שהוא מכיל, סרוק אותו וסייע לתלמיד להבין אותו, למצוא שגיאות בקוד או בחיבור, או לענות על שאלות מתוכו.
6. ענה בעברית טבעית ונעימה (עם אימוג'ים בטעם טוב).`;
      
      ms.tutorHistory = [{ role: 'system', content: sysPrompt }];
      _save();
    }

    _currentChatCtx = { courseId: course.id, milestoneId: ms.id, history: ms.tutorHistory };

    _openChatUI(
      course.name, 
      ms.type === 'exam' ? 'הכנה למבחן' : ms.topic, 
      ms.tutorHistory, 
      (txt) => _handleSendAI(txt, ms.tutorHistory, _currentChatCtx)
    );

    if (ms.tutorHistory.length === 1) _handleSendAI('שלום! אני המורה הפרטי שלך לנושא הזה. מאיפה נרצה להתחיל?', ms.tutorHistory, _currentChatCtx);
  };

  // 5. Free Practice / General Chat
  window.sfTutorFreeChat = function(courseId) {
    const course = _courses().find(c => String(c.id) === String(courseId));
    if (!course) return;

    if (!Array.isArray(course.tutorHistory)) {
      const completed = (course.milestones || []).filter(m => m.done).map(m => m.topic).join(', ');
      const sysPrompt = `אתה מורה פרטי מומחה ומוביל לקורס "${course.name}".
זוהי שיחת תרגול פתוחה וחופשית. הסטודנט יכול לשאול הכל.
לידיעתך, הסטודנט כבר סיים ללמוד את הנושאים הבאים: ${completed || 'עדיין לא סומנו נושאים שנלמדו'}.
מטרתך:
1. לספק תחושת הצלחה והתקדמות לתלמיד.
2. לעזור לו לבצע אינטגרציה בין כל הנושאים שלמד.
3. אם התלמיד מצרף קבצים (קוד, תרגילים, טקסט) - נתח אותם בסבלנות, הראה לו איפה הטעויות ואל תפתור במקומו אלא אם הוא מתקשה מאוד.
4. השתמש בשפה חיובית, מעצימה ומקצועית.`;

      course.tutorHistory = [{ role: 'system', content: sysPrompt }];
      _save();
    }

    _currentChatCtx = { courseId: course.id, milestoneId: 'free', history: course.tutorHistory };

    _openChatUI(
      course.name, 
      'תרגול חופשי ומרתון', 
      course.tutorHistory, 
      (txt) => _handleSendAI(txt, course.tutorHistory, _currentChatCtx)
    );

    if (course.tutorHistory.length === 1) _handleSendAI('היי! אני מוכן למרתון ותרגול הכללי שלנו. מה נתרגל היום?', course.tutorHistory, _currentChatCtx);
  };

  // Entry from the syllabus / milestone "מורה פרטי" buttons → open the full tutor page.
  window.sfOpenTutor = function(courseId) {
    if (!isP()) { if (window.AIWP && AIWP.openPaywall) AIWP.openPaywall(); return; }
    if (window.showPage) window.showPage('tutor', null);
    sfTutorCourse(courseId);
  };

})();
