/* ============================================================
   بخش ۳۲: همگام‌سازی ابری — دیتابیس مشترک روی GitHub
   ------------------------------------------------------------
   موقعیت‌های باز و بسته‌شده در ریپوی «reza681/option1»
   (فایل data.json) ذخیره می‌شوند تا همهٔ کاربران برنامه
   یک نسخهٔ مشترک و به‌روز ببینند:

   • خواندن: بدون توکن — هر کسی برنامه را باز کند داده را می‌بیند
   • نوشتن: با Personal Access Token دارای دسترسی
     «Contents: Read and write» روی ریپوی option1
     (راهنمای ساخت توکن داخل پنجرهٔ همگام‌سازی است)

   خط‌مشی نسخه‌ها: «آخرین ارسال، معتبر است»؛ اگر هم دادهٔ محلی
   و هم ابر هم‌زمان تغییر کرده باشند، هشدار تضاد نمایش داده
   می‌شود تا کاربر تصمیم بگیرد.
   ============================================================ */
(function(){
'use strict';

/* ---------- ۱) تنظیمات ابری ---------- */
var CLOUD = {
  owner:  'reza681',
  repo:   'option1',
  branch: 'main',
  path:   'data.json'
};
var RAW_URL  = 'https://raw.githubusercontent.com/' + CLOUD.owner + '/' + CLOUD.repo + '/' + CLOUD.branch + '/' + CLOUD.path;
var API_URL  = 'https://api.github.com/repos/' + CLOUD.owner + '/' + CLOUD.repo + '/contents/' + CLOUD.path;
var REPO_WEB = 'https://github.com/' + CLOUD.owner + '/' + CLOUD.repo;

var CFG_KEY   = 'cloudSyncCfg';         /* {token, userName, autoPull, autoPush, lastSync, lastPull, lastPush, lastError, lastConflictAt, lastConflictRemote} */
var DIRTY_KEY = 'cloudLocalUpdatedAt';  /* آخرین لحظهٔ تغییر دادهٔ محلی (ms) */
var POLL_MS           = 5 * 60 * 1000;  /* دریافت دوره‌ای: هر ۵ دقیقه */
var PUSH_DEBOUNCE_MS  = 4000;           /* ارسال خودکار: ۴ ثانیه بعد از آخرین تغییر */

var CS = {
  busy: false,          /* یک عملیات ابری در جریان است */
  applying: false,      /* در حال اعمال دادهٔ ابری روی state (ارسال خودکار نشود) */
  origPersist: null,    /* تابع اصلی persistPositionBook */
  pushTimer: null,
  pollTimer: null
};

/* ---------- ۲) ابزارهای کوچک ---------- */
function escHtml(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function getCfg(){
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch(e){ return {}; }
}
function setCfg(patch){
  try {
    var c = getCfg();
    for (var k in patch) c[k] = patch[k];
    localStorage.setItem(CFG_KEY, JSON.stringify(c));
  } catch(e){}
}
function getToken(){ return String(getCfg().token || '').trim(); }
function hasToken(){ return getToken().length > 10; }
function getDirtyAt(){
  var v = Number(localStorage.getItem(DIRTY_KEY));
  return isFinite(v) ? v : 0;
}
function setDirtyAt(ms){ try { localStorage.setItem(DIRTY_KEY, String(ms)); } catch(e){} }
function fmtFa(ms){
  if (!ms) return '—';
  try { return new Date(ms).toLocaleString('fa-IR', { hour12: false }); } catch(e){ return '—'; }
}
function localHasData(){
  return ((typeof state !== 'undefined' && state.savedPositions) || []).length > 0 ||
         ((typeof state !== 'undefined' && state.closedStrategies) || []).length > 0;
}
function summaryText(){
  var open = ((typeof state !== 'undefined' && state.savedPositions) || []).length;
  var closed = ((typeof state !== 'undefined' && state.closedStrategies) || []).length;
  return open + ' موقعیت باز، ' + closed + ' استراتژی بسته';
}
function utf8ToB64(str){
  var bytes = new TextEncoder().encode(str);
  var bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/* ---------- ۳) ارتباط با GitHub ---------- */
/* خواندن از CDN عمومی — بدون توکن و بدون محدودیت جدی (حداکثر ۵ دقیقه تأخیر تازگی) */
async function cloudRead(){
  var res = await fetch(RAW_URL + '?v=' + Date.now(), { cache: 'no-store' });
  if (res.status === 404) return null;              /* دیتابیس ابری هنوز خالی است */
  if (!res.ok) throw new Error('HTTP ' + res.status);
  var text = await res.text();
  if (!text || text.trim().charAt(0) !== '{') return null;
  return JSON.parse(text);
}
/* نوشتن در فایل دیتابیس از طریق GitHub API — نیاز به توکن */
async function cloudWrite(payload){
  var token = getToken();
  if (!token) throw new Error('توکن ذخیره نشده است');

  var authHeaders = {
    'Accept': 'application/vnd.github+json',
    'Authorization': 'Bearer ' + token,
    'X-GitHub-Api-Version': '2022-11-28'
  };

  /* SHA فایل فعلی (برای به‌روزرسانی) — با یک تلاش مجدد روی 409 */
  var attempt, sha = null;
  for (attempt = 0; attempt < 2; attempt++){
    sha = null;
    try {
      var head = await fetch(API_URL + '?ref=' + CLOUD.branch + '&_ts=' + Date.now(), { headers: authHeaders, cache: 'no-store' });
      if (head.ok) sha = (await head.json()).sha;
      else if (head.status !== 404 && head.status !== 409){
        var hm = 'HTTP ' + head.status;
        try { hm = (await head.json()).message || hm; } catch(e){}
        throw new Error('خواندن وضعیت دیتابیس: ' + hm);
      }
    } catch(e){ if (String(e.message).indexOf('HTTP') === 0) throw e; }

    var body = {
      message: 'به‌روزرسانی موقعیت‌ها — ' + new Date().toLocaleString('fa-IR', { hour12: false }),
      branch: CLOUD.branch,
      content: utf8ToB64(JSON.stringify(payload, null, 2))
    };
    if (sha) body.sha = sha;

    var res = await fetch(API_URL, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders),
      body: JSON.stringify(body)
    });
    if (res.ok) return true;
    if (res.status === 409 && attempt === 0) continue; /* SHA قدیمی شده — یک‌بار دیگر */
    var msg = 'HTTP ' + res.status;
    try { msg = (await res.json()).message || msg; } catch(e){}
    if (res.status === 401) msg = 'توکن نامعتبر است — دوباره ذخیره کنید';
    else if (res.status === 403) msg = 'توکن اجازهٔ نوشتن ندارد یا سهمیهٔ API تمام شده — ' + msg;
    else if (res.status === 404) msg = 'دیتابیس پیدا نشد — توکن باید دسترسی به ریپوی ' + CLOUD.owner + '/' + CLOUD.repo + ' داشته باشد';
    throw new Error(msg);
  }
  throw new Error('نوشتن پس از تلاش مجدد هم ناموفق بود');
}

/* ---------- ۴) ساخت و اعمال داده ---------- */
function normRemotePos(p){
  if (!p || typeof p !== 'object') return null;
  if (!p.id) p.id = 'rp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  if (!p.strategyName) p.strategyName = (p.type === 'underlying') ? (p.sym || 'بدون نام') : 'بدون نام';
  return p;
}
function buildPayload(t){
  return {
    app: 'option-strategy-panel',
    cloud: 1,
    updatedAt: new Date(t).toISOString(),
    updatedBy: (getCfg().userName || 'کاربر'),
    count: (state.savedPositions || []).length,
    closedCount: (state.closedStrategies || []).length,
    data: {
      positions: state.savedPositions || [],
      closedStrategies: state.closedStrategies || []
    }
  };
}
function applyRemote(remote){
  CS.applying = true;
  try {
    var d = (remote && remote.data) || {};
    var positions = (Array.isArray(d.positions) ? d.positions : []).map(normRemotePos).filter(Boolean);
    var closed = Array.isArray(d.closedStrategies) ? d.closedStrategies : [];
    state.savedPositions = positions;
    state.closedStrategies = closed;
    if (CS.origPersist) { try { CS.origPersist(positions, closed); } catch(e){} }
    var t = Date.parse(remote && remote.updatedAt) || Date.now();
    setDirtyAt(t);
    setCfg({ lastSync: t, lastPull: Date.now(), lastError: null, lastConflictAt: null, lastConflictRemote: 0 });
    rerenderAfterData();
  } finally { CS.applying = false; }
}
function rerenderAfterData(){
  try { syncStrategyNames(); } catch(e){}
  var b = document.getElementById('rpBadge');
  if (b) b.textContent = (state.savedPositions || []).length;
  var rp = document.querySelector('[data-panel="report"]');
  if (rp && !rp.classList.contains('hidden')){ try { renderReportPanel(); } catch(e){ console.warn(e); } }
  var ld = document.querySelector('[data-panel="ledger"]');
  if (ld && !ld.classList.contains('hidden')){ try { renderPositionLedger(); } catch(e){ console.warn(e); } }
}

/* ---------- ۵) دریافت و ارسال ---------- */
async function doPull(opts){
  var o = Object.assign({ auto: false, force: false }, opts || {});
  if (CS.busy) return;
  CS.busy = true; refreshStatus();
  var shouldSeed = false;
  try {
    var remote = await cloudRead();
    if (!remote){
      if (o.auto){
        /* ابر خالی است — اگر توکن و داده داریم، اولین بار خودمان منتشر کنیم */
        if (hasToken() && localHasData()) shouldSeed = true;
      } else {
        toast('☁️ دیتابیس ابری خالی است — با «ارسال به ابر» داده‌های این دستگاه را منتشر کنید.', 'warn', 6000);
      }
      setCfg({ lastPull: Date.now(), lastError: null });
      return;
    }
    var remoteAt = Date.parse(remote.updatedAt || '') || 0;
    var dirty = getDirtyAt();
    var lastSync = getCfg().lastSync || 0;
    var localUnsynced = localHasData() && dirty > lastSync;

    if (o.auto && !o.force){
      /* خودکار فقط وقتی اعمال می‌شود که ابر واقعاً جدیدتر از هم نسخهٔ محلی و هم
         آخرین همگام‌سازی باشد (مقاوم در برابر اختلاف ساعت دستگاه‌ها) */
      if (remoteAt <= dirty || remoteAt <= lastSync){ setCfg({ lastPull: Date.now(), lastError: null }); return; }
      if (localUnsynced){ notifyConflict(remoteAt); return; }
      applyRemote(remote);
      toast('⬇ داده‌های جدید ابری دریافت شد — ' + summaryText(), 'ok', 5000);
    } else {
      /* دریافت دستی: دادهٔ ابری جایگزین محلی می‌شود */
      var destructive = localHasData() && (localUnsynced || dirty > remoteAt);
      if (destructive && !window.confirm(
        'دادهٔ ابری (به‌روزرسانی ' + fmtFa(remoteAt) + ') جایگزین دادهٔ محلی می‌شود\nو تغییرات محلیِ جدیدتر از بین می‌رود.\n\nادامه می‌دهید؟'
      )) return;
      applyRemote(remote);
      toast('⬇ داده‌های ابر دریافت شد — ' + summaryText(), 'ok', 5000);
    }
  } catch(e){
    setCfg({ lastError: String((e && e.message) || e) });
    if (!o.auto) toast('✗ دریافت از ابر ناموفق: ' + ((e && e.message) || e), 'err', 7000);
    console.warn('[cloud-sync] pull:', e);
  } finally {
    CS.busy = false;
    refreshStatus();
    if (shouldSeed){ clearTimeout(CS.pushTimer); CS.pushTimer = setTimeout(function(){ doPush('auto'); }, 600); }
  }
}

async function doPush(kind){
  if (CS.busy) return;
  if (!hasToken()){
    toast('🔑 برای ارسال به ابر، ابتدا توکن GitHub را در پنجرهٔ همگام‌سازی ذخیره کنید.', 'err', 6000);
    openModal();
    return;
  }
  if (kind === 'manual' && !localHasData() && !window.confirm('هیچ داده‌ای روی این دستگاه نیست — فهرست خالی به ابر ارسال شود؟')) return;

  CS.busy = true; refreshStatus();
  var t = Date.now();
  try {
    await cloudWrite(buildPayload(t));
    setDirtyAt(t);
    setCfg({ lastSync: t, lastPush: t, lastError: null, lastConflictAt: null, lastConflictRemote: 0 });
    toast('✓ به ابر ارسال شد — دیگران با باز کردن برنامه همین داده‌ها را می‌بینند', 'ok', 4500);
  } catch(e){
    setCfg({ lastError: String((e && e.message) || e) });
    toast('✗ ارسال به ابر ناموفق: ' + ((e && e.message) || e), 'err', 8000);
    console.warn('[cloud-sync] push:', e);
  } finally {
    CS.busy = false; refreshStatus();
  }
}

function notifyConflict(remoteAt){
  setCfg({ lastConflictAt: Date.now(), lastConflictRemote: remoteAt || Date.now() });
  toast('⚠️ هم دادهٔ محلی و هم ابر تغییر کرده‌اند — از «همگام‌سازی ابری» یکی را انتخاب کنید.', 'err', 9000);
}

/* ارسال خودکار با تأخیر (پس از هر تغییر محلی) */
function schedulePush(){
  var c = getCfg();
  if (c.autoPush === false) return;
  if (!hasToken()) return;
  clearTimeout(CS.pushTimer);
  CS.pushTimer = setTimeout(function(){
    if (CS.busy) schedulePush();
    else doPush('auto');
  }, PUSH_DEBOUNCE_MS);
}

/* ---------- ۶) نقاط اتصال به برنامه ---------- */
function wrapPersist(){
  if (typeof window.persistPositionBook !== 'function') return;
  CS.origPersist = window.persistPositionBook;
  window.persistPositionBook = function(positions, closedStrategies){
    var r = CS.origPersist.apply(this, arguments);
    if (!CS.applying){
      setDirtyAt(Date.now());
      schedulePush();
      refreshStatus();
    }
    return r;
  };
}
function ensureBaseline(){
  /* اولین اجرا: دادهٔ محلی موجود را معتبر فرض می‌کنیم تا دادهٔ قدیمیِ ابر
     نتواند بی‌خورد آن را جایگزین کند. اگر محلی خالی باشد، ابر ملاک است. */
  if (localStorage.getItem(DIRTY_KEY) !== null) return;
  if (localHasData()){
    var t = Date.now();
    setDirtyAt(t);
    setCfg({ lastSync: t });
  } else {
    setDirtyAt(0);
    setCfg({ lastSync: 0 });
  }
}

/* ---------- ۷) رابط کاربری ---------- */
function injectStyles(){
  if (document.getElementById('cloudSyncStyles')) return;
  var st = document.createElement('style');
  st.id = 'cloudSyncStyles';
  st.textContent = [
    '/* دکمهٔ همگام‌سازی در منوی کنار */',
    '#cloudChip{display:flex;align-items:center;gap:9px;margin:10px 12px 4px;padding:10px 12px;border-radius:9px;cursor:pointer;color:rgba(255,255,255,.78);font-weight:700;font-size:13px;font-family:inherit;background:rgba(255,255,255,.05);border:1px dashed rgba(255,255,255,.22);transition:background .15s,color .15s;text-align:right;flex-shrink:0;width:calc(100% - 24px);box-sizing:border-box}',
    '#cloudChip:hover{background:rgba(255,255,255,.12);color:#fff}',
    '#cloudChip .ico{font-size:15px;flex-shrink:0}',
    '#cloudChip .lbl{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.cs-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.15)}',
    '.cs-dot.ok{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.15)}',
    '.cs-dot.bad{background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.15)}',
    '.cs-dot.busy{background:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.18);animation:csPulse 1s infinite}',
    '@keyframes csPulse{50%{opacity:.35}}',
    '@media (max-width:820px){#cloudChip{margin:0 6px;width:auto;padding:9px 11px;white-space:nowrap}#cloudChip .lbl{max-width:110px}}',
    '',
    '/* پنجرهٔ همگام‌سازی */',
    '#csOverlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10065;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);animation:csFade .15s ease}',
    '#csOverlay.hidden{display:none}',
    '#csModal{background:#fff;border-radius:16px;max-width:620px;width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 60px -15px rgba(15,23,42,.45);animation:csUp .2s ease;font-size:13px}',
    'html[data-theme="dark"] #csModal{background:#131f33}',
    '.cs-head{display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid var(--line);background:#fafbfc}',
    'html[data-theme="dark"] .cs-head{background:#0f1a2b}',
    '.cs-head h3{margin:0;font-size:15px;font-weight:800;color:var(--ink);flex:1}',
    '.cs-x{width:32px;height:32px;padding:0;border-radius:8px;font-size:15px;border:1px solid var(--line-2);background:var(--card);color:var(--ink-2);cursor:pointer;font-family:inherit;flex-shrink:0}',
    '.cs-x:hover{background:#fee2e2;color:#b91c1c;border-color:#fecaca}',
    '.cs-body{padding:16px 18px;overflow-y:auto;flex:1}',
    '',
    '.cs-banner{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:10px;font-weight:700;line-height:1.8;margin-bottom:12px;font-size:12.5px}',
    '.cs-banner.info{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}',
    '.cs-banner.warn{background:#fffbeb;border:1px solid #fde68a;color:#b45309}',
    '.cs-banner.err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}',
    'html[data-theme="dark"] .cs-banner.info{background:#16233a;border-color:#1e3a5f;color:#7db1f5}',
    'html[data-theme="dark"] .cs-banner.warn{background:#2a2313;border-color:#4a3a12;color:#e0b352}',
    'html[data-theme="dark"] .cs-banner.err{background:#331719;border-color:#5b2326;color:#f08a8a}',
    '',
    '.cs-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}',
    '@media (max-width:520px){.cs-cards{grid-template-columns:1fr}}',
    '.cs-card{background:var(--card);border:1px solid var(--line-2);border-radius:10px;padding:10px 12px}',
    '.cs-card .t{font-size:11px;color:var(--muted);font-weight:800;margin-bottom:3px}',
    '.cs-card .v{font-size:12.5px;color:var(--ink-2);font-weight:700}',
    '',
    '.cs-actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
    '.cs-btn{padding:10px 16px;border-radius:9px;border:1px solid var(--line-2);background:var(--card);color:var(--ink);font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:7px}',
    '.cs-btn:hover:not(:disabled){border-color:var(--primary);color:var(--primary)}',
    '.cs-btn:disabled{opacity:.55;cursor:progress}',
    '.cs-btn.primary{background:linear-gradient(135deg,var(--grad-from),var(--grad-to));color:#fff;border:none;box-shadow:0 6px 16px -6px rgba(37,99,235,.6)}',
    '.cs-btn.primary:hover:not(:disabled){filter:brightness(1.06);color:#fff}',
    '',
    '.cs-box{padding:12px 13px;background:var(--card);border:1px solid var(--line-2);border-radius:10px;margin-bottom:12px}',
    '.cs-box .lbl{font-size:12px;font-weight:800;color:var(--ink);margin-bottom:8px}',
    '.cs-checks{display:flex;flex-direction:column;gap:9px}',
    '.cs-checks label{display:flex;align-items:center;gap:9px;font-size:12.5px;font-weight:700;color:var(--ink-2);cursor:pointer;line-height:1.7}',
    '.cs-checks input{width:16px;height:16px;accent-color:var(--primary);cursor:pointer;flex-shrink:0}',
    '.cs-checks .hint{font-size:11px;color:var(--muted);font-weight:400}',
    '',
    '#csToken{width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--line-2);border-radius:9px;font-family:inherit;font-size:12.5px;background:var(--card);color:var(--ink);direction:ltr;text-align:left;outline:none;transition:.15s}',
    '#csToken:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(37,99,235,.15)}',
    '#csName{width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--line-2);border-radius:9px;font-family:inherit;font-size:12.5px;background:var(--card);color:var(--ink);outline:none;transition:.15s;margin-top:10px}',
    '#csName:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(37,99,235,.15)}',
    '.cs-token-row{display:flex;gap:8px;margin-top:9px;align-items:center;flex-wrap:wrap}',
    '.cs-token-row .state{font-size:11.5px;font-weight:700;color:var(--muted);margin-inline-start:auto}',
    '.cs-mini{padding:7px 13px;border-radius:8px;border:1px solid var(--line-2);background:var(--card);color:var(--ink-2);font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}',
    '.cs-mini:hover{border-color:var(--primary);color:var(--primary)}',
    '',
    '.cs-help summary{cursor:pointer;font-size:12px;font-weight:800;color:var(--primary);margin-top:10px;user-select:none}',
    '.cs-help .steps{margin:8px 0 0;padding-inline-start:20px;font-size:12px;color:var(--ink-2);line-height:2.1}',
    '.cs-help code, .cs-info code{background:var(--card);border:1px solid var(--line-2);border-radius:5px;padding:1px 6px;font-size:11.5px;direction:ltr;display:inline-block}',
    '',
    '.cs-info{font-size:11.5px;color:var(--muted);line-height:2;background:var(--card);border:1px solid var(--line-2);border-radius:10px;padding:10px 12px}',
    '.cs-info a{color:var(--primary);font-weight:800;text-decoration:none}',
    '.cs-info a:hover{text-decoration:underline}',
    '',
    '/* اعلان‌های کوچک */',
    '#csToasts{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:10070;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:min(92vw,600px)}',
    '.cs-toast{background:#0f172a;color:#fff;padding:10px 18px;border-radius:11px;font-size:12.5px;font-weight:700;box-shadow:0 10px 30px -8px rgba(0,0,0,.55);max-width:100%;text-align:center;line-height:1.7;animation:csUp .25s ease}',
    '.cs-toast.err{background:#b91c1c}',
    '.cs-toast.warn{background:#b45309}',
    '.cs-toast.ok{background:#166534}',
    '@keyframes csUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '@keyframes csFade{from{opacity:0}to{opacity:1}}'
  ].join('\n');
  document.head.appendChild(st);
}

function buildChip(){
  if (document.getElementById('cloudChip')) return;
  var nav = document.querySelector('.sidebar-nav');
  var chip = document.createElement('button');
  chip.id = 'cloudChip';
  chip.type = 'button';
  chip.title = 'همگام‌سازی ابری داده‌ها با GitHub';
  chip.innerHTML = '<span class="ico">☁️</span><span class="lbl">همگام‌سازی ابری</span><span class="cs-dot" id="cloudDot"></span>';
  chip.addEventListener('click', openModal);
  if (nav && nav.parentNode) nav.parentNode.insertBefore(chip, nav.nextSibling);
  else document.body.appendChild(chip);
}

function buildModal(){
  if (document.getElementById('csOverlay')) return;
  var ov = document.createElement('div');
  ov.id = 'csOverlay';
  ov.className = 'hidden';
  ov.innerHTML =
    '<div id="csModal" role="dialog" aria-modal="true" aria-labelledby="csTitle">' +
      '<div class="cs-head">' +
        '<span style="font-size:17px">☁️</span>' +
        '<h3 id="csTitle">همگام‌سازی ابری</h3>' +
        '<button class="cs-x" id="csClose" type="button" title="بستن">✕</button>' +
      '</div>' +
      '<div class="cs-body">' +
        '<div id="csBanner"></div>' +
        '<div class="cs-cards">' +
          '<div class="cs-card"><div class="t">آخرین دریافت از ابر</div><div class="v" id="csLastPull">—</div></div>' +
          '<div class="cs-card"><div class="t">آخرین ارسال به ابر</div><div class="v" id="csLastPush">—</div></div>' +
        '</div>' +
        '<div class="cs-actions">' +
          '<button class="cs-btn primary" id="csPushBtn" type="button">⬆ ارسال به ابر</button>' +
          '<button class="cs-btn" id="csPullBtn" type="button">⬇ دریافت از ابر</button>' +
        '</div>' +
        '<div class="cs-box"><div class="lbl">⚙️ خودکار</div>' +
          '<div class="cs-checks">' +
            '<label><input type="checkbox" id="csAutoPull" checked> دریافت خودکار هنگام باز کردن برنامه و هر ۵ دقیقه</label>' +
            '<label><input type="checkbox" id="csAutoPush" checked> ارسال خودکار چند ثانیه بعد از هر تغییر <span class="hint">(نیاز به توکن)</span></label>' +
          '</div>' +
        '</div>' +
        '<div class="cs-box"><div class="lbl">🔑 توکن GitHub — فقط برای ارسال (ذخیرهٔ داده در ابر)</div>' +
          '<input type="password" id="csToken" placeholder="github_pat_…" autocomplete="off" spellcheck="false">' +
          '<input type="text" id="csName" placeholder="نام شما (اختیاری — برای شناسایی ارسال‌ها، مثلاً: رضا)" autocomplete="off">' +
          '<div class="cs-token-row">' +
            '<button class="cs-mini" id="csSaveToken" type="button">ذخیره توکن</button>' +
            '<button class="cs-mini" id="csClearToken" type="button">حذف توکن</button>' +
            '<span class="state" id="csTokenState">—</span>' +
          '</div>' +
          '<details class="cs-help">' +
            '<summary>راهنمای ساخت توکن (۳ قدم)</summary>' +
            '<ol class="steps">' +
              '<li>به صفحهٔ <code>github.com/settings/personal-access-tokens/new</code> بروید (منوی Generate new token).</li>' +
              '<li><b>Repository access:</b> «Only select repositories» → ریپوی <code>' + escHtml(CLOUD.owner + '/' + CLOUD.repo) + '</code> را انتخاب کنید.</li>' +
              '<li><b>Permissions → Repository permissions → Contents:</b> روی <code>Read and write</code> بگذارید و توکن را بسازید.</li>' +
            '</ol>' +
            '<div style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.9">توکن فقط در مرورگر خودتان (localStorage) ذخیره می‌شود. اگر می‌خواهید دیگران هم بتوانند ویرایش و ارسال کنند، همین توکن را برایشان بفرستید تا در مرورگر خودشان وارد کنند.</div>' +
          '</details>' +
        '</div>' +
        '<div class="cs-info">' +
          '📌 <b>دیتابیس مشترک:</b> <a href="' + REPO_WEB + '" target="_blank" rel="noopener">' + escHtml(CLOUD.owner + '/' + CLOUD.repo) + '</a> — فایل <code>data.json</code><br>' +
          '• هر کسی برنامه را باز کند، آخرین داده‌های ابری را می‌بیند (بدون نیاز به توکن).<br>' +
          '• دادهٔ ابری روی CDN حداکثر تا ۵ دقیقه با تأخیر تازه می‌شود.<br>' +
          '• خط‌مشی نسخه‌ها: آخرین ارسالِ موفق، معتبر است.' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);

  document.getElementById('csClose').addEventListener('click', closeModal);
  ov.addEventListener('click', function(e){ if (e.target === ov) closeModal(); });
  document.getElementById('csPushBtn').addEventListener('click', function(){ doPush('manual'); });
  document.getElementById('csPullBtn').addEventListener('click', function(){ doPull({ auto: false, force: true }); });
  document.getElementById('csAutoPull').addEventListener('change', function(e){ setCfg({ autoPull: e.target.checked }); });
  document.getElementById('csAutoPush').addEventListener('change', function(e){ setCfg({ autoPush: e.target.checked }); });

  document.getElementById('csSaveToken').addEventListener('click', function(){
    var v = String(document.getElementById('csToken').value || '').trim();
    if (v && v.length < 10){ toast('این مقدار توکن به نظر کوتاه است — دوباره بررسی کنید.', 'err', 5000); return; }
    var name = String(document.getElementById('csName').value || '').trim();
    setCfg({ token: v, userName: name || getCfg().userName || '' });
    document.getElementById('csToken').value = '';
    toast(v ? 'توکن ذخیره شد ✓ — از این پس تغییرات خودکار به ابر ارسال می‌شود' : 'توکن حذف شد؛ فقط دادهٔ ابری را می‌بینید', 'ok', 5000);
    refreshStatus(true);
    if (v && getDirtyAt() > (getCfg().lastSync || 0)) schedulePush();
  });
  document.getElementById('csClearToken').addEventListener('click', function(){
    setCfg({ token: '' });
    document.getElementById('csToken').value = '';
    toast('توکن حذف شد — این دستگاه فقط می‌تواند دادهٔ ابری را ببیند.', 'warn', 5000);
    refreshStatus(true);
  });
  document.getElementById('csName').addEventListener('change', function(e){
    setCfg({ userName: String(e.target.value || '').trim() });
  });
}

function openModal(){
  var ov = document.getElementById('csOverlay');
  if (!ov) return;
  var c = getCfg();
  var tEl = document.getElementById('csToken');
  if (tEl) tEl.value = '';
  var nEl = document.getElementById('csName');
  if (nEl) nEl.value = c.userName || '';
  var ap = document.getElementById('csAutoPull');
  if (ap) ap.checked = (c.autoPull !== false);
  var au = document.getElementById('csAutoPush');
  if (au) au.checked = (c.autoPush !== false);
  ov.classList.remove('hidden');
  refreshStatus();
}
function closeModal(){
  var ov = document.getElementById('csOverlay');
  if (ov) ov.classList.add('hidden');
}

/* ---------- ۸) وضعیت و اعلان ---------- */
function statusInfo(){
  var c = getCfg();
  if (CS.busy) return { cls: 'info', icon: '⏳', text: 'در حال همگام‌سازی با ابر…' };
  if (c.lastConflictAt && localHasData() && getDirtyAt() > (c.lastSync || 0)){
    return { cls: 'err', icon: '⚠️', text: 'تضاد نسخه‌ها: هم دادهٔ محلی و هم ابر تغییر کرده‌اند. «دریافت از ابر» یا «ارسال به ابر» را انتخاب کنید. (آخرین دادهٔ ابری: ' + fmtFa(c.lastConflictRemote) + ')' };
  }
  if (!hasToken()){
    return localHasData()
      ? { cls: 'warn', icon: '🔑', text: 'بدون توکن — داده‌ها فقط روی همین مرورگر ذخیره می‌شوند و برای دیگران ارسال نمی‌شوند. برای اشتراک، توکن GitHub را وارد کنید.' }
      : { cls: 'warn', icon: '🔑', text: 'بدون توکن — این دستگاه فقط می‌تواند دادهٔ ابری را ببیند.' };
  }
  if (getDirtyAt() > (c.lastSync || 0)){
    return { cls: 'warn', icon: '⏫', text: 'تغییرات همگام‌سازی‌نشده دارید — چند ثانیه بعد از آخرین ویرایش، خودکار به ابر ارسال می‌شود (یا «ارسال به ابر» را بزنید).' };
  }
  if (c.lastError) return { cls: 'err', icon: '✗', text: 'آخرین خطا: ' + c.lastError };
  return { cls: 'info', icon: '✓', text: 'همگام است — داده‌های ابری و این دستگاه یکسان‌اند.' };
}
function refreshStatus(withModal){
  /* نقطهٔ وضعیت روی دکمهٔ منوی کنار */
  var dot = document.getElementById('cloudDot');
  var info = statusInfo();
  if (dot){
    dot.className = 'cs-dot ' + (CS.busy ? 'busy' : (info.cls === 'info' ? 'ok' : (info.cls === 'err' ? 'bad' : '')));
  }
  if (withModal || (document.getElementById('csOverlay') && !document.getElementById('csOverlay').classList.contains('hidden'))){
    var banner = document.getElementById('csBanner');
    if (banner) banner.innerHTML = '<div class="cs-banner ' + info.cls + '"><span>' + info.icon + '</span><span>' + escHtml(info.text) + '</span></div>';
    var c = getCfg();
    var lp = document.getElementById('csLastPull');
    if (lp) lp.textContent = fmtFa(c.lastPull);
    var lps = document.getElementById('csLastPush');
    if (lps) lps.textContent = hasToken() ? fmtFa(c.lastPush) : 'بدون توکن';
    var ts = document.getElementById('csTokenState');
    if (ts) ts.textContent = hasToken() ? 'ذخیره شده ✓' : 'وارد نشده';
    var pb = document.getElementById('csPushBtn');
    if (pb) pb.disabled = CS.busy;
    var pl = document.getElementById('csPullBtn');
    if (pl) pl.disabled = CS.busy;
  }
}
function toast(msg, type, ms){
  var wrap = document.getElementById('csToasts');
  if (!wrap){
    wrap = document.createElement('div');
    wrap.id = 'csToasts';
    document.body.appendChild(wrap);
  }
  var el = document.createElement('div');
  el.className = 'cs-toast ' + (type || '');
  el.textContent = msg;
  wrap.appendChild(el);
  while (wrap.children.length > 3) wrap.firstChild.remove();
  setTimeout(function(){
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 350);
  }, ms || 4000);
}

/* ---------- ۹) راه‌اندازی ---------- */
function init(){
  try {
    ensureBaseline();
    injectStyles();
    buildChip();
    buildModal();
    wrapPersist();
    refreshStatus();

    /* دریافت خودکار هنگام ورود */
    var c = getCfg();
    if (c.autoPull !== false) setTimeout(function(){ doPull({ auto: true }); }, 1500);

    /* دریافت دوره‌ای (وقتی برنامه در حال نمایش است) */
    CS.pollTimer = setInterval(function(){
      var cfgNow = getCfg();
      if (cfgNow.autoPull === false) return;
      if (document.visibilityState === 'visible' && !CS.busy) doPull({ auto: true });
    }, POLL_MS);

    /* برگشت آنلاین شدن شبکه */
    window.addEventListener('online', function(){
      setTimeout(function(){
        doPull({ auto: true });
        if (hasToken() && getDirtyAt() > (getCfg().lastSync || 0)) schedulePush();
      }, 1500);
    });

    /* کلید Esc برای بستن پنجره */
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape'){
        var ov = document.getElementById('csOverlay');
        if (ov && !ov.classList.contains('hidden')) closeModal();
      }
    });
  } catch(e){
    console.warn('[cloud-sync] init:', e);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
