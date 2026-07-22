import { createClient } from '@supabase/supabase-js'

function normalizeSupabaseUrl(value?: string) {
  const normalized = value?.trim().replace(/\/+$/, '')

  // Supabase project URLs end in .supabase.co. Correct the common .com typo
  // so an old or mistyped deployment variable cannot break authentication.
  return normalized?.replace(/\.supabase\.com$/i, '.supabase.co')
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase er ikke konfigurert.')
  }

  return supabase
}
