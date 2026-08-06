-- Støttefunksjoner for edge-funksjonene i steg 3.
-- Nye objekter er additive og berører ikke eksisterende familiehistorikk.

create or replace function public.families_due_for_notification(
  p_now timestamptz default now()
)
returns table (
  id uuid,
  name text,
  notification_weekday smallint,
  notification_time time without time zone,
  timezone text,
  last_notification_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    f.id,
    f.name,
    f.notification_weekday,
    f.notification_time,
    f.timezone,
    f.last_notification_at
  from public.families f
  cross join lateral (
    select p_now at time zone f.timezone as local_now
  ) local_time
  where (
      f.last_notification_at is null
      or f.last_notification_at <= p_now - interval '20 hours'
    )
    and extract(dow from local_time.local_now)::smallint = f.notification_weekday
    and local_time.local_now >= (local_time.local_now::date + f.notification_time)
    and local_time.local_now < (local_time.local_now::date + f.notification_time + interval '15 minutes')
$$;

revoke all on function public.families_due_for_notification(timestamptz)
  from public, anon, authenticated;
grant execute on function public.families_due_for_notification(timestamptz)
  to service_role;


-- Tabellen er ikke tilgjengelig gjennom klient-API-et. En security definer-
-- funksjon gjør den atomiske ett-minuttskontrollen for send-push.
create table if not exists public.push_test_rate_limits (
  member_id uuid primary key references public.family_members(id) on delete cascade,
  last_test_at timestamptz not null
);

alter table public.push_test_rate_limits enable row level security;
revoke all on table public.push_test_rate_limits from public, anon, authenticated;

create or replace function public.claim_push_test_slot(
  p_member_id uuid,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claimed boolean;
begin
  insert into public.push_test_rate_limits as limits (member_id, last_test_at)
  values (p_member_id, p_now)
  on conflict (member_id) do update
    set last_test_at = excluded.last_test_at
    where limits.last_test_at <= excluded.last_test_at - interval '1 minute'
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_push_test_slot(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_push_test_slot(uuid, timestamptz)
  to service_role;
