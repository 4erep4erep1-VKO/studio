import { useState, useEffect } from 'react';
import { DEFAULT_INSTALLERS } from '@/lib/types';

export function useInstallers() {
  const [installers, setInstallers] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('creative_dispatch_installers');
    if (stored) {
      try {
        setInstallers(JSON.parse(stored));
      } catch (e) {
        setInstallers(DEFAULT_INSTALLERS);
      }
    } else {
      setInstallers(DEFAULT_INSTALLERS);
      localStorage.setItem('creative_dispatch_installers', JSON.stringify(DEFAULT_INSTALLERS));
    }
  }, []);

  const addInstaller = (name: string) => {
    const newList = [...installers, name];
    setInstallers(newList);
    localStorage.setItem('creative_dispatch_installers', JSON.stringify(newList));
  };

  const removeInstaller = (name: string) => {
    const newList = installers.filter(i => i !== name);
    setInstallers(newList);
    localStorage.setItem('creative_dispatch_installers', JSON.stringify(newList));
  };

  return { installers, addInstaller, removeInstaller };
}
