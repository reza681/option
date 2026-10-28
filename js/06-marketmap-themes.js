/* ============================================================
   بخش‌های ۲۴-۲۵: نقشه بازار و پوسته‌ها
   منبع: option-ver16.html خطوط 2837-2999
   ============================================================ */
/* ==================================================================
   ۲۴) نقشه بازار
   ================================================================== */
let __mmRetry = 0;
function renderMarketMap(){
  const wrap = $('#marketmapWrap');
  const status = $('#mmStatus');
  const hint = $('#mmHint');
  if (!state.options || !state.options.length){
    __mmRetry = 0;
    wrap.innerHTML = `<div class="mm-empty">هنوز داده‌ای دریافت نشده است.</div>`;
    hint.textContent = '';
    status.innerHTML = '<span class="dot wait"></span>در انتظار داده';
    return;
  }
  const rect = wrap.getBoundingClientRect();
  const W = Math.floor(rect.width), H = Math.floor(rect.height);
  if (W < 40 || H < 40){
    if (__mmRetry < 20){ __mmRetry++; requestAnimationFrame(() => renderMarketMap()); }
    return;
  }
  __mmRetry = 0;
  const q = ($('#mmSearch').value || '').trim().toLowerCase();
  const fType = $('#mmFilterType').value;
  const fDir = $('#mmFilterDir').value;
  const sizeBy = $('#mmSizeBy').value;
  let items = state.options.map(o => ({
    opt: o, sym: o.sym, name: o.name, underlying: o.underlying, type: o.type,
    price: o.price, changePct: computeChangePct(o),
    tval: Number(o.tval) || 0, tvol: Number(o.tvol) || 0, tno: Number(o.tno) || 0
  }));
  if (fType) items = items.filter(r => r.type === fType);
  if (fDir === 'up') items = items.filter(r => r.changePct > 0);
  if (fDir === 'down') items = items.filter(r => r.changePct < 0);
  if (q) items = items.filter(r => (r.sym + ' ' + r.name + ' ' + r.underlying).toLowerCase().includes(q));
  if (!items.length){
    wrap.innerHTML = `<div class="mm-empty">نتیجه‌ای یافت نشد. (کل اختیارها: ${state.options.length})</div>`;
    hint.textContent = '';
    status.innerHTML = '<span class="dot wait"></span>بدون نتیجه';
    return;
  }
  const metricOrder = [sizeBy, 'tvol', 'tno'];
  let effectiveSizeBy = sizeBy, usingMetric = null;
  for (const m of metricOrder){
    if (items.some(r => Number(r[m]) > 0)){ effectiveSizeBy = m; usingMetric = m; break; }
  }
  let fallbackUsed = false;
  if (!usingMetric){ fallbackUsed = true; items.forEach(r => { r.value = 1; }); }
  else { items.forEach(r => { r.value = Number(r[effectiveSizeBy]) || 0; }); items = items.filter(r => r.value > 0); }
  if (!items.length){
    wrap.innerHTML = `<div class="mm-empty">هیچ نمادی با مقدار معتبر یافت نشد.</div>`;
    hint.textContent = '';
    status.innerHTML = '<span class="dot wait"></span>بدون مقدار';
    return;
  }
  const layout = squarify(items.map(it => ({ value: it.value, data: it })), 0, 0, W, H);
  wrap.innerHTML = '';
  const frag = document.createDocumentFragment();
  layout.forEach(({item, x, y, w, h}) => {
    if (w < 1 || h < 1) return;
    const r = item.data;
    const box = document.createElement('div');
    box.className = 'mm-box';
    box.style.left = x + 'px'; box.style.top = y + 'px';
    box.style.width = Math.max(1, w - 1) + 'px';
    box.style.height = Math.max(1, h - 1) + 'px';
    box.style.background = changeColor(r.changePct).bg;
    const showSym = w > 42 && h > 22;
    const showPct = w > 52 && h > 38;
    const showUnder = w > 78 && h > 58;
    const showVal = w > 100 && h > 78;
    let html = '';
    if (showSym) html += `<div class="mm-sym">${r.sym}</div>`;
    if (showPct) html += `<div class="mm-pct">${(r.changePct >= 0 ? '+' : '') + r.changePct.toFixed(2)}%</div>`;
    if (showUnder) html += `<div class="mm-sub">${r.underlying} · ${r.type === 'call' ? 'Call' : 'Put'}</div>`;
    if (showVal && !fallbackUsed){
      const lbl = effectiveSizeBy === 'tval' ? 'ارزش' : effectiveSizeBy === 'tvol' ? 'حجم' : 'تعداد';
      html += `<div class="mm-sub">${lbl}: ${fmt0(r[effectiveSizeBy])}</div>`;
    }
    box.innerHTML = html;
    box.title = `${r.sym}\n${r.name}\nدارایی پایه: ${r.underlying}\nنوع: ${r.type === 'call' ? 'Call' : 'Put'}\nآخرین قیمت: ${fmt0(r.price)}\nتغییر: ${(r.changePct >= 0 ? '+' : '') + r.changePct.toFixed(2)}%\nحجم معاملات: ${fmt0(r.tvol)}\nتعداد معاملات: ${fmt0(r.tno)}`;
    frag.appendChild(box);
  });
  wrap.appendChild(frag);
  const totalValue = items.reduce((s, i) => s + i.value, 0);
  const vals = items.map(i => i.value);
  const vMin = Math.min(...vals), vMax = Math.max(...vals);
  const sizeLabel = effectiveSizeBy === 'tval' ? 'ارزش' : effectiveSizeBy === 'tvol' ? 'حجم' : 'تعداد';
  if (fallbackUsed){
    hint.textContent = `${items.length} نماد | ⚠ هیچ داده معاملاتی موجود نیست — وزن یکسان`;
    status.innerHTML = '<span class="dot wait"></span>بدون داده معاملاتی';
  } else {
    const altNote = (effectiveSizeBy !== sizeBy) ? ` (جایگزین: ${sizeLabel})` : '';
    hint.textContent = `${items.length} از ${state.options.length} نماد | مجموع ${sizeLabel}: ${fmt0(totalValue)} | کمینه: ${fmt0(vMin)} | بیشینه: ${fmt0(vMax)}${altNote}`;
    status.innerHTML = `<span class="dot ok"></span>${items.length} نماد`;
  }
}
['#mmSearch','#mmFilterType','#mmFilterDir','#mmSizeBy'].forEach(sel => {
  const el = document.querySelector(sel); if (!el) return;
  const ev = el.tagName === 'INPUT' ? 'input' : 'change';
  el.addEventListener(ev, () => { clearTimeout(window.__mmTimer); window.__mmTimer = setTimeout(() => { __mmRetry = 0; renderMarketMap(); }, 200); });
});

/* ==================================================================
   ۲۵) پوسته
   ================================================================== */
const THEMES = [
  { id:'blue',    name:'آبی اقیانوس',   grad:['#1e3a8a','#2563eb'], dots:['#2563eb','#7c3aed','#0f172a'] },
  { id:'emerald', name:'زمرد',          grad:['#064e3b','#10b981'], dots:['#059669','#0ea5e9','#04231c'] },
  { id:'violet',  name:'بنفش سلطنتی',   grad:['#3b0764','#8b5cf6'], dots:['#7c3aed','#ec4899','#1a1035'] },
  { id:'sunset',  name:'غروب',          grad:['#7c2d12','#f97316'], dots:['#ea580c','#eab308','#1c1210'] },
  { id:'rose',    name:'یاقوت',         grad:['#4c0519','#f43f5e'], dots:['#e11d48','#8b5cf6','#1f0a12'] },
  { id:'cyan',    name:'فیروزه',        grad:['#083344','#06b6d4'], dots:['#0891b2','#6366f1','#062a35'] },
  { id:'dark',    name:'شبانه',         grad:['#0b1220','#1e293b'], dots:['#3b82f6','#8b5cf6','#020617'] }
];
const $themeGrid = $('#themeGrid');
const $themeHint = $('#themeHint');
function currentThemeId(){
  const t = document.documentElement.getAttribute('data-theme');
  return THEMES.some(x => x.id === t) ? t : 'blue';
}
function renderThemeGrid(){
  const active = currentThemeId();
  state.theme = active;
  $themeGrid.innerHTML = '';
  THEMES.forEach(t => {
    const card = document.createElement('div');
    card.className = 'theme-card' + (t.id === active ? ' active' : '');
    card.dataset.theme = t.id;
    card.innerHTML = `
      <div class="tc-preview" style="background:linear-gradient(135deg, ${t.grad[0]}, ${t.grad[1]})">${t.name}</div>
      <div class="tc-name"><span>${t.name}</span><span class="tc-check">✓</span></div>
      <div class="tc-swatches"><span style="background:${t.dots[0]}"></span><span style="background:${t.dots[1]}"></span><span style="background:${t.dots[2]}"></span></div>`;
    card.addEventListener('click', () => applyTheme(t.id));
    $themeGrid.appendChild(card);
  });
  const cur = THEMES.find(x => x.id === active);
  $themeHint.textContent = cur ? ('پوسته فعلی: ' + cur.name) : '';
}
function applyTheme(id){
  const theme = THEMES.find(t => t.id === id) || THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);
  try { localStorage.setItem('appTheme', theme.id); } catch(e){}
  state.theme = theme.id;
  renderThemeGrid();
  if (state.report && !$('[data-panel="main"]').classList.contains('hidden')) setTimeout(() => { try { drawChart(state.report); } catch(e){} }, 40);
  if (!$('[data-panel="marketmap"]').classList.contains('hidden')){ __mmRetry = 0; setTimeout(renderMarketMap, 40); }
  if (!$('[data-panel="report"]').classList.contains('hidden') && __rpLastRows) {
    setTimeout(() => { try { drawRpChart(__rpLastRows); } catch(e){} }, 40);
  }
}
$('#themeResetBtn').addEventListener('click', () => applyTheme('blue'));
(function initTheme(){
  let saved = 'blue';
  try { saved = localStorage.getItem('appTheme') || 'blue'; } catch(e){}
  if (!THEMES.some(t => t.id === saved)) saved = 'blue';
  document.documentElement.setAttribute('data-theme', saved);
  state.theme = saved;
})();
renderThemeGrid();
try { updateSortHint(); } catch(e){}
