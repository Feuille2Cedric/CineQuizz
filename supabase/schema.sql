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
  total_answered integer not null default 0,
  total_correct integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
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

grant usage on schema public to anon, authenticated;
grant select on public.questions to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_question_progress to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.user_question_progress enable row level security;
alter table public.questions enable row level security;

drop policy if exists "questions_select_public" on public.questions;
create policy "questions_select_public"
on public.questions
for select
to anon, authenticated
using (is_active = true);

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
    update public.profiles
    set
      total_answered = total_answered + 1,
      total_correct = total_correct + case when p_is_correct then 1 else 0 end
    where user_id = v_user_id;

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

  update public.profiles
  set
    total_answered = greatest(total_answered - 1, 0),
    total_correct = greatest(total_correct - case when v_existing.is_correct then 1 else 0 end, 0)
  where user_id = v_user_id;

  return query
    select true, profiles.total_answered, profiles.total_correct
    from public.profiles
    where profiles.user_id = v_user_id;
end;
$$;

grant execute on function public.reopen_question(text) to authenticated;
