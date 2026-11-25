-- Supabase SQL Editor에서 한 번 실행한다. 표 다섯 개를 만들고 RLS를 켠다.
-- 공개 접근 정책(policy)을 하나도 두지 않으므로 공개 키로는 아무것도 읽거나 쓸 수 없다.
-- 서버 함수만 비밀 키로 읽고 쓴다(비밀 키는 RLS를 거치지 않으므로 권한 검사는 API 코드가 한다).

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  password_salt text not null,
  age_group text check (age_group in ('20s','30s','40s','50s+','na')), -- 샘플 계정에만 있음
  gender text check (gender in ('female','male','na')),               -- 샘플 계정에만 있음
  is_sample boolean not null default false,
  failed_attempts smallint not null default 0,
  locked_until timestamptz,
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,          -- 세션 토큰의 SHA-256 해시(원문은 쿠키에만)
  role text not null check (role in ('user','admin')),
  user_id uuid references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade, -- 게스트 응답이면 null
  session_code text not null,
  item_01 smallint not null check (item_01 between 1 and 5),
  item_02 smallint not null check (item_02 between 1 and 5),
  item_03 smallint not null check (item_03 between 1 and 5),
  item_04 smallint not null check (item_04 between 1 and 5),
  item_05 smallint not null check (item_05 between 1 and 5),
  item_06 smallint not null check (item_06 between 1 and 5),
  item_07 smallint not null check (item_07 between 1 and 5),
  item_08 smallint not null check (item_08 between 1 and 5),
  item_09 smallint not null check (item_09 between 1 and 5),
  item_10 smallint not null check (item_10 between 1 and 5),
  score_mean numeric not null,
  scale_version text not null,
  consented_at timestamptz,              -- 게스트 응답일 때만
  created_at timestamptz not null default now()
);
create index if not exists responses_session_idx on responses (session_code, created_at);
create index if not exists responses_user_idx on responses (user_id);

create table if not exists settings (
  key text primary key,
  value text not null default ''
);
insert into settings (key, value) values
  ('allow_guest', 'false'),
  ('session_code', 'KNU-2026-12'),
  ('phase', 'collecting'),
  ('admin_failed_attempts', '0'),
  ('admin_locked_until', '')
on conflict (key) do nothing;

create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table users enable row level security;
alter table sessions enable row level security;
alter table responses enable row level security;
alter table settings enable row level security;
alter table error_logs enable row level security;
