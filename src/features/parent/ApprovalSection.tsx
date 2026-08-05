import { CheckCircle2, XCircle } from 'lucide-react'
import { Empty } from '../../components/Empty'
import { Section } from '../../components/Section'
import type { Member, Submission, Task } from '../../data/types'
import { formatMoney } from '../../lib/format'

export function ApprovalSection({ pending, tasks, members, onDecide }: {
  pending: Submission[]
  tasks: Task[]
  members: Member[]
  onDecide: (submissionId: string, status: 'godkjent' | 'avvist') => void
}) {
  return (
    <Section title="Til godkjenning" eyebrow={`${pending.length} venter`}>
      {pending.length === 0 ? (
        <Empty text="Ingen oppdrag venter akkurat nå." />
      ) : (
        <div className="card-list">
          {pending.map((submission) => {
            const task = tasks.find((item) => item.id === submission.task_id)
            const child = members.find((item) => item.id === submission.child_member_id)
            return (
              <article className="submission-card" key={submission.id}>
                <span className="task-icon">{task?.emoji ?? '✨'}</span>
                <div>
                  <strong>{task?.title ?? 'Arkivert oppgave'}</strong>
                  <small>
                    {child?.emoji} {child?.display_name} · {formatMoney(submission.amount_ore)}
                  </small>
                </div>
                <div className="actions">
                  <button
                    className="reject-button"
                    onClick={() => onDecide(submission.id, 'avvist')}
                  >
                    <XCircle size={18} /> Avvis
                  </button>
                  <button
                    className="approve-button"
                    onClick={() => onDecide(submission.id, 'godkjent')}
                  >
                    <CheckCircle2 size={18} /> Godkjenn
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </Section>
  )
}
