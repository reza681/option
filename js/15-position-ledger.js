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
  let draft = [], editing = null;
  /* تاریخ بسته شدن شمسی استراتژی؛ برای رکوردهای قدیمی از closedAt استخراج می‌شود */
  const closeDateOf = s => s.closeDate || isoToJalaliStr(s.closedAt);
  const day = v => {
    const parts = parseJalaliDate(v); if (!parts) return null;
    const [y,m,d] = parts, utc = (y,m,d) => { const [a,b,c] = jalaliToGregorian(y,m,d); return Date.UTC(a,b-1,c)/86400000; };
    if (y < 1200 || y > 1600 || m < 1 || m > 12 || d < 1 || d > (m < 7 ? 31 : 30)) return null;
    const n = utc(y,m,d); return n < utc(y+1,1,1) ? n : null;
  };
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
  function returns(s){
    const start = day(s.from), end = day(s.to), days = start !== null && end !== null && end > start ? end-start : null;
    const pct = Number.isFinite(s.capital) && s.capital > 0 ? realized(s)*100/s.capital : null;
    const mode = ['linear','compound'].includes(s.rateMode) ? s.rateMode : getAnnualMode();
    const ann = annualizePct(pct,days,mode);
    return `<p>سرمایهٔ مبنا: ${money(Number.isFinite(s.capital)?s.capital:null)} ریال · ورود: ${escapeHtml(s.from || '—')} · سررسید: ${escapeHtml(s.to || '—')} · مدت: ${money(days)} روز</p><p>بازده خالص کل دوره: ${money(Number.isFinite(pct)?pct:null)}٪ · YTM سالانه (${mode === 'linear'?'خطی':'مرکب'}): ${money(Number.isFinite(ann)?ann:null)}٪</p><small>بر پایهٔ خروج ثبت‌شده، با فرض عدم سرمایه‌گذاری مجدد تا سررسید؛ نه پیش‌بینی قیمت تسویه.</small>`;
  }
  function history(archive = state.closedStrategies, el = $('#ledgerHistory')){
    if (!archive.length) { el.textContent = 'هنوز استراتژی بسته‌شده‌ای ثبت نشده است.'; return; }
    const editable = el.id === 'ledgerHistory';
    const editBtn = idx => editable ? `<button type="button" data-ledger-edit="${idx}" title="ویرایش تاریخ بسته شدن، قیمت‌ها و جزئیات این استراتژی" style="padding:2px 10px;font-size:11.5px;font-weight:700;border:1px solid #0369a1;color:#0369a1;background:var(--card);border-radius:6px;cursor:pointer">✏️ ویرایش</button>` : '';
    el.innerHTML = `<p>جمع سود و زیان پس از کسر کارمزد ثبت‌شده: <b>${money(total(archive.map(realized)))} ریال</b></p>` + archive.slice().reverse().map((s,i) =>
      `<details><summary>${escapeHtml(s.name)} · تاریخ بسته شدن: <b dir="ltr">${escapeHtml(closeDateOf(s))}</b> · ${money(realized(s))} ریال ${editBtn(archive.length-1-i)}</summary><p>کارمزد ثبت‌شده: ${money(s.fees)} ریال · زمان ثبت: ${new Date(s.closedAt).toLocaleString('fa-IR')}</p>` +
      returns(s) + (editable ? `<p>${editBtn(archive.length-1-i)}</p>` : '') + table([...headers,'قیمت خروج','سود و زیان پیش از کارمزد'], s.legs.map(p => [...cells(p),money(p.exitPrice),money(ledgerPnl(p,p.exitPrice))])) + '</details>').join('');
  }
  function marks(positions = state.savedPositions, priceOf = mark, el = $('#ledgerMarks'), shared = false){
    if (!positions.length) { el.textContent = 'موقعیت بازی وجود ندارد.'; return; }
    const groups = new Map();
    for (const p of positions){
      const name = nameOf(p), price = priceOf(p);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push({p,price,pnl:ledgerPnl(p,price)});
    }
    const all = [...groups.values()].flat(), net = total(all.map(r => r.pnl));
    el.innerHTML = `<p>جمع سود و زیان باز: <b>${money(net)} ریال</b> (پیش از کارمزد، ${shared ? 'بر اساس قیمت‌های داخل فایل' : 'بر اساس آخرین دادهٔ دریافتی'})</p>` +
      (net === null ? '<p>جمع برای گروهی که قیمت یا اطلاعات ناقص دارد نمایش داده نمی‌شود.</p>' : '') +
      [...groups].map(([name, rows]) => `<details><summary>${escapeHtml(name)} · ${money(total(rows.map(r => r.pnl)))} ریال</summary>` +
        table([...headers,'قیمت بازار','سود و زیان باز'],rows.map(r => [...cells(r.p),money(r.price),money(r.pnl)])) + '</details>').join('');
  }
  const shareLeg = p => ({sym:p.sym, strategyName:nameOf(p), direction:p.direction, qty:p.qty, avgPremium:p.avgPremium});
  $('#ledgerShare').addEventListener('click', () => {
    if (!state.savedPositions.length && !state.closedStrategies.length) return alert('موقعیتی برای ارسال وجود ندارد.');
    const savedAt = new Date().toISOString();
    const data = {format:'option-ledger-view', version:1, savedAt,
      open:state.savedPositions.map(p => ({...shareLeg(p), mark:mark(p)})),
      closed:state.closedStrategies.map(s => ({name:s.name, closedAt:s.closedAt, closeDate:s.closeDate, fees:s.fees, from:s.from,to:s.to,capital:s.capital,rateMode:s.rateMode, legs:s.legs.map(p => ({...shareLeg(p), exitPrice:p.exitPrice}))}))};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'ledger-view-' + savedAt.slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
  });
  $('#ledgerView').addEventListener('click', () => $('#ledgerFile').click());
  $('#ledgerFile').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.format !== 'option-ledger-view' || data.version !== 1 || !Number.isFinite(Date.parse(data.savedAt)) ||
          !Array.isArray(data.open) || !data.open.every(p => p && typeof p.sym === 'string' && typeof p.strategyName === 'string' && ledgerPnl(p,0) !== null && (p.mark === null || (Number.isFinite(p.mark) && p.mark >= 0))) ||
          !Array.isArray(data.closed) || !data.closed.every(validClosedStrategy)) throw new Error();
      marks(data.open,p => p.mark,$('#ledgerSharedMarks'),true); history(data.closed,$('#ledgerSharedHistory'));
      $('#ledgerStamp').textContent = 'زمان ذخیرهٔ گزارش: ' + new Date(data.savedAt).toLocaleString('fa-IR');
      $('#ledgerSharedDialog').showModal();
    } catch { alert('فایل نمایش معتبر نیست. فایل ساخته‌شده با «ذخیرهٔ فایل برای ارسال» را انتخاب کنید.'); }
  });
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
    const legs = draft.map((p,i) => ({...p,qty:form.querySelectorAll('[data-qty]')[i].valueAsNumber,avgPremium:form.querySelectorAll('[data-entry]')[i].valueAsNumber,exitPrice:inputs[i].valueAsNumber}));
    const feeEl = $('#ledgerFees');
    const capital = $('#ledgerCapital'), from = $('#ledgerFrom').value.trim(), to = $('#ledgerTo').value.trim();
    if (capital.validity.badInput || (capital.value && !(capital.valueAsNumber > 0)) || (from && day(from) === null) || (to && day(to) === null) || (from && to && day(to) <= day(from))) return null;
    /* تاریخ بسته شدن: خالی یعنی همان مقدار قبلی/امروز */
    const closeDateEl = $('#ledgerCloseDate');
    const closeRaw = closeDateEl ? closeDateEl.value.trim().replace(/[-\s]+/g, '/') : '';
    if (closeRaw && day(closeRaw) === null) return null;
    const closeDate = closeRaw ? normalizeExpiryStr(closeRaw) : (editing?.closeDate || todayJalaliStr());
    let name = editing?.name ?? select.value;
    if (editing){
      const nameEl = $('#ledgerName');
      const nm = nameEl ? nameEl.value.trim() : '';
      if (!nm) return null;
      name = nm;
    }
    const s = {...editing,name,closedAt:editing?.closedAt ?? new Date().toISOString(),closeDate,from,to,capital:capital.valueAsNumber || null,rateMode:editing?.rateMode || getAnnualMode(),fees:feeEl.value === '' && !feeEl.validity.badInput ? 0 : feeEl.valueAsNumber,legs};
    return validClosedStrategy(s) && Number.isFinite(realized(s)) ? s : null;
  }
  function preview(){
    const s = readDraft();
    $('#ledgerPreview').innerHTML = s ? `سود و زیان نهایی استراتژی: <b>${money(realized(s))} ریال</b> · تاریخ بسته شدن: <b dir="ltr">${escapeHtml(closeDateOf(s))}</b>${returns(s)}` : 'قیمت‌ها، تعداد و تاریخ‌ها (از جمله تاریخ بسته شدن) را بررسی کنید. سررسید باید بعد از ورود و سرمایهٔ مبنا مثبت باشد.';
  }
  select.addEventListener('change', selection);
  $('#ledgerOpen').addEventListener('toggle', () => { if ($('#ledgerOpen').open) marks(); });
  function openForm(record){
    editing = record; draft = record ? record.legs : selected(); if (!draft.length) return;
    const unanimous = xs => xs.length && xs.every(x => x && x === xs[0]) ? xs[0] : '';
    $('#ledgerFrom').value = record?.from ?? unanimous(draft.map(p => p.investmentDate));
    $('#ledgerTo').value = record?.to ?? unanimous(draft.filter(p => p.type !== 'underlying').map(p => p.expiryStr || state.options.find(o => o.sym === p.sym)?.expiryStr));
    $('#ledgerCapital').value = record?.capital ?? (draft.every(p => p.direction === 'buy') ? draft.reduce((a,p) => a+p.qty*p.avgPremium,0) || '' : '');
    $('#ledgerCloseDate').value = record?.closeDate ?? todayJalaliStr();
    const nameRow = $('#ledgerNameRow');
    if (nameRow) nameRow.hidden = !record;
    if (record) $('#ledgerName').value = record.name;
    $('#ledgerTitle').textContent = record ? 'ویرایش: ' + record.name : 'بستن استراتژی: ' + select.value;
    const input = (key,val,label) => `<input data-${key} type="number" required min="0" step="any" value="${val == null?'':Number(val)}" aria-label="${label}">`;
    $('#ledgerInputs').innerHTML = table([...headers,'آخرین قیمت بازار','قیمت واقعی خروج (ریال)'],draft.map(p => [...cells(p).slice(0,2),input('qty',p.qty,'تعداد'),input('entry',p.avgPremium,'قیمت ورود'),money(mark(p)),input('exit',record?p.exitPrice:null,'قیمت خروج')]));
    $('#ledgerFees').value = record?.fees ?? ''; preview(); dialog.showModal();
  }
  $('#ledgerStart').addEventListener('click', () => openForm(null));
  $('#ledgerHistory').addEventListener('click', e => {
    const btn = e.target.closest('[data-ledger-edit]');
    if (!btn) return;
    e.preventDefault(); // جلوگیری از باز/بسته‌شدن details هنگام کلیک روی دکمهٔ ویرایش
    openForm(state.closedStrategies[+btn.dataset.ledgerEdit]);
  });
  $('#ledgerCancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { draft = []; });
  form.addEventListener('input', preview);
  form.addEventListener('submit', e => {
    e.preventDefault(); const s = readDraft(), current = selected();
    if (!s) return;
    if (editing){
      const i = state.closedStrategies.indexOf(editing); if (i < 0) return;
      const archive = state.closedStrategies.slice(); archive[i] = s;
      try { persistPositionBook(state.savedPositions,archive); } catch { alert('ویرایش ذخیره نشد. فضای ذخیره‌سازی را بررسی کنید.'); return; }
      state.closedStrategies = archive; dialog.close(); render(); $('#ledgerMessage').textContent = 'اصلاحات ذخیره شد.'; return;
    }
    if (current.length !== draft.length || !current.every((p,i) => p === draft[i])) return;
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
