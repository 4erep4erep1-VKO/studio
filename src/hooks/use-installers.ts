'use client';

import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Installer } from '@/lib/types';

export function useInstallers() {
  const db = useFirestore();

  const installersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'installers');
  }, [db]);

  const { data: installers, isLoading } = useCollection<Installer>(installersQuery);

  const addInstaller = (name: string) => {
    if (!db) return;
    const colRef = collection(db, 'installers');
    addDocumentNonBlocking(colRef, { name });
  };

  const removeInstaller = (id: string) => {
    if (!db) return;
    const docRef = doc(db, 'installers', id);
    deleteDocumentNonBlocking(docRef);
  };

  return { installers: installers || [], isLoading, addInstaller, removeInstaller };
}
