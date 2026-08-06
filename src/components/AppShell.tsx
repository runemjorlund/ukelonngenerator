import { useEffect, useRef, useState } from 'react'
import type { ReactNode, TouchEvent } from 'react'
import { LogOut, RefreshCw, Sparkles } from 'lucide-react'
import type { Family, Member } from '../data/types'
import './AppShell.css'

const pullThreshold = 72
const maxPullDistance = 112
const pullResistance = 0.55
const signOutConfirmationId = 'sign-out-confirmation'

function pageIsAtTop() {
  return window.scrollY <= 0 && (document.scrollingElement?.scrollTop ?? 0) <= 0
}

export function AppShell({
  family,
  member,
  notice,
  refreshing,
  refreshDisabled,
  onRefresh,
  onSignOut,
  children,
}: {
  family: Family
  member: Member
  notice: string
  refreshing: boolean
  refreshDisabled: boolean
  onRefresh: () => Promise<void>
  onSignOut: () => void
  children: ReactNode
}) {
  const [pullDistance, setPullDistance] = useState(0)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const pullStartY = useRef<number | null>(null)
  const pullDistanceRef = useRef(0)
  const signOutControlRef = useRef<HTMLDivElement | null>(null)
  const signOutTriggerRef = useRef<HTMLButtonElement | null>(null)
  const cancelSignOutRef = useRef<HTMLButtonElement | null>(null)

  const updatePullDistance = (nextDistance: number) => {
    pullDistanceRef.current = nextDistance
    setPullDistance(nextDistance)
  }

  const resetPull = () => {
    pullStartY.current = null
    updatePullDistance(0)
  }

  const requestRefresh = () => {
    if (refreshDisabled) return
    void onRefresh()
  }

  const cancelSignOut = () => {
    setConfirmingSignOut(false)
    window.requestAnimationFrame(() => signOutTriggerRef.current?.focus())
  }

  const confirmSignOut = () => {
    setConfirmingSignOut(false)
    onSignOut()
  }

  useEffect(() => {
    if (!confirmingSignOut) return

    const focusFrame = window.requestAnimationFrame(() => cancelSignOutRef.current?.focus())

    const handlePointerDown = (event: PointerEvent) => {
      if (!signOutControlRef.current?.contains(event.target as Node)) {
        setConfirmingSignOut(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setConfirmingSignOut(false)
      window.requestAnimationFrame(() => signOutTriggerRef.current?.focus())
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [confirmingSignOut])

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches.item(0)
    if (refreshDisabled || event.touches.length !== 1 || !touch || !pageIsAtTop()) return
    pullStartY.current = touch.clientY
  }

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const startY = pullStartY.current
    const touch = event.touches.item(0)
    if (startY === null || !touch) return

    const dragDistance = touch.clientY - startY
    if (dragDistance <= 0 || !pageIsAtTop()) {
      updatePullDistance(0)
      return
    }

    updatePullDistance(Math.min(maxPullDistance, dragDistance * pullResistance))
  }

  const handleTouchEnd = () => {
    const shouldRefresh = pullDistanceRef.current >= pullThreshold
    resetPull()
    if (shouldRefresh) requestRefresh()
  }

  const pullProgress = Math.min(1, pullDistance / pullThreshold)
  const pullReady = pullProgress >= 1
  const indicatorVisible = refreshing || pullDistance > 6
  const indicatorOffset = refreshing ? 10 : Math.min(10, pullDistance - 48)
  const contentOffset = Math.min(24, pullDistance * 0.25)
  const indicatorText = refreshing
    ? 'Oppdaterer…'
    : pullReady
      ? 'Slipp for å oppdatere'
      : 'Dra ned for å oppdatere'

  return (
    <div
      className="app-shell"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={resetPull}
    >
      <header className="topbar">
        <div className="brand">
          <span><Sparkles size={20} /></span>
          <div>
            <strong>{family.name}</strong>
            <small>Små oppdrag. Stor mestring.</small>
          </div>
        </div>
        <div className="account">
          <span className="avatar" style={{ background: member.profile_color }}>{member.emoji}</span>
          <div className="account-details">
            <strong>{member.display_name}</strong>
            <small>{member.role === 'administrator' ? 'Voksen' : 'Barn'}</small>
          </div>
          <div className="account-actions">
            <button
              type="button"
              className={`icon-button refresh-button${refreshing ? ' is-refreshing' : ''}`}
              onClick={requestRefresh}
              disabled={refreshDisabled}
              aria-label={refreshing ? 'Oppdaterer data' : 'Oppdater data'}
              title="Oppdater data"
            >
              <RefreshCw size={18} />
            </button>
            {member.role === 'administrator' && (
              <div className="sign-out-control" ref={signOutControlRef}>
                <button
                  ref={signOutTriggerRef}
                  type="button"
                  className={`icon-button sign-out-button${confirmingSignOut ? ' is-active' : ''}`}
                  onClick={() => setConfirmingSignOut((current) => !current)}
                  aria-label={confirmingSignOut ? 'Lukk bekreftelse for utlogging' : 'Logg ut'}
                  aria-haspopup="dialog"
                  aria-expanded={confirmingSignOut}
                  aria-controls={signOutConfirmationId}
                  title="Logg ut"
                >
                  <LogOut size={18} />
                </button>
                {confirmingSignOut && (
                  <div
                    id={signOutConfirmationId}
                    className="sign-out-confirmation"
                    role="dialog"
                    aria-modal="false"
                    aria-labelledby={`${signOutConfirmationId}-title`}
                  >
                    <strong id={`${signOutConfirmationId}-title`}>
                      Er du sikker på at du vil logge ut?
                    </strong>
                    <span>Du kan logge inn igjen med en ny kode fra e-post.</span>
                    <div className="sign-out-confirmation-actions">
                      <button
                        ref={cancelSignOutRef}
                        type="button"
                        className="sign-out-cancel-button"
                        onClick={cancelSignOut}
                      >
                        Avbryt
                      </button>
                      <button
                        type="button"
                        className="sign-out-confirm-button"
                        onClick={confirmSignOut}
                      >
                        Ja, logg ut
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div
        className={`pull-refresh-indicator${pullReady ? ' is-ready' : ''}${refreshing ? ' is-refreshing' : ''}`}
        style={{
          opacity: indicatorVisible ? 1 : 0,
          transform: `translate(-50%, ${indicatorOffset}px)`,
        }}
        role="status"
        aria-hidden={!indicatorVisible}
      >
        <RefreshCw
          size={17}
          style={refreshing ? undefined : { transform: `rotate(${pullProgress * 180}deg)` }}
        />
        <span>{indicatorText}</span>
      </div>

      <main
        className={`app-content${pullDistance > 0 ? ' is-pulling' : ''}`}
        style={{ transform: contentOffset > 0 ? `translateY(${contentOffset}px)` : undefined }}
      >
        {children}
      </main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}
