'use client';

import { useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { AppSettings } from '@/lib/types';
import { useToast } from './use-toast';
import { useEffect } from 'react';

export function useAppSettings() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading: isAuthLoading } = useUser();

  const settingsRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'settings', 'app');
  }, [db]);

  const { data: settings, isLoading: isDocLoading } = useDoc<AppSettings>(settingsRef);

  // Initialize default settings if they are missing and user is signed in
  useEffect(() => {
    // Only attempt to initialize if auth is done and doc is missing
    if (!isAuthLoading && !isDocLoading && !settings && settingsRef && user) {
      setDocumentNonBlocking(settingsRef, { adminPin: '1234' }, { merge: true });
    }
  }, [settings, isDocLoading, isAuthLoading, settingsRef, user]);

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
    isLoading: isDocLoading, 
    updatePin 
  };
}