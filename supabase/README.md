# Supabase-oppsett

## 1. Opprett og koble prosjektet

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

I Supabase Dashboard under **Authentication → Providers → Anonymous Sign-Ins**, aktiver anonyme innlogginger. De brukes bare når et barn åpner eller limer inn en engangslenke som en voksen har opprettet.

Migreringen `202608030001_fix_ios_auth_and_child_invites.sql` legger `extensions` inn i søkeveien til invitasjonsfunksjonene. Det gjør Supabase-funksjonene `gen_random_bytes` og `digest` tilgjengelige når en invitasjon opprettes eller brukes. Migreringen `202608050001_child_profile_reconnect.sql` lar en voksen koble en eksisterende barneprofil til en ny enhet uten å slette profil eller historikk.

## 2. Konfigurer e-postkode for voksne

Den installerte webappen på iPhone har et annet lokalt lager enn Safari. Derfor skriver voksne inn engangskoden i selve appen, i stedet for å være avhengige av at en e-postlenke åpnes i riktig nettleserkontekst.

1. Konfigurer en ekstern SMTP-leverandør under **Authentication → Email → SMTP Settings**.
2. Åpne **Authentication → Email → Templates → Magic Link or OTP**.
3. Bruk innholdet i [`email-template-otp.html`](email-template-otp.html).

Malen skal inneholde `{{ .Token }}` og ikke `{{ .ConfirmationURL }}`. Da sender Supabase en engangskode som kan verifiseres inne i den installerte appen.

## 3. Lag VAPID-nøkler

```bash
npx web-push generate-vapid-keys
```

Legg den offentlige nøkkelen i Vercel som `VITE_VAPID_PUBLIC_KEY`. Legg begge nøklene i Supabase:

```bash
npx supabase secrets set \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:YOUR_EMAIL \
  CRON_SECRET=A_LONG_RANDOM_SECRET
npx supabase functions deploy send-push --no-verify-jwt
```

## 4. Vercel-miljøvariabler

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`

Kjør en ny Vercel-deploy etter at variablene er lagret.

## 5. Ukentlig cron

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

Funksjonen sender bare når familiens valgte ukedag og klokkeslett faller innenfor det aktuelle 15-minuttersvinduet.
