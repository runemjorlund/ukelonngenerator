import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Bell,
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import { subscribeToPush } from './lib/push'
import { getSupabase, isSupabaseConfigured } from './lib/supabase'
import './App.css'

type Role = 'administrator' | 'barn'
type SubmissionStatus = 'venter' | 'godkjent' | 'avvist' | 'betalt'

type Family = {
  id: string
  name: string
  notification_weekday: number
  notification_time: string
  timezone: string
}

type Member = {
  id: string
  family_id: string
  auth_user_id: string | null
  role: Role
  display_name: string
  emoji: string
  profile_color: string
}

type Task = {
  id: string
  family_id: string
  title: string
  description: string
  amount_ore: number
  emoji: string
  active: boolean
}

type Submission = {
  id: string
  family_id: string
  task_id: string
  child_member_id: string
  status: SubmissionStatus
  submitted_at: string
  decided_at: string | null
  decided_by: string | null
}

const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
const EMOJIS = ['🦊', '🐙', '🐼', '🦁', '🐬', '🦄', '🚀', '🎨', '⚽', '🎧', '🌟', '🛹']

const formatMoney = (ore: number) => new Intl.NumberFormat('nb-NO', {
  style: 'currency',
  currency: 'NOK',
  maximumFractionDigits: 0,
}).format(ore / 100)

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Noe gikk galt. Prøv igjen.'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [member, setMember] = useState<Member | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [notice, setNotice] = useState('')

  const refresh = async (userId = session?.user.id) => {
    if (!userId || !isSupabaseConfigured) return
    const client = getSupabase()
    setLoading(true)

    const { data: profile, error: profileError } = await client
      .from('family_members')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (profileError) {
      setNotice(profileError.message)
      setLoading(false)
      return
    }

    if (!profile) {
      setMember(null)
      setFamily(null)
      setMembers([])
      setTasks([])
      setSubmissions([])
      setLoading(false)
      return
    }

    const currentMember = profile as Member
    const [familyResult, membersResult, tasksResult, submissionsResult] = await Promise.all([
      client.from('families').select('id, name, notification_weekday, notification_time, timezone').eq('id', currentMember.family_id).single(),
      client.from('family_members').select('*').eq('family_id', currentMember.family_id).order('created_at'),
      client.from('tasks').select('*').eq('family_id', currentMember.family_id).order('created_at'),
      client.from('submissions').select('*').eq('family_id', currentMember.family_id).order('submitted_at', { ascending: false }),
    ])
    const firstError = familyResult.error ?? membersResult.error ?? tasksResult.error ?? submissionsResult.error
    if (firstError) setNotice(firstError.message)

    setMember(currentMember)
    setFamily((familyResult.data as Family | null) ?? null)
    setMembers((membersResult.data as Member[] | null) ?? [])
    setTasks((tasksResult.data as Task[] | null) ?? [])
    setSubmissions((submissionsResult.data as Submission[] | null) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true)
      return
    }

    const client = getSupabase()
    let active = true

    const initialize = async () => {
      let currentSession = (await client.auth.getSession()).data.session
      const inviteToken = new URLSearchParams(window.location.search).get('invite')

      if (inviteToken) {
        try {
          if (!currentSession) {
            const { data, error } = await client.auth.signInAnonymously()
            if (error) throw error
            currentSession = data.session
          }
          const { error } = await client.rpc('claim_child_invite', { p_token: inviteToken })
          if (error) throw error
          window.history.replaceState({}, '', window.location.pathname)
          setNotice('Denne enheten er koblet til barneprofilen.')
        } catch (error) {
          setNotice(`Invitasjonen kunne ikke brukes: ${errorMessage(error)}`)
        }
      }

      if (active) {
        setSession(currentSession)
        setAuthReady(true)
      }
    }

    void initialize()
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session) void refresh(session.user.id)
    else {
      setMember(null)
      setFamily(null)
      setMembers([])
      setTasks([])
      setSubmissions([])
    }
  }, [session?.user.id])

  useEffect(() => {
    if (!family) return
    const client = getSupabase()
    const channel = client
      .channel(`family-${family.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `family_id=eq.${family.id}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `family_id=eq.${family.id}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members', filter: `family_id=eq.${family.id}` }, () => void refresh())
      .subscribe()

    return () => { void client.removeChannel(channel) }
  }, [family?.id, session?.user.id])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (!isSupabaseConfigured) return <ConfigurationMissing />
  if (!authReady) return <LoadingScreen />
  if (!session) return <SignIn onNotice={setNotice} notice={notice} />
  if (loading && !member) return <LoadingScreen />

  if (!member || !family) {
    if (session.user.is_anonymous) {
      return <InvalidInvite notice={notice} onSignOut={() => void getSupabase().auth.signOut()} />
    }
    return <CreateFamily onCreated={() => void refresh()} onNotice={setNotice} notice={notice} />
  }

  return (
    <AppShell family={family} member={member} notice={notice} onSignOut={() => void getSupabase().auth.signOut()}>
      {member.role === 'administrator' ? (
        <ParentDashboard
          family={family}
          member={member}
          members={members}
          tasks={tasks}
          submissions={submissions}
          refresh={() => void refresh()}
          onNotice={setNotice}
        />
      ) : (
        <ChildDashboard
          family={family}
          member={member}
          tasks={tasks}
          submissions={submissions}
          refresh={() => void refresh()}
          onNotice={setNotice}
        />
      )}
    </AppShell>
  )
}

function AppShell({ family, member, notice, onSignOut, children }: {
  family: Family
  member: Member
  notice: string
  onSignOut: () => void
  children: React.ReactNode
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span><Sparkles size={20} /></span><div><strong>{family.name}</strong><small>Små oppdrag. Stor mestring.</small></div></div>
        <div className="account">
          <span className="avatar" style={{ background: member.profile_color }}>{member.emoji}</span>
          <div><strong>{member.display_name}</strong><small>{member.role === 'administrator' ? 'Voksen' : 'Barn'}</small></div>
          <button className="icon-button" onClick={onSignOut} aria-label="Logg ut"><LogOut size={18} /></button>
        </div>
      </header>
      <main>{children}</main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

function SignIn({ onNotice, notice }: { onNotice: (value: string) => void, notice: string }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setSending(false)
    onNotice(error ? error.message : 'Sjekk e-posten din for en trygg innloggingslenke.')
  }

  return (
    <AuthLayout title="Velkommen til Oppdragsklubben" text="Voksne logger inn med e-post. Barn åpner engangslenken de får av en voksen.">
      <form className="auth-form" onSubmit={submit}>
        <label>E-postadresse<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button className="primary-button" disabled={sending}>{sending ? 'Sender…' : 'Send innloggingslenke'}</button>
      </form>
      {notice && <p className="inline-notice">{notice}</p>}
      <p className="privacy-note"><ShieldCheck size={18} /> Familiens oppgaver og beløp er private og beskyttet i databasen.</p>
    </AuthLayout>
  )
}

function CreateFamily({ onCreated, onNotice, notice }: { onCreated: () => void, onNotice: (value: string) => void, notice: string }) {
  const [familyName, setFamilyName] = useState('Oppdragsklubben')
  const [displayName, setDisplayName] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const { error } = await getSupabase().rpc('create_family', {
      p_family_name: familyName.trim(),
      p_display_name: displayName.trim(),
    })
    if (error) onNotice(error.message)
    else onCreated()
  }

  return (
    <AuthLayout title="Opprett familiens klubb" text="Du blir administrator og kan invitere barna etterpå.">
      <form className="auth-form" onSubmit={submit}>
        <label>Familiens navn<input required value={familyName} onChange={(event) => setFamilyName(event.target.value)} /></label>
        <label>Ditt navn<input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <button className="primary-button">Opprett familie</button>
      </form>
      {notice && <p className="inline-notice">{notice}</p>}
    </AuthLayout>
  )
}

function ParentDashboard({ family, member, members, tasks, submissions, refresh, onNotice }: {
  family: Family
  member: Member
  members: Member[]
  tasks: Task[]
  submissions: Submission[]
  refresh: () => void
  onNotice: (value: string) => void
}) {
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskAmount, setTaskAmount] = useState('15')
  const [taskEmoji, setTaskEmoji] = useState('✨')
  const [childName, setChildName] = useState('')
  const [childEmoji, setChildEmoji] = useState('🦊')
  const [inviteUrl, setInviteUrl] = useState('')
  const [pushBusy, setPushBusy] = useState(false)

  const pending = submissions.filter((submission) => submission.status === 'venter')
  const approved = submissions.filter((submission) => submission.status === 'godkjent')
  const approvedOre = approved.reduce((total, submission) => total + (tasks.find((task) => task.id === submission.task_id)?.amount_ore ?? 0), 0)
  const children = members.filter((item) => item.role === 'barn')
  const findTask = (id: string) => tasks.find((task) => task.id === id)
  const findMember = (id: string) => members.find((item) => item.id === id)

  const decide = async (id: string, status: 'godkjent' | 'avvist') => {
    const { error } = await getSupabase().from('submissions').update({
      status,
      decided_at: new Date().toISOString(),
      decided_by: member.id,
    }).eq('id', id)
    onNotice(error ? error.message : status === 'godkjent' ? 'Oppdraget er godkjent.' : 'Oppdraget er avvist.')
    if (!error) refresh()
  }

  const markPaid = async () => {
    const { error } = await getSupabase().from('submissions').update({ status: 'betalt' }).eq('family_id', family.id).eq('status', 'godkjent')
    onNotice(error ? error.message : 'Ukens godkjente beløp er markert som betalt.')
    if (!error) refresh()
  }

  const addTask = async (event: FormEvent) => {
    event.preventDefault()
    const amountOre = Math.round(Number(taskAmount.replace(',', '.')) * 100)
    if (!Number.isFinite(amountOre) || amountOre < 0) return onNotice('Skriv inn et gyldig beløp.')
    const { error } = await getSupabase().from('tasks').insert({
      family_id: family.id,
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      amount_ore: amountOre,
      emoji: taskEmoji,
    })
    if (error) onNotice(error.message)
    else {
      setTaskTitle('')
      setTaskDescription('')
      setTaskAmount('15')
      onNotice('Oppgaven er lagt til.')
      refresh()
    }
  }

  const archiveTask = async (id: string) => {
    const { error } = await getSupabase().from('tasks').update({ active: false }).eq('id', id)
    onNotice(error ? error.message : 'Oppgaven er arkivert.')
    if (!error) refresh()
  }

  const createInvite = async (event: FormEvent) => {
    event.preventDefault()
    const { data, error } = await getSupabase().rpc('create_child_invite', {
      p_display_name: childName.trim(),
      p_emoji: childEmoji,
    })
    if (error) return onNotice(error.message)
    const result = Array.isArray(data) ? data[0] : data
    const token = result?.invite_token as string | undefined
    if (!token) return onNotice('Invitasjonen ble opprettet uten en gyldig lenke.')
    const url = new URL(window.location.origin)
    url.searchParams.set('invite', token)
    setInviteUrl(url.toString())
    setChildName('')
    onNotice('Invitasjonen er klar. Den kan bare brukes én gang.')
    refresh()
  }

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    onNotice('Invitasjonslenken er kopiert.')
  }

  const updateSchedule = async (weekday: number, time: string) => {
    const { error } = await getSupabase().from('families').update({
      notification_weekday: weekday,
      notification_time: time,
    }).eq('id', family.id)
    onNotice(error ? error.message : 'Varseltidspunktet er lagret.')
    if (!error) refresh()
  }

  const enablePush = async () => {
    setPushBusy(true)
    try {
      await subscribeToPush(family.id, member.id)
      onNotice('Pushvarsler er aktivert og et testvarsel er sendt.')
    } catch (error) {
      onNotice(errorMessage(error))
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="dashboard">
      <section className="welcome-row">
        <div><span className="eyebrow">Voksenoversikt</span><h1>Hei, {member.display_name}</h1><p>Godkjenn oppdrag, inviter barna og hold ukeoppgjøret samlet.</p></div>
        <span className="secure-pill"><ShieldCheck size={17} /> Privat familierom</span>
      </section>

      <section className="summary-grid">
        <article className="summary-card dark"><Coins size={24} /><span>Klar til utbetaling</span><strong>{formatMoney(approvedOre)}</strong><button onClick={markPaid} disabled={approvedOre === 0}>Marker som betalt</button></article>
        <article className="summary-card"><Clock3 size={24} /><span>Venter på deg</span><strong>{pending.length}</strong><small>innsendte oppdrag</small></article>
        <article className="summary-card"><Users size={24} /><span>Familien</span><strong>{children.length}</strong><small>barneprofiler</small></article>
      </section>

      <Section title="Til godkjenning" eyebrow={`${pending.length} venter`}>
        {pending.length === 0 ? <Empty text="Ingen oppdrag venter akkurat nå." /> : (
          <div className="card-list">{pending.map((submission) => {
            const task = findTask(submission.task_id)
            const child = findMember(submission.child_member_id)
            return <article className="submission-card" key={submission.id}>
              <span className="task-icon">{task?.emoji ?? '✨'}</span>
              <div><strong>{task?.title ?? 'Arkivert oppgave'}</strong><small>{child?.emoji} {child?.display_name} · {task ? formatMoney(task.amount_ore) : ''}</small></div>
              <div className="actions"><button className="reject-button" onClick={() => void decide(submission.id, 'avvist')}><XCircle size={18} /> Avvis</button><button className="approve-button" onClick={() => void decide(submission.id, 'godkjent')}><CheckCircle2 size={18} /> Godkjenn</button></div>
            </article>
          })}</div>
        )}
      </Section>

      <div className="two-column">
        <Section title="Oppgaver" eyebrow="Administrer">
          <form className="compact-form" onSubmit={addTask}>
            <div className="form-row"><select value={taskEmoji} onChange={(event) => setTaskEmoji(event.target.value)}>{EMOJIS.map((emoji) => <option key={emoji}>{emoji}</option>)}</select><input required placeholder="Navn på oppgaven" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} /><input className="amount-input" required inputMode="decimal" aria-label="Beløp i kroner" value={taskAmount} onChange={(event) => setTaskAmount(event.target.value)} /></div>
            <input placeholder="Kort beskrivelse" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} />
            <button className="primary-button"><Plus size={17} /> Legg til oppgave</button>
          </form>
          <div className="mini-list">{tasks.filter((task) => task.active).map((task) => <div key={task.id}><span>{task.emoji}</span><div><strong>{task.title}</strong><small>{formatMoney(task.amount_ore)}</small></div><button className="icon-button danger" onClick={() => void archiveTask(task.id)} aria-label={`Arkiver ${task.title}`}><Trash2 size={17} /></button></div>)}</div>
        </Section>

        <Section title="Inviter et barn" eyebrow="Én trygg lenke per enhet">
          <form className="compact-form" onSubmit={createInvite}>
            <div className="form-row"><select value={childEmoji} onChange={(event) => setChildEmoji(event.target.value)}>{EMOJIS.map((emoji) => <option key={emoji}>{emoji}</option>)}</select><input required placeholder="Barnets navn" value={childName} onChange={(event) => setChildName(event.target.value)} /></div>
            <button className="primary-button"><Plus size={17} /> Lag invitasjonslenke</button>
          </form>
          {inviteUrl && <div className="invite-box"><p>Åpne denne lenken på barnets telefon eller nettbrett. Den virker bare én gang.</p><div><input readOnly value={inviteUrl} /><button className="icon-button" onClick={() => void copyInvite()}><Copy size={18} /></button></div></div>}
          <div className="member-list">{children.map((child) => <div key={child.id}><span className="avatar" style={{ background: child.profile_color }}>{child.emoji}</span><strong>{child.display_name}</strong><small>{child.auth_user_id ? 'Enhet koblet til' : 'Venter på invitasjon'}</small></div>)}</div>
        </Section>
      </div>

      <Section title="Ukentlig pushvarsel" eyebrow="Påminnelse til de voksne">
        <div className="notification-settings">
          <label>Dag<select value={family.notification_weekday} onChange={(event) => void updateSchedule(Number(event.target.value), family.notification_time)}>{WEEKDAYS.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>
          <label>Klokkeslett<input type="time" value={family.notification_time.slice(0, 5)} onChange={(event) => void updateSchedule(family.notification_weekday, event.target.value)} /></label>
          <button className="primary-button" onClick={() => void enablePush()} disabled={pushBusy}><Bell size={17} /> {pushBusy ? 'Aktiverer…' : 'Aktiver varsler på denne enheten'}</button>
        </div>
        <p className="help-text">På iPhone og iPad må appen først legges til på Hjem-skjermen. Varseltillatelsen gis alltid av personen som bruker enheten.</p>
      </Section>
    </div>
  )
}

function ChildDashboard({ member, tasks, submissions, refresh, onNotice }: {
  family: Family
  member: Member
  tasks: Task[]
  submissions: Submission[]
  refresh: () => void
  onNotice: (value: string) => void
}) {
  const mySubmissions = submissions.filter((submission) => submission.child_member_id === member.id)
  const pendingTaskIds = new Set(mySubmissions.filter((submission) => submission.status === 'venter').map((submission) => submission.task_id))
  const earnedOre = mySubmissions.filter((submission) => ['godkjent', 'betalt'].includes(submission.status)).reduce((total, submission) => total + (tasks.find((task) => task.id === submission.task_id)?.amount_ore ?? 0), 0)

  const submitTask = async (task: Task) => {
    const { error } = await getSupabase().from('submissions').insert({
      family_id: member.family_id,
      task_id: task.id,
      child_member_id: member.id,
      status: 'venter',
    })
    onNotice(error ? error.message : 'Bra jobbet! Oppdraget er sendt til de voksne.')
    if (!error) refresh()
  }

  return (
    <div className="dashboard">
      <section className="child-hero" style={{ '--child-color': member.profile_color } as React.CSSProperties}>
        <div><span className="eyebrow light">Dine oppdrag</span><h1>Hei, {member.display_name}! {member.emoji}</h1><p>Velg det du har gjort. En voksen sjekker og godkjenner etterpå.</p><div className="child-stats"><span><strong>{formatMoney(earnedOre)}</strong><small>opptjent totalt</small></span><span><strong>{pendingTaskIds.size}</strong><small>venter på sjekk</small></span></div></div>
      </section>

      <Section title="Hva har du gjort?" eyebrow="Aktive oppdrag">
        <div className="task-grid">{tasks.filter((task) => task.active).map((task) => {
          const waiting = pendingTaskIds.has(task.id)
          return <article className="child-task" key={task.id}><span className="task-icon large">{task.emoji}</span><div><strong>{task.title}</strong><p>{task.description}</p><span className="reward">{formatMoney(task.amount_ore)}</span></div><button className={waiting ? 'waiting-button' : 'primary-button'} disabled={waiting} onClick={() => void submitTask(task)}>{waiting ? <><Clock3 size={17} /> Venter på sjekk</> : <><Send size={17} /> Jeg har gjort den</>}</button></article>
        })}</div>
      </Section>

      <Section title="Din historikk" eyebrow="Siste oppdrag">
        <div className="history-list">{mySubmissions.slice(0, 8).map((submission) => {
          const task = tasks.find((item) => item.id === submission.task_id)
          return <div key={submission.id}><span>{task?.emoji ?? '✨'}</span><strong>{task?.title ?? 'Arkivert oppgave'}</strong><Status value={submission.status} /></div>
        })}</div>
      </Section>
    </div>
  )
}

function Status({ value }: { value: SubmissionStatus }) {
  const labels: Record<SubmissionStatus, string> = { venter: 'Venter', godkjent: 'Godkjent', avvist: 'Prøv igjen', betalt: 'Betalt' }
  return <span className={`status status-${value}`}>{labels[value]}</span>
}

function Section({ title, eyebrow, children }: { title: string, eyebrow: string, children: React.ReactNode }) {
  return <section className="section"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div></div>{children}</section>
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><CheckCircle2 size={30} /><strong>Alt er ajour</strong><p>{text}</p></div>
}

function AuthLayout({ title, text, children }: { title: string, text: string, children: React.ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-logo"><Sparkles size={27} /></div><span className="eyebrow">Oppdragsklubben</span><h1>{title}</h1><p>{text}</p>{children}</section></main>
}

function ConfigurationMissing() {
  return <AuthLayout title="Supabase må kobles til" text="Frontend-koden er klar, men Vercel mangler miljøvariablene VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY og VITE_VAPID_PUBLIC_KEY."><p className="inline-notice">Se supabase/README.md i repoet for hele oppsettet.</p></AuthLayout>
}

function InvalidInvite({ notice, onSignOut }: { notice: string, onSignOut: () => void }) {
  return <AuthLayout title="Invitasjonen virker ikke" text="Be en voksen lage en ny invitasjonslenke fra familieoversikten.">{notice && <p className="inline-notice">{notice}</p>}<button className="secondary-button" onClick={onSignOut}>Tilbake til innlogging</button></AuthLayout>
}

function LoadingScreen() {
  return <main className="loading-screen"><div className="spinner" /><strong>Laster familierommet…</strong></main>
}

export default App
