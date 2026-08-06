import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {
  assertAllowedOrigin,
  bearerToken,
  corsHeaders,
  errorResponse,
  HttpError,
  jsonResponse,
  requiredEnv,
} from '../_shared/http.ts'

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

const supabaseUrl = requiredEnv('SUPABASE_URL')
const publishableKey = requiredEnv('SUPABASE_ANON_KEY')
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const cronSecret = requiredEnv('CRON_SECRET')

webpush.setVapidDetails(
  requiredEnv('VAPID_SUBJECT'),
  requiredEnv('VAPID_PUBLIC_KEY'),
  requiredEnv('VAPID_PRIVATE_KEY'),
)

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

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
    console.error('Pushvarselet kunne ikke leveres', statusCode ?? error)
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

async function sendTest(request: Request) {
  const { authorization, token } = bearerToken(request)
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) throw new HttpError(401, 'Innloggingen er ugyldig eller utløpt')

  const { data: member, error: memberError } = await admin
    .from('family_members')
    .select('id, family_id, families(name)')
    .eq('auth_user_id', userData.user.id)
    .single()
  if (memberError || !member) throw new HttpError(404, 'Familieprofilen finnes ikke')

  const { data: slotClaimed, error: limitError } = await admin.rpc('claim_push_test_slot', {
    p_member_id: member.id,
  })
  if (limitError) throw limitError
  if (slotClaimed !== true) {
    throw new HttpError(429, 'Vent minst ett minutt før du sender et nytt testvarsel')
  }

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
  const { data, error } = await admin.rpc('families_due_for_notification', {
    p_now: now.toISOString(),
  })
  if (error) throw error

  let sent = 0
  for (const family of (data ?? []) as Family[]) {
    const [{ data: parents }, { count: pendingCount }, { data: approved }] = await Promise.all([
      admin.from('family_members').select('id').eq('family_id', family.id).eq('role', 'administrator'),
      admin.from('submissions').select('id', { count: 'exact', head: true }).eq('family_id', family.id).eq('status', 'venter'),
      admin.from('submissions').select('amount_ore').eq('family_id', family.id).eq('status', 'godkjent'),
    ])
    const subscriptions = await subscriptionsForMembers((parents ?? []).map((parent) => parent.id))
    const totalOre = (approved ?? []).reduce((sum, row) => sum + (row.amount_ore ?? 0), 0)
    const results = await Promise.all(subscriptions.map((subscription) => send(subscription, {
      title: `${family.name}: Ukeoppgjør`,
      body: `${(totalOre / 100).toLocaleString('nb-NO')} kr klart til utbetaling · ${pendingCount ?? 0} venter på godkjenning`,
      url: '/',
      tag: `weekly-${family.id}`,
    })))
    const delivered = results.filter(Boolean).length
    sent += delivered
    if (delivered > 0) {
      const { error: updateError } = await admin
        .from('families')
        .update({ last_notification_at: now.toISOString() })
        .eq('id', family.id)
      if (updateError) throw updateError
    }
  }
  return { sent, families: (data ?? []).length }
}

Deno.serve(async (request) => {
  try {
    assertAllowedOrigin(request)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    if (request.method !== 'POST') throw new HttpError(405, 'Bare POST er tillatt')

    const body = await request.json().catch(() => ({})) as { mode?: string }
    if (body.mode === 'test') {
      return jsonResponse(request, await sendTest(request))
    }
    if (body.mode === 'scheduled') {
      if (request.headers.get('x-cron-secret') !== cronSecret) {
        throw new HttpError(401, 'Ugyldig cron-hemmelighet')
      }
      return jsonResponse(request, await sendScheduled())
    }
    throw new HttpError(400, 'Ukjent pushmodus')
  } catch (error) {
    return errorResponse(request, error)
  }
})
