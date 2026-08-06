import { getSupabase } from '../lib/supabase'
import type {
  Family,
  FamilyRoom,
  InviteResult,
  Member,
  Payout,
  Submission,
  Task,
} from './types'

function firstInviteResult(data: unknown): InviteResult | null {
  const value = Array.isArray(data) ? data[0] : data
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<InviteResult>
  if (!candidate.member_id || !candidate.invite_token) return null
  return candidate as InviteResult
}

async function invokeAccountDeletion(body: {
  mode: 'member' | 'family'
  member_id?: string
}) {
  const { data, error } = await getSupabase().functions.invoke('slett-konto', { body })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error))
  }
  return data
}

export async function loadFamilyRoom(userId: string): Promise<FamilyRoom> {
  const client = getSupabase()
  const { data: profile, error: profileError } = await client
    .from('family_members')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile) {
    return {
      member: null,
      family: null,
      members: [],
      tasks: [],
      submissions: [],
      payouts: [],
    }
  }

  const currentMember = profile as Member
  const [familyResult, membersResult, tasksResult, submissionsResult, payoutsResult] = await Promise.all([
    client
      .from('families')
      .select('id, name, notification_weekday, notification_time, timezone')
      .eq('id', currentMember.family_id)
      .single(),
    client
      .from('family_members')
      .select('*')
      .eq('family_id', currentMember.family_id)
      .order('created_at'),
    client
      .from('tasks')
      .select('*')
      .eq('family_id', currentMember.family_id)
      .order('created_at'),
    client
      .from('submissions')
      .select('*')
      .eq('family_id', currentMember.family_id)
      .order('submitted_at', { ascending: false }),
    client
      .from('payouts')
      .select('*')
      .eq('family_id', currentMember.family_id)
      .order('paid_at', { ascending: false }),
  ])

  const firstError = familyResult.error
    ?? membersResult.error
    ?? tasksResult.error
    ?? submissionsResult.error
    ?? payoutsResult.error
  if (firstError) throw firstError

  return {
    member: currentMember,
    family: familyResult.data as Family,
    members: (membersResult.data ?? []) as Member[],
    tasks: (tasksResult.data ?? []) as Task[],
    submissions: (submissionsResult.data ?? []) as Submission[],
    payouts: (payoutsResult.data ?? []) as Payout[],
  }
}

export function subscribeToFamilyChanges(familyId: string, refresh: () => void) {
  const client = getSupabase()
  const channel = client
    .channel(`family-${familyId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `family_id=eq.${familyId}` },
      refresh,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'submissions', filter: `family_id=eq.${familyId}` },
      refresh,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'family_members', filter: `family_id=eq.${familyId}` },
      refresh,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payouts', filter: `family_id=eq.${familyId}` },
      refresh,
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

export async function createFamily(familyName: string, displayName: string) {
  const { error } = await getSupabase().rpc('create_family', {
    p_family_name: familyName,
    p_display_name: displayName,
  })
  if (error) throw error
}

export async function decideSubmission(
  submissionId: string,
  status: 'godkjent' | 'avvist',
  decidedBy: string,
) {
  const { error } = await getSupabase()
    .from('submissions')
    .update({
      status,
      decided_at: new Date().toISOString(),
      decided_by: decidedBy,
    })
    .eq('id', submissionId)
  if (error) throw error
}

export async function resubmitSubmission(submissionId: string) {
  const { error } = await getSupabase()
    .from('submissions')
    .update({ status: 'venter' })
    .eq('id', submissionId)
  if (error) throw error
}

export async function createTask(input: {
  familyId: string
  title: string
  description: string
  amountOre: number
  emoji: string
}) {
  const { error } = await getSupabase().from('tasks').insert({
    family_id: input.familyId,
    title: input.title,
    description: input.description,
    amount_ore: input.amountOre,
    emoji: input.emoji,
  })
  if (error) throw error
}

export async function archiveTask(taskId: string) {
  const { error } = await getSupabase()
    .from('tasks')
    .update({ active: false })
    .eq('id', taskId)
  if (error) throw error
}

export async function createChildInvite(displayName: string, emoji: string) {
  const { data, error } = await getSupabase().rpc('create_child_invite', {
    p_display_name: displayName,
    p_emoji: emoji,
  })
  if (error) throw error
  const result = firstInviteResult(data)
  if (!result) throw new Error('Invitasjonen ble opprettet uten en gyldig lenke.')
  return result
}

export async function createAdminInvite(displayName: string, emoji: string) {
  const { data, error } = await getSupabase().rpc('create_admin_invite', {
    p_display_name: displayName,
    p_emoji: emoji,
  })
  if (error) throw error
  const result = firstInviteResult(data)
  if (!result) throw new Error('Invitasjonen ble opprettet uten en gyldig lenke.')
  return result
}

export async function createReconnectInvite(memberId: string) {
  const { data, error } = await getSupabase().rpc('create_child_reconnect_invite', {
    p_member_id: memberId,
  })
  if (error) throw error
  const result = firstInviteResult(data)
  if (!result) throw new Error('Invitasjonen ble opprettet uten en gyldig lenke.')
  return result
}

export async function updateNotificationSchedule(
  familyId: string,
  weekday: number,
  time: string,
) {
  const { error } = await getSupabase()
    .from('families')
    .update({ notification_weekday: weekday, notification_time: time })
    .eq('id', familyId)
  if (error) throw error
}

export async function createPayout(childMemberId: string) {
  const { data, error } = await getSupabase().rpc('create_payout', {
    p_child_member_id: childMemberId,
    p_note: '',
  })
  if (error) throw error
  return data
}

export async function deleteMemberProfile(memberId: string) {
  return invokeAccountDeletion({ mode: 'member', member_id: memberId })
}

export async function deleteFamilyData() {
  return invokeAccountDeletion({ mode: 'family' })
}

export async function submitTask(task: Task, member: Member) {
  const { error } = await getSupabase().from('submissions').insert({
    family_id: member.family_id,
    task_id: task.id,
    child_member_id: member.id,
    status: 'venter',
  })
  if (error) throw error
}
