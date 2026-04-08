begin;

create unique index if not exists profiles_nickname_unique_idx
  on public.profiles (lower(trim(nickname)));

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

commit;
