create extension if not exists pgcrypto;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references auth.users(id),
  notification_weekday smallint not null default 0 check (notification_weekday between 0 and 6),
  notification_time time not null default '18:00',
  timezone text not null default 'Europe/Oslo',
  last_notification_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  role text not null check (role in ('administrator', 'barn')),
  display_name text not null check (char_length(display_name) between 1 and 60),
  emoji text not null default '🌟',
  profile_color text not null default '#12AEB4',
  invite_token_hash text unique,
  created_at timestamptz not null default now(),
  unique (family_id, display_name)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  amount_ore integer not null default 0 check (amount_ore between 0 and 10000000),
  emoji text not null default '✨',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  task_id uuid not null references public.tasks(id),
  child_member_id uuid not null references public.family_members(id),
  status text not null default 'venter' check (status in ('venter', 'godkjent', 'avvist', 'betalt')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.family_members(id)
);

create unique index submissions_one_pending_per_task
  on public.submissions (task_id, child_member_id)
  where status = 'venter';

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.family_members where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select family_id from public.family_members where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.current_family_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.family_members where auth_user_id = auth.uid() limit 1
$$;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;
alter table public.push_subscriptions enable row level security;

create policy families_select on public.families
  for select to authenticated
  using (id = public.current_family_id());

create policy families_update_admin on public.families
  for update to authenticated
  using (id = public.current_family_id() and public.current_family_role() = 'administrator')
  with check (id = public.current_family_id() and public.current_family_role() = 'administrator');

create policy members_select on public.family_members
  for select to authenticated
  using (family_id = public.current_family_id());

create policy members_update_profile on public.family_members
  for update to authenticated
  using (
    family_id = public.current_family_id()
    and (id = public.current_member_id() or public.current_family_role() = 'administrator')
  )
  with check (family_id = public.current_family_id());

create policy tasks_select on public.tasks
  for select to authenticated
  using (family_id = public.current_family_id());

create policy tasks_insert_admin on public.tasks
  for insert to authenticated
  with check (family_id = public.current_family_id() and public.current_family_role() = 'administrator');

create policy tasks_update_admin on public.tasks
  for update to authenticated
  using (family_id = public.current_family_id() and public.current_family_role() = 'administrator')
  with check (family_id = public.current_family_id() and public.current_family_role() = 'administrator');

create policy tasks_delete_admin on public.tasks
  for delete to authenticated
  using (family_id = public.current_family_id() and public.current_family_role() = 'administrator');

create policy submissions_select on public.submissions
  for select to authenticated
  using (family_id = public.current_family_id());

create policy submissions_insert_child on public.submissions
  for insert to authenticated
  with check (
    family_id = public.current_family_id()
    and child_member_id = public.current_member_id()
    and public.current_family_role() = 'barn'
    and status = 'venter'
    and exists (
      select 1 from public.tasks
      where tasks.id = task_id and tasks.family_id = public.current_family_id() and tasks.active
    )
  );

create policy submissions_update_admin on public.submissions
  for update to authenticated
  using (family_id = public.current_family_id() and public.current_family_role() = 'administrator')
  with check (family_id = public.current_family_id() and public.current_family_role() = 'administrator');

create policy subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (member_id = public.current_member_id() and family_id = public.current_family_id());

create policy subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (member_id = public.current_member_id() and family_id = public.current_family_id());

create policy subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (member_id = public.current_member_id() and family_id = public.current_family_id())
  with check (member_id = public.current_member_id() and family_id = public.current_family_id());

create policy subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (member_id = public.current_member_id() and family_id = public.current_family_id());

revoke update on public.family_members from anon, authenticated;
grant update (display_name, emoji, profile_color) on public.family_members to authenticated;

create or replace function public.create_family(p_family_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid;
begin
  if auth.uid() is null then raise exception 'Innlogging kreves'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Anonyme barnekontoer kan ikke opprette familier';
  end if;
  if exists (select 1 from public.family_members where auth_user_id = auth.uid()) then
    raise exception 'Brukeren tilhører allerede en familie';
  end if;

  insert into public.families (name, created_by)
  values (trim(p_family_name), auth.uid())
  returning id into v_family_id;

  insert into public.family_members (family_id, auth_user_id, role, display_name, emoji, profile_color)
  values (v_family_id, auth.uid(), 'administrator', trim(p_display_name), '🚀', '#14406B');

  insert into public.tasks (family_id, title, description, amount_ore, emoji) values
    (v_family_id, 'Tømme oppvaskmaskinen', 'Sett alt på riktig plass.', 1500, '🍽️'),
    (v_family_id, 'Ta ut søppelet', 'Husk ny pose i bøtta.', 1000, '🗑️'),
    (v_family_id, 'Rydde stua', 'Legg ting på plass og puff putene.', 2000, '✨');

  return v_family_id;
end;
$$;

create or replace function public.create_child_invite(p_display_name text, p_emoji text default '🌟')
returns table(member_id uuid, invite_token text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_member_id uuid;
begin
  if public.current_family_role() <> 'administrator' then raise exception 'Bare voksne kan invitere'; end if;

  insert into public.family_members (family_id, role, display_name, emoji, invite_token_hash)
  values (v_family_id, 'barn', trim(p_display_name), coalesce(nullif(p_emoji, ''), '🌟'), encode(digest(v_token, 'sha256'), 'hex'))
  returning id into v_member_id;

  return query select v_member_id, v_token;
end;
$$;

create or replace function public.claim_child_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
begin
  if auth.uid() is null then raise exception 'Innlogging kreves'; end if;
  if exists (select 1 from public.family_members where auth_user_id = auth.uid()) then
    raise exception 'Denne brukeren er allerede koblet til en familie';
  end if;

  select id into v_member_id
  from public.family_members
  where invite_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and auth_user_id is null
    and role = 'barn'
  for update;

  if v_member_id is null then raise exception 'Invitasjonen er ugyldig eller allerede brukt'; end if;

  update public.family_members
  set auth_user_id = auth.uid(), invite_token_hash = null
  where id = v_member_id;

  return v_member_id;
end;
$$;

grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.create_child_invite(text, text) to authenticated;
grant execute on function public.claim_child_invite(text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'submissions') then
    alter publication supabase_realtime add table public.submissions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'family_members') then
    alter publication supabase_realtime add table public.family_members;
  end if;
end $$;
