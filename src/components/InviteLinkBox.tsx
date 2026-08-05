import { Copy } from 'lucide-react'

export function InviteLinkBox({ url, audience, onCopy }: {
  url: string
  audience: 'barn' | 'voksen'
  onCopy: () => void
}) {
  const text = audience === 'voksen'
    ? 'Den voksne må først logge inn med sin egen e-post. Deretter åpner eller limer de inn denne lenken i appen. Lenken virker bare én gang.'
    : 'Åpne denne lenken på barnets telefon eller nettbrett. Den virker bare én gang.'

  return (
    <div className={`invite-box invite-box-${audience}`}>
      <p>{text}</p>
      <div>
        <input readOnly value={url} />
        <button className="icon-button" onClick={onCopy} aria-label="Kopier invitasjonslenke">
          <Copy size={18} />
        </button>
      </div>
    </div>
  )
}
