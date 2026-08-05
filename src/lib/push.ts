import { getSupabase } from './supabase'

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }

  return bytes
}

export async function subscribeToPush() {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
  if (!vapidPublicKey) throw new Error('VAPID-nøkkelen mangler i Vercel.')
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Denne nettleseren støtter ikke pushvarsler.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Varsler ble ikke tillatt på denne enheten.')

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
  const json = subscription.toJSON()

  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('Nettleseren returnerte et ugyldig pushabonnement.')
  }

  const client = getSupabase()
  const { error } = await client.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error

  const { error: testError } = await client.functions.invoke('send-push', {
    body: { mode: 'test' },
  })
  if (testError) throw testError
}
