create or replace function public.create_child_invite(
  p_display_name text,
  p_emoji text default '🌟'
)
returns table(member_id uuid, invite_token text)
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_member_id uuid;
begin
  if public.current_family_role() <> 'administrator' then
    raise exception 'Bare voksne kan invitere';
  end if;

  insert into public.family_members (
    family_id,
    role,
    display_name,
    emoji,
    invite_token_hash
  )
  values (
    v_family_id,
    'barn',
    trim(p_display_name),
    coalesce(nullif(p_emoji, ''), '🌟'),
    encode(digest(v_token, 'sha256'), 'hex')
  )
  returning id into v_member_id;

  return query select v_member_id, v_token;
end;
$$;

create or replace function public.claim_child_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Innlogging kreves';
  end if;

  if exists (
    select 1
    from public.family_members
    where auth_user_id = auth.uid()
  ) then
    raise exception 'Denne brukeren er allerede koblet til en familie';
  end if;

  select id
  into v_member_id
  from public.family_members
  where invite_token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and auth_user_id is null
    and role = 'barn'
  for update;

  if v_member_id is null then
    raise exception 'Invitasjonen er ugyldig eller allerede brukt';
  end if;

  update public.family_members
  set auth_user_id = auth.uid(),
      invite_token_hash = null
  where id = v_member_id;

  return v_member_id;
end;
$$;

revoke all on function public.create_child_invite(text, text) from public;
revoke all on function public.claim_child_invite(text) from public;
grant execute on function public.create_child_invite(text, text) to authenticated;
grant execute on function public.claim_child_invite(text) to authenticated;
