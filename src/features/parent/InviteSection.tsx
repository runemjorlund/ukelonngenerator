import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { InviteLinkBox } from '../../components/InviteLinkBox'
import { Section } from '../../components/Section'
import {
  createAdminInvite,
  createChildInvite,
  createReconnectInvite,
} from '../../data/api'
import type { Member } from '../../data/types'
import { errorMessage } from '../../lib/format'

const PROFILE_EMOJIS = ['🦊', '🐙', '🐼', '🦁', '🐬', '🦄', '🚀', '🎨', '⚽', '🎧', '🌟', '🛹']

function inviteUrl(token: string) {
  const url = new URL(window.location.origin)
  url.searchParams.set('invite', token)
  return url.toString()
}

export function InviteSection({ children, refresh, onNotice }: {
  children: Member[]
  refresh: () => void
  onNotice: (value: string) => void
}) {
  const [childName, setChildName] = useState('')
  const [childEmoji, setChildEmoji] = useState('🦊')
  const [adultName, setAdultName] = useState('')
  const [adultEmoji, setAdultEmoji] = useState('🚀')
  const [currentInviteUrl, setCurrentInviteUrl] = useState('')
  const [inviteAudience, setInviteAudience] = useState<'barn' | 'voksen'>('barn')
  const [reconnectBusyId, setReconnectBusyId] = useState('')

  const createChild = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const result = await createChildInvite(childName.trim(), childEmoji)
      setCurrentInviteUrl(inviteUrl(result.invite_token))
      setInviteAudience('barn')
      setChildName('')
      onNotice('Barneinvitasjonen er klar. Den kan bare brukes én gang.')
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    }
  }

  const createAdult = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const result = await createAdminInvite(adultName.trim(), adultEmoji)
      setCurrentInviteUrl(inviteUrl(result.invite_token))
      setInviteAudience('voksen')
      setAdultName('')
      onNotice('Vokseninvitasjonen er klar. Den kan bare brukes én gang.')
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    }
  }

  const copyInvite = async () => {
    await navigator.clipboard.writeText(currentInviteUrl)
    onNotice('Invitasjonslenken er kopiert.')
  }

  const reconnectChild = async (child: Member) => {
    const action = child.auth_user_id
      ? 'koble fra den gamle enheten og lage en ny lenke'
      : 'lage en ny lenke'
    const confirmed = window.confirm(
      `Vil du ${action} for ${child.display_name}? Oppgavehistorikken blir beholdt.`,
    )
    if (!confirmed) return

    setReconnectBusyId(child.id)
    try {
      const result = await createReconnectInvite(child.id)
      setCurrentInviteUrl(inviteUrl(result.invite_token))
      setInviteAudience('barn')
      onNotice(`Ny invitasjon til ${child.display_name} er klar. Den gamle enheten er koblet fra.`)
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    } finally {
      setReconnectBusyId('')
    }
  }

  return (
    <Section title="Inviter familie" eyebrow="Én trygg lenke per profil">
      <div className="invite-grid">
        <form className="compact-form" onSubmit={createChild}>
          <strong>Inviter et barn</strong>
          <div className="form-row">
            <select value={childEmoji} onChange={(event) => setChildEmoji(event.target.value)}>
              {PROFILE_EMOJIS.map((emoji) => <option key={emoji}>{emoji}</option>)}
            </select>
            <input
              required
              placeholder="Barnets navn"
              value={childName}
              onChange={(event) => setChildName(event.target.value)}
            />
          </div>
          <button className="primary-button"><Plus size={17} /> Lag barneinvitasjon</button>
        </form>

        <form className="compact-form" onSubmit={createAdult}>
          <strong>Inviter en voksen</strong>
          <p className="form-help">
            Den voksne må logge inn med sin egen e-post før lenken brukes.
          </p>
          <div className="form-row">
            <select value={adultEmoji} onChange={(event) => setAdultEmoji(event.target.value)}>
              {PROFILE_EMOJIS.map((emoji) => <option key={emoji}>{emoji}</option>)}
            </select>
            <input
              required
              placeholder="Den voksnes navn"
              value={adultName}
              onChange={(event) => setAdultName(event.target.value)}
            />
          </div>
          <button className="primary-button"><Plus size={17} /> Lag vokseninvitasjon</button>
        </form>
      </div>

      {currentInviteUrl && (
        <InviteLinkBox
          url={currentInviteUrl}
          audience={inviteAudience}
          onCopy={() => void copyInvite()}
        />
      )}

      <div className="member-list">
        {children.map((child) => (
          <div key={child.id}>
            <span className="avatar" style={{ background: child.profile_color }}>{child.emoji}</span>
            <div>
              <strong>{child.display_name}</strong>
              <small>{child.auth_user_id ? 'Enhet koblet til' : 'Venter på invitasjon'}</small>
            </div>
            <button
              className="secondary-button reconnect-button"
              disabled={reconnectBusyId === child.id}
              onClick={() => void reconnectChild(child)}
            >
              {reconnectBusyId === child.id
                ? 'Lager lenke…'
                : child.auth_user_id ? 'Koble til på nytt' : 'Lag ny lenke'}
            </button>
          </div>
        ))}
      </div>
    </Section>
  )
}
