// ===== shared helpers — state travels between pages via URL query params =====
// (no backend yet, so this is how "quiz-app" pages hand off data to each other)

const QuizApp = {
  getParam(name, fallback = ''){
    const val = new URLSearchParams(window.location.search).get(name);
    return val === null ? fallback : val;
  },

  buildUrl(page, params){
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if(v !== undefined && v !== null && v !== '') usp.set(k, v);
    });
    return `${page}?${usp.toString()}`;
  },

  encodeQuiz(questions){
    return encodeURIComponent(JSON.stringify(questions));
  },

  decodeQuiz(str){
    try{ return JSON.parse(decodeURIComponent(str)); }
    catch(e){ return null; }
  },

  generateRoomCode(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for(let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  // fallback quiz used wherever a page is opened directly without upstream quiz data
  sampleQuiz(topic = 'General Knowledge'){
    return [
      { text: `Sample question 1 about ${topic}`, options: ['Option A','Option B','Option C','Option D'], correct: 0 },
      { text: `Sample question 2 about ${topic}`, options: ['Option A','Option B','Option C','Option D'], correct: 1 },
      { text: `Sample question 3 about ${topic}`, options: ['Option A','Option B','Option C','Option D'], correct: 2 },
    ];
  }
};

// ---------- anti-copy / fullscreen lock (shared by host-live & play-quiz) ----------
function initAntiCopyLock(logFn){
  let violationCount = 0;
  let lockActive = false;
  const log = logFn || function(){};

  function updateBanner(){
    const el = document.getElementById('violation-count');
    if(el) el.textContent = violationCount;
  }

  function recordViolation(reason){
    if(!lockActive) return;
    violationCount++;
    updateBanner();
    log(`<span style="color:var(--red)">⚠</span> violation: ${reason} <span class="comment">(#${violationCount})</span>`);
  }

  function requestFullscreen(el){
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if(req) return req.call(el);
    return Promise.reject('Fullscreen API not supported');
  }

  function blockContextMenu(e){ e.preventDefault(); }

  function blockKeys(e){
    const k = e.key ? e.key.toLowerCase() : '';
    const blockCombo =
      ((e.ctrlKey || e.metaKey) && ['c','x','v','u','p','s'].includes(k)) ||
      (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(k)) ||
      k === 'f12' || k === 'printscreen';
    if(blockCombo){
      e.preventDefault();
      recordViolation(`blocked shortcut (${e.key})`);
    }
  }

  function onFullscreenChange(){
    const inFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if(lockActive && !inFullscreen) recordViolation('exited full-screen');
  }

  function onVisibilityChange(){
    if(lockActive && document.hidden) recordViolation('switched tab / window');
  }

  return {
    engage(){
      lockActive = true;
      violationCount = 0;
      updateBanner();
      document.body.classList.add('anti-copy-active');
      const banner = document.getElementById('lock-banner');
      if(banner) banner.classList.add('show');

      requestFullscreen(document.documentElement).catch(() => {
        log('<span style="color:var(--red)">⚠</span> full-screen request was blocked by the browser');
      });

      document.addEventListener('contextmenu', blockContextMenu);
      document.addEventListener('keydown', blockKeys);
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', onFullscreenChange);
      document.addEventListener('visibilitychange', onVisibilityChange);

      log('<span class="ok">✓</span> anti-copy lock engaged — full-screen, copy, right-click and dev-tools are now blocked');
    },
    disengage(){
      lockActive = false;
      document.body.classList.remove('anti-copy-active');
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockKeys);
      if(document.fullscreenElement) document.exitFullscreen?.();
    },
    get violations(){ return violationCount; }
  };
}
