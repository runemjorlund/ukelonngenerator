import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AppShell } from './components/AppShell'
import { LoadingScreen } from './components/LoadingScreen'
import {
  loadFamilyRoom,
  subscribeToFamilyChanges,
} from './data/api'
import {
  getCurrentSession,
  signOutLocal,
  subscribeToAuth,
} from './data/auth'
import type { Family, Member, Payout, Submission, Task } from './data/types'
import { ChildDashboard } from './features/child/ChildDashboard'
import {
  ConfigurationMissing,
  CreateFamily,
  InvalidInvite,
} from './features/auth/FamilySetup'
import { ParentDashboard } from './features/parent/ParentDashboard'
import { errorMessage } from './lib/format'
import { isSupabaseConfigured } from './lib/supabase'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [member, setMember] = useState<Member | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [notice, setNotice] = useState('')

  const clearRoom = useCallback(() => {
    setMember(null)
    setFamily(null)
    setMembers([])
    setTasks([])
    setSubmissions([])
    setPayouts([])
  }, [])

  const refresh = useCallback(async (userId = session?.user.id) => {
    if (!userId || !isSupabaseConfigured) return
    setLoading(true)
    try {
      const room = await loadFamilyRoom(userId)
      setMember(room.member)
      setFamily(room.family)
      setMembers(room.members)
      setTasks(room.tasks)
      setSubmissions(room.submissions)
      setPayouts(room.payouts)
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [session?.user.id])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true)
      return
    }

    let active = true
    void getCurrentSession()
      .then((currentSession) => {
        if (!active) return
        setSession(currentSession)
        setAuthReady(true)
      })
      .catch((error) => {
        if (!active) return
        setNotice(errorMessage(error))
        setAuthReady(true)
      })

    const unsubscribe = subscribeToAuth((nextSession) => {
      if (!active) return
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session) void refresh(session.user.id)
    else clearRoom()
  }, [clearRoom, refresh, session])

  useEffect(() => {
    if (!family) return
    return subscribeToFamilyChanges(family.id, () => void refresh())
  }, [family, refresh])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const signOut = async () => {
    try {
      await signOutLocal()
      setSession(null)
      clearRoom()
    } catch (error) {
      setNotice(errorMessage(error))
    }
  }

  if (!isSupabaseConfigured) return <ConfigurationMissing />
  if (!authReady || !session) return <LoadingScreen />
  if (loading && !member) return <LoadingScreen />

  if (!member || !family) {
    if (session.user.is_anonymous) {
      return <InvalidInvite notice={notice} onSignOut={() => void signOut()} />
    }
    return (
      <CreateFamily
        onCreated={() => void refresh()}
        onNotice={setNotice}
        notice={notice}
      />
    )
  }

  return (
    <AppShell
      family={family}
      member={member}
      notice={notice}
      onSignOut={() => void signOut()}
    >
      {member.role === 'administrator' ? (
        <ParentDashboard
          family={family}
          member={member}
          members={members}
          tasks={tasks}
          submissions={submissions}
          payouts={payouts}
          refresh={() => void refresh()}
          onNotice={setNotice}
          onFamilyDeleted={() => void signOut()}
        />
      ) : (
        <ChildDashboard
          member={member}
          tasks={tasks}
          submissions={submissions}
          payouts={payouts}
          refresh={() => void refresh()}
          onNotice={setNotice}
        />
      )}
    </AppShell>
  )
}

export default App
