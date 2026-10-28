/* ============================================================
   بخش‌های ۵-۷: وضعیت، دریافت داده و نرمال‌سازی
   ============================================================ */
/* ==================================================================
   ۵) وضعیت
   ================================================================== */
const state = {
  market: [], options: [], underlyingPrice: 0, ytm: 0.25,
  legs: [], report: null,
  underlyingsWithOptions: [],
  includeCollateral: true,
  includeFixedIncome: true, // <--- گزینه جدید
  wlApplyFee: true, wlNonFundFeePct: 1.5, wlFundFeePct: 0.3,
  wlActiveCols: null, wlActiveTemplate: null,
  wlSort: { column: null, direction: 'asc' }, wlColWidths: {}, wlColFilters: {},
  theme: 'blue', rangeManual: false,
  wlFeeOnPremium: false, ccApplyFee: true, ccAnnualMode: 'compound', ccFeeOnPremium: false, ccNonFundFeePct: 1.5, ccFundFeePct: 0.3,
  ccOffsets: [],
  ccOffsetEnabled: false,
  calcManualPrices: {},
  calcApplyFee: true, calcNonFundFeePct: 1.5, calcFundFeePct: 0.3,
  savedPositions: [],
  stPositions: [], // استیت مستقل برای تست استراتژی
  ttManualSelections: {}, // استیت برای ذخیره انتخاب‌های دستی در استراتژی تا فردا
  ttManualPercentages: {}, // استیت جدید برای ذخیره درصد رول در حالت دستی
};
state.wlActiveCols = loadActiveCols();
state.wlSort = loadSort();
state.wlColWidths = loadColWidths();

const MARKET_URL =
  'https://cdn.tsetmc.com/api/ClosingPrice/GetMarketWatch' +
  '?market=0&paperTypes[0]=1&paperTypes[1]=2&paperTypes[2]=3' +
  '&paperTypes[3]=4&paperTypes[4]=5&paperTypes[5]=6' +
  '&paperTypes[6]=7&paperTypes[7]=8&paperTypes[8]=9' +
  '&withBestLimits=false&hEven=0&RefID=0';

function fetchWithTimeout(url, ms, opts){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return fetch(url, Object.assign({ signal: controller.signal, cache: 'no-store' }, opts || {}))
    .finally(() => clearTimeout(t));
}

/* ==================================================================
   ۶) دریافت داده
   ================================================================== */
$('#fetchBtn').addEventListener('click', () => fetchMarketData());

async function fetchMarketData(){
  const btn = $('#fetchBtn');
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin">⏳</span> در حال دریافت…';
  $('#refreshStatus').innerHTML = '<span class="dot wait"></span>در حال دریافت…';

  /* لیست جامع منابع: مستقیم + چند پروکسی CORS برای اطمینان بیشتر */
  const sources = [
    { name: 'مستقیم (TSETMC)',   url: MARKET_URL },
    { name: 'codetabs',          url: 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(MARKET_URL) },
    { name: 'allorigins',        url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(MARKET_URL) },
    { name: 'corsproxy.io',      url: 'https://corsproxy.io/?' + encodeURIComponent(MARKET_URL) },
    { name: 'cors-anywhere',     url: 'https://cors-anywhere.herokuapp.com/' + MARKET_URL },
    { name: 'thingproxy',        url: 'https://thingproxy.freeboard.io/fetch/' + MARKET_URL },
    { name: 'whateverorigin',    url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(MARKET_URL) + '&charset=UTF-8' }
  ];

  let items = null;
  const log = [];

  for (const src of sources){
    try {
      log.push(`[${src.name}] در حال تلاش…`);
      console.log(`[fetch] trying: ${src.name}`);
      const res = await fetchWithTimeout(src.url, 30000, { headers: { 'Accept': 'application/json, */*' } });
      if (!res.ok){ log.push(`  ✗ HTTP ${res.status}`); console.warn(`[fetch] ${src.name} HTTP ${res.status}`); continue; }
      const text = await res.text();
      if (!text || text.length < 20){ log.push(`  ✗ پاسخ خیلی کوتاه (${text ? text.length : 0} کاراکتر)`); console.warn(`[fetch] ${src.name} empty`); continue; }
      if (text.trim().startsWith('<')){ log.push(`  ✗ پاسخ HTML (احتمالاً خطای ۴۰۳ یا Cloudflare)`); console.warn(`[fetch] ${src.name} HTML response`); continue; }
      let json;
      try { json = JSON.parse(text); } catch(e){ log.push(`  ✗ JSON نامعتبر: ${e.message}`); console.warn(`[fetch] ${src.name} JSON error`, e); continue; }
      const arr = json.marketwatch || json.marketWatch || json.data || json;
      if (!Array.isArray(arr) || !arr.length){ log.push(`  ✗ آرایه خالی یا ساختار نامعتبر`); console.warn(`[fetch] ${src.name} empty array`); continue; }
      items = arr;
      log.push(`  ✓ موفق — ${arr.length} ردیف`);
      console.log(`[fetch] ${src.name} SUCCESS: ${arr.length} items`);
      break;
    } catch(e){
      const msg = e.name === 'AbortError' ? 'timeout (30s)' : e.message;
      log.push(`  ✗ ${msg}`);
      console.warn(`[fetch] ${src.name} failed:`, msg);
    }
  }

  if (!items){
    $('#fileInfo').innerHTML =
      `<div class="alert err">⚠️ دریافت داده ممکن نشد.<br>` +
      `<b>علت‌های محتمل:</b><br>` +
      `• IP شما در دسترس TSETMC نیست (نیاز به IP ایران یا VPN)<br>` +
      `• همه‌ی پروکسی‌ها نتوانستند پاسخ بدهند<br>` +
      `• در حال حاضر سرویس TSETMC در دسترس نیست<br><br>` +
      `<b>راه‌حل‌ها:</b><br>` +
      `• از VPN ایران استفاده کنید<br>` +
      `• چند دقیقه دیگر دوباره تلاش کنید<br>` +
      `• صفحه را رفرش کنید (Ctrl+Shift+R)<br><br>` +
      `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:12.5px;font-weight:700">جزئیات فنی (برای عیب‌یابی)</summary>` +
      `<pre style="font-size:11.5px;background:#fff;padding:8px;border-radius:6px;direction:ltr;text-align:left;max-height:200px;overflow:auto">` +
      escapeHtml(log.join('\n')) + `</pre></details></div>`;
    $('#refreshStatus').innerHTML = '<span class="dot bad"></span>خطا';
    $('#wlBadge').textContent = '0';
    $('#ccBadge').textContent = '0';
    btn.disabled = false; btn.innerHTML = old;
    return;
  }

  const market = items.map(normalizeItem).filter(x => x && x.sym);
  if (!market.length){
    $('#fileInfo').innerHTML = `<div class="alert err">⚠️ پاسخی دریافت شد اما هیچ نماد معتبری در آن نبود.</div>`;
    $('#refreshStatus').innerHTML = '<span class="dot bad"></span>خطا';
    $('#wlBadge').textContent = '0';
    $('#ccBadge').textContent = '0';
    btn.disabled = false; btn.innerHTML = old;
    return;
  }

  state.market = market;
  state.options = market.filter(m => m.isOption);

  const byUnderlying = {};
  for (const o of state.options){
    if (!byUnderlying[o.underlying]) byUnderlying[o.underlying] = { sym: o.underlying, calls: [], puts: [] };
    if (o.type === 'call') byUnderlying[o.underlying].calls.push(o);
    else if (o.type === 'put') byUnderlying[o.underlying].puts.push(o);
  }
  state.underlyingsWithOptions = Object.values(byUnderlying).sort((a, b) => a.sym.localeCompare(b.sym, 'fa'));

  const nowStr = new Date().toLocaleTimeString('fa-IR');
  $('#fileInfo').innerHTML =
    `<div class="alert ok">✅ داده‌ها دریافت شد — ` +
    `نمادها: <b>${state.market.length}</b> | اختیارها: <b>${state.options.length}</b> | ` +
    `دارایی‌های پایه: <b>${state.underlyingsWithOptions.length}</b> ` +
    `<span style="opacity:.7;margin-inline-start:8px">(${nowStr})</span></div>`;

  const prevLegs = state.legs.length ? JSON.parse(JSON.stringify(state.legs)) : null;
  const wasReportVisible = !$('#card-report').classList.contains('hidden');

  initStrategyUI(null, prevLegs);
  $('#card-strategy').classList.remove('hidden');
  $('#refreshStatus').innerHTML = '<span class="dot ok"></span>آخرین دریافت: ' + nowStr;
  if (!state.rangeManual) resetAutoRange();

  $('#wlBadge').textContent = state.options.length;
  const callCount = state.options.filter(o => o.type === 'call').length;
  $('#ccBadge').textContent = callCount;
  if ($('#rpBadge')) $('#rpBadge').textContent = (state.savedPositions || []).length;

  if (!$('[data-panel="watchlist"]').classList.contains('hidden')) renderWatchlist();
  if (!$('[data-panel="marketmap"]').classList.contains('hidden')) renderMarketMap();
  if (!$('[data-panel="coveredcall"]').classList.contains('hidden')) renderCoveredCall();
  if (!$('[data-panel="report"]').classList.contains('hidden')) renderReportPanel();
  if (!$('[data-panel="calculations"]').classList.contains('hidden')) renderCalculations();
  if (!$('[data-panel="strategytest"]').classList.contains('hidden')) renderStrategyTest();
  
  if (!$('[data-panel="tilltomorrow"]').classList.contains('hidden') && document.getElementById('ttAnalyzeBtn')) {
    document.getElementById('ttAnalyzeBtn').click();
  }

  if (wasReportVisible){
    try {
      const rep = computeReport();
      $('#card-report').classList.remove('hidden');
      requestAnimationFrame(() => { try { renderReport(rep); } catch(e){ console.warn(e); } });
    } catch(err){ console.warn(err); $('#card-report').classList.add('hidden'); }
  } else { $('#card-report').classList.add('hidden'); }

  btn.disabled = false; btn.innerHTML = old;
}

/* ==================================================================
   ۷) نرمال‌سازی
   ================================================================== */
function extractTradingField(it, candidateKeys){
  for (const k of candidateKeys){
    if (it[k] !== undefined && it[k] !== null && it[k] !== ''){
      const v = toNum(it[k]);
      if (v > 0) return { value: v, source: k };
    }
  }
  const keys = Object.keys(it);
  for (const candidate of candidateKeys){
    const lower = candidate.toLowerCase();
    for (const k of keys){
      if (k.toLowerCase() === lower && it[k] !== undefined && it[k] !== null && it[k] !== ''){
        const v = toNum(it[k]);
        if (v > 0) return { value: v, source: k + ' (ci)' };
      }
    }
  }
  return { value: 0, source: null };
}
function normalizeItem(it){
  if (!it) return null;
  const sym  = String(it.lva || it.l18 || '').trim();
  const name = String(it.lvc || it.l30 || '').trim();
  if (!sym) return null;
  const yesterday = toNum(it.py ?? it.pcl ?? it.priceYesterday);
  const first = toNum(it.pf ?? it.priceFirst);
  const last = toNum(it.pdv ?? it.pDrCotVal ?? it.lastPrice);
  const close = toNum(it.pcl ?? it.pClosing ?? it.closingPrice);
  const minP = toNum(it.pmn ?? it.priceMin);
  const maxP = toNum(it.pmx ?? it.priceMax);
  const price = last > 0 ? last : close;
  const volRes = extractTradingField(it, ['tvol','tVolume','tradeVolume','TradeVolume','totalTradeVolume','hajm','Hajm','hajmMoamele','qTot','qTit','qtj','qTj','sumTvol','totalVolume','volume','Volume','vol','Vol']);
  const noRes = extractTradingField(it, ['tno','tNo','tradeCount','TradeCount','totalTradeCount','tedad','tedadMoamele','zTot','zTit','zno','znoTot','sumTno','totalCount','count','Count']);
  const rec = {
    sym, name, last, close, price, yesterday, first, min: minP, max: maxP,
    tvol: volRes.value, tno: noRes.value,
    _src: { tvol: volRes.source, tno: noRes.source },
    isOption: false, type: null, underlying: '', strike: 0,
    expiry: null, expiryStr: '', days: 0
  };
  const opt = parseOptionName(name);
  if (opt){
    rec.isOption = true;
    rec.type = opt.type;
    rec.underlying = opt.underlying;
    rec.strike = opt.strike;
    rec.expiry = opt.expiry;
    rec.expiryStr = opt.expiryStr;
    rec.days = daysToExpiry(opt.expiry);
  }
  return rec;
}
