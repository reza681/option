/* ============================================================
   بخش‌های ۱۲-۱۷: محاسبه گزارش، نمودار، گزارش، دکمه‌ها، تغییر اندازه و سایدبار
   ============================================================ */

/* ============================================================
   Chart Tooltip Helpers
   ============================================================ */
var __chartTipEl = null;

function getChartTipEl() {
  if (__chartTipEl && document.body.contains(__chartTipEl)) return __chartTipEl;
  __chartTipEl = document.createElement('div');
  __chartTipEl.id = 'chartHoverTip';
  __chartTipEl.style.cssText = 'position:fixed;z-index:10060;pointer-events:none;' +
    'background:rgba(15,23,42,.96);color:#fff;padding:10px 14px;' +
    'border-radius:10px;font-size:12.5px;font-family:Vazirmatn,Tahoma,sans-serif;' +
    'direction:rtl;line-height:1.9;box-shadow:0 10px 28px -8px rgba(0,0,0,.55);' +
    'display:none;font-variant-numeric:tabular-nums;min-width:170px;' +
    'border:1px solid rgba(255,255,255,.12);';
  document.body.appendChild(__chartTipEl);
  return __chartTipEl;
}

function hideChartTip() {
  if (__chartTipEl) __chartTipEl.style.display = 'none';
}

function showChartTip(clientX, clientY, html) {
  try {
    var tip = getChartTipEl();
    tip.innerHTML = html;
    tip.style.display = 'block';
    var rect = tip.getBoundingClientRect();
    var x = clientX + 14;
    var y = clientY + 14;
    if (x + rect.width > window.innerWidth - 10) x = clientX - rect.width - 14;
    if (y + rect.height > window.innerHeight - 10) y = clientY - rect.height - 14;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  } catch (e) {
    console.warn('showChartTip error:', e);
  }
}

function findNearestRow(rows, price) {
  if (!rows || !rows.length) return null;
  var best = rows[0];
  var bestD = Math.abs(rows[0].P - price);
  for (var i = 1; i < rows.length; i++) {
    var d = Math.abs(rows[i].P - price);
    if (d < bestD) { bestD = d; best = rows[i]; }
  }
  return best;
}

function fmtPctHtml(pct) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return '<span style="opacity:.7">—</span>';
  }
  var color = pct >= 0 ? '#4ade80' : '#f87171';
  var sign = pct >= 0 ? '+' : '';
  return '<b style="color:' + color + '">' + sign + pct.toFixed(2) + '%</b>';
}

/* ==================================================================
   ۱۲) محاسبات گزارش
   ================================================================== */
function computeCollateral(leg, S0, overrideQty){
  if (leg.position !== 'sell') return 0;
  if (leg.kind !== 'call' && leg.kind !== 'put') return 0;
  if (!leg.strike || !S0) return 0;
  const K = leg.strike, P = leg.price;
  const Q = (overrideQty !== undefined && overrideQty !== null) ? overrideQty : leg.qty;
  if (Q <= 0) return 0;
  let base;
  if (leg.kind === 'call') base = 0.2 * S0 * 1000 + Math.min(S0 - K, 0) * 1000;
  else base = 0.2 * S0 * 1000 + Math.min(K - S0, 0) * 1000;
  base = Math.max(1000 * K * 0.1, base);
  return ((base / 10000 + 1) * 10000 + P * 1000) * Q / 1000;
}
function optionCashFlow(leg, S){
  if (leg.position === 'n/a') return 0;
  const K = leg.strike, Q = leg.qty;
  const intrinsic = leg.kind === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
  return leg.position === 'buy' ? intrinsic * Q : -intrinsic * Q;
}
function computeReport(){
  const S0 = toNum($('#underlyingPrice').value);
  const ytm = toNum($('#ytm').value);
  state.underlyingPrice = S0;
  state.ytm = ytm;
  const useCollateral = state.includeCollateral;
  const useFixedIncome = state.includeFixedIncome;

  let priceMin = toNum($priceMinInput.value);
  let priceMax = toNum($priceMaxInput.value);
  if (!priceMin || !priceMax || priceMin >= priceMax){
    const auto = computeAutoRange();
    priceMin = auto.min; priceMax = auto.max;
    $priceMinInput.value = priceMin || ''; $priceMaxInput.value = priceMax || '';
  }
  const N_POINTS = 160;
  const step = Math.max(1, Math.ceil((priceMax - priceMin) / N_POINTS));

  let minDays = Infinity;
  for (const leg of state.legs){
    if (leg.kind !== 'call' && leg.kind !== 'put') continue;
    if (leg.position === 'n/a') continue;
    const rec = state.options.find(o => o.sym === leg.sym);
    if (rec && rec.days > 0) minDays = Math.min(minDays, rec.days);
  }
  if (!isFinite(minDays)) minDays = 0;

  const legsInfo = state.legs.map(leg => {
    const info = { ...leg, price: 0, strike: 0, days: 0, underlying: '', expiryStr: '', rec: null };
    if (leg.kind === 'underlying'){
      const rec = state.market.find(m => m.sym === leg.sym);
      info.underlying = leg.sym;
      info.rec = rec || null;
      info.price = rec ? rec.price : 0;
    } else {
      const rec = state.options.find(o => o.sym === leg.sym);
      if (rec){
        info.price = rec.price; info.strike = rec.strike; info.days = rec.days;
        info.underlying = rec.underlying; info.expiryStr = rec.expiryStr; info.rec = rec;
      }
    }
    return info;
  });

  let I16 = 0;
  legsInfo.forEach(li => {
    if (li.position === 'buy') I16 -= li.price * li.qty;
    if (li.position === 'sell') I16 += li.price * li.qty;
  });

  let remainingCoverage = 0;
  const underlyingLong = legsInfo.find(li => li.kind === 'underlying' && li.position === 'buy');
  if (underlyingLong) remainingCoverage = underlyingLong.qty;

  let Lsum = 0;
  legsInfo.forEach(li => {
    li.coveredQty = 0; li.collateral = 0;
    if (li.kind !== 'call' && li.kind !== 'put') return;
    if (!useCollateral) return;
    let qtyForCol = li.qty;
    if (li.kind === 'call' && li.position === 'sell' && remainingCoverage > 0){
      const covered = Math.min(qtyForCol, remainingCoverage);
      qtyForCol -= covered; remainingCoverage -= covered; li.coveredQty = covered;
    }
    if (qtyForCol > 0){
      li.collateral = computeCollateral(li, S0, qtyForCol);
      Lsum += li.collateral;
    }
  });

  const netCashBase = I16 - Lsum;
  let fixedIncome = 0;
  if (useFixedIncome && minDays > 0) fixedIncome = netCashBase * (ytm * minDays / 365);

  const rows = [];
  const pushRow = (P) => {
    const row = { P, cf: [], holding: 0, totalCF: 0, sumOptionCF: 0 };
    if (legsInfo[0].position === 'buy') row.holding = P * legsInfo[0].qty;
    else if (legsInfo[0].position === 'sell') row.holding = -P * legsInfo[0].qty;
    row.cf.push(row.holding);
    for (let i = 1; i < legsInfo.length; i++){
      const cf = optionCashFlow(legsInfo[i], P);
      row.cf.push(cf); row.sumOptionCF += cf;
    }
    row.totalCF = row.holding + row.sumOptionCF + fixedIncome;
    row.profit = row.totalCF + I16;
    rows.push(row);
  };
  for (let P = priceMin; P <= priceMax; P += step) pushRow(P);
  if (rows.length && rows[rows.length-1].P < priceMax) pushRow(priceMax);

  const breakEvens = [];
  for (let i = 1; i < rows.length; i++){
    const a = rows[i-1], b = rows[i];
    if ((a.profit === 0) || (a.profit < 0 && b.profit > 0) || (a.profit > 0 && b.profit < 0)){
      const t = -a.profit / (b.profit - a.profit);
      const x = a.P + t * (b.P - a.P);
      if (!breakEvens.some(v => Math.abs(v - x) < 1)) breakEvens.push(x);
    }
  }

  let maxProfit = -Infinity, minProfit = Infinity, maxAt = 0, minAt = 0;
  rows.forEach(r => {
    if (r.profit > maxProfit){ maxProfit = r.profit; maxAt = r.P; }
    if (r.profit < minProfit){ minProfit = r.profit; minAt = r.P; }
  });

  state.report = {
    S0, ytm, minDays, fixedIncome, isOpportunityCost: fixedIncome < 0,
    legsInfo, I16, Lsum, rows, breakEvens,
    breakEven: breakEvens.length ? breakEvens[0] : null,
    maxProfit, minProfit, maxAt, minAt, priceMin, priceMax, step,
    includeCollateral: useCollateral,
    includeFixedIncome: useFixedIncome
  };
  return state.report;
}

/* ==================================================================
   ۱۳) نمودار اصلی
   ================================================================== */
function getChartColors(){
  const cs = getComputedStyle(document.documentElement);
  const g = (n, fb) => (cs.getPropertyValue(n) || '').trim() || fb;
  return {
    bg:g('--card','#ffffff'), grid:g('--line','#eef2f7'), axis:g('--muted-2','#94a3b8'),
    text:g('--ink-2','#475569'), zero:g('--muted','#64748b'),
    line:g('--primary','#2563eb'), s0:g('--primary','#2563eb'), strike:g('--warn','#d97706')
  };
}

function mainChartHover(e) {
  try {
    var canvas = e.currentTarget;
    var data = canvas.__chartData;
    if (!data) { hideChartTip(); return; }
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    if (mx < data.padL || mx > data.padL + data.chartW ||
        my < data.padT || my > data.padT + data.chartH) { hideChartTip(); return; }
    var price = data.xMin + (mx - data.padL) / data.chartW * (data.xMax - data.xMin);
    var row = findNearestRow(data.rows, price);
    if (!row) { hideChartTip(); return; }
    var net = data.netInvestment;
    var pct = (net !== 0) ? (row.profit / Math.abs(net)) * 100 : null;
    var color = row.profit >= 0 ? '#4ade80' : '#f87171';
    var pnlSign = row.profit >= 0 ? '+' : '';
    
    // ⬇⬇⬇ محاسبه YTM سالانه ⬇⬇⬇
    var annPct = null;
    if (pct !== null && data.minDays > 0) {
      annPct = annualizePct(pct, data.minDays, getAnnualMode());
    }

    var html = '';
    html += '<div style="font-weight:800;margin-bottom:6px;padding-bottom:5px;border-bottom:1px dashed rgba(255,255,255,.18);font-size:12.5px">';
    html += 'قیمت دارایی پایه: <span style="color:#93c5fd">' + fmt0(row.P) + '</span>';
    html += '</div>';
    
    html += '<div style="display:flex;justify-content:space-between;gap:14px;font-size:12.5px">';
    html += '<span style="opacity:.85">سود / زیان:</span>';
    html += '<b style="color:' + color + '">' + pnlSign + fmt0(row.profit) + '</b>';
    html += '</div>';
    
    html += '<div style="display:flex;justify-content:space-between;gap:14px;font-size:12.5px">';
    html += '<span style="opacity:.85">درصد سود:</span>';
    html += fmtPctHtml(pct);
    html += '</div>';

    // ⬇⬇⬇ نمایش YTM سالانه در تولتیپ ⬇⬇⬇
    if (annPct !== null) {
      html += '<div style="display:flex;justify-content:space-between;gap:14px;font-size:12.5px;margin-top:4px">';
      html += '<span style="opacity:.85">YTM سالانه:</span>';
      html += fmtPctHtml(annPct);
      html += '</div>';
    }

    if (pct !== null) {
      html += '<div style="font-size:10.5px;opacity:.65;margin-top:6px;padding-top:5px;border-top:1px dashed rgba(255,255,255,.12)">';
      html += 'مبنا: خالص سرمایه‌گذاری (' + fmt0(Math.abs(net)) + ')';
      html += '</div>';
    }
    showChartTip(e.clientX, e.clientY, html);
  } catch (err) {
    console.error('[chart hover]', err);
    hideChartTip();
  }
}

function drawChart(rep){
  const canvas = $('#chart');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const dpr = window.devicePixelRatio || 1;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H){
    if (!wrap.__chartRetry) wrap.__chartRetry = 0;
    if (wrap.__chartRetry < 20){ wrap.__chartRetry++; requestAnimationFrame(() => drawChart(rep)); }
    return;
  }
  wrap.__chartRetry = 0;
  hideChartTip();

  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const C = getChartColors();
  const rows = rep.rows;
  if (!rows.length) return;
  const padL = 100, padR = 34, padT = 44, padB = 68;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const profits = rows.map(r => r.profit);
  let yMin = Math.min(...profits, 0), yMax = Math.max(...profits, 0);
  if (yMin === yMax){ yMin = -1; yMax = 1; }
  const padY = (yMax - yMin) * 0.10;
  yMin -= padY; yMax += padY;
  const xMin = rows[0].P, xMax = rows[rows.length-1].P;
  const sx = x => padL + (x - xMin) / (xMax - xMin) * chartW;
  const sy = y => padT + chartH - (y - yMin) / (yMax - yMin) * chartH;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  const nGridY = 7;
  for (let i = 0; i <= nGridY; i++){
    const y = padT + chartH * i / nGridY;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    const val = yMax - (yMax - yMin) * i / nGridY;
    ctx.fillStyle = C.axis; ctx.font = '13px Vazirmatn, Tahoma'; ctx.textAlign = 'right';
    ctx.fillText(fmt0(val), padL - 8, y + 4);
  }
  const nGridX = 10;
  for (let i = 0; i <= nGridX; i++){
    const x = padL + chartW * i / nGridX;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + chartH); ctx.stroke();
    const val = xMin + (xMax - xMin) * i / nGridX;
    ctx.fillStyle = C.axis; ctx.textAlign = 'center';
    ctx.fillText(fmt0(val), x, padT + chartH + 18);
  }
  if (yMin <= 0 && yMax >= 0){
    ctx.strokeStyle = C.zero; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(padL, sy(0)); ctx.lineTo(W - padR, sy(0)); ctx.stroke();
  }
  const buildSegments = (wantPositive) => {
    const segs = []; let current = null;
    for (let i = 0; i < rows.length; i++){
      const r = rows[i];
      const inRange = wantPositive ? r.profit >= 0 : r.profit <= 0;
      if (inRange){
        if (!current){
          current = [];
          if (i > 0){
            const prev = rows[i-1];
            const t = -prev.profit / (r.profit - prev.profit);
            current.push({ x: prev.P + t * (r.P - prev.P), y: 0 });
          } else current.push({ x: r.P, y: 0 });
        }
        current.push({ x: r.P, y: r.profit });
      } else if (current){
        const prev = rows[i-1];
        const t = -prev.profit / (r.profit - prev.profit);
        current.push({ x: prev.P + t * (r.P - prev.P), y: 0 });
        segs.push(current); current = null;
      }
    }
    if (current){ const last = rows[rows.length-1]; current.push({ x: last.P, y: 0 }); segs.push(current); }
    return segs;
  };
  const drawFilledSegments = (segs, fillStyle) => {
    segs.forEach(seg => {
      if (seg.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(sx(seg[0].x), sy(seg[0].y));
      for (let i = 1; i < seg.length; i++) ctx.lineTo(sx(seg[i].x), sy(seg[i].y));
      ctx.closePath(); ctx.fillStyle = fillStyle; ctx.fill();
    });
  };
  drawFilledSegments(buildSegments(true), 'rgba(21,128,61,0.14)');
  drawFilledSegments(buildSegments(false), 'rgba(185,28,28,0.14)');
  if (xMin <= rep.S0 && xMax >= rep.S0){
    ctx.strokeStyle = C.axis; ctx.setLineDash([5,4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx(rep.S0), padT); ctx.lineTo(sx(rep.S0), padT + chartH); ctx.stroke();
    ctx.setLineDash([]);
    const label = 'S₀ = ' + fmt0(rep.S0);
    ctx.font = 'bold 13.5px Vazirmatn, Tahoma';
    const tw = ctx.measureText(label).width;
    const lx = sx(rep.S0), ly = padT - 10;
    ctx.fillStyle = C.bg; ctx.fillRect(lx - tw/2 - 5, ly - 12, tw + 10, 16);
    ctx.strokeStyle = C.s0; ctx.strokeRect(lx - tw/2 - 5, ly - 12, tw + 10, 16);
    ctx.fillStyle = C.s0; ctx.textAlign = 'center'; ctx.fillText(label, lx, ly);
  }
  const strikeSet = new Set();
  rep.legsInfo.forEach(li => {
    if ((li.kind === 'call' || li.kind === 'put') && li.position !== 'n/a' && li.strike > 0) strikeSet.add(li.strike);
  });
  strikeSet.forEach(K => {
    if (K < xMin || K > xMax) return;
    const x = sx(K);
    ctx.strokeStyle = 'rgba(217,119,6,0.40)'; ctx.setLineDash([3,4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + chartH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 12.5px Vazirmatn, Tahoma';
    const label = 'K=' + fmt0(K);
    const tw = ctx.measureText(label).width;
    const ly = padT + chartH - 4;
    ctx.fillStyle = C.bg; ctx.fillRect(x - tw/2 - 3, ly - 10, tw + 6, 13);
    ctx.strokeStyle = C.strike; ctx.strokeRect(x - tw/2 - 3, ly - 10, tw + 6, 13);
    ctx.fillStyle = C.strike; ctx.textAlign = 'center'; ctx.fillText(label, x, ly);
  });
  ctx.strokeStyle = C.line; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  rows.forEach((r, i) => {
    const x = sx(r.P), y = sy(r.profit);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  rep.breakEvens.forEach(be => {
    if (be < xMin || be > xMax) return;
    const x = sx(be), y = sy(0);
    ctx.fillStyle = C.bg; ctx.strokeStyle = C.strike; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fillStyle = C.strike; ctx.fill();
  });
  const markExtreme = (x, y, color, label) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(sx(x), sy(y), 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.beginPath(); ctx.arc(sx(x), sy(y), 2, 0, Math.PI*2); ctx.fill();
    ctx.font = 'bold 13.5px Vazirmatn, Tahoma';
    const tw = ctx.measureText(label).width;
    let lx = sx(x), ly = sy(y) - 12;
    if (lx + tw/2 > W - padR) lx = W - padR - tw/2;
    if (lx - tw/2 < padL) lx = padL + tw/2;
    if (ly < padT + 4) ly = sy(y) + 18;
    ctx.fillStyle = C.bg; ctx.fillRect(lx - tw/2 - 4, ly - 11, tw + 8, 15);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.strokeRect(lx - tw/2 - 4, ly - 11, tw + 8, 15);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(label, lx, ly);
  };
  markExtreme(rep.maxAt, rep.maxProfit, '#15803d', 'حداکثر ' + fmt0(rep.maxProfit));
  markExtreme(rep.minAt, rep.minProfit, '#b91c1c', 'حداقل ' + fmt0(rep.minProfit));
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + chartH); ctx.lineTo(W - padR, padT + chartH); ctx.stroke();
  ctx.fillStyle = C.text; ctx.font = 'bold 13.5px Vazirmatn, Tahoma';
  ctx.save(); ctx.translate(16, padT + chartH / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.fillText('سود / زیان', 0, 0); ctx.restore();
  ctx.textAlign = 'center';
  ctx.fillText('قیمت دارایی پایه در سررسید', padL + chartW / 2, H - 10);
  const legendY = padT - 10;
  let legendX = W - padR - 10;
  const drawLegend = (text, color) => {
    ctx.font = '13px Vazirmatn, Tahoma';
    const tw = ctx.measureText(text).width;
    const boxW = tw + 24;
    legendX -= boxW;
    ctx.fillStyle = color; ctx.fillRect(legendX, legendY - 8, 12, 10);
    ctx.fillStyle = C.text; ctx.textAlign = 'left';
    ctx.fillText(text, legendX + 16, legendY);
    legendX -= 12;
  };
  drawLegend('سود', 'rgba(21,128,61,0.55)');
  drawLegend('زیان', 'rgba(185,28,28,0.55)');

  /* ---- HOVER BINDING ---- */
  canvas.__chartData = {
    rows: rep.rows,
    xMin: xMin, xMax: xMax,
    padL: padL, padT: padT, padR: padR,
    chartW: chartW, chartH: chartH,
    W: W, H: H,
    netInvestment: -rep.I16,
    minDays: rep.minDays // ⬅️ پاس دادن کوتاه‌ترین سررسید به داده‌های هاور
  };
  canvas.onmousemove = mainChartHover;
  canvas.onmouseleave = function() { hideChartTip(); };
  canvas.style.cursor = 'crosshair';
}

/* ==================================================================
   ۱۴) گزارش
   ================================================================== */
function renderReport(rep){
  const s = $('#summary');
  const beText = rep.breakEvens.length ? rep.breakEvens.map(v => fmt0(v)).join(' ، ') : '—';
  const collateralBox = rep.includeCollateral
    ? `<div class="stat"><div class="k">جمع وثایق</div><div class="v">${fmt0(rep.Lsum)}</div></div>`
    : `<div class="stat off"><div class="k">جمع وثایق</div><div class="v off">غیرفعال</div></div>`;
    
  const incomeCard = rep.includeFixedIncome === false
    ? `<div class="stat off"><div class="k">درآمد ثابت / هزینه فرصت</div><div class="v off">غیرفعال</div></div>`
    : (rep.fixedIncome >= 0
        ? `<div class="stat pos"><div class="k">درآمد ثابت</div><div class="v pos">${fmt0(rep.fixedIncome)}</div></div>`
        : `<div class="stat neg"><div class="k">هزینه فرصت</div><div class="v neg">${fmt0(Math.abs(rep.fixedIncome))}</div></div>`);

  s.innerHTML = `
    <div class="stat"><div class="k">قیمت دارایی پایه</div><div class="v">${fmt0(rep.S0)}</div></div>
    <div class="stat"><div class="k">نرخ سود بدون ریسک (YTM)</div><div class="v">${(rep.ytm * 100).toFixed(2)}%</div></div>
    <div class="stat ${-rep.I16 >= 0 ? 'pos' : 'neg'}"><div class="k">خالص سرمایه‌گذاری</div>
      <div class="v ${-rep.I16 >= 0 ? 'pos' : 'neg'}">${fmt0(-rep.I16)}</div></div>
    ${collateralBox}
    ${incomeCard}
    <div class="stat pos"><div class="k">حداکثر سود</div><div class="v pos">${fmt0(rep.maxProfit)}</div></div>
    <div class="stat neg"><div class="k">حداکثر زیان</div><div class="v neg">${fmt0(rep.minProfit)}</div></div>
    <div class="stat"><div class="k">نقاط سربه‌سر</div><div class="v" style="font-size:13.5px">${beText}</div></div>
    <div class="stat"><div class="k">کوتاه‌ترین سررسید</div><div class="v">${rep.minDays}<small>روز</small></div></div>`;

  const tbl = $('#reportTable');
  const legs = rep.legsInfo;
  let th1 = `<th>قیمت در سررسید</th><th>سود دارایی پایه</th>`;
  const optionLegs = legs.slice(1).filter(l => l.kind === 'call' || l.kind === 'put');
  optionLegs.forEach(li => {
    const pos = li.position === 'buy' ? 'خرید' : (li.position === 'sell' ? 'فروش' : '—');
    th1 += `<th class="grp">${li.label}<br><span style="font-weight:500;opacity:.8">${pos}</span></th>`;
  });
  th1 += `<th class="grp">جمع جریان نقد</th><th class="grp">سود / زیان</th>`;
  let th2 = `<th>—</th><th>—</th>`;
  optionLegs.forEach(() => { th2 += `<th>جریان نقد</th>`; });
  th2 += `<th>با درآمد ثابت</th><th>در سررسید</th>`;
  const thead = `<thead><tr>${th1}</tr><tr>${th2}</tr></thead>`;
  let tbody = '<tbody>';
  rep.rows.forEach(r => {
    let tds = `<td class="price">${fmt0(r.P)}</td><td>${fmt0(r.holding)}</td>`;
    for (let i = 1; i < legs.length; i++){
      if (legs[i].kind !== 'call' && legs[i].kind !== 'put') continue;
      tds += `<td>${fmt0(r.cf[i])}</td>`;
    }
    tds += `<td>${fmt0(r.totalCF)}</td>`;
    const cls = r.profit >= 0 ? 'pos' : 'neg';
    tds += `<td class="pl ${cls}">${fmt0(r.profit)}</td>`;
    tbody += `<tr>${tds}</tr>`;
  });
  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;
  requestAnimationFrame(() => drawChart(rep));
}

/* ==================================================================
   ۱۵) دکمه‌ها
   ================================================================== */
$('#calcBtn').onclick = () => {
  const hasPosition = state.legs.some(l => l.position !== 'n/a');
  if (!hasPosition){ alert('حداقل یک موقعیت (خرید یا فروش) را مشخص کنید.'); return; }
  try {
    $('#card-report').classList.remove('hidden');
    const rep = computeReport();
    requestAnimationFrame(() => {
      try { renderReport(rep); $('#card-report').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      catch(err){ console.error(err); alert('خطا در رسم گزارش: ' + err.message); }
    });
  } catch (err){ console.error(err); alert('خطا در محاسبه: ' + err.message); }
};
$('#resetBtn').onclick = () => {
  state.legs.forEach((leg, i) => { leg.position = 'n/a'; leg.qty = 1; if (i > 0) leg.sym = ''; });
  renderLegs(); maybeResetAutoRange();
  $('#card-report').classList.add('hidden');
};
$('#exportBtn').onclick = () => {
  if (!state.report){ alert('ابتدا گزارش را محاسبه کنید.'); return; }
  const rep = state.report;
  const legs = rep.legsInfo;
  const aoa = [];
  const h1 = ['قیمت در سررسید', 'سود دارایی پایه'];
  const h2 = ['', ''];
  for (let i = 1; i < legs.length; i++){
    if (legs[i].kind !== 'call' && legs[i].kind !== 'put') continue;
    const pos = legs[i].position === 'buy' ? 'خرید' : (legs[i].position === 'sell' ? 'فروش' : '—');
    h1.push(`${legs[i].label} (${pos})`, '');
    h2.push('جریان نقد', '');
  }
  h1.push('جمع جریان نقد', 'سود / زیان');
  h2.push('', '');
  aoa.push(h1); aoa.push(h2);
  rep.rows.forEach(r => {
    const row = [r.P, r.holding];
    for (let i = 1; i < legs.length; i++){
      if (legs[i].kind !== 'call' && legs[i].kind !== 'put') continue;
      row.push(r.cf[i]);
    }
    row.push(r.totalCF, r.profit);
    aoa.push(row);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, 'option_strategy_report.xlsx');
};

/* ==================================================================
   ۱۶) resize
   ================================================================== */
let resizeTimer = null;
window.addEventListener('resize', () => {
  closeCalcPopover();
  hideChartTip();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.report && !$('[data-panel="main"]').classList.contains('hidden')) drawChart(state.report);
    if (!$('[data-panel="marketmap"]').classList.contains('hidden')){ __mmRetry = 0; renderMarketMap(); }
    if (!$('[data-panel="report"]').classList.contains('hidden') && __rpLastRows) {
      try { drawRpChart(__rpLastRows); } catch(e){}
    }
    if (!$('[data-panel="strategytest"]').classList.contains('hidden') && state.stPositions.length) {
      try { drawStChart(); } catch(e){}
    }
  }, 150);
});

/* ==================================================================
   ۱۷) سایدبار
   ================================================================== */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    closeCalcPopover();
    hideChartTip();
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('[data-panel]').forEach(p => { p.classList.toggle('hidden', p.dataset.panel !== view); });
    if (view === 'watchlist') renderWatchlist();
    if (view === 'coveredcall') renderCoveredCall();
    if (view === 'marketmap'){ __mmRetry = 0; setTimeout(renderMarketMap, 0); }
    if (view === 'main' && state.report) setTimeout(() => drawChart(state.report), 60);
    if (view === 'report') renderReportPanel();
    if (view === 'calculations') renderCalculations();
    if (view === 'strategytest') renderStrategyTest();
    if (view === 'tilltomorrow' && document.getElementById('ttAnalyzeBtn')) {
        document.getElementById('ttAnalyzeBtn').click();
    }
  });
});