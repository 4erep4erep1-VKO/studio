import { supabase } from './supabase'

const INSTALLER_SESSION_KEY = 'installer-session'

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
  clearInstallerSession()

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export function saveInstallerSession(session: any) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(INSTALLER_SESSION_KEY, JSON.stringify(session))
}

export function getInstallerSession() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(INSTALLER_SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearInstallerSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(INSTALLER_SESSION_KEY)
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
