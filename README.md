# Oppdragsklubben

En mobiltilpasset familieapp for husoppgaver, godkjenning og ukepenger. Denne første versjonen er en fungerende frontend-prototype i React, TypeScript og Vite.

## Dette virker nå

- Egen barne- og foreldrevisning
- Profilbytte mellom familiemedlemmer
- Innsending av utførte oppgaver
- Godkjenning og avvisning fra foreldrevisningen
- Dynamisk beregning av beløp per barn og samlet utbetaling
- Redigering av familienavn, slagord, navn, avatarer og profilfarger
- Oppretting, redigering og arkivering av oppgaver og beløp
- Pokaler, mestringsrekke og liten feiring
- Lokal lagring i nettleseren
- PWA-manifest, appikon og service worker
- Testvarsel når nettleseren støtter det

## Viktig avgrensning

Prototypen lagrer data lokalt på én enhet. For at familien skal kunne bruke appen samtidig på flere telefoner, må neste versjon kobles til Supabase for database, innlogging og tilgangskontroll. Ukentlig automatisk pushvarsel trenger også en liten serverjobb. Begge deler kan settes opp på gratisnivåene.

## Starte lokalt

```bash
npm install
npm run dev
```

Åpne adressen som Vite viser, vanligvis `http://localhost:5173`.

## Bygge produksjonsversjon

```bash
npm run build
npm run preview
```

## Foreslått neste tekniske steg

1. Opprett Supabase-prosjekt og tabeller for familier, medlemmer, oppgaver og innsendinger.
2. Legg inn Row Level Security slik at bare medlemmer av samme familie får lese data.
3. Bruk e-postlenke for foreldre og en enkel barne-PIN eller foreldrestyrt invitasjon.
4. Koble ukentlig beregning til Supabase Cron eller Vercel Cron.
5. Lagre push-abonnement per administrator og send ut betalingsvarsel.
