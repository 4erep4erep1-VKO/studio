
'use client';

import { useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { AppSettings } from '@/lib/types';
import { useToast } from './use-toast';
import { useEffect } from 'react';

export function useAppSettings() {
  const db = useFirestore();
  const { toast } = useToast();

  const settingsRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'settings', 'app');
  }, [db]);

  const { data: settings, isLoading } = useDoc<AppSettings>(settingsRef);

  // Initialize settings if they don't exist
  useEffect(() => {
    if (!isLoading && !settings && settingsRef) {
      setDocumentNonBlocking(settingsRef, { adminPin: '1234' }, { merge: true });
    }
  }, [settings, isLoading, settingsRef]);

  const updatePin = (newPin: string) => {
    if (!settingsRef) return;
    updateDocumentNonBlocking(settingsRef, { adminPin: newPin });
    toast({
      title: "PIN-код изменен",
      description: "Новый пароль успешно сохранен в облаке.",
    });
  };

  return { 
    settings: settings || { adminPin: '1234' }, 
    isLoading, 
    updatePin 
  };
}
