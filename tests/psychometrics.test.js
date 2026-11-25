// 통계분석 기준값 테스트 — lib/psychometrics.js (계획서 9절 기준 자료)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../lib/psychometrics.js';
import { ITEMS } from '../lib/items.js';
import { keyed } from '../lib/scoring.js';
import { SAMPLE_ACCOUNTS, SAMPLE_GUEST_ANSWERS } from '../api/_lib/sample-data.js';

const rows = [[1, 2, 2, 1], [2, 2, 3, 2], [3, 3, 3, 4], [4, 4, 5, 4], [5, 4, 4, 5], [2, 3, 2, 2]];
const cols = rows[0].map((_, j) => rows.map((r) => r[j]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.0005, `${a} ≠ ${b}`);

test('기준 자료: 평균·표준편차', () => {
  [2.833, 3.0, 3.167, 3.0].forEach((v, j) => near(P.mean(cols[j]), v));
  [1.472, 0.894, 1.169, 1.549].forEach((v, j) => near(P.sd(cols[j]), v));
});

test('기준 자료: 수정 문항-총점 상관, 문항 제거 시 α, 전체 α, 평균 문항 간 상관', () => {
  P.itemRestCorrelations(cols).forEach((r, j) => near(r, [0.974, 0.894, 0.814, 0.926][j]));
  P.alphaIfDeleted(cols).forEach((a, j) => near(a, [0.897, 0.944, 0.947, 0.920][j]));
  near(P.cronbachAlpha(cols), 0.946);
  near(P.meanInterItemCorrelation(cols), 0.852);
});

test('모든 응답이 같으면 α·상관은 계산 불가, 표준편차는 0', () => {
  const same = [[3, 3, 3], [3, 3, 3], [3, 3, 3]];
  assert.equal(P.cronbachAlpha(same), null);
  assert.equal(P.pearson(same[0], same[1]), null);
  assert.equal(P.sd(same[0]), 0);
});

test('상수 문항이 하나 있어도 α는 계산된다(관련 상관만 계산 불가)', () => {
  const withConst = [...cols, [3, 3, 3, 3, 3, 3]];
  assert.notEqual(P.cronbachAlpha(withConst), null);
  assert.equal(P.itemRestCorrelations(withConst)[4], null);
  assert.equal(P.meanInterItemCorrelation(withConst), null);
  assert.notEqual(P.alphaIfDeleted(withConst)[4], null);
});

test('음수 α도 그대로 돌려준다', () => {
  const opposite = [[1, 2, 3, 4, 5], [5, 4, 3, 1, 2]]; // 완전히 반대면 총점 분산이 0이라 null
  assert.ok(P.cronbachAlpha(opposite) < 0);
});

test('역문항이 섞인 샘플 자료: 역처리 전 α < 역처리 후 α', () => {
  const answers = [...SAMPLE_ACCOUNTS.map((a) => a.answers), ...SAMPLE_GUEST_ANSWERS];
  const raw = ITEMS.map((_, j) => answers.map((r) => r[j]));
  const key = ITEMS.map((it, j) => answers.map((r) => keyed(r[j], it)));
  assert.ok(P.cronbachAlpha(raw) < P.cronbachAlpha(key));
});

test('응답자가 2명 미만이면 null', () => {
  assert.equal(P.sd([3]), null);
  assert.equal(P.cronbachAlpha([[1], [2]]), null);
});
