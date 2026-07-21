# Oppdragsklubben

En mobiltilpasset familieapp for husoppgaver, godkjenning og ukepenger. Appen er bygget med React, TypeScript, Vite og Supabase, og kan installeres som en PWA på telefoner og nettbrett.

## Dette støttes

- Voksne logger inn med en e-postlenke
- Barn kobler sin enhet til en barneprofil med en engangslenke
- Familiens data synkroniseres mellom enheter i sanntid
- Barn kan sende inn utførte oppgaver, men ikke godkjenne eller endre beløp
- Voksne kan opprette oppgaver, invitere barn, godkjenne og registrere betaling
- Postgres Row Level Security beskytter data og roller på serversiden
- Ukentlige Web Push-varsler med Supabase Cron og Edge Functions
- Installérbar PWA med offline-cache
- Automatisk byggesjekk i GitHub Actions

## Lokal utvikling

```bash
cp .env.example .env.local
npm install
npm run dev
```

Miljøvariablene er beskrevet i `.env.example`.

## Gjør Vercel-versjonen klar

1. Opprett et Supabase-prosjekt.
2. Følg [Supabase-oppsettet](supabase/README.md) for migrasjon, anonym barneinnlogging, Edge Function, VAPID-nøkler og Cron.
3. Legg `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` og `VITE_VAPID_PUBLIC_KEY` inn i Vercel.
4. Kjør en ny Vercel-deploy.
5. Logg inn som voksen, opprett familien og lag én invitasjonslenke per barn.
6. Åpne hvert barns lenke på barnets egen enhet. På iPhone/iPad: legg appen til på Hjem-skjermen.

## Sikkerhetsmodell

Barnets invitasjonstoken lagres bare som SHA-256-hash og slettes når lenken er brukt. Den anonyme Supabase-kontoen bindes da til nøyaktig én barneprofil. RLS-reglene i `supabase/migrations` er den autoritative tilgangskontrollen; grensesnittet alene brukes aldri som sikkerhetsgrense.

Push-endepunkter og krypteringsnøkler kan bare leses av eieren og Supabase-funksjonen. VAPID-privatnøkkelen og service role-nøkkelen skal aldri legges i Vercel eller klientkoden.

## Produksjonsbygg

```bash
npm run lint
npm run build
```
