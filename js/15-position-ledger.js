/* Personal trade ledger. Quantities are units, as in the saved-position report. */
function ledgerPnl(p, price){
  const numeric = x => (typeof x === 'number' || (typeof x === 'string' && x.trim() !== '')) && Number.isFinite(Number(x));
  if (!numeric(p.qty) || !(p.qty > 0) || !numeric(p.avgPremium) || p.avgPremium < 0 ||
      !Number.isFinite(price) || price < 0 || !['buy', 'sell'].includes(p.direction)) return null;
  const pnl = (price - p.avgPremium) * p.qty * (p.direction === 'sell' ? -1 : 1);
  return Number.isFinite(pnl) ? pnl : null;
}
function validClosedStrategy(s){
  return !!s && typeof s.name === 'string' && Number.isFinite(Date.parse(s.closedAt)) &&
    Number.isFinite(s.fees) && s.fees >= 0 && Array.isArray(s.legs) && s.legs.length > 0 &&
    s.legs.every(p => p && typeof p.sym === 'string' && ledgerPnl(p, p.exitPrice) !== null);
}
function renderPositionLedger(){ positionLedger.render(); }
const positionLedger = (() => {
  const select = $('#ledgerStrategy'), dialog = $('#ledgerDialog'), form = $('#ledgerForm');
  const nameOf = p => p.strategyName || 'بدون نام';
  const selected = () => state.savedPositions.filter(p => nameOf(p) === select.value);
  let draft = [];
  const money = n => n === null ? '—' : `<bdi>${fmt(n, Number.isInteger(n) ? 0 : 2)}</bdi>`;
  const mark = p => {
    const rows = p.type === 'underlying' ? state.market : state.options;
    const price = rows.find(r => r.sym === p.sym)?.price;
    return Number.isFinite(price) && price > 0 ? price : null;
  };
  const table = (headers, rows) => `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const headers = ['نماد', 'جهت ورود', 'تعداد', 'قیمت ورود'];
  const cells = p => [escapeHtml(p.sym), p.direction === 'buy' ? 'خرید' : 'فروش', money(+p.qty), money(+p.avgPremium)];
  const total = values => values.includes(null) ? null : values.reduce((a,b) => a+b, 0);
  const realized = s => total(s.legs.map(p => ledgerPnl(p, p.exitPrice))) - s.fees;
  function history(){
    const archive = state.closedStrategies;
    if (!archive.length) { $('#ledgerHistory').textContent = 'هنوز استراتژی بسته‌شده‌ای ثبت نشده است.'; return; }
    $('#ledgerHistory').innerHTML = `<p>جمع سود و زیان پس از کسر کارمزد ثبت‌شده: <b>${money(total(archive.map(realized)))} ریال</b></p>` + archive.slice().reverse().map(s =>
      `<details><summary>${escapeHtml(s.name)} · ${new Date(s.closedAt).toLocaleString('fa-IR')} · ${money(realized(s))} ریال</summary><p>کارمزد ثبت‌شده: ${money(s.fees)} ریال</p>` +
      table([...headers,'قیمت خروج','سود و زیان پیش از کارمزد'], s.legs.map(p => [...cells(p),money(p.exitPrice),money(ledgerPnl(p,p.exitPrice))])) + '</details>').join('');
  }
  function marks(){
    const el = $('#ledgerMarks');
    if (!state.savedPositions.length) { el.textContent = 'موقعیت بازی وجود ندارد.'; return; }
    const groups = new Map();
    for (const p of state.savedPositions){
      const name = nameOf(p), price = mark(p);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push({p,price,pnl:ledgerPnl(p,price)});
    }
    const all = [...groups.values()].flat(), net = total(all.map(r => r.pnl));
    el.innerHTML = `<p>جمع سود و زیان باز: <b>${money(net)} ریال</b> (پیش از کارمزد، بر اساس آخرین دادهٔ دریافتی)</p>` +
      (net === null ? '<p>جمع برای گروهی که قیمت یا اطلاعات ناقص دارد نمایش داده نمی‌شود. برای به‌روز کردن قیمت‌ها، داده‌های بازار را دریافت کنید.</p>' : '') +
      [...groups].map(([name, rows]) => `<details><summary>${escapeHtml(name)} · ${money(total(rows.map(r => r.pnl)))} ریال</summary>` +
        table([...headers,'قیمت بازار','سود و زیان باز'],rows.map(r => [...cells(r.p),money(r.price),money(r.pnl)])) + '</details>').join('');
  }
  function selection(){
    const legs = selected();
    const valid = legs.length && legs.every(p => ledgerPnl(p, 0) !== null);
    $('#ledgerStart').disabled = !valid;
    $('#ledgerSelection').textContent = !legs.length ? 'ابتدا در «گزارش موقعیت‌ها» موقعیتی ثبت کنید.' : !valid ? 'جهت، تعداد یا قیمت ورود یکی از موقعیت‌ها معتبر نیست؛ آن را در گزارش موقعیت‌ها اصلاح کنید.' : `${legs.length.toLocaleString('fa-IR')} موقعیت با این نام با هم بسته می‌شوند.`;
  }
  function render(){
    const previous = select.value, names = [...new Set(state.savedPositions.map(nameOf))].sort((a,b) => a.localeCompare(b,'fa'));
    select.replaceChildren(...names.map(name => new Option(name,name)));
    if (names.includes(previous)) select.value = previous;
    select.disabled = !names.length;
    selection(); history(); if ($('#ledgerOpen').open) marks();
  }
  function readDraft(){
    const inputs = [...form.querySelectorAll('[data-exit]')];
    const legs = draft.map((p,i) => ({...p,exitPrice:inputs[i].valueAsNumber}));
    const feeEl = $('#ledgerFees');
    const s = {name:select.value,closedAt:new Date().toISOString(),fees:feeEl.value === '' && !feeEl.validity.badInput ? 0 : feeEl.valueAsNumber,legs};
    return validClosedStrategy(s) && Number.isFinite(realized(s)) ? s : null;
  }
  function preview(){
    const s = readDraft();
    $('#ledgerPreview').innerHTML = s ? `سود و زیان نهایی استراتژی: <b>${money(realized(s))} ریال</b>` : 'برای محاسبهٔ سود و زیان، قیمت خروج همهٔ موقعیت‌ها را وارد کنید.';
  }
  select.addEventListener('change', selection);
  $('#ledgerOpen').addEventListener('toggle', () => { if ($('#ledgerOpen').open) marks(); });
  $('#ledgerStart').addEventListener('click', () => {
    draft = selected(); if (!draft.length) return;
    $('#ledgerTitle').textContent = 'بستن استراتژی: ' + select.value;
    $('#ledgerInputs').innerHTML = table([...headers,'آخرین قیمت بازار','قیمت واقعی خروج (ریال)'], draft.map(p => [...cells(p),money(mark(p)),`<input data-exit type="number" required min="0" step="any" aria-label="قیمت خروج ${escapeAttr(p.sym)}">`]));
    $('#ledgerFees').value = ''; preview(); dialog.showModal();
  });
  $('#ledgerCancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { draft = []; });
  form.addEventListener('input', preview);
  form.addEventListener('submit', e => {
    e.preventDefault(); const s = readDraft(), current = selected();
    if (!s || current.length !== draft.length || !current.every((p,i) => p === draft[i])) return;
    const remaining = state.savedPositions.filter(p => nameOf(p) !== s.name);
    const archive = [...state.closedStrategies, s];
    try { persistPositionBook(remaining,archive); }
    catch(err){ alert('ثبت انجام نشد؛ هیچ موقعیتی بسته نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید.'); return; }
    state.savedPositions = remaining; state.closedStrategies = archive;
    syncStrategyNames(); $('#rpBadge').textContent = remaining.length;
    $('#ledgerMessage').textContent = `استراتژی «${s.name}» بسته و در تاریخچه ثبت شد.`;
    dialog.close(); render();
  });
  return {render};
})();
