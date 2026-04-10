'use client'

import { useEffect, useState } from 'react'
import { getProfiles } from '@/lib/api'
import type { Profile } from '@/lib/types'

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refresh = async () => {
    setIsLoading(true)
    try {
      const result = await getProfiles()
      setProfiles(result)
    } catch (error) {
      setProfiles([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return { profiles, isLoading, refresh }
}
