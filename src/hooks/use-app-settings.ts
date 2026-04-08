import { useState, useEffect } from 'react';
import { AppSettings } from '@/lib/types';
import { useToast } from './use-toast';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({ adminPin: '1234' });
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('creative_dispatch_settings');
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse settings');
      }
    }
  }, []);

  const updatePin = (newPin: string) => {
    const newSettings = { ...settings, adminPin: newPin };
    setSettings(newSettings);
    localStorage.setItem('creative_dispatch_settings', JSON.stringify(newSettings));
    toast({
      title: "PIN-код изменен",
      description: "Новый пароль успешно сохранен.",
    });
  };

  return { settings, updatePin };
}
