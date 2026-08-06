import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  assertAllowedOrigin,
  bearerToken,
  corsHeaders,
  errorResponse,
  HttpError,
  jsonResponse,
  requiredEnv,
} from '../_shared/http.ts'

const supabaseUrl = requiredEnv('SUPABASE_URL')
const publishableKey = requiredEnv('SUPABASE_ANON_KEY')
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type DeleteRequest = {
  mode?: 'member' | 'family'
  member_id?: string
}

async function deleteAuthUser(userId: string) {
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.error('Auth-brukeren kunne ikke slettes', error)
    return false
  }
  return true
}

Deno.serve(async (request) => {
  try {
    assertAllowedOrigin(request)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    if (request.method !== 'POST') throw new HttpError(405, 'Bare POST er tillatt')

    const { authorization, token } = bearerToken(request)
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) throw new HttpError(401, 'Innloggingen er ugyldig eller utløpt')

    const { data: caller, error: callerError } = await admin
      .from('family_members')
      .select('id, family_id, role')
      .eq('auth_user_id', userData.user.id)
      .single()
    if (callerError || !caller) throw new HttpError(404, 'Familieprofilen finnes ikke')
    if (caller.role !== 'administrator') throw new HttpError(403, 'Bare voksne kan slette profiler eller familie')

    const body = await request.json().catch(() => ({})) as DeleteRequest

    if (body.mode === 'member') {
      if (!body.member_id) throw new HttpError(400, 'Velg profilen som skal slettes')

      const { data: target, error: targetError } = await admin
        .from('family_members')
        .select('id, role, auth_user_id')
        .eq('id', body.member_id)
        .eq('family_id', caller.family_id)
        .maybeSingle()
      if (targetError) throw targetError
      if (!target) throw new HttpError(404, 'Profilen finnes ikke i familien')
      if (target.role !== 'barn') throw new HttpError(400, 'Denne funksjonen kan bare slette barneprofiler')

      const { error: deleteError } = await userClient.rpc('delete_member', {
        p_member_id: target.id,
      })
      if (deleteError) throw new HttpError(400, deleteError.message)

      const authUserDeleted = target.auth_user_id
        ? await deleteAuthUser(target.auth_user_id)
        : true

      return jsonResponse(request, {
        deleted: true,
        auth_user_deleted: authUserDeleted,
      })
    }

    if (body.mode === 'family') {
      const { data: members, error: membersError } = await admin
        .from('family_members')
        .select('auth_user_id')
        .eq('family_id', caller.family_id)
        .not('auth_user_id', 'is', null)
      if (membersError) throw membersError

      // Familie- og historikkradene må slettes før auth-brukerne på grunn av
      // families.created_by-fremmednøkkelen.
      const { error: deleteError } = await userClient.rpc('delete_family')
      if (deleteError) throw new HttpError(400, deleteError.message)

      const userIds = [...new Set(
        (members ?? [])
          .map((member) => member.auth_user_id)
          .filter((value): value is string => Boolean(value)),
      )].sort((left, right) => Number(left === userData.user.id) - Number(right === userData.user.id))

      let deletedUsers = 0
      for (const userId of userIds) {
        if (await deleteAuthUser(userId)) deletedUsers += 1
      }

      return jsonResponse(request, {
        deleted: true,
        auth_users_deleted: deletedUsers,
        auth_users_failed: userIds.length - deletedUsers,
      })
    }

    throw new HttpError(400, 'Ukjent slettemodus')
  } catch (error) {
    return errorResponse(request, error)
  }
})
