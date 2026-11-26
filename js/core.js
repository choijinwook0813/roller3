/* 공정·사유·분류 규칙, 날짜/숫자 유틸, 저장소, 집계 계산 */
(function () {
  'use strict';

  // ------------------------------------------------------------ 공정·사유·기본 분류
  const PROCESSES = ['황삭', '중삭', '단면', '사상', 'S/F', '기타'];
  const R = 'rework', D = 'defect';
  const GRIND = { '드레싱 초품': R, '외관NG': D };
  const FACE = { 'R값NG': D, '과연삭': D, '품질세팅품': D, '흑피': D, '외관NG': D };
  const SF = { '품질세팅품': R, '진원도NG': R, '크라우닝NG': R, '상호차NG': R, '테이퍼NG': R, '외관NG': R, '조도NG': D, '미S/F': D };
  const ETC = { '낙추품': D, '충돌품': D };
  const DEFAULT_RULES = { '황삭': GRIND, '중삭': GRIND, '단면': FACE, '사상': GRIND, 'S/F': SF, '기타': ETC };
  const KIND_NAME = { rework: '리워크', defect: '불량' };
  const SHIFT_NAME = { D: '주간', N: '야간' };

  // ------------------------------------------------------------ 날짜·숫자
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const monthOf = (s) => s.slice(0, 7);
  const addMonths = (m, n) => { const d = parse(m + '-01'); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
  const monthDays = (m) => { const out = []; const d = parse(m + '-01'); while (ymd(d).slice(0, 7) === m) { out.push(ymd(d)); d.setDate(d.getDate() + 1); } return out; };
  const monthLabel = (m) => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const dow = (s) => DOW[parse(s).getDay()];
  const dayLabel = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))} (${dow(s)})`;
  const fmt = (n) => (n == null || isNaN(n) ? '-' : Math.round(n).toLocaleString('ko-KR'));
  const rate = (x, prod) => (prod > 0 ? (x / prod) * 100 : null);
  const fmtPct = (r) => (r == null || !isFinite(r) ? '-' : r.toFixed(2) + '%');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toInt = (v) => { const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : n; };

  // ------------------------------------------------------------ 저장소
  const KEY = 'r3.v2';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function blankDb() {
    return { version: 2, migrations: ['etc-only'], tags: [], prod: {}, rules: clone(DEFAULT_RULES), workers: [], seq: 1, lastBackupAt: null, firstRealAt: null, prefs: {}, sampleLoaded: false };
  }
  let storageOk = true;
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.version === 2 && Array.isArray(d.tags)) return Object.assign(blankDb(), d);
    } catch (e) { /* 손상·비활성 */ }
    return null;
  }
  try { localStorage.setItem('r3.test', '1'); localStorage.removeItem('r3.test'); } catch (e) { storageOk = false; }

  // 이전 버전 데이터 변환: 단면#1·단면#2 → 단면, 기타 공정 추가
  function migrate(d) {
    let changed = false;
    ['단면#1', '단면#2'].forEach((old) => {
      if (d.rules[old]) {
        d.rules['단면'] = { ...(d.rules['단면'] || {}), ...d.rules[old] };
        delete d.rules[old];
        changed = true;
      }
    });
    d.tags.forEach((t) => { if (t.process === '단면#1' || t.process === '단면#2') { t.process = '단면'; changed = true; } });
    PROCESSES.forEach((p) => { if (!d.rules[p]) { d.rules[p] = clone(DEFAULT_RULES[p]); changed = true; } });
    // 충돌품·낙추품은 '기타' 공정에만 (한 번만 실행: 기존 버튼 삭제, 기존 식별표는 기타로 이동)
    d.migrations = d.migrations || [];
    if (!d.migrations.includes('etc-only')) {
      const ETC_REASONS = ['충돌품', '낙추품'];
      Object.keys(d.rules).forEach((p) => { if (p !== '기타') ETC_REASONS.forEach((r) => { delete d.rules[p][r]; }); });
      d.tags.forEach((t) => { if (t.process !== '기타' && ETC_REASONS.includes(t.reason)) { t.process = '기타'; t.kind = d.rules['기타'][t.reason] || t.kind; } });
      d.migrations.push('etc-only');
      changed = true;
    }
    if (changed) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }
  }

  const Store = {
    db: null,
    get storageOk() { return storageOk; },
    init() {
      const d = load();
      if (d) { this.db = d; migrate(d); return false; }
      this.db = blankDb();
      return true; // 처음 실행
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.db)); return true; } catch (e) { storageOk = false; return false; }
    },
    markReal() { if (!this.db.firstRealAt) this.db.firstRealAt = Date.now(); },
    // 분류
    kindOf(process, reason) { const r = this.db.rules[process]; return (r && r[reason]) || null; },
    reasons(process) { return Object.keys(this.db.rules[process] || {}); },
    // 식별표
    tagsOn(date) { return this.db.tags.filter((t) => t.date === date); },
    tagsIn(month) { return this.db.tags.filter((t) => t.date.slice(0, 7) === month); },
    upsertTag(t) {
      const now = Date.now();
      if (t.id) {
        const i = this.db.tags.findIndex((x) => x.id === t.id);
        if (i >= 0) { this.db.tags[i] = { ...this.db.tags[i], ...t, sample: false, updatedAt: now }; }
      } else {
        this.db.tags.push({ ...t, id: this.db.seq++, createdAt: now, updatedAt: now });
      }
      this.markReal();
      if (t.worker) this.touchWorker(t.worker);
      return this.save();
    },
    deleteTag(id) { this.db.tags = this.db.tags.filter((t) => t.id !== id); return this.save(); },
    touchWorker(name) {
      const w = this.db.workers.filter((x) => x !== name);
      w.unshift(name);
      this.db.workers = w.slice(0, 50);
    },
    // 생산량
    prodOf(date) { return this.db.prod[date] || {}; },
    setProd(date, shift, val) {
      const p = { ...(this.db.prod[date] || {}) };
      p[shift] = val;
      delete p.sample;
      if (p.D == null && p.N == null) delete this.db.prod[date]; else this.db.prod[date] = p;
      this.markReal();
      return this.save();
    },
    // 샘플
    sampleCount() {
      return this.db.tags.filter((t) => t.sample).length + Object.values(this.db.prod).filter((p) => p.sample).length;
    },
    removeSample() {
      this.db.tags = this.db.tags.filter((t) => !t.sample);
      Object.keys(this.db.prod).forEach((d) => { if (this.db.prod[d].sample) delete this.db.prod[d]; });
      return this.save();
    },
    hasReal() { return this.db.tags.some((t) => !t.sample) || Object.values(this.db.prod).some((p) => !p.sample); },
    resetRules() { this.db.rules = clone(DEFAULT_RULES); return this.save(); },
    backupJson() {
      const { prefs, ...rest } = this.db;
      return JSON.stringify({ app: 'roller3-defects', exportedAt: new Date().toISOString(), ...rest }, null, 1);
    },
    restore(obj) {
      if (!obj || obj.version !== 2 || !Array.isArray(obj.tags) || typeof obj.prod !== 'object') throw new Error('백업 파일 형식이 아닙니다');
      const d = Object.assign(blankDb(), obj);
      delete d.app; delete d.exportedAt;
      d.prefs = this.db.prefs;
      d.migrations = obj.migrations || [];
      migrate(d); // 예전 형식 백업도 현재 공정 구성으로 변환
      this.db = d;
      return this.save();
    },
  };

  // ------------------------------------------------------------ 집계
  const zero = () => ({ prod: 0, def: 0, rw: 0, n: 0, missing: false });
  function finish(a) {
    a.good = a.prod > 0 ? a.prod - a.def : null; // 생산량이 없으면 양품 계산 불가
    a.goodRate = rate(a.good, a.prod);
    a.defRate = rate(a.def, a.prod);
    a.rwRate = rate(a.rw, a.prod);
    return a;
  }
  function day(date, tagsByDate) {
    const p = Store.prodOf(date);
    const out = { D: zero(), N: zero(), T: zero() };
    ['D', 'N'].forEach((s) => { out[s].prod = p[s] || 0; out[s].missing = p[s] == null; });
    (tagsByDate[date] || []).forEach((t) => {
      const k = t.kind === 'rework' ? 'rw' : 'def';
      out[t.shift][k] += t.qty; out[t.shift].n++;
    });
    ['prod', 'def', 'rw', 'n'].forEach((k) => { out.T[k] = out.D[k] + out.N[k]; });
    out.T.missing = out.D.missing && out.N.missing;
    // 식별표는 있는데 그 주야 생산량이 없음
    out.warn = ['D', 'N'].filter((s) => out[s].n > 0 && !out[s].prod);
    ['D', 'N', 'T'].forEach((s) => finish(out[s]));
    return out;
  }
  function groupByDate(tags) { const g = {}; tags.forEach((t) => { (g[t.date] = g[t.date] || []).push(t); }); return g; }
  function month(m) {
    const tags = Store.tagsIn(m);
    const g = groupByDate(tags);
    const days = monthDays(m).map((d) => ({ date: d, ...day(d, g) }));
    const tot = { D: zero(), N: zero(), T: zero() };
    days.forEach((d) => ['D', 'N', 'T'].forEach((s) => ['prod', 'def', 'rw', 'n'].forEach((k) => { tot[s][k] += d[s][k]; })));
    ['D', 'N', 'T'].forEach((s) => finish(tot[s]));
    return { days, tot, tags, byDate: g };
  }
  // 공정별 / 사유별 (불량·리워크)
  function breakdown(tags, key) {
    const m = {};
    tags.forEach((t) => {
      const k = t[key];
      m[k] = m[k] || { name: k, def: 0, rw: 0 };
      m[k][t.kind === 'rework' ? 'rw' : 'def'] += t.qty;
    });
    return Object.values(m).sort((a, b) => (b.def + b.rw) - (a.def + a.rw));
  }

  window.R3 = {
    PROCESSES, DEFAULT_RULES, KIND_NAME, SHIFT_NAME, Store,
    ymd, parse, today, addDays, monthOf, addMonths, monthDays, monthLabel, dow, dayLabel, fmt, rate, fmtPct, esc, toInt, clone,
    calc: { day, month, breakdown, groupByDate },
  };
})();
