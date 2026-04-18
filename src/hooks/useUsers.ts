'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  getUsers as getUsersApi,
  createUser as createUserApi,
  deleteUser as deleteUserApi,
} from '@/lib/api'; 
import { User, UserRole } from '@/lib/types';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await getUsersApi();
      setUsers(fetchedUsers);
      setError(null);
    } catch (err: any) {
      const errorMsg = err.message || 'Не удалось загрузить пользователей.';
      setError(errorMsg);
      toast({ title: 'Ошибка', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const addUser = async (userData: { name: string; email: string; password?: string; role: UserRole; }) => {
    if (!navigator.onLine) {
        toast({ title: 'Ошибка сети', description: 'Нет подключения к интернету.', variant: 'destructive' });
        return;
    }
    try {
      const newUser = await createUserApi(userData);
      setUsers(prevUsers => [...prevUsers, newUser]);
      toast({ title: 'Успех', description: `Пользователь ${newUser.name} создан.` });
    } catch (err: any) {
      toast({ title: 'Ошибка создания', description: err.message, variant: 'destructive' });
      throw err; // Пробрасываем ошибку для обработки в форме
    }
  };

  const removeUser = async (userId: string) => {
    if (!navigator.onLine) {
        toast({ title: 'Ошибка сети', description: 'Нет подключения к интернету.', variant: 'destructive' });
        return;
    }
    // Оптимистичное удаление для лучшего UX
    const originalUsers = users;
    setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));

    try {
      await deleteUserApi(userId);
      toast({ title: 'Успех', description: 'Пользователь удален.' });
    } catch (err: any) {
      // Если удаление не удалось, откатываем состояние
      setUsers(originalUsers);
      toast({ title: 'Ошибка удаления', description: err.message, variant: 'destructive' });
    }
  };

  return { users, isLoading, error, addUser, removeUser, refetchUsers: fetchUsers };
}
