import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  claimInviteToken,
  getCurrentSession,
  sendEmailCode,
  signInAnonymously,
  signOutLocal,
  subscribeToAuth,
  verifyEmailCode,
} from '../../data/auth'
import { errorMessage } from '../../lib/format'
import { isSupabaseConfigured } from '../../lib/supabase'
import { AuthCard } from './AuthCard'

type AuthMode = 'email' | 'email-code' | 'invite'

const PENDING_INVITE_KEY = 'oppdragsklubben.pending-invite'

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

function LoadingGate() {
  return (
    <main className="loading-screen">
      <div className="spinner" />
      <strong>Kontrollerer innloggingen…</strong>
    </main>
  )
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [mode, setMode] = useState<AuthMode>('email')
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [inviteValue, setInviteValue] = useState('')
  const [pendingInviteToken, setPendingInviteToken] = useState(
    () => window.sessionStorage.getItem(PENDING_INVITE_KEY) ?? '',
  )
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const claimingInvite = useRef(false)

  const rememberPendingInvite = (token: string) => {
    setPendingInviteToken(token)
    window.sessionStorage.setItem(PENDING_INVITE_KEY, token)
  }

  const clearPendingInvite = () => {
    setPendingInviteToken('')
    window.sessionStorage.removeItem(PENDING_INVITE_KEY)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let active = true

    void (async () => {
      let currentSession = await getCurrentSession()
      const inviteToken = new URLSearchParams(window.location.search).get('invite')?.trim()

      if (inviteToken) {
        claimingInvite.current = true
        let createdAnonymousSession = false

        try {
          if (!currentSession) {
            currentSession = await signInAnonymously()
            createdAnonymousSession = Boolean(currentSession)
          }
          if (!currentSession) throw new Error('Kunne ikke opprette en sikker innlogging.')

          await claimInviteToken(inviteToken)
          await persistStorage()
          clearPendingInvite()
          window.history.replaceState({}, '', window.location.pathname)
          setNotice('Denne enheten er koblet til profilen.')
        } catch (error) {
          if (createdAnonymousSession) {
            await signOutLocal()
            currentSession = null
          }
          rememberPendingInvite(inviteToken)
          const failedInviteUrl = window.location.href
          window.history.replaceState({}, '', window.location.pathname)
          setInviteValue(failedInviteUrl)
          setMode('invite')
          setNotice(
            `Invitasjonen kunne ikke brukes anonymt: ${errorMessage(error)} `
            + 'Er dette en vokseninvitasjon, må du logge inn med e-post først.',
          )
        } finally {
          claimingInvite.current = false
        }
      }

      if (!active) return
      setSession(currentSession)
      setReady(true)
    })().catch((error) => {
      if (!active) return
      setNotice(errorMessage(error))
      setReady(true)
    })

    const unsubscribe = subscribeToAuth((nextSession) => {
      if (!active) return
      if (claimingInvite.current) return
      setSession(nextSession)
      setReady(true)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return

    setBusy(true)
    try {
      await sendEmailCode(normalizedEmail)
      setEmail(normalizedEmail)
      setEmailCode('')
      setMode('email-code')
      setNotice(
        pendingInviteToken
          ? 'Sjekk e-posten. Etter innlogging kobles voksenprofilen til familien.'
          : 'Sjekk e-posten din og skriv inn innloggingskoden.',
      )
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault()
    const token = emailCode.replace(/\D/g, '')
    if (token.length < 6 || token.length > 10) {
      setNotice('Skriv inn koden fra e-posten.')
      return
    }

    setBusy(true)
    claimingInvite.current = Boolean(pendingInviteToken)
    try {
      const nextSession = await verifyEmailCode(email.trim().toLowerCase(), token)
      if (!nextSession) throw new Error('Innloggingen ga ingen gyldig økt.')

      if (pendingInviteToken) {
        try {
          await claimInviteToken(pendingInviteToken)
          clearPendingInvite()
          setNotice('Voksenprofilen er koblet til familien.')
        } catch (error) {
          await signOutLocal()
          setInviteValue(pendingInviteToken)
          setMode('invite')
          throw new Error(`Invitasjonen kunne ikke brukes: ${errorMessage(error)}`)
        }
      } else {
        setNotice('Du er logget inn på denne enheten.')
      }

      await persistStorage()
      setSession(nextSession)
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      claimingInvite.current = false
      setBusy(false)
    }
  }

  const claimInvite = async (event: FormEvent) => {
    event.preventDefault()
    const token = extractInviteToken(inviteValue)
    if (!token) {
      setNotice('Lim inn invitasjonslenken du har fått av en voksen.')
      return
    }

    setBusy(true)
    claimingInvite.current = true
    let createdAnonymousSession = false

    try {
      let currentSession = await getCurrentSession()
      if (!currentSession) {
        currentSession = await signInAnonymously()
        createdAnonymousSession = Boolean(currentSession)
      }
      if (!currentSession) throw new Error('Kunne ikke opprette en sikker innlogging.')

      await claimInviteToken(token)
      await persistStorage()
      clearPendingInvite()
      window.history.replaceState({}, '', window.location.pathname)
      setSession(currentSession)
      setNotice('Denne enheten er koblet til profilen.')
    } catch (error) {
      if (createdAnonymousSession) await signOutLocal()
      rememberPendingInvite(token)
      setNotice(
        `Invitasjonen kunne ikke brukes anonymt: ${errorMessage(error)} `
        + 'Voksne må velge vokseninnlogging og bruke sin egen e-post.',
      )
    } finally {
      claimingInvite.current = false
      setBusy(false)
    }
  }

  const prepareAdultInvite = () => {
    const token = extractInviteToken(inviteValue)
    if (!token) {
      setNotice('Lim inn vokseninvitasjonen først.')
      return
    }
    rememberPendingInvite(token)
    setMode('email')
    setNotice('Logg inn med din egen e-post. Invitasjonen brukes etter at koden er godkjent.')
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
        <form className="auth-form" onSubmit={verifyCode}>
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
          <button className="primary-button" disabled={busy}>
            {busy ? 'Kontrollerer…' : 'Logg inn'}
          </button>
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
        title="Koble til en profil"
        text="Barn kan lime inn lenken og koble til direkte. En voksen må først velge vokseninnlogging, logge inn med sin egen e-post og deretter bruke invitasjonen."
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
          <button className="primary-button" disabled={busy}>
            {busy ? 'Kobler til…' : 'Koble til barneprofil'}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={prepareAdultInvite}
          >
            Jeg er voksen – logg inn først
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setInviteValue('')
              setNotice('')
              clearPendingInvite()
              setMode('email')
            }}
          >
            Tilbake til vanlig innlogging
          </button>
        </form>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Velkommen til Oppdragsklubben"
      text={pendingInviteToken
        ? 'Logg inn med din egen e-post for å godta vokseninvitasjonen.'
        : 'Voksne logger inn med en kode fra e-post. Barn bruker invitasjonslenken de får av en voksen.'}
      notice={notice}
    >
      <form className="auth-form" onSubmit={submitEmail}>
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
        <button className="primary-button" disabled={busy}>
          {busy ? 'Sender…' : 'Send innloggingskode'}
        </button>
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
