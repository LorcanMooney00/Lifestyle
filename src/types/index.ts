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

export interface Recipe {
  id: string
  title: string
  description: string | null
  instructions: string | null
  prep_time: number | null
  cook_time: number | null
  servings: number | null
  image_url: string | null
  created_at: string
  ingredients?: RecipeIngredient[]
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  ingredient_name: string
  amount: string | null
  created_at: string
}

export interface UserIngredient {
  id: string
  user_id: string
  ingredient_name: string
  created_at: string
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

export interface Photo {
  id: string
  user_id: string
  storage_path: string
  url: string
  created_at: string
}

