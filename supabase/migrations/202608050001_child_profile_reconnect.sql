create or replace function public.create_child_reconnect_invite(p_member_id uuid)
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
    raise exception 'Bare voksne kan koble til et barn på nytt';
  end if;

  select id
  into v_member_id
  from public.family_members
  where id = p_member_id
    and family_id = v_family_id
    and role = 'barn'
  for update;

  if v_member_id is null then
    raise exception 'Barneprofilen finnes ikke i denne familien';
  end if;

  update public.family_members
  set auth_user_id = null,
      invite_token_hash = encode(digest(v_token, 'sha256'), 'hex')
  where id = v_member_id;

  return query select v_member_id, v_token;
end;
$$;

revoke all on function public.create_child_reconnect_invite(uuid) from public;
grant execute on function public.create_child_reconnect_invite(uuid) to authenticated;
