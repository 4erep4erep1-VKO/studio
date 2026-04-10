'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getInstallerSession } from '@/lib/auth'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Получаем текущего пользователя при загрузке
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) throw error
        if (user) {
          setUser(user)
        } else {
          const installerSession = getInstallerSession()
          setUser(installerSession)
        }
      } catch (err: any) {
        setError(err.message)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    getUser()

    // Подписываемся на изменения состояния авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        const installerSession = getInstallerSession()
        setUser(installerSession)
      }
      setIsLoading(false)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const getRole = (): 'admin' | 'installer' | null => {
    return (user?.user_metadata?.role as 'admin' | 'installer') || null
  }

  return { user, isLoading, error, getRole }
}
