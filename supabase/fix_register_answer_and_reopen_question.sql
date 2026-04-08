begin;

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

commit;
