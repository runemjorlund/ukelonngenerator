import { Clock3, Coins, ShieldCheck, Users } from 'lucide-react'
import { PayoutHistoryList } from '../../components/PayoutHistoryList'
import { Section } from '../../components/Section'
import { decideSubmission } from '../../data/api'
import type { Family, Member, Payout, Submission, Task } from '../../data/types'
import { errorMessage, formatMoney } from '../../lib/format'
import { ApprovalSection } from './ApprovalSection'
import { DangerZone } from './DangerZone'
import { InviteSection } from './InviteSection'
import { PayoutSection } from './PayoutSection'
import { PushSettings } from './PushSettings'
import { TaskSection } from './TaskSection'

export function ParentDashboard({
  family,
  member,
  members,
  tasks,
  submissions,
  payouts,
  refresh,
  onNotice,
  onFamilyDeleted,
}: {
  family: Family
  member: Member
  members: Member[]
  tasks: Task[]
  submissions: Submission[]
  payouts: Payout[]
  refresh: () => void
  onNotice: (value: string) => void
  onFamilyDeleted: () => void
}) {
  const pending = submissions.filter((submission) => submission.status === 'venter')
  const approved = submissions.filter((submission) => submission.status === 'godkjent')
  const approvedOre = approved.reduce((total, submission) => total + submission.amount_ore, 0)
  const children = members.filter((item) => item.role === 'barn')

  const decide = async (submissionId: string, status: 'godkjent' | 'avvist') => {
    try {
      await decideSubmission(submissionId, status, member.id)
      onNotice(status === 'godkjent' ? 'Oppdraget er godkjent.' : 'Oppdraget er avvist.')
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    }
  }

  return (
    <div className="dashboard">
      <section className="welcome-row">
        <div>
          <span className="eyebrow">Voksenoversikt</span>
          <h1>Hei, {member.display_name}</h1>
          <p>Godkjenn oppdrag, inviter familien og hold utbetalingene samlet.</p>
        </div>
        <span className="secure-pill"><ShieldCheck size={17} /> Privat familierom</span>
      </section>

      <section className="summary-grid">
        <article className="summary-card dark">
          <Coins size={24} />
          <span>Klar til utbetaling</span>
          <strong>{formatMoney(approvedOre)}</strong>
          <small>fordelt per barn nedenfor</small>
        </article>
        <article className="summary-card">
          <Clock3 size={24} />
          <span>Venter på deg</span>
          <strong>{pending.length}</strong>
          <small>innsendte oppdrag</small>
        </article>
        <article className="summary-card">
          <Users size={24} />
          <span>Familien</span>
          <strong>{children.length}</strong>
          <small>barneprofiler</small>
        </article>
      </section>

      <ApprovalSection
        pending={pending}
        tasks={tasks}
        members={members}
        onDecide={(submissionId, status) => void decide(submissionId, status)}
      />

      <PayoutSection
        children={children}
        submissions={submissions}
        refresh={refresh}
        onNotice={onNotice}
      />

      <Section title="Utbetalingshistorikk" eyebrow="Nyeste først">
        <PayoutHistoryList payouts={payouts} members={members} />
      </Section>

      <div className="two-column">
        <TaskSection
          family={family}
          tasks={tasks}
          refresh={refresh}
          onNotice={onNotice}
        />
        <InviteSection children={children} refresh={refresh} onNotice={onNotice} />
      </div>

      <PushSettings family={family} refresh={refresh} onNotice={onNotice} />

      <DangerZone
        family={family}
        children={children}
        refresh={refresh}
        onNotice={onNotice}
        onFamilyDeleted={onFamilyDeleted}
      />
    </div>
  )
}
