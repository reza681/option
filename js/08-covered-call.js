/* ============================================================
   بخش ۲۷: استراتژی کاورد کال
   منبع: option-ver16.html خطوط 3196-3778
   ============================================================ */
/* ==================================================================
   ۲۷) کاورد کال
   ================================================================== */
const CC_SORT_GETTERS = {
  idx:(r,i)=>i, sym:r=>r.sym, underlying:r=>r.underlying,
  S:r=>r.S, strike:r=>r.K, days:r=>r.days, premium:r=>r.P,
  premYield:r=>r.premYield, annualPrem:r=>r.annualPrem,
  maxReturn:r=>r.maxReturn, annualMaxRet:r=>r.annualMaxRet,
  protection:r=>r.protection, breakeven:r=>r.breakeven,
  otmPct:r=>r.otmPct, volume:r=>r.tvol, score:r=>r.score
};

const CC_COLUMN_DEFS = [
  { id: 'idx',          label: '#',                width: 44 },
  { id: 'sym',          label: 'نماد اختیار',      width: 132 },
  { id: 'underlying',   label: 'دارایی پایه',      width: 92 },
  { id: 'S',            label: 'قیمت سهم',         width: 96 },
  { id: 'strike',       label: 'قیمت اعمال',       width: 96 },
  { id: 'otmPct',       label: '% OTM',            width: 82 },
  { id: 'days',         label: 'روز',              width: 60 },
  { id: 'premium',      label: 'پرمیوم',           width: 88 },
  { id: 'premYield',    label: '% پرمیوم',         width: 90 },
  { id: 'annualPrem',   label: '% سالانه پرمیوم',  width: 118 },
  { id: 'maxReturn',    label: '% بازده سررسید',   width: 118 },
  { id: 'annualMaxRet', label: '% بازده سالانه',   width: 118 },
  { id: 'protection',   label: '% محافظت',         width: 90 },
  { id: 'breakeven',    label: 'سربه‌سر سهم',      width: 104 },
  { id: 'volume',       label: 'حجم',              width: 90 },
  { id: 'score',        label: 'امتیاز',           width: 88 }
];

let ccSort = { column: 'score', direction: 'desc' };

function ccAnnualizePct(pct, days, mode){
  const out = annualizePct(pct, days, mode || getAnnualMode());
  return out === null ? 0 : out;
}

function computeCoveredCallRow(opt){
  if (!opt || opt.type !== 'call') return null;
  const S = getUnderlyingPrice(opt.underlying);
  if (!S || S <= 0) return null;
  const K = Number(opt.strike), P = Number(opt.price), days = Number(opt.days);
  if (!K || !P || P <= 0 || !days || days <= 0) return null;
  const annualMode = getAnnualMode();
  const fund = isFundUnderlying(opt.underlying);
  const fee = optionFee(S, P, {
    apply: state.ccApplyFee,
    feePct: fund ? state.ccFundFeePct : state.ccNonFundFeePct,
    feeOnPremium: !!state.ccFeeOnPremium
  });
  const netPremium = P - fee;
  const costBasis = S - netPremium;
  const m = optionReturn(K, S, P, fee, days, annualMode);
  const denom = m.denom;
  const mp = optionPremiumReturn(netPremium, S, P, days, annualMode);
  const premYield = (mp.pct === null) ? 0 : mp.pct;
  const intrinsic = Math.max(0, S - K);
  const timeValue = Math.max(0, P - intrinsic);
  const netTimeValue = Math.max(0, timeValue - fee);
  const tvYield = denom ? (netTimeValue / denom) * 100 : 0;
  const annualPrem = ccAnnualizePct(premYield, days, annualMode);
  const annualTvPrem = ccAnnualizePct(tvYield, days, annualMode);
  const maxReturn = (m.retPct === null) ? 0 : m.retPct;
  const annualMaxRet = ccAnnualizePct(maxReturn, days, annualMode);
  const protection = premYield;
  const breakeven = S - netPremium;
  const otmPct = ((K - S) / S) * 100;
  let moneyness;
  if (K > S) moneyness = 'OTM';
  else if (K === S) moneyness = 'ATM';
  else moneyness = 'ITM';
  const normAnnualPrem = Math.min(Math.max(annualTvPrem, 0) / 1.2, 100);
  const normAnnualMax = Math.min(Math.max(annualMaxRet, 0) / 1.5, 100);
  const normProtection = Math.min(Math.max(protection, 0) / 5, 100);
  const normOtm = otmPct > 0 ? Math.min(otmPct / 10, 100) : 0;
  const score = 0.35 * normAnnualPrem + 0.35 * normAnnualMax + 0.15 * normProtection + 0.15 * normOtm;
  return {
    sym: opt.sym, name: opt.name, underlying: opt.underlying,
    S, K, P, days, expiryStr: opt.expiryStr, fund,
    fee, netPremium, costBasis, denom, premYield, annualPrem, annualTvPrem, annualMode,
    intrinsic, timeValue, netTimeValue, tvYield,
    maxReturn, annualMaxRet, protection, breakeven,
    otmPct, moneyness,
    tvol: Number(opt.tvol) || 0, tno: Number(opt.tno) || 0,
    normAnnualPrem, normAnnualMax, normProtection, normOtm,
    score
  };
}

function getCoveredCallRows(){
  const out = [];
  for (const opt of state.options){
    if (opt.type !== 'call') continue;
    const row = computeCoveredCallRow(opt);
    if (row) out.push(row);
  }
  return out;
}
function applyCcSort(rows){
  const { column, direction } = ccSort;
  const dir = direction === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const g = CC_SORT_GETTERS[column];
    if (!g) return 0;
    const va = g(a, 0), vb = g(b, 0);
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'fa') * dir;
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

/* Black-Scholes */
function normCdf(x){
  const a1=0.319381530, a2=-0.356563782, a3=1.781477937, a4=-1.821255978, a5=1.330274429;
  const k = 1/(1 + 0.2316419*Math.abs(x));
  const k2=k*k, k3=k2*k, k4=k3*k, k5=k4*k;
  const poly = a1*k + a2*k2 + a3*k3 + a4*k4 + a5*k5;
  const nd = Math.exp(-x*x/2) / Math.sqrt(2*Math.PI);
  const p = 1 - nd * poly;
  return x >= 0 ? p : 1 - p;
}
function bsCall(S, K, r, T, sigma){
  if (T <= 0 || sigma <= 0) return Math.max(0, S - K);
  const sqT = Math.sqrt(T);
  const d1 = (Math.log(S/K) + (r + sigma*sigma/2)*T) / (sigma * sqT);
  const d2 = d1 - sigma * sqT;
  return S * normCdf(d1) - K * Math.exp(-r*T) * normCdf(d2);
}
function impliedVol(marketPrice, S, K, r, T){
  if (!T || T <= 0) return null;
  const intrinsic = Math.max(0, S - K);
  if (marketPrice <= intrinsic + 0.001) return 0.02;
  let lo = 0.01, hi = 5.0;
  if (bsCall(S, K, r, T, hi) < marketPrice) return hi;
  for (let i = 0; i < 80; i++){
    const mid = (lo + hi) / 2;
    const price = bsCall(S, K, r, T, mid);
    if (price > marketPrice) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
function computeOffsetPnL(r, offsetDays, offsetPrice){
  const S0 = r.S, K = r.K, days = r.days;
  const netPrem = r.netPremium;
  const rRate = state.ytm || 0.25;
  if (!isFinite(offsetPrice) || offsetPrice <= 0 || !isFinite(offsetDays) || offsetDays < 0) return null;
  const netInvestment = S0 - netPrem;
  let Ct;
  if (offsetDays >= days || days <= 0){
    Ct = Math.max(0, offsetPrice - K);
  } else {
    const T  = days / 365;
    const Tr = (days - offsetDays) / 365;
    const iv = impliedVol(r.P, S0, K, rRate, T);
    if (iv === null || !isFinite(iv)){
      const intrinsicNow = Math.max(0, S0 - K);
      const tv = Math.max(0, r.P - intrinsicNow);
      const tvAtT = tv * Math.max(0, 1 - offsetDays / days);
      Ct = Math.max(0, offsetPrice - K) + tvAtT;
    } else {
      Ct = bsCall(offsetPrice, K, rRate, Tr, iv);
    }
  }
  const offsetRevenue = offsetPrice - Ct;
  return offsetRevenue - netInvestment;
}

function renderCcOffsetScenarios(){
  const wrap = $('#ccOffsetScenarios');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!state.ccOffsetEnabled) return;
  state.ccOffsets.forEach((sc, i) => {
    const item = document.createElement('div');
    item.className = 'cc-offset-item';
    item.innerHTML = `
      <label>روز:</label>
      <input type="number" min="1" step="1" value="${sc.days ?? 30}" data-sc="${i}" data-k="days" placeholder="30">
      <label>کف قیمت:</label>
      <input type="number" min="1" step="any" value="${sc.price ?? ''}" placeholder="مثال ۳۵۰" data-sc="${i}" data-k="price">
      <button class="rm" data-sc="${i}" title="حذف">✕</button>`;
    wrap.appendChild(item);
  });
  wrap.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      const i = +e.target.dataset.sc, k = e.target.dataset.k;
      if (state.ccOffsets[i]) state.ccOffsets[i][k] = toNum(e.target.value);
    });
    inp.addEventListener('change', () => { saveCcOffsets(); renderCoveredCall(); });
  });
  wrap.querySelectorAll('.rm').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ccOffsets.splice(+btn.dataset.sc, 1);
      saveCcOffsets(); renderCcOffsetScenarios(); renderCoveredCall();
    });
  });
}
function saveCcOffsets(){
  try { localStorage.setItem('ccOffsets', JSON.stringify({ enabled: state.ccOffsetEnabled, items: state.ccOffsets })); } catch(e){}
}
function loadCcOffsets(){
  try {
    const s = JSON.parse(localStorage.getItem('ccOffsets') || 'null');
    if (s && typeof s === 'object'){
      state.ccOffsetEnabled = !!s.enabled;
      state.ccOffsets = Array.isArray(s.items) ? s.items.filter(x => x && Number(x.days) > 0) : [];
    }
  } catch(e){}
}
loadCcOffsets();

function buildCcCalcHtml(r, field, extra){
  const feeRateLbl = r.fund ? `صندوق ${state.ccFundFeePct}%` : `غیرصندوق ${state.ccNonFundFeePct}%`;
  const wrap = (title, formula, lines, result, note) => {
    let html = `<div class="ttl"><span class="ico">🧮</span>${title}</div>`;
    if (formula) html += `<div class="formula">${formula}</div>`;
    if (lines && lines.length){
      lines.forEach(l => {
        const cls = l[2] ? ' ' + l[2] : '';
        html += `<div class="calc-line${cls}"><span class="lbl">${l[0]}</span><span class="val">${l[1]}</span></div>`;
      });
    }
    if (result !== undefined && result !== null){
      html += `<div class="result"><span>نتیجه</span><span class="val">${result}</span></div>`;
    }
    if (note) html += `<div class="note">${note}</div>`;
    return html;
  };

  switch(field){
    case 'S': return wrap('قیمت سهم پایه (S)', null,
      [['نماد دارایی پایه', escapeHtml(r.underlying)], ['منبع', 'آخرین قیمت معامله در بازار']],
      fmt0(r.S), 'این عدد پایه‌ی محاسبه تمام معیارهای کاورد کال روی این سهم است.');
    case 'strike': return wrap('قیمت اعمال (K)', null,
      [['قیمت سهم (S)', fmt0(r.S)], ['وضعیت', r.moneyness], ['فاصله K از S', fmt0(r.K - r.S) + ' واحد']],
      fmt0(r.K), 'K از نام نماد اختیار استخراج می‌شود.');
    case 'otmPct': return wrap('% فاصله OTM', '((K − S) ÷ (S − P)) × 100',
      [['K (اعمال)', fmt0(r.K)], ['S (سهم)', fmt0(r.S)], ['K − S', fmt0(r.K - r.S)], ['ضریب', '100']],
      (r.otmPct >= 0 ? '+' : '') + r.otmPct.toFixed(2) + '%',
      r.otmPct > 0 ? 'مثبت ⇒ اختیار OTM.' : (r.otmPct < 0 ? 'منفی ⇒ ITM.' : 'صفر ⇒ ATM.'));
    case 'days': return wrap('روز تا سررسید', 'روزهای تقویمی از امروز تا تاریخ سررسید',
      [['تاریخ سررسید', escapeHtml(r.expiryStr || '—')]],
      r.days + ' روز', 'مبنای تمام محاسبات سالانه‌سازی است.');
    case 'premium': return wrap('پرمیوم (P)', null,
      [['نماد', escapeHtml(r.sym)], ['منبع', 'آخرین قیمت معامله اختیار']],
      fmt0(r.P), 'پرمیوم ناخالص دریافتی از فروش Call.');
    case 'premYield': return wrap('% پرمیوم خالص', '((P − fee) ÷ (S − P)) × 100',
      [['P (پرمیوم)', fmt0(r.P)], ['fee (کارمزد)', fmt0(r.fee) + ' — ' + feeRateLbl], ['P − fee', fmt0(r.netPremium)], ['S', fmt0(r.S)]],
      r.premYield.toFixed(2) + '%', 'درصد پرمیوم خالص دریافتی. همان % محافظت است.');
    case 'annualPrem': return wrap('% سالانه پرمیوم', 'premYield × 365 ÷ days',
      [['% پرمیوم', r.premYield.toFixed(4) + '%'], ['روز', r.days], ['ضریب سالانه‌سازی', (365 / r.days).toFixed(2)]],
      r.annualPrem.toFixed(2) + '%', 'معادل سالانه پرمیوم.');
    case 'maxReturn': return wrap('% بازده سررسید', '((K − S + netPremium) ÷ (S − P)) × 100',
      [['K', fmt0(r.K)], ['S', fmt0(r.S)], ['K − S', fmt0(r.K - r.S)], ['netPremium', fmt0(r.netPremium)], ['صورت کسر', fmt0(r.K - r.S + r.netPremium)]],
      r.maxReturn.toFixed(2) + '%', 'بازده کل در صورت رسیدن سهم به K و اعمال اختیار.');
    case 'annualMaxRet': return wrap('% بازده سالانه', 'maxReturn × 365 ÷ days',
      [['% بازده سررسید', r.maxReturn.toFixed(4) + '%'], ['روز', r.days], ['ضریب سالانه‌سازی', (365 / r.days).toFixed(2)]],
      r.annualMaxRet.toFixed(2) + '%', 'معادل سالانه حداکثر بازده.');
    case 'protection': return wrap('% محافظت', '= premYield',
      [['% پرمیوم', r.premYield.toFixed(4) + '%'], ['نقطه سربه‌سر سهم', fmt0(r.breakeven)], ['افت مجاز سهم', (r.premYield).toFixed(2) + '%']],
      r.protection.toFixed(2) + '%', 'مقدار افت قابل تحمل سهم پیش از ورود به زیان.');
    case 'breakeven': return wrap('سربه‌سر سهم', 'S − netPremium',
      [['S', fmt0(r.S)], ['netPremium', fmt0(r.netPremium)], ['محاسبه', fmt0(r.S) + ' − ' + fmt0(r.netPremium)]],
      fmt0(r.breakeven), 'اگر قیمت سهم در سررسید بالای این عدد باشد، سود می‌کنید.');
    case 'volume': return wrap('حجم معاملات', null, null, fmt0(r.tvol), 'حجم معاملات روزانه — معیار نقدشوندگی.');
    case 'score': {
      const normAnnualPrem = Math.min(Math.max(r.annualPrem, 0) / 1.2, 100);
      const normAnnualMax  = Math.min(Math.max(r.annualMaxRet, 0) / 1.5, 100);
      const normProtection = Math.min(Math.max(r.protection, 0) / 5, 100);
      const normOtm        = r.otmPct > 0 ? Math.min(r.otmPct / 10, 100) : 0;
      return wrap('امتیاز ترکیبی', '0.35×AP + 0.35×AMR + 0.15×Prot + 0.15×OTM',
        [
          ['AP سالانه پرمیوم', r.annualPrem.toFixed(2) + '% → نرمال ' + normAnnualPrem.toFixed(1)],
          ['AMR بازده سالانه', r.annualMaxRet.toFixed(2) + '% → نرمال ' + normAnnualMax.toFixed(1)],
          ['Prot محافظت', r.protection.toFixed(2) + '% → نرمال ' + normProtection.toFixed(1)],
          ['OTM فاصله اعمال', r.otmPct.toFixed(2) + '% → نرمال ' + normOtm.toFixed(1)],
          ['0.35 × AP', (0.35 * normAnnualPrem).toFixed(2)],
          ['0.35 × AMR', (0.35 * normAnnualMax).toFixed(2)],
          ['0.15 × Prot', (0.15 * normProtection).toFixed(2)],
          ['0.15 × OTM', (0.15 * normOtm).toFixed(2)]
        ], r.score.toFixed(2),
        'هر معیار روی بازه بهینه نرمال (۰ تا ۱۰۰) می‌شود، سپس با وزن ترکیب می‌گردد.');
    }
    case 'offset': {
      const oi = extra && extra.offsetIndex;
      const off = state.ccOffsets[oi];
      if (!off) return null;
      const S0 = r.S, K = r.K, days = r.days, netPrem = r.netPremium;
      const rRate = state.ytm || 0.25;
      const netInvestment = S0 - netPrem;
      const T = days / 365;
      const iv = impliedVol(r.P, S0, K, rRate, T);
      const ivPct = iv !== null ? (iv * 100).toFixed(1) + '%' : '—';
      let Ct, ctMethod, intrinsicAtOffset;
      if (off.days >= days || days <= 0){
        Ct = Math.max(0, off.price - K);
        intrinsicAtOffset = Ct;
        ctMethod = 'ارزش ذاتی (منقضی شده)';
      } else {
        const Tr = (days - off.days) / 365;
        intrinsicAtOffset = Math.max(0, off.price - K);
        if (iv !== null && isFinite(iv)){
          Ct = bsCall(off.price, K, rRate, Tr, iv);
          ctMethod = `Black-Scholes (IV=${ivPct})`;
        } else {
          const intrinsicNow = Math.max(0, S0 - K);
          const tv = Math.max(0, r.P - intrinsicNow);
          Ct = intrinsicAtOffset + tv * Math.max(0, 1 - off.days / days);
          ctMethod = 'تقریب (IV در دسترس نبود)';
        }
      }
      const offsetRevenue = off.price - Ct;
      const offsetProfit = offsetRevenue - netInvestment;
      const lines = [
        ['— خالص سرمایه‌گذاری —', '', 'section-hdr'],
        ['S₀ (قیمت خرید سهم)', fmt0(S0)],
        ['P_net (پرمیوم خالص فروش Call)', fmt0(netPrem)],
        ['خالص سرمایه‌گذاری = S₀ − P_net', fmt0(netInvestment)],
        ['— سناریوی کف قیمت —', '', 'section-hdr'],
        ['روز آفست', off.days + ' روز'],
        ['کف قیمت سهم (S_t)', fmt0(off.price)],
        ['روزهای باقی‌مانده تا سررسید', Math.max(0, days - off.days) + ' روز'],
        ['ارزش اختیار در آفست (C_t)', fmt0(Ct)],
        ['روش ارزش‌گذاری', ctMethod],
        ['ارزش ذاتی در آن لحظه', fmt0(intrinsicAtOffset)],
        ['— محاسبه سود آفست —', '', 'section-hdr'],
        ['درآمد آفست = S_t − C_t', fmt0(offsetRevenue)],
        ['سود آفست = درآمد − خالص سرمایه‌گذاری', fmt0(offsetProfit)]
      ];
      return wrap('📉 سود آفست (سناریوی کف قیمت)',
        'سود آفست = (S_t − C_t) − (S₀ − P_net)',
        lines, fmt0(offsetProfit),
        `اگر سهم در روز <b>${off.days}</b> به کف قیمت <b>${fmt0(off.price)}</b> برسد، با فروش سهم و بستن اختیار در آن لحظه، سود/زیان کل موقعیت این مقدار می‌شود.`);
    }
  }
  return null;
}

function renderCoveredCall(){
  const tbl    = $('#ccTable');
  const hint   = $('#ccHint');
  const status = $('#ccStatus');
  const badge  = $('#ccBadge');
  const topEl  = $('#ccTop');
  if (!tbl) return;
  closeCalcPopover();
  $('#ccApplyFee').checked   = state.ccApplyFee;
  if ($('#ccAnnualMode')) $('#ccAnnualMode').value = state.ccAnnualMode === 'linear' ? 'linear' : 'compound';
  if ($('#ccFeeOnPremium')) $('#ccFeeOnPremium').checked = !!state.ccFeeOnPremium;
  $('#ccNonFundFee').value   = state.ccNonFundFeePct;
  $('#ccFundFee').value      = state.ccFundFeePct;
  $('#ccNonFundFee').disabled = !state.ccApplyFee;
  $('#ccFundFee').disabled    = !state.ccApplyFee;
  $('#ccOffsetEnabled').checked = state.ccOffsetEnabled;
  $('#ccOffsetState').textContent = state.ccOffsetEnabled ? 'فعال' : 'غیرفعال';

  if (!state.options || !state.options.length){
    tbl.innerHTML = `<tbody><tr><td style="text-align:center;padding:36px;color:#64748b">هنوز داده‌ای دریافت نشده است.</td></tr></tbody>`;
    if (topEl) topEl.innerHTML = '';
    hint.textContent = '';
    status.innerHTML = '<span class="dot wait"></span>در انتظار داده';
    badge.textContent = '0';
    return;
  }
  let rows = getCoveredCallRows();
  badge.textContent = rows.length;
  const uSel = $('#ccFilterUnderlying');
  const currentU = uSel.value;
  const uniqueU = [...new Set(rows.map(r => r.underlying))].sort((a,b)=>a.localeCompare(b,'fa'));
  if (uSel.options.length - 1 !== uniqueU.length){
    uSel.innerHTML = '<option value="">همه دارایی‌های پایه</option>' + uniqueU.map(u => `<option value="${u}">${u}</option>`).join('');
    uSel.value = currentU;
  }
  const q = ($('#ccSearch').value || '').trim().toLowerCase();
  const fU = uSel.value;
  const fM = $('#ccFilterMoneyness').value;
  const fD = $('#ccFilterDays').value;
  rows = rows.filter(r => {
    if (fU && r.underlying !== fU) return false;
    if (fD && r.days > Number(fD)) return false;
    if (fM === 'otm' && r.moneyness !== 'OTM') return false;
    if (fM === 'atm' && r.moneyness !== 'ATM') return false;
    if (fM === 'itm' && r.moneyness !== 'ITM') return false;
    if (q){
      const hay = (r.sym + ' ' + r.name + ' ' + r.underlying).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sorted = applyCcSort(rows);

  if (topEl){
    if (sorted.length >= 1){
      const top = sorted.slice(0, 3);
      const medals = ['🥇','🥈','🥉'];
      topEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:16px">
          ${top.map((r, i) => `
            <div class="stat pos" style="padding:14px 16px">
              <div class="k" style="font-size:12.5px">${medals[i]} رتبه ${i+1} — ${escapeHtml(r.sym)}</div>
              <div class="v pos" style="font-size:22px">${r.score.toFixed(1)} <small style="font-size:12px;color:var(--muted)">امتیاز</small></div>
              <div style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.95">
                دارایی پایه: <b style="color:var(--ink)">${escapeHtml(r.underlying)}</b><br>
                سهم: ${fmt0(r.S)} &nbsp;|&nbsp; اعمال: ${fmt0(r.K)} &nbsp;|&nbsp; ${r.days} روز<br>
                پرمیوم سالانه: <b class="pos">${r.annualPrem.toFixed(1)}%</b> &nbsp;|&nbsp;
                بازده سالانه: <b class="pos">${r.annualMaxRet.toFixed(1)}%</b><br>
                محافظت: <b>${r.protection.toFixed(2)}%</b>
              </div>
            </div>
          `).join('')}
        </div>`;
    } else topEl.innerHTML = '';
  }

  if (!sorted.length){
    tbl.innerHTML = `<tbody><tr><td style="text-align:center;padding:30px;color:#64748b">با فیلترهای فعلی نتیجه‌ای یافت نشد.</td></tr></tbody>`;
    hint.textContent = '';
    status.innerHTML = '<span class="dot wait"></span>بدون نتیجه';
    return;
  }

  const cell = {
    idx: (r, i) => `<td class="num">${i+1}</td>`,
    sym: r => `<td class="sym-cell" title="${escapeAttr(r.name)}">${escapeHtml(r.sym)}</td>`,
    underlying: r => `<td>${escapeHtml(r.underlying)}</td>`,
    S: (r, i) => `<td class="num" data-cc-calc="S" data-cc-row="${i}">${fmt0(r.S)}</td>`,
    strike: (r, i) => `<td class="num price" data-cc-calc="strike" data-cc-row="${i}">${fmt0(r.K)}</td>`,
    otmPct: (r, i) => { const v = (r.otmPct >= 0 ? '+' : '') + r.otmPct.toFixed(2) + '%'; const cls = r.otmPct >= 0 ? 'pos' : 'neg'; return `<td class="num ${cls}" data-cc-calc="otmPct" data-cc-row="${i}">${v}</td>`; },
    days: (r, i) => `<td class="num" data-cc-calc="days" data-cc-row="${i}">${r.days}</td>`,
    premium: (r, i) => `<td class="num" data-cc-calc="premium" data-cc-row="${i}">${fmt0(r.P)}</td>`,
    premYield: (r, i) => { const cls = r.premYield >= 0 ? 'pos' : 'neg'; return `<td class="num ${cls}" data-cc-calc="premYield" data-cc-row="${i}">${r.premYield.toFixed(2)}%</td>`; },
    annualPrem: (r, i) => { const cls = r.annualPrem >= 0 ? 'pos' : 'neg'; return `<td class="num ${cls}" data-cc-calc="annualPrem" data-cc-row="${i}"><b>${r.annualPrem.toFixed(1)}%</b></td>`; },
    maxReturn: (r, i) => { const cls = r.maxReturn >= 0 ? 'pos' : 'neg'; return `<td class="num ${cls}" data-cc-calc="maxReturn" data-cc-row="${i}">${r.maxReturn.toFixed(2)}%</td>`; },
    annualMaxRet: (r, i) => { const cls = r.annualMaxRet >= 0 ? 'pos' : 'neg'; return `<td class="num ${cls}" data-cc-calc="annualMaxRet" data-cc-row="${i}"><b>${r.annualMaxRet.toFixed(1)}%</b></td>`; },
    protection: (r, i) => { const cls = r.protection >= 0 ? 'pos' : 'neg'; return `<td class="num ${cls}" data-cc-calc="protection" data-cc-row="${i}">${r.protection.toFixed(2)}%</td>`; },
    breakeven: (r, i) => `<td class="num" data-cc-calc="breakeven" data-cc-row="${i}">${fmt0(r.breakeven)}</td>`,
    volume: (r, i) => `<td class="num" data-cc-calc="volume" data-cc-row="${i}">${r.tvol ? fmt0(r.tvol) : '—'}</td>`,
    score: (r, i) => { const cls = r.score >= 60 ? 'pos' : (r.score >= 30 ? '' : 'neg'); return `<td class="num ${cls}" data-cc-calc="score" data-cc-row="${i}"><b>${r.score.toFixed(1)}</b></td>`; }
  };

  const cols = CC_COLUMN_DEFS.slice();
  if (state.ccOffsetEnabled && state.ccOffsets.length){
    state.ccOffsets.forEach((off, oi) => {
      cols.push({
        id: 'offset_' + oi,
        label: `سود آفست ${off.days}روزه (کف ${fmt0(off.price)})`,
        width: 155, isOffset: true,
        offsetIndex: oi, offsetDays: off.days, offsetPrice: off.price
      });
    });
  }
  const ind = (id) => {
    if (id !== ccSort.column || id === 'idx') return '';
    return ccSort.direction === 'asc' ? ' <span class="sort-ind">▲</span>' : ' <span class="sort-ind">▼</span>';
  };
  let thead = '<thead><tr>';
  cols.forEach(c => { thead += `<th data-col="${c.id}" style="min-width:${c.width}px">${c.label}${ind(c.id)}</th>`; });
  thead += '</tr></thead>';
  let tbody = '<tbody>';
  sorted.forEach((r, i) => {
    tbody += '<tr>';
    cols.forEach(c => {
      if (c.isOffset){
        const off = state.ccOffsets[c.offsetIndex];
        const pnl = computeOffsetPnL(r, off.days, off.price);
        const cls = pnl === null ? '' : (pnl >= 0 ? 'pos' : 'neg');
        const v = pnl === null ? '—' : fmt0(pnl);
        tbody += `<td class="num ${cls}" data-cc-calc="offset" data-cc-row="${i}" data-cc-offset="${c.offsetIndex}"><b>${v}</b></td>`;
        return;
      }
      tbody += cell[c.id] ? cell[c.id](r, i) : '<td></td>';
    });
    tbody += '</tr>';
  });
  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;

  tbl.querySelectorAll('thead th[data-col]').forEach(th => {
    const colId = th.dataset.col;
    if (colId === 'idx') return;
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      if (colId.startsWith('offset_')) return;
      if (ccSort.column === colId) ccSort.direction = ccSort.direction === 'asc' ? 'desc' : 'asc';
      else { ccSort.column = colId; ccSort.direction = 'desc'; }
      renderCoveredCall();
    });
  });
  tbl.querySelectorAll('td[data-cc-calc]').forEach(td => {
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = +td.dataset.ccRow;
      const field = td.dataset.ccCalc;
      const row = sorted[idx];
      if (!row) return;
      const extra = field === 'offset' ? { offsetIndex: +td.dataset.ccOffset } : null;
      const isSame = !$calcPopover.classList.contains('hidden') && $calcPopover.__lastTd === td;
      if (isSame){ closeCalcPopover(); return; }
      showCalcPopover(td, buildCcCalcHtml(row, field, extra));
    });
  });
  const feeNote = state.ccApplyFee ? `کارمزد: غیرصندوق ${state.ccNonFundFeePct}% / صندوق ${state.ccFundFeePct}%` : 'کارمزد: غیرفعال';
  const offsetNote = (state.ccOffsetEnabled && state.ccOffsets.length) ? ` | ${state.ccOffsets.length} سناریو آفست` : '';
  hint.textContent = `${sorted.length} فرصت از ${rows.length} کال | ${feeNote}${offsetNote} | 💡 روی هر عدد کلیک کنید`;
  status.innerHTML = `<span class="dot ok"></span>${sorted.length} فرصت کاورد کال`;
}

/* بستن پاپ‌اور */
document.addEventListener('click', (e) => {
  if (!$calcPopover || $calcPopover.classList.contains('hidden')) return;
  if ($calcPopover.contains(e.target)) return;
  if (e.target.closest('td[data-cc-calc], td[data-wl-calc]')) return;
  closeCalcPopover();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $calcPopover && !$calcPopover.classList.contains('hidden')) closeCalcPopover();
});
window.addEventListener('scroll', () => {
  if (!$calcPopover || $calcPopover.classList.contains('hidden')) return;
  closeCalcPopover();
}, true);

/* رویدادهای فیلترها (کاورد کال) */
['#ccSearch','#ccFilterUnderlying','#ccFilterMoneyness','#ccFilterDays'].forEach(sel => {
  const el = document.querySelector(sel); if (!el) return;
  const ev = el.tagName === 'INPUT' ? 'input' : 'change';
  el.addEventListener(ev, () => { clearTimeout(window.__ccTimer); window.__ccTimer = setTimeout(renderCoveredCall, 200); });
});
const $ccSortBy = $('#ccSortBy');
if ($ccSortBy){
  $ccSortBy.addEventListener('change', e => {
    const v = e.target.value;
    if (v) ccSort = { column: v, direction: 'desc' };
    renderCoveredCall();
  });
}
const $ccApplyFee = $('#ccApplyFee');
if ($ccApplyFee){
  $ccApplyFee.addEventListener('change', e => { state.ccApplyFee = e.target.checked; renderCoveredCall(); });
}
['#ccNonFundFee','#ccFundFee'].forEach(sel => {
  const el = document.querySelector(sel); if (!el) return;
  el.addEventListener('input', e => {
    if (sel === '#ccNonFundFee') state.ccNonFundFeePct = toNum(e.target.value);
    else state.ccFundFeePct = toNum(e.target.value);
    clearTimeout(window.__ccFeeTimer);
    window.__ccFeeTimer = setTimeout(renderCoveredCall, 250);
  });
});

/* رویدادهای سناریو */
$('#ccOffsetEnabled').checked = state.ccOffsetEnabled;
$('#ccOffsetState').textContent = state.ccOffsetEnabled ? 'فعال' : 'غیرفعال';
$('#ccOffsetEnabled').addEventListener('change', e => {
  state.ccOffsetEnabled = e.target.checked;
  $('#ccOffsetState').textContent = state.ccOffsetEnabled ? 'فعال' : 'غیرفعال';
  if (state.ccOffsetEnabled && !state.ccOffsets.length){
    state.ccOffsets = [{ days: 30, price: 0 }, { days: 60, price: 0 }];
  }
  saveCcOffsets(); renderCcOffsetScenarios(); renderCoveredCall();
});
$('#ccOffsetAddBtn').addEventListener('click', () => {
  if (!state.ccOffsetEnabled){
    state.ccOffsetEnabled = true;
    $('#ccOffsetEnabled').checked = true;
    $('#ccOffsetState').textContent = 'فعال';
  }
  const last = state.ccOffsets[state.ccOffsets.length - 1];
  const nextDays = last ? (Number(last.days) || 30) + 30 : 30;
  state.ccOffsets.push({ days: nextDays, price: 0 });
  saveCcOffsets(); renderCcOffsetScenarios(); renderCoveredCall();
});
$('#ccOffsetClearBtn').addEventListener('click', () => {
  state.ccOffsets = [];
  saveCcOffsets(); renderCcOffsetScenarios(); renderCoveredCall();
});

renderCcOffsetScenarios();

