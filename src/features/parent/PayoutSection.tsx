import { useState } from 'react'
import { Coins } from 'lucide-react'
import { Section } from '../../components/Section'
import { createPayout } from '../../data/api'
import type { Member, Submission } from '../../data/types'
import { errorMessage, formatMoney } from '../../lib/format'

export function PayoutSection({ children, submissions, refresh, onNotice }: {
  children: Member[]
  submissions: Submission[]
  refresh: () => void
  onNotice: (value: string) => void
}) {
  const [busyChildId, setBusyChildId] = useState('')

  const approvedFor = (childId: string) => submissions
    .filter((submission) => (
      submission.child_member_id === childId && submission.status === 'godkjent'
    ))
    .reduce((total, submission) => total + submission.amount_ore, 0)

  const pay = async (child: Member) => {
    const amountOre = approvedFor(child.id)
    if (amountOre === 0) return
    const confirmed = window.confirm(
      `Betal ut ${formatMoney(amountOre)} til ${child.display_name}? `
      + 'Utbetalingen kan ikke angres.',
    )
    if (!confirmed) return

    setBusyChildId(child.id)
    try {
      await createPayout(child.id)
      onNotice(`${formatMoney(amountOre)} er registrert som utbetalt til ${child.display_name}.`)
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    } finally {
      setBusyChildId('')
    }
  }

  return (
    <Section title="Utbetaling per barn" eyebrow="Godkjente oppdrag">
      {children.length === 0 ? (
        <p className="help-text">Inviter et barn før du kan registrere utbetalinger.</p>
      ) : (
        <div className="payout-list">
          {children.map((child) => {
            const amountOre = approvedFor(child.id)
            return (
              <div className="payout-row" key={child.id}>
                <span className="avatar" style={{ background: child.profile_color }}>{child.emoji}</span>
                <div>
                  <strong>{child.display_name}</strong>
                  <small>{amountOre === 0 ? 'Ingen godkjente oppdrag' : 'Klar til utbetaling'}</small>
                </div>
                <strong className="payout-amount">{formatMoney(amountOre)}</strong>
                <button
                  className="primary-button payout-button"
                  disabled={amountOre === 0 || busyChildId === child.id}
                  onClick={() => void pay(child)}
                >
                  <Coins size={17} />
                  {busyChildId === child.id ? 'Betaler ut…' : 'Betal ut'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}
