import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ShieldCheck, Sparkles } from 'lucide-react'
import { getSupabase, isSupabaseConfigured } from './lib/supabase'

type AuthMode = 'email' | 'email-code' | 'invite'

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message
  : 'Noe gikk galt. Prøv igjen.'

const persistStorage = async () => {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    // Appen fungerer også når nettleseren ikke gir eksplisitt varig lagring.
  }
}

const extractInviteToken = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    return url.searchParams.get('invite')?.trim() ?? ''
  } catch {
    const match = trimmed.match(/[?&]invite=([^&#]+)/i)
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]).trim()
      } catch {
        return match[1].trim()
      }
    }
    return trimmed.replace(/\s+/g, '')
  }
}

function AuthCard({ title, text, notice, children }: {
  title: string
  text: string
  notice: string
  children: ReactNode
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo"><Sparkles size={27} /></div>
        <span className="eyebrow">Oppdragsklubben</span>
        <h1>{title}</h1>
        <p>{text}</p>
        {children}
        {notice && <p className="inline-notice" role="status">{notice}</p>}
        <p className="privacy-note"><ShieldCheck size={18} /> Familiens oppgaver og beløp er private og beskyttet i databasen.</p>
      </section>
    </main>
  )
}

function LoadingGate() {
  return <main className="loading-screen"><div className="spinner" /><strong>Kontrollerer innloggingen…</strong></main>
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [mode, setMode] = useState<AuthMode>('email')
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [inviteValue, setInviteValue] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const claimingInvite = useRef(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const client = getSupabase()
    let active = true

    void (async () => {
      let currentSession = (await client.auth.getSession()).data.session
      const inviteToken = new URLSearchParams(window.location.search).get('invite')?.trim()

      if (inviteToken) {
        claimingInvite.current = true
        let createdAnonymousSession = false

        try {
          if (currentSession && !currentSession.user.is_anonymous) {
            throw new Error('Logg ut av voksenkontoen før du bruker en barneinvitasjon.')
          }

          if (!currentSession) {
            const { data, error } = await client.auth.signInAnonymously()
            if (error) throw error
            currentSession = data.session
            createdAnonymousSession = true
          }

          if (!currentSession) throw new Error('Kunne ikke opprette en sikker barneinnlogging.')

          const { error } = await client.rpc('claim_child_invite', { p_token: inviteToken })
          if (error) throw error

          await persistStorage()
          window.history.replaceState({}, '', window.location.pathname)
          setNotice('Denne enheten er koblet til barneprofilen.')
        } catch (error) {
          if (createdAnonymousSession) {
            await client.auth.signOut({ scope: 'local' })
            currentSession = null
          }
          window.history.replaceState({}, '', window.location.pathname)
          setInviteValue(window.location.href)
          setMode('invite')
          setNotice(`Invitasjonen kunne ikke brukes: ${errorMessage(error)}`)
        } finally {
          claimingInvite.current = false
        }
      }

      if (!active) return
      setSession(currentSession)
      setReady(true)
    })()

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      if (claimingInvite.current && nextSession?.user.is_anonymous) return
      setSession(nextSession)
      setReady(true)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const sendEmailCode = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return

    setBusy(true)
    const { error } = await getSupabase().auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)

    if (error) {
      setNotice(error.message)
      return
    }

    setEmail(normalizedEmail)
    setEmailCode('')
    setMode('email-code')
    setNotice('Sjekk e-posten din og skriv inn innloggingskoden.')
  }

  const verifyEmailCode = async (event: FormEvent) => {
    event.preventDefault()
    const token = emailCode.replace(/\D/g, '')
    if (token.length < 6 || token.length > 10) {
      setNotice('Skriv inn koden fra e-posten.')
      return
    }

    setBusy(true)
    const { data, error } = await getSupabase().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    })
    setBusy(false)

    if (error) {
      setNotice(error.message)
      return
    }

    await persistStorage()
    setSession(data.session)
    setNotice('Du er logget inn på denne enheten.')
  }

  const claimInvite = async (event: FormEvent) => {
    event.preventDefault()
    const token = extractInviteToken(inviteValue)
    if (!token) {
      setNotice('Lim inn invitasjonslenken du har fått av en voksen.')
      return
    }

    const client = getSupabase()
    setBusy(true)
    claimingInvite.current = true
    let createdAnonymousSession = false

    try {
      let currentSession = (await client.auth.getSession()).data.session
      if (currentSession && !currentSession.user.is_anonymous) {
        throw new Error('Logg ut av voksenkontoen før du bruker en barneinvitasjon.')
      }

      if (!currentSession) {
        const { data, error } = await client.auth.signInAnonymously()
        if (error) throw error
        currentSession = data.session
        createdAnonymousSession = true
      }

      if (!currentSession) throw new Error('Kunne ikke opprette en sikker barneinnlogging.')

      const { error } = await client.rpc('claim_child_invite', { p_token: token })
      if (error) throw error

      await persistStorage()
      window.history.replaceState({}, '', window.location.pathname)
      setSession(currentSession)
      setNotice('Denne enheten er koblet til barneprofilen.')
    } catch (error) {
      if (createdAnonymousSession) await client.auth.signOut({ scope: 'local' })
      setNotice(`Invitasjonen kunne ikke brukes: ${errorMessage(error)}`)
    } finally {
      claimingInvite.current = false
      setBusy(false)
    }
  }

  if (!isSupabaseConfigured || session) return children
  if (!ready) return <LoadingGate />

  if (mode === 'email-code') {
    return (
      <AuthCard
        title="Skriv inn innloggingskoden"
        text={`Vi sendte koden til ${email}. Skriv den inn i appen, slik at innloggingen lagres på denne enheten.`}
        notice={notice}
      >
        <form className="auth-form" onSubmit={verifyEmailCode}>
          <label>
            Innloggingskode
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              minLength={6}
              maxLength={10}
              value={emailCode}
              onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </label>
          <button className="primary-button" disabled={busy}>{busy ? 'Kontrollerer…' : 'Logg inn'}</button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setEmailCode('')
              setNotice('')
              setMode('email')
            }}
          >
            Bruk en annen e-postadresse
          </button>
        </form>
      </AuthCard>
    )
  }

  if (mode === 'invite') {
    return (
      <AuthCard
        title="Koble til barneprofil"
        text="Installer Oppdragsklubben på Hjem-skjermen først. Kopier deretter invitasjonslenken, åpne den installerte appen og lim inn lenken her."
        notice={notice}
      >
        <form className="auth-form" onSubmit={claimInvite}>
          <label>
            Invitasjonslenke
            <input
              type="text"
              required
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={inviteValue}
              onChange={(event) => setInviteValue(event.target.value)}
            />
          </label>
          <button className="primary-button" disabled={busy}>{busy ? 'Kobler til…' : 'Koble til barneprofil'}</button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setInviteValue('')
              setNotice('')
              setMode('email')
            }}
          >
            Tilbake til vokseninnlogging
          </button>
        </form>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Velkommen til Oppdragsklubben"
      text="Voksne logger inn med en kode fra e-post. Barn bruker invitasjonslenken de får av en voksen."
      notice={notice}
    >
      <form className="auth-form" onSubmit={sendEmailCode}>
        <label>
          E-postadresse
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button className="primary-button" disabled={busy}>{busy ? 'Sender…' : 'Send innloggingskode'}</button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            setNotice('')
            setMode('invite')
          }}
        >
          Jeg har en invitasjonslenke
        </button>
      </form>
    </AuthCard>
  )
}
