// 채점 로직 — 이 파일 하나를 브라우저·서버·테스트가 같이 쓴다.
// 브라우저는 결과를 바로 보여주려고 계산하고, 서버는 같은 함수로 다시 계산해서 저장한다.

// 결과 분포의 8칸(점수를 소수 첫째 자리로 반올림한 뒤 나눈다)
export const BINS = ['1.0–1.4', '1.5–1.9', '2.0–2.4', '2.5–2.9', '3.0–3.4', '3.5–3.9', '4.0–4.4', '4.5–5.0'];

// 응답 하나가 1–5 사이 정수인지 확인
export function isValidAnswer(v) {
  return Number.isInteger(v) && v >= 1 && v <= 5;
}

// 역문항이면 6 − 응답으로 뒤집는다
export function keyed(value, item) {
  return item.reverse ? 6 - value : value;
}

// answers: [1–5 정수 10개], items: lib/items.js의 ITEMS
// 반환: 역문항을 처리한 10문항 평균(반올림하지 않은 값). 응답이 잘못되면 null
export function scoreResponses(answers, items) {
  if (!Array.isArray(answers) || answers.length !== items.length) return null;
  if (!answers.every(isValidAnswer)) return null;
  let sum = 0;
  answers.forEach((v, i) => { sum += keyed(v, items[i]); });
  return sum / items.length;
}

// 소수 첫째 자리 반올림(0.5는 올림). 1.45 같은 값의 부동소수점 오차를 피하려고 정밀도를 먼저 줄인다.
export function round1(x) {
  return Math.round(Number((x * 10).toPrecision(12))) / 10;
}

// 점수 → 분포 칸 번호(0–7)
export function binIndex(score) {
  const r10 = Math.round(Number((score * 10).toPrecision(12))); // 10–50
  return Math.min(BINS.length - 1, Math.max(0, Math.floor((r10 - 10) / 5)));
}
