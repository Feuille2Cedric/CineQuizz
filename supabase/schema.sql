create table if not exists public.questions (
  id text primary key,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  prompt text not null,
  answer text not null,
  accepted_answers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 3 and 24),
  is_admin boolean not null default false,
  total_answered integer not null default 0,
  total_correct integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.question_moderation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_nickname text not null check (char_length(trim(requester_nickname)) between 3 and 24),
  question_id text references public.questions(id) on delete set null,
  request_type text not null check (request_type in ('report', 'edit', 'new')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text not null default '',
  proposed_prompt text,
  proposed_answer text,
  proposed_accepted_answers jsonb not null default '[]'::jsonb,
  proposed_difficulty text check (proposed_difficulty in ('easy', 'medium', 'hard')),
  question_snapshot jsonb not null default '{}'::jsonb,
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_question_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  is_correct boolean not null,
  normalized_answer text,
  answered_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, question_id)
);

create index if not exists user_question_progress_user_id_idx
  on public.user_question_progress (user_id);

create index if not exists questions_difficulty_is_active_idx
  on public.questions (difficulty, is_active);

create index if not exists question_moderation_requests_status_idx
  on public.question_moderation_requests (status, created_at desc);

create index if not exists question_moderation_requests_requester_idx
  on public.question_moderation_requests (requester_user_id, created_at desc);

create index if not exists question_moderation_requests_question_idx
  on public.question_moderation_requests (question_id);

create unique index if not exists profiles_nickname_unique_idx
  on public.profiles (lower(trim(nickname)));

grant usage on schema public to anon, authenticated;
grant select on public.questions to anon, authenticated;
grant insert, update on public.questions to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_question_progress to authenticated;
grant select, insert, update on public.question_moderation_requests to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and is_admin = true
  );
$$;

create or replace function public.is_nickname_available(
  p_nickname text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where lower(trim(nickname)) = lower(trim(p_nickname))
  );
$$;

create or replace function public.resolve_sign_in_email(
  p_identifier text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with direct_email as (
    select users.email
    from auth.users as users
    where lower(users.email) = lower(trim(p_identifier))
    limit 1
  ),
  profile_email as (
    select users.email
    from public.profiles as profiles
    join auth.users as users
      on users.id = profiles.user_id
    where lower(trim(profiles.nickname)) = lower(trim(p_identifier))
    limit 1
  )
  select coalesce(
    (select email from direct_email),
    (select email from profile_email)
  );
$$;

grant execute on function public.is_nickname_available(text) to anon, authenticated;
grant execute on function public.resolve_sign_in_email(text) to anon, authenticated;

drop trigger if exists profiles_touch_updated_at on public.profiles;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.user_question_progress enable row level security;
alter table public.questions enable row level security;
alter table public.question_moderation_requests enable row level security;

drop policy if exists "questions_select_public" on public.questions;
create policy "questions_select_public"
on public.questions
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "questions_select_admin" on public.questions;
create policy "questions_select_admin"
on public.questions
for select
to authenticated
using (public.is_admin());

drop policy if exists "questions_insert_admin" on public.questions;
create policy "questions_insert_admin"
on public.questions
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "questions_update_admin" on public.questions;
create policy "questions_update_admin"
on public.questions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles_select_for_authenticated" on public.profiles;
create policy "profiles_select_for_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "progress_select_own" on public.user_question_progress;
create policy "progress_select_own"
on public.user_question_progress
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "progress_insert_own" on public.user_question_progress;
create policy "progress_insert_own"
on public.user_question_progress
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "progress_update_own" on public.user_question_progress;
create policy "progress_update_own"
on public.user_question_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "moderation_requests_select_own" on public.question_moderation_requests;
create policy "moderation_requests_select_own"
on public.question_moderation_requests
for select
to authenticated
using (auth.uid() = requester_user_id);

drop policy if exists "moderation_requests_select_admin" on public.question_moderation_requests;
create policy "moderation_requests_select_admin"
on public.question_moderation_requests
for select
to authenticated
using (public.is_admin());

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
);

drop policy if exists "moderation_requests_update_admin" on public.question_moderation_requests;
create policy "moderation_requests_update_admin"
on public.question_moderation_requests
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.register_answer(
  p_question_id text,
  p_difficulty text,
  p_is_correct boolean,
  p_normalized_answer text default null
)
returns table (
  inserted boolean,
  total_answered integer,
  total_correct integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (user_id, nickname)
  values (v_user_id, 'Spectateur')
  on conflict (user_id) do nothing;

  insert into public.user_question_progress (
    user_id,
    question_id,
    difficulty,
    is_correct,
    normalized_answer
  )
  values (
    v_user_id,
    p_question_id,
    p_difficulty,
    p_is_correct,
    p_normalized_answer
  )
  on conflict (user_id, question_id) do nothing;

  if found then
    update public.profiles as p
    set
      total_answered = p.total_answered + 1,
      total_correct = p.total_correct + case when p_is_correct then 1 else 0 end
    where p.user_id = v_user_id;

    return query
      select true, profiles.total_answered, profiles.total_correct
      from public.profiles
      where profiles.user_id = v_user_id;
  end if;

  return query
    select false, profiles.total_answered, profiles.total_correct
    from public.profiles
    where profiles.user_id = v_user_id;
end;
$$;

grant execute on function public.register_answer(text, text, boolean, text) to authenticated;

create or replace function public.reopen_question(
  p_question_id text
)
returns table (
  removed boolean,
  total_answered integer,
  total_correct integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.user_question_progress%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (user_id, nickname)
  values (v_user_id, 'Spectateur')
  on conflict (user_id) do nothing;

  select *
  into v_existing
  from public.user_question_progress
  where user_id = v_user_id
    and question_id = p_question_id;

  if not found then
    return query
      select false, profiles.total_answered, profiles.total_correct
      from public.profiles
      where profiles.user_id = v_user_id;
    return;
  end if;

  delete from public.user_question_progress
  where user_id = v_user_id
    and question_id = p_question_id;

  update public.profiles as p
  set
    total_answered = greatest(p.total_answered - 1, 0),
    total_correct = greatest(p.total_correct - case when v_existing.is_correct then 1 else 0 end, 0)
  where p.user_id = v_user_id;

  return query
    select true, profiles.total_answered, profiles.total_correct
    from public.profiles
    where profiles.user_id = v_user_id;
end;
$$;

grant execute on function public.reopen_question(text) to authenticated;
