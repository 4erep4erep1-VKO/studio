'use client';

import { useState, useEffect } from 'react';
import { AppSettings } from '@/lib/types';
import { useToast } from './use-toast';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({ adminPin: '1234' });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('local_settings');
    if (stored) {
      setSettings(JSON.parse(stored));
    }
    setIsLoading(false);
  }, []);

  const updatePin = (newPin: string) => {
    const newSettings = { ...settings, adminPin: newPin };
    localStorage.setItem('local_settings', JSON.stringify(newSettings));
    setSettings(newSettings);
    toast({
      title: "PIN-код изменен",
      description: "Новый пароль успешно сохранен локально.",
    });
  };

  return { settings, isLoading, updatePin };
}
