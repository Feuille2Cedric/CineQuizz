begin;

alter table public.questions
  drop constraint if exists questions_difficulty_check;

alter table public.questions
  add constraint questions_difficulty_check
  check (difficulty in ('easy', 'medium', 'hard', 'cinephile'));

alter table public.user_question_progress
  drop constraint if exists user_question_progress_difficulty_check;

alter table public.user_question_progress
  add constraint user_question_progress_difficulty_check
  check (difficulty in ('easy', 'medium', 'hard', 'cinephile'));

alter table public.question_moderation_requests
  drop constraint if exists question_moderation_requests_proposed_difficulty_check;

alter table public.question_moderation_requests
  add constraint question_moderation_requests_proposed_difficulty_check
  check (
    proposed_difficulty is null
    or proposed_difficulty in ('easy', 'medium', 'hard', 'cinephile')
  );

commit;
