/* ============================================================
   بخش ۳۱: تست استراتژی (Sandbox)
   ============================================================ */

// تابع اصلاح‌شده برای پر کردن دراپ‌داون تست استراتژی
function populateStSymbols(){
  const type = document.getElementById('stAddType')?.value || 'option';
  const sel = document.getElementById('stAddOption');
  if (!sel) return;
  const search = (document.getElementById('stAddSearch')?.value || '').trim().toLowerCase().replace(/[\u200c\s]/g, '');

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

function renderStrategyTest() {
  const tbl = document.getElementById('stTable');
  const addSel = document.getElementById('stAddOption');
  if (!tbl || !addSel) return;

  if (!state.options || !state.options.length) {
    addSel.innerHTML = '<option value="">— ابتدا داده بازار را دریافت کنید —</option>';
    tbl.innerHTML = '<tbody><tr><td colspan="9" style="text-align:center;padding:36px;color:#64748b">ابتدا از بخش «تحلیل استراتژی» دکمه دریافت داده را بزنید.</td></tr></tbody>';
    return;
  }

  populateStSymbols();

  const thead = `<thead><tr>
    <th>#</th><th>نماد</th><th>جهت</th><th>تعداد</th>
    <th>میانگین قیمت</th><th>قیمت فعلی</th><th>سود/زیان</th><th>درصد</th><th>حذف</th>
  </tr></thead>`;

  let tbody = '<tbody>';
  let totalPnl = 0;
  let totalCost = 0;

  if (!state.stPositions || !state.stPositions.length) {
    tbody += `<tr><td colspan="9" style="text-align:center;padding:30px;color:#64748b">هنوز موقعیتی برای تست اضافه نشده است.</td></tr>`;
  } else {
    state.stPositions.forEach((p, i) => {
      const opt = state.options.find(o => o.sym === p.sym);
      const S = opt ? (opt.price || 0) : getUnderlyingPrice(p.sym);
      const qty = Number(p.qty) || 0;
      const avg = Number(p.avgPremium) || 0;
      const curr = S;
      const pnl = p.direction === 'sell' ? (avg - curr) * qty : (curr - avg) * qty;
      const cost = avg * qty;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
      totalPnl += pnl;
      totalCost += cost;

      const pnlCls = pnl >= 0 ? 'pos' : 'neg';
      tbody += `<tr>
        <td class="num">${i+1}</td>
        <td class="sym-cell">${escapeHtml(p.sym)}</td>
        <td>${p.direction === 'sell' ? 'فروش' : 'خرید'}</td>
        <td class="num">${fmt0(qty)}</td>
        <td class="num">${fmt0(avg)}</td>
        <td class="num">${fmt0(curr)}</td>
        <td class="num ${pnlCls}"><b>${fmt0(pnl)}</b></td>
        <td class="num ${pnlCls}"><b>${pnlPct.toFixed(2)}%</b></td>
        <td><button data-st-remove="${p.id}" style="padding:4px 8px;background:var(--bad-bg);color:var(--bad);border:1px solid var(--bad-line);border-radius:6px;cursor:pointer;font-weight:800">✕</button></td>
      </tr>`;
    });
  }
  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;

  const summaryEl = document.getElementById('stSummary');
  if (summaryEl) {
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    summaryEl.innerHTML = `
      <div class="stat"><div class="k">تعداد موقعیت‌ها</div><div class="v">${state.stPositions.length}</div></div>
      <div class="stat ${totalPnl >= 0 ? 'pos' : 'neg'}"><div class="k">مجموع سود / زیان</div><div class="v ${totalPnl >= 0 ? 'pos' : 'neg'}">${fmt0(totalPnl)}</div></div>
      <div class="stat ${totalPnlPct >= 0 ? 'pos' : 'neg'}"><div class="k">بازدهی کل</div><div class="v ${totalPnlPct >= 0 ? 'pos' : 'neg'}">${totalPnlPct.toFixed(2)}%</div></div>
    `;
  }

  tbl.querySelectorAll('[data-st-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.stPositions = state.stPositions.filter(p => p.id !== btn.dataset.stRemove);
      renderStrategyTest();
    });
  });

  drawStChart();
}

function drawStChart() {
  const canvas = document.getElementById('stChart');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (!state.stPositions || !state.stPositions.length) return;

  const priceCandidates = [];
  state.stPositions.forEach(p => {
    const opt = state.options.find(o => o.sym === p.sym);
    if (opt) {
      priceCandidates.push(opt.price);
      priceCandidates.push(opt.strike);
    } else {
      priceCandidates.push(getUnderlyingPrice(p.sym));
    }
  });
  if (!priceCandidates.length) return;

  const minP = Math.max(1, Math.floor(Math.min(...priceCandidates) * 0.7));
  const maxP = Math.ceil(Math.max(...priceCandidates) * 1.3);
  const N = 200;
  const step = (maxP - minP) / N;
  const points = [];

  for (let i = 0; i <= N; i++) {
    const P = minP + i * step;
    let pnl = 0;
    state.stPositions.forEach(pos => {
      const opt = state.options.find(o => o.sym === pos.sym);
      if (opt) {
        const intrinsic = opt.type === 'call' ? Math.max(0, P - opt.strike) : Math.max(0, opt.strike - P);
        pnl += (pos.direction === 'buy' ? (intrinsic - pos.avgPremium) : (pos.avgPremium - intrinsic)) * pos.qty;
      } else {
        pnl += (pos.direction === 'buy' ? (P - pos.avgPremium) : (pos.avgPremium - P)) * pos.qty;
      }
    });
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
    ctx.fillStyle = C.axis; ctx.font = '12px Vazirmatn, Tahoma'; ctx.textAlign = 'right';
    ctx.fillText(fmt0(val), padL - 8, y + 4);
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
}

function addStPosition() {
  const sym = document.getElementById('stAddOption').value;
  if (!sym) { alert('نماد را انتخاب کنید.'); return; }
  const direction = document.getElementById('stAddDirection').value;
  const qty = Math.max(1, toNum(document.getElementById('stAddQty').value));
  const premium = toNum(document.getElementById('stAddPremium').value);
  if (!(premium > 0)) { alert('قیمت را وارد کنید.'); return; }

  state.stPositions.push({
    id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    sym, direction, qty, avgPremium: premium
  });
  
  renderStrategyTest();
}

(function bindStEvents(){
  const bind = () => {
    const stAddBtn = document.getElementById('stAddBtn');
    if (stAddBtn) stAddBtn.addEventListener('click', addStPosition);
    
    const stTypeSel = document.getElementById('stAddType');
    if (stTypeSel) stTypeSel.addEventListener('change', populateStSymbols);
    
    const stSearchInp = document.getElementById('stAddSearch');
    if (stSearchInp) stSearchInp.addEventListener('input', () => {
      clearTimeout(window.__stSearchTimer);
      window.__stSearchTimer = setTimeout(populateStSymbols, 200);
    });

    const stAddOptionSel = document.getElementById('stAddOption');
    if (stAddOptionSel) {
      stAddOptionSel.addEventListener('focus', populateStSymbols);
      stAddOptionSel.addEventListener('mousedown', () => { if (!stAddOptionSel.options.length || stAddOptionSel.options.length === 1) populateStSymbols(); });
    }
    
    const stClearBtn = document.getElementById('stClearBtn');
    if (stClearBtn) stClearBtn.addEventListener('click', () => {
      if (!state.stPositions || !state.stPositions.length) return;
      if (!confirm('همه موقعیت‌های تست حذف شوند؟')) return;
      state.stPositions = [];
      renderStrategyTest();
    });
    
    const stPrintBtn = document.getElementById('stPrintBtn');
    if (stPrintBtn) stPrintBtn.addEventListener('click', () => {
      window.print();
    });
  };
  
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
