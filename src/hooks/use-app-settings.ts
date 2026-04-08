
'use client';

import { useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { AppSettings } from '@/lib/types';
import { useToast } from './use-toast';

export function useAppSettings() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const settingsRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'settings', 'app');
  }, [db]);

  const { data: settings, isLoading: isDocLoading } = useDoc<AppSettings>(settingsRef);

  const updatePin = (newPin: string) => {
    if (!settingsRef || !user) return;
    updateDocumentNonBlocking(settingsRef, { adminPin: newPin });
    toast({
      title: "PIN-код изменен",
      description: "Новый пароль успешно сохранен в облаке.",
    });
  };

  return { 
    settings: settings || { adminPin: '1234' }, 
    isLoading: isDocLoading, 
    updatePin 
  };
}
