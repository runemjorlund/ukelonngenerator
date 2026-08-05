import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

export function AuthLayout({ title, text, children }: {
  title: string
  text: string
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
      </section>
    </main>
  )
}
