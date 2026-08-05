import type { SubmissionStatus } from '../data/types'

export function Status({ value }: { value: SubmissionStatus }) {
  const labels: Record<SubmissionStatus, string> = {
    venter: 'Venter',
    godkjent: 'Godkjent',
    avvist: 'Prøv igjen',
    betalt: 'Betalt',
  }
  return <span className={`status status-${value}`}>{labels[value]}</span>
}
