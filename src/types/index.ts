export interface Event {
  partner_id?: string | null
  group_id?: string | null
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
  group_id?: string | null
  title: string | null
  content: string | null
  created_by: string
  created_at: string
  updated_at: string
  creator_username?: string | null
  partners?: string[]
}

export interface Todo {
  id: string
  user_id: string
  partner_id: string | null
  group_id?: string | null
  content: string
  completed: boolean
  created_at: string
  updated_at: string
}

export interface ShoppingItem {
  id: string
  user_id: string
  partner_id: string | null
  group_id?: string | null
  item_name: string
  quantity: string | null
  notes: string | null
  purchased: boolean
  created_at: string
  updated_at: string
}

export interface Dog {
  id: string
  user_id: string
  partner_id: string | null
  name: string
  meals_per_day: number | null
  weight_per_meal: number | null
  photo_url: string | null
  created_at: string
  updated_at: string
  photo_signed_url?: string | null
}

export interface DogMeal {
  id: string
  dog_id: string
  user_id: string
  meal_date: string
  meal_index: number
  completed: boolean
  completed_at: string
  created_at: string
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

export interface Partner {
  id: string
  username: string | null
  email: string
}

export interface Photo {
  id: string
  user_id: string
  storage_path: string
  url: string
  created_at: string
}

export interface Group {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  member_count?: number
  creator_username?: string | null
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  username?: string | null
  email?: string
}

