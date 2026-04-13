begin;

create or replace function public.get_leaderboard_profiles()
returns table (
  user_id uuid,
  nickname text,
  total_correct integer,
  total_answered integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.user_id,
    profiles.nickname,
    profiles.total_correct,
    profiles.total_answered
  from public.profiles as profiles
  order by profiles.total_correct desc, profiles.total_answered asc, profiles.nickname asc
  limit 50;
$$;

grant execute on function public.get_leaderboard_profiles() to authenticated;

drop policy if exists "profiles_select_for_authenticated" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

commit;
