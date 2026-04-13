begin;

grant usage on schema public to anon, authenticated;
grant select on public.questions to anon, authenticated;
grant insert, update on public.questions to authenticated;
grant select on public.profiles to authenticated;
revoke insert, update on public.profiles from authenticated;
grant insert (user_id, nickname), update (nickname) on public.profiles to authenticated;
grant select on public.user_question_progress to authenticated;
revoke insert, update on public.user_question_progress from authenticated;
grant select, insert, update on public.question_moderation_requests to authenticated;

create or replace function public.jsonb_is_text_array(
  p_value jsonb,
  p_allow_empty boolean default true,
  p_max_items integer default 100,
  p_max_item_length integer default 500
)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(coalesce(p_value, '[]'::jsonb)) = 'array'
    and (p_allow_empty or jsonb_array_length(coalesce(p_value, '[]'::jsonb)) > 0)
    and jsonb_array_length(coalesce(p_value, '[]'::jsonb)) <= p_max_items
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_value, '[]'::jsonb)) as elem
      where jsonb_typeof(elem) <> 'string'
        or char_length(trim(elem #>> '{}')) = 0
        or char_length(elem #>> '{}') > p_max_item_length
    );
$$;

create or replace function public.question_metadata_is_valid(
  p_metadata jsonb
)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'answerMode')
      or (p_metadata ->> 'answerMode') in ('text', 'mcq')
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'distractors')
      or public.jsonb_is_text_array(p_metadata -> 'distractors', true, 10, 180)
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'mcqChoices')
      or public.jsonb_is_text_array(p_metadata -> 'mcqChoices', true, 10, 180)
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'mcq_choices')
      or public.jsonb_is_text_array(p_metadata -> 'mcq_choices', true, 10, 180)
    );
$$;

create or replace function public.moderation_request_payload_is_valid(
  p_request_type text,
  p_question_id text,
  p_proposed_prompt text,
  p_proposed_answer text,
  p_proposed_difficulty text
)
returns boolean
language sql
immutable
as $$
  select case
    when p_request_type = 'report' then
      true
    when p_request_type = 'edit' then
      char_length(trim(coalesce(p_proposed_prompt, ''))) between 1 and 1000
      and char_length(trim(coalesce(p_proposed_answer, ''))) between 1 and 500
      and coalesce(p_proposed_difficulty, '') in ('easy', 'medium', 'hard', 'cinephile')
    when p_request_type = 'new' then
      char_length(trim(coalesce(p_proposed_prompt, ''))) between 1 and 1000
      and char_length(trim(coalesce(p_proposed_answer, ''))) between 1 and 500
      and coalesce(p_proposed_difficulty, '') in ('easy', 'medium', 'hard', 'cinephile')
    else false
  end;
$$;

grant execute on function public.jsonb_is_text_array(jsonb, boolean, integer, integer) to anon, authenticated;
grant execute on function public.question_metadata_is_valid(jsonb) to anon, authenticated;
grant execute on function public.moderation_request_payload_is_valid(text, text, text, text, text) to anon, authenticated;

alter table public.questions
  drop constraint if exists questions_id_length_check;

alter table public.questions
  add constraint questions_id_length_check
  check (char_length(trim(id)) between 1 and 120);

alter table public.questions
  drop constraint if exists questions_prompt_length_check;

alter table public.questions
  add constraint questions_prompt_length_check
  check (char_length(trim(prompt)) between 1 and 1000);

alter table public.questions
  drop constraint if exists questions_answer_length_check;

alter table public.questions
  add constraint questions_answer_length_check
  check (char_length(trim(answer)) between 1 and 500);

alter table public.questions
  drop constraint if exists questions_accepted_answers_shape_check;

alter table public.questions
  add constraint questions_accepted_answers_shape_check
  check (public.jsonb_is_text_array(accepted_answers, true, 25, 200));

alter table public.questions
  drop constraint if exists questions_metadata_shape_check;

alter table public.questions
  add constraint questions_metadata_shape_check
  check (public.question_metadata_is_valid(metadata));

alter table public.profiles
  drop constraint if exists profiles_totals_consistency_check;

alter table public.profiles
  add constraint profiles_totals_consistency_check
  check (
    total_answered >= 0
    and total_correct >= 0
    and total_correct <= total_answered
  );

alter table public.question_moderation_requests
  drop constraint if exists moderation_reason_length_check;

alter table public.question_moderation_requests
  add constraint moderation_reason_length_check
  check (char_length(reason) <= 1000);

alter table public.question_moderation_requests
  drop constraint if exists moderation_question_id_length_check;

alter table public.question_moderation_requests
  add constraint moderation_question_id_length_check
  check (
    question_id is null
    or char_length(trim(question_id)) between 1 and 120
  );

alter table public.question_moderation_requests
  drop constraint if exists moderation_request_payload_shape_check;

alter table public.question_moderation_requests
  add constraint moderation_request_payload_shape_check
  check (
    public.moderation_request_payload_is_valid(
      request_type,
      question_id,
      proposed_prompt,
      proposed_answer,
      proposed_difficulty
    )
  );

alter table public.question_moderation_requests
  drop constraint if exists moderation_proposed_prompt_length_check;

alter table public.question_moderation_requests
  add constraint moderation_proposed_prompt_length_check
  check (
    proposed_prompt is null
    or char_length(trim(proposed_prompt)) between 1 and 1000
  );

alter table public.question_moderation_requests
  drop constraint if exists moderation_proposed_answer_length_check;

alter table public.question_moderation_requests
  add constraint moderation_proposed_answer_length_check
  check (
    proposed_answer is null
    or char_length(trim(proposed_answer)) between 1 and 500
  );

alter table public.question_moderation_requests
  drop constraint if exists moderation_proposed_answers_shape_check;

alter table public.question_moderation_requests
  add constraint moderation_proposed_answers_shape_check
  check (public.jsonb_is_text_array(proposed_accepted_answers, true, 25, 200));

alter table public.question_moderation_requests
  drop constraint if exists moderation_proposed_metadata_shape_check;

alter table public.question_moderation_requests
  add constraint moderation_proposed_metadata_shape_check
  check (public.question_metadata_is_valid(proposed_metadata));

alter table public.question_moderation_requests
  drop constraint if exists moderation_snapshot_shape_check;

alter table public.question_moderation_requests
  add constraint moderation_snapshot_shape_check
  check (jsonb_typeof(question_snapshot) = 'object');

alter table public.question_moderation_requests
  drop constraint if exists moderation_admin_note_length_check;

alter table public.question_moderation_requests
  add constraint moderation_admin_note_length_check
  check (
    admin_note is null
    or char_length(admin_note) <= 1000
  );

alter table public.question_moderation_requests
  drop constraint if exists moderation_review_audit_check;

alter table public.question_moderation_requests
  add constraint moderation_review_audit_check
  check (
    reviewed_at is null
    or reviewed_by is not null
  );

alter table public.user_question_progress
  drop constraint if exists progress_normalized_answer_length_check;

alter table public.user_question_progress
  add constraint progress_normalized_answer_length_check
  check (
    normalized_answer is null
    or char_length(normalized_answer) <= 500
  );

drop policy if exists "questions_insert_admin" on public.questions;
create policy "questions_insert_admin"
on public.questions
for insert
to authenticated
with check (
  public.is_admin()
  and char_length(trim(id)) between 1 and 120
  and char_length(trim(prompt)) between 1 and 1000
  and char_length(trim(answer)) between 1 and 500
  and public.jsonb_is_text_array(accepted_answers, true, 25, 200)
  and public.question_metadata_is_valid(metadata)
);

drop policy if exists "questions_update_admin" on public.questions;
create policy "questions_update_admin"
on public.questions
for update
to authenticated
using (public.is_admin())
with check (
  public.is_admin()
  and char_length(trim(id)) between 1 and 120
  and char_length(trim(prompt)) between 1 and 1000
  and char_length(trim(answer)) between 1 and 500
  and public.jsonb_is_text_array(accepted_answers, true, 25, 200)
  and public.question_metadata_is_valid(metadata)
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and char_length(trim(nickname)) between 3 and 24
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and char_length(trim(nickname)) between 3 and 24
);

drop policy if exists "moderation_requests_insert_own" on public.question_moderation_requests;
create policy "moderation_requests_insert_own"
on public.question_moderation_requests
for insert
to authenticated
with check (
  auth.uid() = requester_user_id
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and (
    (request_type = 'new' and question_id is null)
    or (request_type in ('report', 'edit') and char_length(trim(coalesce(question_id, ''))) between 1 and 120)
  )
  and public.moderation_request_payload_is_valid(
    request_type,
    question_id,
    proposed_prompt,
    proposed_answer,
    proposed_difficulty
  )
  and public.jsonb_is_text_array(proposed_accepted_answers, true, 25, 200)
  and public.question_metadata_is_valid(proposed_metadata)
  and jsonb_typeof(question_snapshot) = 'object'
);

drop policy if exists "moderation_requests_update_admin" on public.question_moderation_requests;
create policy "moderation_requests_update_admin"
on public.question_moderation_requests
for update
to authenticated
using (public.is_admin())
with check (
  public.is_admin()
  and status in ('pending', 'approved', 'rejected', 'deleted')
  and (
    reviewed_at is null
    or reviewed_by is not null
  )
  and public.moderation_request_payload_is_valid(
    request_type,
    question_id,
    proposed_prompt,
    proposed_answer,
    proposed_difficulty
  )
  and public.jsonb_is_text_array(proposed_accepted_answers, true, 25, 200)
  and public.question_metadata_is_valid(proposed_metadata)
  and jsonb_typeof(question_snapshot) = 'object'
);

commit;
