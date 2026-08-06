import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  assertAllowedOrigin,
  corsHeaders,
  errorResponse,
  HttpError,
  jsonResponse,
  requiredEnv,
} from '../_shared/http.ts'

const supabaseUrl = requiredEnv('SUPABASE_URL')
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const cronSecret = requiredEnv('CRON_SECRET')

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function userIdFromRpcValue(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const candidate = value as { orphaned_auth_user_ids?: unknown }
    if (typeof candidate.orphaned_auth_user_ids === 'string') {
      return candidate.orphaned_auth_user_ids
    }
  }
  return null
}

Deno.serve(async (request) => {
  try {
    assertAllowedOrigin(request)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    if (request.method !== 'POST') throw new HttpError(405, 'Bare POST er tillatt')
    if (request.headers.get('x-cron-secret') !== cronSecret) {
      throw new HttpError(401, 'Ugyldig cron-hemmelighet')
    }

    const { data, error } = await admin.rpc('orphaned_auth_user_ids', {
      p_older_than: '7 days',
    })
    if (error) throw error

    const rpcValues: unknown[] = Array.isArray(data) ? data : []
    const userIds = rpcValues
      .map(userIdFromRpcValue)
      .filter((value): value is string => value !== null)

    let deleted = 0
    let failed = 0
    for (const userId of userIds) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
      if (deleteError) {
        failed += 1
        console.error('Foreldet anonym auth-bruker kunne ikke slettes', deleteError)
      } else {
        deleted += 1
      }
    }

    return jsonResponse(request, {
      found: userIds.length,
      deleted,
      failed,
    })
  } catch (error) {
    return errorResponse(request, error)
  }
})
