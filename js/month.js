/* 월별 현황: 요약 카드 · 일별 표 · 공정/사유별 · 불량률 추이 · 최근 12개월 */
(function () {
  'use strict';
  const { Store, esc, fmt, fmtPct, rate, today, addMonths, monthLabel, dayLabel, SHIFT_NAME } = R3;
  let scope = null;      // 'T' | 'D' | 'N' | 'all'
  let openDate = null;   // 펼친 날짜

  function render(el) {
    const m = App.state.month;
    if (!scope) scope = window.matchMedia('(min-width: 900px)').matches ? 'all' : 'T';
    const cur = R3.calc.month(m);
    const prev = R3.calc.month(addMonths(m, -1));
    el.innerHTML = `
      <div class="kpis" id="kpis">${kpis(cur.tot, prev.tot.T, addMonths(m, -1))}</div>

      <section class="sec">
        <div class="sec-head"><h3>일별 현황</h3>
          <div class="seg sm" id="scope" role="group" aria-label="표시 범위">
            <button type="button" data-v="T">일계</button><button type="button" data-v="D">주간</button><button type="button" data-v="N">야간</button><button type="button" data-v="all">전체</button>
          </div></div>
        <div class="tbl-wrap" id="daily"></div>
        <p class="sub" style="margin:6px 2px 0">날짜를 누르면 그날 식별표가 펼쳐집니다. ⚠ = 식별표는 있는데 생산량이 없음</p>
      </section>

      <section class="sec two">
        <div class="card"><div class="sec-head"><h3>공정별</h3>${legend()}</div><div id="by-proc"></div></div>
        <div class="card"><div class="sec-head"><h3>사유별</h3>${legend()}</div><div id="by-reason"></div></div>
      </section>

      <section class="sec card">
        <div class="sec-head"><h3>일별 불량률 추이</h3>
          <div class="legend"><span><i class="ln" style="background:var(--day)"></i>주간</span><span><i class="ln" style="background:var(--night)"></i>야간</span></div></div>
        <div class="chart" id="trend"></div>
      </section>

      <section class="sec">
        <div class="sec-head"><h3>최근 12개월</h3></div>
        <div class="tbl-wrap" id="months"></div>
      </section>`;

    document.querySelectorAll('#scope button').forEach((b) => b.classList.toggle('on', b.dataset.v === scope));
    el.querySelector('#scope').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      scope = b.dataset.v;
      document.querySelectorAll('#scope button').forEach((x) => x.classList.toggle('on', x === b));
      daily(el, cur);
    });
    daily(el, cur);

    el.querySelector('#by-proc').innerHTML = UI.barRows(R3.calc.breakdown(cur.tags, 'process'));
    el.querySelector('#by-reason').innerHTML = UI.barRows(R3.calc.breakdown(cur.tags, 'reason'));

    const shown = visibleDays(cur);
    UI.lineChart(el.querySelector('#trend'), {
      labels: shown.map((d) => `${Number(d.date.slice(8))}일`),
      series: [
        { name: '주간', color: 'var(--day)', values: shown.map((d) => d.D.defRate) },
        { name: '야간', color: 'var(--night)', values: shown.map((d) => d.N.defRate) },
      ],
      yFmt: (v, tip) => (tip ? v.toFixed(2) : +v.toFixed(2)) + '%',
      empty: '생산량이 입력된 날이 없습니다',
    });

    months(el, m);
  }

  function legend() {
    return '<div class="legend"><span><i style="background:var(--def)"></i>불량</span><span><i style="background:var(--rw)"></i>리워크</span></div>';
  }

  function delta(curV, prevV, pct, goodWhenUp) {
    if (curV == null || prevV == null) return '<span>전월 비교 불가</span>';
    const d = curV - prevV;
    const cls = d === 0 ? '' : (d > 0) === goodWhenUp ? 'up-good' : 'up-bad';
    const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '';
    return `<span class="${cls}">${arrow}${pct ? Math.abs(d).toFixed(2) + '%p' : fmt(Math.abs(d))}</span>`;
  }

  function kpis(tot, p, pm) {
    const c = tot.T;
    const hasPrev = p.prod > 0;
    const pctChg = hasPrev ? ((c.prod - p.prod) / p.prod) * 100 : null;
    const sign = (x) => (x > 0 ? '+' : x < 0 ? '−' : '');
    const cmp = (inner) => `<div class="dl">${hasPrev ? `전월 대비 ${inner}` : `${monthLabel(pm)} 데이터 없음`}</div>`;
    return `
      <div class="kpi"><div class="t">총 생산량</div><div class="v">${fmt(c.prod)}</div>
        <div class="r sub">주간 ${fmt(tot.D.prod)} · 야간 ${fmt(tot.N.prod)}</div>
        ${cmp(`${sign(c.prod - p.prod)}${fmt(Math.abs(c.prod - p.prod))} (${pctChg == null ? '-' : sign(pctChg) + Math.abs(pctChg).toFixed(1) + '%'})`)}</div>
      <div class="kpi k-good"><div class="t">양품 (양품률)</div><div class="v">${fmt(c.good)}</div><div class="r" style="color:var(--good)">${fmtPct(c.goodRate)}</div>
        ${cmp(delta(c.goodRate, p.goodRate, true, true))}</div>
      <div class="kpi k-def"><div class="t">불량 (불량률)</div><div class="v">${fmt(c.def)}</div><div class="r" style="color:var(--def)">${fmtPct(c.defRate)}</div>
        ${cmp(`${delta(c.defRate, p.defRate, true, false)} · ${delta(c.def, p.def, false, false)}개`)}</div>
      <div class="kpi k-rw"><div class="t">리워크 (리워크율)</div><div class="v">${fmt(c.rw)}</div><div class="r" style="color:var(--rw)">${fmtPct(c.rwRate)}</div>
        ${cmp(`${delta(c.rwRate, p.rwRate, true, false)} · ${delta(c.rw, p.rw, false, false)}개`)}</div>`;
  }

  // 이번 달이면 오늘까지 (이후 날짜라도 데이터가 있으면 표시)
  function visibleDays(cur) {
    const t = today();
    return cur.days.filter((d) => d.date <= t || d.T.n > 0 || d.T.prod > 0);
  }

  function daily(el, cur) {
    const box = el.querySelector('#daily');
    const days = visibleDays(cur);
    const cols = scope === 'all' ? ['D', 'N', 'T'] : [scope];
    const cells = (a, s, bl) => {
      const none = a.prod === 0 && a.n === 0;
      return `<td class="${bl ? 'bl' : ''}">${none && a.missing ? '-' : fmt(a.prod)}</td><td>${fmt(a.good)}</td>
        <td class="def">${a.def ? fmt(a.def) : none ? '-' : 0}</td><td class="rw">${a.rw ? fmt(a.rw) : none ? '-' : 0}</td><td class="rate">${fmtPct(a.defRate)}</td>`;
    };
    const sub = '<th>생산량</th><th>양품</th><th>불량</th><th>리워크</th><th>불량률</th>';
    const head = scope === 'all'
      ? `<tr><th rowspan="2">날짜</th>${cols.map((s) => `<th colspan="5" class="grp">${s === 'T' ? '일계' : SHIFT_NAME[s]}</th>`).join('')}</tr>
         <tr>${cols.map(() => sub.replace('<th>', '<th class="bl">')).join('')}</tr>`
      : `<tr><th>날짜</th>${sub}</tr>`;
    const width = 1 + cols.length * 5;
    const body = days.map((d) => {
      const empty = d.T.prod === 0 && d.T.n === 0;
      const warnShifts = scope === 'T' || scope === 'all' ? d.warn : d.warn.filter((s) => s === scope);
      let row = `<tr class="dayrow ${empty ? 'nodata' : ''} ${openDate === d.date ? 'open' : ''}" data-d="${d.date}">
        <td>${Number(d.date.slice(8))}일 <span class="dw">${R3.dow(d.date)}</span>${warnShifts.length ? `<span class="warnmark" title="식별표는 있는데 생산량 없음">⚠</span>` : ''}</td>
        ${cols.map((s, i) => cells(d[s], s, scope === 'all')).join('')}</tr>`;
      if (openDate === d.date) {
        const tags = (cur.byDate[d.date] || []).filter((t) => scope === 'T' || scope === 'all' || t.shift === scope)
          .sort((a, b) => a.shift.localeCompare(b.shift) || b.qty - a.qty);
        row += `<tr><td class="expand" colspan="${width}">${warnShifts.length ? `<div class="sub" style="color:var(--def);font-weight:700;margin-bottom:6px">⚠ ${warnShifts.map((s) => SHIFT_NAME[s]).join('·')} 생산량이 입력되지 않았습니다</div>` : ''}
          ${tags.length ? tags.map(Pages.record.tagHtml).join('') : '<div class="sub">식별표 없음</div>'}</td></tr>`;
      }
      return row;
    }).join('');
    const foot = `<tr><td>${monthLabel(App.state.month).slice(6)} 합계</td>${cols.map((s) => cells(cur.tot[s], s, scope === 'all')).join('')}</tr>`;
    box.innerHTML = `<table class="t"><thead>${head}</thead><tbody>${body || `<tr><td colspan="${width}" class="empty">이 달의 데이터가 없습니다</td></tr>`}</tbody><tfoot>${foot}</tfoot></table>`;
    box.onclick = (e) => {
      const tag = e.target.closest('.tag');
      if (tag) { Pages.record.tagMenu(Number(tag.dataset.id), '#month'); return; }
      const tr = e.target.closest('tr.dayrow');
      if (!tr) return;
      openDate = openDate === tr.dataset.d ? null : tr.dataset.d;
      daily(el, cur);
    };
  }

  function months(el, m) {
    const list = [];
    for (let i = 11; i >= 0; i--) {
      const mm = addMonths(m, -i);
      list.push({ m: mm, ...R3.calc.month(mm).tot.T });
    }
    el.querySelector('#months').innerHTML = `<table class="t"><thead><tr><th>월</th><th>총 생산량</th><th>불량</th><th>불량률</th><th>리워크</th><th>리워크율</th><th>양품률</th></tr></thead>
      <tbody>${list.reverse().map((r) => {
        const none = r.prod === 0 && r.n === 0;
        return `<tr class="${none ? 'nodata' : ''}" ${r.m === m ? 'style="font-weight:800"' : ''}><td>${esc(monthLabel(r.m))}</td>
          <td>${none ? '-' : fmt(r.prod)}</td><td class="def">${none ? '-' : fmt(r.def)}</td><td class="rate">${fmtPct(r.defRate)}</td>
          <td class="rw">${none ? '-' : fmt(r.rw)}</td><td class="rate">${fmtPct(r.rwRate)}</td><td>${fmtPct(r.goodRate)}</td></tr>`;
      }).join('')}</tbody></table>`;
  }

  window.Pages = window.Pages || {};
  Pages.month = { render };
})();
