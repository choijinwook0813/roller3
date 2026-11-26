/* 생산량 화면: 선택한 월의 날짜별 주간/야간 생산량 */
(function () {
  'use strict';
  const { Store, esc, fmt, toInt, today, monthDays, dayLabel, parse } = R3;

  function render(el) {
    const m = App.state.month;
    const days = monthDays(m);
    const t = today();
    const tagDates = R3.calc.groupByDate(Store.tagsIn(m));
    const rows = days.map((d, i) => {
      const p = Store.prodOf(d);
      const wd = parse(d).getDay();
      const future = d > t;
      const warn = ['D', 'N'].filter((s) => (tagDates[d] || []).some((x) => x.shift === s) && !p[s]);
      const cell = (s, idx) => `<input class="pin ${p[s] == null ? 'miss' : ''} ${future ? 'future' : ''}" data-d="${d}" data-s="${s}" data-i="${idx}"
        inputmode="numeric" pattern="[0-9]*" enterkeyhint="next" autocomplete="off" placeholder="미입력" value="${p[s] == null ? '' : p[s]}" aria-label="${dayLabel(d)} ${s === 'D' ? '주간' : '야간'} 생산량">`;
      return `<div class="pd ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''} ${d === t ? 'today' : ''}">${Number(d.slice(8))}일 <small>${R3.dow(d)}</small></div>
        ${cell('D', i * 2)}${cell('N', i * 2 + 1)}
        <div class="ptot" id="pt-${d}">${p.D != null || p.N != null ? fmt((p.D || 0) + (p.N || 0)) : ''}</div>
        ${warn.length ? `<div class="pwarn">⚠ ${warn.map((s) => (s === 'D' ? '주간' : '야간')).join('·')} 식별표는 있는데 생산량이 없습니다</div>` : ''}`;
    }).join('');
    el.innerHTML = `
      <div class="p-head"><b id="p-total"></b><span class="sub" id="p-miss"></span></div>
      <div class="ptable" id="p-table">
        <div class="h">날짜</div><div class="h c">주간 생산량</div><div class="h c">야간 생산량</div><div class="h" style="text-align:right">일계</div>
        ${rows}
      </div>`;
    summary(el);

    const table = el.querySelector('#p-table');
    table.addEventListener('input', (e) => {
      const inp = e.target.closest('.pin');
      if (!inp) return;
      const v = inp.value.replace(/[^0-9]/g, '');
      if (v !== inp.value) inp.value = v;
      const val = v === '' ? null : toInt(v);
      if (!Store.setProd(inp.dataset.d, inp.dataset.s, val)) UI.toast('저장하지 못했습니다', 'error');
      inp.classList.toggle('miss', val == null);
      const p = Store.prodOf(inp.dataset.d);
      el.querySelector(`#pt-${inp.dataset.d}`).textContent = p.D != null || p.N != null ? fmt((p.D || 0) + (p.N || 0)) : '';
      summary(el);
    });
    table.addEventListener('focusin', (e) => { if (e.target.classList.contains('pin')) e.target.select(); });
    table.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const inp = e.target.closest('.pin');
      if (!inp) return;
      e.preventDefault();
      const next = table.querySelector(`.pin[data-i="${Number(inp.dataset.i) + 1}"]`);
      if (next) next.focus(); else inp.blur();
    });
    table.addEventListener('change', () => App.refreshAlerts());

    // 이번 달이면 오늘 근처로 스크롤
    if (m === t.slice(0, 7)) {
      const target = table.querySelector(`.pin[data-d="${R3.addDays(t, -3)}"]`) || table.querySelector(`.pin[data-d="${t}"]`);
      if (target) setTimeout(() => target.scrollIntoView({ block: 'start' }), 0);
    }
  }

  function summary(el) {
    const m = App.state.month;
    const t = today();
    let tot = 0, miss = 0;
    monthDays(m).forEach((d) => {
      const p = Store.prodOf(d);
      tot += (p.D || 0) + (p.N || 0);
      if (d <= t) miss += (p.D == null ? 1 : 0) + (p.N == null ? 1 : 0);
    });
    el.querySelector('#p-total').textContent = `${R3.monthLabel(m)} 생산량 ${fmt(tot)}`;
    el.querySelector('#p-miss').textContent = miss ? `오늘까지 미입력 ${miss}칸 · 휴무는 0 입력` : '모두 입력됨';
  }

  window.Pages = window.Pages || {};
  Pages.prod = { render };
})();
