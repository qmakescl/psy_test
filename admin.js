// 진행자 화면 동작. 모든 숫자는 /api/admin/stats?view=… 에서 받는다(계산은 서버가 한다).
// 개별 응답과 아이디는 서버가 보내 주지 않으므로 이 화면 어디에도 나오지 않는다.

const $ = (id) => document.getElementById(id);
const state = { view: 'live', session: null, header: null, timer: null };
const REFRESH_MS = 3000; // ① 현황 탭만 3초마다 갱신

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x, d = 2) => (x === null || x === undefined ? '<span class="muted">계산 불가</span>' : Number(x).toFixed(d));

// ---------- 로그인 ----------
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { ok, data } = await api('/api/admin/login', { password: $('admin-password').value });
  $('admin-password').value = '';
  if (!ok) { $('login-error').textContent = data.error; $('login-error').hidden = false; return; }
  $('login-error').hidden = true;
  enterDashboard();
});

$('logout').addEventListener('click', async () => {
  await api('/api/logout', {});
  stopTimer();
  showLogin();
});

function showLogin() {
  $('login-view').hidden = false;
  $('dash-view').hidden = true;
  $('logout').hidden = true;
}

async function enterDashboard() {
  $('login-view').hidden = true;
  $('dash-view').hidden = false;
  $('logout').hidden = false;
  await loadSessions();
  load();
}

// ---------- 설정 ----------
function renderHeader(h) {
  state.header = h;
  $('current-session').textContent = h.current_session;
  const closed = h.phase === 'closed';
  $('phase-badge').textContent = closed ? '마감 · 집계 공개 중' : '응답 받는 중 · 건수만 공개';
  $('phase-badge').className = `badge ${closed ? 'badge--ok' : 'badge--warn'}`;
  $('toggle-phase').textContent = closed ? '응답 다시 받기' : '응답 마감하고 집계 공개';
  $('allow-guest').checked = h.allow_guest;
}

async function saveSettings(body) {
  const { ok, data } = await api('/api/admin/settings', body);
  if (!ok) {
    if (data && data.error) { $('settings-error').textContent = data.error; $('settings-error').hidden = false; }
    return;
  }
  $('settings-error').hidden = true;
  await loadSessions();
  load();
}

$('toggle-phase').addEventListener('click', () => {
  saveSettings({ phase: state.header.phase === 'closed' ? 'collecting' : 'closed' });
});
$('allow-guest').addEventListener('change', (e) => saveSettings({ allow_guest: e.target.checked }));
$('session-save').addEventListener('click', () => {
  const code = $('session-input').value.trim();
  if (code) saveSettings({ session_code: code });
  $('session-input').value = '';
});

// 보는 회차 목록(현재 회차 + DB에 있는 다른 회차, 샘플 포함)
async function loadSessions() {
  const { ok, status, data } = await api('/api/admin/stats?view=sessions');
  if (status === 401) return showLogin();
  if (!ok) return;
  renderHeader(data);
  const sel = $('view-session');
  const keep = state.session;
  sel.innerHTML = '';
  data.sessions.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.session_code;
    o.textContent = `${s.session_code}${s.current ? ' (현재)' : ''}${s.session_code === 'SAMPLE' ? ' — 샘플' : ''}`;
    sel.appendChild(o);
  });
  sel.value = data.sessions.some((s) => s.session_code === keep) ? keep : data.current_session;
  state.session = sel.value;
}
$('view-session').addEventListener('change', (e) => { state.session = e.target.value; load(); });

// ---------- 탭 ----------
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  state.view = b.dataset.view;
  load();
}));
$('recalc').addEventListener('click', () => load());

function stopTimer() { clearTimeout(state.timer); state.timer = null; }

// 한 번 불러오고, ① 현황 탭이면 '응답이 온 뒤' 3초 후에 다시 부른다(요청이 겹치지 않게)
async function load() {
  stopTimer();
  const view = state.view;
  const q = view === 'sessions' ? 'view=sessions' : `view=${view}&session=${encodeURIComponent(state.session || '')}`;
  const { ok, status, data } = await api(`/api/admin/stats?${q}`);
  if (status === 401) return showLogin();
  if (!ok || view !== state.view) return;
  renderHeader(data);
  $('recalc-row').hidden = !(view === 'items' || view === 'analysis');
  ({ live: renderLive, items: renderItems, analysis: renderAnalysis, sessions: renderSessions })[view](data);
  if (view === 'live') {
    state.timer = setTimeout(() => { if (document.visibilityState === 'visible') load(); else state.timer = setTimeout(load, REFRESH_MS); }, REFRESH_MS);
  }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.view === 'live' && !$('dash-view').hidden) load(); });

function hiddenNote(data, need) {
  if (data.reason === 'collecting') return '<p class="note note--warn">응답을 받는 동안에는 건수만 보여줍니다. 한 건씩 늘 때 평균이 바뀌는 것을 보면 방금 낸 사람의 점수를 거꾸로 계산할 수 있기 때문입니다. ‘응답 마감하고 집계 공개’를 누르면 나타납니다.</p>';
  if (data.reason === 'too_few') return `<p class="note">대상이 ${data.n}건이라 아직 보여줄 수 없습니다(${need}건 이상 필요).</p>`;
  return '';
}

// ---------- ① 현황 ----------
function renderLive(d) {
  const maxT = Math.max(...d.trend.map((t) => t.count), 1);
  const trend = d.trend.length
    ? `<div class="trend" aria-label="1분 단위 응답 수">${d.trend.map((t) => `<span class="trend__col" title="${t.time} · ${t.count}건 (누적 ${t.cumulative})" style="height:${(t.count / maxT) * 100}%"></span>`).join('')}</div>
       <p class="small muted">${esc(d.trend[0].time)} – ${esc(d.trend[d.trend.length - 1].time)} · 막대 하나가 1분, 누적 ${d.trend[d.trend.length - 1].cumulative}건</p>`
    : '<p class="muted">아직 응답이 없습니다.</p>';

  let body = '';
  if (d.distribution) {
    const max = Math.max(...d.distribution.map((x) => x.count), 1);
    const bars = d.distribution.map((x) => `<div class="bar"><span class="bar__label">${x.label}</span><span class="bar__track"><span class="bar__fill" style="display:block;width:${(x.count / max) * 100}%;background:var(--admin)"></span></span><span class="bar__count">${x.count}</span></div>`).join('');
    body = `<div class="grid2">
      <div class="card"><h3>점수 분포</h3><div class="bars">${bars}</div></div>
      <div class="card"><h3>집단별 평균</h3>${groupHtml('연령대', d.groups.age_group)}${groupHtml('성별', d.groups.gender)}</div></div>`;
  } else {
    body = hiddenNote(d, 5);
  }
  $('panel').innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="kpi__v">${d.n}</div><div class="kpi__l">응답(건) — 사람당 마지막 1건, 게스트는 건별</div></div>
      <div class="kpi"><div class="kpi__v">${d.mean !== undefined ? d.mean.toFixed(1) : '–'}</div><div class="kpi__l">평균 점수(1–5)</div></div>
    </div>
    <div class="card"><h3>시간 추이</h3>${trend}</div>
    ${body}`;
}

function groupHtml(title, g) {
  if (!g.available) return `<p class="small"><b>${title}</b> <span class="muted">— 이 회차 응답에는 ${title} 정보가 없습니다(실제 참가자는 받지 않음, 샘플 회차에서 확인).</span></p>`;
  if (g.hidden) return `<p class="small"><b>${title}</b> <span class="muted">— ${esc(g.reason)}</span></p>`;
  return `<p class="small"><b>${title}</b></p><div class="table-wrap"><table><tr><th>집단</th><th>N</th><th>평균</th></tr>${g.groups.map((x) => `<tr><td>${esc(x.label)}</td><td class="num">${x.n}</td><td class="num">${x.mean.toFixed(1)}</td></tr>`).join('')}</table></div>`;
}

// ---------- ② 문항별 통계 ----------
const STACK_COLORS = ['var(--danger)', 'var(--warn)', 'var(--border-strong)', 'var(--accent)', 'var(--admin)'];
function renderItems(d) {
  if (!d.items) { $('panel').innerHTML = hiddenNote(d, 5); return; }
  const rows = d.items.map((it) => {
    const total = it.counts.reduce((a, b) => a + b, 0) || 1;
    const stack = it.counts.map((c, i) => `<span title="${i + 1}점 ${c}건" style="width:${(c / total) * 100}%;background:${STACK_COLORS[i]}"></span>`).join('');
    return `<tr><td><b>${it.id}</b>${it.reverse ? ' <span class="badge">역</span>' : ''}<div class="small muted">${esc(it.text)}</div></td>
      <td class="num">${num(it.mean_raw)}</td><td class="num">${num(it.mean_keyed)}</td><td class="num">${num(it.sd)}</td><td><div class="stack">${stack}</div></td></tr>`;
  }).join('');
  $('panel').innerHTML = `<p class="small muted">${d.n}건. 역문항(역)은 원점수 평균이 정방향 문항과 반대쪽에 놓입니다. 막대는 1점(왼쪽)–5점(오른쪽) 응답 비율.</p>
    <div class="table-wrap"><table><tr><th>문항</th><th>원점수 평균</th><th>역처리 후</th><th>표준편차</th><th>응답 분포 1→5</th></tr>${rows}</table></div>`;
}

// ---------- ③ 통계분석 ----------
function renderAnalysis(d) {
  if (d.alpha === undefined) { $('panel').innerHTML = hiddenNote(d, 10); return; }
  const rows = d.items.map((it) => {
    const r = it.r_rest;
    const w = r === null ? 0 : Math.max(0, Math.min(1, r)) * 100;
    const up = it.alpha_if_deleted !== null && d.alpha !== null && it.alpha_if_deleted > d.alpha;
    return `<tr><td><b>${it.id}</b>${it.reverse ? ' <span class="badge">역</span>' : ''}</td>
      <td class="num">${num(r)}${r !== null && r < 0.3 ? ' <span class="badge badge--warn">낮음</span>' : ''}</td>
      <td><div class="rbar"><div class="rbar__fill" style="width:${w}%"></div><div class="rbar__ref" title="0.30"></div></div></td>
      <td class="num">${num(it.alpha_if_deleted)}${up ? ' ↑' : ''}</td></tr>`;
  }).join('');
  $('panel').innerHTML = `
    <p class="note ${d.small_sample ? 'note--warn' : ''}">계산 시연용 — 연구 결론에 쓰지 않습니다.${d.small_sample ? ' 표본이 작아(30건 미만) 값이 불안정합니다.' : ''}</p>
    <div class="kpis">
      <div class="kpi"><div class="kpi__v">${d.n}</div><div class="kpi__l">대상(건)</div></div>
      <div class="kpi"><div class="kpi__v">${num(d.alpha)}</div><div class="kpi__l">Cronbach's α (역문항 처리 후)</div></div>
      <div class="kpi"><div class="kpi__v">${num(d.alpha_raw)}</div><div class="kpi__l">α — 역문항을 뒤집지 않으면</div></div>
    </div>
    <p class="small muted">같은 응답이라도 역문항(E02·E04·E06·E08·E10)을 뒤집지 않고 계산하면 α가 달라집니다. 채점 방향이 문항 간 공분산에 영향을 주기 때문입니다.</p>
    <details>
      <summary>문항별 지표 더 보기</summary>
      <p class="small muted">수정 문항-총점 상관: 각 문항과 ‘그 문항을 뺀 나머지 9문항 합’의 상관. 점선은 0.30. <b>이 값만으로 문항을 빼지 않습니다.</b> ↑는 그 문항을 빼면 α가 오른다는 뜻.</p>
      <div class="table-wrap"><table><tr><th>문항</th><th>수정 문항-총점 상관</th><th></th><th>문항 제거 시 α</th></tr>${rows}</table></div>
      <div class="kpis" style="margin-top:12px">
        <div class="kpi"><div class="kpi__v">${num(d.mean_inter_item_r)}</div><div class="kpi__l">평균 문항 간 상관(45쌍)</div></div>
        <div class="kpi"><div class="kpi__v">${num(d.scale.mean)}</div><div class="kpi__l">척도 점수 평균 (SD ${num(d.scale.sd)})</div></div>
        <div class="kpi"><div class="kpi__v">${num(d.scale.min, 1)}–${num(d.scale.max, 1)}</div><div class="kpi__l">최솟값–최댓값</div></div>
      </div>
    </details>
    <details>
      <summary>계산식 보기 (lib/psychometrics.js)</summary>
      <div class="formula">cronbachAlpha: α = k/(k−1) × (1 − Σ문항분산 / 총점분산), 분산은 n−1로 나눔. 총점 분산이 0이면 계산 불가
itemRestCorrelations: r(문항 j, 문항 j를 뺀 나머지 합) — 피어슨 상관, 한쪽이 모두 같은 값이면 계산 불가
alphaIfDeleted: 문항 j를 빼고 다시 계산한 α
meanInterItemCorrelation: 45쌍 상관의 평균 — 계산 불가인 쌍이 있으면 계산 불가
describe: N, 평균, 표준편차, 최솟값, 최댓값 (점수 = 역문항 처리 후 10문항 평균)</div>
    </details>`;
}

// ---------- ④ 회차 비교 ----------
function renderSessions(d) {
  const rows = d.sessions.map((s) => `<tr><td><b>${esc(s.session_code)}</b>${s.current ? ' <span class="badge">현재</span>' : ''}${s.session_code === 'SAMPLE' ? ' <span class="badge">샘플</span>' : ''}</td>
    <td class="num">${s.n}</td><td class="num">${s.mean !== undefined ? num(s.mean) : '–'}</td><td class="num">${s.sd !== undefined ? num(s.sd) : '–'}</td><td class="num">${s.alpha !== undefined ? num(s.alpha) : '–'}</td></tr>`).join('');
  $('panel').innerHTML = `<p class="small muted">회차마다 같은 규칙을 적용합니다: 현재 회차는 마감 후에만, 평균·SD는 5건 이상, α는 10건 이상. ‘–’는 아직 보여줄 수 없다는 뜻입니다.</p>
    <div class="table-wrap"><table><tr><th>회차</th><th>N(건)</th><th>평균</th><th>SD</th><th>α</th></tr>${rows}</table></div>`;
}

// 처음 열 때: 이미 진행자 쿠키가 있으면 바로 대시보드
(async () => {
  const { status } = await api('/api/admin/stats?view=sessions');
  if (status === 401) showLogin(); else enterDashboard();
})();
