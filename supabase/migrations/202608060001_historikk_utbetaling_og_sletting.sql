-- =====================================================================
-- Oppdragsklubben – migrering 202608060001
--
-- Innhold:
--   1. Fremmednøkler som gjør sletting mulig og beskytter historikken
--   2. Låst beløp på innsendinger (amount_ore) + gyldige statusoverganger
--   3. payouts: utbetalingshistorikk
--   4. invites: egen tabell for invitasjonstokener, med utløpstid
--   5. Invitasjons- og innløsningsfunksjoner (barn og medvoksen)
--   6. create_payout(): registrer utbetaling per barn
--   7. save_push_subscription(): trygg lagring av pushabonnement
--   8. delete_member() / delete_family(): sletting av data (GDPR)
--   9. Indekser på fremmednøkler
--  10. RLS-policyer skrevet om med (select ...) for InitPlan-caching
--
-- Kjøres etter 202608050001_child_profile_reconnect.sql.
-- TA BACKUP FØRST. Migreringen er ikke ment å kjøres to ganger.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Fremmednøkler
-- ---------------------------------------------------------------------

-- Godkjenner som slettes skal ikke ta med seg historikken.
alter table public.submissions drop constraint if exists submissions_decided_by_fkey;
alter table public.submissions add constraint submissions_decided_by_fkey
  foreign key (decided_by) references public.family_members(id) on delete set null;

-- Oppgaver og barneprofiler med historikk skal ikke kunne slettes ved et uhell.
-- Sletting går via delete_member() / delete_family(), som rydder i riktig rekkefølge.
alter table public.submissions drop constraint if exists submissions_task_id_fkey;
alter table public.submissions add constraint submissions_task_id_fkey
  foreign key (task_id) references public.tasks(id) on delete restrict;

alter table public.submissions drop constraint if exists submissions_child_member_id_fkey;
alter table public.submissions add constraint submissions_child_member_id_fkey
  foreign key (child_member_id) references public.family_members(id) on delete restrict;

-- Oppgaver arkiveres (active = false), de slettes ikke. Policyen kunne bare
-- produsere fremmednøkkelfeil.
drop policy if exists tasks_delete_admin on public.tasks;


-- ---------------------------------------------------------------------
-- 2. Låst beløp og gyldige statusoverganger
-- ---------------------------------------------------------------------

alter table public.submissions
  add column if not exists amount_ore integer not null default 0;

-- Etterfyll historiske rader med dagens pris. Dette er den beste
-- tilnærmingen vi har for rader som ble sendt inn før beløpet ble låst.
update public.submissions s
set amount_ore = o.amount_ore
from public.tasks o
where o.id = s.task_id
  and s.amount_ore = 0;

create or replace function public.snapshot_submission_amount()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Beløpet låses til prisen oppgaven hadde da barnet sendte inn.
  -- Klienten får aldri bestemme beløpet selv.
  select t.amount_ore into new.amount_ore
  from public.tasks t
  where t.id = new.task_id;

  if new.amount_ore is null then
    raise exception 'Fant ikke oppgaven innsendingen peker på';
  end if;

  new.payout_id := null;
  return new;
end;
$$;

create or replace function public.enforce_submission_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.amount_ore is distinct from old.amount_ore then
    raise exception 'Beløpet på et innsendt oppdrag kan ikke endres';
  end if;

  if new.task_id is distinct from old.task_id
     or new.child_member_id is distinct from old.child_member_id
     or new.family_id is distinct from old.family_id then
    raise exception 'Innsendingen kan ikke flyttes til en annen oppgave, et annet barn eller en annen familie';
  end if;

  if old.status = new.status then
    return new;
  end if;

  -- Tillatte overganger. 'betalt' er endelig. Et avvist oppdrag kan
  -- sendes inn på nytt uten at barnet kan endre beløp eller tilhørighet.
  if not (
       (old.status = 'venter'   and new.status in ('godkjent', 'avvist'))
    or (old.status = 'godkjent' and new.status in ('avvist', 'betalt'))
    or (old.status = 'avvist'   and new.status = 'venter')
  ) then
    raise exception 'Ugyldig statusovergang: % -> %', old.status, new.status;
  end if;

  if old.status = 'avvist' and new.status = 'venter' then
    new.submitted_at := now();
    new.decided_at := null;
    new.decided_by := null;
    new.payout_id := null;
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Utbetalingshistorikk
-- ---------------------------------------------------------------------

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_member_id uuid not null references public.family_members(id) on delete restrict,
  total_ore integer not null check (total_ore >= 0),
  paid_at timestamptz not null default now(),
  paid_by uuid references public.family_members(id) on delete set null,
  note text not null default '' check (char_length(note) <= 200)
);

alter table public.submissions
  add column if not exists payout_id uuid references public.payouts(id) on delete set null;

alter table public.payouts enable row level security;

-- Triggerne opprettes først her, fordi snapshot_submission_amount()
-- refererer til payout_id.
drop trigger if exists submissions_snapshot_amount on public.submissions;
create trigger submissions_snapshot_amount
  before insert on public.submissions
  for each row execute function public.snapshot_submission_amount();

drop trigger if exists submissions_enforce_transition on public.submissions;
create trigger submissions_enforce_transition
  before update on public.submissions
  for each row execute function public.enforce_submission_transition();

-- Klienten kan bare endre status og godkjenningsfeltene. Beløp, kobling
-- til utbetaling og familietilhørighet er utenfor rekkevidde. En egen
-- RLS-policy lenger ned begrenser barn til å sende inn egne avviste oppdrag på nytt.
revoke update on public.submissions from anon, authenticated;
grant update (status, decided_at, decided_by) on public.submissions to authenticated;

-- Utbetalinger opprettes bare av create_payout().
revoke insert, update, delete on public.payouts from anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. Invitasjoner i egen tabell
-- ---------------------------------------------------------------------

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid references public.family_members(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create unique index if not exists invites_one_open_per_member
  on public.invites (member_id)
  where claimed_at is null;

alter table public.invites enable row level security;

-- Bevisst uten policyer: tabellen leses og skrives bare av
-- security definer-funksjonene lenger ned. Da kan ingen klient –
-- heller ikke via Realtime – se hashen til et søskens invitasjon.
revoke all on public.invites from anon, authenticated;

-- Flytt eksisterende, ubrukte invitasjoner over. Tokenet er ukjent, men
-- hashen er den samme, så lenker som allerede er delt fortsetter å virke
-- i 48 timer.
insert into public.invites (family_id, member_id, token_hash, expires_at)
select fm.family_id, fm.id, fm.invite_token_hash, now() + interval '48 hours'
from public.family_members fm
where fm.invite_token_hash is not null
on conflict (token_hash) do nothing;

alter table public.family_members drop column if exists invite_token_hash;


-- ---------------------------------------------------------------------
-- 5. Invitasjonsfunksjoner
-- ---------------------------------------------------------------------

-- Intern hjelper. Ikke tilgjengelig for klienter.
create or replace function public.create_invite_for_member(
  p_member_id uuid,
  p_ttl interval default interval '48 hours'
)
returns text
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_family_id uuid;
begin
  select family_id into v_family_id
  from public.family_members
  where id = p_member_id;

  if v_family_id is null then
    raise exception 'Profilen finnes ikke';
  end if;

  -- Bare én åpen invitasjon per profil. En ny lenke ugyldiggjør den gamle.
  delete from public.invites where member_id = p_member_id and claimed_at is null;

  insert into public.invites (family_id, member_id, token_hash, expires_at, created_by)
  values (
    v_family_id,
    p_member_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    now() + p_ttl,
    public.current_member_id()
  );

  return v_token;
end;
$$;

revoke all on function public.create_invite_for_member(uuid, interval) from public, anon, authenticated;


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
  v_member_id uuid;
begin
  -- is distinct from håndterer null-rollen riktig. <> gjorde ikke det.
  if public.current_family_role() is distinct from 'administrator' then
    raise exception 'Bare voksne kan invitere';
  end if;

  insert into public.family_members (family_id, role, display_name, emoji)
  values (v_family_id, 'barn', trim(p_display_name), coalesce(nullif(p_emoji, ''), '🌟'))
  returning id into v_member_id;

  return query select v_member_id, public.create_invite_for_member(v_member_id);
end;
$$;


create or replace function public.create_admin_invite(
  p_display_name text,
  p_emoji text default '🚀'
)
returns table(member_id uuid, invite_token text)
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_member_id uuid;
begin
  if public.current_family_role() is distinct from 'administrator' then
    raise exception 'Bare voksne kan invitere';
  end if;

  insert into public.family_members (family_id, role, display_name, emoji, profile_color)
  values (v_family_id, 'administrator', trim(p_display_name), coalesce(nullif(p_emoji, ''), '🚀'), '#14406B')
  returning id into v_member_id;

  return query select v_member_id, public.create_invite_for_member(v_member_id);
end;
$$;


-- Beholder navnet fra 202608050001, men virker nå for både barn og voksne.
create or replace function public.create_child_reconnect_invite(p_member_id uuid)
returns table(member_id uuid, invite_token text)
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_member_id uuid;
begin
  if public.current_family_role() is distinct from 'administrator' then
    raise exception 'Bare voksne kan koble til en profil på nytt';
  end if;

  if p_member_id = public.current_member_id() then
    raise exception 'Du kan ikke koble fra din egen enhet på denne måten';
  end if;

  select id into v_member_id
  from public.family_members
  where id = p_member_id and family_id = v_family_id
  for update;

  if v_member_id is null then
    raise exception 'Profilen finnes ikke i denne familien';
  end if;

  update public.family_members set auth_user_id = null where id = v_member_id;

  return query select v_member_id, public.create_invite_for_member(v_member_id);
end;
$$;


create or replace function public.claim_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_invite public.invites;
  v_role text;
  v_er_anonym boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
begin
  if auth.uid() is null then
    raise exception 'Innlogging kreves';
  end if;

  if exists (select 1 from public.family_members where auth_user_id = auth.uid()) then
    raise exception 'Denne brukeren er allerede koblet til en familie';
  end if;

  select * into v_invite
  from public.invites
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and claimed_at is null
  for update;

  if v_invite.id is null then
    raise exception 'Invitasjonen er ugyldig eller allerede brukt';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Invitasjonen er utløpt. Be en voksen lage en ny lenke.';
  end if;

  select role into v_role
  from public.family_members
  where id = v_invite.member_id
  for update;

  -- En voksenprofil må knyttes til en e-postkonto, ikke en anonym enhet.
  if v_role = 'administrator' and v_er_anonym then
    raise exception 'Voksne må logge inn med e-post før invitasjonen kan brukes';
  end if;

  update public.family_members
  set auth_user_id = auth.uid()
  where id = v_invite.member_id and auth_user_id is null;

  if not found then
    raise exception 'Profilen er allerede koblet til en annen enhet';
  end if;

  update public.invites set claimed_at = now() where id = v_invite.id;

  return v_invite.member_id;
end;
$$;


-- Beholdt for klienter som ligger hurtigbufret på en enhet og fortsatt
-- kaller det gamle navnet.
create or replace function public.claim_child_invite(p_token text)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.claim_invite(p_token)
$$;


revoke all on function public.create_child_invite(text, text) from public, anon;
revoke all on function public.create_admin_invite(text, text) from public, anon;
revoke all on function public.create_child_reconnect_invite(uuid) from public, anon;
revoke all on function public.claim_invite(text) from public, anon;
revoke all on function public.claim_child_invite(text) from public, anon;

grant execute on function public.create_child_invite(text, text) to authenticated;
grant execute on function public.create_admin_invite(text, text) to authenticated;
grant execute on function public.create_child_reconnect_invite(uuid) to authenticated;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.claim_child_invite(text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Utbetaling
-- ---------------------------------------------------------------------

create or replace function public.create_payout(
  p_child_member_id uuid,
  p_note text default ''
)
returns table(payout_id uuid, total_ore integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_paid_by uuid := public.current_member_id();
  v_total_ore integer;
  v_payout_id uuid;
begin
  if public.current_family_role() is distinct from 'administrator' then
    raise exception 'Bare voksne kan registrere utbetaling';
  end if;

  if not exists (
    select 1 from public.family_members
    where id = p_child_member_id and family_id = v_family_id and role = 'barn'
  ) then
    raise exception 'Barneprofilen finnes ikke i denne familien';
  end if;

  -- Lås radene, slik at to voksne ikke kan betale ut det samme samtidig.
  perform 1
  from public.submissions
  where family_id = v_family_id
    and child_member_id = p_child_member_id
    and status = 'godkjent'
  for update;

  select coalesce(sum(amount_ore), 0) into v_total_ore
  from public.submissions
  where family_id = v_family_id
    and child_member_id = p_child_member_id
    and status = 'godkjent';

  if v_total_ore = 0 then
    raise exception 'Ingen godkjente oppdrag å betale ut';
  end if;

  insert into public.payouts (family_id, child_member_id, total_ore, paid_by, note)
  values (v_family_id, p_child_member_id, v_total_ore, v_paid_by, left(coalesce(p_note, ''), 200))
  returning id into v_payout_id;

  update public.submissions
  set status = 'betalt', payout_id = v_payout_id
  where family_id = v_family_id
    and child_member_id = p_child_member_id
    and status = 'godkjent';

  return query select v_payout_id, v_total_ore;
end;
$$;

revoke all on function public.create_payout(uuid, text) from public, anon;
grant execute on function public.create_payout(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 7. Pushabonnement
-- ---------------------------------------------------------------------

-- Samme fysiske enhet kan ha vært brukt av en annen profil tidligere.
-- Da feilet upsert på endpoint mot RLS-regelen til forrige eier.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid := public.current_member_id();
  v_family_id uuid := public.current_family_id();
  v_id uuid;
begin
  if v_member_id is null then
    raise exception 'Innlogging kreves';
  end if;

  delete from public.push_subscriptions where endpoint = p_endpoint;

  insert into public.push_subscriptions (family_id, member_id, endpoint, p256dh, auth, user_agent)
  values (v_family_id, v_member_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 400))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 8. Sletting av data
-- ---------------------------------------------------------------------

create or replace function public.delete_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_role text;
begin
  if public.current_family_role() is distinct from 'administrator' then
    raise exception 'Bare voksne kan slette profiler';
  end if;

  if p_member_id = public.current_member_id() then
    raise exception 'Bruk delete_family() for å slette din egen konto';
  end if;

  select role into v_role
  from public.family_members
  where id = p_member_id and family_id = v_family_id;

  if v_role is null then
    raise exception 'Profilen finnes ikke i denne familien';
  end if;

  delete from public.push_subscriptions where member_id = p_member_id;
  delete from public.invites where member_id = p_member_id;
  update public.submissions set decided_by = null where decided_by = p_member_id;
  delete from public.submissions where child_member_id = p_member_id;
  delete from public.payouts where child_member_id = p_member_id;
  delete from public.family_members where id = p_member_id;
end;
$$;


create or replace function public.delete_family()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid := public.current_family_id();
begin
  if public.current_family_role() is distinct from 'administrator' then
    raise exception 'Bare voksne kan slette familien';
  end if;

  delete from public.push_subscriptions where family_id = v_family_id;
  delete from public.invites where family_id = v_family_id;
  delete from public.submissions where family_id = v_family_id;
  delete from public.payouts where family_id = v_family_id;
  delete from public.tasks where family_id = v_family_id;
  delete from public.family_members where family_id = v_family_id;
  delete from public.families where id = v_family_id;
end;
$$;

revoke all on function public.delete_member(uuid) from public, anon;
revoke all on function public.delete_family() from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;
grant execute on function public.delete_family() to authenticated;


-- Brukes bare av opprydningsjobben som kjøres med service role-nøkkelen.
create or replace function public.orphaned_auth_user_ids(
  p_older_than interval default interval '7 days'
)
returns setof uuid
language sql
security definer
set search_path = auth, public, pg_temp
as $$
  select u.id
  from auth.users u
  left join public.family_members fm on fm.auth_user_id = u.id
  where fm.id is null
    and u.is_anonymous
    and u.created_at < now() - p_older_than
$$;

revoke all on function public.orphaned_auth_user_ids(interval) from public, anon, authenticated;
grant execute on function public.orphaned_auth_user_ids(interval) to service_role;


-- ---------------------------------------------------------------------
-- 9. Indekser
-- ---------------------------------------------------------------------

-- Postgres indekserer ikke fremmednøkler automatisk. Alle RLS-policyene
-- filtrerer på family_id, så disse treffes ved hvert eneste oppslag.
create index if not exists family_members_family_idx on public.family_members (family_id);
create index if not exists tasks_family_idx on public.tasks (family_id);
create index if not exists tasks_family_active_idx on public.tasks (family_id, active);
create index if not exists submissions_family_status_idx on public.submissions (family_id, status);
create index if not exists submissions_child_member_idx on public.submissions (child_member_id, status);
create index if not exists submissions_payout_idx on public.submissions (payout_id);
create index if not exists submissions_task_idx on public.submissions (task_id);
create index if not exists push_subscriptions_member_idx on public.push_subscriptions (member_id);
create index if not exists push_subscriptions_family_idx on public.push_subscriptions (family_id);
create index if not exists payouts_family_child_idx on public.payouts (family_id, child_member_id, paid_at desc);
create index if not exists invites_family_idx on public.invites (family_id);


-- ---------------------------------------------------------------------
-- 10. RLS-policyer skrevet om
--
-- (select public.current_family_id()) gjør at Postgres evaluerer
-- hjelpefunksjonen én gang som InitPlan i stedet for potensielt per rad.
-- ---------------------------------------------------------------------

drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select to authenticated
  using (id = (select public.current_family_id()));

drop policy if exists families_update_admin on public.families;
create policy families_update_admin on public.families
  for update to authenticated
  using (id = (select public.current_family_id())
         and (select public.current_family_role()) = 'administrator')
  with check (id = (select public.current_family_id())
              and (select public.current_family_role()) = 'administrator');

drop policy if exists members_select on public.family_members;
create policy members_select on public.family_members
  for select to authenticated
  using (family_id = (select public.current_family_id()));

drop policy if exists members_update_profile on public.family_members;
create policy members_update_profile on public.family_members
  for update to authenticated
  using (
    family_id = (select public.current_family_id())
    and (id = (select public.current_member_id())
         or (select public.current_family_role()) = 'administrator')
  )
  with check (family_id = (select public.current_family_id()));

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (family_id = (select public.current_family_id()));

drop policy if exists tasks_insert_admin on public.tasks;
create policy tasks_insert_admin on public.tasks
  for insert to authenticated
  with check (family_id = (select public.current_family_id())
              and (select public.current_family_role()) = 'administrator');

drop policy if exists tasks_update_admin on public.tasks;
create policy tasks_update_admin on public.tasks
  for update to authenticated
  using (family_id = (select public.current_family_id())
         and (select public.current_family_role()) = 'administrator')
  with check (family_id = (select public.current_family_id())
              and (select public.current_family_role()) = 'administrator');

drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
  for select to authenticated
  using (family_id = (select public.current_family_id()));

drop policy if exists submissions_insert_child on public.submissions;
create policy submissions_insert_child on public.submissions
  for insert to authenticated
  with check (
    family_id = (select public.current_family_id())
    and child_member_id = (select public.current_member_id())
    and (select public.current_family_role()) = 'barn'
    and status = 'venter'
    and payout_id is null
    and exists (
      select 1 from public.tasks
      where tasks.id = task_id
        and tasks.family_id = (select public.current_family_id())
        and tasks.active
    )
  );

drop policy if exists submissions_update_admin on public.submissions;
create policy submissions_update_admin on public.submissions
  for update to authenticated
  using (family_id = (select public.current_family_id())
         and (select public.current_family_role()) = 'administrator')
  with check (family_id = (select public.current_family_id())
              and (select public.current_family_role()) = 'administrator');

drop policy if exists submissions_update_child_resubmit on public.submissions;
create policy submissions_update_child_resubmit on public.submissions
  for update to authenticated
  using (
    family_id = (select public.current_family_id())
    and child_member_id = (select public.current_member_id())
    and (select public.current_family_role()) = 'barn'
    and status = 'avvist'
  )
  with check (
    family_id = (select public.current_family_id())
    and child_member_id = (select public.current_member_id())
    and (select public.current_family_role()) = 'barn'
    and status = 'venter'
    and payout_id is null
    and exists (
      select 1 from public.tasks
      where tasks.id = task_id
        and tasks.family_id = (select public.current_family_id())
        and tasks.active
    )
  );

drop policy if exists payouts_select on public.payouts;
create policy payouts_select on public.payouts
  for select to authenticated
  using (family_id = (select public.current_family_id()));

drop policy if exists subscriptions_select_own on public.push_subscriptions;
create policy subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (member_id = (select public.current_member_id())
         and family_id = (select public.current_family_id()));

drop policy if exists subscriptions_insert_own on public.push_subscriptions;
create policy subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (member_id = (select public.current_member_id())
              and family_id = (select public.current_family_id()));

drop policy if exists subscriptions_update_own on public.push_subscriptions;
create policy subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (member_id = (select public.current_member_id())
         and family_id = (select public.current_family_id()))
  with check (member_id = (select public.current_member_id())
              and family_id = (select public.current_family_id()));

drop policy if exists subscriptions_delete_own on public.push_subscriptions;
create policy subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (member_id = (select public.current_member_id())
         and family_id = (select public.current_family_id()));


-- ---------------------------------------------------------------------
-- 11. Realtime
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'payouts'
  ) then
    alter publication supabase_realtime add table public.payouts;
  end if;
end $$;

commit;
