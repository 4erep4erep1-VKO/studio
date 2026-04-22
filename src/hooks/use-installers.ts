import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';

export function useInstallers() {
  const [installers, setInstallers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInstallers() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .or('role.eq.admin,role.eq.installer'); // Берем и админов, и монтажников

        if (error) throw error;
        setInstallers(data || []);
      } catch (err) {
        console.error('Ошибка при загрузке монтажников:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInstallers();
  }, []);

  return { installers, isLoading };
}