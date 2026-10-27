/* ============================================================
   بخش ۲۶: پاپ‌اور عمومی
   منبع: option-ver16.html خطوط 3000-3195
   ============================================================ */
/* ==================================================================
   ۲۶) پاپ‌اور عمومی
   ================================================================== */
const $calcPopover = $('#calcPopover');
function closeCalcPopover(){
  if ($calcPopover){
    $calcPopover.classList.add('hidden');
    $calcPopover.__lastTd = null;
  }
}
function showCalcPopover(td, html){
  if (!$calcPopover) return;
  if (!html){ closeCalcPopover(); return; }
  $calcPopover.innerHTML = html;
  $calcPopover.classList.remove('hidden', 'below-top');

  const tdRect = td.getBoundingClientRect();
  const popRect = $calcPopover.getBoundingClientRect();
  const pad = 10, gap = 10;

  let left = tdRect.left + tdRect.width / 2 - popRect.width / 2;
  if (left < pad) left = pad;
  if (left + popRect.width > window.innerWidth - pad) left = window.innerWidth - pad - popRect.width;

  let top = tdRect.bottom + gap;
  let belowTop = false;
  if (top + popRect.height > window.innerHeight - pad){
    top = tdRect.top - popRect.height - gap;
    belowTop = true;
    if (top < pad) top = pad;
  }

  $calcPopover.style.left = Math.round(left) + 'px';
  $calcPopover.style.top = Math.round(top) + 'px';
  if (belowTop) $calcPopover.classList.add('below-top');
  $calcPopover.__lastTd = td;
}

function buildWlCalcHtml(r, field){
  const fund = r.fund;
  const feeRate = fund ? state.wlFundFeePct / 100 : state.wlNonFundFeePct / 100;
  const feeRateLbl = fund ? `صندوق ${state.wlFundFeePct}%` : `غیرصندوق ${state.wlNonFundFeePct}%`;

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
    case 'strike':
      return wrap('قیمت اعمال (K)', null,
        [['نماد اختیار', escapeHtml(r.sym)], ['دارایی پایه', escapeHtml(r.underlying)],
         ['نوع', r.isCall ? 'Call' : 'Put'], ['منبع K', 'از نام نماد استخراج شده']],
        fmt0(r.strike),
        'قیمتی که در سررسید، سهم به آن قیمت قابل خرید یا فروش است.');

    case 'price':
      return wrap('آخرین قیمت معامله (P)', null,
        [['نماد', escapeHtml(r.sym)], ['نوع', r.isCall ? 'Call' : 'Put']],
        fmt0(r.price),
        'آخرین قیمت معامله‌شده در بازار. مبنای محاسبه پرمیوم خالص (پس از کارمزد) است.');

    case 'S':
      return wrap('قیمت پایه (S)', null,
        [['دارایی پایه', escapeHtml(r.underlying)],
         ['منبع', 'آخرین قیمت معامله سهم در بازار']],
        fmt0(r.S),
        'قیمت لحظه‌ای سهم پایه که مبنای محاسبه ITM/OTM و معیارهای deep و sookht است.');

    case 'days':
      return wrap('روز تا سررسید', 'روزهای تقویمی باقی‌مانده تا تاریخ سررسید',
        [['تاریخ سررسید', escapeHtml(r.expiryStr || '—')]],
        r.days + ' روز',
        'مبنای تمام محاسبات سالانه‌سازی (deep و sookht).');

    case 'tvol':
      return wrap('حجم معاملات', null,
        [['نماد', escapeHtml(r.sym)]],
        fmt0(r.tvol),
        'حجم معاملات روزانه — معیار نقدشوندگی نماد اختیار.');

    case 'tno':
      return wrap('تعداد معاملات', null,
        [['نماد', escapeHtml(r.sym)]],
        fmt0(r.tno),
        'تعداد دفعات معامله روزانه — معیار دیگری برای نقدشوندگی.');

    case 'deep': {
      if (r.deep === null){
        return wrap('Deep ITM', null,
          [['وضعیت', 'برای Put محاسبه نمی‌شود']],
          '—',
          'این معیار فقط برای اختیار خرید (Call) تعریف شده است.');
      }
      const lines = [
        ['نماد', escapeHtml(r.sym)],
        ['K (قیمت اعمال)', fmt0(r.strike)],
        ['S (قیمت پایه)', fmt0(r.S)],
        ['P (آخرین قیمت)', fmt0(r.price)],
        ['fee (کارمزد)', fmt0(r.fee) + ' — ' + feeRateLbl],
        ['K − S', fmt0(r.strike - r.S)],
        ['P − fee', fmt0(r.price - r.fee)]
      ];
      return wrap('Deep ITM (مقدار)', 'deep = K − S + P − fee',
        lines, fmt0(r.deep),
        'برای Call: بازده کل حاصل از اعمال اختیار در سررسید نسبت به قیمت پایه فعلی. اگر مثبت باشد، اعمال اختیار سودآور است.');
    }

    case 'fuel': {
      if (r.fuel === null){
        return wrap('سوخت', null,
          [['وضعیت', 'برای Put محاسبه نمی‌شود']],
          '—',
          'این معیار فقط برای اختیار خرید (Call) تعریف شده است.');
      }
      const lines = [
        ['نماد', escapeHtml(r.sym)],
        ['P (آخرین قیمت)', fmt0(r.price)],
        ['fee (کارمزد)', fmt0(r.fee) + ' — ' + feeRateLbl]
      ];
      return wrap('سوخت (پرمیوم خالص)', 'sookht = P − fee',
        lines, fmt0(r.fuel),
        'پرمیوم خالص دریافتی از فروش Call. هرچه بزرگ‌تر، درآمد بیشتر و محافظت بالاتر.');
    }

    case 'deepPct':
    case 'deepDailyPct':
    case 'fuelPct':
    case 'fuelDailyPct': {
      const isDeep = field.startsWith('deep');
      const isAnnual = field.endsWith('Pct') && !field.endsWith('DailyPct');
      const baseVal = isDeep ? r.deep : r.fuel;
      if (baseVal === null){
        return wrap(isDeep ? 'Deep ITM %' : 'سوخت %', null,
          [['وضعیت', 'برای Put محاسبه نمی‌شود']],
          '—',
          'این معیار فقط برای اختیار خرید (Call) تعریف شده است.');
      }
      const denom = r.S - r.price;
      const ratio = denom !== 0 ? baseVal / denom : null;
      const displayVal = isDeep
        ? (isAnnual ? r.deepPct : r.deepDailyPct)
        : (isAnnual ? r.fuelPct : r.fuelDailyPct);

      const lines = [
        [isDeep ? 'deep (مقدار)' : 'sookht (مقدار)', fmt0(baseVal)],
        ['S (قیمت پایه)', fmt0(r.S)],
        ['P (آخرین قیمت)', fmt0(r.price)],
        ['S − P (مخرج کسر)', fmt0(denom)],
        ['نسبت خام (r)', ratio !== null ? (ratio*100).toFixed(4) + '%' : '—']
      ];
      if (isAnnual){
        lines.push(['— سالانه‌سازی —', '', 'section-hdr']);
        lines.push(['روز تا سررسید', r.days + ' روز']);
        lines.push(['فرمول سالانه‌سازی', '(1 + r)^(365/days) − 1']);
        if (denom <= 0 && !isDeep){
          lines.push(['هشدار', 'S ≤ P — فرمول خطی به کار رفت']);
        }
      }

      let note;
      if (isDeep){
        note = isAnnual
          ? 'بازده سالانه deep: معیار سودآوری اعمال اختیار Call در مقیاس سالانه. عدد بزرگ‌تر = فرصت جذاب‌تر (در شرایط عادی).'
          : 'بازده روزانه deep: همان نسبت r بدون سالانه‌سازی. تفاوت آن با درصد سالانه در ضریب (365/days) است.';
      } else {
        note = isAnnual
          ? 'بازده سالانه sookht: پرمیوم خالص به‌صورت درصد سالانه از تفاضل قیمت سهم و پرمیوم.'
          : 'بازده روزانه sookht: پرمیوم خالص نسبت به تفاضل قیمت سهم و پرمیوم.';
      }

      return wrap(
        (isDeep ? 'Deep ITM %' : 'سوخت %') + (isAnnual ? ' (سالانه)' : ' (روزانه)'),
        isAnnual
          ? `(1 + ${isDeep ? 'deep' : 'sookht'}/(S−P))^(365/days) − 1`
          : `${isDeep ? 'deep' : 'sookht'} / (S − P)`,
        lines,
        displayVal !== null ? (displayVal*100).toFixed(isAnnual ? 2 : 4) + '%' : '—',
        note
      );
    }
  }
  return null;
}

