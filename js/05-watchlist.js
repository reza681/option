/* ============================================================
   بخش‌های ۱۸-۲۳: واچ‌لیست
   منبع: option-ver16.html خطوط 2377-2836
   ============================================================ */
/* ==================================================================
   ۱۸) توابع کمکی
   ================================================================== */
const FUND_UNDERLYINGS = ['اهرم', 'سرو'];
const isFundUnderlying = u => FUND_UNDERLYINGS.includes(u);
function getUnderlyingPrice(sym){
  const rec = state.market.find(m => m.sym === sym);
  return rec ? (rec.price || rec.close || rec.last || 0) : 0;
}

/* ==================================================================
   ۱۹) ردیف دیده‌بان
   ================================================================== */
function computeWatchlistRow(opt){
  const S = getUnderlyingPrice(opt.underlying);
  const K = opt.strike;
  const P = opt.price;
  const days = opt.days;
  const isCall = opt.type === 'call';
  const fund = isFundUnderlying(opt.underlying);
  const intrinsic = isCall ? Math.max(0, S - K) : Math.max(0, K - S);
  const fee = optionFee(S, P, {
    apply: state.wlApplyFee,
    feePct: fund ? state.wlFundFeePct : state.wlNonFundFeePct,
    feeOnPremium: !!state.wlFeeOnPremium
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
  const denom = (mDeep && mDeep.denom) ? mDeep.denom : (S - P);
  const deepPct = (mDeep && mDeep.valid) ? mDeep.annFrac : null;
  const deepDailyPct = (mDeep && mDeep.valid) ? mDeep.retFrac : null;
  const fuelPct = (mFuel && mFuel.ann !== null) ? mFuel.ann / 100 : null;
  const fuelDailyPct = (mFuel && mFuel.pct !== null) ? mFuel.pct / 100 : null;
  return {
    sym: opt.sym, name: opt.name, fund, isCall,
    strike: K, underlying: opt.underlying, type: opt.type, days,
    expiryStr: opt.expiryStr, S, price: P,
    intrinsic, fee, deep, fuel, netPremium, annualMode: mode, denom,
    deepPct, deepDailyPct, fuelPct, fuelDailyPct, status,
    tvol: Number(opt.tvol) || 0, tno: Number(opt.tno) || 0
  };
}

/* ==================================================================
   ۲۰) مرتب‌سازی
   ================================================================== */
function wlSortValue(colId, row){ const getter = WL_SORT_GETTERS[colId]; if (!getter) return null; return getter(row); }
function applySortToRows(rows){
  const { column, direction } = state.wlSort;
  const dir = direction === 'desc' ? -1 : 1;
  if (!column){
    return rows.slice().sort((a,b) => {
      const u = a.underlying.localeCompare(b.underlying, 'fa'); if (u) return u;
      if (a.type !== b.type) return a.type === 'call' ? -1 : 1;
      return a.strike - b.strike;
    });
  }
  return rows.slice().sort((a,b) => {
    const va = wlSortValue(column, a), vb = wlSortValue(column, b);
    const na = va === null || va === undefined || (typeof va === 'number' && !isFinite(va));
    const nb = vb === null || vb === undefined || (typeof vb === 'number' && !isFinite(vb));
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'fa') * dir;
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}
function handleSortClick(colId){
  if (!colId || colId === 'idx') return;
  if (state.wlSort.column === colId){
    if (state.wlSort.direction === 'asc') state.wlSort.direction = 'desc';
    else state.wlSort = { column: null, direction: 'asc' };
  } else state.wlSort = { column: colId, direction: 'asc' };
  saveSort(); renderWatchlist();
}
function startColumnResize(e, tbl, colId){
  e.preventDefault(); e.stopPropagation();
  const handle = e.currentTarget;
  const colEl = tbl.querySelector(`colgroup col[data-col-id="${colId}"]`);
  if (!colEl) return;
  const startX = e.clientX;
  const startW = colEl.getBoundingClientRect().width || parseFloat(colEl.style.width) || 100;
  handle.classList.add('active');
  document.body.classList.add('col-resizing');
  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    colEl.style.width = Math.max(40, Math.round(startW - dx)) + 'px';
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    handle.classList.remove('active');
    document.body.classList.remove('col-resizing');
    const finalW = parseFloat(colEl.style.width) || startW;
    state.wlColWidths[colId] = Math.round(finalW);
    saveColWidths(); updateSortHint();
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}
function attachHeaderHandlers(tbl){
  tbl.querySelectorAll('thead th[data-col]').forEach(th => {
    const colId = th.dataset.col;
    if (!colId) return;
    const resizer = document.createElement('span');
    resizer.className = 'col-resizer';
    resizer.dataset.col = colId;
    th.appendChild(resizer);
    resizer.addEventListener('pointerdown', (e) => startColumnResize(e, tbl, colId));
    
    th.addEventListener('click', (e) => {
      if (e.target.classList.contains('col-resizer')) return;
      if (e.target.closest('.funnel-icon')) {
        e.stopPropagation();
        openWlFilterPopover(e.target.closest('.funnel-icon'), colId);
        return;
      }
      handleSortClick(colId);
    });
  });
}
function buildWatchlistColgroup(cols){
  return '<colgroup>' + cols.map(c => {
    const w = state.wlColWidths[c.id] || DEFAULT_COL_WIDTHS[c.id] || 100;
    return `<col data-col-id="${c.id}" style="width:${w}px">`;
  }).join('') + '</colgroup>';
}
function updateSortHint(){
  const el = $('#wlSortHint');
  if (!el) return;
  if (!state.wlSort.column){ el.textContent = 'مرتب‌سازی: پیش‌فرض (دارایی پایه ← نوع ← قیمت اعمال)'; return; }
  const def = WL_COLUMN_DEFS.find(c => c.id === state.wlSort.column);
  const lbl = def ? def.label : state.wlSort.column;
  const dirLbl = state.wlSort.direction === 'asc' ? 'صعودی ↑' : 'نزولی ↓';
  el.textContent = `مرتب‌سازی: ${lbl} — ${dirLbl}`;
}

/* ==================================================================
   ۲۱) رندر دیده‌بان
   ================================================================== */
const WL_CELL_RENDERERS = {
  idx: (r, i) => `<td class="num">${i+1}</td>`,
  sym: (r) => `<td class="sym-cell">${r.sym}</td>`,
  name: (r) => `<td title="${escapeAttr(r.name)}">${r.name}</td>`,
  underlying: (r) => `<td>${r.underlying}</td>`,
  type: (r) => `<td>${r.isCall ? '<span class="tag call">Call</span>' : '<span class="tag put">Put</span>'}</td>`,
  fund: (r) => `<td>${r.fund ? '<span class="tag fund">صندوق</span>' : '<span class="tag nofund">غیرصندوق</span>'}</td>`,
  tvol: (r, i) => `<td class="num" data-wl-calc="tvol" data-wl-row="${i}">${r.tvol ? fmt0(r.tvol) : '—'}</td>`,
  tno:  (r, i) => `<td class="num" data-wl-calc="tno" data-wl-row="${i}">${r.tno  ? fmt0(r.tno)  : '—'}</td>`,
  strike: (r, i) => `<td class="num price" data-wl-calc="strike" data-wl-row="${i}">${fmt0(r.strike)}</td>`,
  price:  (r, i) => `<td class="num price" data-wl-calc="price" data-wl-row="${i}">${fmt0(r.price)}</td>`,
  S:      (r, i) => `<td class="num" data-wl-calc="S" data-wl-row="${i}">${fmt0(r.S)}</td>`,
  expiryStr: (r) => `<td>${r.expiryStr || '—'}</td>`,
  days: (r, i) => `<td class="num" data-wl-calc="days" data-wl-row="${i}">${r.days}</td>`,
  status: (r) => {
    const cls = r.status === 'ITM' ? 'itm' : (r.status === 'OTM' ? 'otm' : 'atm');
    return `<td class="status ${cls}">${r.status}</td>`;
  },
  deep: (r, i) => {
    if (r.deep === null) return `<td class="num">—</td>`;
    const v = fmt0(r.deep);
    const cls = r.deep >= 0 ? 'pos' : 'neg';
    return `<td class="num ${cls}" data-wl-calc="deep" data-wl-row="${i}">${v}</td>`;
  },
  deepPct: (r, i) => {
    if (r.deepPct === null) return `<td class="num">—</td>`;
    const v = (r.deepPct*100).toFixed(2)+'%';
    const cls = r.deepPct >= 0 ? 'pos' : 'neg';
    return `<td class="num ${cls}" data-wl-calc="deepPct" data-wl-row="${i}">${v}</td>`;
  },
  deepDailyPct: (r, i) => {
    if (r.deepDailyPct === null) return `<td class="num">—</td>`;
    const v = (r.deepDailyPct*100).toFixed(4)+'%';
    const cls = r.deepDailyPct >= 0 ? 'pos' : 'neg';
    return `<td class="num ${cls}" data-wl-calc="deepDailyPct" data-wl-row="${i}">${v}</td>`;
  },
  fuel: (r, i) => {
    if (r.fuel === null) return `<td class="num">—</td>`;
    const v = fmt0(r.fuel);
    const cls = r.fuel >= 0 ? 'pos' : 'neg';
    return `<td class="num ${cls}" data-wl-calc="fuel" data-wl-row="${i}">${v}</td>`;
  },
  fuelPct: (r, i) => {
    if (r.fuelPct === null) return `<td class="num">—</td>`;
    const v = (r.fuelPct*100).toFixed(2)+'%';
    const cls = r.fuelPct >= 0 ? 'pos' : 'neg';
    return `<td class="num ${cls}" data-wl-calc="fuelPct" data-wl-row="${i}">${v}</td>`;
  },
  fuelDailyPct: (r, i) => {
    if (r.fuelDailyPct === null) return `<td class="num">—</td>`;
    const v = (r.fuelDailyPct*100).toFixed(4)+'%';
    const cls = r.fuelDailyPct >= 0 ? 'pos' : 'neg';
    return `<td class="num ${cls}" data-wl-calc="fuelDailyPct" data-wl-row="${i}">${v}</td>`;
  }
};
function getVisibleCols(){ return WL_COLUMN_DEFS.filter(c => state.wlActiveCols[c.id]); }
function buildWatchlistHeader(cols){
  const hasGroups = cols.some(c => c.group);
  const row1 = [], row2 = [];
  const { column: sortCol, direction: sortDir } = state.wlSort;
  const ind = (id) => {
    if (id !== sortCol || id === 'idx') return '';
    return sortDir === 'asc' ? ' <span class="sort-ind">▲</span>' : ' <span class="sort-ind">▼</span>';
  };
  const thAttr = (col) => (col.id === 'idx' ? '' : ` data-col="${col.id}"`);
  
  const getFunnelHtml = (col) => {
    if (col.id === 'idx') return '';
    const isFiltered = state.wlColFilters[col.id] && (state.wlColFilters[col.id].min !== undefined || state.wlColFilters[col.id].max !== undefined || state.wlColFilters[col.id].text !== undefined);
    const cls = isFiltered ? 'funnel-icon active' : 'funnel-icon';
    // استفاده از آیکون SVG قیف
    const svgIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`;
    return `<span class="${cls}" data-filter-col="${col.id}" title="فیلتر">${svgIcon}</span>`;
  };

  let i = 0;
  while (i < cols.length){
    const col = cols[i];
    if (!col.group){
      row1.push(`<th${thAttr(col)}${hasGroups ? ' rowspan="2"' : ''}>${col.label}${getFunnelHtml(col)}${ind(col.id)}</th>`);
      i++;
    } else {
      const grp = col.group;
      let j = i;
      while (j < cols.length && cols[j].group === grp) j++;
      row1.push(`<th colspan="${j-i}">${grp}</th>`);
      for (let k = i; k < j; k++) row2.push(`<th${thAttr(cols[k])}>${cols[k].label}${getFunnelHtml(cols[k])}${ind(cols[k].id)}</th>`);
      i = j;
    }
  }
  let html = `<thead><tr>${row1.join('')}</tr>`;
  if (row2.length) html += `<tr>${row2.join('')}</tr>`;
  html += '</thead>';
  return html;
}
function renderWatchlist(){
  const tbl = $('#watchlistTable');
  const hint = $('#watchlistHint');
  const status = $('#wlStatus');
  const badge = $('#wlBadge');
  $('#wlApplyFee').checked = state.wlApplyFee;
  $('#wlNonFundFee').value = state.wlNonFundFeePct;
  $('#wlFundFee').value = state.wlFundFeePct;
  $('#wlNonFundFee').disabled = !state.wlApplyFee;
  $('#wlFundFee').disabled = !state.wlApplyFee;

  if (!state.options || !state.options.length){
    tbl.innerHTML = `<tbody><tr><td style="text-align:center;padding:36px;color:#64748b">هنوز داده‌ای دریافت نشده است.</td></tr></tbody>`;
    hint.textContent = '';
    status.innerHTML = '<span class="dot wait"></span>در انتظار داده';
    badge.textContent = '0';
    updateSortHint();
    return;
  }
  const rows = state.options.map(computeWatchlistRow);
  badge.textContent = rows.length;
  const uSel = $('#wlFilterUnderlying');
  const currentU = uSel.value;
  const uniqueU = [...new Set(rows.map(r => r.underlying))].sort((a,b)=>a.localeCompare(b,'fa'));
  if (uSel.options.length - 1 !== uniqueU.length){
    uSel.innerHTML = '<option value="">همه دارایی‌های پایه</option>' + uniqueU.map(u => `<option value="${u}">${u}</option>`).join('');
    uSel.value = currentU;
  }
  const q = ($('#wlSearch').value || '').trim().toLowerCase();
  const fType = $('#wlFilterType').value;
  const fStat = $('#wlFilterStatus').value;
  const fUnder = $('#wlFilterUnderlying').value;
  
  let filtered = rows.filter((r, i) => {
    if (fType && r.type !== fType) return false;
    if (fStat && r.status !== fStat) return false;
    if (fUnder && r.underlying !== fUnder) return false;
    if (q){
      const hay = (r.sym + ' ' + r.name + ' ' + r.underlying).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    
    // Column Filters
    for (const [colId, filter] of Object.entries(state.wlColFilters)) {
        const getter = WL_SORT_GETTERS[colId];
        if (!getter) continue;
        const val = getter(r, i);
        
        if (val === null || val === undefined) {
            if (filter.min !== undefined || filter.max !== undefined || filter.text !== undefined) return false;
            continue;
        }

        if (typeof val === 'number') {
            if (filter.min !== undefined && val < filter.min) return false;
            if (filter.max !== undefined && val > filter.max) return false;
        } else if (typeof val === 'string') {
            if (filter.text !== undefined && !val.toLowerCase().includes(filter.text)) return false;
        }
    }
    
    return true;
  });
  
  const sorted = applySortToRows(filtered);
  const cols = getVisibleCols();
  const colgroup = buildWatchlistColgroup(cols);
  const thead = buildWatchlistHeader(cols);
  let tbody = '<tbody>';
  if (!sorted.length){
    tbody += `<tr><td colspan="${Math.max(cols.length, 1)}" style="text-align:center;padding:24px;color:#64748b">نتیجه‌ای یافت نشد.</td></tr>`;
  } else {
    sorted.forEach((r, i) => {
      const rowCls = r.isCall ? 'call-row' : 'put-row';
      let tr = `<tr class="${rowCls}">`;
      cols.forEach(col => { const renderer = WL_CELL_RENDERERS[col.id]; if (renderer) tr += renderer(r, i); });
      tr += `</tr>`;
      tbody += tr;
    });
  }
  tbody += '</tbody>';
  tbl.innerHTML = colgroup + thead + tbody;
  tbl.style.width = '100%';
  attachHeaderHandlers(tbl);

  tbl.querySelectorAll('td[data-wl-calc]').forEach(td => {
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = +td.dataset.wlRow;
      const field = td.dataset.wlCalc;
      const row = sorted[idx];
      if (!row) return;
      const isSame = !$calcPopover.classList.contains('hidden') && $calcPopover.__lastTd === td;
      if (isSame){ closeCalcPopover(); return; }
      showCalcPopover(td, buildWlCalcHtml(row, field));
    });
  });

  const feeNote = state.wlApplyFee ? `کارمزد: غیرصندوق ${state.wlNonFundFeePct}% / صندوق ${state.wlFundFeePct}%` : 'کارمزد: غیرفعال';
  const tplNote = state.wlActiveTemplate ? ` | قالب: ${state.wlActiveTemplate}` : '';
  hint.textContent = `${sorted.length} از ${rows.length} اختیار | ${cols.length} ستون | ${feeNote}${tplNote} | 💡 روی هر عدد کلیک کنید`;
  status.innerHTML = `<span class="dot ok"></span>${rows.length} اختیار بارگذاری شد`;
  updateSortHint();
}

['#wlSearch','#wlFilterType','#wlFilterStatus','#wlFilterUnderlying'].forEach(sel => {
  const el = document.querySelector(sel); if (!el) return;
  const ev = el.tagName === 'INPUT' ? 'input' : 'change';
  el.addEventListener(ev, () => { clearTimeout(window.__wlTimer); window.__wlTimer = setTimeout(renderWatchlist, 200); });
});
$('#wlApplyFee').addEventListener('change', e => { state.wlApplyFee = e.target.checked; renderWatchlist(); });
$('#wlNonFundFee').addEventListener('input', e => { state.wlNonFundFeePct = toNum(e.target.value); clearTimeout(window.__wlFeeTimer); window.__wlFeeTimer = setTimeout(renderWatchlist, 250); });
$('#wlFundFee').addEventListener('input', e => { state.wlFundFeePct = toNum(e.target.value); clearTimeout(window.__wlFeeTimer); window.__wlFeeTimer = setTimeout(renderWatchlist, 250); });
$('#wlResetSortBtn').addEventListener('click', () => { state.wlSort = { column: null, direction: 'asc' }; saveSort(); renderWatchlist(); });
$('#wlResetWidthsBtn').addEventListener('click', () => { state.wlColWidths = {}; saveColWidths(); renderWatchlist(); });
$('#wlResetFiltersBtn').addEventListener('click', () => { state.wlColFilters = {}; renderWatchlist(); });

/* ==================================================================
   ۲۲) مدال ستون‌ها
   ================================================================== */
const $wlSettingsOverlay = $('#wlSettingsOverlay');
const $wlColumnsList = $('#wlColumnsList');
const $wlTemplatesRow = $('#wlTemplatesRow');
function renderColumnsList(){
  $wlColumnsList.innerHTML = '';
  WL_COLUMN_DEFS.forEach(col => {
    if (col.fixed) return;
    const active = !!state.wlActiveCols[col.id];
    const lbl = document.createElement('label');
    lbl.className = 'col-check' + (active ? ' checked' : '');
    lbl.innerHTML = `
      <input type="checkbox" ${active ? 'checked' : ''} data-col="${col.id}">
      <span>${col.label}</span>
      ${col.group ? `<span class="col-group">${col.group}</span>` : ''}`;
    const cb = lbl.querySelector('input');
    cb.addEventListener('change', e => {
      state.wlActiveCols[col.id] = e.target.checked;
      lbl.classList.toggle('checked', e.target.checked);
      state.wlActiveTemplate = null;
      updateTemplateActiveUI(); saveActiveCols(); renderWatchlist();
    });
    $wlColumnsList.appendChild(lbl);
  });
}
function updateTemplateActiveUI(){
  $wlTemplatesRow.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.template === state.wlActiveTemplate));
}
function applyTemplate(key){
  const tpl = WL_TEMPLATES[key]; if (!tpl) return;
  Object.keys(state.wlActiveCols).forEach(k => { if (k === 'idx') return; state.wlActiveCols[k] = false; });
  Object.keys(tpl).forEach(k => { if (k in state.wlActiveCols) state.wlActiveCols[k] = !!tpl[k]; });
  state.wlActiveTemplate = key;
  saveActiveCols(); renderColumnsList(); updateTemplateActiveUI(); renderWatchlist();
}
function openSettings(){ renderColumnsList(); updateTemplateActiveUI(); $wlSettingsOverlay.classList.remove('hidden'); }
function closeSettings(){ $wlSettingsOverlay.classList.add('hidden'); }
$('#wlSettingsBtn').addEventListener('click', openSettings);
$('#mainSettingsBtn').addEventListener('click', openSettings);
$('#wlSettingsClose').addEventListener('click', closeSettings);
$('#wlApplyCols').addEventListener('click', closeSettings);
$wlSettingsOverlay.addEventListener('click', e => { if (e.target === $wlSettingsOverlay) closeSettings(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$wlSettingsOverlay.classList.contains('hidden')) closeSettings(); });
$wlTemplatesRow.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => applyTemplate(btn.dataset.template)));
$('#wlResetCols').addEventListener('click', () => {
  state.wlActiveCols = defaultActiveCols();
  state.wlActiveTemplate = 'full';
  saveActiveCols(); renderColumnsList(); updateTemplateActiveUI(); renderWatchlist();
});
(function initTemplateLabel(){
  const fullKeys = Object.keys(WL_TEMPLATES.full);
  const allMatchFull = fullKeys.every(k => state.wlActiveCols[k]) &&
    Object.keys(state.wlActiveCols).every(k => { if (k === 'idx') return true; return !state.wlActiveCols[k] || fullKeys.includes(k); });
  if (allMatchFull) state.wlActiveTemplate = 'full';
})();

/* ==================================================================
   ۲۳) Treemap
   ================================================================== */
function squarify(items, x0, y0, x1, y1){
  const result = [];
  if (!items.length) return result;
  items = items.slice().sort((a,b) => b.value - a.value);
  const totalValue = items.reduce((s,c)=>s+c.value, 0);
  if (totalValue <= 0) return result;
  let x = x0, y = y0, w = x1 - x0, h = y1 - y0, i = 0;
  const n = items.length;
  while (i < n && w > 0.01 && h > 0.01){
    const horizontal = w >= h;
    const shorter = horizontal ? h : w;
    const area = w * h;
    const remainingTotal = items.slice(i).reduce((s,c)=>s+c.value, 0);
    if (remainingTotal <= 0) break;
    let rowEnd = i + 1;
    let bestWorst = worstRatio(items, i, rowEnd, shorter, area, remainingTotal);
    while (rowEnd < n){
      const testWorst = worstRatio(items, i, rowEnd + 1, shorter, area, remainingTotal);
      if (testWorst <= bestWorst){ bestWorst = testWorst; rowEnd++; } else break;
    }
    let rowSum = 0;
    for (let k = i; k < rowEnd; k++) rowSum += items[k].value;
    const rowArea = rowSum / remainingTotal * area;
    const rowThick = rowArea / shorter;
    let offset = 0;
    for (let k = i; k < rowEnd; k++){
      const c = items[k];
      const cArea = c.value / remainingTotal * area;
      const cSide = cArea / rowThick;
      if (horizontal) result.push({item: c, x, y: y + offset, w: rowThick, h: cSide});
      else result.push({item: c, x: x + offset, y, w: cSide, h: rowThick});
      offset += cSide;
    }
    if (horizontal){ x += rowThick; w -= rowThick; }
    else { y += rowThick; h -= rowThick; }
    i = rowEnd;
  }
  return result;
}
function worstRatio(items, start, end, shorter, area, remainingTotal){
  let rowSum = 0;
  for (let k = start; k < end; k++) rowSum += items[k].value;
  const rowArea = rowSum / remainingTotal * area;
  const rowThick = rowArea / shorter;
  if (rowThick <= 0) return Infinity;
  let worst = 0;
  for (let k = start; k < end; k++){
    const cArea = items[k].value / remainingTotal * area;
    const cSide = cArea / rowThick;
    if (cSide <= 0) return Infinity;
    const ratio = Math.max(rowThick / cSide, cSide / rowThick);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}
function changeColor(pct){
  if (pct === null || isNaN(pct)) return {bg: '#64748b'};
  if (pct > 0){
    const intensity = Math.min(Math.abs(pct) / 5, 1);
    const lightness = 38 - intensity * 20;
    return {bg: `hsl(142, 65%, ${lightness}%)`};
  } else if (pct < 0){
    const intensity = Math.min(Math.abs(pct) / 5, 1);
    const lightness = 38 - intensity * 20;
    return {bg: `hsl(0, 68%, ${lightness}%)`};
  } else return {bg: '#64748b'};
}
function computeChangePct(opt){
  const prev = opt.yesterday || 0;
  const curr = opt.price || 0;
  if (prev <= 0) return 0;
  return ((curr - prev) / prev) * 100;
}

/* ==================================================================
   اضافه شده: پنجره فیلتر ستون‌ها
   ================================================================== */
const $wlFilterPopover = $('#wlFilterPopover');

function openWlFilterPopover(iconEl, colId) {
    const colDef = WL_COLUMN_DEFS.find(c => c.id === colId);
    if (!colDef) return;

    const numericCols = ['tvol', 'tno', 'strike', 'price', 'S', 'days', 'deep', 'deepPct', 'deepDailyPct', 'fuel', 'fuelPct', 'fuelDailyPct', 'type', 'fund'];
    const isNumeric = numericCols.includes(colId);
    const cur = state.wlColFilters[colId] || {};

    let html = `<div class="ttl"><span class="ico">🔍</span>فیلتر: ${colDef.label}</div>`;
    if (isNumeric) {
        html += `
        <div class="wl-filter-inputs">
            <label>حداقل (≥):</label>
            <input type="number" id="wlFiltMin" value="${cur.min !== undefined ? cur.min : ''}" placeholder="مثلا 1000">
            <label>حداکثر (≤):</label>
            <input type="number" id="wlFiltMax" value="${cur.max !== undefined ? cur.max : ''}" placeholder="مثلا 2000">
        </div>`;
    } else {
        html += `
        <div class="wl-filter-inputs">
            <label>شامل متن:</label>
            <input type="text" id="wlFiltText" value="${cur.text !== undefined ? cur.text : ''}" placeholder="جستجو...">
        </div>`;
    }
    html += `
    <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px; border-top:1px dashed var(--line); padding-top:10px;">
        <button id="wlFilterClearBtn" style="font-size:11px; padding:5px 10px; border-color:var(--bad-line); color:var(--bad);">پاک کردن</button>
        <button id="wlFilterApplyBtn" class="primary" style="font-size:11px; padding:5px 12px;">اعمال</button>
    </div>`;

    $wlFilterPopover.innerHTML = html;
    $wlFilterPopover.classList.remove('hidden', 'below-top');

    const rect = iconEl.getBoundingClientRect();
    const popRect = $wlFilterPopover.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    let top = rect.bottom + 8;
    
    if (left < 10) left = 10;
    if (left + popRect.width > window.innerWidth - 10) left = window.innerWidth - 10 - popRect.width;
    if (top + popRect.height > window.innerHeight - 10) {
        top = rect.top - popRect.height - 8;
        $wlFilterPopover.classList.add('below-top');
    }

    $wlFilterPopover.style.left = Math.round(left) + 'px';
    $wlFilterPopover.style.top = Math.round(top) + 'px';

    // Listeners
    $('#wlFilterApplyBtn').onclick = () => {
        const filter = {};
        if (isNumeric) {
            const min = $('#wlFiltMin').value;
            const max = $('#wlFiltMax').value;
            if (min !== '') filter.min = Number(min);
            if (max !== '') filter.max = Number(max);
        } else {
            const text = $('#wlFiltText').value.trim().toLowerCase();
            if (text !== '') filter.text = text;
        }
        
        if (Object.keys(filter).length > 0) {
            state.wlColFilters[colId] = filter;
        } else {
            delete state.wlColFilters[colId];
        }
        $wlFilterPopover.classList.add('hidden');
        renderWatchlist();
    };

    $('#wlFilterClearBtn').onclick = () => {
        delete state.wlColFilters[colId];
        $wlFilterPopover.classList.add('hidden');
        renderWatchlist();
    };
    
    // Close popover when clicking outside
    setTimeout(() => {
        const closeHandler = (e) => {
            if (!$wlFilterPopover.contains(e.target) && !iconEl.contains(e.target)) {
                $wlFilterPopover.classList.add('hidden');
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 10);
}