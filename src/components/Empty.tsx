import { CheckCircle2 } from 'lucide-react'

export function Empty({ text, title = 'Alt er ajour' }: { text: string, title?: string }) {
  return (
    <div className="empty">
      <CheckCircle2 size={30} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}
