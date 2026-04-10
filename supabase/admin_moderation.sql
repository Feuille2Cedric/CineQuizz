begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

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
  proposed_difficulty text check (proposed_difficulty in ('easy', 'medium', 'hard', 'cinephile')),
  proposed_metadata jsonb not null default '{}'::jsonb,
  question_snapshot jsonb not null default '{}'::jsonb,
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.question_moderation_requests
  add column if not exists proposed_metadata jsonb not null default '{}'::jsonb;

create index if not exists question_moderation_requests_status_idx
  on public.question_moderation_requests (status, created_at desc);

create index if not exists question_moderation_requests_requester_idx
  on public.question_moderation_requests (requester_user_id, created_at desc);

create index if not exists question_moderation_requests_question_idx
  on public.question_moderation_requests (question_id);

grant insert, update on public.questions to authenticated;
grant select, insert, update on public.question_moderation_requests to authenticated;

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

alter table public.question_moderation_requests enable row level security;

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

commit;
