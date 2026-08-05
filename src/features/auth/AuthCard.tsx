import type { ReactNode } from 'react'
import { ShieldCheck, Sparkles } from 'lucide-react'

export function AuthCard({ title, text, notice, children }: {
  title: string
  text: string
  notice: string
  children: ReactNode
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo"><Sparkles size={27} /></div>
        <span className="eyebrow">Oppdragsklubben</span>
        <h1>{title}</h1>
        <p>{text}</p>
        {children}
        {notice && <p className="inline-notice" role="status">{notice}</p>}
        <p className="privacy-note">
          <ShieldCheck size={18} />
          Familiens oppgaver og beløp er private og beskyttet i databasen.
        </p>
      </section>
    </main>
  )
}
