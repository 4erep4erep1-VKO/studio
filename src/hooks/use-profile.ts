''''use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getProfile, updateProfile, getUsers } from '@/lib/api';
import type { Profile, User } from '@/lib/api';

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const fetchedProfile = await getProfile(userId);
      setProfile(fetchedProfile);
      setError(null);
    } catch (err: any) {
      const errorMsg = err.message || 'Не удалось загрузить профиль.';
      setError(errorMsg);
      toast({ title: 'Ошибка загрузки', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updatePinCode = useCallback(async (pin: string) => {
    if (!userId) return;
    setIsUpdating(true);
    try {
      const updatedProfile = await updateProfile(userId, { pin });
      setProfile(updatedProfile);
      toast({ title: 'Успех', description: 'Ваш PIN-код успешно обновлен.' });
    } catch (err: any) {
      toast({ title: 'Ошибка обновления', description: err.message, variant: 'destructive' });
      throw err; // Пробрасываем для обработки в форме
    }
    finally {
      setIsUpdating(false);
    }
  }, [userId, toast]);

  return { profile, isLoading, isUpdating, error, updatePinCode, refetchProfile: fetchProfile };
}

export function useProfiles() {
    const [profiles, setProfiles] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchProfiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const users = await getUsers();
            setProfiles(users);
        } catch (err: any) {
            const errorMsg = err.message || 'Не удалось загрузить профили.';
            setError(errorMsg);
            toast({ title: 'Ошибка загрузки', description: errorMsg, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    return { profiles, isLoading, error, refetchProfiles: fetchProfiles };
}
'''