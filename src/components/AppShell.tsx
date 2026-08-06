import { useRef, useState } from 'react'
import type { ReactNode, TouchEvent } from 'react'
import { LogOut, RefreshCw, Sparkles } from 'lucide-react'
import type { Family, Member } from '../data/types'
import './AppShell.css'

const pullThreshold = 72
const maxPullDistance = 112
const pullResistance = 0.55

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
  const pullStartY = useRef<number | null>(null)
  const pullDistanceRef = useRef(0)

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
          <div>
            <strong>{member.display_name}</strong>
            <small>{member.role === 'administrator' ? 'Voksen' : 'Barn'}</small>
          </div>
          <span className="account-actions">
            <button
              className={`icon-button refresh-button${refreshing ? ' is-refreshing' : ''}`}
              onClick={requestRefresh}
              disabled={refreshDisabled}
              aria-label={refreshing ? 'Oppdaterer data' : 'Oppdater data'}
              title="Oppdater data"
            >
              <RefreshCw size={18} />
            </button>
            {member.role === 'administrator' && (
              <button className="icon-button" onClick={onSignOut} aria-label="Logg ut">
                <LogOut size={18} />
              </button>
            )}
          </span>
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
