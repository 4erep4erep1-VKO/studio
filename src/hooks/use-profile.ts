'use client';
import { useState } from 'react';

export function useProfile() {
  const [isUpdating, setIsUpdating] = useState(false);

  const updatePinCode = async (userId: string, newPin: string) => {
    if (!newPin || newPin.length < 6) {
      alert('Ошибка: ПИН должен быть 6 цифр!');
      return { success: false };
    }

    setIsUpdating(true);
    try {
      // Отправляем запрос на наш серверный API
      const response = await fetch('/api/user/update-pin', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPin }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ошибка');

      alert('ПИН-код изменен успешно!');
      return { success: true };
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
      return { success: false };
    } finally {
      setIsUpdating(false);
    }
  };

  return { updatePinCode, isUpdating };
}