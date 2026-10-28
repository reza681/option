/* ============================================================
   بخش ۲۸: استراتژی تا فردا (تحلیل رول)
   ============================================================ */

// تابع جدید برای پر کردن منوی انتخاب استراتژی
function populateTtStrategies() {
  const sel = document.getElementById('ttStrategySelect');
  if (!sel) return;
  const currentVal = sel.value;
  const strategies = [...new Set((state.savedPositions || []).map(p => p.strategyName || 'بدون نام'))];
  
  sel.innerHTML = '<option value="all">همه استراتژی‌ها (کل پرتفوی)</option>' + 
    strategies.map(s => `<option value="${s}">${s}</option>`).join('');
    
  if (strategies.includes(currentVal)) {
    sel.value = currentVal;
  } else {
    sel.value = 'all';
  }
}

(function initTillTomorrow() {
  const analyzeBtn = document.getElementById('ttAnalyzeBtn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => {
      populateTtStrategies(); // به‌روزرسانی لیست استراتژی‌ها قبل از تحلیل
      analyzeRollSuggestions();
    });
  }

  const printBtn = document.getElementById('ttPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      printTtTableOnly();
    });
  }

  // با تغییر استراتژی، تحلیل مجدد انجام شود
  const stratSel = document.getElementById('ttStrategySelect');
  if (stratSel) {
    stratSel.addEventListener('change', () => {
      analyzeRollSuggestions();
    });
  }

  // با تغییر حالت (اتوماتیک/دستی)، تحلیل مجدد انجام شود
  const modeSel = document.getElementById('ttModeSelect');
  if (modeSel) {
    modeSel.addEventListener('change', () => {
      analyzeRollSuggestions();
    });
  }
})();

// تابع ساخت محتوای پاپ‌اور برای جدول استراتژی تا فردا
function buildTtCalcHtml(r, field) {
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
    case 'qty':
      return wrap('تعداد موقعیت', null, null, fmt0(r.qty), 'تعداد اختیارهای فروش شده در این موقعیت.');

    case 'currentK':
      return wrap('قیمت اعمال فعلی (K)', null,
        [['نماد', escapeHtml(r.sym)], ['دارایی پایه', escapeHtml(r.underlying)]],
        fmt0(r.currentK), 'قیمت اعمالی که در موقعیت فعلی فروخته‌اید.');

    case 'currentPrice':
      return wrap('قیمت بازار فعلی', null,
        [['نماد', escapeHtml(r.sym)], ['روز تا سررسید', r.currentDays + ' روز']],
        fmt0(r.currentPrice), 'آخرین قیمت معامله‌شده این اختیار در بازار.');

    case 'currentYtm': {
      if (r.currentYtm === null) return wrap('YTM فعلی', null, [['وضعیت', 'نامشخص']], '—', 'داده کافی برای محاسبه وجود ندارد.');
      const feeLbl = r.fund ? `صندوق ${state.wlFundFeePct}%` : `غیرصندوق ${state.wlNonFundFeePct}%`;
      return wrap('YTM سالانه فعلی', 'بر اساس وضعیت (اعمال/سوخت) در سررسید محاسبه شده است.',
        [
          ['S (قیمت سهم پایه)', fmt0(r.S)],
          ['K (قیمت اعمال)', fmt0(r.currentK)],
          ['P (پرمیوم اولیه)', fmt0(r.currentPrice)],
          ['fee (کارمزد)', fmt0(r.currentFee) + ' — ' + feeLbl],
          ['P_net (پرمیوم خالص)', fmt0(r.currentPrice - r.currentFee)],
          ['وضعیت', r.assigned ? 'اعمال' : 'سوخت'],
          ['روز تا سررسید', r.currentDays + ' روز']
        ],
        (r.currentYtm >= 0 ? '+' : '') + r.currentYtm.toFixed(1) + '%',
        'این نرخ بازده، سود یا زیان موقعیت فعلی را در صورت نگه‌داشتن تا سررسید نشان می‌دهد (سالانه شده).');
    }

    case 'nextK':
      return wrap('قیمت اعمال جدید (K)', null,
        [['نماد جدید', escapeHtml(r.nextSym || '—')]],
        fmt0(r.nextK || 0), 'قیمت اعمالی که برای رول کردن انتخاب شده است.');

    case 'nextPrice':
      return wrap('پرمیوم جدید (P)', null,
        [['نماد جدید', escapeHtml(r.nextSym || '—')], ['روز تا سررسید', (r.nextDays || 0) + ' روز']],
        fmt0(r.nextPrice || 0), 'پرمیوم اختیار جدید در سررسید بعدی.');

    case 'closeCost':
      return wrap('هزینه بستن موقعیت فعلی', 'closeCost = P_market × rollQty',
        [
          ['P_market (قیمت بازار فعلی)', fmt0(r.currentPrice)],
          ['rollQty (تعداد رول شده)', fmt0(r.rollQty || r.qty)],
          ['محاسبه', fmt0(r.currentPrice) + ' × ' + fmt0(r.rollQty || r.qty)]
        ],
        fmt0(r.closeCost || 0), 'مبلغی که باید پرداخت کنید تا موقعیت فروش فعلی خود را ببندید (خرید همان تعداد اختیار).');

    case 'newIncome':
      return wrap('دریافتی از فروش جدید', 'newIncome = P_new × rollQty',
        [
          ['P_new (پرمیوم جدید)', fmt0(r.nextPrice || 0)],
          ['rollQty (تعداد رول شده)', fmt0(r.rollQty || r.qty)],
          ['محاسبه', fmt0(r.nextPrice || 0) + ' × ' + fmt0(r.rollQty || r.qty)]
        ],
        fmt0(r.newIncome || 0), 'مبلغی که از فروش اختیار در سررسید جدید دریافت می‌کنید.');

    case 'rollCash':
      return wrap('جریان نقدی رول', 'rollCash = newIncome - closeCost',
        [
          ['دریافتی جدید', fmt0(r.newIncome || 0)],
          ['هزینه بستن', fmt0(r.closeCost || 0)],
          ['محاسبه', fmt0(r.newIncome || 0) + ' − ' + fmt0(r.closeCost || 0)]
        ],
        fmt0(r.rollCash || 0), 'اگر مثبت باشد، رول کردن نقدینگی به شما اضافه می‌کند. اگر منفی باشد، باید پول اضافه کنید.');

    case 'newYtm': {
      if (r.newYtm === null) return wrap('YTM جدید', null, [['وضعیت', 'نامشخص']], '—', 'داده کافی برای محاسبه وجود ندارد.');
      const feeLbl = r.fund ? `صندوق ${state.wlFundFeePct}%` : `غیرصندوق ${state.wlNonFundFeePct}%`;
      return wrap('YTM سالانه پس از رول', 'بر اساس قیمت فعلی سهم و سررسید جدید محاسبه شده است.',
        [
          ['S (قیمت سهم پایه)', fmt0(r.S)],
          ['K (قیمت اعمال جدید)', fmt0(r.nextK || 0)],
          ['P (پرمیوم جدید)', fmt0(r.nextPrice || 0)],
          ['fee (کارمزد)', fmt0(r.nextFee || 0) + ' — ' + feeLbl],
          ['P_net (پرمیوم خالص)', fmt0((r.nextPrice || 0) - (r.nextFee || 0))],
          ['وضعیت فرضی', 'اعمال'],
          ['روز تا سررسید جدید', (r.nextDays || 0) + ' روز']
        ],
        (r.newYtm >= 0 ? '+' : '') + r.newYtm.toFixed(1) + '%',
        'اگر موقعیت فعلی را ببندید و موقعیت جدید را باز کنید، این نرخ بازده سالانه شما در سررسید بعدی خواهد بود.');
    }
  }
  return null;
}

function analyzeRollSuggestions() {
  const tbl = document.getElementById('ttTable');
  const summaryEl = document.getElementById('ttSummary');
  const statusEl = document.getElementById('ttStatus');
  const hintEl = document.getElementById('ttHint');

  if (!state.savedPositions || !state.savedPositions.length) {
    tbl.innerHTML = `<tbody><tr><td style="text-align:center;padding:30px;color:var(--bad);font-weight:700">هیچ موقعیتی در «گزارش موقعیت‌ها» ثبت نشده است. ابتدا در آن بخش موقعیت‌های خود را اضافه کنید.</td></tr></tbody>`;
    if (summaryEl) summaryEl.innerHTML = '';
    if (hintEl) hintEl.textContent = '';
    if (statusEl) statusEl.innerHTML = '<span class="dot bad"></span>بدون موقعیت';
    window.__ttLastAnalysis = null;
    return;
  }

  if (!state.options || !state.options.length) {
    tbl.innerHTML = `<tbody><tr><td style="text-align:center;padding:30px;color:var(--bad);font-weight:700">داده‌های بازار دریافت نشده است. ابتدا از تب «تحلیل استراتژی» داده‌ها را دریافت کنید.</td></tr></tbody>`;
    if (hintEl) hintEl.textContent = '';
    if (statusEl) statusEl.innerHTML = '<span class="dot bad"></span>بدون داده بازار';
    window.__ttLastAnalysis = null;
    return;
  }

  const selectedStrategy = document.getElementById('ttStrategySelect')?.value || 'all';
  const mode = document.getElementById('ttModeSelect')?.value || 'auto';
  
  let modeText = '';
  if (mode === 'auto') modeText = 'اتوماتیک';
  else if (mode === 'manual') modeText = 'دستی';

  // 1. فیلتر کردن موقعیت‌های فروش اختیار (کاورد کال) بر اساس استراتژی انتخاب شده
  const shortCalls = state.savedPositions.filter(p => {
    if (p.type !== 'option' || p.direction !== 'sell') return false;
    if (selectedStrategy !== 'all' && (p.strategyName || 'بدون نام') !== selectedStrategy) return false;
    const opt = state.options.find(o => o.sym === p.sym);
    return opt && opt.type === 'call';
  });

  if (!shortCalls.length) {
    tbl.innerHTML = `<tbody><tr><td style="text-align:center;padding:30px;color:var(--muted)">هیچ موقعیت <b>فروش اختیار خرید (Call)</b> در استراتژی انتخابی یافت نشد. این بخش مخصوص تحلیل کاورد کال است.</td></tr></tbody>`;
    if (summaryEl) summaryEl.innerHTML = '';
    if (hintEl) hintEl.textContent = '';
    if (statusEl) statusEl.innerHTML = '<span class="dot ok"></span>آماده';
    window.__ttLastAnalysis = null;
    return;
  }

  let totalRollCash = 0;
  let totalCurrentYtmWeighted = 0;
  let totalNewYtmWeighted = 0;
  let totalWeight = 0;
  let suggestionsCount = 0;
  let totalCloseCost = 0;
  let totalNewIncome = 0;
  let totalRealizedPnl = 0;

  let rowsHtml = '';
  const analyzedRows = [];

  shortCalls.forEach((pos, i) => {
    const opt = state.options.find(o => o.sym === pos.sym);
    if (!opt) return;

    const currentRow = computeSavedPositionRow(pos);
    if (currentRow.missing) return;

    const S = currentRow.S;
    const origQty = currentRow.qty;
    const currentExpiry = opt.expiryStr;
    const currentDays = opt.days;
    
    let percent = 100;
    if (mode === 'manual' && state.ttManualPercentages && state.ttManualPercentages[pos.sym] !== undefined) {
        percent = state.ttManualPercentages[pos.sym];
    }
    
    const rollQty = Math.floor(origQty * percent / 100);
    const closeCost = currentRow.P_market * rollQty;
    const realizedPnl = (currentRow.P_avg * rollQty) - (currentRow.P_market * rollQty);

    let nextCall = null;
    let nextDays = 0;
    let newIncome = 0;
    let rollCash = 0;
    let newYtm = null;
    let rollAction = '—';
    let newFee = 0;
    let nextExpiry = null;

    // ۱. بررسی انتخاب دستی
    if (mode === 'manual' && state.ttManualSelections && state.ttManualSelections[pos.sym]) {
        nextCall = state.options.find(o => o.sym === state.ttManualSelections[pos.sym]);
    }

    // ۲. حالت اتوماتیک
    if (!nextCall && mode === 'auto') {
        const allExpiries = sortExpiries(state.options.filter(o => o.underlying === opt.underlying && o.type === 'call').map(o => o.expiryStr));
        const autoNextExpiry = allExpiries.find(e => expiryKey(e) > expiryKey(currentExpiry));
        
        if (autoNextExpiry) {
          const nextCalls = state.options.filter(o => o.underlying === opt.underlying && o.type === 'call' && o.expiryStr === autoNextExpiry);
          if (nextCalls.length) {
            nextCall = nextCalls.reduce((prev, curr) => Math.abs(curr.strike - opt.strike) < Math.abs(prev.strike - opt.strike) ? curr : prev);
          }
        }
    }

    if (nextCall) {
        nextExpiry = nextCall.expiryStr;
        nextDays = nextCall.days;
        newIncome = nextCall.price * rollQty;
        rollCash = newIncome - closeCost;
        newFee = optionFee(S, nextCall.price, {
            apply: state.wlApplyFee, feePct: currentRow.fund ? state.wlFundFeePct : state.wlNonFundFeePct, feeOnPremium: false
        });
        
        newYtm = computeOptionYtmInternal(true, 'sell', nextCall.strike, S, nextCall.price, newFee, nextDays, true);
        
        if (currentRow.ytm !== null && newYtm !== null) {
          if (newYtm > currentRow.ytm) {
            rollAction = '<span class="pos" style="font-weight:800">پیشنهاد می‌شود</span>';
            suggestionsCount++;
          } else {
            rollAction = '<span style="color:var(--muted)">خیر (YTM پایین‌تر)</span>';
          }
        }

        totalRollCash += rollCash;
        totalCloseCost += closeCost;
        totalNewIncome += newIncome;
        totalRealizedPnl += realizedPnl;

        if (currentRow.ytm !== null) {
          const weight = rollQty * currentRow.P_avg;
          totalCurrentYtmWeighted += currentRow.ytm * weight;
          totalNewYtmWeighted += newYtm * weight;
          totalWeight += weight;
        }
    } else {
        rollAction = mode === 'manual' ? 'انتخاب نشده' : 'سررسید بعدی موجود نیست';
    }

    const ytmCls = currentRow.ytm >= 0 ? 'pos' : 'neg';
    const newYtmCls = newYtm >= 0 ? 'pos' : 'neg';
    const rollCashCls = rollCash >= 0 ? 'pos' : 'neg';
    const rowCls = (rollAction.includes('پیشنهاد می‌شود')) ? 'style="background:rgba(21,128,61,0.06)"' : '';

    // ساخت سلول نماد جدید
    let nextSymCell = '';
    if (mode === 'manual') {
        nextSymCell = `<select class="tt-manual-select" data-current-sym="${pos.sym}" style="padding:6px 8px;font-size:12px;border:1px solid var(--line-2);border-radius:6px;background:var(--card);color:var(--ink);font-family:inherit;cursor:pointer;width:100%;min-width:130px;max-width:200px;outline:none;direction:ltr;text-align:left;">
            <option value="">— خودکار —</option>`;
        
        const groupedCalls = {};
        state.options.filter(o => o.type === 'call' && o.underlying === opt.underlying && o.days > 0).forEach(o => {
            if (!groupedCalls[o.expiryStr]) groupedCalls[o.expiryStr] = [];
            groupedCalls[o.expiryStr].push(o);
        });
        
        Object.keys(groupedCalls).sort((a,b)=>expiryKey(a)-expiryKey(b)).forEach(exp => {
            nextSymCell += `<optgroup label="سررسید ${exp}">`;
            groupedCalls[exp].sort((a,b)=>a.strike-b.strike).forEach(o => {
                const isSelected = nextCall && nextCall.sym === o.sym;
                nextSymCell += `<option value="${o.sym}" ${isSelected ? 'selected' : ''}>${o.sym} (K=${fmt0(o.strike)})</option>`;
            });
            nextSymCell += `</optgroup>`;
        });
        nextSymCell += `</select>`;
    } else {
        nextSymCell = nextCall ? escapeHtml(nextCall.sym) : '—';
    }

    const rowIndex = analyzedRows.length;
    analyzedRows.push({
        posId: pos.id,
        sym: pos.sym,
        underlying: opt.underlying,
        name: opt.name,
        qty: origQty,
        rollQty: rollQty,
        percent: percent,
        currentExpiry: currentExpiry,
        currentDays: currentDays,
        currentK: opt.strike,
        currentPrice: currentRow.P_market,
        currentYtm: currentRow.ytm,
        nextExpiry: nextCall ? nextExpiry : null,
        nextDays: nextCall ? nextDays : null,
        nextSym: nextCall ? nextCall.sym : null,
        nextK: nextCall ? nextCall.strike : null,
        nextPrice: nextCall ? nextCall.price : null,
        closeCost: nextCall ? closeCost : 0,
        newIncome: nextCall ? newIncome : 0,
        rollCash: nextCall ? rollCash : 0,
        newYtm: nextCall ? newYtm : null,
        status: nextCall ? (rollAction.includes('پیشنهاد می‌شود') ? 'پیشنهاد می‌شود' : 'خیر') : '—',
        S: S,
        currentFee: currentRow.fee,
        fund: currentRow.fund,
        nextFee: nextCall ? newFee : 0,
        assigned: currentRow.assigned
    });

    const isManual = (mode === 'manual');

    rowsHtml += `<tr ${rowCls}>
      <td class="num">${i + 1}</td>
      <td class="sym-cell" title="${escapeAttr(opt.name)}">${escapeHtml(pos.sym)}</td>
      <td class="num" data-tt-calc="qty" data-tt-row="${rowIndex}">${origQty}</td>
      <td>${escapeHtml(currentExpiry)} <small>(${currentDays} روز)</small></td>
      <td class="num" data-tt-calc="currentK" data-tt-row="${rowIndex}">${fmt0(opt.strike)}</td>
      <td class="num" data-tt-calc="currentPrice" data-tt-row="${rowIndex}">${fmt0(currentRow.P_market)}</td>
      <td class="num ${ytmCls}" data-tt-calc="currentYtm" data-tt-row="${rowIndex}"><b>${currentRow.ytm !== null ? currentRow.ytm.toFixed(1) + '%' : '—'}</b></td>
      
      <td>${nextExpiry ? escapeHtml(nextExpiry) + ` <small>(${nextDays} روز)</small>` : '—'}</td>
      <td style="text-align:center;">${nextSymCell}</td>
      ${isManual ? `<td style="text-align:center;">
          <input type="number" class="tt-manual-percent" data-current-sym="${pos.sym}" value="${percent}" min="1" max="100" style="width:50px; padding:4px; text-align:center; border:1px solid var(--line-2); border-radius:4px; outline:none;">
          <br><small style="font-size:10px;color:var(--muted)">${rollQty} عدد</small>
      </td>` : ''}
      <td class="num" data-tt-calc="nextK" data-tt-row="${rowIndex}">${nextCall ? fmt0(nextCall.strike) : '—'}</td>
      <td class="num" data-tt-calc="nextPrice" data-tt-row="${rowIndex}">${nextCall ? fmt0(nextCall.price) : '—'}</td>
      <td class="num neg" data-tt-calc="closeCost" data-tt-row="${rowIndex}"><b>${nextCall ? fmt0(closeCost) : '—'}</b></td>
      <td class="num pos" data-tt-calc="newIncome" data-tt-row="${rowIndex}"><b>${nextCall ? fmt0(newIncome) : '—'}</b></td>
      <td class="num ${rollCashCls}" data-tt-calc="rollCash" data-tt-row="${rowIndex}"><b>${nextCall ? fmt0(rollCash) : '—'}</b></td>
      <td class="num ${newYtmCls}" data-tt-calc="newYtm" data-tt-row="${rowIndex}"><b>${newYtm !== null ? newYtm.toFixed(1) + '%' : '—'}</b></td>
      <td>${rollAction}</td>
    </tr>`;
  });
  
  window.__ttLastAnalysis = {
    rows: analyzedRows,
    totalCloseCost,
    totalNewIncome,
    totalRollCash,
    totalRealizedPnl,
    suggestionsCount,
    strategyFilter: selectedStrategy,
    strategyName: selectedStrategy === 'all' ? 'کل پرتفوی' : selectedStrategy
  };

  const isManualMode = (mode === 'manual');
  const nextColspan = isManualMode ? 9 : 8;

  const thead = `<thead>
    <tr>
      <th colspan="7" style="background:#1e293b;text-align:center;border-left:1px solid #334155">موقعیت فعلی</th>
      <th colspan="${nextColspan}" style="background:#0369a1;text-align:center">پیشنهاد رول (سررسید بعدی)</th>
      <th style="background:#1e293b">نتیجه</th>
    </tr>
    <tr>
      <th>#</th><th>نماد</th><th>تعداد</th><th>سررسید فعلی</th><th>اعمال (K)</th><th>قیمت بازار</th><th>YTM فعلی</th>
      <th>سررسید بعدی</th><th>نماد جدید</th>
      ${isManualMode ? '<th>درصد از کل</th>' : ''}
      <th>اعمال جدید (K)</th><th>پرمیوم جدید</th>
      <th style="color:#fca5a5">هزینه بستن (پرداختی)</th>
      <th style="color:#86efac">دریافتی جدید</th>
      <th>جریان نقدی رول</th><th>YTM جدید</th>
      <th>وضعیت</th>
    </tr>
  </thead>`;

  const tbody = `<tbody>${rowsHtml}</tbody>`;
  tbl.innerHTML = thead + tbody;

  // اتصال رویداد کلیک به سلول‌های جدول
  const ttRowsData = window.__ttLastAnalysis.rows;
  tbl.querySelectorAll('td[data-tt-calc]').forEach(td => {
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = +td.dataset.ttRow;
      const field = td.dataset.ttCalc;
      const row = ttRowsData[idx];
      if (!row) return;
      
      const isSame = !$calcPopover.classList.contains('hidden') && $calcPopover.__lastTd === td;
      if (isSame) { closeCalcPopover(); return; }
      
      const html = buildTtCalcHtml(row, field);
      if (html) showCalcPopover(td, html);
    });
  });

  // اتصال رویداد برای منوی کشویی انتخاب دستی
  tbl.querySelectorAll('.tt-manual-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
        const currentSym = e.target.dataset.currentSym;
        if (!state.ttManualSelections) state.ttManualSelections = {};
        if (e.target.value) {
            state.ttManualSelections[currentSym] = e.target.value;
        } else {
            delete state.ttManualSelections[currentSym];
        }
        analyzeRollSuggestions(); // رفرش جدول با انتخاب جدید
    });
  });

  // اتصال رویداد برای فیلد درصد در حالت دستی
  tbl.querySelectorAll('.tt-manual-percent').forEach(inp => {
    inp.addEventListener('change', (e) => {
        const currentSym = e.target.dataset.currentSym;
        if (!state.ttManualPercentages) state.ttManualPercentages = {};
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 100) val = 100;
        state.ttManualPercentages[currentSym] = val;
        analyzeRollSuggestions(); // رفرش جدول با درصد جدید
    });
  });

  if (summaryEl) {
    const avgCurrentYtm = totalWeight > 0 ? totalCurrentYtmWeighted / totalWeight : 0;
    const avgNewYtm = totalWeight > 0 ? totalNewYtmWeighted / totalWeight : 0;
    const diffYtm = avgNewYtm - avgCurrentYtm;

    summaryEl.innerHTML = `
      <div class="stat"><div class="k">تعداد موقعیت‌های بررسی شده</div><div class="v">${shortCalls.length}</div></div>
      <div class="stat ${suggestionsCount > 0 ? 'pos' : ''}"><div class="k">پیشنهاد برای رول</div><div class="v ${suggestionsCount > 0 ? 'pos' : 'off'}">${suggestionsCount}</div></div>
      <div class="stat neg"><div class="k">مجموع هزینه بستن</div><div class="v neg">${fmt0(totalCloseCost)}</div></div>
      <div class="stat pos"><div class="k">مجموع دریافتی جدید</div><div class="v pos">${fmt0(totalNewIncome)}</div></div>
      <div class="stat ${totalRollCash >= 0 ? 'pos' : 'neg'}"><div class="k">جریان نقدی خالص رول</div><div class="v ${totalRollCash >= 0 ? 'pos' : 'neg'}">${fmt0(totalRollCash)}</div></div>
      <div class="stat"><div class="k">میانگین وزنی YTM فعلی</div><div class="v ${avgCurrentYtm >= 0 ? 'pos' : 'neg'}">${avgCurrentYtm.toFixed(1)}%</div></div>
      <div class="stat"><div class="k">میانگین وزنی YTM جدید</div><div class="v ${avgNewYtm >= 0 ? 'pos' : 'neg'}">${avgNewYtm.toFixed(1)}%</div></div>
      <div class="stat ${diffYtm > 0 ? 'pos' : 'neg'}"><div class="k">تغییر YTM</div><div class="v ${diffYtm > 0 ? 'pos' : 'neg'}">${diffYtm > 0 ? '+' : ''}${diffYtm.toFixed(1)}%</div></div>
    `;
  }

  if (hintEl) hintEl.textContent = `${shortCalls.length} موقعیت فروش کال بررسی شد | ${suggestionsCount} مورد برای رول پیشنهاد می‌شود | حالت: ${modeText}`;
  if (statusEl) statusEl.innerHTML = `<span class="dot ok"></span>تحلیل انجام شد`;
}

function printTtTableOnly() {
  const data = window.__ttLastAnalysis;
  if (!data || !data.rows || !data.rows.length) {
    alert('داده‌ای برای چاپ وجود ندارد. ابتدا دکمه «تحلیل و پیشنهاد رول» را بزنید.');
    return;
  }
  
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ── فقط موقعیت‌های همان استراتژی گزارش ──
  const strategyFilter = data.strategyFilter || 'all';
  const reportPositions = state.savedPositions.filter(p =>
    strategyFilter === 'all' || (p.strategyName || 'بدون نام') === strategyFilter
  );

  // نگاشت ردیف‌های رول بر اساس شناسه موقعیت (و در صورت نبود، نماد)
  const rollByPosId = {};
  const rollBySym = {};
  data.rows.forEach(r => {
    if (r.posId) rollByPosId[r.posId] = r;
    if (!rollBySym[r.sym]) rollBySym[r.sym] = r;
  });

  // مشخصات اختیار با زنجیرهٔ جایگزین: state.options → ردیف رول → گزارش موقعیت‌ها
  const rpRows = window.__rpLastRows || [];
  function resolveOptionMeta(p) {
    if (p.type === 'underlying') return null;
    const opt = (state.options || []).find(o => o.sym === p.sym);
    if (opt) return { K: opt.strike, type: opt.type, underlying: opt.underlying };
    const rr = rollByPosId[p.id] || rollBySym[p.sym];
    if (rr) return { K: rr.currentK, type: 'call', underlying: rr.underlying };
    const rp = rpRows.find(r => !r.missing && !r.isUnderlying && r.pos && r.pos.sym === p.sym);
    if (rp) return { K: rp.K, type: rp.type, underlying: rp.underlying };
    return null;
  }

  // افق زمانی: میانگین وزنی روزهای سررسید بعدی روی مقدار رول‌شده
  let ndWeighted = 0, ndQty = 0, cdWeighted = 0, cdQty = 0;
  data.rows.forEach(r => {
    const rq = r.rollQty || 0;
    if (r.nextDays > 0 && rq > 0) { ndWeighted += r.nextDays * rq; ndQty += rq; }
    const q = r.qty || 0;
    if (r.currentDays > 0 && q > 0) { cdWeighted += r.currentDays * q; cdQty += q; }
  });
  const targetDays = ndQty > 0 ? Math.round(ndWeighted / ndQty) : (cdQty > 0 ? Math.round(cdWeighted / cdQty) : 30);

  // قیمت پایهٔ هر دارایی پایه به‌صورت مستقل (نه یک قیمت برای همه)
  const basePrices = {};
  const skippedSyms = [];
  reportPositions.forEach(p => {
    const meta = p.type === 'underlying' ? null : resolveOptionMeta(p);
    const u = p.type === 'underlying' ? p.sym : (meta ? meta.underlying : null);
    if (!u) { skippedSyms.push(p.sym); return; }
    if (basePrices[u] !== undefined) return;
    let bp = getUnderlyingPrice(u) || 0;
    if (!(bp > 0)) {
      const rr = data.rows.find(r => r.underlying === u && r.S > 0);
      if (rr) bp = rr.S;
    }
    if (!(bp > 0)) {
      const rp = rpRows.find(r => !r.missing && r.isUnderlying && r.sym === u && r.S > 0);
      if (rp) bp = rp.S;
    }
    basePrices[u] = bp;
  });
  Object.keys(basePrices).forEach(u => { if (!(basePrices[u] > 0)) skippedSyms.push(u); });

  // دارایی‌های پایه‌ای که در این گزارش دخیل‌اند (برای توضیح سناریو)
  const baseSyms = Object.keys(basePrices).filter(u => basePrices[u] > 0);
  const multiUnderlying = baseSyms.length > 1;

  // دارایی پایهٔ اصلی برای محور افقی نمودار
  const underlyingSym = data.rows[0].underlying;
  const baseS = basePrices[underlyingSym] || data.rows[0].S || 0;

  // متن توضیح سناریوها برای بخش حساسیت
  const strategyLabel = data.strategyName || (strategyFilter === 'all' ? 'کل پرتفوی' : strategyFilter);
  const multiNote = multiUnderlying
    ? ` در این گزارش ${baseSyms.length} دارایی پایه دخیل است (${baseSyms.join('، ')}). سناریوها بر پایهٔ «حرکت درصدی یکنواخت همهٔ دارایی‌های پایه» محاسبه شده‌اند و محور افقی نمودار قیمت «${underlyingSym}» را نشان می‌دهد.`
    : '';
  const skippedNote = skippedSyms.length
    ? ` ⚠️ ${skippedSyms.length} موقعیت/دارایی پایه به دلیل نبود قیمت پایه از محاسبات حذف شده است: ${skippedSyms.join('، ')}.`
    : '';

  // 👇 محاسبهٔ سود/زیان و سرمایه در سناریوی «حرکت درصدی یکنواختِ هر دارایی پایه» 👇
  function calcPnlAtFactor(factor) {
    let totalPnl = 0;
    let netCapital = 0;
    let closedPnl = 0; // سود/زیان بستن موقعیت قبلی (فقط برای نمایش در ستون)

    reportPositions.forEach(p => {
      const isUnderlying = p.type === 'underlying';
      const meta = isUnderlying ? null : resolveOptionMeta(p);
      const u = isUnderlying ? p.sym : (meta ? meta.underlying : null);
      const bp = u ? basePrices[u] : 0;
      if (!u || !(bp > 0)) return;
      const price = bp * factor;
      const currentStockPrice = bp; // قیمت فعلی سهم

      if (isUnderlying) {
        const cost = p.avgPremium;
        const qty = p.qty;
        
        // ۱. سود/زیان نقدشده از بستن سهم (می‌رود در ستون بستن موقعیت قبلی)
        const stockRealizedPnl = (p.direction === 'buy' ? (currentStockPrice - cost) : (cost - currentStockPrice)) * qty;
        closedPnl += stockRealizedPnl;

        // ۲. سود و زیان آتی پوزیشن جدید سهم (فرض خرید مجدد در قیمت فعلی)
        totalPnl += (p.direction === 'buy' ? (price - currentStockPrice) : (currentStockPrice - price)) * qty;
        
        if (p.direction === 'buy') netCapital += currentStockPrice * qty;
        else netCapital -= currentStockPrice * qty;
        return;
      }

      const K = meta.K;
      const isCall = meta.type === 'call';
      const intrinsic = isCall ? Math.max(0, price - K) : Math.max(0, K - price);
      const cost = p.avgPremium;
      const qty = p.qty;

      const row = rollByPosId[p.id] || rollBySym[p.sym];
      if (row && row.nextSym) {
          const rollQty = row.rollQty || 0;
          const remQty = qty - rollQty;
          const currentPrice = row.currentPrice || 0;

          if (rollQty > 0) {
              // سود/زیان نقدشده از بستن اختیار قبلی (کل تعداد موقعیت - برای هماهنگی با آفست)
              // فقط در closedPnl ذخیره می‌شود و به totalPnl اضافه نمی‌شود
              const offsetPnlFull = (p.direction === 'sell' ? (cost - currentPrice) : (currentPrice - cost)) * qty;
              closedPnl += offsetPnlFull;
          }

          // سود و زیان پرتفوی جدید: فقط پوزیشن‌های جدید
          if (rollQty > 0) {
              const newK = row.nextK;
              const newIntrinsic = isCall ? Math.max(0, price - newK) : Math.max(0, newK - price);
              const newCost = row.nextPrice;
              const newPnl = (p.direction === 'sell' ? (newCost - newIntrinsic) : (newIntrinsic - newCost)) * rollQty;
              totalPnl += newPnl;
              if (p.direction === 'sell') netCapital -= newCost * rollQty;
              else netCapital += newCost * rollQty;
          }

          // پوزیشن باقی‌مانده اختیار قبلی (اگر رول ۱۰۰٪ نبوده)
          if (remQty > 0) {
              const remPnl = (p.direction === 'sell' ? (cost - intrinsic) : (intrinsic - cost)) * remQty;
              totalPnl += remPnl;
              if (p.direction === 'sell') netCapital -= cost * remQty;
              else netCapital += cost * remQty;
          }
      } else {
          // موقعیت‌هایی که رول نشده‌اند
          const pnl = (p.direction === 'sell' ? (cost - intrinsic) : (intrinsic - cost)) * qty;
          totalPnl += pnl;
          if (p.direction === 'sell') netCapital -= cost * qty;
          else netCapital += cost * qty;
      }
    });

    return { totalPnl, netCapital, closedPnl }; 
  }

  let chartBase64 = null;
  let sensitivityHtml = '';

  if (baseS > 0) {
    const chartCanvas = document.createElement('canvas');
    chartCanvas.width = 1000;
    chartCanvas.height = 400;
    const ctx = chartCanvas.getContext('2d');
    
    const minS = baseS * 0.6;
    const maxS = baseS * 1.4;
    const N = 200;
    const points = [];
    
    let minPnl = 0, maxPnl = 0;

    for (let i = 0; i <= N; i++) {
      const factor = 0.6 + (0.8 * i / N);
      const price = baseS * factor;
      const { totalPnl } = calcPnlAtFactor(factor);
      points.push({ price, pnl: totalPnl });
      if (totalPnl < minPnl) minPnl = totalPnl;
      if (totalPnl > maxPnl) maxPnl = totalPnl;
    }

    const padL = 80, padR = 30, padT = 40, padB = 50;
    const chartW = 1000 - padL - padR;
    const chartH = 400 - padT - padB;
    
    const yRange = maxPnl - minPnl || 1;
    const yMin = minPnl - yRange * 0.1;
    const yMax = maxPnl + yRange * 0.1;

    const sx = x => padL + (x - minS) / (maxS - minS) * chartW;
    const sy = y => padT + chartH - (y - yMin) / (yMax - yMin) * chartH;

    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1000, 400);
    
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    for(let i=0; i<=4; i++) {
      const y = padT + chartH * i / 4;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(1000 - padR, y); ctx.stroke();
      ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
      const val = yMax - (yMax - yMin) * i / 4;
      ctx.fillText(Math.round(val).toLocaleString(), padL - 10, y + 4);
    }
    
    if (yMin <= 0 && yMax >= 0) {
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(padL, sy(0)); ctx.lineTo(1000 - padR, sy(0)); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(sx(p.price), sy(p.pnl));
      else ctx.lineTo(sx(p.price), sy(p.pnl));
    });
    ctx.stroke();

    const cx = sx(baseS);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, padT + chartH); ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`قیمت فعلی: ${Math.round(baseS).toLocaleString()}`, cx, padT - 10);
    
    ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif';
    for(let i=0; i<=5; i++) {
      const x = padL + chartW * i / 5;
      const val = minS + (maxS - minS) * i / 5;
      ctx.fillText(Math.round(val).toLocaleString(), x, padT + chartH + 20);
    }
    
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + chartH); ctx.lineTo(1000 - padR, padT + chartH); ctx.stroke();
    
    chartBase64 = chartCanvas.toDataURL('image/png');

    [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3].forEach(pct => {
      const price = Math.round(baseS * pct);
      const { totalPnl, netCapital, closedPnl } = calcPnlAtFactor(pct);
      
      const baseCap = Math.abs(netCapital) > 0 ? Math.abs(netCapital) : 1;
      const returnPct = (totalPnl / baseCap) * 100;
      const annReturnPct = annualizePct(returnPct, targetDays, getAnnualMode());
      const isCurrent = Math.abs(pct - 1.0) < 0.001;

      sensitivityHtml += `<tr${isCurrent ? ' class="current-price-row"' : ''}>
        <td class="num">${Math.round(pct*100)}%${isCurrent ? ' (فعلی)' : ''}</td>
        <td class="num">${fmt0(price)}</td>
        <td class="num ${totalPnl >= 0 ? 'pos' : 'neg'}">${fmt0(totalPnl)}</td>
        <td class="num ${closedPnl >= 0 ? 'pos' : 'neg'}">${fmt0(closedPnl)}</td>
        <td class="num ${returnPct >= 0 ? 'pos' : 'neg'}">${returnPct.toFixed(2)}%</td>
        <td class="num ${annReturnPct !== null && annReturnPct >= 0 ? 'pos' : 'neg'}">${annReturnPct !== null ? annReturnPct.toFixed(2) + '%' : '—'}</td>
      </tr>`;
    });
  }

  // ---- 2. ساخت جدول اصلی ----
  let tbody = '';
  data.rows.forEach((r, i) => {
    const ytmCls = r.currentYtm >= 0 ? 'pos' : 'neg';
    const newYtmCls = r.newYtm >= 0 ? 'pos' : 'neg';
    const rollCashCls = r.rollCash >= 0 ? 'pos' : 'neg';
    
    tbody += `<tr>
      <td class="num">${i+1}</td>
      <td class="sym">${esc(r.sym)}</td>
      <td class="num">${fmt0(r.qty)}<br><small>(${r.percent||100}% => ${fmt0(r.rollQty||r.qty)})</small></td>
      <td>${esc(r.currentExpiry)} <br><small>(${r.currentDays} روز)</small></td>
      <td class="num">${fmt0(r.currentK)}</td>
      <td class="num">${fmt0(r.currentPrice)}</td>
      <td class="num ${ytmCls}">${r.currentYtm !== null ? r.currentYtm.toFixed(1) + '%' : '—'}</td>
      
      <td>${esc(r.nextExpiry || '—')} <br><small>${r.nextDays ? `(${r.nextDays} روز)` : ''}</small></td>
      <td class="sym" style="color:var(--primary)">${esc(r.nextSym || '—')}</td>
      <td class="num">${fmt0(r.nextK || 0)}</td>
      <td class="num">${fmt0(r.nextPrice || 0)}</td>
      <td class="num neg">${fmt0(r.closeCost)}</td>
      <td class="num pos">${fmt0(r.newIncome)}</td>
      <td class="num ${rollCashCls}">${fmt0(r.rollCash)}</td>
      <td class="num ${newYtmCls}">${r.newYtm !== null ? r.newYtm.toFixed(1) + '%' : '—'}</td>
      <td>${r.status === 'پیشنهاد می‌شود' ? '<b class="pos">پیشنهاد می‌شود</b>' : '<span class="muted">خیر</span>'}</td>
    </tr>`;
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('fa-IR');

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>گزارش تحلیل رول (استراتژی تا فردا)</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Vazirmatn-font-face.css">
<style>
  :root {
    --ink: #0f172a;
    --muted: #64748b;
    --bg: #f8fafc;
    --border: #e2e8f0;
    --primary: #0f172a;
    --ok: #15803d;
    --ok-bg: #dcfce7;
    --bad: #b91c1c;
    --bad-bg: #fee2e2;
  }
  * { box-sizing: border-box; }
  body { 
    font-family: 'Vazirmatn', Tahoma, sans-serif; 
    direction: rtl; 
    margin: 0; 
    padding: 20px; 
    font-size: 11px; 
    color: var(--ink); 
    background-color: var(--bg);
    -webkit-font-smoothing: antialiased;
  }
  .container {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    border: 1px solid var(--border);
    overflow: hidden;
    max-width: 100%;
    margin: 0 auto;
  }
  .header {
    background: var(--primary);
    color: #fff;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header h1 { font-size: 16px; margin: 0; font-weight: 800; letter-spacing: -0.3px; }
  .header .meta { font-size: 10.5px; opacity: 0.85; margin-top: 4px; }

  table { 
    width: 100%; 
    border-collapse: collapse; 
    font-size: 10px; 
    table-layout: fixed; 
  }
  thead th { 
    background: #f1f5f9; 
    color: var(--ink); 
    padding: 8px 4px; 
    font-weight: 800; 
    border-bottom: 2px solid var(--border); 
    text-align: center; 
    white-space: normal; 
    word-wrap: break-word; 
    font-size: 10px;
  }
  tbody td { 
    padding: 7px 4px; 
    border-bottom: 1px solid var(--border); 
    text-align: center; 
    font-variant-numeric: tabular-nums; 
    line-height: 1.4; 
    color: #334155;
    white-space: nowrap;
  }
  tbody td.wrap { white-space: normal; word-break: break-word; }
  tbody tr:nth-child(even) { background: #f8fafc; }

  tbody td.sym { font-weight: 800; text-align: right; color: var(--ink); font-size: 11px; white-space: normal; word-break: break-word; }

  .pos { color: var(--ok); font-weight: 800; }
  .neg { color: var(--bad); font-weight: 800; }
  .muted { color: var(--muted); }

  .print-btn { 
    display: block; 
    margin: 16px auto; 
    padding: 10px 24px; 
    background: var(--primary); 
    color: #fff; 
    border: none; 
    border-radius: 8px; 
    font-family: inherit; 
    font-size: 13px; 
    font-weight: 800; 
    cursor: pointer; 
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    transition: background 0.2s;
  }
  .print-btn:hover { background: #1e293b; }

  tr.total-row td { 
    background: #e2e8f0 !important; 
    color: var(--ink) !important; 
    font-weight: 800 !important; 
    font-size: 11px !important; 
    border-top: 2px solid #94a3b8 !important; 
    border-bottom: 1px solid #94a3b8 !important; 
    padding: 9px 4px !important; 
    white-space: nowrap;
  }

  small { font-size: 9px; color: var(--muted); font-weight: 500; }

  .chart-container { padding: 10px 20px 20px; text-align: center; page-break-inside: avoid; }
  .chart-container img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--border); }

  .sensitivity-table-wrap { padding: 20px; border-top: 1px solid var(--border); background: #fafbfc; }
  .sensitivity-table-wrap h2 { font-size: 14px; font-weight: 800; margin: 0 0 12px 0; color: var(--ink); }
  .sensitivity-table-wrap .note { font-size: 10.5px; color: var(--muted); margin-bottom: 12px; line-height: 1.8; }
  tr.current-price-row td { background: #dbeafe !important; font-weight: 800; -webkit-print-color-adjust: exact; }

  @media print {
    body { background: #fff; padding: 0; }
    .container { border: none; box-shadow: none; border-radius: 0; }
    .header { background: #fff !important; color: #000 !important; border-bottom: 2px solid #000; padding: 10px 0; }
    .header h1 { color: #000 !important; }
    .header .meta { color: #333 !important; }
    .print-btn { display: none !important; }
    thead { display: table-header-group; }
    thead th { background: #f1f5f9 !important; color: #000 !important; border-bottom: 2px solid #000 !important; -webkit-print-color-adjust: exact; }
    tbody td { font-size: 9.5px; padding: 6px 2px; }
    tr { page-break-inside: avoid; }
    tbody tr:nth-child(even) { background: #f8fafc !important; -webkit-print-color-adjust: exact; }
    tr.total-row td { background: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
    .pos, .neg { -webkit-print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 6mm; }
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>گزارش تحلیل رول — ${data.strategyName}</h1>
        <div class="meta">تاریخ چاپ: ${dateStr} &nbsp;|&nbsp; استراتژی: ${esc(strategyLabel)} &nbsp;|&nbsp; تعداد موقعیت‌های بررسی شده: ${data.rows.length}</div>
      </div>
    </div>

    <table>
      <colgroup>
        <col style="width: 3%">
        <col style="width: 8%">
        <col style="width: 5%">
        <col style="width: 7%">
        <col style="width: 6%">
        <col style="width: 7%">
        <col style="width: 6%">
        <col style="width: 7%">
        <col style="width: 9%">
        <col style="width: 6%">
        <col style="width: 7%">
        <col style="width: 8%">
        <col style="width: 8%">
        <col style="width: 8%">
        <col style="width: 6%">
        <col style="width: 6%">
      </colgroup>
      <thead>
        <tr>
          <th>#</th><th>نماد فعلی</th><th>تعداد</th>
          <th>سررسید فعلی</th><th>K فعلی</th><th>قیمت بازار</th><th>YTM فعلی</th>
          <th>سررسید بعدی</th><th>نماد جدید</th><th>K جدید</th><th>پرمیوم جدید</th>
          <th>هزینه بستن (پرداختی)</th>
          <th>دریافتی جدید</th>
          <th>جریان نقدی رول</th><th>YTM جدید</th><th>نتیجه</th>
        </tr>
      </thead>
      <tbody>${tbody}</tbody>
    </table>
    
    <table style="margin-top:0; border-top:2px solid var(--border)">
      <tr class="total-row">
        <td colspan="11" style="text-align:right; padding-right:12px;">جمع کل</td>
        <td class="neg">${fmt0(data.totalCloseCost)}</td>
        <td class="pos">${fmt0(data.totalNewIncome)}</td>
        <td class="${data.totalRollCash >= 0 ? 'pos' : 'neg'}">${fmt0(data.totalRollCash)}</td>
        <td colspan="2">—</td>
      </tr>
    </table>

    ${chartBase64 ? `
    <div class="chart-container">
      <h2 style="font-size: 14px; font-weight: 800; margin: 0 0 12px 0; color: var(--ink); text-align: right;">نمودار سود و زیان پرتفوی جدید در سررسید</h2>
      <img src="${chartBase64}" alt="نمودار سود و زیان" />
    </div>
    ` : ''}

    ${sensitivityHtml ? `
    <div class="sensitivity-table-wrap">
      <h2>جدول حساسیت — سود/زیان پرتفوی جدید در سررسید بر اساس قیمت سهم</h2>
      <div class="note">
        سناریوها بر اساس قیمت فعلی سهم (${fmt0(baseS)}) و برای استراتژی «${esc(strategyLabel)}» محاسبه شده‌اند. 
        <b>سود/زیان پرتفوی</b> فقط شامل پوزیشن‌های جدید (سهم خریداری‌شده با قیمت امروز + اختیار جدید) است. 
        <b>سود/زیان بستن موقعیت قبلی</b> نشان‌دهنده سود یا زیان نقدشده از بستن موقعیت‌های قبلی (سهام و اختیار) است که در تمام سناریوها ثابت می‌ماند.${multiNote}${skippedNote}
      </div>
      <table>
        <colgroup>
          <col style="width: 12%">
          <col style="width: 16%">
          <col style="width: 20%">
          <col style="width: 18%"> 
          <col style="width: 17%">
          <col style="width: 17%">
        </colgroup>
        <thead>
          <tr>
            <th>تغییر قیمت سهم</th>
            <th>قیمت در سررسید</th>
            <th>سود / زیان پرتفوی</th>
            <th>سود / زیان بستن موقعیت قبلی</th> 
            <th>بازده دوره</th>
            <th>بازده سالانه</th>
          </tr>
        </thead>
        <tbody>${sensitivityHtml}</tbody>
      </table>
    </div>
    ` : ''}
  </div>

  <button class="print-btn" onclick="window.print()">🖨 چاپ / ذخیره به PDF</button>

  <script>
    window.addEventListener('load', function() {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(function() { window.print(); }, 300);
        });
      } else {
        setTimeout(function() { window.print(); }, 300);
      }
    });
  <\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) { alert('پاپ‌آپ مسدود است. لطفاً اجازه دسترسی به پاپ‌آپ را بدهید.'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
