/* 기록 화면: 식별표 1장 = 1건 */
(function () {
  'use strict';
  const { Store, PROCESSES, KIND_NAME, SHIFT_NAME, esc, fmt, toInt, today, addDays, monthOf, dayLabel } = R3;
  const $ = (id) => document.getElementById(id);

  let form = null;
  let returnTo = null;
  let dupArmed = false;

  function blank(date) {
    const p = Store.db.prefs || {};
    return { id: null, date: date || today(), shift: p.shift || 'D', process: '', reason: '', custom: false, kindChoice: null, qty: '' };
  }
  function ensure() {
    if (!form) form = blank();
    const m = App.state.month;
    if (!form.id && monthOf(form.date) !== m) form.date = monthOf(today()) === m ? today() : m + '-01';
  }

  function currentKind() {
    if (!form.process || !form.reason) return null;
    if (!form.custom) return Store.kindOf(form.process, form.reason) || form.kindChoice;
    return form.kindChoice || Store.kindOf(form.process, form.reason);
  }

  function render(el) {
    ensure();
    const editing = !!form.id;
    el.innerHTML = `
      <div class="rec-grid">
        <div class="stack">
          ${editing ? `<div class="edit-note"><span>식별표 수정 중</span><button type="button" class="btn" id="r-cancel">취소</button></div>` : ''}
          <div class="card stack tagform" id="tf">
            <div class="datenav">
              <button type="button" class="dn-arrow" id="r-prevday" aria-label="전날">‹</button>
              <label class="date-btn" for="r-date"><b id="r-dlabel"></b><small id="r-dsub"></small><input type="date" id="r-date" aria-label="식별표 날짜"></label>
              <button type="button" class="dn-arrow" id="r-nextday" aria-label="다음날">›</button>
            </div>
            <button type="button" class="today-link" id="r-today">오늘로 돌아가기</button>
            <div class="seg" id="r-shift" role="group" aria-label="주야"><button type="button" data-v="D">주간</button><button type="button" data-v="N">야간</button></div>
            <div>
              <div class="lbl">공정</div>
              <div class="proc" id="r-proc" role="group" aria-label="공정">${PROCESSES.map((p) => `<button type="button" class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>
            </div>
            <div>
              <div class="lbl">사유</div>
              <div class="chips" id="r-reason"></div>
              <div id="r-custom" hidden style="margin-top:6px" class="stack">
                <input class="txt" id="r-custom-text" placeholder="사유 직접 입력" autocomplete="off">
                <div class="kindpick" id="r-kindpick"><button type="button" data-k="rework">리워크</button><button type="button" data-k="defect">불량</button></div>
              </div>
            </div>
            <div>
              <div class="lbl">수량 (개)</div>
              <label class="qtybox" for="r-qty"><input id="r-qty" inputmode="numeric" pattern="[0-9]*" placeholder="0" autocomplete="off" enterkeyhint="done"><em>개</em></label>
              <div class="quick" id="r-quick"><button type="button" data-a="100">+100</button><button type="button" data-a="500">+500</button><button type="button" data-a="1000">+1000</button><button type="button" data-a="0">지움</button></div>
            </div>
            <div class="kindrow"><span class="lbl" style="margin:0">분류</span><span id="r-kind"></span></div>
            <div class="save"><button type="button" class="btn big primary" id="r-save"></button></div>
          </div>
        </div>
        <div class="card rec-list">
          <h3 id="r-list-title"></h3>
          <div class="listsum" id="r-list-sum"></div>
          <div class="taglist" id="r-list"></div>
        </div>
      </div>`;
    bind(el);
    paint();
  }

  // 전체 상태를 화면에 반영
  function paint() {
    $('r-date').value = form.date;
    $('r-dlabel').textContent = dayLabel(form.date);
    const t = today();
    const sub = $('r-dsub');
    const diff = Math.round((R3.parse(t) - R3.parse(form.date)) / 864e5);
    sub.textContent = diff === 0 ? '오늘' : diff === 1 ? '어제' : diff === 2 ? '그저께' : diff > 0 ? `${diff}일 전 · 누르면 달력` : '미래 날짜';
    sub.classList.toggle('not-today', form.date !== t);
    $('r-nextday').disabled = form.date >= t;
    $('r-today').hidden = form.date === t;
    setSeg('r-shift', form.shift);


    document.querySelectorAll('#r-proc .chip').forEach((b) => b.classList.toggle('on', b.dataset.p === form.process));
    paintReasons();
    $('r-qty').value = form.qty;
    paintKind();
    paintList();
  }

  function paintReasons() {
    const box = $('r-reason');
    if (!form.process) {
      box.innerHTML = '<span class="sub">공정을 먼저 고르세요</span>';
      $('r-custom').hidden = true;
      return;
    }
    const list = Store.reasons(form.process);
    box.innerHTML = list.map((r) => {
      const k = Store.kindOf(form.process, r);
      return `<button type="button" class="chip k-${k} ${!form.custom && r === form.reason ? 'on' : ''}" data-r="${esc(r)}"><span class="k k-dot-${k}"></span>${esc(r)}</button>`;
    }).join('') + `<button type="button" class="chip add ${form.custom ? 'on' : ''}" data-r="">직접 입력</button>`;
    $('r-custom').hidden = !form.custom;
    if (form.custom) {
      if ($('r-custom-text').value !== form.reason) $('r-custom-text').value = form.reason;
      const k = currentKind();
      document.querySelectorAll('#r-kindpick button').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    }
  }

  function paintKind() {
    const k = currentKind();
    const tf = $('tf');
    tf.classList.toggle('rework', k === 'rework');
    tf.classList.toggle('defect', k === 'defect');
    $('r-kind').innerHTML = k ? `<span class="kind-badge ${k}">${KIND_NAME[k]}</span>`
      : `<span class="sub">${form.process && form.reason ? '리워크/불량을 선택하세요' : '공정·사유를 고르면 자동 분류'}</span>`;
    resetDup();
  }
  function resetDup() {
    dupArmed = false;
    const b = $('r-save');
    b.classList.remove('dup');
    b.textContent = form.id ? '수정 저장' : '저장 후 다음 식별표';
  }

  function paintList() {
    const list = Store.tagsOn(form.date).sort((a, b) => a.shift.localeCompare(b.shift) || b.createdAt - a.createdAt);
    $('r-list-title').textContent = `${dayLabel(form.date)} 식별표 ${list.length}건`;
    const def = list.filter((t) => t.kind === 'defect').reduce((a, t) => a + t.qty, 0);
    const rw = list.filter((t) => t.kind === 'rework').reduce((a, t) => a + t.qty, 0);
    $('r-list-sum').innerHTML = list.length ? `<span class="d">불량 ${fmt(def)}</span><span class="r">리워크 ${fmt(rw)}</span>` : '';
    $('r-list').innerHTML = list.length ? list.map(tagHtml).join('') : '<div class="empty">이 날짜에 입력한 식별표가 없습니다</div>';
  }

  function tagHtml(t) {
    return `<button type="button" class="tag ${t.kind}" data-id="${t.id}">
      <span class="sh">${SHIFT_NAME[t.shift]}</span>
      <span class="what">${esc(t.process)} · ${esc(t.reason)}</span>
      <span class="q">${fmt(t.qty)}<small>${KIND_NAME[t.kind]}</small></span>
    </button>`;
  }

  function setSeg(id, v) { document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset.v === v)); }

  function bind(el) {
    $('r-date').addEventListener('change', (e) => {
      if (!e.target.value) return;
      form.date = e.target.value;
      App.setMonth(monthOf(form.date), true);
      paint();
    });
    const moveDay = (n) => {
      const nd = n === 0 ? today() : addDays(form.date, n);
      if (nd > today()) return;
      form.date = nd;
      App.setMonth(monthOf(form.date), true);
      paint();
      UI.buzz(8);
    };
    $('r-prevday').addEventListener('click', () => moveDay(-1));
    $('r-nextday').addEventListener('click', () => moveDay(1));
    $('r-today').addEventListener('click', () => moveDay(0));
    $('r-shift').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { form.shift = b.dataset.v; setSeg('r-shift', form.shift); resetDup(); } });
    $('r-proc').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (form.process !== b.dataset.p) { form.process = b.dataset.p; form.reason = ''; form.custom = false; form.kindChoice = null; }
      document.querySelectorAll('#r-proc .chip').forEach((x) => x.classList.toggle('on', x.dataset.p === form.process));
      paintReasons(); paintKind();
    });
    $('r-reason').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('add')) { form.custom = true; form.reason = ''; form.kindChoice = null; paintReasons(); paintKind(); $('r-custom-text').focus(); return; }
      form.custom = false; form.reason = b.dataset.r; form.kindChoice = null;
      paintReasons(); paintKind();
      UI.buzz(8);
    });
    $('r-custom-text').addEventListener('input', (e) => {
      form.reason = e.target.value.trim();
      const known = Store.kindOf(form.process, form.reason);
      if (known && !form.kindChoice) document.querySelectorAll('#r-kindpick button').forEach((b) => b.classList.toggle('on', b.dataset.k === known));
      paintKind();
      e.target.classList.remove('bad');
    });
    $('r-kindpick').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      form.kindChoice = b.dataset.k;
      document.querySelectorAll('#r-kindpick button').forEach((x) => x.classList.toggle('on', x === b));
      paintKind();
    });
    $('r-qty').addEventListener('input', (e) => {
      const v = e.target.value.replace(/[^0-9]/g, '');
      if (v !== e.target.value) e.target.value = v;
      form.qty = v;
      e.target.closest('.qtybox').classList.remove('bad');
      resetDup();
    });
    $('r-qty').addEventListener('focus', (e) => e.target.select());
    $('r-quick').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const a = Number(b.dataset.a);
      form.qty = a ? String((toInt(form.qty) || 0) + a) : '';
      $('r-qty').value = form.qty;
      $('r-qty').closest('.qtybox').classList.remove('bad');
      resetDup();
      UI.buzz(8);
    });
    $('r-save').addEventListener('click', save);
    const cancel = $('r-cancel');
    if (cancel) cancel.addEventListener('click', () => { const back = returnTo; form = blank(form.date); returnTo = null; if (back) location.hash = back; else App.render(); });
    $('r-list').addEventListener('click', (e) => { const b = e.target.closest('.tag'); if (b) tagMenu(Number(b.dataset.id), null); });
  }

  function save() {
    const qty = toInt(form.qty);
    const kind = currentKind();
    const fail = (msg, node) => { UI.buzz([60, 40, 60]); UI.toast(msg, 'error'); if (node) { node.classList.add('bad'); node.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
    if (!form.date) return fail('날짜를 고르세요');
    if (!form.process) return fail('공정을 고르세요', $('r-proc'));
    if (!form.reason) return fail(form.custom ? '사유를 입력하세요' : '사유를 고르세요', form.custom ? $('r-custom-text') : $('r-reason'));
    if (!kind) return fail('리워크/불량을 선택하세요', $('r-kindpick'));
    if (!qty) return fail('수량을 입력하세요', $('r-qty').closest('.qtybox'));
    const dup = Store.db.tags.find((t) => t.id !== form.id && t.date === form.date && t.shift === form.shift && t.process === form.process
      && t.reason === form.reason && t.qty === qty);
    if (dup && !dupArmed) {
      dupArmed = true;
      const b = $('r-save');
      b.classList.add('dup');
      b.textContent = '같은 식별표가 이미 있음 · 그래도 저장';
      UI.buzz([40, 30, 40]);
      return;
    }
    // 목록에 없던 조합은 고른 분류를 규칙으로 기억
    if (!Store.kindOf(form.process, form.reason) || (form.custom && form.kindChoice)) {
      Store.db.rules[form.process] = Store.db.rules[form.process] || {};
      Store.db.rules[form.process][form.reason] = kind;
    }
    const wasEdit = !!form.id;
    const ok = Store.upsertTag({ id: form.id || undefined, date: form.date, shift: form.shift, process: form.process, reason: form.reason, qty, kind });
    if (!ok) return fail('저장하지 못했습니다. 저장 공간을 확인하세요');
    Store.db.prefs = { ...Store.db.prefs, shift: form.shift };
    Store.save();
    UI.buzz(40);
    UI.toast(`${wasEdit ? '수정됨' : '저장됨'} · ${SHIFT_NAME[form.shift]} ${form.process} ${form.reason} ${fmt(qty)}개 · ${KIND_NAME[kind]}`);
    const keep = { date: form.date, shift: form.shift };
    form = { ...blank(), ...keep };
    App.refreshAlerts();
    if (wasEdit && returnTo) { const back = returnTo; returnTo = null; location.hash = back; return; }
    returnTo = null;
    App.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 식별표 메뉴 (수정/삭제) — 월별 현황에서도 사용
  async function tagMenu(id, back) {
    const t = Store.db.tags.find((x) => x.id === id);
    if (!t) return;
    const act = await UI.sheet(`${dayLabel(t.date)} · ${SHIFT_NAME[t.shift]}`,
      `${t.process} · ${t.reason} · ${fmt(t.qty)}개 · ${KIND_NAME[t.kind]}`,
      [{ label: '수정', value: 'edit', cls: 'primary' }, { label: '삭제', value: 'del', cls: 'ghost-danger' }]);
    if (act === 'edit') {
      const known = Store.reasons(t.process).includes(t.reason);
      form = { id: t.id, date: t.date, shift: t.shift, process: t.process, reason: t.reason, custom: !known, kindChoice: t.kind, qty: String(t.qty) };
      returnTo = back;
      App.setMonth(monthOf(t.date), true);
      if (location.hash === '#record') App.render(); else location.hash = '#record';
    } else if (act === 'del') {
      const ok = await UI.sheet('이 식별표를 삭제할까요?', `${t.process} · ${t.reason} · ${fmt(t.qty)}개\n삭제하면 되돌릴 수 없습니다.`, [{ label: '삭제', value: true, cls: 'danger' }]);
      if (ok) { Store.deleteTag(t.id); UI.buzz(40); UI.toast('삭제했습니다', 'info'); App.render(); }
    }
  }

  window.Pages = window.Pages || {};
  Pages.record = { render, tagMenu, tagHtml };
})();
