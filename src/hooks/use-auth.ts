'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileById } from '@/lib/api'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Получаем текущую сессию при загрузке
    const getCurrentSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (session?.user) {
          setUser(session.user)
          // Получаем роль из таблицы profiles
          console.log('🔐 Getting profile for user:', session.user.id)
          try {
            const profile = await getProfileById(session.user.id)
            if (profile) {
              console.log('✅ Profile found:', profile)
              setRole(profile.role as UserRole)
            } else {
              console.log('⚠️ Profile not found, setting default role: installer')
              setRole('installer')
            }
          } catch (error) {
            console.error('❌ Ошибка при получении профиля:', error)
            setRole('installer')
          }
        } else {
          setUser(null)
          setRole(null)
        }
      } catch (err: any) {
        console.error('❌ Error getting session:', err)
        setError(err.message)
        setUser(null)
        setRole(null)
      } finally {
        setIsLoading(false)
      }
    }

    getCurrentSession()

    // Подписываемся на изменения состояния авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.id)

      if (session?.user) {
        setUser(session.user)
        // Получаем роль из таблицы profiles
        console.log('🔄 Auth state change - getting profile for user:', session.user.id)
        try {
          const profile = await getProfileById(session.user.id)
          if (profile) {
            console.log('✅ Profile found on auth change:', profile)
            setRole(profile.role as UserRole)
          } else {
            console.log('⚠️ Profile not found on auth change, setting default role: installer')
            setRole('installer')
          }
        } catch (error) {
          console.error('❌ Ошибка при получении профиля на auth change:', error)
          setRole('installer')
        }
      } else {
        setUser(null)
        setRole(null)
      }
      setIsLoading(false)
    })

    // Возвращаем функцию отписки
    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const getRole = (): UserRole => {
    return role
  }

  const refreshProfile = async () => {
    if (user) {
      console.log('🔄 Refreshing profile for user:', user.id)
      try {
        const profile = await getProfileById(user.id)
        if (profile) {
          console.log('✅ Profile refreshed:', profile)
          setRole(profile.role as UserRole)
        } else {
          console.log('⚠️ Profile not found on refresh, setting default role: installer')
          setRole('installer')
        }
      } catch (error) {
        console.error('❌ Ошибка при обновлении профиля:', error)
        setRole('installer')
      }
    }
  }

  return { user, role, isLoading, error, getRole, refreshProfile }
}
