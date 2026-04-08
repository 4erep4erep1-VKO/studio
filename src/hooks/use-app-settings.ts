'use client';

import { useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { AppSettings } from '@/lib/types';
import { useToast } from './use-toast';
import { useEffect } from 'react';

export function useAppSettings() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const settingsRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'settings', 'app');
  }, [db]);

  const { data: settings, isLoading } = useDoc<AppSettings>(settingsRef);

  // Инициализация настроек по умолчанию, если они отсутствуют в БД
  useEffect(() => {
    // Выполняем только если данные загружены, их нет, и пользователь авторизован (хотя бы анонимно)
    if (!isLoading && !settings && settingsRef && user) {
      setDocumentNonBlocking(settingsRef, { adminPin: '1234' }, { merge: true });
    }
  }, [settings, isLoading, settingsRef, user]);

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