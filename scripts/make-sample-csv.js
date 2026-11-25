// data/sample_practice.csv 만들기: npm run make:csv
// 샘플 회차(합성 자료) 20건으로 만든 실습 파일이다. 실제 참가자 응답은 내보내지 않는다.
// 열 이름 끝 _R은 역문항(채점할 때 6 − 응답), score_mean은 역문항 처리 후 10문항 평균.
// 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 붙인다.
import { writeFile } from 'node:fs/promises';
import { SAMPLE_ACCOUNTS, SAMPLE_GUEST_ANSWERS, SAMPLE_SESSION } from '../api/_lib/sample-data.js';
import { ITEMS } from '../lib/items.js';
import { scoreResponses } from '../lib/scoring.js';

const header = ['session_code', ...ITEMS.map((it) => `${it.id}${it.reverse ? '_R' : ''}`), 'score_mean'];
const rows = [...SAMPLE_ACCOUNTS.map((a) => a.answers), ...SAMPLE_GUEST_ANSWERS].map((answers) =>
  [SAMPLE_SESSION, ...answers, scoreResponses(answers, ITEMS).toFixed(1)].join(','));
await writeFile(new URL('../data/sample_practice.csv', import.meta.url), '﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n');
console.log(`data/sample_practice.csv: ${rows.length}행`);
