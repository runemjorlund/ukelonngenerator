# Supabase-oppsett

## 1. Opprett og koble prosjektet

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

I Supabase Dashboard under **Authentication → Providers → Anonymous Sign-Ins**, aktiver anonyme innlogginger. De brukes bare når et barn åpner eller limer inn en engangslenke som en voksen har opprettet.

Migreringen `202608030001_fix_ios_auth_and_child_invites.sql` legger `extensions` inn i søkeveien til invitasjonsfunksjonene. Migreringen `202608050001_child_profile_reconnect.sql` lar en voksen koble en eksisterende barneprofil til en ny enhet uten å slette profil eller historikk. Migreringen `202608060002_edge_function_support.sql` velger familier som faktisk skal varsles, og håndhever ett testvarsel per medlem per minutt.

## 2. Konfigurer e-postkode for voksne

Den installerte webappen på iPhone har et annet lokalt lager enn Safari. Derfor skriver voksne inn engangskoden i selve appen, i stedet for å være avhengige av at en e-postlenke åpnes i riktig nettleserkontekst.

1. Konfigurer en ekstern SMTP-leverandør under **Authentication → Email → SMTP Settings**.
2. Åpne **Authentication → Email → Templates → Magic Link or OTP**.
3. Bruk innholdet i [`email-template-otp.html`](email-template-otp.html).

Malen skal inneholde `{{ .Token }}` og ikke `{{ .ConfirmationURL }}`. Da sender Supabase en engangskode som kan verifiseres inne i den installerte appen.

## 3. Lag VAPID-nøkler og edge-hemmeligheter

```bash
npx web-push generate-vapid-keys
```

Legg den offentlige nøkkelen i Vercel som `VITE_VAPID_PUBLIC_KEY`. Legg begge nøklene og appens tillatte origin i Supabase:

```bash
npx supabase secrets set \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:YOUR_EMAIL \
  CRON_SECRET=A_LONG_RANDOM_SECRET \
  APP_ORIGIN=https://YOUR_APP_DOMAIN
```

`APP_ORIGIN` brukes i CORS-svarene og skal ikke være `*`. Flere eksplisitte origins kan oppgis kommaseparert, for eksempel produksjonsdomenet og et fast testdomene.

## 4. Deploy edge-funksjonene

```bash
npx supabase functions deploy send-push --no-verify-jwt
npx supabase functions deploy slett-konto --no-verify-jwt
npx supabase functions deploy rydd-anonyme-brukere --no-verify-jwt
```

Funksjonene er satt til `verify_jwt = false` fordi de gjør sin egen kontroll:

- `send-push` verifiserer bruker-token for testmodus og `x-cron-secret` for planlagt modus.
- `slett-konto` verifiserer bruker-token, kjører database-sletting som innlogget bruker og sletter deretter berørte `auth.users` med service role.
- `rydd-anonyme-brukere` godtar bare samme `x-cron-secret` som cron-jobbene bruker.

## 5. Vercel-miljøvariabler

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`

Kjør en ny Vercel-deploy etter at variablene er lagret.

## 6. Ukentlig push-cron

Aktiver Supabase Cron og Vault. Lagre prosjekt-URL, publishable key og samme `CRON_SECRET` i Vault, og opprett en jobb som kjører hvert 15. minutt:

```sql
select cron.schedule(
  'send-family-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{"mode":"scheduled"}'::jsonb
  );
  $$
);
```

Databasen returnerer bare familier der valgt ukedag og klokkeslett faller innenfor det aktuelle 15-minuttersvinduet. Den eksisterende 20-timerssperren hindrer dobbeltsending.

## 7. Daglig opprydding av anonyme brukere

Opprett en daglig jobb som fjerner anonyme auth-brukere som ikke lenger er koblet til en barneprofil, og som er eldre enn sju dager:

```sql
select cron.schedule(
  'cleanup-orphaned-anonymous-users',
  '17 3 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/rydd-anonyme-brukere',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Kontroller jobbstatus i **Database → Cron Jobs** og edge-loggene etter første kjøring.
