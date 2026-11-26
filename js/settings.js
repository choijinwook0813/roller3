/* 설정 / 데이터: 내보내기 · 백업/복원 · 분류 규칙 · 작업자 · 샘플 */
(function () {
  'use strict';
  const { Store, PROCESSES, KIND_NAME, SHIFT_NAME, esc, fmt, fmtPct, monthDays, monthLabel, today } = R3;
  const $ = (id) => document.getElementById(id);
  const stampOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  // ------------------------------------------------------------ CSV 데이터
  function dailyRows(m) {
    const cur = R3.calc.month(m);
    const g = (s) => [`${s} 생산량`, `${s} 양품`, `${s} 불량`, `${s} 리워크`, `${s} 불량률`];
    const head = ['날짜', ...g('주간'), ...g('야간'), ...g('일계'), '일계 양품률', '일계 리워크율', '경고'];
    const vals = (a, has) => (has ? [a.prod, a.good, a.def, a.rw, fmtPct(a.defRate)] : ['', '', '', '', '']);
    const rows = cur.days.map((d) => {
      const p = Store.prodOf(d.date);
      const any = d.T.n > 0 || p.D != null || p.N != null;
      return [d.date, ...vals(d.D, any), ...vals(d.N, any), ...vals(d.T, any), any ? fmtPct(d.T.goodRate) : '', any ? fmtPct(d.T.rwRate) : '',
        d.warn.length ? `${d.warn.map((s) => SHIFT_NAME[s]).join('·')} 생산량 없음` : ''];
    });
    const t = cur.tot;
    rows.push(['합계', ...vals(t.D, true), ...vals(t.N, true), ...vals(t.T, true), fmtPct(t.T.goodRate), fmtPct(t.T.rwRate), '']);
    return [head, ...rows];
  }
  function tagRows(m) {
    const tags = Store.tagsIn(m).sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift) || a.createdAt - b.createdAt);
    return [['날짜', '주야', '공정', '사유', '수량', '구분', '입력시각'],
      ...tags.map((t) => [t.date, SHIFT_NAME[t.shift], t.process, t.reason, t.qty, KIND_NAME[t.kind], stampOf(t.createdAt)])];
  }
  const csvFile = (rows, name) => new File([UI.toCsv(rows)], name, { type: 'text/csv' });
  const files = (m) => ({
    daily: () => csvFile(dailyRows(m), `Roller3_${m}_daily.csv`),
    tags: () => csvFile(tagRows(m), `Roller3_${m}_tags.csv`),
  });
  function backupFile() {
    return new File([Store.backupJson()], `Roller3_backup_${today().replace(/-/g, '')}.json`, { type: 'application/json' });
  }
  function markBackup() { Store.db.lastBackupAt = Date.now(); Store.save(); App.refreshAlerts(); }

  // ------------------------------------------------------------ 화면
  function render(el) {
    const m = App.state.month;
    const probe = [new File(['x'], 'x.csv', { type: 'text/csv' })];
    const canShare = UI.canShareFiles(probe);
    const nTags = Store.tagsIn(m).length;
    const lb = Store.db.lastBackupAt;
    el.innerHTML = `
      <div class="set-grid">
        <div class="stack">
          <div class="card stack">
            <h3 style="margin:0">내보내기 · ${esc(monthLabel(m))}</h3>
            ${canShare ? `<button type="button" class="btn big primary" id="x-both">CSV 2개 한 번에 공유 (카톡·메일)</button>` : ''}
            <div class="exp"><b>일별 현황표</b><div class="sub">날짜 × 주간/야간/일계 생산량·양품·불량·리워크·불량률, 맨 아래 합계</div>
              <div class="btn-row">${canShare ? '<button type="button" class="btn" data-x="daily" data-a="share">공유</button>' : ''}<button type="button" class="btn" data-x="daily" data-a="save">파일 저장</button><button type="button" class="btn" data-x="daily" data-a="copy">엑셀용 복사</button></div></div>
            <div class="exp"><b>식별표 원본 (${fmt(nTags)}건)</b><div class="sub">식별표 1건 = 1행: 날짜, 주야, 공정, 사유, 수량, 구분, 입력시각</div>
              <div class="btn-row">${canShare ? '<button type="button" class="btn" data-x="tags" data-a="share">공유</button>' : ''}<button type="button" class="btn" data-x="tags" data-a="save">파일 저장</button><button type="button" class="btn" data-x="tags" data-a="copy">엑셀용 복사</button></div></div>
            <div class="meta">CSV는 엑셀에서 한글이 깨지지 않게 저장됩니다. "엑셀용 복사"는 엑셀 칸에 바로 붙여넣을 수 있습니다.</div>
          </div>

          <div class="card stack">
            <h3 style="margin:0">전체 백업 / 복원</h3>
            <div class="sub">마지막 백업: <b>${lb ? `${esc(stampOf(lb))} (${Math.floor((Date.now() - lb) / 864e5)}일 전)` : '없음'}</b> · 7일이 지나면 위에 알림이 뜹니다.</div>
            <div class="btn-row">
              ${UI.canShareFiles([new File(['{}'], 'b.json', { type: 'application/json' })]) ? '<button type="button" class="btn primary" id="b-share">백업 공유</button>' : ''}
              <button type="button" class="btn" id="b-save">백업 파일 저장</button>
              <label class="btn" style="display:flex;align-items:center;justify-content:center">복원<input type="file" id="b-restore" accept=".json,application/json" hidden></label>
            </div>
            <div class="meta">백업 파일(JSON)에는 모든 식별표·생산량·분류 규칙이 들어 있습니다. 카톡 나에게 보내기나 메일로 보관하세요.</div>
          </div>


        </div>

        <div class="card">
          <div class="sec-head"><h3>리워크 / 불량 분류 규칙</h3><button type="button" class="btn" id="r-reset">기본값으로</button></div>
          <div class="meta" style="margin:0 0 10px">공정별 사유 버튼과 분류입니다. 바꾸면 기존 식별표에도 적용할지 묻습니다.</div>
          <div id="rules"></div>
        </div>
      </div>
      <div class="card" style="margin-top:14px"><div class="sec-head"><h3 style="margin:0">모든 데이터 삭제</h3><button type="button" class="btn ghost-danger" id="all-del">전체 삭제</button></div>
        <div class="meta">이 폰에 저장된 식별표·생산량을 모두 지웁니다. 먼저 백업하세요.</div></div>`;

    drawRules(el);

    // 내보내기
    el.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', async () => {
      const kind = b.dataset.x;
      const a = b.dataset.a;
      if (a === 'copy') {
        const rows = kind === 'daily' ? dailyRows(m) : tagRows(m);
        UI.toast((await UI.copyText(UI.toTsv(rows))) ? `복사했습니다 (${rows.length - 1}행). 엑셀에 붙여넣으세요` : '복사가 막혀 있습니다. 파일 저장을 이용하세요', 'info');
        return;
      }
      const f = files(m)[kind]();
      if (a === 'save') { UI.download(f); UI.toast(`${f.name} 저장 (다운로드 폴더)`); return; }
      const r = await UI.shareFiles([f], f.name);
      if (r === 'fail') UI.toast('공유가 안 됩니다. 파일 저장을 이용하세요', 'error');
    }));
    const both = $('x-both');
    if (both) both.addEventListener('click', async () => {
      const fs = [files(m).daily(), files(m).tags()];
      if (!UI.canShareFiles(fs)) { UI.toast('이 폰은 파일 2개 동시 공유가 안 됩니다. 하나씩 공유하세요', 'error'); return; }
      const r = await UI.shareFiles(fs, `롤러 #3 ${monthLabel(m)}`);
      if (r === 'fail') UI.toast('공유가 안 됩니다. 파일 저장을 이용하세요', 'error');
    });

    // 백업
    const bs = $('b-share');
    if (bs) bs.addEventListener('click', async () => {
      const r = await UI.shareFiles([backupFile()], '롤러 #3 백업');
      if (r === 'ok') { markBackup(); UI.toast('백업을 공유했습니다'); render(el); } else if (r === 'fail') UI.toast('공유가 안 됩니다. 파일 저장을 이용하세요', 'error');
    });
    $('b-save').addEventListener('click', () => { const f = backupFile(); UI.download(f); markBackup(); UI.toast(`${f.name} 저장 (다운로드 폴더)`); render(el); });
    $('b-restore').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      let obj;
      try { obj = JSON.parse(await f.text()); } catch (x) { UI.toast('백업 파일을 읽을 수 없습니다', 'error'); return; }
      if (!obj || obj.version !== 2 || !Array.isArray(obj.tags)) { UI.toast('이 앱의 백업 파일이 아닙니다', 'error'); return; }
      const ok = await UI.sheet('백업으로 복원할까요?', `백업: 식별표 ${fmt(obj.tags.length)}건 · 생산량 ${fmt(Object.keys(obj.prod || {}).length)}일\n현재: 식별표 ${fmt(Store.db.tags.length)}건\n현재 데이터는 모두 백업 내용으로 바뀝니다.`, [{ label: '복원', value: true, cls: 'danger' }]);
      if (!ok) return;
      try { Store.restore(obj); UI.toast('복원했습니다'); App.render(); App.refreshAlerts(); } catch (x) { UI.toast(String(x.message || x), 'error'); }
    });

    // 규칙 초기화
    $('r-reset').addEventListener('click', async () => {
      const ok = await UI.sheet('분류 규칙을 기본값으로 되돌릴까요?', '직접 추가한 사유도 지워집니다. 기존 식별표의 분류는 바뀌지 않습니다.', [{ label: '기본값으로', value: true, cls: 'danger' }]);
      if (ok) { Store.resetRules(); UI.toast('기본값으로 되돌렸습니다'); drawRules(el); }
    });

    $('all-del').addEventListener('click', async () => {
      const ok = await UI.sheet('모든 데이터를 삭제할까요?', `식별표 ${fmt(Store.db.tags.length)}건과 생산량을 모두 지웁니다. 되돌릴 수 없습니다.`, [{ label: '모두 삭제', value: true, cls: 'danger' }]);
      if (!ok) return;
      Store.db.tags = []; Store.db.prod = {};
      Store.save();
      UI.toast('모두 삭제했습니다', 'info');
      App.refreshAlerts();
      render(el);
    });
  }

  function drawRules(el) {
    const box = el.querySelector('#rules');
    box.innerHTML = PROCESSES.map((p) => {
      const rules = Store.db.rules[p] || {};
      const def = R3.DEFAULT_RULES[p] || {};
      return `<div class="rule-proc" data-p="${esc(p)}"><h4>${esc(p)}</h4>
        ${Object.keys(rules).map((r) => `<div class="rule-row" data-r="${esc(r)}">
          <span class="nm">${esc(r)}${def[r] == null ? '<small>추가함</small>' : def[r] !== rules[r] ? '<small>변경함</small>' : ''}</span>
          <div class="kt"><button type="button" data-k="rework" class="${rules[r] === 'rework' ? 'on' : ''}">리워크</button><button type="button" data-k="defect" class="${rules[r] === 'defect' ? 'on' : ''}">불량</button></div>
          <button type="button" class="xbtn" data-del aria-label="${esc(r)} 버튼 삭제">×</button></div>`).join('')}
        <div class="addrow"><input class="txt" placeholder="사유 추가" autocomplete="off"><div class="kt" style="width:128px"><button type="button" data-add="rework">+리워크</button><button type="button" data-add="defect">+불량</button></div></div>
      </div>`;
    }).join('');
    box.onclick = async (e) => {
      const procEl = e.target.closest('.rule-proc');
      if (!procEl) return;
      const p = procEl.dataset.p;
      const addBtn = e.target.closest('[data-add]');
      if (addBtn) {
        const inp = procEl.querySelector('.addrow input');
        const name = inp.value.trim();
        if (!name) { inp.focus(); return; }
        Store.db.rules[p][name] = addBtn.dataset.add;
        Store.save();
        drawRules(el);
        return;
      }
      const row = e.target.closest('.rule-row');
      if (!row) return;
      const r = row.dataset.r;
      if (e.target.closest('[data-del]')) {
        const ok = await UI.sheet(`'${r}' 버튼을 삭제할까요?`, `${p} 공정의 사유 버튼에서 빠집니다. 기존 식별표는 그대로 남습니다.`, [{ label: '삭제', value: true, cls: 'danger' }]);
        if (ok) { delete Store.db.rules[p][r]; Store.save(); drawRules(el); }
        return;
      }
      const kb = e.target.closest('[data-k]');
      if (!kb || Store.db.rules[p][r] === kb.dataset.k) return;
      const k = kb.dataset.k;
      Store.db.rules[p][r] = k;
      const affected = Store.db.tags.filter((t) => t.process === p && t.reason === r && t.kind !== k);
      if (affected.length) {
        const apply = await UI.sheet('기존 식별표도 바꿀까요?', `${p} · ${r} 식별표 ${affected.length}건이 지금 '${KIND_NAME[k === 'rework' ? 'defect' : 'rework']}'(으)로 되어 있습니다.`,
          [{ label: `기존 ${affected.length}건도 '${KIND_NAME[k]}'(으)로 변경`, value: true, cls: 'primary' }, { label: '앞으로 입력할 것만', value: false }], { noClose: true });
        if (apply) affected.forEach((t) => { t.kind = k; t.updatedAt = Date.now(); });
      }
      Store.save();
      UI.toast(`${p} · ${r} → ${KIND_NAME[k]}`);
      drawRules(el);
    };
  }

  window.Pages = window.Pages || {};
  Pages.settings = { render, dailyRows, tagRows };
})();
