/* ============================================================
   بخش‌های ۱-۴: توابع کمکی، تاریخ جلالی، تجزیه نام گزینه و ستون‌های واچ‌لیست
   منبع: option-ver16.html
   ============================================================ */
/* ==================================================================
   ۱) ابزارها
   ================================================================== */
const $ = s => document.querySelector(s);
function toNum(v){
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim();
  s = s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  s = s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  s = s.replace(/[,\s\u066c\u200c\u00a0]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function fmt(n, d = 2){
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
const fmt0 = n => fmt(n, 0);
function escapeAttr(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeHtml(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/* ---------- single source of truth: annualization + option return ---------- */
function getAnnualMode(){
  try { return (state && state.ccAnnualMode === 'linear') ? 'linear' : 'compound'; }
  catch(e){ return 'compound'; }
}
function annualizePct(pct, days, mode){
  if (pct === null || pct === undefined || !isFinite(pct)) return null;
  if (!(days > 0)) return null;
  const m = mode || getAnnualMode();
  if (m === 'linear') return pct * 365 / days;
  const base = 1 + pct / 100;
  if (base <= 0) return null;
  const out = (Math.pow(base, 365 / days) - 1) * 100;
  return isFinite(out) ? out : null;
}
function effectiveAnnualRate(periodReturn, days, mode){
  if (periodReturn === null || periodReturn === undefined) return null;
  if (!isFinite(periodReturn)) return null;
  const pct = annualizePct(periodReturn * 100, days, mode);
  return pct === null ? null : pct / 100;
}
function optionFee(S, P, cfg){
  if (!cfg || !cfg.apply) return 0;
  const rate = (Number(cfg.feePct) || 0) / 100;
  if (!(rate > 0)) return 0;
  return rate * S + (cfg.feeOnPremium ? rate * P : 0);
}
/* one option position: S = underlying, P = option premium, denominator = S - P everywhere */
function optionReturn(K, S, P, fee, days, annualMode){
  const netPremium = P - (fee || 0);
  const denom = S - P;
  const out = { netPremium, denom, costBasis: S - netPremium, valid: false,
                profit: null, retPct: null, annPct: null, retFrac: null, annFrac: null };
  if (!isFinite(denom) || denom === 0) return out;
  out.valid = true;
  out.profit = K - S + netPremium;
  out.retPct = (out.profit / denom) * 100;
  out.annPct = annualizePct(out.retPct, days, annualMode);
  out.retFrac = out.retPct / 100;
  out.annFrac = (out.annPct === null) ? null : out.annPct / 100;
  return out;
}
function optionPremiumReturn(netPremium, S, P, days, annualMode){
  const denom = S - P;
  if (!isFinite(denom) || denom === 0) return { pct: null, ann: null };
  const pct = (netPremium / denom) * 100;
  return { pct, ann: annualizePct(pct, days, annualMode) };
}

/* ==================================================================
   ۲) تبدیل تاریخ شمسی
   ================================================================== */
function jalaliToGregorian(jy, jm, jd){
  let jy2 = jy + 1595;
  let days = -355668 + (365 * jy2) + (Math.floor(jy2 / 33) * 8)
           + Math.floor(((jy2 % 33) + 3) / 4) + jd
           + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  let gy = 400 * Math.floor(days / 146097); days %= 146097;
  if (days > 36524){ gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365){ gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
  const sal = [0,31, leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  let gm = 1;
  for (; gm <= 12; gm++){ if (gd <= sal[gm]) break; gd -= sal[gm]; }
  return [gy, gm, gd];
}
function parseJalaliDate(s){
  if (!s) return null;
  s = String(s).trim().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  let m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return [+m[1], +m[2], +m[3]];
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return [+m[1], +m[2], +m[3]];
  m = s.match(/^(\d{2})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return [1400 + +m[1], +m[2], +m[3]];
  return null;
}

function normalizeExpiryStr(s){
  const raw = String(s == null ? '' : s).trim();
  const d = parseJalaliDate(raw.replace(/[-\s]+/g, '/'));
  if (!d) return raw;
  return d[0] + '/' + String(d[1]).padStart(2, '0') + '/' + String(d[2]).padStart(2, '0');
}
/* monotone numeric key for expiry compare/sort (no lexicographic compares) */
function expiryKey(s){
  const d = parseJalaliDate(String(s == null ? '' : s).trim().replace(/[-\s]+/g, '/'));
  if (!d) return 0;
  return d[0] * 10000 + d[1] * 100 + d[2];
}
function sortExpiries(list){
  const uniq = [...new Set(list.map(x => normalizeExpiryStr(x)))];
  return uniq.sort((a, b) => expiryKey(a) - expiryKey(b));
}
function daysToExpiry(expiry){
  if (!expiry) return 0;
  const [jy, jm, jd] = expiry;
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  const target = new Date(gy, gm - 1, gd); target.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const d = Math.round((target - today) / 86400000);
  return d > 0 ? d : 0;
}

/* ==================================================================
   ۳) تجزیه نام اختیار
   ================================================================== */
function parseOptionName(name){
  if (!name) return null;
  let n = String(name).replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
  let type = null, rest = '';
  if (/اختيارخ|اختیارخ/.test(n)){ type = 'call'; rest = n.split(/اختيارخ|اختیارخ/)[1] || ''; }
  else if (/اختيارف|اختیارف/.test(n)){ type = 'put'; rest = n.split(/اختيارف|اختیارف/)[1] || ''; }
  else return null;
  rest = rest.replace(/^[\s\-–—]+/, '').trim();
  const parts = rest.split('-').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const underlying = parts[0];
  let strike = 0, i = 1;
  const digitMap = {'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  const cleanNum = parts[1].replace(/[۰-۹٠-٩]/g, d => digitMap[d] || d).replace(/[,،٬\u066C]/g, '');
  if (/^\d+(\.\d+)?$/.test(cleanNum)){ strike = parseFloat(cleanNum); i = 2; }
  else {
    for (let j = 1; j < parts.length; j++){
      const c = parts[j].replace(/[۰-۹٠-٩]/g, d => digitMap[d] || d).replace(/[,،٬\u066C]/g, '');
      if (/^\d+(\.\d+)?$/.test(c)){ strike = parseFloat(c); i = j + 1; break; }
    }
  }
  const expiryRaw = parts.slice(i).join('-');
  const expiry = parseJalaliDate(expiryRaw.replace(/[-\s]+/g, '/'));
  const expiryStr = normalizeExpiryStr(expiryRaw);
  return { type, underlying, strike, expiry, expiryStr, expiryRaw };
}

/* ==================================================================
   ۴) ستون‌های دیده‌بان
   ================================================================== */
const WL_COLUMN_DEFS = [
  { id: 'idx',          label: '#',                    group: null,               fixed: true },
  { id: 'sym',          label: 'نماد',                 group: null,               default: true },
  { id: 'name',         label: 'شرح',                  group: null,               default: true },
  { id: 'underlying',   label: 'دارایی پایه',          group: null,               default: true },
  { id: 'type',         label: 'نوع',                  group: null,               default: true },
  { id: 'fund',         label: 'صندوق',                group: null,               default: true },
  { id: 'tvol',         label: 'حجم معاملات',          group: null,               default: false },
  { id: 'tno',          label: 'تعداد معاملات',        group: null,               default: false },
  { id: 'strike',       label: 'قیمت اعمال',           group: null,               default: true },
  { id: 'price',        label: 'آخرین قیمت',           group: null,               default: true },
  { id: 'S',            label: 'قیمت پایه',            group: null,               default: true },
  { id: 'expiryStr',    label: 'تاریخ',                group: 'سررسید',           default: true },
  { id: 'days',         label: 'روز',                  group: 'سررسید',           default: true },
  { id: 'status',       label: 'وضعیت',                group: null,               default: true },
  { id: 'deep',         label: 'مقدار',                group: 'deep in the money', default: true },
  { id: 'deepPct',      label: '% (سالانه)',           group: 'deep in the money', default: true },
  { id: 'deepDailyPct', label: '% روزانه',             group: 'deep in the money', default: true },
  { id: 'fuel',         label: 'مقدار',                group: 'سوخت',             default: true },
  { id: 'fuelPct',      label: '% (سالانه)',           group: 'سوخت',             default: true },
  { id: 'fuelDailyPct', label: '% روزانه',             group: 'سوخت',             default: true }
];
const WL_TEMPLATES = {
  full: {sym:true,name:true,underlying:true,type:true,fund:true,strike:true,price:true,S:true,expiryStr:true,days:true,status:true,deep:true,deepPct:true,deepDailyPct:true,fuel:true,fuelPct:true,fuelDailyPct:true},
  compact: {sym:true,type:true,fund:true,strike:true,price:true,days:true,status:true,deep:true,fuel:true},
  deepitm: {sym:true,underlying:true,type:true,fund:true,strike:true,price:true,S:true,days:true,status:true,deep:true,deepPct:true,deepDailyPct:true},
  sookht: {sym:true,underlying:true,type:true,fund:true,price:true,S:true,days:true,status:true,fuel:true,fuelPct:true,fuelDailyPct:true},
  trading: {sym:true,name:true,underlying:true,type:true,fund:true,tvol:true,tno:true,price:true,days:true}
};
const DEFAULT_COL_WIDTHS = {idx:48,sym:110,name:190,underlying:95,type:72,fund:80,tvol:100,tno:100,strike:100,price:100,S:100,expiryStr:100,days:62,status:72,deep:100,deepPct:100,deepDailyPct:100,fuel:100,fuelPct:100,fuelDailyPct:100};
const WL_SORT_GETTERS = {
  idx:(r,i)=>i, sym:r=>r.sym, name:r=>r.name, underlying:r=>r.underlying,
  type:r=>(r.type==='call'?0:1), fund:r=>(r.fund?1:0),
  tvol:r=>r.tvol, tno:r=>r.tno, strike:r=>r.strike, price:r=>r.price,
  S:r=>r.S, expiryStr:r=>r.expiryStr, days:r=>r.days, status:r=>r.status,
  deep:r=>r.deep, deepPct:r=>r.deepPct, deepDailyPct:r=>r.deepDailyPct,
  fuel:r=>r.fuel, fuelPct:r=>r.fuelPct, fuelDailyPct:r=>r.fuelDailyPct
};
function defaultActiveCols(){
  const obj = {};
  WL_COLUMN_DEFS.forEach(c => {
    if (c.fixed) obj[c.id] = true;
    else obj[c.id] = (c.default !== undefined) ? !!c.default : true;
  });
  return obj;
}
function loadActiveCols(){
  const base = defaultActiveCols();
  try {
    const saved = JSON.parse(localStorage.getItem('wlActiveCols') || 'null');
    if (saved && typeof saved === 'object'){
      Object.keys(base).forEach(k => { if (k === 'idx') return; if (k in saved) base[k] = !!saved[k]; });
    }
  } catch(e){}
  return base;
}
function saveActiveCols(){ try { localStorage.setItem('wlActiveCols', JSON.stringify(state.wlActiveCols)); } catch(e){} }
function loadSort(){
  try {
    const s = JSON.parse(localStorage.getItem('wlSort') || 'null');
    if (s && typeof s === 'object'){
      const dir = s.direction === 'desc' ? 'desc' : 'asc';
      return { column: s.column || null, direction: dir };
    }
  } catch(e){}
  return { column: null, direction: 'asc' };
}
function saveSort(){ try { localStorage.setItem('wlSort', JSON.stringify(state.wlSort)); } catch(e){} }
function loadColWidths(){
  try { const s = JSON.parse(localStorage.getItem('wlColWidths') || 'null'); if (s && typeof s === 'object') return s; } catch(e){}
  return {};
}
function saveColWidths(){ try { localStorage.setItem('wlColWidths', JSON.stringify(state.wlColWidths)); } catch(e){} }

