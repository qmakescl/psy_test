-- 워크숍 종료 후 7일 안에 실행: 모든 계정·세션·응답·오류 기록을 지우고 설정을 처음 값으로 되돌린다.
-- 샘플 계정도 함께 지워진다(다음 회차 전에 npm run seed로 다시 만든다).
-- 마지막 select 결과(모두 0)와 실행 일시를 report/에 기록한다.

delete from sessions;
delete from responses;
delete from users;
delete from error_logs;

update settings set value = case key
  when 'allow_guest' then 'false'
  when 'session_code' then 'KNU-2026-12'
  when 'phase' then 'collecting'
  when 'admin_failed_attempts' then '0'
  when 'admin_locked_until' then ''
  else value end;

select
  (select count(*) from users)      as users_left,
  (select count(*) from sessions)   as sessions_left,
  (select count(*) from responses)  as responses_left,
  (select count(*) from error_logs) as error_logs_left;
