// 집계 규칙 테스트 — api/_lib/stats.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { targetRows, isVisible, publicView, groupMeans, analysisView } from '../api/_lib/stats.js';

const row = (user_id, minute, score, extra = {}) => ({
  user_id, score_mean: score, created_at: new Date(Date.UTC(2026, 10, 26, 1, minute)).toISOString(),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`item_${String(i + 1).padStart(2, '0')}`, 3])), ...extra,
});

test('규칙 1: 사용자당 마지막 응답 1건, 게스트는 건별', () => {
  const t = targetRows([row('a', 1, 2), row('a', 5, 4), row('b', 2, 3), row(null, 3, 1), row(null, 4, 1)]);
  assert.equal(t.length, 4);
  assert.equal(t.find((r) => r.user_id === 'a').score_mean, 4);
});

test('규칙 2: 현재 회차는 마감 후에만 공개, 다른 회차는 바로', () => {
  const s = { sessionCode: 'NOW', phase: 'collecting' };
  assert.equal(isVisible('NOW', s), false);
  assert.equal(isVisible('SAMPLE', s), true);
  assert.equal(isVisible('NOW', { ...s, phase: 'closed' }), true);
  const five = [1, 2, 3, 4, 5].map((i) => row(`u${i}`, i, 3));
  assert.deepEqual(publicView(five, false), { n: 5, visible: false, reason: 'collecting' });
  assert.equal(publicView(five.slice(0, 4), true).reason, 'too_few');
  assert.equal(publicView(five, true).distribution.length, 8);
});

test('규칙 4: 한 집단이라도 5명 미만이면 변수 전체를 숨김', () => {
  const rows = [
    ...[1, 2, 3, 4, 5].map((i) => row(`f${i}`, i, 3, { gender: 'female' })),
    ...[1, 2, 3, 4].map((i) => row(`m${i}`, 10 + i, 4, { gender: 'male' })),
  ];
  assert.equal(groupMeans(rows, 'gender').hidden, true);
  const more = [...rows, row('m5', 20, 4, { gender: 'male' })];
  const g = groupMeans(more, 'gender');
  assert.equal(g.hidden, false);
  assert.equal(g.groups.length, 2);
  assert.equal(groupMeans(rows, 'age_group').available, false);
});

test('규칙 5: 통계분석은 10건 이상, 30건 미만이면 small_sample', () => {
  const nine = Array.from({ length: 9 }, (_, i) => row(`u${i}`, i, 3));
  assert.equal(analysisView(nine, true).reason, 'too_few');
  const ten = Array.from({ length: 10 }, (_, i) => row(`u${i}`, i, 3, { item_01: (i % 5) + 1, item_03: ((i + 1) % 5) + 1 }));
  const a = analysisView(ten, true);
  assert.equal(a.small_sample, true);
  assert.ok('alpha' in a);
});
