import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cron-secret',
}

type Family = {
  id: string
  name: string
  notification_weekday: number
  notification_time: string
  timezone: string
  last_notification_at: string | null
}

type Subscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

const required = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

const supabaseUrl = required('SUPABASE_URL')
const publishableKey = required('SUPABASE_ANON_KEY')
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
const cronSecret = required('CRON_SECRET')

webpush.setVapidDetails(
  required('VAPID_SUBJECT'),
  required('VAPID_PUBLIC_KEY'),
  required('VAPID_PRIVATE_KEY'),
)

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function isDue(family: Family, now: Date) {
  if (family.last_notification_at && now.getTime() - new Date(family.last_notification_at).getTime() < 20 * 60 * 60 * 1000) {
    return false
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: family.timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const [targetHour, targetMinute] = family.notification_time.slice(0, 5).split(':').map(Number)
  const currentMinutes = Number(value('hour')) * 60 + Number(value('minute'))
  const targetMinutes = targetHour * 60 + targetMinute

  return weekdays[value('weekday')] === family.notification_weekday
    && currentMinutes >= targetMinutes
    && currentMinutes < targetMinutes + 15
}

async function send(subscription: Subscription, payload: Record<string, unknown>) {
  try {
    await webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }, JSON.stringify(payload))
    return true
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) {
      await admin.from('push_subscriptions').delete().eq('id', subscription.id)
    }
    console.error('Push delivery failed', statusCode ?? error)
    return false
  }
}

async function subscriptionsForMembers(memberIds: string[]) {
  if (memberIds.length === 0) return [] as Subscription[]
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('member_id', memberIds)
  if (error) throw error
  return (data ?? []) as Subscription[]
}

async function sendTest(authorization: string) {
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = authorization.replace(/^Bearer\s+/i, '')
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) throw new Error('Invalid user token')

  const { data: member, error: memberError } = await admin
    .from('family_members')
    .select('id, family_id, families(name)')
    .eq('auth_user_id', userData.user.id)
    .single()
  if (memberError) throw memberError

  const subscriptions = await subscriptionsForMembers([member.id])
  const familyName = (member.families as unknown as { name: string } | null)?.name ?? 'Oppdragsklubben'
  const results = await Promise.all(subscriptions.map((subscription) => send(subscription, {
    title: `${familyName}: Varsler er på`,
    body: 'Denne enheten kan nå motta familiens varsler.',
    url: '/',
    tag: 'push-test',
  })))
  return { sent: results.filter(Boolean).length }
}

async function sendScheduled() {
  const now = new Date()
  const { data, error } = await admin
    .from('families')
    .select('id, name, notification_weekday, notification_time, timezone, last_notification_at')
  if (error) throw error

  let sent = 0
  for (const family of ((data ?? []) as Family[]).filter((item) => isDue(item, now))) {
    const [{ data: parents }, { count: pendingCount }, { data: approved }] = await Promise.all([
      admin.from('family_members').select('id').eq('family_id', family.id).eq('role', 'administrator'),
      admin.from('submissions').select('id', { count: 'exact', head: true }).eq('family_id', family.id).eq('status', 'venter'),
      admin.from('submissions').select('task_id, tasks(amount_ore)').eq('family_id', family.id).eq('status', 'godkjent'),
    ])
    const subscriptions = await subscriptionsForMembers((parents ?? []).map((parent) => parent.id))
    const totalOre = (approved ?? []).reduce((sum, row) => {
      const task = row.tasks as unknown as { amount_ore: number } | null
      return sum + (task?.amount_ore ?? 0)
    }, 0)
    const results = await Promise.all(subscriptions.map((subscription) => send(subscription, {
      title: `${family.name}: Ukeoppgjør`,
      body: `${(totalOre / 100).toLocaleString('nb-NO')} kr klart til utbetaling · ${pendingCount ?? 0} venter på godkjenning`,
      url: '/',
      tag: `weekly-${family.id}`,
    })))
    const delivered = results.filter(Boolean).length
    sent += delivered
    if (delivered > 0) {
      await admin.from('families').update({ last_notification_at: now.toISOString() }).eq('id', family.id)
    }
  }
  return { sent }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await request.json().catch(() => ({})) as { mode?: string }
    const authorization = request.headers.get('authorization') ?? ''
    const result = body.mode === 'test'
      ? await sendTest(authorization)
      : request.headers.get('x-cron-secret') === cronSecret
        ? await sendScheduled()
        : (() => { throw new Error('Unauthorized') })()

    return Response.json(result, { headers: corsHeaders })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 400, headers: corsHeaders })
  }
})
