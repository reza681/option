/* ============================================================
   بخش ۳۰: پوزیشن‌های ذخیره‌شده + گزارش موقعیت‌ها + ذخیره/بازکردن فایل
   ============================================================ */
(function loadSavedPositions(){
  try {
    const s = JSON.parse(localStorage.getItem('savedPositions') || '[]');
    if (Array.isArray(s)) {
      state.savedPositions = s.map(p => {
        if (!p.id) p.id = 'rp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        if (!p.strategyName) {
          p.strategyName = (p.type === 'underlying') ? (p.sym || 'بدون نام') : 'بدون نام';
        }
        return p;
      }).filter(p => p && p.id);
    }
  } catch(e){}
  if (!Array.isArray(state.savedPositions)) state.savedPositions = [];
  if (state.rpSelectedStrategy === undefined) state.rpSelectedStrategy = 'all';
  syncStrategyNames();
})();

function syncStrategyNames(){
  const names = [...new Set((state.savedPositions || []).map(p => p.strategyName || 'بدون نام'))];
  state.strategyNames = names;
  try { localStorage.setItem('savedStrategyNames', JSON.stringify(state.strategyNames)); } catch(e){}
  return names;
}

// تزریق استایل‌های جدول
(function injectRpStyles(){
  if (document.getElementById('rpStyles')) return;
  const style = document.createElement('style');
  style.id = 'rpStyles';
  style.innerHTML = `
    #rpTable { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 12.5px; table-layout: fixed; }
    #rpTable thead th { background: #1e293b; color: #fff; padding: 9px 4px; font-weight: 700; text-align: center; font-size: 12px; white-space: nowrap; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid #0f172a; overflow: hidden; text-overflow: ellipsis; }
    #rpTable tbody td { padding: 4px; border-bottom: 1px solid #f1f5f9; text-align: center; vertical-align: middle; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; }
    #rpTable tbody tr:nth-child(even) { background: #fafbfc; }
    #rpTable tbody tr:hover { background: #eff6ff; }
    
    #rpTable select, #rpTable input { font-family: inherit; font-size: 12px; border: 1px solid var(--line-2); border-radius: 6px; padding: 4px; outline: none; background: #fff; color: var(--ink); transition: .15s; width: 100%; box-sizing: border-box; }
    #rpTable select:focus, #rpTable input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(37,99,235,.15); }
    #rpTable input[type="number"] { text-align: center; font-variant-numeric: tabular-nums; }
    #rpTable select:disabled { background: #f1f5f9; color: var(--muted); cursor: not-allowed; }
    
    html[data-theme="dark"] #rpTable thead th { background: #0f1a2b; border-bottom-color: #1e293b; }
    html[data-theme="dark"] #rpTable tbody td { border-bottom-color: #16233a; }
    html[data-theme="dark"] #rpTable tbody tr:nth-child(even) { background: #0f1a2b; }
    html[data-theme="dark"] #rpTable tbody tr:hover { background: #17253c; }
    html[data-theme="dark"] #rpTable select, html[data-theme="dark"] #rpTable input { background: #0f1a2b; color: var(--ink); }

    .rp-drag-handle { cursor: grab; padding: 0 2px; font-size: 14px; color: var(--muted); user-select: none; display: flex; align-items: center; justify-content: center; }
    .rp-drag-handle:active { cursor: grabbing; }
    .rp-move-btn { padding: 0; font-size: 8px; line-height: 1.1; border: 1px solid var(--line-2); border-radius: 3px; background: var(--card); cursor: pointer; color: var(--ink-2); display:flex; align-items:center; justify-content:center; width: 14px; height: 12px; margin-bottom: 2px; }
    .rp-move-btn:last-child { margin-bottom: 0; }
    .rp-move-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
})();

let __rpLastRows = null;
let __rpLastFileSaveAt = null;
let __rpLastFileSaveName = null;

function saveSavedPositions(){
  try { localStorage.setItem('savedPositions', JSON.stringify(state.savedPositions)); } catch(e){}
}

window.moveRpRow = function(id, dir) {
  const arr = state.savedPositions;
  const index = arr.findIndex(p => p.id === id);
  if (index === -1) return;
  const newIndex = index + dir;
  if (newIndex < 0 || newIndex >= arr.length) return;
  
  const temp = arr[index];
  arr[index] = arr[newIndex];
  arr[newIndex] = temp;
  
  saveSavedPositions();
  renderReportPanel();
};

function rpUpdateFileStatus() {
  const el = document.getElementById('rpBackupStatus');
  if (!el) return;
  if (!__rpLastFileSaveAt) {
    el.innerHTML = '<span style="opacity:.55">هنوز فایلی ذخیره نشده</span>';
    return;
  }
  const date = new Date(__rpLastFileSaveAt).toLocaleString('fa-IR', { hour12: false });
  const name = __rpLastFileSaveName ? ' — ' + escapeHtml(__rpLastFileSaveName) : '';
  el.innerHTML = `<span style="opacity:.75">آخرین ذخیره:</span> <b style="color:var(--ink-2)">${date}</b>${name}`;
}

async function rpSaveToFile() {
  if (!state.savedPositions || !state.savedPositions.length) {
    alert('موقعیتی برای ذخیره وجود ندارد. ابتدا موقعیت اضافه کنید.');
    return;
  }
  const payload = {
    app: 'option-strategy-panel',
    version: 3,
    savedAt: new Date().toISOString(),
    count: state.savedPositions.length,
    strategyNames: state.strategyNames,
    positions: state.savedPositions
  };
  const json = JSON.stringify(payload, null, 2);
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  const suggestedName = 'positions-' + ts + '.json';

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedName,
        types: [{ description: 'فایل پشتیبان موقعیت‌ها (JSON)', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      __rpLastFileSaveAt = Date.now();
      __rpLastFileSaveName = handle.name;
      rpUpdateFileStatus();
      alert('✅ فایل با موفقیت ذخیره شد:\n' + handle.name);
      return;
    } catch(e) {
      if (e.name === 'AbortError') return;
      console.warn('[FSA save] fallback:', e);
    }
  }

  try {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    __rpLastFileSaveAt = Date.now();
    __rpLastFileSaveName = suggestedName;
    rpUpdateFileStatus();
    alert('فایل در پوشه Downloads ذخیره شد.');
  } catch(e) {
    alert('خطا در ذخیره فایل: ' + e.message);
  }
}

function rpProcessLoadedFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      let positions = Array.isArray(data) ? data : (data && Array.isArray(data.positions) ? data.positions : null);
      if (!positions) throw new Error('ساختار فایل معتبر نیست');
      positions = positions.map(p => {
        if (!p.id) p.id = 'rp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        if (!p.strategyName) {
          p.strategyName = (p.type === 'underlying') ? (p.sym || 'بدون نام') : 'بدون نام';
        }
        return p;
      }).filter(p => p && p.id);
      
      if (!positions.length) { alert('فایل خالی است.'); return; }
      if (state.savedPositions.length > 0 && !confirm(`فایل شامل ${positions.length} موقعیت است. جایگزین شوند؟`)) return;
      
      state.savedPositions = positions;
      syncStrategyNames();
      saveSavedPositions();
      renderReportPanel();
      alert(`✅ ${positions.length} موقعیت بارگذاری شد.`);
    } catch(err) {
      alert('خطا در خواندن فایل: ' + err.message);
    }
  };
  reader.onerror = () => alert('خطا در خواندن فایل.');
  reader.readAsText(file, 'utf-8');
}

async function rpOpenFromFile() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'فایل JSON', accept: { 'application/json': ['.json'] } }],
        multiple: false
      });
      const file = await handle.getFile();
      rpProcessLoadedFile(file);
      return;
    } catch(e) {
      if (e.name === 'AbortError') return;
    }
  }
  const input = document.getElementById('rpUploadInput');
  if (input) input.click();
}

function computeOptionYtmInternal(isCall, direction, K, S, P_avg, fee, days, assigned) {
  const P_net = P_avg - (fee || 0);
  const isSell = direction === 'sell';
  let periodReturn = 0;
  
  if (assigned) {
    if (isCall) {
      if (isSell) periodReturn = (S - P_avg) !== 0 ? (K - S + P_net) / (S - P_avg) : 0;
      else { const intrinsic = Math.max(0, S - K); periodReturn = P_net > 0 ? (intrinsic - P_net) / P_net : 0; }
    } else {
      if (isSell) periodReturn = (S - P_avg) !== 0 ? (P_net - Math.max(0, K - S)) / (S - P_avg) : 0;
      else { const intrinsic = Math.max(0, K - S); periodReturn = P_net > 0 ? (intrinsic - P_net) / P_net : 0; }
    }
  } else {
    if (isSell) periodReturn = (S - P_avg) !== 0 ? P_net / (S - P_avg) : 0;
    else periodReturn = -1;
  }
  
  if (!(days > 0)) return periodReturn * 100;
  const mode = getAnnualMode();
  if (mode === 'linear') return periodReturn * (365 / days) * 100;
  const base = 1 + periodReturn;
  if (base <= 0) return -100;
  const result = (Math.pow(base, 365 / days) - 1) * 100;
  return isFinite(result) ? result : null;
}

function computeSavedPositionRow(pos){
  const posType = pos.type || 'option';

  const invDate = pos.investmentDate || '';
  let passedDays = null;
  if (invDate) {
    const parsed = parseJalaliDate(invDate);
    if (parsed) {
      const [jy, jm, jd] = parsed;
      const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
      const target = new Date(gy, gm - 1, gd); target.setHours(0,0,0,0);
      const today = new Date(); today.setHours(0,0,0,0);
      const diff = Math.abs(Math.round((today - target) / 86400000));
      passedDays = diff;
    }
  }

  if (posType === 'underlying') {
    const rec = state.market.find(m => m.sym === pos.sym);
    const S = rec ? (rec.price || rec.close || rec.last || 0) : 0;
    const avgPrice = Number(pos.avgPremium) || 0;
    const qty = Number(pos.qty) || 0;
    const direction = pos.direction === 'buy' ? 'buy' : 'sell';
    const amount = qty * avgPrice;
    const closeAmount = qty * S;
    const offsetPnl = direction === 'sell' ? (avgPrice - S) * qty : (S - avgPrice) * qty;
    
    const offsetPct = amount > 0 ? (offsetPnl / amount) * 100 : 0;
    let annOffsetPct = null;
    if (passedDays !== null && passedDays > 0) annOffsetPct = annualizePct(offsetPct, passedDays, getAnnualMode());

    return {
      pos, isUnderlying: true, posType: 'underlying',
      sym: pos.sym, name: rec ? rec.name : pos.sym, underlying: pos.sym,
      S, P_avg: avgPrice, P_market: S, qty, direction, amount, closeAmount, offsetPnl,
      K: null, days: null, expiryStr: null, fund: false, fee: 0, netPremium: 0,
      deep: null, deepPct: null, deepTotal: null, assigned: false, ytm: null, coveragePct: null, type: null,
      passedDays, offsetPct, annOffsetPct
    };
  }

  const opt = state.options.find(o => o.sym === pos.sym);
  if (!opt) return { missing: true, pos };

  const S = getUnderlyingPrice(opt.underlying);
  const K = opt.strike;
  const P_avg = Number(pos.avgPremium) || 0;
  const P_market = opt.price;
  const days = opt.days;
  const qty = Number(pos.qty) || 0;
  const fund = isFundUnderlying(opt.underlying);
  const direction = pos.direction === 'buy' ? 'buy' : 'sell';

  const fee = optionFee(S, P_avg, {
    apply: state.wlApplyFee,
    feePct: fund ? state.wlFundFeePct : state.wlNonFundFeePct,
    feeOnPremium: !!state.wlFeeOnPremium
  });
  const netPremium = P_avg - fee;

  let deep = null, deepPct = null, deepTotal = null;
  if (opt.type === 'call' && days > 0 && qty > 0) {
    deep = K - S + netPremium;
    const m = optionReturn(K, S, P_avg, fee, days, getAnnualMode());
    if (m.valid) { deepPct = m.annFrac; deepTotal = deep * qty; }
  }

  const amount = qty * P_avg;
  const closeAmount = qty * P_market;
  const offsetPnl = direction === 'sell' ? (P_avg - P_market) * qty : (P_market - P_avg) * qty;
  const assigned = pos.assigned !== false;
  const ytm = computeOptionYtmInternal(opt.type === 'call', direction, K, S, P_avg, fee, days, assigned);

  const offsetPct = amount > 0 ? (offsetPnl / amount) * 100 : 0;
  let annOffsetPct = null;
  if (passedDays !== null && passedDays > 0) annOffsetPct = annualizePct(offsetPct, passedDays, getAnnualMode());

  return {
    pos, isUnderlying: false, posType: 'option',
    sym: pos.sym, name: opt.name, underlying: opt.underlying, type: opt.type,
    K, S, P_avg, P_market, days, qty, expiryStr: opt.expiryStr, fund,
    fee, netPremium, amount, closeAmount, deep, deepPct, deepTotal, offsetPnl,
    direction, assigned, ytm, coveragePct: null,
    passedDays, offsetPct, annOffsetPct
  };
}

// تابع اصلاح‌شده برای پر کردن دراپ‌داون با نادیده گرفتن نیم‌فاصله
function populateRpSymbols(){
  const type = document.getElementById('rpAddType')?.value || 'option';
  const sel = document.getElementById('rpAddOption');
  if (!sel) return;
  const search = (document.getElementById('rpAddSearch')?.value || '').trim().toLowerCase().replace(/[\u200c\s]/g, '');

  if (!state.market || !state.market.length) {
    sel.innerHTML = '<option value="">— ابتدا داده بازار را دریافت کنید —</option>';
    return;
  }

  const prev = sel.value;
  let html = '';
  if (type === 'underlying') {
    const us = [...new Set(
      (state.underlyingsWithOptions && state.underlyingsWithOptions.length)
        ? state.underlyingsWithOptions.map(u => u.sym)
        : (state.options || []).map(o => o.underlying)
    )]
      .filter(u => u && (!search || u.toLowerCase().replace(/[\u200c\s]/g, '').includes(search)))
      .sort((a, b) => a.localeCompare(b, 'fa'));
    
    html = '<option value="">— انتخاب دارایی پایه —</option>';
    us.forEach(u => {
      const p = getUnderlyingPrice(u);
      html += `<option value="${escapeAttr(u)}">${escapeHtml(u)} — قیمت ${fmt0(p)}</option>`;
    });
  } else {
    const opts = (state.options || []).filter(o => {
      if (!search) return true;
      const hay = (o.sym + ' ' + o.name + ' ' + o.underlying).toLowerCase().replace(/[\u200c\s]/g, '');
      return hay.includes(search);
    });

    const grouped = {};
    opts.forEach(o => {
      if (!grouped[o.underlying]) grouped[o.underlying] = [];
      grouped[o.underlying].push(o);
    });

    html = '<option value="">— انتخاب اختیار —</option>';
    Object.keys(grouped).sort((a,b)=>a.localeCompare(b,'fa')).forEach(u => {
      html += `<optgroup label="${escapeAttr(u)}">`;
      grouped[u].sort((a, b) => a.strike - b.strike).forEach(o => {
        html += `<option value="${escapeAttr(o.sym)}">${o.type === 'call' ? 'Call' : 'Put'} | ${escapeHtml(o.sym)} | K=${fmt0(o.strike)} | ${o.expiryStr} | P=${fmt0(o.price)}</option>`;
      });
      html += `</optgroup>`;
    });
  }
  sel.innerHTML = html;
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function buildSymbolSelectHtml(posId, currentSym, currentType) {
  let html = `<select data-rp-sym="${escapeAttr(posId)}" style="padding:4px 6px;font-size:11.5px;border:1px solid var(--line-2);border-radius:5px;background:var(--card);color:var(--ink);font-family:inherit;cursor:pointer;width:100%;box-sizing:border-box;">`;
  html += `<option value="">— انتخاب —</option>`;
  
  if (state.market && state.market.length) {
    const stocks = [...new Set(
      (state.underlyingsWithOptions && state.underlyingsWithOptions.length)
        ? state.underlyingsWithOptions.map(u => u.sym)
        : (state.options || []).map(o => o.underlying)
    )].filter(x => x);
    if (currentSym && currentType === 'underlying' && stocks.indexOf(currentSym) === -1) stocks.push(currentSym);
    stocks.sort((a, b) => a.localeCompare(b, 'fa'));
    html += `<optgroup label="سهام (دارایی پایه)">`;
    stocks.forEach(sym => {
      const isSel = currentSym === sym && currentType === 'underlying';
      html += `<option value="${escapeAttr(sym)}" ${isSel ? 'selected' : ''}>${sym}</option>`;
    });
    html += `</optgroup>`;
  }
  
  if (state.underlyingsWithOptions) {
    state.underlyingsWithOptions.forEach(u => {
      if (!u.calls.length && !u.puts.length) return;
      html += `<optgroup label="اختیار ${escapeAttr(u.sym)}">`;
      u.calls.sort((a,b)=>a.strike-b.strike).forEach(o => {
        const isSel = currentSym === o.sym && currentType === 'option';
        html += `<option value="${escapeAttr(o.sym)}" data-type="option" ${isSel ? 'selected' : ''}>Call | ${o.sym} | K=${fmt0(o.strike)}</option>`;
      });
      u.puts.sort((a,b)=>a.strike-b.strike).forEach(o => {
        const isSel = currentSym === o.sym && currentType === 'option';
        html += `<option value="${escapeAttr(o.sym)}" data-type="option" ${isSel ? 'selected' : ''}>Put | ${o.sym} | K=${fmt0(o.strike)}</option>`;
      });
      html += `</optgroup>`;
    });
  }
  
  html += `</select>`;
  return html;
}

// ⬇⬇⬇ اصلاح تابع رسم نمودار ⬇⬇⬇
function drawRpChart(rows) {
  const canvas = document.getElementById('rpChart');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const dpr = window.devicePixelRatio || 1;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // استفاده از rows ورودی (که همان استراتژی فیلتر شده است)
  if (!Array.isArray(rows)) rows = [];
  const activeRows = rows.filter(r => !r.missing);
  if (!activeRows.length) return;

  const priceCandidates = [];
  activeRows.forEach(r => {
    if (r.S > 0) priceCandidates.push(r.S);
    if (r.isUnderlying && r.P_avg > 0) priceCandidates.push(r.P_avg);
    if (!r.isUnderlying && r.K > 0) priceCandidates.push(r.K);
  });
  if (!priceCandidates.length) return;

  const minP = Math.max(1, Math.floor(Math.min(...priceCandidates) * 0.55));
  const maxP = Math.ceil(Math.max(...priceCandidates) * 1.45);
  const N = 200;
  const step = (maxP - minP) / N;

  const points = [];
  for (let i = 0; i <= N; i++) {
    const P = minP + i * step;
    let pnl = 0;
    for (const r of activeRows) {
      if (r.isUnderlying) {
        pnl += (r.direction === 'buy' ? (P - r.P_avg) : (r.P_avg - P)) * r.qty;
      } else {
        const intrinsic = r.type === 'call' ? Math.max(0, P - r.K) : Math.max(0, r.K - P);
        pnl += (r.direction === 'buy' ? (intrinsic - r.P_avg) : (r.P_avg - intrinsic)) * r.qty;
      }
    }
    points.push({ P, pnl });
  }

  const pnls = points.map(pt => pt.pnl);
  let yMin = Math.min(...pnls, 0), yMax = Math.max(...pnls, 0);
  if (yMin === yMax) { yMin = -1; yMax = 1; }
  const padY = (yMax - yMin) * 0.1;
  yMin -= padY; yMax += padY;

  const C = getChartColors();
  const padL = 100, padR = 30, padT = 30, padB = 60;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const sx = x => padL + (x - minP) / (maxP - minP) * chartW;
  const sy = y => padT + chartH - (y - yMin) / (yMax - yMin) * chartH;

  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const y = padT + chartH * i / 6;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    
    const val = yMax - (yMax - yMin) * i / 6;
    let label = fmt0(val);
    if (val < 0) {
      label = `(${fmt0(Math.abs(val))})`;
      ctx.fillStyle = '#ef4444';
    } else {
      ctx.fillStyle = C.axis;
    }
    ctx.font = '12px Vazirmatn, Tahoma'; ctx.textAlign = 'right';
    ctx.fillText(label, padL - 8, y + 4);
  }

  for (let i = 0; i <= 10; i++) {
    const x = padL + chartW * i / 10;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + chartH); ctx.stroke();
    ctx.fillStyle = C.axis; ctx.textAlign = 'center';
    ctx.fillText(fmt0(minP + (maxP - minP) * i / 10), x, padT + chartH + 18);
  }
  if (yMin <= 0 && yMax >= 0) {
    ctx.strokeStyle = C.zero; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(padL, sy(0)); ctx.lineTo(W - padR, sy(0)); ctx.stroke();
  }

  ctx.strokeStyle = C.line; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach((pt, i) => {
    const x = sx(pt.P), y = sy(pt.pnl);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // خط قیمت فعلی
  const currentS = activeRows.find(r => r.S > 0)?.S || 0;
  if (currentS > 0 && currentS >= minP && currentS <= maxP) {
    let pnlAtS0 = 0;
    for (const r of activeRows) {
      if (r.isUnderlying) {
        pnlAtS0 += (r.direction === 'buy' ? (currentS - r.P_avg) : (r.P_avg - currentS)) * r.qty;
      } else {
        const intrinsic = r.type === 'call' ? Math.max(0, currentS - r.K) : Math.max(0, r.K - currentS);
        pnlAtS0 += (r.direction === 'buy' ? (intrinsic - r.P_avg) : (r.P_avg - intrinsic)) * r.qty;
      }
    }

    const cx = sx(currentS);
    const cy = sy(pnlAtS0);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, padT + chartH); ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fillStyle = C.bg; ctx.fill();
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill();

    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 13px Vazirmatn, Tahoma'; ctx.textAlign = 'center';
    const labelText = 'قیمت فعلی: ' + fmt0(currentS);
    const tw = ctx.measureText(labelText).width;
    let lx = cx;
    if (lx + tw/2 > W - padR) lx = W - padR - tw/2;
    if (lx - tw/2 < padL) lx = padL + tw/2;
    
    ctx.fillStyle = C.bg; ctx.fillRect(lx - tw/2 - 4, padT - 24, tw + 8, 16);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1;
    ctx.strokeRect(lx - tw/2 - 4, padT - 24, tw + 8, 16);
    ctx.fillStyle = '#ef4444';
    ctx.fillText(labelText, lx, padT - 10);
  }

  const bePoints = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i-1], b = points[i];
    if ((a.pnl === 0) || (a.pnl < 0 && b.pnl > 0) || (a.pnl > 0 && b.pnl < 0)) {
      const t = -a.pnl / (b.pnl - a.pnl);
      const x = a.P + t * (b.P - a.P);
      if (!bePoints.some(v => Math.abs(v - x) < (maxP - minP) * 0.005)) bePoints.push(x);
    }
  }
  bePoints.forEach(be => {
    const x = sx(be), y = sy(0);
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = C.bg; ctx.fill();
    ctx.strokeStyle = C.strike; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = C.strike; ctx.fill();
  });

  ctx.fillStyle = C.text; ctx.font = 'bold 13px Vazirmatn, Tahoma'; ctx.textAlign = 'center';
  ctx.fillText('قیمت دارایی پایه در سررسید', padL + chartW / 2, H - 8);
  ctx.save(); ctx.translate(18, padT + chartH / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.fillText('سود / زیان', 0, 0); ctx.restore();

  var net = 0, sumAbs = 0;
  activeRows.forEach(function(r){
    if (r.direction === 'sell') net += (r.amount || 0); else net -= (r.amount || 0);
    sumAbs += Math.abs(r.amount || 0);
  });
  const pctBase = Math.abs(net) > 1 ? Math.abs(net) : (sumAbs || 1);

  canvas.__rpData = { points, minP, maxP, padL, padT, padR, chartW, chartH, W, H, pctBase };
  canvas.onmousemove = function(e) {
    try {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (mx < padL || mx > padL + chartW || my < padT || my > padT + chartH) { hideChartTip(); return; }
      var price = minP + (mx - padL) / chartW * (maxP - minP);
      var row = findNearestRow(points, price);
      if (!row) { hideChartTip(); return; }
      var pct = pctBase > 0 ? (row.pnl / pctBase) * 100 : null;
      var color = row.pnl >= 0 ? '#4ade80' : '#f87171';
      var sign = row.pnl >= 0 ? '+' : '';
      var html = '<div style="font-weight:800;margin-bottom:6px;padding-bottom:5px;border-bottom:1px dashed rgba(255,255,255,.18);font-size:12.5px">قیمت پایه: <span style="color:#93c5fd">' + fmt0(row.P) + '</span></div>';
      html += '<div style="display:flex;justify-content:space-between;gap:14px;font-size:12.5px"><span style="opacity:.85">سود / زیان:</span><b style="color:' + color + '">' + sign + fmt0(row.pnl) + '</b></div>';
      html += '<div style="display:flex;justify-content:space-between;gap:14px;font-size:12.5px"><span style="opacity:.85">درصد:</span>' + fmtPctHtml(pct) + '</div>';
      showChartTip(e.clientX, e.clientY, html);
    } catch (err) { hideChartTip(); }
  };
  canvas.onmouseleave = function() { hideChartTip(); };
  canvas.style.cursor = 'crosshair';
}

function renderReportPanel(){
  const tbl = document.getElementById('rpTable');
  const addSel = document.getElementById('rpAddOption');
  const statusEl = document.getElementById('rpStatus');
  const summaryEl = document.getElementById('rpSummary');
  const tableHint = document.getElementById('rpTableHint');
  const badgeEl = document.getElementById('rpBadge');
  if (!tbl || !addSel) return;

  rpUpdateFileStatus();

  if (!state.options || !state.options.length){
    addSel.innerHTML = '<option value="">— ابتدا داده بازار را دریافت کنید —</option>';
    tbl.innerHTML = '<tbody><tr><td colspan="19" style="text-align:center;padding:36px;color:#64748b">ابتدا از بخش «تحلیل استراتژی» دکمه دریافت داده را بزنید.</td></tr></tbody>';
    if (summaryEl) summaryEl.innerHTML = '';
    if (tableHint) tableHint.textContent = '';
    if (statusEl) statusEl.innerHTML = '<span class="dot wait"></span>در انتظار داده';
    if (badgeEl) badgeEl.textContent = (state.savedPositions || []).length;
    return;
  }

  if (state.rpSelectedStrategy === undefined) state.rpSelectedStrategy = 'all';
  
  const uniqueStrategies = [...new Set(state.savedPositions.map(p => p.strategyName || 'بدون نام'))].sort((a,b)=>a.localeCompare(b,'fa'));
  
  const groupSel = document.getElementById('rpGroupByStrategy');
  if (groupSel) {
    const curVal = state.rpSelectedStrategy;
    if (groupSel.options.length - 1 !== uniqueStrategies.length) {
      groupSel.innerHTML = '<option value="all">همه استراتژی‌ها (کل پرتفوی)</option>' +
        uniqueStrategies.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    groupSel.value = uniqueStrategies.includes(curVal) ? curVal : 'all';
    if (groupSel.value !== curVal) state.rpSelectedStrategy = groupSel.value;
  }

  const datalist = document.getElementById('rpStrategyNameList');
  if (datalist) {
    datalist.innerHTML = uniqueStrategies.map(s => `<option value="${s}">`).join('');
  }

  // ⬇⬇⬇ فیلتر کردن دقیق موقعیت‌ها بر اساس استراتژی انتخاب شده ⬇⬇⬇
  const filteredPositions = state.savedPositions.filter(p => {
    if (state.rpSelectedStrategy === 'all') return true;
    return (p.strategyName || 'بدون نام') === state.rpSelectedStrategy;
  });

  populateRpSymbols();
  
  // ساختن ردیف‌های جدول فقط از روی موقعیت‌های فیلتر شده
  const rows = filteredPositions.map(computeSavedPositionRow);

  const underlyingMap = {};
  rows.forEach(r => {
    if (!r.missing && r.isUnderlying && r.direction === 'buy') {
      if (!underlyingMap[r.sym]) underlyingMap[r.sym] = { qty: 0, totalCost: 0 };
      underlyingMap[r.sym].qty += r.qty;
      underlyingMap[r.sym].totalCost += r.qty * r.P_avg;
    }
  });
  
  const avgCostMap = {};
  Object.keys(underlyingMap).forEach(sym => {
    const u = underlyingMap[sym];
    avgCostMap[sym] = u.qty > 0 ? u.totalCost / u.qty : 0;
  });
  
  const remainingUnderlyingMap = {};
  Object.keys(underlyingMap).forEach(sym => {
    remainingUnderlyingMap[sym] = underlyingMap[sym].qty;
  });

  rows.forEach(r => {
    if (r.missing) return;

    if (!r.isUnderlying) {
      r.pureOptionAmount = r.amount;
      r.pureOptionCloseAmount = r.closeAmount;
      r.pureOptionOffsetPnl = r.offsetPnl;

      if (r.direction === 'sell') {
        const sym = r.underlying;
        const remaining = remainingUnderlyingMap[sym] || 0;
        if (remaining > 0) {
          const coveredQty = Math.min(r.qty, remaining);
          remainingUnderlyingMap[sym] -= coveredQty;
          const avgCost = avgCostMap[sym] || 0;
          const underlyingPnlCovered = (r.S - avgCost) * coveredQty;
          const underlyingCostCovered = avgCost * coveredQty;
          
          r.underlyingPnlCovered = underlyingPnlCovered;
          r.coveredQty = coveredQty;
          
          r.combinedPnl = underlyingPnlCovered + r.pureOptionOffsetPnl;
          r.combinedAmount = underlyingCostCovered + r.pureOptionAmount;
        } else {
          r.combinedPnl = r.pureOptionOffsetPnl;
          r.combinedAmount = r.pureOptionAmount;
          r.coveredQty = 0;
          r.underlyingPnlCovered = 0;
        }
      } else {
        r.combinedPnl = r.pureOptionOffsetPnl;
        r.combinedAmount = r.pureOptionAmount;
        r.coveredQty = 0;
        r.underlyingPnlCovered = 0;
      }

      r.combinedOffsetPct = r.combinedAmount > 0 ? (r.combinedPnl / r.combinedAmount) * 100 : 0;
      r.combinedAnnOffsetPct = (r.passedDays !== null && r.passedDays > 0) ? annualizePct(r.combinedOffsetPct, r.passedDays, getAnnualMode()) : null;

    } else {
      r.combinedPnl = r.offsetPnl;
      r.combinedAmount = r.amount;
      r.combinedOffsetPct = r.offsetPct;
      r.combinedAnnOffsetPct = r.annOffsetPct;
      r.coveredQtyTotal = underlyingMap[r.sym] ? (underlyingMap[r.sym].qty - remainingUnderlyingMap[r.sym]) : 0;
    }
  });

  const underlyingQty = rows
    .filter(r => !r.missing && r.posType === 'underlying' && r.direction === 'buy')
    .reduce((s, r) => s + r.qty, 0);
  rows.forEach(r => {
    if (!r.missing && r.posType === 'option' && r.direction === 'sell' && underlyingQty > 0)
      r.coveragePct = (r.qty / underlyingQty) * 100;
  });

  if (summaryEl && rows.length){
    let totalIncome = 0, totalExpense = 0, ytmSum = 0, ytmWeight = 0;
    rows.forEach(r => {
      if (r.missing) return;
      const cash = r.P_avg * r.qty;
      if (r.direction === 'sell') totalIncome += cash;
      else totalExpense += cash;
      if (r.posType === 'option' && r.ytm !== null && isFinite(r.ytm)) {
        const w = Math.max(1, r.amount);
        ytmSum += r.ytm * w;
        ytmWeight += w;
      }
    });
    const avgYtm = ytmWeight > 0 ? ytmSum / ytmWeight : null;
    const netCash = totalIncome - totalExpense;
    const totalClose = rows.reduce((s,r)=>s + (!r.missing && isFinite(r.closeAmount) ? r.closeAmount : 0), 0);
    const totalOffset = rows.reduce((s,r)=>s + (!r.missing && isFinite(r.offsetPnl) ? r.offsetPnl : 0), 0);
    const totalDeep = rows.reduce((s,r)=>s + (!r.missing && r.deepTotal != null ? r.deepTotal : 0), 0);

    summaryEl.innerHTML = `
      <div class="stat"><div class="k">تعداد موقعیت‌ها</div><div class="v">${rows.length}</div></div>
      <div class="stat pos"><div class="k">مجموع دریافتی از فروش</div><div class="v pos">${fmt0(totalIncome)}</div></div>
      <div class="stat neg"><div class="k">مجموع پرداختی برای خرید</div><div class="v neg">${fmt0(totalExpense)}</div></div>
      <div class="stat ${netCash >= 0 ? 'pos' : 'neg'}"><div class="k">آفست کلی (خالص نقدی)</div><div class="v ${netCash >= 0 ? 'pos' : 'neg'}">${fmt0(netCash)}</div></div>
      <div class="stat"><div class="k">مجموع مبلغ بستن</div><div class="v">${fmt0(totalClose)}</div></div>
      <div class="stat ${totalOffset >= 0 ? 'pos' : 'neg'}"><div class="k">مجموع سود / زیان</div><div class="v ${totalOffset >= 0 ? 'pos' : 'neg'}">${fmt0(totalOffset)}</div></div>
      <div class="stat ${avgYtm !== null && avgYtm >= 0 ? 'pos' : 'neg'}"><div class="k">میانگین وزنی YTM</div><div class="v ${avgYtm !== null && avgYtm >= 0 ? 'pos' : 'neg'}">${avgYtm !== null ? avgYtm.toFixed(2) + '%' : '—'}</div></div>
      <div class="stat ${totalDeep >= 0 ? 'pos' : 'neg'}"><div class="k">مجموع Deep کل</div><div class="v ${totalDeep >= 0 ? 'pos' : 'neg'}">${fmt0(totalDeep)}</div></div>
    `;
  } else if (summaryEl) summaryEl.innerHTML = '';

  if (!rows.length){
    tbl.innerHTML = '<tbody><tr><td colspan="19" style="text-align:center;padding:36px;color:#64748b">هنوز موقعیتی ثبت نشده است.</td></tr></tbody>';
    if (tableHint) tableHint.textContent = '';
    if (statusEl) statusEl.innerHTML = '<span class="dot ok"></span>آماده';
    if (badgeEl) badgeEl.textContent = '0';
    __rpLastRows = null;
    const cv = document.getElementById('rpChart');
    if (cv){ const ctx = cv.getContext('2d'); ctx.clearRect(0,0,cv.width,cv.height); }
    return;
  }

  const colgroup = `<colgroup>
    <col style="width: 80px;">
    <col style="width: 110px;">
    <col style="width: 160px;">
    <col style="width: 70px;">
    <col style="width: 90px;">
    <col style="width: 100px;">
    <col style="width: 80px;">
    <col style="width: 90px;">
    <col style="width: 100px;">
    <col style="width: 70px;">
    <col style="width: 60px;">
    <col style="width: 100px;">
    <col style="width: 100px;">
    <col style="width: 90px;">
    <col style="width: 80px;">
    <col style="width: 80px;">
    <col style="width: 80px;">
    <col style="width: 80px;">
    <col style="width: 50px;">
  </colgroup>`;

  const thead = `<thead><tr>
    <th style="text-align: center;"># / جابجایی</th>
    <th>نام استراتژی</th>
    <th>نماد</th>
    <th>جهت</th>
    <th>قیمت اعمال</th>
    <th>سررسید</th>
    <th>تعداد</th>
    <th>میانگین پرمیوم/قیمت</th>
    <th>تاریخ سرمایه‌گذاری</th>
    <th>روز سپری شده</th>
    <th>پوشش</th>
    <th>مبلغ موقعیت</th>
    <th>مبلغ بستن</th>
    <th>سود / زیان</th>
    <th>درصد آفست</th>
    <th>سالانه آفست</th>
    <th>وضعیت</th>
    <th>YTM</th>
    <th>حذف</th>
  </tr></thead>`;

  let tbody = '<tbody>';
  rows.forEach((r, i) => {
    const moveHtml = `<td class="num" style="padding: 4px;">
      <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
        <span class="rp-drag-handle" title="برای جابجایی بکشید">☰</span>
        <div style="display:flex; flex-direction:column; gap:2px;">
          <button type="button" class="rp-move-btn" onclick="moveRpRow('${r.pos.id}', -1)" ${i===0?'disabled':''}>▲</button>
          <button type="button" class="rp-move-btn" onclick="moveRpRow('${r.pos.id}', 1)" ${i===rows.length-1?'disabled':''}>▼</button>
        </div>
        <span style="font-weight:800; font-size:11px; width:16px; text-align:center;">${i+1}</span>
      </div>
    </td>`;

    if (r.missing){
      tbody += `<tr data-rp-row="${i}" data-rp-id="${r.pos.id}">
        ${moveHtml}
        <td><span class="tag" style="background:#f1f5f9;color:#475569">${escapeHtml(r.pos.strategyName || '—')}</span></td>
        <td class="sym-cell">${escapeHtml(r.pos.sym)}</td>
        <td colspan="15" style="color:var(--bad);font-weight:700">— اختیار در داده‌های فعلی یافت نشد —</td>
        <td><button type="button" data-rp-remove="${escapeAttr(r.pos.id)}" style="padding:4px 10px;background:var(--bad-bg);color:var(--bad);border:1px solid var(--bad-line);border-radius:6px;cursor:pointer;font-weight:800">✕</button></td>
      </tr>`;
      return;
    }
    const dirLabel = r.direction === 'sell' ? 'فروش' : 'خرید';
    const dirCls = r.direction === 'sell' ? 'call' : 'put';

    const coverageText = r.coveragePct !== null ? r.coveragePct.toFixed(1) + '%' : '—';
    const coverageCls = r.coveragePct !== null && r.coveragePct >= 100 ? 'pos' : '';

    const ytmText = (r.ytm !== null && isFinite(r.ytm)) ? (r.ytm >= 0 ? '+' : '') + r.ytm.toFixed(1) + '%' : '—';
    const ytmCls = (r.ytm !== null && isFinite(r.ytm)) ? (r.ytm >= 0 ? 'pos' : 'neg') : '';

    const statusCell = r.isUnderlying
      ? '<span style="color:var(--muted);font-size:11.5px">—</span>'
      : `<select data-rp-assigned="${escapeAttr(r.pos.id)}" style="padding:3px 6px;font-size:11.5px;border:1px solid var(--line-2);border-radius:5px;background:var(--card);color:var(--ink);font-family:inherit;cursor:pointer">
          <option value="assigned" ${r.assigned ? 'selected' : ''}>اعمال</option>
          <option value="burned" ${!r.assigned ? 'selected' : ''}>سوخت</option>
        </select>`;

    const pnlCls = r.offsetPnl >= 0 ? 'pos' : 'neg';
    
    let amountLabel = '—';
    if (r.isUnderlying) amountLabel = 'ارزش سهم';
    else if (r.direction === 'sell') amountLabel = 'پرمیوم دریافتی';
    else amountLabel = 'پرمیوم پرداختی';

    const closeLbl = r.direction === 'sell' ? 'خرید برای بستن' : 'فروش برای بستن';

    const invDateVal = r.pos.investmentDate || '';
    const passedDaysTxt = r.passedDays !== null ? r.passedDays + ' روز' : '—';
    
    const offsetPctTxt = (r.combinedOffsetPct >= 0 ? '+' : '') + r.combinedOffsetPct.toFixed(2) + '%';
    const offsetPctCls = r.combinedOffsetPct >= 0 ? 'pos' : 'neg';
    
    const annOffsetTxt = (r.combinedAnnOffsetPct !== null && isFinite(r.combinedAnnOffsetPct)) ? (r.combinedAnnOffsetPct >= 0 ? '+' : '') + r.combinedAnnOffsetPct.toFixed(2) + '%' : '—';
    const annOffsetPctCls = (r.combinedAnnOffsetPct !== null && isFinite(r.combinedAnnOffsetPct)) ? (r.combinedAnnOffsetPct >= 0 ? 'pos' : 'neg') : '';

    let coveredNote = '';
    if (r.isUnderlying && r.coveredQtyTotal > 0) {
      coveredNote = `<br><small style="color:var(--muted);font-size:9px">پوشش: ${fmt0(r.coveredQtyTotal)}</small>`;
    } else if (!r.isUnderlying && r.coveredQty > 0) {
      coveredNote = `<br><small style="color:var(--muted);font-size:9px">سهم: ${fmt0(r.underlyingPnlCovered)}</small>`;
    }

    tbody += `<tr data-rp-row="${i}" data-rp-id="${r.pos.id}">
      ${moveHtml}
      <td><span class="tag" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe">${escapeHtml(r.pos.strategyName || '—')}</span></td>
      <td>${buildSymbolSelectHtml(r.pos.id, r.pos.sym, r.pos.type)}</td>
      <td>
        <select data-rp-dir="${escapeAttr(r.pos.id)}" style="padding:4px 6px;font-size:11.5px;border:1px solid var(--line-2);border-radius:5px;background:var(--card);color:var(--ink);font-family:inherit;cursor:pointer">
          <option value="buy" ${r.pos.direction === 'buy' ? 'selected' : ''}>خرید</option>
          <option value="sell" ${r.pos.direction === 'sell' ? 'selected' : ''}>فروش</option>
        </select>
      </td>
      <td class="num price">${r.K !== null ? fmt0(r.K) : '—'}</td>
      <td>${r.expiryStr ? escapeHtml(r.expiryStr) + ' <small style="color:var(--muted)">(' + r.days + ' روز)</small>' : '—'}</td>
      <td class="num"><input type="number" min="1" step="1" value="${r.qty}" data-rp-qty="${escapeAttr(r.pos.id)}" style="width:100%;padding:4px 6px;text-align:center;border:1px solid var(--line-2);border-radius:6px;font-family:inherit;font-size:12.5px;background:var(--card);color:var(--ink);outline:none"></td>
      <td class="num"><input type="number" min="0" step="any" value="${r.P_avg}" data-rp-prem="${escapeAttr(r.pos.id)}" style="width:100%;padding:4px 6px;text-align:center;border:1px solid var(--line-2);border-radius:6px;font-family:inherit;font-size:12.5px;background:var(--card);color:var(--ink);outline:none"></td>
      <td><input type="text" value="${invDateVal}" data-rp-invdate="${escapeAttr(r.pos.id)}" placeholder="1402/01/01" style="width:100%;padding:4px 6px;text-align:center;border:1px solid var(--line-2);border-radius:6px;font-family:inherit;font-size:12px;background:var(--card);color:var(--ink);outline:none"></td>
      <td class="num">${passedDaysTxt}</td>
      <td class="num ${coverageCls}">${coverageText}</td>
      
      <td class="num"><b>${fmt0(r.amount)}</b><br><small style="color:var(--muted);font-size:10.5px">${amountLabel}</small></td>
      <td class="num"><b>${fmt0(r.closeAmount)}</b><br><small style="color:var(--muted);font-size:10.5px">${closeLbl} · آخرین: ${fmt0(r.P_market)}</small></td>
      <td class="num ${pnlCls}"><b>${fmt0(r.offsetPnl)}</b>${coveredNote}</td>
      
      <td class="num ${offsetPctCls}"><b>${offsetPctTxt}</b></td>
      <td class="num ${annOffsetPctCls}"><b>${annOffsetTxt}</b></td>
      
      <td>${statusCell}</td>
      <td class="num ${ytmCls}"><b>${ytmText}</b></td>
      <td><button type="button" data-rp-remove="${escapeAttr(r.pos.id)}" style="padding:4px 10px;background:var(--bad-bg);color:var(--bad);border:1px solid var(--bad-line);border-radius:6px;cursor:pointer;font-weight:800">✕</button></td>
    </tr>`;
  });
  tbody += '</tbody>';
  
  tbl.innerHTML = colgroup + thead + tbody;

  tbl.querySelectorAll('input[data-rp-qty]').forEach(inp => {
    inp.addEventListener('change', e => {
      const pos = state.savedPositions.find(p => p.id === e.target.dataset.rpQty);
      if (pos) { pos.qty = Math.max(1, toNum(e.target.value)); saveSavedPositions(); renderReportPanel(); }
    });
  });
  tbl.querySelectorAll('input[data-rp-prem]').forEach(inp => {
    inp.addEventListener('change', e => {
      const pos = state.savedPositions.find(p => p.id === e.target.dataset.rpPrem);
      if (pos) { pos.avgPremium = Math.max(0, toNum(e.target.value)); saveSavedPositions(); renderReportPanel(); }
    });
  });
  tbl.querySelectorAll('select[data-rp-assigned]').forEach(sel => {
    sel.addEventListener('change', e => {
      const pos = state.savedPositions.find(p => p.id === e.target.dataset.rpAssigned);
      if (pos) { pos.assigned = e.target.value === 'assigned'; saveSavedPositions(); renderReportPanel(); }
    });
  });
  tbl.querySelectorAll('input[data-rp-invdate]').forEach(inp => {
    inp.addEventListener('change', e => {
      const pos = state.savedPositions.find(p => p.id === e.target.dataset.rpInvdate);
      if (!pos) return;
      const val = e.target.value.trim().replace(/[-\s]+/g, '/');
      if (val && !parseJalaliDate(val)) {
        alert('تاریخ نامعتبر است.');
        e.target.value = pos.investmentDate || '';
        return;
      }
      pos.investmentDate = val ? normalizeExpiryStr(val) : '';
      saveSavedPositions(); renderReportPanel();
    });
  });
  tbl.querySelectorAll('[data-rp-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.savedPositions = state.savedPositions.filter(p => p.id !== btn.dataset.rpRemove);
      syncStrategyNames();
      saveSavedPositions(); renderReportPanel();
    });
  });

  tbl.querySelectorAll('[data-rp-sym]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const posId = e.target.dataset.rpSym;
      const pos = state.savedPositions.find(p => p.id === posId);
      if (!pos) return;
      const val = e.target.value;
      if (!val) { pos.sym = ''; saveSavedPositions(); renderReportPanel(); return; }
      
      const opt = e.target.options[e.target.selectedIndex];
      const type = opt.dataset.type;
      if (type === 'option') { pos.type = 'option'; pos.sym = val; }
      else { pos.type = 'underlying'; pos.sym = val; }
      
      saveSavedPositions();
      renderReportPanel();
    });
  });

  tbl.querySelectorAll('[data-rp-dir]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const pos = state.savedPositions.find(p => p.id === e.target.dataset.rpDir);
      if (pos) { pos.direction = e.target.value; saveSavedPositions(); renderReportPanel(); }
    });
  });

  if (tableHint) tableHint.textContent = `${rows.length} موقعیت | 💡 برای ویرایش مقادیر کلیک کنید`;
  if (statusEl) statusEl.innerHTML = `<span class="dot ok"></span>${rows.length} موقعیت`;
  if (badgeEl) badgeEl.textContent = state.savedPositions.length;

  // ⬇⬇⬇ فقط و فقط ردیف‌های فیلترشده را برای رسم نمودار ارسال می‌کنیم ⬇⬇⬇
  __rpLastRows = rows;
  requestAnimationFrame(() => { try { drawRpChart(rows); } catch(e){} });

  let dragSrcEl = null;
  const trs = tbl.querySelectorAll('tbody tr[data-rp-row]');
  trs.forEach(tr => {
    tr.setAttribute('draggable', 'true');
    
    tr.addEventListener('dragstart', function(e) {
      if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(e.target.tagName) || e.target.closest('button') || e.target.closest('select')) {
        e.preventDefault();
        return;
      }
      dragSrcEl = this;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', this.innerHTML);
      setTimeout(() => this.classList.add('dragging'), 0);
    });

    tr.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragSrcEl && dragSrcEl !== this) {
        trs.forEach(r => r.classList.remove('drag-over'));
        this.classList.add('drag-over');
      }
    });

    tr.addEventListener('dragleave', function(e) {
      this.classList.remove('drag-over');
    });

    tr.addEventListener('drop', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (dragSrcEl && dragSrcEl !== this) {
        const fromId = dragSrcEl.dataset.rpId;
        const toId = this.dataset.rpId;
        const fromIndex = state.savedPositions.findIndex(p => p.id === fromId);
        const toIndex = state.savedPositions.findIndex(p => p.id === toId);
        
        if (fromIndex > -1 && toIndex > -1) {
          const item = state.savedPositions.splice(fromIndex, 1)[0];
          state.savedPositions.splice(toIndex, 0, item);
          saveSavedPositions();
          renderReportPanel();
        }
      }
      return false;
    });

    tr.addEventListener('dragend', function(e) {
      this.classList.remove('dragging');
      trs.forEach(r => r.classList.remove('drag-over'));
      dragSrcEl = null;
    });
  });
}

function addSavedPosition(){
  const posType = document.getElementById('rpAddType')?.value || 'option';
  const sym = document.getElementById('rpAddOption').value;
  if (!sym){ alert('نماد را انتخاب کنید.'); return; }
  
  let strategyName = document.getElementById('rpAddStrategyName')?.value.trim();
  if (!strategyName) {
    if (posType === 'underlying') {
      strategyName = sym;
    } else {
      const opt = state.options.find(o => o.sym === sym);
      strategyName = opt ? opt.underlying : sym;
    }
    if(!strategyName) strategyName = 'بدون نام';
  }

  const direction = document.getElementById('rpAddDirection').value === 'buy' ? 'buy' : 'sell';
  const qty = Math.max(1, toNum(document.getElementById('rpAddQty').value));
  const premium = toNum(document.getElementById('rpAddPremium').value);
  if (!(premium > 0)){ alert('قیمت را وارد کنید.'); return; }

  const dateInp = document.getElementById('rpAddDate');
  let invDateStr = '';
  if (dateInp && dateInp.value.trim()) {
    const rawVal = dateInp.value.trim().replace(/[-\s]+/g, '/');
    if (!parseJalaliDate(rawVal)) { alert('تاریخ نامعتبر است.'); return; }
    invDateStr = normalizeExpiryStr(rawVal);
  }

  const existing = state.savedPositions.find(p =>
    (p.type || 'option') === posType && p.sym === sym && p.direction === direction && (p.strategyName || 'بدون نام') === strategyName);

  if (existing){
    const totalQty = existing.qty + qty;
    existing.avgPremium = ((existing.avgPremium * existing.qty) + (premium * qty)) / totalQty;
    existing.qty = totalQty;
    if (invDateStr) existing.investmentDate = invDateStr;
  } else {
    state.savedPositions.push({
      id: 'rp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type: posType, sym, direction, qty, avgPremium: premium,
      assigned: true, investmentDate: invDateStr, strategyName
    });
  }
  syncStrategyNames();
  saveSavedPositions();
  document.getElementById('rpAddQty').value = 1000;
  document.getElementById('rpAddPremium').value = '';
  renderReportPanel();
}

async function exportRpImage(){
  if (!window.html2canvas){ alert('کتابخانه تصویر آماده نیست.'); return; }
  const target = document.getElementById('rpDisplayCard');
  if (!target) return;
  closeCalcPopover();
  const btn = document.getElementById('rpExportPngBtn');
  const old = btn ? btn.textContent : '';
  if (btn){ btn.disabled = true; btn.textContent = '⏳...'; }
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff';
    const canvas = await html2canvas(target, { backgroundColor: bg, scale: 2, useCORS: true, logging: false });
    const link = document.createElement('a');
    link.download = 'positions-' + new Date().toISOString().slice(0,10) + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch(err){ alert('خطا: ' + err.message); } finally { if (btn){ btn.disabled = false; btn.textContent = old; } }
}

async function exportRpPdf(){
  if (!window.html2canvas || !window.jspdf){ alert('کتابخانه PDF آماده نیست.'); return; }
  const target = document.getElementById('rpDisplayCard');
  if (!target) return;
  closeCalcPopover();
  const btn = document.getElementById('rpExportPdfBtn');
  const old = btn ? btn.textContent : '';
  if (btn){ btn.disabled = true; btn.textContent = '⏳...'; }
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff';
    const canvas = await html2canvas(target, { backgroundColor: bg, scale: 2, useCORS: true, logging: false });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const m = 8, uw = pw - 2*m, uh = ph - 2*m;
    const pxmm = canvas.width / uw, th = canvas.height / pxmm;
    if (th <= uh) pdf.addImage(canvas, 'PNG', m, m, uw, th);
    else {
      const pph = Math.floor(uh * pxmm);
      let oy = 0, idx = 0;
      while (oy < canvas.height) {
        const sh = Math.min(pph, canvas.height - oy);
        const sc = document.createElement('canvas');
        sc.width = canvas.width; sc.height = sh;
        sc.getContext('2d').drawImage(canvas, 0, oy, canvas.width, sh, 0, 0, canvas.width, sh);
        if (idx > 0) pdf.addPage();
        pdf.addImage(sc, 'PNG', m, m, uw, sh / pxmm);
        oy += sh; idx++;
      }
    }
    pdf.save('positions-' + new Date().toISOString().slice(0,10) + '.pdf');
  } catch(err){ alert('خطا: ' + err.message); } finally { if (btn){ btn.disabled = false; btn.textContent = old; } }
}

function exportRpExcel(){
  const rows = __rpLastRows;
  if (!rows || !rows.length){ alert('داده‌ای نیست.'); return; }
  if (!window.XLSX){ alert('کتابخانه اکسل آماده نیست.'); return; }
  const btn = document.getElementById('rpExportExcelBtn');
  const old = btn ? btn.textContent : '';
  if (btn){ btn.disabled = true; btn.textContent = '⏳...'; }
  try {
    let totalQty = 0, totalAmt = 0, totalClose = 0, totalPnl = 0, totalPrem = 0;
    let sumAvgPrem = 0;
    let sumYtmW = 0, totalYtmW = 0;
    let sumAnnOffsetW = 0, totalAnnOffsetW = 0;
    const data = [];
    
    rows.forEach(r => {
      if (r.missing) return;
      const type = r.isUnderlying ? 'سهم' : (r.type === 'call' ? 'Call' : 'Put');
      const dir = r.direction === 'sell' ? 'فروش' : 'خرید';
      const status = r.isUnderlying ? '—' : (r.assigned ? 'اعمال' : 'سوخت');
      const cov = r.coveragePct !== null ? r.coveragePct/100 : '';
      const ytm = (r.ytm !== null && isFinite(r.ytm)) ? r.ytm/100 : '';
      
      const amt = r.isUnderlying ? (r.qty * r.P_avg) : (r.pureOptionAmount || r.amount);
      const closeAmt = r.isUnderlying ? (r.qty * r.P_market) : (r.pureOptionCloseAmount || r.closeAmount);
      const pnl = r.isUnderlying ? ((r.direction==='buy'?(r.P_market-r.P_avg):(r.P_avg-r.P_market))*r.qty) : (r.pureOptionOffsetPnl || r.offsetPnl);
      
      const opct = (r.combinedOffsetPct !== undefined) ? (r.combinedOffsetPct / 100) : (r.amount > 0 ? (r.offsetPnl / r.amount) : 0);
      const apct = (r.combinedAnnOffsetPct !== undefined && r.combinedAnnOffsetPct !== null && isFinite(r.combinedAnnOffsetPct)) 
        ? (r.combinedAnnOffsetPct / 100) 
        : ((r.passedDays !== null && r.passedDays > 0) ? (annualizePct(opct * 100, r.passedDays, getAnnualMode()) / 100) : '');
      
      totalQty += r.qty;
      totalAmt += amt; totalClose += closeAmt; totalPnl += pnl;
      
      if (!r.isUnderlying) {
        sumAvgPrem += r.P_avg;
        const weight = Math.abs(amt) || 1;
        if (r.ytm !== null && isFinite(r.ytm)) { sumYtmW += r.ytm * weight; totalYtmW += weight; }
        if (apct !== '' && isFinite(apct)) { sumAnnOffsetW += (apct*100) * weight; totalAnnOffsetW += weight; }
        
        if (r.direction === 'sell') totalPrem += (r.pureOptionAmount || 0);
      }

      data.push([data.length+1, r.pos.strategyName || '—', type, r.sym, dir, r.K||'', r.expiryStr||'', r.qty, r.P_avg, r.pos.investmentDate||'', r.passedDays!==null?r.passedDays:'', cov, amt, closeAmt, pnl, opct, apct, status, ytm]);
    });
    
    const avgYtm = totalYtmW > 0 ? (sumYtmW / totalYtmW) : '';
    const avgAnnOffset = totalAnnOffsetW > 0 ? (sumAnnOffsetW / totalAnnOffsetW) : '';
    
    const hdr = ['#','نام استراتژی','نوع','نماد','جهت','قیمت اعمال','سررسید','تعداد','میانگین پرمیوم/قیمت','تاریخ سرمایه‌گذاری','روز سپری شده','پوشش','مبلغ موقعیت','مبلغ بستن','سود / زیان','درصد آفست','سالانه آفست','وضعیت','YTM سالانه'];
    const tot = ['جمع کل', '', '', '', '', '', '', totalQty, sumAvgPrem, '', '', '', totalAmt, totalClose, totalPnl, '', '', '', ''];
    const aoa = [hdr, ...data, tot, [], 
      ['میانگین وزنی YTM', avgYtm ? (avgYtm/100) : ''], 
      ['میانگین وزنی سالانه آفست', avgAnnOffset ? (avgAnnOffset/100) : ''], 
      [], 
      ['جمع پرمیوم دریافتی (فروش اختیار)', totalPrem], 
      ['توجه: مبالغ موقعیت و سود شامل ترکیب سهام پوشش‌داده‌شده نیست و برای هر ردیف جداگانه محاسبه شده است.']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{wch:5},{wch:18},{wch:8},{wch:22},{wch:8},{wch:13},{wch:13},{wch:10},{wch:18},{wch:15},{wch:12},{wch:10},{wch:16},{wch:16},{wch:16},{wch:12},{wch:12},{wch:9},{wch:14}];
    const rng = XLSX.utils.decode_range(ws['!ref']);
    [11,15,16,18].forEach(c => { for(let r=1; r<=rng.e.r; r++){ const ad = XLSX.utils.encode_cell({r,c}); if(ws[ad] && ws[ad].t==='n') ws[ad].z='0.0%'; }});
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Positions');
    XLSX.writeFile(wb, 'positions-' + new Date().toISOString().slice(0,10) + '.xlsx');
  } catch(err){ alert('خطا: ' + err.message); } finally { if (btn){ btn.disabled = false; btn.textContent = old; } }
}

function printRpTableOnly() {
  const rows = __rpLastRows;
  if (!rows || !rows.length) { alert('داده‌ای نیست.'); return; }
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let totalQty = 0, totalAmount = 0, totalClose = 0, totalPnl = 0;
  let sumPremReceived = 0, sumPremPaid = 0;
  let sumYtmWeighted = 0, totalYtmWeight = 0;
  let sumAnnOffsetWeighted = 0, totalAnnOffsetWeight = 0;
  let sumPassedDays = 0, cntPassedDays = 0;
  let sumRemainingDays = 0, cntRemainingDays = 0;
  let sumAvgPrem = 0; 

  rows.forEach(r => {
    if (r.missing) return;
    
    const amt = r.isUnderlying ? (r.qty * r.P_avg) : (r.pureOptionAmount || r.amount);
    const closeAmt = r.isUnderlying ? (r.qty * r.P_market) : (r.pureOptionCloseAmount || r.closeAmount);
    const pnl = r.isUnderlying ? ((r.direction==='buy'?(r.P_market-r.P_avg):(r.P_avg-r.P_market))*r.qty) : (r.pureOptionOffsetPnl || r.offsetPnl);

    totalQty += r.qty;
    totalAmount += amt;
    totalClose += closeAmt;
    totalPnl += pnl;

    if (!r.isUnderlying) {
      sumAvgPrem += r.P_avg;
      
      if (r.direction === 'sell') sumPremReceived += (r.pureOptionAmount || 0);
      else sumPremPaid += (r.pureOptionAmount || 0);

      const weight = Math.abs(amt) || 1;
      const opct = (r.combinedOffsetPct !== undefined) ? r.combinedOffsetPct : (r.amount > 0 ? (r.offsetPnl / r.amount) * 100 : 0);
      let apct = (r.combinedAnnOffsetPct !== undefined) ? r.combinedAnnOffsetPct : null;
      
      if (apct !== null && isFinite(apct)) {
        sumAnnOffsetWeighted += apct * weight;
        totalAnnOffsetWeight += weight;
      }
      if (r.ytm !== null && isFinite(r.ytm)) {
        sumYtmWeighted += r.ytm * weight;
        totalYtmWeight += weight;
      }
      if (r.days !== null && r.days > 0) {
        sumRemainingDays += r.days;
        cntRemainingDays++;
      }
    }

    if (r.passedDays !== null && r.passedDays >= 0) {
      sumPassedDays += r.passedDays;
      cntPassedDays++;
    }
  });

  const avgAnnOffset = totalAnnOffsetWeight > 0 ? (sumAnnOffsetWeighted / totalAnnOffsetWeight) : null;
  const avgYtm = totalYtmWeight > 0 ? (sumYtmWeighted / totalYtmWeight) : null;
  const avgPassedDays = cntPassedDays > 0 ? (sumPassedDays / cntPassedDays) : 0;
  const avgRemainingDays = cntRemainingDays > 0 ? (sumRemainingDays / cntRemainingDays) : 30;
  const totalPeriodDays = avgPassedDays + avgRemainingDays;
  const netPrem = sumPremReceived - sumPremPaid;

  const baseS = rows.find(r => r.isUnderlying && r.direction === 'buy')?.S || rows[0]?.S || 0;
  let sensitivityHtml = '';
  
  if (baseS > 0) {
    const chartCanvas = document.createElement('canvas');
    chartCanvas.width = 1000;
    chartCanvas.height = 400;
    const ctx = chartCanvas.getContext('2d');
    
    const minS = baseS * 0.6;
    const maxS = baseS * 1.4;
    const N = 200;
    const step = (maxS - minS) / N;
    const points = [];
    
    let minPnl = 0, maxPnl = 0;

    for (let i = 0; i <= N; i++) {
      const price = minS + i * step;
      let pnl = 0;
      rows.forEach(r => {
        if (r.missing) return;
        if (r.isUnderlying) {
          pnl += (r.direction === 'buy' ? (price - r.P_avg) : (r.P_avg - price)) * r.qty;
        } else {
          const intrinsic = r.type === 'call' ? Math.max(0, price - r.K) : Math.max(0, r.K - price);
          const prem = r.pureOptionAmount || (r.qty * r.P_avg);
          pnl += (r.direction === 'sell' ? (prem - r.qty * intrinsic) : (r.qty * intrinsic - prem));
        }
      });
      points.push({ price, pnl });
      if (pnl < minPnl) minPnl = pnl;
      if (pnl > maxPnl) maxPnl = pnl;
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
    
    window.__printChartBase64 = chartCanvas.toDataURL('image/png');

    [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3].forEach(pct => {
      const price = Math.round(baseS * pct);
      let pnl = 0, netCapital = 0;

      rows.forEach(r => {
        if (r.missing) return;
        if (r.isUnderlying) {
          if (r.direction === 'buy') {
            pnl += (price - r.P_avg) * r.qty;
            netCapital += r.qty * r.P_avg;
          } else {
            pnl += (r.P_avg - price) * r.qty;
            netCapital -= r.qty * r.P_avg;
          }
        } else {
          const intrinsic = r.type === 'call' ? Math.max(0, price - r.K) : Math.max(0, r.K - price);
          const prem = r.pureOptionAmount || (r.qty * r.P_avg);
          if (r.direction === 'sell') {
            pnl += prem - r.qty * intrinsic;
            netCapital -= prem;
          } else {
            pnl += r.qty * intrinsic - prem;
            netCapital += prem;
          }
        }
      });

      const baseCap = Math.abs(netCapital) > 0 ? Math.abs(netCapital) : 1;
      const returnPct = (pnl / baseCap) * 100;
      const annReturnPct = annualizePct(returnPct, totalPeriodDays, getAnnualMode());
      const isCurrent = Math.abs(pct - 1.0) < 0.001;

      sensitivityHtml += `<tr${isCurrent ? ' class="current-price-row"' : ''}>
        <td class="num">${Math.round(pct*100)}%${isCurrent ? ' (فعلی)' : ''}</td>
        <td class="num">${fmt0(price)}</td>
        <td class="num ${pnl >= 0 ? 'pos' : 'neg'}">${fmt0(pnl)}</td>
        <td class="num ${returnPct >= 0 ? 'pos' : 'neg'}">${returnPct.toFixed(2)}%</td>
        <td class="num ${annReturnPct !== null && annReturnPct >= 0 ? 'pos' : 'neg'}">${annReturnPct !== null ? annReturnPct.toFixed(2) + '%' : '—'}</td>
      </tr>`;
    });
  }

  let tbody = '';
  rows.forEach((r, i) => {
    if (r.missing) {
      tbody += `<tr><td>${i+1}</td><td class="sym">${esc(r.pos.sym)}</td><td colspan="15" class="missing">— یافت نشد —</td></tr>`;
      return;
    }
    const dirLabel = r.direction === 'sell' ? 'فروش' : 'خرید';
    const dirCls = r.direction === 'sell' ? 'sell' : 'buy';
    const cov = r.coveragePct !== null ? r.coveragePct.toFixed(1) + '%' : '—';
    const ytm = (r.ytm !== null && isFinite(r.ytm)) ? (r.ytm >= 0 ? '+' : '') + r.ytm.toFixed(1) + '%' : '—';
    const ytmCls = (r.ytm !== null && isFinite(r.ytm)) ? (r.ytm >= 0 ? 'pos' : 'neg') : '';
    const st = r.isUnderlying ? '—' : (r.assigned ? 'اعمال' : 'سوخت');
    const invDate = r.pos.investmentDate || '—';
    const pDays = r.passedDays !== null ? r.passedDays + ' روز' : '—';

    const amt = r.isUnderlying ? (r.qty * r.P_avg) : (r.pureOptionAmount || r.amount);
    const closeAmt = r.isUnderlying ? (r.qty * r.P_market) : (r.pureOptionCloseAmount || r.closeAmount);
    const pnl = r.isUnderlying ? ((r.direction==='buy'?(r.P_market-r.P_avg):(r.P_avg-r.P_market))*r.qty) : (r.pureOptionOffsetPnl || r.offsetPnl);
    
    const opct = (r.combinedOffsetPct !== undefined) ? r.combinedOffsetPct : (r.amount > 0 ? (r.offsetPnl / r.amount) * 100 : 0);
    const apct = (r.combinedAnnOffsetPct !== undefined) ? r.combinedAnnOffsetPct : ((r.passedDays !== null && r.passedDays > 0) ? annualizePct(opct, r.passedDays, getAnnualMode()) : null);
    
    const opctStr = (opct >= 0 ? '+' : '') + opct.toFixed(2) + '%';
    const apctStr = (apct !== null && isFinite(apct)) ? (apct >= 0 ? '+' : '') + apct.toFixed(2) + '%' : '—';
    const apctCls = (apct !== null && isFinite(apct)) ? (apct >= 0 ? 'pos' : 'neg') : '';

    const expiryCell = r.expiryStr ? `<td class="wrap">${esc(r.expiryStr)}<br><small>(${r.days} روز)</small></td>` : `<td>—</td>`;

    tbody += `<tr>
      <td class="num">${i+1}</td>
      <td class="wrap" style="font-size:10px;color:#1d4ed8;font-weight:700">${esc(r.pos.strategyName || '—')}</td>
      <td class="sym">${esc(r.sym)}</td>
      <td><span class="tag ${dirCls}">${dirLabel}</span></td>
      <td class="num">${r.K !== null ? fmt0(r.K) : '—'}</td>
      ${expiryCell}
      <td class="num">${fmt0(r.qty)}</td>
      <td class="num">${fmt0(r.P_avg)}</td>
      <td class="wrap">${esc(invDate)}</td>
      <td class="num">${pDays}</td>
      <td class="num">${cov}</td>
      <td class="num">${fmt0(amt)}</td>
      <td class="num">${fmt0(closeAmt)}</td>
      <td class="num ${pnl >= 0 ? 'pos' : 'neg'}">${fmt0(pnl)}</td>
      <td class="num ${opct >= 0 ? 'pos' : 'neg'}">${opctStr}</td>
      <td class="num ${apctCls}">${apctStr}</td>
      <td>${st}</td>
      <td class="num ${ytmCls}">${ytm}</td>
    </tr>`;
  });

  tbody += `<tr class="total-row">
    <td colspan="6" style="text-align:right; padding-right:12px;">جمع کل</td>
    <td class="num">${fmt0(totalQty)}</td>
    <td class="num">${fmt0(sumAvgPrem)}</td>
    <td colspan="3">—</td>
    <td class="num">${fmt0(totalAmount)}</td>
    <td class="num">${fmt0(totalClose)}</td>
    <td class="num ${totalPnl >= 0 ? 'pos' : 'neg'}">${fmt0(totalPnl)}</td>
    <td colspan="2">—</td>
    <td colspan="2">—</td>
  </tr>`;

  tbody += `<tr class="mean-row">
    <td colspan="15" style="text-align:right; padding-right:12px;">
      <b>میانگین وزنی سود سالانه آفست:</b>
    </td>
    <td class="num ${avgAnnOffset !== null && avgAnnOffset >= 0 ? 'pos' : 'neg'}" style="font-weight:800;">
      ${avgAnnOffset !== null ? (avgAnnOffset >= 0 ? '+' : '') + avgAnnOffset.toFixed(2) + '%' : '—'}
    </td>
    <td colspan="2">—</td>
  </tr>`;

  tbody += `<tr class="premium-row">
    <td colspan="6" style="text-align:left;padding-right:12px"><b>جمع پرمیوم دریافتی (فروش):</b> ${fmt0(sumPremReceived)}</td>
    <td colspan="6" style="text-align:right;padding-left:12px"><b>جمع پرمیوم پرداختی (خرید):</b> ${fmt0(sumPremPaid)}</td>
    <td colspan="6" style="text-align:center"><b>پرمیوم خالص:</b> <span class="${netPrem >= 0 ? 'pos' : 'neg'}">${fmt0(netPrem)}</span></td>
  </tr>`;

  const now = new Date();
  const dateStr = now.toLocaleDateString('fa-IR');
  const stratName = state.rpSelectedStrategy === 'all' ? 'کل پرتفوی' : `استراتژی ${state.rpSelectedStrategy}`;

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>گزارش موقعیت‌ها</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Vazirmatn-font-face.css">
<style>
  :root {
    --ink: #0f172a;
    --muted: #64748b;
    --bg: #f8fafc;
    --border: #e2e8f0;
    --primary: #1e293b;
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
  tbody td.missing { color: var(--bad); font-weight: 700; }

  .pos { color: var(--ok); font-weight: 800; }
  .neg { color: var(--bad); font-weight: 800; }

  .tag { 
    display: inline-block; 
    padding: 2px 6px; 
    border-radius: 99px; 
    font-size: 9px; 
    font-weight: 800; 
    letter-spacing: 0.3px;
  }
  .tag.call { background: var(--ok-bg); color: var(--ok); border: 1px solid #bbf7d0; }
  .tag.put { background: var(--bad-bg); color: var(--bad); border: 1px solid #fecaca; }
  .tag.fund { background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }
  .tag.sell { background: var(--bad-bg); color: var(--bad); border: 1px solid #fecaca; }
  .tag.buy { background: var(--ok-bg); color: var(--ok); border: 1px solid #bbf7d0; }

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
  .print-btn:hover { background: #0f172a; }

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
  tr.mean-row td { 
    background: #fef9c3 !important; 
    color: var(--ink) !important; 
    font-size: 10.5px !important; 
    padding: 8px 4px !important; 
    border-top: 1px solid #fde047 !important; 
    border-bottom: 1px solid #fde047 !important; 
    -webkit-print-color-adjust: exact; 
  }
  tr.mean-row td b { color: #713f12; font-size: 11px; }
  tr.premium-row td { 
    background: #f1f5f9 !important; 
    color: var(--muted) !important; 
    font-size: 10.5px !important; 
    padding: 9px 4px !important; 
    border-bottom: 1px solid var(--border) !important; 
    white-space: nowrap;
  }
  tr.premium-row td b { color: var(--ink); font-size: 11px; }

  small { font-size: 9px; color: var(--muted); font-weight: 500; }

  .sensitivity-table-wrap { padding: 20px; border-top: 1px solid var(--border); background: #fafbfc; }
  .sensitivity-table-wrap h2 { font-size: 14px; font-weight: 800; margin: 0 0 12px 0; color: var(--ink); }
  .sensitivity-table-wrap .note { font-size: 10.5px; color: var(--muted); margin-bottom: 12px; line-height: 1.8; }
  tr.current-price-row td { background: #dbeafe !important; font-weight: 800; -webkit-print-color-adjust: exact; }

  .chart-container { padding: 10px 20px 20px; text-align: center; page-break-inside: avoid; }
  .chart-container img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--border); }

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
    tr.total-row, tr.premium-row, tr.mean-row { page-break-inside: avoid; }
    tbody tr:nth-child(even) { background: #f8fafc !important; -webkit-print-color-adjust: exact; }
    tr.total-row td { background: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
    tr.mean-row td { background: #fef9c3 !important; -webkit-print-color-adjust: exact; }
    tr.premium-row td { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
    .tag { -webkit-print-color-adjust: exact; }
    .pos, .neg { -webkit-print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 6mm; }
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>گزارش موقعیت‌های اختیار — ${stratName}</h1>
        <div class="meta">تاریخ چاپ: ${dateStr} &nbsp;|&nbsp; تعداد موقعیت‌ها: ${rows.length} &nbsp;|&nbsp; جمع تعداد: ${fmt0(totalQty)}</div>
      </div>
    </div>

    <table>
      <colgroup>
        <col style="width: 3%">
        <col style="width: 8%">
        <col style="width: 7%">
        <col style="width: 4%">
        <col style="width: 5%">
        <col style="width: 6%">
        <col style="width: 6%">
        <col style="width: 6%">
        <col style="width: 7%">
        <col style="width: 4%">
        <col style="width: 3%">
        <col style="width: 10%">
        <col style="width: 10%">
        <col style="width: 10%">
        <col style="width: 5%">
        <col style="width: 5%">
        <col style="width: 4%">
        <col style="width: 5%">
      </colgroup>
      <thead>
        <tr>
          <th>#</th><th>نام استراتژی</th><th>نماد</th><th>جهت</th><th>قیمت اعمال</th>
          <th>سررسید</th><th>تعداد</th><th>میانگین پرمیوم</th>
          <th>تاریخ سرمایه‌گذاری</th><th>روز سپری شده</th>
          <th>پوشش</th><th>مبلغ موقعیت</th>
          <th>مبلغ بستن</th><th>سود / زیان</th>
          <th>درصد آفست</th><th>سالانه آفست</th>
          <th>وضعیت</th><th>YTM</th>
        </tr>
      </thead>
      <tbody>${tbody}</tbody>
    </table>

    ${window.__printChartBase64 ? `
    <div class="chart-container">
      <h2 style="font-size: 14px; font-weight: 800; margin: 0 0 12px 0; color: var(--ink); text-align: right;">نمودار سود و زیان در سررسید</h2>
      <img src="${window.__printChartBase64}" alt="نمودار سود و زیان" />
    </div>
    ` : ''}

    ${baseS > 0 ? `
    <div class="sensitivity-table-wrap">
      <h2>جدول حساسیت — سود/زیان پرتفوی در سررسید بر اساس قیمت سهم</h2>
      <div class="note">
        سناریوها بر اساس قیمت فعلی سهم (${fmt0(baseS)}) محاسبه شده‌اند. سود/زیان، مجموع تحقق‌یافته در سررسید است (سود سهم + سود/زیان اختیار). درصد بازده نسبت به بهای تمام‌شده خالص محاسبه و با افق ${Math.round(totalPeriodDays)} روز سالانه‌سازی شده است.
      </div>
      <table>
        <colgroup>
          <col style="width: 15%">
          <col style="width: 20%">
          <col style="width: 25%">
          <col style="width: 20%">
          <col style="width: 20%">
        </colgroup>
        <thead>
          <tr>
            <th>تغییر قیمت سهم</th>
            <th>قیمت در سررسید</th>
            <th>سود / زیان پرتفوی</th>
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

// ==========================================
// اتصال رویدادها (Events Binding)
// ==========================================
(function bindReportEvents(){
  const bind = () => {
    const addBtn = document.getElementById('rpAddBtn');
    if (addBtn) addBtn.addEventListener('click', addSavedPosition);

    const addNewBtn = document.getElementById('rpAddNewStrategyBtn');
    if (addNewBtn) addNewBtn.addEventListener('click', () => {
      const name = prompt('نام استراتژی جدید را وارد کنید:', 'استراتژی ' + (state.savedPositions.length + 1));
      if (!name) return;
      const visibleNames = [...new Set((state.savedPositions || []).map(p => p.strategyName || 'بدون نام'))];
      if (visibleNames.includes(name)) { alert('این نام قبلا وجود دارد.'); return; }
      
      state.savedPositions.push({
        id: 'rp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        strategyName: name,
        type: 'underlying',
        sym: '',
        direction: 'buy',
        qty: 1000,
        avgPremium: 0,
        assigned: true
      });
      
      syncStrategyNames();
      saveSavedPositions();
      state.rpSelectedStrategy = name;
      renderReportPanel();
      
      const stratInp = document.getElementById('rpAddStrategyName');
      if (stratInp) stratInp.value = name;
    });

    const typeSel = document.getElementById('rpAddType');
    if (typeSel) typeSel.addEventListener('change', () => {
      populateRpSymbols();
      const premInp = document.getElementById('rpAddPremium');
      if (premInp) premInp.placeholder = typeSel.value === 'underlying' ? 'میانگین قیمت' : 'میانگین پرمیوم';
    });

    const searchInp = document.getElementById('rpAddSearch');
    if (searchInp) searchInp.addEventListener('input', () => {
      clearTimeout(window.__rpSearchTimer);
      window.__rpSearchTimer = setTimeout(populateRpSymbols, 200);
    });

    const rpAddOptionSel = document.getElementById('rpAddOption');
    if (rpAddOptionSel) {
      rpAddOptionSel.addEventListener('focus', populateRpSymbols);
      rpAddOptionSel.addEventListener('mousedown', () => { if (!rpAddOptionSel.options.length || rpAddOptionSel.options.length === 1) populateRpSymbols(); });
    }

    if (rpAddOptionSel) rpAddOptionSel.addEventListener('change', e => {
      const type = document.getElementById('rpAddType')?.value || 'option';
      const premInp = document.getElementById('rpAddPremium');
      if (!premInp || !e.target.value) return;
      if (type === 'underlying'){
        const p = getUnderlyingPrice(e.target.value);
        if (p > 0 && !premInp.value) premInp.value = p.toFixed(0);
      } else {
        const opt = state.options.find(o => o.sym === e.target.value);
        if (opt && opt.price > 0 && !premInp.value) premInp.value = opt.price.toFixed(0);
      }
    });

    const groupSel = document.getElementById('rpGroupByStrategy');
    if (groupSel) {
      groupSel.addEventListener('change', (e) => {
        state.rpSelectedStrategy = e.target.value;
        renderReportPanel();
      });
    }

    const pngBtn = document.getElementById('rpExportPngBtn');
    if (pngBtn) pngBtn.addEventListener('click', exportRpImage);
    const pdfBtn = document.getElementById('rpExportPdfBtn');
    if (pdfBtn) pdfBtn.addEventListener('click', exportRpPdf);
    const xlsBtn = document.getElementById('rpExportExcelBtn');
    if (xlsBtn) xlsBtn.addEventListener('click', exportRpExcel);
    const printBtn = document.getElementById('rpPrintBtn');
    if (printBtn) printBtn.addEventListener('click', printRpTableOnly);

    const fileSaveBtn = document.getElementById('rpFileSaveBtn');
    if (fileSaveBtn) fileSaveBtn.addEventListener('click', rpSaveToFile);
    const fileOpenBtn = document.getElementById('rpFileOpenBtn');
    if (fileOpenBtn) fileOpenBtn.addEventListener('click', rpOpenFromFile);
    const upInput = document.getElementById('rpUploadInput');
    if (upInput) upInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) rpProcessLoadedFile(f);
      e.target.value = '';
    });

    const clearBtn = document.getElementById('rpClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (!state.savedPositions.length) return;
      if (!confirm('همه موقعیت‌ها و استراتژی‌ها حذف شوند؟')) return;
      state.savedPositions = [];
      state.strategyNames = [];
      saveSavedPositions(); 
      try { localStorage.setItem('savedStrategyNames', '[]'); } catch(e){}
      renderReportPanel();
    });

    const dateInp = document.getElementById('rpAddDate');
    if (dateInp && !dateInp.value) dateInp.value = new Date().toLocaleDateString('fa-IR');

    rpUpdateFileStatus();
  };
  
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

try { const _rpB = document.getElementById('rpBadge'); if (_rpB) _rpB.textContent = (state.savedPositions || []).length; } catch(e){}
