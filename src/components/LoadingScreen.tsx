export function LoadingScreen({ text = 'Laster familierommet…' }: { text?: string }) {
  return (
    <main className="loading-screen">
      <div className="spinner" />
      <strong>{text}</strong>
    </main>
  )
}
