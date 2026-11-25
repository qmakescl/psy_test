// 채점 테스트 — lib/scoring.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../lib/items.js';
import { scoreResponses, binIndex, round1 } from '../lib/scoring.js';

const fill = (fwd, rev) => ITEMS.map((it) => (it.reverse ? rev : fwd));

test('문항은 10개, 역문항 5개', () => {
  assert.equal(ITEMS.length, 10);
  assert.equal(ITEMS.filter((it) => it.reverse).length, 5);
});

test('채점 패턴', () => {
  assert.equal(scoreResponses(Array(10).fill(1), ITEMS), 3);
  assert.equal(scoreResponses(Array(10).fill(5), ITEMS), 3);
  assert.equal(scoreResponses(fill(5, 1), ITEMS), 5);
  assert.equal(scoreResponses(fill(1, 5), ITEMS), 1);
});

test('잘못된 응답은 null', () => {
  assert.equal(scoreResponses(Array(9).fill(3), ITEMS), null);
  assert.equal(scoreResponses([...Array(9).fill(3), 6], ITEMS), null);
  assert.equal(scoreResponses([...Array(9).fill(3), 2.5], ITEMS), null);
  assert.equal(scoreResponses('3333333333', ITEMS), null);
});

test('분포 칸 경계', () => {
  assert.equal(binIndex(1.0), 0);
  assert.equal(binIndex(1.4), 0);
  assert.equal(binIndex(1.45), 1); // 반올림하면 1.5
  assert.equal(binIndex(1.5), 1);
  assert.equal(binIndex(4.4), 6);
  assert.equal(binIndex(4.5), 7);
  assert.equal(binIndex(4.95), 7);
  assert.equal(binIndex(5.0), 7);
  assert.equal(round1(1.45), 1.5);
});
