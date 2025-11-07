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
  // Use the current origin for redirect (works for both localhost and production)
  const redirectTo = `${window.location.origin}/app/topics`
  
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

