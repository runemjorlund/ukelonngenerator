import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Section } from '../../components/Section'
import { deleteFamilyData, deleteMemberProfile } from '../../data/api'
import type { Family, Member } from '../../data/types'
import { errorMessage } from '../../lib/format'

export function DangerZone({ family, children, refresh, onNotice, onFamilyDeleted }: {
  family: Family
  children: Member[]
  refresh: () => void
  onNotice: (value: string) => void
  onFamilyDeleted: () => void
}) {
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [memberConfirmation, setMemberConfirmation] = useState('')
  const [familyConfirmation, setFamilyConfirmation] = useState('')
  const [busy, setBusy] = useState(false)

  const deleteMember = async () => {
    if (!memberToDelete || memberConfirmation !== memberToDelete.display_name) return
    setBusy(true)
    try {
      await deleteMemberProfile(memberToDelete.id)
      onNotice(`${memberToDelete.display_name} og profilens historikk er slettet.`)
      setMemberToDelete(null)
      setMemberConfirmation('')
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const deleteFamily = async () => {
    if (familyConfirmation !== family.name) return
    const confirmed = window.confirm(
      'Dette sletter familien, alle oppgaver, innsendinger og utbetalinger permanent. Fortsette?',
    )
    if (!confirmed) return

    setBusy(true)
    try {
      await deleteFamilyData()
      onFamilyDeleted()
    } catch (error) {
      onNotice(errorMessage(error))
      setBusy(false)
    }
  }

  return (
    <Section title="Faresone" eyebrow="Permanent sletting" className="danger-zone">
      <div className="danger-grid">
        <article className="danger-card">
          <div>
            <strong>Slett en profil</strong>
            <p>Profilen, innsendingene og utbetalingshistorikken til barnet slettes permanent.</p>
          </div>
          <label>
            Velg profil
            <select
              value={memberToDelete?.id ?? ''}
              onChange={(event) => {
                setMemberToDelete(children.find((child) => child.id === event.target.value) ?? null)
                setMemberConfirmation('')
              }}
            >
              <option value="">Velg et barn</option>
              {children.map((child) => (
                <option value={child.id} key={child.id}>{child.display_name}</option>
              ))}
            </select>
          </label>
          {memberToDelete && (
            <label>
              Skriv {memberToDelete.display_name} for å bekrefte
              <input
                value={memberConfirmation}
                onChange={(event) => setMemberConfirmation(event.target.value)}
              />
            </label>
          )}
          <button
            className="danger-button"
            disabled={!memberToDelete || memberConfirmation !== memberToDelete.display_name || busy}
            onClick={() => void deleteMember()}
          >
            <Trash2 size={17} /> Slett profilen permanent
          </button>
        </article>

        <article className="danger-card danger-card-family">
          <div>
            <strong>Slett familien og alle data</strong>
            <p>
              Alle oppgaver, innsendinger, profiler og hele utbetalingshistorikken slettes permanent.
            </p>
          </div>
          <label>
            Skriv {family.name} for å bekrefte
            <input
              value={familyConfirmation}
              onChange={(event) => setFamilyConfirmation(event.target.value)}
            />
          </label>
          <button
            className="danger-button"
            disabled={familyConfirmation !== family.name || busy}
            onClick={() => void deleteFamily()}
          >
            <Trash2 size={17} /> Slett familien permanent
          </button>
        </article>
      </div>
    </Section>
  )
}
