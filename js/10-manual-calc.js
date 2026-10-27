/* ============================================================
   بخش ۲۹: محاسبات دستی
   منبع: option-ver16.html خطوط 4741-4996
   ============================================================ */
/* ==================================================================
   ۲۹) محاسبات دستی
   ================================================================== */
(function loadCalcPrices(){
  try {
    const s = JSON.parse(localStorage.getItem('calcManualPrices') || '{}');
    if (s && typeof s === 'object') state.calcManualPrices = s;
  } catch(e){}
})();
function saveCalcPrices(){
  try { localStorage.setItem('calcManualPrices', JSON.stringify(state.calcManualPrices)); } catch(e){}
}

function computeCalcRow(opt){
  const S = getUnderlyingPrice(opt.underlying);
  const K = opt.strike;
  const marketP = opt.price;
  const raw = state.calcManualPrices[opt.sym];
  const hasManual = (raw !== undefined && raw !== null && Number(raw) > 0);
  const P = hasManual ? Number(raw) : marketP;
  const days = opt.days;
  const isCall = opt.type === 'call';
  const fund = isFundUnderlying(opt.underlying);
  const fee = optionFee(S, P, {
    apply: state.calcApplyFee,
    feePct: fund ? state.calcFundFeePct : state.calcNonFundFeePct,
    feeOnPremium: false
  });
  const netPremium = P - fee;
  const deep = isCall ? (K - S + netPremium) : null;
  const fuel = isCall ? netPremium : null;
  let status;
  if (isCall) status = S > K ? 'ITM' : (S === K ? 'ATM' : 'OTM');
  else status = S < K ? 'ITM' : (S === K ? 'ATM' : 'OTM');
  const mode = getAnnualMode();
  const mDeep = isCall ? optionReturn(K, S, P, fee, days, mode) : null;
  const mFuel = isCall ? optionPremiumReturn(netPremium, S, P, days, mode) : null;
  const deepPct = (mDeep && mDeep.valid) ? mDeep.annFrac : null;
  const deepDailyPct = (mDeep && mDeep.valid) ? mDeep.retFrac : null;
  const fuelPct = (mFuel && mFuel.ann !== null) ? mFuel.ann / 100 : null;
  const fuelDailyPct = (mFuel && mFuel.pct !== null) ? mFuel.pct / 100 : null;
  return {
    sym: opt.sym, name: opt.name, fund, isCall,
    strike: K, underlying: opt.underlying, type: opt.type, days,
    expiryStr: opt.expiryStr, S, marketP, P, hasManual,
    fee, deep, fuel, netPremium,
    deepPct, deepDailyPct, fuelPct, fuelDailyPct, status
  };
}

function updateCalcRowDisplay(tr, sym){
  const opt = state.options.find(o => o.sym === sym);
  if (!opt || !tr) return;
  const r = computeCalcRow(opt);
  const setCell = (field, text, cls) => {
    const cell = tr.querySelector(`[data-calc-cell="${field}"]`);
    if (!cell) return;
    cell.textContent = text;
    cell.className = 'num' + (cls ? ' ' + cls : '');
  };
  const statusCell = tr.querySelector('.status');
  if (statusCell) {
    const cls = r.status === 'ITM' ? 'itm' : (r.status === 'OTM' ? 'otm' : 'atm');
    statusCell.className = 'status ' + cls;
    statusCell.textContent = r.status;
  }
  setCell('deep',         r.deep === null ? '—' : fmt0(r.deep),                             r.deep === null ? '' : (r.deep >= 0 ? 'pos' : 'neg'));
  setCell('deepPct',      r.deepPct === null ? '—' : (r.deepPct*100).toFixed(2) + '%',       r.deepPct === null ? '' : (r.deepPct >= 0 ? 'pos' : 'neg'));
  setCell('deepDailyPct', r.deepDailyPct === null ? '—' : (r.deepDailyPct*100).toFixed(4) + '%', r.deepDailyPct === null ? '' : (r.deepDailyPct >= 0 ? 'pos' : 'neg'));
  setCell('fuel',         r.fuel === null ? '—' : fmt0(r.fuel),                             r.fuel === null ? '' : (r.fuel >= 0 ? 'pos' : 'neg'));
  setCell('fuelPct',      r.fuelPct === null ? '—' : (r.fuelPct*100).toFixed(2) + '%',       r.fuelPct === null ? '' : (r.fuelPct >= 0 ? 'pos' : 'neg'));
  setCell('fuelDailyPct', r.fuelDailyPct === null ? '—' : (r.fuelDailyPct*100).toFixed(4) + '%', r.fuelDailyPct === null ? '' : (r.fuelDailyPct >= 0 ? 'pos' : 'neg'));
}

function renderCalculations(){
  const tbl = document.getElementById('calcTable');
  const hint = document.getElementById('calcHint');
  const status = document.getElementById('calcStatus');
  if (!tbl) return;

  if (!state.options || !state.options.length){
    tbl.innerHTML = `<tbody><tr><td style="text-align:center;padding:36px;color:#64748b">هنوز داده‌ای دریافت نشده است. ابتدا از بخش «تحلیل استراتژی» دکمه دریافت داده را بزنید.</td></tr></tbody>`;
    if (hint) hint.textContent = '';
    if (status) status.innerHTML = '<span class="dot wait"></span>در انتظار داده';
    return;
  }

  const applyEl = document.getElementById('calcApplyFee');
  if (applyEl) applyEl.checked = state.calcApplyFee;
  const nonFundEl = document.getElementById('calcNonFundFee');
  if (nonFundEl){ nonFundEl.value = state.calcNonFundFeePct; nonFundEl.disabled = !state.calcApplyFee; }
  const fundEl = document.getElementById('calcFundFee');
  if (fundEl){ fundEl.value = state.calcFundFeePct; fundEl.disabled = !state.calcApplyFee; }

  let rows = state.options.map(computeCalcRow);

  const uSel = document.getElementById('calcFilterUnderlying');
  const currentU = uSel ? uSel.value : '';
  const uniqueU = [...new Set(rows.map(r => r.underlying))].sort((a,b) => a.localeCompare(b,'fa'));
  if (uSel && uSel.options.length - 1 !== uniqueU.length){
    uSel.innerHTML = '<option value="">همه دارایی‌های پایه</option>' + uniqueU.map(u => `<option value="${u}">${u}</option>`).join('');
    uSel.value = currentU;
  }

  const q = (document.getElementById('calcSearch')?.value || '').trim().toLowerCase();
  const fType = document.getElementById('calcFilterType')?.value || '';
  const fU = uSel?.value || '';

  rows = rows.filter(r => {
    if (fType && r.type !== fType) return false;
    if (fU && r.underlying !== fU) return false;
    if (q){
      const hay = (r.sym + ' ' + r.name + ' ' + r.underlying).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  rows.sort((a,b) => {
    const u = a.underlying.localeCompare(b.underlying, 'fa'); if (u) return u;
    if (a.type !== b.type) return a.type === 'call' ? -1 : 1;
    return a.strike - b.strike;
  });

  let thead = `<thead><tr>
    <th>#</th><th>نماد</th><th>دارایی پایه</th><th>نوع</th><th>صندوق</th>
    <th>قیمت اعمال</th><th>قیمت پایه</th><th>قیمت بازار</th>
    <th style="background:#0369a1;color:#fff">قیمت دستی ✎</th>
    <th>روز</th><th>وضعیت</th>
    <th>Deep</th><th>Deep % سالانه</th><th>Deep % روزانه</th>
    <th>سوخت</th><th>سوخت % سالانه</th><th>سوخت % روزانه</th>
  </tr></thead>`;

  let tbody = '<tbody>';
  if (!rows.length){
    tbody += `<tr><td colspan="17" style="text-align:center;padding:24px;color:#64748b">نتیجه‌ای یافت نشد.</td></tr>`;
  } else {
    rows.forEach((r, i) => {
      const rowCls = r.isCall ? 'call-row' : 'put-row';
      const statusCls = r.status === 'ITM' ? 'itm' : (r.status === 'OTM' ? 'otm' : 'atm');
      const deepVal = r.deep === null ? '—' : fmt0(r.deep);
      const deepCls = r.deep === null ? '' : (r.deep >= 0 ? 'pos' : 'neg');
      const deepPctVal = r.deepPct === null ? '—' : (r.deepPct*100).toFixed(2) + '%';
      const deepPctCls = r.deepPct === null ? '' : (r.deepPct >= 0 ? 'pos' : 'neg');
      const deepDailyVal = r.deepDailyPct === null ? '—' : (r.deepDailyPct*100).toFixed(4) + '%';
      const deepDailyCls = r.deepDailyPct === null ? '' : (r.deepDailyPct >= 0 ? 'pos' : 'neg');
      const fuelVal = r.fuel === null ? '—' : fmt0(r.fuel);
      const fuelCls = r.fuel === null ? '' : (r.fuel >= 0 ? 'pos' : 'neg');
      const fuelPctVal = r.fuelPct === null ? '—' : (r.fuelPct*100).toFixed(2) + '%';
      const fuelPctCls = r.fuelPct === null ? '' : (r.fuelPct >= 0 ? 'pos' : 'neg');
      const fuelDailyVal = r.fuelDailyPct === null ? '—' : (r.fuelDailyPct*100).toFixed(4) + '%';
      const fuelDailyCls = r.fuelDailyPct === null ? '' : (r.fuelDailyPct >= 0 ? 'pos' : 'neg');
      const manualVal = r.hasManual ? r.P : '';
      const placeholder = fmt0(r.marketP);

      tbody += `<tr class="${rowCls}">
        <td class="num">${i+1}</td>
        <td class="sym-cell" title="${escapeAttr(r.name)}">${escapeHtml(r.sym)}</td>
        <td>${escapeHtml(r.underlying)}</td>
        <td>${r.isCall ? '<span class="tag call">Call</span>' : '<span class="tag put">Put</span>'}</td>
        <td>${r.fund ? '<span class="tag fund">صندوق</span>' : '<span class="tag nofund">غیرصندوق</span>'}</td>
        <td class="num price">${fmt0(r.strike)}</td>
        <td class="num">${fmt0(r.S)}</td>
        <td class="num market-price-cell" data-sym="${escapeAttr(r.sym)}" data-market-price="${r.marketP}" title="کلیک کنید تا در فیلد قیمت دستی قرار گیرد">${fmt0(r.marketP)}</td>
        <td class="num manual-price-cell">
          <input type="text" inputmode="decimal" value="${manualVal}" placeholder="${placeholder}" data-sym="${escapeAttr(r.sym)}" data-calc-price>
        </td>
        <td class="num">${r.days}</td>
        <td class="status ${statusCls}">${r.status}</td>
        <td class="num ${deepCls}" data-calc-cell="deep">${deepVal}</td>
        <td class="num ${deepPctCls}" data-calc-cell="deepPct">${deepPctVal}</td>
        <td class="num ${deepDailyCls}" data-calc-cell="deepDailyPct">${deepDailyVal}</td>
        <td class="num ${fuelCls}" data-calc-cell="fuel">${fuelVal}</td>
        <td class="num ${fuelPctCls}" data-calc-cell="fuelPct">${fuelPctVal}</td>
        <td class="num ${fuelDailyCls}" data-calc-cell="fuelDailyPct">${fuelDailyVal}</td>
      </tr>`;
    });
  }
  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;

  const refreshHint = () => {
    const manualCount = Object.keys(state.calcManualPrices).length;
    const feeNote = state.calcApplyFee
      ? `کارمزد: غیرصندوق ${state.calcNonFundFeePct}% / صندوق ${state.calcFundFeePct}%`
      : 'کارمزد: غیرفعال';
    if (hint) hint.textContent = `${rows.length} از ${state.options.length} اختیار | ${manualCount} قیمت دستی | ${feeNote} | 💡 برای درج سریع قیمت بازار، روی سلول «قیمت بازار» کلیک کنید`;
  };

  tbl.querySelectorAll('input[data-calc-price]').forEach(inp => {
    inp.addEventListener('input', e => {
      const sym = e.target.dataset.sym;
      const val = toNum(e.target.value);
      if (val > 0) state.calcManualPrices[sym] = val;
      else delete state.calcManualPrices[sym];
      saveCalcPrices();
      updateCalcRowDisplay(inp.closest('tr'), sym);
      refreshHint();
    });
  });

  tbl.querySelectorAll('td.market-price-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const sym = cell.dataset.sym;
      const price = Number(cell.dataset.marketPrice) || 0;
      if (!(price > 0)) return;
      state.calcManualPrices[sym] = price;
      saveCalcPrices();
      const inp = tbl.querySelector(`input[data-calc-price][data-sym="${sym}"]`);
      if (inp){ inp.value = price; updateCalcRowDisplay(inp.closest('tr'), sym); }
      refreshHint();
    });
  });

  refreshHint();
  if (status) status.innerHTML = `<span class="dot ok"></span>${rows.length} اختیار`;
}

(function bindCalcEvents(){
  const bind = () => {
    ['calcSearch','calcFilterType','calcFilterUnderlying'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const ev = el.tagName === 'INPUT' ? 'input' : 'change';
      el.addEventListener(ev, () => {
        clearTimeout(window.__calcTimer);
        window.__calcTimer = setTimeout(renderCalculations, 200);
      });
    });
    const applyEl = document.getElementById('calcApplyFee');
    if (applyEl) applyEl.addEventListener('change', e => {
      state.calcApplyFee = e.target.checked;
      renderCalculations();
    });
    const nonFundEl = document.getElementById('calcNonFundFee');
    if (nonFundEl) nonFundEl.addEventListener('input', e => {
      state.calcNonFundFeePct = toNum(e.target.value);
      clearTimeout(window.__calcFeeTimer);
      window.__calcFeeTimer = setTimeout(renderCalculations, 250);
    });
    const fundEl = document.getElementById('calcFundFee');
    if (fundEl) fundEl.addEventListener('input', e => {
      state.calcFundFeePct = toNum(e.target.value);
      clearTimeout(window.__calcFeeTimer);
      window.__calcFeeTimer = setTimeout(renderCalculations, 250);
    });
    const resetBtn = document.getElementById('calcResetPricesBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      state.calcManualPrices = {};
      saveCalcPrices();
      renderCalculations();
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

