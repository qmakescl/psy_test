// 문항 정보 — 브라우저(app.js)와 서버(api/submit.js)가 이 파일 하나를 같이 읽는다.
// 출처: International Personality Item Pool(IPIP), Big-Five Factor Markers 중 Factor I(외향성) 10문항
// (Goldberg, 1992). 한국어는 타당화되지 않은 '시연용 번역'이다. 연구 측정에 쓰지 않는다.

export const SCALE = {
  id: 'ipip-extraversion-10',
  version: 'ipip-e10-ko-demo-1.1', // 문항이나 채점이 바뀌면 이 값을 올린다(응답 표에 함께 저장됨)
  title: '외향성 10문항 (IPIP)',
  instruction: '다음 문장이 평소의 나를 얼마나 잘 설명하는지 골라 주세요.',
  source: 'International Personality Item Pool (ipip.ori.org), Goldberg (1992). 시연용 한국어 번역 — 타당화되지 않음.',
  options: [
    { value: 1, label: '나와 전혀 맞지 않는다' },
    { value: 2, label: '대체로 맞지 않는다' },
    { value: 3, label: '맞는 것도 맞지 않는 것도 아니다' },
    { value: 4, label: '대체로 맞는다' },
    { value: 5, label: '매우 잘 맞는다' },
  ],
};

// reverse: true 인 문항은 채점할 때 6 − 응답 으로 뒤집는다(역문항).
export const ITEMS = [
  { id: 'E01', reverse: false, text: '나는 모임에서 분위기를 띄우는 사람이다.', original: 'Am the life of the party.' },
  { id: 'E02', reverse: true,  text: '나는 말을 많이 하지 않는 편이다.', original: "Don't talk a lot." },
  { id: 'E03', reverse: false, text: '나는 사람들과 함께 있으면 편안하다.', original: 'Feel comfortable around people.' },
  { id: 'E04', reverse: true,  text: '나는 앞에 나서지 않는 편이다.', original: 'Keep in the background.' },
  { id: 'E05', reverse: false, text: '나는 먼저 대화를 시작하는 편이다.', original: 'Start conversations.' },
  { id: 'E06', reverse: true,  text: '나는 할 말이 별로 없다.', original: 'Have little to say.' },
  { id: 'E07', reverse: false, text: '나는 모임에서 여러 사람과 두루 이야기를 나눈다.', original: 'Talk to a lot of different people at parties.' },
  { id: 'E08', reverse: true,  text: '나는 사람들의 주목을 끄는 것을 좋아하지 않는다.', original: "Don't like to draw attention to myself." },
  { id: 'E09', reverse: false, text: '나는 주목의 중심에 서는 것을 꺼리지 않는다.', original: "Don't mind being the center of attention." },
  { id: 'E10', reverse: true,  text: '나는 낯선 사람들과 있을 때 조용한 편이다.', original: 'Am quiet around strangers.' },
];
