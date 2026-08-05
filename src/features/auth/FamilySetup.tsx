import { useState, type FormEvent } from 'react'
import { AuthLayout } from '../../components/AuthLayout'
import { createFamily } from '../../data/api'
import { errorMessage } from '../../lib/format'

export function CreateFamily({ onCreated, onNotice, notice }: {
  onCreated: () => void
  onNotice: (value: string) => void
  notice: string
}) {
  const [familyName, setFamilyName] = useState('Oppdragsklubben')
  const [displayName, setDisplayName] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await createFamily(familyName.trim(), displayName.trim())
      onCreated()
    } catch (error) {
      onNotice(errorMessage(error))
    }
  }

  return (
    <AuthLayout
      title="Opprett familiens klubb"
      text="Du blir administrator og kan invitere barn og en annen voksen etterpå."
    >
      <form className="auth-form" onSubmit={submit}>
        <label>
          Familiens navn
          <input
            required
            value={familyName}
            onChange={(event) => setFamilyName(event.target.value)}
          />
        </label>
        <label>
          Ditt navn
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <button className="primary-button">Opprett familie</button>
      </form>
      {notice && <p className="inline-notice">{notice}</p>}
    </AuthLayout>
  )
}

export function InvalidInvite({ notice, onSignOut }: {
  notice: string
  onSignOut: () => void
}) {
  return (
    <AuthLayout
      title="Invitasjonen virker ikke"
      text="Be en voksen lage en ny invitasjonslenke fra familieoversikten."
    >
      {notice && <p className="inline-notice">{notice}</p>}
      <button className="secondary-button" onClick={onSignOut}>Tilbake til innlogging</button>
    </AuthLayout>
  )
}

export function ConfigurationMissing() {
  return (
    <AuthLayout
      title="Supabase må kobles til"
      text="Frontend-koden er klar, men Vercel mangler miljøvariablene VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY og VITE_VAPID_PUBLIC_KEY."
    >
      <p className="inline-notice">Se supabase/README.md i repoet for hele oppsettet.</p>
    </AuthLayout>
  )
}
