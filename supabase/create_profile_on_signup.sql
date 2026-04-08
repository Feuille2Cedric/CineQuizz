begin;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_nickname text;
  v_nickname text;
begin
  v_base_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Spectateur'
  );

  v_nickname := v_base_nickname;

  if exists (
    select 1
    from public.profiles
    where lower(trim(nickname)) = lower(trim(v_nickname))
  ) then
    v_nickname := left(v_base_nickname, 18) || '-' || left(new.id::text, 5);
  end if;

  insert into public.profiles (user_id, nickname)
  values (new.id, v_nickname)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user_profile();

insert into public.profiles (user_id, nickname)
select
  users.id,
  case
    when exists (
      select 1
      from public.profiles as existing
      where lower(trim(existing.nickname)) = lower(trim(
        coalesce(
          nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
          nullif(split_part(users.email, '@', 1), ''),
          'Spectateur'
        )
      ))
    )
    then left(
      coalesce(
        nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(users.email, '@', 1), ''),
        'Spectateur'
      ),
      18
    ) || '-' || left(users.id::text, 5)
    else coalesce(
      nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(users.email, '@', 1), ''),
      'Spectateur'
    )
  end
from auth.users as users
left join public.profiles as profiles
  on profiles.user_id = users.id
where profiles.user_id is null
on conflict (user_id) do nothing;

commit;
