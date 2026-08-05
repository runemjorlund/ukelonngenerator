import type { ReactNode } from 'react'
import { LogOut, Sparkles } from 'lucide-react'
import type { Family, Member } from '../data/types'

export function AppShell({ family, member, notice, onSignOut, children }: {
  family: Family
  member: Member
  notice: string
  onSignOut: () => void
  children: ReactNode
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span><Sparkles size={20} /></span>
          <div>
            <strong>{family.name}</strong>
            <small>Små oppdrag. Stor mestring.</small>
          </div>
        </div>
        <div className="account">
          <span className="avatar" style={{ background: member.profile_color }}>{member.emoji}</span>
          <div>
            <strong>{member.display_name}</strong>
            <small>{member.role === 'administrator' ? 'Voksen' : 'Barn'}</small>
          </div>
          {member.role === 'administrator' && (
            <button className="icon-button" onClick={onSignOut} aria-label="Logg ut">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>
      <main>{children}</main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}
