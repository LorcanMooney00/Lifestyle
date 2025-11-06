export interface Event {
  id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Topic {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface TopicMember {
  id: string
  topic_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  created_at: string
}

export interface Note {
  id: string
  topic_id: string
  title: string | null
  content: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email?: string
}

export interface PartnerLink {
  id: string
  user_id: string
  partner_id: string
  created_at: string
}

