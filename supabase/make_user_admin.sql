-- Remplace l'adresse e-mail ci-dessous par celle de ton compte Supabase.
begin;

insert into public.profiles (user_id, nickname, is_admin)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
    split_part(users.email, '@', 1),
    'Spectateur'
  ),
  true
from auth.users as users
where users.email = 'ton-email@example.com'
on conflict (user_id) do update
set is_admin = true;

commit;
