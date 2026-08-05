import { Coins } from 'lucide-react'
import type { Member, Payout } from '../data/types'
import { formatDate, formatMoney } from '../lib/format'

export function PayoutHistoryList({ payouts, members, compact = false }: {
  payouts: Payout[]
  members: Member[]
  compact?: boolean
}) {
  const visible = compact ? payouts.slice(0, 4) : payouts

  if (visible.length === 0) {
    return <p className="help-text">Ingen utbetalinger er registrert ennå.</p>
  }

  return (
    <div className={`payout-history-list ${compact ? 'compact' : ''}`}>
      {visible.map((payout) => {
        const child = members.find((item) => item.id === payout.child_member_id)
        return (
          <div className="payout-history-item" key={payout.id}>
            <span className="payout-history-icon"><Coins size={18} /></span>
            <div>
              <strong>{child?.display_name ?? 'Slettet profil'}</strong>
              <small>{formatDate(payout.paid_at)}</small>
            </div>
            <strong>{formatMoney(payout.total_ore)}</strong>
          </div>
        )
      })}
    </div>
  )
}
