'use client';

import { useState, useEffect } from 'react';
import { Installer } from '@/lib/types';

const DEFAULT_INSTALLERS: Installer[] = [
  { id: '1', name: 'Иванов Иван' },
  { id: '2', name: 'Петров Петр' },
  { id: '3', name: 'Сидоров Сидор' }
];

export function useInstallers() {
  const [installers, setInstallers] = useState<Installer[]>(DEFAULT_INSTALLERS);
  const [isLoading, setIsLoading] = useState(false);

  const addInstaller = (name: string) => {
    const newInst = { id: Math.random().toString(36).substr(2, 9), name };
    setInstallers(prev => [...prev, newInst]);
  };

  const removeInstaller = (id: string) => {
    setInstallers(prev => prev.filter(i => i.id !== id));
  };

  return { installers, isLoading, addInstaller, removeInstaller };
}
