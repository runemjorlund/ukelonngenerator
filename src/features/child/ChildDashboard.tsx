import type { CSSProperties } from 'react'
import { Clock3, RotateCcw, Send } from 'lucide-react'
import { PayoutHistoryList } from '../../components/PayoutHistoryList'
import { Section } from '../../components/Section'
import { Status } from '../../components/Status'
import { resubmitSubmission, submitTask } from '../../data/api'
import type { Member, Payout, Submission, Task } from '../../data/types'
import { errorMessage, formatMoney } from '../../lib/format'

export function ChildDashboard({ member, tasks, submissions, payouts, refresh, onNotice }: {
  member: Member
  tasks: Task[]
  submissions: Submission[]
  payouts: Payout[]
  refresh: () => void
  onNotice: (value: string) => void
}) {
  const mySubmissions = submissions.filter((submission) => submission.child_member_id === member.id)
  const latestSubmissionByTask = new Map<string, Submission>()
  for (const submission of mySubmissions) {
    if (!latestSubmissionByTask.has(submission.task_id)) {
      latestSubmissionByTask.set(submission.task_id, submission)
    }
  }
  const pendingTaskIds = new Set(
    [...latestSubmissionByTask.values()]
      .filter((submission) => submission.status === 'venter')
      .map((submission) => submission.task_id),
  )

  const earnedOre = mySubmissions
    .filter((submission) => ['godkjent', 'betalt'].includes(submission.status))
    .reduce((total, submission) => total + submission.amount_ore, 0)
  const myPayouts = payouts.filter((payout) => payout.child_member_id === member.id)

  const sendTask = async (task: Task) => {
    try {
      const latestSubmission = latestSubmissionByTask.get(task.id)
      if (latestSubmission?.status === 'avvist') {
        await resubmitSubmission(latestSubmission.id)
        onNotice('Oppdraget er sendt inn på nytt. Bra jobbet!')
      } else {
        await submitTask(task, member)
        onNotice('Bra jobbet! Oppdraget er sendt til de voksne.')
      }
      refresh()
    } catch (error) {
      onNotice(errorMessage(error))
    }
  }

  return (
    <div className="dashboard">
      <section
        className="child-hero"
        style={{ '--child-color': member.profile_color } as CSSProperties}
      >
        <div>
          <span className="eyebrow light">Dine oppdrag</span>
          <h1>Hei, {member.display_name}! {member.emoji}</h1>
          <p>Velg det du har gjort. En voksen sjekker og godkjenner etterpå.</p>
          <div className="child-stats">
            <span>
              <strong>{formatMoney(earnedOre)}</strong>
              <small>opptjent totalt</small>
            </span>
            <span>
              <strong>{pendingTaskIds.size}</strong>
              <small>venter på sjekk</small>
            </span>
          </div>
        </div>
      </section>

      <Section title="Hva har du gjort?" eyebrow="Aktive oppdrag">
        <div className="task-grid">
          {tasks.filter((task) => task.active).map((task) => {
            const waiting = pendingTaskIds.has(task.id)
            const canResubmit = latestSubmissionByTask.get(task.id)?.status === 'avvist'
            return (
              <article className="child-task" key={task.id}>
                <span className="task-icon large">{task.emoji}</span>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                  <span className="reward">{formatMoney(task.amount_ore)}</span>
                </div>
                <button
                  className={waiting ? 'waiting-button' : canResubmit ? 'secondary-button' : 'primary-button'}
                  disabled={waiting}
                  onClick={() => void sendTask(task)}
                >
                  {waiting ? (
                    <><Clock3 size={17} /> Venter på sjekk</>
                  ) : canResubmit ? (
                    <><RotateCcw size={17} /> Send inn på nytt</>
                  ) : (
                    <><Send size={17} /> Jeg har gjort den</>
                  )}
                </button>
              </article>
            )
          })}
        </div>
      </Section>

      <Section title="Din historikk" eyebrow="Siste oppdrag">
        <div className="history-list">
          {mySubmissions.slice(0, 8).map((submission) => {
            const task = tasks.find((item) => item.id === submission.task_id)
            return (
              <div key={submission.id}>
                <span>{task?.emoji ?? '✨'}</span>
                <div>
                  <strong>{task?.title ?? 'Arkivert oppgave'}</strong>
                  <small>{formatMoney(submission.amount_ore)}</small>
                </div>
                <Status value={submission.status} />
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Dine utbetalinger" eyebrow="Siste utbetalinger">
        <PayoutHistoryList payouts={myPayouts} members={[member]} compact />
      </Section>
    </div>
  )
}
