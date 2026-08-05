import type { ReactNode } from 'react'

export function Section({ title, eyebrow, children, className = '' }: {
  title: string
  eyebrow: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`section ${className}`.trim()}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  )
}
