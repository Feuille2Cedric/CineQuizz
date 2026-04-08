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
    from (
      select lower(trim(profiles.nickname)) as normalized_nickname
      from public.profiles as profiles

      union

      select lower(trim(users.raw_user_meta_data ->> 'display_name')) as normalized_nickname
      from auth.users as users
      where nullif(trim(users.raw_user_meta_data ->> 'display_name'), '') is not null
    ) as nicknames
    where nicknames.normalized_nickname = lower(trim(p_nickname))
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
  ),
  metadata_email as (
    select users.email
    from auth.users as users
    where lower(trim(users.raw_user_meta_data ->> 'display_name')) = lower(trim(p_identifier))
    limit 1
  )
  select coalesce(
    (select email from direct_email),
    (select email from profile_email),
    (select email from metadata_email)
  );
$$;

grant execute on function public.is_nickname_available(text) to anon, authenticated;
grant execute on function public.resolve_sign_in_email(text) to anon, authenticated;

commit;
