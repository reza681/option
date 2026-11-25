/* Strike-by-expiry comparison, independent of the strategy selections. */
function rollRate(fraction, digits){
  return fraction === null ? '—' : `<bdi>${(fraction * 100).toFixed(digits)}%</bdi>`;
}

const rollVisibleContracts = [];
function renderRollWatch(){
  rollVisibleContracts.length = 0;
  const asset = $('#rollAsset'), previous = asset.value;
  const groups = state.underlyingsWithOptions;
  const selected = groups.find(g => g.sym === previous) || groups[0];
  asset.replaceChildren(...groups.map(g => new Option(g.sym, g.sym)));
  asset.disabled = !selected;
  if (selected) asset.value = selected.sym;

  const contracts = !selected ? [] : $('#rollType').value === 'call' ? selected.calls : selected.puts;
  const rows = new Map(), dates = new Set();
  for (const o of contracts){
    if (!(o.strike > 0) || !o.expiry) continue;
    if (!rows.has(o.strike)) rows.set(o.strike, new Map());
    const byDate = rows.get(o.strike);
    if (!byDate.has(o.expiryStr)) byDate.set(o.expiryStr, []);
    byDate.get(o.expiryStr).push(o);
    dates.add(o.expiryStr);
  }
  const hint = $('#rollHint'), table = $('#rollTable');
  if (!rows.size){
    table.replaceChildren();
    hint.textContent = !state.market.length ? 'برای شروع، داده‌های بازار را از صفحه اصلی دریافت کنید.' :
      !selected ? 'در داده‌های بازار قرارداد اختیاری یافت نشد.' : 'برای این دارایی و نوع اختیار، قراردادی با اعمال و سررسید مشخص یافت نشد.';
    return;
  }
  const expiries = sortExpiries([...dates]);
  const field = $('#rollQuote').value;
  hint.textContent = 'پرمیوم به ریال است. YTM بازده سالانه در صورت اعمال، بر مبنای قیمت دیده‌بان است. برای جزئیات روی خانه بزنید.';
  const header = expiries.map(d => `<th scope="col"><bdi>${escapeHtml(d)}</bdi><br><small>${daysToExpiry(parseJalaliDate(d)).toLocaleString('fa-IR')} روز تا سررسید</small></th>`).join('');
  const body = [...rows.keys()].sort((a,b) => a-b).map(strike => {
    const cells = expiries.map(d => {
      const items = rows.get(strike).get(d);
      const quotes = items && items.map(o => {
        const P = o[field], r = computeWatchlistRow(o);
        const index = rollVisibleContracts.push(o) - 1;
        return `<button type="button" class="roll-contract" data-roll-index="${index}" aria-haspopup="dialog" title="${escapeAttr(o.sym)}" aria-label="جزئیات ${escapeAttr(o.sym)}">پرمیوم: <bdi>${P > 0 ? fmt0(P) : '—'}</bdi><br>YTM: ${rollRate(r.deepPct, 2)}</button>`;
      }).join('');
      return `<td>${quotes || '—'}</td>`;
    }).join('');
    return `<tr><th scope="row">${fmt0(strike)}</th>${cells}</tr>`;
  }).join('');
  table.innerHTML = `<thead><tr><th scope="col">قیمت اعمال</th>${header}</tr></thead><tbody>${body}</tbody>`;
}
function openRollDetails(o){
  const r = computeWatchlistRow(o);
  const num = x => fmt(x, Number.isInteger(x) ? 0 : 2);
  const eq = s => `<bdi dir="ltr">${s}</bdi>`;
  const feePct = r.fund ? state.wlFundFeePct : state.wlNonFundFeePct;
  const feeLine = !state.wlApplyFee ? 'کارمزد غیرفعال است: ۰ ریال.' :
    `کارمزد = ${state.wlFeeOnPremium ? 'درصد کارمزد × (قیمت پایه + پرمیوم)' : 'درصد کارمزد × قیمت پایه'} = ${eq(`${num(feePct)}% × ${num(r.S + (state.wlFeeOnPremium ? r.price : 0))} = ${num(r.fee)}`)} ریال`;
  const scenario = (title, explanation, amount, period, annual) => `<section><h3>${title}</h3>
    <p>${explanation} = <b>${eq(num(amount))} ریال</b></p>
    <p>سود از امروز تا سررسید = مبلغ سود ÷ سرمایهٔ مبنا × ۱۰۰<br>${eq(`${num(amount)} ÷ ${num(r.denom)} × 100`)} = <b>${rollRate(period, 4)}</b></p>
    <p>بازده سالانه: <b>${rollRate(annual, 2)}</b></p></section>`;
  $('#rollDetailsTitle').textContent = `محاسبات ${o.sym}`;
  $('#rollDetailsBody').innerHTML = `<p>${r.isCall ? 'اختیار خرید' : 'اختیار فروش'} ${escapeHtml(o.underlying)} · سررسید <bdi>${escapeHtml(o.expiryStr)}</bdi> · ${r.days} روز تا سررسید</p>
    <section><h3>قیمت‌های مبنای دیده‌بان (ریال)</h3><p>دارایی پایه: <b>${num(r.S)}</b> | قیمت اعمال: <b>${num(r.strike)}</b> | پرمیوم اختیار: <b>${num(r.price)}</b></p></section>` +
    (!r.isCall ? '<p>در دیده‌بان اختیار، محاسبات اعمال (Deep) و سوخت برای اختیار فروش تعریف نشده‌اند.</p>' :
    `<section><h3>کارمزد و سرمایهٔ مبنا</h3><p>${feeLine}</p><p>پرمیوم خالص = پرمیوم − کارمزد = ${eq(`${num(r.price)} − ${num(r.fee)} = ${num(r.netPremium)}`)} ریال</p>
    <p>سرمایهٔ مبنا = قیمت پایه − پرمیوم = ${eq(`${num(r.S)} − ${num(r.price)} = ${num(r.denom)}`)} ریال</p></section>` +
    scenario('اگر اختیار اعمال شود (Deep)', `مبلغ سود = قیمت اعمال − قیمت پایه + پرمیوم خالص = ${eq(`${num(r.strike)} − ${num(r.S)} + ${num(r.netPremium)}`)}`, r.deep, r.deepDailyPct, r.deepPct) +
    scenario('اگر اختیار اعمال نشود (سوخت)', 'مبلغ سود = پرمیوم خالص', r.fuel, r.fuelDailyPct, r.fuelPct) +
    `<section><h3>بازده سالانه چگونه محاسبه شد؟</h3><p>${r.annualMode === 'linear' ? 'روش ساده: درصد سود تا سررسید × ۳۶۵ ÷ روزهای باقی‌مانده.' : 'روش مرکب: اگر R بازده تا سررسید به‌صورت اعشاری و d روزهای باقی‌مانده باشد، درصد سالانه برابر است با ' + eq('100 × ((1 + R)^(365/d) − 1)') + '.'}</p><p>خط تیره یعنی با داده‌های این قرارداد، نرخ قابل محاسبه نیست.</p></section>`);
  $('#rollDetails').showModal();
}
$('#rollTable').addEventListener('click', e => {
  const button = e.target.closest('[data-roll-index]');
  if (button && rollVisibleContracts[button.dataset.rollIndex]) openRollDetails(rollVisibleContracts[button.dataset.rollIndex]);
});
for (const id of ['#rollAsset', '#rollType', '#rollQuote']) $(id).addEventListener('change', renderRollWatch);
