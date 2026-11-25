// 동작(JS) — 화면 전환, 서버(API)와 주고받기, 그래프 그리기.
// 개발자도구 Network 탭에서 이 파일이 보내는 요청(/api/...)을 직접 볼 수 있다.
import { ITEMS, SCALE } from './lib/items.js';
import { scoreResponses, round1, binIndex } from './lib/scoring.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['start', 'auth', 'items', 'result', 'history'];
const PROGRESS_KEY = 'psy-progress'; // 새로고침해도 진행 상황이 남도록 sessionStorage에 임시 보관

const state = {
  config: null,
  username: null,       // 로그인했으면 아이디
  mode: 'user',         // user: 로그인 응답 / guest: 가입 없이 저장 / nosave: 저장 없이 체험
  answers: Array(ITEMS.length).fill(null),
  index: 0,
  authMode: 'signup',
};

// ---------- 서버와 주고받기 ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    method: options.body ? 'POST' : 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin', // 로그인 쿠키를 함께 보낸다(쿠키 값은 HttpOnly라 JS로 읽을 수 없음)
    ...options.fetch,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ---------- 화면 전환 ----------
function show(name) {
  SCREENS.forEach((s) => { $(`screen-${s}`).hidden = s !== name; });
  window.scrollTo(0, 0);
  if (name === 'start') renderStart();
  if (name === 'items') renderItem();
  if (name === 'history') renderHistory();
}

function setUser(username) {
  state.username = username;
  $('user-box').hidden = !username;
  $('user-name').textContent = username ? `${username}님` : '';
}

// ---------- 1. 시작·동의 ----------
function renderStart() {
  const loggedIn = Boolean(state.username);
  $('logged-in-start').hidden = !loggedIn;
  $('consent-block').hidden = loggedIn;
  $('start-username').textContent = state.username || '';
  if (loggedIn) state.mode = 'user';
}

$('consent').addEventListener('change', (e) => { $('start-consented').disabled = !e.target.checked; });
$('start-consented').addEventListener('click', () => {
  $('guest-block').hidden = !state.config?.allow_guest;
  show('auth');
});
$('start-nosave').addEventListener('click', () => { startItems('nosave'); });
$('start-logged').addEventListener('click', () => { startItems('user'); });

// ---------- 2. 가입·로그인 ----------
function setAuthMode(mode) {
  state.authMode = mode;
  $('tab-signup').setAttribute('aria-selected', String(mode === 'signup'));
  $('tab-login').setAttribute('aria-selected', String(mode === 'login'));
  $('auth-submit').textContent = mode === 'signup' ? '가입하고 시작' : '로그인';
  $('password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  $('auth-error').hidden = true;
}
$('tab-signup').addEventListener('click', () => setAuthMode('signup'));
$('tab-login').addEventListener('click', () => setAuthMode('login'));

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('username').value.trim();
  const password = $('password').value;
  const err = $('auth-error');
  // 형식은 브라우저에서 먼저 확인한다(서버도 다시 확인함)
  if (!/^[A-Za-z0-9]{4,20}$/.test(username)) return showError(err, '아이디는 영문·숫자 4–20자로 정해 주세요.');
  if (password.length < 8) return showError(err, '비밀번호는 8자 이상이에요.');

  $('auth-submit').disabled = true;
  const body = state.authMode === 'signup' ? { username, password, consent: true } : { username, password };
  const { ok, data } = await api(`/api/${state.authMode}`, { body });
  $('auth-submit').disabled = false;
  if (!ok) return showError(err, data.error || '다시 시도해 주세요.');
  $('password').value = '';
  setUser(data.username);
  startItems('user');
});

$('start-guest').addEventListener('click', () => startItems('guest'));

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

// ---------- 3. 문항 ----------
function startItems(mode) {
  const saved = loadProgress();
  state.mode = mode;
  if (saved && saved.mode === mode) {
    state.answers = saved.answers;
    state.index = saved.index;
  } else {
    state.answers = Array(ITEMS.length).fill(null);
    state.index = 0;
  }
  show('items');
}

function renderItem() {
  const i = state.index;
  const item = ITEMS[i];
  const answered = state.answers.filter((v) => v !== null).length;
  $('progress-count').textContent = `${i + 1} / ${ITEMS.length}`;
  $('progress-fill').style.width = `${(answered / ITEMS.length) * 100}%`;
  $('mode-label').textContent = { user: '', guest: '가입 없이 응답', nosave: '저장 없이 체험' }[state.mode];
  $('instruction').textContent = SCALE.instruction;
  $('item-text').textContent = item.text;
  $('options').innerHTML = '';
  SCALE.options.forEach((opt) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option';
    b.setAttribute('aria-pressed', String(state.answers[i] === opt.value));
    b.innerHTML = `<span class="option__num">${opt.value}</span><span></span>`;
    b.lastChild.textContent = opt.label;
    b.addEventListener('click', () => choose(opt.value));
    $('options').appendChild(b);
  });
  $('prev').disabled = i === 0;
  $('finish').disabled = answered < ITEMS.length;
  $('submit-error').hidden = true;
}

function choose(value) {
  state.answers[state.index] = value;
  saveProgress();
  renderItem();
  if (state.index < ITEMS.length - 1) {
    setTimeout(() => { state.index += 1; renderItem(); }, 300); // 0.3초 뒤 다음 문항
  }
}

$('prev').addEventListener('click', () => { if (state.index > 0) { state.index -= 1; renderItem(); } });
$('finish').addEventListener('click', finish);

function saveProgress() {
  try { sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ mode: state.mode, answers: state.answers, index: state.index })); } catch { /* 저장소가 막혀 있어도 계속 진행 */ }
}
function loadProgress() {
  try { return JSON.parse(sessionStorage.getItem(PROGRESS_KEY)); } catch { return null; }
}
function clearProgress() {
  try { sessionStorage.removeItem(PROGRESS_KEY); } catch { /* 무시 */ }
}

// ---------- 4. 결과 ----------
async function finish() {
  const browserScore = scoreResponses(state.answers, ITEMS); // 브라우저에서 먼저 계산
  if (state.mode === 'nosave') {
    clearProgress();
    return showResult(round1(browserScore), null);
  }
  $('finish').disabled = true;
  const { ok, status, data } = await api('/api/submit', {
    body: { answers: state.answers, consent: state.mode === 'guest' ? true : undefined },
  });
  if (!ok) {
    $('finish').disabled = false;
    if (status === 401 && state.mode === 'user') setUser(null);
    return showError($('submit-error'), data.error || '제출하지 못했어요. 다시 시도해 주세요.');
  }
  clearProgress();
  showResult(data.score, round1(browserScore));
}

function showResult(score, browserScore) {
  show('result');
  $('my-score').innerHTML = `${score.toFixed(1)}<small> / 5</small>`;
  $('score-check').textContent = browserScore === null
    ? '이 브라우저가 계산한 점수'
    : `브라우저 계산 ${browserScore.toFixed(1)} · 서버 계산 ${score.toFixed(1)} (같은 lib/scoring.js 사용)`;
  $('guest-notice').hidden = state.mode !== 'guest';
  $('nosave-notice').hidden = state.mode !== 'nosave';
  $('to-history').hidden = state.mode !== 'user';
  state.myBin = binIndex(score);
  loadClassStats();
}

async function loadClassStats() {
  const box = $('class-dist');
  if (state.mode === 'nosave') {
    box.innerHTML = '<p class="muted">저장 없이 체험하면 반 분포를 볼 수 없어요.</p>';
    $('refresh-stats').hidden = true;
    return;
  }
  $('refresh-stats').hidden = false;
  const { ok, data } = await api('/api/stats');
  if (!ok) { box.innerHTML = '<p class="muted">분포를 불러오지 못했어요.</p>'; return; }
  if (data.reason === 'collecting') {
    box.innerHTML = `<p class="muted">지금까지 <b>${data.n}</b>건이 모였어요. 진행자가 응답을 마감하면 반 분포를 볼 수 있어요.</p>`;
    return;
  }
  if (data.reason === 'too_few') {
    box.innerHTML = '<p class="muted">아직 응답이 5건 미만이라 반 분포를 보여드릴 수 없어요. 잠시 뒤 다시 확인해 주세요.</p>';
    return;
  }
  const max = Math.max(...data.distribution.map((d) => d.count), 1);
  box.innerHTML = `<p class="small muted">${data.n}건 · 평균 ${data.mean.toFixed(1)} · 내 점수 구간을 진하게 표시</p><div class="bars"></div>`;
  data.distribution.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = `bar${i === state.myBin ? ' bar--mine' : ''}`;
    row.innerHTML = `<span class="bar__label">${d.label}</span><span class="bar__track"><span class="bar__fill" style="display:block;width:${(d.count / max) * 100}%"></span></span><span class="bar__count">${d.count}</span>`;
    box.querySelector('.bars').appendChild(row);
  });
}
$('refresh-stats').addEventListener('click', loadClassStats);

// ---------- 5. 지난 결과 ----------
async function renderHistory() {
  const list = $('history-list');
  list.innerHTML = '<li class="muted">불러오는 중…</li>';
  const { ok, data } = await api('/api/me');
  if (!ok) { list.innerHTML = '<li class="muted">로그인이 필요해요.</li>'; return; }
  list.innerHTML = data.results.length ? '' : '<li class="muted">아직 결과가 없어요.</li>';
  const fmt = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
  data.results.forEach((r) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${fmt.format(new Date(r.created_at))} <span class="badge"></span></span><b>${r.score.toFixed(1)}</b>`;
    li.querySelector('.badge').textContent = r.session_code;
    list.appendChild(li);
  });
}

// ---------- 공통 ----------
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
$('logout').addEventListener('click', async () => {
  await api('/api/logout', { body: {} });
  setUser(null);
  clearProgress();
  show('start');
});

// 처음 열 때: 공개 설정값과 로그인 상태를 확인한다
async function init() {
  const [config, me] = await Promise.all([api('/api/config'), api('/api/me')]);
  state.config = config.ok ? config.data : { allow_guest: false };
  if (me.ok) setUser(me.data.username);
  show('start');
}
init();
