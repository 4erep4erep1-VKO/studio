'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileById } from '@/lib/api'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getCurrentSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error

      if (session?.user) {
        setUser(session.user)
        try {
          const profile = await getProfileById(session.user.id)
          setRole(profile ? (profile.role as UserRole) : 'installer')
        } catch (profileError) {
          console.error('Ошибка при получении профиля:', profileError)
          setRole('installer')
        }
      } else {
        setUser(null)
        setRole(null)
      }
    } catch (err: any) {
      console.error('Error getting session:', err)
      setError(err.message)
      setUser(null)
      setRole(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    getCurrentSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        if(session?.user) {
            setUser(session.user)
             try {
               const profile = await getProfileById(session.user.id)
               setRole(profile ? (profile.role as UserRole) : 'installer')
             } catch (profileError) {
               console.error('Ошибка при получении профиля:', profileError)
               setRole('installer')
             }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setRole(null)
      }
      setIsLoading(false)
    })

    // Принудительно проверяем сессию, когда пользователь возвращается на вкладку
    const handleFocus = () => {
      getCurrentSession()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      subscription?.unsubscribe()
      window.removeEventListener('focus', handleFocus)
    }
  }, [getCurrentSession])

  const getRole = (): UserRole => {
    return role
  }

  return { user, role, isLoading, error, getRole }
}
