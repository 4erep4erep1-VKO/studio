import { supabase } from './supabase'

export async function signUp(email: string, password: string, role: 'admin' | 'installer' = 'installer') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
      },
    },
  })

  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export async function updateUserRole(role: 'admin' | 'installer') {
  const { data, error } = await supabase.auth.updateUser({
    data: { role },
  })

  if (error) throw error
  return data
}

export function subscribeToAuthChanges(callback: (user: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })

  return subscription
}
