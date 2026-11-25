// 통계분석 계산식 — 진행자 화면 '통계분석' 탭의 숫자는 모두 여기서 나온다.
// 순수 함수만 둔다(DB·화면과 무관). 서버 집계(api/_lib/stats.js)와 테스트가 같이 쓴다.
// 계산할 수 없는 값은 null 로 돌려주고, 화면은 '계산 불가'로 표시한다.

export function mean(xs) {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// 표본 분산(n−1로 나눔). 응답이 2개 미만이면 null. 모두 같으면 0.
export function variance(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

export function sd(xs) {
  const v = variance(xs);
  return v === null ? null : Math.sqrt(v);
}

// 피어슨 상관. 둘 중 하나라도 모두 같은 값(분산 0)이면 정의되지 않으므로 null.
export function pearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

// 행(응답자)마다 합계
function rowTotals(columns) {
  return columns[0].map((_, i) => columns.reduce((a, col) => a + col[i], 0));
}

// Cronbach's α = k/(k−1) × (1 − Σ문항분산 / 총점분산)
// columns: 문항별 응답 배열의 배열 [[문항1 응답들], [문항2 응답들], …]
// 조건: 문항 2개 이상, 응답자 2명 이상, 총점 분산 > 0. 음수 α도 그대로 돌려준다.
export function cronbachAlpha(columns) {
  const k = columns.length;
  if (k < 2 || columns[0].length < 2) return null;
  const totalVar = variance(rowTotals(columns));
  if (!totalVar) return null;
  const sumItemVar = columns.reduce((a, col) => a + variance(col), 0);
  return (k / (k - 1)) * (1 - sumItemVar / totalVar);
}

// 수정 문항-총점 상관: 각 문항과 '그 문항을 뺀 나머지 문항 합'의 상관
export function itemRestCorrelations(columns) {
  return columns.map((col, j) => {
    const rest = rowTotals(columns.filter((_, i) => i !== j));
    return pearson(col, rest);
  });
}

// 문항 제거 시 α: 그 문항을 빼고 다시 계산한 α
export function alphaIfDeleted(columns) {
  return columns.map((_, j) => cronbachAlpha(columns.filter((_, i) => i !== j)));
}

// 평균 문항 간 상관: 모든 문항 쌍 상관의 평균. 정의되지 않는 쌍이 하나라도 있으면 null.
export function meanInterItemCorrelation(columns) {
  const rs = [];
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const r = pearson(columns[i], columns[j]);
      if (r === null) return null;
      rs.push(r);
    }
  }
  return rs.length ? mean(rs) : null;
}

// 기술통계: N, 평균, 표준편차, 최솟값, 최댓값
export function describe(xs) {
  if (xs.length === 0) return { n: 0, mean: null, sd: null, min: null, max: null };
  return { n: xs.length, mean: mean(xs), sd: sd(xs), min: Math.min(...xs), max: Math.max(...xs) };
}
