// 집계 규칙 — 참가자용(/api/stats)과 진행자용(/api/admin/stats)이 같이 쓴다.
//
// 1. 대상: 로그인 사용자는 사람마다 마지막 응답 1건, 게스트 응답은 사람을 구분할 수 없어 1건씩 센다(단위 '건').
// 2. 공개 시점: 현재 회차는 진행자가 '응답 마감'을 누른 뒤에만 분포·평균을 공개한다.
//    응답을 받는 동안 집계가 바뀌면, 한 건이 늘 때의 변화로 그 사람의 점수를 거꾸로 계산할 수 있기 때문이다.
//    지난 회차·샘플 회차는 새 응답이 들어오지 않으므로 바로 볼 수 있다.
// 3. 분포·평균·문항별 통계: 5건 이상일 때만.
// 4. 집단별 평균: 한 변수에서 응답이 있는 집단 중 하나라도 5명 미만이면 그 변수 전체를 숨긴다
//    (일부만 숨기면 전체 평균에서 빼서 숨긴 집단의 평균을 계산해낼 수 있다).
// 5. 통계분석: 10건 이상일 때만. 30건 미만이면 small_sample 표시.
import { ITEMS } from '../../lib/items.js';
import { BINS, binIndex, keyed, round1 } from '../../lib/scoring.js';
import * as P from '../../lib/psychometrics.js';

export const MIN_CELL = 5;
export const MIN_ANALYSIS = 10;
export const STABLE_N = 30;

const ITEM_KEYS = ITEMS.map((_, i) => `item_${String(i + 1).padStart(2, '0')}`);
const LABELS = {
  age_group: { '20s': '20대', '30s': '30대', '40s': '40대', '50s+': '50대 이상', na: '응답하지 않음' },
  gender: { female: '여', male: '남', na: '응답하지 않음' },
};

export const answersOf = (row) => ITEM_KEYS.map((k) => row[k]);

// 규칙 1: 집계 대상 고르기
export function targetRows(rows) {
  const latest = new Map();
  const guests = [];
  for (const r of rows) {
    if (!r.user_id) { guests.push(r); continue; }
    const prev = latest.get(r.user_id);
    if (!prev || r.created_at > prev.created_at) latest.set(r.user_id, r);
  }
  return [...latest.values(), ...guests].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// 규칙 2: 이 회차의 집계를 지금 보여줘도 되는가
export function isVisible(sessionCode, settings) {
  return sessionCode !== settings.sessionCode || settings.phase === 'closed';
}

function distribution(rows) {
  const counts = BINS.map(() => 0);
  rows.forEach((r) => { counts[binIndex(r.score_mean)] += 1; });
  return BINS.map((label, i) => ({ label, count: counts[i] }));
}

// 참가자 결과 화면용
export function publicView(rows, visible) {
  const n = rows.length;
  if (!visible) return { n, visible: false, reason: 'collecting' };
  if (n < MIN_CELL) return { n, visible: true, reason: 'too_few' };
  return { n, visible: true, mean: round1(P.mean(rows.map((r) => r.score_mean))), distribution: distribution(rows) };
}

// 규칙 4
export function groupMeans(rows, variable) {
  const withValue = rows.filter((r) => r[variable]);
  if (withValue.length === 0) return { available: false };
  const groups = new Map();
  withValue.forEach((r) => {
    if (!groups.has(r[variable])) groups.set(r[variable], []);
    groups.get(r[variable]).push(r.score_mean);
  });
  if ([...groups.values()].some((g) => g.length < MIN_CELL)) {
    return { available: true, hidden: true, reason: `5명 미만인 집단이 있어 ${variable === 'gender' ? '성별' : '연령대'} 전체를 숨겼습니다` };
  }
  return {
    available: true,
    hidden: false,
    groups: [...groups.entries()].map(([key, xs]) => ({ key, label: LABELS[variable][key] || key, n: xs.length, mean: round1(P.mean(xs)) })),
  };
}

// 1분 단위 응답 수와 누적 수(최근 120분까지)
export function trend(rows) {
  if (rows.length === 0) return [];
  const minute = (r) => Math.floor(Date.parse(r.created_at) / 60_000);
  const first = minute(rows[0]);
  const last = minute(rows[rows.length - 1]);
  const counts = new Map();
  rows.forEach((r) => counts.set(minute(r), (counts.get(minute(r)) || 0) + 1));
  const fmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const out = [];
  let cum = 0;
  for (let m = first; m <= last; m++) {
    const c = counts.get(m) || 0;
    cum += c;
    out.push({ time: fmt.format(new Date(m * 60_000)), count: c, cumulative: cum });
  }
  return out.slice(-120);
}

// 진행자 ① 현황
export function liveView(rows, visible) {
  const base = { n: rows.length, visible, trend: trend(rows) };
  if (!visible || rows.length < MIN_CELL) return { ...base, reason: !visible ? 'collecting' : 'too_few' };
  return {
    ...base,
    mean: round1(P.mean(rows.map((r) => r.score_mean))),
    distribution: distribution(rows),
    groups: { age_group: groupMeans(rows, 'age_group'), gender: groupMeans(rows, 'gender') },
  };
}

const fix = (x, d = 2) => (x === null || x === undefined ? null : Number(x.toFixed(d)));

// 진행자 ② 문항별 통계
export function itemsView(rows, visible) {
  if (!visible || rows.length < MIN_CELL) return { n: rows.length, visible, reason: !visible ? 'collecting' : 'too_few' };
  return {
    n: rows.length,
    visible,
    items: ITEMS.map((item, j) => {
      const raw = rows.map((r) => answersOf(r)[j]);
      return {
        id: item.id, text: item.text, reverse: item.reverse,
        mean_raw: fix(P.mean(raw)),
        mean_keyed: fix(P.mean(raw.map((v) => keyed(v, item)))),
        sd: fix(P.sd(raw)),
        counts: [1, 2, 3, 4, 5].map((v) => raw.filter((x) => x === v).length),
      };
    }),
  };
}

// 문항별 응답을 열(문항) 단위로 모은다. keyedScores=true면 역문항을 뒤집는다
function columns(rows, keyedScores) {
  return ITEMS.map((item, j) => rows.map((r) => (keyedScores ? keyed(answersOf(r)[j], item) : answersOf(r)[j])));
}

// 진행자 ③ 통계분석 — 계산식은 lib/psychometrics.js
export function analysisView(rows, visible) {
  const n = rows.length;
  if (!visible || n < MIN_ANALYSIS) return { n, visible, reason: !visible ? 'collecting' : 'too_few' };
  const cols = columns(rows, true);
  const rRest = P.itemRestCorrelations(cols);
  const aDel = P.alphaIfDeleted(cols);
  const scores = rows.map((r) => r.score_mean);
  const d = P.describe(scores);
  return {
    n, visible,
    small_sample: n < STABLE_N,
    alpha: fix(P.cronbachAlpha(cols)),
    alpha_raw: fix(P.cronbachAlpha(columns(rows, false))),
    mean_inter_item_r: fix(P.meanInterItemCorrelation(cols)),
    items: ITEMS.map((item, j) => ({ id: item.id, text: item.text, reverse: item.reverse, r_rest: fix(rRest[j]), alpha_if_deleted: fix(aDel[j]) })),
    scale: { n: d.n, mean: fix(d.mean), sd: fix(d.sd), min: fix(d.min), max: fix(d.max) },
  };
}

// 진행자 ④ 회차 비교 — 회차마다 규칙 1–5를 따로 적용
export function sessionsView(allRows, settings) {
  const bySession = new Map();
  allRows.forEach((r) => {
    if (!bySession.has(r.session_code)) bySession.set(r.session_code, []);
    bySession.get(r.session_code).push(r);
  });
  if (!bySession.has(settings.sessionCode)) bySession.set(settings.sessionCode, []);
  return [...bySession.entries()].map(([code, rows]) => {
    const t = targetRows(rows);
    const visible = isVisible(code, settings);
    const out = { session_code: code, current: code === settings.sessionCode, n: t.length, visible };
    if (visible && t.length >= MIN_CELL) {
      const s = t.map((r) => r.score_mean);
      out.mean = fix(P.mean(s));
      out.sd = fix(P.sd(s));
    }
    if (visible && t.length >= MIN_ANALYSIS) out.alpha = fix(P.cronbachAlpha(columns(t, true)));
    return out;
  }).sort((a, b) => (b.current - a.current) || a.session_code.localeCompare(b.session_code));
}
