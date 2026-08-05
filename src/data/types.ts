export type Role = 'administrator' | 'barn'
export type SubmissionStatus = 'venter' | 'godkjent' | 'avvist' | 'betalt'

export type Family = {
  id: string
  name: string
  notification_weekday: number
  notification_time: string
  timezone: string
}

export type Member = {
  id: string
  family_id: string
  auth_user_id: string | null
  role: Role
  display_name: string
  emoji: string
  profile_color: string
}

export type Task = {
  id: string
  family_id: string
  title: string
  description: string
  amount_ore: number
  emoji: string
  active: boolean
}

export type Submission = {
  id: string
  family_id: string
  task_id: string
  child_member_id: string
  status: SubmissionStatus
  submitted_at: string
  decided_at: string | null
  decided_by: string | null
  amount_ore: number
  payout_id: string | null
}

export type Payout = {
  id: string
  family_id: string
  child_member_id: string
  total_ore: number
  paid_at: string
  paid_by: string | null
  note: string
}

export type FamilyRoom = {
  member: Member | null
  family: Family | null
  members: Member[]
  tasks: Task[]
  submissions: Submission[]
  payouts: Payout[]
}

export type InviteResult = {
  member_id: string
  invite_token: string
}
