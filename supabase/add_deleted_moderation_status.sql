begin;

alter table public.question_moderation_requests
  drop constraint if exists question_moderation_requests_status_check;

alter table public.question_moderation_requests
  add constraint question_moderation_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'deleted'));

commit;
