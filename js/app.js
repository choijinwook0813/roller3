/* 앱 틀: 월 선택, 탭 이동, 알림, 첫 실행, 오프라인(서비스 워커) */
(function () {
  'use strict';
  const { Store, today, monthOf, addMonths, monthLabel } = R3;
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['record', 'prod', 'month', 'settings'];
  const BACKUP_DAYS = 7;

  const firstRun = Store.init();
  void firstRun;
  // 예전 버전에서 넣은 샘플 데이터가 남아 있으면 자동으로 지움 (직접 입력한 기록은 유지)
  if (Store.sampleCount() > 0) Store.removeSample();

  const App = {
    state: { month: monthOf(today()), view: 'record' },
    setMonth(m, silent) {
      this.state.month = m;
      paintMonth();
      if (!silent) this.render();
    },
    render() {
      const el = $('page');
      Pages[this.state.view].render(el);
    },
    refreshAlerts,
  };
  window.App = App;

  function paintMonth() {
    const m = App.state.month;
    const cur = monthOf(today());
    $('m-label').innerHTML = `${monthLabel(m)}${m === cur ? '<small>이번 달</small>' : `<small>${m < cur ? '지난 달' : '다음 달'}</small>`}`;
  }

  function refreshAlerts() {
    $('alert-store').hidden = Store.storageOk;
    const real = Store.hasReal();
    const since = Store.db.lastBackupAt || Store.db.firstRealAt;
    const days = since ? Math.floor((Date.now() - since) / 864e5) : 0;
    const showBackup = real && since && days >= BACKUP_DAYS && App.state.view !== 'settings';
    $('alert-backup').hidden = !showBackup;
    if (showBackup) $('alert-backup-text').textContent = Store.db.lastBackupAt ? `마지막 백업 후 ${days}일 지났습니다` : `아직 백업하지 않았습니다 (첫 기록 후 ${days}일)`;
  }

  function route() {
    const h = location.hash.replace('#', '');
    App.state.view = VIEWS.includes(h) ? h : 'record';
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.v === App.state.view));
    refreshAlerts();
    window.scrollTo(0, 0);
    App.render();
  }

  $('m-prev').addEventListener('click', () => App.setMonth(addMonths(App.state.month, -1)));
  $('m-next').addEventListener('click', () => App.setMonth(addMonths(App.state.month, 1)));
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAlerts(); });

  paintMonth();
  route();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 미리보기 환경 등에서는 무시 */ });
  }
})();
