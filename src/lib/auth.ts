import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import type { User } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }: { data: { session: { user: User } | null } | null }) => {
      const session = data?.session
      setUser(session?.user as User | null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: { user: User } | null) => {
      setUser(session?.user as User | null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signUp(email: string, password: string, username: string): Promise<{ data: any; error: any }> {
  // Use environment variable for production URL, fallback to current origin for development
  const productionUrl = import.meta.env.VITE_SITE_URL || window.location.origin
  const redirectTo = `${productionUrl}/app/topics`
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        username: username,
      },
    },
  })

  // Create user profile after signup
  if (data.user && !error) {
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: data.user.id,
        username: username,
      })

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      // Don't fail signup if profile creation fails - user can update it later
    }
  }

  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function changePassword(newPassword: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    console.error('Error changing password:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function deleteAccount(): Promise<{ success: boolean; error: string | null }> {
  // First, delete all user data through a database function
  // Then delete the auth account
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'No user found' }
  }

  // Call a database function to delete all user data
  const { error: deleteError } = await supabase.rpc('delete_user_account', {
    p_user_id: user.id,
  })

  if (deleteError) {
    console.error('Error deleting user data:', deleteError)
    return { success: false, error: deleteError.message }
  }

  // Sign out the user (the auth account deletion will be handled by a database trigger)
  await supabase.auth.signOut()

  return { success: true, error: null }
}

