import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'

export async function getCurrentSession() {
  const { data, error } = await getSupabase().auth.getSession()
  if (error) throw error
  return data.session
}

export function subscribeToAuth(callback: (session: Session | null) => void) {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function signInAnonymously() {
  const { data, error } = await getSupabase().auth.signInAnonymously()
  if (error) throw error
  return data.session
}

export async function sendEmailCode(email: string) {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function verifyEmailCode(email: string, token: string) {
  const { data, error } = await getSupabase().auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  if (error) throw error
  return data.session
}

export async function claimInviteToken(token: string) {
  const { error } = await getSupabase().rpc('claim_invite', { p_token: token })
  if (error) throw error
}

export async function signOutLocal() {
  const { error } = await getSupabase().auth.signOut({ scope: 'local' })
  if (error) throw error
}
