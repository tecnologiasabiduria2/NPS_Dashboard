export type UserRole = 'client' | 'admin'
export type AccessStatus = 'active' | 'inactive' | 'pending'
export type ProductSlug = 'workshop' | 'desafio' | 'sabiduria'
export type LessonType = 'video' | 'document' | 'checklist_item'
export type NpsType = 'mejora_sesion' | 'interes_ascension'
export type NpsTrigger = 'post_sesion' | 'semanal'

export interface Profile {
  id: string
  full_name: string
  phone?: string
  role: UserRole
  created_at: string
}

export interface Product {
  id: string
  slug: ProductSlug
  title: string
  description?: string
  order: number
}

export interface Module {
  id: string
  product_id: string
  title: string
  description?: string
  order: number
  is_published: boolean
  created_at: string
}

export interface Lesson {
  id: string
  module_id: string
  title: string
  type: LessonType
  fathom_share_id?: string
  storage_path?: string
  order: number
  is_published: boolean
}

export interface UserAccess {
  id: string
  user_id: string
  product_id: string
  status: AccessStatus
  access_until?: string
  access_started?: string
  current_module_id?: string
  ghl_contact_id?: string
  platform_invite_sent: boolean
  last_activity?: string
  created_at: string
  updated_at: string
  profiles?: Profile
  products?: Product
  modules?: Module
}

export interface LessonProgress {
  id: string
  user_id: string
  lesson_id: string
  completed: boolean
  completed_at?: string
}

export interface CoachingNote {
  id: string
  user_id: string
  admin_id: string
  content: string
  session_date: string
  created_at: string
  profiles?: Profile
}

export interface NpsResponse {
  id: string
  user_id: string
  score: number
  feedback?: string
  type: NpsType
  trigger: NpsTrigger
  live_session_id?: string
  created_at: string
}

export type SessionTipo =
  | 'inmersion_1'
  | 'inmersion_2'
  | 'mentoria'
  | 'sala_gerencia'
  | 'entrenamiento_comercial'

export interface LiveSession {
  id: string
  product_id: string
  title: string
  tipo: SessionTipo
  starts_at: string
  ends_at: string
  zoom_url: string
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface LiveSessionAttendance {
  id: string
  user_id: string
  session_id: string
  joined_at: string
}
