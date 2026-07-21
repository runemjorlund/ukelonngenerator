# Supabase-oppsett

## 1. Opprett og koble prosjektet

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

I Supabase Dashboard under **Authentication → Providers → Anonymous Sign-Ins**, aktiver anonyme innlogginger. De brukes bare når et barn åpner en engangslenke som en voksen har opprettet.

## 2. Lag VAPID-nøkler

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

## 3. Vercel-miljøvariabler

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`

Kjør en ny Vercel-deploy etter at variablene er lagret.

## 4. Ukentlig cron

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
