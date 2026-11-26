/* 공통 UI: 토스트, 진동, 하단 시트, SVG 선 그래프, 막대, 파일 공유·저장·복사 */
(function () {
  'use strict';
  const { esc } = R3;
  const $ = (id) => document.getElementById(id);

  let toastTimer;
  function toast(msg, kind) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast ' + (kind || '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' ? 4500 : 2200);
  }
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } };

  // 하단 시트: actions = [{label, value, cls}], body = 문자열 또는 HTML 노드
  function sheet(title, body, actions, opts) {
    return new Promise((resolve) => {
      $('sheet-title').textContent = title;
      const b = $('sheet-body');
      b.innerHTML = '';
      if (body instanceof Node) b.appendChild(body); else b.textContent = body || '';
      const box = $('sheet-actions');
      box.innerHTML = '';
      const close = (v) => { $('sheet').hidden = true; document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') close(null); };
      actions.concat(opts && opts.noClose ? [] : [{ label: '닫기', value: null }]).forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn big ' + (a.cls || '');
        btn.textContent = a.label;
        btn.onclick = () => close(typeof a.value === 'function' ? a.value(b) : a.value);
        box.appendChild(btn);
      });
      $('sheet').onclick = (e) => { if (e.target.id === 'sheet') close(null); };
      document.addEventListener('keydown', onKey);
      $('sheet').hidden = false;
    });
  }

  // ------------------------------------------------------------ 선 그래프 (SVG, 크기에 맞춰 다시 그림)
  function lineChart(box, { labels, series, yFmt, empty }) {
    box.innerHTML = '';
    const svgNS = 'http://www.w3.org/2000/svg';
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    box.appendChild(tip);
    const svg = document.createElementNS(svgNS, 'svg');
    box.appendChild(svg);
    const hasData = series.some((s) => s.values.some((v) => v != null));
    if (!hasData) { box.innerHTML = `<div class="empty">${esc(empty || '데이터가 없습니다')}</div>`; return; }
    let geom = null;
    const draw = () => {
      const W = box.clientWidth, H = box.clientHeight;
      if (!W || !H) return;
      const m = { l: 44, r: 12, t: 12, b: 26 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const all = series.flatMap((s) => s.values).filter((v) => v != null);
      const rawMax = Math.max(...all, 0.01);
      const step = niceStep(rawMax / 4);
      const yMax = Math.ceil(rawMax / step) * step || step;
      const n = labels.length;
      const x = (i) => m.l + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
      const y = (v) => m.t + ih - (v / yMax) * ih;
      let g = '';
      for (let v = 0; v <= yMax + 1e-9; v += step) {
        g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
        g += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${esc(yFmt(v))}</text>`;
      }
      const every = Math.ceil(n / Math.max(2, Math.floor(iw / 44)));
      labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="axis">${esc(l)}</text>`; });
      series.forEach((s) => {
        let d = '', pen = false;
        s.values.forEach((v, i) => {
          if (v == null) { pen = false; return; }
          d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          pen = true;
        });
        g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        s.values.forEach((v, i) => { if (v != null) g += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="var(--card)" stroke="${s.color}" stroke-width="2"/>`; });
      });
      g += `<line class="cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      geom = { x, m, iw, n };
    };
    const ro = new ResizeObserver(draw);
    ro.observe(box);
    draw();
    const move = (e) => {
      if (!geom) return;
      const r = svg.getBoundingClientRect();
      const px = e.clientX - r.left;
      const i = Math.max(0, Math.min(geom.n - 1, Math.round(((px - geom.m.l) / geom.iw) * (geom.n - 1))));
      const cross = svg.querySelector('.cross');
      cross.setAttribute('x1', geom.x(i)); cross.setAttribute('x2', geom.x(i)); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${esc(labels[i])}</b>` + series.map((s) => `<div><i style="background:${s.color}"></i>${esc(s.name)} ${esc(s.values[i] == null ? '-' : yFmt(s.values[i], true))}</div>`).join('');
      tip.hidden = false;
      const tx = geom.x(i) + 12;
      tip.style.left = (tx + tip.offsetWidth > r.width ? geom.x(i) - tip.offsetWidth - 12 : tx) + 'px';
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; const c = svg.querySelector('.cross'); if (c) c.setAttribute('visibility', 'hidden'); });
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  // ------------------------------------------------------------ 막대 (HTML) — 불량·리워크 두 줄
  function barRows(rows, max) {
    if (!rows.length) return '<div class="empty">이 달의 식별표가 없습니다</div>';
    const mx = max || Math.max(...rows.map((r) => Math.max(r.def, r.rw)), 1);
    return `<div class="bars">${rows.map((r) => `
      <div class="bar-row">
        <div class="bar-name">${esc(r.name)}</div>
        <div class="bar-cells">
          <div class="bar-line"><span class="bar def" style="width:${(r.def / mx) * 100}%"></span><b>${R3.fmt(r.def)}</b></div>
          <div class="bar-line"><span class="bar rw" style="width:${(r.rw / mx) * 100}%"></span><b>${R3.fmt(r.rw)}</b></div>
        </div>
      </div>`).join('')}</div>`;
  }

  // ------------------------------------------------------------ 파일: 공유 / 저장 / 복사
  function canShareFiles(files) {
    try { return !!(navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; }
  }
  async function shareFiles(files, title) {
    try {
      await navigator.share({ files, title });
      return 'ok';
    } catch (e) {
      return e && e.name === 'AbortError' ? 'cancel' : 'fail';
    }
  }
  function download(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (x) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const toCsv = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const toTsv = (rows) => rows.map((r) => r.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');

  window.UI = { toast, buzz, sheet, lineChart, barRows, canShareFiles, shareFiles, download, copyText, toCsv, toTsv };
})();
