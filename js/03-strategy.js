/* ============================================================
   بخش‌های ۸-۱۱: وثیقه، بازه قیمت، رابط استراتژی و رندر پوزیشن‌ها
   ============================================================ */
/* ==================================================================
   ۸) گزینه وثایق و درآمد ثابت
   ================================================================== */
const $collateralToggle = $('#includeCollateral');
const $collateralState  = $('#collateralState');
const $fixedIncomeToggle = $('#includeFixedIncome');
const $fixedIncomeState  = $('#fixedIncomeState');

function syncCollateralToggleUI(){
  if ($collateralState) $collateralState.textContent = state.includeCollateral ? 'فعال' : 'غیرفعال';
}
function syncFixedIncomeToggleUI(){
  if ($fixedIncomeState) $fixedIncomeState.textContent = state.includeFixedIncome ? 'فعال' : 'غیرفعال';
}

if ($collateralToggle) {
  $collateralToggle.addEventListener('change', () => {
    state.includeCollateral = $collateralToggle.checked;
    syncCollateralToggleUI();
    if (state.report && !$('#card-report').classList.contains('hidden')){
      try { const rep = computeReport(); renderReport(rep); } catch(err){ console.warn(err); }
    }
  });
}

if ($fixedIncomeToggle) {
  $fixedIncomeToggle.addEventListener('change', () => {
    state.includeFixedIncome = $fixedIncomeToggle.checked;
    syncFixedIncomeToggleUI();
    if (state.report && !$('#card-report').classList.contains('hidden')){
      try { const rep = computeReport(); renderReport(rep); } catch(err){ console.warn(err); }
    }
  });
}

/* ==================================================================
   ۹) دامنه قیمت
   ================================================================== */
const $priceMinInput = $('#priceMinInput');
const $priceMaxInput = $('#priceMaxInput');
const $rangeRow      = $('#rangeRow');
function computeAutoRange(){
  const S0 = toNum($('#underlyingPrice').value) || state.underlyingPrice || 0;
  if (!S0) return { min: 0, max: 0 };
  const activeStrikes = [];
  for (const leg of state.legs){
    if (!leg || leg.position === 'n/a') continue;
    if (leg.kind === 'call' || leg.kind === 'put'){
      const rec = state.options.find(o => o.sym === leg.sym);
      if (rec && rec.strike > 0) activeStrikes.push(rec.strike);
    }
  }
  let minVal = S0 * 0.40, maxVal = S0 * 2.20;
  if (activeStrikes.length){
    const minK = Math.min(...activeStrikes), maxK = Math.max(...activeStrikes);
    minVal = Math.min(minVal, minK * 0.65);
    maxVal = Math.max(maxVal, maxK * 1.35);
  }
  return { min: Math.max(1, Math.floor(minVal)), max: Math.ceil(maxVal) };
}
function resetAutoRange(){
  const { min, max } = computeAutoRange();
  $priceMinInput.value = min || '';
  $priceMaxInput.value = max || '';
}
function maybeResetAutoRange(){ if (!state.rangeManual) resetAutoRange(); }
function syncRangeManualUI(){ if ($rangeRow) $rangeRow.classList.toggle('manual', state.rangeManual); }
$('#autoRangeBtn').addEventListener('click', () => {
  state.rangeManual = false; syncRangeManualUI(); resetAutoRange();
  if (state.report && !$('#card-report').classList.contains('hidden')){
    try { const rep = computeReport(); renderReport(rep); } catch(err){ console.warn(err); }
  }
});
let rangeChangeTimer = null;
[$priceMinInput, $priceMaxInput].forEach(inp => {
  inp.addEventListener('input', () => {
    if (!$priceMinInput.value && !$priceMaxInput.value) state.rangeManual = false;
    else state.rangeManual = true;
    syncRangeManualUI();
    clearTimeout(rangeChangeTimer);
    rangeChangeTimer = setTimeout(() => {
      if (state.report && !$('#card-report').classList.contains('hidden')){
        try { const rep = computeReport(); renderReport(rep); } catch(err){ console.warn(err); }
      }
    }, 350);
  });
});

/* ==================================================================
   ۱۰) استراتژی UI
   ================================================================== */
function initStrategyUI(imported, preservedLegs){
  const uSel = $('#underlyingSym');
  uSel.innerHTML = '';
  for (const u of state.underlyingsWithOptions){
    const o = document.createElement('option');
    o.value = u.sym;
    o.textContent = `${u.sym}  (${u.calls.length} Call / ${u.puts.length} Put)`;
    uSel.appendChild(o);
  }
  let defaultUnderlying = null;
  if (preservedLegs && preservedLegs[0] && preservedLegs[0].sym){
    if (state.underlyingsWithOptions.some(u => u.sym === preservedLegs[0].sym)) defaultUnderlying = preservedLegs[0].sym;
  }
  if (!defaultUnderlying) defaultUnderlying = state.underlyingsWithOptions[0]?.sym || '';
  if (defaultUnderlying) uSel.value = defaultUnderlying;

  $('#ytm').value = state.ytm;
  $('#todayVal').value = new Date().toLocaleDateString('fa-IR');
  if ($collateralToggle) $collateralToggle.checked = state.includeCollateral;
  if ($fixedIncomeToggle) $fixedIncomeToggle.checked = state.includeFixedIncome;
  syncCollateralToggleUI();
  syncFixedIncomeToggleUI();
  syncRangeManualUI();

  state.legs = [
    { kind:'underlying', label:'دارایی',   cls:'',     position:'n/a', qty:1, sym: defaultUnderlying },
    { kind:'call', label:'Call ۱', cls:'call', position:'n/a', qty:1, sym:'' },
    { kind:'call', label:'Call ۲', cls:'call', position:'n/a', qty:1, sym:'' },
    { kind:'call', label:'Call ۳', cls:'call', position:'n/a', qty:1, sym:'' },
    { kind:'call', label:'Call ۴', cls:'call', position:'n/a', qty:1, sym:'' },
    { kind:'put',  label:'Put ۱',  cls:'put',  position:'n/a', qty:1, sym:'' },
    { kind:'put',  label:'Put ۲',  cls:'put',  position:'n/a', qty:1, sym:'' }
  ];
  if (preservedLegs){
    preservedLegs.forEach((p, i) => {
      if (!state.legs[i]) return;
      state.legs[i].position = p.position || 'n/a';
      state.legs[i].qty = p.qty || 1;
      if (i > 0){
        const rec = state.options.find(o => o.sym === p.sym);
        if (rec && rec.underlying === defaultUnderlying) state.legs[i].sym = p.sym;
      }
    });
  }
  uSel.onchange = () => {
    state.legs[0].sym = uSel.value;
    for (let i = 1; i < state.legs.length; i++){
      const rec = state.options.find(o => o.sym === state.legs[i].sym);
      if (!rec || rec.underlying !== uSel.value) state.legs[i].sym = '';
    }
    updateUnderlyingPrice(); renderLegs(); maybeResetAutoRange();
  };
  $('#underlyingPrice').oninput = e => { state.underlyingPrice = toNum(e.target.value); maybeResetAutoRange(); };
  $('#ytm').oninput = e => { state.ytm = toNum(e.target.value); };

  renderLegs(); updateUnderlyingPrice(); maybeResetAutoRange();
}
function updateUnderlyingPrice(){
  const sym = state.legs[0]?.sym;
  const rec = state.market.find(m => m.sym === sym);
  const p = rec ? (rec.price || rec.close || rec.last) : 0;
  state.underlyingPrice = p;
  $('#underlyingPrice').value = p || '';
}

/* ==================================================================
   ۱۱) رندر موقعیت‌ها
   ================================================================== */
function renderLegs(){
  const wrap = $('#legs');
  wrap.innerHTML = '';
  const headCols = ['نوع', 'نماد', 'موقعیت', 'تعداد', 'اطلاعات'];
  headCols.forEach((h, i) => {
    const d = document.createElement('div');
    d.className = 'head' + (i === 4 ? ' col-meta' : '');
    d.textContent = h;
    wrap.appendChild(d);
  });
  const underlyingSym = state.legs[0].sym;
  state.legs.forEach((leg, idx) => {
    const tag = document.createElement('div');
    tag.className = 'row-cell tag ' + (leg.kind === 'call' ? 'call' : (leg.kind === 'put' ? 'put' : ''));
    tag.textContent = leg.label;
    wrap.appendChild(tag);

    const symCell = document.createElement('div');
    symCell.className = 'row-cell';
    let optionsHtml = '';
    if (leg.kind === 'underlying'){
      optionsHtml = state.underlyingsWithOptions.map(u =>
        `<option value="${u.sym}" ${u.sym === leg.sym ? 'selected' : ''}>${u.sym} — ${u.calls.length + u.puts.length} اختیار</option>`
      ).join('');
    } else {
      const opts = state.options.filter(o => o.type === leg.kind && o.underlying === underlyingSym);
      if (!opts.length) optionsHtml = `<option value="">— اختیاری موجود نیست —</option>`;
      else {
        const groups = {};
        for (const o of opts) (groups[o.expiryStr] = groups[o.expiryStr] || []).push(o);
        const keys = Object.keys(groups).sort((a, b) => expiryKey(a) - expiryKey(b));
        optionsHtml = `<option value="">— انتخاب اختیار —</option>`;
        for (const k of keys){
          optionsHtml += `<optgroup label="سررسید ${k}">`;
          for (const o of groups[k].sort((a,b) => a.strike - b.strike)){
            const sel = o.sym === leg.sym ? 'selected' : '';
            optionsHtml += `<option value="${o.sym}" ${sel}>${o.sym} | K=${fmt0(o.strike)} | P=${fmt0(o.price)} | \u2066${o.days} روز\u2069</option>`;
          }
          optionsHtml += `</optgroup>`;
        }
      }
    }
    const sel = document.createElement('select');
    sel.dataset.role = 'sym'; sel.dataset.idx = idx;
    sel.innerHTML = optionsHtml;
    symCell.appendChild(sel);
    wrap.appendChild(symCell);

    const posCell = document.createElement('div');
    posCell.className = 'row-cell';
    const posSel = document.createElement('select');
    posSel.dataset.role = 'pos'; posSel.dataset.idx = idx;
    posSel.innerHTML = `
      <option value="n/a"  ${leg.position==='n/a'?'selected':''}>—</option>
      <option value="buy"  ${leg.position==='buy'?'selected':''}>خرید</option>
      <option value="sell" ${leg.position==='sell'?'selected':''}>فروش</option>`;
    posCell.appendChild(posSel);
    wrap.appendChild(posCell);

    const qtyCell = document.createElement('div');
    qtyCell.className = 'row-cell';
    const qtyInp = document.createElement('input');
    qtyInp.type = 'number'; qtyInp.min = '0'; qtyInp.step = '1';
    qtyInp.className = 'qty'; qtyInp.value = leg.qty;
    qtyInp.dataset.role = 'qty'; qtyInp.dataset.idx = idx;
    qtyCell.appendChild(qtyInp);
    wrap.appendChild(qtyCell);

    const metaCell = document.createElement('div');
    metaCell.className = 'row-cell meta col-meta';
    metaCell.dataset.meta = idx;
    wrap.appendChild(metaCell);
  });

  wrap.querySelectorAll('select[data-role="sym"]').forEach(sel => {
    sel.onchange = e => {
      const i = +e.target.dataset.idx;
      state.legs[i].sym = e.target.value;
      if (i === 0){
        state.legs[0].sym = e.target.value;
        for (let j = 1; j < state.legs.length; j++){
          const rec = state.options.find(o => o.sym === state.legs[j].sym);
          if (!rec || rec.underlying !== e.target.value) state.legs[j].sym = '';
        }
        updateUnderlyingPrice(); renderLegs(); maybeResetAutoRange(); return;
      }
      updateLegMeta(); maybeResetAutoRange();
    };
  });
  wrap.querySelectorAll('select[data-role="pos"]').forEach(sel => {
    sel.onchange = e => { state.legs[+e.target.dataset.idx].position = e.target.value; updateLegMeta(); maybeResetAutoRange(); };
  });
  wrap.querySelectorAll('input[data-role="qty"]').forEach(inp => {
    inp.oninput = e => { state.legs[+e.target.dataset.idx].qty = toNum(e.target.value); updateLegMeta(); };
  });
  updateLegMeta();
}
function updateLegMeta(){
  state.legs.forEach((leg, idx) => {
    const el = document.querySelector(`[data-meta="${idx}"]`);
    if (!el) return;
    if (leg.kind === 'underlying'){
      const rec = state.market.find(m => m.sym === leg.sym);
      el.textContent = rec ? `قیمت: ${fmt0(rec.price)}` : '';
      return;
    }
    const rec = state.options.find(o => o.sym === leg.sym);
    if (!rec){ el.textContent = ''; return; }
    el.textContent = `K=${fmt0(rec.strike)} | P=${fmt0(rec.price)} | ${rec.expiryStr} | ${rec.days} روز`;
  });
  const n = state.legs.filter(l => l.position !== 'n/a').length;
  const u = state.legs[0]?.sym || '';
  const counts = state.underlyingsWithOptions.find(x => x.sym === u);
  $('#strategyHint').textContent = counts ? `${counts.calls.length} Call / ${counts.puts.length} Put برای ${u} — ${n} موقعیت فعال` : '';
}
