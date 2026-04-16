'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useInstallers() {
  const [installers, setInstallers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Загрузка списка монтажников
  const loadInstallers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'installer')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setInstallers(data || []);
    } catch (error: any) {
      console.error('Ошибка при загрузке списка:', error.message);
    }
  };

  useEffect(() => {
    loadInstallers();
  }, []);

  // 2. Добавление нового монтажника
  const addInstaller = async (formData: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/create-installer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при создании');
      }

      alert(`Монтажник ${formData.name} успешно добавлен!`);
      await loadInstallers();
      return { success: true };
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Удаление монтажника
  const removeInstaller = async (id: string) => {
    if (!confirm('Удалить этого сотрудника из системы?')) return;

    setIsLoading(true);
    try {
      // Отправляем запрос на наш новый API роут для удаления
      const response = await fetch(`/api/admin/delete-installer?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при удалении');
      }

      alert('Монтажник полностью удален из системы');
      await loadInstallers(); // Обновляем список на экране
    } catch (error: any) {
      console.error('Ошибка удаления:', error.message);
      alert('Не удалось удалить: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    installers, 
    isLoading, 
    addInstaller, 
    removeInstaller 
  };
}