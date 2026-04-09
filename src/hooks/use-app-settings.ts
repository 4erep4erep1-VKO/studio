'use client';

import { useState, useEffect } from 'react';
import { AppSettings } from '@/lib/types';
import { useToast } from './use-toast';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({ adminPin: '1234' });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const updatePin = (newPin: string) => {
    const newSettings = { ...settings, adminPin: newPin };
    setSettings(newSettings);
    toast({
      title: "PIN-код изменен",
      description: "Новый пароль успешно сохранен.",
    });
  };

  return { settings, isLoading, updatePin };
}
