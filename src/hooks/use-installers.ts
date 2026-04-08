'use client';

import { useState, useEffect } from 'react';
import { Installer } from '@/lib/types';

const DEFAULT_INSTALLERS: Installer[] = [
  { id: '1', name: 'Иванов Иван' },
  { id: '2', name: 'Петров Петр' },
  { id: '3', name: 'Сидоров Сидор' }
];

export function useInstallers() {
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      const stored = localStorage.getItem('local_installers');
      if (stored) {
        setInstallers(JSON.parse(stored));
      } else {
        localStorage.setItem('local_installers', JSON.stringify(DEFAULT_INSTALLERS));
        setInstallers(DEFAULT_INSTALLERS);
      }
      setIsLoading(false);
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const addInstaller = (name: string) => {
    const newInst = { id: Math.random().toString(36).substr(2, 9), name };
    const updated = [...installers, newInst];
    localStorage.setItem('local_installers', JSON.stringify(updated));
    setInstallers(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const removeInstaller = (id: string) => {
    const updated = installers.filter(i => i.id !== id);
    localStorage.setItem('local_installers', JSON.stringify(updated));
    setInstallers(updated);
    window.dispatchEvent(new Event('storage'));
  };

  return { installers, isLoading, addInstaller, removeInstaller };
}
