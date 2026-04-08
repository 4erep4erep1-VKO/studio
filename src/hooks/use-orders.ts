'use client';

import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { Order } from '@/lib/types';
import { useToast } from './use-toast';

export function useOrders(userId?: string, role?: string) {
  const db = useFirestore();
  const { toast } = useToast();

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    const baseQuery = collection(db, 'orders');
    if (role === 'installer' && userId) {
      return query(baseQuery, where('installerId', '==', userId));
    }
    return baseQuery;
  }, [db, userId, role]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const addOrder = (orderData: Partial<Order>) => {
    if (!db) return;
    const colRef = collection(db, 'orders');
    const newOrder = {
      ...orderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'В работе',
    };
    addDocumentNonBlocking(colRef, newOrder);
    toast({
      title: "Заказ создан",
      description: `Объект "${orderData.objectName}" успешно добавлен.`,
    });
  };

  const updateOrder = (orderId: string, updates: Partial<Order>) => {
    if (!db) return;
    const docRef = doc(db, 'orders', orderId);
    updateDocumentNonBlocking(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    toast({
      title: "Заказ обновлен",
    });
  };

  const deleteOrder = (id: string) => {
    if (!db) return;
    const docRef = doc(db, 'orders', id);
    deleteDocumentNonBlocking(docRef);
    toast({
      title: "Заказ удален",
      variant: "destructive",
    });
  };

  return { orders: orders || [], isLoading, addOrder, updateOrder, deleteOrder };
}
